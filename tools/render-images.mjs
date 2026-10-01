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
const og = `<html><head><style>${fonts}html,body{margin:0}
  body{width:1200px;height:630px;background:linear-gradient(180deg,#D7EBFE 0,#F4F3F0 420px);font-family:H;color:#1B1A18;padding:76px 84px;box-sizing:border-box;display:flex;flex-direction:column}
  .eye{display:flex;align-items:center;gap:16px;font:600 19px/1 H;letter-spacing:.14em;text-transform:uppercase;color:#55534E}
  h1{margin:34px 0 0;font:700 92px/1 H;letter-spacing:-.045em}
  h1 em{font-style:normal;color:#395AFA}
  p{margin:26px 0 0;font:500 31px/1.35 H;color:#55534E;max-width:900px;letter-spacing:-.01em}
  .row{margin-top:auto;display:flex;gap:16px}
  .g{display:flex;align-items:center;gap:14px;background:#FEFDFB;border-radius:999px;padding:9px 24px 9px 9px;box-shadow:0 1px 2px rgba(21,21,24,.05),0 14px 36px -18px rgba(21,21,24,.25)}
  .g img{width:58px;height:58px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px #FEFDFB,0 0 0 5px #0667D9}
  .g b{display:block;font:700 23px/1.15 H} .g small{display:block;font:500 17px/1.2 H;color:#7B7974;margin-top:3px}</style></head>
  <body><div class="eye">${dots(15, 7)}<span>From the Clay community Slack</span></div>
  <h1>Clay AMA <em>Compendium</em></h1>
  <p>Every answer from the community's Ask Me Anything sessions. Find one by topic, or swipe through an AMA in a few minutes.</p>
  <div class="row">${guests.map(s => `<div class="g"><img src="${img(s.photo)}"><span><b>${s.guest}</b><small>${s.role}</small></span></div>`).join("")}</div>
  </body></html>`;

const b = await chromium.launch();
const shot = async (html, w, h, path) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150); await p.screenshot({ path }); await p.close(); };
for (const [s, pad, name] of [[512, 0, "icon-512"], [192, 0, "icon-192"], [180, 0, "apple-touch-icon"], [32, 0, "icon-32"], [512, .22, "icon-maskable-512"]]) await shot(icon(s, pad), s, s, `public/icons/${name}.png`);
await shot(og, 1200, 630, "public/og.png");
await b.close();
console.log("icons and og.png rendered");
