/**
 * Guided-creation hand-off: deterministic text builders (doc 64 §7ter — the
 * plumbing is CODE, the LLM only ever reasons). Muse scaffolds the app folder
 * with these files, then the user pastes the prompt into their IDE agent
 * (Antigravity / Claude Code / Cursor), which "takes the memory" first:
 * BRIEF.md + app-spec.json + the repo's AGENTS.md + the official boilerplate.
 */

export type HandoffInput = {
  name: string;
  slug: string;
  purpose: string;
  features: string[];
  nextSteps: string[];
  appDir: string;
  repoDir: string;
  museVersion: string;
  target: 'site' | 'cartridge';
  /** Which memory the project leans on (null = the whole memory, federated). */
  memory?: MemorySource;
};

export type ChatMsg = { role: 'muse' | 'user'; text: string };

/** ── Prompt language ──────────────────────────────────────────────────────
 *  The prompt CORE stays English on purpose — agents follow English
 *  instructions best (doc 64 §6, field-validated). What must follow the user
 *  is the OUTPUT: the `MY LANGUAGE:` directive and every "in <language>"
 *  output constraint. Hardcoding "français" meant a Spanish or English user
 *  got French answers from their own IDE agent.
 *
 *  Set once by the UI when the shell language changes; the builders stay pure
 *  functions of (input, current language) and tests can pin it explicitly.
 */
export type PromptLang = 'en' | 'fr' | 'es';

/** Endonym — what the user calls their own language, for the MY LANGUAGE line. */
const LANG_ENDONYM: Record<PromptLang, string> = { en: 'English', fr: 'français', es: 'español' };
/** English name — used inside English instructions ("write in Spanish"). */
const LANG_IN_ENGLISH: Record<PromptLang, string> = { en: 'English', fr: 'French', es: 'Spanish' };

let _promptLang: PromptLang = 'en';

export function setPromptLanguage(lang: PromptLang): void { _promptLang = lang; }
export function getPromptLanguage(): PromptLang { return _promptLang; }
/** "français" — for `MY LANGUAGE: …` lines. */
export function langEndonym(): string { return LANG_ENDONYM[_promptLang]; }
/** "French" — for "…, in French" output constraints. */
export function langInEnglish(): string { return LANG_IN_ENGLISH[_promptLang]; }

/** A dedicated system-prompt language pin.
 *
 *  A field report (29/07) of "the coach answered in English under a French
 *  shell" turned into a multi-round chase — an in-prompt "MY LANGUAGE:"
 *  directive, then a trailing reminder, then this dedicated systemPrompt,
 *  each retested and each apparently unheeded. The actual cause was none of
 *  those: `lang` (from useI18n(), which `_promptLang` mirrors) was ITSELF
 *  wrong. Muse opened via `plugins.linkDev`'s standalone dev window
 *  (`createPluginWindow` in infinity-edition's main/index.ts) loads with no
 *  `?lang=` on its URL at all — unlike the two iframe-embedded paths
 *  (PluginWidget.tsx, PluginStandaloneHost.tsx), which both set it and also
 *  broadcast `MNEMO_CONFIG_UPDATE` live. A standalone top-level window gets
 *  neither: it boots on `navigator.language` (the OS/Electron locale) and can
 *  never learn the shell's language setting changed. The coach was following
 *  `lang` correctly the whole time — `lang` was just never the shell's real
 *  setting for that window. That is a host-side gap (flagged separately,
 *  apps/muse cannot fix it) — this function does NOT fix it.
 *
 *  Kept anyway as legitimate defense in depth, now that the real bug is
 *  understood: whatever `lang` says, a model should follow it on the system
 *  channel too, not only from inside the prompt text — the host's own RAG
 *  injection also writes to `systemPrompt` (`(req.systemPrompt ?? '') +
 *  ragContext`, see modelHandlers.ts) ending in a generic, English-worded
 *  "Reply in the user's language." that never names the language; a call
 *  with no systemPrompt of its own had only that vague signal to go on.
 *  Written IN the target language on purpose, not "in English, asking for
 *  French": priming a model's first output tokens already in the target
 *  language is the more reliable half of that belt-and-suspenders, especially
 *  for weak/local engines. Callers pass this as `systemPrompt` on every
 *  model.infer call producing human-facing prose — prepended ahead of the
 *  host's own block, never replacing it. */
export function languageSystemPrompt(): string {
  return {
    fr: 'Réponds uniquement en français, même si ces instructions et le contexte fourni sont en anglais. N’écris pas un seul mot d’anglais dans ta réponse.',
    es: 'Responde únicamente en español, aunque estas instrucciones y el contexto proporcionado estén en inglés. No escribas ni una sola palabra en inglés en tu respuesta.',
    en: 'Answer only in English.',
  }[_promptLang];
}

/** The three creation lanes the intent router dispatches to (doc 64 §7sexies):
 *  doc = generated inside Muse · site = IDE agent + Mnemosyne MCP · cartridge =
 *  real MnemoHub app via boilerplate. */
export type Lane = 'doc' | 'site' | 'cartridge';
export type FramingBrief = { name: string; purpose: string; features: string[]; nextSteps: string[]; lane: Lane };

const LANE_GUIDE: Record<Lane, string> = {
  doc: 'The deliverable is a DOCUMENT (presentation, report, summary…) that Muse generates itself. Frame: audience, what content/memories it must draw on, rough length/structure.',
  site: 'The deliverable is a WEBSITE that an IDE coding agent will build, grounded on the user’s Mnemosyne memory (via MCP). Frame: purpose, audience, the main pages, what memory it should showcase.',
  cartridge: 'The deliverable is a REAL Mnemosyne OS cartridge app (built from the official boilerplate by an IDE agent). Frame: the ONE main action, who uses it, the v0 core loop.',
};

/** Folder-safe slug from a human app name (accents stripped, kebab-case). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mon-app';
}

/**
 * Framing-chat prompt (BMAD one-question-at-a-time). Grounded in the
 * field-validated ROLE 1 "SCOPING COACH" of doc 64 §6 (P3): steer, shrink to
 * a v0 the user can SEE running today, keep ambition as next steps. The
 * output contract is STRICT so the cartridge can parse it deterministically.
 */
export function buildFramingPrompt(idea: string, convo: ChatMsg[], forceConclude: boolean, mode: Lane | 'auto' = 'auto'): string {
  const lines = convo.length
    ? convo.map((m) => `${m.role === 'muse' ? 'MNEMOSYNE' : 'USER'}: ${m.text}`).join('\n')
    : '(none yet)';
  const laneBlock = mode === 'auto'
    ? `LANE ROUTING (you decide, silently): pick the lane that fits the request and put it in the brief.
- "doc": ${LANE_GUIDE.doc}
- "site": ${LANE_GUIDE.site}
- "cartridge": ${LANE_GUIDE.cartridge}`
    : `LANE (fixed by the user — do not change it): "${mode}". ${LANE_GUIDE[mode]}`;
  return `You are MNEMOSYNE — the scoping coach inside Muse (Mnemosyne OS). A beginner just told you what they want to create. Have a real back-and-forth to frame it, then hand back a machine brief.

MY LANGUAGE: ${langEndonym()} — every question, and all human text inside the brief, MUST be in my language.

${laneBlock}

HOW TO COACH — steer me, do not just record:
- Ask exactly ONE short question per turn, plain language, no jargon. Draft a suggestion for me if I hesitate.
- Find out: what it must do/say, who it is for, and the ONE main thing.
- SCOPE CHECK: if my idea needs saved data, several kinds of things, accounts, several screens or business calculations — do NOT say no and do NOT plan it all. Say it is a great goal, propose the SMALLEST version I can SEE working today (the v0), and keep the bigger parts as next steps so I keep my ambition.
- Before concluding, use ONE question turn to play back a 2-3 line summary of the v0 and ask if you got it right. Only after my explicit YES, output the BRIEF. 5 questions maximum in total.

OUTPUT FORMAT — STRICT, machine parsed, nothing before or after:
- To ask your next question, reply exactly:
QUESTION: <your single question>
- Once I said yes to the v0 (or when told to conclude), reply exactly:
BRIEF: {"name":"<short name>","purpose":"<1-2 sentences in my language>","features":["<v0 feature 1>","<optional 2>","<optional 3>"],"nextSteps":["<deferred part>"],"lane":"doc|site|cartridge"}

IDEA: ${idea}

CONVERSATION SO FAR:
${lines}

${forceConclude
    ? 'You MUST conclude NOW: output the BRIEF line using everything above, making sensible choices for anything missing.'
    : 'Your next output:'}
(Reminder: this whole instruction block is in English on purpose, but YOUR question and every human-facing string MUST be written in ${langEndonym()} — not in the language of this prompt.)`;
}

/** Parse the coach's reply into a question or a final brief (fault-tolerant). */
export function parseFramingReply(raw: string): { question?: string; brief?: FramingBrief } {
  const clean = (v: unknown, max: number): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()).slice(0, max) : [];
  const text = raw.replace(/```[a-z]*\n?|```/gi, '').trim();
  const bIdx = text.search(/BRIEF\s*:/i);
  if (bIdx >= 0) {
    const jm = text.slice(bIdx).match(/\{[\s\S]*\}/);
    if (jm) {
      try {
        const o = JSON.parse(jm[0]) as Record<string, unknown>;
        const name = typeof o.name === 'string' ? o.name.trim() : '';
        const purpose = typeof o.purpose === 'string' ? o.purpose.trim() : '';
        const lane: Lane = o.lane === 'doc' || o.lane === 'site' || o.lane === 'cartridge' ? o.lane : 'cartridge';
        if (name && purpose) {
          return { brief: { name, purpose, features: clean(o.features, 3), nextSteps: clean(o.nextSteps, 6), lane } };
        }
      } catch { /* fall through to question handling */ }
    }
  }
  const qIdx = text.search(/QUESTION\s*:/i);
  if (qIdx >= 0) return { question: text.slice(qIdx).replace(/QUESTION\s*:\s*/i, '').trim() };
  return { question: text }; // model free-chatted — surface it as the question
}

/** ── First-app preflight ─────────────────────────────────────────────────
 *  CATALOG.md of the app space (P1's dashboard, kept by deterministic CODE —
 *  zero credits) + MCP client config per IDE (official snippet from the
 *  packages/mnemosyne-mcp README: npx -y @mnemosyne_os/mcp, stdio→ws shim). */
export const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['-y', '@mnemosyne_os/mcp'],
  env: { MNEMO_DEFAULT_VAULT: 'DEV', MNEMO_VAULTS: 'DEV,PERSONAL,SOCIAL' },
} as const;

/** The memory a creation leans on. Three modes, all real host behaviours:
 *  `none` = no retrieval at all (`disableRAG`), `all` = federated over every
 *  ACTIVE vault, `pick` = a chosen subset (`vaultIds`, run as one query per
 *  vault and merged main-side). `null` is still accepted and means `all`. */
export type MemoryVault = { vaultId: string; displayName: string };
export type MemorySource = { mode: 'none' | 'all' | 'pick'; vaults: MemoryVault[] } | null;

/** Normalizes the legacy `null` and an empty pick into a usable selection. */
export function memoryMode(mem: MemorySource | undefined): 'none' | 'all' | 'pick' {
  if (!mem) return 'all';
  if (mem.mode === 'pick' && mem.vaults.length === 0) return 'all';
  return mem.mode;
}

/** The `model.infer` fields that ENFORCE a memory choice, host-side. Kept as
 *  one function because every inference must derive its scope the same way:
 *  the picker was once honoured on a single call site out of five, and the
 *  four that built their payload by hand were the ones that silently ran
 *  federated. `all` returns nothing to spread — absent fields mean federated. */
export function memoryScope(mem: MemorySource | undefined): { disableRAG?: boolean; vaultIds?: string[] } {
  const mode = memoryMode(mem);
  if (mode === 'none') return { disableRAG: true };
  if (mode === 'pick') return { vaultIds: (mem as { vaults: MemoryVault[] }).vaults.map((v) => v.vaultId) };
  return {};
}

/** Human label for the chosen memory — the UI translates the two modes. */
export function memoryLabel(mem: MemorySource | undefined): string {
  const mode = memoryMode(mem);
  if (mode === 'none') return 'aucune mémoire';
  if (mode === 'all') return 'toute ma mémoire';
  const names = (mem as { vaults: MemoryVault[] }).vaults.map((v) => v.displayName);
  return names.length <= 2 ? names.join(' + ') : `${names.slice(0, 2).join(' + ')} +${names.length - 2}`;
}

