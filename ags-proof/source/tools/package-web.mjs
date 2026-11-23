import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'web');await fs.mkdir(out,{recursive:true});
for(const n of ['ags.js','ags.wasm','questlab-proof.ags','acsetup.cfg'])await fs.copyFile(path.join(root,'game/Compiled/Web',n),path.join(out,n));
await fs.writeFile(path.join(out,'acsetup.cfg'),(await fs.readFile(path.join(out,'acsetup.cfg'),'utf8')).replace('game_scale_win=round','game_scale_win=proportional'));
for(const n of ['index.html','player.html','shell.js','player.js','sw.js'])await fs.copyFile(path.join(root,'tools/web',n),path.join(out,n));
const build=crypto.createHash('sha256');for(const n of ['questlab-proof.ags','ags.js','ags.wasm','acsetup.cfg','shell.js','player.js','index.html','player.html'])build.update(await fs.readFile(path.join(out,n)));const id=build.digest('hex').slice(0,16);await fs.writeFile(path.join(out,'sw.js'),(await fs.readFile(path.join(out,'sw.js'),'utf8')).replace('__BUILD__',id));
const manifest=[];for(const n of ['index.html','player.html','shell.js','player.js','sw.js','ags.js','ags.wasm','questlab-proof.ags','acsetup.cfg']){const b=await fs.readFile(path.join(out,n));manifest.push({file:n,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
await fs.writeFile(path.join(root,'evidence/web-manifest.json'),JSON.stringify({engine:'AGS 3.6.3.17',version:'0.1.1',files:manifest},null,2));console.log('Packaged '+manifest.reduce((s,f)=>s+f.bytes,0)+' bytes');
