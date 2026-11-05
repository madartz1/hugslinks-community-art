import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtistAccountHandler,artistMailFailure} from '../netlify/lib/artist-account.mjs';
import {createArtistSubmissionHandler} from '../netlify/lib/artist-submission.mjs';
import {createArtistReviewHandler} from '../netlify/lib/artist-review.mjs';
import {mergeSwanProposals} from '../netlify/lib/swan-proposals.mjs';
import {createPublicGalleryHandler} from '../netlify/lib/public-gallery.mjs';

// Only in-memory stores and a captured mail transport. These tests cannot contact a live service.
function fixture(){
 const entries=new Map();let version=0,time=Date.parse('2026-11-05T12:00:00Z'),sequence=0;const mail=[];
 const getStore=name=>{
  const keyOf=key=>name+':'+key;
  const set=async(key,data,options={})=>{const k=keyOf(key),previous=entries.get(k);if(options.onlyIfNew&&previous||options.onlyIfMatch&&previous?.etag!==options.onlyIfMatch)return {modified:false};const etag=String(++version);entries.set(k,{data:structuredClone(data),metadata:options.metadata||{},etag});return {modified:true,etag}};
  return {get:async key=>structuredClone(entries.get(keyOf(key))?.data??null),getWithMetadata:async key=>structuredClone(entries.get(keyOf(key))??null),set,setJSON:set,delete:async key=>entries.delete(keyOf(key))};
 };
 const env={HUGS_VOTER_SESSION_SECRET:'isolated-workflow-secret',HUGS_VOTER_RESEND_API_KEY:'fake-mail-key',HUGS_VOTER_FROM_EMAIL:'Gallery <no-reply@example.com>'};
 const account=createArtistAccountHandler({getStore,env,now:()=>time,fetcher:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');mail.push(JSON.parse(options.body));return new Response('{}',{status:200})}});
 const submit=createArtistSubmissionHandler({getStore,makeArtistId:()=>`ARTIST-TEST-${++sequence}`,now:()=>new Date(time).toISOString()});
 const admin=createArtistReviewHandler(getStore,{HUGS_ADMIN_TOKEN:'test-admin'}),gallery=createPublicGalleryHandler(getStore);
 const call=(action='',body,cookie='',origin='https://gallery.example')=>account(new Request('https://gallery.example/.netlify/functions/artist-account'+(action?'?'+(action.includes('=')?action:'action='+action):''),{method:body===undefined?'GET':'POST',headers:{origin,...(cookie?{cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}));
 const review=(id,action)=>admin(new Request('https://gallery.example/admin',{method:'POST',headers:{Authorization:'Bearer test-admin','Content-Type':'application/json'},body:JSON.stringify({artist_id:id,action,admin_note:'Isolated workflow verification.'})}));
 const login=async(email='artist@example.com')=>{await call('request',{email});const token=new URL(mail.at(-1).text.match(/https:\/\/\S+/)[0]).searchParams.get('login');const result=await call('verify',{token});assert.equal(result.status,200);return result.headers.get('set-cookie').split(';')[0]};
 return {getStore,entries,mail,env,account,call,submit,review,gallery,login,advance:ms=>{time+=ms}};
}
function form(overrides={}){
 const data=new FormData();for(const [key,value] of Object.entries({artist_name:'Test artist',full_name:'Private Legal Name',email:'Artist@Example.com',city:'Test City',primary_medium:'Painting',artist_statement:'Light and water inspire this original composition.',artwork_title:'Test reflections',rights_confirmation:'yes',confirmation:'yes',submission_request_id:crypto.randomUUID(),...overrides}))data.set(key,value);
 data.set('artwork',new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3])],{type:'image/png'}),'test.png');return data;
}
const upload=(f,data=form(),origin='https://gallery.example')=>f.submit(new Request('https://gallery.example/.netlify/functions/submit-artist',{method:'POST',headers:{origin},body:data}));
const publicWorks=async f=>(await(await f.gallery(new Request('https://gallery.example/gallery'))).json()).works;

test('private submission → email sign-in → admin publication → biography review works end to end',async()=>{
 const f=fixture(),submitted=await upload(f);assert.equal(submitted.status,201);const {artist_id:id}=await submitted.json();assert.deepEqual(await publicWorks(f),[]);
 const cookie=await f.login();assert.match(cookie,/hugs_artist_session=/);let data=await(await f.call('',undefined,cookie)).json();assert.equal(data.artist.id,id);assert.equal(data.artist.published,false);assert.equal(data.artist.status,'Pending Review');assert.equal(data.submissions.length,1);assert(!JSON.stringify(data).includes('Private Legal Name'));assert(!JSON.stringify(data).includes('artist@example.com'));
 const image=await f.call('action=image&submission='+id,undefined,cookie);assert.equal(image.status,200);assert.equal(image.headers.get('cache-control'),'private, no-store');assert.equal(image.headers.get('content-type'),'image/png');assert.equal((await image.arrayBuffer()).byteLength,11);
 assert.equal((await f.review(id,'approve-publish')).status,200);assert.equal((await publicWorks(f)).length,1);data=await(await f.call('',undefined,cookie)).json();assert.equal(data.artist.published,true);
 const bio='My biography celebrates light and quiet reflections.';assert.equal((await f.call('profile',{artist_id:id,bio},cookie)).status,200);assert.equal((await publicWorks(f))[0].artist_bio,'');assert.equal((await f.review(id,'approve-profile')).status,200);assert.equal((await publicWorks(f))[0].artist_bio,bio);
 await f.review(id,'hold-artist');assert.deepEqual(await publicWorks(f),[]);assert.equal((await(await f.call('',undefined,cookie)).json()).artist.published,false);
});
test('same email sees all submissions and cannot access another artist or their private image',async()=>{
 const f=fixture(),a=await(await upload(f)).json();f.advance(1000);const b=await(await upload(f,form({artwork_title:'Second work',email:' ARTIST@example.com '}))).json(),other=await(await upload(f,form({email:'someone@example.com'}))).json();
 const cookie=await f.login(),data=await(await f.call('',undefined,cookie)).json();assert.equal(data.artist.id,b.artist_id);assert.deepEqual(data.submissions.map(x=>x.id),[b.artist_id,a.artist_id]);
 assert.equal((await f.call('submission='+a.artist_id,undefined,cookie)).status,200);for(const query of ['submission=','action=image&submission='])assert.equal((await f.call(query+other.artist_id,undefined,cookie)).status,404);
 assert.equal((await f.call('profile',{artist_id:other.artist_id,bio:'A biography that must never be saved.'},cookie)).status,404);assert.equal((await f.call('action=image&submission='+a.artist_id)).status,401);
 const raw=await f.getStore('hugs-artists').get('artists');raw.artists[0].admin_note='PRIVATE ADMIN NOTE';raw.artists[0].moderation.flags=['private flag'];await f.getStore('hugs-artists').setJSON('artists',raw);const safe=JSON.stringify(await(await f.call('',undefined,cookie)).json());assert(!safe.includes('PRIVATE ADMIN NOTE'));assert(!safe.includes('private flag'));
});
test('login configuration and delivery failures are honest and do not reveal credentials',async()=>{
 const f=fixture();delete f.env.HUGS_VOTER_RESEND_API_KEY;assert.deepEqual(await(await f.call('config')).json(),{ok:true,configured:false});assert.equal((await f.call('request',{email:'artist@example.com'})).status,503);assert.equal(f.mail.length,0);
 await upload(f);f.env.HUGS_VOTER_RESEND_API_KEY='fake';const failed=createArtistAccountHandler({getStore:f.getStore,env:f.env,fetcher:async()=>new Response('private upstream error',{status:500})});const result=await failed(new Request('https://gallery.example/account?action=request',{method:'POST',headers:{origin:'https://gallery.example','Content-Type':'application/json'},body:JSON.stringify({email:'artist@example.com'})}));assert.equal(result.status,503);assert(!(await result.text()).includes('private upstream error'));
});
test('email requests use a generic response and a per-email cooldown',async()=>{
 const f=fixture();await upload(f);const known=await(await f.call('request',{email:'artist@example.com'})).json(),unknown=await(await f.call('request',{email:'unknown@example.com'})).json();assert.deepEqual(known,unknown);await f.call('request',{email:'ARTIST@EXAMPLE.COM'});assert.equal(f.mail.length,1);f.advance(60001);await f.call('request',{email:'artist@example.com'});assert.equal(f.mail.length,2);
});
test('expired, tampered and already used login links cannot establish a session',async()=>{
 for(const condition of ['expired','tampered','reused']){const f=fixture();await upload(f);await f.call('request',{email:'artist@example.com'});let token=new URL(f.mail[0].text.match(/https:\/\/\S+/)[0]).searchParams.get('login');if(condition==='expired')f.advance(15*60000+1);if(condition==='tampered')token='x'+token.slice(1);if(condition==='reused')assert.equal((await f.call('verify',{token})).status,200);assert.equal((await f.call('verify',{token})).status,401)}
});
test('concurrent use of one login link succeeds exactly once',async()=>{
 const f=fixture();await upload(f);await f.call('request',{email:'artist@example.com'});const token=new URL(f.mail[0].text.match(/https:\/\/\S+/)[0]).searchParams.get('login');const attempts=await Promise.all([f.call('verify',{token}),f.call('verify',{token})]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,401]);
});
test('session signature, expiry, origin and malformed requests are checked',async()=>{
 const f=fixture();await upload(f);const cookie=await f.login();assert.equal((await f.call('',undefined,cookie+'x')).status,401);assert.equal((await f.call('profile',{bio:'A biography with enough characters.'},cookie,'https://evil.example')).status,403);assert.equal((await f.call('request',{email:'invalid'})).status,400);f.advance(12*60*60000+1);assert.equal((await f.call('',undefined,cookie)).status,401);
});
test('upload retries return the original reference without creating another image',async()=>{
 const f=fixture(),id=crypto.randomUUID();const a=await(await upload(f,form({submission_request_id:id}))).json(),b=await(await upload(f,form({submission_request_id:id}))).json();assert.equal(a.artist_id,b.artist_id);assert.equal(b.duplicate,true);assert.equal((await f.getStore('hugs-artists').get('artists')).artists.length,1);assert.equal([...f.entries.keys()].filter(k=>k.startsWith('hugs-art-images:')).length,1);
});
test('concurrent submissions survive compare-and-set retries; identical retries deduplicate',async()=>{
 for(const same of [false,true]){const f=fixture(),id=crypto.randomUUID();const results=await Promise.all([upload(f,form({submission_request_id:id})),upload(f,form({submission_request_id:same?id:crypto.randomUUID()}))]);assert(results.every(r=>r.status===201));assert.equal((await f.getStore('hugs-artists').get('artists')).artists.length,same?1:2);assert.equal([...f.entries.keys()].filter(k=>k.startsWith('hugs-art-images:')).length,same?1:2)}
});
test('invalid origin, rights, request id and image files never enter the review queue',async()=>{
 const f=fixture();assert.equal((await upload(f,form(),'https://evil.example')).status,403);assert.equal((await upload(f,form({rights_confirmation:'no'}))).status,400);assert.equal((await upload(f,form({submission_request_id:'invalid'}))).status,400);
 for(const [blob,expected] of [[new Blob(['not an image'],{type:'image/png'}),415],[new Blob(['not allowed'],{type:'image/svg+xml'}),415],[new Blob([new Uint8Array(4*1024*1024+1)],{type:'image/png'}),413]]){const data=form();data.set('artwork',blob,'bad');assert.equal((await upload(f,data)).status,expected)}assert.equal(f.entries.size,0);
});
test('biography changes stay with their selected submission and reject invalid lengths',async()=>{
 const f=fixture(),a=await(await upload(f)).json(),b=await(await upload(f)).json(),cookie=await f.login();assert.equal((await f.call('profile',{artist_id:a.artist_id,bio:'short'},cookie)).status,400);assert.equal((await f.call('profile',{artist_id:a.artist_id,bio:'x'.repeat(801)},cookie)).status,400);assert.equal((await f.call('profile',{artist_id:a.artist_id,bio:'An original biography for the first submission.'},cookie)).status,200);const records=(await f.getStore('hugs-artists').get('artists')).artists;assert.equal(records.find(x=>x.id===a.artist_id).profile_review_status,'Pending Review');assert.equal(records.find(x=>x.id===b.artist_id).proposed_bio,undefined);
});

