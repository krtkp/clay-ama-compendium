// The Claude artifact copy of the site is published from the same src/index.html.
// Its in-page editor republishes the whole document, so it needs the exact served document as a template:
// .artifact/page.txt = the artifact runtime's skeleton + src/index.html. Run before every artifact publish.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const pre = readFileSync("tools/artifact/prefix.txt", "utf8");
const body = readFileSync("src/index.html", "utf8");
mkdirSync(".artifact", { recursive: true });
writeFileSync(".artifact/page.txt", pre + "\n" + body.replace(/\n+$/, "") + "\n\n</body></html>");
console.log("artifact template written");
