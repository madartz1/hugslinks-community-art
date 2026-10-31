import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {handlePayments,signQuote,readQuote,PRICE} from '../netlify/lib/print-payments.mjs';
const url='https://deploy-preview-1--hugslinks-community-art.netlify.app/.netlify/functions/art-print-payments';
const env={STRIPE_SECRET_KEY:'sk_test_dummy',HUGS_PRINT_QUOTE_SECRET:'quote-secret',HUGS_PRINT_BRIDGE_PREVIEW_TOKEN:'bridge',HUGS_PRINT_CHECKOUT_ADMIN_TOKEN:'admin'};
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
 const q={sku:'AP108137P696597',price:PRICE,shipping:2759,nonce:'random',expires:1000};
 const token=signQuote(q,'secret');assert.equal(readQuote(token,'secret',999).shipping,2759);
 assert.throws(()=>readQuote(token,'secret',1001));assert.throws(()=>readQuote(token,'wrong',999));
 assert.throws(()=>readQuote(signQuote({...q,price:1},'secret'),'secret',999));
});
test('shipping uses supplier rates and server SKU, strips HTML and never accepts buyer price',async()=>{
 let sent;const res=await handlePayments(req('quote',{recipient:addr,price:1,sku:'wrong'}),ctx,{...defaults,makeStripe:()=>({}),fetcher:async(u,o)=>{sent=JSON.parse(o.body);return Response.json({ok:true,options:[{id:'78',automationReady:true,rateCents:2759,method:'Ground',transitTime:'1–5 days <a>map</a>'}]})}});
 const result=await res.json();assert.equal(sent.action,'shipping');assert.equal(result.options[0].totalCents,47208);assert.doesNotMatch(result.options[0].transitTime,/<a>/);const q=readQuote(result.options[0].quote,env.HUGS_PRINT_QUOTE_SECRET);assert.equal(q.price,44449);assert.equal(q.sku,'AP108137P696597');
});
test('checkout locks artwork and shipping amounts, customer address and idempotency',async()=>{
 let params,customer;const stripe={customers:{create:async p=>{customer=p;return{id:'cus_test'}}},checkout:{sessions:{create:async p=>{params=p;return{livemode:false,url:'https://checkout.stripe.com/c/pay/test'}}}}};
 const q=signQuote({sku:'AP108137P696597',price:PRICE,shipping:2759,method:'Ground',recipient:addr,nonce:'abcdefgh',expires:Date.now()+10000,shippingId:'78'},env.HUGS_PRINT_QUOTE_SECRET);
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
