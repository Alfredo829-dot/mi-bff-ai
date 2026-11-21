import { Renderer, Puppet, loadImage } from './rig.js';
import { LS, BASE_PERSONA, profileText, guard, minorSignal, researchQuery, webSearch, complete, completeVision, updateProfile, localProfile, hasGroq, cleanKey, PROVIDERS, provKey, listModels, provErrText, ADULT_RULES, warmModels, updateTone, toneText, saveMemory, memoryText, pickScenario, detectAction, getLimits, learnLimits, limitsText } from './ai.js';
import * as V from './voice.js';

const VERSION='1.6.0'; // única versión: también nombra la caché del service worker
const $=s=>document.querySelector(s);
const ROOM={w:1248,h:832};
// ---------- catálogo (agregar más outfits aquí; 'ready' = tiene poses con el cuarto nuevo) ----------
const OUTFITS=[
  {id:'base',name:'Diablita morada'},
  {id:'jeans',name:'Casual jeans'},
  {id:'hoodie',name:'Street hoodie'},
];
let READY=['base','jeans','hoodie'];
let outfitN=0; // serie para que dos clics rápidos en cambiar de outfit no se pisen
const HAIR=[['castaño',null,'#6b3a2a'],['negro',[0.07,0.25,0.42],'#1b1414'],['rubio',[0.11,0.95,1.9],'#e2c06a'],['pelirroja',[0.015,1.5,1.08],'#b8361e'],['rosa',[0.93,1.2,1.75],'#f28cc0'],['morado',[0.78,1.1,1.15],'#7a3fb0'],['azul',[0.6,1.1,1.1],'#2f5fb8'],['plateado',[0.65,0.12,2.4],'#c9ccd6'],['verde',[0.42,0.9,1.05],'#2f8f6a']];
const EYES=[['café',null,'#7a4a33'],['azul',[0.58,1.2,1.2],'#3b7ddd'],['verde',[0.33,1.1,1.15],'#3ea65a'],['miel',[0.09,1.2,1.25],'#c98b2b'],['morado',[0.78,1.1,1.15],'#8c4fd1'],['rojo',[0.98,1.4,1.0],'#c3394b']];
const EARS=[['jade',null,'#4f9a6c'],['oro',[0.12,1.3,1.3],'#d4a72c'],['plata',[0.6,0.08,1.7],'#cfd3da'],['rosa',[0.93,1.1,1.35],'#ef7fb6'],['zafiro',[0.6,1.2,1.1],'#3060c8'],['rubí',[0.0,1.3,1.0],'#b8202f']];
// ---------- escena: cuarto fijo (cámara fija) y Vale parada en el centro, sin moverse ----------
// solo hay un lugar: idle (parada, pose stand / phone). No hay traslados ni clips: toda la vida
// está en el títere (respiración, balanceo, gestos de brazos, pelo, boca, parpadeo, mirada).
const SPOTS={ idle:{pose:'stand',phone:'phone',cx:646,top:64,foot:745} };
const HOT={bed:[20,250,520,600],pc:[790,200,1248,640]}; // toques que la hacen reaccionar desde su lugar

// ---------- estado ----------
let cfg=Object.assign({name:'Vale',voice:'es_MX-claude-high',voiceRate:1,sysVoice:null,readAloud:false,dev:false,persona:''},LS.get('bff_cfg',{}));
let look=Object.assign({outfit:'base',hair:0,eye:0,ear:0},LS.get('bff_look',{}));
if(!READY.includes(look.outfit)) look.outfit='base';
if(!LS.get('bff_v2',false)){ look.eye=0; LS.set('bff_v2',true); }
let hist=LS.get('bff_hist',[]);
const saveCfg=()=>LS.set('bff_cfg',cfg), saveLook=()=>LS.set('bff_look',look), saveHist=()=>LS.set('bff_hist',hist.slice(-200));
let R=null; // se crea en boot() para poder avisar si no hay WebGL
let bgTex, pup={}, meta={};
const her={spot:'idle',phone:0,phoneT:0,phoneHold:0,squash:1,hop:0};
const P={breath:0,blink:0,headTilt:0,nod:0,headTurn:0,hip:0,lean:0,armL:0,armR:0,hairAmp:1,hairWind:0,typing:0,open:0};
const G={tilt:0,nod:0,armL:0,armR:0,turn:0}; let gestT=0;
let forceOpen=null, lipHold=0; // forceOpen: solo pruebas (__bff.open)
let talking=false, fakeTalkUntil=0, herTyping=false, userTyping=0, voiceMode=false, busy=false, lastPoke=0;
let cam={k:1,cx:646,cy:416,ax:0,ay:0,aw:1,ah:1}, camX=SPOTS.idle.cx, camY=416;

// ---------- carga ----------
const prog=p=>{ $('#loader .lbar i').style.width=Math.round(p*100)+'%'; };
async function loadMeta(id){ if(!meta[id]) meta[id]=await fetch(`img2/poses-${id}.json`).then(r=>{ if(!r.ok) throw new Error('poses '+r.status); return r.json(); }); return meta[id]; }
async function loadOutfit(id, all=false){
  const M=await loadMeta(id); const need=all? Object.keys(M) : ['stand','phone'];
  await Promise.all(need.map(async k=>{ const key=k+'-'+id; if(pup[key]||!M[k]) return;
    const [im,mk]=await Promise.all([loadImage(`img2/${key}.webp`),loadImage(`img2/${key}-m.png`)]);
    const L=M[k].L; pup[key]=new Puppet(R,im,mk,L,16,40); pup[key].off=M[k].off; }));
}
async function boot(){
  try{
    R=new Renderer($('#gl'));
    $('#gl').addEventListener('webglcontextlost',e=>{ e.preventDefault(); },false);
    $('#gl').addEventListener('webglcontextrestored',()=>location.reload(),false);
    prog(0.1); const bg=await loadImage('img2/cuarto.webp'); bgTex=R.texture(bg,true); prog(0.45);
    await loadOutfit(look.outfit); prog(1);
  }catch(e){ $('#loader .lname').textContent=/WebGL/i.test(e.message||'')?'Tu navegador no soporta WebGL 😢 prueba en Chrome':'No pude cargar 😢 recarga'; console.error(e); return; }
  layout(); fxInit(); updateAmbience(); setInterval(updateAmbience,600000); requestAnimationFrame(frame);
  setTimeout(()=>{ $('#loader').classList.add('out'); if(!CAPTURE) intro(); },150);
  loadOutfit(look.outfit,true).catch(()=>{});
  if(!CAPTURE) setTimeout(()=>warmModels(),1200);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v='+VERSION).catch(()=>{});
}

