import {validPublicationDate} from '../../publication-dates.js';
export function publicGalleryWorks(works,artists=[]){
 const dates=new Map(artists.filter(a=>a&&a.id).map(a=>[a.id,validPublicationDate(a.artwork_published_at)]));
 return (Array.isArray(works)?works:[]).filter(w=>w&&w.published===true).map(w=>({id:w.id,title:w.title,artist_name:w.artist_name,collection:w.collection,image_url:w.image_url,description:w.description,medium:w.medium,year:w.year,room_images:Array.isArray(w.room_images)?w.room_images:[],featured:w.featured===true,artist_bio:typeof w.artist_bio==='string'?w.artist_bio.slice(0,800):'',published_at:validPublicationDate(w.published_at)||dates.get(w.source_artist_submission_id)||null,updated_at:validPublicationDate(w.updated_at)}));
}
export function createPublicGalleryHandler(getStore){return async request=>{
 const json=(b,status=200)=>new Response(JSON.stringify(b),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 if(request.method!=='GET')return json({ok:false,error:'Method not allowed.'},405);
 try{const gallery=await getStore('hugs-art-gallery').get('gallery',{type:'json',consistency:'strong'});let artists=[];
  if((gallery?.works||[]).some(w=>w.published===true&&!validPublicationDate(w.published_at))){try{const d=await getStore('hugs-artists').get('artists',{type:'json',consistency:'strong'});artists=Array.isArray(d?.artists)?d.artists:Array.isArray(d)?d:[]}catch{}}
  return json({ok:true,works:publicGalleryWorks(gallery?.works,artists)});
 }catch{return json({ok:false,error:'Gallery unavailable.'},500)}
}}
