// Versión única: la pone app.js al registrar (sw.js?v=VERSION). Cambiar VERSION en app.js = SW nuevo + caché nueva.
const VER=new URL(location.href).searchParams.get('v')||'dev';
const V='mibff-'+VER;
const SHELL=['./','index.html','css/app.css','js/app.js','js/rig.js','js/ai.js','js/voice.js','js/vits/vits-web.js','js/vits/piper-DeOu3H9E.js','manifest.webmanifest',
'img2/cuarto.webp','img/silueta.png','img/avatar.webp','img/icon-192.png','img2/poses-base.json','img2/stand-base.webp','img2/stand-base-m.png','img2/phone-base.webp','img2/phone-base-m.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
const put=(req,res)=>{ if(res&&res.ok&&res.status===200){ const c=res.clone(); caches.open(V).then(x=>x.put(req,c)); } return res; };
self.addEventListener('fetch',e=>{
  const req=e.request, u=new URL(req.url); if(req.method!=='GET'||req.headers.has('range')) return;
  const same=u.origin===location.origin, lib=/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.host);
  if(!same&&!lib) return;
  // código y HTML: red primero (siempre lo último), caché si no hay red
  if(same && (u.pathname.endsWith('/')||/\.(html|js|css|webmanifest)$/.test(u.pathname))){
    e.respondWith(fetch(req).then(r=>put(req,r)).catch(()=>caches.match(req))); return; }
  // librerías externas versionadas en la URL: caché primero
  if(lib){ e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>put(req,r)))); return; }
  // imágenes, poses y clips: stale-while-revalidate (responde rápido de caché y se actualiza en segundo plano)
  e.respondWith(caches.open(V).then(c=>c.match(req).then(m=>{
    const net=fetch(req).then(r=>put(req,r)).catch(()=>m);
    if(m){ e.waitUntil(net); return m; } return net; })));
});
