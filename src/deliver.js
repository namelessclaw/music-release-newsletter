#!/usr/bin/env node
/**
 * Music Release Newsletter — Generator + Pending Delivery
 * Runs fetcher, writes pending message (text + HTML) if new releases found.
 * If RESEND_API_KEY is set, also sends the email immediately.
 * Run: node src/deliver.js
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/releases.json');
const PENDING_TXT = join(__dirname, '../data/pending-newsletter.txt');
const PENDING_HTML = join(__dirname, '../data/pending-newsletter.html');

async function main() {
  // Run fetcher
  console.error('Fetching releases from MusicBrainz...');
  try {
    execSync('node src/fetcher.js', { cwd: __dirname + '/../', encoding: 'utf8' });
  } catch (e) {
    console.error('Fetcher error:', e.message);
    process.exit(1);
  }

  // Read results
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));

  if (data.newCount === 0) {
    console.log('No new releases — skipping.');
    if (existsSync(PENDING_TXT)) writeFileSync(PENDING_TXT, '');
    if (existsSync(PENDING_HTML)) writeFileSync(PENDING_HTML, '');
    return;
  }

  // Build text message
  const dateStr = new Date(data.generatedAt).toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  let txt = `🎵 **NEW MUSIC DISPATCH** — ${dateStr}\n`;
  txt += `${data.newCount} new release${data.newCount !== 1 ? 's' : ''} this week\n\n`;

  const grouped = {};
  for (const r of data.newReleases) {
    if (!grouped[r.genre]) grouped[r.genre] = [];
    grouped[r.genre].push(r);
  }

  for (const [genre, items] of Object.entries(grouped)) {
    txt += `**${genre}**\n`;
    for (const r of items.slice(0, 5)) {
      const type = r.type === 'Album' ? '' : r.type === 'EP' ? `[${r.type}] ` : `[${r.type}] `;
      txt += `• ${r.artist} — "${type}${r.title}" ${r.date ? `(${r.date})` : ''}\n`;
      txt += `  ${r.link}\n`;
    }
    txt += '\n';
  }

  txt += `_Tracking ${data.total} releases across 8 genres_`;

  writeFileSync(PENDING_TXT, txt);
  console.log(`✓ ${data.newCount} new releases — pending text written`);

  // Build HTML email
  const html = buildHtmlNewsletter(data, dateStr);
  writeFileSync(PENDING_HTML, html);
  console.log(`✓ HTML newsletter written`);

  // Try Resend if API key is present
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    console.error('📧 RESEND_API_KEY found — sending email...');
    await sendViaResend(html, txt, dateStr, data.newCount);
  } else {
    console.error('📧 RESEND_API_KEY not set — email not sent (HTML ready at data/pending-newsletter.html)');
  }

  console.log('\n--- TEXT PREVIEW ---');
  console.log(txt);
}

function buildHtmlNewsletter(data, dateStr) {
  const genreColors = {
    'Electronic': '#f0f',
    'Ambient': '#8af',
    'Experimental': '#fa0',
    'Rock': '#f55',
    'Jazz': '#daa',
    'Hip-Hop': '#af5',
    'Metal': '#aaa',
    'Folk': '#8b5',
  };

  const grouped = {};
  for (const r of data.newReleases) {
    if (!grouped[r.genre]) grouped[r.genre] = [];
    grouped[r.genre].push(r);
  }

  let releasesHtml = '';
  for (const [genre, items] of Object.entries(grouped)) {
    const color = genreColors[genre] || '#0ff';
    releasesHtml += `
    <div style="margin:32px 0;">
      <h2 style="color:${color};margin:0 0 12px;font-size:18px;border-bottom:1px solid #333;padding-bottom:8px;">${genre}</h2>
      ${items.slice(0, 5).map(r => `
        <div style="margin:12px 0;padding-left:14px;border-left:3px solid ${color};">
          <strong style="font-size:15px;">${escapeHtml(r.artist)}</strong>
          <span style="color:#aaa;"> — "</span>
          <em>${escapeHtml(r.title)}</em>
          <span style="color:#888;">${r.date ? ` (${r.date})` : ''}</span>
          <br>
          <a href="${r.link}" style="color:#0af;font-size:13px;">${r.link}</a>
        </div>
      `).join('')}
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>New Music Dispatch</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,sans-serif;color:#e8e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e,#0a0a0f);border-radius:16px 16px 0 0;padding:40px 40px 32px;border:1px solid #222;">
              <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#666;margin-bottom:16px;">Music Release Newsletter</div>
              <h1 style="margin:0;font-size:36px;font-weight:800;color:#fff;letter-spacing:-1px;">
                🎵 New Music<br><span style="color:#e050ff;">Dispatch</span>
              </h1>
              <p style="margin:16px 0 0;color:#888;font-size:15px;">${dateStr} — <strong style="color:#e050ff;">${data.newCount} new release${data.newCount !== 1 ? 's' : ''}</strong></p>
            </td>
          </tr>

          <!-- Releases -->
          <tr>
            <td style="background:#111;border-left:1px solid #222;border-right:1px solid #222;padding:32px 40px;">
              ${releasesHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d14;border-radius:0 0 16px 16px;border:1px solid #222;border-top:none;padding:24px 40px;">
              <p style="margin:0;color:#555;font-size:12px;">
                Tracking ${data.total} releases across 8 genres — MusicBrainz + open sources
              </p>
              <p style="margin:8px 0 0;color:#333;font-size:11px;">
                Sent to subscribers of the New Music Dispatch Newsletter
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendViaResend(html, text, dateStr, newCount) {
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.NEWSLETTER_TO || 'subscribers@example.com';
  const from = process.env.NEWSLETTER_FROM || 'New Music Dispatch <newsletter@obscure.page>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject: `🎵 ${newCount} New Releases — ${dateStr}`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend error ${response.status}: ${err}`);
  }

  const result = await response.json();
  console.error(`✓ Email sent via Resend! ID: ${result.id}`);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
