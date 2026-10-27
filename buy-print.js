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
 $('backToArt').href='virtual-gallery.html?artwork='+encodeURIComponent(id);
})();
