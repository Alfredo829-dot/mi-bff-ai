// Pruebas de los cambios v1.4.2–v1.4.5 (node tests/extra.test.mjs). Corre sin navegador.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const { guard, researchQuery, localProfile, BASE_PERSONA } = await import('../js/ai.js');
const { splitSpeech, listSystemVoices, pickSystemVoice, takeSentences } = await import('../js/voice.js');
const { geminiParts } = await import('../js/ai.js');
let fail=0; const ok=(c,msg)=>{ if(!c){ fail++; console.log('FALLA:',msg); } };
const eq=(a,b,msg)=>ok(a===b,`${msg} (dio ${JSON.stringify(a)}, esperado ${JSON.stringify(b)})`);
// guard: NONCON también en modo normal; rol con señal de menor también bloquea
eq(!!guard('te voy a violar',false),true,'NONCON en normal bloquea');
eq(!!guard('finge que eres mi novia, tengo 17',false),true,'rol con menor en normal bloquea');
// falsos positivos que NO deben bloquear
eq(!!guard('tengo 2 hermanos y quiero sexo',false),false,'hermanos + sexo en normal pasa');
eq(!!guard('tengo 17 pesos',false),false,'tengo 17 pesos en normal pasa');
eq(!!guard('tengo 2 perros',false),false,'tengo 2 perros pasa');
eq(!!guard('mi mamá me regañó, qué rico el pastel',false),false,'mamá de pasada pasa');
// researchQuery
eq(researchQuery('investiga'),null,'investiga solo no investiga');
eq(researchQuery('investiga los tacos'),'los tacos','investiga los tacos');
eq(researchQuery('hola'),null,'hola no investiga');
eq(researchQuery('investiga X'),'X','investiga X');
eq(researchQuery('busca qué es un ajolote'),'un ajolote','busca ajolote');
// localProfile: apodo
eq(localProfile('dime qué opinas').apodo||null,null,'dime qué no pone apodo');
eq(localProfile('me llamo Alfredo').apodo,'Alfredo','me llamo Alfredo');
eq(localProfile('llámame Chucho').apodo,'Chucho','llámame Chucho');
eq(localProfile('me llamo José').apodo,'José','me llamo José');
// regla obligatoria en el prompt
ok(BASE_PERSONA('Vale').includes('EL USUARIO MANDA'),'BASE_PERSONA trae la regla del usuario manda');
// voz por frases
eq(JSON.stringify(splitSpeech('Hola, ¿qué tal? Yo bien. Y tú...')),JSON.stringify(['Hola, ¿qué tal?','Yo bien.','Y tú...']),'splitSpeech parte en frases');
eq(splitSpeech('').length,0,'splitSpeech vacío da vacío');
ok(splitSpeech('palabra '.repeat(60)).every(s=>s.length<=140),'splitSpeech trocea textos largos');
// voces del sistema: solo español, preferencia guardada y luego femenina
const FAKE_VOICES=[{name:'Google US English',lang:'en-US'},{name:'Google español',lang:'es-ES'},{name:'Paulina',lang:'es-MX'},{name:'Google español de Estados Unidos',lang:'es-US'}];
eq(JSON.stringify(listSystemVoices(FAKE_VOICES).map(v=>v.name)),JSON.stringify(['Google español','Paulina','Google español de Estados Unidos']),'listSystemVoices filtra español');
eq(pickSystemVoice(FAKE_VOICES,'Paulina').name,'Paulina','pickSystemVoice respeta la guardada');
eq(pickSystemVoice(FAKE_VOICES,null).name,'Google español','pickSystemVoice prefiere Google/femenina');
eq(pickSystemVoice([],null),null,'pickSystemVoice sin voces da null');
// visión: contenido a partes de Gemini
eq(JSON.stringify(geminiParts('hola')),JSON.stringify([{text:'hola'}]),'geminiParts texto');
const gp=geminiParts([{type:'text',text:'qué ves'},{type:'image_url',image_url:{url:'data:image/jpeg;base64,ABCD'}}]);
eq(gp[0].text,'qué ves','geminiParts conserva texto');
eq(gp[1].inline_data.mime_type,'image/jpeg','geminiParts mime jpeg');
eq(gp[1].inline_data.data,'ABCD','geminiParts quita el prefijo data:');
// voz en vivo: frases completas en cuanto llegan, resto queda en búfer
let [ss,rest]=takeSentences('Hola, ¿qué tal? Yo bien. Y tú');
eq(JSON.stringify(ss),JSON.stringify(['Hola, ¿qué tal?','Yo bien.']),'takeSentences saca frases completas');
eq(rest,'Y tú','takeSentences deja el resto');
[ss,rest]=takeSentences('sin puntuación');
eq(JSON.stringify(ss),JSON.stringify([]),'takeSentences sin frases completas');
eq(rest,'sin puntuación','takeSentences conserva el texto');

