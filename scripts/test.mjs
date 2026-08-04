/**
 * test.mjs — smoke tests for handoff.ts's pure functions.
 *
 * Why not vitest: apps/muse has no test runner installed, and adding one
 * means `pnpm install` — which is unsafe to run while the Electron app has
 * this workspace open (Windows file locks have wiped `dist` before, see
 * memory: "JAMAIS pnpm install app ouverte"). Node 22's
 * --experimental-strip-types imports handoff.ts directly, so this suite adds
 * ZERO dependencies and needs no build step. Revisit as real vitest once a
 * safe window (app closed) allows `pnpm install`.
 *
 * Run: node --experimental-strip-types scripts/test.mjs
 *      (wired as `pnpm --filter …/muse test`)
 */
import {
  setPromptLanguage, langEndonym, langInEnglish, languageSystemPrompt,
  buildFramingPrompt, parseFramingReply,
  buildDocPlanPrompt, buildDocRenderPrompt,
  memoryMode, memoryScope, memoryLabel,
  isAppSandboxVault, prettyVaultName, orderVaultsForDisplay,
  replaceImagePlaceholders, isImageFile,
  adaptOdTokens, adaptOdDesignMd, buildOdSystem, odScheme, buildDesignTokens, isOdCatalog, buildDocSystemBlock, inlineOdStylesheet,
  odPercent, odElapsedLabel, odAvailablePages, OD_EXPECTED_SYSTEMS,
  resolveDesignMix, mixRoleSystem, EMPTY_MIX, buildDocDesignBlock, fontStack, FONT_CANDIDATES, FONT_ROLES,
} from '../src/handoff.ts';

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

