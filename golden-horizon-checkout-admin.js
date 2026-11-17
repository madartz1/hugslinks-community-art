(() => {
 const form=document.getElementById('privateCheckout'), button=document.getElementById('makeCheckout');
 const link=document.getElementById('privateLink'), status=document.getElementById('checkoutStatus');
 let key,lastInput;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const v=new FormData(form),input={
   shippingCents:Math.round(Number(v.get('shipping'))*100), shippingService:v.get('shippingService'),
   supplierQuoteRef:v.get('supplierQuoteRef'),address:{line1:v.get('line1'),line2:v.get('line2'),city:v.get('city'),postal_code:v.get('postal_code'),state:'NY',country:'US'}
  };
  if(form.elements.supplierCost)input.supplierCostCents=Math.round(Number(v.get('supplierCost'))*100);
  const fingerprint=JSON.stringify(input);
  if(lastInput!==fingerprint){
   key=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
   lastInput=fingerprint;
  }
  button.disabled=true;link.hidden=true;status.textContent='Preparing Stripe checkout…';
  try {
   const r=await fetch(form.dataset.endpoint||'/.netlify/functions/art-print-golden-horizon-live',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+document.getElementById('adminToken').value.trim()},
    body:JSON.stringify({quoteId:key,...input})
   });
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Checkout is unavailable.');
   if(new URL(data.url).origin!=='https://checkout.stripe.com')throw Error('Checkout is unavailable.');
   link.href=data.url;link.hidden=false;document.getElementById('adminToken').value='';
   status.textContent='Private link ready. The buyer must use the quoted address. No supplier order has been placed.';
  }catch(e){status.textContent=e.message||'Checkout is unavailable.'}
  finally{button.disabled=false;}
 });
})();
