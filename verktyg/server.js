/* Enkel lokal server utan cache. node server.js <mapp>  →  http://localhost:8765/ */
const http=require('http'),fs=require('fs'),path=require('path');
const ROT=process.argv[2];const T={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain'};
http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROT,p);
fs.readFile(f,(e,d)=>{if(e){s.writeHead(404,{'Content-Type':'text/html'});return fs.createReadStream(path.join(ROT,'404.html')).pipe(s)}s.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});s.end(d)})}).listen(8765,()=>console.log('http://localhost:8765/'));
