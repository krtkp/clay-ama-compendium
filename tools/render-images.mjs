// Renders the app icons and the link-preview image (og.png) from HTML, in the site's own font.
// Run when guests change: node tools/render-images.mjs   (needs Playwright; not part of the Vercel build)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
// use a local Playwright if the project has one, else the globally installed one
const req = createRequire(import.meta.url);
let pw; try { pw = req("playwright"); } catch { pw = createRequire(execSync("npm root -g").toString().trim() + "/").call(null, "playwright"); }
const { chromium } = pw;

const font = w => `@font-face{font-family:H;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(`tools/fonts/hanken-grotesk-latin-${w}-normal.woff2`).toString("base64")}) format("woff2")}`;
const fonts = [500, 600, 700, 800].map(font).join("");
const data = JSON.parse(readFileSync("public/ama.json", "utf8"));
const img = p => `data:image/jpeg;base64,${readFileSync("public/" + p).toString("base64")}`;
const dots = (r, gap) => ["#FB4450", "#FF7614", "#FCBE11", "#395AFA", "#8B5CF6"].map(c => `<i style="width:${r}px;height:${r}px;border-radius:50%;background:${c};display:block"></i>`).join("").replace(/^/, `<div style="display:flex;gap:${gap}px">`) + "</div>";

const icon = (size, pad) => `<html><head><style>${fonts}html,body{margin:0}body{width:${size}px;height:${size}px;background:#000;display:flex;align-items:center;justify-content:center}
  .in{display:flex;flex-direction:column;align-items:center;gap:${size * .07}px;transform:scale(${1 - pad})}
  b{font:800 ${size * .3}px/1 H;color:#fff;letter-spacing:-.045em}</style></head>
  <body><div class="in">${dots(size * .085, size * .035)}<b>AMA</b></div></body></html>`;

const guests = data.sessions.filter(s => s.status !== "upcoming").sort((a, b) => b.held.localeCompare(a.held)).slice(0, 4);
// Centered on purpose: Slack crops link previews to a square around the middle, LinkedIn and iMessage show it wide
const og = `<html><head><style>${fonts}html,body{margin:0}
  body{width:1200px;height:630px;background:radial-gradient(ellipse 70% 90% at 50% 0%,#D7EBFE 0,#E9F1F8 45%,#F4F3F0 100%);font-family:H;color:#1B1A18;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .eye{display:flex;align-items:center;gap:14px;font:600 17px/1 H;letter-spacing:.16em;text-transform:uppercase;color:#55534E}
  h1{margin:30px 0 0;font:700 96px/.98 H;letter-spacing:-.05em}
  h1 em{display:block;font-style:normal;color:#395AFA}
  .ppl{margin-top:38px;display:flex;align-items:center;gap:16px}
  .stack{display:flex}
  .stack img{width:64px;height:64px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 4px #F4F3F0;margin-left:-14px}
  .stack img:first-child{margin-left:0}
  .ppl span{font:600 22px/1.25 H;color:#55534E;text-align:left}
  .ppl b{display:block;color:#1B1A18;font-weight:700}</style></head>
  <body><div class="eye">${dots(13, 6)}<span>Clay community</span></div>
  <h1>Clay AMA<em>Compendium</em></h1>
  <div class="ppl"><div class="stack">${guests.map(s => `<img src="${img(s.photo)}">`).join("")}</div><span><b>Every AMA answer</b>${guests.length === 1 ? guests[0].guest : guests.map(s => s.guest.split(" ")[0]).join(", ").replace(/, ([^,]*)$/, " & $1")}</span></div>
  </body></html>`;

const b = await chromium.launch();
const shot = async (html, w, h, path) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150); await p.screenshot({ path }); await p.close(); };
for (const [s, pad, name] of [[512, 0, "icon-512"], [192, 0, "icon-192"], [180, 0, "apple-touch-icon"], [32, 0, "icon-32"], [512, .22, "icon-maskable-512"]]) await shot(icon(s, pad), s, s, `public/icons/${name}.png`);
await shot(og, 1200, 630, "public/og.png");
await b.close();
console.log("icons and og.png rendered");
