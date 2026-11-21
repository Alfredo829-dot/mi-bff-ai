// Voz: Piper (neural, offline tras 1a descarga) vía vits-web; voz del sistema solo como último recurso.
export const VOICES = [
  {id:'es_MX-claude-high', name:'Claude (México, natural)', kind:'piper', size:'~63 MB, se descarga una vez'},
  {id:'system', name:'Voz del sistema (la de tu cel)', kind:'system'},
];
// Voces de español que trae el dispositivo (en Android suelen ser las de Google, muy naturales).
export function listSystemVoices(all){
  const vs = all || (typeof speechSynthesis!=='undefined' ? speechSynthesis.getVoices() : []);
  return vs.filter(v=>/^es([-_]|$)/i.test(v.lang||'')).map(v=>({name:v.name, lang:v.lang}));
}
export function pickSystemVoice(all, preferred){
  const vs=listSystemVoices(all);
  if(preferred){ const f=vs.find(v=>v.name===preferred); if(f) return f; }
  return vs.find(v=>/female|mujer|paulina|sabina|google/i.test(v.name))||vs[0]||null;
}
let tts=null, ctx=null, analyser=null, cur=null, level=0, _ab=null;
let liveQ=[], liveDone=false, liveBusy=false, liveCfg=null, liveFinished=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function audioLevel(){ if(!analyser) return level; _ab=_ab||new Uint8Array(analyser.fftSize); const a=_ab; analyser.getByteTimeDomainData(a);
  let s=0; for(const v of a){ const d=(v-128)/128; s+=d*d; }
  // apertura por decibeles (idea de ryza-ai-revive, MIT): -40 dB = cerrada, -6 dB = abierta; más natural que escalar lineal
  const db=20*Math.log10(Math.sqrt(s/a.length)+1e-6); return Math.max(0,Math.min(1,(db+40)/34)); }
function ac(){ if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)(); analyser=ctx.createAnalyser(); analyser.fftSize=1024; analyser.connect(ctx.destination); } if(ctx.state==='suspended') ctx.resume(); return ctx; }
export function unlockAudio(){ try{ ac(); }catch{} }
export async function clearPiperCache(){ tts=tts||await import('./vits/vits-web.js'); await tts.flush(); }
export async function piperReady(){ try{ tts=tts||await import('./vits/vits-web.js'); const s=await tts.stored(); return s.includes('es_MX-claude-high'); }catch{ return false; } }
export async function preparePiper(onProg){ tts=tts||await import('./vits/vits-web.js');
  await tts.download('es_MX-claude-high', p=>onProg&&p.total&&onProg(p.loaded/p.total)); }
