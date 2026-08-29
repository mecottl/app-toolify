import fs from "node:fs";
import path from "node:path";
import { run, emit, finish, fail, tail, toSeconds } from "./jobs.js";

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

const PROGRESS_TPL =
  "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s";

function baseArgs(outDir) {
  return [
    "--newline", "--no-playlist", "--no-part", "--restrict-filenames",
    "--no-warnings", "-o", path.join(outDir, "%(title).150B.%(ext)s"),
    "--progress-template", PROGRESS_TPL,
  ];
}

function wireProgress(job, label) {
  return (line) => {
    job.log.push(line);
    if (job.log.length > 300) job.log.shift();
    if (line.includes("|") && /\d/.test(line)) {
      const [pct, speed, eta] = line.split("|");
      const n = parseFloat(String(pct).replace("%", "").trim());
      if (!Number.isNaN(n)) emit(job.id, {
        phase: label, percent: Math.min(99, Math.round(n)),
        detail: [speed, eta && eta.trim() !== "Unknown" ? `faltan ${eta.trim()}` : ""]
          .map((s) => (s || "").trim()).filter(Boolean).join(" · "),
      });
    } else if (/\[ExtractAudio\]|Destination:.*\.mp3/i.test(line)) {
      emit(job.id, { phase: "Convirtiendo audio…", percent: 99, detail: "" });
    } else if (/\[Merger\]|Merging formats/i.test(line)) {
      emit(job.id, { phase: "Uniendo video y audio…", percent: 99, detail: "" });
    } else if (/Extracting URL|Downloading webpage|\[info\]/i.test(line)) {
      emit(job.id, { phase: "Leyendo info…" });
    }
  };
}

function collect(outDir, exts) {
  const files = fs.readdirSync(outDir)
    .filter((f) => !f.endsWith(".part") && !f.endsWith(".ytdl"))
    .map((f) => path.join(outDir, f));
  if (!exts) return files;
  const set = exts.map((e) => "." + e.toLowerCase());
  const picked = files.filter((f) => set.includes(path.extname(f).toLowerCase()));
  return picked.length ? picked : files;
}

/** tool: dl-audio / dl-video */
export async function download(job, { params, outDir }) {
  const { url, format = "mp3" } = params;
  const audio = format === "mp3";
  const args = [
    ...baseArgs(outDir),
    ...(audio
      ? ["-x", "--audio-format", "mp3", "--audio-quality", "0",
         "--embed-thumbnail", "--embed-metadata"]
      : ["-f", "bv*+ba/b", "--merge-output-format", "mp4", "--embed-metadata"]),
  ];
  if (params.start || params.end) {
    const s = toSeconds(params.start) ?? 0;
    const e = params.end ? toSeconds(params.end) : "inf";
    args.push("--download-sections", `*${s}-${e}`, "--force-keyframes-at-cuts");
  }
  args.push(url);

  const r = await run(YTDLP, args, {
    onLine: wireProgress(job, audio ? "Descargando audio…" : "Descargando video…"),
  });
  if (r.code !== 0) return fail(job.id, tail(r.stderr) || `yt-dlp salió con código ${r.code}`);
  const out = collect(outDir, [audio ? "mp3" : "mp4"]);
  if (!out.length) return fail(job.id, "No se generó el archivo.");
  finish(job.id, out[0]);
}

/** tool: dl-subs */
export async function subtitles(job, { params, outDir }) {
  const { url, lang = "es" } = params;
  const args = [
    "--newline", "--no-playlist", "--no-warnings", "--skip-download",
    "--write-subs", "--write-auto-subs", "--sub-langs", `${lang}-orig,${lang},${lang}.*`,
    "--convert-subs", "srt",
    "-o", path.join(outDir, "%(title).150B.%(ext)s"), url,
  ];
  const r = await run(YTDLP, args, { onLine: (l) => job.log.push(l) });
  if (r.code !== 0) return fail(job.id, tail(r.stderr) || "No se pudieron obtener subtítulos.");
  const srt = collect(outDir).find((f) => f.endsWith(".srt"));
  if (!srt) return fail(job.id, "El video no tiene subtítulos en ese idioma.");
  // plain-text version
  const txt = srt.replace(/\.srt$/, ".txt");
  const plain = fs.readFileSync(srt, "utf8")
    .replace(/\r/g, "")
    .split("\n\n")
    .map((block) => block.split("\n").slice(2).join(" "))
    .join("\n").replace(/<[^>]+>/g, "").trim();
  fs.writeFileSync(txt, plain);
  finish(job.id, [srt, txt]);
}
