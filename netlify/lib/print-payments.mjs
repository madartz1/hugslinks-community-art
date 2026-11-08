import Stripe from 'stripe';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';
import { SWAN_EDITION, RETIRED_SWAN_TEST_SKU, readTestEditions, editionRevision, editionSummary, sizeLabel } from './print-editions.mjs';
import { quoteFinerWorksTestShipping } from './print-sandbox.mjs';

export const PRICE = SWAN_EDITION.priceCents;
const PREVIEW_ORIGIN = 'https://deploy-preview-4--hugslinks-community-art.netlify.app';
const WEBHOOK_PATH = '/.netlify/functions/art-print-payments?action=webhook';
const LEGACY_HOOK = /^https:\/\/([a-f0-9]{24})--(?:hugslinks-community-art|hl-art-gallery)\.netlify\.app\/\.netlify\/functions\/art-print-payments\?action=webhook$/;
const INTEGRATION = 'hugs-art-print-sandbox';
const EVENTS = ['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'];
const limitReached=e=>/webhook/i.test(e.message||'')&&/maximum|more than|limit|too many/i.test(e.message||'');
async function connectWebhook(stripe,readLegacyWebhook){
 const url=PREVIEW_ORIGIN+WEBHOOK_PATH;
 try{return await stripe.webhookEndpoints.create({url,enabled_events:EVENTS,metadata:{integration:INTEGRATION,preview:'4'}},{idempotencyKey:'hugs-print-preview-4-webhook-v2'})}catch(error){
  if(!limitReached(error))throw error;
  const list=await stripe.webhookEndpoints.list({limit:100});
  for(const hook of list.data){
   if(hook.livemode!==false||hook.metadata?.integration!==INTEGRATION||hook.status!=='enabled')continue;
   const priorDeploy=LEGACY_HOOK.exec(hook.url)?.[1];
   const legacyDeploy=priorDeploy||(hook.url===url&&hook.metadata.preview==='4'?hook.metadata.deploy:'');
   if(!/^[a-f0-9]{24}$/.test(legacyDeploy||'')||hook.metadata.deploy!==legacyDeploy)continue;
   let config;try{config=await readLegacyWebhook(legacyDeploy)}catch{continue}
   if(config?.id!==hook.id||!config.secret)continue;
   // The exact endpoint and its signing secret belong to this gallery's old deploy.
   // Updating the destination frees no capacity and leaves every other connection intact.
   if(hook.url!==url)await stripe.webhookEndpoints.update(hook.id,{url,enabled_events:EVENTS,metadata:{integration:INTEGRATION,preview:'4',deploy:legacyDeploy}});
   return {id:hook.id,secret:config.secret,livemode:false};
  }
  throw error;
 }
}

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)};
const hmac=(value,secret)=>createHmac('sha256',secret).update(value).digest('base64url');
export function signQuote(data,secret){const b=Buffer.from(JSON.stringify(data)).toString('base64url');return b+'.'+hmac(b,secret)}
export function readQuote(token,secret,now=Date.now(),editions=[SWAN_EDITION]){
 if(typeof token!=='string'||token.length>6000)throw Error('Invalid quote');
 const [b,s,extra]=token.split('.');if(extra||!equal(s,hmac(b,secret)))throw Error('Invalid quote');
 const q=JSON.parse(Buffer.from(b,'base64url')),edition=editions.find(e=>e.id===(q.editionId??SWAN_EDITION.id));
 if(!edition||!Number.isFinite(q.expires)||q.expires<now||q.price!==edition.priceCents||q.sku!==edition.sku||(q.editionId&&q.revision!==editionRevision(edition))||!Number.isSafeInteger(q.shipping)||q.shipping<0||q.shipping>100000||typeof q.nonce!=='string')throw Error('Expired or invalid quote');return q;
}
export function cleanRecipient(v){
 const states='AL AZ AR CA CO CT DC DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
 const clean=(s,n)=>typeof s==='string'&&s.trim().length<=n?s.trim():'';
 const a={first_name:clean(v?.first_name,50),last_name:clean(v?.last_name,50),address_1:clean(v?.address_1,100),address_2:clean(v?.address_2,100),city:clean(v?.city,60),state_code:clean(v?.state_code,2).toUpperCase(),zip_postal_code:clean(v?.zip_postal_code,10),phone:clean(v?.phone,25),country_code:'us'};
 if(!a.first_name||!a.last_name||!a.address_1||!a.city||!states.includes(a.state_code)||!/^\d{5}(-\d{4})?$/.test(a.zip_postal_code)||!/^[-+() .0-9]{7,25}$/.test(a.phone))throw Error('Enter a complete contiguous-US delivery address and phone number.');return a;
}
const plain=s=>String(s||'').replace(/<[^>]*>/g,'').slice(0,160);
const signedSessionFields = ['hugs_print','edition_id','artwork_id','sku','price','shipping','shipping_id','quote_nonce','print_size'];
const sessionSeal=(metadata,secret)=>hmac(JSON.stringify(signedSessionFields.map(key=>metadata[key])),secret);
export function validSession(s,secret){
 const m=s?.metadata,price=Number(m?.price),shipping=Number(m?.shipping);
 if(s?.livemode!==false||s.currency!=='usd'||!Number.isSafeInteger(price)||price<50||price>10000000||!Number.isSafeInteger(shipping)||shipping<0||shipping>100000||s.amount_total!==price+shipping)return false;
 if(m.hugs_print==='swan-test-v1')return m.sku===RETIRED_SWAN_TEST_SKU&&price===PRICE;
 return m.hugs_print==='swan-test-v2'&&!!secret&&equal(m.print_seal,sessionSeal(m,secret));
}