/** An app sandbox (doc 58) is named after the cartridge that owns it, never
 *  after a human: the host builds `app-<sanitized plugin id>` and uses that
 *  slug as the display name too. That is the only way to tell one apart from
 *  a vault the user actually created. */
export function isAppSandboxVault(raw: string): boolean {
  return /^app-/.test(raw);
}

/** Readable label for a vault as RAG reports it. Human vaults already carry a
 *  real display name and come back untouched; app sandboxes arrive as raw
 *  slugs (`app-mnemosyne-plugins-founders-console`), which is noise in a
 *  badge — the namespace prefix goes, the rest is title-cased. */
export function prettyVaultName(raw: string): string {
  const m = /^app-(?:mnemosyne-plugins-)?(.+)$/.exec(raw);
  if (!m) return raw;
  return m[1].split('-').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Vaults as they should be READ: the user's own memory first, the cartridge
 *  sandboxes after. Federated retrieval returns them interleaved, so without
 *  this the three names a badge has room for were often three sandboxes —
 *  the least interesting stores in the list. Order is stable within a group. */
export function orderVaultsForDisplay(vaults: string[]): string[] {
  return [
    ...vaults.filter((v) => !isAppSandboxVault(v)),
    ...vaults.filter((v) => isAppSandboxVault(v)),
  ];
}

/** MCP server entry pointed at the memory the user picked, so the IDE agent's
 *  default vault matches the project instead of the generic DEV. */
export function mcpServerEntry(mem: MemorySource | undefined) {
  const chosen = memoryMode(mem) === 'pick' ? (mem as { vaults: MemoryVault[] }).vaults : [];
  if (!chosen.length) return MCP_SERVER_ENTRY;
  // MNEMO_VAULTS is the exposure list: a chosen vault missing from it would be
  // unreachable for the agent, so every pick is added rather than shipping a
  // dead default. First pick leads — it becomes the agent's default vault.
  const known = MCP_SERVER_ENTRY.env.MNEMO_VAULTS.split(',').map((v) => v.trim()).filter(Boolean);
  const ids = chosen.map((v) => v.vaultId);
  const vaults = [...new Set([...ids, ...known])];
  return {
    ...MCP_SERVER_ENTRY,
    env: { ...MCP_SERVER_ENTRY.env, MNEMO_DEFAULT_VAULT: ids[0], MNEMO_VAULTS: vaults.join(',') },
  };
}

export type McpIde = 'claude-code' | 'cursor' | 'vscode' | 'antigravity';
// rel = config file path segments; scope 'project' = inside the app folder,
// scope 'home' = under the user profile (both home-scoped → writable via the
// dialog actions). VS Code's mcp.json uses the 'servers' root key. Antigravity
// path confirmed by Tony on Windows: ~/.gemini/config/mcp_config.json.
export const MCP_TARGETS: Record<McpIde, { label: string; rel: string; rootKey: 'mcpServers' | 'servers'; scope: 'project' | 'home' }> = {
  'claude-code': { label: 'Claude Code', rel: '.mcp.json', rootKey: 'mcpServers', scope: 'project' },
  cursor: { label: 'Cursor', rel: '.cursor/mcp.json', rootKey: 'mcpServers', scope: 'project' },
  vscode: { label: 'VS Code', rel: '.vscode/mcp.json', rootKey: 'servers', scope: 'project' },
  antigravity: { label: 'Antigravity', rel: '.gemini/config/mcp_config.json', rootKey: 'mcpServers', scope: 'home' },
};

/** Best-effort user-home extraction from a home-scoped path (the host
 *  guarantees every dialog path lives under home). Null when unrecognized —
 *  the caller then falls back to manual mode. */
export function homeFromPath(p: string): string | null {
  const win = p.match(/^([A-Za-z]:\\Users\\[^\\]+)(\\|$)/);
  if (win) return win[1];
  const nix = p.match(/^(\/(?:Users|home)\/[^/]+)(\/|$)/);
  if (nix) return nix[1];
  return null;
}

export function mcpSnippet(rootKey: 'mcpServers' | 'servers', mem: MemorySource = null): string {
  return JSON.stringify({ [rootKey]: { mnemosyne: mcpServerEntry(mem) } }, null, 2);
}

/** Merge the mnemosyne server into an existing MCP config — never clobbers
 *  other servers; throws on malformed JSON (caller falls back to manual). */
export function mergeMcpConfig(existing: string | null, rootKey: 'mcpServers' | 'servers', mem: MemorySource = null): string {
  let root: Record<string, unknown> = {};
  if (existing && existing.trim()) {
    const parsed: unknown = JSON.parse(existing);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('config MCP existante illisible');
    root = parsed as Record<string, unknown>;
  }
  const cur = root[rootKey];
  const servers = cur && typeof cur === 'object' && !Array.isArray(cur) ? (cur as Record<string, unknown>) : {};
  servers.mnemosyne = mcpServerEntry(mem);
  root[rootKey] = servers;
  return JSON.stringify(root, null, 2) + '\n';
}

/** Create or update the space-level CATALOG.md (one row per prepared app,
 *  keyed by the app folder — re-preparing replaces the row, never duplicates). */
export function upsertCatalog(existing: string | null, e: { name: string; lane: Lane; slug: string; date: string }): string {
  const LANE_CELL: Record<Lane, string> = { doc: '📄 document', site: '🌐 site', cartridge: '🧩 app' };
  const row = `| ${e.name.replace(/\|/g, '/')} | ${LANE_CELL[e.lane]} | ${e.date} | ${e.slug}/ |`;
  const header = [
    '# Catalogue de mes apps — espace Muse',
    '',
    '> Tenu automatiquement par Muse : chaque app préparée s’ajoute ici. C’est ton tableau de bord.',
    '',
    '| App | Type | Créée le | Dossier |',
    '|---|---|---|---|',
  ].join('\n');
  if (!existing || !existing.includes('| App | Type |')) return `${header}\n${row}\n`;
  const lines = existing.replace(/\r\n?/g, '\n').split('\n');
  const marker = `| ${e.slug}/ |`;
  const idx = lines.findIndex((l) => l.trim().endsWith(marker));
  if (idx >= 0) lines[idx] = row; else lines.push(row);
  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

/** ── Design step (doc 64 §7sexies lane site) ─────────────────────────────
 *  Color wheel + harmony + page-style preset + effects → design-tokens.json
 *  written at the project root; the IDE prompt applies it strictly. */
export type Harmony = 'complementary' | 'analogous' | 'triadic' | 'mono';
export type Scheme = 'dark' | 'light';

export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ln - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Harmony hues relative to the base (the "concordance des couleurs"). */
export function harmonyHues(hue: number, harmony: Harmony): number[] {
  switch (harmony) {
    case 'complementary': return [(hue + 180) % 360];
    case 'analogous': return [(hue + 330) % 360, (hue + 30) % 360];
    case 'triadic': return [(hue + 120) % 360, (hue + 240) % 360];
    case 'mono': return [hue];
  }
}

/** Role palette derived from ONE hue + harmony + scheme — deterministic. */
export function computePalette(hue: number, harmony: Harmony, scheme: Scheme) {
  const dark = scheme === 'dark';
  const base = dark ? hslToHex(hue, 72, 56) : hslToHex(hue, 65, 45);
  const accents = harmony === 'mono'
    ? [dark ? hslToHex(hue, 60, 72) : hslToHex(hue, 55, 30)]
    : harmonyHues(hue, harmony).map((h) => (dark ? hslToHex(h, 68, 58) : hslToHex(h, 60, 45)));
  return {
    base,
    accents,
    background: dark ? hslToHex(hue, 30, 6) : hslToHex(hue, 30, 96),
    surface: dark ? hslToHex(hue, 25, 11) : hslToHex(hue, 26, 90),
    text: dark ? hslToHex(hue, 25, 93) : hslToHex(hue, 32, 12),
    muted: dark ? hslToHex(hue, 16, 62) : hslToHex(hue, 12, 40),
  };
}


/** One imported design library — persisted in <space>/design-refs/LIBRARY.json
 *  so every import is REAL, visible, and reusable across projects. */
export type RefLibrary = {
  id: string;
  gitUrl: string;
  path: string;
  importedAt: string;
  files: number;
  /** 'repo' (default, absent on libraries imported before the catalogue
   *  existed) = an arbitrary kit, scraped for colors. 'od-catalog' = the Open
   *  Design catalogue, whose systems are read on demand instead. */
  kind?: 'repo' | 'od-catalog';
  /** Catalogue only: the system folder names indexed at import. Names only —
   *  reading 151 manifests up front would blow the 800-file walk budget. */
  systems?: string[];
};

export function isOdCatalog(lib: RefLibrary): boolean {
  return lib.kind === 'od-catalog';
}

/** Upsert a library into the LIBRARY.json index (keyed by id — re-importing
 *  the same repo refreshes its analysis, never duplicates). Pure + testable. */
export function upsertLibrary(existing: string | null, lib: RefLibrary): string {
  let libs: RefLibrary[] = [];
  if (existing && existing.trim()) {
    try {
      const parsed: unknown = JSON.parse(existing);
      const arr = (parsed as { libraries?: unknown })?.libraries;
      if (Array.isArray(arr)) libs = arr.filter((l): l is RefLibrary => !!l && typeof (l as RefLibrary).id === 'string');
    } catch { /* corrupt index — rebuild from scratch, imports stay on disk */ }
  }
  const idx = libs.findIndex((l) => l.id === lib.id);
  if (idx >= 0) libs[idx] = lib; else libs.push(lib);
  return JSON.stringify({ version: 1, libraries: libs }, null, 2) + '\n';
}

export function parseLibraryIndex(raw: string | null): RefLibrary[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const arr = (parsed as { libraries?: unknown })?.libraries;
    return Array.isArray(arr) ? arr.filter((l): l is RefLibrary => !!l && typeof (l as RefLibrary).id === 'string') : [];
  } catch {
    return [];
  }
}


/** ── Truth pass (doc 64 §3.2 — ALERT DETECTOR, never a proof) ────────────
 *  Layer 1: deterministic heuristics (free). Layer 2: adversarial agent. */
export type VerityAlert = { rule: string; severity: 'alert' | 'warn' | 'info'; file: string; line: number; excerpt: string };
export type VerityFeature = { name: string; status: 'ok' | 'doubtful' | 'missing'; note: string };

/** The P3 ROLE 4 rule set, deterministic and line-anchored. */
export function runVerityHeuristics(files: Array<{ rel: string; content: string }>): VerityAlert[] {
  const alerts: VerityAlert[] = [];
  const push = (rule: string, severity: VerityAlert['severity'], file: string, line: number, excerpt: string) => {
    if (alerts.length < 80) alerts.push({ rule, severity, file, line, excerpt: excerpt.trim().slice(0, 120) });
  };
  for (const f of files) {
    if (/\.(md|json)$/i.test(f.rel)) continue; // prose/config — text rules would false-positive
    const lines = f.content.split('\n');
    lines.forEach((ln, i) => {
      if (/\b(TODO|FIXME|XXX)\b/.test(ln)) push('todo-left', 'warn', f.rel, i + 1, ln);
      if (/lorem ipsum/i.test(ln)) push('lorem-ipsum', 'alert', f.rel, i + 1, ln);
      if (/coming soon|à venir|not implemented|pas encore implémenté/i.test(ln)) push('unfinished-text', 'warn', f.rel, i + 1, ln);
      if (/\b(fake|dummy|mocked?)[-_ ]?(data|value|result)s?\b/i.test(ln)) push('fake-data-marker', 'alert', f.rel, i + 1, ln);
    });
    for (const m of f.content.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)) {
      const line = f.content.slice(0, m.index ?? 0).split('\n').length;
      push('silent-catch', 'alert', f.rel, line, m[0].replace(/\s+/g, ' '));
    }
  }
  return alerts;
}

/** Adversarial agent prompt — judge each promised v0 feature against the code.
 *  When the builder AI's own report is provided (pasted from the IDE), every
 *  claim in it is treated as untrusted and cross-checked against the sources. */
