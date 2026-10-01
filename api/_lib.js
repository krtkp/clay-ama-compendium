// Shared helpers for the editor sign-in. Files starting with "_" are not routes on Vercel.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SITE = (process.env.SITE_URL || "https://ama.smallgenai.com").replace(/\/$/, "");
const SECRET = process.env.SESSION_SECRET || "";
const b64 = s => Buffer.from(s).toString("base64url");
const mac = data => createHmac("sha256", SECRET).update(data).digest("base64url");

// A signed, expiring token: payload.signature. Used for the emailed link (15 min) and the session (30 days).
export function sign(payload){ if (!SECRET) throw new Error("SESSION_SECRET is not set"); const p = b64(JSON.stringify(payload)); return `${p}.${mac(p)}`; }
export function verify(token, kind){
  if (!SECRET || typeof token !== "string" || !token.includes(".")) return null;
  const [p, s] = token.split(".");
  const want = Buffer.from(mac(p)), got = Buffer.from(s || "");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { const v = JSON.parse(Buffer.from(p, "base64url").toString()); return v.k === kind && v.x > Date.now() && isEditor(v.e) ? v : null; } catch { return null; }
}
// ALLOWED_EDITORS: comma-separated, each "email" or "email=Display name", e.g. "kartik@x.com=Kartik,shriya@y.com=Shriya"
const roster = () => new Map((process.env.ALLOWED_EDITORS || "").split(",").map(s => s.trim()).filter(Boolean).map(s => { const [e, n] = s.split("="); return [e.trim().toLowerCase(), (n || "").trim()]; }));
export const editors = () => [...roster().keys()];
export const isEditor = email => !!email && roster().has(String(email).trim().toLowerCase());

export function cookies(req){ return Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; })); }
export const session = req => verify(cookies(req).ama_s, "sess");
const DAY = 86400;
export function setSession(res, email){
  const token = sign({ k: "sess", e: email, x: Date.now() + 30 * DAY * 1000 });
  res.setHeader("Set-Cookie", [
    `ama_s=${token}; Path=/; Max-Age=${30 * DAY}; HttpOnly; Secure; SameSite=Lax`,
    `ama_ed=1; Path=/; Max-Age=${30 * DAY}; Secure; SameSite=Lax`,   // a hint the page can read; it grants nothing
  ]);
}
export function clearSession(res){ res.setHeader("Set-Cookie", ["ama_s=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax", "ama_ed=; Path=/; Max-Age=0; Secure; SameSite=Lax"]); }
// Writes must come from the site itself
export function sameOrigin(req){ const o = req.headers.origin || ""; return !o || o === SITE || /^https:\/\/clay-ama-compendium[\w-]*\.vercel\.app$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o); }
export const nameOf = email => { const set = roster().get(String(email).trim().toLowerCase()); if (set) return set; const n = String(email).split("@")[0].split(/[._-]/)[0].replace(/\d+$/, ""); return n ? n[0].toUpperCase() + n.slice(1) : email; };
