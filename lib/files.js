import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import AdmZip from "adm-zip";
import { emit, finish, fail } from "./jobs.js";

/** tool: zip — many files -> one .zip */
export async function zip(job, { files, outDir }) {
  try {
    emit(job.id, { phase: "Comprimiendo…", percent: 20 });
    const dest = path.join(outDir, "archivo.zip");
    const output = fs.createWriteStream(dest);
    const arc = archiver("zip", { zlib: { level: 9 } });
    arc.pipe(output);
    for (const f of files) arc.file(f.path, { name: f.name });
    await arc.finalize();
    await new Promise((r) => output.on("close", r));
    finish(job.id, dest);
  } catch (e) {
    fail(job.id, e.message);
  }
}

/** tool: unzip — one .zip -> list of extracted files */
export async function unzip(job, { files, outDir }) {
  try {
    emit(job.id, { phase: "Descomprimiendo…", percent: 30 });
    const extractTo = path.join(outDir, "contenido");
    fs.mkdirSync(extractTo, { recursive: true });
    const z = new AdmZip(files[0].path);
    z.extractAllTo(extractTo, true);
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else out.push(full);
      }
    };
    walk(extractTo);
    if (!out.length) return fail(job.id, "El ZIP está vacío.");
    finish(job.id, out);
  } catch (e) {
    fail(job.id, "No se pudo leer el ZIP: " + e.message);
  }
}