export function buildVerityPrompt(o: { name: string; purpose: string; features: string[]; lane: Lane; sources: Array<{ name: string; content: string }>; ideReport?: string; userNote?: string }): string {
  const feats = o.features.filter(Boolean).map((f, i) => `${i + 1}. ${f}`).join('\n') || '(none listed)';
  const src = o.sources.map((s) => `--- SOURCE: ${s.name} ---\n${s.content}`).join('\n\n');
  const claims = o.ideReport?.trim()
    ? `

CLAIMS FROM THE BUILDER AI — its latest report to the user, UNTRUSTED. Cross-check every "done / fixed / working" claim against the sources below: a claim with no matching wired code = emit a "false-claim" alert (severity alert) naming what was claimed vs what the code shows.
--- BUILDER REPORT ---
${o.ideReport.trim().slice(0, 3500)}
--- END BUILDER REPORT ---`
    : '';
  const humanBlock = o.userNote?.trim()
    ? `

WHAT THE HUMAN USER OBSERVES WHEN RUNNING THE APP — treat as ground truth about the delivered behavior, it beats your reading of the code. Hunt the code for the cause and report it as an alert (rule "user-reported", severity alert) unless the sources prove the behavior is correct:
${o.userNote.trim().slice(0, 1200)}`
    : '';
  return `You are a TRUTH AGENT reviewing code delivered by another AI. Assume it might be FAKE until proven otherwise. Do not be polite — be right.

THE PROMISE (v0 brief of "${o.name}", a ${o.lane === 'site' ? 'website' : 'app'}):
- Intent: ${o.purpose}
- v0 features:
${feats}${claims}${humanBlock}

VERIFY adversarially:
- Is each promised feature ACTUALLY wired in the code below (not just present as UI text)?
- Hardcoded values pretending to be computed or fetched?
- Interactions promised but not bound? Dead buttons?

OUTPUT — exactly ONE line starting with VERDICT: followed by strict JSON, nothing else:
VERDICT: {"features":[{"name":"<feature>","status":"ok|doubtful|missing","note":"<short, in ${langInEnglish()}>"}],"alerts":[{"rule":"<slug>","severity":"alert|warn|info","file":"<source name>","note":"<short, in ${langInEnglish()}>"}],"summary":"<2 sentences in ${langInEnglish()}, honest>"}

${src}`;
}

/** Tolerant VERDICT parser — null only when nothing usable. */
export function parseVerityReply(raw: string): { features: VerityFeature[]; alerts: Array<{ rule: string; severity: VerityAlert['severity']; file: string; note: string }>; summary: string } | null {
  const jm = raw.match(/VERDICT\s*:\s*(\{[\s\S]*\})/i)?.[1] ?? (raw.trim().startsWith('{') ? raw.trim() : null);
  if (!jm) return null;
  try {
    const o = JSON.parse(jm.replace(/```/g, '')) as Record<string, unknown>;
    const sev = (v: unknown): VerityAlert['severity'] => (v === 'alert' || v === 'warn' || v === 'info' ? v : 'warn');
    const features = Array.isArray(o.features)
      ? (o.features as Array<Record<string, unknown>>).filter((f) => typeof f?.name === 'string').map((f) => ({
          name: String(f.name),
          status: (f.status === 'ok' || f.status === 'doubtful' || f.status === 'missing' ? f.status : 'doubtful') as VerityFeature['status'],
          note: typeof f.note === 'string' ? f.note : '',
        }))
      : [];
    const alerts = Array.isArray(o.alerts)
      ? (o.alerts as Array<Record<string, unknown>>).filter((a) => typeof a?.rule === 'string').map((a) => ({
          rule: String(a.rule), severity: sev(a.severity), file: typeof a.file === 'string' ? a.file : '?', note: typeof a.note === 'string' ? a.note : '',
        }))
      : [];
    return { features, alerts, summary: typeof o.summary === 'string' ? o.summary : '' };
  } catch {
    return null;
  }
}

/** docs/VERITY.md — the honest report written into the project. */
/** docs/VERITY.md — follows the shell language, same scaffold pattern as
 *  BRIEF_STR above. */
const VERITY_STR: Record<PromptLang, {
  title: string;
  tierLine: (dateIso: string, tier: string) => string;
  tierLine2: string;
  claimsChecked1: string;
  claimsChecked2: string;
  myRemarkHeading: string;
  promisedHeading: string;
  agentVerdict: string;
  agentAlertsHeading: string;
  heuristicsHeading: string;
  heuristicsNone: string;
}> = {
  en: {
    title: 'Truth pass',
    tierLine: (dateIso, tier) => `> ${dateIso} · tier ${tier}. **Alert detector, NOT proof**: a clean`,
    tierLine2: '> pass does not guarantee perfect code — it flags what looks like fake work.',
    claimsChecked1: '> 🔎 This pass cross-checked the **IDE agent’s claims** (latest reply',
    claimsChecked2: '> archived in `docs/VERITY-LOG.md`) against the code actually present on disk.',
    myRemarkHeading: '## 🗣️ My remark (taken into account in this pass)',
    promisedHeading: '## Promised v0 features',
    agentVerdict: '**Agent’s verdict:**',
    agentAlertsHeading: '## Agent alerts',
    heuristicsHeading: '## Heuristics (deterministic)',
    heuristicsNone: '- ✅ Nothing detected by the automated rules.',
  },
  fr: {
    title: 'Passe de vérité',
    tierLine: (dateIso, tier) => `> ${dateIso} · niveau ${tier}. **Détecteur d'alertes, PAS une preuve** : une passe`,
    tierLine2: '> propre ne garantit pas un code parfait — elle signale ce qui ressemble à du fake.',
    claimsChecked1: '> 🔎 Cette passe a contre-vérifié les **affirmations de l’agent IDE** (dernière réponse',
    claimsChecked2: '> archivée dans `docs/VERITY-LOG.md`) face au code réellement présent sur le disque.',
    myRemarkHeading: '## 🗣️ Ma remarque (prise en compte dans cette passe)',
    promisedHeading: '## Fonctions v0 promises',
    agentVerdict: '**Verdict de l’agent :**',
    agentAlertsHeading: '## Alertes de l’agent',
    heuristicsHeading: '## Heuristiques (déterministes)',
    heuristicsNone: '- ✅ Rien détecté par les règles automatiques.',
  },
  es: {
    title: 'Pase de verdad',
    tierLine: (dateIso, tier) => `> ${dateIso} · nivel ${tier}. **Detector de alertas, NO una prueba**: un pase`,
    tierLine2: '> limpio no garantiza un código perfecto — señala lo que parece falso.',
    claimsChecked1: '> 🔎 Este pase contra-verificó las **afirmaciones del agente IDE** (última respuesta',
    claimsChecked2: '> archivada en `docs/VERITY-LOG.md`) frente al código realmente presente en el disco.',
    myRemarkHeading: '## 🗣️ Mi observación (tenida en cuenta en este pase)',
    promisedHeading: '## Funciones v0 prometidas',
    agentVerdict: '**Veredicto del agente:**',
    agentAlertsHeading: '## Alertas del agente',
    heuristicsHeading: '## Heurísticas (deterministas)',
    heuristicsNone: '- ✅ Nada detectado por las reglas automáticas.',
  },
};

export function buildVerityReport(o: {
  name: string; dateIso: string; tier: string;
  heuristics: VerityAlert[];
  agent: { features: VerityFeature[]; alerts: Array<{ rule: string; severity: VerityAlert['severity']; file: string; note: string }>; summary: string } | null;
  claimsChecked?: boolean;
  userNote?: string;
}): string {
  const L = VERITY_STR[_promptLang];
  const FEAT_ICON: Record<VerityFeature['status'], string> = { ok: '✅', doubtful: '❓', missing: '❌' };
  const SEV_ICON: Record<VerityAlert['severity'], string> = { alert: '🔴', warn: '🟡', info: 'ℹ️' };
  const lines = [
    `# ${L.title} — ${o.name}`,
    '',
    L.tierLine(o.dateIso, o.tier),
    L.tierLine2,
    '',
  ];
  if (o.claimsChecked) {
    lines.push(L.claimsChecked1, L.claimsChecked2, '');
  }
  if (o.userNote?.trim()) {
    lines.push(L.myRemarkHeading, '', ...o.userNote.trim().split('\n').map((l) => `> ${l}`), '');
  }
  if (o.agent) {
    lines.push(L.promisedHeading, '');
    for (const f of o.agent.features) lines.push(`- ${FEAT_ICON[f.status]} **${f.name}** — ${f.note || f.status}`);
    if (o.agent.summary) lines.push('', `${L.agentVerdict} ${o.agent.summary}`);
    if (o.agent.alerts.length) {
      lines.push('', L.agentAlertsHeading, '');
      for (const a of o.agent.alerts) lines.push(`- ${SEV_ICON[a.severity]} \`${a.rule}\` (${a.file}) — ${a.note}`);
    }
    lines.push('');
  }
  lines.push(L.heuristicsHeading, '');
  if (!o.heuristics.length) lines.push(L.heuristicsNone);
  for (const h of o.heuristics) lines.push(`- ${SEV_ICON[h.severity]} \`${h.rule}\` — ${h.file}:${h.line} · \`${h.excerpt.replace(/`/g, "'")}\``);
  return lines.join('\n') + '\n';
}

/** docs/VERITY-LOG.md — append-only archive of what the IDE agent REPLIED
 *  after each repair round, plus the user's own observations. Kept in the
 *  project so the claims are on record and the truth pass can cross-check
 *  them; the human remark is what no heuristic can see (dead button, wrong
 *  behavior, "I wanted it to…"). */
/** IDE replies arrive FLATTENED — chat UIs strip the newlines, so a 7-item
 *  report lands as one unreadable paragraph (and Markdown would glue single
 *  newlines anyway). Re-break the text on its own status markers and emit real
 *  bullets, so the log reads as a checklist. Pure + testable. */
const STATUS_MARKER = /(CORRIGÉ|CORRIGE|IMPOSSIBLE|✅|✓|❌|✗|⚠️|🗣️)\s*(?:—|-|–|:)?\s*/g;

export function formatIdeReply(raw: string): string {
  const flat = raw.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!flat) return '';
  // Insert a break before every marker that is not already starting a line.
  const broken = flat.replace(STATUS_MARKER, (m, _kw, off: number) => (off === 0 || flat[off - 1] === '\n' ? m : `\n${m}`));
  const out: string[] = [];
  for (const line of broken.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(CORRIGÉ|CORRIGE|IMPOSSIBLE|✅|✓|❌|✗|⚠️|🗣️)\s*(?:—|-|–|:)?\s*(.*)$/);
    if (m) {
      const kw = m[1] === 'CORRIGE' ? 'CORRIGÉ' : m[1];
      const icon = /CORRIG|✅|✓/.test(kw) ? '✅' : /IMPOSSIBLE|❌|✗/.test(kw) ? '❌' : kw;
      const label = /CORRIG|IMPOSSIBLE/.test(kw) ? `**${kw}** — ` : '';
      out.push(`- ${icon} ${label}${m[2].trim()}`);
    } else {
      out.push(out.length && out[out.length - 1].startsWith('- ') ? `\n${t}` : t);
    }
  }
  return out.join('\n');
}

/** One-glance tally of a formatted reply — surfaced above the entry. */
export function tallyIdeReply(formatted: string): { fixed: number; impossible: number } {
  const lines = formatted.split('\n');
  return {
    fixed: lines.filter((l) => l.startsWith('- ✅')).length,
    impossible: lines.filter((l) => l.startsWith('- ❌')).length,
  };
}

/** docs/VERITY-LOG.md — follows the shell language, same scaffold pattern as
 *  BRIEF_STR/VERITY_STR above. */
