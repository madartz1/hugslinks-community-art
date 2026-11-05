// Artist-directed collection proposals. They are never automatically published.
const proposals=[
 ['ascension','Ascension','Wings rise from the darkness in a sweep of gold. Ascension explores the moment quiet resolve becomes movement—a study in courage, renewal and the freedom to rise.'],
 ['stillwater','Stillwater','A swan meets its reflection on an obsidian lake. Slender traces of gold bring warmth to the stillness, inviting a slower look at grace, balance and the strength found in pause.'],
 ['together-in-gold','Together in Gold','Two swans turn toward one another, their curved necks opening a space shaped by connection. Gold reflections join them across dark water—a meditation on companionship and shared light.']
].map(([slug,title,description])=>({id:'SWAN-PROPOSAL-'+slug,artwork_id:'swan-'+slug,artwork_title:title,artist_name:'Swan the Artist',primary_medium:'AI-assisted digital artwork',artist_statement:description,artwork_year:'2026',collection:'Black Gold Series',preview_image_url:'/assets/swan-'+slug+'.jpg',rights_confirmed:true,rights_source:'Artist-directed creation and ownership declaration in project instructions',status:'Pending Review',created_at:'2026-11-04T21:00:00.000Z',moderation:{flags:[],auto_approved:false},source:'swan-collection-proposal'}));
export function swanProposal(id){return proposals.find(p=>p.id===id)}
export function mergeSwanProposals(records){const ids=new Set(records.map(r=>r.id));return [...records,...proposals.filter(p=>!ids.has(p.id)).map(p=>structuredClone(p))]}
