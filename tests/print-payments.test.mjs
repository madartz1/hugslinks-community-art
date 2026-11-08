import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {handlePayments,signQuote,readQuote,validSession,PRICE} from '../netlify/lib/print-payments.mjs';
const url='https://deploy-preview-4--hugslinks-community-art.netlify.app/.netlify/functions/art-print-payments';
const env={STRIPE_SECRET_KEY:'sk_test_dummy',HUGS_PRINT_QUOTE_SECRET:'quote-secret',FINERWORKS_TEST_WEB_API_KEY:'fixture-web',FINERWORKS_TEST_APP_KEY:'fixture-app',HUGS_PRINT_CHECKOUT_ADMIN_TOKEN:'admin'};
const ctx={deploy:{context:'deploy-preview',id:'test'}};
const addr={first_name:'Test',last_name:'Buyer',address_1:'1 Test Street',city:'New York',state_code:'NY',zip_postal_code:'10001',phone:'2125550100'};
const req=(action,body,headers={})=>new Request(url+'?action='+action,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
const good={id:'cs_test_example',livemode:false,currency:'usd',amount_total:47208,payment_status:'paid',metadata:{hugs_print:'swan-test-v1',sku:'AP108137P696597',price:'44449',shipping:'2759'}};
const store={get:async()=>({secret:'whsec_test'}),setJSON:async()=>{}};
const defaults={env,makeStore:()=>store};
test('production and live keys fail closed before Stripe access',async()=>{
 const deps={...defaults,makeStripe:()=>{throw Error('must not call')}};
 assert.equal((await handlePayments(req('config'),{deploy:{context:'production'}},deps)).status,404);
 assert.equal((await handlePayments(req('config'),ctx,{...deps,env:{...env,STRIPE_SECRET_KEY:'sk_live_dummy'}})).status,503);
});
test('quote rejects tampered amounts, invalid MACs and expired quotes',()=>{
 const q={sku:'AP108137P696937',price:PRICE,shipping:2759,nonce:'random',expires:1000};
 const token=signQuote(q,'secret');assert.equal(readQuote(token,'secret',999).shipping,2759);
 assert.throws(()=>readQuote(token,'secret',1001));assert.throws(()=>readQuote(token,'wrong',999));
 assert.throws(()=>readQuote(signQuote({...q,price:1},'secret'),'secret',999));
 assert.throws(()=>readQuote(signQuote({...q,sku:'AP108137P696597'},'secret'),'secret',999));
});
function supplierReply(request,rate=27.59){const order=JSON.parse(request.body).orders[0];return Response.json({status:{success:true},orders:[{order_po:order.order_po,options:[{id:78,rate,shipping_method:'Standard - Ship in Tube Preferred',transit_time:'1–5 days <a>map</a>'}]}]})}

test('shipping quotes the current Swan SKU directly in test mode and never accepts buyer pricing',async()=>{
 let sent;const res=await handlePayments(req('quote',{recipient:addr,price:1,sku:'AP108137P696597'}),ctx,{...defaults,makeStripe:()=>({}),fetcher:async(u,o)=>{assert.equal(u,'https://v2.api.finerworks.com/v3/list_shipping_options_multiple');sent=JSON.parse(o.body).orders[0];return supplierReply(o)}});
 const result=await res.json();assert.equal(sent.test_mode,true);assert.equal(sent.order_items[0].product_sku,'AP108137P696937');assert.equal(sent.recipient.zip_postal_code,addr.zip_postal_code);assert.equal(result.options[0].totalCents,47208);assert.doesNotMatch(result.options[0].transitTime,/<a>/);const q=readQuote(result.options[0].quote,env.HUGS_PRINT_QUOTE_SECRET);assert.equal(q.price,44449);assert.equal(q.sku,'AP108137P696937');
});
test('checkout locks artwork and shipping amounts, customer address and idempotency',async()=>{
 let params,customer;const stripe={customers:{create:async p=>{customer=p;return{id:'cus_test'}}},checkout:{sessions:{create:async p=>{params=p;return{livemode:false,url:'https://checkout.stripe.com/c/pay/test'}}}}};
 const q=signQuote({sku:'AP108137P696937',price:PRICE,shipping:2759,method:'Ground',recipient:addr,nonce:'abcdefgh',expires:Date.now()+10000,shippingId:'78'},env.HUGS_PRINT_QUOTE_SECRET);
 const res=await handlePayments(req('checkout',{quote:q,price:1}),ctx,{...defaults,makeStripe:()=>stripe});assert.equal(res.status,200);assert.equal(params.line_items[0].price_data.unit_amount,44449);assert.equal(params.line_items[1].price_data.unit_amount,2759);assert.equal(params.metadata.hugs_fulfillment,'test-hold');assert.equal(customer.shipping.address.line1,addr.address_1);assert.equal(params.payment_method_types,undefined);
});
test('invalid webhook signatures cannot change payment records',async()=>{
 let changed=false;const stripe=new Stripe('sk_test_dummy');stripe.checkout.sessions.update=async()=>{changed=true};
 const res=await handlePayments(req('webhook',{id:'fake'}),ctx,{...defaults,makeStripe:()=>stripe});assert.equal(res.status,400);assert.equal(changed,false);
});
test('paid webhook verifies amounts, holds fulfillment and repeats idempotently',async()=>{
 let updates=[];const stripe=new Stripe('sk_test_dummy');stripe.checkout.sessions.retrieve=async()=>good;stripe.checkout.sessions.update=async(...p)=>updates.push(p);
 const event=JSON.stringify({id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{id:good.id}}});const signature=Stripe.webhooks.generateTestHeaderString({payload:event,secret:'whsec_test'});
 const invoke=()=>handlePayments(new Request(url+'?action=webhook',{method:'POST',headers:{'stripe-signature':signature},body:event}),ctx,{...defaults,makeStripe:()=>stripe});
 assert.equal((await invoke()).status,200);assert.equal((await invoke()).status,200);assert.equal(updates[0][1].metadata.hugs_fulfillment,'test-hold');assert.equal(updates[0][2].idempotencyKey,updates[1][2].idempotencyKey);
 stripe.checkout.sessions.retrieve=async()=>({...good,amount_total:1});assert.equal((await invoke()).status,400);assert.equal(updates.length,2);
});