// Existing collection records are linked only through private owner configuration, never artist name matching.
async function seedCollection(f){const records=mergeSwanProposals([]).map(a=>({...a,status:'Approved'}));await f.getStore('hugs-artists').setJSON('artists',{artists:records});await f.getStore('hugs-art-gallery').setJSON('gallery',{works:records.map(a=>({id:a.artwork_id,published:true,source_artist_submission_id:a.id,image_url:a.preview_image_url}))});return records}
test('configured owner can sign in to the existing Swan collection without resubmission or public email exposure',async()=>{
 const f=fixture();f.env.HL_SWAN_ARTIST_EMAIL=' OWNER@example.com ';await seedCollection(f);const cookie=await f.login('owner@example.com'),studio=await(await f.call('',undefined,cookie)).json();assert.equal(studio.submissions.length,3);assert(studio.submissions.every(a=>a.status==='Approved'&&a.published));assert(!JSON.stringify(studio).includes('owner@example.com'));assert(!(await(await f.call('config')).text()).includes('owner@example.com'));assert.equal((await publicWorks(f)).length,3);
 assert.equal((await f.call('profile',{artist_id:'SWAN-PROPOSAL-stillwater',bio:'A biography for this existing collection artwork.'},cookie)).status,200);assert.equal((await f.getStore('hugs-artists').get('artists')).artists.length,3);
});
test('artist names and lookalike IDs cannot claim collection ownership; explicit record owners are preserved',async()=>{
 const f=fixture();await seedCollection(f);await f.call('request',{email:'owner@example.com'});assert.equal(f.mail.length,0);f.advance(60001);f.env.HL_SWAN_ARTIST_EMAIL='owner@example.com';const data=await f.getStore('hugs-artists').get('artists');data.artists.push({id:'SWAN-PROPOSAL-fake',source:'swan-collection-proposal',artist_name:'Swan the Artist'},{id:'OTHER-SWAN',artist_name:'Swan the Artist'});data.artists.find(a=>a.id==='SWAN-PROPOSAL-ascension').email='different@example.com';await f.getStore('hugs-artists').setJSON('artists',data);
 const cookie=await f.login('owner@example.com'),studio=await(await f.call('',undefined,cookie)).json();assert.equal(studio.submissions.length,2);assert(!studio.submissions.some(a=>a.id==='SWAN-PROPOSAL-ascension'));assert.equal((await f.call('submission=SWAN-PROPOSAL-fake',undefined,cookie)).status,404);
});
test('changing assigned ownership invalidates old email links and sessions',async()=>{
 const f=fixture();f.env.HL_SWAN_ARTIST_EMAIL='owner@example.com';await seedCollection(f);const cookie=await f.login('owner@example.com');f.advance(60001);await f.call('request',{email:'owner@example.com'});const token=new URL(f.mail.at(-1).text.match(/https:\/\/\S+/)[0]).searchParams.get('login');f.env.HL_SWAN_ARTIST_EMAIL='new-owner@example.com';assert.equal((await f.call('verify',{token})).status,401);assert.equal((await f.call('',undefined,cookie)).status,401);
});

test('delivery diagnostics distinguish actionable failures without returning upstream messages or private recipients',async()=>{
 for(const [status,message,code] of [[401,'API key is invalid. PRIVATE','MAIL_KEY_INVALID'],[403,'You can only send testing emails to your own email address (private@example.com).','MAIL_TEST_RESTRICTION'],[403,'The example.com domain is not verified. PRIVATE','MAIL_SENDER_UNVERIFIED'],[403,'PRIVATE','MAIL_PERMISSION'],[429,'PRIVATE','MAIL_RATE_LIMIT'],[500,'PRIVATE','MAIL_PROVIDER_UNAVAILABLE'],[400,'PRIVATE','MAIL_REJECTED']]){const result=await artistMailFailure(new Response(JSON.stringify({message}),{status}));assert.equal(result.code,code);assert(!JSON.stringify(result).includes('PRIVATE'));assert(!JSON.stringify(result).includes('private@example.com'))}
});
