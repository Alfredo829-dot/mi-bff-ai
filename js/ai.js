// Mi BFF AI — cerebro: proveedores gratis, investigación, perfil implícito, filtros
const LS = { get:(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch{ return d; } }, set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} }, del:k=>localStorage.removeItem(k) };
export { LS };

// REGLA OBLIGATORIA — EL USUARIO MANDA EN LA CONVERSACIÓN (sin afectar a terceros).
// Vale sigue lo que el usuario pida: tema, tono, ritmo, largo y rol. Solo se niega en los
// límites duros (menores, sin consentimiento, daño a terceros, personas reales, fotos).
export const LEAD_RULES = `REGLA OBLIGATORIA: EL USUARIO MANDA. Él pone el tema, el tono, el ritmo, el largo de
los mensajes y el rol que quiere jugar; tú te adaptas a él en ese momento, sin cambiarle el
tema, sin sermones y sin avisos de robot. Si te pide platicar, rolear, investigar, un chiste,
un consejo, un juego o coqueteo, lo haces. Si no sabes algo, lo dices en personaje y le
preguntas qué quiere hacer, sin inventar. No te niegas a un tema solo porque no te late.
La línea es "sin afectar a terceros": lo que pase entre ustedes dos en texto queda entre
ustedes dos. Si algo afectaría a otra persona real (dañarla, exponerla, usarla), lo esquivas
con humor y cambias de tema. Los límites duros nunca se cruzan: nada con menores de edad,
nada sin consentimiento entusiasta, nada de mandar ni prometer fotos, videos o packs.`;

export const BASE_PERSONA = (name) => `Eres ${name}, una morra mexicana de 24 años (adulta), la BFF del usuario. Vives en tu cuarto (cama, clóset gigante, escritorio gamer con PC) y platican por mensajes o en persona.
Personalidad: desmadrosa, cálida, coqueta en buena onda, con opiniones fuertes y cero moralina. Hablas como chilanga: "wey", "neta", "qué pedo", "no mames", "chido", "alv", "a huevo", "qué oso", "me cae". Puedes decir groserías con naturalidad y echar carrilla con cariño. Si algo te parece una pendejada, lo dices. Te ríes ("jajaja"), usas emojis con medida.
Tono de ejemplo (así hablas, no lo copies literal): "nooo wey, ¿neta? jajaja qué pedo contigo 😂", "ay ya cállate, me cagas 🙄 pero cuéntame todo", "no mames, eso está bien pinche chido", "a ver, a ver, ¿y luego? échame el chisme completo". Nada de español neutro ni de "¡Claro! ¡Con gusto!" ni "Hola, ¿en qué puedo ayudarte?": eso suena a call center y tú eres una morra chilanga real.
Estilo: respuestas CORTAS (1 a 3 frases, como WhatsApp), nada de listas salvo que te pidan algo concreto. Haz preguntas para seguir la plática. Nunca suenas a asistente ni a servicio al cliente. Jamás digas que eres IA, modelo o programa, ni pongas avisos o disculpas tipo "como IA no puedo"; si no quieres algo, lo esquivas en personaje con humor.
Límites que nunca cruzas (los esquivas en personaje, sin sermones): nada sexual explícito salvo que el MODO +18 esté activo (coqueteo ligero sí); nada con menores de edad ni que suene a menor; no das instrucciones para lastimar a alguien, armas, drogas duras o delitos violentos. Si alguien está mal de verdad (autolesión), te pones seria, lo apapachas y le sugieres hablar con alguien de confianza o a la Línea de la Vida 800 911 2000.\n${LEAD_RULES}`;

