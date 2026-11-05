(()=>{
 const $=id=>document.getElementById(id),notice=t=>{$('notice').textContent=t};
 let submissions=[],selected='',configured=false,until=0,clock;
 async function api(action='',method='GET',body){
  let response;try{response=await fetch('/.netlify/functions/artist-account'+(action?'?action='+encodeURIComponent(action):''),{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined})}catch{throw Error('Connection interrupted. Please try again when you are online.')}
  let data;try{data=await response.json()}catch{throw Error('The artist studio is temporarily unavailable. Please try again.')}
  if(!response.ok||!data.ok){const error=Error(data.error||'Unable to connect to your studio.');error.status=response.status;throw error}return data;
 }
 function updateRequest(){const left=Math.max(0,Math.ceil((until-Date.now())/1000));$('requestLink').disabled=!configured||left>0;$('requestLink').textContent=!configured?'Sign-in temporarily unavailable':left?'Resend available in '+left+'s':'Email my sign-in link';if(!left&&clock){clearInterval(clock);clock=null}}
 function clear(){submissions=[];selected='';$('privateArtwork').removeAttribute('src');$('privateArtwork').hidden=true;$('submissionSelect').replaceChildren();$('bio').value='';$('dashboard').hidden=true;$('loginPanel').hidden=false;for(const id of ['welcome','artTitle','reviewStatus','visibility','created','reviewed','reference','editStatus','studioSummary','statusExplanation'])$(id).textContent='';$('publicProfile').hidden=true;$('publicProfile').removeAttribute('href')}
 const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Not yet';
 function count(){$('bioCount').textContent=$('bio').value.length+' / 800 characters'}
 function select(id){
  const a=submissions.find(x=>x.id===id);if(!a)return;selected=a.id;$('submissionSelect').value=a.id;$('welcome').textContent='Welcome, '+(a.artist_name||'Artist');$('artTitle').textContent=a.artwork_title||'Untitled artwork';$('reviewStatus').textContent=a.status||'Pending Review';$('visibility').textContent=a.published?'Published in the gallery':'Not currently published';$('created').textContent=date(a.created_at);$('reviewed').textContent=date(a.reviewed_at);$('reference').textContent=a.id;$('editStatus').textContent=a.profile_review_status||'No edits pending';$('bio').value=a.proposed_bio||a.profile_bio||'';count();
  const explanations={'Approved':a.published?'This artwork is approved and visible in the public gallery.':'This submission is approved. Publication is a separate admin action.','On Hold':'This submission is on hold for gallery review. Contact the gallery if you need help.','Declined':'This submission has not been accepted for the gallery. You can submit another artwork.','Flagged Review':'This submission needs additional review. It is not automatically published.'};
  $('statusExplanation').textContent=explanations[a.status]||'Your artwork is in the private review queue. Gallery admin must approve and publish it before visitors can see it.';
  $('publicProfile').hidden=!a.published;if(a.published)$('publicProfile').href='artist-profile.html?artist='+encodeURIComponent(String(a.artist_name||'').trim().toLowerCase());else $('publicProfile').removeAttribute('href');
  const img=$('privateArtwork');img.hidden=true;img.removeAttribute('src');if(a.has_image){img.alt='Your submitted artwork: '+(a.artwork_title||'Untitled');img.src='/.netlify/functions/artist-account?action=image&submission='+encodeURIComponent(a.id)}
 }
 $('privateArtwork').onload=()=>{$('privateArtwork').hidden=false};$('privateArtwork').onerror=()=>{$('privateArtwork').hidden=true};
 async function load(){const data=await api();submissions=Array.isArray(data.submissions)?data.submissions:[data.artist];$('loginPanel').hidden=true;$('dashboard').hidden=false;$('submissionSelect').replaceChildren(...submissions.map(a=>{const option=document.createElement('option');option.value=a.id;option.textContent=(a.artwork_title||'Untitled artwork')+' · '+(a.status||'Pending Review');return option}));$('studioSummary').textContent=submissions.length+' submission'+(submissions.length===1?'':'s')+' · '+submissions.filter(a=>a.published).length+' currently published';select(submissions.some(a=>a.id===selected)?selected:submissions[0]?.id)}
 $('submissionSelect').onchange=()=>select($('submissionSelect').value);$('bio').oninput=count;
 $('loginForm').onsubmit=async e=>{e.preventDefault();$('requestLink').disabled=true;try{const data=await api('request','POST',{email:$('email').value.trim()});notice(data.message);until=Date.now()+(Number(data.retry_after)||60)*1000;clock=setInterval(updateRequest,1000)}catch(error){notice(error.message)}finally{updateRequest()}};
 $('profileForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter||$('profileForm').querySelector('button');button.disabled=true;$('submissionSelect').disabled=true;try{const data=await api('profile','POST',{artist_id:selected,bio:$('bio').value.trim()});await load();notice(data.message)}catch(error){notice(error.message);if(error.status===401)clear()}finally{button.disabled=false;$('submissionSelect').disabled=false}};
 $('logout').onclick=async()=>{$('logout').disabled=true;try{await api('logout','POST',{});clear();notice('Signed out.')}catch(error){notice('Unable to sign out: '+error.message)}finally{$('logout').disabled=false}};
 (async()=>{
  const url=new URL(location.href),token=url.searchParams.get('login');let loginError='';
  if(token){url.searchParams.delete('login');history.replaceState(null,'',url.pathname+url.search+url.hash);notice('Verifying your private sign-in link…');try{await api('verify','POST',{token})}catch(error){loginError=error.message}}
  try{const config=await api('config');configured=config.configured;updateRequest()}catch{updateRequest()}
  try{await load();notice(loginError||'Signed in. Select an artwork to track its review and publication.')}catch(error){clear();notice(loginError||(error.status===401?(configured?'Enter your submission email to sign in securely.':'Sign-in email is temporarily unavailable. Contact the gallery for help.'):error.message))}
 })();
})();
