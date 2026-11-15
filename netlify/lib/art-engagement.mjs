const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const value=(env)=>typeof env==='function'?env():env;
const published=async getStore=>{const d=await getStore('hugs-art-gallery').get('gallery',{type:'json',consistency:'strong'});return (d?.works||[]).filter(w=>w&&w.published===true&&typeof w.id==='string')};
const ready=env=>env.HUGS_ENABLE_ART_ENGAGEMENT==='true'&&!!env.HUGS_VOTING_DATABASE_URL&&!!env.HUGS_VOTER_SESSION_SECRET;
async function body(request){if(!(request.headers.get('content-type')||'').includes('application/json'))throw Error('json');const raw=await request.text();if(raw.length>6000)throw Error('large');return JSON.parse(raw)}
const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;
export function createAppreciationHandler({makeSql,getStore,guestVoter,digest,env=()=>process.env}){
 return async request=>{
  if(!['GET','POST'].includes(request.method))return json({ok:false,error:'Method not allowed'},405);
  const config=value(env);if(!ready(config))return json({ok:false,error:'Appreciations are not available in this deployment.'},503);
  if(request.method==='POST'&&!sameOrigin(request))return json({ok:false,error:'React from the gallery page.'},403);
  try{const works=await published(getStore),sql=makeSql(config.HUGS_VOTING_DATABASE_URL),guest=guestVoter(request),hash=await digest(guest.id+':'+config.HUGS_VOTER_SESSION_SECRET),headers=guest.header?{'Set-Cookie':guest.header}:{};
   if(request.method==='GET'){
    const requested=new URL(request.url).searchParams.get('ids');let ids=requested?requested.split(','):[...works.map(w=>w.id)];if(ids.length>200)return json({ok:false,error:'Request up to 200 artworks at a time.'},400);
    ids=[...new Set(ids)].filter(id=>works.some(w=>w.id===id));
    const rows=ids.length?await sql`SELECT artwork_id,COUNT(*)::int AS appreciations,BOOL_OR(voter_hash=${hash}) AS appreciated FROM hugs_art_appreciations WHERE artwork_id=ANY(${ids}::text[]) GROUP BY artwork_id`:[];
    const map=new Map(rows.map(r=>[r.artwork_id,r]));return json({ok:true,items:ids.map(id=>({id,count:map.get(id)?.appreciations||0,appreciated:map.get(id)?.appreciated===true}))},200,headers);
   }
   let b;try{b=await body(request)}catch{return json({ok:false,error:'Send a valid JSON request.'},400)}
   if(typeof b?.appreciated!=='boolean'||!works.some(w=>w.id===b.artwork_id))return json({ok:false,error:'Choose a published artwork and an appreciation action.'},400);
   if(b.appreciated)await sql`INSERT INTO hugs_art_appreciations(artwork_id,voter_hash) VALUES(${b.artwork_id},${hash}) ON CONFLICT DO NOTHING`;
   else await sql`DELETE FROM hugs_art_appreciations WHERE artwork_id=${b.artwork_id} AND voter_hash=${hash}`;
   const [row]=await sql`SELECT COUNT(*)::int AS appreciations,COALESCE(BOOL_OR(voter_hash=${hash}),false) AS appreciated FROM hugs_art_appreciations WHERE artwork_id=${b.artwork_id}`;
   return json({ok:true,id:b.artwork_id,count:row?.appreciations||0,appreciated:row?.appreciated===true},200,headers);
  }catch{return json({ok:false,error:'Appreciations are temporarily unavailable. Please try again.'},503)}
 };
}
export function createArtworkReportHandler({makeSql,getStore,guestVoter,digest,env=()=>process.env,makeId=()=>crypto.randomUUID()}){
 return async request=>{
  if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
  const config=value(env);if(!ready(config))return json({ok:false,error:'Reporting is not available in this deployment. Contact the gallery for help.'},503);
  if(!sameOrigin(request))return json({ok:false,error:'Submit the report from the gallery page.'},403);
  let b;try{b=await body(request)}catch{return json({ok:false,error:'Send a valid JSON report.'},400)}
  if(!['rights','harmful','privacy','other'].includes(b?.category)||typeof b.details!=='string'||b.details.trim().length<10||b.details.length>1000)return json({ok:false,error:'Choose a reason and describe the concern in 10–1000 characters.'},400);
  try{const w=(await published(getStore)).find(w=>w.id===b.artwork_id);if(!w)return json({ok:false,error:'Choose published artwork to report.'},400);
   const sql=makeSql(config.HUGS_VOTING_DATABASE_URL),guest=guestVoter(request),hash=await digest(guest.id+':'+config.HUGS_VOTER_SESSION_SECRET),headers=guest.header?{'Set-Cookie':guest.header}:{};
   const rows=await sql`INSERT INTO hugs_art_reports(id,artwork_id,artwork_title,artist_name,reporter_hash,category,details) VALUES(${makeId()},${w.id},${String(w.title||'Untitled').slice(0,180)},${String(w.artist_name||'').slice(0,180)},${hash},${b.category},${b.details.trim()}) ON CONFLICT(artwork_id,reporter_hash,report_day) DO NOTHING RETURNING id`;
   if(!rows.length)return json({ok:false,error:'A report for this artwork has already been received from this browser today.'},409,headers);
   return json({ok:true,reference:rows[0].id,message:'Your report was received for private review. It does not automatically remove the artwork.'},201,headers);
  }catch{return json({ok:false,error:'We could not save your report. Please try again or contact the gallery.'},503)}
 };
}
export function createReportAdminHandler({makeSql,env=()=>process.env}){
 return async request=>{
  const config=value(env),secret=String(config.HUGS_ADMIN_TOKEN||'').trim(),auth=request.headers.get('authorization')||'';
  if(!secret||auth!=='Bearer '+secret)return json({ok:false,error:'Unauthorized'},401);
  if(!config.HUGS_VOTING_DATABASE_URL||config.HUGS_ENABLE_ART_ENGAGEMENT!=='true')return json({ok:false,error:'The report queue is not configured in this deployment.'},503);
  if(!['GET','POST'].includes(request.method))return json({ok:false,error:'Method not allowed'},405);
  if(request.method==='POST'&&request.headers.get('origin')&&!sameOrigin(request))return json({ok:false,error:'Invalid origin'},403);
  try{const sql=makeSql(config.HUGS_VOTING_DATABASE_URL);
   if(request.method==='GET'){
    const q=new URL(request.url).searchParams,status=q.get('status')||'open',page=Number(q.get('page')||0);if(!['open','reviewed','dismissed','all'].includes(status)||!Number.isSafeInteger(page)||page<0||page>1000)return json({ok:false,error:'Invalid queue filter'},400);
    const filter=status==='all'?null:status;
    const rows=await sql`SELECT id,artwork_id,artwork_title,artist_name,category,details,status,admin_note,version,created_at,reviewed_at FROM hugs_art_reports WHERE (${filter}::text IS NULL OR status=${filter}) ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ${page*50}`;
    return json({ok:true,reports:rows.slice(0,50),has_more:rows.length>50,page});
   }
   let b;try{b=await body(request)}catch{return json({ok:false,error:'Send a valid JSON update.'},400)}
   if(typeof b?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.id)||!['open','reviewed','dismissed'].includes(b.status)||!Number.isSafeInteger(b.expected_version)||b.expected_version<1||typeof b.admin_note!=='string'||b.admin_note.trim().length<5||b.admin_note.length>1000)return json({ok:false,error:'Select a report, choose a status and add a private review note (5–1000 characters).'},400);
   const rows=await sql`UPDATE hugs_art_reports SET status=${b.status},admin_note=${b.admin_note.trim()},reviewed_at=now(),version=version+1 WHERE id=${b.id}::uuid AND version=${b.expected_version} RETURNING id,status,version`;
   if(!rows.length)return json({ok:false,error:'This report changed or is no longer available. Refresh before reviewing it.'},409);
   return json({ok:true,report:rows[0],message:'Private review saved. Artwork publication has not changed.'});
  }catch{return json({ok:false,error:'The private report queue is temporarily unavailable.'},503)}
 };
}
