#!/usr/bin/env node
/*
 * pin-descriptions.js — one-off: capture the hand-written meta descriptions that
 * currently live in the generated entry pages and pin them into index.html as a
 * `const SEO_DESC` map, so `gen-pages.js` uses them instead of auto-deriving from
 * body text (which would otherwise overwrite them on the next regeneration).
 *
 * Keys: kb:<key> | market:<key> | col:<col-id>. Run once (before regenerating):
 *   node scripts/pin-descriptions.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
let html = fs.readFileSync(SRC, 'utf8');

if (html.includes('const SEO_DESC = {')) {
  console.log('SEO_DESC already present — aborting (no changes).');
  process.exit(0);
}

const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const metaDesc = h => { const m = h.match(/<meta name="description" content="([^"]*)"/); return m ? unesc(m[1]) : ''; };

const SEO_DESC = {};
function addDir(section, keyPrefix, idFromFile) {
  for (const name of fs.readdirSync(path.join(ROOT, section))) {
    const file = path.join(ROOT, section, name, 'index.html');
    if (!fs.existsSync(file)) continue;            // skips the hub index.html
    const h = fs.readFileSync(file, 'utf8');
    const key = idFromFile ? idFromFile(h) : keyPrefix + name;
    const d = metaDesc(h);
    if (key && d) SEO_DESC[key] = d;
  }
}
addDir('knowledge', 'kb:');
addDir('markets', 'market:');
addDir('column', null, h => {
  const m = h.match(/href="\/zz-strotec\/#(col-\d+)"/);
  return m ? 'col:' + m[1] : '';
});

const n = Object.keys(SEO_DESC).length;
console.log(`Captured ${n} descriptions (expect 70).`);
if (n !== 70) console.log('WARNING: expected 70 — check before committing.');

const marker = 'const MARKETS = {';
if (!html.includes(marker)) throw new Error('MARKETS marker not found');
html = html.replace(marker, 'const SEO_DESC = ' + JSON.stringify(SEO_DESC) + ';\n\n' + marker);
fs.writeFileSync(SRC, html);
console.log('Injected const SEO_DESC into index.html.');