const VERITY_LOG_STR: Record<PromptLang, {
  header: string;
  myRemark: string;
  ideReply: string;
  tally: (fixed: number, impossible: number) => string;
  empty: string;
}> = {
  en: {
    header: [
      '# Truth journal — IDE replies & remarks',
      '',
      '> Every IDE agent reply pasted into Muse is archived here, then',
      '> cross-checked by the truth pass against the code actually on disk.',
      '> Remarks marked 🗣️ come from the human using the app.',
      '',
    ].join('\n'),
    myRemark: '### 🗣️ My remark',
    ideReply: '### 🤖 IDE agent reply',
    tally: (fixed, impossible) => `\n\n\`${fixed} fixed · ${impossible} not possible\` — reported by the agent, **not yet verified**.`,
    empty: '_(empty)_',
  },
  fr: {
    header: [
      '# Journal de vérité — réponses de l’IDE & remarques',
      '',
      '> Chaque réponse de l’agent IDE collée dans Muse est archivée ici, puis',
      '> contre-vérifiée par la passe de vérité face au code réellement sur disque.',
      '> Les remarques marquées 🗣️ viennent de l’humain qui utilise l’app.',
      '',
    ].join('\n'),
    myRemark: '### 🗣️ Ma remarque',
    ideReply: '### 🤖 Réponse de l’agent IDE',
    tally: (fixed, impossible) => `\n\n\`${fixed} corrigé${fixed > 1 ? 's' : ''} · ${impossible} impossible${impossible > 1 ? 's' : ''}\` — annoncés par l’agent, **pas encore vérifiés**.`,
    empty: '_(vide)_',
  },
  es: {
    header: [
      '# Diario de verdad — respuestas del IDE y observaciones',
      '',
      '> Cada respuesta del agente IDE pegada en Muse se archiva aquí, luego',
      '> se contra-verifica en el pase de verdad frente al código realmente en disco.',
      '> Las observaciones marcadas con 🗣️ vienen del humano que usa la app.',
      '',
    ].join('\n'),
    myRemark: '### 🗣️ Mi observación',
    ideReply: '### 🤖 Respuesta del agente IDE',
    tally: (fixed, impossible) => `\n\n\`${fixed} corregido${fixed > 1 ? 's' : ''} · ${impossible} imposible${impossible > 1 ? 's' : ''}\` — anunciados por el agente, **aún no verificados**.`,
    empty: '_(vacío)_',
  },
};

export function appendVerityLog(existing: string | null, e: { dateIso: string; text: string; note?: string }): string {
  const L = VERITY_LOG_STR[_promptLang];
  const base = existing && existing.trim() ? existing.replace(/\r\n?/g, '\n').replace(/\n+$/, '\n') : L.header;
  const parts: string[] = [];
  if (e.note?.trim()) {
    parts.push(`${L.myRemark}\n\n${e.note.trim().split('\n').filter((l) => l.trim()).map((l) => `> ${l.trim()}`).join('\n')}`);
  }
  if (e.text.trim()) {
    const body = formatIdeReply(e.text);
    const { fixed, impossible } = tallyIdeReply(body);
    const tally = fixed || impossible ? L.tally(fixed, impossible) : '';
    parts.push(`${L.ideReply}${tally}\n\n${body}`);
  }
  return `${base}\n---\n\n## ${e.dateIso}\n\n${parts.join('\n\n') || L.empty}\n`;
}

/** The fix prompt: alerts become work orders for the IDE agent. Aggressive by
 *  design — field experience showed polite repair prompts get cosmetic or
 *  partial fixes and the pass has to be re-run 3-4 times. */
export function buildVerityFixPrompt(o: { appDir: string; heuristics: VerityAlert[]; agent: ReturnType<typeof parseVerityReply>; round?: number; userNote?: string }): string {
  const items: string[] = [];
  for (const h of o.heuristics) items.push(`- [${h.severity}] ${h.rule} at ${h.file}:${h.line} — "${h.excerpt}"`);
  if (o.agent) {
    for (const f of o.agent.features.filter((x) => x.status !== 'ok')) items.push(`- [feature-${f.status}] "${f.name}" — ${f.note}`);
    for (const a of o.agent.alerts) items.push(`- [${a.severity}] ${a.rule} (${a.file}) — ${a.note}`);
  }
  const note = o.userNote?.trim();
  const noteBlock = note
    ? `

🗣️ WHAT I SEE WHEN I USE THE APP — HIGHEST PRIORITY, above the automated list. I am the human actually running this thing; what I report below is a FACT about the delivered app, not an opinion or a feature request. If it contradicts what the code looks like to you, the app is wrong, not me. Reproduce it, find the real cause, fix it — and if I describe something I WANT rather than something broken, do the smallest honest version of it inside the existing v0 scope:
${note.split('\n').map((l) => `> ${l}`).join('\n')}`
    : '';
  const round = o.round ?? 1;
  const escalation = round > 1
    ? `

⚠️ THIS IS REPAIR ROUND ${round}. Rounds 1-${round - 1} did NOT fix these — the truth pass re-read the files on disk and the problems are STILL THERE. Whatever you did last time did not work: change your approach, open the actual files, and do not repeat the same edit. Explaining is not repairing.`
    : '';
  return `This is a REPAIR CONTRACT on my project at ${o.appDir}. A truth pass flagged the issues below. MY LANGUAGE: ${langEndonym()} — talk to me in my language.${escalation}

NON-NEGOTIABLE TERMS — repair rounds on this project have already FAILED because the fixes were cosmetic or partial:
1. Every issue listed is REAL and UNFIXED until you prove otherwise. OPEN each file, READ the flagged line, FIX the root cause. Do not work from memory of what you wrote before.
2. A repair MODIFIES CODE. Deleting a TODO comment without doing the TODO, renaming "mock"/"fake" to something neutral, or removing the evidence while keeping the fake behavior is FRAUD — the next pass re-reads the files and will catch it.
3. [feature-missing] / [feature-doubtful] means: wire the REAL feature end to end — real computation, real data, real event handlers actually bound. Not a stub, not a placeholder, not "à venir".
4. You may dispute an item as a false positive ONLY by quoting the exact current code on disk that proves it works. No quote = you fix it.
5. Fix ALL items in this ONE session. Do not stop halfway, do not ask permission item by item.
6. FORBIDDEN to answer that everything is already fine. The truth pass reads the files on disk: if it flagged the line, the line exists.${noteBlock}

ISSUES TO FIX (fix only these — no new features, no refactor tourism):
${items.join('\n') || '- (none — nothing to do)'}

MANDATORY FINAL REPORT — after re-reading each modified file on disk to confirm the change is saved, give me EXACTLY one line per issue above${note ? ', PLUS one line per point of my own remark (start those with 🗣️), my remark first' : ''}, same order, in plain ${langInEnglish()}, no code dumps:
- CORRIGÉ — <fichier:ligne> — <ce qui a réellement changé, une phrase>
- IMPOSSIBLE — <raison honnête, une phrase>
No third status, no "partiellement". Then end with the exact project folder path.

I will immediately re-run the truth pass on the files. Any issue still detected means this repair FAILED.`;
}


/** ── Open Design catalogue (github.com/nexu-io/open-design, Apache-2.0) ────
 *  Their design systems are a NORMALIZED contract — one folder per system with
 *  manifest.json + design-tokens.json (`od-design-tokens/v1`, 56 declared
 *  tokens) + DESIGN.md + components.html. Measured over the whole catalogue on
 *  2026-08-01: 150 of 151 systems yield all five palette roles AND at least one
 *  font family, so this adapter needs zero heuristics — and there is nothing to guess.
 *
 *  We never vendor their files: the user clones the catalogue into their own
 *  Muse space. Nothing is redistributed, which matters twice over — Apache-2.0
 *  asks for notice on redistribution, and a number of systems are derived from
 *  real brands (Airbnb, Apple, BMW…) whose trademarks no license covers. */
export const OD_CATALOG_ID = 'open-design';
export const OD_CATALOG_URL = 'https://github.com/nexu-io/open-design';
export const OD_SYSTEMS_DIR = 'design-systems';
/** How many system folders the catalogue held when this was measured
 *  (2026-08-01). A REFERENCE, not a contract: it only exists so the checkout
 *  can show real progress toward a plausible target, and the bar is clamped so
 *  a grown catalogue reads 100% instead of an impossible 108%. */
export const OD_EXPECTED_SYSTEMS = 151;

/** Percent of the checkout, or null when there is nothing real to divide by.
 *  Never invent a denominator: during the fetch git reports no bytes at all,
 *  and a bar moving on a made-up total is worse than no bar. */
export function odPercent(count: number, expected: number | null): number | null {
  if (!expected || expected <= 0 || count <= 0) return null;
  return Math.max(1, Math.min(100, Math.round((count / expected) * 100)));
}

/** "2 min 14 s" / "48 s" — proof of life while no percentage exists. */
export function odElapsedLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

export type OdPalette = { background?: string; surface?: string; text?: string; muted?: string; base?: string };

/** The reference pages every system ships. Verified on the real catalogue:
 *  they paste :root from tokens.css into a <style> block and link NOTHING
 *  external, so they render as-is in a sandboxed srcDoc iframe. Showing them
 *  beats any mock we could draw — the point of choosing a system is seeing its
 *  buttons, forms, cards and elevation, not three swatches. */
export type OdPages = {
  components: string | null;
  colors: string | null;
  typography: string | null;
  spacing: string | null;
};

/** Inline a system's tokens.css into one of its reference pages.
 *
 *  components.html pastes :root itself, but preview/*.html LINK it
 *  (`<link rel="stylesheet" href="../tokens.css">`) and then use var(--…) for
 *  every colour, font and size. Inside a srcDoc iframe that relative href
 *  resolves to nothing, so every custom property comes back empty and the page
 *  renders as unstyled serif text — which is exactly what shipping this
 *  untested looked like.
 *
 *  The replacement is a FUNCTION, never a string: a stylesheet containing `$&`
 *  or `$'` would otherwise be spliced into itself by String#replace's special
 *  patterns. Same trap that once printed a whole bundle as plain text. */
export function inlineOdStylesheet(html: string | null, css: string | null): string | null {
  if (!html) return html;
  if (!css || !css.trim()) return html;
  const LINK = /<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi;
  if (!LINK.test(html)) return html;
  LINK.lastIndex = 0;
  // `</style>` inside the CSS would close the tag early and dump the rest as
  // text — same escape the built-app inliner does for `</script>`.
  const safe = css.replace(/<\/style/gi, '<\\/style');
  let used = false;
  return html.replace(LINK, () => {
    if (used) return ''; // one stylesheet, one inline copy
    used = true;
    return `<style>${safe}</style>`;
  });
}

export const OD_PAGE_FILES: Array<[keyof OdPages, string]> = [
  ['components', 'components.html'],
  ['colors', 'preview/colors.html'],
  ['typography', 'preview/typography.html'],
  ['spacing', 'preview/spacing.html'],
];

/** Which reference pages actually came back — the tab row shows only these,
 *  so a missing page is never an empty frame pretending to be a design. */
export function odAvailablePages(sys: OdSystem): Array<keyof OdPages> {
  return OD_PAGE_FILES.map(([k]) => k).filter((k) => !!sys.pages[k]);
}

export type OdSystem = {
  id: string;
  /** Folder on disk — the IDE agent is pointed at it for components.html. */
  path: string;
  name: string;
  category: string | null;
  intent: string | null;
  palette: OdPalette;
  accents: string[];
  fonts: string[];
  antiPatterns: string[];
  /** false = the boilerplate every generated DESIGN.md carries. Only 6 of 150
   *  systems author their own; showing a gabarit as curated guidance would be
   *  claiming an editorial value the file does not have. */
  authoredAntiPatterns: boolean;
  tokenCount: number;
  /** The system's own reference pages — see OdPages. Kept out of
   *  design-tokens.json on purpose: the agent gets the PATH, not 55 KB of
   *  inlined HTML. */
  pages: OdPages;
};

/** Their token names are CSS custom properties; these are the five roles Muse
 *  already speaks. Order matters: first match wins. */
const OD_ROLE_MAP: Array<[keyof OdPalette, RegExp]> = [
  ['background', /^--(bg|background|canvas)$/],
  ['surface', /^--(surface|card|panel)$/],
  ['text', /^--(fg|text|foreground|ink)$/],
  ['muted', /^--(muted|subtle|fg-muted|secondary-text)$/],
  ['base', /^--(primary|accent|brand|cta)$/],
];

/** The generic anti-pattern line shared by 57 of the 63 systems that have any. */
const OD_GENERIC_ANTIPATTERN = 'Do not introduce off-palette colors';

/** design-tokens.json (od-design-tokens/v1) → palette roles, accents, fonts.
 *  Null when the file is missing or carries no token array: a system without a
 *  palette has nothing to hand the agent, and must not appear as an empty one. */
