import { createHash } from 'node:crypto';

export const SWAN_EDITION = Object.freeze({id:'swan-36x43',artworkId:'archive-eye',width:36,height:43,material:'Artisan archival canvas',finish:'Unmounted',sku:'AP108137P696597',priceCents:44449,supplier:'bridge'});
export const sizeLabel = edition => `${edition.width} × ${edition.height} inches`;
const inch = value => typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=120;
const label = value => typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=70&&!/[<>\x00-\x1f]/.test(value);
const sku = value => typeof value==='string'&&/^[A-Za-z0-9_-]{6,64}$/.test(value);

export function readTestEditions(raw) {
 if(!raw)return [SWAN_EDITION];
 const rows=JSON.parse(raw);
 if(!Array.isArray(rows)||rows.length>20)throw Error('Invalid test print catalog');
 const editions=[SWAN_EDITION],ids=new Set([SWAN_EDITION.id]),skus=new Set([SWAN_EDITION.sku]);
 for(const row of rows){
  if(!row||typeof row.id!=='string'||!/^[a-z0-9][a-z0-9-]{1,47}$/.test(row.id)||row.artworkId!=='archive-eye'||!inch(row.width)||!inch(row.height)||!label(row.material)||!label(row.finish)||!sku(row.sku)||!Number.isSafeInteger(row.priceCents)||row.priceCents<50||row.priceCents>10000000||ids.has(row.id)||skus.has(row.sku))throw Error('Invalid or duplicate test print edition');
  const {id,artworkId,width,height,material,finish,sku:productSku,priceCents}=row;
  editions.push({id,artworkId,width,height,material,finish,sku:productSku,priceCents,supplier:'direct'});ids.add(id);skus.add(productSku);
 }
 return editions;
}

export function editionRevision(e){
 return createHash('sha256').update(JSON.stringify([e.id,e.artworkId,e.width,e.height,e.material,e.finish,e.sku,e.priceCents,e.supplier])).digest('base64url');
}

export function editionSummary(e,quoteAvailable){
 return {id:e.id,artworkId:e.artworkId,width:e.width,height:e.height,size:sizeLabel(e),material:e.material,finish:e.finish,priceCents:e.priceCents,quoteAvailable};
}
