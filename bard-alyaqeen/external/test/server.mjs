// خادم اختبار محلي يعرض الدوال نفسها (بلا Netlify) بذاكرة بدل Blobs. للاختبار فقط.
import http from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
process.env.STORE_MODE='memory'; process.env.INVITE_CODE=process.env.INVITE_CODE||'Invite-Test-2026'; process.env.ADMIN_KEY=process.env.ADMIN_KEY||'admin-key-for-tests-0123456789';
const here=path.dirname(fileURLToPath(import.meta.url)), fdir=path.join(here,'../netlify/functions');
const routes=[]; for(const f of ['gate','api','admin']){ const m=await import(pathToFileURL(path.join(fdir,f+'.mjs'))); for(const p of [].concat(m.config.path)) routes.push([p,m.default]); }
const NO={ 'X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet' };
export const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://'+req.headers.host); const r=routes.find(([p])=>p===url.pathname);
  if(!r){ if(url.pathname==='/robots.txt'){res.writeHead(200,{'content-type':'text/plain',...NO});return res.end(readFileSync(path.join(here,'../public/robots.txt')));} res.writeHead(404,NO); return res.end('not found'); }
  const chunks=[]; for await(const c of req) chunks.push(c); const body=chunks.length?Buffer.concat(chunks):undefined;
  const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body});
  const resp=await r[1](request); const h={}; resp.headers.forEach((v,k)=>h[k]=v); const sc=resp.headers.getSetCookie?.(); if(sc&&sc.length) h['set-cookie']=sc;
  res.writeHead(resp.status,h); res.end(Buffer.from(await resp.arrayBuffer()));
});
if(process.argv[1]===fileURLToPath(import.meta.url)){ server.listen(+process.env.PORT||8899,()=>console.log('listening')); }
