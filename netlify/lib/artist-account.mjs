import {swanProposal} from "./swan-proposals.mjs";
const reply=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export async function artistMailFailure(response){
 let detail={};try{detail=await response.json()}catch{}
 const text=typeof detail?.message==='string'?detail.message:'';
 let code='MAIL_REJECTED',message='The email provider could not send your link. Please contact the gallery.';
 if(response.status===401||/invalid.{0,20}api.{0,5}key|api.{0,5}key.{0,20}invalid/i.test(text)){code='MAIL_KEY_INVALID';message='The gallery email provider rejected its API key. The site owner needs to update the email configuration.'}
 else if(/only send testing emails|testing.{0,30}own email/i.test(text)){code='MAIL_TEST_RESTRICTION';message='The gallery email provider is restricted to testing recipients. The site owner needs to enable a verified sending domain.'}
 else if(/domain.{0,80}not verified|verify.{0,20}(sending )?domain/i.test(text)){code='MAIL_SENDER_UNVERIFIED';message='The gallery sending domain is not verified with the email provider. The site owner needs to verify it.'}
 else if(response.status===403){code='MAIL_PERMISSION';message='The email provider blocked this send. The site owner needs to check the sending key permissions and verified domain.'}
 else if(response.status===429){code='MAIL_RATE_LIMIT';message='The email provider is temporarily limiting sends. Please try again later.'}
 else if(response.status>=500){code='MAIL_PROVIDER_UNAVAILABLE';message='The email provider is temporarily unavailable. Please try again later.'}
 return {code,message};
}
const enc=new TextEncoder(),base=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const clean=(v,n)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,n):'';
const generic='If this email has an artist submission, a sign-in link will arrive shortly. Check your inbox and spam folder.';
export function createArtistAccountHandler({getStore,env=()=>process.env,fetcher=fetch,now=()=>Date.now(),random=()=>crypto.getRandomValues(new Uint8Array(32))}){
 const config=()=>typeof env==='function'?env():env;
 // The site owner assigns the original collection entries out of band. A display name never grants ownership.
 const emailOf=a=>{
  const explicit=String(a?.email||'').trim().toLowerCase();if(explicit)return explicit;
  if(!swanProposal(a?.id)||a.source!=='swan-collection-proposal')return '';
  const assigned=String(config().HL_SWAN_ARTIST_EMAIL||'').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assigned)?assigned:'';
 };
 const digest=async s=>base(await crypto.subtle.digest('SHA-256',enc.encode(s)));
 const sign=async msg=>{const key=await crypto.subtle.importKey('raw',enc.encode(config().HUGS_VOTER_SESSION_SECRET||''),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base(await crypto.subtle.sign('HMAC',key,enc.encode(msg)))};
 const read=async()=>{const d=await getStore('hugs-artists').get('artists',{type:'json',consistency:'strong'});return Array.isArray(d?.artists)?d.artists:Array.isArray(d)?d:[]};
 async function identity(request){try{const raw=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('hugs_artist_session='))?.slice(20)||'',parts=raw.split('.');if(parts.length!==3||!Number.isFinite(Number(parts[1]))||Number(parts[1])<=now()||await sign(parts[0]+'.'+parts[1])!==parts[2])return null;const identity=JSON.parse(atob(parts[0].replace(/-/g,'+').replace(/_/g,'/')));return identity&&typeof identity.id==='string'&&identity.id.length<=100&&typeof identity.email==='string'&&identity.email.length<=254?identity:null}catch{return null}}
 async function body(request){if(!(request.headers.get('content-type')||'').includes('application/json'))throw Error();const text=await request.text();if(text.length>6000)throw Error();return JSON.parse(text)}
 const publicRecord=(a,work)=>({id:a.id,artist_name:a.artist_name,artwork_title:a.artwork_title,status:a.status,created_at:a.created_at,reviewed_at:a.reviewed_at,artwork_published_at:a.artwork_published_at,published:!!work,published_artwork_id:work?.id||null,published_image_url:work?.image_url||null,has_image:!!a.artwork_image_id,profile_bio:a.public_bio||'',proposed_bio:a.proposed_bio||'',profile_review_status:a.profile_review_status||'No edits pending'});
 return async request=>{
  const url=new URL(request.url),action=url.searchParams.get('action')||'',c=config(),mailReady=!!c.HUGS_VOTER_SESSION_SECRET&&!!c.HUGS_VOTER_RESEND_API_KEY&&!!c.HUGS_VOTER_FROM_EMAIL;
  if(request.method==='GET'&&action==='config')return reply({ok:true,configured:mailReady});
  if(!c.HUGS_VOTER_SESSION_SECRET)return reply({ok:false,error:'Artist login is temporarily unavailable. Contact the gallery for help.'},503);
  if(!['GET','POST'].includes(request.method))return reply({ok:false,error:'Method not allowed.'},405);
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply({ok:false,error:'Use the artist studio page to make this request.'},403);
  try{
   if(request.method==='POST'&&action==='request'){
    let b;try{b=await body(request)}catch{return reply({ok:false,error:'Send a valid sign-in request.'},400)}
    const email=clean(b?.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({ok:false,error:'Enter a valid email address.'},400);
    if(!mailReady)return reply({ok:false,error:'Sign-in email is not available right now. Please contact the gallery.'},503);
    const limiter=getStore('hugs-artist-login'),bucket='request-'+await digest(email)+'-'+Math.floor(now()/60000),claim=await limiter.setJSON(bucket,{time:now()},{onlyIfNew:true});
    if(!claim.modified)return reply({ok:true,message:generic,retry_after:60});
    const matches=(await read()).filter(a=>emailOf(a)===email).sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)),person=matches[0];
    if(person){const token=base(random()),key=await digest(token);await limiter.setJSON(key,{id:person.id,email:emailOf(person),expires:now()+15*60000,used:false});
     const link=url.origin+'/artist-dashboard.html?login='+encodeURIComponent(token);
     const sent=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.HUGS_VOTER_RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:c.HUGS_VOTER_FROM_EMAIL,to:[email],subject:'Your HL Art Gallery sign-in link',text:'Open this private sign-in link within 15 minutes: '+link+'\nIf you did not request it, ignore this email.'})});
     if(!sent.ok){const failure=await artistMailFailure(sent);console.warn('Artist sign-in delivery rejected',{status:sent.status,reference:failure.code});return reply({ok:false,error:failure.message,reference:failure.code},503)}
     console.info('Artist sign-in delivery accepted');
    }
    return reply({ok:true,message:generic,retry_after:60});
   }
   if(request.method==='POST'&&action==='verify'){
    let b;try{b=await body(request)}catch{return reply({ok:false,error:'Invalid sign-in link.'},400)}const token=clean(b?.token,180);if(!/^[A-Za-z0-9_-]{35,180}$/.test(token))return reply({ok:false,error:'Invalid sign-in link.'},401);
    const store=getStore('hugs-artist-login'),key=await digest(token),entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'}),data=entry?.data;
    if(!data||data.used||!Number.isFinite(data.expires)||data.expires<=now()||!entry.etag)return reply({ok:false,error:'This sign-in link expired or was already used. Request a new one.'},401);
    const person=(await read()).find(a=>a.id===data.id);if(!person||!data.email||emailOf(person)!==data.email)return reply({ok:false,error:'This artist account is unavailable.'},401);
    const claimed=await store.setJSON(key,{...data,used:true},{onlyIfMatch:entry.etag});if(!claimed.modified)return reply({ok:false,error:'This sign-in link was already used. Request a new one.'},401);
    const payload=base(enc.encode(JSON.stringify({id:person.id,email:emailOf(person)}))),expiry=String(now()+12*60*60000),msg=payload+'.'+expiry;
    return reply({ok:true},200,{'Set-Cookie':'hugs_artist_session='+msg+'.'+await sign(msg)+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200'});
   }
   if(request.method==='POST'&&action==='logout')return reply({ok:true},200,{'Set-Cookie':'hugs_artist_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});
   const session=await identity(request),id=session?.id;if(!id)return reply({ok:false,error:'Sign in to continue.'},401);
   const all=await read(),owner=all.find(a=>a.id===id);if(!owner||!emailOf(owner)||emailOf(owner)!==session.email)return reply({ok:false,error:'Artist account unavailable.'},401);
   const owned=all.filter(a=>emailOf(a)===emailOf(owner)).sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||String(a.id).localeCompare(String(b.id)));
   let b=null;if(request.method==='POST'){try{b=await body(request)}catch{return reply({ok:false,error:'Send a valid studio request.'},400)}}
   const requested=request.method==='POST'?b?.artist_id:url.searchParams.get('submission'),selected=requested?owned.find(a=>a.id===requested):owned[0];if(!selected)return reply({ok:false,error:'Submission not found in your artist studio.'},404);
   if(request.method==='GET'&&action==='image'){
    if(!selected.artwork_image_id)return reply({ok:false,error:'No uploaded image is available for this submission.'},404);
    const image=await getStore('hugs-art-images').getWithMetadata('image-'+selected.artwork_image_id,{type:'arrayBuffer',consistency:'strong'}),mime=image?.metadata?.mime;if(!image||!['image/jpeg','image/png','image/webp'].includes(mime))return reply({ok:false,error:'Image unavailable.'},404);
    return new Response(image.data,{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Content-Disposition':'inline'}});
   }
   if(request.method==='GET'&&!action){const gallery=await getStore('hugs-art-gallery').get('gallery',{type:'json',consistency:'strong'}),published=new Map((gallery?.works||[]).filter(w=>w.published===true).map(w=>[w.source_artist_submission_id,w]));return reply({ok:true,artist:publicRecord(selected,published.get(selected.id)),submissions:owned.map(a=>publicRecord(a,published.get(a.id)))})}
   if(request.method==='POST'&&action==='profile'){
    const bio=clean(b?.bio,800);if(typeof b?.bio!=='string'||b.bio.length>800||bio.length<20)return reply({ok:false,error:'Write a biography of 20–800 characters.'},400);
    const store=getStore('hugs-artists');for(let attempt=0;attempt<5;attempt++){const snap=await store.getWithMetadata('artists',{type:'json',consistency:'strong'}),records=Array.isArray(snap?.data?.artists)?snap.data.artists:Array.isArray(snap?.data)?snap.data:[],current=records.find(a=>a.id===selected.id&&emailOf(a)===emailOf(owner));if(!current)return reply({ok:false,error:'Submission is no longer available.'},404);current.proposed_bio=bio;current.profile_review_status='Pending Review';current.profile_requested_at=new Date(now()).toISOString();const saved=await store.setJSON('artists',{updated_at:new Date(now()).toISOString(),artists:records},snap?.etag?{onlyIfMatch:snap.etag}:{onlyIfNew:true});if(saved.modified)return reply({ok:true,message:'Biography update submitted for gallery review. Your published profile has not changed.'})}return reply({ok:false,error:'Your studio changed while saving. Please try again.'},409);
   }
   return reply({ok:false,error:'Method not allowed.'},405);
  }catch{return reply({ok:false,error:'The artist studio is temporarily unavailable. Please try again.'},503)}
 };
}
