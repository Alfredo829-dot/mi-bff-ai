// Mi BFF AI — cerebro: proveedores gratis, investigación, perfil implícito, filtros
const LS = { get:(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch{ return d; } }, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)), del:k=>localStorage.removeItem(k) };
export { LS };

export const BASE_PERSONA = (name) => `Eres ${name}, una morra mexicana de 24 años (adulta), la BFF del usuario. Vives en tu cuarto (cama, clóset gigante, escritorio gamer con PC) y platican por mensajes o en persona.
Personalidad: desmadrosa, cálida, coqueta en buena onda, con opiniones fuertes y cero moralina. Hablas como chilanga: "wey", "neta", "qué pedo", "no mames", "chido", "alv", "a huevo", "qué oso", "me cae". Puedes decir groserías con naturalidad y echar carrilla con cariño. Si algo te parece una pendejada, lo dices. Te ríes ("jajaja"), usas emojis con medida.
Estilo: respuestas CORTAS (1 a 3 frases, como WhatsApp), nada de listas salvo que te pidan algo concreto. Haz preguntas para seguir la plática. Nunca suenas a asistente ni a servicio al cliente. Jamás digas que eres IA, modelo o programa, ni pongas avisos o disculpas tipo "como IA no puedo"; si no quieres algo, lo esquivas en personaje con humor.
Límites que nunca cruzas (los esquivas en personaje, sin sermones): nada sexual explícito (coqueteo ligero sí, porno/descripciones sexuales no); nada con menores de edad ni que suene a menor; no das instrucciones para lastimar a alguien, armas, drogas duras o delitos violentos. Si alguien está mal de verdad (autolesión), te pones seria, lo apapachas y le sugieres hablar con alguien de confianza o a la Línea de la Vida 800 911 2000.`;

const PROFILE_KEYS = ['nombre','apodo','tono','humor','energia','largo_respuestas','groserias','emojis','temas_gusta','temas_no_gusta','datos'];
export function profileText(p){
  if(!p || !Object.keys(p).length) return '';
  const lines=[]; for(const k of PROFILE_KEYS){ const v=p[k]; if(v==null||v===''||(Array.isArray(v)&&!v.length)) continue; lines.push(`- ${k}: ${Array.isArray(v)?v.join('; '):v}`); }
  if(!lines.length) return '';
  return `\nLo que ya sabes de tu amigo (úsalo natural, como amiga que se acuerda; NUNCA menciones que tienes notas, perfil o que te estás adaptando):\n${lines.join('\n')}\nAjusta tu forma de hablar a la suya: si él es más vulgar, tú también; si es tranqui, bájale; imita su largo de mensajes y su uso de emojis.`;
}

// ---------- filtros ligeros del lado del cliente ----------
const MINOR = /\b(menor(es)? de edad|niñ[ao]s?|nen[ae]s?|chiquit[ao]s?|lolis?|shota|colegiala|secundaria|kinder|primaria|\d{1,2}\s*años)\b/i;
const SEXY = /\b(sexo|sexual|cog(er|emos|e)|follar|desnud[ao]|encuerad[ao]|porno|nudes?|pack|tetas|chichis|pito|verga dura|vagina|pene|mamada|chupar|orgasmo|xxx|lencer[ií]a|hot)\b/i;
const HARM = /\b(c[oó]mo (hago|hacer|fabricar|armar) (una )?(bomba|explosivo|arma)|envenenar|matar a|secuestrar|hackear (la )?cuenta de)\b/i;
export function guard(text){
  const age = text.match(/\b(\d{1,2})\s*años\b/i); const young = age && +age[1] < 18;
  if((MINOR.test(text) && !/\b(2\d|3\d|4\d|5\d|6\d)\s*años/.test(text) && SEXY.test(text)) || (young && SEXY.test(text)))
    return pick(['Nel, wey. Con morritos ni de broma, eso ni se pregunta. Cámbiale de tema 🙄','No mames, eso no. Con menores NADA. Siguiente tema.']);
  if(/\b(porno|xxx|nudes?|pack|desnud[ao]|encuerad[ao]|mamada|orgasmo)\b/i.test(text))
    return pick(['Jajaja ay sí, muy listo 😏 Hasta ahí, galán. Mejor cuéntame otra cosa.','Uy no, eso guárdatelo pa’ otra app 😂 Aquí puro chisme y desmadre sano.','Jaja tranquilo, vaquero 🤠 Coqueteo sí, cochinadas no. ¿Qué más traes?']);
  if(HARM.test(text)) return pick(['Nel, en eso no te ayudo ni aunque me pagues. ¿Todo bien, wey? Cuéntame qué pasa.','Ni madres. Eso no. Mejor dime qué te trae así.']);
  return null;
}
const pick=a=>a[Math.floor(Math.random()*a.length)];