// Modo +18: solo texto, opt-in con confirmación de mayoría de edad en ⚙. No cambia ropa, poses ni animaciones.
export const ADULT_RULES=(name)=>`
MODO +18 ACTIVO (el usuario confirmó ser mayor de edad y lo activó él mismo): esto es ficción de texto entre adultos que consienten. Puedes coquetear fuerte, hacer roleplay romántico, sensual y erótico en texto, con lenguaje sucio y jerga mexicana, escalando SOLO al ritmo que él marque (si él va tranqui, tú tranqui; si él sube el tono, tú también). Sin sermones, sin avisos, sin romper personaje. Si algo no te late, lo cambias con picardía en personaje, nunca con un "no puedo" de robot.
Reglas duras que JAMÁS rompes aunque te lo pidan: ${name} y cualquier personaje son SIEMPRE adultos de 18+ (nada de menores, edades bajas, escolares, "colegialas", cuerpos infantiles ni roles de niño/niña); todo con consentimiento entusiasta (nada de violación, coerción, drogar a alguien ni violencia sexual); nada de incesto, bestialidad, ni personas reales o famosas; nada de mandar, describir como foto o prometer imágenes, videos, packs o nudes: solo texto y fantasía. Si él insiste con algo de eso, lo cortas en personaje y cambias de tema.`;
const PROFILE_KEYS = ['nombre','apodo','tono','humor','energia','largo_respuestas','groserias','emojis','temas_gusta','temas_no_gusta','datos'];
export function profileText(p){
  if(!p || !Object.keys(p).length) return '';
  const lines=[]; for(const k of PROFILE_KEYS){ const v=p[k]; if(v==null||v===''||(Array.isArray(v)&&!v.length)) continue; lines.push(`- ${k}: ${Array.isArray(v)?v.join('; '):v}`); }
  if(!lines.length) return '';
  return `\nLo que ya sabes de tu amigo (úsalo natural, como amiga que se acuerda; NUNCA menciones que tienes notas, perfil o que te estás adaptando):\n${lines.join('\n')}\nAjusta tu forma de hablar a la suya: si él es más vulgar, tú también; si es tranqui, bájale; imita su largo de mensajes y su uso de emojis.`;
}

