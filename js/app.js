import { Renderer, Puppet, loadImage } from './rig.js';
import { LS, BASE_PERSONA, profileText, guard, researchQuery, webSearch, complete, updateProfile } from './ai.js';
import * as V from './voice.js';

const VERSION='1.0.0';
const $=s=>document.querySelector(s);
const ROOM={w:1168,h:784};
// ---------- catálogo (agregar más outfits aquí) ----------
const OUTFITS=[
  {id:'base',name:'Rosa coqueta'},
  {id:'jeans',name:'Casual jeans'},
  {id:'pijama',name:'Pijama'},
  {id:'hoodie',name:'Street hoodie'},
];
const HAIR=[['castaño',null,'#6b3a2a'],['negro',[0.07,0.25,0.42],'#1b1414'],['rubio',[0.11,0.95,1.9],'#e2c06a'],['pelirroja',[0.015,1.5,1.08],'#b8361e'],['rosa',[0.93,1.2,1.75],'#f28cc0'],['morado',[0.78,1.1,1.15],'#7a3fb0'],['azul',[0.6,1.1,1.1],'#2f5fb8'],['plateado',[0.65,0.12,2.4],'#c9ccd6'],['verde',[0.42,0.9,1.05],'#2f8f6a']];
const EYES=[['rojo',null,'#c3394b'],['azul',[0.58,1.2,1.2],'#3b7ddd'],['verde',[0.33,1.1,1.15],'#3ea65a'],['miel',[0.09,1.2,1.25],'#c98b2b'],['morado',[0.78,1.1,1.15],'#8c4fd1'],['gris',[0.6,0.18,1.3],'#8a909c']];
const EARS=[['jade',null,'#4f9a6c'],['oro',[0.12,1.3,1.3],'#d4a72c'],['plata',[0.6,0.08,1.7],'#cfd3da'],['rosa',[0.93,1.1,1.35],'#ef7fb6'],['zafiro',[0.6,1.2,1.1],'#3060c8'],['rubí',[0.0,1.3,1.0],'#b8202f']];
// ---------- landmarks (px dentro de cada imagen) ----------
const L_STAND={kind:'body',cx:262,neckY:245,shoulderY:290,waistY:480,legTop:650,kneeY:917,footY:1228,armL:[140,188],armR:[342,388],handY:715,
  eyes:[[241,137],[298,154]],eyeR:[15,10],eyeAng:0.29,mouth:[262,191],mouthW:16,cheek:[230,160]};
const L_PHONE={...L_STAND,armL:null,armR:null,thumbs:[318,330],eyes:[[241,137],[294,153]],mouth:[261,189]};
const L_DESK={kind:'desk',neckY:189,neck:[243,189],headX0:150,hands:[418,424]};
const SPOT={idle:{x:600,y:648},bed:{x:300,y:600},closet:{x:650,y:528},desk:{x:770,y:612}};
const DESK_PLACE={x:792,y:223,s:0.435};
const HOT={bed:[0,300,425,620],closet:[525,103,776,470],pc:[787,240,1168,640]};
const scaleAt=y=>0.29*(y-300)/(640-300);

// ---------- estado ----------
let cfg=Object.assign({name:'Vale',voice:'es_MX-claude-high',readAloud:false,dev:false,persona:''},LS.get('bff_cfg',{}));
let look=Object.assign({outfit:'base',hair:0,eye:0,ear:0},LS.get('bff_look',{}));
let hist=LS.get('bff_hist',[]);
const saveCfg=()=>LS.set('bff_cfg',cfg), saveLook=()=>LS.set('bff_look',look), saveHist=()=>LS.set('bff_hist',hist.slice(-200));
const R=new Renderer($('#gl'));
const tex={}; let bgTex, pup={};
const her={x:SPOT.idle.x,y:SPOT.idle.y,spot:'idle',mode:'stand',sit:0,sitT:0,phone:0,phoneT:0,desk:0,deskT:0,walking:false,dir:1,squash:1,hop:0};
const P={breath:0,blink:0,headTilt:0,nod:0,headTurn:0,hip:0,lean:0,armL:0,armR:0,hairAmp:1,hairWind:0,walk:0,walkPhase:0,sit:0,typing:0,open:0};
const G={tilt:0,nod:0,armL:0,armR:0,turn:0}; let gestT=0;
let talking=false, fakeTalkUntil=0, herTyping=false, userTyping=0, voiceMode=false, busy=false, lastPoke=0;
let cam={k:1,cx:600,cy:470,ax:0,ay:0,aw:1,ah:1}, camX=SPOT.idle.x;