// ---------- layout / cámara ----------
function layout(){
  R.resize(); const W=innerWidth,H=innerHeight; const land=W>H&&W>=560;
  const barH=$('#bar').offsetHeight; document.body.style.setProperty('--barH',barH+'px');
  let ax=0,ay=0,aw=W,ah=H-barH;
  if(land){ const pw=Math.min(400,Math.round(W*0.38)); document.body.style.setProperty('--panelW',pw+'px'); if(!voiceMode) aw=W-pw; ah=H; }
  else { const ch=voiceMode?0:Math.round(H*0.40); document.body.style.setProperty('--chatH',ch+'px'); document.body.style.setProperty('--capH',ch+'px'); ah=H-barH-(voiceMode?0:ch-12); }
  if(CAPTURE){ ax=0; ay=0; aw=W; ah=H; }
  const cover=Math.max(aw/ROOM.w, ah/ROOM.h);
  // horizontal + modo voz: que quepa de cuerpo completo (cabeza a pies); los lados se rellenan con el cuarto atenuado
  const k= (land&&voiceMode&&!CAPTURE)? Math.min(cover, ah/800) : cover;
  cam={...cam,k,cover,fit:k<cover-1e-4,ax,ay,aw,ah};
  fxResize();
}
function updateCam(dt){
  const halfW=cam.aw/2/cam.k, halfH=cam.ah/2/cam.k;
  const tx=SPOTS.idle.cx, top=SPOTS.idle.top;
  camX+=(tx-camX)*Math.min(1,dt*2.4);
  cam.cx=Math.min(Math.max(camX,halfW),ROOM.w-halfW); if(halfW*2>=ROOM.w) cam.cx=ROOM.w/2;
  const wantY=Math.max(halfH, top-26+halfH); camY+=(wantY-camY)*Math.min(1,dt*2.4);
  cam.cy=Math.min(Math.max(camY,halfH),ROOM.h-halfH); if(halfH*2>=ROOM.h) cam.cy=ROOM.h/2;
}
const toScreen=(X,Y)=>[(X-cam.cx)*cam.k+cam.ax+cam.aw/2,(Y-cam.cy)*cam.k+cam.ay+cam.ah/2];
const toRoom=(sx,sy)=>[(sx-cam.ax-cam.aw/2)/cam.k+cam.cx,(sy-cam.ay-cam.ah/2)/cam.k+cam.cy];
addEventListener('resize',()=>{ layout(); });
if(window.visualViewport) visualViewport.addEventListener('resize',()=>{ document.getElementById('app').style.height=visualViewport.height+'px'; layout(); });
// ---------- ambiente del cuarto: polvo flotando, luz según la hora, mirada que sigue ----------
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fx=$('#fx'), fxc=fx.getContext('2d');
let motes=[], bursts=[];
function fxResize(){ const d=Math.min(devicePixelRatio||1,2); fx.width=Math.max(1,Math.round(fx.clientWidth*d)); fx.height=Math.max(1,Math.round(fx.clientHeight*d)); }
function fxInit(){ fxResize(); motes=Array.from({length:26},()=>({x:Math.random(),y:Math.random(),r:0.6+Math.random()*1.8,s:0.008+Math.random()*0.02,ph:Math.random()*6.28,a:0.15+Math.random()*0.35})); }
function fxBurst(sx,sy,n=10){ if(REDUCED) return; for(let i=0;i<n;i++){ const a=Math.random()*6.28, sp=20+Math.random()*50; bursts.push({x:sx,y:sy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-20,life:1}); } }
function fxDraw(dt){ if(!fxc||REDUCED) return; const W=fx.width,H=fx.height; fxc.clearRect(0,0,W,H);
  for(const m of motes){ m.y-=m.s*dt; m.x+=Math.sin(T*0.3+m.ph)*0.0004; if(m.y<-0.02){ m.y=1.02; m.x=Math.random(); }
    fxc.globalAlpha=m.a*(0.5+0.5*Math.sin(T*1.2+m.ph*3)); fxc.fillStyle='#ffe9f6'; fxc.beginPath(); fxc.arc(m.x*W,m.y*H,Math.max(0.8,m.r*(W/800+0.5)),0,6.29); fxc.fill(); }
  bursts=bursts.filter(b=>b.life>0);
  for(const b of bursts){ b.life-=dt*1.4; b.x+=b.vx*dt; b.y+=b.vy*dt; b.vy+=60*dt; fxc.globalAlpha=Math.max(0,b.life)*0.9; fxc.fillStyle='#ffb3dd'; fxc.beginPath(); fxc.arc(b.x,b.y,2.5*b.life+1,0,6.29); fxc.fill(); }
  fxc.globalAlpha=1; }
function updateAmbience(){ const el=$('#ambience'); if(!el) return; const h=new Date().getHours();
  el.style.background=h>=6&&h<11?'linear-gradient(rgba(255,217,160,.13),transparent 60%)':h>=11&&h<17?'linear-gradient(rgba(255,246,216,.10),transparent 60%)':h>=17&&h<20?'linear-gradient(rgba(255,154,92,.16),rgba(122,63,176,.10) 130%)':'linear-gradient(rgba(42,26,94,.20),rgba(11,16,48,.20) 130%)'; }
let lookX=0, lookY=0, lookT=-10;
addEventListener('pointermove',e=>{ lookX=(e.clientX/innerWidth-0.5)*2; lookY=(e.clientY/innerHeight-0.5)*2; lookT=T; });
let gustT=3, gust=0;

// ---------- animación ----------
let last=performance.now(), T=0, nextBlink=/capture=1/.test(location.search)?1e9:1.5, blinkT=-1, dbl=false;
const lerp=(a,b,t)=>a+(b-a)*t;
function frame(now){
  try{ frameBody(now); }catch(e){ if(!frame.err){ frame.err=1; console.error('frame',e); } }
  requestAnimationFrame(frame);
}
function frameBody(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now; T+=dt;
  if(T>nextBlink&&blinkT<0){ blinkT=0; }
  if(blinkT>=0){ blinkT+=dt; const d=0.16; P.blink=blinkT<d/2? blinkT/(d/2) : Math.max(0,1-(blinkT-d/2)/(d/2)); if(blinkT>d){ blinkT=-1; P.blink=0; if(!dbl&&Math.random()<0.2){ dbl=true; nextBlink=T+0.12; } else { dbl=false; nextBlink=T+2+Math.random()*3.5; } } }
  P.breath=Math.sin(T*1.55)*(talking?1.2:1);
  // siempre parada en idle: vaivén y cadera al 100% (antes en otros lugares era un parche)
  P.hip=(Math.sin(T*0.45)*2.6+Math.sin(T*0.17)*1.2); P.lean=-P.hip*0.0012;
  P.hairAmp=1.0; // pelo largo: se mueve más que antes (0.7)
  gustT-=dt; if(gustT<=0){ gustT=4+Math.random()*5; gust=0.6+Math.random()*0.8; } P.hairWind=Math.sin(T*0.7)*0.25+gust*Math.sin(T*2.1)*0.35;
  const isTalk=talking||T<fakeTalkUntil;
  gestT-=dt; if(gestT<=0){ gestT=0.35+Math.random()*0.55; // gestos más seguidos al platicar
    if(isTalk){ G.tilt=(Math.random()-.5)*0.09; G.nod=Math.random()<0.5?0.8:0;
      const big=Math.random()<0.15?2.2:1; // de vez en cuando un gesto grande
      G.armL=(Math.random()-.5)*0.14*big; G.armR=(Math.random()-.5)*0.14*big; G.turn=(Math.random()-.5)*0.5; }
    else { G.tilt=(Math.random()-.5)*0.04; G.nod=0; G.armL=0; G.armR=0; G.turn=(Math.random()-.5)*0.2; } }
  const ph=her.phone;
  const lookOn=T-lookT<3?1:0;
  const tiltT=G.tilt+Math.sin(T*0.6)*0.02+Math.sin(T*1.7)*0.008 + her.hop*0.05 + lookY*0.03*lookOn;
  P.headTilt=lerp(P.headTilt,tiltT,dt*3); P.nod=lerp(P.nod,(isTalk?G.nod*Math.max(0,Math.sin(T*7)):0)+ph*0.4,dt*6); P.headTurn=lerp(P.headTurn,G.turn*0.6+lookX*0.35*lookOn,dt*2.5);
  P.armL=lerp(P.armL,G.armL+Math.sin(T*0.9)*0.01,dt*3); P.armR=lerp(P.armR,G.armR-Math.sin(T*0.8)*0.01,dt*3);
  let open=0; if(talking) open=V.audioLevel(); else if(T<fakeTalkUntil) open=Math.max(0,Math.sin(T*15)*0.5+Math.sin(T*23)*0.3+0.15);
  // boca: ataque rápido / suelta más lenta + retención corta para que no parpadee (idea de ryza-ai-revive, MIT)
  open=Math.min(1,open);
  if(forceOpen!=null) P.open=forceOpen;
  else if(open>=P.open){ P.open+=(open-P.open)*(1-Math.exp(-dt/0.025)); lipHold=0.06; }
  else if(lipHold>0) lipHold-=dt; else P.open+=(open-P.open)*(1-Math.exp(-dt/0.07));
  const hasPhone=!!SPOTS.idle.phone; // idle siempre tiene variante con cel
  her.phoneT = hasPhone && !voiceMode && ((herTyping||userTyping>T||busy) || her.phoneHold>T) ? 1 : 0;
  her.phone=lerp(her.phone,her.phoneT,dt*5); if(Math.abs(her.phone-her.phoneT)<0.01) her.phone=her.phoneT;
  P.typing=lerp(P.typing,(herTyping&&her.phone>0.6)?1:0,dt*6);
  her.hop=Math.max(0,her.hop-dt*2.2); her.squash=lerp(her.squash,1,dt*6);
  updateCam(dt);
  draw();
  fxDraw(dt);
  placeBubble();
}
function lookUniforms(){ return { hair:HAIR[look.hair][1], eye:EYES[look.eye][1], ear:EARS[look.ear][1], tint:[1,1,1] }; }
function drawSpot(spot,alpha,lu){
  const S=SPOTS[spot]; if(!S||alpha<=0.003) return;
  const a=pup[S.pose+'-'+look.outfit], b=S.phone&&pup[S.phone+'-'+look.outfit]; if(!a) return;
  const f=b?her.phone:0;
  const place=p=>{ const L=p.L; const hop= -Math.sin(her.hop*Math.PI)*8*(her.hop>0?1:0);
    return {x:p.off[0]+L.cx,y:p.off[1]+L.footY+hop,s:1,sx:her.squash}; };
  R.drawShadow(a.off[0]+a.L.cx,a.off[1]+a.L.footY-2,150,22,cam,alpha*0.8); // sombra en los pies reales de cada atuendo
  if(f<0.999) a.draw(P,T,place(a),cam,alpha,lu);
  if(b&&f>0.001) b.draw(P,T,place(b),cam,alpha*f,lu);
}
function draw(){
  R.clear(); const glow=[0.75,0.33,0.13,0.06];
  if(cam.fit) R.drawBg(bgTex,ROOM.w,ROOM.h,{...cam,k:cam.cover,cx:ROOM.w/2,cy:ROOM.h/2},0.32,null);
  R.drawBg(bgTex,ROOM.w,ROOM.h,cam,1,glow);
  const lu=lookUniforms();
  drawSpot('idle',1,lu);
}

