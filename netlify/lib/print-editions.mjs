import { createHash } from 'node:crypto';

export const RETIRED_SWAN_TEST_SKU = 'AP108137P696597';
const PRIOR_SWAN_SANDBOX_SKU = 'AP108137P696937';
export const SWAN_EDITION = Object.freeze({id:'swan-36x43',artworkId:'archive-eye',width:36,height:43,material:'Artisan archival canvas',finish:'Unmounted',sku:'AP108137P700678',priceCents:44449});
export const PRINT_ARTWORKS = Object.freeze({'archive-eye':'Swan — The Eye','archive-horizon':'Golden Horizon'});
const BASE_EDITIONS = [SWAN_EDITION, Object.freeze({id:'swan-18x22-black-floater',artworkId:'archive-eye',width:18,height:22,material:'Artisan archival canvas',finish:'Stretched with black floater frame',sku:'AP108137P700682',priceCents:49900}), Object.freeze({id:'horizon-5x4-matte',artworkId:'archive-horizon',width:5,height:4,material:'Archival matte paper',finish:'Unframed, borderless',sku:'AP108137P700685',priceCents:2900})];
export const sizeLabel = edition => `${edition.width} × ${edition.height} inches`;
const inch = value => typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=120;
const label = value => typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=70&&!/[<>\x00-\x1f]/.test(value);
const sku = value => typeof value==='string'&&/^[A-Za-z0-9_-]{6,64}$/.test(value);

export function readTestEditions(raw) {
 if(!raw)return [...BASE_EDITIONS];
 const rows=JSON.parse(raw);
 if(!Array.isArray(rows)||rows.length>20)throw Error('Invalid test print catalog');
 const editions=[...BASE_EDITIONS],ids=new Set(editions.map(e=>e.id)),skus=new Set([...editions.map(e=>e.sku),PRIOR_SWAN_SANDBOX_SKU,RETIRED_SWAN_TEST_SKU]);
 for(const row of rows){
  if(!row||typeof row.id!=='string'||!/^[a-z0-9][a-z0-9-]{1,47}$/.test(row.id)||!Object.hasOwn(PRINT_ARTWORKS,row.artworkId)||!inch(row.width)||!inch(row.height)||!label(row.material)||!label(row.finish)||!sku(row.sku)||!Number.isSafeInteger(row.priceCents)||row.priceCents<50||row.priceCents>10000000||ids.has(row.id)||skus.has(row.sku))throw Error('Invalid or duplicate test print edition');
  const {id,artworkId,width,height,material,finish,sku:productSku,priceCents}=row;
  editions.push({id,artworkId,width,height,material,finish,sku:productSku,priceCents});ids.add(id);skus.add(productSku);
 }
 return editions;
}

export function editionRevision(e){
 return createHash('sha256').update(JSON.stringify([e.id,e.artworkId,e.width,e.height,e.material,e.finish,e.sku,e.priceCents])).digest('base64url');
}

export function editionSummary(e,quoteAvailable){
 return {id:e.id,artworkId:e.artworkId,width:e.width,height:e.height,size:sizeLabel(e),material:e.material,finish:e.finish,priceCents:e.priceCents,quoteAvailable};
}
