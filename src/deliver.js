#!/usr/bin/env node
/**
 * Music Release Newsletter — Generator + Pending Delivery
 * Runs fetcher, writes pending message if new releases found.
 * Heartbeat/main session sends the pending DM.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/releases.json');
const PENDING_FILE = join(__dirname, '../data/pending-newsletter.txt');

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
    // Clear any pending
    if (existsSync(PENDING_FILE)) writeFileSync(PENDING_FILE, '');
    return;
  }

  // Build message
  const dateStr = new Date(data.generatedAt).toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  let msg = `🎵 **NEW MUSIC DISPATCH** — ${dateStr}\n`;
  msg += `${data.newCount} new release${data.newCount !== 1 ? 's' : ''} this week\n\n`;

  const grouped = {};
  for (const r of data.newReleases) {
    if (!grouped[r.genre]) grouped[r.genre] = [];
    grouped[r.genre].push(r);
  }

  for (const [genre, items] of Object.entries(grouped)) {
    msg += `**${genre}**\n`;
    for (const r of items.slice(0, 5)) {
      const type = r.type === 'Album' ? '' : r.type === 'EP' ? `[${r.type}] ` : `[${r.type}] `;
      msg += `• ${r.artist} — "${type}${r.title}" ${r.date ? `(${r.date})` : ''}\n`;
      msg += `  ${r.link}\n`;
    }
    msg += '\n';
  }

  msg += `_Tracking ${data.total} releases across 8 genres_`;

  writeFileSync(PENDING_FILE, msg);
  console.log(`✓ ${data.newCount} new releases — pending DM written`);
  console.log(msg);
}

main().catch(console.error);
