const main = document.getElementById("main");
const nav = document.getElementById("nav");
const search = document.getElementById("search");
let active = null;

/* ---------------- sidebar ---------------- */
const COLLAPSE_KEY = "toolify.collapsed";
function getCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]")); }
  catch { return new Set(); }
}
function setCollapsed(set) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set])); } catch {}
}

function buildNav(filter = "") {
  nav.innerHTML = "";
  const f = filter.trim().toLowerCase();
  const searching = f.length > 0;
  const collapsed = getCollapsed();
  const cats = [...new Set(TOOLS.map((t) => t.cat))];

  for (const cat of cats) {
    const items = TOOLS.filter(
      (t) => t.cat === cat && (!f || (t.name + " " + t.desc).toLowerCase().includes(f))
    );
    if (!items.length) continue;
    const isCollapsed = !searching && collapsed.has(cat);

    const group = document.createElement("div");
    group.className = "cat-group" + (isCollapsed ? " collapsed" : "");

    const head = document.createElement("button");
    head.className = "cat";
    head.innerHTML = `<span class="caret">▾</span><span>${cat}</span><span class="count">${items.length}</span>`;
    head.onclick = () => {
      const c = getCollapsed();
      c.has(cat) ? c.delete(cat) : c.add(cat);
      setCollapsed(c);
      buildNav(search.value);
    };
    group.appendChild(head);

    const box = document.createElement("div");
    box.className = "cat-items";
    for (const t of items) {
      const b = document.createElement("button");
      b.className = "item" + (active === t.id ? " active" : "");
      b.innerHTML = `<span class="ico">${t.ico}</span><span>${t.name}</span>`;
      b.onclick = () => openTool(t.id);
      box.appendChild(b);
    }
    group.appendChild(box);
    nav.appendChild(group);
  }
}
search.addEventListener("input", () => buildNav(search.value));

/* ---------------- tool view ---------------- */
function opt(o, def) {
  const v = typeof o === "object" ? o.v : o;
  const t = typeof o === "object" ? o.t : o;
  return `<option value="${v}"${def && v === def ? " selected" : ""}>${t}</option>`;
}

function field(f) {
  const wrap = document.createElement("div");
  wrap.className = "f" + (f.type === "checkbox" ? " inline" : "");
  const id = "fld-" + f.name;
  const label = `<label for="${id}">${f.label}</label>`;
  const hint = f.hint ? `<small class="hint">${f.hint}</small>` : "";
  let body;

  if (f.type === "file") {
    body = label + `
      <div class="drop" id="drop-${f.name}">
        <strong>Elige ${f.multiple ? "archivos" : "un archivo"}</strong> o arrástralo aquí
        <input type="file" id="${id}" ${f.multiple ? "multiple" : ""} ${f.accept ? `accept="${f.accept}"` : ""} hidden />
        <div class="files" id="files-${f.name}"></div>
      </div>`;
  } else if (f.type === "textarea") {
    body = label + `<textarea id="${id}" placeholder="${f.placeholder || ""}"></textarea>`;
  } else if (f.type === "select") {
    let inner;
    if (f.optgroups) {
      inner = f.optgroups.map((g) =>
        `<optgroup label="${g.label}">${g.options.map((o) => opt(o, f.def)).join("")}</optgroup>`
      ).join("");
    } else {
      inner = f.options.map((o) => opt(o, f.def)).join("");
    }
    body = label + `<select id="${id}">${inner}</select>`;
  } else if (f.type === "checkbox") {
    body = `<input type="checkbox" id="${id}" ${f.def ? "checked" : ""} /><label for="${id}">${f.label}</label>`;
  } else {
    const val = f.def != null ? ` value="${f.def}"` : "";
    const mm = (f.min != null ? ` min="${f.min}"` : "") + (f.max != null ? ` max="${f.max}"` : "");
    body = label + `<input type="${f.type}" id="${id}" placeholder="${f.placeholder || ""}"${val}${mm} />`;
  }

  wrap.innerHTML = body + hint;
  return wrap;
}

function wireDrop(f) {
  const zone = document.getElementById("drop-" + f.name);
  if (!zone) return;
  const input = document.getElementById("fld-" + f.name);
  const list = document.getElementById("files-" + f.name);
  const show = () => {
    list.textContent = [...(input.files || [])].map((x) => x.name).join(", ");
  };
  zone.onclick = () => input.click();
  input.onchange = show;
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("over"); };
  zone.ondragleave = () => zone.classList.remove("over");
  zone.ondrop = (e) => {
    e.preventDefault(); zone.classList.remove("over");
    input.files = e.dataTransfer.files; show();
  };
}

