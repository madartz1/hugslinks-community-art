export function createGalleryVotingHandler({makeSql,getStore,digest,guestVoter,env=()=>process.env}){
 const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
 return async request=>{
  const config=typeof env==='function'?env():env,open=config.HUGS_ENABLE_PUBLIC_VOTING==='true';
  if(!['GET','POST'].includes(request.method))return json({ok:false,error:'Method not allowed'},405);
  if(request.method==='POST'&&!open)return json({ok:false,error:'Public voting is not open yet.'},503);
  if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return json({ok:false,error:'Vote from the gallery page.'},403);
  if(!config.HUGS_VOTER_SESSION_SECRET||!config.HUGS_VOTING_DATABASE_URL)return json({ok:false,error:'Voting not configured'},503);
  try{
   const sql=makeSql(config.HUGS_VOTING_DATABASE_URL),gallery=await getStore('hugs-art-gallery').get('gallery',{type:'json',consistency:'strong'}),works=(gallery?.works||[]).filter(w=>w.published===true);
   if(request.method==='GET'){
    const rows=await sql`SELECT artwork_id,COUNT(*)::int AS votes FROM hugs_art_ratings GROUP BY artwork_id`,counts=new Map(rows.map(r=>[r.artwork_id,r.votes]));
    return json({ok:true,voting_open:open,scores:works.map(w=>({id:w.id,votes:counts.get(w.id)||0}))});
   }
   let body;try{body=await request.json()}catch{return json({ok:false,error:'Invalid request'},400)}
   const id=typeof body?.artwork_id==='string'?body.artwork_id:'';if(!works.some(w=>w.id===id))return json({ok:false,error:'Choose published artwork.'},400);
   const guest=guestVoter(request),hash=await digest(guest.id+':'+config.HUGS_VOTER_SESSION_SECRET),headers=guest.header?{'Set-Cookie':guest.header}:{};
   const inserted=await sql`INSERT INTO hugs_art_ratings(artwork_id,voter_hash,rating) VALUES(${id},${hash},${1}) ON CONFLICT DO NOTHING RETURNING artwork_id`;
   if(!inserted.length)return json({ok:false,error:'You already voted for this artwork from this browser.'},409,headers);
   const [score]=await sql`SELECT COUNT(*)::int AS votes FROM hugs_art_ratings WHERE artwork_id=${id}`;
   return json({ok:true,artwork_id:id,votes:score.votes,message:'Your vote was counted.'},200,headers);
  }catch(error){console.warn('Gallery vote service unavailable',{code:error?.code||'connection_error'});return json({ok:false,error:'Voting temporarily unavailable.'},503)}
 };
}
