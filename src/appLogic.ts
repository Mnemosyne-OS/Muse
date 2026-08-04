// Pure, deterministic helpers used across App.tsx — no React state, no hooks,
// no host/SDK calls. Extracted so they can be unit-tested the same way
// handoff.ts is (see scripts/test.mjs), independently of the giant component.
// `t`/`lang` are threaded in as explicit params rather than imported from
// useI18n, same convention as osLabel/projectPhases below: it keeps this file
// import-free of the i18n module, which in turn imports the locale JSON files
// without a Node `type: "json"` import attribute (Vite-only syntax) — pulling
// it in here would break scripts/test-logic.mjs's direct Node execution.
import { memoryLabel, memoryMode, type DocFormat, type Lane, type MemorySource } from './handoff.ts';

type T = (key: string, vars?: Record<string, string | number>) => string;

/** A repo Muse can clone into the user's app space (own repo, samples). */
export type Installable = { id: string; icon: string; name: string; repo: string; dir: string };

/** Cost of ONE generation, measured — never estimated (doc 64 §7septies m).
 *  `usdMicro` is the delta of the wallet's server-metered `usedUsdMicro`
 *  around the call. `null` = not measurable on this engine: local costs
 *  nothing, and a personal API key is billed by the provider, which the host
 *  never sees. The two cases are NOT the same and must not read the same. */
export type GenCost = { usdMicro: number } | { unmeasured: 'local' | 'byok' } | null;

/** A dollar amount in the reader's locale — comma in fr/es, dot in en. */
export function fmtUsd(v: number, digits: number, lang: string): string {
  const n = new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  return `${n} $`;
}

/** Money for humans, in the SAME unit as the balance it is drawn from.
 *  The display used to switch to cents under 1 ¢, and "0.52 ¢" reads like an
 *  ordinary price — half a cent looked expensive, and the wallet barely moving
 *  looked like a contradiction instead of the confirmation it was. Dollars
 *  throughout make a document's cost directly comparable to the credit balance.
 *  `null` = not measurable on this engine, and must NEVER render as zero. */
export function formatCost(c: GenCost, t: T, lang: string): string {
  if (!c) return '';
  if ('unmeasured' in c) return t(c.unmeasured === 'local' ? 'cost.free' : 'cost.unmeasured');
  const usd = c.usdMicro / 1_000_000;
  if (usd === 0) return fmtUsd(0, 2, lang);
  // Under a tenth of a cent the exact figure is noise and a rounded "0,00 $"
  // would read as free, which is a different claim. Three decimals below a
  // cent keep it honest without faking a precision nobody needs.
  if (usd < 0.001) return `< ${fmtUsd(0.001, 3, lang)}`;
  return fmtUsd(usd, usd < 0.01 ? 3 : 2, lang);
}

/** Translated memory label for the UI. handoff's memoryLabel() stays as-is:
 *  it also feeds prompts and persisted rows, which must not follow the shell. */
export function memLabelUI(mem: MemorySource, t: T): string {
  const mode = memoryMode(mem);
  if (mode === 'none') return t('mem.none');
  if (mode === 'all') return t('mem.all');
  return memoryLabel(mem);
}

/** Reads a cost back from a stored row — tolerant, since rows written before
 *  cost tracking simply have none. */
export function parseCost(raw: unknown): GenCost {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { usdMicro?: unknown; unmeasured?: unknown };
  if (typeof o.usdMicro === 'number') return { usdMicro: o.usdMicro };
  if (o.unmeasured === 'local' || o.unmeasured === 'byok') return { unmeasured: o.unmeasured };
  return null;
}

/** Rebuilds the memory scope persisted with a document take. An unrecognized
 *  or absent shape returns null — "no contract on record", never a silent
 *  "all": the caller must then leave the picker alone rather than widen it. */