function collect(tool) {
  const v = {};
  for (const f of tool.fields) {
    if (f.type === "file") continue;
    const el = document.getElementById("fld-" + f.name);
    if (!el) continue;
    if (f.type === "checkbox") v[f.name] = el.checked;
    else if (f.type === "number") v[f.name] = el.value === "" ? undefined : Number(el.value);
    else v[f.name] = el.value;
  }
  return v;
}
function fileInput(tool) {
  const f = tool.fields.find((x) => x.type === "file");
  return f ? document.getElementById("fld-" + f.name) : null;
}

function openTool(id) {
  const tool = TOOLS.find((t) => t.id === id);
  active = id;
  buildNav(search.value);
  document.getElementById("welcome")?.remove();

  main.innerHTML = "";
  const view = document.createElement("div");
  view.className = "tool";
  view.innerHTML = `<header><h2>${tool.name}</h2><p>${tool.desc}</p></header>`;

  const form = document.createElement("div");
  form.className = "form";
  tool.fields.forEach((f) => form.appendChild(field(f)));

  const actions = document.createElement("div");
  actions.className = "actions";
  const btns = tool.actions || [{ label: tool.submit || "Ejecutar" }];
  btns.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "btn" + (a.cls ? " " + a.cls : "");
    btn.textContent = a.label;
    btn.onclick = () => runTool(tool, a, view);
    actions.appendChild(btn);
  });
  form.appendChild(actions);
  view.appendChild(form);

  const out = document.createElement("div");
  out.className = "out hidden";
  view.appendChild(out);

  main.appendChild(view);
  tool.fields.forEach((f) => { if (f.type === "file") wireDrop(f); });
}

/* ---------------- run ---------------- */
function setBusy(view, busy) {
  view.querySelectorAll(".btn").forEach((b) => (b.disabled = busy));
}
function out(view) {
  const o = view.querySelector(".out");
  o.className = "out";
  o.innerHTML = "";
  return o;
}
function showError(o, msg) {
  const d = document.createElement("div");
  d.className = "error";
  d.textContent = msg;
  o.appendChild(d);
}
function resultBox(o) {
  const box = document.createElement("div");
  box.className = "result-box";
  o.appendChild(box);
  return box;
}
function addText(box, text) {
  const pre = document.createElement("pre");
  pre.textContent = text;
  box.appendChild(pre);
  const c = document.createElement("button");
  c.className = "copy";
  c.textContent = "Copiar";
  c.onclick = () => { navigator.clipboard.writeText(text); c.textContent = "¡Copiado!"; setTimeout(() => (c.textContent = "Copiar"), 1200); };
  box.appendChild(c);
}
function addStats(box, stats) {
  const g = document.createElement("div");
  g.className = "stat-grid";
  for (const [k, val] of Object.entries(stats)) {
    const s = document.createElement("div");
    s.className = "stat";
    s.innerHTML = `<b>${val}</b><span>${k}</span>`;
    g.appendChild(s);
  }
  box.appendChild(g);
}
function addTable(box, rows) {
  const wrap = document.createElement("div");
  wrap.style.overflowX = "auto";
  const t = document.createElement("table");
  t.className = "csv";
  rows.slice(0, 200).forEach((r, i) => {
    const tr = document.createElement("tr");
    r.forEach((c) => {
      const cell = document.createElement(i === 0 ? "th" : "td");
      cell.textContent = c;
      tr.appendChild(cell);
    });
    t.appendChild(tr);
  });
  wrap.appendChild(t);
  box.appendChild(wrap);
}

