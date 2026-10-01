// The Claude artifact copy of the site is published from the same src/index.html.
// Its in-page editor republishes the whole document, so it needs the exact served document as a template:
// .artifact/page.txt = the artifact runtime's skeleton + src/index.html. Run before every artifact publish.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const pre = readFileSync("tools/artifact/prefix.txt", "utf8");
const mod = JSON.parse(readFileSync("moderation.json", "utf8"));
const block = '<script id="moderation" type="application/json">' + JSON.stringify(mod).replace(/</g, "\\u003c") + "</script>";
const body = readFileSync("src/index.html", "utf8").replace(/<script id="moderation" type="application\/json">[\s\S]*?<\/script>/, () => block);
mkdirSync(".artifact", { recursive: true });
writeFileSync(".artifact/index.html", body);   // publish this file (not src/index.html) to the artifact
mkdirSync(".artifact", { recursive: true });
writeFileSync(".artifact/page.txt", pre + "\n" + body.replace(/\n+$/, "") + "\n\n</body></html>");
console.log("artifact template written");