export function parseMemSource(raw: unknown): MemorySource {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as { mode?: unknown; vaults?: unknown };
  if (m.mode === 'none') return { mode: 'none', vaults: [] };
  if (m.mode === 'all') return { mode: 'all', vaults: [] };
  if (m.mode === 'pick' && Array.isArray(m.vaults)) {
    const vaults = (m.vaults as Array<{ vaultId?: unknown; displayName?: unknown }>)
      .filter((v) => !!v && typeof v === 'object' && typeof v.vaultId === 'string')
      .map((v) => ({ vaultId: v.vaultId as string, displayName: typeof v.displayName === 'string' && v.displayName ? v.displayName : v.vaultId as string }));
    return vaults.length ? { mode: 'pick', vaults } : null;
  }
  return null;
}

/** What a run actually retrieved. `mode` is the memory choice that produced
 *  it, so "0 items" can be read as intended (none) or as a warning (a pick
 *  that reached nothing). */
export type Grounding = { count: number; vaults: string[]; mode: 'none' | 'all' | 'pick' };

/** Reads back what a stored take was grounded on. Absent on every take
 *  written before this was recorded — shown as "unknown", never as zero. */
export function parseGrounding(raw: unknown): Grounding | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as { count?: unknown; vaults?: unknown; mode?: unknown };
  if (typeof g.count !== 'number') return null;
  const vaults = Array.isArray(g.vaults) ? g.vaults.filter((v): v is string => typeof v === 'string') : [];
  const mode = g.mode === 'none' || g.mode === 'pick' ? g.mode : 'all';
  return { count: g.count, vaults, mode };
}

/** An image on disk, referenced by path — the bytes are read on demand.
 *  `caption` is what the user says it shows; without it the model gets only
 *  the file name, which is rarely enough to place an image on purpose. */
export type DocImage = { rel: string; path: string; caption?: string };

/** Reads back the images a take was built with. A malformed entry is
 *  dropped rather than failing the whole take — a missing photo later
 *  becomes a skipped <figure>, not a broken document. */
export function parseDocImages(raw: unknown): DocImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is DocImage & { caption?: unknown } =>
      !!v && typeof v === 'object' && typeof (v as DocImage).rel === 'string' && typeof (v as DocImage).path === 'string')
    .map((v) => ({ rel: v.rel, path: v.path, caption: typeof v.caption === 'string' ? v.caption : undefined }));
}

/** Join a base path with a sub-folder using the base's own separator (cross-OS). */
export function joinPath(base: string, sub: string) {
  return base + (base.includes('\\') ? '\\' : '/') + sub;
}

/** Project-board phases (mini-Gantt). Statuses are computed, not stored:
 *  framing/scaffold are behind us once the board shows, hand-off is the live
 *  step, the rest are suggested next steps ('soon' = not built in Muse yet). */
export type PhaseStatus = 'done' | 'current' | 'next' | 'soon' | 'optional';
/** `id` doubles as the icon key — App.tsx's PHASE_ICON map looks the icon up
 *  by it, since a React component reference can't live in this file (this
 *  module is also imported straight by Node for scripts/test-logic.mjs, and
 *  Glyphs.tsx is JSX — a syntax --experimental-strip-types cannot handle). */
export type Phase = { id: string; title: string; status: PhaseStatus };

/** Builds the mini-Gantt's 8 phases: title (translated) + status (computed
 *  from the disk scan, never stored — statuses are computed from what
 *  ACTUALLY exists on disk, the Gantt tells the truth, it is not decoration).
 *  `t` is threaded in rather than imported, since the caller is a component
 *  with its own useI18n() closure. */
