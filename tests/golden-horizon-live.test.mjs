import test from 'node:test';
import assert from 'node:assert/strict';
import {collectorEdition} from '../netlify/lib/collector-live.mjs';
import { startGoldenHorizonCheckout, cityscape } from '../netlify/lib/golden-horizon-live.mjs';

const env={HUGS_PRINT_LIVE_LEDGER:'true',HUGS_PRINT_LIVE_CHECKOUT:'true',
 HUGS_PRINT_STRIPE_LIVE_KEY:['rk','live','fixture'].join('_'),HUGS_PRINT_STRIPE_LIVE_WEBHOOK_SECRET:'whsec_fixture',
 HUGS_PRINT_LIVE_QUOTE_SECRET:'quote fixture secret 1234567890123456',HUGS_PRINT_LIVE_ORIGIN:'https://gallery.example.com',
 HUGS_PRINT_LIVE_ADMIN_TOKEN:'admin fixture token 12345678901234567'};
const ctx={deploy:{context:'production'}};
const address={line1:'350 Fifth Avenue',city:'New York',state:'NY',postal_code:'10118',country:'US'};
const body={quoteId:'a'.repeat(32),address,shippingService:'Economy',shippingCents:695,supplierQuoteRef:'FW quote 001'};
function fixture({tax=true,edition=cityscape,findPrintRequest}={}){
 let record,config,calls=0;
 const stripe={tax:{settings:{retrieve:async()=>({livemode:true,status:'active'})},
  registrations:{list:async()=>({data:tax?[{livemode:true,status:'active',country:'US',country_options:{us:{state:'NY'}}}]:[]})}},
  checkout:{sessions:{create:async(p,opts)=>{calls++;config=p;
   assert.equal(opts.idempotencyKey,'hl-gallery-cityscape-'+body.quoteId);
   return{livemode:true,status:'open',id:'cs_live_fixture',url:'https://checkout.stripe.com/c/pay/cs_live_fixture'};
  }}}};
 const store={setJSON:async(_key,val,opts)=>{if(!opts?.onlyIfNew||!record)record=val},get:async()=>record};
 const invoke=(payload=body,context=ctx,token=env.HUGS_PRINT_LIVE_ADMIN_TOKEN)=>startGoldenHorizonCheckout(
  new Request('https://gallery.example.com/checkout',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(payload)}),
  context,{edition,...(findPrintRequest?{findPrintRequest}:{}),env,now:()=>100_000,makeStripe:()=>stripe,makeStore:()=>store});
 return {invoke,get state(){return {record,config,calls}}};
}

test('private checkout uses the approved Stripe price, exact shipping, active tax, and stores a bound quote without the street address',async()=>{
 const f=fixture();
 assert.equal((await f.invoke({...body,priceCents:1,artworkId:'archive-eye'})).status,200);
 assert.deepEqual(f.state.config.line_items,[{price:cityscape.priceId,quantity:1}]);
 assert.equal(f.state.config.automatic_tax.enabled,true);
 assert.equal(f.state.config.shipping_options[0].shipping_rate_data.fixed_amount.amount,695);
 assert.equal(f.state.record.sku,'GH-10X8-STD-BLK');
 assert.equal(f.state.record.sessionId,'cs_live_fixture');
 assert.doesNotMatch(JSON.stringify(f.state.record),/350 Fifth/i);
 assert.equal((await f.invoke({...body,shippingCents:899})).status,409);
 assert.equal(f.state.calls,1);
});
test('unauthorized, non-production, non-NY and missing registration cannot create a Checkout Session',async()=>{
 const f=fixture({tax:false});
 assert.equal((await f.invoke(body,ctx,'not-the-token')).status,401);
 assert.equal((await f.invoke(body,{deploy:{context:'deploy-preview'}})).status,404);
 assert.equal((await f.invoke({...body,address:{...address,state:'NJ'}})).status,400);
 assert.equal((await f.invoke(body)).status,503);
 assert.equal(f.state.calls,0);
});

test('collector edition requires a verified supplier cost, protects margin, and uses its own live Price',async()=>{
 const f=fixture({edition:collectorEdition});
 for(const supplierCostCents of [undefined,14800])assert.equal((await f.invoke({...body,supplierCostCents})).status,422);
 assert.equal(f.state.calls,0);
 assert.equal((await f.invoke({...body,supplierCostCents:12800,priceCents:1})).status,200);
 assert.deepEqual(f.state.config.line_items,[{price:collectorEdition.priceId,quantity:1}]);
 assert.equal(f.state.record.printCents,34900);
 assert.equal(f.state.record.supplierCostCents,12800);
 assert.equal(f.state.record.editionId,'city-holds-breath-20x16-framed');
 assert.equal(f.state.config.cancel_url,'https://gallery.example.com/the-city-holds-its-breath.html');
 assert.equal((await f.invoke({...body,supplierCostCents:12900})).status,409);
});

test('linked buyer request locks the edition and ZIP and records a quote without storing its payment URL',async()=>{
 let quoted;
 const f=fixture({findPrintRequest:async (ref,editionId)=>{
  assert.equal(ref,body.quoteId);assert.equal(editionId,cityscape.editionId);
  return {record:{email:'buyer@example.com',zip:'10118'},store:{setJSON:async (key,value)=>{quoted={key,value}}}};
 }});
 assert.equal((await f.invoke({...body,requestId:'b'.repeat(32)})).status,422);
 assert.equal((await f.invoke({...body,requestId:body.quoteId,address:{...address,postal_code:'10001'}})).status,409);
 assert.equal((await f.invoke({...body,requestId:body.quoteId})).status,200);
 assert.equal(f.state.config.customer_email,'buyer@example.com');
 assert.equal(f.state.record.requestId,body.quoteId);
 assert.equal(quoted.key,'quoted:'+body.quoteId);
 assert.deepEqual(Object.keys(quoted.value),['createdAt']);
});
