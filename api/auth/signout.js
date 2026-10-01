import { clearSession, sameOrigin } from "../_lib.js";
export default function handler(req, res){
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
  clearSession(res); res.status(200).json({ ok: true });
}