export function projectPhases(lane: 'doc' | 'site' | 'cartridge', disk: { tokens: boolean; artifacts: boolean; adapted: boolean; built: boolean; verity: boolean }, t: (key: string, vars?: Record<string, string | number>) => string): Phase[] {
  return [
    { id: 'cadrage', title: t('board.phase.cadrage'), status: 'done' },
    { id: 'scaffold', title: t('board.phase.scaffold'), status: 'done' },
    { id: 'design', title: t('board.phase.design'), status: disk.tokens || disk.adapted ? 'done' : 'optional' },
    { id: 'artifacts', title: t('board.phase.artifacts'), status: disk.artifacts ? 'done' : 'optional' },
    { id: 'handoff', title: t('board.phase.handoff'), status: disk.built ? 'done' : 'current' },
    { id: 'build', title: lane === 'site' ? t('board.phase.buildSite') : t('board.phase.buildApp'), status: disk.built ? 'done' : 'next' },
    { id: 'verify', title: t('board.phase.verify'), status: disk.verity ? 'done' : disk.built ? 'next' : 'soon' },
    { id: 'publish', title: lane === 'site' ? t('board.phase.publishSite') : t('board.phase.publishApp'), status: 'soon' },
  ];
}

/** Small type icon for the project files panel. */
export function fileIcon(rel: string): string {
  if (/\.(md|markdown)$/i.test(rel)) return '📄';
  if (/\.json$/i.test(rel)) return '🧩';
  if (/\.(css|scss|less)$/i.test(rel)) return '🎨';
  if (/\.html?$/i.test(rel)) return '🌐';
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(rel)) return '⚙️';
  return '📃';
}

/** Rendered view of a Mermaid block on mermaid.live (no in-cartridge renderer:
 *  the lib is heavy and node_modules is junctioned — this is one click, zero dep). */
export function mermaidLiveUrl(code: string): string {
  const state = JSON.stringify({ code, mermaid: '{"theme":"dark"}' });
  return `https://mermaid.live/view#base64:${btoa(unescape(encodeURIComponent(state)))}`;
}

export type DocEntry = { name: string; rel: string; path: string };
export type DocFolder = { name: string; rel: string; folders: DocFolder[]; files: DocEntry[]; count: number };

/** Group the flat doc list into a nested folder tree (sorted, README first). */
export function buildDocTree(docs: DocEntry[]): DocFolder {
  const root: DocFolder = { name: '', rel: '', folders: [], files: [], count: 0 };
  const byRel = new Map<string, DocFolder>([['', root]]);
  for (const d of docs) {
    const parts = d.rel.split('/');
    let cur = root;
    let rel = '';
    for (let p = 0; p < parts.length - 1; p++) {
      rel = rel ? `${rel}/${parts[p]}` : parts[p];
      let f = byRel.get(rel);
      if (!f) { f = { name: parts[p], rel, folders: [], files: [], count: 0 }; byRel.set(rel, f); cur.folders.push(f); }
      cur = f;
    }
    cur.files.push(d);
  }
  /** Sorts a folder's children (README.md always first) and rolls up its
   *  total document count from its subfolders, recursively. */
  const finalize = (f: DocFolder): number => {
    f.folders.sort((a, b) => a.name.localeCompare(b.name));
    f.files.sort((a, b) => (a.name === 'README.md' ? -1 : b.name === 'README.md' ? 1 : a.name.localeCompare(b.name)));
    f.count = f.files.length + f.folders.reduce((sum, sub) => sum + finalize(sub), 0);
    return f.count;
  };
  finalize(root);
  return root;
}