// ---------- utilidades ----------
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- burbuja sobre su cabeza ----------
let bubbleUntil=0;
function say(text,ms){ const b=$('#bubble'); b.textContent=text; b.classList.remove('hide'); bubbleUntil=performance.now()+(ms||Math.min(9000,1800+text.length*55)); }
function placeBubble(){
  const b=$('#bubble'); if(performance.now()>bubbleUntil){ b.classList.add('hide'); return; }
  const S=SPOTS.idle; let X=S.cx, Y=S.top-14;
  let [sx,sy]=toScreen(X,Y); const bw=b.offsetWidth||200, bh=b.offsetHeight||40;
  // sin espacio arriba de la cabeza (horizontal / modo voz): la burbuja va AL LADO de la cara, no encima
  const side= sy-bh<8; b.classList.toggle('side',side);
  if(side){ const [hx,hy]=toScreen(S.cx,S.top+70); const r=hx+50+bw/2, l=hx-50-bw/2; sx= r+bw/2<cam.ax+cam.aw-8? r : l; sy=Math.max(bh+8,hy+bh/2); }
  b.style.left=Math.max(cam.ax+bw/2+6,Math.min(cam.ax+cam.aw-bw/2-6,sx))+'px'; b.style.top=Math.max(bh+8,sy)+'px';
}