test('restored gallery previews are accepted and the released temporary hostname is rejected',async()=>{
 const deps={...defaults,makeStripe:()=>({})};
 assert.equal((await handlePayments(req('config'),ctx,deps)).status,200);
 const old=new Request('https://deploy-preview-1--hl-art-gallery.netlify.app/.netlify/functions/art-print-payments?action=config');
 assert.equal((await handlePayments(old,ctx,deps)).status,400);
});

test('one stable sandbox webhook is reused across preview rebuilds',async()=>{
 let saved,created=0;const makeStore=()=>({get:async()=>saved||null,setJSON:async(k,v)=>{saved=v}});
 const stripe={webhookEndpoints:{create:async(p,o)=>{created++;assert.equal(p.url,url+'?action=webhook');assert.equal(o.idempotencyKey,'hugs-print-preview-4-webhook-v2');return{id:'we_test',secret:'whsec_new',livemode:false}}}};
 const deps={...defaults,makeStore,makeStripe:()=>stripe};
 assert.equal((await handlePayments(req('setup',{}, {'x-hugs-checkout-admin':'wrong'}),ctx,deps)).status,401);
 assert.equal((await handlePayments(req('setup',{}, {'x-hugs-checkout-admin':'admin'}),ctx,deps)).status,200);
 const rebuilt={deploy:{context:'deploy-preview',id:'new-build'}};
 const config=await(await handlePayments(req('config'),rebuilt,deps)).json();assert.equal(config.enabled,true);
 assert.equal((await handlePayments(req('setup',{}, {'x-hugs-checkout-admin':'admin'}),rebuilt,deps)).status,200);assert.equal(created,1);
});
test('endpoint limit does not delete other sandbox webhooks',async()=>{
 const stripe={webhookEndpoints:{create:async()=>{throw Error('Too many webhook endpoints')},list:async()=>({data:[]}),del:async()=>assert.fail('Do not delete existing webhooks')}};
 const result=await handlePayments(req('setup',{}, {'x-hugs-checkout-admin':'admin'}),ctx,{...defaults,makeStripe:()=>stripe,makeStore:()=>({get:async()=>null})});
 assert.equal(result.status,502);assert.equal((await result.json()).setupError,'webhook-endpoint-limit');
});
test('without a webhook, live supplier quotes can be checked but payments cannot start',async()=>{
 const deps={...defaults,makeStripe:()=>({}),makeStore:()=>({get:async()=>null}),fetcher:async(u,o)=>supplierReply(o)};
 assert.equal((await handlePayments(req('quote',{recipient:addr}),ctx,deps)).status,200);
 assert.equal((await handlePayments(req('checkout',{quote:'fake'}),ctx,deps)).status,503);
});
test('payment status returns totals without customer details and requires actual payment to verify',async()=>{
 const status=(s)=>handlePayments(req('status&session_id='+good.id),ctx,{...defaults,makeStripe:()=>({checkout:{sessions:{retrieve:async()=>s}}})});
 const s={...good,customer_details:{email:'private@example.com'},metadata:{...good.metadata,hugs_test_payment_verified:'true'}};
 const paid=await(await status(s)).json();assert.deepEqual(paid,{testOnly:true,paid:true,webhookVerified:true,priceCents:44449,shippingCents:2759,totalCents:47208,fulfillment:'test-hold'});
 assert.equal((await(await status({...s,payment_status:'unpaid'})).json()).webhookVerified,false);
});

