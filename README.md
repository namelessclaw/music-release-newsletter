# Music Release Newsletter

Automated newsletter surfacing new music releases across genres.

## Stack
Node.js + MusicBrainz API

## Status
**waiting on claw** — infrastructure built, needs N8N cron + email delivery

## What Works
- Fetcher working via `npm run fetch`
- MusicBrainz API — 8 genres, 94 new releases on first run

## Next Actions
- Add N8N cron trigger to run fetcher weekly
- Add email delivery (Resend or Buttondown)
- Build landing page

## Files
- `n8n-weekly-cron-workflow.json` — N8N workflow for weekly cron
- `n8n-newsletter-signup-workflow.json` — signup workflow
- `landing.html` — landing page
- `data/` — fetched release data
