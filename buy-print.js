(()=>{
 const works={
  'archive-eye':{title:'Swan — The Eye',artist:'Swan the Artist',image:'assets/swan-eye.jpg',description:'A luminous swan emerges from the darkness, its graceful form traced in gold. Part of Swan the Artist’s Black Gold Series, this piece invites you to pause with the quiet power of transformation.'},
  'archive-horizon':{title:'Golden Horizon',artist:'HUGSLinks founding collection',image:'assets/golden-horizon.jpg',description:'A city skyline glows through layers of gold and shadow, capturing the energy and possibility of a new horizon.'}
 };
 const id=new URLSearchParams(location.search).get('artwork');
 const work=Object.hasOwn(works,id)?works[id]:null;
 if(!work){document.querySelector('.purchase-grid').innerHTML='<div class="purchase-error"><h1>Artwork not found</h1><p>Please select a work from the virtual gallery.</p><a href="virtual-gallery.html">Explore the gallery →</a></div>';return}
 document.title=work.title+' | HUGS Art Social';
 const $=id=>document.getElementById(id);
 $('printTitle').textContent=work.title;$('printArtist').textContent=work.artist;$('printDescription').textContent=work.description;
 $('artImage').src=work.image;$('artImage').alt=work.title+' by '+work.artist;
 if(id==='archive-eye')$('pilotEdition').hidden=false;
 $('backToArt').href='virtual-gallery.html?artwork='+encodeURIComponent(id);
 if(id==='archive-eye')startCheckout();
 async function startCheckout(){
  const note=$('purchaseNote');
  const api=async(action,data)=>{const res=await fetch('/.netlify/functions/art-print-payments?action='+action,data?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{});const value=await res.json();if(!res.ok)throw Error(value.error||'The test service is unavailable.');return value};
  let config;try{config=await api('config')}catch{return}
  if(!config.enabled)return;
  note.innerHTML='<h2>Try the print checkout</h2><p><strong>Sandbox only — no charge and no physical print.</strong> Use a sample delivery address. Tax is not calculated in this test.</p><form id="shippingForm"><div class="address-fields"><label>First name<input name="first_name" autocomplete="given-name" maxlength="50" required></label><label>Last name<input name="last_name" autocomplete="family-name" maxlength="50" required></label><label class="wide">Street address<input name="address_1" autocomplete="address-line1" maxlength="100" required></label><label class="wide">Apartment / suite (optional)<input name="address_2" autocomplete="address-line2" maxlength="100"></label><label>City<input name="city" autocomplete="address-level2" maxlength="60" required></label><label>State<select name="state_code" autocomplete="address-level1" required></select></label><label>ZIP code<input name="zip_postal_code" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" required></label><label>Phone<input name="phone" autocomplete="tel" type="tel" maxlength="25" required></label></div><p>Delivery: contiguous United States. Canvas is unmounted.</p><button id="quoteButton">Calculate test shipping</button></form><div id="shippingOptions"></div><p id="orderStatus" role="status" aria-live="polite"></p>';
  const state=note.querySelector('select');state.append(new Option('Select state',''));for(const code of 'AL AZ AR CA CO CT DC DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '))state.append(new Option(code,code));
  const form=$('shippingForm'),options=$('shippingOptions'),status=$('orderStatus');
  const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
  let generation=0;
  form.addEventListener('input',()=>{generation++;options.replaceChildren();status.textContent=''});
  form.addEventListener('submit',async event=>{
   event.preventDefault();const current=++generation;options.replaceChildren();$('quoteButton').disabled=true;status.textContent='Calculating shipping…';
   try{const data=await api('quote',{recipient:Object.fromEntries(new FormData(form))});if(current!==generation)return;
    status.textContent='Quote valid for 15 minutes. Your artwork price is '+money(data.priceCents)+'.';
    for(const option of data.options){const box=document.createElement('div');box.className='shipping-option';const p=document.createElement('p');p.textContent=option.method+' · '+money(option.shippingCents)+' shipping · '+money(option.totalCents)+' test total';const t=document.createElement('p');t.textContent=option.transitTime+' transit estimate; production time is additional.';const button=document.createElement('button');button.type='button';button.textContent='Continue to test payment';button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Opening secure sandbox checkout…';try{const s=await api('checkout',{quote:option.quote});location.assign(s.url)}catch(e){status.textContent=e.message;button.disabled=false}});box.append(p,t,button);options.append(box)}
   }catch(e){status.textContent=e.message}finally{$('quoteButton').disabled=false}
  });
  const session=new URLSearchParams(location.search).get('session_id');
  if(session){status.textContent='Checking your sandbox payment…';let attempt=0;const poll=async()=>{try{const s=await api('status&session_id='+encodeURIComponent(session));status.textContent=s.webhookVerified?'Test payment verified. No physical print order was placed.':s.paid?'Test payment received; waiting for webhook verification.':'Test payment is not completed.';if(s.paid&&!s.webhookVerified&&++attempt<6)setTimeout(poll,2500)}catch(e){status.textContent=e.message}};poll()}
 }
})();
