/**
 * test-logic.mjs — smoke tests for appLogic.ts's pure functions (extracted
 * out of App.tsx's giant component so they could be tested at all).
 *
 * Same rationale and harness style as test.mjs (see that file's header):
 * zero new dependencies, Node 22's --experimental-strip-types imports the
 * .ts source directly.
 *
 * Run: node --experimental-strip-types scripts/test-logic.mjs
 *      (wired as `pnpm --filter …/muse test:logic`)
 */
import {
  fmtUsd, formatCost, memLabelUI, parseCost, parseMemSource, parseGrounding, parseDocImages,
  renderMsg,
  joinPath, projectPhases, fileIcon, mermaidLiveUrl, buildDocTree, osLabel, downloadUrl, extractHtml, isHostTimeout,
  versionTail,
} from '../src/appLogic.ts';

let pass = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  failures.push(`${label}\n   expected: ${e}\n   actual:   ${a}`);
}

function ok(cond, label) {
  if (cond) { pass++; return; }
  failures.push(label);
}

// appLogic.ts takes `t`/`lang` as explicit params rather than importing the
// real i18n module (that module pulls in the locale JSON with a Vite-only
// import-attribute-free syntax Node's loader rejects — see appLogic.ts's
// header comment). A tiny fake translator is enough: these tests pin the
// FUNCTIONS' logic, not the real translated copy — check-i18n.mjs and the
// App.tsx JSDoc pass already guard the real strings/keys.
const T_EN = { 'cost.free': 'free', 'cost.unmeasured': 'not measured', 'mem.none': 'no memory', 'mem.all': 'my whole memory' };
const t = (key) => T_EN[key] ?? key;
const lang = 'en';

// ── Cost formatting — the exact bug fixed earlier this session: cost must
// show in the SAME unit as the wallet balance (dollars), never cents, and
// "unmeasured" must never render as a fake zero. ─────────────────────────────
{
  eq(formatCost(null, t, lang), '', 'formatCost: null (nothing measured) renders as an empty string, never "0"');
  eq(formatCost({ unmeasured: 'local' }, t, lang), 'free', 'formatCost: local-engine "unmeasured" reads as free, via t(), with no fabricated digit');
  eq(formatCost({ unmeasured: 'byok' }, t, lang), 'not measured', 'formatCost: BYOK "unmeasured" renders a distinct message, via t()');
  eq(fmtUsd(0, 2, lang), '$0.00', 'fmtUsd: zero renders with the requested decimals');
  ok(formatCost({ usdMicro: 0 }, t, lang).includes('0.00'), 'formatCost: a measured zero-cost run shows "$0.00", not blank (blank means "not measured", 0 means "measured, cost nothing")');
  ok(formatCost({ usdMicro: 500 }, t, lang).startsWith('<'), 'formatCost: under a tenth of a cent (500 micro-USD = $0.0005) shows as "< $0.001" rather than rounding to a misleading "$0.00"');

  // The symbol MOVES with the language — appending " $" by hand was right in
  // French only, and printed "0.00 $" to every English reader. The separator
  // is a NO-BREAK space (U+00A0), not a plain one: written by hand, a
  // price could wrap between the amount and its symbol.
  eq(fmtUsd(1.23, 2, 'en'), '$1.23', 'fmtUsd (en): the symbol leads, dot decimal, no space');
  eq(fmtUsd(1.23, 2, 'fr'), '1,23\u00a0$', 'fmtUsd (fr): the symbol trails, comma decimal, joined by a no-break space');
  eq(fmtUsd(1.23, 2, 'es'), '1,23\u00a0$', 'fmtUsd (es): narrowSymbol keeps a plain $, not the "US$" es-ES defaults to');
  eq(formatCost({ usdMicro: 5_000 }, t, lang), fmtUsd(0.005, 3, lang), 'formatCost: under a cent keeps 3 decimals');
  eq(formatCost({ usdMicro: 1_230_000 }, t, lang), fmtUsd(1.23, 2, lang), 'formatCost: a dollar-plus amount keeps 2 decimals');
}

