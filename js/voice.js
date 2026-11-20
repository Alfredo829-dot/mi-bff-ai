// Voz: Piper (neural, offline tras 1a descarga) vía vits-web; voz del sistema solo como último recurso.
export const VOICES = [
  {id:'es_MX-claude-high', name:'Claude (México, natural)', kind:'piper', size:'~63 MB, se descarga una vez'},
  {id:'system', name:'Voz del sistema (robótica, último recurso)', kind:'system'},
];
let tts=null, ctx=null, analyser=null, cur=null, level=0, _ab=null;
export function audioLevel(){ if(!analyser) return level; _ab=_ab||new Uint8Array(analyser.fftSize); const a=_ab; analyser.getByteTimeDomainData(a);
  let s=0; for(const v of a){ const d=(v-128)/128; s+=d*d; } return Math.min(1,Math.sqrt(s/a.length)*5.5); }
function ac(){ if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)(); analyser=ctx.createAnalyser(); analyser.fftSize=1024; analyser.connect(ctx.destination); } if(ctx.state==='suspended') ctx.resume(); return ctx; }
export function unlockAudio(){ try{ ac(); }catch{} }
export async function piperReady(){ try{ tts=tts||await import('./vits/vits-web.js'); const s=await tts.stored(); return s.includes('es_MX-claude-high'); }catch{ return false; } }
export async function preparePiper(onProg){ tts=tts||await import('./vits/vits-web.js');
  await tts.download('es_MX-claude-high', p=>onProg&&p.total&&onProg(p.loaded/p.total)); }
export function stop(){ try{ cur&&cur.stop(); }catch{} cur=null; try{ speechSynthesis.cancel(); }catch{} }
function speakable(t){ return t.replace(/https?:\/\/\S+/g,'').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\bwey\b/gi,'güey').replace(/\balv\b/gi,'a la verga').replace(/\bxd\b/gi,'jajaja').replace(/[*_#>]/g,'').trim(); }
// devuelve promesa que resuelve al terminar. onStart(kind)
export async function speak(text, voiceId, onStart){
  stop(); const t=speakable(text); if(!t) return;
  if(voiceId!=='system'){
    try{ tts=tts||await import('./vits/vits-web.js'); const wav=await tts.predict({text:t, voiceId:'es_MX-claude-high'});
      const c=ac(); const buf=await c.decodeAudioData(await wav.arrayBuffer()); const src=c.createBufferSource(); src.buffer=buf; src.playbackRate.value=1.04; src.connect(analyser);
      cur=src; onStart&&onStart('piper'); await new Promise(r=>{ src.onended=r; src.start(); }); cur=null; return; }
    catch(e){ console.warn('piper falló, uso voz del sistema', e); }
  }
  // último recurso: voz del sistema (amplitud simulada)
  await new Promise(res=>{ const u=new SpeechSynthesisUtterance(t); u.lang='es-MX'; u.rate=1.05; u.pitch=1.1;
    const vs=speechSynthesis.getVoices().filter(v=>/es[-_](MX|US|419)/i.test(v.lang)); const f=vs.find(v=>/female|mujer|paulina|sabina|google/i.test(v.name))||vs[0]; if(f) u.voice=f;
    let iv=setInterval(()=>{ level=0.25+Math.random()*0.6; },90); u.onend=u.onerror=()=>{ clearInterval(iv); level=0; res(); };
    onStart&&onStart('system'); speechSynthesis.speak(u); });
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