// ---------- chat UI ----------
const hhmm=ts=>new Date(ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function bubbleEl(m){
  const d=document.createElement('div'); d.className='m '+(m.role==='user'?'me':m.role==='sys'?'sys':'her');
  d.innerHTML=esc(m.content).replace(/(https?:\/\/[^\s)]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  if(m.photo){ const im=document.createElement('img'); im.className='ph'; im.src=m.photo; im.alt='Foto'; d.insertBefore(im,d.firstChild); }
  if(m.links&&m.links.length){ const s=document.createElement('div'); s.className='src'; for(const l of m.links){ const a=document.createElement('a'); a.href=l.url; a.target='_blank'; a.rel='noopener'; a.textContent='🔗 '+l.title; s.appendChild(a);} d.appendChild(s); }
  if(m.role!=='sys'){ const meta=document.createElement('span'); meta.className='meta'; meta.innerHTML=(m.role==='assistant'&&m.via?`<span class="via ${m.via==='respaldo'?'respaldo':'key'}">${PROVIDERS[m.via]?'⚡ '+PROVIDERS[m.via].name:'respaldo'}</span> `:'')+hhmm(m.ts)+(m.role==='assistant'?'<button class="regen" aria-label="Otra respuesta" title="Otra respuesta">↻</button>':'')+(m.role==='user'?`<span class="tick ${m.read?'read':''}">✓✓</span>`:''); d.appendChild(meta); }
  m._el=d; return d;
}
function render(){ const box=$('#msgs'); box.innerHTML=''; for(const m of hist.slice(-60)) box.appendChild(bubbleEl(m)); box.scrollTop=box.scrollHeight; markLastHer(); }
// ↻ otra respuesta (como el "swipe/regenerate" de SillyTavern): solo en el último mensaje de ella
function markLastHer(){ const box=$('#msgs'); box.querySelectorAll('.m.her.last').forEach(e=>e.classList.remove('last'));
  let i=hist.length-1; while(i>=0&&hist[i].role==='sys') i--; const m=hist[i]; if(m&&m.role==='assistant'&&m._el&&hist.slice(0,i).some(x=>x.role==='user')) m._el.classList.add('last'); }
$('#msgs').addEventListener('click',async e=>{ const b=e.target.closest('.regen'); if(!b||busy||talking) return; const el=b.closest('.m.her'); if(!el||!el.classList.contains('last')) return;
  const i=hist.findLastIndex(m=>m._el===el); if(i<0) return; hist.splice(i,1); saveHist(); el.remove(); V.stop();
  busy=true; try{ await respond(); } finally{ busy=false; } });
function push(m){ m.ts=m.ts||Date.now(); hist.push(m); if(m.role!=='sys') saveHist(); const box=$('#msgs'); const t=box.querySelector('.typing'); const el=bubbleEl(m); el.classList.add('new'); box.insertBefore(el,t); markLastHer(); requestAnimationFrame(()=>box.scrollTop=box.scrollHeight); return m; }
function setTyping(on){ herTyping=on; const box=$('#msgs'); let t=box.querySelector('.typing'); $('#cstatus').textContent=on?'escribiendo…':'en línea';
  if(on&&!t){ t=document.createElement('div'); t.className='typing'; t.innerHTML='<i></i><i></i><i></i>'; box.appendChild(t); box.scrollTop=box.scrollHeight; }
  if(!on&&t) t.remove(); }
function markRead(){ for(const m of hist) if(m.role==='user'&&!m.read){ m.read=true; m._el&&m._el.querySelector('.tick')?.classList.add('read'); } saveHist(); }

// ---------- conversación ----------
function systemPrompt(extra=''){
  const persona=(cfg.dev&&cfg.persona.trim())? cfg.persona : BASE_PERSONA(cfg.name);
  const now=new Date(); const where='parada en tu cuarto';
  const ctx=`\nAhora: ${now.toLocaleString('es-MX',{weekday:'long',hour:'2-digit',minute:'2-digit'})}. Estás ${where}, vestida con tu outfit "${(OUTFITS.find(o=>o.id===look.outfit)||OUTFITS[0]).name}".`+
    (voiceMode? ' Están platicando EN PERSONA, frente a frente: habla natural para decirse en voz alta, sin emojis ni links.' : ' Están platicando por WhatsApp desde tu cel: escribe como mensaje de WhatsApp.');
  return persona+(cfg.adult?ADULT_RULES(cfg.name):'')+ctx+profileText(LS.get('bff_profile',{}))+(cfg.adult?memoryText()+limitsText():'')+toneText(!!cfg.adult)+extra;
}
function chatMsgs(extra){ const h=hist.filter(m=>m.role==='user'||m.role==='assistant').slice(-16).map(m=>({role:m.role,content:m.content.length>700? m.content.slice(0,700)+'…' : m.content})); // contexto corto = respuesta más rápida
  if(pendingPhoto){ for(let i=h.length-1;i>=0;i--) if(h[i].role==='user'){ h[i]={role:'user',content:[{type:'text',text:h[i].content},{type:'image_url',image_url:{url:pendingPhoto}}]}; break; } }
  return [{role:'system',content:systemPrompt(extra)},...h]; }
let userCount=LS.get('bff_ucount',0);
async function reply(m,live,silent){
  // muestra respuesta, voz, gestos (live = burbuja que ya se mostró en streaming: solo se completa)
  let msg;
  if(live){ msg=live; Object.assign(msg,{content:m.text,links:m.links,via:m.via}); const old=msg._el, el=bubbleEl(msg); if(old&&old.isConnected) old.replaceWith(el); saveHist(); markLastHer(); }
  else msg=push({role:'assistant',content:m.text,links:m.links,via:m.via});
  her.hop=0.6; 
  if(voiceMode||cfg.readAloud){ if(!silent) await speakLine(m.text); } else { her.phoneHold=T+6; }
  return msg;
}
async function speakLine(text){
  say(text.length>160? text.slice(0,157)+'…':text);
  if(cfg.voice==='none'){ fakeTalkUntil=T+Math.min(10,1+text.length*0.055); return; }
  ear&&ear.pause(); talking=true;
  try{ await V.speak(text,cfg.voice,kind=>{ if(kind==='system'&&!warnedSys){ warnedSys=true; push({role:'sys',content:'Uso la voz del sistema porque la natural no cargó (suena más robótica). Revisa ⚙ → Voz.'}); } },cfg.voiceRate||1,cfg.sysVoice); }
  catch{ fakeTalkUntil=T+Math.min(10,1+text.length*0.055); }
  talking=false; if(pendingVoice){ const v=pendingVoice; pendingVoice=null; send(v); } if(voiceMode) ear&&ear.resume();
}
let warnedSys=false;
let pending=false, limitWarned=false;
let lastUserAt=Date.now(), nudged=false;
setInterval(()=>{ if(nudged||busy||talking||!hist.some(m=>m.role==='user')) return; const idleMs=Date.now()-lastUserAt;
  if(cfg.adult && idleMs>=360000){ nudged=true; proposeScenario(); return; }
  if(idleMs<240000) return; nudged=true;
  const l=pick(['¿Sigues ahí? 😏 Cuéntame algo, ando aburrida…','Oye, ¿te dormiste? 😂 Aquí sigo, ¿eh?','¿Qué onda? Ya me dejaste en visto 👀 cuéntame el chisme']); push({role:'assistant',content:l}); say(l,3000); fakeTalkUntil=T+1.5; },30000);
async function send(text){
  text=text.trim(); if(!text) return; V.unlockAudio(); lastUserAt=Date.now(); nudged=false;
  push({role:'user',content:text}); userCount++; LS.set('bff_ucount',userCount); localProfile(text);
  updateTone(text);
  if(cfg.adult){ saveMemory(text); learnLimits(text); }
  if(busy){ pending=true; return; }
  busy=true;
  try{ await respond(); while(pending){ pending=false; await respond(); } }
  finally{ busy=false; }
  if(userCount%5===0 && hasGroq()){ const um2=hist.filter(m=>m.role==='user').slice(-12).map(m=>m.content); updateProfile(um2); }
}
const lastUser=()=>{ const u=[]; for(let i=hist.length-1;i>=0&&hist[i].role!=='assistant';i--) if(hist[i].role==='user') u.unshift(hist[i].content); return u.join('\n'); };
const warned=new Set();
function warnErrs(errs){ for(const e of errs||[]){ const k=e.prov+':'+e.status; if(warned.has(k)) continue; warned.add(k); push({role:'sys',content:'⚠️ '+provErrText(e)}); } }
const DEFLECT=['Jajaja uy, me pusiste roja 🙈 Ahorita se me trabó la cabeza, cuéntame tú qué traes en mente…','Ay, cállate 😏 me sacaste los colores. A ver, sígueme contando, ¿qué más?','Mmm qué atrevido 😏 dame chance, que se me fue la onda; ¿en qué íbamos?'];
async function askAI(msgs,onDelta){
  for(let i=0;i<4;i++){
    try{ const r=await complete(msgs,{adult:!!cfg.adult,onDelta}); warnErrs(r.errs); if(r.refused) return {text:pick(DEFLECT),via:r.via}; return r; }
    catch(e){ warnErrs(e.errs); if(e.wait){ const w=Math.min(60,e.wait||45);
        push({role:'sys',content:limitWarned?`⏳ Espero ${w} s y lo reintento…`:`La IA gratis sin llave deja ~1 respuesta cada ${w} s, por eso tardo. ${hasGroq()?'':'Con una llave gratis (⚙) contesto al instante.'}`}); limitWarned=true;
        for(let k=w+1;k>0;k--){ $('#cstatus').textContent=`escribiendo… (${k}s)`; await sleep(1000); } $('#cstatus').textContent='escribiendo…'; continue; }
      break; }
  }
  return {text:pick(['Uy, se me trabó el cel 😩 ¿me lo repites?','Ay, se me fue el internet wey, dame chance y repítemelo 🙏'])};
}
async function respond(){
  const text=lastUser(); if(!text) return;
  // si en modo +18 hay señal de menor de edad, el modo se apaga solo (hay que volver a confirmar en ⚙)
  const minorInAdult=cfg.adult && minorSignal(text,true);
  if(minorInAdult){ cfg.adult=false; saveCfg(); push({role:'sys',content:'🔞 Modo +18 desactivado: hubo señal de que podrías ser menor de edad. Si fue un error, vuelve a activarlo en ⚙.'}); }
  const g=guard(text, minorInAdult || !!cfg.adult);
  if(g){ await sleep(500); markRead(); setTyping(true); await sleep(900); setTyping(false); await reply({text:g}); return; }
  const q=researchQuery(text.split('\n').pop());
  if(q){ await research(q,text); return; }
  // v1.5.2 (+18): su acción tiene consecuencia física inmediata en la muñeca
  const physAct=cfg.adult?detectAction(text):null;
  if(physAct){ her.hop=0.8; G.tilt=(Math.random()-.5)*0.3; document.body.classList.add('blushing'); setTimeout(()=>document.body.classList.remove('blushing'),2600); }
  await sleep(150); markRead(); setTyping(true); const t0=performance.now();
  // diálogo por voz: el audio arranca con la primera frase, sin esperar la respuesta completa
  const liveOn=voiceMode||cfg.readAloud;
  let liveBuf='', liveFed='', fedLen=0, spokeLive=liveOn;
  const endTalking=()=>{ talking=false; if(pendingVoice){ const v=pendingVoice; pendingVoice=null; send(v); } if(voiceMode) ear&&ear.resume(); };
  const feedLive=t=>{ if(!liveOn) return; const [ss,rest]=V.takeSentences(liveBuf+t); liveBuf=rest; for(const s of ss){ liveFed+=s+' '; V.liveEnqueue(s); } };
  if(liveOn){ talking=true; ear&&ear.pause();
    V.liveStart(cfg.voice,kind=>{ if(kind==='system'&&!warnedSys){ warnedSys=true; push({role:'sys',content:'Uso la voz del sistema porque la natural no cargó. Revisa ⚙ → Voz.'}); } },cfg.voiceRate||1,cfg.sysVoice,()=>endTalking()); }
  // streaming: la burbuja aparece con las primeras frases y se va llenando (idea de SillyTavern)
  let live=null; const onDelta=t=>{ if(!live){ setTyping(false); live=push({role:'assistant',content:t}); her.hop=0.6; }
    else { live.content=t; if(live._el&&live._el.firstChild) live._el.firstChild.textContent=t; const box=$('#msgs'); box.scrollTop=box.scrollHeight; }
    feedLive(t.slice(fedLen)); fedLen=t.length; };
  const r=await askAI(chatMsgs(physAct?`\nÉl acaba de ${physAct.label}: reacciona físicamente de inmediato (sonrojo, escalofrío, respiración entrecortada) y descríbelo en tu respuesta, en personaje.` : ''),onDelta);
  if(liveOn){
    if(r.text && liveFed.trim() && r.text.startsWith(liveFed.trim())){ feedLive(r.text.slice(liveFed.trim().length)); }
    else if(!liveFed.trim()){ feedLive(r.text); }
    else { V.liveStop(); spokeLive=false; endTalking(); }
    if(spokeLive){ if(liveBuf.trim()){ V.liveEnqueue(liveBuf); liveBuf=''; } V.liveEnd(); }
  }
  if(live){ await reply(r,live,spokeLive); return; }
  // pausa mínima de "escribiendo" (antes hasta 2.6 s extra)
  if(!spokeLive){ const min=Math.min(1100,300+r.text.length*5); const left=min-(performance.now()-t0); if(left>0) await sleep(left); }
  setTyping(false);
  if(spokeLive){ push({role:'assistant',content:r.text,links:r.links,via:r.via}); her.hop=0.6; return; }
  await reply(r);
}
// v1.5.2 (+18): propone un escenario nuevo (sin repetir los últimos 3) y lo juega la IA
async function proposeScenario(){
  if(busy||talking) return; busy=true; nudged=true; lastUserAt=Date.now();
  try{ const sc=pickScenario();
    const r=await askAI(chatMsgs(`\nSe te acaba de ocurrir un escenario para jugar con él, propónselo en tu estilo, con picardía, invitándolo a jugarlo: "${sc.text}" No lo presentes como lista ni como idea de nadie más: es tuya, se te ocurrió ahorita.`));
    await reply(r);
  } finally{ busy=false; }
}
const pick=a=>a[Math.floor(Math.random()*a.length)];
async function research(q,orig){
  markRead(); const ack=pick([`Va, déjame lo investigo en la compu 💻`,`Órale, ahorita lo busco, aguanta 🔎`,`Sale, voy a la compu a checar eso 👀`]);
  push({role:'assistant',content:ack}); if(voiceMode||cfg.readAloud) await speakLine(ack); else say(ack,2200);
  const found=await webSearch(q).catch(()=>[]);
  setTyping(true);
  const src=found.map((r,i)=>`[${i+1}] ${r.title}: ${r.text.slice(0,700)}`).join('\n\n');
  const extra = src? `\n\nACABAS DE INVESTIGAR en tu compu sobre "${q}". Resultados:\n${src}\n\nCuéntale lo que encontraste en 2 a 4 frases, en tu estilo, con datos concretos de los resultados (no inventes nada que no esté ahí). No pegues links, yo los pongo abajo.`
    : `\n\nIntentaste investigar "${q}" en internet pero no salió nada. Díselo en tu estilo y comparte lo que sepas si estás segura, aclarando que no lo checaste.`;
  let r=await askAI(chatMsgs(extra)); if(/se me trabó|se me fue el internet/.test(r.text)&&found.length) r={text:`Mira, encontré esto: ${found[0].text.slice(0,260)}…`};
  await sleep(900); setTyping(false);
  r.links=found.map(f=>({title:f.title,url:f.url}));
  await reply(r);
}

// ---------- intro ----------
function intro(){
  const first=!hist.length; const p=LS.get('bff_profile',{}); const nom=p.apodo||p.nombre;
  her.hop=1; her.squash=0.92;
  const h=new Date().getHours(); const saludo=h<6?'¡Quiubo! 👋 ¿Qué haces despierto a estas horas?':h<12?'¡Buenos días! ☀️':h<20?'¡Quiubo! 👋':'¡Buenas noches! 🌙';
  const line= first? `${saludo} Por fin alguien que me pela. Soy ${cfg.name}, tu nueva BFF. ¿Qué onda contigo, qué tal tu día? Cuéntame el chisme 😏`
    : pick([`¡Ya volviste${nom?', '+nom:''}! 🙌 Te extrañé, ¿eh? ¿Qué me cuentas?`,`¡Eyyy${nom?' '+nom:''}! 😏 ¿Qué milagro? Échame el chisme.`,`Mira nomás quién regresó${nom?', '+nom:''} 😂 ¿Qué traes?`]);
  render(); say(first?'¡Quiubo! 👋':'¡Eyyy! 👋',2600); const introLen=hist.length;
  setTimeout(()=>{ if(hist.length!==introLen) return; setTyping(true); },400);
  setTimeout(()=>{ if(hist.length!==introLen) return; setTyping(false); push({role:'assistant',content:line}); fakeTalkUntil=T+0.8; },1300);
}

// ---------- toques en el cuarto: Vale reacciona desde su lugar, sin moverse ----------
$('#gl').addEventListener('click',e=>{
  V.unlockAudio();
  const [X,Y]=toRoom(e.clientX,e.clientY);
  // ¿la tocó a ella?
  const S=SPOTS.idle; const pz=pup[S.pose+'-'+look.outfit];
  if(pz){ const [x0,y0]=pz.off; if(X>x0+20&&X<x0+pz.w-20&&Y>y0&&Y<(pz.h?y0+pz.h:S.foot)) return poke(); }
  const inR=(r)=>X>=r[0]&&X<=r[2]&&Y>=r[1]&&Y<=r[3];
  if(inR(HOT.pc)){ if(busy) return; $('#txt').value='Investiga '; $('#txt').focus(); say('¿Qué investigo? 🤓',2500); return; }
  if(inR(HOT.bed)){ if(busy) return; her.hop=1; G.tilt=(Math.random()-.5)*0.2;
    say(pick(['Ahh, qué rica se ve esa camita 😌 ¿nos echamos?','Uff, esa cama me está llamando… pero aquí me quedo contigo 😏','¿Te imaginas echados ahí? 😌']),2200); return; }
});
function poke(){ const t=performance.now(); if(t-lastPoke<800) return; lastPoke=t; her.hop=1; her.squash=0.94; G.tilt=(Math.random()-.5)*0.2;
  const S=SPOTS.idle; const [px,py]=toScreen(S.cx,S.top+120); fxBurst(px,py,8);
  const l=pick(['¡Ay, qué! 😂','¿Qué me ves? 😏','Jajaja no me piques 🙈','¿Mande? 👀','Oye, respeta 😤 jaja']); say(l,1800); fakeTalkUntil=T+0.9; }

// ---------- barra de texto / mic ----------
const txt=$('#txt');
txt.addEventListener('input',()=>{ txt.style.height='auto'; txt.style.height=Math.min(120,txt.scrollHeight)+'px'; userTyping=T+2.5; lastUserAt=Date.now(); nudged=false; layout(); });
txt.addEventListener('focus',()=>{ userTyping=T+3; });
txt.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); $('#bar').requestSubmit(); } });
$('#bar').addEventListener('submit',e=>{ e.preventDefault(); const v=txt.value; txt.value=''; txt.style.height='auto'; send(v); });
let ear=null, pendingVoice=null, pendingPhoto=null;
const VISION_EXTRA='\nTe mandaron una foto: descríbela como tu BFF, con detalle y cariño. Si en la foto hay alguien que parece menor de edad, descríbelo solo de forma neutra y nunca hagas comentarios sobre su cuerpo ni nada sexual.';
$('#photo').addEventListener('click',()=>$('#photoIn').click());
$('#photoIn').addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(f) sendPhoto(f); });
function processPhoto(file){ return new Promise((res,rej)=>{ const url=URL.createObjectURL(file); const im=new Image();
  im.onload=()=>{ URL.revokeObjectURL(url); const mk=max=>{ const s=Math.min(1,max/Math.max(im.width,im.height)); const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(im.width*s)); c.height=Math.max(1,Math.round(im.height*s)); c.getContext('2d').drawImage(im,0,0,c.width,c.height); return c.toDataURL('image/jpeg',0.82); };
    res({full:mk(1024),thumb:mk(320)}); };
  im.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('foto')); }; im.src=url; }); }
