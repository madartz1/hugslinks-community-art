(()=>{
const rooms=[
 ['manhattan-loft','horizon-manhattan-loft.jpg','Manhattan Loft','archive-horizon'],
 ['luxury-condo','horizon-luxury-condo.jpg','Luxury Condo','archive-horizon'],
 ['hotel-lobby','horizon-hotel-lobby.jpg','Hotel Lobby','archive-horizon'],
 ['dining-room','horizon-dining-room.jpg','Dining Room','archive-horizon'],
 ['modern-penthouse','swan-modern-penthouse.jpg','Modern Penthouse','archive-eye'],
 ['living-room','swan-luxury-living-room.jpg','Living Room','archive-eye'],
 ['executive-office','swan-executive-office.jpg','Executive Office','archive-eye'],
 ['hotel-suite','swan-hotel-suite.jpg','Hotel Suite','archive-eye']
].map(([id,file,name,art])=>({id,file,name,art,url:id==='manhattan-loft'?'/assets/manhattan-loft-room.jpg':'https://hugslinks.com/assets/rooms/'+file}));
const works={
 'archive-horizon':{title:'Golden Horizon',image:'/assets/golden-horizon.jpg',description:'A city skyline glows through layers of gold and shadow, reflecting the energy and possibility of a new horizon.'},
 'archive-eye':{title:'Swan — The Eye',image:'/assets/swan-eye.jpg',description:'A luminous swan emerges from darkness, its graceful form traced in gold. An invitation to pause with the quiet power of transformation.'}
};
const $=id=>document.getElementById(id),preview=$('roomPreview'),image=$('roomImage'),picker=$('roomPicker');if(!preview)return;
const storageKey='hl-art-gallery-saved-rooms';let saved=new Set();try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(value))saved=new Set(value.filter(x=>rooms.some(r=>r.id===x)))}catch{}
const dialog=document.createElement('dialog');dialog.id='roomViewer';dialog.className='room-viewer';dialog.setAttribute('aria-labelledby','roomViewerTitle');
dialog.innerHTML='<div class="room-viewer-shell"><header class="room-viewer-head"><div><small>HL ART GALLERY · IN YOUR SPACE</small><h2 id="roomViewerTitle"></h2></div><button id="closeRoomViewer" type="button" aria-label="Close larger room view">Close ✕</button></header><div class="room-viewer-layout"><div class="room-viewer-visual"><div class="room-viewer-modes" role="group" aria-label="Viewing mode"><button id="roomMode" type="button" aria-pressed="true">Room view</button><button id="artMode" type="button" aria-pressed="false">Artwork detail</button><button id="fullscreenRoom" type="button">⛶ Full screen</button></div><div class="room-viewer-canvas" id="roomViewerCanvas"><div class="room-image-stage"><img id="roomViewerImage" alt=""></div><p id="roomImageError" role="status" hidden></p></div><div class="room-viewer-navigation"><button id="previousRoom" type="button" aria-label="Previous room">← Previous room</button><span id="roomViewerCount" aria-live="polite"></span><button id="nextRoom" type="button" aria-label="Next room">Next room →</button></div><p class="room-swipe-hint">Swipe left or right to change rooms. Turn your phone sideways for a wider view.</p></div><aside class="room-viewer-details"><p class="room-viewer-eyebrow">ON THE WALL</p><h3 id="roomArtworkTitle"></h3><p class="room-artist">Swan the Artist</p><p id="roomArtworkDescription"></p><p class="room-illustration-note">Illustrative room presentation. Artwork size and placement are a visual guide, not a measured installation.</p><a id="roomArtworkLink" class="room-details-link">Explore this artwork →</a><a id="roomPlannerLink" class="room-details-link">Try it in your room →</a><a id="roomPrintLink" class="room-details-link">Print details →</a><div class="room-viewer-actions"><button id="saveRoomView" type="button" aria-pressed="false">♡ Save this view</button><button id="shareRoomView" type="button">Share room</button></div><p id="roomViewerStatus" role="status" aria-live="polite"></p><p class="room-local-note">Saved views stay on this device.</p></aside></div><nav id="roomThumbnails" class="room-thumbnails" aria-label="Choose another room"></nav></div>';
document.body.append(dialog);
let current=0,mode='room',prior=null,oldOverflow='',swipe=null;
const query=new URLSearchParams(location.search),requested=rooms.findIndex(r=>r.id===query.get('room'));if(requested>=0)current=requested;
function link(open=false){const u=new URL(location.href);u.searchParams.set('room',rooms[current].id);if(open)u.searchParams.set('view','room');else u.searchParams.delete('view');return u}
function updateURL(){try{history.replaceState(null,'',link(dialog.open))}catch{}}
function setImage(node,url,alt){node.hidden=false;node.alt=alt;node.src=url}
function render(){const room=rooms[current],work=works[room.art];
 preview.dataset.crop=String(current!==0);$('roomViewerCanvas').dataset.crop=String(mode==='room'&&current!==0);setImage(image,room.url,room.name+' with '+work.title+' by Swan the Artist');$('roomPreviewTitle').textContent=room.name;
 $('roomDescription').textContent=work.title+' · Swan the Artist · Illustrative interior';preview.setAttribute('aria-label','Open larger view of '+room.name+' with '+work.title);
 $('roomViewerTitle').textContent=room.name;$('roomArtworkTitle').textContent=work.title;$('roomArtworkDescription').textContent=work.description;
 $('roomPlannerLink').href='room-planner.html?artwork='+encodeURIComponent(room.art);$('roomArtworkLink').href='virtual-gallery.html?artwork='+encodeURIComponent(room.art);$('roomPrintLink').href='buy-print.html?artwork='+encodeURIComponent(room.art);
 $('roomViewerCount').textContent=(current+1)+' / '+rooms.length;
 $('roomImageError').hidden=true;setImage($('roomViewerImage'),mode==='room'?room.url:work.image,mode==='room'?room.name+' with '+work.title:work.title+' by Swan the Artist');
 $('roomMode').setAttribute('aria-pressed',String(mode==='room'));$('artMode').setAttribute('aria-pressed',String(mode==='art'));
 $('saveRoomView').setAttribute('aria-pressed',String(saved.has(room.id)));$('saveRoomView').textContent=saved.has(room.id)?'♥ Saved on this device':'♡ Save this view';
 [...picker.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===current)));[...$('roomThumbnails').children].forEach((b,i)=>{b.setAttribute('aria-current',String(i===current));b.setAttribute('aria-label',rooms[i].name+(saved.has(rooms[i].id)?' · Saved':''))});
 updateURL();
}
function select(i){current=(i+rooms.length)%rooms.length;$('roomViewerStatus').textContent='';render()}
function close(){if(document.fullscreenElement===dialog)document.exitFullscreen?.().catch(()=>{});dialog.close()}
function open(){if(dialog.open)return;prior=document.activeElement;oldOverflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';render();$('closeRoomViewer').focus()}
rooms.forEach((room,i)=>{const b=document.createElement('button');b.type='button';b.textContent=room.name;b.onclick=()=>select(i);picker.append(b);const t=document.createElement('button');t.type='button';const thumb=document.createElement('img');thumb.src=room.url;thumb.alt='';thumb.loading='lazy';const label=document.createElement('span');label.textContent=room.name;t.append(thumb,label);t.onclick=()=>select(i);$('roomThumbnails').append(t)});
image.onerror=()=>{image.hidden=true;$('roomDescription').textContent='This room image is temporarily unavailable. Open the viewer to see the artwork or select another room.'};
const viewerImage=$('roomViewerImage');viewerImage.onerror=()=>{viewerImage.hidden=true;$('roomImageError').hidden=false;$('roomImageError').textContent='This image is temporarily unavailable. Try artwork detail or choose another room.'};
preview.onclick=open;$('closeRoomViewer').onclick=close;$('previousRoom').onclick=()=>select(current-1);$('nextRoom').onclick=()=>select(current+1);
for(const [id,value]of [['roomMode','room'],['artMode','art']])$(id).onclick=()=>{mode=value;render()};
if(!dialog.requestFullscreen)$('fullscreenRoom').hidden=true;else $('fullscreenRoom').onclick=async()=>{try{if(document.fullscreenElement===dialog)await document.exitFullscreen();else await dialog.requestFullscreen()}catch{$('roomViewerStatus').textContent='The expanded view is ready. This browser does not support full-screen mode.'}};
dialog.addEventListener('close',()=>{document.body.style.overflow=oldOverflow;updateURL();if(prior?.isConnected)prior.focus()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
dialog.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='ArrowRight'){e.preventDefault();select(current+1)}if(e.key==='ArrowLeft'){e.preventDefault();select(current-1)}});
const canvas=$('roomViewerCanvas');canvas.addEventListener('touchstart',e=>{swipe=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});canvas.addEventListener('touchend',e=>{if(!swipe)return;const dx=e.changedTouches[0].clientX-swipe.x,dy=e.changedTouches[0].clientY-swipe.y;swipe=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)select(current+(dx<0?1:-1))},{passive:true});
 $('saveRoomView').onclick=()=>{const id=rooms[current].id;if(saved.has(id))saved.delete(id);else saved.add(id);try{localStorage.setItem(storageKey,JSON.stringify([...saved]));render();$('roomViewerStatus').textContent=saved.has(id)?'View saved on this device.':'Saved view removed.'}catch{$('roomViewerStatus').textContent='This browser could not save the view.'}};
 $('shareRoomView').onclick=async()=>{const url=link(true).href;try{if(navigator.share)await navigator.share({title:rooms[current].name+' · HL Art Gallery',url});else{await navigator.clipboard.writeText(url);$('roomViewerStatus').textContent='Room link copied.'}}catch(e){if(e.name!=='AbortError')$('roomViewerStatus').textContent='Sharing is unavailable. You can copy this page’s address.'}};
 render();if(query.get('view')==='room')open();
})();
