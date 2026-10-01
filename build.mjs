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
// Hidden entries live in moderation.json (the Toolbox writes it); they are baked into the page at build time
const moderation = existsSync("moderation.json") ? JSON.parse(readFileSync("moderation.json", "utf8")) : { hidden: [] };
moderation.hidden = Array.isArray(moderation.hidden) ? moderation.hidden : [];
moderation.hidden.forEach(h => hidden.add(h.id));
const modBlock = '<script id="moderation" type="application/json">' + JSON.stringify(moderation).replace(/</g, "\\u003c") + "</script>";
const qas = data.qas.filter(q => !q.hidden && !hidden.has(q.id) && q.answered);
const sessions = data.sessions.filter(s => s.status !== "upcoming");

// ---------- prerendered feed: the collapsed cards, written into the HTML so crawlers (and the first paint) get the answers without JavaScript ----------
// The app re-renders the same list once it loads; the markup here mirrors card() in src/index.html (title, the two people, date, upvotes).
const SESS = Object.fromEntries(data.sessions.map(s => [s.id, s]));
const firstName = n => String(n).split(/\s+/)[0];
const initials = n => String(n).replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
const tsDate = ts => new Date(Number(String(ts).slice(0, 10)) * 1000);
const fmtDate = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const photoOf = (name, q) => { const s = SESS[q.session]; if (s && name === s.guest) return s.photo; if (data.host && name === data.host.handle) return data.host.photo; return (data.people || {})[name] || null; };
const shortName = (name, q) => {
  const s = SESS[q.session], everyone = [q.asker, s.guest, ...q.replies.map(r => r.by)], f = firstName(name);
  if (new Set(everyone.filter(n => firstName(n) === f)).size < 2) return f;
  if (name === s.guest){ const parts = name.split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name; }
  return name;
};
const pill = (name, q, kind) => { const ph = photoOf(name, q); return `<span class="pp ${kind}">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" decoding="async">` : `<span class="ini" aria-hidden="true">${esc(initials(name))}</span>`}${esc(shortName(name, q))}</span>`; };
const ICON_UP = `<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.5V3M3.2 7.6 8 2.8l4.8 4.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const para = t => String(t || "").split(/\n{2,}/).map(x => `<p>${esc(x.trim()).replace(/\n/g, "<br>")}</p>`).join("");
const ICON_STAR = `<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.2l-3.9 2.2.9-4.3-3.3-3 4.4-.5z" fill="currentColor"/></svg>`;
const mine = q => (data.curator && q.asker === data.curator) ? 1 : 0;
const byVotes = (a, b) => (b.likes || 0) - (a.likes || 0) || mine(a) - mine(b) || b.replies.length - a.replies.length || String(a.qts).localeCompare(String(b.qts));
// Latest AMA first, most upvoted within it, with the podium labels: the order the app opens with
const bySession = [...sessions].sort((a, b) => String(b.held).localeCompare(String(a.held)));
const ordered = bySession.flatMap(s => qas.filter(q => q.session === s.id).sort(byVotes));
const feat = bySession[0], podium = feat ? ordered.filter(q => q.session === feat.id && q.likes > 0).slice(0, 3) : [];
const labels = feat ? [`Most upvoted in ${firstName(feat.guest)}'s AMA`, "Second most upvoted", "Third most upvoted"] : [];
const ALLTOP = ([...qas].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0] || {}).id;
const prerenderCard = q => {
  const s = SESS[q.session], main = q.replies.find(r => r.role === "guest"), rank = podium.indexOf(q) + 1, gold = q.id === ALLTOP;
  const chips = (gold ? `<span class="rk gold">${ICON_STAR}Most upvoted of all time</span>` : "") + (rank ? `<span class="rk"><b>#${rank}</b><span class="rkl"> ${esc(labels[rank - 1])}</span></span>` : "");
  const stats = `<span class="stats2"><span class="when">${fmtDate(tsDate(main.ts))}</span>${q.likes ? `<span class="ic" aria-label="${q.likes} upvotes">${ICON_UP}${q.likes}</span>` : ""}</span>`;
  return `<article class="qa${rank ? ` rank rank${rank}` : ""}${gold ? " alltime" : ""}" id="${esc(q.id)}" data-card="${esc(q.id)}" tabindex="0" aria-expanded="false" aria-label="${rank ? `${esc(labels[rank - 1])}: ` : ""}${esc(q.title)}, ${esc(firstName(q.asker))} and ${esc(firstName(s.guest))}">
    ${chips ? `<div class="ribbon">${chips}</div>` : ""}
    <div class="phead"><h3>${esc(q.title)}</h3></div>
    <div class="pbar"><span class="duo">${pill(q.asker, q, "asker")}<span class="amp">&amp;</span>${pill(s.guest, q, "guest")}</span>${stats}</div>
    <div class="ssr" hidden><p><b>${esc(q.asker)} asked:</b></p>${para(q.question)}${q.replies.map(r => `<p><b>${esc(r.by)} replied:</b></p>${para(r.text)}`).join("")}</div>
  </article>`;
};
const members = new Set(data.qas.filter(q => !q.hidden && !hidden.has(q.id)).flatMap(q => [q.asker, ...q.replies.filter(r => r.role === "asker" || r.role === "community").map(r => r.by)])).size;
const prerender = `<h2 class="sr">Answers</h2>` + ordered.map(prerenderCard).join("\n");
const jsonLd = JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage",
  name: config.title, url: `${SITE}/`,
  mainEntity: ordered.map(q => { const s = SESS[q.session], main = q.replies.find(r => r.role === "guest"); return {
    "@type": "Question", name: q.title, text: q.question, url: `${SITE}/#${q.id}`, author: { "@type": "Person", name: q.asker }, upvoteCount: q.likes || 0,
    acceptedAnswer: { "@type": "Answer", text: q.replies.filter(r => r.role === "guest").map(r => r.text).join("\n\n"), author: { "@type": "Person", name: s.guest, jobTitle: s.role }, dateCreated: tsDate(main.ts).toISOString() } }; }),
}).replace(/</g, "\\u003c");
const page = readFileSync("src/index.html", "utf8").replace(/<script id="moderation" type="application\/json">[\s\S]*?<\/script>/, () => modBlock)
  .replace(/(<main class="list" id="list">)[\s\S]*?(<\/main>)/, (m, a, b) => `${a}${prerender}${b}`)
  .replace(/<div class="stats" id="stats">Loading…<\/div>/, () => `<div class="stats" id="stats"><b>${sessions.length}</b> AMAs<span class="dot-sep">·</span><b>${qas.length}</b> answers<span class="dot-sep">·</span><b>${members}</b> members</div>`);

