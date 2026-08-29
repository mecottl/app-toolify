# 🧰 Toolify

Caja de herramientas web personal. Corre 100% en tu equipo: un servidor Node local
con una sola interfaz para descargas, multimedia, imágenes, texto y generadores.

## Arrancar

```bash
npm install
npm start
```

Abre <http://localhost:4747>. En Windows también sirve el doble clic en `iniciar.bat`.
Desde el celular (misma WiFi) usa `http://TU-IP:4747` (la IP aparece en la terminal al arrancar).

## Requisitos

- **Node.js** 18+
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** y **[ffmpeg](https://ffmpeg.org/)** disponibles en el `PATH`
  (solo necesarios para las herramientas de Descargas y Multimedia).

Si las descargas empiezan a fallar (error 403 de YouTube), actualiza yt-dlp: `yt-dlp -U`.

## Herramientas

| Grupo | Herramientas |
|---|---|
| **Descargas** (yt-dlp) | Audio → MP3 · Video → MP4 (YouTube, TikTok, Instagram, X, Twitch, SoundCloud…) · Subtítulos de YouTube (.srt + texto). Con recorte por tiempo. |
| **Multimedia** (ffmpeg) | Cambiar formato (a video o solo audio; rechaza audio→video) · Recortar · Comprimir video · Extraer audio · Video → GIF |
| **Imágenes** (sharp) | Convertir / redimensionar / comprimir (quita EXIF, admite varias) · Imágenes → PDF |
| **Texto y código** | JSON formatear/minificar/validar · YAML ↔ JSON · CSV → tabla/JSON · Base64 y URL · Decodificar JWT · Hash (MD5/SHA-1/256/512) · Diff de textos · Contador de palabras |
| **Generadores** | Contraseñas · UUID v4 · Código QR (PNG + SVG) |
| **Archivos y web** | Comprimir a ZIP · Descomprimir ZIP · Desenrollar un enlace (redirecciones + vista previa) |

Las categorías del menú se pliegan/despliegan (el estado se guarda). Los resultados muestran
vista previa en línea de imágenes, video, audio y PDF. El botón **🧹 Limpiar** borra todo lo
temporal (`work/` y `downloads/`).

## Arquitectura

```
server.js          Express + mapa TOOLS + endpoints (jobs, SSE, descarga, quick, clean)
lib/
  jobs.js          store de trabajos, SSE, helper para lanzar procesos
  media.js         yt-dlp (descargas, subtítulos)
  ffmpeg.js        conversión, recorte, compresión, GIF
  images.js        sharp + pdfkit
  files.js         zip / unzip
  quick.js         yaml, hash, qr, unwrap (respuesta JSON directa)
public/
  tools.js         registro declarativo de herramientas (kind: job | quick | client)
  app.js           renderiza el formulario y ejecuta cada herramienta
  style.css
```

### Añadir una herramienta

1. **Backend** (si aplica): una función en `lib/` con la firma `(job, { params, files, outDir })`
   que termine llamando `finish(job.id, archivos)`.
2. Regístrala en el objeto `TOOLS` de `server.js`.
3. **Frontend**: agrega un objeto al arreglo de `public/tools.js`. La UI se genera sola.

## Desplegar (hosting)

**No sirve Vercel/Netlify** (serverless): Toolify necesita procesos largos, binarios del
sistema (ffmpeg, yt-dlp) y escribir en disco. Usa un host de contenedores.

El repo ya trae `Dockerfile` (Node + ffmpeg + yt-dlp) y `render.yaml`.

### Render (recomendado, tiene plan gratis)
1. <https://dashboard.render.com> → **New + → Blueprint** → elige este repo.
2. Render lee `render.yaml` y crea el servicio con Docker.
3. En **Environment**, define `AUTH_USER` y `AUTH_PASS` (protege la app con usuario/contraseña).
4. Deploy. Te da una URL `https://toolify-xxxx.onrender.com`.

Plan free: 512 MB RAM y se duerme tras 15 min de inactividad (primer acceso tarda ~30 s).
Las conversiones de video grandes pueden ir lentas o quedarse sin memoria; para eso, sube de plan.

### Railway / Fly.io / Cloud Run
Mismo `Dockerfile`. En Railway: *New Project → Deploy from GitHub repo*. En Fly: `fly launch`.

### Local con Docker
```bash
docker build -t toolify .
docker run -p 4747:4747 -e AUTH_USER=yo -e AUTH_PASS=1234 toolify
```

### Autenticación
Si defines `AUTH_USER` **y** `AUTH_PASS`, toda la app queda tras HTTP Basic auth.
Sin esas variables no hay auth (modo local).

## Aviso

Uso personal. Esta app **no trae autenticación ni límites de uso**: si la expones a internet,
protégela (auth básica, rate-limit) — es un descargador abierto y hace peticiones a URLs
arbitrarias. No está pensada para hosting serverless (Vercel/Netlify): necesita procesos
largos, binarios del sistema y disco. Para desplegarla usa Render / Railway / Fly.io / un VPS.

Respeta los derechos de autor y los términos de servicio de cada sitio.
