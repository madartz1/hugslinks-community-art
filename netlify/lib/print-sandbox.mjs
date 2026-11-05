import { timingSafeEqual, randomUUID } from 'node:crypto';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)};
const required=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const states=new Set('AL AZ AR CA CO CT DC DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
function recipient(value){
 if(!value||typeof value!=='object')return null;
 const clean=v=>typeof v==='string'?v.trim():'';
 const a={first_name:clean(value.first_name),last_name:clean(value.last_name),address_1:clean(value.address_1),address_2:clean(value.address_2)||null,city:clean(value.city),state_code:clean(value.state_code).toUpperCase(),zip_postal_code:clean(value.zip_postal_code),country_code:'us',phone:clean(value.phone)||null};
 if(!required(a.first_name,50)||!required(a.last_name,50)||!required(a.address_1,100)||!required(a.city,60)||!states.has(a.state_code)||!/^\d{5}(?:-\d{4})?$/.test(a.zip_postal_code)||(a.address_2&&!required(a.address_2,100))||(a.phone&&!/^[+() 0-9.-]{7,25}$/.test(a.phone)))return null;
 return a;
}
function reason(http,data){
 if(http===401||http===403)return 'supplier_authentication_rejected';
 if(http===404)return 'supplier_endpoint_not_found';
 if(http===408||http===429)return 'supplier_temporarily_unavailable';
 if(http>=500)return 'supplier_server_error';
 const message=String(data?.status?.message||data?.message||'').toLowerCase();
 if(/sku|product|catalog|item/.test(message))return 'supplier_product_or_sku_error';
 if(/auth|key|credential|permission/.test(message))return 'supplier_authentication_rejected';
 if(http>=400)return 'supplier_request_rejected';
 return 'supplier_response_unconfirmed';
}
export async function handleSandbox(request,context,{env=process.env,fetcher=fetch,uuid=randomUUID}={}){
 // This endpoint is strictly limited to deploy previews, with a separate admin token.
 if(context?.deploy?.context!=='deploy-preview')return json({error:'Not found.'},404);
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(!equal(request.headers.get('x-hugs-print-test-token'),env.HUGS_ART_PRINT_TEST_TOKEN))return json({error:'Unauthorized.'},401);
 const webKey=env.FINERWORKS_WEB_API_KEY,appKey=env.FINERWORKS_APP_KEY,sku=env.FINERWORKS_TEST_SKU;
 if(!webKey||!appKey||!sku)return json({ok:false,error:'test_configuration_incomplete',testOnly:true},503);
 if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Request too large.'},413);
 let body;try{const raw=await request.text();if(raw.length>4096)return json({error:'Request too large.'},413);body=JSON.parse(raw)}catch{return json({error:'Invalid JSON.'},400)}
 if(!['product','shipping'].includes(body?.action))return json({error:'Unsupported test action.'},400);
 let endpoint,payload,orderPo;
 if(body.action==='product'){
  endpoint='get_product_details';payload=[{product_order_po:null,product_qty:1,product_sku:sku}];
 }else{
  const dest=recipient(body.recipient);if(!dest)return json({error:'Provide a valid contiguous US address for the test.'},400);
  const po='HUGS-TEST-'+uuid();orderPo=po;
  endpoint='list_shipping_options_multiple';
  payload={orders:[{order_po:po,guest:false,recipient:dest,order_items:[{product_order_po:po,product_qty:1,product_sku:sku,product_title:'Swan Canvas Test'}],test_mode:true}],account_key:null};
 }
 let response,data;const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 try{
  response=await fetcher('https://v2.api.finerworks.com/v3/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','web_api_key':webKey,'app_key':appKey},body:JSON.stringify(payload),signal:ctrl.signal});
  const raw=await response.text();try{data=JSON.parse(raw)}catch{data=null}
  if(!response.ok||data?.status?.success!==true)return json({ok:false,testOnly:true,error:reason(response.status,data),supplierHttpStatus:response.status},502);
  if(body.action==='product')return json({ok:true,testOnly:true,action:'product',message:'FinerWorks accepted the product lookup. Confirm the SKU’s size, material, artwork, and pricing before launch.'});
  const orders=Array.isArray(data.orders)?data.orders:[],order=orders.find(o=>o?.order_po===orderPo);if(!order)return json({ok:false,testOnly:true,error:'supplier_response_unconfirmed'},502);const options=Array.isArray(order.options)?order.options:[];
  const safe=options.filter(o=>Number.isFinite(Number(o.rate))&&Number(o.rate)>=0&&typeof o.shipping_method==='string').map(o=>({id:String(o.id??''),method:o.shipping_method.slice(0,120),rateCents:Math.round(Number(o.rate)*100),currency:'USD',transitTime:typeof o.transit_time==='string'?o.transit_time.slice(0,80):null,automationReady:Number.isInteger(Number(o.id))&&Number(o.id)>0}));
  return json({ok:true,testOnly:true,action:'shipping',options:safe});
 }catch(e){return json({ok:false,testOnly:true,error:e?.name==='AbortError'?'supplier_timeout':'supplier_network_error'},502)}
 finally{clearTimeout(timer)}
}
