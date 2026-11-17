import test from 'node:test';
import assert from 'node:assert/strict';
import { startGoldenHorizonCheckout, cityscape } from '../netlify/lib/golden-horizon-live.mjs';

const env={HUGS_PRINT_LIVE_LEDGER:'true',HUGS_PRINT_LIVE_CHECKOUT:'true',
 HUGS_PRINT_STRIPE_LIVE_KEY:['rk','live','fixture'].join('_'),HUGS_PRINT_STRIPE_LIVE_WEBHOOK_SECRET:'whsec_fixture',
 HUGS_PRINT_LIVE_QUOTE_SECRET:'quote fixture secret 1234567890123456',HUGS_PRINT_LIVE_ORIGIN:'https://gallery.example.com',
 HUGS_PRINT_LIVE_ADMIN_TOKEN:'admin fixture token 12345678901234567'};
const ctx={deploy:{context:'production'}};
const address={line1:'350 Fifth Avenue',city:'New York',state:'NY',postal_code:'10118',country:'US'};
const body={quoteId:'a'.repeat(32),address,shippingService:'Economy',shippingCents:695,supplierQuoteRef:'FW quote 001'};
function fixture({tax=true}={}){
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
  context,{env,now:()=>100_000,makeStripe:()=>stripe,makeStore:()=>store});
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