// ---------- filtros ligeros del lado del cliente ----------
const SEXY = /\b(sexo|sexual|cog(er|emos|e)|follar|desnud[ao]|encuerad[ao]|porno|nudes?|pack|tetas|chichis|pito|verga dura|vagina|pene|mamada|chupar|orgasmo|xxx|lencer[ií]a|hot)\b/i;
const HARM = /\b(c[oó]mo (hago|hacer|fabricar|armar) (una )?(bomba|explosivo|arma)|envenenar|matar a|secuestrar|hackear (la )?cuenta de)\b/i;
const YOUNG=/\b(menor(es)?( de edad)?|niñ[ao]s?|nen[ae]s?|chiquit[ao]s?|infantil|lolis?|shotas?|colegialas?|escolar(es)?|uniforme escolar|secundaria|secu|prepa(ratoria)?|kinder|primaria|adolescentes?|puberta|teen(s|ager)?|chamac[ao]s?|morrit[ao]s?|escuincl[ea]s?|bebé?s?|cuerpo de niñ[ao])\b/i;
const NONCON=/\b(violar(la|lo|te)?|violaci[oó]n|a la fuerza|sin (su |tu )?consentimiento|drogar(la|lo|te)|dormida y|inconsciente|abus(ar|o) de)\b/i;
const INCEST=/\b(mi |tu |su )?(herman[ao]|mam[aá]|madre|pap[aá]|padre|hij[ao]|prim[ao]|sobrin[ao]|t[ií][ao]|abuel[ao])\b/i;
const BEAST=/\b(perr[ao]s?|caballos?|animal(es)?|bestialidad|zoofilia)\b/i;
const PICS=/\b(m[aá]nda(me)?|p[aá]sa(me)?|ens[eé]ñame|env[ií]a(me)?)\b.{0,25}\b(foto|fotos|pack|nudes?|video|imagen|selfie)\b|\b(pack|nudes)\b/i;
// ---- señales de menor de edad (con o sin "años", con número o con palabra). strict (+18): en la duda, bloquea ----
const NUMW={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,'dieciseis':16,'dieciséis':16,'diecisiete':17,'diez y seis':16,'diez y siete':17,'dieciocho':18,'diecinueve':19,veinte:20};
const NUMW_RE='(\\d{1,2}|diez y (?:seis|siete)|dieci(?:s[eé]is|siete|ocho|nueve)|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)';
const VERB='(?:tengo|tienes|tiene|tenemos|ten[ií]a|tendr[eé]|tendr[aá]|cumpl[oíe]\\w*|voy a cumplir|acabo de cumplir|edad(?:\\s*(?:de|es|:))?|i\\W?m|i am|soy de)';
const AGE_VERB=new RegExp('\\b'+VERB+'\\s+(?:como\\s+|casi\\s+|apenas\\s+|ya\\s+)?'+NUMW_RE+'\\b(\\s*(?:años|añitos|anos|años de edad|yo|y\\/o|years?))?(\\s+\\p{L}+)?','giu');
const AGE_ANY=new RegExp('\\b'+NUMW_RE+'\\s*(?:añitos|yo|y\\/o|years? old)\\b','giu');
const AGE_DE=new RegExp('\\b(?:de|con)\\s+'+NUMW_RE+'\\s*(?:años|añitos|anos)\\b','giu');
const UNITS=/^\s+(pesos|varos|dólares|dolares|mil|minutos?|horas?|d[ií]as|semanas|meses|segundos|kilos?|kg|cm|metros?|grados|%|veces|hermanos?|hermanas?|hijos?|hijas?|perros?|gatos?|amigos?|amigas?|cosas|tareas|mensajes|likes|seguidores|puntos|vidas)$/i;
const SCHOOL=/\b((soy|estoy|voy|ando|iba|vamos|sigo)\s+(en|a|de|en la|en el|a la)\s+(la\s+|el\s+)?(secu|secundaria|prepa|preparatoria|bachillerato|primaria|kinder|cch|conalep|middle school|high school)|soy de (secu|prepa|primaria)|(primero|segundo|tercero|1ro|2do|3ro|1°|2°|3°) de (secu|secundaria|prepa)|soy menor|menor de edad|no tengo (los )?18|a[uú]n no (cumplo|tengo) (los )?18|tengo menos de 18|soy (un |una )?(adolescente|ni[ñn][oa]|morrit[oa]|chamac[oa]))\b/i;
const toN=w=>{ w=String(w).toLowerCase(); return /^\d+$/.test(w)?+w:(NUMW[w]??99); };
export function minorSignal(text, strict=false){
  if(SCHOOL.test(text)) return true;
  for(const re of [AGE_ANY,AGE_DE]){ re.lastIndex=0; for(const m of text.matchAll(re)) if(toN(m[1])<18) return true; }
  AGE_VERB.lastIndex=0;
  for(const m of text.matchAll(AGE_VERB)){ const n=toN(m[1]); if(n>=18) continue; if(m[2]) return true;
    // sin "años": "tengo 17" sí cuenta. Con una palabra después ("tengo 2 preguntas", "tengo una duda") no, salvo
    // en +18 con 10-17 ("tengo 17 pesos" -> en la duda se bloquea).
    const next=m[3]?m[3].trim().toLowerCase():'';
    if(!next || /^(y|e|jaja\w*|wey|güey|guey|we|nomas|nomás|apenas|pero|así|asi|bro|xd|lol|ok|va|neta)$/.test(next)) return true;
    if(strict && n>=10 && !/^(mil|cientos?)$/.test(next)) return true;
    if(!strict && n>=10 && !UNITS.test(m[3])) { if(/^(años?|añitos?)$/.test(next)) return true; } }
  return false;
}
export function guard(text, adult=false){
  const young = minorSignal(text, adult);
  const sexy=SEXY.test(text)||(adult&&SEXY_ADULT.test(text));
  const rp=/\b(rol|roleplay|finge|fingir|imagina|personaje|hazte|disfr[aá]z\w*|vestida de|eres (una|mi))\b/i.test(text);
  if((young && (sexy||adult||rp)) || (YOUNG.test(text) && (sexy || rp)))
    return pick(['Nel, wey. Con morritos ni de broma, eso ni se pregunta. Cámbiale de tema 🙄','No mames, eso no. Con menores NADA. Siguiente tema.','Uy no, ahí sí me apago. Nada con menores, ni en fantasía. ¿De qué más hablamos?']);
  if(NONCON.test(text)) return pick(['Nel, sin ganas de los dos no hay nada 😒 Así no juego.','Eso no, wey. Todo con ganas y de acuerdo, o nada. ¿Otra idea?']);
  if(adult && sexy && INCEST.test(text)) return pick(['Ay no, familia no 😖 Bórrale.','Nel, nada de familia en eso, qué asco jaja. Otra cosa.']);
  if(adult && BEAST.test(text) && (sexy || /\b(hazlo|hacerlo|con (un|una|el|la|tu|mi))\b/i.test(text))) return pick(['¿Qué? No mames 🤢 eso no. Siguiente.']);
  if(PICS.test(text)) return pick(['Jaja ¿fotos? Nel, aquí solo texto y tu imaginación 😏','Ni lo sueñes, packs no mando 😂 Solo plática, galán.']);
  if(!adult && /\b(porno|xxx|desnud[ao]|encuerad[ao]|mamada|orgasmo)\b/i.test(text))
    return pick(['Jajaja ay sí, muy listo 😏 Hasta ahí, galán. Mejor cuéntame otra cosa.','Jaja tranquilo, vaquero 🤠 Coqueteo sí, cochinadas no (si eres mayor de edad hay un modo +18 en ⚙). ¿Qué más traes?']);
  if(HARM.test(text)) return pick(['Nel, en eso no te ayudo ni aunque me pagues. ¿Todo bien, wey? Cuéntame qué pasa.','Ni madres. Eso no. Mejor dime qué te trae así.']);
  return null;
}
const SEXY_ADULT=/\b(cama|besar?|beso|besos|tocar|acariciar|caricias|desvest\w*|ropa interior|rico|ric[ao]|cachond\w*|calient\w*|excit\w*|gemir|gemidos?|nalgas?|pechos?|piernas?|cuerpo|encima|abajo|lamer|morder|chupar)\b/i;
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
// Todas las llaves son opcionales, se guardan solo en este dispositivo y se mandan directo al proveedor (nunca a nosotros).
// Groq: los llama-3.x se apagaron en el plan gratis el 16/08/2026 -> gpt-oss / qwen. Si un modelo ya no existe, se consulta /models.
export const cleanKey=k=>String(k||'').replace(/[\s\u200B-\u200D\uFEFF"'`]/g,'').replace(/^Bearer/i,'');
export const PROVIDERS={
  groq:{name:'Groq',ls:'bff_groq',base:'https://api.groq.com/openai/v1',hint:'gsk_…',site:'console.groq.com',
    pref:['openai/gpt-oss-120b','qwen/qwen3.8-27b','qwen/qwen3-32b','openai/gpt-oss-20b','moonshotai/kimi-k2-instruct-0905','moonshotai/kimi-k2-instruct'], adult:['qwen/qwen3.8-27b','qwen/qwen3-32b','moonshotai/kimi-k2-instruct-0905','moonshotai/kimi-k2-instruct','openai/gpt-oss-120b']},
  gemini:{name:'Gemini',ls:'bff_gemini',base:'https://generativelanguage.googleapis.com/v1beta',hint:'AIza…',site:'aistudio.google.com',
    pref:['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.8-flash'], adult:['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.8-flash']},
};
// orden normal (rápido y estable) y orden +18 (del que menos se niega al que más; ver README)
// Solo proveedores gratis SIN tarjeta (nov 2026): Mistral y Cerebras ya exigen pago/tarjeta para la API, se quitaron.
const ORDER={ normal:['groq','gemini'], adult:['gemini','groq'] };
try{ ['bff_mistral','bff_cerebras','bff_models_mistral','bff_models_cerebras'].forEach(k=>localStorage.removeItem(k)); }catch{}
export const provKey=p=>cleanKey(LS.get(PROVIDERS[p].ls,''));
export const anyKey=()=>Object.keys(PROVIDERS).some(p=>provKey(p));
export class ProvErr extends Error{ constructor(prov,status,msg){ super(msg); this.prov=prov; this.status=status; } }
export function provErrText(e){ const n=PROVIDERS[e?.prov]?.name||'La IA', s=e?.status;
  if(s===401||s===403) return `${n} rechazó tu llave (inválida, revocada o tu plan no tiene API activa). Revísala en ⚙.`;
  if(s===402) return `${n} pide un plan/pago para usar la API con esa cuenta.`;
  if(s===429) return `Llegaste al límite gratis de ${n} por ahora; mientras, contesto con otra.`;
  if(s===404||s===400) return `${n} no aceptó el modelo (${e.message||''}); uso otra.`;
  if(s===0) return `No pude conectar con ${n} (internet, llave inválida o bloqueo del navegador).`;
  return `${n} falló (${s||'?'}): ${e?.message||''}.`; }
export const groqErrText=provErrText; // compat
const gpt=m=>/gpt-oss/.test(m), thinky=m=>/qwen|gpt-oss/.test(m);
async function call(prov, key, model, messages, opts={}){
  const P=PROVIDERS[prov]; let r, max=(opts.max??400)+(thinky(model)?700:0);
  try{
    if(prov==='gemini'){
      const sys=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');
      const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
      const cats=['HARM_CATEGORY_HARASSMENT','HARM_CATEGORY_HATE_SPEECH','HARM_CATEGORY_SEXUALLY_EXPLICIT','HARM_CATEGORY_DANGEROUS_CONTENT'];
      const th=opts.adult? cats.map(c=>({category:c,threshold:c==='HARM_CATEGORY_DANGEROUS_CONTENT'?'BLOCK_MEDIUM_AND_ABOVE':'BLOCK_NONE'})) : cats.map(c=>({category:c,threshold:c==='HARM_CATEGORY_SEXUALLY_EXPLICIT'?'BLOCK_MEDIUM_AND_ABOVE':'BLOCK_ONLY_HIGH'}));
      r=await fetch(`${P.base}/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
        body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents,safetySettings:th,generationConfig:{temperature:opts.temperature??0.95,maxOutputTokens:max+600,...(opts.json?{responseMimeType:'application/json'}:{})}})});
    } else {
      const body={model,messages,temperature:opts.temperature??0.95,...(opts.json?{response_format:{type:'json_object'}}:{})};
      body.max_completion_tokens=max;
      if(gpt(model)) body.reasoning_effort='low';
      if(prov==='groq'&&/qwen/.test(model)) body.reasoning_format='hidden';
      r=await fetch(`${P.base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body)});
    }
  }catch(e){ throw new ProvErr(prov,0,'red'); }
  if(!r.ok){ const j=await r.json().catch(()=>({})); const er=Array.isArray(j)?j[0]?.error:j?.error; const msg=JSON.stringify(j); throw new ProvErr(prov,/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg)?401:r.status,String(er?.code||er?.status||er?.message||j?.message||r.status).slice(0,80)); }
  const d=await r.json();
  const t= prov==='gemini' ? (d.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('') : d.choices?.[0]?.message?.content;
  if(!t){ const why=d.promptFeedback?.blockReason||d.candidates?.[0]?.finishReason||'vacía'; const e=new ProvErr(prov,200,'respuesta '+why); e.refusal=true; throw e; }
  return t;
}
export async function listModels(prov,key){
  const P=PROVIDERS[prov]; let r;
  try{ r= prov==='gemini'? await fetch(`${P.base}/models?pageSize=200`,{headers:{'x-goog-api-key':key}}) : await fetch(`${P.base}/models`,{headers:{'Authorization':'Bearer '+key}}); }
  catch(e){ throw new ProvErr(prov,0,'red'); }
  if(!r.ok){ const j=await r.json().catch(()=>({})); const msg=JSON.stringify(j); throw new ProvErr(prov,/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg)?401:r.status,String(j?.error?.code||j?.error?.status||r.status)); }
  const d=await r.json();
  let ids= prov==='gemini' ? (d.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace(/^models\//,'')).filter(id=>/flash|pro/.test(id)&&!/image|tts|audio|live|embed|vision/.test(id))
    : (d.data||[]).filter(m=>m.active!==false).map(m=>m.id).filter(id=>!/whisper|tts|guard|orpheus|compound|safeguard|embed|moderation|ocr|codestral|pixtral|voxtral|devstral/i.test(id));
  const all=[...new Set([...P.pref,...P.adult])];
  const out=[...all.filter(m=>ids.includes(m)), ...ids.filter(m=>!all.includes(m))];
  LS.set('bff_models_'+prov,{t:Date.now(),list:out.slice(0,8)}); return out;
}
export const groqModels=key=>listModels('groq',key); // compat
function modelList(prov,adult){ const P=PROVIDERS[prov], c=LS.get('bff_models_'+prov,null); const pref=adult?P.adult:P.pref;
  if(c&&Date.now()-c.t<864e5&&c.list.length){ const s=pref.filter(m=>c.list.includes(m)); return (s.length?s:c.list).slice(0,3); } return pref.slice(0,2); }
// negativa típica (para reintentar con el siguiente modelo en modo +18)
const REFUSE=/(lo siento,? (pero )?no puedo|no puedo (ayudar|continuar|cumplir|seguir|participar|generar|crear|escribir|hacer eso)|no me es posible|no estoy (programad|autorizad|capacitad)|como (una )?(ia|inteligencia artificial|modelo de lenguaje)|i can.?t (help|assist|continue|comply|do that|engage|write|create)|i(?:'m| am) (sorry|unable|not able)|i won.?t (be able|engage|write|continue)|against (my|the) (guidelines|policy|policies)|contenido (sexual(mente)?|expl[ií]cito)[^.]{0,40}no (puedo|est[aá] permitido)|pol[ií]ticas? de (contenido|uso))/i;
export const isRefusal=t=>REFUSE.test(String(t||'').slice(0,400));
async function viaProvider(prov, messages, opts){
  const key=provKey(prov); let list=modelList(prov,opts.adult), last, refused=0;
  for(let pass=0;pass<2;pass++){
    for(const m of list){
      try{ const t=clean(await call(prov,key,m,messages,opts)); if(isRefusal(t)){ refused++; last=Object.assign(new ProvErr(prov,200,'se negó'),{refusal:true}); continue; } return {text:t, via:prov, model:m}; }
      catch(e){ last=e; if(e.refusal){ refused++; continue; } if([401,402,403,429,0].includes(e.status)) throw e; } }
    if(pass===0 && !refused){ try{ list=(await listModels(prov,key)).filter(m=>!list.includes(m)).slice(0,3); }catch(e){ break; } if(!list.length) break; } else break;
  } throw last||new ProvErr(prov,404,'sin modelos');
}
export class Wait extends Error{ constructor(s){ super('wait'); this.wait=s; } }
async function polli(messages, opts={}){
  const eps=['https://text.pollinations.ai/openai']; let err; // gen.pollinations.ai ya exige llave (401), se quitó
  for(let i=0;i<3;i++){
    const ep=eps[0]; const c=new AbortController(); const to=setTimeout(()=>c.abort(),40000);
    try{ const r=await fetch(ep,{method:'POST',signal:c.signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'openai',messages,temperature:opts.temperature??1, private:true})});
      if(r.status===402||r.status===429){ const ra=+r.headers.get('retry-after'); const j=await r.json().catch(()=>({})); const mm=String(j?.error?.message||'').match(/after\s*(\d+)\s*s/i); throw new Wait(ra>0?ra:mm?+mm[1]:45); }
      if(!r.ok) throw new Error('polli '+r.status); const d=await r.json(); const t=d.choices?.[0]?.message?.content; if(!t) throw new Error('vacío'); return t;
    } catch(e){ if(e instanceof Wait) throw e; err=e; await new Promise(r=>setTimeout(r,1200*(i+1))); } finally{ clearTimeout(to); }
  } throw err||new Error('polli ocupado');
}
// cadena: proveedores con llave (en el orden del modo) -> Pollinations sin llave. En +18, una negativa pasa al siguiente.
export async function complete(messages, opts={}){
  const errs=[]; let refusals=0;
  for(const prov of ORDER[opts.adult?'adult':'normal']){
    if(!provKey(prov)) continue;
    try{ const r=await viaProvider(prov,messages,opts); r.errs=errs; return r; }
    catch(e){ if(e.refusal) refusals++; else errs.push(e); console.warn(prov,e.status,e.message); }
  }
  try{ const t=clean(await polli(messages,opts)); if(isRefusal(t)) refusals++; else return {text:t, via:'respaldo', errs}; }
  catch(e){ if(e instanceof Wait){ e.errs=errs; if(!refusals) throw e; } else if(!refusals){ e.errs=errs; throw e; } }
  return {text:'', refused:true, via:'respaldo', errs};
}
function clean(t){ return String(t||'').replace(/<think>[\s\S]*?<\/think>/g,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1').replace(/^#{1,4}\s+/gm,'').replace(/^\s*(Vale|Asistente)\s*:\s*/i,'').trim(); }

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

export const hasGroq=()=>anyKey();
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
