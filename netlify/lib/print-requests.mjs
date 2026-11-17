import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';

export const printRequestEditions = Object.freeze({
 'city-holds-breath-20x16-framed':{title:'The City Holds Its Breath',size:'20 × 16″ framed',checkout:'city-holds-breath-checkout-admin.html'},
 'horizon-10x8-matte-framed':{title:'Golden Horizon',size:'10 × 8″ framed',checkout:'golden-horizon-checkout-admin.html'}
});
export const requestIdPattern=/^[0-9a-f]{32}$/;
const isEnabled=ctx=>['production','deploy-preview'].includes(ctx?.deploy?.context);
const storeFor=ctx=>ctx.deploy.context==='production'
 ?getStore({name:'print-requests-live',consistency:'strong'}):getDeployStore({name:'print-requests-preview',consistency:'strong'});
const liveLedger=()=>getStore({name:'print-orders-live',consistency:'strong'});
const opts={type:'json'};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function auth(request,env){
 const expected=env.HUGS_PRINT_LIVE_ADMIN_TOKEN||env.HUGS_ADMIN_TOKEN;
 const value=request.headers.get('authorization');
 if(!expected||!value)return false;
 const a=Buffer.from('Bearer '+expected),b=Buffer.from(value);
 return a.length===b.length&&timingSafeEqual(a,b);
}
const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;
async function smallBody(request){
 const len=Number(request.headers.get('content-length')||0);
 if(len>4096)throw Error();
 const data=await request.text();
 if(data.length>4096)throw Error();
 return JSON.parse(data);
}

export async function submitPrintRequest(request,context,{requestStore=storeFor,uuid=randomUUID,now=()=>Date.now()}={}){
 if(!isEnabled(context))return json({error:'Not found.'},404);
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(!sameOrigin(request))return json({error:'Submit this request from the gallery.'},403);
 let data;try{data=await smallBody(request)}catch{return json({error:'Invalid request.'},400)}
 const editionId=data?.editionId;
 const email=typeof data?.email==='string'?data.email.trim():'';
 const zip=typeof data?.zip==='string'?data.zip.trim():'';
 if(!Object.hasOwn(printRequestEditions,editionId)||!/^\d{5}$/.test(zip)||
   !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254){
  return json({error:'Select a supported print and enter an email address and five-digit ZIP code.'},422);
 }
 if(data.company)return json({error:'Unable to accept this request.'},422);
 const time=now();
 const id=time.toString(16).padStart(12,'0')+uuid().replaceAll('-','').slice(0,20);
 try{
  const result=await requestStore(context).setJSON('request:'+id,{id,editionId,email,zip,createdAt:time},{onlyIfNew:true});
  if(result?.modified===false)throw Error();
  return json({id},201);
 }catch{return json({error:'Unable to save your print request. Please try again.'},503)}
}

export async function linkPrintRequest(id,editionId,context,{requestStore=storeFor}={}){
 if(!requestIdPattern.test(id||'')||context?.deploy?.context!=='production')return null;
 const store=requestStore(context),record=await store.get('request:'+id,opts);
 if(await store.get('paid:'+id,opts))return null;
 return record?.editionId===editionId?{record,store}:null;
}

async function recent(store,prefix,limit=100){
 const result=await store.list({prefix,paginate:false});
 const keys=[...(result.blobs||[])].sort((a,b)=>b.key.localeCompare(a.key)).slice(0,limit);
 return (await Promise.all(keys.map(x=>store.get(x.key,opts)))).filter(Boolean);
}

export async function recordPaidPrintRequest(id,order,context,{requestStore=storeFor}={}){
 if(!requestIdPattern.test(id||'')||context?.deploy?.context!=='production')return;
 await requestStore(context).setJSON('paid:'+id,{id:order.id,status:order.status}, {onlyIfNew:true});
}

export async function adminPrintRequests(request,context,{env=process.env,requestStore=storeFor,makeLedger=liveLedger,now=()=>Date.now()}={}){
 if(!isEnabled(context))return json({error:'Not found.'},404);
 if(!auth(request,env))return json({error:'Use your gallery admin token.'},401);
 const production=context.deploy.context==='production';
 try{
  const store=requestStore(context);
  const ledger=production?makeLedger():null;
  if(request.method==='GET'){
   const [requests,orders]=await Promise.all([recent(store,'request:'),ledger?recent(ledger,'order:'):[]]);
   const results=await Promise.all(requests.map(async row=>{
    const [quote,sent,order]=await Promise.all([
     store.get('quoted:'+row.id,opts),store.get('sent:'+row.id,opts),store.get('paid:'+row.id,opts)]);
    let status='requested';
    if(quote)status='quoted';
    if(order)status=order.status==='paid_needs_review'?'paid_needs_review':'paid';
    if(sent&&order?.id===sent.orderId&&status==='paid')status='sent_to_finerworks';
    return {...row,status,orderId:order?.id??null,supplierOrderRef:status==='sent_to_finerworks'?sent.supplierOrderRef:null};
   }));
   return json({requests:results.sort((a,b)=>b.createdAt-a.createdAt),orders:orders.sort((a,b)=>b.createdAt-a.createdAt).map(o=>({
    id:o.id,requestId:o.requestId??null,editionId:o.editionId,totalCents:o.totalCents,status:o.status,createdAt:o.createdAt
   })),production});
  }
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(!sameOrigin(request))return json({error:'Use the gallery admin page.'},403);
  let row;try{row=await smallBody(request)}catch{return json({error:'Invalid request.'},400)}
  if(!production||row?.action!=='mark_sent'||!requestIdPattern.test(row?.requestId||'')||
   !/^cs_live_[A-Za-z0-9]{1,220}$/.test(row?.orderId||'')||!/^[A-Za-z0-9_-]{3,80}$/.test(row?.supplierOrderRef||'')){
   return json({error:'Enter a valid FinerWorks order reference for an eligible paid request.'},422);
  }
  const order=await ledger.get('order:'+row.orderId,opts);
  if(order?.requestId!==row.requestId||order?.status!=='paid_awaiting_fulfillment'){
   return json({error:'Only a verified paid order without a review exception can be marked sent.'},409);
  }
  const saved=await store.setJSON('sent:'+row.requestId,{orderId:row.orderId,supplierOrderRef:row.supplierOrderRef,createdAt:now()},{onlyIfNew:true});
  if(saved?.modified===false)return json({error:'A FinerWorks reference is already recorded.'},409);
  return json({ok:true});
 }catch{return json({error:'Print queue is temporarily unavailable.'},503)}
}
