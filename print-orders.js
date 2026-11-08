(()=>{let token='',generation=0;const $=id=>document.getElementById(id);const status=t=>$('status').textContent=t;const api=async(method='GET',body)=>{const r=await fetch('/.netlify/functions/art-print-payments?action=orders',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Object.assign(Error(j.error||'Request failed'),{status:r.status});return j};const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);function clear(){$('orders').replaceChildren()}function card(o){const e=document.createElement('article');e.className='order';const h=document.createElement('div');h.className='order-head';const title=document.createElement('h2');title.textContent=o.printSize||o.editionId||'Print order';const badge=document.createElement('span');badge.className='badge';badge.textContent=o.reviewStatus.replaceAll('_',' ');h.append(title,badge);e.append(h);const g=document.createElement('div');g.className='grid';const rows=[['Order',o.id],['Artwork',o.artworkId],['SKU',o.sku],['Payment',o.paymentStatus],['Print',money(o.priceCents)],['Shipping',money(o.shippingCents)],['Total',money(o.totalCents)],['Created',new Date(o.createdAt).toLocaleString()]];for(const [k,v] of rows){const p=document.createElement('div');p.innerHTML='<strong>'+k+'</strong><br>';p.append(document.createTextNode(v??'—'));g.append(p)}e.append(g);const r=document.createElement('div');r.className='review';for(const [label,next,cls] of [['Approve test hold','approved_test_hold','button'],['Reject','rejected','button danger']]){const b=document.createElement('button');b.className=cls;b.textContent=label;b.disabled=o.reviewStatus==='rejected'&&next==='approved_test_hold';b.onclick=async()=>{const current=generation;b.disabled=true;try{await api('POST',{id:o.id,reviewStatus:next});if(current===generation)await load()}catch(err){if(current===generation){status(err.message);b.disabled=false}}};r.append(b)}e.append(r);return e}
const login=$('orderLogin'),field=$('orderToken'),signIn=$('load'),slot=$('orderLoginSlot'),controls=$('orderControls'),refresh=$('refresh');
function setUnlocked(value){
 if(value&&login.isConnected){
  login.remove();
  field.value='';
  history.replaceState(history.state,'');
  controls.hidden=false;
  refresh.focus();
 }else if(!value){
  controls.hidden=true;
  field.value='';
  if(!login.isConnected)slot.append(login);
  field.focus();
 }
}
async function load(){const current=++generation;clear();signIn.disabled=true;refresh.disabled=true;status('Loading verified sandbox orders…');try{const d=await api();if(current!==generation)return;setUnlocked(true);const list=d.orders||[];status(list.length?list.length+' verified sandbox order'+(list.length===1?'':'s')+'. No supplier fulfillment is active.':'No verified sandbox print orders yet.');if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='A verified Stripe test payment will appear here after the webhook confirms it.';$('orders').append(p);return}list.forEach(o=>$('orders').append(card(o)))}catch(e){if(current!==generation)return;if(e.status===401||login.isConnected){token='';setUnlocked(false)}status(e.message)}finally{if(current===generation){signIn.disabled=false;refresh.disabled=false}}}
login.addEventListener('submit',event=>{
 event.preventDefault();
 token=field.value.trim();
 if(token)load();else status('Enter your gallery admin token.');
});
refresh.addEventListener('click',()=>{if(token)load()});
$('lock').onclick=()=>{
 generation++;token='';clear();setUnlocked(false);
 signIn.disabled=false;refresh.disabled=false;
 status('Screen locked. Admin token cleared from this page.');
};
signIn.disabled=false;
})();
