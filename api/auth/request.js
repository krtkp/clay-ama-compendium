// POST {email} → emails a 15-minute sign-in link to allowed editors. Always answers the same way, so it never reveals who can edit.
import { sign, isEditor, SITE, sameOrigin } from "../_lib.js";

export default async function handler(req, res){
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "origin" });
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 200);
  if (isEditor(email)){
    const token = sign({ k: "link", e: email, x: Date.now() + 15 * 60 * 1000 });
    const link = `${SITE}/api/auth/verify?t=${encodeURIComponent(token)}`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Clay AMA Compendium <signin@smallgenai.com>",
        to: [email],
        subject: "Your sign-in link for the Clay AMA Compendium",
        text: `Sign in to the Clay AMA Compendium Toolbox:\n\n${link}\n\nThe link works for 15 minutes. If you didn't ask for it, ignore this email.`,
        html: `<div style="font:15px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#1B1A18;max-width:480px">
          <p style="margin:0 0 6px;font-weight:700;font-size:18px">Sign in to the Toolbox</p>
          <p style="margin:0 0 20px;color:#55534E">Clay AMA Compendium · editors only</p>
          <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">Sign in</a></p>
          <p style="margin:0;color:#7B7974;font-size:13px">The link works for 15 minutes. If you didn't ask for it, you can ignore this email.</p></div>`,
      }),
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    if (!r.ok) console.error("email failed", r.status, await r.text());
  }
  res.status(200).json({ ok: true });
}
