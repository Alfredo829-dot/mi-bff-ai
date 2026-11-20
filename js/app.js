import { Renderer, Puppet, loadImage } from './rig.js';
import { LS, BASE_PERSONA, profileText, guard, minorSignal, researchQuery, webSearch, complete, updateProfile, localProfile, hasGroq, cleanKey, PROVIDERS, provKey, listModels, provErrText, ADULT_RULES } from './ai.js';
import * as V from './voice.js';

const VERSION='1.4.0'; // única versión: también nombra la caché del service worker
const $=s=>document.querySelector(s);
const ROOM={w:1248,h:832};
// ---------- catálogo (agregar más outfits aquí; 'ready' = tiene poses y clips con el cuarto nuevo) ----------
const OUTFITS=[
  {id:'base',name:'Rosa coqueta'},
  {id:'jeans',name:'Casual jeans'},
  {id:'hoodie',name:'Street hoodie'},
];
let READY=['base','jeans','hoodie'];
const HAIR=[['castaño',null,'#6b3a2a'],['negro',[0.07,0.25,0.42],'#1b1414'],['rubio',[0.11,0.95,1.9],'#e2c06a'],['pelirroja',[0.015,1.5,1.08],'#b8361e'],['rosa',[0.93,1.2,1.75],'#f28cc0'],['morado',[0.78,1.1,1.15],'#7a3fb0'],['azul',[0.6,1.1,1.1],'#2f5fb8'],['plateado',[0.65,0.12,2.4],'#c9ccd6'],['verde',[0.42,0.9,1.05],'#2f8f6a']];
const EYES=[['café',null,'#7a4a33'],['azul',[0.58,1.2,1.2],'#3b7ddd'],['verde',[0.33,1.1,1.15],'#3ea65a'],['miel',[0.09,1.2,1.25],'#c98b2b'],['morado',[0.78,1.1,1.15],'#8c4fd1'],['rojo',[0.98,1.4,1.0],'#c3394b']];
const EARS=[['jade',null,'#4f9a6c'],['oro',[0.12,1.3,1.3],'#d4a72c'],['plata',[0.6,0.08,1.7],'#cfd3da'],['rosa',[0.93,1.1,1.35],'#ef7fb6'],['zafiro',[0.6,1.2,1.1],'#3060c8'],['rubí',[0.0,1.3,1.0],'#b8202f']];
// ---------- escena: cuarto fijo (cámara fija) y poses en su lugar exacto ----------
// cada lugar tiene su pose (y la variante con cel); los traslados son clips de video recortados con alfa
const SPOTS={ idle:{pose:'stand',phone:'phone',cx:646,top:64,foot:745}, bed:{pose:'bed',phone:'bedphone',cx:440,top:150,foot:690},
  desk:{pose:'desk',phone:null,cx:930,top:190,foot:690}, closet:{pose:'closet',phone:null,cx:625,top:84,foot:560} };
const HOT={bed:[20,250,520,600],closet:[430,80,830,330],pc:[790,200,1248,640]};
const CLIP_RECTS={"base-closet-idle":[502.4,43.6,786.9,828.6],"base-bed-idle":[284.5,34.4,786.9,828.6],"base-desk-idle":[497.8,41.3,1133.3,828.6],"base-idle-bed":[217.9,34.4,894.7,828.6],"base-idle-closet":[403.8,36.7,814.4,828.6],"base-idle-desk":[470.3,41.3,1153.9,828.6],"hoodie-closet-idle":[483.9,39.3,819.3,829.6],"hoodie-idle-closet":[400.2,41.0,825.7,828.0],"hoodie-bed-idle":[285.3,36.8,800.1,823.7],"hoodie-desk-idle":[488.9,38.9,1175.7,823.3],"jeans-closet-idle":[498.1,41.5,786.8,829.6],"jeans-bed-idle":[240.8,40.9,788.7,822.7],"hoodie-idle-desk":[468.7,41.1,1189.6,828.2],"jeans-desk-idle":[499.6,41.5,1189.6,826.9],"jeans-idle-closet":[475.4,38.7,783.8,826.8],"jeans-idle-bed":[300.1,38.6,788.1,826.9],"jeans-idle-desk":[484.7,43.3,1125.5,826.7],"hoodie-idle-bed":[293.3,38.7,814.4,827.9]};

// ---------- estado ----------
let cfg=Object.assign({name:'Vale',voice:'es_MX-claude-high',readAloud:false,dev:false,persona:''},LS.get('bff_cfg',{}));
let look=Object.assign({outfit:'base',hair:0,eye:0,ear:0},LS.get('bff_look',{}));
if(!READY.includes(look.outfit)) look.outfit='base';
if(!LS.get('bff_v2',false)){ look.eye=0; LS.set('bff_v2',true); }
let hist=LS.get('bff_hist',[]);
const saveCfg=()=>LS.set('bff_cfg',cfg), saveLook=()=>LS.set('bff_look',look), saveHist=()=>LS.set('bff_hist',hist.slice(-200));
const R=new Renderer($('#gl'));
let bgTex, pup={}, meta={};
const her={spot:'idle',mode:'stand',phone:0,phoneT:0,show:1,squash:1,hop:0,typingDesk:false,walking:false};
const P={breath:0,blink:0,headTilt:0,nod:0,headTurn:0,hip:0,lean:0,armL:0,armR:0,hairAmp:1,hairWind:0,typing:0,open:0};
const G={tilt:0,nod:0,armL:0,armR:0,turn:0}; let gestT=0;
let talking=false, fakeTalkUntil=0, herTyping=false, userTyping=0, voiceMode=false, busy=false, lastPoke=0;
let cam={k:1,cx:646,cy:416,ax:0,ay:0,aw:1,ah:1}, camX=SPOTS.idle.cx, camY=416, fadeFrom=null, fadeT=1;

