import { mkdir, readdir, copyFile, cp, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const name of await readdir('.'))if(/\.(html|css|js)$/.test(name))await copyFile(name,'dist/'+name);
await cp('assets','dist/assets',{recursive:true});
console.log('Built gallery static assets; server source and tests excluded.');