let gen=0;
export function stop(){ gen++; liveQ=[]; liveDone=false; liveBusy=false; try{ cur&&cur.stop(); }catch{} cur=null; try{ speechSynthesis.cancel(); }catch{} }
function speakable(t){ return t.replace(/https?:\/\/\S+/g,'').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\bwey\b/gi,'güey').replace(/\balv\b/gi,'a la verga').replace(/\bxd\b/gi,'jajaja').replace(/[*_#>]/g,'').trim(); }
// trozos por frase (≥ ~45 letras) para empezar a hablar en cuanto la 1a frase está lista
function chunks(t){ const parts=t.match(/[^.!?…\n]+[.!?…]*\s*/g)||[t]; const out=[]; let c='';
  for(const p of parts){ c+=p; if(c.trim().length>=45){ out.push(c.trim()); c=''; } } if(c.trim()) out.push(c.trim()); return out; }
// Parte el texto en frases para la voz en vivo (no espera a sintetizar todo).
export function splitSpeech(t){
  const m=String(t||'').match(/[^.!?…]+[.!?…]+["'”)]*\s*|[^.!?…]+$/g)||[];
  const out=[];
  for(const p of m.map(s=>s.trim()).filter(Boolean)){
    if(p.length<=140){ out.push(p); continue; }
    let rest=p; while(rest.length>140){ const cut=rest.lastIndexOf(' ',140); const i=cut>60?cut:140; out.push(rest.slice(0,i).trim()); rest=rest.slice(i).trim(); }
    if(rest) out.push(rest);
  }
  return out;
}
// Saca las frases completas de un texto en vivo; devuelve [frases, resto sin terminar].
export function takeSentences(buf){
  const m=String(buf||'').match(/[^.!?…]+[.!?…]+["'”)]*\s*/g);
  if(!m) return [[], String(buf||'')];
  const done=m.join('');
  return [splitSpeech(done), String(buf||'').slice(done.length)];
}
// devuelve promesa que resuelve al terminar. onStart(kind)
export async function speak(text, voiceId, onStart, rate=1, sysVoice=null){
  stop(); const t=speakable(text); if(!t) return; const my=gen;
  if(voiceId!=='system'){
    let started=false;
    try{ tts=tts||await import('./vits/vits-web.js'); const c=ac(); const cs=chunks(t);
      const synth=s=>tts.predict({text:s, voiceId:'es_MX-claude-high'}).then(async w=>c.decodeAudioData(await w.arrayBuffer()));
      let next=synth(cs[0]);
      for(let i=0;i<cs.length;i++){ const buf=await next; if(my!==gen) return; next= i+1<cs.length? synth(cs[i+1]) : null; if(next) next.catch(()=>{});
        const src=c.createBufferSource(); src.buffer=buf; src.playbackRate.value=rate; src.connect(analyser); cur=src;
        if(!started){ started=true; onStart&&onStart('piper'); }
        await new Promise(r=>{ src.onended=r; src.start(); }); if(my!==gen) return; }
      cur=null; return; }
    catch(e){ console.warn('piper falló, uso voz del sistema', e); cur=null; if(started||my!==gen) return; }
  }
  // último recurso: voz del sistema (amplitud simulada)
  await new Promise(res=>{ const u=new SpeechSynthesisUtterance(t); u.lang='es-MX'; u.rate=rate; u.pitch=1.1;
    const f=pickSystemVoice(undefined, sysVoice); if(f){ const real=speechSynthesis.getVoices().find(v=>v.name===f.name); if(real) u.voice=real; }
    let iv=setInterval(()=>{ level=0.25+Math.random()*0.6; },90); u.onend=u.onerror=()=>{ clearInterval(iv); level=0; res(); };
    onStart&&onStart('system'); speechSynthesis.speak(u); });
}
// --- voz en vivo: habla las frases en cuanto llegan, sin esperar el texto completo ---
export function liveStart(voiceId, onStart, rate=1, sysVoice=null, onDone=null){
  stop();
  liveQ=[]; liveDone=false; liveBusy=false; liveFinished=false;
  liveCfg={voiceId, onStart, rate, sysVoice, onDone};
}
export function liveEnqueue(text){
  if(!liveCfg) return;
  const t=speakable(text); if(!t) return;
  for(const s of splitSpeech(t)) liveQ.push(s);
  livePump();
}
export function liveEnd(){ liveDone=true; livePump(); }
export function liveStop(){ stop(); liveQ=[]; liveDone=false; liveBusy=false; }
async function livePump(){
  if(liveBusy) return; liveBusy=true;
  const g=gen, cfg=liveCfg;
  while(liveQ.length || !liveDone){
    if(g!==gen || !cfg){ liveBusy=false; return; }
    const s=liveQ.shift();
    if(!s){ await sleep(60); continue; }
    if(cfg.voiceId!=='system'){
      try{
        tts=tts||await import('./vits/vits-web.js'); const c=ac();
        const wav=await tts.predict({text:s, voiceId:'es_MX-claude-high'});
        if(g!==gen){ liveBusy=false; return; }
        const buf=await c.decodeAudioData(await wav.arrayBuffer());
        const src=c.createBufferSource(); src.buffer=buf; src.playbackRate.value=cfg.rate; src.connect(analyser);
        cur=src; if(cfg.onStart){ cfg.onStart('piper'); cfg.onStart=null; }
        await new Promise(r=>{ src.onended=r; src.start(); }); cur=null;
        continue;
      }catch(e){ console.warn('piper falló en vivo, uso voz del sistema', e); }
    }
    if(g!==gen){ liveBusy=false; return; }
    await new Promise(res=>{ const u=new SpeechSynthesisUtterance(s); u.lang='es-MX'; u.rate=cfg.rate; u.pitch=1.1;
      const f=pickSystemVoice(undefined, cfg.sysVoice); if(f){ const real=speechSynthesis.getVoices().find(v=>v.name===f.name); if(real) u.voice=real; }
      let iv=setInterval(()=>{ level=0.25+Math.random()*0.6; },90); u.onend=u.onerror=()=>{ clearInterval(iv); level=0; res(); };
      if(cfg.onStart){ cfg.onStart('system'); cfg.onStart=null; } speechSynthesis.speak(u); });
  }
  liveBusy=false;
  if(g===gen && !liveFinished){ liveFinished=true; cfg.onDone&&cfg.onDone(); }
}
// ---- reconocimiento de voz (continuo: un solo "bip" al activar) ----
export class Ear {
  constructor(onFinal,onInterim){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; this.ok=!!SR; if(!SR) return;
    this.r=new SR(); this.r.lang='es-MX'; this.r.continuous=true; this.r.interimResults=true; this.on=false; this.paused=false;
    this.r.onresult=e=>{ let fin='',int=''; for(let i=e.resultIndex;i<e.results.length;i++){ const x=e.results[i]; if(x.isFinal) fin+=x[0].transcript; else int+=x[0].transcript; }
      if(int) onInterim&&onInterim(int); if(fin.trim()) onFinal(fin.trim()); };
    this.r.onend=()=>{ if(this.on&&!this.paused) setTimeout(()=>{ try{ this.r.start(); }catch{} },250); };
    this.r.onerror=e=>{ if(e.error==='not-allowed'){ this.on=false; this.onDenied&&this.onDenied(); } }; }
  start(){ if(!this.ok) return false; this.on=true; this.paused=false; try{ this.r.start(); }catch{} return true; }
  stop(){ this.on=false; try{ this.r.stop(); }catch{} }
  pause(){ this.paused=true; try{ this.r.stop(); }catch{} }
  resume(){ if(!this.on) return; this.paused=false; try{ this.r.start(); }catch{} }
}
