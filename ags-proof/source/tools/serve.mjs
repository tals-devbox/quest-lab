import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../web');
const mime={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.cfg':'text/plain'};
http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!p.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(await fs.readFile(p));}catch{res.statusCode=404;res.end('Not found');}}).listen(4330,'127.0.0.1',()=>console.log('AGS proof http://127.0.0.1:4330/'));