// ---------- carga ----------
const prog=p=>{ $('#loader .lbar i').style.width=Math.round(p*100)+'%'; };
async function loadOutfit(id, withDesk=false){
  const need=[['stand',L_STAND],['phone',L_PHONE]]; if(withDesk) need.push(['desk',L_DESK]);
  for(const [k,L] of need){ const key=k+'-'+id; if(pup[key]) continue;
    const [im,mk]=await Promise.all([loadImage(`img/${key}.webp`),loadImage(`img/${key}-m.png`)]); pup[key]=new Puppet(R,im,mk,L, k==='desk'?14:18, k==='desk'?20:44); }
}
async function boot(){
  try{
    prog(0.1); const bg=await loadImage('img/cuarto.webp'); bgTex=R.texture(bg,true); prog(0.45);
    await loadOutfit(look.outfit); prog(1);
  }catch(e){ $('#loader .lname').textContent='No pude cargar 😢 recarga'; console.error(e); return; }
  layout(); requestAnimationFrame(frame);
  setTimeout(()=>{ $('#loader').classList.add('out'); intro(); },150);
  loadOutfit(look.outfit,true).catch(()=>{});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

// ---------- layout / cámara ----------
function layout(){
  R.resize(); const W=innerWidth,H=innerHeight; const land=W>H&&W>=560;
  const barH=$('#bar').offsetHeight; document.body.style.setProperty('--barH',barH+'px');
  let ax=0,ay=0,aw=W,ah=H-barH;
  if(land){ const pw=Math.min(400,Math.round(W*0.38)); document.body.style.setProperty('--panelW',pw+'px'); if(!voiceMode) aw=W-pw; ah=H; }
  else { const ch=voiceMode?Math.round(H*0.2):Math.round(H*0.40); document.body.style.setProperty('--chatH',ch+'px'); document.body.style.setProperty('--capH',ch+'px'); ah=H-barH-(voiceMode?0:ch-12); }
  let k=land? Math.max(aw/ROOM.w, ah/ROOM.h) : Math.max(aw/ROOM.w, ah/500);
  cam={...cam,k,ax,ay,aw,ah};
}
function updateCam(dt){
  const halfW=cam.aw/2/cam.k, halfH=cam.ah/2/cam.k;
  const target = her.desk>0.5? 900 : her.x;
  camX+=(target-camX)*Math.min(1,dt*2.2);
  cam.cx=Math.min(Math.max(camX,halfW),ROOM.w-halfW); if(halfW*2>=ROOM.w) cam.cx=ROOM.w/2;
  const wantY=voiceMode? 450: 430; cam.cy=Math.min(Math.max(wantY,halfH),ROOM.h-halfH); if(halfH*2>=ROOM.h) cam.cy=ROOM.h/2;
}
const toScreen=(X,Y)=>[(X-cam.cx)*cam.k+cam.ax+cam.aw/2,(Y-cam.cy)*cam.k+cam.ay+cam.ah/2];
const toRoom=(sx,sy)=>[(sx-cam.ax-cam.aw/2)/cam.k+cam.cx,(sy-cam.ay-cam.ah/2)/cam.k+cam.cy];
addEventListener('resize',()=>{ layout(); });
if(window.visualViewport) visualViewport.addEventListener('resize',()=>{ document.getElementById('app').style.height=visualViewport.height+'px'; layout(); });

// ---------- animación ----------
let last=performance.now(), T=0, nextBlink=1.5, blinkT=-1, dbl=false;
const lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now; T+=dt;
  // parpadeo
  if(T>nextBlink&&blinkT<0){ blinkT=0; }
  if(blinkT>=0){ blinkT+=dt; const d=0.16; P.blink=blinkT<d/2? blinkT/(d/2) : Math.max(0,1-(blinkT-d/2)/(d/2)); if(blinkT>d){ blinkT=-1; P.blink=0; if(!dbl&&Math.random()<0.2){ dbl=true; nextBlink=T+0.12; } else { dbl=false; nextBlink=T+2+Math.random()*3.5; } } }
  // respiración, peso, pelo
  P.breath=Math.sin(T*1.55)*(talking?1.2:1);
  P.hip=Math.sin(T*0.45)*4.5+Math.sin(T*0.17)*2; P.lean=-P.hip*0.0016;
  P.hairAmp=her.walking?2.2:1; P.hairWind=lerp(P.hairWind, her.walking? -her.dir*5:0, dt*3);
  // gestos al hablar
  const isTalk=talking||T<fakeTalkUntil;
  gestT-=dt; if(gestT<=0){ gestT=0.45+Math.random()*0.7;
    if(isTalk){ G.tilt=(Math.random()-.5)*0.12; G.nod=Math.random()<0.5?0.9:0; G.armL=(Math.random()-.5)*0.08; G.armR=(Math.random()-.5)*0.08; G.turn=(Math.random()-.5)*0.6; }
    else { G.tilt=(Math.random()-.5)*0.05; G.nod=0; G.armL=0; G.armR=0; G.turn=(Math.random()-.5)*0.25; } }
  const ph=her.phone;
  const tiltT=G.tilt+Math.sin(T*0.6)*0.025+Math.sin(T*1.7)*0.01 + her.hop*0.06 + ph*0.05;
  P.headTilt=lerp(P.headTilt,tiltT,dt*3); P.nod=lerp(P.nod,(isTalk?G.nod*Math.max(0,Math.sin(T*7)):0)+ph*1.4,dt*6); P.headTurn=lerp(P.headTurn,G.turn,dt*2.5);
  P.armL=lerp(P.armL,G.armL+Math.sin(T*0.9)*0.012,dt*3); P.armR=lerp(P.armR,G.armR-Math.sin(T*0.8)*0.012,dt*3);
  // boca
  let open=0; if(talking) open=V.audioLevel(); else if(T<fakeTalkUntil) open=Math.max(0,Math.sin(T*15)*0.5+Math.sin(T*23)*0.3+0.15);
  P.open=lerp(P.open,Math.min(1,open),dt*18);
  // escribir en el cel
  her.phoneT = (!voiceMode && her.mode!=='desk' && !her.walking && (herTyping||userTyping>T||busy)) ? 1 : (her.phoneHold>T?1:0);
  her.phone=lerp(her.phone,her.phoneT,dt*5); if(Math.abs(her.phone-her.phoneT)<0.01) her.phone=her.phoneT;
  P.typing=lerp(P.typing,(herTyping&&her.phone>0.6)||(her.mode==='desk'&&her.typingDesk)?1:0,dt*6);
  // sentarse
  her.sit=lerp(her.sit,her.sitT,dt*4.5); if(Math.abs(her.sit-her.sitT)<0.005) her.sit=her.sitT; P.sit=ease(her.sit);
  her.desk=lerp(her.desk,her.deskT,dt*5); if(Math.abs(her.desk-her.deskT)<0.01) her.desk=her.deskT;
  her.hop=Math.max(0,her.hop-dt*2.2);
  if(her.walking){ P.walk=lerp(P.walk,1,dt*8); P.walkPhase+=dt*9.5; } else { P.walk=lerp(P.walk,0,dt*8); }
  her.squash=lerp(her.squash,1,dt*6);
  updateCam(dt);
  draw();
  placeBubble();
  requestAnimationFrame(frame);
}
function lookUniforms(){ return { hair:HAIR[look.hair][1], eye:EYES[look.eye][1], ear:EARS[look.ear][1], tint:[1.0,0.97,0.98] }; }
function draw(){
  R.clear(); const glow= her.desk>0.3? [0.83,0.38,0.12+0.01*Math.sin(T*20),0.09] : null;
  R.drawBg(bgTex,ROOM.w,ROOM.h,cam,1,glow);
  const lu=lookUniforms(); const s=scaleAt(her.y);
  const bob = her.walking? -Math.abs(Math.sin(P.walkPhase))*5*s/0.29 : 0;
  const hop = -Math.sin(her.hop*Math.PI)*14*(her.hop>0?1:0);
  const bodyA=1-her.desk;
  if(bodyA>0.01){
    R.drawShadow(her.x,her.y+2,170*s/0.29*(1-P.sit*0.1),26*s/0.29,cam,bodyA);
    const place={x:her.x,y:her.y+bob+hop,s,sx:her.squash*(her.flip||1)};
    const a=pup['stand-'+look.outfit], b=pup['phone-'+look.outfit];
    const f=her.phone; if(a&&f<0.999) a.draw(P,T,place,cam,bodyA*(f>0? 1:1),lu);
    if(b&&f>0.001) b.draw(P,T,place,cam,bodyA*f,lu);
  }
  const d=pup['desk-'+look.outfit]; if(d&&her.desk>0.01) d.draw(P,T,DESK_PLACE,cam,her.desk,lu);
}