// -- renderMsg: a status line that survives a language switch ---------------
// The bug it exists for: `setError(t('err.x'))` froze the SENTENCE. Switch the
// shell afterwards and the banner kept speaking the old language, because a
// re-render cannot re-translate a string that is already a string.
{
  // An unknown key comes back STAMPED, not echoed. A t() that echoes its
  // argument makes "was this string translated?" unanswerable — and the raw
  // host error below is exactly the string that must never reach t().
  const fake = (dict) => (key, vars) => (dict[key] ?? '[t]' + key)
    .replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars?.[k] ?? ''));
  const fr = fake({ 'err.x': 'Erreur : {{n}}', 'err.hint': 'Réessaie.' });
  const en = fake({ 'err.x': 'Error: {{n}}', 'err.hint': 'Try again.' });

  const stored = { key: 'err.x', vars: { n: 3 } };
  eq(renderMsg(stored, fr), 'Erreur : 3', 'renderMsg: renders the key with the CURRENT language');
  eq(renderMsg(stored, en), 'Error: 3', 'renderMsg: the SAME stored value reads differently after a switch — the whole point');

  eq(renderMsg('ENOENT: no such file', en), 'ENOENT: no such file',
    'renderMsg: a raw string passes through — a host error is not ours to translate');
  eq(renderMsg([{ key: 'err.x', vars: { n: 1 } }, 'ENOENT'], en), 'Error: 1 ENOENT',
    'renderMsg: an array joins a translated head to an untranslated tail');
  eq(renderMsg([{ key: 'err.x', vars: { n: 1 } }, { key: 'err.hint' }], fr), 'Erreur : 1 Réessaie.',
    'renderMsg: two keys compose without either being frozen');

  // `{msg && …}` guards all over App.tsx depend on the empty case staying falsy.
  for (const empty of [null, undefined, '', []]) {
    eq(renderMsg(empty, en), '', `renderMsg: ${JSON.stringify(empty)} renders as nothing, so the banner guard stays falsy`);
  }
  eq(renderMsg(['', { key: 'err.hint' }], en), 'Try again.',
    'renderMsg: an empty part does not leave a leading space');
}

// ── Memory label / mode passthrough (UI-facing wrapper over handoff's own
// memoryMode/memoryLabel — a regression here would desync the picker's own
// label from what the badge and history rows show). ─────────────────────────
{
  eq(memLabelUI(null, t), 'my whole memory', 'memLabelUI: null (federated) goes through t(\'mem.all\')');
  eq(memLabelUI({ mode: 'none', vaults: [] }, t), 'no memory', 'memLabelUI: none goes through t(\'mem.none\')');
  eq(memLabelUI({ mode: 'pick', vaults: [{ vaultId: 'a', displayName: 'Notes' }] }, t), 'Notes',
    'memLabelUI: a single picked vault shows its name (bypasses t(), comes from handoff\'s own memoryLabel)');
}

// ── Round-tripping what was persisted on a document take — the exact bug
// class from earlier this session (a stored take silently defaulting to
// "all" on reopen instead of keeping "no contract on record"). ──────────────
{
  eq(parseCost(undefined), null, 'parseCost: absent field (pre-cost-tracking row) is null, not zero');
  eq(parseCost({ usdMicro: 42 }), { usdMicro: 42 }, 'parseCost: reads back a measured cost');
  eq(parseCost({ unmeasured: 'byok' }), { unmeasured: 'byok' }, 'parseCost: reads back an unmeasured marker');
  eq(parseCost({ unmeasured: 'nonsense' }), null, 'parseCost: an unrecognized unmeasured value is rejected, not passed through');

  eq(parseMemSource(undefined), null, 'parseMemSource: absent shape returns null (no contract), never a silent "all"');
  eq(parseMemSource({ mode: 'none', vaults: [] }), { mode: 'none', vaults: [] }, 'parseMemSource: none round-trips');
  eq(parseMemSource({ mode: 'pick', vaults: [{ vaultId: 'a' }] }), { mode: 'pick', vaults: [{ vaultId: 'a', displayName: 'a' }] },
    'parseMemSource: a vault missing displayName falls back to its id');
  eq(parseMemSource({ mode: 'pick', vaults: [] }), null, 'parseMemSource: an empty pick array is not a valid contract (null, not "all")');

  eq(parseGrounding(undefined), null, 'parseGrounding: absent (pre-grounding row) is null ("unknown"), never zero');
  eq(parseGrounding({ count: 3, vaults: ['Notes'], mode: 'pick' }), { count: 3, vaults: ['Notes'], mode: 'pick' },
    'parseGrounding: reads back a full record');
  eq(parseGrounding({ count: 0, vaults: [] }), { count: 0, vaults: [], mode: 'all' }, 'parseGrounding: missing mode defaults to "all"');

  eq(parseDocImages(null), [], 'parseDocImages: non-array input is an empty list, not a throw');
  eq(parseDocImages([{ rel: 'a.png', path: '/x/a.png', caption: 'a photo' }]),
    [{ rel: 'a.png', path: '/x/a.png', caption: 'a photo' }], 'parseDocImages: a well-formed entry round-trips');
  eq(parseDocImages([{ rel: 'a.png' }, { rel: 'b.png', path: '/x/b.png' }]),
    [{ rel: 'b.png', path: '/x/b.png', caption: undefined }],
    'parseDocImages: a malformed entry (missing path) is dropped, not failing the whole take');
}

