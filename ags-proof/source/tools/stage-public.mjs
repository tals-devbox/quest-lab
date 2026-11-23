import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const proof=path.resolve(import.meta.dirname,'..'),lab=path.resolve(proof,'..'),out=path.join(lab,'dist/ags-proof');
const names=['index.html','player.html','shell.js','player.js','sw.js','ags.js','ags.wasm','questlab-proof.ags','acsetup.cfg'];
const receipt=[];for(const n of names){const b=await fs.readFile(path.join(proof,'web',n));await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,n),b);receipt.push({file:n,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
await fs.cp(path.join(proof,'web/licenses'),path.join(out,'licenses'),{recursive:true});
await fs.copyFile(path.join(proof,'README.md'),path.join(out,'README.md'));
await fs.copyFile(path.join(proof,'web/report.html'),path.join(out,'report.html'));
await fs.mkdir(path.join(out,'source'),{recursive:true});for(const n of ['Author.cs','proof.asc','build.ps1','package-web.mjs','revision-check.ps1'])await fs.copyFile(path.join(proof,'tools',n),path.join(out,'source',n));
await fs.cp(path.join(proof,'tools'),path.join(out,'source/tools'),{recursive:true});await fs.copyFile(path.join(proof,'start-proof.ps1'),path.join(out,'source/start-proof.ps1'));
await fs.cp(path.join(proof,'game'),path.join(out,'source/game'),{recursive:true,filter:p=>!/(?:^|[\\/])(?:Compiled|AudioCache|Speech|_OpenInEditor\.lock|backup_[^\\/]*)(?:[\\/]|$)|\.bak$|\.user(?:\.|$)/i.test(p)});
await fs.writeFile(path.join(out,'offline-check.html'),'<!doctype html><meta name="viewport" content="width=device-width"><title>AGS offline launch check</title><p>Test starting point. <a href="./">Open the AGS proof</a></p>');
await fs.writeFile(path.join(proof,'evidence/public-stage.json'),JSON.stringify({at:new Date().toISOString(),scope:'Only original proof content, compiled test game, official runtime and licenses. No Quest Lab original game data or saves.',files:receipt},null,2));console.log('Staged '+receipt.length+' runtime files, source and licenses.');
