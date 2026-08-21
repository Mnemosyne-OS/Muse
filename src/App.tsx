import { useEffect, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import {
  buildDocTree, copyText, extractHtml, isHostTimeout,
  joinPath, memLabelUI, mermaidLiveUrl, parseCost, parseDocImages, parseGrounding, parseMemSource,
  type DocEntry, type DocVersion, type GenCost, type Grounding, type DocImage, type Installable, type Project,
  renderMsg, type Localized,
} from './appLogic';
import { setPromptLanguage, languageSystemPrompt, buildAppSpec, buildArtifactPrompt, buildBrief, buildDesignTokens, buildDocPlanPrompt, buildDocRenderPrompt, buildDocStyleBlock, buildDocDesignBlock, resolveDesignMix, buildFramingPrompt, buildHandoffPrompt, buildVerityFixPrompt, isImageFile, memoryLabel, memoryMode, memoryScope, orderVaultsForDisplay, prettyVaultName, replaceImagePlaceholders, homeFromPath, odScheme, OD_CATALOG_ID, OD_CATALOG_URL, OD_SYSTEMS_DIR, OD_EXPECTED_SYSTEMS, MCP_TARGETS, mergeMcpConfig, parseFramingReply, parseLibraryIndex, slugify, upsertCatalog, upsertLibrary, type ArtifactKind, type ChatMsg, type DocFormat, type FramingBrief, type Harmony, type Lane, type McpIde, type MemorySource, type OdSystem, type DesignMix, type DesignRole, type FontRole, EMPTY_MIX, type RefLibrary } from './handoff';
import { DesignStudio, STYLE_PRESETS } from './DesignStudio';
import { TruthStudio } from './TruthStudio';
import { DocStudio } from './DocStudio';
import type { DocBuild, DocBlock, DocOutline } from './handoff';
import { useI18n, dateLocale } from './i18n/useI18n';
import { GBan, GCheck, GClose, GDoc, GFolder, GGlobe, GLock, GMemory, GPuzzle, GSliders, GSpark, GTrash } from './Glyphs';
import { Footer, KEYFRAMES, Logo, RepoCard, S, SideLogo, useEscape } from './Chrome';
import { GeneratingScreen, IntroScreen, NameScreen, ReadyScreen } from './screens/SimpleScreens';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DocsScreen } from './screens/DocsScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { BriefScreen } from './screens/BriefScreen';
import { HandoffScreen } from './screens/HandoffScreen';
import { DoneScreen } from './screens/DoneScreen';
import manifest from '../mnemo-plugin.json';
import { invokeHost, openExternal, sdk, sleep, waitForClone } from './lib/host';
import { loadOdSystem, readOdSystems } from './lib/odFiles';
import { useVerity } from './hooks/useVerity';

const SPINE = 'USER_APP_V2';
const META = 'MUSE_META';   // cartridge settings (e.g. onboarding done)
const FRAMING_SPINE = 'MUSE_FRAMING'; // framing-chat checkpoints (crash-safe resume)
// My design: the GLOBAL default every creation starts from. Latest row wins,
// like META — a preference is a single current value, not a history.
const DESIGN_SPINE = 'MUSE_DESIGN';
// Advanced document builder checkpoints (plan + blocks) — latest row wins,
// like the framing chat: a crash never loses an evening's plan.
const DOCBUILD_SPINE = 'MUSE_DOCBUILD';
const MUSE_VERSION = manifest.version; // single source = the official cartridge manifest
const REPO = 'https://github.com/Mnemosyne-OS/Mnemosyne-Neural-OS';

// Everything cohabits in the ONE app-space folder picked at onboarding:
// the user's own apps, the official repo (code + examples) and the sample
// cartridges below. Each is cloned via the host `app.clone` action, whose
// main-side handler enforces home-scoped dest + https github.com only.
// `desc` is looked up as t(`install.desc.${id}`) at render time — this array
// is module-level, outside the component's useI18n() closure.
const INSTALLABLES: Installable[] = [
  { id: 'neural-os', icon: '🧠', name: 'Mnemosyne Neural OS', repo: REPO, dir: 'Mnemosyne-Neural-OS' },
  { id: 'reader', icon: '📚', name: 'MnemoReader', repo: 'https://github.com/Mnemosyne-OS/MnemoReader---MnemosyneOS', dir: 'MnemoReader' },
  { id: 'resto', icon: '🍽️', name: 'MnemoResto', repo: 'https://github.com/Mnemosyne-OS/MnemoResto---MnemosyneOS', dir: 'MnemoResto' },
  { id: 'archipel', icon: '🏝️', name: 'L’Archipel CRM', repo: 'https://github.com/Mnemosyne-OS/MnemoArchipel---Mnemosyne-OS', dir: 'MnemoArchipel' },
];

type View = 'intro' | 'onboarding' | 'ready' | 'dashboard' | 'brief' | 'handoff' | 'design' | 'verify' | 'name' | 'docstudio' | 'generating' | 'done' | 'docs';
type FramingSave = { idea: string; chat: ChatMsg[]; brief: FramingBrief | null; done: boolean; ts: number };
/** One generated take of a document — regenerating adds a version, it never
 *  replaces and never spawns a second history row. */
/** How much writing room each format needs, relative to the tier's budget.
 *  Measured against the real failure mode: a deck or a long piece cut off
 *  mid-section reads as a bug, not as brevity. */
const FORMAT_BUDGET: Record<DocFormat, number> = { page: 1, long: 1.7, slides: 1.3 };
// DocVersion and Project now live in appLogic.ts (DashboardScreen needs them too).

// Intent-router mode chips (doc 64 §7sexies): Auto routes, the human can force.
const MODES: Array<{ id: 'auto' | Lane; Icon: (p: { size?: number }) => JSX.Element; key: string }> = [
  { id: 'auto', Icon: GSpark, key: 'dash.modeAuto' },
  { id: 'doc', Icon: GDoc, key: 'dash.modeDoc' },
  { id: 'site', Icon: GGlobe, key: 'dash.modeSite' },
  { id: 'cartridge', Icon: GPuzzle, key: 'dash.modeApp' },
];
/** Lane pictogram, reused by the history rows and the board header. */
const LANE_ICON: Record<Lane, (p: { size?: number }) => JSX.Element> = { doc: GDoc, site: GGlobe, cartridge: GPuzzle };
// Looked up as t(`lane.badge.${lane}`) at render time — module-level, outside
// the component's useI18n() closure.

/** Vault families, in the host's own display order (VaultWidget / Settings →
 *  Vaults) so the memory picker reads like the rest of Mnemosyne OS. */
const VAULT_TYPES = ['DEV', 'PERSONAL', 'RESEARCH', 'SOCIAL', 'CREATIVE', 'DREAM', 'CUSTOM'];
const VAULT_TINT: Record<string, string> = {
  DEV: 'color-mix(in srgb, var(--mu-accent) 100%, transparent)', PERSONAL: 'rgba(52,199,190,1)', RESEARCH: 'rgba(175,82,222,1)',
  SOCIAL: 'rgba(48,209,88,1)', CREATIVE: 'rgba(255,159,10,1)', DREAM: 'rgba(139,92,246,1)',
  CUSTOM: 'rgba(142,142,147,1)',
};
/** The slice of the host's vault manifest Muse needs (vault.scanTree nodes). */
type VaultManifestLite = {
  id: string; displayName: string; type: string;
  permissions?: { protection?: string };
  appSandbox?: unknown;
};
type VaultTreeNode = { manifest: VaultManifestLite; children?: VaultTreeNode[] };
type MemVault = { vaultId: string; displayName: string; chronicleCount: number | null; type: string; locked: boolean };

// Project-board phases (mini-Gantt): projectPhases() lives in appLogic.ts
// (pure, tested); PHASE_ICON/PHASE_DOT/ARTIFACTS live in
// ./screens/HandoffScreen.tsx, the only place that uses them.

// Style presets + FX options + the studio UI live in ./DesignStudio.tsx.
// The Muse mark's own constellation/gear data lives in ./Chrome.tsx, next to
// the Logo component that's the only thing using it. IDES (the editor list)
// lives in ./screens/OnboardingScreen.tsx, the only place it's used.

/** Muse's single component — deliberately not split (yet). Navigation is one
 *  `view` state machine (see the `View` type above: intro → onboarding →
 *  dashboard → brief → handoff → done, plus docs/design/verify side screens),
 *  rendered as one big `{view === 'x' && (...)}` chain near the bottom of
 *  this function. State and handlers are grouped by the feature they serve
 *  (framing chat, document generation, the project board, the doc library,
 *  installables) roughly in the order their UI appears. Each handler has its
 *  own doc comment — start there rather than reading top to bottom. */