// ── Path joining (cross-OS) ───────────────────────────────────────────────────
{
  eq(joinPath('C:\\Users\\tony\\space', 'documents'), 'C:\\Users\\tony\\space\\documents', 'joinPath: follows the base\'s own backslash style');
  eq(joinPath('/home/tony/space', 'documents'), '/home/tony/space/documents', 'joinPath: follows the base\'s own forward-slash style');
}

// ── Project-board phases (the Gantt "tells the truth" — statuses are derived
// from what is ACTUALLY on disk, this pins the derivation itself). ──────────
{
  const t = (key) => key; // identity translator — this suite checks structure/status, not copy
  const nothingBuilt = projectPhases('cartridge', { tokens: false, artifacts: false, adapted: false, built: false, verity: false }, t);
  eq(nothingBuilt.find((p) => p.id === 'handoff')?.status, 'current', 'projectPhases: hand-off is the live step before anything is built');
  eq(nothingBuilt.find((p) => p.id === 'build')?.status, 'next', 'projectPhases: build is "next" (not yet built)');
  eq(nothingBuilt.find((p) => p.id === 'verify')?.status, 'soon', 'projectPhases: verify is only "soon" before a build exists');
  eq(nothingBuilt.find((p) => p.id === 'design')?.status, 'optional', 'projectPhases: design with nothing on disk is "optional", not "done"');

  const allBuilt = projectPhases('site', { tokens: true, artifacts: true, adapted: false, built: true, verity: true }, t);
  eq(allBuilt.find((p) => p.id === 'handoff')?.status, 'done', 'projectPhases: hand-off flips to "done" once a build exists');
  eq(allBuilt.find((p) => p.id === 'build')?.status, 'done', 'projectPhases: build is "done" once it is actually on disk');
  eq(allBuilt.find((p) => p.id === 'verify')?.status, 'done', 'projectPhases: verify is "done" once VERITY.md exists');
  eq(allBuilt.find((p) => p.id === 'design')?.status, 'done', 'projectPhases: design tokens on disk mark the step "done"');

  eq(nothingBuilt.find((p) => p.id === 'build')?.title, 'board.phase.buildApp', 'projectPhases: the "cartridge" lane uses the app-flavored build/publish titles');
  eq(allBuilt.find((p) => p.id === 'build')?.title, 'board.phase.buildSite', 'projectPhases: the "site" lane uses the site-flavored build/publish titles');
}

// ── Doc-tree building (nested folder grouping, README-first sort) ───────────
{
  const docs = [
    { name: 'guide.md', rel: 'guides/guide.md', path: '/x/guides/guide.md' },
    { name: 'README.md', rel: 'README.md', path: '/x/README.md' },
    { name: 'notes.md', rel: 'guides/notes.md', path: '/x/guides/notes.md' },
    { name: 'README.md', rel: 'guides/README.md', path: '/x/guides/README.md' },
  ];
  const tree = buildDocTree(docs);
  eq(tree.files.map((f) => f.rel), ['README.md'], 'buildDocTree: root-level files grouped correctly');
  eq(tree.folders.map((f) => f.name), ['guides'], 'buildDocTree: one subfolder created for the nested docs');
  const guides = tree.folders[0];
  eq(guides.files.map((f) => f.name), ['README.md', 'guide.md', 'notes.md'],
    'buildDocTree: a SUBFOLDER\'s README.md is pinned first too (the check compares the bare `name`, not the full `rel` path)');
  eq(tree.count, 4, 'buildDocTree: the root count rolls up every doc across all subfolders');
}