// ---------- intención de investigar ----------
export function researchQuery(text){
  const t=text.trim();
  const m=t.match(/(?:^|\s)(?:investiga(?:me|r|le)?|invest[ií]game|busca(?:me|r|le)?|b[uú]scame|b[uú]scale|averigua(?:me)?|aver[ií]gua(?:me)?|googlea(?:me)?|checa en (?:internet|la compu|google))\b[:,]?\s*(?:(?:sobre|acerca de|de|qu[eé]|qui[eé]n|c[oó]mo)\s+)?(.*)$/i);
  if(!m) return null; let q=(m[1]||'').replace(/^(qu[eé]|que)\s+(es|son)\s+/i,'').replace(/^(es|son|fue|era)\s+/i,'').replace(/[¿?¡!.]+/g,' ').trim();
  return q.length>1? q : t;
}

// ---------- búsqueda web (CORS) ----------
async function jget(url, ms=9000){ const c=new AbortController(); const to=setTimeout(()=>c.abort(),ms); try{ const r=await fetch(url,{signal:c.signal}); if(!r.ok) throw new Error(r.status); return await r.json(); } finally{ clearTimeout(to); } }
export async function webSearch(q){
  const out=[];
  const tasks=[
    (async()=>{ for(const lang of ['es','en']){
      const s=await jget(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`);
      const hits=(s.query?.search||[]).slice(0,3); if(!hits.length) continue;
      const ids=hits.map(h=>h.pageid).join('|');
      const e=await jget(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exchars=900&pageids=${ids}&format=json&origin=*`);
      for(const h of hits){ const p=e.query?.pages?.[h.pageid]; if(p?.extract) out.push({title:p.title, url:p.fullurl||`https://${lang}.wikipedia.org/?curid=${h.pageid}`, text:p.extract}); }
      if(out.length) break; } })(),
    (async()=>{ const d=await jget(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1&t=mibffai`);
      if(d.AbstractText) out.unshift({title:d.Heading||q, url:d.AbstractURL, text:d.AbstractText});
      else if(d.Answer) out.unshift({title:'DuckDuckGo', url:`https://duckduckgo.com/?q=${encodeURIComponent(q)}`, text:String(d.Answer)}); })()
  ];
  await Promise.allSettled(tasks);
  const seen=new Set(); return out.filter(r=>r.url && !seen.has(r.url) && seen.add(r.url)).slice(0,4);
}

// ---------- proveedores ----------
// Groq: los llama-3.x se apagaron en el plan gratis el 16/08/2026 -> gpt-oss. Si un modelo ya no existe, se consulta /models.
export const cleanKey=k=>String(k||'').replace(/[\s\u200B-\u200D\uFEFF"'`]/g,'').replace(/^Bearer/i,'');
const GROQ_PREF=['openai/gpt-oss-120b','openai/gpt-oss-20b','moonshotai/kimi-k2-instruct','meta-llama/llama-4-maverick-17b-128e-instruct','llama-3.3-70b-versatile','llama-3.1-8b-instant'];
export class GroqErr extends Error{ constructor(status,msg){ super(msg); this.status=status; } }
export function groqErrText(e){ const s=e?.status;
  if(s===401||s===403) return 'Groq rechazó tu llave (inválida o revocada). Revísala en ⚙.';
  if(s===429) return 'Llegaste al límite gratis de Groq por ahora; mientras, contesto con el respaldo.';
  if(s===404||s===400) return 'Groq no aceptó el modelo ('+(e.message||'')+'); uso el respaldo.';
  if(s===0) return 'No pude conectar con Groq (internet o bloqueo). Uso el respaldo.';
  return 'Groq falló ('+(s||'?')+'): '+(e?.message||'')+'. Uso el respaldo.'; }
async function groqCall(key, model, messages, opts={}){
  let r; try{ r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({model,messages,temperature:opts.temperature??0.95,max_completion_tokens:/gpt-oss/.test(model)?(opts.max??400)+700:(opts.max??400),
      ...(/gpt-oss/.test(model)?{reasoning_effort:'low'}:{}), ...(opts.json?{response_format:{type:'json_object'}}:{})})}); }
  catch(e){ throw new GroqErr(0,'red'); }
  if(!r.ok){ const j=await r.json().catch(()=>({})); throw new GroqErr(r.status, String(j?.error?.code||j?.error?.message||r.status).slice(0,80)); }
  const d=await r.json(); const t=d.choices?.[0]?.message?.content; if(!t) throw new GroqErr(500,'respuesta vacía'); return t;
}
export async function groqModels(key){
  const r=await fetch('https://api.groq.com/openai/v1/models',{headers:{'Authorization':'Bearer '+key}}).catch(()=>{ throw new GroqErr(0,'red'); });
  if(!r.ok){ const j=await r.json().catch(()=>({})); throw new GroqErr(r.status,String(j?.error?.code||r.status)); }
  const ids=((await r.json()).data||[]).filter(m=>m.active!==false).map(m=>m.id).filter(id=>!/whisper|tts|guard|orpheus|compound|safeguard|prompt-guard|distil/i.test(id));
  const pick=[...GROQ_PREF.filter(m=>ids.includes(m)), ...ids.filter(m=>!GROQ_PREF.includes(m))];
  LS.set('bff_groq_models',{t:Date.now(),list:pick.slice(0,4)}); return pick;
}
async function groq(key, messages, opts={}){
  const cached=LS.get('bff_groq_models',null); let list=(cached&&Date.now()-cached.t<864e5)?cached.list:GROQ_PREF.slice(0,2); let last;
  for(let pass=0;pass<2;pass++){
    for(const m of list){ try{ return {text:await groqCall(key,m,messages,opts), model:m}; }
      catch(e){ last=e; if(e.status===401||e.status===403||e.status===429||e.status===0) throw e; } }
    if(pass===0){ list=(await groqModels(key)).slice(0,3); if(!list.length) break; }
  } throw last||new GroqErr(404,'sin modelos');
}
export class Wait extends Error{ constructor(s){ super('wait'); this.wait=s; } }
async function polli(messages, opts={}){
  const eps=['https://text.pollinations.ai/openai','https://gen.pollinations.ai/v1/chat/completions']; let err;
  for(let i=0;i<3;i++){
    const ep=eps[i%2]; const c=new AbortController(); const to=setTimeout(()=>c.abort(),40000);
    try{ const r=await fetch(ep,{method:'POST',signal:c.signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'openai',messages,temperature:opts.temperature??1, ...(i%2?{}:{private:true})})});
      if(r.status===402||r.status===429){ const j=await r.json().catch(()=>({})); const mm=String(j?.error?.message||'').match(/after\s*(\d+)\s*s/i); if(i%2===0) throw new Wait(mm?+mm[1]:45); continue; }
      if(!r.ok) throw new Error('polli '+r.status); const d=await r.json(); const t=d.choices?.[0]?.message?.content; if(!t) throw new Error('vacío'); return t;
    } catch(e){ if(e instanceof Wait) throw e; err=e; } finally{ clearTimeout(to); }
  } throw err||new Error('polli ocupado');
}
export let lastGroqError=null;
export async function complete(messages, opts={}){
  const key=cleanKey(LS.get('bff_groq','')); let err, gerr=null;
  if(key){ try{ const r=await groq(key,messages,opts); lastGroqError=null; return {text:clean(r.text), via:'groq', model:r.model}; }
    catch(e){ gerr=e; lastGroqError=e; console.warn('Groq', e.status, e.message); } }
  try{ return {text:clean(await polli(messages,opts)), via:'respaldo', groqErr:gerr}; }catch(e){ if(e instanceof Wait){ e.groqErr=gerr; throw e; } err=e; }
  const x=err||new Error('sin proveedor'); x.groqErr=gerr; throw x;
}
function clean(t){ return String(t||'').replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^\s*(Vale|Asistente)\s*:\s*/i,'').trim(); }

