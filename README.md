# Mi BFF AI
Tu BFF virtual (Vale, adulta de 24) en su cuarto: platica por "WhatsApp" o en persona con micrófono, le pides que investigue y camina a su compu, y le cambias el look en el clóset.

- **IA gratis, sin tarjeta:** Pollinations (sin llave, respaldo) o tu llave opcional de **Groq** (console.groq.com) y/o **Gemini** (aistudio.google.com). Las llaves se guardan solo en el navegador. Si un modelo ya no existe, se consulta `/models` y se usa otro. Mistral y Cerebras se quitaron: su API ya exige pago/tarjeta (nov 2026).
- **Modo +18 (solo texto):** opcional en ⚙, apagado por defecto, con confirmación de mayoría de edad. Límites duros en el prompt y en `guard()`: todo entre adultos, nada con menores (si hay señal de menor, el modo se apaga solo), consentimiento, nada de incesto/bestialidad/personas reales, nunca imágenes.
- **Escena:** cuarto fijo (`img2/cuarto.webp`), poses recortadas por atuendo (`img2/{pose}-{atuendo}.webp` + máscara y `poses-*.json` con marcas de ojos/boca), traslados en clips MP4 con alfa apilado (`clips2/`), puppet WebGL que respira, parpadea y habla.
- **Voz natural offline:** Piper `es_MX-claude-high` vía vits-web (MIT), ~63 MB una sola vez.
- **Versión:** una sola constante `VERSION` en `js/app.js`; el service worker se registra como `sw.js?v=VERSION` y nombra su caché con ella. Imágenes y clips: stale-while-revalidate.
- **Pruebas:** `node tests/guard.test.mjs` (filtro de menores y límites +18) y `node tests/extra.test.mjs` (regla del usuario manda, NONCON en normal, apodo, researchQuery).
- **Conversación:** regla obligatoria, el usuario manda — Vale sigue tu tema, tono, ritmo y rol, sin cambiarte la plática; los límites duros (menores, sin consentimiento, daño a terceros, fotos) no se cruzan.
- **Ambiente:** polvo flotando, luz según la hora del día, viñeta, Vale te sigue con la mirada y brillo de la pantalla de la compu.
- **v1.4.3:** Vale te busca si te quedas callado 4 minutos; saludo según la hora; se ve la espera cuando la IA gratis tarda; el apodo ya no se confunde con "qué"; el service worker ya no falla si un archivo del caché falla.
- **v1.4.4:** integración de OpenRouter/Venice para el modo +18, descartada por decisión de Alfredo (opción D: nos quedamos en Groq gratis, sin pagar).
- **v1.4.5:** `phoneHold` ya nace inicializado; las poses avisan si su JSON falla; "investiga" sin tema ya no busca la palabra "investiga".
- **v1.4.6:** la descarga de la voz ya no guarda páginas de error como si fueran el modelo (eso la dejaba muda para siempre); en Ajustes hay botón para borrar la voz descargada y el botón de descarga ya dice si falló.
- **v1.4.7:** boca: al hablar se borra la boca dibujada (relleno con la piel de alrededor) y se dibuja una boca abierta estilo anime en su lugar, en las 6 poses × 3 atuendos; marcas de ojos/boca re-medidas en compu y clóset; barbilla semitransparente del clóset corregida; shader en alta precisión en cel. Velocidad: streaming (el texto aparece mientras llega), tope de 15–20 s por proveedor, lista de modelos precalentada, menos espera artificial, voz que empieza a hablar con la 1a frase. Animaciones: si el clip no bajó en 2.5 s hay transición suave en vez de congelarse, se liberan los decodificadores de video, toques seguidos van solo al último destino, un error en un cuadro ya no congela la escena, recarga si el cel pierde WebGL. ↻ otra respuesta en el último mensaje.
- **Créditos de ideas:** streaming SSE, "regenerar" y contexto recortado inspirados en SillyTavern (AGPL-3.0, solo ideas, sin código copiado). Mapeo de volumen a apertura de boca en decibeles con ataque/suelta inspirado en ryza-ai-revive (MIT, idea reimplementada).

Todos los datos se quedan en el dispositivo del usuario (localStorage).