test('a full sandbox can migrate the exact legacy gallery webhook without deleting anything',async()=>{
 const deploy='0123456789abcdef01234567';const old={id:'we_gallery',livemode:false,status:'enabled',url:`https://${deploy}--hugslinks-community-art.netlify.app/.netlify/functions/art-print-payments?action=webhook`,metadata:{integration:'hugs-art-print-sandbox',deploy}};let updated,saved;
 const stripe={webhookEndpoints:{create:async()=>{throw Error('Webhook endpoint limit')},list:async()=>({data:[{...old,id:'other',livemode:true},{...old,id:'wrong-config'},old]}),update:async(id,p)=>{updated={id,...p}},del:async()=>assert.fail('Do not delete endpoints')}};
 const result=await handlePayments(req('setup',{}, {'x-hugs-checkout-admin':'admin'}),ctx,{...defaults,makeStripe:()=>stripe,makeStore:()=>({get:async()=>null,setJSON:async(k,v)=>{saved=v}}),readLegacyWebhook:async id=>{assert.equal(id,deploy);return{id:old.id,secret:'whsec_existing'}}});
 assert.equal(result.status,200);assert.equal(updated.id,old.id);assert.equal(updated.url,url+'?action=webhook');assert.deepEqual(saved,{id:old.id,secret:'whsec_existing'});
});

const secondEdition={id:'fixture-canvas-12x14',artworkId:'archive-eye',width:12,height:14,material:'Test canvas',finish:'Unmounted',sku:'FIXTURE123456',priceCents:12500};
const multiEnv={...env,HUGS_PRINT_TEST_EDITIONS_JSON:JSON.stringify([secondEdition]),FINERWORKS_TEST_WEB_API_KEY:'fixture-web',FINERWORKS_TEST_APP_KEY:'fixture-app'};

test('configured sizes expose only customer-facing details and unknown sizes are rejected',async()=>{
 const deps={...defaults,env:multiEnv,makeStripe:()=>({}),fetcher:async()=>assert.fail('No supplier lookup for an unknown size')};
 const config=await(await handlePayments(req('config'),ctx,deps)).json();assert.equal(config.editions.length,2);assert.equal(config.editions[1].priceCents,12500);assert(!JSON.stringify(config).includes(secondEdition.sku));assert(!JSON.stringify(config).includes('fixture-web'));
 assert.equal((await handlePayments(req('quote',{editionId:'not-configured',recipient:addr}),ctx,deps)).status,400);
});

