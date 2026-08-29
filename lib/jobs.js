import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** jobId -> job object */
export const jobs = new Map();
/** jobId -> Set<res> */
const listeners = new Map();

export function createJob(extra = {}) {
  const id = randomUUID();
  const job = {
    id, status: "running", phase: "Iniciando…", percent: 0,
    detail: "", title: "", files: [], error: null, log: [], ...extra,
  };
  jobs.set(id, job);
  return job;
}

export function emit(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
  const payload = `data: ${JSON.stringify(job)}\n\n`;
  for (const res of listeners.get(id) || []) res.write(payload);
}

export function subscribe(id, res) {
  const job = jobs.get(id);
  if (!job) return false;
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify(job)}\n\n`);
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id).add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  res.on("close", () => { clearInterval(ping); listeners.get(id)?.delete(res); });
  return true;
}

export function finish(id, files) {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean);
  emit(id, {
    status: "done", phase: "¡Listo!", percent: 100, detail: "",
    files: list.map((f) => ({ name: path.basename(f), path: f })),
    title: list[0] ? path.parse(list[0]).name : "",
  });
}

export function fail(id, message) {
  emit(id, { status: "error", error: String(message || "Algo falló.") });
}

/**
 * Run a command, streaming stdout/stderr lines to onLine.
 * Resolves with { code } on exit. Never rejects for non-zero code.
 */
export function run(cmd, args, { onLine, cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, cwd });
    let err = "";
    let buf = "";
    const pump = (data) => {
      buf += data.toString();
      const parts = buf.split(/\r?\n/);
      buf = parts.pop();
      for (const line of parts) if (line.trim() && onLine) onLine(line.trim());
    };
    child.stdout.on("data", pump);
    child.stderr.on("data", (d) => { err += d.toString(); pump(d); });
    child.on("error", (e) => resolve({ code: -1, stderr: e.message }));
    child.on("close", (code) => {
      if (buf.trim() && onLine) onLine(buf.trim());
      resolve({ code, stderr: err });
    });
  });
}

/** Parse "HH:MM:SS.xx" or "MM:SS" or "83" into seconds. */
export function toSeconds(t) {
  if (t == null || t === "") return null;
  const s = String(t).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const parts = s.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function tail(stderr, n = 4) {
  return String(stderr || "").split(/\r?\n/).filter(Boolean).slice(-n).join(" · ");
}

export function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}
