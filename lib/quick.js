import crypto from "node:crypto";
import yaml from "js-yaml";
import QRCode from "qrcode";

/** Each handler: async (params) -> result object (sent as JSON) */
export const quick = {
  async yaml({ text = "", direction = "yaml2json" }) {
    if (direction === "yaml2json") {
      const obj = yaml.load(text);
      return { output: JSON.stringify(obj, null, 2), lang: "json" };
    }
    const obj = JSON.parse(text);
    return { output: yaml.dump(obj, { indent: 2, lineWidth: 100 }), lang: "yaml" };
  },

  async hash({ text = "" }) {
    const algos = ["md5", "sha1", "sha256", "sha512"];
    const out = {};
    for (const a of algos) out[a] = crypto.createHash(a).update(text, "utf8").digest("hex");
    return {
      output: algos.map((a) => `${a.padEnd(7)} ${out[a]}`).join("\n"),
      lang: "text",
    };
  },

  async qr({ text = "" }) {
    if (!text.trim()) throw new Error("Escribe algo para codificar.");
    const png = await QRCode.toDataURL(text, { width: 512, margin: 2, errorCorrectionLevel: "M" });
    const svg = await QRCode.toString(text, { type: "svg", margin: 2 });
    return { image: png, svg };
  },

  async unwrap({ text = "" }) {
    let url = text.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const UA = "Mozilla/5.0 (compatible; Toolify/1.0)";
    const chain = [];
    for (let i = 0; i < 12; i++) {
      let res;
      try {
        res = await fetch(url, { method: "HEAD", redirect: "manual", headers: { "user-agent": UA } });
      } catch {
        res = await fetch(url, { method: "GET", redirect: "manual", headers: { "user-agent": UA } });
      }
      chain.push(`${res.status}  ${url}`);
      const loc = res.headers.get("location");
      if (!loc || res.status < 300 || res.status >= 400) break;
      url = new URL(loc, url).href;
    }

    // best-effort page preview from OpenGraph / <title>
    let preview = null;
    try {
      const ctrl = AbortSignal.timeout(6000);
      const page = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl });
      const type = page.headers.get("content-type") || "";
      if (type.includes("text/html")) {
        const html = (await page.text()).slice(0, 250000);
        const meta = (prop) => {
          const re = new RegExp(
            `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
          const re2 = new RegExp(
            `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
          return (html.match(re) || html.match(re2) || [])[1] || "";
        };
        const decode = (s) => s
          .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
        const abs = (u) => { try { return u ? new URL(u, url).href : ""; } catch { return ""; } };
        preview = {
          url,
          title: decode(meta("og:title") || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || ""),
          description: decode(meta("og:description") || meta("description")),
          image: abs(meta("og:image") || meta("twitter:image")),
          site: decode(meta("og:site_name")) || new URL(url).hostname,
        };
      }
    } catch { /* preview is optional */ }

    return {
      output: chain.join("\n") + `\n\n→ Destino final:\n${url}`,
      lang: "text",
      preview,
    };
  },
};
