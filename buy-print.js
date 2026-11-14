(()=>{
 const works={
  'archive-eye':{title:'Swan — The Eye',artist:'Swan the Artist',image:'assets/swan-eye.jpg',description:'A luminous swan emerges from the darkness, its graceful form traced in gold. Part of Swan the Artist’s Black Gold Series, this piece invites you to pause with the quiet power of transformation.'},
  'archive-horizon':{title:'Golden Horizon',artist:'HL Art Gallery founding collection',image:'assets/golden-horizon.jpg',description:'A city skyline glows through layers of gold and shadow, capturing the energy and possibility of a new horizon.'}
 };
 const params=new URLSearchParams(location.search);
 const id=params.get('artwork');
 const work=Object.hasOwn(works,id)?works[id]:null;
 if(!work){document.querySelector('.purchase-grid').innerHTML='<div class="purchase-error"><h1>Artwork not found</h1><p>Please select a work from the virtual gallery.</p><a href="virtual-gallery.html">Explore the gallery →</a></div>';return}
 document.title=work.title+' | HL Art Gallery';
 const $=id=>document.getElementById(id);
 const api=async(action,data)=>{const res=await fetch('/.netlify/functions/art-print-payments?action='+action,data?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{});const value=await res.json();if(!res.ok)throw Error(value.error||'The test service is unavailable.');return value};
 const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
 const money=c=>currency.format(c/100);
 const galleryLink='virtual-gallery.html?artwork='+encodeURIComponent(id);
 if(params.has('session_id')){showReceipt(params.get('session_id'));return}

 $('printTitle').textContent=work.title;$('printArtist').textContent=work.artist;$('printDescription').textContent=work.description;
 $('artImage').src=work.image;$('artImage').alt=work.title+' by '+work.artist;
 if(id==='archive-eye')$('pilotEdition').hidden=false;
 $('backToArt').href=galleryLink;
 startCheckout();

 function showReceipt(session){
  $('receiptNewTest').href='buy-print.html?artwork='+encodeURIComponent(id);
  const receipt=$('printReceipt'),heading=$('receiptHeading'),status=$('receiptStatus'),retry=$('receiptRetry');
  document.querySelector('.purchase-grid').hidden=true;
  $('backToArt').hidden=true;
  receipt.hidden=false;
  $('receiptImage').src=work.image;
  $('receiptArtwork').textContent=work.title;
  $('receiptArtist').textContent=work.artist;
  $('receiptGallery').href=galleryLink;
  document.title='Print order | HL Art Gallery';
  if(!/^cs_test_[a-zA-Z0-9]+$/.test(session)){
   heading.textContent='Test receipt unavailable';
   status.textContent='This test checkout link is invalid.';
   return;
  }
  let attempts=0;
  const check=async()=>{
   attempts++;
   try{
    const result=await api('status&session_id='+encodeURIComponent(session)+'&artwork='+encodeURIComponent(id));
    if(result.testOnly!==true)throw Error('Unexpected receipt mode');
    if(result.paid===true&&result.webhookVerified===true){
     $('receiptSize').textContent=result.size||(id==='archive-eye'?'36 × 43 inches':'—'); // Older Swan test receipts predate size metadata.
     $('receiptTotal').textContent=money(result.totalCents);
     $('receiptSummary').hidden=false;
     const breakdown=$('receiptBreakdown');
     breakdown.textContent=money(result.priceCents)+' print + '+money(result.shippingCents)+' shipping';
     breakdown.hidden=false;
     heading.textContent='Order confirmed';
     document.title='Order confirmed | HL Art Gallery';
     status.textContent='Test payment verified. No money was charged and no physical print order was placed.';
     $('receiptNewTest').hidden=false;
     return;
    }
    status.textContent=result.paid?'Test payment received. Waiting for Stripe confirmation.':'Waiting for Stripe to confirm your test payment.';
    if(attempts<12){setTimeout(check,2500);return}
    heading.textContent='Confirmation pending';
    status.textContent='The gallery has not verified this test payment yet. Check again for an update.';
   }catch{
    heading.textContent='Test receipt unavailable';
    status.textContent='The gallery could not check this test payment. Try checking again.';
   }
   retry.hidden=false;
  };
  retry.addEventListener('click',()=>{
   attempts=0;retry.hidden=true;
   heading.textContent='Checking your order';
   status.textContent='Waiting for Stripe to confirm your test payment.';
   check();
  });
  check();
 }
 async function startCheckout(){
  const note=$('purchaseNote');
  let config;try{config=await api('config')}catch{return}
  const editions=config.editions?.filter(e=>e.artworkId===id)||[];
  if(!config.testOnly||!editions.length)return;
  $('pilotEdition').hidden=false;
  note.innerHTML='<h2>Try the print checkout</h2><p><strong>Sandbox only — no charge and no physical print.</strong> Use a sample delivery address. Tax is not calculated in this test.</p><form id="shippingForm"><div class="print-edition-field"><label for="editionSelect">Print size, paper or canvas, and finish</label><select id="editionSelect" name="edition_id" required></select><p id="editionHint" role="status"></p></div><div class="address-fields"><label>First name<input name="first_name" autocomplete="given-name" maxlength="50" required></label><label>Last name<input name="last_name" autocomplete="family-name" maxlength="50" required></label><label class="wide">Street address<input name="address_1" autocomplete="address-line1" maxlength="100" required></label><label class="wide">Apartment / suite (optional)<input name="address_2" autocomplete="address-line2" maxlength="100"></label><label>City<input name="city" autocomplete="address-level2" maxlength="60" required></label><label>State<select name="state_code" autocomplete="address-level1" required></select></label><label>ZIP code<input name="zip_postal_code" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" required></label><label>Phone<input name="phone" autocomplete="tel" type="tel" maxlength="25" required></label></div><p>Delivery: contiguous United States.</p><div class="test-checkout-actions"><button type="button" id="sampleAddress">Use sample delivery address</button><button id="quoteButton">Calculate test shipping</button></div></form><div id="shippingOptions"></div><p id="orderStatus" role="status" aria-live="polite"></p>';
  const state=note.querySelector('select[name="state_code"]');state.append(new Option('Select state',''));for(const code of 'AL AZ AR CA CO CT DC DE FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '))state.append(new Option(code,code));
  const form=$('shippingForm'),options=$('shippingOptions'),status=$('orderStatus');
  const select=$('editionSelect'),quoteButton=$('quoteButton');
  select.append(...editions.map(e=>new Option(`${e.size} · ${e.material} · ${e.finish} · ${money(e.priceCents)}`,e.id)));
  const selectedEdition=()=>editions.find(e=>e.id===select.value);
  function updateEdition(){const e=selectedEdition();if(!e)return;$('printFormat').textContent=e.material+', '+e.finish;$('printSize').textContent=e.size;$('printFit').textContent=e.finish.toLowerCase()==='unmounted'?'Stretching and framing are not included.':'See the selected finish above.';$('printPrice').textContent=money(e.priceCents)+' · Shipping additional in this test';$('editionHint').textContent=e.quoteAvailable?'':'Shipping for this size is not configured yet.';quoteButton.disabled=!e.quoteAvailable;}
  select.addEventListener('change',updateEdition);updateEdition();
  const sample={first_name:'Gallery',last_name:'Test',address_1:'350 Fifth Avenue',city:'New York',state_code:'NY',zip_postal_code:'10118',phone:'2125550140'};
  $('sampleAddress').onclick=()=>{for(const [name,value] of Object.entries(sample))form.elements.namedItem(name).value=value;form.elements.namedItem('address_2').value='';generation++;options.replaceChildren();status.textContent='Sample address filled in. Calculate test shipping to continue.'};
  let generation=0;
  form.addEventListener('input',()=>{generation++;options.replaceChildren();status.textContent=''});
  form.addEventListener('submit',async event=>{
   event.preventDefault();const edition=selectedEdition();if(!edition?.quoteAvailable)return;const current=++generation;options.replaceChildren();$('quoteButton').disabled=true;status.textContent='Calculating shipping…';
   try{const data=await api('quote',{artworkId:id,editionId:edition.id,recipient:Object.fromEntries(new FormData(form))});if(current!==generation)return;
    status.textContent='Quote valid for 15 minutes. Artwork: '+money(data.priceCents)+'.'+(config.enabled?'':' Test payment confirmation is being configured.');
    for(const option of data.options){const box=document.createElement('div');box.className='shipping-option';const p=document.createElement('p');p.textContent=option.method+' · '+money(option.shippingCents)+' shipping · '+money(option.totalCents)+' test total';const t=document.createElement('p');t.textContent=option.transitTime+' transit estimate; production time is additional.';const button=document.createElement('button');button.type='button';button.textContent=config.enabled?'Continue to test payment':'Test payment unavailable';button.disabled=!config.enabled;button.addEventListener('click',async()=>{button.disabled=true;status.textContent='Opening secure sandbox checkout…';try{const s=await api('checkout',{quote:option.quote});location.assign(s.url)}catch(e){status.textContent=e.message;button.disabled=false}});box.append(p,t,button);options.append(box)}
   }catch(e){status.textContent=e.message}finally{updateEdition()}
  });
  if(params.has('cancelled'))status.textContent='Test checkout cancelled. No print order was placed.';
 }
})();