/** Best-effort OS detection from the browser. */
export function detectOs(): 'win' | 'mac' | 'linux' | 'other' {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = String(nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase();
  if (p.includes('win')) return 'win';
  if (p.includes('mac') || p.includes('darwin')) return 'mac';
  if (p.includes('linux') || p.includes('x11')) return 'linux';
  return 'other';
}

/** OS names are proper nouns (universal); only the "unknown OS" fallback
 *  needs translation, so `t` is threaded in for that one case. */
export function osLabel(os: string, t: (key: string) => string): string {
  return os === 'win' ? 'Windows' : os === 'mac' ? 'macOS' : os === 'linux' ? 'Linux' : t('ob.otherSystem');
}

export type IdeDownload = {
  direct?: string; directByOs?: { win: string; mac: string; linux: string }; page: string;
};

/** The download URL for an editor, tailored to the OS when we have per-OS links. */
export function downloadUrl(o: IdeDownload, os: string): string {
  if (o.directByOs && (os === 'win' || os === 'mac' || os === 'linux')) return o.directByOs[os];
  return o.direct ?? o.page;
}

/** Pull a clean HTML document out of the model's answer (strips ``` fences). */
export function extractHtml(raw: string): string {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/** The cartridge bridge caps replies at ~30s while a shallow git clone of a
 *  big repo can legitimately take longer (main-side allows 180s). */
export const isHostTimeout = (err: unknown) =>
  String((err as Error)?.message ?? err).includes('did not reply');

/** One generated take of a document — regenerating adds a version, it never
 *  replaces and never spawns a second history row. */
export type DocVersion = {
  version: number; ts: number; html: string; style: string | null; memory: string | null; tier: string | null; cost: GenCost;
  /** What this take was grounded on, measured at generation time — not a
   *  promise from the picker but the host's own count of injected memories. */
  grounding: Grounding | null;
  /** Shape and visuals. `images` holds PATHS, never data: a single photo as a
   *  data URI would blow the 200 KB ceiling that decides whether a take is
   *  kept in history at all. The bytes are re-read from disk to display. */
  format: DocFormat | null;
  svg: boolean;
  images: DocImage[];
  /** The memory this take was actually grounded on. `memory` above is only its
   *  human label ("Notes + Développement +3"), which cannot be replayed — so
   *  reopening a document from history and regenerating silently fell back to
   *  whatever the picker happened to hold, i.e. the whole memory in a fresh
   *  session. Null on takes written before this was persisted. */
  memSource: MemorySource;
  /** The Open Design system this take was rendered with, by id. The id is
   *  enough to replay: the system is re-read from the catalogue on disk, so
   *  reopening a document restores the real design instead of a name. Null
   *  when a preset (or nothing) was used. */
  systemId: string | null;
  /** Chronicle backing this take — needed to actually forget it. */
  rowId: number | null;
};

export type Project = {
  name: string; purpose: string; status: 'draft' | 'done'; html?: string; ts?: number;
  path?: string; features?: string[]; lane?: Lane;
  /** Stable id shared by every version of the same document. Absent on rows
   *  written before versioning — those stay single-version projects. */
  docId?: string;
  versions?: DocVersion[];
  /** Every chronicle that makes up this project row (all its versions). */
  rowIds?: number[];
};

/** Clipboard copy resilient to the sandboxed-iframe Clipboard API denial —
 *  same pattern as the host's utils/clipboard.ts: async API first, then a
 *  textarea + execCommand('copy') fallback inside the click gesture. Returns
 *  REAL success — callers must gate their 'Copié !' feedback on it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Async API denied in the sandboxed iframe — fall through to execCommand.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    console.warn('[clipboard] copy failed:', err);
    return false;
  }
}

/** Style · engine · cost suffix shared by BOTH version-history tooltips (the
 *  dashboard's history rows and the done screen's version chips). They drifted
 *  apart once already — one said "style auto" where the other said nothing —
 *  so the shared part lives here and each caller only appends what is unique
 *  to it. Style names are product nouns (Design Studio presets), never
 *  translated; only the surrounding labels are. */
export function versionTail(
  v: { style: string | null; tier: string | null; cost: GenCost },
  styleName: string | null,
  t: T,
  lang: string,
): string {
  const style = styleName ? ` · ${t('doc.styleTag', { name: styleName })}` : ` · ${t('doc.styleAutoTag')}`;
  const tier = v.tier ? ` · ${t('doc.tierTag', { tier: v.tier })}` : '';
  const cost = v.cost ? ` · ${formatCost(v.cost, t, lang)}` : '';
  return `${style}${tier}${cost}`;
}
