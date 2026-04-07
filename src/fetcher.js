#!/usr/bin/env node
/**
 * Music Release Newsletter Fetcher v2
 * Uses MusicBrainz + open sources for new releases across genres.
 */

import https from 'node:https';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const DATA_FILE = join(DATA_DIR, 'releases.json');
const PREV_FILE = join(DATA_DIR, 'previous-releases.json');

mkdirSync(DATA_DIR, { recursive: true });

// Genre tags for MusicBrainz
const GENRES = [
  { name: 'Electronic', tag: 'electronic', mbid: '11d2a125-50e5-4c0f-b15b-6cb5f3c43cce' },
  { name: 'Ambient', tag: 'ambient', mbid: '92459f5a-a89f-4f36-a1a3-7e39f3f9c7c9' },
  { name: 'Experimental', tag: 'experimental', mbid: '45d5b7ef-5e91-4b7e-b5b4-8c3fb8f2b3d9' },
  { name: 'Rock', tag: 'rock', mbid: '5e10a49d-28df-4f62-9b42-7418e2f177a0' },
  { name: 'Jazz', tag: 'jazz', mbid: '4c5a9b5a-4b0e-4e7f-9b42-8e3a1f4f2b5b' },
  { name: 'Hip-Hop', tag: 'hip-hop', mbid: '6e8d5d2e-5d0a-4f6e-8c3e-7f2e9a1b4c5d' },
  { name: 'Metal', tag: 'metal', mbid: '4f63b2e8-5c9a-4e4e-8b3a-7f9c2d1e3f4a' },
  { name: 'Folk', tag: 'folk', mbid: '54a8537b-d9bc-4e6e-b1b5-8c3c2a9f7e1d' },
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'MusicReleaseNewsletter/1.0 (max@obscure.page)',
        'Accept': 'application/json',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function getMusicBrainzReleases(genre, days = 7) {
  const today = new Date();
  const past = new Date(today - days * 24 * 60 * 60 * 1000);
  const from = past.toISOString().split('T')[0];
  const to = today.toISOString().split('T')[0];

  const url = `https://musicbrainz.org/ws/2/release/?query=tag:${genre.tag}+AND+date:[${from}+TO+${to}]&fmt=json&limit=25&inc=artist-credits,release-groups`;
  try {
    const { status, body } = await httpGet(url);
    if (status !== 200) return [];
    const data = JSON.parse(body);
    return (data.releases || []).map(r => ({
      title: r['release-group']?.['primary-type'] === 'Album' ? r.title : `[EP] ${r.title}`,
      artist: r['artist-credit']?.[0]?.name || 'Unknown',
      date: r.date,
      genre: genre.name,
      type: r['release-group']?.['primary-type'] || 'Unknown',
      mbid: r.id,
      link: `https://musicbrainz.org/release/${r.id}`,
      sources: ['MusicBrainz'],
    }));
  } catch (e) {
    console.error(`MusicBrainz error (${genre.name}): ${e.message}`);
    return [];
  }
}

function loadPrevious() {
  if (!existsSync(PREV_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(PREV_FILE, 'utf8'));
    return new Set(data.map(r => `${r.title}|${r.artist}`));
  } catch { return new Set(); }
}

function savePrevious(releases) {
  writeFileSync(PREV_FILE, JSON.stringify(releases.slice(0, 200), null, 2));
}

async function main() {
  const seen = loadPrevious();
  const newReleases = [];
  const allReleases = [];

  // Poll MusicBrainz for each genre
  for (const genre of GENRES) {
    console.error(`Fetching: ${genre.name}`);
    const releases = await getMusicBrainzReleases(genre);
    for (const r of releases) {
      const key = `${r.title}|${r.artist}`;
      r.seen = seen.has(key);
      if (!seen.has(key)) {
        newReleases.push(r);
        seen.add(key);
      }
      allReleases.push(r);
    }
    // Be polite to MusicBrainz
    await new Promise(res => setTimeout(res, 1100));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    tz: 'America/Los_Angeles',
    total: allReleases.length,
    newCount: newReleases.length,
    newReleases,
    recentReleases: allReleases.slice(0, 50),
  };

  writeFileSync(DATA_FILE, JSON.stringify(output, null, 2));
  savePrevious([...seen].map(s => {
    const [title, artist] = s.split('|');
    return { title, artist };
  }));

  // Render newsletter text
  const dateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let text = `🎵 NEW MUSIC DISPATCH — ${dateStr}\n`;
  text += `========================================\n\n`;
  text += `Found ${newReleases.length} new releases this week\n`;
  text += `Tracking ${allReleases.length} total releases\n\n`;

  if (newReleases.length > 0) {
    const grouped = {};
    for (const r of newReleases) {
      if (!grouped[r.genre]) grouped[r.genre] = [];
      grouped[r.genre].push(r);
    }
    for (const [genre, items] of Object.entries(grouped)) {
      text += `--- ${genre} ---\n`;
      for (const r of items.slice(0, 5)) {
        text += `  ${r.artist} — "${r.title}" (${r.date || 'TBD'})\n`;
        text += `  🔗 ${r.link}\n`;
      }
      text += '\n';
    }
  } else {
    text += `No new releases found — check back soon!\n`;
  }

  console.log(text);

  // Also write a readable HTML version
  const htmlFile = join(DATA_DIR, 'newsletter-latest.html');
  const groupedForHtml = {};
  for (const r of newReleases) {
    if (!groupedForHtml[r.genre]) groupedForHtml[r.genre] = [];
    groupedForHtml[r.genre].push(r);
  }
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Music Release Newsletter</title>`;
  html += `<style>body{font-family:system-ui;max-width:700px;margin:0 auto;padding:20px;background:#111;color:#eee;}`;
  html += `h1{color:#f0f;}h2{color:#0ff;}a{color:#0ff;}p{line-height:1.6;}`;
  html += `.genre{margin:30px 0;}.release{margin:10px 0;padding:10px;border-left:3px solid #f0f;}`;
  html += `</style></head><body>`;
  html += `<h1>🎵 New Music Dispatch</h1><p>${dateStr} — ${newReleases.length} new releases found</p>`;
  for (const [genre, items] of Object.entries(groupedForHtml)) {
    html += `<div class="genre"><h2>${genre}</h2>`;
    for (const r of items.slice(0, 5)) {
      html += `<div class="release"><strong>${r.artist}</strong> — "${r.title}" (${r.date || 'TBD'})<br><a href="${r.link}">${r.link}</a></div>`;
    }
    html += `</div>`;
  }
  html += `</body></html>`;
  writeFileSync(htmlFile, html);

  console.error(`\nData saved to: ${DATA_FILE}`);
  console.error(`HTML newsletter: ${htmlFile}`);
}

main().catch(console.error);
