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
async function groq(key, model, messages, opts={}){
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({model,messages,temperature:opts.temperature??0.95,max_tokens:opts.max??400, ...(opts.json?{response_format:{type:'json_object'}}:{})})});
  if(!r.ok) throw new Error('groq '+r.status); const d=await r.json(); return d.choices[0].message.content;
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
export async function complete(messages, opts={}){
  const key=(LS.get('bff_groq','')||'').trim(); let err;
  if(key){ for(const m of ['llama-3.3-70b-versatile','llama-3.1-8b-instant']){ try{ return {text:clean(await groq(key,m,messages,opts)), via:'Groq '+m}; }catch(e){ err=e; } } }
  try{ return {text:clean(await polli(messages,opts)), via:'Pollinations'}; }catch(e){ if(e instanceof Wait) throw e; err=e; }
  throw err||new Error('sin proveedor');
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

export const hasGroq=()=>!!(LS.get('bff_groq','')||'').trim();
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