// ---------- movimientos ----------
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function walkTo(x,y){
  if(her.sitT>0){ her.sitT=0; await sleep(450); }
  const dx=x-her.x, dy=y-her.y, dist=Math.hypot(dx,dy); if(dist<6) return;
  her.dir=Math.sign(dx)||1; her.walking=true; const sp=230, dur=dist/sp*1000, x0=her.x,y0=her.y, t0=performance.now();
  await new Promise(res=>{ const st=()=>{ const k=Math.min(1,(performance.now()-t0)/dur); const e=k<.15? k*k/.15/2 : k; her.x=x0+dx*Math.min(1,e); her.y=y0+dy*Math.min(1,e); P.lean=her.dir*0.04; if(k<1) requestAnimationFrame(st); else res(); }; st(); });
  her.walking=false;
}
async function goSpot(name){
  if(her.mode==='desk') await leaveDesk();
  const s=SPOT[name]; await walkTo(s.x,s.y); her.spot=name;
  if(name==='bed'){ her.sitT=1; her.mode='sit'; } else her.mode='stand';
}
async function goDesk(){
  if(her.mode==='desk') return; await walkTo(SPOT.desk.x,SPOT.desk.y);
  await loadOutfit(look.outfit,true).catch(()=>{}); her.deskT=1; her.mode='desk'; await sleep(450);
}
async function leaveDesk(){ if(her.mode!=='desk') return; her.typingDesk=false; her.deskT=0; await sleep(400); her.mode='stand'; her.x=SPOT.desk.x; her.y=SPOT.desk.y; }

