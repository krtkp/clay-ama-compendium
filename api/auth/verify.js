// GET ?t=… (the emailed link) → sets a 30-day session cookie and returns to the site with the Toolbox open
import { verify, setSession, SITE } from "../_lib.js";

export default function handler(req, res){
  const v = verify(String(req.query?.t || ""), "link");
  if (!v){ res.setHeader("Location", `${SITE}/#signin-expired`); return res.status(302).end(); }
  setSession(res, v.e);
  res.setHeader("Location", `${SITE}/#toolbox`);
  res.status(302).end();
}