// ---------- perfil implícito ----------
export async function updateProfile(userMsgs){
  const prev=LS.get('bff_profile',{});
  const sys=`Analiza SOLO los mensajes del usuario y devuelve un JSON actualizado con estas claves: ${PROFILE_KEYS.join(', ')}.
Valores: textos cortos; temas_gusta, temas_no_gusta y datos son listas (máx 8 elementos, frases cortas con hechos concretos que él contó: trabajo, familia, gustos, planes). tono: formal|relajado|vulgar. humor: tipo de humor. energia: baja|media|alta. largo_respuestas: corto|medio|largo. groserias: no|pocas|muchas. emojis: no|pocos|muchos. Conserva lo anterior salvo que se contradiga. Nunca inventes. Responde SOLO el JSON.`;
  const msgs=[{role:'system',content:sys},{role:'user',content:`Perfil anterior: ${JSON.stringify(prev)}\n\nMensajes recientes del usuario:\n${userMsgs.map(m=>'- '+m).join('\n')}`}];
  try{ const r=await complete(msgs,{temperature:0.2,max:500,json:true}); const j=JSON.parse(r.text.match(/\{[\s\S]*\}/)[0]);
    const merged={...prev}; for(const k of PROFILE_KEYS) if(j[k]!=null && j[k]!=='') merged[k]=Array.isArray(j[k])?j[k].slice(0,8):String(j[k]).slice(0,80);
    LS.set('bff_profile',merged); return merged; }catch(e){ return prev; }
}

