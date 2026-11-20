const V='mibff-v7';
const SHELL=['./','index.html','css/app.css','js/app.js','js/rig.js','js/ai.js','js/voice.js','js/vits/vits-web.js','js/vits/piper-DeOu3H9E.js','manifest.webmanifest',
'img2/cuarto.webp','img/silueta.png','img/avatar.webp','img/icon-192.png','img2/poses-base.json','img2/stand-base.webp','img2/stand-base-m.png','img2/phone-base.webp','img2/phone-base-m.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url); if(e.request.method!=='GET') return;
  const same=u.origin===location.origin, lib=/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.host);
  if(!same&&!lib) return;
  if(same && (u.pathname.endsWith('/')||u.pathname.endsWith('.html')||u.pathname.endsWith('.js')||u.pathname.endsWith('.css'))){
    e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(V).then(x=>x.put(e.request,c)); return r; }).catch(()=>caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request).then(m=>m||fetch(e.request).then(r=>{ if(r.ok){ const c=r.clone(); caches.open(V).then(x=>x.put(e.request,c)); } return r; })));
});
