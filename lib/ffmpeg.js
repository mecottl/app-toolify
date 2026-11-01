import path from "node:path";
import { run, emit, finish, fail, tail, toSeconds } from "./jobs.js";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ||
  (process.env.FFMPEG_PATH ? process.env.FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1") : "ffprobe");

const VIDEO_CONTAINERS = ["mp4", "mkv", "webm", "mov", "avi"];

async function hasVideoStream(file) {
  let seen = "";
  await run(FFPROBE, [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=codec_type", "-of", "csv=p=0", file,
  ], { onLine: (l) => { seen += l + "\n"; } });
  return /\bvideo\b/i.test(seen);
}

function progressHandler(job, label) {
  let total = 0;
  return (line) => {
    const dur = line.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (dur) total = (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]);
    const t = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (t && total) {
      const cur = (+t[1]) * 3600 + (+t[2]) * 60 + parseFloat(t[3]);
      emit(job.id, { phase: label, percent: Math.min(99, Math.round((cur / total) * 100)) });
    }
    if (job.log.push(line) > 200) job.log.shift();
  };
}

function outPath(outDir, name, suffix, ext) {
  const base = path.parse(name || "archivo").name.replace(/[^\w.\- ]+/g, "_") || "archivo";
  return path.join(outDir, `${base}${suffix}.${ext}`);
}

/** Runs ffmpeg with progress; returns stderr tail on failure, null on success. */
async function encode(job, args, label) {
  emit(job.id, { phase: label, percent: 1 });
  const r = await run(FFMPEG, ["-y", "-hide_banner", ...args], {
    onLine: progressHandler(job, label),
  });
  return r.code === 0 ? null : (tail(r.stderr) || "ffmpeg falló.");
}

async function ffmpeg(job, args, label, out) {
  const err = await encode(job, args, label);
  if (err) { fail(job.id, err); return false; }
  finish(job.id, out);
  return true;
}

/** tool: conv-media — one or many files, all to the same format */
export async function convert(job, { params, files, outDir }) {
  const fmt = (params.format || "mp4").toLowerCase();
  const n = files.length, out = [];
  for (let i = 0; i < n; i++) {
    const { path: input, name } = files[i];
    const tag = n > 1 ? ` ${i + 1}/${n} (${name})` : "";
    if (VIDEO_CONTAINERS.includes(fmt)) {
      emit(job.id, { phase: `Revisando el archivo${tag}…`, percent: 1 });
      if (!(await hasVideoStream(input)))
        return fail(job.id,
          `${n > 1 ? `"${name}": ` : ""}El archivo es de solo audio, no se puede convertir a .${fmt} (un formato de video). ` +
          `Elige un formato de audio (mp3, m4a, wav, flac, ogg).`);
    }
    // "video.avi" + "video.mov" would both become video.mp4 — number the repeats
    let dest = outPath(outDir, name, "", fmt);
    for (let k = 2; out.includes(dest); k++) dest = outPath(outDir, name, `_${k}`, fmt);
    const err = await encode(job, ["-i", input, dest], `Convirtiendo${tag}…`);
    if (err) return fail(job.id, n > 1 ? `"${name}": ${err}` : err);
    out.push(dest);
  }
  finish(job.id, out);
}

/** tool: trim-media */
export async function trim(job, { params, files, outDir }) {
  const input = files[0].path, name = files[0].name;
  const s = toSeconds(params.start) ?? 0;
  const e = params.end ? toSeconds(params.end) : null;
  const ext = path.extname(name).slice(1) || "mp4";
  const out = outPath(outDir, name, "_recorte", ext);
  const seek = ["-ss", String(s), ...(e ? ["-to", String(e)] : [])];
  // try stream copy first, fall back to re-encode
  let ok = await run(FFMPEG, ["-y", "-hide_banner", ...seek, "-i", input, "-c", "copy", out], {
    onLine: (l) => job.log.push(l),
  });
  if (ok.code !== 0) {
    await ffmpeg(job, [...seek, "-i", input, out], "Recortando…", out);
  } else {
    finish(job.id, out);
  }
}

/** tool: compress-video */
export async function compress(job, { params, files, outDir }) {
  const input = files[0].path, name = files[0].name;
  const crf = { alta: 23, media: 28, baja: 32 }[params.level || "media"] || 28;
  const out = outPath(outDir, name, "_comprimido", "mp4");
  await ffmpeg(job, [
    "-i", input, "-vcodec", "libx264", "-crf", String(crf), "-preset", "veryfast",
    "-acodec", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
  ], "Comprimiendo…", out);
}

/** tool: extract-audio */
export async function extractAudio(job, { params, files, outDir }) {
  const input = files[0].path, name = files[0].name;
  const fmt = (params.format || "mp3").toLowerCase();
  const codec = { mp3: "libmp3lame", m4a: "aac", wav: "pcm_s16le", flac: "flac", ogg: "libvorbis" }[fmt] || "libmp3lame";
  const out = outPath(outDir, name, "", fmt);
  const q = fmt === "mp3" ? ["-q:a", "0"] : [];
  await ffmpeg(job, ["-i", input, "-vn", "-acodec", codec, ...q, out], "Extrayendo audio…", out);
}

/** tool: to-gif */
export async function toGif(job, { params, files, outDir }) {
  const input = files[0].path, name = files[0].name;
  const fps = Math.min(24, Math.max(5, +params.fps || 12));
  const width = Math.min(1200, Math.max(120, +params.width || 480));
  const out = outPath(outDir, name, "", "gif");
  const seek = params.start ? ["-ss", String(toSeconds(params.start))] : [];
  const dur = params.duration ? ["-t", String(toSeconds(params.duration))] : [];
  await ffmpeg(job, [
    ...seek, "-i", input, ...dur,
    "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
    "-loop", "0", out,
  ], "Creando GIF…", out);
}