test('a second size uses its own test SKU and server price through quote, checkout and receipt validation',async()=>{
 let checkout;const deps={...defaults,env:multiEnv,makeStripe:()=>({customers:{create:async()=>({id:'cus_test'})},checkout:{sessions:{create:async p=>{checkout=p;return{livemode:false,url:'https://checkout.stripe.com/c/pay/fixture'}}}}}),fetcher:async(u,o)=>{
  assert.equal(u,'https://v2.api.finerworks.com/v3/list_shipping_options_multiple');const order=JSON.parse(o.body).orders[0];assert.equal(order.test_mode,true);assert.equal(order.order_items[0].product_sku,secondEdition.sku);
  return Response.json({status:{success:true},orders:[{order_po:order.order_po,options:[{id:78,rate:8.95,shipping_method:'Ground'}]}]});
 }};
 const quote=await(await handlePayments(req('quote',{editionId:secondEdition.id,recipient:addr,sku:'wrong',price:1}),ctx,deps)).json();assert.equal(quote.priceCents,12500);assert.equal(quote.options[0].totalCents,13395);
 assert.equal((await handlePayments(req('checkout',{quote:quote.options[0].quote,editionId:'swan-36x43'}),ctx,deps)).status,200);assert.equal(checkout.line_items[0].price_data.unit_amount,12500);assert.match(checkout.line_items[0].price_data.product_data.name,/12 × 14/);assert.equal(checkout.metadata.sku,secondEdition.sku);assert.equal(checkout.metadata.hugs_fulfillment,'test-hold');
 const paid={livemode:false,currency:'usd',amount_total:13395,metadata:checkout.metadata};assert.equal(validSession(paid,multiEnv.HUGS_PRINT_QUOTE_SECRET),true);assert.equal(validSession({...paid,metadata:{...paid.metadata,sku:'different'}},multiEnv.HUGS_PRINT_QUOTE_SECRET),false);
 const changed={...multiEnv,HUGS_PRINT_TEST_EDITIONS_JSON:JSON.stringify([{...secondEdition,width:13}])};assert.equal((await handlePayments(req('checkout',{quote:quote.options[0].quote}),ctx,{...deps,env:changed})).status,400);
});

test('duplicate SKUs or invalid prices cannot appear in the sandbox catalog',async()=>{
 const deps={...defaults,makeStripe:()=>({})};
 for(const edit of [{sku:'AP108137P696597'},{sku:'AP108137P696937'},{priceCents:0}]){
  const invalid={...multiEnv,HUGS_PRINT_TEST_EDITIONS_JSON:JSON.stringify([{...secondEdition,...edit}])};assert.equal((await handlePayments(req('config'),ctx,{...deps,env:invalid})).status,502);
 }
});

test('without gallery supplier keys there is no stale quote or checkout, and old paid receipts remain readable',async()=>{
 const deps={...defaults,env:{...env,FINERWORKS_TEST_APP_KEY:undefined},fetcher:async()=>assert.fail('Do not call the retired bridge'),makeStripe:()=>({customers:{create:async()=>assert.fail('Do not start a payment without supplier keys')},checkout:{sessions:{retrieve:async()=>({...good,metadata:{...good.metadata,hugs_test_payment_verified:'true'}})}}})};
 const config=await(await handlePayments(req('config'),ctx,deps)).json();assert.equal(config.enabled,false);assert.equal(config.editions[0].quoteAvailable,false);assert.equal(config.editions[0].priceCents,44449);
 assert.equal((await handlePayments(req('quote',{recipient:addr}),ctx,deps)).status,503);assert.equal((await handlePayments(req('checkout',{quote:'previous'}),ctx,deps)).status,503);
 const receipt=await(await handlePayments(req('status&session_id='+good.id),ctx,deps)).json();assert.equal(receipt.webhookVerified,true);
});
