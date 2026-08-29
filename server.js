import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { jobs, createJob, subscribe, fail, cleanupDir } from "./lib/jobs.js";
import * as media from "./lib/media.js";
import * as ff from "./lib/ffmpeg.js";
import * as images from "./lib/images.js";
import * as files from "./lib/files.js";
import { quick } from "./lib/quick.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(__dirname, "work");
const DL = path.join(__dirname, "downloads");
for (const d of [WORK, DL]) fs.mkdirSync(d, { recursive: true });

const PORT = process.env.PORT || 4747;
const upload = multer({ dest: WORK, limits: { fileSize: 1024 * 1024 * 1024 } });

// tool id -> { fn, files: "none" | "one" | "many" }
const TOOLS = {
  "dl-audio":        { fn: media.download,     files: "none" },
  "dl-video":        { fn: media.download,     files: "none" },
  "dl-subs":         { fn: media.subtitles,    files: "none" },
  "conv-media":      { fn: ff.convert,         files: "one"  },
  "trim-media":      { fn: ff.trim,            files: "one"  },
  "compress-video":  { fn: ff.compress,        files: "one"  },
  "extract-audio":   { fn: ff.extractAudio,    files: "one"  },
  "to-gif":          { fn: ff.toGif,           files: "one"  },
  "image-edit":      { fn: images.edit,        files: "many" },
  "images-to-pdf":   { fn: images.toPdf,       files: "many" },
  "zip":             { fn: files.zip,          files: "many" },
  "unzip":           { fn: files.unzip,        files: "one"  },
};

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/run", upload.array("file", 40), async (req, res) => {
  const tool = TOOLS[req.body.tool];
  if (!tool) return res.status(400).json({ error: "Herramienta desconocida." });

  let params = {};
  try { params = req.body.params ? JSON.parse(req.body.params) : {}; } catch {}
  const uploaded = (req.files || []).map((f) => ({ path: f.path, name: f.originalname }));

  if (tool.files !== "none" && uploaded.length === 0)
    return res.status(400).json({ error: "Sube al menos un archivo." });
  if (tool.files === "none") {
    const u = (params.url || "").trim();
    if (!/^https?:\/\/\S+$/i.test(u) || /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(u))
      return res.status(400).json({ error: "Pega un enlace http(s) válido." });
  }

  const job = createJob({ tool: req.body.tool });
  const outDir = path.join(DL, job.id);
  fs.mkdirSync(outDir, { recursive: true });
  res.json({ id: job.id });

  Promise.resolve()
    .then(() => tool.fn(job, { params, files: uploaded, outDir }))
    .catch((e) => fail(job.id, e.message))
    .finally(() => uploaded.forEach((f) => { try { fs.unlinkSync(f.path); } catch {} }));
});

app.get("/api/jobs/:id/events", (req, res) => {
  if (!subscribe(req.params.id, res)) res.status(404).end();
});

app.get("/api/jobs/:id/file", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "done") return res.status(404).end();
  const idx = Math.max(0, Math.min(job.files.length - 1, +req.query.i || 0));
  const f = job.files[idx];
  if (!f || !f.path.startsWith(DL) || !fs.existsSync(f.path)) return res.status(404).end();
  if (req.query.inline) {
    res.type(path.extname(f.name) || "application/octet-stream");
    res.setHeader("Content-Disposition", "inline");
    return res.sendFile(f.path);
  }
  res.download(f.path, f.name);
});

app.post("/api/quick/:tool", async (req, res) => {
  const handler = quick[req.params.tool];
  if (!handler) return res.status(404).json({ error: "No existe." });
  try {
    res.json(await handler(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/clean", (req, res) => {
  let n = 0;
  for (const dir of [WORK, DL]) {
    for (const entry of fs.readdirSync(dir)) {
      if (entry === ".gitkeep") continue;
      cleanupDir(path.join(dir, entry));
      n++;
    }
  }
  jobs.clear();
  res.json({ removed: n });
});

app.listen(PORT, () => {
  let lan = "";
  for (const list of Object.values(os.networkInterfaces()))
    for (const net of list || [])
      if (net.family === "IPv4" && !net.internal) lan = net.address;
  console.log(`\n  🧰 Toolify  ·  http://localhost:${PORT}`);
  if (lan) console.log(`      en tu red: http://${lan}:${PORT}`);
  console.log(`      Ctrl+C para detener\n`);
});