export async function handlePayments(request,context,{env=process.env,fetcher=fetch,makeStripe=key=>new Stripe(key,{apiVersion:'2026-09-30.endive'}),makeStore=()=>getStore({name:'print-checkout-preview-4-config',consistency:'strong'}),readLegacyWebhook=deployID=>getDeployStore({name:'print-checkout-config',deployID,consistency:'strong'}).get('webhook',{type:'json'}),now=()=>Date.now()}={}){
 if(context?.deploy?.context!=='deploy-preview')return json({error:'Not found'},404);
 const url=new URL(request.url),origin=url.origin,action=url.searchParams.get('action')||'config';
 if(origin!==PREVIEW_ORIGIN)return json({error:'Use the gallery checkout preview'},400);
 const canSetup=()=>equal(request.headers.get('x-hugs-checkout-admin'),env.HUGS_PRINT_PREVIEW_SETUP_TOKEN)||equal(request.headers.get('x-hugs-checkout-admin'),env.HUGS_PRINT_CHECKOUT_ADMIN_TOKEN);
 let key=env.STRIPE_SECRET_KEY?.trim();if(key?.startsWith('STRIPE_SECRET_KEY='))key=key.slice(18).trim();if((key?.startsWith('\"')&&key.endsWith('\"'))||(key?.startsWith("'")&&key.endsWith("'")))key=key.slice(1,-1).trim();const secret=env.HUGS_PRINT_QUOTE_SECRET;
 if(!/^(sk|rk)_test_/.test(key||'')||!secret)return json({enabled:false,testOnly:true,error:!key?'Stripe sandbox key is missing':!/^(sk|rk)_test_/.test(key)?(/^(sk|rk)_live_/.test(key)?'A live Stripe key was saved; replace it with a sandbox test key':/^pk_/.test(key)?'A publishable Stripe key was saved; use a sandbox secret key':'Saved Stripe key is not a recognized sandbox secret key'):'Quote signing secret is missing'},503);
 const stripe=makeStripe(key),store=makeStore();
 if(!['config','status'].includes(action)&&request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&action!=='webhook'&&request.headers.get('origin')&&request.headers.get('origin')!==origin)return json({error:'Invalid origin'},403);
 try{
  const webhook=await store.get('webhook',{type:'json'});
  const directAvailable=!!(env.FINERWORKS_TEST_WEB_API_KEY&&env.FINERWORKS_TEST_APP_KEY);
  if(action==='config'){
   const editions=readTestEditions(env.HUGS_PRINT_TEST_EDITIONS_JSON);
   return json({enabled:!!webhook?.secret&&directAvailable,quoteAvailable:directAvailable,testOnly:true,priceCents:PRICE,editions:editions.map(e=>editionSummary(e,directAvailable)),shippingCalculated:directAvailable,fulfillment:'test-hold',taxCalculated:false});
  }
  if(action==='setup'){
   if(!canSetup())return json({error:'Unauthorized'},401);
   if(webhook?.secret)return json({ok:true,testOnly:true,webhookReady:true});
   const hook=await connectWebhook(stripe,readLegacyWebhook);
   if(hook.livemode!==false||!hook.secret)throw Error('Unexpected sandbox webhook');
   await store.setJSON('webhook',{secret:hook.secret,id:hook.id});
   return json({ok:true,testOnly:true,webhookReady:true});
  }
  if(action==='webhook'){
   if(!webhook?.secret)return json({error:'Webhook not configured'},503);
   let event;try{event=stripe.webhooks.constructEvent(await request.text(),request.headers.get('stripe-signature'),webhook.secret)}catch{return json({error:'Invalid signature'},400)}
   if(event.livemode!==false)return json({error:'Live events are not accepted'},400);
   if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type))return json({received:true});
   const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
   if(!validSession(session,secret))return json({error:'Unexpected payment details'},400);
   if(event.type==='checkout.session.async_payment_failed')return json({received:true});
   if(session.payment_status!=='paid')return json({received:true,pending:true});
   await stripe.checkout.sessions.update(session.id,{metadata:{hugs_test_payment_verified:'true',hugs_fulfillment:'test-hold'}},{idempotencyKey:'hugs-print-verified-'+session.id});
   return json({received:true,testOnly:true});
  }
  if(action==='status'){
   const id=new URL(request.url).searchParams.get('session_id');if(!/^cs_test_[a-zA-Z0-9]+$/.test(id||''))return json({error:'Invalid session'},400);
   const s=await stripe.checkout.sessions.retrieve(id);if(!validSession(s,secret))return json({error:'Unknown print test'},404);
   const paid=s.payment_status==='paid';
   return json({testOnly:true,paid,webhookVerified:paid&&s.metadata.hugs_test_payment_verified==='true',priceCents:Number(s.metadata.price),shippingCents:Number(s.metadata.shipping),totalCents:s.amount_total,...(s.metadata.print_size?{size:s.metadata.print_size}:{}),fulfillment:'test-hold'});
  }
  if(['quote','checkout'].includes(action)&&!directAvailable)return json({error:'FinerWorks test shipping credentials are not configured for the gallery preview.'},503);
  if(action==='checkout'&&!webhook?.secret)return json({error:'Test payment confirmation is being configured. Shipping quotes are available.'},503);
  let body;try{const raw=await request.text();if(raw.length>8000)return json({error:'Request too large'},413);body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
  if(action==='quote'){
   const editions=readTestEditions(env.HUGS_PRINT_TEST_EDITIONS_JSON),edition=editions.find(e=>e.id===(body.editionId??SWAN_EDITION.id));
   if(!edition)return json({error:'Select a configured print size.'},400);
   let recipient;try{recipient=cleanRecipient(body.recipient)}catch(e){return json({error:e.message},400)}
   const res=await quoteFinerWorksTestShipping(recipient,{webKey:env.FINERWORKS_TEST_WEB_API_KEY,appKey:env.FINERWORKS_TEST_APP_KEY,sku:edition.sku,fetcher});
   const data=await res.json();if(!res.ok||!data.ok)return json({error:'Shipping quote unavailable. Check the address and try again.'},502);
   const valid=(data.options||[]).filter(o=>o.automationReady&&Number.isSafeInteger(o.rateCents)&&o.rateCents>=0&&o.rateCents<=100000);
   if(!valid.length)return json({error:'No shipping method available for this address.'},422);
   const options=valid.map(o=>{const q={editionId:edition.id,revision:editionRevision(edition),sku:edition.sku,price:edition.priceCents,shipping:o.rateCents,method:plain(o.method),shippingId:o.id,recipient,expires:now()+15*60*1000,nonce:randomBytes(16).toString('hex')};return {method:q.method,shippingCents:q.shipping,totalCents:q.price+q.shipping,transitTime:plain(o.transitTime),quote:signQuote(q,secret)}});
   return json({testOnly:true,editionId:edition.id,priceCents:edition.priceCents,options});
  }
  if(action==='checkout'){
   const editions=readTestEditions(env.HUGS_PRINT_TEST_EDITIONS_JSON);
   let q;try{q=readQuote(body.quote,secret,now(),editions)}catch{return json({error:'The quote expired or changed. Calculate shipping again.'},400)}
   const r=q.recipient,edition=editions.find(e=>e.id===(q.editionId??SWAN_EDITION.id));
   const customer=await stripe.customers.create({name:r.first_name+' '+r.last_name,shipping:{name:r.first_name+' '+r.last_name,phone:r.phone,address:{line1:r.address_1,line2:r.address_2||undefined,city:r.city,state:r.state_code,postal_code:r.zip_postal_code,country:'US'}},metadata:{hugs_sandbox:'art-print'}},{idempotencyKey:'hugs-print-customer-'+q.nonce});
   const item=(name,amount)=>({price_data:{currency:'usd',unit_amount:amount,product_data:{name}},quantity:1});
   const metadata={hugs_print:'swan-test-v2',edition_id:edition.id,artwork_id:edition.artworkId,sku:edition.sku,price:String(q.price),shipping:String(q.shipping),shipping_id:String(q.shippingId),quote_nonce:q.nonce,print_size:sizeLabel(edition),hugs_fulfillment:'test-hold'};
   metadata.print_seal=sessionSeal(metadata,secret);
   const session=await stripe.checkout.sessions.create({mode:'payment',branding_settings:{display_name:'HL Art Gallery'},customer:customer.id,line_items:[item('Swan — The Eye · '+sizeLabel(edition)+' · '+edition.material+' · '+edition.finish,q.price),item(q.method+' shipping',q.shipping)],success_url:origin+'/buy-print.html?artwork=archive-eye&session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/buy-print.html?artwork=archive-eye&cancelled=1',expires_at:Math.floor(now()/1000)+1800,integration_identifier:'hugs_art_'+Array.from(createHash('sha256').update(q.nonce).digest().subarray(0,8),b=>String.fromCharCode(97+b%26)).join(''),metadata,custom_text:{submit:{message:'Sandbox test only. No print will be produced. Tax is not calculated in this test. Delivery quote: '+r.address_1+', '+r.city+', '+r.state_code+' '+r.zip_postal_code}}},{idempotencyKey:'hugs-print-checkout-'+q.nonce});
   if(session.livemode!==false||!session.url?.startsWith('https://checkout.stripe.com/'))throw Error('Unexpected checkout');
   return json({testOnly:true,url:session.url});
  }
  return json({error:'Unsupported action'},400);
 }catch(e){
  const setupError=action==='setup'&&canSetup()?(limitReached(e)?'webhook-endpoint-limit':e.type==='StripeAuthenticationError'?'stripe-authentication':e.type==='StripePermissionError'?'stripe-permission':e.type==='StripeConnectionError'?'stripe-connection':'setup-failed'):undefined;
  return json({error:'Sandbox payment service unavailable. Please try again.',testOnly:true,...(setupError?{setupError}:{})},502)
 }
}
