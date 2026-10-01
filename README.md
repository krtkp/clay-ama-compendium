# Clay AMA Compendium

**Live at [ama.smallgenai.com](https://ama.smallgenai.com)**

Every answer from the Clay community's Ask Me Anything sessions, kept in one place: searchable by topic and guest, shareable into Slack, and swipeable as a card deck when you just want to catch up.

Unofficial and community-made. Questions and answers are quoted word for word from the public [#10-ask-me-anything](https://community.clay.com/x/10-ask-me-anything) channel; each answer is the guest's own view.

## What it does

- **All answers / By topic.** Every Q&A as a card with the full thread, or grouped into nine topics.
- **Swipe deck.** Any AMA, topic or search as a stack of cards, most upvoted first. Keep the good ones, skip the rest, undo, then copy what you kept into Slack.
- **Share.** Quote images sized for LinkedIn, "Copy for Slack" lists with thread links, Markdown downloads.
- **Report.** A one-page AMA report (program-wide or per guest) for the community team, exportable to PDF.
- **Works offline and installs to the home screen** (PWA).

## How it stays current

```
Clay Slack #10-ask-me-anything
        │  weekly scheduled agent (Mondays): reads new threads, replies and upvotes
        ▼
public/ama.json  ── verbatim text, hashed and checked against the source before publishing
        │  git push
        ▼
Vercel build (node build.mjs) ──► dist/: page, report, RSS, sitemap, service worker
        ▼
the site
```

Nothing is paraphrased. The only written-by-AI text per thread is its short title and a 2–6 word topic line for share images.

## Layout

| Path | What it is |
|---|---|
| `src/index.html` | The app: one file of HTML, CSS and vanilla JS. Also published as a Claude artifact. |
| `src/sw.js` | Service worker template (offline, instant repeat visits). |
| `public/` | Data, report page, guest and member photos, icons, PDF libraries. |
| `build.mjs` | Dependency-free build: page head and metadata, manifest, RSS, sitemap, versioned service worker. |
| `site.config.json` | Title, domain, analytics keys. |
| `tools/render-images.mjs` | Renders the app icons and the link-preview image (needs Playwright). |
| `tools/artifact/` | Builds the template the Claude artifact copy needs. |

## Editors

Editors sign in from the footer ("Editor sign-in") with an emailed link and get the Toolbox: program and guest reports, recap posts, the unanswered-questions sheet, exports, and hide/restore. Hiding commits to `moderation.json` through `api/moderation.js`, and Vercel redeploys within a minute.

| Vercel environment variable | What it is |
|---|---|
| `SESSION_SECRET` | Long random string that signs sign-in links and sessions |
| `ALLOWED_EDITORS` | Comma-separated emails that can sign in |
| `RESEND_API_KEY` | Sends the sign-in emails |
| `EMAIL_FROM` | e.g. `Clay AMA Compendium <signin@smallgenai.com>` (a domain verified in Resend) |
| `GITHUB_TOKEN` | Fine-grained token with contents read/write on this repo |

## Analytics

Page views through Vercel Web Analytics; product events through PostHog when a key is set in `site.config.json`: `deck_start`, `deck_finish`, `card_keep`, `card_skip`, `card_open`, `copy_for_slack`, `share_image`, `search`, `search_no_results`, `topics_view`, `guest_filter`, `outbound`.

## Run it locally

```
node build.mjs && npx serve dist
```

## Removal

Anyone who asked or answered can have their entry removed. Message Kartik P. in the Clay Slack.
