import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { emit, finish, fail } from "./jobs.js";

/** tool: image-edit — convert / resize / compress, strips metadata */
export async function edit(job, { params, files, outDir }) {
  try {
    const fmt = (params.format || "jpeg").toLowerCase().replace("jpg", "jpeg");
    const quality = Math.min(100, Math.max(1, +params.quality || 82));
    const width = params.width ? Math.max(1, +params.width) : null;
    const out = [];
    for (let i = 0; i < files.length; i++) {
      emit(job.id, { phase: `Procesando imagen ${i + 1}/${files.length}…`, percent: Math.round((i / files.length) * 100) });
      const base = path.parse(files[i].name || files[i].path).name.replace(/[^\w.\- ]+/g, "_") || `imagen_${i + 1}`;
      const dest = path.join(outDir, `${base}.${fmt === "jpeg" ? "jpg" : fmt}`);
      let img = sharp(files[i].path).rotate();
      if (width) img = img.resize({ width, withoutEnlargement: true });
      await img.toFormat(fmt, { quality }).toFile(dest);
      out.push(dest);
    }
    finish(job.id, out);
  } catch (e) {
    fail(job.id, e.message);
  }
}

/** tool: images-to-pdf */
export async function toPdf(job, { files, outDir }) {
  try {
    emit(job.id, { phase: "Armando PDF…", percent: 30 });
    const dest = path.join(outDir, "imagenes.pdf");
    const doc = new PDFDocument({ autoFirstPage: false });
    const ws = fs.createWriteStream(dest);
    doc.pipe(ws);
    for (const f of files) {
      const meta = await sharp(f.path).rotate().metadata();
      const buf = await sharp(f.path).rotate().jpeg({ quality: 88 }).toBuffer();
      const w = meta.width || 800, h = meta.height || 600;
      doc.addPage({ size: [w, h], margin: 0 });
      doc.image(buf, 0, 0, { width: w, height: h });
    }
    doc.end();
    await new Promise((r) => ws.on("finish", r));
    finish(job.id, dest);
  } catch (e) {
    fail(job.id, e.message);
  }
}
