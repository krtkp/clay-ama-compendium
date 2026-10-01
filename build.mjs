// Builds the public site into dist/ from src/index.html, public/ and the data in public/ama.json.
// No dependencies: Vercel runs `node build.mjs` on every push.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const config = JSON.parse(readFileSync("site.config.json", "utf8"));
// The address the site is served from: an explicit domain wins, then Vercel's production URL, then the fallback in the config
const host = config.domain || process.env.VERCEL_PROJECT_PRODUCTION_URL || config.fallbackHost;
const SITE = `https://${host.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("public", "dist", { recursive: true });

const data = JSON.parse(readFileSync("public/ama.json", "utf8"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hidden = new Set();
const page = readFileSync("src/index.html", "utf8");
try { JSON.parse(page.match(/<script id="moderation" type="application\/json">([\s\S]*?)<\/script>/)[1]).hidden.forEach(h => hidden.add(h.id)); } catch {}
const qas = data.qas.filter(q => !q.hidden && !hidden.has(q.id) && q.answered);
const sessions = data.sessions.filter(s => s.status !== "upcoming");

// ---------- index.html: the artifact's page, wrapped in a real document head ----------
const headBits = [];
let body = page.replace(/^\s*<title>[\s\S]*?<\/title>\s*/, "");
body = body.replace(/<link rel="preconnect"[^>]*>\s*/g, m => { headBits.push(m.trim()); return ""; });
body = body.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/, m => { headBits.push(m.trim()); return ""; });
const desc = `Every answer from the Clay community's Ask Me Anything sessions with ${sessions.map(s => s.guest).join(" and ")}. Search by topic or guest, or swipe through an AMA in a few minutes.`;
const analytics = [
  `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>`,
  `<script defer src="/_vercel/insights/script.js"></script>`,
  config.posthog?.key ? `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister identify alias set_config reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_distinct_id get_property".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(config.posthog.key)},{api_host:${JSON.stringify(config.posthog.host || "https://us.i.posthog.com")},person_profiles:"identified_only",persistence:"localStorage"});</script>` : "",
].filter(Boolean).join("\n");
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(config.title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/">
<meta name="ama:site" content="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.title)}">
<meta property="og:title" content="${esc(config.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F3F0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121211" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="${esc(config.shortName)}">
<link rel="alternate" type="application/rss+xml" title="${esc(config.title)}: new answers" href="/rss.xml">
${headBits.join("\n")}
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>
${analytics}
<script>if("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));</script>
</head>
<body>
`;
writeFileSync("dist/index.html", head + body.trim() + "\n</body>\n</html>\n");

// report.html gets the same favicon, manifest and analytics
let report = readFileSync("public/report.html", "utf8");
report = report.replace("</head>", `<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n<link rel="manifest" href="/manifest.webmanifest">\n${analytics}\n</head>`);
writeFileSync("dist/report.html", report);

// ---------- manifest, robots, sitemap, rss ----------
writeFileSync("dist/manifest.webmanifest", JSON.stringify({
  name: config.title, short_name: config.shortName, description: desc,
  start_url: "/?source=homescreen", scope: "/", display: "standalone",
  background_color: "#F4F3F0", theme_color: "#F4F3F0",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));
writeFileSync("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
writeFileSync("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>
  <url><loc>${SITE}/report</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>
</urlset>
`);
const guestOf = q => (data.sessions.find(s => s.id === q.session) || {}).guest || "Guest";
const firstGuest = q => q.replies.find(r => r.role === "guest");
const tsDate = ts => new Date(Number(String(ts).slice(0, 10)) * 1000);
const items = qas.map(q => ({ q, g: firstGuest(q) })).filter(x => x.g).sort((a, b) => b.g.ts.localeCompare(a.g.ts)).slice(0, 50);
writeFileSync("dist/rss.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(config.title)}</title>
<link>${SITE}/</link>
<atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
<description>${esc(desc)}</description>
<language>en</language>
${items.map(({ q, g }) => `<item>
  <title>${esc(guestOf(q))}: ${esc(q.title)}</title>
  <link>${SITE}/#${esc(q.id)}</link>
  <guid isPermaLink="false">${esc(q.id)}</guid>
  <pubDate>${tsDate(g.ts).toUTCString()}</pubDate>
  <description>${esc(g.text.length > 400 ? g.text.slice(0, 397).replace(/\s+\S*$/, "") + "…" : g.text)}</description>
</item>`).join("\n")}
</channel>
</rss>
`);

// ---------- service worker: versioned by the content it serves ----------
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk("dist").filter(f => !f.endsWith("sw.js"));
const hash = createHash("sha1"); files.sort().forEach(f => hash.update(f).update(readFileSync(f)));
const version = hash.digest("hex").slice(0, 10);
const precache = ["/", "/report", "/manifest.webmanifest", "/icons/icon-192.png", "/ama.json",
  ...files.filter(f => /^dist\/img\//.test(f)).map(f => "/" + f.slice(5))];
writeFileSync("dist/sw.js", readFileSync("src/sw.js", "utf8").replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(precache)));

console.log(`Built ${SITE} · ${qas.length} answers · ${files.length} files · sw ${version}`);
