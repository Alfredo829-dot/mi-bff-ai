# Mi BFF AI
Tu BFF virtual (Vale, adulta de 24) en su cuarto: platica por "WhatsApp" o en persona con micrófono, le pides que investigue y camina a su compu, y le cambias el look en el clóset.

- **IA gratis, sin tarjeta:** Pollinations (sin llave, respaldo) o tu llave opcional de **Groq** (console.groq.com) y/o **Gemini** (aistudio.google.com). Las llaves se guardan solo en el navegador. Si un modelo ya no existe, se consulta `/models` y se usa otro. Mistral y Cerebras se quitaron: su API ya exige pago/tarjeta (nov 2026).
- **Modo +18 (solo texto):** opcional en ⚙, apagado por defecto, con confirmación de mayoría de edad. Límites duros en el prompt y en `guard()`: todo entre adultos, nada con menores (si hay señal de menor, el modo se apaga solo), consentimiento, nada de incesto/bestialidad/personas reales, nunca imágenes.
- **Escena:** cuarto fijo (`img2/cuarto.webp`), poses recortadas por atuendo (`img2/{pose}-{atuendo}.webp` + máscara y `poses-*.json` con marcas de ojos/boca), traslados en clips MP4 con alfa apilado (`clips2/`), puppet WebGL que respira, parpadea y habla.
- **Voz natural offline:** Piper `es_MX-claude-high` vía vits-web (MIT), ~63 MB una sola vez.
- **Versión:** una sola constante `VERSION` en `js/app.js`; el service worker se registra como `sw.js?v=VERSION` y nombra su caché con ella. Imágenes y clips: stale-while-revalidate.
- **Pruebas:** `node tests/guard.test.mjs` (filtro de menores y límites +18).

Todos los datos se quedan en el dispositivo del usuario (localStorage).
