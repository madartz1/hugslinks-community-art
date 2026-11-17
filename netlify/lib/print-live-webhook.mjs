// This endpoint only records verified live payments. It never submits a print
// order. The production checkout producer must save the approved quote first.
import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';
import { canonicalDestination, destinationSeal } from './golden-horizon-live.mjs';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const quoteIdPattern=/^[0-9a-f]{32}$/;
const sessionIdPattern=/^cs_live_[A-Za-z0-9]{1,220}$/;
const paymentEvents=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed']);
const storeDefault=()=>getStore({name:'print-orders-live',consistency:'strong'});
const cents=(value,low=0)=>Number.isSafeInteger(value)&&value>=low&&value<=10_000_000;
const label=value=>typeof value==='string'&&value.length>0&&value.length<=120;
const approvedQuote=q=>q?.approved===true&&q.currency==='usd'&&
 label(q.editionId)&&label(q.artworkId)&&label(q.sku)&&label(q.revision)&&label(q.shippingService)&&
 cents(q.printCents,50)&&cents(q.shippingCents);
const webhookKey=value=>typeof value==='string'&&/^whsec_[A-Za-z0-9_-]+$/.test(value);
const apiKey=value=>typeof value==='string'&&/^(?:rk|sk)_live_[A-Za-z0-9_-]+$/.test(value);

export async function handleLivePrintWebhook(request, context, {
 env=process.env,
 makeStripe=key=>new Stripe(key,{apiVersion:'2026-10-28.endive'}),
 makeStore=storeDefault,
 now=()=>Date.now()
}={}){
 if(context?.deploy?.context!=='production'||env.HUGS_PRINT_LIVE_LEDGER!=='true')return json({error:'Not found'},404);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const signingSecret=env.HUGS_PRINT_STRIPE_LIVE_WEBHOOK_SECRET, key=env.HUGS_PRINT_STRIPE_LIVE_KEY;
 if(!webhookKey(signingSecret)||!apiKey(key))return json({error:'Live payment verification is not configured.'},503);
 const signature=request.headers.get('stripe-signature');
 if(!signature)return json({error:'Invalid signature'},400);
 const stripe=makeStripe(key);
 let event;
 try{event=stripe.webhooks.constructEvent(await request.text(),signature,signingSecret)}
 catch{return json({error:'Invalid signature'},400)}
 if(event.livemode!==true)return json({error:'Unexpected payment mode'},400);
 if(!paymentEvents.has(event.type)||event.type==='checkout.session.async_payment_failed')return json({received:true});
 const eventSession=event.data?.object;
 if(eventSession?.metadata?.hugs_print!=='hl-print-live-v1')return json({received:true});
 if(!sessionIdPattern.test(eventSession.id||''))return json({error:'Unexpected checkout session'},400);
 try{
  const session=await stripe.checkout.sessions.retrieve(eventSession.id);
  const id=eventSession.id, ref=session.metadata?.quote_id;
  if(session.livemode!==true||session.id!==id||session.mode!=='payment'||
   session.metadata?.hugs_print!=='hl-print-live-v1'||!quoteIdPattern.test(ref||'')) {
   return json({error:'Unexpected payment details'},400);
  }
  if(session.payment_status!=='paid')return json({received:true,pending:true});
  const store=makeStore();
  const quote=await store.get('quote:'+ref,{type:'json'});
  if(!approvedQuote(quote)||quote.sessionId!==id)return json({error:'Approved quote is not available.'},503);
  const subtotal=quote.printCents+quote.shippingCents,tax=session.total_details?.amount_tax;
  const pilot=typeof quote.destinationSeal==='string',actualShipping=session.total_details?.amount_shipping;
  if(session.currency!==quote.currency||session.amount_subtotal!==(pilot?quote.printCents:subtotal)||
    (pilot&&actualShipping!==quote.shippingCents)||!cents(tax)||
    session.amount_total!==subtotal+tax||session.total_details?.amount_discount!==0){
   return json({error:'Payment total does not match quote'},409);
  }
  const destination=pilot?canonicalDestination(session.collected_information?.shipping_details?.address):null;
  const exception=pilot&&(!env.HUGS_PRINT_LIVE_QUOTE_SECRET||!destination||
   destinationSeal(destination,env.HUGS_PRINT_LIVE_QUOTE_SECRET)!==quote.destinationSeal||
   session.automatic_tax?.status!=='complete'||tax<=0)?'verify_destination_and_tax':null;
  const order={
   id, art:quote.artworkId, editionId:quote.editionId, sku:quote.sku, revision:quote.revision,
   shippingService:quote.shippingService, printCents:quote.printCents, shippingCents:quote.shippingCents,
   taxCents:tax, totalCents:session.amount_total, currency:session.currency, quoteRef:ref,
   status:exception?'paid_needs_review':'paid_awaiting_fulfillment', ...(exception?{exception}:{}), fulfillment:'manual_hold', createdAt:now()
  };
  await store.setJSON('order:'+id,order,{onlyIfNew:true});
  return json({received:true});
 }catch{return json({error:'Live payment verification temporarily unavailable.'},503)}
}