export default function App() {
  const { t, lang } = useI18n();   // language follows Mnemosyne OS (?lang + MNEMO_CONFIG_UPDATE)
  // The prompts keep their English core (agents follow English best) but must
  // ANSWER in the user's language — keep that directive in sync with the shell.
  setPromptLanguage(lang);
  const [view, setView] = useState<View>('intro');
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [vault, setVault] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [appHtml, setAppHtml] = useState('');
  const [doneFrom, setDoneFrom] = useState<'new' | 'history'>('new'); // 'new' = just generated (celebratory copy)
  // The KEY, not the sentence — see Localized in appLogic.ts. `''` stays
  // the empty value so every `{error && …}` guard reads the same.
  const [error, setError] = useState<Localized>('');
  // True ONLY when the sandbox boot failed — the shared `error` banner then
  // grows a retry button. Feature errors (design save, artifacts…) must not:
  // retrying THEM through a boot re-run would be a lie.
  const [bootFailed, setBootFailed] = useState(false);

  // Guided creation (the real flow: framing chat -> scaffold -> IDE hand-off)
  const [mode, setMode] = useState<'auto' | Lane>('auto'); // router chip on the dashboard
  // Memory source picked on the dashboard: null = federated over every vault.
  const [memVaults, setMemVaults] = useState<MemVault[]>([]);
  const [memVault, setMemVault] = useState<MemorySource>({ mode: 'all', vaults: [] });
  const [memPanel, setMemPanel] = useState(false); // sliding vault picker
  const [memFolded, setMemFolded] = useState<Set<string>>(new Set());
  // [MEMORY-SCOPE] The picked memory must reach EVERY inference, not only the
  // document lane. Derived once here so a new call site cannot silently fall
  // back to "the whole memory" — which is exactly what the framing chat, the
  // design agent, the truth pass and the artifact generator were all doing:
  // the picker was honoured in one place out of five.
  //  none = no retrieval at all | pick = those vaults | all = federated (no field)
  const memMode = memoryMode(memVault);
  const memScope = memoryScope(memVault);
  // The retrieval vector must come from the INTENT, never from the prompt: the
  // host embeds `ragQuery` when present and falls back to `prompt` otherwise,
  // and these prompts are walls of instructions and inlined sources that drown
  // the topic. Every scoped call carries one.
  const projectRagQuery = `${name} — ${purpose}`;
  // [GROUNDING] What the LAST inference actually retrieved. A scope that
  // resolves to nothing comes back as zero chronicles and no error (the host
  // drops the per-vault error the core reports), so an unreachable vault used
  // to look exactly like an empty memory. This is the missing proof.
  const [grounding, setGrounding] = useState<Grounding | null>(null);

  /** Records what a `model.infer` reply was grounded on. Call it on EVERY
   *  reply — "nothing was retrieved" is a result too, and the one worth
   *  showing. `ragSources` is absent when the host injected no memory. */
  const noteGrounding = (res: unknown, mode: 'none' | 'all' | 'pick' = memMode): Grounding => {
    const raw = (res as { ragSources?: Array<{ vault?: string }> } | null)?.ragSources;
    const list = Array.isArray(raw) ? raw : [];
    const names = [...new Set(list.map((s) => String(s?.vault ?? '')).filter(Boolean))];
    const vaults = orderVaultsForDisplay(names).map(prettyVaultName);
    const info: Grounding = { count: list.length, vaults, mode };
    setGrounding(info);
    return info;
  };

  /** [GROUNDING] Proof of what the last inference leaned on. Rendered in BOTH
   *  places an inference can be triggered from — the dashboard and the framing
   *  chat — because a badge the user cannot see proves nothing.
   *  Federated runs hit ~20 vaults: naming them all wrapped the badge over
   *  three lines and pushed the dashboard down, so the line stays one line —
   *  the leading vaults, a "+n" for the tail, and the full list on hover. */
  const GROUND_NAMED = 3;
  const groundVaults = grounding
    ? grounding.vaults.length > GROUND_NAMED
      ? `${grounding.vaults.slice(0, GROUND_NAMED).join(' · ')} +${grounding.vaults.length - GROUND_NAMED}`
      : grounding.vaults.join(' · ')
    : '';
  const groundingBadge = grounding ? (
    <span
      style={{ ...S.memGround, ...(grounding.mode !== 'none' && grounding.count === 0 ? S.memGroundWarn : {}) }}
      title={grounding.vaults.join(' · ')}
    >
      {grounding.mode === 'none'
        ? <><GBan size={11} />{t('mem.groundOff')}</>
        : grounding.count > 0
          ? <><GCheck size={11} /><span style={S.memGroundText}>{t('mem.groundOk', { n: grounding.count, vaults: groundVaults || '—' })}</span></>
          : <><GBan size={11} />{t('mem.groundNone')}</>}
    </span>
  ) : null;
  // Document style: a Design-Studio preset id, or null = let the model choose.
  const [docStyle, setDocStyle] = useState<string | null>(null);
  // A document has ONE design: an Open Design system OR a preset, never both.
  // Picking one clears the other explicitly rather than letting the render
  // prompt carry two contradictory style blocks.
  const [docSystem, setDocSystem] = useState<OdSystem | null>(null);
  /** Id of a system a reopened document was rendered with but that can no
   *  longer be read (catalogue deleted or truncated). Shown as such. */
  const [docSystemMissing, setDocSystemMissing] = useState<string | null>(null);
  /** Which creation the design studio is currently serving. The doc lane never
   *  reaches the project board, so it needs its own way in — and its own way
   *  back, since it can be opened from the brief or from the finished doc. */
  const [designFor, setDesignFor] = useState<'project' | 'doc' | 'pref'>('project');
  const [designBack, setDesignBack] = useState<'brief' | 'done'>('brief');

  /** Open the studio to choose a design system for a DOCUMENT. */
  const pickDocSystem = (from: 'brief' | 'done') => {
    setDesignBack(from);
    setDesignFor('doc');
    setView('design');
  };

  /** Preset and system are one choice, not two: picking a preset (including
   *  "auto", i.e. none) drops the system instead of leaving both on record. */
  const pickDocStyle = (id: string | null) => {
    setDocStyle(id);
    setDocSystem(null);
    setDocSystemMissing(null);
  };
  // Version history of the document currently on screen (newest first).
  const [curDocId, setCurDocId] = useState('');
  const [curVersion, setCurVersion] = useState(1);
  const [docVersions, setDocVersions] = useState<DocVersion[]>([]);
  const [regenOpen, setRegenOpen] = useState(false);
  // Document model tier — the doc lane was the only step with no choice, so a
  // weak default model was silently deciding how good the page could be.
  const [docTier, setDocTier] = useState<'eco' | 'standard' | 'max'>('standard');
  // Shape and visuals — a document was only ever a style and a model tier.
  const [docFormat, setDocFormat] = useState<DocFormat>('page');
  const [docSvg, setDocSvg] = useState(false);
  /** Images found in a folder the user explicitly picked, and the subset
   *  chosen for the next take. NEVER defaults to the whole app space: that
   *  folder also holds the cloned installables (Mnemosyne-Neural-OS,
   *  MnemoReader…) and any imported design-reference kit — their own
   *  screenshots and icons, not the user's pictures, and the same generic
   *  set for every Muse user. Scanning it by default put "founders-console
   *  screenshot" and "neural-map.jpg" in front of someone writing a personal
   *  document. `null` = nothing picked yet; the picker asks, it never guesses. */
  const [imgSourceDir, setImgSourceDir] = useState<string | null>(null);
  const [spaceImages, setSpaceImages] = useState<DocImage[]>([]);
  const [docImages, setDocImages] = useState<DocImage[]>([]);
  const [imgPanel, setImgPanel] = useState(false);
  const [imgScan, setImgScan] = useState<'idle' | 'scanning' | 'done'>('idle');
  /** Images belonging to the take ON SCREEN — not the same list as the pick
   *  for the NEXT one, which is why they are separate states. */
  const [takeImages, setTakeImages] = useState<DocImage[]>([]);
  /** Latest advanced-builder checkpoint from the vault (resume offer). */
  const [savedBuild, setSavedBuild] = useState<DocBuild | null>(null);
  /** Latest checkpoint PER document — the way BACK into the studio after a
   *  save (Tony: "une fois que c'est généré je veux pouvoir y revenir"). */
  const [savedBuilds, setSavedBuilds] = useState<Record<string, DocBuild>>({});
  /** The build the studio opens with (done screen → studio); null = fresh. */
  const [studioSeed, setStudioSeed] = useState<DocBuild | null>(null);
  /** Credits spent across THIS studio session's per-block calls — summed, so
   *  the saved take carries what the whole construction really cost. */
  const advSpend = useRef({ usd: 0 });
  const [appHtmlView, setAppHtmlView] = useState('');
  /** Data-URI cache keyed by path: switching versions must not re-read the
   *  same photo, and a multi-megabyte file crossing the bridge is not free. */
  const imgCache = useRef<Map<string, string>>(new Map());
  const [genStage, setGenStage] = useState<'plan' | 'render'>('render');
  const [lane, setLane] = useState<Lane>('cartridge');     // effective lane once framed
  const [feats, setFeats] = useState<string[]>(['', '', '']);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [appDir, setAppDir] = useState('');
  const [scaffolding, setScaffolding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [boardStep, setBoardStep] = useState('handoff'); // selected phase on the project board

  // Project files panel — the PROOF of every action, always visible on the
  // board. Rescanned after each tool completes (projScanTick bumps).
  const [projFiles, setProjFiles] = useState<Array<{ rel: string; path: string }>>([]);
  const [builtEntry, setBuiltEntry] = useState<{ rel: string; path: string } | null>(null);
  const [projScanTick, setProjScanTick] = useState(0);
  /** Triggers a re-scan of the project's file tree (the "proof" panel and
   *  the Gantt's disk-derived phase statuses) — call after any action that
   *  writes into the project folder. */
  const bumpProjScan = () => setProjScanTick((t) => t + 1);

  /** '▶ Voir mon app': render the built v0 inside Muse. Vite bundles use
   *  relative asset paths that break under iframe srcDoc, so the local
   *  ./assets js/css files are read and inlined first (deterministic). */
  const viewBuiltApp = async () => {
    if (!builtEntry) return;
    setError('');
    try {
      const r = await invokeHost<{ success?: boolean; content?: string; error?: string }>('dialog.readFile', { filePath: builtEntry.path });
      if (!r?.success || typeof r.content !== 'string') throw new Error(r?.error || 'index.html illisible');
      let html = r.content;
      const baseDir = builtEntry.path.replace(/[\\/][^\\/]*$/, '');
      const ASSET_RE = /<script[^>]*\ssrc=["'](\.?\/?assets\/[^"']+)["'][^>]*><\/script>|<link[^>]*\shref=["'](\.?\/?assets\/[^"']+)["'][^>]*\/?>/gi;
      const jobs: Array<{ tag: string; rel: string; kind: 'js' | 'css' }> = [];
      for (const m of html.matchAll(ASSET_RE)) {
        const rel = (m[1] || m[2] || '').replace(/^\.?\//, '');
        if (!rel || jobs.length >= 6) continue;
        jobs.push({ tag: m[0], rel, kind: m[1] ? 'js' : 'css' });
      }
      let budget = 2_000_000;
      for (const job of jobs) {
        if (budget <= 0) break;
        const assetPath = job.rel.split('/').reduce((acc, seg) => joinPath(acc, seg), baseDir);
        try {
          const a = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: assetPath });
          if (!a?.success || typeof a.content !== 'string') continue;
          budget -= a.content.length;
          const safe = a.content.replace(/<\/script/gi, '<\\/script');
          // Replacement MUST be a function: minified bundles are full of '$',
          // and string replacements treat $&/$'/$$ as special patterns —
          // that corrupts the document (raw JS rendered as page text).
          html = html.replace(job.tag, () => (job.kind === 'js' ? `<script type="module">${safe}</script>` : `<style>${a.content}</style>`));
        } catch { /* missing asset — leave the tag, the preview degrades gracefully */ }
      }
      setArtView({ title: `▶ ${name || t('verity.yourAppFallback')} — v0`, content: html, mermaids: [], kind: 'html' });
    } catch (err) {
      setError({ key: 'err.previewFailed', vars: { error: (err as Error).message, file: builtEntry.rel } });
    }
  };

  useEffect(() => {
    if (view !== 'handoff' || !appDir) return;
    let alive = true;
    (async () => {
      type DirFile = { name: string; isDirectory: boolean; path: string };
      const out: Array<{ rel: string; path: string }> = [];
      const walk = async (dir: string, rel: string, depth: number) => {
        if (out.length >= 200) return;
        let r: { success?: boolean; files?: DirFile[] } | null = null;
        try { r = await invokeHost<{ success?: boolean; files?: DirFile[] }>('dialog.readDir', { dirPath: dir }); } catch { return; }
        if (!r?.success || !Array.isArray(r.files)) return;
        for (const f of r.files) {
          if (out.length >= 200) return;
          const childRel = rel ? `${rel}/${f.name}` : f.name;
          if (f.isDirectory) {
            if (depth < 3 && !/^(node_modules|\.git|dist|build)$/i.test(f.name)) await walk(f.path, childRel, depth + 1);
          } else {
            out.push({ rel: childRel, path: f.path });
          }
        }
      };
      await walk(appDir, '', 0);
      out.sort((a, b) => a.rel.localeCompare(b.rel));
      // Built-app detection: the walk skips dist/ (bundle noise), so probe it
      // directly. Root index.html counts too (site lane, no build step).
      let entry: { rel: string; path: string } | null = null;
      try {
        const distDir = joinPath(appDir, 'dist');
        const r = await invokeHost<{ success?: boolean; files?: DirFile[] }>('dialog.readDir', { dirPath: distDir });
        const hit = r?.success && Array.isArray(r.files) ? r.files.find((f) => !f.isDirectory && f.name.toLowerCase() === 'index.html') : undefined;
        if (hit) entry = { rel: 'dist/index.html', path: hit.path };
      } catch { /* no dist folder yet */ }
      if (!entry) {
        const rootHtml = out.find((f) => f.rel.toLowerCase() === 'index.html');
        if (rootHtml) entry = { rel: rootHtml.rel, path: rootHtml.path };
      }
      if (alive) {
        setProjFiles(out);
        setBuiltEntry(entry);
      }
      // Restore the memory this project was framed on — app-spec.json is the
      // contract on disk. Without this, reopening a draft would quietly hand
      // the IDE a prompt saying "toute ma mémoire" while BRIEF.md says a vault.
      if (out.some((f) => f.rel === 'app-spec.json')) {
        try {
          const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: joinPath(appDir, 'app-spec.json') });
          if (alive && r?.success && typeof r.content === 'string') {
            // Two shapes on disk: the current { mode, vaults[] } and the older
            // single { vaultId, displayName } written before mixing existed.
            const spec = JSON.parse(r.content) as {
              memory?: null | { vaultId?: string; displayName?: string; mode?: string; vaults?: Array<{ vaultId?: string; displayName?: string }> };
            };
            const m = spec.memory;
            const clean = (list: Array<{ vaultId?: string; displayName?: string }> | undefined) =>
              (list ?? []).filter((v): v is { vaultId: string; displayName?: string } => typeof v?.vaultId === 'string')
                .map((v) => ({ vaultId: v.vaultId, displayName: v.displayName || v.vaultId }));
            if (m?.mode === 'none') setMemVault({ mode: 'none', vaults: [] });
            else if (m?.mode === 'pick') {
              const picked = clean(m.vaults);
              setMemVault(picked.length ? { mode: 'pick', vaults: picked } : { mode: 'all', vaults: [] });
            } else if (m?.vaultId) setMemVault({ mode: 'pick', vaults: [{ vaultId: m.vaultId, displayName: m.displayName || m.vaultId }] });
            // Legacy specs wrote `memory: null` to mean federated — an explicit
            // contract, so it still wins.
            else if ('memory' in spec && spec.memory === null) setMemVault({ mode: 'all', vaults: [] });
            // Anything else (key absent, shape unrecognized) is NOT a contract:
            // leave the picker alone. This scan re-runs on every bumpProjScan()
            // — after a scaffold, a design pass, an artifact — so forcing 'all'
            // here silently reset a pick the user had just made, and the run
            // went federated. That was the "it used my whole memory" bug.
            else if (m) console.warn('app-spec.json: unrecognized memory shape, keeping the current selection');
          }
        } catch (err) {
          console.warn('app-spec.json memory restore failed:', err);
        }
      }
    })();
    return () => { alive = false; };
  }, [view, appDir, projScanTick]);

  // MCP preflight: connect the user's IDE to the memory (project-level config)
  const [mcpIde, setMcpIde] = useState<McpIde>('claude-code');
  const [mcpState, setMcpState] = useState<'idle' | 'writing' | 'done' | 'error'>('idle');
  const [mcpMsg, setMcpMsg] = useState<Localized>('');

  /** 'Configurer pour moi': read the project-level MCP config, merge the
   *  mnemosyne server in (never clobbers other servers), write it back.
   *  Everything stays home-scoped — no new IPC needed. */
  const autoConfigureMcp = async () => {
    const target = MCP_TARGETS[mcpIde];
    if (!appDir || mcpState === 'writing') return;
    setMcpState('writing');
    setMcpMsg('');
    try {
      // Project configs live in the app folder; home configs (Antigravity)
      // under the user profile — derived from the (host-guaranteed
      // home-scoped) app space path.
      let base = appDir;
      if (target.scope === 'home') {
        const home = homeFromPath(folder || appDir);
        if (!home) throw new Error(t('err.homeUnknown'));
        base = home;
      }
      const parts = target.rel.split('/');
      let filePath = base;
      for (let i = 0; i < parts.length - 1; i++) {
        filePath = joinPath(filePath, parts[i]);
        const mk = await invokeHost<{ success?: boolean; error?: string }>('dialog.mkdir', { dirPath: filePath });
        if (!mk?.success) throw new Error(mk?.error || t('err.mkdirFailed'));
      }
      filePath = joinPath(filePath, parts[parts.length - 1]);
      let prev: string | null = null;
      try {
        const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath });
        if (r?.success && typeof r.content === 'string') prev = r.content;
      } catch { /* no existing config — a fresh file will be created */ }
      const merged = mergeMcpConfig(prev, target.rootKey, memVault);
      const w = await invokeHost<{ success?: boolean; error?: string }>('dialog.writeFile', { filePath, content: merged });
      if (!w?.success) throw new Error(w?.error || t('err.writeFailed'));
      setMcpState('done');
      setMcpMsg({ key: 'step.mcpFileWritten', vars: { file: target.rel } });
      if (target.scope === 'project') bumpProjScan();
    } catch (err) {
      console.warn('MCP auto-config failed:', err);
      setMcpState('error');
      setMcpMsg({ key: 'err.mcpAutoFailed', vars: { error: (err as Error).message } });
    }
  };

  // Artifacts step: model tier + per-artifact generation state + in-app viewer
  const [artModel, setArtModel] = useState<'eco' | 'standard' | 'max'>('standard');
  const [artState, setArtState] = useState<Record<string, 'idle' | 'running' | 'done' | 'error'>>({});

  // Design step: color wheel + harmony + page style + effects → design-tokens.json
  const [designHue, setDesignHue] = useState(210);
  const [designHarmony, setDesignHarmony] = useState<Harmony>('analogous');
  const [designStyle, setDesignStyle] = useState<string | null>(null);
  const [designFx, setDesignFx] = useState<Set<string>>(new Set());
  const [designState, setDesignState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  // Import/check state, now serving the Open Design catalogue only.
  const [refState, setRefState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [refMsg, setRefMsg] = useState<Localized>('');

  // Personal design libraries — space-level, reusable across projects
  const [libraries, setLibraries] = useState<RefLibrary[]>([]);

  // Open Design catalogue: 151 normalized systems, read one at a time.
  // `odPreview` is the system currently OPENED in the studio (browsing),
  // `designSystem` the one ATTACHED to the project (writes into the tokens) —
  // two different things, kept apart so looking at a system never silently
  // becomes choosing it.
  const [odPreview, setOdPreview] = useState<OdSystem | null>(null);
  const [designSystem, setDesignSystem] = useState<OdSystem | null>(null);
  const [odState, setOdState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [odMsg, setOdMsg] = useState<Localized>('');
  // Import progress. 'fetch' = git is downloading and reports NOTHING back
  // through the bridge, so there is no percentage to show — only a clock.
  // 'checkout' = folders are landing on disk, which is a real count.
  // Per-role overrides, one set per context. The BASE stays designSystem /
  // docSystem; these are the roles the user took from somewhere else.
  const [projRoles, setProjRoles] = useState<Partial<Record<DesignRole, string>>>({});
  const [docRoles, setDocRoles] = useState<Partial<Record<DesignRole, string>>>({});
  const [projFontRoles, setProjFontRoles] = useState<Partial<Record<FontRole, string>>>({});
  const [docFontRoles, setDocFontRoles] = useState<Partial<Record<FontRole, string>>>({});
  /** Systems already read off disk, by id — a mix references three of them and
   *  re-reading on every render would hammer the bridge. */
  const [odSystems, setOdSystems] = useState<Map<string, OdSystem>>(new Map());
  /** True once the user actually moved the wheel: only then does the manual
   *  hue override a system's authored accent. */
  const [hueTouched, setHueTouched] = useState(false);
  /** The global design preference, edited from the home and inherited by every
   *  creation that has not chosen its own. */
  const [prefMix, setPrefMix] = useState<DesignMix>(EMPTY_MIX);
  const [prefState, setPrefState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [odProgress, setOdProgress] = useState<{ phase: 'fetch' | 'checkout'; count: number } | null>(null);
  const [odElapsed, setOdElapsed] = useState(0);

  // Proof of life while no percentage exists. A frozen counter is not proof
  // that anything is still running, so this clock is driven by the clock, not
  // by the polling loop — it keeps moving even if a poll hangs.
  useEffect(() => {
    if (!odProgress) { setOdElapsed(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setOdElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [odProgress === null]);



  /* Truth pass — layer 1 heuristics (free) + layer 2 adversarial agent.
   * Its state and its two entry points live in ./hooks/useVerity.ts; what it
   * needs from here is listed explicitly rather than reached for. */
  const verity = useVerity({
    appDir, projFiles, name, purpose, feats, lane,
    projectRagQuery, memScope, noteGrounding, bumpProjScan, setError, t, lang,
  });

  /** Import the Open Design catalogue as a library. Unlike a design kit, we do
   *  NOT walk it: `design-systems/` alone holds 4 000+ files, which would eat
   *  the 800-file budget and index nothing useful. We record the system NAMES
   *  (one readDir) and read a system's three files only when it is opened. */
  const importOdCatalog = async () => {
    if (refState === 'working') return;
    if (!folder) { setRefState('error'); setRefMsg({ key: 'ref.needSpace' }); return; }
    setRefState('working');
    setRefMsg({ key: 'od.cloning' });
    setOdProgress({ phase: 'fetch', count: 0 });
    try {
      const refsDir = joinPath(folder, 'design-refs');
      const dest = joinPath(refsDir, OD_CATALOG_ID);
      await invokeHost('dialog.mkdir', { dirPath: refsDir });
      try {
        const res = await invokeHost<{ success?: boolean; error?: string }>('app.clone', { repo: OD_CATALOG_URL, dest });
        if (!res?.success && !(res?.error || '').includes('already exists')) throw new Error(res?.error || t('err.actionRefused'));
      } catch (err) {
        if (!isHostTimeout(err)) throw err;
        // ~300 MB of working tree: the bridge reply always times out well
        // before the host's 180s allowance runs out. The clone continues, so
        // this is not an error — the disk below is the source of truth.
        setRefMsg({ key: 'od.bigRepoWait' });
      }
      // Poll design-systems/ itself rather than the clone signal: the repo root
      // stabilizes long before a shallow checkout has written the leaves. Each
      // folder counted here is one that really exists on disk — that is the
      // only progress figure this path can honestly produce.
      const sysDir = joinPath(dest, OD_SYSTEMS_DIR);
      let systems: string[] = [];
      let prev = -1;
      let stable = 0;
      for (let i = 0; i < 90; i++) { // ~4.5 min — the host kills git at 180 s
        const names = await readOdSystems(sysDir);
        systems = names;
        if (names.length) {
          setOdProgress({ phase: 'checkout', count: names.length });
          setRefMsg({ key: 'od.indexing' });
        }
        if (names.length && names.length === prev) {
          stable++;
          if (stable >= 2) break;
        } else {
          stable = 0;
        }
        prev = names.length;
        await sleep(3000);
      }
      if (!systems.length) throw new Error(t('od.noSystems'));
      const lib: RefLibrary = {
        id: OD_CATALOG_ID, gitUrl: OD_CATALOG_URL, path: dest,
        importedAt: new Date().toISOString(),
        files: systems.length,
        kind: 'od-catalog', systems: systems.sort(),
      };
      try {
        const idxPath = joinPath(refsDir, 'LIBRARY.json');
        let prevIdx: string | null = null;
        try {
          const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: idxPath });
          if (r?.success && typeof r.content === 'string') prevIdx = r.content;
        } catch { /* first library */ }
        await invokeHost('dialog.writeFile', { filePath: idxPath, content: upsertLibrary(prevIdx, lib) });
      } catch (err) { console.warn('LIBRARY.json update failed:', err); }
      setLibraries((prev) => [...prev.filter((l) => l.id !== lib.id), lib]);
      setRefState('done');
      // The host kills git at 180 s. On a slow link a ~300 MB clone dies
      // mid-checkout and leaves a REAL but truncated tree — which would
      // otherwise be announced as the whole catalogue. What we indexed is
      // usable, so it is kept; it just must not claim to be complete.
      const partial = systems.length < Math.round(OD_EXPECTED_SYSTEMS * 0.6);
      setRefMsg(partial
        ? { key: 'od.importedPartial', vars: { n: systems.length, total: OD_EXPECTED_SYSTEMS } }
        : { key: 'od.imported', vars: { n: systems.length } });
    } catch (err) {
      console.warn('Open Design catalogue import failed:', err);
      setRefState('error');
      setRefMsg({ key: 'ref.importFailed', vars: { error: (err as Error).message } });
    } finally {
      setOdProgress(null); // the bar must never outlive the work it describes
    }
  };

  /** Re-count the catalogue on disk. The stored count is a memory of an older
   *  import; this is the only truthful answer to "is it complete?", and it
   *  refreshes LIBRARY.json so the number shown is never stale. */
  const checkOdCatalog = async () => {
    const lib = libraries.find((l) => l.id === OD_CATALOG_ID);
    if (!lib || refState === 'working') return;
    setRefState('working');
    setRefMsg({ key: 'od.checking' });
    try {
      const names = (await readOdSystems(joinPath(lib.path, OD_SYSTEMS_DIR))).sort();
      if (!names.length) throw new Error(t('od.noSystems'));
      const next: RefLibrary = { ...lib, files: names.length, systems: names };
      try {
        const idxPath = joinPath(joinPath(folder, 'design-refs'), 'LIBRARY.json');
        let prevIdx: string | null = null;
        try {
          const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: idxPath });
          if (r?.success && typeof r.content === 'string') prevIdx = r.content;
        } catch { /* index will be rebuilt */ }
        await invokeHost('dialog.writeFile', { filePath: idxPath, content: upsertLibrary(prevIdx, next) });
      } catch (err) { console.warn('LIBRARY.json refresh failed:', err); }
      setLibraries((prev) => prev.map((l) => (l.id === lib.id ? next : l)));
      const partial = names.length < Math.round(OD_EXPECTED_SYSTEMS * 0.6);
      setRefState('done');
      setRefMsg(partial
        ? { key: 'od.checkPartial', vars: { n: names.length, total: OD_EXPECTED_SYSTEMS } }
        : { key: 'od.checkComplete', vars: { n: names.length } });
    } catch (err) {
      console.warn('Open Design catalogue check failed:', err);
      setRefState('error');
      setRefMsg((err as Error).message);
    }
  };

  /** Reveal the catalogue folder in the OS explorer. There is no "open folder"
   *  action (dialog:openInOS is extension-whitelisted), so a known file inside
   *  it is revealed instead — the explorer opens ON the folder either way. */
  const openOdFolder = async () => {
    const lib = libraries.find((l) => l.id === OD_CATALOG_ID);
    if (!lib) return;
    try {
      const r = await invokeHost<{ success?: boolean; error?: string }>(
        'dialog.openInOS', { filePath: joinPath(lib.path, 'README.md') });
      if (!r?.success) throw new Error(r?.error || t('err.actionRefused'));
    } catch (err) {
      console.warn('openInOS failed:', err);
      setRefState('error');
      setRefMsg((err as Error).message);
    }
  };

  /** Open ONE system in the studio. Lazy by design: 151 systems × 7 files at
   *  import time would be a thousand bridge round-trips for data the user may
   *  never look at. */
  const openOdSystem = async (id: string) => {
    const lib = libraries.find((l) => l.id === OD_CATALOG_ID);
    if (!lib) return;
    setOdState('loading');
    setOdMsg('');
    setOdPreview(null);
    try {
      const sys = await loadOdSystem(lib.path, id);
      if (!sys) throw new Error(t('od.unreadable'));
      setOdPreview(sys);
      setOdState('idle');
    } catch (err) {
      console.warn('Open Design system read failed:', err);
      setOdState('error');
      setOdMsg((err as Error).message);
    }
  };

  /** Restore the system a saved document was rendered with. Only its id was
   *  persisted, so the design is re-read from the catalogue — a name alone
   *  could not be replayed, and regenerating would silently fall back to
   *  whatever the picker held. When the catalogue is gone the id is kept on
   *  screen as MISSING instead of disappearing, which would look like the
   *  document never had a design. */
  const restoreDocSystem = async (id: string) => {
    const lib = libraries.find((l) => l.id === OD_CATALOG_ID);
    const sys = lib ? await loadOdSystem(lib.path, id) : null;
    if (sys) { setDocSystem(sys); setDocSystemMissing(null); }
    else { setDocSystem(null); setDocSystemMissing(id); }
  };

  // The mix the studio is currently editing, and what it resolves to. Derived,
  // never stored resolved: the systems are re-read from disk, so a catalogue
  // that changed is reflected instead of a frozen copy.
  const ownMix: DesignMix = {
    base: (designFor === 'doc' ? docSystem : designSystem)?.id ?? null,
    roles: designFor === 'doc' ? docRoles : projRoles,
    hue: hueTouched ? designHue : null,
    effects: [...designFx],
    fontRoles: designFor === 'doc' ? docFontRoles : projFontRoles,
  };
  const mixIsSet = (m: DesignMix) => !!m.base || Object.keys(m.roles).length > 0 || Object.keys(m.fontRoles ?? {}).length > 0;
  /** True when this creation is showing the global default rather than a
   *  design of its own — the studio says so, because a preference silently
   *  standing in for a choice is the same lie as a stale label. */
  const inheritingPref = designFor !== 'pref' && !mixIsSet(ownMix) && mixIsSet(prefMix);
  const designMix: DesignMix = designFor === 'pref'
    ? prefMix
    : inheritingPref
      ? { ...prefMix, hue: ownMix.hue ?? prefMix.hue, effects: ownMix.effects.length ? ownMix.effects : prefMix.effects }
      : ownMix;
  const designResolved = resolveDesignMix(designMix, odSystems);

  // Load the systems the saved preference points at. Without this a default
  // restored from the vault would resolve to nothing in a fresh session and
  // silently do nothing — a preference that exists but never applies.
/** Ids whose load came back null — a system folder deleted or truncated under
   *  a design that still references it. Without this the effect below never
   *  settles: it stores a NEW Map that STILL lacks the id, that new identity is
   *  one of its own dependencies, and it runs again — an endless disk-read loop
   *  on a catalogue the user broke. Reset when the library index changes, so a
   *  re-import gets a fresh try instead of being remembered as broken. */
  const odFailed = useRef<Set<string>>(new Set());
  useEffect(() => { odFailed.current = new Set(); }, [libraries]);

  useEffect(() => {
    const lib = libraries.find((l) => l.id === OD_CATALOG_ID);
    if (!lib) return;
    const ids = [prefMix.base, ...Object.values(prefMix.roles)].filter((x): x is string => !!x);
    const missing = ids.filter((id) => !odSystems.has(id) && !odFailed.current.has(id));
    if (!missing.length) return;
    let cancelled = false;
    void (async () => {
      const loaded = await Promise.all(missing.map((id) => loadOdSystem(lib.path, id)));
      if (cancelled) return;
      loaded.forEach((s, i) => { if (!s) odFailed.current.add(missing[i]); });
      // Nothing loaded = nothing to store. Writing a new Map here would only
      // re-trigger this effect, which is the loop described above.
      if (!loaded.some(Boolean)) return;
      setOdSystems((prev) => {
        const nx = new Map(prev);
        for (const s of loaded) if (s) nx.set(s.id, s);
        return nx;
      });
    })();
    return () => { cancelled = true; };
  }, [prefMix, libraries, odSystems]);

  /** The design a DOCUMENT renders with: its own if it chose one, the global
   *  default otherwise. Same single source as sites and apps. */
  const docOwnMix: DesignMix = { base: docSystem?.id ?? null, roles: docRoles, hue: null, effects: [], fontRoles: docFontRoles };
  const docDesign = resolveDesignMix(mixIsSet(docOwnMix) ? docOwnMix : prefMix, odSystems);

  /** Persist the global design preference. Latest row wins on load. */
  const saveDesignPref = async () => {
    if (prefState === 'saving') return;
    setPrefState('saving');
    try {
      const { vault } = await sdk.ensureSandbox();
      await sdk.socialIngest(vault, JSON.stringify({ designPref: prefMix, ts: Date.now() }), DESIGN_SPINE);
      setPrefState('done');
    } catch (err) {
      console.warn('Design preference save failed:', err);
      setPrefState('error');
      setError([{ key: 'pref.saveFailed' }, (err as Error).message]);
    }
  };

  /** Take ONE role from a system. The system is cached so the mix can resolve
   *  it without another disk read. */
  const assignRole = (role: DesignRole, sys: OdSystem) => {
    setOdSystems((prev) => new Map(prev).set(sys.id, sys));
    if (designFor === 'pref') { setPrefMix((m) => ({ ...m, roles: { ...m.roles, [role]: sys.id } })); setPrefState('idle'); return; }
    const set = designFor === 'doc' ? setDocRoles : setProjRoles;
    set((prev) => ({ ...prev, [role]: sys.id }));
    if (designFor === 'project') setDesignState('idle');
  };

  /** Pick the family for one tag (h1…mono), or clear it back to whatever the
   *  chosen system says. Stored per context, exactly like the other roles. */
  const setFontRole = (role: FontRole, family: string | null) => {
    const apply = (m: DesignMix): DesignMix => {
      const nx = { ...(m.fontRoles ?? {}) };
      if (family) nx[role] = family; else delete nx[role];
      return { ...m, fontRoles: nx };
    };
    if (designFor === 'pref') { setPrefMix(apply); setPrefState('idle'); return; }
    if (designFor === 'doc') { setDocFontRoles((r) => apply({ ...EMPTY_MIX, fontRoles: r }).fontRoles ?? {}); return; }
    setProjFontRoles((r) => apply({ ...EMPTY_MIX, fontRoles: r }).fontRoles ?? {});
    setDesignState('idle');
  };

  const clearRole = (role: DesignRole) => {
    if (designFor === 'pref') { setPrefMix((m) => { const nx = { ...m.roles }; delete nx[role]; return { ...m, roles: nx }; }); setPrefState('idle'); return; }
    const set = designFor === 'doc' ? setDocRoles : setProjRoles;
    set((prev) => { const nx = { ...prev }; delete nx[role]; return nx; });
    if (designFor === 'project') setDesignState('idle');
  };

  /** Writes design-tokens.json (palette + style + effects + any imported
   *  reference or design system) into the project folder. The IDE agent's
   *  prompt tells it to apply these tokens strictly. */
  const saveDesign = async () => {
    if (!appDir || designState === 'saving') return;
    setDesignState('saving');
    setError('');
    try {
      const preset = STYLE_PRESETS.find((p) => p.id === designStyle) ?? null;
      const json = buildDesignTokens({
        hue: designHue, harmony: designHarmony,
        // An attached system carries its own light/dark stance; only fall back
        // to the preset (then dark) when no system is chosen.
        scheme: designSystem ? odScheme(designSystem) : preset?.scheme ?? 'dark',
        styleId: preset?.id ?? null, styleName: preset?.name, styleTraits: preset?.traits,
        effects: [...designFx], museVersion: MUSE_VERSION,
        system: designSystem,
        design: designResolved,
      }, new Date().toISOString());
      const w = await invokeHost<{ success?: boolean; error?: string }>(
        'dialog.writeFile', { filePath: joinPath(appDir, 'design-tokens.json'), content: json });
      if (!w?.success) throw new Error(w?.error || t('err.writeFailed'));
      setDesignState('done');
      bumpProjScan();
    } catch (err) {
      console.warn('Design save failed:', err);
      setDesignState('error');
      setError({ key: 'err.designFailed', vars: { error: (err as Error).message } });
    }
  };
  const [artView, setArtView] = useState<{ title: string; content: string; mermaids: string[]; kind: 'md' | 'html' } | null>(null);

  /** Open a project file in the in-app viewer (Markdown rendered; every
   *  ```mermaid block gets a one-click rendered view on mermaid.live). */
  const viewDoc = async (title: string, filePath: string) => {
    setError('');
    try {
      const res = await invokeHost<{ success?: boolean; content?: string; error?: string }>(
        'dialog.readFile', { filePath });
      if (!res?.success || typeof res.content !== 'string') {
        throw new Error(res?.error || t('err.notFoundGenerateFirst'));
      }
      const isHtml = /\.html?$/i.test(filePath);
      const mermaids = isHtml ? [] : [...res.content.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean);
      // Raw JSON/CSS read as fenced code, HTML renders live, markdown renders
      // rich — anything else (ts, js, config…) shows as a plain code block.
      const fence = /\.json$/i.test(filePath) ? 'json'
        : /\.(css|scss|less)$/i.test(filePath) ? 'css'
        : !isHtml && !/\.(md|markdown)$/i.test(filePath) ? '' : null;
      const content = fence !== null ? `\`\`\`${fence}\n${res.content}\n\`\`\`` : res.content;
      setArtView({ title, content, mermaids, kind: isHtml ? 'html' : 'md' });
    } catch (err) {
      setError({ key: 'err.docViewFailed', vars: { error: (err as Error).message } });
    }
  };

  /** ── Open a Muse project in its OWN Mnemosyne window ───────────────────
   *  A cartridge project IS a real cartridge, so the honest way to run it is
   *  the host's own dev-link: link the folder, then launch it → a separate
   *  Electron window that behaves exactly like an installed cartridge (host
   *  SDK available, reload to see changes). The free tier allows ONE dev link,
   *  so Muse rotates its OWN slot: links it created (inside the Muse space)
   *  are unlinked first — links the user made elsewhere are never touched.
   */
  const [launchMsg, setLaunchMsg] = useState<Localized>('');
  /** Did the last launch SUCCEED? The banner's colour used to be decided by
   *  `launchMsg.startsWith('Ouverture impossible')` — a literal that only ever
   *  matched the French string, so an EN/ES user saw a failed launch rendered
   *  green with a rocket. Outcome is state, not something to re-derive from
   *  translated prose. `null` = nothing launched yet / still running. */
  const [launchOk, setLaunchOk] = useState<boolean | null>(null);
  const [launching, setLaunching] = useState('');
  type DevLink = { path: string; id?: string; valid: boolean; error?: string };

  /** Path equality tolerant of trailing slash and slash direction — Windows
   *  and the host's own path strings mix `/` and `\` freely. */
  const samePath = (a: string, b: string) =>
    a.replace(/[\\/]+$/, '').replace(/\//g, '\\').toLowerCase() === b.replace(/[\\/]+$/, '').replace(/\//g, '\\').toLowerCase();

  /** Opens a cartridge project in its own Mnemosyne window (`plugins.linkDev`
   *  + `plugins.launch`). Preflights the manifest and dist/ build first: the
   *  host serves the project's dist/ directly, so a bad entrypoint or a
   *  missing build would otherwise open a silently blank window. */
  const launchAppWindow = async (dir: string, label: string) => {
    if (!dir || launching) return;
    setLaunching(dir);
    setLaunchMsg({ key: 'board.launchWorking', vars: { name: label } });
    setLaunchOk(null);
    try {
      const manifestPath = joinPath(dir, 'mnemo-plugin.json');
      const mf = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: manifestPath });
      if (!mf?.success || typeof mf.content !== 'string') {
        throw new Error(t('board.notCartridge'));
      }
      // Preflight: the host serves <project>/dist/ first, so a localhost
      // entrypoint or a missing build opens a BLANK window. Say it plainly
      // instead — the fix is one line for the IDE agent.
      try {
        const mfJson = JSON.parse(mf.content) as { entrypoints?: { renderer?: string } };
        const entry = mfJson.entrypoints?.renderer ?? '';
        if (/^https?:\/\//i.test(entry)) {
          throw new Error(t('board.entrypointNotRelative', { entry }));
        }
      } catch (err) {
        if (err instanceof SyntaxError) throw new Error(t('board.manifestUnreadable'));
        throw err;
      }
      const built = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: joinPath(joinPath(dir, 'dist'), 'index.html') });
      if (!built?.success || typeof built.content !== 'string') {
        throw new Error(t('board.noBuildFound'));
      }
      const linked = await invokeHost<{ success?: boolean; data?: DevLink[] }>('plugins.getLinkedDev', {});
      const list = linked?.data ?? [];
      let entry = list.find((l) => samePath(l.path, dir));
      if (!entry) {
        // Free the slot Muse itself owns (other Muse projects), never the user's.
        for (const l of list) {
          if (folder && l.path.toLowerCase().startsWith(folder.toLowerCase()) && !samePath(l.path, dir)) {
            await invokeHost('plugins.unlinkDev', { dirPath: l.path });
          }
        }
        const res = await invokeHost<{ success?: boolean; id?: string; error?: string }>('plugins.linkDev', { dirPath: dir });
        if (!res?.success) {
          const e = res?.error || t('err.actionRefused');
          throw new Error(
            e === 'DEV_LINK_LICENSE_REQUIRED' ? t('board.devLinkLicenseRequired')
            : e === 'ID_CONFLICT' ? t('board.idConflict')
            : e === 'NO_MANIFEST' ? t('board.noManifest')
            : e
          );
        }
        entry = { path: dir, id: res.id, valid: true };
      }
      if (entry.valid === false) throw new Error(entry.error || t('err.invalidCartridge'));
      if (!entry.id) throw new Error(t('board.cartridgeIdMissing'));
      const run = await invokeHost<{ success?: boolean; error?: string }>('plugins.launch', { id: entry.id });
      if (!run?.success) throw new Error(run?.error || t('err.actionRefused'));
      setLaunchMsg({ key: 'board.launchOk', vars: { name: label } });
      setLaunchOk(true);
    } catch (err) {
      console.warn('launchAppWindow failed:', err);
      setLaunchMsg({ key: 'board.launchFailed', vars: { error: (err as Error).message } });
      setLaunchOk(false);
    } finally {
      setLaunching('');
    }
  };

  /** ── Save a generated document as a real file ──────────────────────────
   *  A doc-lane result only lived inside the vault history: nothing to share,
   *  print or turn into a PDF. Writing it into <espace>/documents/ makes it a
   *  file the user owns; printing then happens in the OS viewer (the preview
   *  iframe is sandboxed without same-origin, so the parent cannot call
   *  print() on it — and loosening that sandbox for model-generated HTML is
   *  not a trade worth making). */
  const [docSaving, setDocSaving] = useState(false);
  const [docMsg, setDocMsg] = useState('');
  /** Same contract as launchOk above: the save/open banner's colour is an
   *  OUTCOME, not something to sniff out of a translated sentence. */
  const [docOk, setDocOk] = useState<boolean | null>(null);
  const [savedDocPath, setSavedDocPath] = useState('');

  /** Writes the document on screen to <space>/documents/ — versioned in the
   *  filename once there is more than one take, so regenerating never
   *  silently overwrites an earlier save. */
  const saveDocument = async () => {
    if (!appHtml || docSaving) return;
    if (!folder) { setDocMsg(t('doc.saveNoSpace')); setDocOk(false); return; }
    setDocSaving(true);
    setDocMsg('');
    setDocOk(null);
    try {
      const dir = joinPath(folder, 'documents');
      await invokeHost('dialog.mkdir', { dirPath: dir });
      // Version in the filename as soon as there is more than one: otherwise
      // saving v2 would silently overwrite the v1 file already on disk.
      const base = slugify(name) || 'document';
      const file = joinPath(dir, docVersions.length > 1 ? `${base}-v${curVersion}.html` : `${base}.html`);
      // The file exported to disk carries the resolved photos (appHtmlView),
      // never the raw take with its unresolved {{IMG_n}} tokens — the whole
      // point of saving is a document that opens the same everywhere.
      const w = await invokeHost<{ success?: boolean; error?: string }>('dialog.writeFile', { filePath: file, content: appHtmlView || appHtml });
      if (!w?.success) throw new Error(w?.error || t('err.actionRefused'));
      setSavedDocPath(file);
      setDocMsg(t('doc.saved', { path: file }));
      setDocOk(true);
    } catch (err) {
      console.warn('Document save failed:', err);
      setDocMsg(t('doc.saveFailed', { error: (err as Error).message }));
      setDocOk(false);
    } finally {
      setDocSaving(false);
    }
  };

  /** Opens the saved document in the OS's default handler (print/PDF from
   *  there — Muse itself has no print pipeline). */
  const openSavedDoc = async () => {
    if (!savedDocPath) return;
    try {
      const r = await invokeHost<{ success?: boolean; error?: string }>('dialog.openInOS', { filePath: savedDocPath });
      if (!r?.success) throw new Error(r?.error || t('err.actionRefused'));
    } catch (err) {
      console.warn('openInOS failed:', err);
      setDocMsg(t('doc.openFailed', { error: (err as Error).message }));
      setDocOk(false);
    }
  };

  /** Reveals the project folder in the OS file explorer. There is no
   *  "open folder" host action (see the comment below), so this reveals a
   *  known file inside it instead — Explorer opens ON the folder either way. */
  const openAppDir = async () => {
    // dialog:openInOS is extension-whitelisted host-side (no folders, no
    // executables): reveal a known whitelisted file instead — Explorer opens
    // ON the folder with that file selected.
    setError('');
    const anchor = projFiles.find((f) => f.rel === 'BRIEF.md')
      ?? projFiles.find((f) => /\.(md|json|html|css|txt)$/i.test(f.rel));
    const target = anchor?.path ?? joinPath(appDir, 'BRIEF.md');
    try {
      const r = await invokeHost<{ success?: boolean; error?: string }>('dialog.openInOS', { filePath: target });
      if (!r?.success) throw new Error(r?.error || t('err.actionRefused'));
    } catch (err) {
      console.warn('openInOS failed:', err);
      setError({ key: 'err.openFolderFailed', vars: { error: (err as Error).message } });
    }
  };

  // Hand-off declutter: the wall of prompt text and the MCP details are
  // collapsed by default — copy is the primary action.
  const [showPrompt, setShowPrompt] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const [mcpShowSnippet, setMcpShowSnippet] = useState(false); // shown when copy is blocked

  /** Generate one support artifact into <appDir>/docs/ with the chosen model
   *  tier (eco = forceMode local, max = forceMode cloud, standard = auto). */
  const generateArtifact = async (art: { id: ArtifactKind; fileName: string }) => {
    if (!appDir || artState[art.id] === 'running') return;
    setArtState((s) => ({ ...s, [art.id]: 'running' }));
    setError('');
    try {
      const prompt = buildArtifactPrompt(art.id, { name, purpose, features: feats, nextSteps, lane });
      const payload: Record<string, unknown> = {
        prompt, temperature: 0.4,
        // [MEMORY-SCOPE] A SPEC written against the user's own memory is the
        // whole point of writing it here rather than in the IDE.
        ragQuery: projectRagQuery, ...memScope,
        // [LANGUAGE] A dedicated system-channel pin — see languageSystemPrompt().
        systemPrompt: languageSystemPrompt(),
      };
      if (artModel === 'eco') payload.forceMode = 'local';
      if (artModel === 'max') payload.forceMode = 'cloud';
      const res = await invokeHost<{ success?: boolean; error?: string; text?: string; response?: string }>('model.infer', payload);
      noteGrounding(res);
      if (res && res.success === false) throw new Error(res.error || t('err.inferRefused'));
      let text = String(res?.text ?? res?.response ?? '').trim();
      // Strip a whole-document wrapper fence, keeping the inner ```mermaid blocks.
      const wrap = text.match(/^```[a-z]*\n([\s\S]*)\n```$/);
      if (wrap) text = wrap[1].trim();
      if (!text) throw new Error(t('doc.emptyReply'));
      const docsDir = joinPath(appDir, 'docs');
      const mk = await invokeHost<{ success?: boolean; error?: string }>('dialog.mkdir', { dirPath: docsDir });
      if (!mk?.success) throw new Error(mk?.error || t('err.mkdirFailed'));
      const w = await invokeHost<{ success?: boolean; error?: string }>('dialog.writeFile', { filePath: joinPath(docsDir, art.fileName), content: text });
      if (!w?.success) throw new Error(w?.error || t('err.writeFailed'));
      setArtState((s) => ({ ...s, [art.id]: 'done' }));
      bumpProjScan();
    } catch (err) {
      console.warn('Artifact generation failed:', err);
      setArtState((s) => ({ ...s, [art.id]: 'error' }));
      setError({ key: 'err.artifactFailed', vars: { error: (err as Error).message } });
    }
  };

  // BMAD framing chat: ONE question at a time (doc 64 ROLE 1 scoping coach)
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [brief, setBrief] = useState<FramingBrief | null>(null);
  const [savedFraming, setSavedFraming] = useState<FramingSave | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Keep the newest exchange in view as the conversation grows.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, thinking, brief]);

  // Hands on keyboard: the answer field regains focus whenever the coach
  // finishes a turn — the user should never have to click to type.
  useEffect(() => {
    if (view === 'brief' && !thinking && !brief) chatInputRef.current?.focus();
  }, [view, thinking, brief, chat]);

  // Onboarding local state
  const [obStep, setObStep] = useState(0);
  /** What this human creates with Muse. 'doc' strips the dashboard down to
   *  the document studio — no lane chips, no app tiles, no IDE anywhere
   *  (Tony: "si la personne veut créer que des documents, pas besoin de
   *  l'UI prendre la tête"). Persisted in the META row, latest wins. */
  const [focus, setFocus] = useState<'doc' | 'full'>('full');
  const [ide, setIde] = useState('');
  const [os, setOs] = useState('');
  const [folder, setFolder] = useState('');
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [cloneTarget, setCloneTarget] = useState<Installable | null>(null);
  const [cloning, setCloning] = useState<'idle' | 'confirm' | 'running' | 'done' | 'error'>('idle');
  const [cloneMsg, setCloneMsg] = useState<Localized>('');
  /** Files seen in the destination while the clone runs past the bridge
   *  timeout. Null until the first tick: a spinner that never moves for four
   *  minutes reads as a freeze, and waitForClone already counts them. */
  const [cloneCount, setCloneCount] = useState<number | null>(null);

  // Doc library state (markdown files found in the app space's Neural OS clone)
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [docsState, setDocsState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [selDoc, setSelDoc] = useState<DocEntry | null>(null);
  const [docContent, setDocContent] = useState('');
  const [docQuery, setDocQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [readerLoading, setReaderLoading] = useState(false);
  const docsScanKey = useRef(''); // folder already scanned — '' forces a rescan

  // Cinematic intro auto-advances — no button. Routes to onboarding on first run.
  useEffect(() => {
    if (view !== 'intro') return;
    const t = setTimeout(() => setView(onboarded ? 'dashboard' : 'onboarding'), 7200);
    return () => clearTimeout(t);
  }, [view, onboarded]);

  // Onboarding → dashboard handover. 1.5s of animation + a 300ms fade-out, so
  // the whole beat lands under the 2s ceiling even on a slow first paint.
  useEffect(() => {
    if (view !== 'ready') return;
    const t = setTimeout(() => setView('dashboard'), 1500);
    return () => clearTimeout(t);
  }, [view]);

  // Boot the sandbox vault, read the onboarding flag + saved projects.
  // Kept callable: on first launch the host may open its native authorization
  // dialog and the human can answer it too late — the banner then offers a
  // retry instead of leaving the whole session dead (the grant persists, so
  // the retry succeeds).
  const bootSandbox = async () => {
    setBootFailed(false);
    setError('');
    try {
      const { vault } = await sdk.ensureSandbox();
      setVault(vault);
      // The label follows the shell language at boot (Tony: "Projets", not
      // "Apps" — a Muse row is a project, apps are only one of its lanes).
      await sdk.describeVaultTile({ icon: '✦', metrics: [{ label: t('tile.projects'), spine: SPINE }] });
      await loadState(vault);
    } catch (err) {
      setBootFailed(true);
      setError([{ key: 'err.sandboxUnavailable', vars: { error: (err as Error).message } }, { key: 'err.sandboxHint' }]);
    }
  };
  useEffect(() => { void bootSandbox(); }, []);

  // Real vault list for the memory picker. memoryStats alone gives counts but no
  // identity, which listed raw ids ("app-mnemosyne-plugins-…") beside human
  // vaults; scanTree carries the manifests, so Muse can name and group them the
  // way the host's own Vaults screen does.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tree, st] = await Promise.all([
          invokeHost<{ success?: boolean; nodes?: VaultTreeNode[] }>('vault.scanTree', {}),
          invokeHost<{ vaults?: Array<{ vaultId: string; displayName: string; chronicleCount: number }> }>('mnemosyne.status', {}),
        ]);
        if (!alive) return;
        // memoryStats keys on the workspaceId in the live path and on the
        // manifest id in the disk fallback, so the join is tried both ways and
        // by display name. A MISSING count must not hide a vault — only a
        // count known to be zero does.
        const counts = new Map<string, number>();
        for (const v of st?.vaults ?? []) {
          const n = v.chronicleCount ?? 0;
          if (v.vaultId) counts.set(v.vaultId.toLowerCase(), n);
          if (v.displayName) counts.set(v.displayName.toLowerCase(), n);
        }
        const countOf = (m: VaultManifestLite): number | null =>
          counts.get(m.id.toLowerCase()) ?? counts.get((m.displayName || '').toLowerCase()) ?? null;
        const flat: VaultManifestLite[] = [];
        (function collect(list: VaultTreeNode[] | undefined) {
          for (const n of list ?? []) {
            if (n?.manifest?.id) flat.push(n.manifest);
            collect(n?.children);
          }
        })(tree?.nodes);
        const mine = (vault ?? '').toLowerCase();
        setMemVaults(flat
          // App sandboxes are OTHER cartridges' walled-off stores (doc 58) —
          // not "my memory", and never a source Muse should offer.
          .filter((m) => !m.appSandbox
            && m.id.toLowerCase() !== mine && (m.displayName || '').toLowerCase() !== mine
            && (countOf(m) === null || (countOf(m) as number) > 0))
          .map((m) => ({
            vaultId: m.id,
            displayName: m.displayName || m.id,
            chronicleCount: countOf(m),
            type: VAULT_TYPES.includes(m.type) ? m.type : 'CUSTOM',
            locked: (m.permissions?.protection ?? '').toUpperCase() === 'MAXIMUM',
          })));
      } catch (err) {
        // No picker rather than a fake one — federated stays the default.
        console.warn('Vault list unavailable:', err);
      }
    })();
    return () => { alive = false; };
  }, [vault]);

  // Images a document can use: a bounded walk of a folder the user picked —
  // never the whole app space (see imgSourceDir's comment above).
  useEffect(() => {
    if (!imgPanel || !imgSourceDir) return;
    let alive = true;
    setImgScan('scanning');
    (async () => {
      type DirFile = { name: string; isDirectory: boolean; path: string };
      const found: DocImage[] = [];
      const CAP = 120;
      const walk = async (dir: string, rel: string, depth: number) => {
        if (found.length >= CAP) return;
        let r: { success?: boolean; files?: DirFile[] } | null = null;
        try { r = await invokeHost<{ success?: boolean; files?: DirFile[] }>('dialog.readDir', { dirPath: dir }); } catch { return; }
        if (!r?.success || !Array.isArray(r.files)) return;
        for (const f of r.files) {
          if (found.length >= CAP) return;
          const childRel = rel ? `${rel}/${f.name}` : f.name;
          if (f.isDirectory) {
            if (depth < 3 && !/^(node_modules|\.git|dist|build)$/i.test(f.name)) await walk(f.path, childRel, depth + 1);
          } else if (isImageFile(f.name)) found.push({ rel: childRel, path: f.path });
        }
      };
      await walk(imgSourceDir, '', 0);
      found.sort((a, b) => a.rel.localeCompare(b.rel));
      if (alive) { setSpaceImages(found); setImgScan('done'); }
    })();
    return () => { alive = false; };
  }, [imgPanel, imgSourceDir]);

  /** Lets the user point the picker at ANY folder — their real pictures live
   *  in Documents/Pictures/wherever, not inside the Muse app space. */
  const pickImageFolder = async () => {
    try {
      const path = await sdk.selectFolder();
      if (path) { setImgSourceDir(path); setSpaceImages([]); setImgScan('idle'); }
    } catch (err) {
      console.warn('Image folder pick cancelled/failed:', err);
    }
  };

  // The document on screen carries image PLACEHOLDERS; the bytes are pulled
  // from disk here. Keeping the two apart is what lets a take with photos stay
  // under the history size ceiling and still render whole.
  /** Swap a document's {{IMG_n}} tokens for real data URIs read from disk —
   *  shared by the viewer effect below and the studio preview. */
  const resolveDocHtml = async (html: string, imgs: DocImage[]): Promise<string> => {
    if (!imgs.length) return html;
    const resolved: Array<{ token: string; uri: string; alt: string }> = [];
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      let uri = imgCache.current.get(img.path);
      if (!uri) {
        try {
          const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: img.path });
          // The host returns binaries as a data URI; anything else means the
          // file moved or is no longer readable — that image is simply
          // dropped, never rendered as a broken tag.
          if (r?.success && typeof r.content === 'string' && r.content.startsWith('data:')) {
            uri = r.content;
            imgCache.current.set(img.path, uri);
          }
        } catch (err) {
          console.warn('Image unreadable, skipped:', img.rel, err);
        }
      }
      if (uri) resolved.push({ token: `{{IMG_${i + 1}}}`, uri, alt: img.caption || img.rel });
    }
    return replaceImagePlaceholders(html, resolved);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!appHtml) { setAppHtmlView(''); return; }
      const out = await resolveDocHtml(appHtml, takeImages);
      if (alive) setAppHtmlView(out);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveDocHtml is stable in behavior (cache ref + host call)
  }, [appHtml, takeImages]);

  // Detect which installables are already in the app space (a non-empty
  // target folder counts as installed — app.clone refuses non-empty dests).
  useEffect(() => {
    if (!folder || view !== 'onboarding' || obStep !== 3) return;
    let alive = true;
    (async () => {
      const found: Record<string, boolean> = {};
      for (const item of INSTALLABLES) {
        try {
          const res = await invokeHost<{ success?: boolean; files?: unknown[] }>(
            'dialog.readDir', { dirPath: joinPath(folder, item.dir) });
          found[item.id] = !!res?.success && Array.isArray(res.files) && res.files.length > 0;
        } catch { found[item.id] = false; }
      }
      if (alive) setInstalled(found);
    })();
    return () => { alive = false; };
  }, [folder, view, obStep]);

  // Discover the Mnemosyne markdown docs inside the app space (repo root +
  // sub-folders, 3 levels deep). Re-runs when the clone modal closes so a
  // fresh install shows up immediately. `cloning` gate keeps it off mid-clone.
  useEffect(() => {
    if ((view !== 'dashboard' && view !== 'docs' && view !== 'brief') || cloning !== 'idle') return;
    if (!folder) { setDocsState('missing'); setDocs([]); return; }
    if (docsScanKey.current === folder) return; // cached — cleared after installs
    docsScanKey.current = folder;
    let alive = true;
    (async () => {
      setDocsState('loading');
      type DirFile = { name: string; isDirectory: boolean; path: string };
      const list = async (p: string): Promise<DirFile[] | null> => {
        try {
          const r = await invokeHost<{ success?: boolean; files?: DirFile[] }>('dialog.readDir', { dirPath: p });
          return r?.success && Array.isArray(r.files) ? r.files : null;
        } catch { return null; }
      };
      const found: DocEntry[] = [];
      const walk = async (dirPath: string, relBase: string, depth: number) => {
        const files = await list(dirPath);
        if (!files) return;
        for (const f of files) {
          if (found.length >= 300) return; // hard cap — keep the scan cheap
          const rel = relBase ? `${relBase}/${f.name}` : f.name;
          if (!f.isDirectory && /\.md$/i.test(f.name) && !f.name.startsWith('.')) {
            found.push({ name: f.name, rel, path: f.path });
          } else if (f.isDirectory && depth < 2 && !f.name.startsWith('.') && !/^(node_modules|dist|coverage)$/i.test(f.name)) {
            await walk(f.path, rel, depth + 1);
          }
        }
      };
      const root = joinPath(folder, INSTALLABLES[0].dir);
      const rootFiles = await list(root);
      if (!rootFiles) {
        if (alive) { setDocs([]); setDocsState('missing'); }
        return;
      }
      await walk(root, '', 0);
      found.sort((a, b) => (a.rel === 'README.md' ? -1 : b.rel === 'README.md' ? 1 : a.rel.localeCompare(b.rel)));
      if (alive) { setDocs(found); setDocsState('ok'); }
    })();
    return () => { alive = false; };
  }, [view, folder, cloning]);

  // Load the library index whenever the studio opens: imports made from ANY
  // project appear (design-refs/LIBRARY.json is the persistent index).
  useEffect(() => {
    if (view !== 'design' || !folder) return;
    let alive = true;
    (async () => {
      try {
        const r = await invokeHost<{ success?: boolean; content?: string }>(
          'dialog.readFile', { filePath: joinPath(joinPath(folder, 'design-refs'), 'LIBRARY.json') });
        if (!alive) return;
        const libs = parseLibraryIndex(r?.success && typeof r.content === 'string' ? r.content : null);
        setLibraries(libs);
      } catch {
        if (alive) setLibraries([]);
      }
    })();
    return () => { alive = false; };
  }, [view, folder]);

  /** Opens a doc-library entry in the reader, auto-expanding every ancestor
   *  folder in the tree so its location is visible without a manual click. */
  const openDoc = async (doc: DocEntry) => {
    setSelDoc(doc);
    setDocContent('');
    setReaderLoading(true);
    setView('docs');
    // Reveal the doc's location in the tree (expand every ancestor folder).
    setExpanded((prev) => {
      const next = new Set(prev);
      const parts = doc.rel.split('/');
      let rel = '';
      for (let p = 0; p < parts.length - 1; p++) { rel = rel ? `${rel}/${parts[p]}` : parts[p]; next.add(rel); }
      return next;
    });
    try {
      const res = await invokeHost<{ success?: boolean; content?: string; error?: string }>(
        'dialog.readFile', { filePath: doc.path });
      if (!res?.success || typeof res.content !== 'string') throw new Error(res?.error || t('err.readFailed'));
      setDocContent(res.content);
    } catch (err) {
      setDocContent(t('err.docReadFailed', { error: (err as Error).message }));
    } finally {
      setReaderLoading(false);
    }
  };

  /** Expand/collapse one folder in the doc-library tree. */
  const toggleFolder = (rel: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel); else next.add(rel);
      return next;
    });
  };

  /** Rebuilds Muse's whole in-memory state (project history, versions,
   *  onboarding flag, any resumable framing session) from the sandbox
   *  vault's raw chronicle rows. Called on boot and after every write, since
   *  the vault is the single source of truth — nothing here is optimistic. */
  const loadState = async (target: string) => {
    try {
      // Every document VERSION is a row, so the window has to be wider than the
      // project count or regenerating would push older projects out of the
      // history. 200 is the host-side ceiling (social:query clamps there).
      const res = await sdk.socialQuery(target, 200);
      const rows: unknown[] = Array.isArray((res as { chronicles?: unknown[] })?.chronicles)
        ? (res as { chronicles: unknown[] }).chronicles
        : Array.isArray(res) ? (res as unknown[]) : [];
      const parsed: Project[] = [];
      let metaTs = -1;
      let prefTs = -1;
      let prefRow: DesignMix | null = null;
      let metaOnboarded = false;
      let metaFolder = '';
      let metaFocus: 'doc' | 'full' = 'full';
      let framingTs = -1;
      let framingRow: FramingSave | null = null;
      let buildTs = -1;
      let buildRow: DocBuild | null = null;
      const buildMap: Record<string, DocBuild> = {};
      const buildMapTs: Record<string, number> = {};
      for (const row of rows) {
        const rowId = typeof (row as { id?: unknown })?.id === 'number' ? (row as { id: number }).id : null;
        const content = (row as { content?: string })?.content ?? String(row);
        try {
          const p = JSON.parse(content) as Partial<Project> & { onboarded?: boolean; ts?: number; folder?: string; framing?: boolean; designPref?: unknown };
          // Framing checkpoints: keep only the latest one (latest-wins by ts).
          if (p?.framing === true) {
            const f = p as unknown as Partial<FramingSave>;
            const ts = typeof f.ts === 'number' ? f.ts : 0;
            if (ts >= framingTs) {
              framingTs = ts;
              const chatRows = Array.isArray(f.chat)
                ? f.chat.filter((m): m is ChatMsg => !!m && (m.role === 'muse' || m.role === 'user') && typeof m.text === 'string')
                : [];
              const rawLane = (f.brief as { lane?: unknown } | null | undefined)?.lane;
              const savedLane: Lane = rawLane === 'doc' || rawLane === 'site' || rawLane === 'cartridge' ? rawLane : 'cartridge';
              const b = f.brief && typeof f.brief === 'object' && typeof f.brief.name === 'string' && typeof f.brief.purpose === 'string'
                ? { name: f.brief.name, purpose: f.brief.purpose, features: Array.isArray(f.brief.features) ? f.brief.features.filter((x): x is string => typeof x === 'string') : [], nextSteps: Array.isArray(f.brief.nextSteps) ? f.brief.nextSteps.filter((x): x is string => typeof x === 'string') : [], lane: savedLane }
                : null;
              framingRow = { idea: typeof f.idea === 'string' ? f.idea : '', chat: chatRows, brief: b, done: !!f.done, ts };
            }
            continue;
          }
          // Advanced-builder checkpoints — latest wins; malformed ones are
          // skipped whole (a partial plan resurrected would look like data loss).
          if ((p as { docbuild?: unknown }).docbuild === true) {
            const b = p as unknown as Partial<DocBuild>;
            const ts = typeof b.ts === 'number' ? b.ts : 0;
            const outlineOk = !!b.outline && Array.isArray((b.outline as DocOutline).sections);
            if (outlineOk && Array.isArray(b.blocks) && typeof b.docId === 'string' && typeof b.name === 'string') {
              const entry: DocBuild = {
                docbuild: true, docId: b.docId, name: b.name,
                purpose: typeof b.purpose === 'string' ? b.purpose : '',
                outline: b.outline as DocOutline,
                blocks: (b.blocks as DocBlock[]).filter((x) => !!x && typeof x.id === 'string' && (x.kind === 'gen' || x.kind === 'text' || x.kind === 'image')),
                ts,
              };
              // Latest per document (the reopen path) AND latest overall (the
              // fresh-entry resume banner) — one scan feeds both.
              if (ts >= (buildMapTs[entry.docId] ?? -1)) { buildMapTs[entry.docId] = ts; buildMap[entry.docId] = entry; }
              if (ts >= buildTs) { buildTs = ts; buildRow = entry; }
            }
            continue;
          }
          // The global design preference — latest row wins, same as META.
          if (p?.designPref && typeof p.designPref === 'object') {
            const ts = typeof p.ts === 'number' ? p.ts : 0;
            if (ts >= prefTs) { prefTs = ts; prefRow = p.designPref as DesignMix; }
            continue;
          }
          if (typeof p?.onboarded === 'boolean') {
            const ts = typeof p.ts === 'number' ? p.ts : 0; // latest meta wins → reset works
            if (ts >= metaTs) {
              metaTs = ts; metaOnboarded = p.onboarded; metaFolder = typeof p.folder === 'string' ? p.folder : '';
              metaFocus = (p as { focus?: unknown }).focus === 'doc' ? 'doc' : 'full';
            }
            continue;
          }
          // Only real rows make the history: done entries carry their HTML
          // (instant reopen), drafts carry the scaffolded folder path.
          const isDone = p.status === 'done' && typeof p.html === 'string' && !!p.html;
          const isDraft = p.status === 'draft' && typeof p.path === 'string' && !!p.path;
          if (p?.name && typeof p.ts === 'number' && (isDone || isDraft)) {
            const row = p as Partial<Project> & { version?: number; style?: string | null; systemId?: string | null; memory?: string | null; memSource?: unknown; grounding?: unknown; format?: unknown; svg?: unknown; images?: unknown; tier?: string | null; cost?: unknown };
            parsed.push({
              name: p.name,
              purpose: p.purpose ?? '',
              status: isDone ? 'done' : 'draft',
              html: isDone ? p.html : undefined,
              ts: p.ts,
              path: typeof p.path === 'string' ? p.path : undefined,
              features: Array.isArray(p.features) ? p.features.filter((f): f is string => typeof f === 'string') : undefined,
              lane: p.lane === 'doc' || p.lane === 'site' || p.lane === 'cartridge' ? p.lane : undefined,
              docId: typeof row.docId === 'string' ? row.docId : undefined,
              rowIds: rowId === null ? [] : [rowId],
              versions: isDone
                ? [{
                    version: typeof row.version === 'number' ? row.version : 1,
                    ts: p.ts,
                    html: p.html as string,
                    style: typeof row.style === 'string' ? row.style : null,
                    systemId: typeof row.systemId === 'string' ? row.systemId : null,
                    memory: typeof row.memory === 'string' ? row.memory : null,
                    memSource: parseMemSource(row.memSource),
                    grounding: parseGrounding(row.grounding),
                    format: row.format === 'page' || row.format === 'long' || row.format === 'slides' ? row.format : null,
                    svg: row.svg === true,
                    images: parseDocImages(row.images),
                    tier: typeof row.tier === 'string' ? row.tier : null,
                    cost: parseCost(row.cost),
                    rowId,
                  }]
                : undefined,
            });
          }
        } catch {
          // Not a Muse row — ignore.
        }
      }
      // A malformed stored preference must not take the studio down with it:
      // an unreadable shape falls back to "no preference", never to a partial
      // one that would look like a design the user chose.
      if (prefRow && typeof prefRow === 'object') {
        setPrefMix({
          base: typeof prefRow.base === 'string' ? prefRow.base : null,
          roles: prefRow.roles && typeof prefRow.roles === 'object' && !Array.isArray(prefRow.roles) ? prefRow.roles : {},
          hue: typeof prefRow.hue === 'number' ? prefRow.hue : null,
          effects: Array.isArray(prefRow.effects) ? prefRow.effects.filter((e): e is string => typeof e === 'string') : [],
        });
      }
      setOnboarded(metaOnboarded);
      if (metaFolder) setFolder(metaFolder); // restore the app space across sessions
      setFocus(metaFocus);
      if (metaFocus === 'doc') setMode('doc'); // a documents-only Muse has one lane
      // Surface an interrupted framing session (crash/close) for one-click resume.
      setSavedFraming(framingRow && !framingRow.done && framingRow.chat.length > 0 ? framingRow : null);
      setSavedBuild(buildRow);
      setSavedBuilds(buildMap);
      parsed.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)); // newest first — real history
      // A re-prepared draft rewrites the same folder → keep only the newest row
      // per path. Documents sharing a docId are the SAME document: the newest
      // take leads the row and the older ones become its versions, so
      // regenerating grows a history instead of cluttering the dashboard.
      const seen = new Set<string>();
      const byDoc = new Map<string, Project>();
      const out: Project[] = [];
      for (const p of parsed) {
        if (p.docId && p.status === 'done') {
          const head = byDoc.get(p.docId);
          if (head) {
            head.versions = [...(head.versions ?? []), ...(p.versions ?? [])];
            head.rowIds = [...(head.rowIds ?? []), ...(p.rowIds ?? [])];
            continue;
          }
          byDoc.set(p.docId, p);
          out.push(p);
          continue;
        }
        const key = p.path || `${p.name}#${p.ts}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
      for (const p of byDoc.values()) {
        p.versions?.sort((a, b) => b.version - a.version || b.ts - a.ts);
      }
      setProjects(out);
    } catch (err) {
      console.warn('Could not load state:', err);
    }
  };

  /** Marks onboarding done (persisted in the sandbox vault) and hands off to
   *  the dashboard — a short 'ready' beat first, deliberately brief since
   *  this is a handover, not a second intro. */
  const completeOnboarding = async (chosenFocus: 'doc' | 'full' = focus) => {
    setFocus(chosenFocus);
    if (chosenFocus === 'doc') setMode('doc');
    // A failed boot (authorization dialog answered too late) would silently
    // drop the flag here and replay onboarding forever. By this point the
    // human has usually granted the permission — re-ensure heals the session.
    let target = vault;
    if (!target) {
      try {
        target = (await sdk.ensureSandbox()).vault;
        setVault(target);
        setBootFailed(false);
        setError('');
        void loadState(target);
      } catch (err) { console.warn('Sandbox still unavailable — onboarding flag not persisted:', err); }
    }
    if (target) {
      try { await sdk.socialIngest(target, JSON.stringify({ onboarded: true, ide, folder, focus: chosenFocus, ts: Date.now() }), META); }
      catch (err) { console.warn('Could not persist onboarding:', err); }
    }
    setOnboarded(true);
    // A beat to land on: the mark fades in centered, then the dashboard. Short
    // on purpose — this is a handover, not a second intro.
    setView('ready');
  };

  /** Widen a documents-only Muse to the full studio (persisted like the
   *  onboarding choice — same META row, latest wins). The reverse direction
   *  goes through the onboarding reset, where the fork lives. */
  const enableFullFocus = async () => {
    setFocus('full');
    if (vault) {
      try { await sdk.socialIngest(vault, JSON.stringify({ onboarded: true, ide, folder, focus: 'full', ts: Date.now() }), META); }
      catch (err) { console.warn('Could not persist focus:', err); }
    }
  };

  /** Reverses completeOnboarding: clears the persisted flag and every
   *  onboarding-step choice, then sends the user back through it. */
  const resetOnboarding = async () => {
    if (vault) {
      try { await sdk.socialIngest(vault, JSON.stringify({ onboarded: false, ts: Date.now() }), META); }
      catch (err) { console.warn('Could not reset onboarding:', err); }
    }
    setOnboarded(false); setObStep(0); setIde(''); setOs(''); setFolder('');
    setView('onboarding');
  };

  /** Clones one of the one-click installables into the app space. A
   *  non-empty destination is treated as "already installed" (app.clone
   *  refuses to clone into it), and a bridge timeout on a big repo falls
   *  back to waitForClone's polling rather than failing outright. */
  const startClone = async (target: Installable) => {
    if (!folder) return;
    setCloning('running');
    setCloneCount(null);
    try {
      const res = await invokeHost<{ success?: boolean; error?: string }>(
        'app.clone', { repo: target.repo, dest: joinPath(folder, target.dir) });
      if (res?.success || (res?.error || '').includes('already exists')) {
        // Non-empty dest = it was already cloned earlier → same outcome for the user.
        setInstalled((m) => ({ ...m, [target.id]: true }));
        docsScanKey.current = ''; // new content on disk → rescan the doc library
        setCloning('done');
        return;
      }
      setCloneMsg(res?.error === 'git-not-installed'
        ? { key: 'install.gitNotInstalled' }
        : (res?.error || { key: 'install.cloneUnavailable' }));
      setCloning('error');
    } catch (err) {
      if (isHostTimeout(err)) {
        // Same patience mode as the design reference: the clone is still
        // running host-side — keep the modal on 'running' and poll the dest.
        const ok = await waitForClone(joinPath(folder, target.dir), setCloneCount);
        if (ok) {
          setInstalled((m) => ({ ...m, [target.id]: true }));
          docsScanKey.current = '';
          setCloning('done');
          return;
        }
        setCloneMsg({ key: 'install.cloneSlow' });
        setCloning('error');
        return;
      }
      console.warn('app.clone failed:', err);
      setCloneMsg({ key: 'install.cloneUnavailable' });
      setCloning('error');
    }
  };

  /** Native folder picker for the onboarding "choose your app space" step. */
  const pickFolder = async () => {
    try {
      const path = await sdk.selectFolder();
      if (path) setFolder(path);
    } catch (err) {
      console.warn('Folder pick cancelled/failed:', err);
    }
  };

  /** Checkpoint the framing session in the sandbox vault (latest-wins by ts).
   *  Fire-and-forget: a crash at any point resumes from the last saved turn. */
  const saveFraming = (idea: string, chatState: ChatMsg[], briefState: FramingBrief | null, done: boolean) => {
    if (!vault) return;
    sdk.socialIngest(vault, JSON.stringify({ framing: true, idea, chat: chatState, brief: briefState, done, ts: Date.now() }), FRAMING_SPINE)
      .catch((err: unknown) => console.warn('Could not checkpoint framing:', err));
  };

  /** One framing turn: ask the coach, append its question — or lock the brief. */
  const museAsk = async (hist: ChatMsg[], idea: string, forceConclude: boolean) => {
    setThinking(true);
    try {
      const sysPrompt = languageSystemPrompt();
      // Direct action call, not sdk.inferModel: the published SDK is still
      // 0.1.0 and its ModelInferPayload has no `ragQuery` (0.1.1 is bumped but
      // unpublished). invoke() is the documented interim path.
      const res = await invokeHost<{ text?: string; response?: string }>('model.infer', {
        prompt: buildFramingPrompt(idea, hist, forceConclude, mode),
        temperature: 0.4,
        // [MEMORY-SCOPE] This is the screen where the memory is picked, and it
        // was the one call that ignored it. The coach steers on what the user
        // already has — `idea` is the intent, the prompt is the role contract.
        ragQuery: idea,
        ...memScope,
        // [LANGUAGE] A dedicated system-channel pin — see languageSystemPrompt().
        // (A field report of an "English answer under a French shell" turned
        // out to be `lang` itself being wrong, not the model ignoring it — see
        // languageSystemPrompt()'s doc comment. This pin stays as legitimate
        // defense in depth: whatever `lang` says, the model should follow it
        // on the system channel too, not just from inside the prompt text.)
        systemPrompt: sysPrompt,
      });
      noteGrounding(res);
      const text = String((res as { text?: string; response?: string }).text
        ?? (res as { response?: string }).response ?? '');
      const out = parseFramingReply(text);
      if (out.brief) {
        // A manually forced mode always beats the model's routing call.
        const locked: FramingBrief = mode !== 'auto' ? { ...out.brief, lane: mode } : out.brief;
        setBrief(locked);
        setLane(locked.lane);
        setName(locked.name);
        setPurpose(locked.purpose);
        setFeats([...locked.features, '', '', ''].slice(0, 3));
        setNextSteps(locked.nextSteps);
        const next: ChatMsg[] = [...hist, { role: 'muse', text: t('brief.briefLocked') }];
        setChat(next);
        saveFraming(idea, next, locked, false);
      } else if (out.question) {
        const next: ChatMsg[] = [...hist, { role: 'muse', text: out.question }];
        setChat(next);
        saveFraming(idea, next, null, false);
      }
    } catch (err) {
      console.warn('Framing turn failed:', err);
      // Transient UI only — error bubbles are not checkpointed.
      setChat((prev) => [...prev, { role: 'muse', text: t('brief.thinkingFailed') }]);
    } finally {
      setThinking(false);
    }
  };

  /** Sends the user's typed answer as the next framing-chat turn. Checkpoints
   *  BEFORE the inference call, so the answer survives even if the model
   *  call itself crashes or the app closes mid-turn. */
  const sendAnswer = () => {
    const t = chatInput.trim();
    if (!t || thinking || brief) return;
    const hist: ChatMsg[] = [...chat, { role: 'user', text: t }];
    setChat(hist);
    setChatInput('');
    saveFraming(purpose, hist, null, false); // checkpoint BEFORE inference — answer survives a crash
    const museTurns = hist.filter((m) => m.role === 'muse').length;
    void museAsk(hist, purpose, museTurns >= 5); // hard cap — conclude past 5 questions
  };

  /** Skips ahead to the coach's final BRIEF, forcing it to conclude with
   *  whatever the conversation has gathered so far. */
  const concludeNow = () => {
    if (thinking || brief) return;
    void museAsk(chat, purpose, true);
  };

  /** Dashboard input → the GUIDED flow: BMAD framing chat, then IDE hand-off.
   *  In-cartridge generation survives only as the 'express' side path. */
  const startQuickLaunch = (idea: string) => {
    const t = idea.trim();
    setPurpose(t);
    setName(''); setAppHtml(''); setError('');
    setFeats(['', '', '']); setNextSteps([]); setAppDir(''); setCopied(false);
    setBrief(null); setChatInput('');
    const seed: ChatMsg[] = [{ role: 'user', text: t }];
    setChat(seed);
    setView('brief');
    saveFraming(t, seed, null, false); // a fresh session supersedes any older checkpoint
    void museAsk(seed, t, false);
  };

  /** Resume the framing session checkpointed before a crash/close. */
  const resumeFraming = () => {
    if (!savedFraming) return;
    setPurpose(savedFraming.idea);
    setName(savedFraming.brief?.name ?? '');
    setChat(savedFraming.chat);
    setBrief(savedFraming.brief);
    if (savedFraming.brief) {
      setLane(savedFraming.brief.lane);
      setFeats([...savedFraming.brief.features, '', '', ''].slice(0, 3));
      setNextSteps(savedFraming.brief.nextSteps);
    }
    setChatInput(''); setError(''); setAppDir(''); setCopied(false);
    setView('brief');
  };

  /** Discards the resumable framing checkpoint (marks it `done` in the vault
   *  so it stops resurfacing as "resume this?" on future boots). */
  const dismissFraming = () => {
    if (savedFraming) saveFraming(savedFraming.idea, savedFraming.chat, savedFraming.brief, true);
    setSavedFraming(null);
  };

  /** Deterministic scaffold (doc 64 §7ter — plumbing is CODE, zero credits):
   *  creates <space>/<slug>/ with BRIEF.md + app-spec.json, saves the draft. */
  const scaffoldApp = async () => {
    if (!folder || !name.trim() || !purpose.trim()) return;
    setScaffolding(true);
    setError('');
    try {
      const slug = slugify(name);
      const dir = joinPath(folder, slug);
      const input = {
        name: name.trim(), slug, purpose: purpose.trim(), features: feats.map((f) => f.trim()),
        nextSteps, appDir: dir, repoDir: joinPath(folder, INSTALLABLES[0].dir),
        museVersion: MUSE_VERSION,
        target: (lane === 'site' ? 'site' : 'cartridge') as 'site' | 'cartridge',
        memory: memVault,
      };
      const mk = await invokeHost<{ success?: boolean; error?: string }>('dialog.mkdir', { dirPath: dir });
      if (!mk?.success) throw new Error(mk?.error || t('err.mkdirFailed'));
      const w1 = await invokeHost<{ success?: boolean; error?: string }>('dialog.writeFile', { filePath: joinPath(dir, 'BRIEF.md'), content: buildBrief(input) });
      if (!w1?.success) throw new Error(w1?.error || t('err.writeFailed'));
      const w2 = await invokeHost<{ success?: boolean; error?: string }>('dialog.writeFile', { filePath: joinPath(dir, 'app-spec.json'), content: buildAppSpec(input, new Date().toISOString()) });
      if (!w2?.success) throw new Error(w2?.error || t('err.writeFailed'));
      if (vault) {
        try {
          await sdk.socialIngest(vault, JSON.stringify({ name: input.name, purpose: input.purpose, status: 'draft', ts: Date.now(), path: dir, features: input.features.filter(Boolean), lane }), SPINE);
          await loadState(vault);
        } catch (err) { console.warn('Could not save the draft:', err); }
      }
      // Space-level CATALOG.md — the P1 dashboard, kept by deterministic code
      // (zero credits). Non-fatal: a failed update never blocks the hand-off.
      try {
        const catPath = joinPath(folder, 'CATALOG.md');
        let prevCat: string | null = null;
        try {
          const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: catPath });
          if (r?.success && typeof r.content === 'string') prevCat = r.content;
        } catch { /* first app — no catalog yet */ }
        await invokeHost('dialog.writeFile', {
          filePath: catPath,
          content: upsertCatalog(prevCat, { name: input.name, lane, slug, date: new Date().toLocaleDateString(dateLocale(lang)) }),
        });
      } catch (err) { console.warn('CATALOG.md update failed:', err); }
      setAppDir(dir);
      setCopied(false);
      setBoardStep('handoff');
      setArtState({});
      setDesignState('idle'); setDesignStyle(null); setDesignFx(new Set());
      setRefState('idle'); setRefMsg('');
      setDesignSystem(null); setOdPreview(null); setOdState('idle'); setOdMsg('');
      setMcpIde(ide === 'cursor' || ide === 'vscode' || ide === 'antigravity' ? ide : 'claude-code');
      setMcpState('idle'); setMcpMsg(''); setMcpShowSnippet(false);
      verity.reset();
      saveFraming(purpose, chat, brief, true); // session concluded — banner off
      setSavedFraming(null);
      setView('handoff');
    } catch (err) {
      setError({ key: 'board.scaffoldFailed', vars: { error: (err as Error).message } });
    } finally {
      setScaffolding(false);
    }
  };

  /** Reopen a history entry: done rows run their saved HTML instantly,
   *  drafts land back on the IDE hand-off screen. */
  /** ── Delete a project ──────────────────────────────────────────────────
   *  Two very different things live under one word, so the dialog says which:
   *  the HISTORY rows (chronicles Muse wrote in its own sandbox — really
   *  forgotten via vault.sandbox.forget) and the project FOLDER on disk, which
   *  a cartridge cannot remove (dialog:deleteFile refuses directories). The
   *  folder is never touched and the dialog says so plainly. */
  const [delTarget, setDelTarget] = useState<Project | null>(null);
  const [delFiles, setDelFiles] = useState(false); // opt-in: wipe the folder too
  const [deleting, setDeleting] = useState(false);

  /* Escape closes what a backdrop click already closed — grouped here because
   * every one of these states is in scope by now, and hook order must not
   * depend on which overlay happens to be open. `undefined` = deliberately not
   * dismissable: a delete in flight, and a clone the host is still running. */
  useEscape(delTarget && !deleting ? () => { setDelTarget(null); setDelFiles(false); } : undefined);
  useEscape(memPanel ? () => setMemPanel(false) : undefined);
  useEscape(imgPanel ? () => setImgPanel(false) : undefined);
  useEscape(artView ? () => setArtView(null) : undefined);
  useEscape(cloning === 'confirm' ? () => { setCloning('idle'); setCloneTarget(null); } : undefined);

  const confirmDelete = async () => {
    const p = delTarget;
    if (!p || deleting) return;
    setDeleting(true);
    try {
      // Files FIRST: if the folder delete fails, the project stays in the list
      // with its folder intact — a half-deleted state the user can retry. The
      // reverse order would lose the row and orphan the folder silently.
      if (delFiles && p.path) {
        const d = await invokeHost<{ success?: boolean; error?: string }>('dialog.deleteProjectDir', { dirPath: p.path });
        if (!d?.success) {
          throw new Error((d?.error || '').startsWith('NOT_A_PROJECT')
            ? t('err.notAProject')
            : d?.error || t('err.actionRefused'));
        }
      }
      const ids = (p.rowIds ?? []).filter((n) => Number.isInteger(n) && n > 0);
      if (ids.length) {
        const r = await invokeHost<{ success?: boolean; forgotten?: number; error?: string }>('vault.sandbox.forget', { ids });
        if (!r?.success) throw new Error(r?.error || t('err.actionRefused'));
      }
      setDelTarget(null);
      setDelFiles(false);
      if (vault) await loadState(vault);
    } catch (err) {
      console.warn('Project delete failed:', err);
      setError({ key: 'err.deleteFailed', vars: { error: (err as Error).message } });
      setDelTarget(null);
      setDelFiles(false);
    } finally {
      setDeleting(false);
    }
  };

  /** Reopen a project. `atVersion` opens a document straight on that take —
   *  the dashboard offers every version, so a comparison costs one click. */
  const openProject = (p: Project, atVersion?: number) => {
    setName(p.name);
    setPurpose(p.purpose);
    if (p.status === 'draft') {
      setLane(p.lane ?? 'cartridge');
      setFeats([p.features?.[0] ?? '', p.features?.[1] ?? '', p.features?.[2] ?? '']);
      setAppDir(p.path || '');
      setCopied(false);
      setBoardStep('handoff');
      setArtState({});
      setDesignState('idle'); setDesignStyle(null); setDesignFx(new Set());
      setRefState('idle'); setRefMsg('');
      setDesignSystem(null); setOdPreview(null); setOdState('idle'); setOdMsg('');
      setMcpIde(ide === 'cursor' || ide === 'vscode' || ide === 'antigravity' ? ide : 'claude-code');
      setMcpState('idle'); setMcpMsg(''); setMcpShowSnippet(false);
      verity.reset();
      setView('handoff');
    } else {
      // Reopen on the newest take, with every version reachable. Pre-versioning
      // rows have none: they become a single v1 so the screen behaves the same.
      const versions = p.versions?.length
        ? [...p.versions].sort((a, b) => b.version - a.version || b.ts - a.ts)
        : [{ version: 1, ts: p.ts ?? 0, html: p.html || '', style: null, systemId: null, memory: null, memSource: null, grounding: null, format: null, svg: false, images: [], tier: null, cost: null, rowId: null }];
      // Asked-for version when it still exists, newest otherwise.
      const head = (atVersion !== undefined ? versions.find((v) => v.version === atVersion) : undefined) ?? versions[0];
      setAppHtml(head.html);
      setCurDocId(p.docId ?? '');
      setCurVersion(head.version);
      setDocVersions(versions);
      setDocStyle(head.style);
      // Same reasoning as the memory scope below: the id IS the replayable
      // state, so the system is re-read from disk rather than trusted from a
      // label. A take with no system on record clears the picker instead of
      // carrying the previous document's design into this one.
      setDocSystem(null);
      setDocSystemMissing(null);
      if (head.systemId) void restoreDocSystem(head.systemId);
      // Restore the memory this take was grounded on. Style and tier were
      // already restored here; the scope was not, so "regenerate" reused
      // whatever the picker held — federated in a fresh session, while the
      // version card still claimed five vaults. A take with no scope on
      // record leaves the picker untouched rather than widening it.
      if (head.memSource) setMemVault(head.memSource);
      setGrounding(head.grounding);
      if (head.tier === 'eco' || head.tier === 'standard' || head.tier === 'max') setDocTier(head.tier);
      // Same reasoning for the shape: a doc lacking these (every take before
      // this shipped) falls back to the current picker rather than a fixed
      // default, so an old document does not silently switch format on open.
      if (head.format) setDocFormat(head.format);
      setDocSvg(head.svg);
      setDocImages(head.images);
      setTakeImages(head.images);
      setRegenOpen(false);
      setDocMsg(''); setDocOk(null); setSavedDocPath('');
      setDoneFrom('history');
      setView('done');
    }
  };

  /** The wallet's total spend — the before/after delta of a call IS its real
   *  cost (server-billed). null = no wallet / offline / BYOK → unmeasured. */
  const readSpend = async (): Promise<number | null> => {
    try {
      const r = await invokeHost<{ success?: boolean; data?: { usedUsdMicro?: number } }>('credits.status', {});
      return r?.success && typeof r.data?.usedUsdMicro === 'number' ? r.data.usedUsdMicro : null;
    } catch {
      return null; // no wallet / offline / BYOK — reported as unmeasured
    }
  };
  const readText = (r: unknown) => String((r as { text?: string; response?: string })?.text ?? (r as { response?: string })?.response ?? '');

  // ── Advanced document builder (plan → blocks → assemble) ──────────────────
  /** One model call for the studio: current picker scope, current tier's mode,
   *  cost metered into the session accumulator so the saved take carries the
   *  REAL total of every block generated along the way. */
  const runAdvInfer = async (prompt: string, o: { maxTokens: number; temperature: number }): Promise<string> => {
    const mode = docTier === 'eco' ? { forceMode: 'local' as const } : docTier === 'max' ? { forceMode: 'cloud' as const } : {};
    const before = docTier === 'eco' ? null : await readSpend();
    const res = await invokeHost<{ success?: boolean; error?: string; text?: string; response?: string }>('model.infer', {
      prompt, temperature: o.temperature, maxTokens: o.maxTokens,
      ragQuery: projectRagQuery, ...memScope, ...mode,
      // [LANGUAGE] A dedicated system-channel pin — see languageSystemPrompt().
      systemPrompt: languageSystemPrompt(),
    });
    noteGrounding(res, memMode);
    if (docTier !== 'eco') {
      const after = await readSpend();
      if (before !== null && after !== null && after > before) advSpend.current.usd += after - before;
    }
    if (res && res.success === false) throw new Error(res.error || t('err.inferRefused'));
    const text = readText(res);
    if (!text.trim()) throw new Error(t('doc.emptyReply'));
    return text;
  };

  /** Fire-and-forget builder checkpoint — latest row wins on load. */
  const checkpointBuild = (b: DocBuild) => {
    if (!vault) return;
    sdk.socialIngest(vault, JSON.stringify(b), DOCBUILD_SPINE)
      .catch((err) => console.warn('Docbuild checkpoint failed:', err));
  };

  /** Persist the assembled document as a take — same row shape as the quick
   *  lane (plus `advanced: true`), so history, versions and the viewer treat
   *  both modes as one kind of document. */
  const saveAdvancedTake = async (build: DocBuild, html: string) => {
    const ts = Date.now();
    const cost: GenCost = docTier === 'eco'
      ? { unmeasured: 'local' }
      : advSpend.current.usd > 0 ? { usdMicro: advSpend.current.usd } : { unmeasured: 'byok' };
    const sameDoc = build.docId === curDocId;
    const version = sameDoc ? Math.max(...docVersions.map((v) => v.version), 0) + 1 : 1;
    const take: DocVersion = { version, ts, html, style: docStyle, systemId: null, memory: memoryLabel(memVault), memSource: memVault, grounding, format: 'page', svg: docSvg, images: docImages, tier: docTier, cost, rowId: null };
    setName(build.name);
    setPurpose(build.purpose);
    setAppHtml(html);
    setTakeImages(docImages);
    setCurDocId(build.docId);
    setCurVersion(version);
    setDocVersions((prev) => (sameDoc ? [take, ...prev.filter((v) => v.version !== version)] : [take]));
    if (vault) {
      try {
        if (html.length <= 200_000) {
          await sdk.socialIngest(vault, JSON.stringify({ name: build.name, purpose: build.purpose, status: 'done', ts, html, lane: 'doc', docId: build.docId, version, style: docStyle, systemId: null, memory: memoryLabel(memVault), memSource: memVault, grounding, format: 'page', svg: docSvg, images: docImages, tier: docTier, cost, advanced: true }), SPINE);
          await loadState(vault);
        } else {
          console.warn('Assembled document above 200KB — not persisted in history.');
        }
      } catch (err) { console.warn('Could not save the document:', err); }
    }
    setDoneFrom('new');
    setView('done');
  };

  /** Generate a document. With no argument it starts a NEW document (v1);
   *  called from the done screen it adds the next version of the same docId —
   *  same intent and, unless the regen panel changed it, the same memory.
   *  Style, format and visuals are read live from the regen panel each time,
   *  so a version CAN change shape — the memory scope is the one thing that
   *  must not drift by accident (see baseSource below). */
  const generate = async (regen?: { docId: string; nextVersion: number }) => {
    setError('');
    setView('generating');
    try {
      const docId = regen?.docId ?? `${slugify(name) || 'document'}#${Date.now()}`;
      const version = regen?.nextVersion ?? 1;
      // A regeneration reproduces the take it starts from, so THAT take's
      // recorded scope wins over whatever the picker holds now — which is what
      // the "même mémoire" copy on the button has always claimed. Falls back to
      // the picker for a new document, and for takes written before the scope
      // was persisted (they carry only a label, which cannot be replayed).
      const baseSource: MemorySource = regen
        ? (docVersions.find((v) => v.version === curVersion)?.memSource ?? memVault)
        : memVault;
      const genMode = memoryMode(baseSource);
      const genScope = memoryScope(baseSource);
      const docPreset = docStyle ? STYLE_PRESETS.find((p) => p.id === docStyle) ?? null : null;
      // Budgets measured against the real failure: with no maxTokens the host
      // defaults to 4096 (cloud) / 2048 (local) — not enough for a typeset page,
      // so the model shrinks the document to fit and it reads cheap.
      const TIER = {
        eco: { plan: 0, render: 3200, mode: 'local' as const },
        standard: { plan: 900, render: 6000, mode: null },
        max: { plan: 1200, render: 8000, mode: 'cloud' as const },
      }[docTier];
      // Cost is METERED, not guessed: the gate bills server-side, so the wallet's
      // usedUsdMicro before/after the generation IS the amount charged. Only the
      // Mnemosyne Cloud path is metered — a personal API key is billed by the
      // provider (the host never sees it) and local costs nothing.
      const spendBefore = docTier === 'eco' ? null : await readSpend();

      // Scope and retrieval query come from the shared derivation at the top of
      // the component — this lane used to be the only one that had them.
      const modeOpt = TIER.mode ? { forceMode: TIER.mode } : {};

      // Pass 1 — plan. Skipped in eco: one cheap call, or nothing.
      let plan = '';
      if (TIER.plan > 0) {
        setGenStage('plan');
        try {
          const p = await invokeHost<{ success?: boolean; error?: string; text?: string; response?: string }>('model.infer', {
            prompt: buildDocPlanPrompt({ name, purpose, memoryName: genMode === 'pick' ? memoryLabel(baseSource) : undefined }),
            temperature: 0.4, maxTokens: TIER.plan, ragQuery: projectRagQuery, ...genScope, ...modeOpt,
            // [LANGUAGE] A dedicated system-channel pin — see languageSystemPrompt().
            systemPrompt: languageSystemPrompt(),
          });
          noteGrounding(p, genMode);
          if (p && p.success !== false) plan = readText(p).trim();
        } catch (err) {
          // A failed plan must not lose the document: render without it.
          console.warn('Document plan pass failed — rendering without a plan:', err);
        }
      }

      // Pass 2 — render. Direct action call (not sdk.inferModel): the host
      // embeds `ragQuery` for retrieval, so the memory search runs on MY INTENT
      // and not on the long instruction block, which would swamp the vector.
      setGenStage('render');
      const res = await invokeHost<{ success?: boolean; error?: string; text?: string; response?: string }>('model.infer', {
        prompt: buildDocRenderPrompt({
          name, purpose,
          plan: plan || undefined,
          memoryName: genMode === 'pick' ? memoryLabel(baseSource) : undefined,
          format: docFormat,
          svg: docSvg,
          // Only NAME + CAPTION reach the model — never the bytes. A caption
          // matters: a bare "img_042.jpg" tells the model nothing about what
          // it shows, so it has no basis to place it anywhere and just skips
          // it — which is what "the image feature does nothing" looks like
          // from the outside. The file name alone is kept as a last resort.
          images: docImages.map((i) => ({ name: i.rel.split('/').pop() ?? i.rel, caption: i.caption?.trim() || undefined })),
          // An Open Design system wins over a preset — the two are mutually
          // exclusive in the picker, this order is only the belt to that brace.
          // One design for the three lanes: the document's own if it has
          // one, otherwise the global default. A preset only speaks when no
          // design at all resolves.
          styleBlock: !docDesign.empty
            ? buildDocDesignBlock(docDesign, docSystem?.name ?? t('pref.title'))
            : docPreset
              ? buildDocStyleBlock({ styleName: docPreset.name, scheme: docPreset.scheme, palette: docPreset.palette, traits: docPreset.traits })
              : undefined,
        }),
        // A long piece and a deck need more room than a single page; the model
        // tier sets the budget, the format stretches it.
        temperature: 0.6, maxTokens: Math.round(TIER.render * FORMAT_BUDGET[docFormat]),
        ragQuery: projectRagQuery, ...genScope, ...modeOpt,
        // [LANGUAGE] A dedicated system-channel pin — see languageSystemPrompt().
        systemPrompt: languageSystemPrompt(),
      });
      const took = noteGrounding(res, genMode);
      if (res && res.success === false) throw new Error(res.error || t('err.inferRefused'));
      const html = extractHtml(readText(res));
      if (!html) throw new Error(t('doc.emptyReply'));
      const ts = Date.now();
      // Local never bills; otherwise a missing/unchanged reading means the call
      // did not go through the metered path (personal key), which is a DIFFERENT
      // statement from "it was free" — so they are labelled differently.
      const spendAfter = docTier === 'eco' ? null : await readSpend();
      const cost: GenCost = docTier === 'eco'
        ? { unmeasured: 'local' }
        : spendBefore !== null && spendAfter !== null && spendAfter > spendBefore
          ? { usdMicro: spendAfter - spendBefore }
          : { unmeasured: 'byok' };
      const take: DocVersion = { version, ts, html, style: docStyle, systemId: docSystem?.id ?? null, memory: memoryLabel(baseSource), memSource: baseSource, grounding: took, format: docFormat, svg: docSvg, images: docImages, tier: docTier, cost, rowId: null };
      setAppHtml(html);
      setTakeImages(docImages);
      setCurDocId(docId);
      setCurVersion(version);
      // Newest first, like the loaded history — the switcher reads the same way
      // whether the version was just produced or came back from the vault.
      setDocVersions((prev) => [take, ...prev.filter((v) => v.version !== version)]);
      setRegenOpen(false);
      if (vault) {
        try {
          // Persist the generated HTML with the entry — history rows reopen
          // instantly. Oversized outputs are not saved at all (no dead rows).
          if (html.length <= 200_000) {
            // In-Muse generated artifacts are doc-lane by definition.
            await sdk.socialIngest(vault, JSON.stringify({ name, purpose, status: 'done', ts, html, lane: 'doc', docId, version, style: docStyle, systemId: docSystem?.id ?? null, memory: memoryLabel(baseSource), memSource: baseSource, grounding: took, format: docFormat, svg: docSvg, images: docImages, tier: docTier, cost }), SPINE);
            await loadState(vault);
          } else {
            console.warn('App HTML above 200KB — not persisted in history.');
          }
        } catch (err) { console.warn('Could not save the project:', err); }
      }
      setDoneFrom('new');
      setView('done');
    } catch (err) {
      setError((err as Error)?.message || { key: 'err.genericFailed' });
      setView('name');
    }
  };

  const inProgress = projects.filter((p) => p.status === 'draft');
  const toPublish = projects.filter((p) => p.status === 'done');
  const cloneDest = cloneTarget && folder ? joinPath(folder, cloneTarget.dir) : '';
  const repoDir = folder ? joinPath(folder, INSTALLABLES[0].dir) : '';
  const handoffPrompt = appDir
    ? buildHandoffPrompt({
        name: name.trim(), slug: slugify(name), purpose: purpose.trim(),
        features: feats.map((f) => f.trim()), nextSteps, appDir, repoDir, museVersion: MUSE_VERSION,
        target: lane === 'site' ? 'site' : 'cartridge',
        memory: memVault,
      })
    : '';
  const briefBlocked = scaffolding || !brief || !folder;
  // Disk truth for the Gantt: what the project folder actually contains.
  const projDisk = {
    tokens: projFiles.some((f) => f.rel === 'design-tokens.json'),
    artifacts: projFiles.some((f) => f.rel.startsWith('docs/') && /\.md$/i.test(f.rel)),
    adapted: projFiles.some((f) => f.rel.startsWith('design/')),
    built: !!builtEntry,
    verity: projFiles.some((f) => f.rel === 'docs/VERITY.md'),
  };
  const mcpConfigured = mcpState === 'done'
    || projFiles.some((f) => f.rel === '.mcp.json' || f.rel === '.cursor/mcp.json' || f.rel === '.vscode/mcp.json');
  const docTree = buildDocTree(docs);
  const docMatches = docQuery.trim()
    ? docs.filter((d) => d.rel.toLowerCase().includes(docQuery.trim().toLowerCase())).slice(0, 60)
    : [];

  return (
    <div style={S.root}>
      {/* Ambient side mark only on the airy wizard screens — dense views
          (dashboard, done, docs) keep their full width for content. */}
      {((view === 'onboarding' && obStep !== 0) || view === 'name' || view === 'generating') && <SideLogo />}
      {/* ── Cinematic intro ─────────────────────────────────────────────── */}
      {view === 'intro' && <IntroScreen t={t} onboarded={onboarded} onEnter={setView} />}

      {/* ── Onboarding handover: the mark, a breath, the dashboard ───────── */}
      {view === 'ready' && <ReadyScreen t={t} />}

      {/* ── First-run onboarding ────────────────────────────────────────── */}
      {view === 'onboarding' && (
        <OnboardingScreen
          t={t} error={renderMsg(error, t)} onRetryBoot={bootFailed ? () => { void bootSandbox(); } : undefined}
          obStep={obStep} setObStep={setObStep}
          os={os} setOs={setOs} ide={ide} setIde={setIde}
          folder={folder} installed={installed} installables={INSTALLABLES}
          onPickFolder={pickFolder}
          onCompleteOnboarding={() => { void completeOnboarding('full'); }}
          onDocsOnly={() => { void completeOnboarding('doc'); }}
          onOpenExternal={openExternal}
          onInstallClick={(item) => { setCloneTarget(item); setCloning('confirm'); }}
        />
      )}

      {/* ── Dashboard (ultra sober) ─────────────────────────────────────── */}
      {view === 'dashboard' && (
        <DashboardScreen
          t={t} lang={lang} error={renderMsg(error, t)}
          onRetryBoot={bootFailed ? () => { void bootSandbox(); } : undefined}
          onOpenDocs={() => setView('docs')}
          onOpenDesignPref={() => { setDesignFor('pref'); setPrefState('idle'); setView('design'); }}
          onQuickLaunch={startQuickLaunch}
          onAdvancedDoc={(input) => { setPurpose(input.trim()); setName(''); setStudioSeed(null); advSpend.current.usd = 0; setView('docstudio'); }}
          focus={focus} onEnableFull={() => { void enableFullFocus(); }}
          modes={MODES} mode={mode} onSetMode={(id) => setMode(id as 'auto' | Lane)}
          memVault={memVault} onSetMemVault={setMemVault} onOpenMemPanel={() => setMemPanel(true)}
          groundingBadge={groundingBadge}
          laneIcon={(l) => LANE_ICON[l]}
          savedFraming={savedFraming} onResumeFraming={resumeFraming} onDismissFraming={dismissFraming}
          toPublishCount={toPublish.length} inProgressCount={inProgress.length}
          docsCount={docsState === 'ok' ? docs.length : '—'}
          projects={projects} onOpenProject={openProject}
          launching={launching} onLaunchApp={(path, name) => { void launchAppWindow(path, name); }}
          launchMsg={renderMsg(launchMsg, t)} launchOk={launchOk}
          onDeleteProject={(p) => { setError(''); setDelFiles(false); setDelTarget(p); }}
        />
      )}

      {/* ── Guided creation 1/2: BMAD framing chat (one question at a time) ─ */}
      {view === 'brief' && (
        <BriefScreen
          t={t} groundingBadge={groundingBadge} chat={chat} thinking={thinking} brief={brief}
          chatRef={chatRef} chatInputRef={chatInputRef} chatInput={chatInput} setChatInput={setChatInput}
          folder={folder} docsState={docsState} error={renderMsg(error, t)} memVault={memVault} installables={INSTALLABLES}
          docStyle={docStyle} setDocStyle={pickDocStyle} docTier={docTier} setDocTier={setDocTier}
          docSystem={docSystem} docSystemMissing={docSystemMissing} onPickDocSystem={() => pickDocSystem('brief')}
          docFormat={docFormat} setDocFormat={setDocFormat} docImages={docImages} docSvg={docSvg}
          briefBlocked={briefBlocked} scaffolding={scaffolding}
          onBack={() => setView('dashboard')}
          onGoOnboarding={resetOnboarding}
          onInstallClick={(item) => { setCloneTarget(item); setCloning('confirm'); }}
          onOpenImgPanel={() => setImgPanel(true)}
          onToggleSvg={() => setDocSvg((v) => !v)}
          onSendAnswer={sendAnswer}
          onConcludeNow={concludeNow}
          onExpressMode={() => setView('name')}
          onGenerate={() => { saveFraming(purpose, chat, brief, true); setSavedFraming(null); void generate(); }}
          onScaffoldApp={scaffoldApp}
        />
      )}

      {/* ── Project board: mini-Gantt timeline + per-step detail ─────────── */}
      {view === 'handoff' && (
        <HandoffScreen
          t={t} lane={lane} name={name} memVault={memVault} laneIcon={(l) => LANE_ICON[l]}
          launching={launching} launchMsg={renderMsg(launchMsg, t)} launchOk={launchOk} appDir={appDir} projFiles={projFiles} projDisk={projDisk}
          boardStep={boardStep} setBoardStep={setBoardStep} purpose={purpose} feats={feats} nextSteps={nextSteps} error={renderMsg(error, t)}
          designHue={designHue} designHarmony={designHarmony} designStyle={designStyle} designFx={designFx} designState={designState}
          artModel={artModel} setArtModel={setArtModel} artState={artState}
          handoffPrompt={handoffPrompt} copied={copied} setCopied={setCopied}
          showPrompt={showPrompt} setShowPrompt={setShowPrompt} setError={setError}
          mcpConfigured={mcpConfigured} showMcp={showMcp} setShowMcp={setShowMcp}
          mcpIde={mcpIde} setMcpIde={setMcpIde} setMcpState={setMcpState} setMcpMsg={setMcpMsg} setMcpShowSnippet={setMcpShowSnippet}
          mcpTargets={MCP_TARGETS} mcpState={mcpState} mcpMsg={renderMsg(mcpMsg, t)} mcpShowSnippet={mcpShowSnippet}
          builtEntry={builtEntry} verityState={verity.state} verityHeuristics={verity.heuristics} verityAgent={verity.agent} fixRound={verity.fixRound}
          onLaunchApp={(dir, label) => { void launchAppWindow(dir, label); }}
          onOpenAppDir={openAppDir}
          onBack={() => setView('dashboard')}
          onSetView={setView}
          onViewDoc={viewDoc}
          onGenerateArtifact={(art) => { void generateArtifact(art); }}
          onAutoConfigureMcp={() => { void autoConfigureMcp(); }}
          onViewBuiltApp={() => { void viewBuiltApp(); }}
        />
      )}

      {/* ── Design Studio: dedicated module (colors / styles / fx / trends) ─ */}
      {view === 'design' && (
        <DesignStudio
          projectName={name || t('board.untitled')}
          lane={lane}
          hue={designHue} setHue={(h) => { setDesignHue(h); setHueTouched(true); setDesignState('idle'); }}
          harmony={designHarmony} setHarmony={(h) => { setDesignHarmony(h); setDesignState('idle'); }}
          styleId={designStyle} setStyleId={(id) => { setDesignStyle(id); setDesignState('idle'); }}
          fx={designFor === 'pref' ? new Set(prefMix.effects) : designFx}
          setFx={(f) => {
            if (designFor === 'pref') { setPrefMix((m) => ({ ...m, effects: [...f] })); setPrefState('idle'); return; }
            setDesignFx(f); setDesignState('idle');
          }}
          saveState={designState}
          error={renderMsg(error, t)}
          refState={refState}
          refMsg={renderMsg(refMsg, t)}
          libraries={libraries}
          odPreview={odPreview}
          odState={odState}
          odMsg={renderMsg(odMsg, t)}
          odProgress={odProgress}
          odElapsed={odElapsed}
          designSystem={designFor === 'doc' ? docSystem : designSystem}
          onImportOdCatalog={() => { void importOdCatalog(); }}
          onCheckOdCatalog={() => { void checkOdCatalog(); }}
          onOpenOdFolder={() => { void openOdFolder(); }}
          onOpenOdSystem={(id) => { void openOdSystem(id); }}
          mode={designFor}
          mix={designMix}
          inherited={inheritingPref}
          prefState={prefState}
          onSavePref={() => { void saveDesignPref(); }}
          resolved={designResolved}
          onAssignRole={assignRole}
          onClearRole={clearRole}
          onSetFontRole={setFontRole}
          onUseOdSystem={(sys) => {
            setOdSystems((prev) => new Map(prev).set(sys.id, sys));
            if (designFor === 'doc') {
              setDocSystem(sys); setDocStyle(null); setDocSystemMissing(null);
              setView(designBack);
            } else { setDesignSystem(sys); setDesignState('idle'); }
          }}
          onClearOdSystem={() => {
            if (designFor === 'doc') { setDocSystem(null); setDocSystemMissing(null); }
            else { setDesignSystem(null); setDesignState('idle'); }
          }}
          onSave={saveDesign}
          onBack={() => {
            if (designFor === 'doc') { setView(designBack); return; }
            setBoardStep('design'); setView('handoff');
          }}
          onViewTokens={() => viewDoc('design-tokens.json', joinPath(appDir, 'design-tokens.json'))}
        />
      )}

      {/* ── Truth Studio: the whole repair loop on ONE dedicated screen ──── */}
      {view === 'verify' && (
        <TruthStudio
          projectName={name || t('board.untitled')}
          tier={verity.tier}
          setTier={verity.setTier}
          state={verity.state}
          msg={renderMsg(verity.msg, t)}
          error={renderMsg(error, t)}
          heuristics={verity.heuristics}
          agent={verity.agent}
          userNote={verity.userNote}
          setUserNote={verity.setUserNote}
          ideReply={verity.ideReply}
          setIdeReply={verity.setIdeReply}
          fixRound={verity.fixRound}
          canRun={!!builtEntry || projFiles.some((f) => /\.(html?|js|jsx|ts|tsx)$/i.test(f.rel))}
          hasReport={projFiles.some((f) => f.rel === 'docs/VERITY.md')}
          hasLog={projFiles.some((f) => f.rel === 'docs/VERITY-LOG.md')}
          onRun={() => { void verity.run(); }}
          onArchive={() => { void verity.saveIdeReply(); }}
          onCopyFix={() => {
            void (async () => {
              const round = verity.fixRound + 1;
              const ok = await copyText(buildVerityFixPrompt({ appDir, heuristics: verity.heuristics, agent: verity.agent, round, userNote: verity.userNote.trim() || undefined }));
              if (ok) verity.setFixRound(round);
              verity.setMsg(ok
                ? { key: 'verity.fixPromptCopied', vars: { n: round, noteSuffix: verity.userNote.trim() ? t('verity.fixPromptWithNote') : '' } }
                : { key: 'verity.fixCopyBlocked' });
            })();
          }}
          onViewReport={() => viewDoc('docs/VERITY.md', joinPath(joinPath(appDir, 'docs'), 'VERITY.md'))}
          onViewLog={() => viewDoc('docs/VERITY-LOG.md', joinPath(joinPath(appDir, 'docs'), 'VERITY-LOG.md'))}
          onBack={() => { setBoardStep('verify'); setView('handoff'); }}
        />
      )}

      {/* ── Doc library: folder tree + reader side by side ──────────────── */}
      {view === 'docs' && (
        <DocsScreen
          t={t} selDoc={selDoc} docQuery={docQuery} setDocQuery={setDocQuery}
          docsState={docsState} folder={folder} docs={docs} docMatches={docMatches}
          docTree={docTree} expanded={expanded} readerLoading={readerLoading} docContent={docContent}
          installables={INSTALLABLES}
          onBack={() => setView('dashboard')}
          onInstallClick={(item) => { setCloneTarget(item); setCloning('confirm'); }}
          onGoOnboarding={resetOnboarding}
          onToggleFolder={toggleFolder}
          onOpenDoc={openDoc}
          onOpenExternal={openExternal}
        />
      )}

      {/* ── Create: give it a name ──────────────────────────────────────── */}
      {view === 'name' && (
        <NameScreen
          t={t} purpose={purpose} name={name}
          onNameChange={setName}
          onGenerate={() => { void generate(); }}
          onAdvanced={() => { setStudioSeed(null); advSpend.current.usd = 0; setView('docstudio'); }}
          onBack={() => setView('dashboard')}
        />
      )}

      {/* ── Create: advanced document builder (plan → blocks → assemble) ── */}
      {view === 'docstudio' && (
        <DocStudio
          key={studioSeed?.docId ?? 'fresh'}
          name={name} purpose={purpose}
          tier={docTier} setTier={setDocTier}
          stylePresetId={docStyle}
          memoryName={memMode === 'pick' ? memoryLabel(memVault) : undefined}
          svgAllowed={docSvg}
          images={docImages}
          onOpenImages={() => setImgPanel(true)}
          savedBuild={savedBuild}
          initialBuild={studioSeed}
          onCheckpoint={checkpointBuild}
          runInfer={runAdvInfer}
          resolveHtml={(h) => resolveDocHtml(h, docImages)}
          onSave={saveAdvancedTake}
          onBack={() => setView(studioSeed ? 'done' : 'dashboard')}
        />
      )}

      {/* ── Generating ──────────────────────────────────────────────────── */}
      {view === 'generating' && <GeneratingScreen t={t} name={name} genStage={genStage} docTier={docTier} />}

      {/* ── Done: it runs ───────────────────────────────────────────────── */}
      {view === 'done' && (
        <DoneScreen
          t={t} lang={lang} name={name} purpose={purpose} doneFrom={doneFrom} memVault={memVault}
          docVersions={docVersions} curVersion={curVersion} appHtml={appHtml} appHtmlView={appHtmlView}
          regenOpen={regenOpen} setRegenOpen={setRegenOpen} docSaving={docSaving} folder={folder}
          savedDocPath={savedDocPath} docMsg={docMsg} docOk={docOk}
          docTier={docTier} setDocTier={setDocTier} docStyle={docStyle} setDocStyle={pickDocStyle}
          docSystem={docSystem} docSystemMissing={docSystemMissing} onPickDocSystem={() => pickDocSystem('done')}
          docFormat={docFormat} setDocFormat={setDocFormat} docImages={docImages} docSvg={docSvg}
          onSaveDocument={() => { void saveDocument(); }}
          onOpenSavedDoc={() => { void openSavedDoc(); }}
          onBack={() => setView('dashboard')}
          onSelectVersion={(v) => {
            setAppHtml(v.html); setCurVersion(v.version); setDocStyle(v.style);
            // Switching version switches its memory too — otherwise the
            // badge above would describe one take while another is on
            // screen, and a regen would start from the wrong scope.
            if (v.memSource) setMemVault(v.memSource);
            setGrounding(v.grounding);
            if (v.tier === 'eco' || v.tier === 'standard' || v.tier === 'max') setDocTier(v.tier);
            if (v.format) setDocFormat(v.format);
            setDocSvg(v.svg);
            setDocImages(v.images);
            setTakeImages(v.images);
            setDocMsg(''); setDocOk(null); setSavedDocPath('');
          }}
          onOpenImgPanel={() => setImgPanel(true)}
          onToggleSvg={() => setDocSvg((v) => !v)}
          onRegenerate={() => {
            const next = Math.max(...docVersions.map((v) => v.version), 0) + 1;
            void generate({ docId: curDocId || `${slugify(name) || 'document'}#${Date.now()}`, nextVersion: next });
          }}
          onReopenStudio={curDocId && savedBuilds[curDocId]
            ? () => { setStudioSeed(savedBuilds[curDocId]); advSpend.current.usd = 0; setView('docstudio'); }
            : null}
        />
      )}

      {/* ── Delete a project: say exactly what goes and what stays ──────── */}
      {delTarget && (
        <div style={S.overlay} onClick={() => { if (!deleting) { setDelTarget(null); setDelFiles(false); } }}>
          <div role="dialog" aria-modal="true" aria-label={t('del.title', { name: delTarget.name })} style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.h1small}>{t('del.title', { name: delTarget.name })}</h2>
            {(() => {
              const versions = delTarget.versions?.length ?? 0;
              const rows = delTarget.rowIds?.length ?? 0;
              return (
                <>
                  <p style={S.sub}>
                    {versions > 1 ? t('del.bodyVersions', { count: versions }) : t('del.bodyOne')}
                    {' '}{t('del.definitive')}
                  </p>
                  {delTarget.path && (
                    <>
                      <button style={{ ...S.delFilesRow, ...(delFiles ? S.delFilesOn : {}) }} onClick={() => setDelFiles((v) => !v)}>
                        <span style={{ ...S.memCheck, ...(delFiles ? { border: '1px solid color-mix(in srgb, var(--mu-err-bg) 70%, transparent)', background: 'color-mix(in srgb, var(--mu-err-bg) 30%, transparent)', color: 'var(--mu-err)' } : {}) }}>{delFiles && <GCheck size={9} />}</span>
                        <GFolder size={13} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {t('del.filesOption')}
                        </span>
                      </button>
                      <p style={S.sub}>
                        {delFiles ? `⚠️ ${t('del.filesOn')}` : t('del.filesOff')}
                        {' '}<code style={S.pathCode}>{delTarget.path}</code>
                      </p>
                    </>
                  )}
                  {rows === 0 && (
                    <p style={{ ...S.sub, color: 'var(--mu-err)' }}>
                      ⚠️ {t('del.noId')}
                    </p>
                  )}
                </>
              );
            })()}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="mu-btn mu-danger"
                style={{ ...S.dangerBtn, ...(deleting ? { opacity: 0.6, cursor: 'wait' } : {}) }}
                disabled={deleting}
                onClick={() => { void confirmDelete(); }}
              ><GTrash size={13} />{t(deleting ? 'del.working' : delFiles ? 'del.confirmFiles' : 'del.confirm')}</button>
              <button className="mu-btn" style={S.secondary} disabled={deleting} onClick={() => { setDelTarget(null); setDelFiles(false); }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Memory drawer: pick none / all / a mix of vaults ─────────────── */}
      {memPanel && (
        <div style={S.memOverlay} onClick={() => setMemPanel(false)}>
          <aside role="dialog" aria-modal="true" aria-label={t('mem.label')} style={S.memDrawer} onClick={(e) => e.stopPropagation()}>
            <div style={S.memDrawerHead}>
              <p style={S.memDrawerTitle}><GMemory size={14} />{t('mem.label')}</p>
              <button className="mu-btn" style={S.linkBtn} aria-label={t('common.closeLabel')} onClick={() => setMemPanel(false)}><GClose size={12} /></button>
            </div>

            {/* Three modes on ONE row — the drawer's job is the vault pad. */}
            <div style={S.memModes}>
              {([
                ['none', GBan, 'mem.modeNone'],
                ['all', GGlobe, 'mem.modeAll'],
                ['pick', GSliders, 'mem.modePick'],
              ] as const).map(([m, Icon, labelKey]) => (
                <button
                  key={m}
                  className="mu-btn"
                  style={{ ...S.memModeCard, ...(memoryMode(memVault) === m ? S.memModeOn : {}) }}
                  title={t(m === 'none' ? 'mem.hintNone' : m === 'all' ? 'mem.hintAll' : 'mem.hintPick')}
                  onClick={() => {
                    if (m === 'pick') { if (memoryMode(memVault) !== 'pick') setMemVault({ mode: 'pick', vaults: [] }); }
                    else setMemVault({ mode: m, vaults: [] });
                  }}
                ><Icon size={12} />{t(labelKey)}</button>
              ))}
            </div>

            {/* Vault pad — foldable families + tiles, same reading as the host. */}
            <div style={S.memDrawerBody}>
              {memVaults.length === 0 && <p style={S.empty}>{t('mem.noVaults')}</p>}
              {VAULT_TYPES.map((type) => {
                const list = memVaults.filter((v) => v.type === type);
                if (!list.length) return null;
                const folded = memFolded.has(type);
                return (
                  <div key={type} style={S.memSection}>
                    <button
                      style={S.memGroupHead}
                      onClick={() => setMemFolded((cur) => {
                        const next = new Set(cur);
                        if (next.has(type)) next.delete(type); else next.add(type);
                        return next;
                      })}
                    >
                      <span style={S.memCaret}>{folded ? '▸' : '▾'}</span>
                      <span style={{ ...S.memDot, background: VAULT_TINT[type] }} />
                      <span style={S.memGroupName}>{type}</span>
                      <span style={S.memCount}>{list.length}</span>
                    </button>
                    {!folded && (
                      <div style={S.memGrid}>
                        {list.map((v) => {
                          const on = (memVault?.vaults ?? []).some((x) => x.vaultId === v.vaultId);
                          return (
                            <button
                              key={v.vaultId}
                              className="mu-btn"
                              style={{
                                ...S.memTile,
                                borderColor: on ? VAULT_TINT[type] : 'var(--mu-line)',
                                background: on ? 'color-mix(in srgb, var(--mu-accent) 12%, transparent)' : 'var(--mu-wash)',
                              }}
                              title={`${v.chronicleCount === null ? t('mem.countUnknown') : t('mem.countKnown', { n: v.chronicleCount })}${v.locked ? ` · ${t('mem.protected')}` : ''}`}
                              onClick={() => setMemVault((cur) => {
                                const current = memoryMode(cur) === 'pick' ? (cur?.vaults ?? []) : [];
                                const next = current.some((x) => x.vaultId === v.vaultId)
                                  ? current.filter((x) => x.vaultId !== v.vaultId)
                                  : [...current, { vaultId: v.vaultId, displayName: v.displayName }];
                                return next.length ? { mode: 'pick', vaults: next } : { mode: 'all', vaults: [] };
                              })}
                            >
                              <span style={S.memTileTop}>
                                {v.locked && <span style={S.memLock}><GLock size={10} /></span>}
                                <span style={{ ...S.memTileCheck, ...(on ? { ...S.memCheckOn, borderColor: VAULT_TINT[type] } : {}) }}>{on && <GCheck size={9} />}</span>
                              </span>
                              <span style={S.memTileName}>{v.displayName}</span>
                              <span style={S.memTileCount}>{v.chronicleCount ?? '—'}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={S.memDrawerFoot}>
              <span style={S.memDrawerSub}>{t('mem.kept')} <b>{memLabelUI(memVault, t)}</b></span>
              <button className="mu-btn mu-cta" style={S.launchBtn} onClick={() => setMemPanel(false)}>{t('common.done')}</button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Image picker: a folder the user explicitly chose, never the whole
             app space (see imgSourceDir's comment: that folder is shared
             product furniture, not personal pictures). ────────────────── */}
      {imgPanel && (
        <div style={S.memOverlay} onClick={() => setImgPanel(false)}>
          <aside role="dialog" aria-modal="true" aria-label={t('brief.imagesTitle')} style={S.memDrawer} onClick={(e) => e.stopPropagation()}>
            <div style={S.memDrawerHead}>
              <p style={S.memDrawerTitle}><GFolder size={14} />{t('brief.imagesTitle')}</p>
              <button className="mu-btn" style={S.linkBtn} aria-label={t('common.closeLabel')} onClick={() => setImgPanel(false)}><GClose size={12} /></button>
            </div>
            <div style={S.memDrawerBody}>
              <div style={S.imgFolderRow}>
                <span style={S.imgFolderPath} title={imgSourceDir ?? undefined}>
                  {imgSourceDir ? imgSourceDir.split(/[\\/]/).pop() : t('brief.imagesNoFolder')}
                </span>
                <button className="mu-btn" style={S.secondary} onClick={() => { void pickImageFolder(); }}>
                  <GFolder size={12} />{imgSourceDir ? t('brief.imagesChangeFolder') : t('brief.imagesPickFolder')}
                </button>
              </div>
              {!imgSourceDir && <p style={S.empty}>{t('brief.imagesPickFolderHint')}</p>}
              {imgScan === 'scanning' && <p style={S.empty}>{t('brief.imagesScanning')}</p>}
              {imgScan === 'done' && spaceImages.length === 0 && <p style={S.empty}>{t('brief.imagesEmpty')}</p>}
              {spaceImages.length > 0 && (
                <div style={S.memGrid}>
                  {spaceImages.map((img) => {
                    const on = docImages.some((x) => x.path === img.path);
                    return (
                      <button
                        key={img.path}
                        className="mu-btn"
                        style={{
                          ...S.memTile,
                          borderColor: on ? 'color-mix(in srgb, var(--mu-accent) 60%, transparent)' : 'var(--mu-line)',
                          background: on ? 'color-mix(in srgb, var(--mu-accent) 12%, transparent)' : 'var(--mu-wash)',
                        }}
                        title={img.rel}
                        onClick={() => setDocImages((cur) =>
                          cur.some((x) => x.path === img.path) ? cur.filter((x) => x.path !== img.path) : [...cur, img])}
                      >
                        <span style={S.memTileTop}>
                          <span style={{ ...S.memTileCheck, ...(on ? { ...S.memCheckOn, borderColor: 'color-mix(in srgb, var(--mu-accent) 60%, transparent)' } : {}) }}>{on && <GCheck size={9} />}</span>
                        </span>
                        <span style={S.memTileName}>{img.rel.split('/').pop()}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* A bare file name rarely tells the model what a photo shows,
                  so with no caption it usually just skips the image — the
                  "generation doesn't work" a user sees from the outside.
                  One text field per PICKED image, not per tile: most stay
                  unselected, describing all of them would be noise. */}
              {docImages.length > 0 && (
                <div style={S.imgCaptionList}>
                  <p style={S.memLabel}>{t('brief.imagesCaptionLabel')}</p>
                  {docImages.map((img) => (
                    <div key={img.path} style={S.imgCaptionRow}>
                      <span style={S.imgCaptionName} title={img.rel}>{img.rel.split('/').pop()}</span>
                      <input
                        style={S.imgCaptionInput}
                        placeholder={t('brief.imagesCaptionPlaceholder')} aria-label={t('brief.imagesCaptionPlaceholder')}
                        value={img.caption ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDocImages((cur) => cur.map((x) => x.path === img.path ? { ...x, caption: val } : x));
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={S.memDrawerFoot}>
              <span style={S.memDrawerSub}>{docImages.length ? t('brief.imagesCount', { n: docImages.length }) : t('brief.imagesNone')}</span>
              <button className="mu-btn mu-cta" style={S.launchBtn} onClick={() => setImgPanel(false)}>{t('common.done')}</button>
            </div>
          </aside>
        </div>
      )}

      {view !== 'intro' && view !== 'ready' && <Footer onReset={resetOnboarding} museVersion={MUSE_VERSION} />}

      {/* ── In-app doc viewer (artifacts, BRIEF) ────────────────────────── */}
      {artView && (
        <div style={S.overlay} onClick={() => setArtView(null)}>
          <div role="dialog" aria-modal="true" aria-label={artView.title} style={S.viewerModal} onClick={(e) => e.stopPropagation()}>
            <div style={S.viewerHead}>
              <span style={S.viewerTitle}>📄 {artView.title}</span>
              {artView.mermaids.map((code, i) => (
                <button key={i} className="mu-btn" style={S.installBtn} onClick={() => openExternal(mermaidLiveUrl(code))}>
                  {t('doc.diagramView', { n: artView.mermaids.length > 1 ? i + 1 : '' })}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button className="mu-btn" style={S.linkBtn} onClick={() => setArtView(null)}>{t('common.close')}</button>
            </div>
            <div style={S.viewerBody}>
              {artView.kind === 'html'
                ? <iframe title={artView.title} sandbox="allow-scripts" srcDoc={artView.content} style={{ width: '100%', height: '62vh', border: 'none', borderRadius: '10px', background: '#fff' }} />
                : <Markdown source={artView.content} onLink={openExternal} />}
            </div>
          </div>
        </div>
      )}

      {cloning !== 'idle' && cloneTarget && (
        <div style={S.overlay}>
          <div role="dialog" aria-modal="true" aria-label={t('install.confirmTitle')} style={S.modal}>
            {cloning === 'confirm' && (
              <>
                <h2 style={S.h1small}>{t('install.confirmTitle')}</h2>
                <RepoCard repo={cloneTarget.repo} desc={t(`install.desc.${cloneTarget.id}`)} />
                <p style={S.sub}>{t('install.repoPre')} <b style={{ color: 'var(--mu-link)' }}>{t('install.repoBold')}</b> {t('install.repoEnd')}</p>
                <code style={S.code}>{cloneDest}</code>
                <button className="mu-btn" style={S.ideLinkPrimary} onClick={() => openExternal(cloneTarget.repo)}>{t('install.verifyGithub')}</button>
                <button style={S.primary} onClick={() => startClone(cloneTarget)}>{t('install.authorize')}</button>
                <button style={S.back} onClick={() => { setCloning('idle'); setCloneTarget(null); }}>{t('common.cancel')}</button>
              </>
            )}
            {cloning === 'running' && (
              <>
                <Logo mode="ambient" />
                <h2 style={S.h1small}>{t('install.installing', { name: cloneTarget.name })}</h2>
                {cloneCount !== null && <p style={S.sub}>{t('install.cloningInProgress', { n: cloneCount })}</p>}
              </>
            )}
            {cloning === 'done' && (
              <>
                <div style={S.hero}>✅</div>
                <h2 style={S.h1small}>{t('install.doneTitle')}</h2>
                <p style={S.sub}>{t('install.doneDesc', { name: cloneTarget.name })}</p>
                <button style={S.primary} onClick={() => { setCloning('idle'); setCloneTarget(null); }}>{t('install.great')}</button>
              </>
            )}
            {cloning === 'error' && (
              <>
                <div style={S.hero}>😕</div>
                <h2 style={S.h1small}>{t('install.notAvailable')}</h2>
                <p style={S.sub}>{renderMsg(cloneMsg, t)}</p>
                <p style={S.soonNote}><b>{t('install.manualMode')}</b></p>
                <code style={S.code}>{`git clone ${cloneTarget.repo} "${cloneDest}"`}</code>
                <button
                  className="mu-btn" style={S.secondary}
                  onClick={async () => {
                    const ok = await copyText(`git clone ${cloneTarget.repo} "${cloneDest}"`);
                    if (!ok) setCloneMsg({ key: 'install.copyBlocked' });
                    openExternal(cloneTarget.repo);
                  }}
                >{t('install.copyOpenGithub')}</button>
                <button style={S.primary} onClick={() => { setCloning('idle'); setCloneTarget(null); }}>{t('install.ok')}</button>
              </>
            )}
          </div>
        </div>
      )}

      <style>{KEYFRAMES}</style>
    </div>
  );
}

