(() => {
 const {works,materials,sandboxEdition}=HLGPrintOptions;
 const $=id=>document.getElementById(id);
 const params=new URLSearchParams(location.search);
 const artwork=$('optionsArtworkChoice'), size=$('optionsSize'), finish=$('optionsFinish');
 const artHas=id=>Object.hasOwn(works,id);
 let active=artHas(params.get('artwork'))?params.get('artwork'):'archive-eye';
 let material;
 function selectValues(select,values){
  const previous=select.value;
  select.replaceChildren(...values.map(value=>new Option(value,value)));
  if(values.includes(previous))select.value=previous;
 }
 for(const [id,work] of Object.entries(works))artwork.append(new Option(work.title,id));
 function chooseArtwork(){
  const work=works[active];
  artwork.value=active;
  material=work.first;
  $('optionsArtwork').src=work.image;
  $('optionsArtwork').alt=work.title;
  $('optionsCaption').textContent=work.title+' · '+work.artist;
  $('optionsGallery').href='virtual-gallery.html?artwork='+encodeURIComponent(active);
  const buttons=Object.keys(work.offers).map(id=>{
   const label=document.createElement('label');
   const radio=document.createElement('input');
   radio.type='radio';radio.name='printMaterial';radio.value=id;radio.checked=id===material;
   const name=document.createElement('strong'), description=document.createElement('span');
   name.textContent=materials[id].label;description.textContent=materials[id].subtitle;
   const content=document.createElement('span');content.className='options-material-card';
   content.append(name,description);label.append(radio,content);
   radio.addEventListener('change',()=>{material=id;chooseMaterial()});
   return label;
  });
  $('optionsMaterials').replaceChildren(...buttons);
  size.value='';finish.value='';
  chooseMaterial();
  if(active==='archive-eye'){
   size.value='18 × 22';finish.value='Black floater frame';
   renderSelection();
  }
 }
 function chooseMaterial(){
  const offer=works[active].offers[material];
  $('optionsMaterialNote').textContent=materials[material].note;
  selectValues(size,offer.sizes);
  selectValues(finish,offer.finishes);
  renderSelection();
 }
 function renderSelection(){
  const work=works[active], offer=work.offers[material];
  const edition=sandboxEdition(active,material,size.value,finish.value);
  const action=$('optionsAction');
  const proof=offer.large?.includes(size.value);
  const selection=size.value+' in · '+materials[material].label+' · '+finish.value;
  const [width,height]=size.value.split(' × ').map(Number);
  const shape=Math.abs((width/height)/work.ratio-1)>0.025;
  $('optionsFit').textContent=work.fit+(shape?' This size may need a border or a crop.':'');
  $('optionsSelection').textContent=selection;
  $('optionsStatus').textContent=edition?'Sandbox checkout':proof?'Proof & quote':'Quote request';
  $('optionsPrice').textContent=edition?edition.price+' before shipping · test price':'Price and shipping provided by quote';
  $('optionsMessage').textContent=edition?'Test payment only. No charge or physical print.':proof?'The gallery needs to check print detail and fit at this size before offering it for sale.':'Ask the gallery to confirm this combination and quote it for you.';
  if(edition){
   action.href='buy-print.html?'+new URLSearchParams({artwork:active,edition:edition.id});
   action.textContent='Continue to test checkout';
  }else{
   const subject='HL Art Gallery print quote: '+work.title;
   const body='Hello HL Art Gallery,\n\nPlease quote this print option:\n'+work.title+'\n'+size.value+' inches (width × height)\n'+materials[material].label+'\n'+finish.value+'\n\nDelivery ZIP code (optional):\n\nThank you.';
   action.href='mailto:info@hugslinks.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
   action.textContent=proof?'Email for a proof & quote':'Email for a quote';
  }
 }
 artwork.addEventListener('change',()=>{
  active=artwork.value;
  const url=new URL(location.href);url.searchParams.set('artwork',active);
  if(url.protocol!=='file:')history.replaceState(null,'',url);
  chooseArtwork();
 });
 size.addEventListener('change',renderSelection);
 finish.addEventListener('change',renderSelection);
 chooseArtwork();
 $('optionsControls').hidden=false;
})();
