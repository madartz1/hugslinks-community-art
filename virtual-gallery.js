const $=id=>document.getElementById(id);
const initial=[
 {id:'archive-eye',title:'Swan — The Eye',artist:'Swan the Artist',collection:'Black Gold Series',url:'assets/swan-eye.jpg',description:'From the founding Black Gold Series.'},
 {id:'archive-horizon',title:'Golden Horizon',artist:'HUGSLinks archive',collection:'Luxe Collection',url:'assets/golden-horizon.jpg',description:'From the HUGSLinks founding collection.'}
];
let works=[...initial],engine=null,selected=null,priorFocus=null;
const requested=new URLSearchParams(location.search).get('artwork');
const validURL=value=>{try{return ['http:','https:'].includes(new URL(value,location.href).protocol)}catch{return false}};
function drawCatalogue(){
 $('artworks').replaceChildren();
 for(const work of works){
  const b=document.createElement('button');b.type='button';b.className='art-card';b.setAttribute('aria-pressed',String(selected===work.id));
  const mount=document.createElement('div');mount.className='mount';
  const img=document.createElement('img');img.src=work.url;img.alt=work.title+' by '+work.artist;img.loading='lazy';
  const title=document.createElement('h3');title.textContent=work.title;
  const author=document.createElement('p');author.textContent=work.artist;
  const action=document.createElement('small');action.textContent='Approach artwork ↗';
  mount.append(img);b.append(mount,title,author,action);b.onclick=async()=>{await enter();if(engine){if(!engine.approach(work.id))showDetails(work);$('gallery').scrollIntoView({behavior:'auto',block:'start'})}else showDetails(work)};$('artworks').append(b);
 }
}
function showDetails(work){
 selected=work.id;priorFocus=document.activeElement;
 $('detailImage').src=work.url;$('detailImage').alt=work.title+' by '+work.artist;
 $('detailTitle').textContent=work.title;$('detailArtist').textContent=work.artist;
 $('detailDescription').textContent=work.description||work.collection;
 $('artistLink').href=work.id.startsWith('archive-')?'art-collections.html':'artist-profile.html?artist='+encodeURIComponent(work.artist.trim().toLocaleLowerCase());
 $('artistLink').textContent=work.id.startsWith('archive-')?'Explore collection story →':'Explore artist →';
 $('shareStatus').textContent='';$('details').showModal();$('closeDetails').focus();drawCatalogue();
}
$('closeDetails').onclick=()=>$('details').close();
$('details').addEventListener('close',()=>priorFocus?.focus());
$('details').addEventListener('click',e=>{if(e.target===$('details')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
$('shareArt').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('artwork',selected);try{if(navigator.share)await navigator.share({title:$('detailTitle').textContent,url:url.href});else if(navigator.clipboard){await navigator.clipboard.writeText(url.href);$('shareStatus').textContent='Artwork link copied.'}else $('shareStatus').textContent=url.href}catch(e){if(e.name!=='AbortError')$('shareStatus').textContent=url.href}};
$('help').onclick=()=>{const open=$('instructions').hidden;$('instructions').hidden=!open;$('help').setAttribute('aria-expanded',String(open))};
$('enter').onclick=()=>enter();
drawCatalogue();
$('loadStatus').textContent='Ready when you are · Walk, look around, and discover.';
let loading=false;
async function enter(){
 if(engine){$('welcome').hidden=true;$('gallery').hidden=false;engine.resize();$('viewport').focus();return}
 if(loading)return;loading=true;$('enter').disabled=true;$('loadStatus').textContent='Opening the 3D exhibition…';
 try{
  const THREE=await import('./assets/vendor/three.min.js');
  $('gallery').hidden=false;engine=createGallery(THREE);$('welcome').hidden=true;engine.resize();$('viewport').focus();
  $('loadStatus').textContent='';if(requested&&works.some(w=>w.id===requested))engine.approach(requested);
 }catch(error){$('gallery').hidden=true;$('welcome').hidden=false;$('loadStatus').textContent='3D viewing is unavailable in this browser. Tap any artwork below for its full gallery details.';console.error('Virtual gallery unavailable',error)}
 finally{loading=false;$('enter').disabled=false}
}
function createGallery(T){
 const host=$('viewport'),scene=new T.Scene();scene.background=new T.Color('#e5dfd2');scene.fog=new T.Fog('#e5dfd2',24,50);
 const camera=new T.PerspectiveCamera(60,1,.1,70);camera.position.set(0,1.65,7.8);camera.rotation.order='YXZ';
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.replaceChildren(renderer.domElement);
 const mat=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const wall=mat('#e9e3d6'),walnut=mat('#51311e',.52),brass=mat('#9e8454',.35,.65),black=mat('#242725',.4,.4),leather=mat('#9d623b',.65);
 function box(w,h,d,x,y,z,material,parent=scene){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 // Long oak planks with restrained natural grain.
 const grain=document.createElement('canvas');grain.width=512;grain.height=512;const ctx=grain.getContext('2d');ctx.fillStyle='#b9a58a';ctx.fillRect(0,0,512,512);
 let seed=7;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 for(let i=0;i<1600;i++){ctx.strokeStyle='rgba(62,44,26,'+(rand()*.08)+')';ctx.beginPath();const y=rand()*512;ctx.moveTo(0,y);ctx.bezierCurveTo(150,y+rand()*8,350,y-rand()*8,512,y);ctx.stroke()}
 const woodTexture=new T.CanvasTexture(grain);woodTexture.colorSpace=T.SRGBColorSpace;woodTexture.wrapS=woodTexture.wrapT=T.RepeatWrapping;woodTexture.repeat.set(1,1);
 const plank=new T.MeshStandardMaterial({map:woodTexture,roughness:.64});
 for(let x=-7.75;x<8;x+=.5)for(let z=-8;z<10;z+=4)box(.495,.08,3.98,x,-.05,z,plank);
 box(16,4.8,.2,0,2.4,-10,wall);box(.2,4.8,20,-8,2.4,0,wall);box(.2,4.8,20,8,2.4,0,wall);box(16,.1,20,0,4.8,0,mat('#ded8cc'));
 // Entrance behind the viewer; physical railings frame a warm reception area.
 box(16,4.8,.2,0,2.4,10,wall);
 const ambient=new T.HemisphereLight('#fff8e8','#817766',2.25);scene.add(ambient);
 const fill=new T.DirectionalLight('#fff3dd',1.7);fill.position.set(1,4,5);scene.add(fill);
 for(const x of [-5,0,5])box(.055,.055,19,x,4.5,0,black);
 for(const z of [-7,-2,4])for(const x of [-5,5]){
  const fixture=new T.Mesh(new T.CylinderGeometry(.09,.07,.22,16),black);fixture.position.set(x,4.35,z);scene.add(fixture);
  const light=new T.SpotLight('#ffe4b8',38,13,Math.PI/4,.65,1.6);light.position.set(x,4.15,z);light.target.position.set(x<0?-7.7:7.7,2.2,z-1);scene.add(light,light.target);
 }
 // Gallery bench, leather panels, and real depth under the seat.
 box(4.1,.18,1.05,0,.5,1.4,walnut);for(const x of [-1.7,1.7])box(.22,.5,.88,x,.22,1.4,walnut);
 for(let i=0;i<7;i++)box(.57,.13,.97,-1.74+i*.58,.65,1.4,leather);
 // Pedestal and a polished bronze loop sculpture.
 box(.65,1.08,.65,6.25,.54,5.3,mat('#d4c6ae'));const sculpture=new T.Mesh(new T.TorusGeometry(.3,.065,16,48),brass);sculpture.position.set(6.25,1.48,5.3);sculpture.rotation.set(.25,.4,0);scene.add(sculpture);
 // Welcome lettering is rendered as a scene label, not baked into artwork.
 function label(text,w,h){const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#eee8dc';g.fillRect(0,0,c.width,c.height);g.fillStyle='#393b32';g.font='50px Georgia';g.textAlign='center';g.fillText(text,512,140,980);const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tx}))}
 const sign=label('H U G S   /   THE FOUNDING EXHIBITION',7,.7);sign.position.set(0,4,-9.87);scene.add(sign);
 let yaw=0,pitch=0,lastTime=performance.now(),active=true,drag=null,keys=new Set(),touchMove=null;
 const raycaster=new T.Raycaster(),pointer=new T.Vector2(),paintings=[],placements=new Map(),textureLoader=new T.TextureLoader();
 function select(id){selected=id;document.querySelectorAll('.art-card').forEach((b,i)=>b.setAttribute('aria-pressed',String(works[i]?.id===id)));const url=new URL(location.href);url.searchParams.set('artwork',id);history.replaceState(null,'',url)}
 function buildArtwork(work,i){
  let x,y=2.4,z,rotation,normal;
  if(i<2){x=i===0?-3:3;z=-9.82;rotation=0;normal=new T.Vector3(0,0,1)}
  else{const left=i%2===0;const row=Math.floor((i-2)/2);x=left?-7.82:7.82;z=-5.5+(row%4)*3.8;rotation=left?Math.PI/2:-Math.PI/2;normal=new T.Vector3(left?1:-1,0,0)}
  const group=new T.Group();group.position.set(x,y,z);group.rotation.y=rotation;scene.add(group);
  const position=new T.Vector3(x,y,z);placements.set(work.id,{group,position,normal,rotation,ready:false});
  textureLoader.load(work.url,texture=>{
   const ratio=texture.image.width/texture.image.height;let h=2.25,w=h*ratio;if(w>3.45){w=3.45;h=w/ratio}
   texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   const artwork=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}));artwork.position.z=.055;artwork.userData.work=work;group.add(artwork);paintings.push(artwork);
   // Four strips follow the actual image edges. No fixed-ratio mat or cropping.
   const f=.065;
   box(w+2*f,f,.105,0,h/2+f/2,0,walnut,group);box(w+2*f,f,.105,0,-h/2-f/2,0,walnut,group);
   box(f,h,.105,-w/2-f/2,0,0,walnut,group);box(f,h,.105,w/2+f/2,0,0,walnut,group);
   const plate=label(work.title+'  /  '+work.artist,Math.min(w,2.7),.22);plate.position.set(0,-h/2-.28,.07);group.add(plate);
   const light=new T.SpotLight('#fff0d5',55,9,.52,.8,1.6);light.position.copy(position.clone().add(normal.clone().multiplyScalar(2)));light.position.y=4.1;light.target.position.copy(position);scene.add(light,light.target);
   if(i<2){light.castShadow=true;light.shadow.mapSize.set(1024,1024)}
   placements.get(work.id).ready=true;
  },undefined,()=>{$('walkStatus').textContent='An artwork image could not load. Other works are still available.'});
 }
 function addWorks(){works.slice(0,10).forEach((w,i)=>{if(!placements.has(w.id))buildArtwork(w,i)})}
 addWorks();
 function resize(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height)}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function approach(id){const p=placements.get(id);if(!p)return false;camera.position.copy(p.position.clone().add(p.normal.clone().multiplyScalar(4.2)));camera.position.y=1.7;yaw=p.rotation;pitch=.1;select(id);$('walkStatus').textContent='Tap the painting to meet the artist';camera.rotation.set(pitch,yaw,0);host.focus();return true}
 function reset(){camera.position.set(0,1.65,7.8);yaw=0;pitch=0;camera.rotation.set(0,0,0);$('walkStatus').textContent='Drag to look · Tap artwork to discover';host.focus()}
 $('home').onclick=reset;
 host.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,total:0};host.setPointerCapture(e.pointerId);host.focus()});
 host.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.total+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.004;pitch=Math.max(-.6,Math.min(.6,pitch-dy*.003));drag.x=e.clientX;drag.y=e.clientY;camera.rotation.set(pitch,yaw,0)});
 host.addEventListener('pointerup',e=>{if(drag&&drag.total<8){const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(paintings)[0];if(hit){select(hit.object.userData.work.id);showDetails(hit.object.userData.work)}}drag=null});
 host.addEventListener('pointercancel',()=>drag=null);
 host.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase())}});
 host.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
 host.addEventListener('blur',()=>keys.clear());window.addEventListener('blur',()=>{keys.clear();touchMove=null});
 for(const button of document.querySelectorAll('[data-move]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();touchMove=button.dataset.move;button.setPointerCapture(e.pointerId)});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>touchMove=null);
 }
 document.addEventListener('visibilitychange',()=>{active=!document.hidden;keys.clear();touchMove=null;lastTime=performance.now()});
 function animate(now){const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;
  if(active&&!$('details').open){
   let f=(keys.has('w')||keys.has('arrowup')||touchMove==='forward'?1:0)-(keys.has('s')||keys.has('arrowdown')||touchMove==='back'?1:0);
   let side=(keys.has('d')||keys.has('arrowright')||touchMove==='right'?1:0)-(keys.has('a')||keys.has('arrowleft')||touchMove==='left'?1:0);
   const scale=3*dt/Math.max(1,Math.hypot(f,side));const nx=camera.position.x+(-Math.sin(yaw)*f+Math.cos(yaw)*side)*scale,nz=camera.position.z+(-Math.cos(yaw)*f-Math.sin(yaw)*side)*scale;
   if(!(Math.abs(nx)<2.4&&nz>.65&&nz<2.15)&&!(nx>5.5&&nz>4.6&&nz<6)){camera.position.x=Math.max(-7.25,Math.min(7.25,nx));camera.position.z=Math.max(-9.15,Math.min(9.1,nz))}
   renderer.render(scene,camera);
  }
  requestAnimationFrame(animate)
 }
 requestAnimationFrame(animate);
 return {resize,approach,addWorks};
}
fetch('/.netlify/functions/art-gallery',{cache:'no-store'}).then(r=>r.json()).then(data=>{
 if(!data.ok||!Array.isArray(data.works))throw Error('Gallery unavailable');
 const seen=new Set(works.map(w=>w.url));for(const w of data.works){if(!w?.id||!w.image_url||w.published===false||!validURL(w.image_url)||seen.has(w.image_url))continue;seen.add(w.image_url);works.push({id:w.id,title:w.title||'Untitled',artist:w.artist_name||'Community artist',collection:w.collection||'Community Gallery',description:w.description||w.artist_bio||'',url:w.image_url})}
 drawCatalogue();engine?.addWorks();if(engine&&requested&&works.some(w=>w.id===requested))engine.approach(requested);
 $('collectionStatus').textContent=works.length>initial.length?'The founding collection and approved community artwork. The first ten works are hung in this exhibition; every published work is available below.':'The founding collection · Published community artwork will join the exhibition.';
}).catch(()=>$('collectionStatus').textContent='Showing the founding collection. Community artwork is temporarily unavailable.');