// ── Language integrity ──────────────────────────────────────────────────────
// This is the bug class a real user hit: the coach answered in English while
// the shell was in French. The directive was correct but buried far from the
// generation point — these tests pin both its PRESENCE and its POSITION
// (the trailing reminder), so a future edit can't quietly drop either.
for (const lang of ['fr', 'es', 'en']) {
  setPromptLanguage(lang);
  const endonym = langEndonym();
  const inEnglish = langInEnglish();

  const framing = buildFramingPrompt('a cooking timer', [], false, 'auto');
  ok(framing.includes(`MY LANGUAGE: ${endonym}`), `framing prompt (${lang}): states MY LANGUAGE: ${endonym}`);
  ok(/\(Reminder:.*MUST be written in/i.test(framing) && framing.includes(endonym),
    `framing prompt (${lang}): trailing reminder repeats ${endonym} near the output cue`);
  const lastReminder = framing.trim().slice(framing.trim().lastIndexOf('(Reminder:'));
  ok(lastReminder.endsWith(')') && lastReminder.includes(endonym) && framing.trim().endsWith(lastReminder),
    `framing prompt (${lang}): the reminder sentence is the LAST thing before generation (recency matters for compliance)`);

  const rendered = buildDocRenderPrompt({ name: 'Test', purpose: 'A test document' });
  ok(rendered.includes(`LANGUAGE: everything visible is in ${inEnglish.toUpperCase()}`),
    `render prompt (${lang}): states the visible-text language as ${inEnglish}`);
  ok(rendered.includes(`written in ${inEnglish}`), `render prompt (${lang}): trailing reminder repeats ${inEnglish}`);

  // Regression pin for a real hardcoded-language bug found in this same pass:
  // buildDocPlanPrompt's OUTPUT scaffold literally spelled "TITRE"/"ANCRE"/
  // "forme:" in French, even for an EN or ES user — the scaffold KEYS must
  // stay English (machine-parsed shape) regardless of language; only the
  // human content between < > is localized.
  const plan = buildDocPlanPrompt({ name: 'Test', purpose: 'A test document' });
  ok(plan.includes('AUDIENCE:') && plan.includes('MESSAGE:') && plan.includes('ANCHOR:'),
    `plan prompt (${lang}): scaffold keys stay English (AUDIENCE/MESSAGE/ANCHOR)`);
  ok(!/TITRE|ANCRE|forme:/.test(plan), `plan prompt (${lang}): no hardcoded French leaking into the scaffold`);

  // languageSystemPrompt(): the dedicated system-channel pin added after the
  // in-prompt reminder alone still went unheeded in the field (a real user
  // report, French shell, English coach reply). Written IN the target
  // language, not "in English about" it — pin both facts down.
  const sys = languageSystemPrompt();
  ok(sys.length > 0, `languageSystemPrompt (${lang}): never empty (an empty systemPrompt leaves the host's own vague fallback as the only signal)`);
  if (lang !== 'en') ok(!/^[ -~]*$/.test(sys), `languageSystemPrompt (${lang}): written using the language's own script/accents, not translated-sounding English`);
}
setPromptLanguage('fr'); // restore a sane default for the rest of the suite

// ── parseFramingReply ────────────────────────────────────────────────────────
{
  const brief = parseFramingReply('BRIEF: {"name":"Cosmos","purpose":"A star map","features":["zoom"],"nextSteps":["share"],"lane":"cartridge"}');
  eq(brief.brief, { name: 'Cosmos', purpose: 'A star map', features: ['zoom'], nextSteps: ['share'], lane: 'cartridge' },
    'parseFramingReply: parses a well-formed BRIEF');

  const question = parseFramingReply('QUESTION: Who is this for?');
  eq(question, { question: 'Who is this for?' }, 'parseFramingReply: parses a QUESTION');

  const fenced = parseFramingReply('```\nQUESTION: What does it do?\n```');
  eq(fenced, { question: 'What does it do?' }, 'parseFramingReply: strips a code fence around QUESTION');

  const malformed = parseFramingReply('BRIEF: {not json}');
  ok(!malformed.brief, 'parseFramingReply: malformed BRIEF JSON does not produce a brief');

  const freeChat = parseFramingReply('Sure, tell me more about your idea!');
  eq(freeChat, { question: 'Sure, tell me more about your idea!' },
    'parseFramingReply: unlabelled free chat surfaces as a question rather than being dropped');

  const missingName = parseFramingReply('BRIEF: {"purpose":"x","features":[],"nextSteps":[],"lane":"doc"}');
  ok(!missingName.brief, 'parseFramingReply: a BRIEF missing "name" is rejected, not accepted half-empty');

  const badLane = parseFramingReply('BRIEF: {"name":"X","purpose":"Y","features":[],"nextSteps":[],"lane":"nonsense"}');
  eq(badLane.brief?.lane, 'cartridge', 'parseFramingReply: an unrecognized lane falls back to "cartridge", never crashes');
}

// ── Memory scope / mode / label ──────────────────────────────────────────────
// Direct coverage of today's earlier fix: these three functions are now the
// ONLY place a call site derives a scope, so a wrong answer here breaks
// every inference at once.
{
  eq(memoryMode(undefined), 'all', 'memoryMode: undefined is federated');
  eq(memoryMode(null), 'all', 'memoryMode: null is federated');
  eq(memoryMode({ mode: 'pick', vaults: [] }), 'all', 'memoryMode: an empty pick degrades to federated, not a silent no-op');
  eq(memoryMode({ mode: 'pick', vaults: [{ vaultId: 'x', displayName: 'X' }] }), 'pick', 'memoryMode: a non-empty pick stays pick');
  eq(memoryMode({ mode: 'none', vaults: [] }), 'none', 'memoryMode: none stays none');

  eq(memoryScope({ mode: 'none', vaults: [] }), { disableRAG: true }, 'memoryScope: none disables RAG');
  eq(memoryScope({ mode: 'all', vaults: [] }), {}, 'memoryScope: all sends no scope fields (federated is the absence of scope)');
  eq(memoryScope({ mode: 'pick', vaults: [{ vaultId: 'a', displayName: 'A' }, { vaultId: 'b', displayName: 'B' }] }),
    { vaultIds: ['a', 'b'] }, 'memoryScope: pick sends exactly the chosen vaultIds');

  eq(memoryLabel(null), 'toute ma mémoire', 'memoryLabel: null reads as "toute ma mémoire"');
  eq(memoryLabel({ mode: 'none', vaults: [] }), 'aucune mémoire', 'memoryLabel: none reads as "aucune mémoire"');
  const oneTwo = { mode: 'pick', vaults: [{ vaultId: 'a', displayName: 'Notes' }, { vaultId: 'b', displayName: 'Recherche' }] };
  eq(memoryLabel(oneTwo), 'Notes + Recherche', 'memoryLabel: two vaults are both named');
  const three = { mode: 'pick', vaults: [{ vaultId: 'a', displayName: 'Notes' }, { vaultId: 'b', displayName: 'Recherche' }, { vaultId: 'c', displayName: 'Dev' }] };
  eq(memoryLabel(three), 'Notes + Recherche +1', 'memoryLabel: a third vault collapses to "+1" rather than listing everything');
}

// ── Vault-name readability (today's earlier fix) ─────────────────────────────
{
  ok(isAppSandboxVault('app-mnemosyne-plugins-founders-console'), 'isAppSandboxVault: recognizes a sandbox slug');
  ok(!isAppSandboxVault('Notes'), 'isAppSandboxVault: a human vault name is not mistaken for a sandbox');

  eq(prettyVaultName('app-mnemosyne-plugins-founders-console'), 'Founders Console',
    'prettyVaultName: strips the namespace prefix and title-cases the rest');
  eq(prettyVaultName('app-bmad-2'), 'Bmad 2', 'prettyVaultName: works without the mnemosyne-plugins segment too');
  eq(prettyVaultName('AGRICULTURE'), 'AGRICULTURE', 'prettyVaultName: a human vault name passes through untouched');

  const mixed = ['app-mnemosyne-plugins-founders-console', 'AGRICULTURE', 'app-bmad-2', 'Notes'];
  eq(orderVaultsForDisplay(mixed), ['AGRICULTURE', 'Notes', 'app-mnemosyne-plugins-founders-console', 'app-bmad-2'],
    'orderVaultsForDisplay: human vaults lead, sandboxes trail, order stable within each group');
}

// ── Image placeholder swap (today's feature) ─────────────────────────────────
{
  const out = replaceImagePlaceholders('<p>before {{IMG_1}} after</p>', [
    { token: '{{IMG_1}}', uri: 'data:image/png;base64,AAAA', alt: 'a photo' },
  ]);
  ok(out.includes('src="data:image/png;base64,AAAA"') && out.includes('alt="a photo"'),
    'replaceImagePlaceholders: swaps a token for an <img> carrying the right src/alt');

  const unused = replaceImagePlaceholders('<p>{{IMG_1}} and {{IMG_2}}</p>', [
    { token: '{{IMG_1}}', uri: 'data:image/png;base64,BBBB', alt: 'one' },
  ]);
  ok(!unused.includes('{{IMG_2}}'), 'replaceImagePlaceholders: an unused token is stripped, never shipped literally');

  // The exact trap this codebase already learned from once (memory:
  // "main-bundle-native-import-sealed-core-trap" / the String.replace $-sign
  // incident): a replacement STRING interprets $&/$'/$$ as special patterns.
  // A data URI or filename containing a literal "$" must not corrupt the
  // surrounding document.
  const dollar = replaceImagePlaceholders('<p>{{IMG_1}}</p>', [
    { token: '{{IMG_1}}', uri: 'data:image/png;base64,$&$$weird', alt: 'x' },
  ]);
  ok(dollar.includes('base64,$&$$weird'), 'replaceImagePlaceholders: a "$" in the data URI is not eaten by the replacement');

  ok(isImageFile('photo.PNG'), 'isImageFile: extension check is case-insensitive');
  ok(!isImageFile('notes.txt'), 'isImageFile: a non-image extension is rejected');
}

// ── Document format & visuals directives ─────────────────────────────────────
{
  const page = buildDocRenderPrompt({ name: 'T', purpose: 'P', format: 'page' });
  const long = buildDocRenderPrompt({ name: 'T', purpose: 'P', format: 'long' });
  const slides = buildDocRenderPrompt({ name: 'T', purpose: 'P', format: 'slides' });
  ok(/4 to 6 sections/.test(page), 'buildDocRenderPrompt: page format states its own section count');
  ok(/LONG-FORM/.test(long) && /table of contents/i.test(long), 'buildDocRenderPrompt: long format asks for depth and a TOC');
  ok(/SLIDE DECK/.test(slides) && /100dvh/.test(slides), 'buildDocRenderPrompt: slides format asks for full-screen sections');

  const noSvg = buildDocRenderPrompt({ name: 'T', purpose: 'P' });
  const withSvg = buildDocRenderPrompt({ name: 'T', purpose: 'P', svg: true });
  ok(!/DIAGRAMS/.test(noSvg), 'buildDocRenderPrompt: no SVG directive when not requested');
  ok(/DIAGRAMS/.test(withSvg), 'buildDocRenderPrompt: SVG directive present when requested');

  const noImages = buildDocRenderPrompt({ name: 'T', purpose: 'P' });
  const withImages = buildDocRenderPrompt({
    name: 'T', purpose: 'P',
    images: [{ name: 'photo.png', caption: 'the team on launch day' }, { name: 'diagram.jpg' }],
  });
  ok(!/IMAGES —/.test(noImages), 'buildDocRenderPrompt: no IMAGES directive when none supplied');
  ok(withImages.includes('{{IMG_1}}') && withImages.includes('{{IMG_2}}') && !withImages.includes('{{IMG_3}}'),
    'buildDocRenderPrompt: exactly one token per supplied image, none extra');
  ok(withImages.includes('the team on launch day'),
    'buildDocRenderPrompt: a caption reaches the model as the image description');
  ok(withImages.includes('no description given — file: diagram.jpg'),
    'buildDocRenderPrompt: an uncaptioned image is explicitly flagged as a guess, not silently passed as if captioned');
  ok(!withImages.includes('base64') && !/data:image/.test(withImages),
    'buildDocRenderPrompt: never the image bytes — only name/caption reach the model');
}

// ── Open Design catalogue adapter ───────────────────────────────────────────
// Fixtures mirror the real shapes on disk (checked against
// design-systems/bento on 2026-08-01): od-design-tokens/v1 declares a flat
// token array of CSS custom properties, and DESIGN.md ends on its
// Anti-patterns section.
{
  const odTokens = JSON.stringify({
    schemaVersion: 1, format: 'od-design-tokens/v1',
    summary: { grade: 'excellent' },
    tokens: [
      { name: '--bg', value: '#f5f8ff', type: 'color', layer: 'A1-identity' },
      { name: '--surface', value: '#ffffff', type: 'color' },
      { name: '--fg', value: '#101828', type: 'color' },
      { name: '--muted', value: '#667085', type: 'color' },
      { name: '--primary', value: '#2563eb', type: 'color' },
      { name: '--accent', value: '#2563eb', type: 'color' },
      { name: '--accent-hover', value: 'color-mix(in oklab, var(--accent), black 8%)', type: 'color' },
      { name: '--font-sans', value: 'Inter, system-ui, sans-serif', type: 'fontFamily' },
      { name: '--radius-md', value: '10px', type: 'dimension' },
    ],
  });

  const tk = adaptOdTokens(odTokens);
  eq(tk.palette, { background: '#f5f8ff', surface: '#ffffff', text: '#101828', muted: '#667085', base: '#2563eb' },
    'adaptOdTokens: the five Muse roles come straight off the declared tokens');
  eq(tk.accents, ['#2563eb'], 'adaptOdTokens: color-mix()/var() accents are dropped — a swatch that paints nothing reads as "no colour"');
  eq(tk.fonts, ['Inter, system-ui, sans-serif'], 'adaptOdTokens: font families are picked up by name');
  eq(tk.tokenCount, 9, 'adaptOdTokens: counts what it actually read');

  ok(adaptOdTokens(null) === null, 'adaptOdTokens: missing file → null, never an empty palette');
  ok(adaptOdTokens('not json') === null, 'adaptOdTokens: unparseable file → null');
  ok(adaptOdTokens('{"tokens":[]}') === null, 'adaptOdTokens: zero tokens → null, so the system cannot show up palette-less');
  ok(adaptOdTokens('{"tokens":"nope"}') === null, 'adaptOdTokens: tokens must be an array');

  // THE regression: Anti-patterns is the LAST section of DESIGN.md. An
  // end-anchored body regex returns zero items here — a real zero and an
  // unparsed section are indistinguishable downstream, so this stays tested.
  const designMd = [
    '# Design System Inspired by Bento', '',
    '> Category: Layout & Structure',
    '> Modular grid layout with card-like blocks.', '',
    '## 1. Visual Theme & Atmosphere', '', '- **Visual style:** modern, clean', '',
    '## 9. Anti-patterns', '',
    '- Do not introduce off-palette colors when an existing token can solve the problem.',
    '- Do not flatten hierarchy by using the same type size/weight for all text.',
  ].join('\n');
  const dm = adaptOdDesignMd(designMd);
  eq(dm.antiPatterns.length, 2, 'adaptOdDesignMd: the LAST section is captured (no \\Z anchor in JS regex)');
  eq(dm.category, 'Layout & Structure', 'adaptOdDesignMd: category read from the quoted header');
  eq(dm.intent, 'Modular grid layout with card-like blocks.', 'adaptOdDesignMd: intent is the non-category quote line');
  ok(dm.authored === false, 'adaptOdDesignMd: the boilerplate line is recognized as gabarit, not curated guidance');

  const authored = adaptOdDesignMd('# X\n\n## 9. Anti-patterns\n\n- ❌ No drop shadows above 30px blur.\n');
  ok(authored.authored === true, 'adaptOdDesignMd: a system that writes its own rules is marked authored');
  eq(adaptOdDesignMd(null).antiPatterns, [], 'adaptOdDesignMd: missing file → empty, not a crash');
  eq(adaptOdDesignMd('# No sections here').antiPatterns, [], 'adaptOdDesignMd: no anti-pattern section → empty');

  const sys = buildOdSystem('bento', 'C:\\space\\design-refs\\open-design\\design-systems\\bento', {
    manifest: JSON.stringify({ name: 'Bento', category: 'Layout & Structure' }),
    tokens: odTokens, design: designMd,
  });
  eq(sys.name, 'Bento', 'buildOdSystem: display name comes from the manifest');
  eq(sys.id, 'bento', 'buildOdSystem: id stays the folder name');
  ok(sys.authoredAntiPatterns === false, 'buildOdSystem: carries the authored flag through');
  ok(buildOdSystem('x', 'C:\\d', { manifest: null, tokens: null, design: designMd }) === null,
    'buildOdSystem: no readable tokens → null (a system with no palette has nothing to give)');
  eq(buildOdSystem('bento', 'C:\\d', { manifest: '{broken', tokens: odTokens, design: null }).name, 'bento',
    'buildOdSystem: a broken manifest falls back to the folder name instead of failing the system');

  // Light/dark must follow the system's own background, not the style preset.
  eq(odScheme(sys), 'light', 'odScheme: a pale background reads as light');
  eq(odScheme({ ...sys, palette: { background: '#0b1020' } }), 'dark', 'odScheme: a dark background reads as dark');
  eq(odScheme({ ...sys, palette: { background: '#FFF' } }), 'light', 'odScheme: 3-digit hex is expanded');
  eq(odScheme({ ...sys, palette: { background: 'oklch(0.98 0 0)' } }), 'dark',
    'odScheme: an unparsed colour falls back to dark rather than guessing a luminance');
  eq(odScheme({ ...sys, palette: {} }), 'dark', 'odScheme: no background → dark');

  // The attached system's palette WINS, and says so in the file.
  const base = { hue: 210, harmony: 'analogous', scheme: 'light', styleId: null, effects: [], museVersion: '0.1.0' };
  const withSys = JSON.parse(buildDesignTokens({ ...base, system: sys }, '2026-08-01T00:00:00.000Z'));
  eq(withSys.palette.source, 'system', 'buildDesignTokens: the palette source is written down, never implied');
  eq(withSys.palette.background, '#f5f8ff', 'buildDesignTokens: the system background wins over the computed one');
  eq(withSys.palette.accents, ['#2563eb'], 'buildDesignTokens: system accents replace the harmony accents');
  eq(withSys.system.id, 'bento', 'buildDesignTokens: the system block names the system');
  ok(withSys.system.components.endsWith('components.html'), 'buildDesignTokens: the agent is pointed at the components file');
  eq(withSys.system.antiPatterns, [],
    'buildDesignTokens: gabarit anti-patterns are NOT passed to the agent as this system’s rules');

  const authoredSys = { ...sys, authoredAntiPatterns: true, antiPatterns: ['❌ No drop shadows.'] };
  eq(JSON.parse(buildDesignTokens({ ...base, system: authoredSys }, 'x')).system.antiPatterns, ['❌ No drop shadows.'],
    'buildDesignTokens: authored rules DO reach the agent');

  const noSys = JSON.parse(buildDesignTokens({ ...base, system: null }, 'x'));
  eq(noSys.palette.source, 'wheel', 'buildDesignTokens: without a system the wheel is the source');
  eq(noSys.system, null, 'buildDesignTokens: no system block when none is attached');
  ok(noSys.palette.background !== '#f5f8ff', 'buildDesignTokens: the wheel palette is computed, not left over');

  // Reference pages LINK ../tokens.css; under srcDoc that resolves to nothing
  // and every var(--…) comes back empty — the page rendered as serif text in
  // the field. The inliner is what makes the preview real.
  {
    const linked = '<html><head><link rel="stylesheet" href="../tokens.css" /><style>body{color:var(--fg)}</style></head><body>x</body></html>';
    const out = inlineOdStylesheet(linked, ':root{--fg:#222}');
    ok(out.includes('<style>:root{--fg:#222}</style>'), 'inlineOdStylesheet: the stylesheet is inlined where the link was');
    ok(!/<link/i.test(out), 'inlineOdStylesheet: the dead relative link is gone');
    ok(out.includes('var(--fg)'), 'inlineOdStylesheet: the page keeps its own <style> block');

    // String#replace treats $& / $' as patterns: a CSS file carrying them would
    // splice the document into itself. The replacement must be a function.
    const tricky = inlineOdStylesheet(linked, ".a::after{content:\"$& $' $$\"}");
    ok(tricky.includes("$& $' $$"), 'inlineOdStylesheet: $-patterns in the CSS survive verbatim');

    ok(!/<\/style>/i.test(inlineOdStylesheet(linked, 'a{}</style><script>bad()</script>').split('</style>')[0]),
      'inlineOdStylesheet: a </style> inside the CSS cannot close the tag early');
    eq(inlineOdStylesheet('<html>no link</html>', ':root{}'), '<html>no link</html>',
      'inlineOdStylesheet: a self-contained page (components.html) is left untouched');
    eq(inlineOdStylesheet(null, ':root{}'), null, 'inlineOdStylesheet: a missing page stays missing');
    eq(inlineOdStylesheet(linked, null), linked, 'inlineOdStylesheet: no tokens.css → the page is returned as-is, not blanked');

    const two = inlineOdStylesheet('<link rel="stylesheet" href="a.css"><link rel=stylesheet href="b.css">', ':root{--x:1}');
    eq((two.match(/<style>/g) || []).length, 1, 'inlineOdStylesheet: several links yield ONE inline copy, not duplicates');
  }

  // A document is rendered inside Muse, so a system reaches the model as text.
  const docBlock = buildDocSystemBlock(sys);
  ok(docBlock.includes('#f5f8ff') && docBlock.includes('#2563eb'),
    'buildDocSystemBlock: the exact authored values reach the model, not a description of them');
  ok(/EXACT/.test(docBlock), 'buildDocSystemBlock: the model is told not to reinterpret the palette');
  ok(docBlock.includes('Inter'), 'buildDocSystemBlock: the font direction is carried');
  ok(!/@import|<link>/.test(docBlock.split('NEVER use')[0]),
    'buildDocSystemBlock: external fonts are forbidden, never suggested');
  ok(!docBlock.includes('off-palette colors'),
    'buildDocSystemBlock: gabarit anti-patterns are not passed off as this system’s rules');
  ok(buildDocSystemBlock({ ...sys, authoredAntiPatterns: true, antiPatterns: ['No drop shadows.'] }).includes('No drop shadows.'),
    'buildDocSystemBlock: authored rules DO reach the model');
  ok(buildDocSystemBlock({ ...sys, palette: {}, accents: [], fonts: [], intent: null }).includes('VISUAL STYLE'),
    'buildDocSystemBlock: a bare system still yields a usable directive, never a crash');

  // Reference pages: shown in the studio, kept OUT of the tokens file.
  const withPages = buildOdSystem('bento', 'C:\\d', {
    manifest: null, tokens: odTokens, design: designMd,
    pages: { components: '<html>buttons and modals</html>', colors: '<html>ramps</html>' },
  });
  eq(odAvailablePages(withPages), ['components', 'colors'],
    'odAvailablePages: only the pages that came back get a tab — never an empty frame');
  eq(odAvailablePages(sys), [], 'odAvailablePages: nothing read → no tabs at all');
  ok(!buildDesignTokens({ ...base, system: withPages }, 'x').includes('<html>'),
    'buildDesignTokens: reference pages stay out of the file — the agent gets the path, not 55 KB of HTML');

  // Import progress: a percentage may only exist when something real can be
  // divided. During the fetch git reports no bytes, so null is the answer.
  ok(odPercent(0, OD_EXPECTED_SYSTEMS) === null, 'odPercent: nothing on disk yet → no percentage, not 0%');
  ok(odPercent(12, null) === null, 'odPercent: no denominator → no percentage (never invent a total)');
  eq(odPercent(76, 151), 50, 'odPercent: real count over the measured reference');
  eq(odPercent(1, 151), 1, 'odPercent: the first folder shows as 1%, never rounds down to 0');
  eq(odPercent(400, 151), 100, 'odPercent: a grown catalogue clamps at 100%, never 265%');
  eq(odElapsedLabel(0), '0 s', 'odElapsedLabel: seconds under a minute');
  eq(odElapsedLabel(59), '59 s', 'odElapsedLabel: last second before the minute');
  eq(odElapsedLabel(134), '2 min 14 s', 'odElapsedLabel: minutes and zero-padded seconds');
  eq(odElapsedLabel(120), '2 min 00 s', 'odElapsedLabel: an exact minute still shows its seconds');

  // ── "Mon design": one design mixed by role ────────────────────────────────
  {
    const mk = (id, over = {}) => ({
      id, path: `C:\\d\\${id}`, name: id.toUpperCase(), category: null, intent: null,
      palette: { background: '#111111', surface: '#222222', text: '#eeeeee', muted: '#888888', base: '#3366ff' },
      accents: ['#3366ff'], fonts: [`${id}-sans`], antiPatterns: [], authoredAntiPatterns: false,
      tokenCount: 56, pages: { components: null, colors: null, typography: null, spacing: null }, ...over,
    });
    const systems = new Map([
      ['a', mk('a', { palette: { background: '#ffffff', surface: '#f5f5f5', text: '#111111', muted: '#777777', base: '#ff385c' }, accents: ['#ff385c'] })],
      ['b', mk('b', { fonts: ['B Display', 'B Text'] })],
      ['c', mk('c', { antiPatterns: ['No drop shadows.'], authoredAntiPatterns: true })],
    ]);

    eq(mixRoleSystem({ ...EMPTY_MIX, base: 'a', roles: { colors: 'b' } }, 'colors'), 'b',
      'mixRoleSystem: a role override beats the base');
    eq(mixRoleSystem({ ...EMPTY_MIX, base: 'a', roles: { colors: 'b' } }, 'typography'), 'a',
      'mixRoleSystem: an unset role falls back to the base');
    eq(mixRoleSystem(EMPTY_MIX, 'colors'), null, 'mixRoleSystem: nothing chosen resolves to nothing');

    const mixed = resolveDesignMix({ base: null, roles: { colors: 'a', typography: 'b', components: 'c' }, hue: null, effects: ['glow'] }, systems);
    eq(mixed.palette.background, '#ffffff', 'resolveDesignMix: colours come from the colours system');
    eq(mixed.fonts, ['B Display', 'B Text'], 'resolveDesignMix: fonts come from the typography system');
    eq(mixed.componentsFrom?.id, 'c', 'resolveDesignMix: components come from the components system');
    eq(mixed.antiPatterns, ['No drop shadows.'], 'resolveDesignMix: rules travel with the system that authored them');
    eq(mixed.scheme, 'light', 'resolveDesignMix: light/dark follows the COLOURS system, not the base');
    eq(mixed.provenance.colors, { kind: 'system', id: 'a', name: 'A' }, 'resolveDesignMix: every role names its origin');
    eq(mixed.provenance.effects, { kind: 'manual' }, 'resolveDesignMix: effects are the user’s, never attributed to a system');
    ok(!mixed.empty, 'resolveDesignMix: a real mix is not empty');

    const gone = resolveDesignMix({ base: 'a', roles: { typography: 'deleted' }, hue: null, effects: [] }, systems);
    eq(gone.fonts, ['a-sans'], 'resolveDesignMix: a role whose system vanished falls back to the base');
    const orphan = resolveDesignMix({ base: null, roles: { typography: 'deleted', colors: 'a' }, hue: null, effects: [] }, systems);
    eq(orphan.fonts, [], 'resolveDesignMix: with no base either, the role resolves to NOTHING — never borrowed from another role');
    eq(orphan.palette.background, '#ffffff', 'resolveDesignMix: the other roles are unaffected by the missing one');

    const hued = resolveDesignMix({ base: 'a', roles: {}, hue: 210, effects: [] }, systems);
    ok(hued.palette.base !== '#ff385c', 'resolveDesignMix: an explicit hue replaces the system accent');
    eq(hued.accents, [], 'resolveDesignMix: the system’s other accents go with it — no half-overridden palette');
    eq(hued.provenance.colors, { kind: 'manual' }, 'resolveDesignMix: an overridden accent is attributed to the user, not to the system');
    eq(hued.palette.background, '#ffffff', 'resolveDesignMix: overriding the accent keeps the rest of the system’s palette');

    // What the mix hands downstream: the file and the render prompt.
    const tk = JSON.parse(buildDesignTokens({
      hue: 210, harmony: 'analogous', scheme: 'dark', styleId: null, effects: [], museVersion: '0.1.0',
      design: mixed,
    }, 'x'));
    eq(tk.palette.background, '#ffffff', 'buildDesignTokens: the mix palette wins over the wheel');
    eq(tk.fonts, ['B Display', 'B Text'], 'buildDesignTokens: fonts come from the typography role');
    eq(tk.system.id, 'c', 'buildDesignTokens: the components block names the components system, not the base');
    eq(tk.provenance.colors, { kind: 'system', id: 'a', name: 'A' },
      'buildDesignTokens: provenance is written into the file — the agent never gets an anonymous blend');
    eq(tk.effects, ['glow'], 'buildDesignTokens: the user’s effects travel with the design');

    const empty = JSON.parse(buildDesignTokens({
      hue: 210, harmony: 'analogous', scheme: 'dark', styleId: null, effects: [], museVersion: '0.1.0',
      design: resolveDesignMix(EMPTY_MIX, systems),
    }, 'x'));
    eq(empty.palette.source, 'wheel',
      'buildDesignTokens: an empty mix falls back to the wheel rather than writing a blank design');

    const docBlk = buildDocDesignBlock(mixed, 'my mix');
    ok(docBlk.includes('#ffffff') && docBlk.includes('B Display'),
      'buildDocDesignBlock: the document prompt carries the mixed values');
    ok(docBlk.includes('glow'), 'buildDocDesignBlock: effects reach the document too');
    ok(docBlk.includes('No drop shadows.'),
      'buildDocDesignBlock: rules from the components system reach the document');

    // Typography per tag: what the user picks wins, and every stack keeps a
    // generic fallback so the file still renders elsewhere.
    const typed = resolveDesignMix({ ...EMPTY_MIX, base: 'a', fontRoles: { h1: 'Georgia', body: 'Inter' } }, systems);
    eq(typed.fontRoles, { h1: 'Georgia', body: 'Inter' }, 'resolveDesignMix: the per-tag families survive resolution');
    const typedTk = JSON.parse(buildDesignTokens({ hue: 0, harmony: 'mono', scheme: 'dark', styleId: null, effects: [], museVersion: 'x', design: typed }, 'x'));
    eq(typedTk.typography.h1, '"Georgia", Georgia, serif', 'buildDesignTokens: a serif choice carries a serif fallback');
    eq(typedTk.typography.body, '"Inter", system-ui, sans-serif', 'buildDesignTokens: a sans choice carries a sans fallback');
    ok(!('h2' in typedTk.typography), 'buildDesignTokens: a tag left to the system is absent, not filled with a default');
    ok(buildDocDesignBlock(typed, 'x').includes('h1 = "Georgia"'), 'buildDocDesignBlock: the document prompt names the face per tag');
    eq(fontStack('Consolas'), '"Consolas", ui-monospace, monospace', 'fontStack: a mono family falls back to mono');
    eq(fontStack('Totally Unknown'), '"Totally Unknown", system-ui, sans-serif', 'fontStack: an unlisted family still gets a usable stack');
    ok(FONT_CANDIDATES.length >= 40 && FONT_ROLES.length === 5, 'font model: the probe list and the tag list are both populated');
    ok(resolveDesignMix(EMPTY_MIX, systems).empty,
      'resolveDesignMix: nothing chosen → empty, so callers fall back instead of writing a blank design');
    ok(!resolveDesignMix({ ...EMPTY_MIX, effects: ['glass'] }, systems).empty,
      'resolveDesignMix: effects alone still count as a design');
  }

  ok(isOdCatalog({ id: 'open-design', kind: 'od-catalog' }) === true, 'isOdCatalog: catalogue recognized');
  ok(isOdCatalog({ id: 'radix' }) === false,
    'isOdCatalog: libraries imported before the catalogue existed (no kind) stay plain repos');
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`✗ ${failures.length}/${pass + failures.length} failed:\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}
console.log(`✓ handoff.ts — ${pass} assertions passed.`);
