import { timingSafeEqual } from 'node:crypto';
const ENDPOINT='https://6ae3b6b6aca9dac0b568f87f--hugslinks-ai-ecom.netlify.app/.netlify/functions/art-print-sandbox';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)};
export default async function(request,context){
 if(context?.deploy?.context!=='deploy-preview')return json({error:'Not found'},404);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const token=process.env.HUGS_PRINT_BRIDGE_PREVIEW_TOKEN;
 if(!equal(request.headers.get('x-hugs-print-test-token'),token))return json({error:'Unauthorized'},401);
 let body;try{const raw=await request.text();if(raw.length>4096)return json({error:'Request too large'},413);body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
 if(!['product','shipping'].includes(body?.action))return json({error:'Unsupported test action'},400);
 try{
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','x-hugs-print-test-token':token},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const data=await res.json();return json(data,res.status);
 }catch{return json({error:'Test service unavailable',testOnly:true},502)}
}
