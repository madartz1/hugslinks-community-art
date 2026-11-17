import test from 'node:test';
import assert from 'node:assert/strict';
import {submitPrintRequest,adminPrintRequests,linkPrintRequest,recordPaidPrintRequest} from '../netlify/lib/print-requests.mjs';

const origin='https://gallery.example.com';
const prod={deploy:{context:'production'}},preview={deploy:{context:'deploy-preview'}};
const valid={editionId:'city-holds-breath-20x16-framed',email:'buyer@example.com',zip:'10118'};
const env={HUGS_ADMIN_TOKEN:'gallery-token'},orderId='cs_live_fixture';
const admin={Authorization:'Bearer gallery-token'};
const req=(body,headers={})=>new Request(origin+'/requests',{
 method:body?'POST':'GET',headers:{Origin:origin,...headers},...(body?{body:JSON.stringify(body)}:{})
});
function memory(){
 const rows=new Map();
 return {get:async key=>rows.get(key),setJSON:async(key,value,options)=>{if(options?.onlyIfNew&&rows.has(key))return{modified:false};rows.set(key,value);return{modified:true}},
  list:async({prefix})=>({blobs:[...rows.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))})};
}
test('buyer request makes a private, edition-specific queue record without payment or address',async()=>{
 const store=memory(),deps={requestStore:()=>store};
 assert.equal((await submitPrintRequest(req(valid,{Origin:'https://other.example'}),prod,deps)).status,403);
 assert.equal((await submitPrintRequest(req({...valid,editionId:'unapproved'}),prod,deps)).status,422);
 const response=await submitPrintRequest(req({...valid,address:'do not store'}),prod,deps);
 assert.equal(response.status,201);
 const pub=await response.json();
 assert.deepEqual(Object.keys(pub),['id']);
 assert.equal((await adminPrintRequests(req(),prod,{...deps,env,makeLedger:()=>assert.fail()})).status,401);
 const record=(await linkPrintRequest(pub.id,valid.editionId,prod,deps)).record;
 assert.equal(record.zip,'10118');assert.equal(record.address,undefined);
 assert.equal(await linkPrintRequest(pub.id,'horizon-10x8-matte-framed',prod,deps),null);
});
test('published admin workflow derives paid from the ledger and records supplier reference only after manual fulfillment',async()=>{
 const store=memory(),ledger=memory(),deps={env,requestStore:()=>store,makeLedger:()=>ledger};
 const {id}=await (await submitPrintRequest(req(valid),prod,deps)).json();
 const status=async()=> (await (await adminPrintRequests(req(null,admin),prod,deps)).json()).requests[0].status;
 assert.equal(await status(),'requested');
 await store.setJSON('quoted:'+id,{createdAt:5});
 assert.equal(await status(),'quoted');
 const mark=()=>adminPrintRequests(req({action:'mark_sent',requestId:id,orderId,supplierOrderRef:'FW-123'},admin),prod,deps);
 assert.equal((await mark()).status,409);
 const order={id:orderId,requestId:id,editionId:valid.editionId,status:'paid_awaiting_fulfillment',totalCents:37000,createdAt:9};
 await ledger.setJSON('order:'+orderId,order);
 await recordPaidPrintRequest(id,order,prod,deps);
 assert.equal(await status(),'paid');
 assert.equal(await linkPrintRequest(id,valid.editionId,prod,deps),null);
 assert.equal((await mark()).status,200);
 assert.equal(await status(),'sent_to_finerworks');
 assert.equal((await mark()).status,409);
});
test('preview has no connection to the live ledger or fulfillment',async()=>{
 const store=memory(),deps={env,requestStore:()=>store,makeLedger:()=>assert.fail('No preview access to production orders')};
 assert.equal((await submitPrintRequest(req(valid),preview,deps)).status,201);
 const result=await adminPrintRequests(req(null,admin),preview,deps);
 assert.equal(result.status,200);assert.equal((await result.json()).production,false);
 assert.equal((await adminPrintRequests(req({action:'mark_sent'},admin),preview,deps)).status,422);
});
