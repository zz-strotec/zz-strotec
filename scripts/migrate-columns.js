#!/usr/bin/env node
/*
 * migrate-columns.js — one-off: move the 14 Expert Column bodies out of the
 * homepage's initial HTML into an inline `const COLUMNS` JS object, so the full
 * text is no longer duplicate crawlable content competing with /column/<slug>/.
 *
 * - Each <div class="page" id="page-col-N">…</div> becomes an empty shell
 *   <div class="page" id="page-col-N"></div> (kept so hash routing + openColumn work).
 * - `const COLUMNS = {…}` (id -> inner HTML, JSON-encoded) is inserted before MARKETS.
 * - openColumn() injects COLUMNS[id] into the shell on first open (identical UX).
 *
 * index.html stays the single source of truth; gen-pages.js reads COLUMNS too.
 * Run once:  node scripts/migrate-columns.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', 'index.html');
let html = fs.readFileSync(SRC, 'utf8');

if (html.includes('const COLUMNS = {')) {
  console.log('COLUMNS already present — migration already done. Aborting (no changes).');
  process.exit(0);
}

function extractDivBlock(src, idAttr) {
  const at = src.indexOf(idAttr);
  if (at < 0) throw new Error('id not found: ' + idAttr);
  const start = src.lastIndexOf('<div', at);
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(src))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) return { block: src.slice(start, re.lastIndex), start, end: re.lastIndex }; }
    else depth++;
  }
  throw new Error('unbalanced div for ' + idAttr);
}

const ids = [...html.matchAll(/id="page-col-(\d+)"/g)].map(m => 'col-' + m[1]);
const COLUMNS = {};
for (const id of ids) {
  const { block } = extractDivBlock(html, `id="page-${id}"`);
  const inner = block.replace(/^<div\b[^>]*>/, '').replace(/<\/div>\s*$/, '');
  COLUMNS[id] = inner;
  // replace the full block with an empty shell
  html = html.replace(block, `<div class="page" id="page-${id}"></div>`);
}
console.log(`Extracted ${ids.length} columns: ${ids.join(', ')}`);

// insert the COLUMNS data object just before MARKETS (same <script>, in scope for openColumn)
const marker = 'const MARKETS = {';
if (!html.includes(marker)) throw new Error('MARKETS marker not found');
const columnsConst = 'const COLUMNS = ' + JSON.stringify(COLUMNS) + ';\n\n' + marker;
html = html.replace(marker, columnsConst);

// patch openColumn to inject content on first open
const oldFn = `function openColumn(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');`;
const newFn = `function openColumn(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  var _colPg = document.getElementById('page-' + id);
  if (_colPg && typeof COLUMNS !== 'undefined' && COLUMNS[id] && !_colPg.dataset.loaded) {
    _colPg.innerHTML = COLUMNS[id];
    _colPg.dataset.loaded = '1';
  }
  _colPg.classList.add('active');`;
if (!html.includes(oldFn)) throw new Error('openColumn signature not found (structure changed?)');
html = html.replace(oldFn, newFn);

fs.writeFileSync(SRC, html);
console.log('Patched openColumn + inserted COLUMNS. index.html updated.');
