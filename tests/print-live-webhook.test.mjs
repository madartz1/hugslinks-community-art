import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {handleLivePrintWebhook} from '../netlify/lib/print-live-webhook.mjs';

const env={HUGS_PRINT_LIVE_LEDGER:'true',HUGS_PRINT_STRIPE_LIVE_KEY:['rk','live','fixture'].join('_'),HUGS_PRINT_STRIPE_LIVE_WEBHOOK_SECRET:'whsec_fixture'};
const ctx={deploy:{context:'production'}};
const ref='0'.repeat(32),id='cs_live_fixture';
const quote={approved:true,currency:'usd',sessionId:id,editionId:'swan-18x22-black-floater',artworkId:'archive-eye',sku:'AP108137P700682',revision:'r1',shippingService:'ground',printCents:49900,shippingCents:2745};
const base={id,mode:'payment',livemode:true,currency:'usd',payment_status:'paid',metadata:{hugs_print:'hl-print-live-v1',quote_id:ref},total_details:{amount_tax:3200,amount_discount:0},amount_subtotal:52645,amount_total:55845,customer_details:{email:'buyer@example.com'}};
function fixture({session=base,type='checkout.session.completed',live=true,forQuote=quote,metadata=base.metadata,validSig=true}={}){
 let writes=0,order,reads=0;
 const payload=JSON.stringify({type,livemode:live,data:{object:{id,metadata}}});
 const header=Stripe.webhooks.generateTestHeaderString({payload,secret:env.HUGS_PRINT_STRIPE_LIVE_WEBHOOK_SECRET});
 const stripe={webhooks:Stripe.webhooks,checkout:{sessions:{retrieve:async()=>{reads++;return session}}}};
 const store={get:async key=>{assert.equal(key,'quote:'+ref);return forQuote},
  setJSON:async(key,value,opts)=>{assert.equal(key,'order:'+id);assert.equal(opts.onlyIfNew,true);
   if(order)return{modified:false};order=value;writes++;return{modified:true}
  }};
 const invoke=(context=ctx,injected={})=>handleLivePrintWebhook(new Request('https://example.com/live',{method:'POST',headers:{'stripe-signature':validSig?header:'invalid'},body:payload}),context,{env,makeStripe:()=>stripe,makeStore:()=>store,now:()=>1,...injected});
 return {invoke,get state(){return{writes,reads,order}}};
}

test('production live ledger is disabled by default, even with keys, and never accepts preview',async()=>{
 const f=fixture();
 assert.equal((await f.invoke({deploy:{context:'deploy-preview'}})).status,404);
 assert.equal((await f.invoke(ctx,{env:{...env,HUGS_PRINT_LIVE_LEDGER:undefined}})).status,404);
 assert.equal((await f.invoke(ctx,{env:{...env,HUGS_PRINT_STRIPE_LIVE_KEY:'rk_test_fixture'}})).status,503);
 assert.equal(f.state.reads,0);
});
test('one signed paid session creates one manual hold on replay with tax and without customer data',async()=>{
 const f=fixture();
 assert.deepEqual((await Promise.all([f.invoke(),f.invoke()])).map(r=>r.status),[200,200]);
 assert.equal(f.state.writes,1);
 assert.equal(f.state.order.fulfillment,'manual_hold');
 assert.equal(f.state.order.taxCents,3200);
 assert.equal(f.state.order.totalCents,55845);
 assert.doesNotMatch(JSON.stringify(f.state.order),/buyer@example/);
});
test('bad signature, sandbox event, unrelated payment and async failure never read a Checkout Session',async()=>{
 for(const scenario of [{validSig:false},{live:false},{metadata:{}},{type:'checkout.session.async_payment_failed'}]){
  const f=fixture(scenario);
  await f.invoke();
  assert.equal(f.state.reads,0);assert.equal(f.state.writes,0);
 }
});
test('unpaid events, mismatched totals and missing approved quote do not produce orders',async()=>{
 for(const [scenario,status] of [[{session:{...base,payment_status:'unpaid'}},200],[{session:{...base,amount_total:1200}},409],[{forQuote:null},503],[{forQuote:{...quote,sessionId:'cs_live_other'}},503]]){
  const f=fixture(scenario);
  assert.equal((await f.invoke()).status,status);assert.equal(f.state.writes,0);
 }
});

test('cityscape pilot keeps the order on manual hold and flags a changed address or incomplete tax',async()=>{
 const {canonicalDestination,destinationSeal}=await import('../netlify/lib/golden-horizon-live.mjs');
 const addr={line1:'350 Fifth Avenue',city:'New York',state:'NY',postal_code:'10118',country:'US'};
 const secret='quote fixture secret 1234567890123456';
 const forQuote={...quote,destinationSeal:destinationSeal(canonicalDestination(addr),secret)};
 for(const [address,taxStatus,expected] of [[addr,'complete','paid_awaiting_fulfillment'],[{...addr,line2:'Unit 2'},'complete','paid_needs_review'],[addr,'requires_location_inputs','paid_needs_review']]){
  const session={...base,amount_subtotal:quote.printCents,total_details:{...base.total_details,amount_shipping:quote.shippingCents},
   collected_information:{shipping_details:{address}},automatic_tax:{status:taxStatus}};
  const f=fixture({session,forQuote});
  const response=await f.invoke(ctx,{env:{...env,HUGS_PRINT_LIVE_QUOTE_SECRET:secret}});
  assert.equal(response.status,200);assert.equal(f.state.order.status,expected);
  assert.equal(f.state.order.fulfillment,'manual_hold');
 }
});

test('linked paid Checkout Session passes a verified held order to the request queue',async()=>{
 let linked;
 const requestId='a'.repeat(32),f=fixture({forQuote:{...quote,requestId}});
 const response=await f.invoke(ctx,{recordPaid:async(id,order)=>{linked={id,order}}});
 assert.equal(response.status,200);
 assert.equal(linked.id,requestId);
 assert.equal(linked.order.requestId,requestId);
 assert.equal(linked.order.fulfillment,'manual_hold');
});
