(() => {
 const $=id=>document.getElementById(id),login=$('queueLogin'),queue=$('queue'),field=$('queueToken'),status=$('queueStatus');
 let token='',generation=0;
 const editions={
 'city-holds-breath-20x16-framed':['The City Holds Its Breath · 20 × 16″ framed','city-holds-breath-checkout-admin.html'],
 'horizon-10x8-matte-framed':['Golden Horizon · 10 × 8″ framed','golden-horizon-checkout-admin.html']
 };
 const labels={requested:'Requested',quoted:'Quoted',paid:'Paid · manual hold',paid_needs_review:'Paid · needs review',sent_to_finerworks:'Sent to FinerWorks',paid_awaiting_fulfillment:'Paid · manual hold'};
 const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
 function node(tag,value){const el=document.createElement(tag);el.textContent=value;return el}
 async function api(body){
  const r=await fetch('/.netlify/functions/admin-art-print-requests',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Request failed.'),{status:r.status});return d;
 }
 function lock(message){
  generation++;token='';field.value='';queue.hidden=true;login.hidden=false;status.textContent=message;
  $('printRequests').replaceChildren();$('printOrders').replaceChildren();
 }
 function card(row,production){
  const panel=node('article',''),edition=editions[row.editionId];
  panel.className='purchase-note';panel.append(node('h3',edition?.[0]||row.editionId),node('p',labels[row.status]||row.status),node('p',row.email+' · ZIP '+row.zip),node('p','Request '+row.id));
  if(row.supplierOrderRef)panel.append(node('p','FinerWorks order '+row.supplierOrderRef));
  if(production&&edition&&['requested','quoted'].includes(row.status)){
   const a=node('a',row.status==='quoted'?'Open quote and checkout':'Verify quote and create checkout');
   a.href=edition[1]+'?'+new URLSearchParams({request:row.id,zip:row.zip});panel.append(a);
  }
  if(production&&row.status==='paid'&&row.orderId){
   const form=node('form',''),label=node('label','FinerWorks order reference '),input=node('input',''),button=node('button','Mark sent to FinerWorks');
   input.required=true;input.maxLength=80;label.append(input);form.append(label,button);
   form.addEventListener('submit',async e=>{
    e.preventDefault();const current=generation;button.disabled=true;
    try{await api({action:'mark_sent',requestId:row.id,orderId:row.orderId,supplierOrderRef:input.value.trim()});if(current===generation)await load()}
    catch(error){if(current===generation){status.textContent=error.message;button.disabled=false}}
   });panel.append(form);
  }
  return panel;
 }
 async function load(){
  const current=++generation;status.textContent='Loading print requests…';
  try{
   const d=await api();if(current!==generation)return;queue.hidden=false;login.hidden=true;field.value='';
   status.textContent=d.production?'Live print queue. FinerWorks orders are placed manually.':'Preview requests only. Live payments and fulfillment are unavailable here.';
   $('printRequests').replaceChildren(...(d.requests.length?d.requests.map(row=>card(row,d.production)):[node('p','No print requests yet.')]));
   $('printOrders').replaceChildren(...(d.orders.length?d.orders.map(o=>node('p',(editions[o.editionId]?.[0]||o.editionId)+' · '+money.format(o.totalCents/100)+' · '+(labels[o.status]||o.status)+' · '+o.id)):[node('p','No verified payments shown.')]));
  }catch(error){if(current!==generation)return;if(error.status===401)lock(error.message);else status.textContent=error.message}
 }
 login.addEventListener('submit',e=>{e.preventDefault();token=field.value.trim();if(token)load()});
 $('queueRefresh').onclick=()=>{if(token)load()};
 $('queueLock').onclick=()=>lock('Queue locked.');
})();