// ---------- carga ----------
const prog=p=>{ $('#loader .lbar i').style.width=Math.round(p*100)+'%'; };
async function loadMeta(id){ if(!meta[id]) meta[id]=await fetch(`img2/poses-${id}.json`).then(r=>r.json()); return meta[id]; }
async function loadOutfit(id, all=false){
  const M=await loadMeta(id); const need=all? Object.keys(M) : ['stand','phone'];
  await Promise.all(need.map(async k=>{ const key=k+'-'+id; if(pup[key]||!M[k]) return;
    const [im,mk]=await Promise.all([loadImage(`img2/${key}.webp`),loadImage(`img2/${key}-m.png`)]);
    const L=M[k].L, desk=L.kind==='desk'; pup[key]=new Puppet(R,im,mk,L, desk?14:16, desk?20:40); pup[key].off=M[k].off; }));
}
async function boot(){
  try{
    prog(0.1); const bg=await loadImage('img2/cuarto.webp'); bgTex=R.texture(bg,true); prog(0.45);
    await loadOutfit(look.outfit); prog(1);
  }catch(e){ $('#loader .lname').textContent='No pude cargar 😢 recarga'; console.error(e); return; }
  layout(); requestAnimationFrame(frame);
  setTimeout(()=>{ $('#loader').classList.add('out'); if(!CAPTURE) intro(); },150);
  loadOutfit(look.outfit,true).catch(()=>{});
  if(!CAPTURE) setTimeout(()=>preloadClips(),2500);
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
}
function spotX(s){ return (SPOTS[s]||SPOTS.idle).cx; }
function updateCam(dt){
  const halfW=cam.aw/2/cam.k, halfH=cam.ah/2/cam.k;
  let tx=spotX(her.spot), top=SPOTS[her.spot]?.top??64;
  if(clip&&!clip.done&&clip.v.duration){ const k=Math.min(1,clip.v.currentTime/clip.v.duration), e=k*k*(3-2*k); tx=spotX(clip.a)+(spotX(clip.b)-spotX(clip.a))*e; top=Math.min(SPOTS[clip.a].top,SPOTS[clip.b].top); }
  camX+=(tx-camX)*Math.min(1,dt*(clip&&!clip.done?4.5:2.4));
  cam.cx=Math.min(Math.max(camX,halfW),ROOM.w-halfW); if(halfW*2>=ROOM.w) cam.cx=ROOM.w/2;
  const wantY=Math.max(halfH, top-26+halfH); camY+=(wantY-camY)*Math.min(1,dt*2.4);
  cam.cy=Math.min(Math.max(camY,halfH),ROOM.h-halfH); if(halfH*2>=ROOM.h) cam.cy=ROOM.h/2;
}
const toScreen=(X,Y)=>[(X-cam.cx)*cam.k+cam.ax+cam.aw/2,(Y-cam.cy)*cam.k+cam.ay+cam.ah/2];
const toRoom=(sx,sy)=>[(sx-cam.ax-cam.aw/2)/cam.k+cam.cx,(sy-cam.ay-cam.ah/2)/cam.k+cam.cy];
addEventListener('resize',()=>{ layout(); });
if(window.visualViewport) visualViewport.addEventListener('resize',()=>{ document.getElementById('app').style.height=visualViewport.height+'px'; layout(); });