async function sendPhoto(file){
  if(busy){ push({role:'sys',content:'Dame un segundito, estoy contestando…'}); return; }
  if(!provKey('gemini')){ push({role:'sys',content:'Para que Vale vea fotos pon tu llave gratis de Gemini en ⚙ → Llaves (aistudio.google.com). Groq no tiene modelo que vea imágenes.'}); return; }
  V.unlockAudio();
  let p; try{ p=await processPhoto(file); }catch{ push({role:'sys',content:'No pude leer esa foto 😢 Prueba con otra.'}); return; }
  const caption=txt.value.trim()||'¿Qué ves en esta foto?'; txt.value=''; txt.style.height='auto';
  lastUserAt=Date.now(); nudged=false; userCount++; LS.set('bff_ucount',userCount); localProfile(caption);
  push({role:'user',content:caption,photo:p.thumb}); pendingPhoto=p.full;
  busy=true; try{ await respondPhoto(); } finally{ busy=false; pendingPhoto=null; }
}
async function askAIVision(msgs){
  try{ const r=await completeVision(msgs,{adult:!!cfg.adult}); warnErrs(r.errs); return r; }
  catch(e){ warnErrs(e.errs); return {text:pick(['Uy, no pude ver la foto 😩 ¿me la mandas de nuevo?','Ay, se me trabó al ver la foto, wey, mándamela otra vez 🙏'])}; }
}
async function respondPhoto(){
  const text=lastUser(); if(!text) return;
  const minorInAdult=cfg.adult && minorSignal(text,true);
  if(minorInAdult){ cfg.adult=false; saveCfg(); push({role:'sys',content:'🔞 Modo +18 desactivado: hubo señal de que podrías ser menor de edad. Si fue un error, vuelve a activarlo en ⚙.'}); }
  const g=guard(text, minorInAdult || !!cfg.adult);
  if(g){ await sleep(500); markRead(); setTyping(true); await sleep(900); setTyping(false); await reply({text:g}); return; }
  await sleep(350); markRead(); setTyping(true); const t0=performance.now();
  const msg=push({role:'assistant',content:''});
  const r=await askAIVision(chatMsgs(VISION_EXTRA));
  setTyping(false);
  msg.content=r.text; msg.via=r.via;
  if(msg._el&&msg._el.isConnected){ const fresh=bubbleEl(msg); msg._el.replaceWith(fresh); }
  saveHist();
  const elapsed=performance.now()-t0; const min=elapsed>1500?0:Math.min(900,300+r.text.length*6); const left=min-elapsed; if(left>0) await sleep(left);
  her.hop=0.6;
  if(voiceMode||cfg.readAloud) await speakLine(r.text); else { her.phoneHold=T+6; }
}
$('#mic').addEventListener('click',async()=>{
  V.unlockAudio();
  if(!voiceMode){
    ear=ear||new V.Ear(t=>{ if(talking) pendingVoice=t; else send(t); },t=>{ txt.placeholder='🎙️ '+t; });
    if(!ear.ok){ push({role:'sys',content:'Tu navegador no deja usar el micrófono aquí. Prueba en Chrome.'}); return; }
    ear.onDenied=()=>{ push({role:'sys',content:'No me diste permiso del micrófono 😢 Actívalo en el candadito de la barra de direcciones.'}); setVoice(false); };
    V.stop(); // que se calle si estaba hablando: si no, su propia voz se transcribiría como mensaje tuyo
    setVoice(true); ear.start();
    if(cfg.voice==='es_MX-claude-high' && !(await V.piperReady())) downloadVoice();
  } else { setVoice(false); ear&&ear.stop(); V.stop(); }
});
$('#dice').addEventListener('click',()=>{ if(!cfg.adult||busy||talking) return; V.unlockAudio(); proposeScenario(); });
function setVoice(on){ voiceMode=on; document.body.classList.toggle('voice-mode',on); document.body.classList.toggle('text-mode',!on); $('#mic').classList.toggle('on',on); txt.placeholder=on?'Te escucho… (o escribe)':'Escríbele…'; layout();
  if(on) say(pick(['¡A ver, platícame! 👂','Te escucho, wey 😊']),2000); }
