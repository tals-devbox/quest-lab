'use strict';const CACHE='questlab-ags-proof-__BUILD__';const FILES=['./','index.html','player.html','shell.js','player.js','ags.js','ags.wasm','questlab-proof.ags','acsetup.cfg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request,{ignoreSearch:true}))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data?.type==='status')e.waitUntil(caches.open(CACHE).then(async c=>{const ok=(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean);e.source?.postMessage({type:ok?'cached':'incomplete'});}));});