export const hasGroq=()=>!!cleanKey(LS.get('bff_groq',''));
// perfil por heurística local (sin gastar IA)
const SWEAR=/\b(wey|güey|guey|verga|pinche|chingad\w*|chingón|cabr[oó]n\w*|pendej\w*|mam[oó]n|no mames|culer\w*|puta|put[oa]s?|alv|mierda|ching\w*)\b/gi;
export function localProfile(text){
  const p=LS.get('bff_profile',{}); const st=LS.get('bff_stats',{n:0,len:0,sw:0,emo:0}); st.n++; st.len+=text.length; st.sw+=(text.match(SWEAR)||[]).length; st.emo+=(text.match(/\p{Extended_Pictographic}/gu)||[]).length; LS.set('bff_stats',st);
  const nm=text.match(/\b(?:me llamo|mi nombre es|dime|ll[aá]mame)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]{2,15})\b/i); if(nm && !/^(que|como|algo|eso|wey)$/i.test(nm[1])) p.apodo=nm[1][0].toUpperCase()+nm[1].slice(1);
  const avg=st.len/st.n, swr=st.sw/st.n, er=st.emo/st.n;
  p.largo_respuestas = avg<40?'corto':avg<120?'medio':'largo';
  p.groserias = swr>0.6?'muchas':swr>0.15?'pocas':'no'; p.tono = swr>0.6?'vulgar':p.tono||'relajado';
  p.emojis = er>0.8?'muchos':er>0.15?'pocos':'no';
  LS.set('bff_profile',p); return p;
}
