/* ---------- helpers for client-side tools ---------- */
const b64 = {
  enc: (s) => btoa(unescape(encodeURIComponent(s))),
  dec: (s) => decodeURIComponent(escape(atob(s.replace(/\s+/g, "")))),
};
const b64url = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
};

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ""));
}

function lineDiff(a, b) {
  const A = a.split("\n"), B = b.split("\n");
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push("  " + A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push("- " + A[i++]);
    else out.push("+ " + B[j++]);
  }
  while (i < A.length) out.push("- " + A[i++]);
  while (j < B.length) out.push("+ " + B[j++]);
  return out.join("\n") || "(los textos son idénticos)";
}

/* ---------- tool registry ---------- */
window.TOOLS = [
  /* === Descargas === */
  {
    id: "dl-audio", cat: "Descargas", ico: "🎵", name: "Audio de la web (MP3)",
    desc: "YouTube, TikTok, Instagram, X, Twitch, SoundCloud… Descarga solo el audio en MP3 de máxima calidad.",
    kind: "job",
    fields: [
      { name: "url", label: "Enlace", type: "url", placeholder: "https://www.youtube.com/watch?v=…" },
      { name: "start", label: "Desde (opcional, ej. 1:30)", type: "text", placeholder: "" },
      { name: "end", label: "Hasta (opcional, ej. 2:45)", type: "text", placeholder: "" },
    ],
    params: () => ({ format: "mp3" }), submit: "Descargar MP3",
  },
  {
    id: "dl-video", cat: "Descargas", ico: "🎬", name: "Video de la web (MP4)",
    desc: "Descarga el video con la mejor resolución disponible y lo une en un MP4.",
    kind: "job",
    fields: [
      { name: "url", label: "Enlace", type: "url", placeholder: "https://…" },
      { name: "start", label: "Desde (opcional)", type: "text" },
      { name: "end", label: "Hasta (opcional)", type: "text" },
    ],
    params: () => ({ format: "mp4" }), submit: "Descargar MP4",
  },
  {
    id: "dl-subs", cat: "Descargas", ico: "💬", name: "Subtítulos de YouTube",
    desc: "Baja los subtítulos (o autogenerados) en .srt y también en texto plano.",
    kind: "job",
    fields: [
      { name: "url", label: "Enlace", type: "url", placeholder: "https://www.youtube.com/watch?v=…" },
      { name: "lang", label: "Idioma", type: "select", options: ["es", "en", "pt", "fr", "de", "it", "ja"], def: "es" },
    ],
    submit: "Obtener subtítulos",
  },

  /* === Multimedia === */
  {
    id: "conv-media", cat: "Multimedia", ico: "🔄", name: "Cambiar el formato de un archivo",
    desc: "Reempaqueta o recodifica un archivo local a otro contenedor. Un video puede ir a video o a solo audio; un archivo de solo audio (mp3, wav…) solo puede convertirse a otro formato de audio.",
    kind: "job",
    fields: [
      { name: "file", label: "Archivo de audio o video", type: "file", accept: "video/*,audio/*" },
      { name: "format", label: "Convertir a", type: "select", def: "mp4",
        optgroups: [
          { label: "Contenedor de video (necesita un video de entrada)", options: ["mp4", "mkv", "webm", "mov"] },
          { label: "Solo audio", options: ["mp3", "m4a", "wav", "flac", "ogg"] },
        ],
        hint: "Convertir de solo audio a un formato de video NO añade imagen: sigue siendo audio dentro de otro archivo." },
    ],
    submit: "Convertir",
  },
  {
    id: "trim-media", cat: "Multimedia", ico: "✂️", name: "Recortar audio / video",
    desc: "Quédate solo con el fragmento entre dos tiempos. Sin recodificar cuando se puede.",
    kind: "job",
    fields: [
      { name: "file", label: "Archivo", type: "file", accept: "video/*,audio/*" },
      { name: "start", label: "Desde (ej. 0:10)", type: "text", placeholder: "0:00" },
      { name: "end", label: "Hasta (ej. 1:30, opcional)", type: "text" },
    ],
    submit: "Recortar",
  },
  {
    id: "compress-video", cat: "Multimedia", ico: "🗜️", name: "Comprimir video",
    desc: "Baja el peso para mandarlo por correo o chat. Sale en MP4 (H.264).",
    kind: "job",
    fields: [
      { name: "file", label: "Video", type: "file", accept: "video/*" },
      { name: "level", label: "Calidad", type: "select", options: ["alta", "media", "baja"], def: "media" },
    ],
    submit: "Comprimir",
  },
  {
    id: "extract-audio", cat: "Multimedia", ico: "🎧", name: "Extraer audio de un video",
    desc: "Saca la pista de audio de un archivo de video local.",
    kind: "job",
    fields: [
      { name: "file", label: "Video", type: "file", accept: "video/*" },
      { name: "format", label: "Formato", type: "select", options: ["mp3", "m4a", "wav", "flac", "ogg"], def: "mp3" },
    ],
    submit: "Extraer audio",
  },
  {
    id: "to-gif", cat: "Multimedia", ico: "🖼️", name: "Video → GIF",
    desc: "Convierte un clip en un GIF con paleta optimizada.",
    kind: "job",
    fields: [
      { name: "file", label: "Video", type: "file", accept: "video/*" },
      { name: "start", label: "Desde (opcional)", type: "text" },
      { name: "duration", label: "Duración seg. (opcional)", type: "text", placeholder: "3" },
      { name: "fps", label: "FPS", type: "number", def: 12, min: 5, max: 24 },
      { name: "width", label: "Ancho px", type: "number", def: 480, min: 120, max: 1200 },
    ],
    submit: "Crear GIF",
  },

  /* === Imágenes === */
  {
    id: "image-edit", cat: "Imágenes", ico: "🏞️", name: "Convertir / redimensionar imagen",
    desc: "Cambia formato, reduce tamaño y comprime. Quita los metadatos EXIF. Acepta varias a la vez.",
    kind: "job",
    fields: [
      { name: "file", label: "Imágenes", type: "file", accept: "image/*", multiple: true },
      { name: "format", label: "Formato", type: "select", options: ["jpg", "png", "webp", "avif"], def: "jpg" },
      { name: "width", label: "Ancho máx. px (opcional)", type: "number", min: 1, max: 10000 },
      { name: "quality", label: "Calidad 1–100", type: "number", def: 82, min: 1, max: 100 },
    ],
    submit: "Procesar",
  },
  {
    id: "images-to-pdf", cat: "Imágenes", ico: "📄", name: "Imágenes → PDF",
    desc: "Une varias imágenes en un solo PDF, una por página.",
    kind: "job",
    fields: [{ name: "file", label: "Imágenes (en orden)", type: "file", accept: "image/*", multiple: true }],
    submit: "Crear PDF",
  },

  /* === Texto y código === */
  {
    id: "json-format", cat: "Texto y código", ico: "{ }", name: "JSON: formatear / validar",
    desc: "Ordena o minifica JSON y avisa si tiene errores.",
    kind: "client",
    fields: [{ name: "text", label: "Pega tu JSON", type: "textarea", placeholder: '{"hola":"mundo"}' }],
    actions: [
      { label: "Formatear", run: (i) => ({ output: JSON.stringify(JSON.parse(i.text), null, 2), lang: "json" }) },
      { label: "Minificar", cls: "sec", run: (i) => ({ output: JSON.stringify(JSON.parse(i.text)), lang: "json" }) },
    ],
  },
  {
    id: "yaml-convert", cat: "Texto y código", ico: "🔧", name: "YAML ↔ JSON",
    desc: "Convierte de YAML a JSON y al revés.",
    kind: "quick", endpoint: "yaml",
    fields: [
      { name: "text", label: "Entrada", type: "textarea", placeholder: "clave: valor" },
      { name: "direction", label: "Dirección", type: "select",
        options: [{ v: "yaml2json", t: "YAML → JSON" }, { v: "json2yaml", t: "JSON → YAML" }] },
    ],
    submit: "Convertir",
  },
  {
    id: "csv-table", cat: "Texto y código", ico: "▦", name: "CSV → tabla / JSON",
    desc: "Pega un CSV y velo como tabla, o cópialo como arreglo JSON.",
    kind: "client",
    fields: [{ name: "text", label: "CSV", type: "textarea", placeholder: "nombre,edad\nAna,30" }],
    actions: [{
      label: "Convertir", run: (i) => {
        const rows = parseCSV(i.text.trim());
        if (!rows.length) throw new Error("CSV vacío.");
        const [head, ...body] = rows;
        const json = body.map((r) => Object.fromEntries(head.map((h, k) => [h, r[k] ?? ""])));
        return { table: rows, output: JSON.stringify(json, null, 2), lang: "json" };
      },
    }],
  },
  {
    id: "encode", cat: "Texto y código", ico: "🔡", name: "Codificar / decodificar texto",
    desc: "Base64 y URL-encoding en los dos sentidos.",
    kind: "client",
    fields: [
      { name: "scheme", label: "Esquema", type: "select", options: ["Base64", "URL"] },
      { name: "text", label: "Texto", type: "textarea" },
    ],
    actions: [
      { label: "Codificar", run: (i) => ({ output: i.scheme === "URL" ? encodeURIComponent(i.text) : b64.enc(i.text) }) },
      { label: "Decodificar", cls: "sec", run: (i) => ({ output: i.scheme === "URL" ? decodeURIComponent(i.text) : b64.dec(i.text) }) },
    ],
  },
  {
    id: "jwt", cat: "Texto y código", ico: "🪙", name: "Decodificar JWT",
    desc: "Muestra el header y el payload de un token JWT (no verifica la firma).",
    kind: "client",
    fields: [{ name: "token", label: "Token", type: "textarea", placeholder: "eyJhbGci…" }],
    actions: [{
      label: "Decodificar", run: (i) => {
        const p = i.token.trim().split(".");
        if (p.length < 2) throw new Error("No parece un JWT.");
        const h = JSON.parse(b64url(p[0])), pl = JSON.parse(b64url(p[1]));
        let extra = "";
        if (pl.exp) extra = `\n\n// expira: ${new Date(pl.exp * 1000).toLocaleString()}`;
        return { output: "HEADER\n" + JSON.stringify(h, null, 2) + "\n\nPAYLOAD\n" + JSON.stringify(pl, null, 2) + extra, lang: "json" };
      },
    }],
  },
  {
    id: "hash", cat: "Texto y código", ico: "#️⃣", name: "Hash de texto",
    desc: "MD5, SHA-1, SHA-256 y SHA-512 de lo que escribas.",
    kind: "quick", endpoint: "hash",
    fields: [{ name: "text", label: "Texto", type: "textarea" }],
    submit: "Calcular",
  },
  {
    id: "text-diff", cat: "Texto y código", ico: "±", name: "Comparar dos textos",
    desc: "Diferencias línea por línea entre dos versiones.",
    kind: "client",
    fields: [
      { name: "a", label: "Texto A", type: "textarea" },
      { name: "b", label: "Texto B", type: "textarea" },
    ],
    actions: [{ label: "Comparar", run: (i) => ({ output: lineDiff(i.a, i.b), lang: "diff" }) }],
  },
  {
    id: "word-count", cat: "Texto y código", ico: "🔢", name: "Contador de palabras",
    desc: "Palabras, caracteres, líneas y tiempo estimado de lectura.",
    kind: "client",
    fields: [{ name: "text", label: "Texto", type: "textarea" }],
    actions: [{
      label: "Contar", run: (i) => {
        const t = i.text || "";
        const words = (t.trim().match(/\S+/g) || []).length;
        return { stats: {
          "Palabras": words,
          "Caracteres": t.length,
          "Sin espacios": t.replace(/\s/g, "").length,
          "Líneas": t ? t.split(/\n/).length : 0,
          "Párrafos": (t.trim().split(/\n\s*\n/).filter(Boolean).length) || 0,
          "Lectura": Math.max(1, Math.round(words / 200)) + " min",
        } };
      },
    }],
  },

  /* === Generadores === */
  {
    id: "password", cat: "Generadores", ico: "🔐", name: "Generador de contraseñas",
    desc: "Contraseñas aleatorias fuertes, generadas en tu navegador.",
    kind: "client",
    fields: [
      { name: "length", label: "Longitud", type: "number", def: 20, min: 4, max: 128 },
      { name: "upper", label: "Mayúsculas (A-Z)", type: "checkbox", def: true },
      { name: "digits", label: "Números (0-9)", type: "checkbox", def: true },
      { name: "symbols", label: "Símbolos (!@#…)", type: "checkbox", def: true },
    ],
    actions: [{
      label: "Generar 5", run: (i) => {
        let pool = "abcdefghijkmnpqrstuvwxyz";
        if (i.upper) pool += "ABCDEFGHJKLMNPQRSTUVWXYZ";
        if (i.digits) pool += "23456789";
        if (i.symbols) pool += "!@#$%&*?-_=+";
        const n = Math.max(4, Math.min(128, +i.length || 20));
        const gen = () => Array.from(crypto.getRandomValues(new Uint32Array(n)))
          .map((x) => pool[x % pool.length]).join("");
        return { output: Array.from({ length: 5 }, gen).join("\n") };
      },
    }],
  },
  {
    id: "uuid", cat: "Generadores", ico: "🆔", name: "Generador de UUID",
    desc: "Identificadores únicos versión 4.",
    kind: "client",
    fields: [{ name: "count", label: "Cuántos", type: "number", def: 5, min: 1, max: 100 }],
    actions: [{
      label: "Generar", run: (i) => ({
        output: Array.from({ length: Math.max(1, Math.min(100, +i.count || 5)) }, () => crypto.randomUUID()).join("\n"),
      }),
    }],
  },
  {
    id: "qr", cat: "Generadores", ico: "▪▫", name: "Código QR",
    desc: "Genera un QR (PNG y SVG) a partir de texto, un enlace, WiFi, etc.",
    kind: "quick", endpoint: "qr",
    fields: [{ name: "text", label: "Contenido", type: "textarea", placeholder: "https://…" }],
    submit: "Generar QR",
  },

  /* === Archivos y web === */
  {
    id: "zip", cat: "Archivos y web", ico: "📦", name: "Comprimir a ZIP",
    desc: "Junta varios archivos en un único .zip.",
    kind: "job",
    fields: [{ name: "file", label: "Archivos", type: "file", multiple: true }],
    submit: "Comprimir",
  },
  {
    id: "unzip", cat: "Archivos y web", ico: "🗂️", name: "Descomprimir ZIP",
    desc: "Abre un .zip y descarga sus archivos por separado.",
    kind: "job",
    fields: [{ name: "file", label: "Archivo .zip", type: "file", accept: ".zip,application/zip" }],
    submit: "Descomprimir",
  },
  {
    id: "unwrap", cat: "Archivos y web", ico: "🔗", name: "Desenrollar un enlace",
    desc: "Sigue todas las redirecciones y te dice a dónde lleva de verdad un link corto.",
    kind: "quick", endpoint: "unwrap",
    fields: [{ name: "text", label: "Enlace", type: "text", placeholder: "https://bit.ly/…" }],
    submit: "Rastrear",
  },
];
