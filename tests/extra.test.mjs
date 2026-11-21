// Pruebas de los cambios v1.4.2–v1.4.5 (node tests/extra.test.mjs). Corre sin navegador.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const { guard, researchQuery, localProfile, BASE_PERSONA } = await import('../js/ai.js');
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
console.log(fail?`${fail} fallas`:'OK: pruebas extra'); process.exit(fail?1:0);
