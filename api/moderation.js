// POST {action: "hide" | "restore", id} → updates moderation.json in the repo; Vercel redeploys the site in about a minute
import { session, sameOrigin, nameOf } from "./_lib.js";

const REPO = process.env.GITHUB_REPO || "krtkp/clay-ama-compendium";
const FILE = "moderation.json";
const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) } });

export default async function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
  const s = session(req); if (!s) return res.status(401).json({ error: "signin" });
  const { action, id } = req.body || {};
  if (!["hide", "restore"].includes(action) || !/^msg_[A-Za-z0-9]{6,40}$/.test(String(id))) return res.status(400).json({ error: "input" });

  for (let attempt = 0; attempt < 3; attempt++){
    const cur = await gh(`${FILE}?ref=main`);
    if (!cur.ok && cur.status !== 404) return res.status(502).json({ error: "github", status: cur.status });
    const file = cur.ok ? await cur.json() : null;
    let mod = { hidden: [] };
    if (file) try { mod = JSON.parse(Buffer.from(file.content, "base64").toString()); } catch {}
    mod.hidden = Array.isArray(mod.hidden) ? mod.hidden : [];
    const has = mod.hidden.some(h => h.id === id);
    if (action === "hide" && !has) mod.hidden.push({ id, at: new Date().toISOString(), by: nameOf(s.e) });
    if (action === "restore") mod.hidden = mod.hidden.filter(h => h.id !== id);
    if ((action === "hide" && has) || (action === "restore" && !has)) return res.status(200).json({ ok: true, hidden: mod.hidden, unchanged: true });
    const put = await gh(FILE, { method: "PUT", body: JSON.stringify({
      message: `${action === "hide" ? "Hide" : "Restore"} ${id} (by ${nameOf(s.e)} from the Toolbox)`,
      content: Buffer.from(JSON.stringify(mod, null, 2) + "\n").toString("base64"),
      branch: "main", ...(file ? { sha: file.sha } : {}),
    }) });
    if (put.ok) return res.status(200).json({ ok: true, hidden: mod.hidden });
    if (put.status !== 409 && put.status !== 422) return res.status(502).json({ error: "github", status: put.status });
  }
  res.status(409).json({ error: "busy" });
}
