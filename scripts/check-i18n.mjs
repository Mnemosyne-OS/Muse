/**
 * check-i18n — fails loudly when the three locales drift apart.
 *
 * CLAUDE.md rule 3: every key lives in en.json, fr.json AND es.json. A missing
 * key is invisible at runtime (it falls back to English, then to the raw key),
 * so the only way it stays honest is a check that breaks the build.
 *
 * Run: node scripts/check-i18n.mjs  (wired as `pnpm --filter …/muse i18n`)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'src', 'i18n', 'locales');
const LOCALES = ['en', 'fr', 'es'];

/** Flatten "a.b.c" paths, so a nested object never hides a missing leaf. */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out);
    else out.add(path);
  }
  return out;
}

const keys = {};
for (const l of LOCALES) {
  keys[l] = flatten(JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf-8')));
}

const union = new Set(LOCALES.flatMap((l) => [...keys[l]]));
let failed = false;
for (const l of LOCALES) {
  const missing = [...union].filter((k) => !keys[l].has(k)).sort();
  if (missing.length) {
    failed = true;
    console.error(`✗ ${l}.json is missing ${missing.length} key(s):\n   ${missing.join('\n   ')}`);
  }
}

// Placeholders must match too: a {{name}} present in one locale and absent in
// another produces a sentence with a hole in it, only in that language.
const ph = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');
const raw = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf-8'))]));
const read = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
for (const k of union) {
  const sets = LOCALES.map((l) => ({ l, v: read(raw[l], k) })).filter((x) => typeof x.v === 'string');
  const first = ph(sets[0].v);
  for (const s of sets.slice(1)) {
    if (ph(s.v) !== first) {
      failed = true;
      console.error(`✗ ${k}: placeholders differ — ${sets[0].l}(${first || '∅'}) vs ${s.l}(${ph(s.v) || '∅'})`);
    }
  }
}

if (failed) process.exit(1);
console.log(`✓ i18n OK — ${union.size} keys × ${LOCALES.length} locales, placeholders aligned.`);