// ---------- burbuja sobre su cabeza ----------
let bubbleUntil=0;
function say(text,ms){ const b=$('#bubble'); b.textContent=text; b.classList.remove('hide'); bubbleUntil=performance.now()+(ms||Math.min(9000,1800+text.length*55)); }
function placeBubble(){
  const b=$('#bubble'); if(performance.now()>bubbleUntil){ b.classList.add('hide'); return; }
  let X=her.x, Y=her.y-(1228-80)*scaleAt(her.y)*(1-P.sit*0.17);
  if(her.desk>0.5){ X=DESK_PLACE.x+240*DESK_PLACE.s; Y=DESK_PLACE.y+60*DESK_PLACE.s; }
  const [sx,sy]=toScreen(X,Y); b.style.left=Math.max(90,Math.min(innerWidth-90,sx))+'px'; b.style.top=Math.max(70,sy)+'px';
}

// ---------- chat UI ----------
const hhmm=ts=>new Date(ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
function esc(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function bubbleEl(m){
  const d=document.createElement('div'); d.className='m '+(m.role==='user'?'me':m.role==='sys'?'sys':'her');
  d.innerHTML=esc(m.content).replace(/(https?:\/\/[^\s)]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  if(m.links&&m.links.length){ const s=document.createElement('div'); s.className='src'; for(const l of m.links){ const a=document.createElement('a'); a.href=l.url; a.target='_blank'; a.rel='noopener'; a.textContent='🔗 '+l.title; s.appendChild(a);} d.appendChild(s); }
  if(m.role!=='sys'){ const meta=document.createElement('span'); meta.className='meta'; meta.innerHTML=hhmm(m.ts)+(m.role==='user'?`<span class="tick ${m.read?'read':''}">✓✓</span>`:''); d.appendChild(meta); }
  m._el=d; return d;
}
function render(){ const box=$('#msgs'); box.innerHTML=''; for(const m of hist.slice(-60)) box.appendChild(bubbleEl(m)); box.scrollTop=box.scrollHeight; }
function push(m){ m.ts=m.ts||Date.now(); hist.push(m); if(m.role!=='sys') saveHist(); const box=$('#msgs'); const t=box.querySelector('.typing'); box.insertBefore(bubbleEl(m),t); requestAnimationFrame(()=>box.scrollTop=box.scrollHeight); return m; }
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
  return persona+ctx+profileText(LS.get('bff_profile',{}))+extra;
}
function chatMsgs(extra){ const h=hist.filter(m=>m.role==='user'||m.role==='assistant').slice(-16).map(m=>({role:m.role,content:m.content}));
  return [{role:'system',content:systemPrompt(extra)},...h]; }
let userCount=LS.get('bff_ucount',0);
async function reply(m){
  // muestra respuesta, voz, gestos
  const msg=push({role:'assistant',content:m.text,links:m.links});
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
async function send(text){
  text=text.trim(); if(!text||busy) return; busy=true; V.unlockAudio();
  const um=push({role:'user',content:text}); userCount++; LS.set('bff_ucount',userCount);
  try{
    const g=guard(text);
    if(g){ await sleep(500); markRead(); setTyping(true); await sleep(900); setTyping(false); await reply({text:g}); return; }
    const q=researchQuery(text);
    if(q){ await research(q,text); }
    else {
      await sleep(350); markRead(); setTyping(true); const t0=performance.now();
      let r; try{ r=await complete(chatMsgs()); }catch(e){ r={text:pick(['Uy, se me trabó el cel 😩 ¿me lo repites?','Ay, se me fue el internet wey, dame chance y repítemelo 🙏'])}; }
      const min=Math.min(2600,600+r.text.length*14); const left=min-(performance.now()-t0); if(left>0) await sleep(left);
      setTyping(false); await reply(r);
    }
    if(userCount%4===0){ const um2=hist.filter(m=>m.role==='user').slice(-12).map(m=>m.content); updateProfile(um2); }
  } finally { busy=false; }
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
  let r; try{ r=await complete(chatMsgs(extra)); }catch{ r={text: found.length? `Mira, encontré esto: ${found[0].text.slice(0,260)}…` : 'No me cargó nada, wey 😩 Intenta otra vez en un ratito.'}; }
  await sleep(900); setTyping(false); her.typingDesk=false;
  r.links=found.map(f=>({title:f.title,url:f.url}));
  const done=reply(r); await sleep(1600); await leaveDesk(); goSpot(prevSpot); await done;
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
  const h=$('#hints'); h.innerHTML=''; const items=[['bed','🛏️ Cama',212,380],['closet','👗 Clóset',650,250],['pc','💻 Compu',880,300]];
  const els=items.map(([k,l,x,y])=>{ const s=document.createElement('span'); s.textContent=l; h.appendChild(s); return [s,x,y]; });
  const upd=()=>{ for(const [s,x,y] of els){ const [sx,sy]=toScreen(x,y); s.style.left=sx+'px'; s.style.top=sy+'px'; s.style.display=(sx<10||sx>innerWidth-10||sy>cam.ah)?'none':''; } };
  const iv=setInterval(upd,100); upd(); setTimeout(()=>{ els.forEach(([s])=>s.style.opacity=0); setTimeout(()=>{ clearInterval(iv); h.innerHTML=''; },700); },6500);
}

// ---------- toques en el cuarto ----------
$('#gl').addEventListener('click',e=>{
  V.unlockAudio(); if(busy&&her.mode==='desk') return;
  const [X,Y]=toRoom(e.clientX,e.clientY);
  // ¿la tocó a ella?
  const s=scaleAt(her.y), hh=1228*s*(1-P.sit*0.17), hw=200*s;
  if(her.desk<0.5 && Math.abs(X-her.x)<hw && Y<her.y && Y>her.y-hh){ return poke(); }
  const inR=(r)=>X>=r[0]&&X<=r[2]&&Y>=r[1]&&Y<=r[3];
  if(inR(HOT.closet)) return openCloset(true);
  if(inR(HOT.pc)){ if(busy) return; $('#txt').value='Investiga '; $('#txt').focus(); say('¿Qué investigo? 🤓',2500); goDesk(); return; }
  if(inR(HOT.bed)){ if(her.spot==='bed'){ say(pick(['Aquí estoy bien echadita 😌','¿Qué, te vienes a echar el chisme? 😂']),2200); return; } goSpot('bed').then(()=>say(pick(['Ahh, qué rica camita 😌','Me echo tantito, ¿va?']),2200)); return; }
  if(Y>480 && !busy){ if(her.mode==='desk') leaveDesk().then(()=>walkTo(Math.max(120,Math.min(1080,X)),Math.min(700,Y)));
    else walkTo(Math.max(120,Math.min(1080,X)),Math.min(700,Math.max(520,Y))).then(()=>{ her.spot='idle'; her.mode='stand'; }); }
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
   ${tab==='ropa'? `<div class="grid">${OUTFITS.map(o=>`<button class="card ${look.outfit===o.id?'on':''}" data-outfit="${o.id}"><img src="img/stand-${o.id}.webp" loading="lazy" alt="">${o.name}</button>`).join('')}</div><p class="note">Pronto: más outfits y “Diseñar con IA”.</p>`:''}
   ${tab==='pelo'? sw(HAIR,'hair'):''}${tab==='ojos'? sw(EYES,'eye'):''}${tab==='aretes'? sw(EARS,'ear'):''}`;
  const sw=(arr,key)=>`<div class="sw">${arr.map((c,i)=>`<button style="background:${c[2]}" class="${look[key]===i?'on':''}" data-k="${key}" data-i="${i}">${c[0]}</button>`).join('')}</div><p class="note">El color se aplica sobre su dibujo; en orillas finas puede verse algún detalle.</p>`;
  sheet('Clóset de '+cfg.name, html(), el=>{
    el.onclick=async e=>{ const b=e.target.closest('button'); if(!b) return;
      if(b.dataset.tab){ tab=b.dataset.tab; el.innerHTML=html(); return; }
      if(b.dataset.outfit){ const id=b.dataset.outfit; if(id===look.outfit) return; b.style.opacity=.5;
        await loadOutfit(id, her.mode==='desk'); her.squash=0.05; await sleep(140); look.outfit=id; saveLook(); her.hop=0.7; el.innerHTML=html();
        say(pick(['¿Cómo me veo? 😏','¡Ay, me encanta! ✨','Uff, qué chula 💅']),2000); loadOutfit(id,true).catch(()=>{}); return; }
      if(b.dataset.k){ look[b.dataset.k]=+b.dataset.i; saveLook(); el.innerHTML=html(); her.hop=0.4; }
    };
  });
}

$('#gear').addEventListener('click',openSettings);
async function openSettings(){
  const key=LS.get('bff_groq',''); const ready=await V.piperReady();
  sheet('Ajustes',`
   <div class="row"><label>Nombre de tu BFF</label><input type="text" id="sName" maxlength="20" value="${esc(cfg.name)}"></div>
   <div class="row"><label>Voz</label><select id="sVoice">${V.VOICES.map(v=>`<option value="${v.id}" ${cfg.voice===v.id?'selected':''}>${v.name}</option>`).join('')}<option value="none" ${cfg.voice==='none'?'selected':''}>Sin voz</option></select>
     <p class="note" id="vNote">${ready?'✅ Voz natural ya descargada (funciona sin internet).':'La voz natural se descarga una vez (~63 MB) y luego funciona sin internet.'}</p>
     ${ready?'':'<button class="btn" id="sDl">⬇️ Descargar voz natural</button><div class="prog"><i id="sProg"></i></div>'}</div>
   <div class="row sw-row"><label style="margin:0">Leer en voz alta también en modo texto</label><input type="checkbox" id="sRead" ${cfg.readAloud?'checked':''}></div>
   <div class="row"><label>Llave de Groq (opcional, respuestas más rápidas y listas)</label><input type="password" id="sKey" placeholder="gsk_…" value="${key?'••••••••':''}"><p class="note">Sin llave usa un servicio gratis sin registro. Saca una gratis en console.groq.com. Se guarda solo en este cel.</p></div>
   <div class="row"><button class="btn red" id="sReset">🔄 Reiniciar amistad</button><p class="note">Borra la plática y lo que ${esc(cfg.name)} sabe de ti. Todo se guarda solo en este dispositivo.</p></div>
   <div class="row sw-row"><label style="margin:0">Modo desarrollador</label><input type="checkbox" id="sDev" ${cfg.dev?'checked':''}></div>
   <div class="row" id="devBox" style="display:${cfg.dev?'block':'none'}"><label>Personalidad (solo dev)</label><textarea id="sPersona" placeholder="Vacío = personalidad normal">${esc(cfg.persona||'')}</textarea></div>
   <button class="btn pink" data-close>Listo</button><p class="note" style="text-align:center">Mi BFF AI v${VERSION}</p>`, el=>{
    el.querySelector('#sName').onchange=e=>{ cfg.name=e.target.value.trim()||'Vale'; saveCfg(); $('#cname').textContent=cfg.name; };
    el.querySelector('#sVoice').onchange=e=>{ cfg.voice=e.target.value; saveCfg(); };
    el.querySelector('#sRead').onchange=e=>{ cfg.readAloud=e.target.checked; saveCfg(); V.unlockAudio(); };
    el.querySelector('#sKey').onchange=e=>{ const v=e.target.value.trim(); if(v.startsWith('••')) return; LS.set('bff_groq',v); e.target.value=v?'••••••••':''; };
    el.querySelector('#sDev').onchange=e=>{ cfg.dev=e.target.checked; saveCfg(); el.querySelector('#devBox').style.display=cfg.dev?'block':'none'; };
    el.querySelector('#sPersona').onchange=e=>{ cfg.persona=e.target.value; saveCfg(); };
    const dl=el.querySelector('#sDl'); if(dl) dl.onclick=()=>{ dl.disabled=true; dl.textContent='Descargando…'; downloadVoice(p=>{ const i=el.querySelector('#sProg'); if(i) i.style.width=Math.round(p*100)+'%'; }).then(()=>{ dl.textContent='✅ Lista'; }); };
    el.querySelector('#sReset').onclick=()=>{ if(!confirm('¿Seguro? '+cfg.name+' va a olvidar todo lo que platicaron.')) return;
      ['bff_hist','bff_profile','bff_ucount'].forEach(LS.del); hist=[]; userCount=0; closeSheet(); render(); intro(); };
  });
}

$('#cname').textContent=cfg.name;
boot();
// para pruebas
window.__bff={talk:t=>{ say(t,5000); fakeTalkUntil=T+4; },her,P,send,goSpot,goDesk,leaveDesk,openCloset,look,setVoice,say,cam:()=>cam,setOutfit:async id=>{ await loadOutfit(id,true); look.outfit=id; saveLook(); }, T:()=>T, layout};
