import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const cityscape=Object.freeze({
 artworkId:'archive-horizon',editionId:'horizon-10x8-matte-framed',sku:'GH-10X8-STD-BLK',revision:'golden-horizon-framed-v1',
 priceId:'price_1UcudIAgUYqcdQzuYgITE7an',printCents:10900
});
const currency='usd';
const defaultStore=()=>getStore({name:'print-orders-live',consistency:'strong'});
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const strongEqual=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
};
export function canonicalDestination(a){
 const clean=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim().replace(/\s+/g,' ').toUpperCase():'';
 const normalized=[clean(a?.line1,100),clean(a?.line2,100),clean(a?.city,60),clean(a?.state,2),clean(a?.postal_code,10),clean(a?.country,2)];
 if(!normalized[0]||!normalized[2]||normalized[3]!=='NY'||!/^\d{5}(-\d{4})?$/.test(normalized[4])||normalized[5]!=='US')return null;
 if(a?.line2&&!normalized[1])return null;
 return normalized;
}
export const destinationSeal=(address,secret)=>createHmac('sha256',secret).update(JSON.stringify(address)).digest('hex');
export const validCheckoutUrl=value=>{
 if(typeof value!=='string')return false;
 try{return new URL(value).origin==='https://checkout.stripe.com'}catch{return false}
};

export async function startGoldenHorizonCheckout(request,context,{
 env=process.env,makeStripe=key=>new Stripe(key,{apiVersion:'2026-10-28.endive'}),makeStore=defaultStore,now=()=>Date.now()
}={}){
 if(context?.deploy?.context!=='production'||env.HUGS_PRINT_LIVE_CHECKOUT!=='true'||env.HUGS_PRINT_LIVE_LEDGER!=='true')return json({error:'Not found'},404);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const token=env.HUGS_PRINT_LIVE_ADMIN_TOKEN||env.HUGS_ADMIN_TOKEN;
 if(typeof token!=='string'||token.length<24||!strongEqual(request.headers.get('authorization'),'Bearer '+token))return json({error:'Unauthorized'},401);
 const key=env.HUGS_PRINT_STRIPE_LIVE_KEY,signing=env.HUGS_PRINT_STRIPE_LIVE_WEBHOOK_SECRET;
 const secret=env.HUGS_PRINT_LIVE_QUOTE_SECRET,origin=env.HUGS_PRINT_LIVE_ORIGIN;
 if(!/^(rk|sk)_live_[A-Za-z0-9_-]+$/.test(key||'')||!/^whsec_[A-Za-z0-9_-]+$/.test(signing||'')||
  typeof secret!=='string'||secret.length<32||!/^https:\/\/[a-z0-9.-]+$/i.test(origin||''))return json({error:'Live checkout is not configured.'},503);

 let body;
 try{const raw=await request.text();if(raw.length>4096)throw Error();body=JSON.parse(raw)}catch{return json({error:'Invalid quote request.'},400)}
 const {quoteId,shippingCents,shippingService,address,supplierQuoteRef}=body??{};
 const dest=canonicalDestination(address);
 if(!/^[a-f0-9]{32}$/.test(quoteId||'')||!dest||!Number.isSafeInteger(shippingCents)||shippingCents<0||
  shippingCents>10000||!/^[A-Za-z0-9_ -]{2,80}$/.test(supplierQuoteRef||'')||typeof shippingService!=='string'||!shippingService.trim()||shippingService.length>64){
  return json({error:'Use a verified FinerWorks quote for one New York delivery address.'},400);
 }

 try{
  const stripe=makeStripe(key);
  // The registration is live and active in the verified pilot jurisdiction.
  const [settings,registrations]=await Promise.all([stripe.tax.settings.retrieve(),stripe.tax.registrations.list({status:'active',limit:100})]);
  if(settings.livemode!==true||settings.status!=='active'||!registrations.data.some(r=>r.livemode===true&&r.status==='active'&&
   r.country==='US'&&r.country_options?.us?.state==='NY'))return json({error:'New York tax setup is not active.'},503);

  const candidate={approved:true,currency,artworkId:cityscape.artworkId,editionId:cityscape.editionId,sku:cityscape.sku,
   revision:cityscape.revision,printCents:cityscape.printCents,shippingCents,shippingService:shippingService.trim(),
   supplierQuoteRef,destinationSeal:destinationSeal(dest,secret),expiresAt:Math.floor(now()/1000)+3600};
  const store=makeStore(),storeKey='quote:'+quoteId;
  await store.setJSON(storeKey,candidate,{onlyIfNew:true});
  const quote=await store.get(storeKey,{type:'json'});
  if(!quote||quote.revision!==candidate.revision||quote.destinationSeal!==candidate.destinationSeal||
   quote.shippingCents!==candidate.shippingCents||quote.shippingService!==candidate.shippingService||quote.supplierQuoteRef!==supplierQuoteRef){
   return json({error:'Use a different quote reference for a changed amount or address.'},409);
  }
  if(quote.expiresAt<=Math.floor(now()/1000)+1800)return json({error:'This quote is near expiry. Verify the rate and use a new quote reference.'},410);
  const digest=destinationSeal([quoteId],secret);
  const session=await stripe.checkout.sessions.create({
   mode:'payment',automatic_tax:{enabled:true},adaptive_pricing:{enabled:false},line_items:[{price:cityscape.priceId,quantity:1}],
   shipping_address_collection:{allowed_countries:['US']},
   custom_text:{shipping_address:{message:'Use the New York delivery address on your gallery quote. The gallery reviews shipping before production.'}},
   shipping_options:[{shipping_rate_data:{display_name:quote.shippingService,type:'fixed_amount',
    fixed_amount:{currency,amount:quote.shippingCents},tax_behavior:'exclusive'}}],
   success_url:origin+'/golden-horizon-order.html',cancel_url:origin+'/print-options.html?artwork=archive-horizon',
   expires_at:quote.expiresAt,
   integration_identifier:'hl_gallery_print_'+Array.from(digest.slice(0,8),c=>String.fromCharCode(97+parseInt(c,16))).join(''),
   metadata:{hugs_print:'hl-print-live-v1',quote_id:quoteId}
  },{idempotencyKey:'hl-gallery-cityscape-'+quoteId});
  if(session.livemode!==true||session.status!=='open'||!/^cs_live_[A-Za-z0-9]+$/.test(session.id||'')||
   !validCheckoutUrl(session.url)||(quote.sessionId&&quote.sessionId!==session.id))throw Error('Unexpected live checkout');
  // Never disclose the Checkout URL until the authoritative quote is bound.
  if(!quote.sessionId)await store.setJSON(storeKey,{...quote,sessionId:session.id});
  return json({url:session.url,artwork:'Golden Horizon',printCents:quote.printCents,shippingCents:quote.shippingCents});
 }catch{return json({error:'Unable to create the live print checkout.'},503)}
}