let dlP=null;
function downloadVoice(onp){
  if(dlP) return dlP; const m=push({role:'sys',content:'Bajando mi voz natural (una sola vez, ~63 MB)… 0%'});
  dlP=V.preparePiper(p=>{ const t=`Bajando mi voz natural (una sola vez, ~63 MB)… ${Math.round(p*100)}%`; m.content=t; if(m._el&&m._el.isConnected) m._el.firstChild.textContent=t; onp&&onp(p); })
    .then(()=>{ m.content='¡Listo! Ya tengo mi voz 🎙️'; if(m._el&&m._el.isConnected) m._el.firstChild.textContent=m.content; return true; })
    .catch(e=>{ dlP=null; m.content='No pude bajar la voz natural (¿sin internet?). Mientras, uso la del sistema.'; if(m._el&&m._el.isConnected) m._el.firstChild.textContent=m.content; return false; });
  return dlP;
}

// ---------- hojas ----------
function sheet(title,html,onMount){ $('#shTitle').textContent=title; $('#shBody').innerHTML=html; $('#sheet').classList.remove('hide'); onMount&&onMount($('#shBody')); }
function closeSheet(){ $('#sheet').classList.add('hide'); }
$('#sheet').addEventListener('click',e=>{ if(e.target.id==='sheet'||e.target.hasAttribute('data-close')) closeSheet(); });