// ---------- animación ----------
let last=performance.now(), T=0, nextBlink=/capture=1/.test(location.search)?1e9:1.5, blinkT=-1, dbl=false;
const lerp=(a,b,t)=>a+(b-a)*t;
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now; T+=dt;
  if(T>nextBlink&&blinkT<0){ blinkT=0; }
  if(blinkT>=0){ blinkT+=dt; const d=0.16; P.blink=blinkT<d/2? blinkT/(d/2) : Math.max(0,1-(blinkT-d/2)/(d/2)); if(blinkT>d){ blinkT=-1; P.blink=0; if(!dbl&&Math.random()<0.2){ dbl=true; nextBlink=T+0.12; } else { dbl=false; nextBlink=T+2+Math.random()*3.5; } } }
  P.breath=Math.sin(T*1.55)*(talking?1.2:1);
  const still=her.spot!=='idle'; // en cama/compu/clóset es un parche del cuadro: menos vaivén
  P.hip=(Math.sin(T*0.45)*2.6+Math.sin(T*0.17)*1.2)*(still?0.25:1); P.lean=-P.hip*0.0012;
  P.hairAmp=0.7; P.hairWind=0;
  const isTalk=talking||T<fakeTalkUntil;
  gestT-=dt; if(gestT<=0){ gestT=0.45+Math.random()*0.7;
    if(isTalk){ G.tilt=(Math.random()-.5)*0.09; G.nod=Math.random()<0.5?0.8:0; G.armL=(Math.random()-.5)*0.06; G.armR=(Math.random()-.5)*0.06; G.turn=(Math.random()-.5)*0.5; }
    else { G.tilt=(Math.random()-.5)*0.04; G.nod=0; G.armL=0; G.armR=0; G.turn=(Math.random()-.5)*0.2; } }
  const ph=her.phone;
  const tiltT=G.tilt+Math.sin(T*0.6)*0.02+Math.sin(T*1.7)*0.008 + her.hop*0.05;
  P.headTilt=lerp(P.headTilt,tiltT,dt*3); P.nod=lerp(P.nod,(isTalk?G.nod*Math.max(0,Math.sin(T*7)):0)+ph*0.4,dt*6); P.headTurn=lerp(P.headTurn,G.turn*0.6,dt*2.5);
  P.armL=lerp(P.armL,G.armL+Math.sin(T*0.9)*0.01,dt*3); P.armR=lerp(P.armR,G.armR-Math.sin(T*0.8)*0.01,dt*3);
  let open=0; if(talking) open=V.audioLevel(); else if(T<fakeTalkUntil) open=Math.max(0,Math.sin(T*15)*0.5+Math.sin(T*23)*0.3+0.15);
  P.open=lerp(P.open,Math.min(1,open),dt*18);
  const hasPhone=!!SPOTS[her.spot]?.phone;
  her.phoneT = hasPhone && !voiceMode && !moving_now && ((herTyping||userTyping>T||busy) || her.phoneHold>T) ? 1 : 0;
  her.phone=lerp(her.phone,her.phoneT,dt*5); if(Math.abs(her.phone-her.phoneT)<0.01) her.phone=her.phoneT;
  P.typing=lerp(P.typing,(herTyping&&her.phone>0.6)||(her.spot==='desk'&&her.typingDesk)?1:0,dt*6);
  her.hop=Math.max(0,her.hop-dt*2.2); her.squash=lerp(her.squash,1,dt*6);
  fadeT=Math.min(1,fadeT+dt*2.5);
  updateCam(dt);
  draw();
  placeBubble();
  requestAnimationFrame(frame);
}
function lookUniforms(){ return { hair:HAIR[look.hair][1], eye:EYES[look.eye][1], ear:EARS[look.ear][1], tint:[1,1,1] }; }
function drawSpot(spot,alpha,lu){
  const S=SPOTS[spot]; if(!S||alpha<=0.003) return;
  const a=pup[S.pose+'-'+look.outfit], b=S.phone&&pup[S.phone+'-'+look.outfit]; if(!a) return;
  const f=b?her.phone:0;
  const place=p=>{ const L=p.L, desk=L.kind==='desk'; const hop=spot==='idle'? -Math.sin(her.hop*Math.PI)*8*(her.hop>0?1:0):0;
    return desk? {x:p.off[0],y:p.off[1],s:1} : {x:p.off[0]+L.cx,y:p.off[1]+L.footY+hop,s:1,sx:spot==='idle'?her.squash:1}; };
  if(spot==='idle'){ R.drawShadow(a.off[0]+a.L.cx,a.off[1]+a.L.footY-2,150,22,cam,alpha*0.8); } // sombra en los pies reales de cada atuendo
  if(f<0.999) a.draw(P,T,place(a),cam,alpha,lu);
  if(b&&f>0.001) b.draw(P,T,place(b),cam,alpha*f,lu);
}
function draw(){
  R.clear(); const glow= her.spot==='desk'&&her.typingDesk? [0.75,0.33,0.10+0.01*Math.sin(T*20),0.09] : null;
  if(cam.fit) R.drawBg(bgTex,ROOM.w,ROOM.h,{...cam,k:cam.cover,cx:ROOM.w/2,cy:ROOM.h/2},0.32,null);
  R.drawBg(bgTex,ROOM.w,ROOM.h,cam,1,glow);
  const lu=lookUniforms();
  const vidOn = clip&&!clip.done&&clip.alpha>0;
  // sin doble transparencia: la pose queda sólida debajo mientras el video entra/sale, y se oculta cuando el video está completo
  const pupA = vidOn && !clip.ending && clip.alpha>=1 ? 0 : 1;
  if(pupA>0.003){
    if(fadeFrom&&fadeT<1){ drawSpot(fadeFrom,pupA*(1-fadeT),lu); drawSpot(her.spot,pupA*fadeT,lu); }
    else drawSpot(her.spot,pupA,lu);
  }
  if(clip&&!clip.done){ const v=clip.v; if(v.readyState>=2 && R.updateVideo(clip.tex,v)){ clip.ready=true; } if(clip.ready){ clip.alpha=clip.ending? Math.max(0,clip.alpha-0.12) : Math.min(1,clip.alpha+0.34); R.drawVideo(clip.tex,clip.rect,cam,clip.alpha); } }
}

