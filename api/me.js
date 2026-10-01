// Who is signed in, if anyone
import { session, nameOf } from "./_lib.js";
export default function handler(req, res){
  res.setHeader("Cache-Control", "no-store");
  const s = session(req);
  if (!s) return res.status(401).json({ editor: false });
  res.status(200).json({ editor: true, email: s.e, name: nameOf(s.e) });
}