const esc = (s) => (s || "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const IMG_EXT = ["png", "jpg", "jpeg", "webp", "avif", "gif", "bmp", "svg"];
const VID_EXT = ["mp4", "webm", "mov", "mkv", "m4v"];
const AUD_EXT = ["mp3", "m4a", "wav", "flac", "ogg", "opus", "aac"];

function addLinkPreview(o, p) {
  const card = document.createElement("a");
  card.className = "link-preview";
  card.href = p.url; card.target = "_blank"; card.rel = "noopener noreferrer";
  card.innerHTML =
    (p.image
      ? `<div class="lp-img"><img src="${esc(p.image)}" alt="" onerror="this.closest('.lp-img').remove()"></div>`
      : "") +
    `<div class="lp-body">
       ${p.site ? `<span class="lp-site">${esc(p.site)}</span>` : ""}
       <strong class="lp-title">${esc(p.title || p.url)}</strong>
       ${p.description ? `<span class="lp-desc">${esc(p.description)}</span>` : ""}
       <span class="lp-url">${esc(p.url)}</span>
     </div>`;
  o.appendChild(card);
}

function renderFiles(container, id, files) {
  const grid = document.createElement("div");
  grid.className = "file-grid";
  files.forEach((f, i) => {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const base = `/api/jobs/${id}/file?i=${i}`;
    let media;
    if (IMG_EXT.includes(ext)) media = `<img src="${base}&inline=1" alt="">`;
    else if (VID_EXT.includes(ext)) media = `<video controls preload="metadata" src="${base}&inline=1"></video>`;
    else if (AUD_EXT.includes(ext)) media = `<audio controls preload="metadata" src="${base}&inline=1"></audio>`;
    else if (ext === "pdf") media = `<embed src="${base}&inline=1" type="application/pdf">`;
    else media = `<div class="file-ico">📄 <span>.${esc(ext)}</span></div>`;
    const card = document.createElement("div");
    card.className = "file-card" + (AUD_EXT.includes(ext) ? " audio" : "");
    card.innerHTML =
      `<div class="file-media">${media}</div>
       <div class="file-foot"><span title="${esc(f.name)}">${esc(f.name)}</span>
       <a class="dl mini" href="${base}" download title="Descargar">⬇</a></div>`;
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

function renderResult(o, r) {
  if (r.preview) addLinkPreview(o, r.preview);
  if (r.image) {
    const box = resultBox(o);
    const img = document.createElement("img");
    img.src = r.image;
    box.appendChild(img);
    const list = document.createElement("div");
    list.className = "dl-list";
    const a = document.createElement("a");
    a.className = "dl"; a.href = r.image; a.download = "qr.png"; a.textContent = "⬇ Descargar PNG";
    list.appendChild(a);
    if (r.svg) {
      const b = document.createElement("a");
      b.className = "dl sec";
      b.href = "data:image/svg+xml," + encodeURIComponent(r.svg);
      b.download = "qr.svg"; b.textContent = "⬇ Descargar SVG";
      list.appendChild(b);
    }
    box.appendChild(list);
    return;
  }
  if (r.stats) return addStats(resultBox(o), r.stats);
  if (r.table) addTable(resultBox(o), r.table);
  if (r.output != null) addText(resultBox(o), r.output);
}

async function runTool(tool, action, view) {
  const o = out(view);
  const inputs = collect(tool);

  /* ---- client ---- */
  if (tool.kind === "client") {
    try {
      renderResult(o, action.run(inputs));
    } catch (e) {
      showError(o, e.message || String(e));
    }
    return;
  }

  /* ---- quick (json endpoint) ---- */
  if (tool.kind === "quick") {
    setBusy(view, true);
    o.innerHTML = `<div class="status"><span>Procesando…</span></div>`;
    try {
      const res = await fetch("/api/quick/" + tool.endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      o.innerHTML = "";
      if (!res.ok) showError(o, data.error || "Error.");
      else renderResult(o, data);
    } catch (e) {
      o.innerHTML = ""; showError(o, e.message);
    } finally {
      setBusy(view, false);
    }
    return;
  }

  /* ---- job (long task with progress) ---- */
  const fd = new FormData();
  fd.append("tool", tool.id);
  const fi = fileInput(tool);
  if (fi && fi.files.length === 0) { showError(o, "Sube al menos un archivo."); return; }
  if (fi) [...fi.files].forEach((f) => fd.append("file", f));
  fd.append("params", JSON.stringify({ ...inputs, ...(tool.params ? tool.params() : {}) }));

  setBusy(view, true);
  o.innerHTML = `
    <div class="bar-wrap"><div class="bar"></div></div>
    <div class="status"><span class="phase">Enviando…</span><span class="detail"></span></div>
    <div class="dl-list"></div>
    <details class="log" hidden><summary>Detalle técnico</summary><pre></pre></details>`;
  const bar = o.querySelector(".bar");
  const phase = o.querySelector(".phase");
  const detail = o.querySelector(".detail");
  const dlList = o.querySelector(".dl-list");
  const logBox = o.querySelector(".log");
  const logPre = o.querySelector(".log pre");

  let id;
  try {
    const res = await fetch("/api/run", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo iniciar.");
    id = data.id;
  } catch (e) {
    showError(o, e.message); setBusy(view, false); return;
  }

  const es = new EventSource(`/api/jobs/${id}/events`);
  es.onmessage = (ev) => {
    const job = JSON.parse(ev.data);
    phase.textContent = job.phase || "…";
    bar.style.width = (job.percent || 0) + "%";
    detail.textContent = job.detail || "";
    if (job.log?.length) {
      logBox.hidden = false;
      logPre.textContent = job.log.join("\n");
      logPre.scrollTop = logPre.scrollHeight;
    }
    if (job.status === "done") {
      es.close(); setBusy(view, false);
      bar.style.width = "100%"; bar.classList.add("done");
      phase.textContent = "✓ Listo"; detail.textContent = "";
      renderFiles(dlList, id, job.files);
    } else if (job.status === "error") {
      es.close(); setBusy(view, false);
      phase.textContent = "Error"; detail.textContent = "";
      showError(o, job.error || "Algo falló.");
    }
  };
  es.onerror = () => { es.close(); setBusy(view, false); };
}

buildNav();