// ---------- traslados: clips de video con alfa (color arriba, alfa abajo) sobre el cuarto fijo ----------
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clipURL={}; let clip=null, moving=Promise.resolve(), moving_now=false;
function clipKey(a,b,o=look.outfit){ return `${o}-${a}-${b}`; }
async function fetchClip(k){ if(!CLIP_RECTS[k]) return null; if(clipURL[k]) return clipURL[k];
  clipURL[k]=fetch(`clips2/${k}.mp4`).then(r=>{ if(!r.ok) throw 0; return r.blob(); }).then(b=>URL.createObjectURL(b)).catch(()=>{ delete clipURL[k]; return null; });
  return clipURL[k]; }
function preloadClips(o=look.outfit){ const ks=[]; for(const s of ['desk','bed','closet']) ks.push(clipKey('idle',s,o),clipKey(s,'idle',o));
  ks.reduce((p,k)=>p.then(()=>fetchClip(k)),Promise.resolve()); }
async function playClip(a,b){
  const k=clipKey(a,b); const url=await Promise.race([fetchClip(k), sleep(7000).then(()=>null)]); if(!url) return false;
  const v=document.createElement('video'); v.muted=true; v.playsInline=true; v.setAttribute('playsinline',''); v.setAttribute('muted',''); v.preload='auto'; v.src=url;
  try{ await new Promise((res,rej)=>{ v.oncanplay=res; v.onerror=rej; setTimeout(rej,7000); }); await v.play(); }catch(e){ return false; }
  const tex=clip?.tex||R.videoTexture();
  clip={v,tex,alpha:0,a,b,rect:CLIP_RECTS[k],ending:false,ready:false};
  her.phone=her.phoneT=0;
  await new Promise(res=>{ v.onended=res; setTimeout(res,(v.duration||6)*1000+1500); });
  her.spot=b; her.mode=b==='desk'?'desk':b==='bed'?'sit':'stand'; fadeFrom=null; fadeT=1;
  clip.ending=true; await sleep(260); clip.v.pause(); clip.alpha=0; clip.done=true; return true;
}
function crossTo(b){ fadeFrom=her.spot; fadeT=0; her.spot=b; her.mode=b==='desk'?'desk':b==='bed'?'sit':'stand'; return sleep(450); }
function stateSpot(){ return her.spot; }
function goSpot(name){ moving=moving.then(()=>_goSpot(name)).catch(()=>{}); return moving; }
async function _goSpot(name){
  const from=her.spot; if(from===name) return;
  moving_now=true; her.typingDesk=false;
  try{
    await loadOutfit(look.outfit,true).catch(()=>{});
    const legs=(from!=='idle'&&name!=='idle')? [[from,'idle'],['idle',name]] : [[from,name]];
    for(const [a,b] of legs){ if(!(await playClip(a,b))) await crossTo(b); }
  } finally { moving_now=false; }
}
async function goDesk(){ if(her.spot==='desk') return; await goSpot('desk'); }
async function leaveDesk(){ if(her.spot!=='desk') return; her.typingDesk=false; await goSpot('idle'); }

// ---------- burbuja sobre su cabeza ----------
let bubbleUntil=0;
function say(text,ms){ const b=$('#bubble'); b.textContent=text; b.classList.remove('hide'); bubbleUntil=performance.now()+(ms||Math.min(9000,1800+text.length*55)); }
function placeBubble(){
  const b=$('#bubble'); if(performance.now()>bubbleUntil){ b.classList.add('hide'); return; }
  const S=SPOTS[her.spot]||SPOTS.idle; let X=S.cx, Y=S.top-14;
  let [sx,sy]=toScreen(X,Y); if(sy<78){ const [rx]=toScreen(S.cx+150,0); sx=rx; sy=78; } b.style.left=Math.max(cam.ax+90,Math.min(cam.ax+cam.aw-90,sx))+'px'; b.style.top=Math.max(70,sy)+'px';
}