// ---------- index.html: the artifact's page, wrapped in a real document head ----------
const headBits = [];
let body = page.replace(/^\s*<title>[\s\S]*?<\/title>\s*/, "");
// The artifact copy loads Hanken Grotesk from Google Fonts; the site serves the same OFL font itself (public/fonts), one connection fewer before the headline can paint
body = body.replace(/<link rel="preconnect"[^>]*>\s*/g, "");
body = body.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/, "");
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const face = (file, style, range) => `@font-face{font-family:"Hanken Grotesk";font-style:${style};font-weight:100 900;font-display:swap;src:url(/fonts/${file}) format("woff2-variations"),url(/fonts/${file}) format("woff2");unicode-range:${range}}`;
headBits.push(`<link rel="preload" href="/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`);
headBits.push(`<style>${face("hanken-grotesk-latin-wght-normal.woff2", "normal", LATIN)}${face("hanken-grotesk-latin-ext-wght-normal.woff2", "normal", LATIN_EXT)}${face("hanken-grotesk-latin-wght-italic.woff2", "italic", LATIN)}</style>`);
const desc = `Every answer from the Clay community's Ask Me Anything sessions with ${sessions.map(s => s.guest).join(" and ")}. Search by topic or guest, or swipe through an AMA in a few minutes.`;
const analytics = [
  `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>`,
  `<script defer src="/_vercel/insights/script.js"></script>`,
  config.posthog?.key ? `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister identify alias set_config reset opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_distinct_id get_property".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(config.posthog.key)},{api_host:${JSON.stringify(config.posthog.host || "https://us.i.posthog.com")},person_profiles:"identified_only",persistence:"localStorage",disable_session_recording:true,disable_surveys:true,loaded:function(ph){try{var q=location.search;if(/[?&]notrack/.test(q))localStorage.setItem("ama.notrack","1");if(/[?&]track(=|&|$)/.test(q))localStorage.removeItem("ama.notrack");if(localStorage.getItem("ama.notrack"))ph.opt_out_capturing();else if(ph.has_opted_out_capturing())ph.opt_in_capturing();}catch(e){}}});</script>` : "",
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
<script type="application/ld+json">${jsonLd}</script>
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
  ...files.filter(f => /^dist\/(img|fonts)\//.test(f) && !f.endsWith(".txt")).map(f => "/" + f.slice(5))];
writeFileSync("dist/sw.js", readFileSync("src/sw.js", "utf8").replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(precache)));

console.log(`Built ${SITE} · ${qas.length} answers · ${files.length} files · sw ${version}`);