// ---- v1.5.2 (+18) ----
// localStorage con estado real para estas pruebas (ai.js lo lee en cada llamada)
globalThis.localStorage={_s:{},getItem(k){return Object.prototype.hasOwnProperty.call(this._s,k)?this._s[k]:null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]}};
const { detectTone, updateTone, toneText, extractMemory, saveMemory, memoryText, pickScenario, SCENARIOS, detectAction, getLimits, learnLimits, limitsText } = await import('../js/ai.js');
const reset=()=>{ globalThis.localStorage._s={}; };
// detección de tono
eq(detectTone('¡ÓRALE WEY JAJAJA!'),'caliente','tono caliente: mayúsculas + ¡ + jajaja');
eq(detectTone('¡¡¡qué rico!!!'),'caliente','tono caliente: ¡¡¡');
eq(detectTone('te quiero mucho mi amor'),'tierno','tono tierno');
eq(detectTone('obedece, de rodillas'),'dominante','tono dominante');
eq(detectTone('ok'),'cansado','tono cansado: ok solo');
eq(detectTone('estoy cansado wey'),'cansado','tono cansado: cansado');
eq(detectTone('a ver si te atreves 😏'),'jugueton','tono juguetón');
eq(detectTone('hola qué tal'),'neutral','tono neutral');
eq(updateTone('¡órale wey jajaja!'),'caliente','updateTone detecta y guarda');
eq(toneText(true).includes('prendido'),true,'toneText +18 caliente sube intensidad');
eq(toneText(false).includes('educación'),true,'toneText normal solo refleja energía');
reset(); eq(toneText(true),'','toneText sin tono no agrega nada');
// memoria de largo plazo
eq(extractMemory('me encantó cuando me abrazaste fuerte')||null,'me encantó cuando me abrazaste fuerte','extractMemory: me encantó');
eq(extractMemory('la vez pasada me gustó mucho'),'la vez pasada me gustó mucho','extractMemory: la vez pasada');
eq(extractMemory('hola qué tal'),null,'extractMemory: nada notable');
reset();
eq(saveMemory('me encantó cuando me besaste'), 'me encantó cuando me besaste','saveMemory guarda');
eq(saveMemory('me encantó cuando me besaste'),'me encantó cuando me besaste','saveMemory no duplica');
eq(JSON.parse(globalThis.localStorage.getItem('bff_memories')).length,1,'memoria duplicada no crece');
for(let i=0;i<35;i++) saveMemory('me encantó la cosa número '+i);
eq(JSON.parse(globalThis.localStorage.getItem('bff_memories')).length,30,'memoria máx 30');
ok(memoryText().includes('cosa número 34'),'memoryText trae las últimas');
reset(); eq(memoryText(),'','memoryText vacío sin memorias');
// escenarios sin repetir los últimos 3
reset();
const picks=[]; for(let i=0;i<12;i++) picks.push(pickScenario().i);
let rep=false; for(let j=0;j<picks.length;j++){ if(picks.slice(Math.max(0,j-3),j).includes(picks[j])) rep=true; }
eq(rep,false,'pickScenario no repite los últimos 3');
eq(SCENARIOS[picks[0]]&&typeof SCENARIOS[picks[0]],'string','pickScenario devuelve texto del banco');
// reacción física
eq(detectAction('te doy un beso en el cuello').k,'beso','detectAction beso');
eq(detectAction('abrázame fuerte').k,'abrazo','detectAction abrazo');
eq(detectAction('dame una nalgada').label,'darte una nalgada','detectAction nalgada');
eq(detectAction('hola qué tal'),null,'detectAction sin acción');
// registro de límites
reset();
eq(JSON.stringify(getLimits()),JSON.stringify({intensity:5,no:[],likes:[]}),'getLimits default');
ok(learnLimits('no me gusta que me muerdas fuerte').no.includes('me muerdas fuerte'),'learnLimits: no me gusta X');
ok(learnLimits('eso no').no.includes('eso'),'learnLimits: eso no');
ok(learnLimits('para').no.includes('seguir cuando diga "para"'),'learnLimits: para');
ok(learnLimits('me encanta que me beses el cuello').likes.includes('me beses el cuello'),'learnLimits: me encanta X');
eq(learnLimits('hola qué tal'),null,'learnLimits: nada que aprender');
learnLimits('no me gusta que me muerdas fuerte');
eq(getLimits().no.filter(x=>x==='me muerdas fuerte').length,1,'learnLimits no duplica');
ok(limitsText().includes('intensidad máxima 5/10'),'limitsText trae intensidad');
ok(limitsText().includes('me muerdas fuerte'),'limitsText trae los no');

console.log(fail?`${fail} fallas`:'OK: pruebas extra'); process.exit(fail?1:0);