$('#gear').addEventListener('click',openSettings);
async function openSettings(){
  const ready=await V.piperReady();
  sheet('Ajustes',`
   <div class="row"><label>Nombre de tu BFF</label><input type="text" id="sName" maxlength="20" value="${esc(cfg.name)}"></div>
   <div class="row"><label>👗 Outfit de ${esc(cfg.name)}</label>
     <div class="grid">${OUTFITS.filter(o=>READY.includes(o.id)).map(o=>`<button class="card ${look.outfit===o.id?'on':''}" data-outfit="${o.id}"><img src="img2/stand-${o.id}.webp" loading="lazy" alt="">${o.name}</button>`).join('')}</div>
     <p class="note">Se cambia al instante, sin que se mueva de su lugar. Pronto: más outfits y “Diseñar con IA”.</p></div>
   <div class="row"><label>💇 Cabello</label><div class="sw">${HAIR.map((c,i)=>`<button style="background:${c[2]}" class="${look.hair===i?'on':''}" data-k="hair" data-i="${i}">${c[0]}</button>`).join('')}</div>
   <p class="note">El color se aplica sobre su dibujo; en orillas finas puede verse algún detalle.</p></div>
   <div class="row"><label>👁️ Ojos</label><div class="sw">${EYES.map((c,i)=>`<button style="background:${c[2]}" class="${look.eye===i?'on':''}" data-k="eye" data-i="${i}">${c[0]}</button>`).join('')}</div></div>
   <div class="row"><label>💎 Aretes</label><div class="sw">${EARS.map((c,i)=>`<button style="background:${c[2]}" class="${look.ear===i?'on':''}" data-k="ear" data-i="${i}">${c[0]}</button>`).join('')}</div></div>
   <p class="note">💬 Llevan ${userCount} mensajes tuyos y ${hist.filter(m=>m.role==='assistant').length} míos.</p>
   <div class="row"><label>Voz</label><select id="sVoice">${V.VOICES.map(v=>`<option value="${v.id}" ${cfg.voice===v.id?'selected':''}>${v.name}</option>`).join('')}<option value="none" ${cfg.voice==='none'?'selected':''}>Sin voz</option></select>
     <p class="note" id="vNote">${ready?'✅ Voz natural ya descargada (funciona sin internet).':'La voz natural se descarga una vez (~63 MB) y luego funciona sin internet.'}</p>
     ${ready?'<button class="btn" id="sDel">🗑️ Borrar voz descargada</button>':'<button class="btn" id="sDl">⬇️ Descargar voz natural</button><div class="prog"><i id="sProg"></i></div>'}</div>
   <div class="row"><label>Velocidad de voz</label><input type="range" id="sRate" min="0.75" max="1.5" step="0.05" value="${cfg.voiceRate||1}"><p class="note" id="sRateNote">${Math.round((cfg.voiceRate||1)*100)}% (1 = normal)</p></div>
   <div class="row" id="sysRow" style="display:${cfg.voice==='system'?'block':'none'}"><label>Voz del sistema (la de tu cel)</label><select id="sSysVoice"></select><p class="note">En Android suelen ser las de Google y suenan muy naturales. Prueba varias.</p></div>
   <div class="row sw-row"><label style="margin:0">Leer en voz alta también en modo texto</label><input type="checkbox" id="sRead" ${cfg.readAloud?'checked':''}></div>
   <div class="row sw-row"><label style="margin:0">🔞 Modo +18 (solo texto)</label><input type="checkbox" id="sAdult" ${cfg.adult?'checked':''}></div>
   <p class="note" style="margin-top:-6px">Plática coqueta/subida de tono entre adultos, solo texto. Su ropa, poses y animaciones no cambian. Apagado por defecto.</p>
   <div class="row" id="adultBox" style="display:${cfg.adult?'block':'none'}">
     <label>🔞 Intensidad máxima (modo +18)</label><input type="range" id="sInt" min="1" max="10" step="1" value="${getLimits().intensity}"><p class="note" id="sIntNote">${getLimits().intensity}/10 — juega justo al filo, sin pasarte</p>
     <label>Cosas que NO quiere (límites)</label><div id="sNoList"></div>
     <div class="kb"><input type="text" id="sNoAdd" placeholder="Agregar un no…" maxlength="40"><button class="btn" id="sNoBtn">＋</button></div>
     <p class="note">También aprendo sola: si dice "eso no" o "no me gusta X", lo anoto aquí.</p>
     <label>Memorias guardadas</label><p class="note" id="sMemNote">${(LS.get('bff_memories',[])||[]).length} recuerdos guardados.</p>
     <button class="btn" id="sMemBtn">👁️ Ver memorias</button> <button class="btn" id="sMemDel">🗑️ Borrar memorias</button>
     <div id="sMemList" style="display:none"></div>
   </div>
   <div class="row"><label>Llaves de IA (opcionales, gratis, se guardan solo en este cel)</label>
   ${Object.entries(PROVIDERS).map(([id,P])=>`<div class="kb"><span class="kn">${P.name}</span><input type="password" data-prov="${id}" placeholder="${P.hint}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${provKey(id)?'••••••••':''}"><p class="note" id="kst-${id}">${provKey(id)?'Probando…':''}</p></div>`).join('')}
   <p class="note">Sin llaves uso un servicio gratis sin registro (más lento y se niega más en +18). Llaves gratis sin tarjeta: console.groq.com y aistudio.google.com (Gemini). Mistral y Cerebras ya piden pago, por eso no están.</p></div>
   <div class="row"><button class="btn red" id="sReset">🔄 Reiniciar amistad</button><p class="note">Borra la plática y lo que ${esc(cfg.name)} sabe de ti. Todo se guarda solo en este dispositivo.</p></div>
   <div class="row sw-row"><label style="margin:0">Modo desarrollador</label><input type="checkbox" id="sDev" ${cfg.dev?'checked':''}></div>
   <div class="row" id="devBox" style="display:${cfg.dev?'block':'none'}"><label>Personalidad (solo dev)</label><textarea id="sPersona" placeholder="Vacío = personalidad normal">${esc(cfg.persona||'')}</textarea></div>
   <button class="btn pink" data-close>Listo</button><p class="note" style="text-align:center">Mi BFF AI v${VERSION}</p>`, el=>{
    el.querySelector('#sName').onchange=e=>{ cfg.name=e.target.value.trim()||'Vale'; saveCfg(); $('#cname').textContent=cfg.name; };
    // cambio de ropa en Ajustes (antes era el clóset): sin re-render, solo se marca la tarjeta
    el.querySelectorAll('[data-outfit]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.outfit; if(id===look.outfit) return; b.style.opacity=.5; const n=++outfitN;
      await loadOutfit(id,true); if(n!==outfitN) return; her.squash=0.05; await sleep(140); if(n!==outfitN) return; look.outfit=id; saveLook(); her.hop=0.7;
      say(pick(['¿Cómo me veo? 😏','¡Ay, me encanta! ✨','Uff, qué chula 💅']),2000);
      el.querySelectorAll('[data-outfit]').forEach(x=>{ x.classList.toggle('on',x.dataset.outfit===id); x.style.opacity=''; }); });
    el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ look[b.dataset.k]=+b.dataset.i; saveLook(); her.hop=0.4;
      el.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x=>x.classList.toggle('on',x===b)); });
    el.querySelector('#sVoice').onchange=e=>{ cfg.voice=e.target.value; saveCfg(); const sr2=el.querySelector('#sysRow'); if(sr2) sr2.style.display=cfg.voice==='system'?'block':'none'; };
    const sr=el.querySelector('#sRate'); if(sr) sr.oninput=e=>{ cfg.voiceRate=+e.target.value; saveCfg(); const n=el.querySelector('#sRateNote'); if(n) n.textContent=Math.round(cfg.voiceRate*100)+'% (1 = normal)'; };
    const sv=el.querySelector('#sSysVoice');
    const fillSys=()=>{ if(!sv) return; const vs=V.listSystemVoices(); sv.innerHTML=vs.map(v=>`<option value="${esc(v.name)}" ${cfg.sysVoice===v.name?'selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')||'<option value="">Sin voces de español en este cel</option>'; };
    if(sv){ fillSys(); if(typeof speechSynthesis!=='undefined') speechSynthesis.onvoiceschanged=fillSys; sv.onchange=e=>{ cfg.sysVoice=e.target.value||null; saveCfg(); }; }
    el.querySelector('#sRead').onchange=e=>{ cfg.readAloud=e.target.checked; saveCfg(); V.unlockAudio(); };
    for(const kIn of el.querySelectorAll('input[data-prov]')){ const prov=kIn.dataset.prov, P=PROVIDERS[prov], kSt=el.querySelector('#kst-'+prov); let kT=0, kN=0;
      const testKey=async()=>{ const k=provKey(prov); const n=++kN; if(!k){ kSt.textContent=''; return; }
        kSt.textContent='Probando llave…'; try{ const ms=await listModels(prov,k); if(n!==kN) return; kSt.textContent=ms.length?`✅ ${P.name} conectado (${ms[0]}).`:`⚠️ La llave sirve pero ${P.name} no ofrece modelos de chat.`; }
        catch(e){ if(n!==kN) return; kSt.textContent='❌ '+provErrText(e); } };
      const saveKey=()=>{ const raw=kIn.value; if(raw.startsWith('••')) return; const v=cleanKey(raw); if(v) LS.set(P.ls,v); else LS.del(P.ls); LS.del('bff_models_'+prov); for(const w of [...warned]) if(w.startsWith(prov+':')) warned.delete(w); testKey(); };
      kIn.onfocus=()=>{ if(kIn.value.startsWith('••')) kIn.value=''; };
      kIn.oninput=()=>{ clearTimeout(kT); kT=setTimeout(saveKey,350); };
      kIn.onchange=()=>{ clearTimeout(kT); saveKey(); };
      kIn.onblur=()=>{ if(!kIn.value&&provKey(prov)) kIn.value='••••••••'; };
      if(provKey(prov)) testKey(); }
    el.querySelector('#sAdult').onchange=e=>{ if(e.target.checked){ if(!confirm('🔞 Modo +18 (solo texto)\n\nConfirmo que tengo 18 años o más y quiero pláticas para adultos. Nada con menores, todo con consentimiento.\n\n¿Tengo 18 años o más?')){ e.target.checked=false; return; } cfg.adult=true; cfg.adultAt=Date.now(); }
      else cfg.adult=false; saveCfg(); syncAdult(); const ab=el.querySelector('#adultBox'); if(ab) ab.style.display=cfg.adult?'block':'none'; };
    const renderNo=()=>{ const l=getLimits(); const box=el.querySelector('#sNoList'); if(!box) return; box.innerHTML=l.no.length? l.no.map((n,i)=>`<p class="note" style="display:flex;justify-content:space-between;align-items:center"><span>🚫 ${esc(n)}</span><button class="btn" data-no="${i}" style="width:auto;padding:4px 10px">✕</button></p>`).join('') : '<p class="note">Nada anotado todavía.</p>'; };
    renderNo();
    el.querySelector('#sNoList')?.addEventListener('click',e=>{ const b=e.target.closest('button[data-no]'); if(!b) return; const l=getLimits(); l.no.splice(+b.dataset.no,1); LS.set('bff_limits',l); renderNo(); });
    el.querySelector('#sNoBtn')?.addEventListener('click',()=>{ const inp=el.querySelector('#sNoAdd'); const v=(inp.value||'').trim(); if(!v) return; const l=getLimits(); if(!l.no.some(x=>x.toLowerCase()===v.toLowerCase())) l.no.push(v.slice(0,40)); LS.set('bff_limits',l); inp.value=''; renderNo(); });
    const si=el.querySelector('#sInt'); if(si) si.oninput=e=>{ const l=getLimits(); l.intensity=+e.target.value; LS.set('bff_limits',l); const n=el.querySelector('#sIntNote'); if(n) n.textContent=l.intensity+'/10 — juega justo al filo, sin pasarte'; };
    el.querySelector('#sMemBtn')?.addEventListener('click',()=>{ const ml=el.querySelector('#sMemList'); if(!ml) return; if(ml.style.display==='none'){ const ms=LS.get('bff_memories',[])||[]; ml.innerHTML=ms.length? ms.map(m=>`<p class="note">🗓️ ${new Date(m.t).toLocaleDateString('es-MX')}: ${esc(m.m)}</p>`).join('') : '<p class="note">Todavía no hay recuerdos. Cuando te diga que algo le encantó, lo guardo aquí.</p>'; ml.style.display='block'; } else ml.style.display='none'; });
    el.querySelector('#sMemDel')?.addEventListener('click',()=>{ if(!confirm('¿Borrar todas las memorias guardadas?')) return; LS.del('bff_memories'); const n=el.querySelector('#sMemNote'); if(n) n.textContent='0 recuerdos guardados.'; const ml=el.querySelector('#sMemList'); if(ml){ ml.style.display='none'; ml.innerHTML=''; } });
    el.querySelector('#sDev').onchange=e=>{ cfg.dev=e.target.checked; saveCfg(); el.querySelector('#devBox').style.display=cfg.dev?'block':'none'; };
    el.querySelector('#sPersona').onchange=e=>{ cfg.persona=e.target.value; saveCfg(); };
    const dl=el.querySelector('#sDl'); if(dl) dl.onclick=()=>{ dl.disabled=true; dl.textContent='Descargando…'; downloadVoice(p=>{ const i=el.querySelector('#sProg'); if(i) i.style.width=Math.round(p*100)+'%'; }).then(ok=>{ dl.textContent=ok?'✅ Lista':'❌ No se pudo, reintenta'; dl.disabled=ok; }); };
    const del=el.querySelector('#sDel'); if(del) del.onclick=async()=>{ if(!confirm('¿Borrar la voz natural descargada? Se puede volver a descargar después.')) return; del.disabled=true; del.textContent='Borrando…'; await V.clearPiperCache(); del.textContent='✅ Borrada'; const vn=el.querySelector('#vNote'); if(vn) vn.textContent='Voz borrada. Puedes volver a descargarla.'; };
    el.querySelector('#sReset').onclick=()=>{ if(!confirm('¿Seguro? '+cfg.name+' va a olvidar todo lo que platicaron.')) return;
      ['bff_hist','bff_profile','bff_ucount','bff_stats','bff_memories','bff_limits'].forEach(LS.del); hist=[]; userCount=0; cfg.adult=false; saveCfg(); syncAdult(); closeSheet(); render(); intro(); };
  });
}

const syncAdult=()=>document.body.classList.toggle('adult',!!cfg.adult);
$('#cname').textContent=cfg.name;
syncAdult();
const CAPTURE=/capture=1/.test(location.search);
if(CAPTURE){ document.body.classList.add('capture'); }
boot();
// para pruebas
function snap(){ her.phone=her.phoneT=0; camX=SPOTS.idle.cx; }
window.__bff={holdBlink:()=>{ nextBlink=-1; blinkT=0.075; },snap,talk:t=>{ say(t,5000); fakeTalkUntil=T+4; },her,P,send,look,setVoice,say,cam:()=>cam,setOutfit:async id=>{ await loadOutfit(id,true); look.outfit=id; saveLook(); }, T:()=>T, layout, open:v=>{ forceOpen=v; }, toScreen:(x,y)=>toScreen(x,y)};