export function adaptOdTokens(raw: string | null): { palette: OdPalette; accents: string[]; fonts: string[]; tokenCount: number } | null {
  if (!raw || !raw.trim()) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const list = (parsed as { tokens?: unknown })?.tokens;
  if (!Array.isArray(list)) return null;
  const tokens = list.filter((t): t is { name: string; value: string; type?: string } =>
    !!t && typeof t === 'object'
    && typeof (t as { name?: unknown }).name === 'string'
    && typeof (t as { value?: unknown }).value === 'string');
  if (!tokens.length) return null;
  const palette: OdPalette = {};
  for (const [role, re] of OD_ROLE_MAP) {
    const hit = tokens.find((t) => t.type === 'color' && re.test(t.name));
    if (hit) palette[role] = hit.value;
  }
  const uniq = (xs: string[]) => xs.filter((v, i, a) => a.indexOf(v) === i);
  // Swatch-able accents only. `color-mix(…)` and `var(…)` are valid CSS but
  // paint nothing in a standalone swatch, and a blank square reads as "no
  // colour" when the truth is "computed from another token".
  const accents = uniq(tokens
    .filter((t) => t.type === 'color' && /^--(accent|secondary|success|warning|danger|info)/.test(t.name))
    .map((t) => t.value.trim())
    .filter((v) => /^(#|rgba?\(|hsla?\(|oklch\()/i.test(v)))
    .slice(0, 6);
  const fonts = uniq(tokens.filter((t) => /font/i.test(t.name)).map((t) => t.value.trim()).filter(Boolean)).slice(0, 3);
  return { palette, accents, fonts, tokenCount: tokens.length };
}

/** DESIGN.md → category, intent and anti-patterns.
 *  Sections are split on headings rather than matched with an end-anchored
 *  regex: Anti-patterns is the LAST section, and JS has no \Z anchor, so the
 *  obvious body match silently returns zero items — an absent value dressed up
 *  as a real zero, which is exactly the failure we refuse to ship. */
export function adaptOdDesignMd(md: string | null): { category: string | null; intent: string | null; antiPatterns: string[]; authored: boolean } {
  if (!md || !md.trim()) return { category: null, intent: null, antiPatterns: [], authored: false };
  const blocks = md.split(/^## /m).slice(1);
  const body = blocks.find((b) => /anti-pattern/i.test(b.split('\n')[0] ?? ''));
  const antiPatterns = (body ? body.split('\n').slice(1) : [])
    .filter((l) => l.trim().startsWith('-'))
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 14);
  // Read every quoted header line, then sort them out. A lookahead after `\s*`
  // does not work here: the star backtracks to zero width and the "Category:"
  // line sails through as if it were the intent.
  const quotes = [...md.matchAll(/^>\s*(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
  const isCategory = (q: string) => /^Category:/i.test(q);
  const category = quotes.find(isCategory)?.replace(/^Category:\s*/i, '').trim() || null;
  const intent = quotes.find((q) => !isCategory(q)) ?? null;
  const authored = antiPatterns.length > 0 && !antiPatterns.some((a) => a.startsWith(OD_GENERIC_ANTIPATTERN));
  return { category, intent, antiPatterns, authored };
}

/** Light or dark, read off the system's own background rather than inherited
 *  from the style preset: attaching a pale system while the tokens still say
 *  `scheme: dark` would hand the agent two contradictory instructions.
 *  Non-hex backgrounds (oklch…) are not parsed — we fall back to dark and say
 *  so here rather than guessing a luminance we did not compute. */
export function odScheme(sys: OdSystem): Scheme {
  const bg = (sys.palette.background ?? '').trim();
  const m = /^#([0-9a-f]{6})$/i.exec(bg) ?? /^#([0-9a-f]{3})$/i.exec(bg);
  if (!m) return 'dark';
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  // Rec. 709 relative luminance — enough to tell a paper background from ink.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? 'light' : 'dark';
}

/** Assemble one system from the three files Muse reads when it is opened.
 *  Null when the tokens are unreadable — see adaptOdTokens. */
export function buildOdSystem(
  id: string, dir: string,
  files: { manifest: string | null; tokens: string | null; design: string | null; pages?: Partial<OdPages> }
): OdSystem | null {
  const tk = adaptOdTokens(files.tokens);
  if (!tk) return null;
  const dm = adaptOdDesignMd(files.design);
  let name = id;
  let manifestCat: string | null = null;
  if (files.manifest && files.manifest.trim()) {
    try {
      const m = JSON.parse(files.manifest) as { name?: unknown; category?: unknown };
      if (typeof m.name === 'string' && m.name.trim()) name = m.name.trim();
      if (typeof m.category === 'string' && m.category.trim()) manifestCat = m.category.trim();
    } catch { /* the manifest is cosmetic — the tokens carry the design */ }
  }
  return {
    id, path: dir, name,
    category: dm.category ?? manifestCat,
    intent: dm.intent,
    palette: tk.palette, accents: tk.accents, fonts: tk.fonts,
    antiPatterns: dm.antiPatterns, authoredAntiPatterns: dm.authored,
    tokenCount: tk.tokenCount,
    pages: {
      components: files.pages?.components ?? null,
      colors: files.pages?.colors ?? null,
      typography: files.pages?.typography ?? null,
      spacing: files.pages?.spacing ?? null,
    },
  };
}

/** ── "Mon design" — one design, mixed by role ────────────────────────────
 *  A design is a BASE system plus per-role replacements: colours from one
 *  system, typography from another, components from a third. Effects are the
 *  one role no system declares, so they stay the user's own choice — the UI
 *  says so rather than pretending they came from somewhere.
 *
 *  Everything is stored by system ID and resolved against systems read from
 *  disk. Storing resolved values would freeze a copy that silently drifts from
 *  the catalogue; the id is the replayable state. */
/** Typography, per tag. A design system hands one or two families; what a
 *  page actually needs is "which face for H1, which for body". */
export type FontRole = 'h1' | 'h2' | 'h3' | 'body' | 'mono';
export const FONT_ROLES: FontRole[] = ['h1', 'h2', 'h3', 'body', 'mono'];

/** Families we probe for. A browser cannot ENUMERATE installed fonts — that
 *  is fingerprinting and it is closed off — so detection can only answer "is
 *  this one present?" for names we ask about. Hence a curated list, and a UI
 *  that says "detected among a known list", never "your fonts". */
export const FONT_CANDIDATES: Array<{ family: string; kind: 'sans' | 'serif' | 'mono' | 'display' }> = [
  { family: 'Inter', kind: 'sans' }, { family: 'Segoe UI', kind: 'sans' }, { family: 'Helvetica Neue', kind: 'sans' },
  { family: 'Arial', kind: 'sans' }, { family: 'Verdana', kind: 'sans' }, { family: 'Tahoma', kind: 'sans' },
  { family: 'Trebuchet MS', kind: 'sans' }, { family: 'Calibri', kind: 'sans' }, { family: 'Roboto', kind: 'sans' },
  { family: 'Open Sans', kind: 'sans' }, { family: 'Lato', kind: 'sans' }, { family: 'Montserrat', kind: 'sans' },
  { family: 'Poppins', kind: 'sans' }, { family: 'Source Sans Pro', kind: 'sans' }, { family: 'Nunito', kind: 'sans' },
  { family: 'Franklin Gothic Medium', kind: 'sans' }, { family: 'Century Gothic', kind: 'sans' },
  { family: 'Georgia', kind: 'serif' }, { family: 'Times New Roman', kind: 'serif' }, { family: 'Garamond', kind: 'serif' },
  { family: 'Palatino Linotype', kind: 'serif' }, { family: 'Book Antiqua', kind: 'serif' }, { family: 'Cambria', kind: 'serif' },
  { family: 'Constantia', kind: 'serif' }, { family: 'Merriweather', kind: 'serif' }, { family: 'Playfair Display', kind: 'serif' },
  { family: 'Consolas', kind: 'mono' }, { family: 'Courier New', kind: 'mono' }, { family: 'Cascadia Code', kind: 'mono' },
  { family: 'Cascadia Mono', kind: 'mono' }, { family: 'JetBrains Mono', kind: 'mono' }, { family: 'Fira Code', kind: 'mono' },
  { family: 'SF Mono', kind: 'mono' }, { family: 'Menlo', kind: 'mono' }, { family: 'Monaco', kind: 'mono' },
  { family: 'Lucida Console', kind: 'mono' },
  { family: 'Impact', kind: 'display' }, { family: 'Bebas Neue', kind: 'display' }, { family: 'Oswald', kind: 'display' },
  { family: 'Arial Black', kind: 'display' }, { family: 'Bahnschrift', kind: 'display' }, { family: 'Copperplate Gothic Bold', kind: 'display' },
];

/** A CSS stack for one chosen family: the family first, then a generic that
 *  matches its kind — the document must still render on a machine that does
 *  not have it. */
export function fontStack(family: string): string {
  const kind = FONT_CANDIDATES.find((f) => f.family === family)?.kind ?? 'sans';
  const tail = kind === 'serif' ? 'Georgia, serif' : kind === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif';
  return `"${family}", ${tail}`;
}

export type DesignRole = 'colors' | 'typography' | 'components';

export type DesignMix = {
  /** System every unset role falls back to. Null = no system at all (the
   *  colour wheel and the style presets are then the whole design). */
  base: string | null;
  roles: Partial<Record<DesignRole, string>>;
  /** Manual accent hue. Set = the user deliberately overrode the system's
   *  accent, which is why the resolved provenance says so out loud. */
  hue: number | null;
  effects: string[];
  /** Per-tag families the user picked from what is installed. Absent = the
   *  system typography speaks for that tag. */
  fontRoles?: Partial<Record<FontRole, string>>;
};

export const EMPTY_MIX: DesignMix = { base: null, roles: {}, hue: null, effects: [] };

/** Where a resolved value came from. 'manual' is never dressed up as a system:
 *  a hue the user picked is not Airbnb's accent. */
export type Provenance = { kind: 'system'; id: string; name: string } | { kind: 'manual' } | null;

export type ResolvedDesign = {
  palette: OdPalette;
  accents: string[];
  fonts: string[];
  scheme: Scheme;
  effects: string[];
  /** Folder of the system providing components, for the agent to open. */
  componentsFrom: OdSystem | null;
  /** Rules only travel with the system that authored them. */
  antiPatterns: string[];
  /** Per-tag families, resolved: what the user chose wins over the system. */
  fontRoles: Partial<Record<FontRole, string>>;
  provenance: Record<DesignRole | 'effects', Provenance>;
  /** True when nothing at all is chosen — callers must then fall back to the
   *  wheel/preset path instead of writing an empty design. */
  empty: boolean;
};

/** Which system serves a role: its own override, else the base. */
export function mixRoleSystem(mix: DesignMix, role: DesignRole): string | null {
  return mix.roles[role] ?? mix.base ?? null;
}

/** Resolve a mix against the systems currently readable on disk.
 *
 *  A role whose system is missing (catalogue deleted, truncated clone) falls
 *  back to the base, and to nothing if the base is missing too — it is never
 *  filled from another role, which would invent a design nobody chose. */
export function resolveDesignMix(mix: DesignMix, systems: Map<string, OdSystem>): ResolvedDesign {
  const pick = (role: DesignRole): OdSystem | null => {
    const own = mix.roles[role];
    return (own ? systems.get(own) : undefined) ?? (mix.base ? systems.get(mix.base) ?? null : null);
  };
  const prov = (role: DesignRole): Provenance => {
    const s = pick(role);
    return s ? { kind: 'system', id: s.id, name: s.name } : null;
  };
  const colors = pick('colors');
  const typo = pick('typography');
  const comps = pick('components');
  const palette: OdPalette = { ...(colors?.palette ?? {}) };
  // An explicit hue REPLACES the system accent, and says so. Leaving the
  // system's accent while the wheel shows another is the "label, not state"
  // failure we keep paying for.
  if (mix.hue !== null && colors) palette.base = hslToHex(mix.hue, 72, odScheme(colors) === 'dark' ? 56 : 45);
  return {
    palette,
    accents: mix.hue !== null ? [] : colors?.accents ?? [],
    fonts: typo?.fonts ?? [],
    fontRoles: mix.fontRoles ?? {},
    scheme: colors ? odScheme(colors) : 'dark',
    effects: mix.effects,
    componentsFrom: comps,
    antiPatterns: comps?.authoredAntiPatterns ? comps.antiPatterns : [],
    provenance: {
      colors: mix.hue !== null && colors ? { kind: 'manual' } : prov('colors'),
      typography: prov('typography'),
      components: prov('components'),
      effects: mix.effects.length ? { kind: 'manual' } : null,
    },
    empty: !colors && !typo && !comps && mix.hue === null && mix.effects.length === 0,
  };
}

/** One line per role for the agent: what was chosen AND where it comes from,
 *  so a mixed design never reaches it as an anonymous blend. */
export function designProvenanceLines(r: ResolvedDesign, t: (p: Provenance) => string): string[] {
  return (['colors', 'typography', 'components', 'effects'] as const)
    .filter((role) => r.provenance[role])
    .map((role) => `${role}: ${t(r.provenance[role])}`);
}

export function buildDesignTokens(o: {
  hue: number; harmony: Harmony; scheme: Scheme;
  styleId: string | null; styleName?: string; styleTraits?: string[];
  effects: string[]; museVersion: string;
  system?: OdSystem | null;
  /** A resolved mix takes precedence over a single system: it IS the design
   *  once roles come from different places. */
  design?: ResolvedDesign | null;
}, createdAtIso: string): string {
  const wheel = computePalette(o.hue, o.harmony, o.scheme);
  const mix = o.design && !o.design.empty ? o.design : null;
  const sys = o.system ?? null;
  if (mix) {
    return JSON.stringify(
      {
        version: '1.2',
        generator: `muse@${o.museVersion}`,
        createdAt: createdAtIso,
        palette: {
          baseHue: o.hue, harmony: o.harmony, scheme: mix.scheme, source: 'system' as const,
          base: mix.palette.base ?? wheel.base,
          accents: mix.accents.length ? mix.accents : wheel.accents,
          background: mix.palette.background ?? wheel.background,
          surface: mix.palette.surface ?? wheel.surface,
          text: mix.palette.text ?? wheel.text,
          muted: mix.palette.muted ?? wheel.muted,
        },
        style: o.styleId ? { id: o.styleId, name: o.styleName ?? o.styleId, traits: o.styleTraits ?? [] } : null,
        effects: mix.effects,
        fonts: mix.fonts,
        // Provenance travels with the design: a mix of two authored palettes
        // is nobody's system, and the agent must be told which part came from
        // where instead of receiving an anonymous blend.
        system: mix.componentsFrom
          ? {
              catalog: 'open-design', id: mix.componentsFrom.id, name: mix.componentsFrom.name,
              category: mix.componentsFrom.category, path: mix.componentsFrom.path,
              components: `${mix.componentsFrom.path}\\components.html`,
              guide: `${mix.componentsFrom.path}\\DESIGN.md`,
              fonts: mix.fonts, antiPatterns: mix.antiPatterns,
            }
          : null,
        typography: FONT_ROLES.reduce<Record<string, string>>((acc, role) => {
          const fam = mix.fontRoles[role];
          if (fam) acc[role] = fontStack(fam);
          return acc;
        }, {}),
        provenance: mix.provenance,
        trends: { status: 'placeholder', note: 'Espace réservé — scrap Pinterest / tendances / articles à venir.' },
      },
      null,
      2
    );
  }
  // A chosen system's palette is AUTHORED: recolouring it with the wheel would
  // destroy the one thing that makes it that system. So it wins — and the
  // winner is written down, because a palette silently overridden is a label,
  // not a state, and the UI would end up showing a hue nobody applied.
  const palette = sys
    ? {
        baseHue: o.hue, harmony: o.harmony, scheme: o.scheme, source: 'system' as const,
        base: sys.palette.base ?? wheel.base,
        accents: sys.accents.length ? sys.accents : wheel.accents,
        background: sys.palette.background ?? wheel.background,
        surface: sys.palette.surface ?? wheel.surface,
        text: sys.palette.text ?? wheel.text,
        muted: sys.palette.muted ?? wheel.muted,
      }
    : { baseHue: o.hue, harmony: o.harmony, scheme: o.scheme, source: 'wheel' as const, ...wheel };
  return JSON.stringify(
    {
      version: '1.1',
      generator: `muse@${o.museVersion}`,
      createdAt: createdAtIso,
      palette,
      style: o.styleId ? { id: o.styleId, name: o.styleName ?? o.styleId, traits: o.styleTraits ?? [] } : null,
      effects: o.effects,
      system: sys
        ? {
            catalog: 'open-design', id: sys.id, name: sys.name, category: sys.category,
            path: sys.path, components: `${sys.path}\\components.html`, guide: `${sys.path}\\DESIGN.md`,
            fonts: sys.fonts,
            // Only surface authored rules: the generic gabarit would read to the
            // agent as curated guidance from this system, which it is not.
            antiPatterns: sys.authoredAntiPatterns ? sys.antiPatterns : [],
          }
        : null,
      trends: { status: 'placeholder', note: 'Espace réservé — scrap Pinterest / tendances / articles à venir.' },
    },
    null,
    2
  );
}

/** ── Document styling (doc lane) ─────────────────────────────────────────
 *  The site/app lanes hand their design to an IDE agent through
 *  design-tokens.json; a document is generated inside Muse, so the SAME style
 *  presets have to reach the generation prompt instead. Pure builder — the
 *  preset table itself lives with the Design Studio UI.
 */
/** The same job as buildDocStyleBlock, for an Open Design system. A document
 *  is rendered INSIDE Muse, so the system has to reach the model as text —
 *  there is no design-tokens.json for the agent to read. Its palette is
 *  authored, hence "these EXACT values": the model reinterpreting them would
 *  give back a generic document wearing the system's name. */
export function buildDocDesignBlock(r: ResolvedDesign, label: string): string {
  const p = r.palette;
  const roles = [
    p.background && `background ${p.background}`,
    p.surface && `surfaces/cards ${p.surface}`,
    p.text && `body text ${p.text}`,
    p.muted && `secondary text ${p.muted}`,
    p.base && `primary accent ${p.base}`,
  ].filter(Boolean).join(', ');
  return [
    `VISUAL STYLE — apply it strictly, it is my chosen design, not a suggestion: ${label} (${r.scheme} scheme).`,
    roles ? `Use these EXACT values by role: ${roles}.` : '',
    r.accents.length ? `Further accents available: ${r.accents.join(', ')}.` : '',
    Object.keys(r.fontRoles).length
      ? `Typography, per tag — use these families, they are installed on my machine: ${FONT_ROLES.filter((k) => r.fontRoles[k]).map((k) => `${k} = ${fontStack(r.fontRoles[k] as string)}`).join('; ')}.`
      : '',
    r.fonts.length ? `Font direction: ${r.fonts.join(' | ')} — reproduce their SPIRIT with system stacks only.` : '',
    r.effects.length ? `Visual effects I want, and no others: ${r.effects.join(', ')}.` : '',
    'NEVER use @import, <link> or any external font — the document must render offline as one file.',
    'The style applies to the whole document: background, headings, body text, cards, separators and spacing rhythm — not just accent colors.',
    r.antiPatterns.length ? `Rules this system sets, respect them: ${r.antiPatterns.slice(0, 8).join(' · ')}.` : '',
  ].filter(Boolean).join(' ');
}

export function buildDocSystemBlock(sys: OdSystem): string {
  const p = sys.palette;
  const roles = [
    p.background && `background ${p.background}`,
    p.surface && `surfaces/cards ${p.surface}`,
    p.text && `body text ${p.text}`,
    p.muted && `secondary text ${p.muted}`,
    p.base && `primary accent ${p.base}`,
  ].filter(Boolean).join(', ');
  return [
    `VISUAL STYLE — apply it strictly, it is my chosen design, not a suggestion: the "${sys.name}" design system${sys.category ? ` (${sys.category})` : ''}, ${odScheme(sys)} scheme.`,
    sys.intent ? `Its intent: ${sys.intent}` : '',
    roles ? `Use these EXACT values by role: ${roles}.` : '',
    sys.accents.length ? `Further accents available: ${sys.accents.join(', ')}.` : '',
    sys.fonts.length ? `Font direction: ${sys.fonts.join(' | ')} — reproduce their SPIRIT with system stacks only.` : '',
    'NEVER use @import, <link> or any external font — the document must render offline as one file.',
    'The style applies to the whole document: background, headings, body text, cards, separators and spacing rhythm — not just accent colors.',
    // Only a system that wrote its own rules gets to impose them; the shared
    // gabarit would read as this system's doctrine when it is nobody's.
    sys.authoredAntiPatterns && sys.antiPatterns.length
      ? `Rules this system sets, respect them: ${sys.antiPatterns.slice(0, 8).join(' · ')}.`
      : '',
  ].filter(Boolean).join(' ');
}

export function buildDocStyleBlock(o: { styleName: string; scheme: Scheme; palette: string[]; traits: string[] }): string {
  return [
    `VISUAL STYLE — apply it strictly, it is my chosen design, not a suggestion: "${o.styleName}" (${o.scheme} scheme).`,
    `Palette (use these exact hex values for background, text and accents): ${o.palette.join(', ')}.`,
    `Design traits: ${o.traits.join(' · ')}.`,
    // The document must stay a single self-contained file: no CDN, no font
    // fetch. A trait naming a font is a DIRECTION, matched with system stacks.
    'Typography: reproduce the SPIRIT of any font named above using system stacks only (e.g. Georgia/serif for editorial, system-ui/sans-serif for neutral, ui-monospace for technical). NEVER use @import, <link> or any external font — the document must render offline as one file.',
    'The style applies to the whole document: background, headings, body text, cards, separators and spacing rhythm — not just accent colors.',
  ].join(' ');
}

/** Pass 1 — PLAN. Field finding (2026-07-28): asking one call to invent the
 *  structure AND typeset it yields a crude page, and the weaker the model the
 *  cruder. Deciding the outline first gives the render pass something to fill
 *  instead of improvising. Cheap (short output), and it is where the memory
 *  actually matters — it decides what content exists. */
export function buildDocPlanPrompt(o: { name: string; purpose: string; memoryName?: string }): string {
  return `You are a document architect. Plan — do NOT write — a document titled "${o.name}".

INTENT (the brief I gave): ${o.purpose}

${o.memoryName
    ? `The memory context you are given comes from my vault "${o.memoryName}". Base the plan on what is ACTUALLY there. Where the memory says nothing, plan a section that states the gap — never plan a section you would have to fill with invented facts.`
    : 'If memory context is provided, base the plan on what is actually there; never plan a section you would have to fill with invented facts.'}

Decide, in ${langInEnglish()}:
- The audience, in one line, and the ONE thing they must remember.
- 4 to 7 sections MAX. For each: a real title (not "Introduction"), one line on what it says, and its visual form — running text / a list of 3-4 parallel items / a comparison / a figure with its caption / a call to action.
- Which single section is the visual anchor of the page (the one that gets the most weight).

OUTPUT — this exact shape, nothing else, no preamble (the labels AUDIENCE/MESSAGE/ANCHOR stay in English, everything between < > is in ${langInEnglish()}):
AUDIENCE: <…>
MESSAGE: <…>
1. <title> — <what it says> — form: <running text|list|comparison|figure|call to action>
2. …
ANCHOR: <number of the section that carries the page>`;
}

/** Pass 2 — RENDER. The doc lane used to reuse the "app maker" prompt, which
 *  is why presentations came out looking like toy apps. This is a typesetting
 *  brief with an explicit quality bar. */
/** How a document is laid out. `page` is the default single piece, `long` goes
 *  deep, `slides` is a deck read one screenful at a time. */
export type DocFormat = 'page' | 'long' | 'slides';

const FORMAT_DIRECTIVE: Record<DocFormat, string> = {
  page: `FORMAT — a single well-paced page: 4 to 6 sections, each one worth reading. Do not pad.`,
  long: `FORMAT — a LONG-FORM piece: 9 to 14 sections that actually develop the subject, with sub-headings, and a short table of contents linking to them (anchors). Depth means more ground covered, NEVER the same idea restated: if the material runs out, close the document rather than repeat.`,
  slides: `FORMAT — a SLIDE DECK read one screenful at a time. Each slide is a <section> sized \`min-height:100dvh\` with its content vertically centred, ONE idea per slide, a large title and at most 5 short lines or bullets — never a paragraph. 8 to 14 slides, numbered discreetly in a corner. In @media print, each slide starts a new page (\`break-after:page\`) and drops to a light background.`,
};

/** One selectable image, as the model is allowed to know it: never the bytes,
 *  a file name at minimum, and ideally a caption. A bare name like "img_042.jpg"
 *  or "icon.svg" tells the model nothing about what it shows or where it
 *  belongs — the caption is what turns "an image exists" into "this image
 *  can be placed on purpose" instead of skipped for lack of any signal. */
export type PromptImage = { name: string; caption?: string };

/** The visual contract. Images NEVER reach the model — it places tokens, and
 *  the cartridge swaps in the data URIs afterwards. Two reasons: a base64
 *  photo would blow the context window for no benefit, and the model cannot
 *  invent a src it was never given. */
function visualDirective(o: { svg?: boolean; images?: PromptImage[] }): string {
  const parts: string[] = [];
  if (o.images?.length) {
    const list = o.images.map((img, i) => `  ${i + 1}. {{IMG_${i + 1}}} — ${img.caption ? img.caption : `(no description given — file: ${img.name})`}`).join('\n');
    parts.push(`IMAGES — ${o.images.length} image(s) are available, described below (never the file itself). Place the ones that genuinely help, each inside a <figure> with a short <figcaption> written in LANGUAGE — base the caption on the description given, not on the file name. Reference an image ONLY by its token, copied exactly, alone inside the figure:
${list}
An image with no description is a guess for you — place it only if the file name alone makes its content obvious, skip it otherwise. Use each token AT MOST once. SKIP any that does not fit the section you are writing — an image forced onto a page is worse than no image. Never write an <img> tag yourself and never invent a src: the tokens are the only way to show a picture.`);
  }
  if (o.svg) {
    parts.push(`DIAGRAMS — where a drawing genuinely clarifies (a flow, a comparison, a structure, a proportion), draw it as INLINE SVG: a viewBox, text in the page's own font stack, colours taken from the palette already in use. At most 3, and none that is merely decorative — an SVG that carries no information is noise.`);
  }
  return parts.length ? `\n${parts.join('\n\n')}\n` : '';
}

export function buildDocRenderPrompt(o: {
  name: string; purpose: string; plan?: string; styleBlock?: string; memoryName?: string;
  format?: DocFormat; svg?: boolean; images?: PromptImage[];
}): string {
  return `You are a document designer typesetting a finished, printable page in HTML. This is a DOCUMENT to be read and shared — not an app, not a toy demo.

TITLE: ${o.name}
INTENT: ${o.purpose}
LANGUAGE: everything visible is in ${langInEnglish().toUpperCase()}.
${o.plan ? `\nTHE PLAN — follow it, section by section, in this order:\n${o.plan}\n` : ''}
${o.memoryName
    ? `GROUND IT: base every factual claim on MY MEMORY given to you as context (vault "${o.memoryName}"). Where the memory is silent, write that it is missing — NEVER invent a memory, a date, a name, a figure or a quote.`
    : 'GROUND IT: if memory context is provided, base your factual claims on it. NEVER invent a date, a name, a figure or a quote.'}

QUALITY BAR — a reader must see a finished document, not a generated draft:
- ONE clear hierarchy: a title block, then sections. Heading sizes follow a scale (e.g. 2.6rem / 1.5rem / 1.05rem), never all-similar.
- Running text is capped around 68-72 characters per line and left-aligned. Never centre a paragraph, never justify.
- Consistent spacing scale (multiples of one base, e.g. 8px). Generous breathing room between sections — a cramped page reads cheap.
- Cards/boxes ONLY for genuinely parallel items (3 or 4 side by side, equal weight). Never wrap the whole page in boxes, never a box containing a single paragraph.
- One accent colour used sparingly, for emphasis and rules — not on every heading.
- Zero emoji unless I asked for them. Zero "Lorem ipsum". Zero "à venir" placeholder section.
- Print-friendly: include an @media print rule (white background, dark text, no shadows, avoid breaking a section across pages).
${FORMAT_DIRECTIVE[o.format ?? 'page']}
${o.styleBlock ? `\n${o.styleBlock}\n` : ''}${visualDirective(o)}
TECHNICAL: ONE complete self-contained HTML document — inline CSS only, no external file, no CDN, no @import, no framework, no external image URL. Responsive with flexible layout (flex/grid, %, clamp); it must read well from mobile to desktop without horizontal scrolling.

Return ONLY the HTML document, starting with <!doctype html>. No explanation, no code fence.
(Reminder: every word of visible text in the document — titles, body, captions, labels — MUST be written in ${langInEnglish()}. This instruction block is in English on purpose; the document is not.)`;
}

/** Extensions `dialog.readFile` returns as a data URI (its own binary
 *  whitelist), so these are exactly the files Muse can embed. */
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

export function isImageFile(rel: string): boolean {
  return IMAGE_EXTS.includes(rel.split('.').pop()?.toLowerCase() ?? '');
}

function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeAttr(s: string): string { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

/** Swaps `{{IMG_n}}` tokens for real <img> tags, then drops the tokens the
 *  model left unused — shipping a literal "{{IMG_3}}" would be worse than no
 *  image at all.
 *  ⚠️ The replacement MUST be a function: a data URI handed to String.replace
 *  as a replacement STRING has its `$&`/`$'`/`$$` sequences interpreted, which
 *  silently mangles the document (the same trap that once shredded an inlined
 *  bundle). Base64 has no `$` today — the rule holds anyway, because the day a
 *  filename reaches this string it would. */
export function replaceImagePlaceholders(
  html: string,
  images: Array<{ token: string; uri: string; alt: string }>,
): string {
  let out = html;
  for (const img of images) {
    const tag = `<img src="${img.uri}" alt="${escapeAttr(img.alt)}" style="max-width:100%;height:auto;display:block;margin:0 auto" />`;
    out = out.replace(new RegExp(escapeRegExp(img.token), 'g'), () => tag);
  }
  return out.replace(/\{\{IMG_\d+\}\}/g, '');
}

/** Optional support artifacts generated in-Muse into <appDir>/docs/ — the IDE
 *  agent reads them before coding. Deterministic prompts, model picked by the
 *  user (eco/standard/max) in the project board. */
export type ArtifactKind = 'spec' | 'mermaid';

export function buildArtifactPrompt(kind: ArtifactKind, o: { name: string; purpose: string; features: string[]; nextSteps: string[]; lane: Lane }): string {
  const feats = o.features.filter(Boolean).map((f, i) => `${i + 1}. ${f}`).join('\n') || '(to be defined)';
  const later = o.nextSteps.filter(Boolean).join(', ') || '(none)';
  const ctx = `PROJECT
- Name: ${o.name}
- Type: ${o.lane === 'site' ? 'website grounded on the user’s Mnemosyne memory' : o.lane === 'doc' ? 'document' : 'Mnemosyne OS cartridge app'}
- Intent: ${o.purpose}
- v0 features:
${feats}
- Deferred (NOT in v0 scope): ${later}`;
  if (kind === 'spec') {
    return `You are a product writer. Produce the COMPLETE content of a SPEC.md file, in ${langInEnglish()}, for the project below. Markdown only — no preamble, no closing remarks, start directly with the title line.

Sections (exactly): # Spec — ${o.name} / ## Objectif / ## Utilisateurs / ## Fonctions v0 / ## Hors-scope v0 / ## Écrans & interactions / ## Données / ## Critères de terminé (v0).
Keep it short and concrete: a beginner must understand every line. "Hors-scope v0" lists the deferred parts so nobody builds them too early.

${ctx}`;
  }
  return `You are a software architect. Produce the COMPLETE content of a DIAGRAMS.md file for the project below. Markdown only — no preamble, start directly with the title line.

It must contain exactly two sections, each with ONE fenced \`\`\`mermaid block:
# Diagrammes — ${o.name}
## Parcours v0 — a flowchart of the v0 user flow, top to bottom, short ${langInEnglish()} labels.
## Architecture — a simple graph of the main pieces (UI, data, ${o.lane === 'site' ? 'Mnemosyne MCP' : 'host SDK actions'}) and their links.

Keep both diagrams SMALL (max ~12 nodes each) and use valid Mermaid syntax.

${ctx}`;
}

/** The premade prompt the user pastes into their IDE agent. English core
 *  (agents are strongest in English) + MY LANGUAGE rule, per doc 64 §6. */
export function buildHandoffPrompt(o: HandoffInput): string {
  const feats = o.features.filter(Boolean);
  const featLines = feats.length
    ? feats.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : '1. (to define together — propose the smallest useful core loop)';
  const isSite = o.target === 'site';
  // The vault the user picked in Muse — the agent must not wander into others.
  const memMode = memoryMode(o.memory);
  const memRule = memMode === 'none'
    ? 'I chose NO memory for this project: do not query the MCP for my content, and do not invent memories — everything factual must come from me.'
    : memMode === 'all'
      ? 'Query across my whole memory (no particular vault was chosen for this project).'
      : `Query ONLY these vaults, the memory I chose for this project: ${(o.memory as { vaults: MemoryVault[] }).vaults.map((v) => `"${v.displayName}" (id \`${v.vaultId}\`)`).join(', ')}. Do NOT pull from my other vaults; if what you need is not in them, tell me instead of substituting another source.`;
  const memorySteps = isSite
    ? `1. ${o.appDir}\\BRIEF.md and ${o.appDir}\\app-spec.json — what we build and why.
2. ${memMode === 'none'
      ? `Memory: ${memRule} Build the site from the brief alone.`
      : `The Mnemosyne MCP (ws://127.0.0.1:7799 — the Mnemosyne OS app must be running): this website is ABOUT my memory, so query the MCP to ground every page on my REAL vault content. ${memRule} If the MCP is unreachable, STOP and tell me how to start it — do not invent memory content.`}
3. ${o.repoDir}\\ — READ-ONLY reference if you need context about Mnemosyne OS itself.
4. If ${o.appDir}\\docs\\ exists (SPEC.md, DIAGRAMS.md), read it too — it is part of the contract.
5. If ${o.appDir}\\design-tokens.json exists, APPLY it strictly: palette roles, page-style traits, effects — and if it contains a "system", open its "components" file and its "guide" on disk and follow THAT system's component language; its palette already won over my colour wheel, so use the tokens as written and never recolour it. It is my chosen design, not a suggestion.
6. If ${o.appDir}\\design\\ exists (buttons.css, buttons.html — components ALREADY adapted to my tokens by Mnemosyne), use those files as the base for buttons/components instead of restyling from scratch.`
    : `1. ${o.appDir}\\BRIEF.md and ${o.appDir}\\app-spec.json — what we build and why.
2. ${o.repoDir}\\llms.txt — the developer entry point: the surfaces and the authoritative host-action table. Do NOT invent actions: if it is not listed there or in the boilerplate docs, it does not exist.
3. The official boilerplate — your template for folder structure, mnemo-plugin.json and SDK usage. It lives at ${o.repoDir}\\examples\\cartridge-boilerplate\\ (public clone) or ${o.repoDir}\\apps\\mnemo-cartridge-boilerplate\\ (full monorepo); if neither path exists, search the repo for "cartridge-boilerplate". Read its AGENTS.md and README first if present.
4. If ${o.appDir}\\docs\\ exists (SPEC.md, DIAGRAMS.md), read it too — it is part of the contract.
5. If ${o.appDir}\\design-tokens.json exists, APPLY it strictly: palette roles, style traits, effects — and if it contains a "system", open its "components" file and its "guide" on disk and follow THAT system's component language; its palette already won over my colour wheel, so use the tokens as written and never recolour it. It is my chosen design, not a suggestion.
6. If ${o.appDir}\\design\\ exists (buttons.css, buttons.html — components ALREADY adapted to my tokens by Mnemosyne), use those files as the base for buttons/components instead of restyling from scratch.
7. Optional: if the Mnemosyne MCP is reachable (ws://127.0.0.1:7799, the app must be running), you may use it to query my memory for extra context. ${memRule}`;
  const buildRules = isSite
    ? `- A static website (plain HTML/CSS/JS unless I ask otherwise): openable locally, deployable anywhere, no server required for v0.
- Ground the content on my REAL memory via the MCP — never fabricate memories or data.
- v0 = ONE page that looks finished and shows real content. More pages come after.
- Never fake anything: no placeholder data presented as real, no silent catch blocks, say plainly what is not implemented yet.
- Ask me ONE question at a time when you need a decision.`
    : `- Start by replicating the boilerplate structure into the app folder and adapt mnemo-plugin.json (name, displayName, permissions, widgets). Plumbing comes from the template — never invented.
- Dependencies come from npm (copy the boilerplate's package.json): @mnemosyne_os/cartridge-sdk + react/react-dom + the vite toolchain. Never reference workspace packages.
- SHIP CRITERIA — the host preflight rejects the cartridge otherwise: vite config uses base './'; mnemo-plugin.json entrypoints.renderer is a RELATIVE path ("index.html"), never a localhost URL; run the build so dist/ exists — the host serves dist/, not your sources.
- v0 = a skeleton that RUNS today: ONE screen, the core loop, zero bonus features. We iterate after.
- Never fake anything: no hardcoded values pretending to be real data, no silent catch blocks, and say plainly what is not implemented yet.
- Ask me ONE question at a time when you need a decision.`;
  return `You are my coding agent. We are building ${isSite ? 'a WEBSITE grounded on my Mnemosyne OS memory' : 'a REAL Mnemosyne OS cartridge app'}.

MY LANGUAGE: ${langEndonym()} — always talk to me in my language.

WORKSPACE
- Project folder (work ONLY in here): ${o.appDir}
- Mnemosyne repo (READ-ONLY reference): ${o.repoDir}

TAKE THE MEMORY FIRST — read before writing any code:
${memorySteps}

BUILD RULES
${buildRules}

PRESENTATION — I am not a developer (field-tested rules):
- Do NOT dump pages of code at me: report progress as a short plain-language checklist (e.g. "✓ page created, ✓ button wired, ✓ file verified").
- NEVER say something is done unless you checked the file actually exists on disk. If it is not there, say so plainly and create it — do not pretend.
- Each time you finish a phase, give me the EXACT folder path and which file to open — I must never wonder where my project is.

THE APP
- Name: ${o.name}
- Intent: ${o.purpose}
- v0 features (hard cap — refuse scope creep politely):
${featLines}${o.nextSteps.filter(Boolean).length ? `
- Next steps (LATER — do NOT build these in v0, they are the kept ambition):
${o.nextSteps.filter(Boolean).map((n) => `  - ${n}`).join('\n')}` : ''}

Start now: read the memory files above, then show me your v0 plan in max 5 steps and wait for my OK before coding.`;
}

/** BRIEF.md — human-readable brief dropped in the app folder. Follows the
 *  shell language (doc 64 §7ter): the scaffold structure is fixed, the
 *  section labels/prose are picked from BRIEF_STR[_promptLang]. */
const BRIEF_STR: Record<PromptLang, {
  titleSuffix: string;
  generatedBy: (v: string) => string;
  idea: string;
  memoryHeading: string;
  memNone: string;
  memAll: string;
  memPick: (list: string) => string;
  featHeading: string;
  featPlaceholder: string;
  nextHeading: string;
  rulesHeading: string;
  siteRules: () => string;
  cartridgeRules: (repoDir: string) => string;
  promptHeading: string;
  pasteInstruction: string;
}> = {
  en: {
    titleSuffix: '— Muse Brief',
    generatedBy: (v) => `Generated by Muse v${v} (Mnemosyne OS). This folder is the starting point of the app.`,
    idea: 'The idea',
    memoryHeading: 'Supporting memory',
    memNone: 'None — this project does not rest on any vault. The agent does not draw from my memory.',
    memAll: 'All of my memory (federated search across every vault).',
    memPick: (list) => `${list} — that is WHERE the agent draws from. Not the others.`,
    featHeading: 'v0 features — a skeleton that WORKS',
    featPlaceholder: '_To define with the agent — aim for the smallest useful loop._',
    nextHeading: 'Next steps (after v0 — the kept ambition)',
    rulesHeading: 'Project rules',
    siteRules: () => `- Target: a **website** grounded on my Mnemosyne memory (via the MCP, app open).
- Static site (HTML/CSS/JS): openable locally, deployable anywhere, zero server in v0.
- Content grounded on my REAL memory — never invented memories.
- v0 first: ONE finished page with real content, the rest after.
- Honesty: no simulated data presented as real.`,
    cartridgeRules: (repoDir) => `- Target: a **Mnemosyne OS cartridge** (SDK \`@mnemosyne_os/cartridge-sdk\`), not a standalone page.
- Developer entry point: \`${repoDir}\\llms.txt\` — surfaces + host action table, READ FIRST.
- Model to follow: the official boilerplate → \`${repoDir}\\examples\\cartridge-boilerplate\\\` (public clone) or \`${repoDir}\\apps\\mnemo-cartridge-boilerplate\\\` (full monorepo).
- \`mnemo-plugin.json\` = plumbing: copied from the boilerplate then adapted, never invented.
- Delivery criteria: vite \`base: './'\`, \`entrypoints.renderer\` RELATIVE (\`index.html\`), \`dist/\` build present — otherwise the import is rejected.
- v0 first: ONE running screen, the core loop, zero bonus features.
- Honesty: no simulated data presented as real.`,
    promptHeading: 'Prompt for the IDE agent',
    pasteInstruction: 'Copy-paste as-is:',
  },
  fr: {
    titleSuffix: '— Brief Muse',
    generatedBy: (v) => `Généré par Muse v${v} (Mnemosyne OS). Ce dossier est le point de départ de l'app.`,
    idea: 'L’idée',
    memoryHeading: 'Mémoire d’appui',
    memNone: 'Aucune — ce projet ne s’adosse sur aucun vault. L’agent ne puise pas dans ma mémoire.',
    memAll: 'Toute ma mémoire (recherche fédérée sur tous les vaults).',
    memPick: (list) => `${list} — c'est LÀ que l'agent puise. Pas dans les autres.`,
    featHeading: 'Fonctions v0 — un squelette qui MARCHE',
    featPlaceholder: '_À définir avec l’agent — viser la plus petite boucle utile._',
    nextHeading: 'Prochaines étapes (après la v0 — l’ambition gardée)',
    rulesHeading: 'Règles du projet',
    siteRules: () => `- Cible : un **site web** fondé sur ma mémoire Mnemosyne (via le MCP, app ouverte).
- Site statique (HTML/CSS/JS) : ouvrable en local, déployable partout, zéro serveur en v0.
- Contenu ancré sur ma VRAIE mémoire — jamais de souvenirs inventés.
- v0 d'abord : UNE page finie avec du vrai contenu, les autres ensuite.
- Honnêteté : aucune donnée simulée présentée comme réelle.`,
    cartridgeRules: (repoDir) => `- Cible : une **cartouche Mnemosyne OS** (SDK \`@mnemosyne_os/cartridge-sdk\`), pas une page isolée.
- Point d'entrée développeur : \`${repoDir}\\llms.txt\` — surfaces + table des actions hôte, à lire EN PREMIER.
- Modèle à suivre : le boilerplate officiel → \`${repoDir}\\examples\\cartridge-boilerplate\\\` (clone public) ou \`${repoDir}\\apps\\mnemo-cartridge-boilerplate\\\` (monorepo complet).
- \`mnemo-plugin.json\` = plomberie : copié du boilerplate puis adapté, jamais inventé.
- Critères de livraison : vite \`base: './'\`, \`entrypoints.renderer\` RELATIF (\`index.html\`), build \`dist/\` présent — sinon l'import est refusé.
- v0 d'abord : UN écran qui tourne, la boucle cœur, zéro feature bonus.
- Honnêteté : aucune donnée simulée présentée comme réelle.`,
    promptHeading: 'Prompt pour l’agent IDE',
    pasteInstruction: 'Copie-colle tel quel :',
  },
  es: {
    titleSuffix: '— Resumen de Muse',
    generatedBy: (v) => `Generado por Muse v${v} (Mnemosyne OS). Esta carpeta es el punto de partida de la app.`,
    idea: 'La idea',
    memoryHeading: 'Memoria de apoyo',
    memNone: 'Ninguna — este proyecto no se apoya en ningún vault. El agente no recurre a mi memoria.',
    memAll: 'Toda mi memoria (búsqueda federada en todos los vaults).',
    memPick: (list) => `${list} — de AHÍ es de donde saca el agente. De los demás no.`,
    featHeading: 'Funciones v0 — un esqueleto que FUNCIONA',
    featPlaceholder: '_Por definir con el agente — apunta al bucle útil más pequeño._',
    nextHeading: 'Próximos pasos (después de la v0 — la ambición conservada)',
    rulesHeading: 'Reglas del proyecto',
    siteRules: () => `- Objetivo: un **sitio web** basado en mi memoria de Mnemosyne (vía el MCP, con la app abierta).
- Sitio estático (HTML/CSS/JS): abrible en local, desplegable donde sea, sin servidor en v0.
- Contenido anclado en mi memoria REAL — nunca recuerdos inventados.
- v0 primero: UNA página terminada con contenido real, las demás después.
- Honestidad: ningún dato simulado presentado como real.`,
    cartridgeRules: (repoDir) => `- Objetivo: un **cartucho de Mnemosyne OS** (SDK \`@mnemosyne_os/cartridge-sdk\`), no una página aislada.
- Punto de entrada para el desarrollador: \`${repoDir}\\llms.txt\` — superficies + tabla de acciones del host, LEER PRIMERO.
- Modelo a seguir: el boilerplate oficial → \`${repoDir}\\examples\\cartridge-boilerplate\\\` (clon público) o \`${repoDir}\\apps\\mnemo-cartridge-boilerplate\\\` (monorepo completo).
- \`mnemo-plugin.json\` = fontanería: copiado del boilerplate y luego adaptado, nunca inventado.
- Criterios de entrega: vite \`base: './'\`, \`entrypoints.renderer\` RELATIVO (\`index.html\`), build \`dist/\` presente — si no, se rechaza la importación.
- v0 primero: UNA pantalla que funciona, el bucle central, cero funciones extra.
- Honestidad: ningún dato simulado presentado como real.`,
    promptHeading: 'Prompt para el agente IDE',
    pasteInstruction: 'Copia y pega tal cual:',
  },
};

export function buildBrief(o: HandoffInput): string {
  const L = BRIEF_STR[_promptLang];
  const feats = o.features.filter(Boolean);
  const featLines = feats.length
    ? feats.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : L.featPlaceholder;
  return `# ${o.name} ${L.titleSuffix}

> ${L.generatedBy(o.museVersion)}

## ${L.idea}
${o.purpose}

## ${L.memoryHeading}
${memoryMode(o.memory) === 'none'
    ? L.memNone
    : memoryMode(o.memory) === 'all'
      ? L.memAll
      : L.memPick((o.memory as { vaults: MemoryVault[] }).vaults.map((v) => `**${v.displayName}** (\`${v.vaultId}\`)`).join(' + '))}

## ${L.featHeading}
${featLines}
${o.nextSteps.filter(Boolean).length ? `
## ${L.nextHeading}
${o.nextSteps.filter(Boolean).map((n) => `- ${n}`).join('\n')}
` : ''}
## ${L.rulesHeading}
${o.target === 'site' ? L.siteRules() : L.cartridgeRules(o.repoDir)}

## ${L.promptHeading}
${L.pasteInstruction}

\`\`\`
${buildHandoffPrompt(o)}
\`\`\`
`;
}

/** app-spec.json — the machine-readable contract seed (doc 64: renamed from
 *  manifest.json to avoid the mnemo-plugin.json collision). */
export function buildAppSpec(o: HandoffInput, createdAtIso: string): string {
  return JSON.stringify(
    {
      $schema: 'https://mnemosyne-os.com/schemas/app-spec.schema.json',
      specVersion: '1.0',
      name: o.name,
      slug: o.slug,
      purpose: o.purpose,
      features: o.features.filter(Boolean),
      nextSteps: o.nextSteps.filter(Boolean),
      target: o.target === 'site' ? 'website' : 'mnemo-cartridge',
      // Which memory grounds this project (null = federated over every vault).
      memory: { mode: memoryMode(o.memory), vaults: memoryMode(o.memory) === 'pick' ? (o.memory as { vaults: MemoryVault[] }).vaults : [] },
      createdAt: createdAtIso,
      generator: `muse@${o.museVersion}`,
    },
    null,
    2
  );
}
