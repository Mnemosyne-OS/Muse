/**
 * check-a11y — fails the build when a control has no accessible name.
 *
 * A screen reader announces a control by its name. A button whose whole body
 * is a glyph has none, and a field named only by its placeholder loses that
 * name the moment the user types into it. Seventeen buttons and fifteen fields
 * were in that state; fixing them once means nothing if the next one slips in
 * silently, so this is a gate rather than a note.
 *
 * The parser matters: the obvious `<button(.*?)>` regex ends the opening tag at
 * the first `>`, which in this codebase is the arrow of `onClick={() => …}`.
 * That version reported ONE offender out of seventeen. This one walks the tag
 * with a brace/quote counter instead.
 *
 * Run: node scripts/check-a11y.mjs  (wired into `pnpm --filter …/muse test`)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');

/** Every .tsx under src/, minus the SDK re-export. */
function tsxFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxFiles(p));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Index of the `>` closing the tag opened at `i`, ignoring {…}, quotes and
 *  the `=>` of every inline handler. */
function tagEnd(src, i, tagLen) {
  let j = i + tagLen;
  let depth = 0;
  let quote = null;
  while (j < src.length) {
    const c = src[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return j;
    j++;
  }
  return -1;
}

const GLYPH = /<G[A-Za-z]+[^>]*\/>|<svg[\s\S]*?<\/svg>|<BookIcon\s*\/>/g;
/** Something a screen reader can actually read out — a t() call, or letters.
 *  A lone "✕" or "↑" is a picture, not a name. */
const WORDY = /t\(|[A-Za-zÀ-ÿ]{2,}/;

const problems = [];

for (const file of tsxFiles(SRC)) {
  const src = readFileSync(file, 'utf-8');
  const rel = relative(join(here, '..'), file).replace(/\\/g, '/');
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  // ── Buttons: a name from aria-label, from a title, or from real text ──
  for (let i = src.indexOf('<button'); i >= 0; i = src.indexOf('<button', i + 1)) {
    const j = tagEnd(src, i, '<button'.length);
    if (j < 0) continue;
    const attrs = src.slice(i, j);
    const close = src.indexOf('</button>', j);
    const body = close > 0 ? src.slice(j + 1, close) : '';
    if (/aria-label[=\s]/.test(attrs) || /title[=\s]/.test(attrs)) continue;
    if (WORDY.test(body.replace(GLYPH, ''))) continue;
    problems.push(`${rel}:${lineOf(i)} — <button> has no accessible name (icon or symbol only)`);
  }

  // ── Fields: no <label> wrapping in this app, so aria-label is the name ──
  for (const tag of ['<input', '<textarea']) {
    for (let i = src.indexOf(tag); i >= 0; i = src.indexOf(tag, i + 1)) {
      const j = tagEnd(src, i, tag.length);
      if (j < 0) continue;
      const attrs = src.slice(i, j);
      if (/aria-label[=\s]/.test(attrs)) continue;
      // A checkbox next to its own text label is named by that text.
      if (/type=["']checkbox["']/.test(attrs)) continue;
      problems.push(`${rel}:${lineOf(i)} — ${tag}> has no aria-label (a placeholder is not a name)`);
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} control(s) with no accessible name:\n   ${problems.join('\n   ')}`);
  process.exit(1);
}
console.log('✓ a11y OK — every button, input and textarea states its name.');
