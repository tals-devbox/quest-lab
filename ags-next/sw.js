'use strict';
const PREFIX='questlab-native-runtime-',BUILD='6b0b22b631495ff644d2',CACHE=PREFIX+BUILD,FILES=["./","index.html","style.css","player.html","storage.js","shell.js","player.js","quest-bridge.js","session-trace.js","quest-viewer/index.html","quest-viewer/viewer.css","quest-viewer/viewer.js","ags.js","ags.wasm","licenses/AGS-Copyright.txt","licenses/AGS-License.txt","licenses/AllegroFont.txt","licenses/FTL.txt","licenses/glm.txt","licenses/GNU GPL v2.1.txt","licenses/irrKlang.txt","licenses/Magick.NET.txt","licenses/mojoAL.txt","licenses/Newtonsoft JSON.NET.txt","licenses/Scintilla.txt","licenses/SDL_sound.txt","licenses/SDL.txt","licenses/Weifen Luo DockPanel Suite.txt","licenses/Xiph.txt","delivery.js","downloads.json","sw.js","runtime-manifest.json"];
const allowed=new Set(FILES.map(p=>new URL(p,self.registration.scope).pathname));
const expected=new Set(FILES.filter(f=>f!=='./'&&f!=='runtime-manifest.json'));
async function fresh(name){const u=new URL(name,self.registration.scope);u.searchParams.set('runtimeBuild',BUILD);const r=await fetch(u.href,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Runtime download failed: '+name);return r;}
async function hash(b){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');}
async function installRuntime(){
 const manifestResponse=await fresh('runtime-manifest.json'),m=await manifestResponse.clone().json();
 if(m.build!==BUILD||m.privateGameFiles!==0||!Array.isArray(m.files)||m.files.length!==expected.size)throw Error('Runtime manifest does not match worker');
 const names=new Set();for(const f of m.files){if(!expected.has(f.name)||names.has(f.name)||!Number.isSafeInteger(f.bytes)||f.bytes<=0||!/^[0-9a-f]{64}$/.test(f.sha256))throw Error('Invalid runtime file');names.add(f.name);}
 // Fetch and validate the entire build before changing its cache. Never mix old CDN/browser bytes.
 const responses=await Promise.all(m.files.map(async f=>{const r=await fresh(f.name),data=await r.clone().arrayBuffer();if(data.byteLength!==f.bytes||await hash(data)!==f.sha256)throw Error('Runtime checksum mismatch: '+f.name);return [f.name,r];}));
 const cache=await caches.open(CACHE);for(const [name,r]of responses){if(name==='index.html')await cache.put('./',r.clone());await cache.put(name,r);}await cache.put('runtime-manifest.json',manifestResponse);
}
self.addEventListener('install',e=>e.waitUntil(installRuntime()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||!allowed.has(url.pathname))return;e.respondWith((async()=>{const cached=await(await caches.open(CACHE)).match(url.pathname,{ignoreSearch:true});return cached||fetch(e.request);})());});
self.addEventListener('message',e=>{if(e.data?.type==='status')e.waitUntil((async()=>{const c=await caches.open(CACHE),manifest=await c.match('runtime-manifest.json');let valid=false;try{valid=!!manifest&&(await manifest.json()).build===BUILD;}catch{}const ready=valid&&(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean);e.source?.postMessage({type:'runtime-cache',ready,build:BUILD});})());});
self.addEventListener('message',e=>{if(e.data?.type==='activate')e.waitUntil(self.skipWaiting());});
