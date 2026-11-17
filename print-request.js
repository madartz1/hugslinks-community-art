(() => {
 const form=document.getElementById('printRequest'),status=document.getElementById('result'),button=document.getElementById('sendRequest');
 const id=new URLSearchParams(location.search).get('edition');
 if([...form.elements.editionId.options].some(o=>o.value===id))form.elements.editionId.value=id;
 form.addEventListener('submit',async event=>{
  event.preventDefault();button.disabled=true;status.textContent='Saving your request…';
  try{
   const response=await fetch('/.netlify/functions/art-print-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'The request couldn’t be saved.');
   form.hidden=true;status.textContent='Request received. No payment was taken. Your reference is '+data.id+'.';
  }catch(error){status.textContent=error.message;button.disabled=false}
 });
})();
