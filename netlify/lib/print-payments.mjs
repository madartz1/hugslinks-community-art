import Stripe from 'stripe';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDeployStore } from '@netlify/blobs';

export const PRICE = 44449;
const SUPPLIER = 'https://6ae3b6b6aca9dac0b568f87f--hugslinks-ai-ecom.netlify.app/.netlify/functions/art-print-sandbox';
const SKU = 'AP108137P696597';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)};
const hmac=(value,secret)=>createHmac('sha256',secret).update(value).digest('base64url');
export function signQuote(data,secret){const b=Buffer.from(JSON.stringify(data)).toString('base64url');return b+'.'+hmac(b,secret)}
export function readQuote(token,secret,now=Date.now()){
 if(typeof token!=='string'||token.length>6000)throw Error('Invalid quote');
 const [b,s,extra]=token.split('.');if(extra||!equal(s,hmac(b,secret)))throw Error('Invalid quote');
 const q=JSON.parse(Buffer.from(b,'base64url'));if(q.expires<now||q.price!==PRICE||q.sku!==SKU||!Number.isSafeInteger(q.shipping)||q.shipping<0||q.shipping>100000||typeof q.nonce!=='string')throw Error('Expired or invalid quote');return q;
}
export function cleanRecipient(v){
 const states='AL AZ AR CA CO CT DC DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
 const clean=(s,n)=>typeof s==='string'&&s.trim().length<=n?s.trim():'';
 const a={first_name:clean(v?.first_name,50),last_name:clean(v?.last_name,50),address_1:clean(v?.address_1,100),address_2:clean(v?.address_2,100),city:clean(v?.city,60),state_code:clean(v?.state_code,2).toUpperCase(),zip_postal_code:clean(v?.zip_postal_code,10),phone:clean(v?.phone,25),country_code:'us'};
 if(!a.first_name||!a.last_name||!a.address_1||!a.city||!states.includes(a.state_code)||!/^\d{5}(-\d{4})?$/.test(a.zip_postal_code)||!/^[-+() .0-9]{7,25}$/.test(a.phone))throw Error('Enter a complete contiguous-US delivery address and phone number.');return a;
}
const plain=s=>String(s||'').replace(/<[^>]*>/g,'').slice(0,160);
export function validSession(s){return s?.livemode===false&&s.currency==='usd'&&s.metadata?.hugs_print==='swan-test-v1'&&s.metadata?.sku===SKU&&Number(s.metadata?.price)===PRICE&&Number.isSafeInteger(Number(s.metadata?.shipping))&&Number(s.metadata.shipping)>=0&&s.amount_total===PRICE+Number(s.metadata.shipping)}
export async function handlePayments(request,context,{env=process.env,fetcher=fetch,makeStripe=key=>new Stripe(key,{apiVersion:'2026-09-30.endive'}),makeStore=()=>getDeployStore({name:'print-checkout-config',consistency:'strong'}),now=()=>Date.now()}={}){
 if(context?.deploy?.context!=='deploy-preview')return json({error:'Not found'},404);
 const action=new URL(request.url).searchParams.get('action')||'config';
 const key=env.STRIPE_SECRET_KEY?.trim(),secret=env.HUGS_PRINT_QUOTE_SECRET;
 if(!/^(sk|rk)_test_/.test(key||'')||!secret||!env.HUGS_PRINT_BRIDGE_PREVIEW_TOKEN)return json({enabled:false,testOnly:true,error:!key?'Stripe sandbox key is missing':!/^(sk|rk)_test_/.test(key)?'Stripe key must be a sandbox test key':!secret?'Quote signing secret is missing':'Supplier bridge is not configured'},503);
 const stripe=makeStripe(key),store=makeStore();
 const origin=new URL(request.url).origin;
 if(!/^https:\/\/(?:[a-z0-9-]+--)?hugslinks-community-art\.netlify\.app$/.test(origin))return json({error:'Unsupported preview host'},400);
 if(!['config','status'].includes(action)&&request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&action!=='webhook'&&request.headers.get('origin')&&request.headers.get('origin')!==origin)return json({error:'Invalid origin'},403);
 try{
  const webhook=await store.get('webhook',{type:'json'});
  if(action==='config')return json({enabled:!!webhook?.secret,testOnly:true,priceCents:PRICE,shippingCalculated:true,fulfillment:'test-hold',taxCalculated:false});
  if(action==='setup'){
   if(!equal(request.headers.get('x-hugs-checkout-admin'),env.HUGS_PRINT_CHECKOUT_ADMIN_TOKEN))return json({error:'Unauthorized'},401);
   if(webhook?.secret)return json({ok:true,testOnly:true,webhookReady:true});
   const hook=await stripe.webhookEndpoints.create({url:origin+'/.netlify/functions/art-print-payments?action=webhook',enabled_events:['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'],metadata:{integration:'hugs-art-print-sandbox',deploy:context.deploy.id||'preview'}});
   try{await store.setJSON('webhook',{secret:hook.secret,id:hook.id})}catch(e){await stripe.webhookEndpoints.del(hook.id);throw e}
   return json({ok:true,testOnly:true,webhookReady:true});
  }
  if(action==='webhook'){
   if(!webhook?.secret)return json({error:'Webhook not configured'},503);
   let event;try{event=stripe.webhooks.constructEvent(await request.text(),request.headers.get('stripe-signature'),webhook.secret)}catch{return json({error:'Invalid signature'},400)}
   if(event.livemode!==false)return json({error:'Live events are not accepted'},400);
   if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type))return json({received:true});
   const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
   if(!validSession(session))return json({error:'Unexpected payment details'},400);
   if(event.type==='checkout.session.async_payment_failed')return json({received:true});
   if(session.payment_status!=='paid')return json({received:true,pending:true});
   await stripe.checkout.sessions.update(session.id,{metadata:{hugs_test_payment_verified:'true',hugs_fulfillment:'test-hold'}},{idempotencyKey:'hugs-print-verified-'+session.id});
   return json({received:true,testOnly:true});
  }
  if(action==='status'){
   const id=new URL(request.url).searchParams.get('session_id');if(!/^cs_test_[a-zA-Z0-9]+$/.test(id||''))return json({error:'Invalid session'},400);
   const s=await stripe.checkout.sessions.retrieve(id);if(!validSession(s))return json({error:'Unknown print test'},404);
   return json({testOnly:true,paid:s.payment_status==='paid',webhookVerified:s.metadata.hugs_test_payment_verified==='true',fulfillment:'test-hold'});
  }
  if(!webhook?.secret)return json({error:'Test checkout is being configured'},503);
  let body;try{const raw=await request.text();if(raw.length>8000)return json({error:'Request too large'},413);body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
  if(action==='quote'){
   let recipient;try{recipient=cleanRecipient(body.recipient)}catch(e){return json({error:e.message},400)}
   const res=await fetcher(SUPPLIER,{method:'POST',headers:{'content-type':'application/json','x-hugs-print-test-token':env.HUGS_PRINT_BRIDGE_PREVIEW_TOKEN},body:JSON.stringify({action:'shipping',recipient}),signal:AbortSignal.timeout(12000)});
   const data=await res.json();if(!res.ok||!data.ok)return json({error:'Shipping quote unavailable. Check the address and try again.'},502);
   const valid=(data.options||[]).filter(o=>o.automationReady&&Number.isSafeInteger(o.rateCents)&&o.rateCents>=0&&o.rateCents<=100000);
   if(!valid.length)return json({error:'No shipping method available for this address.'},422);
   const options=valid.map(o=>{const q={sku:SKU,price:PRICE,shipping:o.rateCents,method:plain(o.method),shippingId:o.id,recipient,expires:now()+15*60*1000,nonce:randomBytes(16).toString('hex')};return {method:q.method,shippingCents:q.shipping,totalCents:PRICE+q.shipping,transitTime:plain(o.transitTime),quote:signQuote(q,secret)}});
   return json({testOnly:true,priceCents:PRICE,options});
  }
  if(action==='checkout'){
   let q;try{q=readQuote(body.quote,secret,now())}catch{return json({error:'The quote expired or changed. Calculate shipping again.'},400)}
   const r=q.recipient;
   const customer=await stripe.customers.create({name:r.first_name+' '+r.last_name,shipping:{name:r.first_name+' '+r.last_name,phone:r.phone,address:{line1:r.address_1,line2:r.address_2||undefined,city:r.city,state:r.state_code,postal_code:r.zip_postal_code,country:'US'}},metadata:{hugs_sandbox:'art-print'}},{idempotencyKey:'hugs-print-customer-'+q.nonce});
   const item=(name,amount)=>({price_data:{currency:'usd',unit_amount:amount,product_data:{name}},quantity:1});
   const session=await stripe.checkout.sessions.create({mode:'payment',customer:customer.id,line_items:[item('Swan canvas · 36 × 43 inches · unmounted',PRICE),item(q.method+' shipping',q.shipping)],success_url:origin+'/buy-print.html?artwork=archive-eye&session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/buy-print.html?artwork=archive-eye&cancelled=1',expires_at:Math.floor(now()/1000)+1800,integration_identifier:'hugs_art_'+q.nonce.replace(/[^a-z]/g,'a').slice(0,8),metadata:{hugs_print:'swan-test-v1',sku:SKU,price:String(PRICE),shipping:String(q.shipping),shipping_id:String(q.shippingId),hugs_fulfillment:'test-hold'},custom_text:{submit:{message:'Sandbox test only. No print will be produced. Tax is not calculated in this test. Delivery quote: '+r.address_1+', '+r.city+', '+r.state_code+' '+r.zip_postal_code}}},{idempotencyKey:'hugs-print-checkout-'+q.nonce});
   if(session.livemode||!session.url?.startsWith('https://checkout.stripe.com/'))throw Error('Unexpected checkout');
   return json({testOnly:true,url:session.url});
  }
  return json({error:'Unsupported action'},400);
 }catch{return json({error:'Sandbox payment service unavailable. Please try again.',testOnly:true},502)}
}