// ---------- chat UI ----------
const hhmm=ts=>new Date(ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
function esc(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function bubbleEl(m){
  const d=document.createElement('div'); d.className='m '+(m.role==='user'?'me':m.role==='sys'?'sys':'her');
  d.innerHTML=esc(m.content).replace(/(https?:\/\/[^\s)]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  if(m.links&&m.links.length){ const s=document.createElement('div'); s.className='src'; for(const l of m.links){ const a=document.createElement('a'); a.href=l.url; a.target='_blank'; a.rel='noopener'; a.textContent='🔗 '+l.title; s.appendChild(a);} d.appendChild(s); }
  if(m.role!=='sys'){ const meta=document.createElement('span'); meta.className='meta'; meta.innerHTML=(m.role==='assistant'&&m.via?`<span class="via ${m.via==='respaldo'?'respaldo':'key'}">${PROVIDERS[m.via]?'⚡ '+PROVIDERS[m.via].name:'respaldo'}</span> `:'')+hhmm(m.ts)+(m.role==='user'?`<span class="tick ${m.read?'read':''}">✓✓</span>`:''); d.appendChild(meta); }
  m._el=d; return d;
}
function render(){ const box=$('#msgs'); box.innerHTML=''; for(const m of hist.slice(-60)) box.appendChild(bubbleEl(m)); box.scrollTop=box.scrollHeight; }
function push(m){ m.ts=m.ts||Date.now(); hist.push(m); if(m.role!=='sys') saveHist(); const box=$('#msgs'); const t=box.querySelector('.typing'); const el=bubbleEl(m); el.classList.add('new'); box.insertBefore(el,t); requestAnimationFrame(()=>box.scrollTop=box.scrollHeight); return m; }
function setTyping(on){ herTyping=on; const box=$('#msgs'); let t=box.querySelector('.typing'); $('#cstatus').textContent=on?'escribiendo…':'en línea';
  if(on&&!t){ t=document.createElement('div'); t.className='typing'; t.innerHTML='<i></i><i></i><i></i>'; box.appendChild(t); box.scrollTop=box.scrollHeight; }
  if(!on&&t) t.remove(); }
function markRead(){ for(const m of hist) if(m.role==='user'&&!m.read){ m.read=true; m._el&&m._el.querySelector('.tick')?.classList.add('read'); } saveHist(); }

// ---------- conversación ----------
function systemPrompt(extra=''){
  const persona=(cfg.dev&&cfg.persona.trim())? cfg.persona : BASE_PERSONA(cfg.name);
  const now=new Date(); const where={idle:'parada en tu cuarto',bed:'echada en tu cama',closet:'frente a tu clóset',desk:'en tu compu'}[her.spot]||'en tu cuarto';
  const ctx=`\nAhora: ${now.toLocaleString('es-MX',{weekday:'long',hour:'2-digit',minute:'2-digit'})}. Estás ${where}, vestida con tu outfit "${OUTFITS.find(o=>o.id===look.outfit).name}".`+
    (voiceMode? ' Están platicando EN PERSONA, frente a frente: habla natural para decirse en voz alta, sin emojis ni links.' : ' Están platicando por WhatsApp desde tu cel: escribe como mensaje de WhatsApp.');
  return persona+(cfg.adult?ADULT_RULES(cfg.name):'')+ctx+profileText(LS.get('bff_profile',{}))+extra;
}
function chatMsgs(extra){ const h=hist.filter(m=>m.role==='user'||m.role==='assistant').slice(-16).map(m=>({role:m.role,content:m.content}));
  return [{role:'system',content:systemPrompt(extra)},...h]; }
let userCount=LS.get('bff_ucount',0);
async function reply(m){
  // muestra respuesta, voz, gestos
  const msg=push({role:'assistant',content:m.text,links:m.links,via:m.via});
  her.hop=0.6; 
  if(voiceMode||cfg.readAloud) await speakLine(m.text); else { her.phoneHold=T+6; }
  return msg;
}
async function speakLine(text){
  say(text.length>160? text.slice(0,157)+'…':text);
  if(cfg.voice==='none'){ fakeTalkUntil=T+Math.min(10,1+text.length*0.055); return; }
  ear&&ear.pause(); talking=true;
  try{ await V.speak(text,cfg.voice,kind=>{ if(kind==='system'&&!warnedSys){ warnedSys=true; push({role:'sys',content:'Uso la voz del sistema porque la natural no cargó (suena más robótica). Revisa ⚙ → Voz.'}); } }); }
  catch{ fakeTalkUntil=T+Math.min(10,1+text.length*0.055); }
  talking=false; if(voiceMode) ear&&ear.resume();
}
let warnedSys=false;
let pending=false, limitWarned=false;
async function send(text){
  text=text.trim(); if(!text) return; V.unlockAudio();
  push({role:'user',content:text}); userCount++; LS.set('bff_ucount',userCount); localProfile(text);
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
async function askAI(msgs){
  for(let i=0;i<4;i++){
    try{ const r=await complete(msgs,{adult:!!cfg.adult}); warnErrs(r.errs); if(r.refused) return {text:pick(DEFLECT),via:r.via}; return r; }
    catch(e){ warnErrs(e.errs); if(e.wait){ if(!limitWarned){ limitWarned=true; push({role:'sys',content:`La IA gratis sin llave deja ~1 respuesta cada ${e.wait||45} s, por eso tardo. ${hasGroq()?'':'Con una llave gratis (⚙) contesto al instante.'}`}); }
        await sleep((Math.min(60,e.wait||45)+1)*1000); continue; }
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
  await sleep(350); markRead(); setTyping(true); const t0=performance.now();
  const r=await askAI(chatMsgs());
  const min=Math.min(2600,600+r.text.length*14); const left=min-(performance.now()-t0); if(left>0) await sleep(left);
  setTyping(false); await reply(r);
}
const pick=a=>a[Math.floor(Math.random()*a.length)];
async function research(q,orig){
  markRead(); const ack=pick([`Va, déjame lo investigo en la compu 💻`,`Órale, ahorita lo busco, aguanta 🔎`,`Sale, voy a la compu a checar eso 👀`]);
  push({role:'assistant',content:ack}); if(voiceMode||cfg.readAloud) speakLine(ack); else say(ack,2200);
  const prevSpot=her.spot==='desk'?'idle':her.spot;
  const [_,found]=await Promise.all([goDesk(), webSearch(q).catch(()=>[])]);
  her.typingDesk=true; setTyping(true);
  const src=found.map((r,i)=>`[${i+1}] ${r.title}: ${r.text.slice(0,700)}`).join('\n\n');
  const extra = src? `\n\nACABAS DE INVESTIGAR en tu compu sobre "${q}". Resultados:\n${src}\n\nCuéntale lo que encontraste en 2 a 4 frases, en tu estilo, con datos concretos de los resultados (no inventes nada que no esté ahí). No pegues links, yo los pongo abajo.`
    : `\n\nIntentaste investigar "${q}" en internet pero no salió nada. Díselo en tu estilo y comparte lo que sepas si estás segura, aclarando que no lo checaste.`;
  let r=await askAI(chatMsgs(extra)); if(/se me trabó|se me fue el internet/.test(r.text)&&found.length) r={text:`Mira, encontré esto: ${found[0].text.slice(0,260)}…`};
  await sleep(900); setTyping(false); her.typingDesk=false;
  r.links=found.map(f=>({title:f.title,url:f.url}));
  const done=reply(r); await sleep(1600); goSpot(prevSpot); await done;
}

// ---------- intro ----------
function intro(){
  const first=!hist.length; const p=LS.get('bff_profile',{}); const nom=p.apodo||p.nombre;
  her.hop=1; her.squash=0.92;
  const line= first? `¡Quiubo! 👋 Por fin alguien que me pela. Soy ${cfg.name}, tu nueva BFF. ¿Qué onda contigo, qué tal tu día? Cuéntame el chisme 😏`
    : pick([`¡Ya volviste${nom?', '+nom:''}! 🙌 Te extrañé, ¿eh? ¿Qué me cuentas?`,`¡Eyyy${nom?' '+nom:''}! 😏 ¿Qué milagro? Échame el chisme.`,`Mira nomás quién regresó${nom?', '+nom:''} 😂 ¿Qué traes?`]);
  render(); say(first?'¡Quiubo! 👋':'¡Eyyy! 👋',2600);
  setTimeout(()=>{ setTyping(true); },400);
  setTimeout(()=>{ setTyping(false); push({role:'assistant',content:line}); fakeTalkUntil=T+0.8; if(first) showHints(); },1300);
}
function showHints(){
  const h=$('#hints'); h.innerHTML=''; const items=[['bed','🛏️ Cama',230,330],['closet','👗 Clóset',500,150],['pc','💻 Compu',1000,270]];
  const els=items.map(([k,l,x,y])=>{ const s=document.createElement('span'); s.textContent=l; h.appendChild(s); return [s,x,y]; });
  const upd=()=>{ const x0=cam.ax+52, x1=cam.ax+cam.aw-52; for(const [s,x,y] of els){ let [sx,sy]=toScreen(x,y); const l0=s.dataset.l||(s.dataset.l=s.textContent);
      // fuera de cuadro: se pega al borde con flechita en vez de desaparecer
      if(sx<x0){ s.textContent='← '+l0; sx=x0; } else if(sx>x1){ s.textContent=l0+' →'; sx=x1; } else s.textContent=l0;
      sy=Math.min(Math.max(sy,cam.ay+70),cam.ay+cam.ah-30); s.style.left=sx+'px'; s.style.top=sy+'px'; } };
  const iv=setInterval(upd,100); upd(); setTimeout(()=>{ els.forEach(([s])=>s.style.opacity=0); setTimeout(()=>{ clearInterval(iv); h.innerHTML=''; },700); },6500);
}

// ---------- toques en el cuarto ----------
$('#gl').addEventListener('click',e=>{
  V.unlockAudio(); if(busy&&her.mode==='desk') return;
  const [X,Y]=toRoom(e.clientX,e.clientY);
  // ¿la tocó a ella?
  const S=SPOTS[her.spot]; const pz=pup[S.pose+'-'+look.outfit];
  if(pz&&!(clip&&!clip.done)){ const [x0,y0]=pz.off; if(X>x0+20&&X<x0+pz.w-20&&Y>y0&&Y<(pz.h?y0+pz.h:S.foot)) return poke(); }
  const inR=(r)=>X>=r[0]&&X<=r[2]&&Y>=r[1]&&Y<=r[3];
  if(inR(HOT.pc)){ if(busy) return; $('#txt').value='Investiga '; $('#txt').focus(); say('¿Qué investigo? 🤓',2500); goDesk(); return; }
  if(inR(HOT.bed)){ if(her.spot==='bed'){ say(pick(['Aquí estoy bien echadita 😌','¿Qué, te vienes a echar el chisme? 😂']),2200); return; } goSpot('bed').then(()=>say(pick(['Ahh, qué rica camita 😌','Me echo tantito, ¿va?']),2200)); return; }
  if(inR(HOT.closet)) return openCloset(true);
  if(Y>560 && her.spot!=='idle' && !busy) goSpot('idle');
});
function poke(){ const t=performance.now(); if(t-lastPoke<800) return; lastPoke=t; her.hop=1; her.squash=0.94; G.tilt=(Math.random()-.5)*0.2;
  const l=pick(['¡Ay, qué! 😂','¿Qué me ves? 😏','Jajaja no me piques 🙈','¿Mande? 👀','Oye, respeta 😤 jaja']); say(l,1800); fakeTalkUntil=T+0.9; }

// ---------- barra de texto / mic ----------
const txt=$('#txt');
txt.addEventListener('input',()=>{ txt.style.height='auto'; txt.style.height=Math.min(120,txt.scrollHeight)+'px'; userTyping=T+2.5; layout(); });
txt.addEventListener('focus',()=>{ userTyping=T+3; });
txt.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); $('#bar').requestSubmit(); } });
$('#bar').addEventListener('submit',e=>{ e.preventDefault(); const v=txt.value; txt.value=''; txt.style.height='auto'; send(v); });
let ear=null;
$('#mic').addEventListener('click',async()=>{
  V.unlockAudio();
  if(!voiceMode){
    ear=ear||new V.Ear(t=>{ if(!talking) send(t); },t=>{ txt.placeholder='🎙️ '+t; });
    if(!ear.ok){ push({role:'sys',content:'Tu navegador no deja usar el micrófono aquí. Prueba en Chrome.'}); return; }
    ear.onDenied=()=>{ push({role:'sys',content:'No me diste permiso del micrófono 😢 Actívalo en el candadito de la barra de direcciones.'}); setVoice(false); };
    setVoice(true); ear.start();
    if(cfg.voice==='es_MX-claude-high' && !(await V.piperReady())) downloadVoice();
  } else { setVoice(false); ear&&ear.stop(); V.stop(); }
});
function setVoice(on){ voiceMode=on; document.body.classList.toggle('voice-mode',on); document.body.classList.toggle('text-mode',!on); $('#mic').classList.toggle('on',on); txt.placeholder=on?'Te escucho… (o escribe)':'Escríbele…'; layout();
  if(on) say(pick(['¡A ver, platícame! 👂','Te escucho, wey 😊']),2000); }
let dlP=null;
function downloadVoice(onp){
  if(dlP) return dlP; const m=push({role:'sys',content:'Bajando mi voz natural (una sola vez, ~63 MB)… 0%'});
  dlP=V.preparePiper(p=>{ const t=`Bajando mi voz natural (una sola vez, ~63 MB)… ${Math.round(p*100)}%`; m.content=t; if(m._el) m._el.firstChild.textContent=t; onp&&onp(p); })
    .then(()=>{ m.content='¡Listo! Ya tengo mi voz 🎙️'; if(m._el) m._el.firstChild.textContent=m.content; })
    .catch(e=>{ dlP=null; m.content='No pude bajar la voz natural (¿sin internet?). Mientras, uso la del sistema.'; if(m._el) m._el.firstChild.textContent=m.content; });
  return dlP;
}

// ---------- hojas ----------
function sheet(title,html,onMount){ $('#shTitle').textContent=title; $('#shBody').innerHTML=html; $('#sheet').classList.remove('hide'); onMount&&onMount($('#shBody')); }
function closeSheet(){ $('#sheet').classList.add('hide'); }
$('#sheet').addEventListener('click',e=>{ if(e.target.id==='sheet'||e.target.hasAttribute('data-close')) closeSheet(); });

async function openCloset(walk){
  if(walk&&!busy){ goSpot('closet').then(()=>say(pick(['¿Qué me pongo? 👗','A ver, escógeme algo chido 😏']),2200)); }
  let tab='ropa';
  const html=()=>`<div class="tabs">${[['ropa','👗 Ropa'],['pelo','💇 Cabello'],['ojos','👁️ Ojos'],['aretes','💎 Aretes']].map(([k,l])=>`<button data-tab="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')}</div>
   ${tab==='ropa'? `<div class="grid">${OUTFITS.filter(o=>READY.includes(o.id)).map(o=>`<button class="card ${look.outfit===o.id?'on':''}" data-outfit="${o.id}"><img src="img2/stand-${o.id}.webp" loading="lazy" alt="">${o.name}</button>`).join('')}</div><p class="note">${READY.length<OUTFITS.length?'Estoy estrenando cuarto: los otros outfits llegan en cuanto estén listos sus videos.':'Pronto: más outfits y “Diseñar con IA”.'}</p>`:''}
   ${tab==='pelo'? sw(HAIR,'hair'):''}${tab==='ojos'? sw(EYES,'eye'):''}${tab==='aretes'? sw(EARS,'ear'):''}`;
  const sw=(arr,key)=>`<div class="sw">${arr.map((c,i)=>`<button style="background:${c[2]}" class="${look[key]===i?'on':''}" data-k="${key}" data-i="${i}">${c[0]}</button>`).join('')}</div><p class="note">El color se aplica sobre su dibujo; en orillas finas puede verse algún detalle.</p>`;
  sheet('Clóset de '+cfg.name, html(), el=>{
    el.onclick=async e=>{ const b=e.target.closest('button'); if(!b) return;
      if(b.dataset.tab){ tab=b.dataset.tab; el.innerHTML=html(); return; }
      if(b.dataset.outfit){ const id=b.dataset.outfit; if(id===look.outfit) return; b.style.opacity=.5;
        await loadOutfit(id, true); her.squash=0.05; await sleep(140); look.outfit=id; saveLook(); her.hop=0.7; el.innerHTML=html();
        say(pick(['¿Cómo me veo? 😏','¡Ay, me encanta! ✨','Uff, qué chula 💅']),2000); loadOutfit(id,true).catch(()=>{}); preloadClips(id); return; }
      if(b.dataset.k){ look[b.dataset.k]=+b.dataset.i; saveLook(); el.innerHTML=html(); her.hop=0.4; }
    };
  });
}

$('#gear').addEventListener('click',openSettings);
async function openSettings(){
  const ready=await V.piperReady();
  sheet('Ajustes',`
   <div class="row"><label>Nombre de tu BFF</label><input type="text" id="sName" maxlength="20" value="${esc(cfg.name)}"></div>
   <div class="row"><label>Voz</label><select id="sVoice">${V.VOICES.map(v=>`<option value="${v.id}" ${cfg.voice===v.id?'selected':''}>${v.name}</option>`).join('')}<option value="none" ${cfg.voice==='none'?'selected':''}>Sin voz</option></select>
     <p class="note" id="vNote">${ready?'✅ Voz natural ya descargada (funciona sin internet).':'La voz natural se descarga una vez (~63 MB) y luego funciona sin internet.'}</p>
     ${ready?'':'<button class="btn" id="sDl">⬇️ Descargar voz natural</button><div class="prog"><i id="sProg"></i></div>'}</div>
   <div class="row sw-row"><label style="margin:0">Leer en voz alta también en modo texto</label><input type="checkbox" id="sRead" ${cfg.readAloud?'checked':''}></div>
   <div class="row sw-row"><label style="margin:0">🔞 Modo +18 (solo texto)</label><input type="checkbox" id="sAdult" ${cfg.adult?'checked':''}></div>
   <p class="note" style="margin-top:-6px">Plática coqueta/subida de tono entre adultos, solo texto. Su ropa, poses y animaciones no cambian. Apagado por defecto.</p>
   <div class="row"><label>Llaves de IA (opcionales, gratis, se guardan solo en este cel)</label>
   ${Object.entries(PROVIDERS).map(([id,P])=>`<div class="kb"><span class="kn">${P.name}</span><input type="password" data-prov="${id}" placeholder="${P.hint}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${provKey(id)?'••••••••':''}"><p class="note" id="kst-${id}">${provKey(id)?'Probando…':''}</p></div>`).join('')}
   <p class="note">Sin llaves uso un servicio gratis sin registro (más lento y se niega más en +18). Llaves gratis sin tarjeta: console.groq.com y aistudio.google.com (Gemini). Mistral y Cerebras ya piden pago, por eso no están.</p></div>
   <div class="row"><button class="btn red" id="sReset">🔄 Reiniciar amistad</button><p class="note">Borra la plática y lo que ${esc(cfg.name)} sabe de ti. Todo se guarda solo en este dispositivo.</p></div>
   <div class="row sw-row"><label style="margin:0">Modo desarrollador</label><input type="checkbox" id="sDev" ${cfg.dev?'checked':''}></div>
   <div class="row" id="devBox" style="display:${cfg.dev?'block':'none'}"><label>Personalidad (solo dev)</label><textarea id="sPersona" placeholder="Vacío = personalidad normal">${esc(cfg.persona||'')}</textarea></div>
   <button class="btn pink" data-close>Listo</button><p class="note" style="text-align:center">Mi BFF AI v${VERSION}</p>`, el=>{
    el.querySelector('#sName').onchange=e=>{ cfg.name=e.target.value.trim()||'Vale'; saveCfg(); $('#cname').textContent=cfg.name; };
    el.querySelector('#sVoice').onchange=e=>{ cfg.voice=e.target.value; saveCfg(); };
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
      else cfg.adult=false; saveCfg(); };
    el.querySelector('#sDev').onchange=e=>{ cfg.dev=e.target.checked; saveCfg(); el.querySelector('#devBox').style.display=cfg.dev?'block':'none'; };
    el.querySelector('#sPersona').onchange=e=>{ cfg.persona=e.target.value; saveCfg(); };
    const dl=el.querySelector('#sDl'); if(dl) dl.onclick=()=>{ dl.disabled=true; dl.textContent='Descargando…'; downloadVoice(p=>{ const i=el.querySelector('#sProg'); if(i) i.style.width=Math.round(p*100)+'%'; }).then(()=>{ dl.textContent='✅ Lista'; }); };
    el.querySelector('#sReset').onclick=()=>{ if(!confirm('¿Seguro? '+cfg.name+' va a olvidar todo lo que platicaron.')) return;
      ['bff_hist','bff_profile','bff_ucount'].forEach(LS.del); hist=[]; userCount=0; closeSheet(); render(); intro(); };
  });
}

$('#cname').textContent=cfg.name;
const CAPTURE=/capture=1/.test(location.search);
if(CAPTURE){ document.body.classList.add('capture'); }
boot();
// para pruebas
function snap(spot){ her.spot=spot; her.mode=spot==='bed'?'sit':spot==='desk'?'desk':'stand'; her.phone=her.phoneT=0; fadeFrom=null; fadeT=1; camX=spotX(spot); }
window.__bff={holdBlink:()=>{ nextBlink=-1; blinkT=0.075; },clipState:()=>clip&&{a:clip.a,b:clip.b,t:clip.v.currentTime,done:!!clip.done,alpha:clip.alpha,ready:clip.ready},snap,talk:t=>{ say(t,5000); fakeTalkUntil=T+4; },her,P,send,goSpot,goDesk,leaveDesk,openCloset,look,setVoice,say,cam:()=>cam,setOutfit:async id=>{ await loadOutfit(id,true); look.outfit=id; saveLook(); }, T:()=>T, layout};
