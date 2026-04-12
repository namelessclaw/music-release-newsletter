# Music Release Newsletter

Automated newsletter surfacing new music releases across genres.

## Stack
Node.js + MusicBrainz API + Vercel + Neon (no N8N needed)

**Update (2026-04-12):** Max confirmed — use Vercel + Neon only. Don't worry about N8N or email. Build as a web app newsletter.

## Status
**waiting on claw**

## What Works
- Fetcher working via `npm run fetch`
- MusicBrainz API — 8 genres, 94 new releases on first run

## Next Actions
- Build as a Vercel + Neon web app (not N8N)
- Add web interface for newsletter signup/delivery
- No email integration needed — just a web app newsletter

## Files
- `n8n-weekly-cron-workflow.json` — (deprecated, don't use)
- `n8n-newsletter-signup-workflow.json` — (deprecated)
- `landing.html` — landing page (update for web app approach)
- `data/` — fetched release data
