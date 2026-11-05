(()=>{
 const path=location.pathname.split('/').pop().replace(/\.html$/,'')||'art-social';
 if(location.pathname==='/'&&['#collections','#artists','#join','#new-artists','#creative-challenge'].includes(location.hash)){location.replace('art-community.html'+location.hash);return}
 const items=[['art-social.html','Feed','art-social'],['art-voting.html#gallery','Gallery','art-voting'],['competition.html','Competition','competition'],['art-collections.html','Collections','art-collections']];
 const exhibition=['virtual-gallery','swan-collection','art-room-gallery','view-in-room','room-planner','buy-print'];
 const bar=document.createElement('nav');bar.className='site-bottom-nav';bar.setAttribute('aria-label','Quick navigation');
 for(const [href,label,id] of items){const a=document.createElement('a');a.href=href;a.textContent=label;if(path===id||(id==='art-collections'&&exhibition.includes(path)))a.setAttribute('aria-current','page');bar.append(a)}document.body.append(bar);
 const tools=document.querySelector('.site-tools');if(!tools)return;
 document.addEventListener('click',e=>{if(!tools.contains(e.target))tools.open=false});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tools.open){tools.open=false;tools.querySelector('summary').focus()}});
})();
