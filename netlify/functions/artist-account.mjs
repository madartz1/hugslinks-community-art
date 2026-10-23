import {getStore} from "@netlify/blobs";
const reply=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const enc=new TextEncoder(),base=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const hash=async s=>base(await crypto.subtle.digest("SHA-256",enc.encode(s)));
const secret=()=>process.env.HUGS_VOTER_SESSION_SECRET||"";
const sign=async msg=>{const key=await crypto.subtle.importKey("raw",enc.encode(secret()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return base(await crypto.subtle.sign("HMAC",key,enc.encode(msg)))};
const artists=()=>getStore("hugs-artists");
const read=async()=>{const v=await artists().get("artists",{type:"json",consistency:"strong"});return Array.isArray(v?.artists)?v.artists:[]};
const cookie=r=>(r.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("hugs_artist_session="))?.slice(20)||"";
async function identity(r){const raw=cookie(r);const parts=raw.split(".");if(parts.length!==3||!secret())return null;const msg=parts[0]+"."+parts[1];if(await sign(msg)!==parts[2])return null;let id;try{id=JSON.parse(atob(parts[0].replace(/-/g,"+").replace(/_/g,"/")))}catch{return null}if(!id||!Number.isFinite(Number(parts[1]))||Date.now()>Number(parts[1]))return null;return id}
const clean=(v,n)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001f\u007f]/g,"").slice(0,n):"";
export default async function handler(request){
 if(!secret())return reply({ok:false,error:"Artist login is not configured."},503);
 const url=new URL(request.url),action=url.searchParams.get("action")||"";
 try{
 if(request.method==="POST"&&action==="request"){
 const body=await request.json(),email=clean(body.email,254).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({ok:false,error:"Enter a valid email address."},400);
 const limiter=getStore("hugs-artist-login");const throttleKey="request-"+await hash(email);const recent=await limiter.get(throttleKey,{type:"json",consistency:"strong"});if(recent&&Date.now()-recent.time<60*1000)return reply({ok:true,message:"If this email has an artist submission, a sign-in link will arrive shortly."});await limiter.setJSON(throttleKey,{time:Date.now()});
 const person=(await read()).find(a=>a.email===email);
 if(person&&process.env.HUGS_VOTER_RESEND_API_KEY&&process.env.HUGS_VOTER_FROM_EMAIL){
 const token=base(crypto.getRandomValues(new Uint8Array(32))),key=await hash(token);
 await getStore("hugs-artist-login").setJSON(key,{id:person.id,expires:Date.now()+15*60*1000});
 const link=url.origin+"/artist-dashboard.html?login="+encodeURIComponent(token);
 const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+process.env.HUGS_VOTER_RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.HUGS_VOTER_FROM_EMAIL,to:[email],subject:"Your HUGS Community Art sign-in link",text:"Open this private sign-in link within 15 minutes: "+link+"\nIf you did not request it, ignore this email."})});
 if(!sent.ok){console.error("Artist email delivery failed",sent.status);return reply({ok:false,error:"Sign-in email is temporarily unavailable."},503)}
 }
 return reply({ok:true,message:"If this email has an artist submission, a sign-in link will arrive shortly."});
 }
 if(request.method==="POST"&&action==="verify"){
 const body=await request.json(),token=clean(body.token,180);if(!/^[A-Za-z0-9_-]{35,180}$/.test(token))return reply({ok:false,error:"Invalid link."},401);
 const store=getStore("hugs-artist-login"),key=await hash(token),entry=await store.get(key,{type:"json",consistency:"strong"});
 if(!entry||Date.now()>entry.expires)return reply({ok:false,error:"Link expired or already used."},401);
 await store.delete(key);
 const person=(await read()).find(a=>a.id===entry.id);if(!person)return reply({ok:false,error:"Account unavailable."},401);
 const payload=base(enc.encode(JSON.stringify(person.id))),expiry=String(Date.now()+12*60*60*1000),msg=payload+"."+expiry,sig=await sign(msg);
 const out=reply({ok:true});out.headers.append("Set-Cookie","hugs_artist_session="+msg+"."+sig+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200");return out;
 }
 if(request.method==="POST"&&action==="logout"){const out=reply({ok:true});out.headers.append("Set-Cookie","hugs_artist_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");return out}
 const id=await identity(request);if(!id)return reply({ok:false,error:"Sign in to continue."},401);
 const all=await read(),artist=all.find(a=>a.id===id);if(!artist)return reply({ok:false,error:"Account unavailable."},401);
 if(request.method==="GET"){return reply({ok:true,artist:{id:artist.id,artist_name:artist.artist_name,artwork_title:artist.artwork_title,status:artist.status,created_at:artist.created_at,reviewed_at:artist.reviewed_at,artwork_published_at:artist.artwork_published_at,profile_bio:artist.public_bio||"",proposed_bio:artist.proposed_bio||"",profile_review_status:artist.profile_review_status||"No edits pending"}})}
 if(request.method==="POST"&&action==="profile"){const body=await request.json(),bio=clean(body.bio,800);if(!bio||bio.length<20)return reply({ok:false,error:"Please write at least 20 characters."},400);artist.proposed_bio=bio;artist.profile_review_status="Pending Review";artist.profile_requested_at=new Date().toISOString();await artists().setJSON("artists",{updated_at:new Date().toISOString(),artists:all});return reply({ok:true,message:"Profile update submitted for HUGS review."})}
 return reply({ok:false,error:"Method not allowed."},405);
 }catch(e){console.error("Artist dashboard error",e);return reply({ok:false,error:"Unable to complete that request."},500)}
}