// ── Small format/OS/misc helpers ──────────────────────────────────────────────
{
  eq(fileIcon('SPEC.md'), '📄', 'fileIcon: markdown (case-insensitive extension)');
  eq(fileIcon('design-tokens.json'), '🧩', 'fileIcon: json');
  eq(fileIcon('index.html'), '🌐', 'fileIcon: html');
  eq(fileIcon('App.tsx'), '⚙️', 'fileIcon: source code');
  eq(fileIcon('LICENSE'), '📃', 'fileIcon: unrecognized extension falls back to a generic icon');

  ok(mermaidLiveUrl('graph TD; A-->B').startsWith('https://mermaid.live/view#base64:'), 'mermaidLiveUrl: builds a mermaid.live deep link');

  eq(osLabel('win', (k) => k), 'Windows', 'osLabel: Windows is a proper noun, not translated');
  eq(osLabel('mac', (k) => k), 'macOS', 'osLabel: macOS is a proper noun, not translated');
  eq(osLabel('other', (k) => k), 'ob.otherSystem', 'osLabel: only the unknown-OS fallback goes through t()');

  eq(downloadUrl({ page: 'https://example.com' }, 'win'), 'https://example.com', 'downloadUrl: falls back to the product page with no direct link');
  eq(downloadUrl({ direct: 'https://example.com/dl', page: 'https://example.com' }, 'linux'), 'https://example.com/dl', 'downloadUrl: prefers the single direct link when there is no per-OS map');
  const perOs = { directByOs: { win: 'https://x/win', mac: 'https://x/mac', linux: 'https://x/linux' }, page: 'https://x' };
  eq(downloadUrl(perOs, 'mac'), 'https://x/mac', 'downloadUrl: picks the matching OS-specific link');
  eq(downloadUrl(perOs, 'other'), 'https://x', 'downloadUrl: an unrecognized OS falls back to the product page even with a per-OS map available');

  eq(extractHtml('```html\n<p>hi</p>\n```'), '<p>hi</p>', 'extractHtml: strips a ```html fence');
  eq(extractHtml('```\n<p>hi</p>\n```'), '<p>hi</p>', 'extractHtml: strips a bare ``` fence too');
  eq(extractHtml('<p>hi</p>'), '<p>hi</p>', 'extractHtml: an unfenced reply passes through untouched');

  ok(isHostTimeout(new Error('bridge did not reply in time')), 'isHostTimeout: recognizes the bridge timeout message');
  ok(!isHostTimeout(new Error('some other failure')), 'isHostTimeout: an unrelated error is not mistaken for a timeout');
}

// ── versionTail — the suffix BOTH version-history tooltips share ─────────────
// It exists because the dashboard's and the done screen's tooltips had drifted
// apart; these pin the shared shape so they cannot drift again.
{
  const base = { style: null, tier: null, cost: null };
  eq(versionTail(base, null, t, lang), ' · doc.styleAutoTag',
    'versionTail: no style at all still states it explicitly ("auto"), never renders an empty gap');
  eq(versionTail({ ...base, style: 'zen' }, 'Zen', t, lang), ' · doc.styleTag',
    'versionTail: a named style goes through t(), and the preset NAME is passed in (product noun, never translated)');
  ok(versionTail({ ...base, tier: 'max' }, null, t, lang).includes('doc.tierTag'),
    'versionTail: the engine tier is appended when present');
  eq(versionTail({ ...base, tier: null }, null, t, lang).includes('doc.tierTag'), false,
    'versionTail: no tier means no engine segment at all, not an empty one');
  ok(versionTail({ ...base, cost: { usdMicro: 1_230_000 } }, null, t, lang).includes('1.23'),
    'versionTail: a measured cost is appended, formatted in dollars');
  eq(versionTail({ ...base, cost: null }, null, t, lang).includes('$'), false,
    'versionTail: an unmeasured take shows NO cost segment rather than a fake zero');
  eq(versionTail({ style: 'zen', tier: 'max', cost: { usdMicro: 1_230_000 } }, 'Zen', t, lang),
    ` · doc.styleTag · doc.tierTag · ${fmtUsd(1.23, 2, lang)}`,
    'versionTail: full form keeps the style · tier · cost order with a single separator between each');
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`✗ ${failures.length}/${pass + failures.length} failed:\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}
console.log(`✓ appLogic.ts — ${pass} assertions passed.`);
