// Muse's visual chrome: the animated mark, small stateless presentational
// components (logo, footer, doc-tree, repo card), the global keyframes/CSS,
// and the giant style dictionary `S` App.tsx's whole render tree draws from.
// Extracted out of App.tsx (which used to define all of this after its own
// ~3260-line component body) — none of it touches App()'s state or hooks,
// so it moves verbatim with zero behavior change.
import { useEffect, useState, type CSSProperties } from 'react';
import { useI18n } from './i18n/useI18n';
import type { DocEntry, DocFolder } from './appLogic';
import manifest from '../mnemo-plugin.json';

// Constellation "M" — nodes A..E, edges drawn left→right so the M "writes" itself.
const M_NODES: Array<[number, number]> = [
  [45, 150], [65, 52], [100, 105], [135, 52], [155, 150],
];
const M_EDGES: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4]];

// Gears that assemble and mesh around the M as it draws itself.
const GEARS = [
  { cx: 150, cy: 140, r: 24, teeth: 9, dur: 9, dir: 'normal', inDelay: 0.1 },
  { cx: 50, cy: 62, r: 17, teeth: 8, dur: 7, dir: 'reverse', inDelay: 0.35 },
  { cx: 142, cy: 50, r: 11, teeth: 7, dur: 5, dir: 'normal', inDelay: 0.55 },
] as const;

function gearTeeth(r: number, teeth: number) {
  const fill = 'rgba(96,140,205,0.5)';
  const tw = r * 0.36, th = r * 0.42;
  return (
    <>
      {Array.from({ length: teeth }).map((_, i) => (
        <rect key={i} x={-tw / 2} y={-r - th * 0.4} width={tw} height={th} rx={tw * 0.28} fill={fill} transform={`rotate(${(i * 360) / teeth})`} />
      ))}
      <circle r={r * 0.82} fill={fill} />
      <circle r={r * 0.34} fill="#0b1730" />
    </>
  );
}

/** Stylized editor marks (clean stand-ins — swap for official brand SVGs later). */
export function LogoIcon({ id }: { id: string }) {
  if (id === 'vscode') return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden>
      <path d="M16.8 3.3 L7.4 12 L16.8 20.7 L20.4 19 V5 Z" fill="#2ea0ee" />
      <path d="M7.4 12 L3.9 9.3 V14.7 Z" fill="#1f7fc0" />
    </svg>
  );
  if (id === 'cursor') return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <path d="M5 3 L19 12 L12.4 12.9 L16 20 L13.2 21.2 L9.6 14 L5 18 Z" fill="#d7dee8" />
    </svg>
  );
  if (id === 'antigravity') return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-28 12 12)" stroke="#8b7cf0" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" fill="#8b7cf0" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <g stroke="#d97757" strokeWidth="2.2" strokeLinecap="round">
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={12 + 3 * Math.cos(a)} y1={12 + 3 * Math.sin(a)} x2={12 + 8.5 * Math.cos(a)} y2={12 + 8.5 * Math.sin(a)} />;
        })}
      </g>
    </svg>
  );
}

/**
 * The Muse mark. Modes:
 *  - 'intro'   : one-shot cinematic (gears assemble, M draws, halo).
 *  - 'ambient' : M lit + gears spinning continuously (side accent on every screen).
 *  - 'static'  : still M (small inline mark).
 */
export function Logo({ mode = 'static' }: { mode?: 'intro' | 'static' | 'ambient' | 'mark' }) {
  const anim = mode === 'intro';
  const showGears = mode !== 'static' && mode !== 'mark';
  const svgStyle = mode === 'intro' ? S.emblem : mode === 'ambient' ? S.emblemSide : mode === 'mark' ? S.emblemMark : S.emblemSmall;
  return (
    <svg viewBox="0 0 200 200" style={svgStyle} aria-hidden>
      <defs>
        <linearGradient id="gb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--mu-link)" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {showGears && GEARS.map((g, i) => {
        const spin = (
          <g className="ab-gearspin" style={{ animationDelay: anim ? `${g.inDelay + 0.7}s` : '0s', animationDuration: `${g.dur}s`, animationDirection: g.dir }}>
            {gearTeeth(g.r, g.teeth)}
          </g>
        );
        return (
          <g key={`g${i}`} transform={`translate(${g.cx} ${g.cy})`}>
            {anim ? <g className="ab-gearin" style={{ animationDelay: `${g.inDelay}s` }}>{spin}</g> : spin}
          </g>
        );
      })}
      {anim
        ? <circle cx="100" cy="100" r="52" className="ab-halo" fill="none" stroke="var(--mu-accent)" strokeWidth="1.2" />
        : <circle cx="100" cy="100" r="52" fill="none" stroke="var(--mu-accent)" strokeWidth="1.2" opacity={0.12} />}
      {M_EDGES.map(([a, b], i) => (
        <line
          key={`e${i}`} x1={M_NODES[a][0]} y1={M_NODES[a][1]} x2={M_NODES[b][0]} y2={M_NODES[b][1]}
          stroke="url(#gb)" strokeWidth="2.6" strokeLinecap="round"
          className={anim ? 'ab-spoke' : ''} style={anim ? { animationDelay: `${0.2 + i * 0.3}s` } : undefined}
        />
      ))}
      {M_NODES.map(([x, y], i) => (
        <circle
          key={`n${i}`} cx={x} cy={y} r="6" fill="url(#gb)"
          className={anim ? 'ab-node' : ''} style={anim ? { animationDelay: `${0.1 + i * 0.3}s` } : undefined}
        />
      ))}
    </svg>
  );
}

/** Release channel, read off the manifest's semver pre-release tag
 *  (1.0.0-beta.2 → "beta"). Shipping a final x.y.z clears it everywhere. */
const CHANNEL = /-(alpha|beta|rc)\.\d+$/.exec(manifest.version)?.[1] ?? null;

/** Channel pill next to the wordmark — hairline, never an emoji (doc 59). */
export function ChannelBadge({ size = 'md' }: { size?: 'md' | 'lg' }) {
  if (!CHANNEL) return null;
  return <span style={size === 'lg' ? { ...S.channel, ...S.channelLg } : S.channel}>{CHANNEL}</span>;
}

/** Ambient Muse mark pinned to the side — shows on every screen but the intro. */
export function SideLogo() {
  return <div className="side-logo" style={S.sideLogo}><Logo mode="ambient" /></div>;
}

/** Open-book glyph for the header action bar. */
export function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--mu-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 6.5C10.4 5 8 4.5 5.5 4.5c-.8 0-1.5.1-2 .2V18c.5-.1 1.2-.2 2-.2 2.5 0 4.9.5 6.5 2 1.6-1.5 4-2 6.5-2 .8 0 1.5.1 2 .2V4.7c-.5-.1-1.2-.2-2-.2-2.5 0-4.9.5-6.5 2Z" />
      <path d="M12 6.5v13.3" />
    </svg>
  );
}

/** Recursive folder tree for the doc library sidebar. */
export function DocTreeView({ folder, depth, expanded, selRel, onToggle, onOpen }: {
  folder: DocFolder;
  depth: number;
  expanded: Set<string>;
  selRel: string | null;
  onToggle: (rel: string) => void;
  onOpen: (doc: DocEntry) => void;
}) {
  /** Left padding per tree depth, so nested folders/files step in visually. */
  const indent = (level: number): CSSProperties => ({ paddingLeft: `${10 + level * 14}px` });
  return (
    <>
      {folder.files.map((d) => (
        <button
          key={d.rel}
          style={{ ...S.treeFile, ...indent(depth), ...(selRel === d.rel ? S.treeFileOn : {}) }}
          title={d.rel}
          onClick={() => onOpen(d)}
        >
          <span style={S.docIcon}>📄</span>
          <span style={S.treeLabel}>{d.name}</span>
        </button>
      ))}
      {folder.folders.map((f) => {
        const open = expanded.has(f.rel);
        return (
          <div key={f.rel}>
            <button style={{ ...S.treeFolder, ...indent(depth) }} title={f.rel} onClick={() => onToggle(f.rel)}>
              <span style={S.treeCaret}>{open ? '▾' : '▸'}</span>
              <span style={S.docIcon}>{open ? '📂' : '📁'}</span>
              <span style={S.treeLabel}>{f.name}</span>
              <span style={S.treeCount}>{f.count}</span>
            </button>
            {open && (
              <DocTreeView
                folder={f}
                depth={depth + 1}
                expanded={expanded}
                selRel={selRel}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/** Repo preview card — shows it's an official Mnemosyne repo (web thumbnail + fallback). */
export function RepoCard({ repo, desc }: { repo: string; desc: string }) {
  const { t } = useI18n();
  const [imgOk, setImgOk] = useState(true);
  const slug = repo.replace(/^https:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  const og = `https://opengraph.githubassets.com/muse/${slug}`;
  return (
    <div style={S.repoCard}>
      {imgOk && <img src={og} alt="" style={S.repoImg} onError={() => setImgOk(false)} />}
      <div style={S.repoBody}>
        <span style={S.repoName}>{slug.replace('/', ' / ')}</span>
        <span style={S.repoDesc}>{desc}</span>
        <span style={S.repoTrust}>{t('install.officialVerified')}</span>
      </div>
    </div>
  );
}

/** Close an overlay on Escape.
 *
 *  Every overlay in Muse already closed on a backdrop click, which is a mouse
 *  gesture: with the keyboard there was no way out at all. Pass `undefined`
 *  while the overlay must NOT be dismissable (a clone in flight) and no
 *  listener is registered — the guard belongs here, not at every call site. */
export function useEscape(onClose: (() => void) | undefined): void {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** Bottom footer: Mnemosyne ∞ mark + the Muse version + onboarding reset. */
export function Footer({ onReset, museVersion }: { onReset?: () => void; museVersion: string }) {
  const { t } = useI18n();
  const d = 'M14,20 C14,9 30,9 40,20 C50,31 66,31 66,20 C66,9 50,9 40,20 C30,31 14,31 14,20 Z';
  return (
    <footer style={S.footer}>
      <svg viewBox="0 0 80 40" style={S.footInf} aria-hidden>
        <path d={d} fill="none" stroke="rgba(95,111,146,0.35)" strokeWidth="4" strokeLinecap="round" />
        <path d={d} fill="none" stroke="#8fa3c9" strokeWidth="4" strokeLinecap="round" pathLength={240} strokeDasharray="20 220" className="ab-infrun" style={{ animationDelay: '0s' }} />
      </svg>
      <span>Mnemosyne OS</span>
      <span style={{ opacity: 0.45 }}>·</span>
      <span>Muse v{museVersion}</span>
      {onReset && <button style={S.footReset} onClick={onReset}>{t('install.onboardingButton')}</button>}
    </footer>
  );
}

/** Mnemosyne's infinity mark, as a loading beat at the end of the intro. */
export function InfinityLoader({ immediate = false }: { immediate?: boolean }) {
  const d = 'M14,20 C14,9 30,9 40,20 C50,31 66,31 66,20 C66,9 50,9 40,20 C30,31 14,31 14,20 Z';
  return (
    <div className="ab-inf-wrap" style={immediate ? { ...S.infWrap, animationDelay: '0.2s' } : S.infWrap}>
      <svg viewBox="0 0 80 40" style={S.inf} aria-hidden>
        <path d={d} fill="none" stroke="color-mix(in srgb, var(--mu-link) 18%, transparent)" strokeWidth="3" strokeLinecap="round" />
        <path d={d} fill="none" stroke="var(--mu-link)" strokeWidth="3" strokeLinecap="round" pathLength={240} strokeDasharray="20 220" className="ab-infrun" style={immediate ? { animationDelay: '0.4s' } : undefined} />
      </svg>
      <span style={S.infText}>Mnemosyne OS</span>
    </div>
  );
}

/** Primary button, dimmed + disabled when the current step is incomplete. */
export function btn(disabled: boolean): CSSProperties {
  return disabled ? { ...S.primary, opacity: 0.45, cursor: 'not-allowed' } : S.primary;
}

export const KEYFRAMES = `
  /* Slim, quiet scrollbars everywhere — the chunky OS default is ugly in-app. */
  * { scrollbar-width: thin; scrollbar-color: var(--mu-scroll) transparent; }
  *::-webkit-scrollbar { width: 9px; height: 9px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: var(--mu-scroll); border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
  *::-webkit-scrollbar-thumb:hover { background: var(--mu-scroll-hover); border: 3px solid transparent; background-clip: padding-box; }
  *::-webkit-scrollbar-corner { background: transparent; }
  @keyframes ab-draw { to { stroke-dashoffset: 0; } }
  @keyframes ab-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.4); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes ab-halo { 0% { transform: scale(0.3); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }
  @keyframes ab-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ab-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ab-spin { to { transform: rotate(360deg); } }
  @keyframes mu-ready-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
  @keyframes mu-ready-out { to { opacity: 0; } }
  .mu-ready-in { animation: mu-ready-in 0.5s cubic-bezier(.16,1,.3,1) both; }
  .mu-ready-word { animation: mu-ready-in 0.5s cubic-bezier(.16,1,.3,1) 0.25s both; }
  @keyframes ab-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes ab-gearin { from { opacity: 0; transform: scale(0.3) rotate(-50deg); } to { opacity: 1; transform: scale(1) rotate(0deg); } }
  /* Hairline controls (doc 59): the hover/active states inline styles cannot
     express. ONE ease, 160ms, nothing bounces — a wash lifts, a hairline
     brightens, and the glyph inherits the color change for free. */
  .mu-btn { transition: background-color .16s cubic-bezier(.16,1,.3,1), border-color .16s cubic-bezier(.16,1,.3,1), color .16s cubic-bezier(.16,1,.3,1), transform .16s cubic-bezier(.16,1,.3,1); }
  .mu-btn:hover:not(:disabled) { background-color: var(--mu-wash-2); border-color: var(--mu-line-3); color: var(--mu-text); }
  .mu-btn:active:not(:disabled) { transform: translateY(1px); }
  .mu-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--mu-link) 50%, transparent); }
  /* Keyboard focus has to be VISIBLE on everything reachable, not only on the
     buttons that opted into .mu-btn — inputs, links and plain buttons were
     landing on the browser default, which this app's own outline reset hid. */
  :where(button, [href], input, textarea, select, [tabindex]):focus-visible {
    outline: 2px solid var(--mu-link);
    outline-offset: 2px;
  }
  /* Primary: accent wash + ring, never a saturated fill with white text. */
  .mu-cta:hover:not(:disabled) { background-color: color-mix(in srgb, var(--mu-accent) 24%, transparent); border-color: color-mix(in srgb, var(--mu-accent) 75%, transparent); color: var(--mu-text); }
  /* Destructive keeps its own hue so it never reads as "just another button". */
  .mu-danger:hover:not(:disabled) { background-color: color-mix(in srgb, var(--mu-err-bg) 18%, transparent); border-color: color-mix(in srgb, var(--mu-err-bg) 55%, transparent); color: var(--mu-err); }
  /* Rows: the affordance arrow slides a hair on hover. */
  .mu-row:hover { background-color: var(--mu-wash-2); border-color: var(--mu-line-2); }
  .mu-row .mu-go { transition: transform .16s cubic-bezier(.16,1,.3,1), opacity .16s ease; opacity: .55; }
  .mu-row:hover .mu-go { transform: translateX(3px); opacity: 1; }
  @keyframes ab-run { to { stroke-dashoffset: -240; } }
  /* Indeterminate bar — used ONLY while git is fetching, where no byte count
     exists to make a real percentage out of. It must never be mistaken for
     progress: it slides, it does not fill. */
  @keyframes mu-indet { 0% { left: -38%; } 100% { left: 100%; } }
  .mu-indet { position: absolute; top: 0; bottom: 0; width: 38%; border-radius: 999px; animation: mu-indet 1.35s cubic-bezier(.5,0,.5,1) infinite; }
  .ab-spoke { stroke-dasharray: 120; stroke-dashoffset: 120; animation: ab-draw 0.5s ease forwards; }
  .ab-node { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ab-pop 0.45s cubic-bezier(.2,1.3,.4,1) forwards; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--mu-accent) 70%, transparent)); }
  .ab-halo { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ab-halo 1.2s ease-out forwards; animation-delay: 1.6s; }
  .ab-gearin { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ab-gearin 0.7s ease forwards; }
  .ab-gearspin { transform-box: fill-box; transform-origin: center; animation-name: ab-spin; animation-timing-function: linear; animation-iteration-count: infinite; }
  .ab-word { opacity: 0; animation: ab-rise 0.8s ease forwards; animation-delay: 2.0s; }
  .ab-t1 { opacity: 0; animation: ab-rise 0.7s ease forwards; animation-delay: 2.8s; }
  .ab-t2 { opacity: 0; animation: ab-rise 0.7s ease forwards; animation-delay: 3.6s; }
  .ab-inf-wrap { opacity: 0; animation: ab-rise 0.7s ease forwards; animation-delay: 4.6s; }
  .ab-infrun { animation: ab-run 0.9s linear infinite; animation-delay: 4.8s; }
  @media (max-width: 460px) { .ide-grid { grid-template-columns: 1fr !important; } }
  button { transition: transform .12s ease, filter .15s ease, box-shadow .15s ease; }
  button:hover:not(:disabled) { filter: brightness(1.07); }
  button:active:not(:disabled) { transform: translateY(1px); }
  @media (max-width: 620px) { .side-logo { display: none !important; } }
  @media (max-width: 580px) {
    .docs-body { flex-direction: column !important; }
    .docs-side { width: 100% !important; max-height: 220px; }
  }
  @media (max-width: 760px) {
    .proj-cols { flex-direction: column !important; }
    .proj-files { width: 100% !important; max-height: 200px; }
  }
`;

export const S: Record<string, CSSProperties> = {
  root: {
    height: '100%', boxSizing: 'border-box', color: 'var(--mu-text)',
    background: 'radial-gradient(circle at 50% -10%, var(--mu-glow) 0%, var(--mu-ground) 55%)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    fontFamily: '"Inter", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased',
  },
  sideLogo: { position: 'absolute', right: 'clamp(-24px, 1vw, 24px)', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none', zIndex: 0 },
  emblemSide: { width: 'clamp(130px, 15vw, 190px)', height: 'clamp(130px, 15vw, 190px)', overflow: 'visible' },

  // Intro / logo
  ready: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', userSelect: 'none', padding: 'clamp(16px, 4vw, 28px)', animation: 'mu-ready-out 0.3s ease 1.2s both' },
  readyWord: { fontSize: '15px', letterSpacing: '0.06em', color: 'var(--mu-text-3)' },
  intro: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', cursor: 'pointer', userSelect: 'none', padding: 'clamp(16px, 4vw, 28px)' },
  emblem: { width: 'clamp(104px, 26vw, 138px)', height: 'clamp(104px, 26vw, 138px)', overflow: 'visible' },
  emblemSmall: { width: '84px', height: '84px', overflow: 'visible' },
  emblemMark: { width: '38px', height: '38px', overflow: 'visible', flexShrink: 0 },
  word: { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(34px, 9vw, 46px)', fontWeight: 700, letterSpacing: '0.14em', marginTop: '10px', background: 'linear-gradient(135deg, var(--mu-link), var(--mu-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  t1: { fontSize: '16px', color: 'var(--mu-text-2)', letterSpacing: '0.02em' },
  t2: { fontSize: '13px', color: 'var(--mu-text-3)', textAlign: 'center', lineHeight: 1.6 },
  infWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '12px' },
  inf: { width: '72px', height: '36px', overflow: 'visible' },
  infText: { fontSize: '10px', letterSpacing: '0.2em', color: 'var(--mu-text-4)', textTransform: 'uppercase' },
  footer: { position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px 16px', borderTop: '1px solid var(--mu-wash-2)', fontSize: '11px', color: 'var(--mu-text-4)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  footReset: { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--mu-text-4)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 },
  footInf: { width: '26px', height: '13px', overflow: 'visible' },

  // Onboarding
  ob: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(18px, 4vw, 32px)', gap: '22px' },
  obDots: { display: 'flex', gap: '8px' },
  obBody: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '18px', maxWidth: '520px', animation: 'ab-fade 0.45s ease both' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--mu-line-2)', transition: 'all .3s' },
  dotOn: { background: 'var(--mu-accent)', boxShadow: '0 0 10px color-mix(in srgb, var(--mu-accent) 70%, transparent)', transform: 'scale(1.15)' },
  ideGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', width: '100%', maxWidth: '440px' },
  ideCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '16px 14px', borderRadius: '14px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', color: 'var(--mu-text)', cursor: 'pointer', textAlign: 'center' },
  ideCardOn: { border: '1px solid var(--mu-accent)', background: 'color-mix(in srgb, var(--mu-accent) 12%, transparent)', boxShadow: '0 0 0 1px var(--mu-accent)' },
  ideName: { fontSize: '15px', fontWeight: 700, marginTop: '2px' },
  tagReco: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mu-link)', background: 'color-mix(in srgb, var(--mu-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--mu-accent) 35%, transparent)', borderRadius: '999px', padding: '2px 8px' },
  tagExpert: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e6b980', background: 'rgba(230,150,60,0.12)', border: '1px solid rgba(230,150,60,0.3)', borderRadius: '999px', padding: '2px 8px' },
  ideDesc: { fontSize: '12px', color: 'var(--mu-text-3)' },
  ideLinks: { display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' },
  ideLinkPrimary: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--mu-link)', textDecoration: 'none', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  ideLink: { fontSize: '12px', color: 'var(--mu-text-3)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--mu-text-3)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 },
  pathLabel: { fontSize: '12px', color: 'var(--mu-link)', background: 'color-mix(in srgb, var(--mu-accent) 8%, transparent)', padding: '8px 12px', borderRadius: '8px', wordBreak: 'break-all', maxWidth: '100%' },
  soonNote: { fontSize: '12px', color: 'var(--mu-text-3)', margin: 0 },
  exList: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '440px' },
  exRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', color: 'var(--mu-text)', cursor: 'pointer' },
  exIcon: { fontSize: '20px', width: '26px', textAlign: 'center', flexShrink: 0 },
  exInfo: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 },
  exName: { fontSize: '14px', fontWeight: 600 },
  exDesc: { fontSize: '11px', color: 'var(--mu-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  installBtn: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700, padding: '8px 12px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--mu-accent) 45%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 16%, transparent)', color: 'var(--mu-link)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  installedTag: { fontSize: '12px', fontWeight: 700, color: 'var(--mu-ok)', whiteSpace: 'nowrap', flexShrink: 0 },
  code: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11px', color: 'var(--mu-text-3)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--mu-line)', borderRadius: '8px', padding: '8px 10px', maxWidth: '440px', width: '100%', boxSizing: 'border-box', wordBreak: 'break-all', textAlign: 'left' },
  overlay: { position: 'absolute', inset: 0, background: 'rgba(6,10,22,0.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: '24px', boxSizing: 'border-box' },
  modal: { width: '100%', maxWidth: '420px', background: 'var(--mu-panel)', border: '1px solid var(--mu-line)', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px', boxShadow: '0 30px 80px rgba(0,0,0,0.55)', boxSizing: 'border-box' },
  repoCard: { display: 'flex', flexDirection: 'column', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)' },
  repoImg: { width: '100%', height: 'auto', display: 'block', maxHeight: '150px', objectFit: 'cover' },
  repoBody: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '10px 12px', textAlign: 'left' },
  repoName: { fontSize: '13px', fontWeight: 700, color: 'var(--mu-text)' },
  repoDesc: { fontSize: '11px', color: 'var(--mu-text-3)' },
  repoTrust: { fontSize: '11px', color: 'var(--mu-ok)', fontWeight: 600, marginTop: '2px' },

  // Dashboard. The SCROLLER spans the full view so the scrollbar hugs the
  // window edge; the INNER block centers and caps the content width.
  dash: { flex: 1, minHeight: 0, overflowY: 'auto', width: '100%', boxSizing: 'border-box', animation: 'ab-fade 0.45s ease both' },
  dashInner: { width: '100%', maxWidth: '1080px', margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vw, 24px)', boxSizing: 'border-box' },
  dashHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px' },
  brandName: { fontFamily: 'Georgia, serif', fontSize: '22px', letterSpacing: '0.08em', color: 'var(--mu-text)' },
  brandTag: { fontSize: '11px', color: 'var(--mu-text-4)', textTransform: 'uppercase', letterSpacing: '0.14em' },
  channel: { fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mu-link)', background: 'color-mix(in srgb, var(--mu-accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--mu-link) 35%, transparent)', borderRadius: '999px', padding: '3px 9px', lineHeight: 1.4, alignSelf: 'center', flexShrink: 0 },
  channelLg: { fontSize: '11px', padding: '4px 12px', letterSpacing: '0.2em' },
  wordRow: { display: 'inline-flex', alignItems: 'baseline', gap: '12px', marginTop: '10px' },
  quick: { display: 'flex', flexDirection: 'column', gap: '12px' },
  quickLabel: { fontSize: '18px', fontWeight: 600, color: 'var(--mu-text)' },
  quickInput: { width: '100%', boxSizing: 'border-box', fontSize: '16px', padding: '18px 20px', borderRadius: '16px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-input)', color: 'var(--mu-text)', outline: 'none' },
  cols: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  col: { flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '10px' },
  colTitle: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--mu-text-4)', margin: 0, borderBottom: '1px solid var(--mu-wash-2)', paddingBottom: '8px' },
  empty: { fontSize: '13px', color: 'var(--mu-text-4)', fontStyle: 'italic', margin: '4px 0' },
  stats: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  statCard: { flex: '1 1 120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '14px 10px', borderRadius: '14px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)' },
  statNum: { fontSize: '26px', fontWeight: 700, color: 'var(--mu-link)', lineHeight: 1.1 },
  statLabel: { fontSize: '11px', color: 'var(--mu-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  headActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  iconBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-wash-2)', cursor: 'pointer', padding: 0 },
  docIcon: { display: 'inline-flex', alignItems: 'center', color: 'var(--mu-text-3)', fontSize: '15px', flexShrink: 0 },

  // Doc library (tree + reader)
  docsWrap: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1280px', margin: '0 auto', padding: 'clamp(12px, 2.5vw, 22px)', gap: '12px', boxSizing: 'border-box', animation: 'ab-fade 0.45s ease both' },
  docsBody: { flex: 1, minHeight: 0, display: 'flex', gap: '14px' },
  docsSide: { width: '250px', flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  docsSearch: { boxSizing: 'border-box', width: '100%', fontSize: '12.5px', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--mu-line)', background: 'var(--mu-input)', color: 'var(--mu-text)', outline: 'none', fontFamily: 'inherit' },
  docsTree: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '1px', paddingRight: '4px', borderRadius: '12px', border: '1px solid var(--mu-wash-2)', background: 'var(--mu-wash)', padding: '6px' },
  treeFolder: { display: 'flex', alignItems: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '6px 8px', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--mu-text-2)', cursor: 'pointer', font: 'inherit', fontSize: '12.5px', fontWeight: 600 },
  treeCaret: { fontSize: '10px', color: 'var(--mu-text-4)', width: '10px', flexShrink: 0 },
  treeCount: { fontSize: '10px', fontWeight: 700, color: 'var(--mu-text-4)', marginLeft: 'auto', flexShrink: 0 },
  treeLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  treeFile: { display: 'flex', alignItems: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '5px 8px', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--mu-text-3)', cursor: 'pointer', font: 'inherit', fontSize: '12.5px' },
  treeFileOn: { background: 'color-mix(in srgb, var(--mu-accent) 14%, transparent)', color: 'var(--mu-text)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--mu-accent) 35%, transparent)' },
  readerPlaceholder: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'center' },

  // Doc reader pane
  readerHead: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
  readerTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--mu-text)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 },
  readerBody: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px', borderRadius: '16px', border: '1px solid var(--mu-wash-2)', background: 'rgba(0,0,0,0.18)' },
  rowItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', color: 'var(--mu-text)', padding: '10px 12px', borderRadius: '10px', background: 'var(--mu-wash)' },
  soon: { fontSize: '11px', color: 'var(--mu-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  histRow: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, boxSizing: 'border-box', textAlign: 'left', fontSize: '14px', color: 'var(--mu-text)', padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--mu-wash-2)', background: 'var(--mu-wash)', cursor: 'pointer', font: 'inherit' },
  histBlock: { display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' },
  histLine: { display: 'flex', alignItems: 'stretch', gap: '8px', width: '100%', boxSizing: 'border-box' },
  histVersions: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '0 4px 2px 40px' },
  histVerLabel: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, color: 'var(--mu-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  histVerChip: { fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-wash-2)', color: 'var(--mu-text-3)', cursor: 'pointer', fontFamily: 'inherit' },
  histDelete: { flexShrink: 0, fontSize: '14px', padding: '0 12px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--mu-err-bg) 28%, transparent)', background: 'color-mix(in srgb, var(--mu-err-bg) 8%, transparent)', color: 'var(--mu-err)', cursor: 'pointer', fontFamily: 'inherit' },
  delFilesRow: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', color: 'var(--mu-text-2)', cursor: 'pointer', font: 'inherit', fontSize: '13px', textAlign: 'left' },
  delFilesOn: { border: '1px solid color-mix(in srgb, var(--mu-err-bg) 50%, transparent)', background: 'color-mix(in srgb, var(--mu-err-bg) 10%, transparent)', color: 'var(--mu-err)' },
  dangerBtn: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 700, padding: '12px 18px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--mu-err-bg) 50%, transparent)', background: 'color-mix(in srgb, var(--mu-err-bg) 16%, transparent)', color: 'var(--mu-err)', cursor: 'pointer', fontFamily: 'inherit' },
  pathCode: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11.5px', color: 'var(--mu-link)', wordBreak: 'break-all' },
  histLaunch: { flexShrink: 0, fontSize: '15px', padding: '0 14px', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--mu-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 14%, transparent)', color: 'var(--mu-text-2)', cursor: 'pointer', fontFamily: 'inherit' },
  launchBtn: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 700, padding: '11px 18px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--mu-accent) 50%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 18%, transparent)', color: 'var(--mu-text-2)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  histName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 },
  histDate: { fontSize: '11px', color: 'var(--mu-text-4)', flexShrink: 0, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  histOpen: { display: 'inline-flex', alignItems: 'center', fontSize: '11px', color: 'var(--mu-link)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },

  // Shared create screens
  center: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '18px', padding: 'clamp(18px, 4vw, 32px)', animation: 'ab-fade 0.45s ease both' },
  hero: { fontSize: 'clamp(40px, 12vw, 52px)', lineHeight: 1, filter: 'drop-shadow(0 6px 20px color-mix(in srgb, var(--mu-accent) 45%, transparent))' },
  h1: { fontSize: 'clamp(22px, 5.5vw, 28px)', fontWeight: 700, letterSpacing: '-0.015em', margin: 0, color: 'var(--mu-text)' },
  h1small: { display: 'inline-flex', alignItems: 'center', gap: '9px', fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--mu-text)' },
  sub: { fontSize: '15px', color: 'var(--mu-text-3)', margin: 0, maxWidth: '42ch', lineHeight: 1.5 },
  input: { width: '100%', maxWidth: '440px', boxSizing: 'border-box', fontSize: '17px', padding: '16px 18px', borderRadius: '16px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-input)', color: 'var(--mu-text)', outline: 'none', textAlign: 'center' },
  prereqRow: { margin: 0, fontSize: '13px', color: 'var(--mu-text-2)' },

  // Framing chat (BMAD one-question-at-a-time)
  briefWrap: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '820px', margin: '0 auto', padding: 'clamp(14px, 3vw, 24px)', gap: '12px', boxSizing: 'border-box', animation: 'ab-fade 0.45s ease both' },
  chatList: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '6px 2px' },
  bubbleMuse: { alignSelf: 'flex-start', maxWidth: '85%', background: 'color-mix(in srgb, var(--mu-accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--mu-accent) 25%, transparent)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', fontSize: '14px', lineHeight: 1.55, color: 'var(--mu-text-2)', whiteSpace: 'pre-wrap' },
  bubbleUser: { alignSelf: 'flex-end', maxWidth: '85%', background: 'var(--mu-wash-2)', border: '1px solid var(--mu-line)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: '14px', lineHeight: 1.55, color: 'var(--mu-text)', whiteSpace: 'pre-wrap' },
  chatRow: { display: 'flex', gap: '10px', flexShrink: 0 },
  chatInput: { flex: 1, minWidth: 0, boxSizing: 'border-box', fontSize: '15px', padding: '13px 16px', borderRadius: '14px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-input)', color: 'var(--mu-text)', outline: 'none', fontFamily: 'inherit' },
  chatSend: { width: '48px', flexShrink: 0, fontSize: '16px', borderRadius: '12px', border: '1px solid var(--mu-line-2)', cursor: 'pointer', color: '#ffffff', background: 'linear-gradient(180deg, #2f6fe6 0%, #2560d0 55%, #1d4fb0 100%)' },
  chatFootRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0 },
  recap: { alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 18px', borderRadius: '14px', border: '1px solid color-mix(in srgb, var(--mu-ok) 30%, transparent)', background: 'color-mix(in srgb, var(--mu-ok) 5%, transparent)' },
  recapList: { margin: 0, paddingLeft: '20px', fontSize: '13.5px', color: 'var(--mu-text-2)', display: 'flex', flexDirection: 'column', gap: '4px' },
  recapNext: { margin: 0, fontSize: '12px', color: 'var(--mu-text-3)' },
  resumeRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', border: '1px dashed color-mix(in srgb, var(--mu-link) 35%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 7%, transparent)', fontSize: '13px' },
  resumeText: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--mu-text-2)' },
  // Project board (mini-Gantt)
  boardTitleCol: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 },
  boardTitleRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  gantt: { display: 'flex', alignItems: 'flex-start', overflowX: 'auto', padding: '16px 10px', border: '1px solid var(--mu-wash-2)', borderRadius: '16px', background: 'var(--mu-wash)' },
  ganttSeg: { display: 'flex', alignItems: 'flex-start', flex: '1 1 0', minWidth: 0 },
  ganttSegLast: { display: 'flex', alignItems: 'flex-start', flex: '0 0 auto' },
  ganttNode: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', minWidth: '92px', font: 'inherit', flexShrink: 0 },
  ganttDot: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', transition: 'transform .15s ease, box-shadow .2s ease' },
  ganttDotSel: { transform: 'scale(1.14)' },
  ganttLabel: { fontSize: '11.5px', fontWeight: 600, color: 'var(--mu-text-3)', whiteSpace: 'nowrap' },
  ganttStatus: { fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--mu-text-4)' },
  ganttLine: { flex: '1 1 26px', minWidth: '16px', height: '2px', background: 'var(--mu-line)', marginTop: '19px', borderRadius: '1px' },
  boardDetail: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', padding: '18px 20px', borderRadius: '16px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', minHeight: '160px' },
  boardCols: { display: 'flex', gap: '14px', alignItems: 'stretch' },
  projFilesPanel: { width: '252px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '3px', padding: '14px', borderRadius: '16px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', maxHeight: '440px', overflowY: 'auto', boxSizing: 'border-box' },
  projFilesTitle: { margin: '0 0 6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mu-text-3)' },
  projFileRow: { display: 'flex', alignItems: 'center', gap: '7px', textAlign: 'left', padding: '5px 8px', borderRadius: '8px', border: 'none', background: 'none', color: 'var(--mu-text-2)', cursor: 'pointer', font: 'inherit', fontSize: '12px', width: '100%', boxSizing: 'border-box' },
  projFileName: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  designSummary: { fontSize: '13px', color: 'var(--mu-text-3)', lineHeight: 1.5 },
  optRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  optLabel: { fontSize: '12px', color: 'var(--mu-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  creditLine: { margin: 0, fontSize: '12.5px', color: 'var(--mu-text-3)' },
  artRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  artCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', minWidth: '210px' },
  artName: { fontSize: '14px', fontWeight: 700, color: 'var(--mu-text)' },
  artFile: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11px', color: 'var(--mu-text-4)' },
  mcpCard: { alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', marginTop: '8px', paddingTop: '14px', borderTop: '1px solid var(--mu-line)' },
  mcpSnippet: { width: '100%', boxSizing: 'border-box', margin: 0, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11px', lineHeight: 1.55, color: 'var(--mu-text-2)', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--mu-line)', borderRadius: '10px', padding: '10px 12px', maxHeight: '160px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left' },
  viewerModal: { width: 'min(94vw, 920px)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--mu-panel)', border: '1px solid var(--mu-line)', borderRadius: '20px', padding: '18px 20px', boxShadow: '0 30px 80px rgba(0,0,0,0.55)', boxSizing: 'border-box' },

  // Design step
  designGrid: { display: 'flex', gap: '22px', flexWrap: 'wrap', width: '100%' },
  designCol: { display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 260px', minWidth: '240px' },
  wheel: { width: '168px', height: '168px', borderRadius: '50%', position: 'relative', cursor: 'crosshair', flexShrink: 0, background: 'conic-gradient(from 0deg, #f00, #ff0 60deg, #0f0 120deg, #0ff 180deg, #00f 240deg, #f0f 300deg, #f00 360deg)', boxShadow: 'inset 0 0 0 2px var(--mu-line-2), 0 8px 24px rgba(0,0,0,0.35)' },
  wheelDot: { position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #fff', transform: 'translate(-50%, -50%)', boxShadow: '0 0 10px rgba(0,0,0,0.65)', pointerEvents: 'none' },
  swRow: { display: 'flex', gap: '6px', alignItems: 'center' },
  sw: { width: '26px', height: '26px', borderRadius: '7px', border: '1px solid var(--mu-line-3)', flexShrink: 0 },
  trendBox: { padding: '12px 14px', borderRadius: '12px', border: '1px dashed rgba(139,124,240,0.4)', background: 'rgba(139,124,240,0.06)', fontSize: '12.5px', color: 'var(--mu-text-3)', lineHeight: 1.55 },
  viewerHead: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0 },
  viewerTitle: { fontSize: '14px', fontWeight: 700, color: 'var(--mu-text)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '46ch' },
  viewerBody: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--mu-wash-2)', background: 'rgba(0,0,0,0.22)' },

  memLabel: { display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '2px 0 0', fontSize: '11.5px', fontWeight: 700, color: 'var(--mu-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  styleRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' },
  verRow: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 },
  verChip: { fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-wash-2)', color: 'var(--mu-text-3)', cursor: 'pointer', fontFamily: 'inherit' },
  verChipOn: { border: '1px solid color-mix(in srgb, var(--mu-accent) 60%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 16%, transparent)', color: 'var(--mu-link)' },
  regenPanel: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 16px', borderRadius: '14px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', flexShrink: 0, boxSizing: 'border-box' },
  styleCard: { display: 'flex', flexDirection: 'column', gap: '5px', width: '104px', padding: '7px', borderRadius: '10px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', cursor: 'pointer', font: 'inherit', color: 'var(--mu-text-2)', textAlign: 'left' },
  styleCardOn: { border: '1px solid color-mix(in srgb, var(--mu-accent) 60%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 12%, transparent)' },
  styleThumb: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '34px', borderRadius: '6px', fontSize: '12px', overflow: 'hidden', border: '1px solid var(--mu-wash-2)' },
  styleCardName: { fontSize: '11px', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  memCount: { fontSize: '10.5px', color: 'var(--mu-text-4)', fontWeight: 700 },
  memBar: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' },
  memSummary: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '999px', border: '1px solid color-mix(in srgb, var(--mu-accent) 45%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 12%, transparent)', color: 'var(--mu-text-2)', cursor: 'pointer', fontFamily: 'inherit' },
  memPick: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '5px 8px 5px 12px', borderRadius: '999px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-wash-2)', color: 'var(--mu-text-2)' },
  memPickX: { fontSize: '11px', lineHeight: 1, padding: '3px 5px', borderRadius: '999px', border: 'none', background: 'var(--mu-line)', color: 'var(--mu-text-3)', cursor: 'pointer', fontFamily: 'inherit' },
  // One line, always: the vault list is elided rather than allowed to wrap.
  memGround: { display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%', minWidth: 0, fontSize: '11.5px', fontWeight: 600, padding: '5px 11px', borderRadius: '999px', border: '1px solid rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.10)', color: 'var(--mu-ok)' },
  memGroundText: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memGroundWarn: { border: '1px solid rgba(251,191,36,0.45)', background: 'rgba(251,191,36,0.12)', color: '#f3d089' },
  memOverlay: { position: 'fixed', inset: 0, background: 'rgba(2,6,16,0.62)', display: 'flex', justifyContent: 'flex-end', zIndex: 60, animation: 'ab-fade 0.2s ease both' },
  memDrawer: { width: 'min(440px, 92vw)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', background: 'var(--mu-panel)', borderLeft: '1px solid var(--mu-line)', boxShadow: '-24px 0 60px rgba(0,0,0,0.5)', animation: 'ab-slide-in 0.26s cubic-bezier(0.22,1,0.36,1) both' },
  memDrawerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexShrink: 0 },
  memDrawerTitle: { display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--mu-text)' },
  memDrawerSub: { margin: '4px 0 0', fontSize: '12.5px', lineHeight: 1.5, color: 'var(--mu-text-3)' },
  memModes: { display: 'flex', gap: '6px', flexShrink: 0 },
  memModeCard: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, minWidth: 0, padding: '8px 6px', borderRadius: '10px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', color: 'var(--mu-text-2)', cursor: 'pointer', font: 'inherit', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  memModeOn: { border: '1px solid color-mix(in srgb, var(--mu-accent) 60%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 14%, transparent)', color: 'var(--mu-text)' },
  memGroupHead: { display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '5px 2px', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--mu-text-4)' },
  memCaret: { fontSize: '9px', width: '9px', flexShrink: 0 },
  memGroupName: { flex: 1, minWidth: 0, textAlign: 'left', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  memGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: '6px' },
  memTile: { display: 'flex', flexDirection: 'column', gap: '3px', padding: '8px 9px', borderRadius: '10px', border: '1px solid', cursor: 'pointer', font: 'inherit', color: 'var(--mu-text)', textAlign: 'left', minWidth: 0 },
  memTileTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', height: '16px' },
  memLock: { display: 'inline-flex', alignItems: 'center', color: '#f0b840' },
  memTileCheck: { width: '15px', height: '15px', marginLeft: 'auto', flexShrink: 0, borderRadius: '4px', border: '1px solid var(--mu-line-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 },
  memTileName: { fontSize: '12px', fontWeight: 600, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memTileCount: { fontSize: '10.5px', color: 'var(--mu-text-4)', fontWeight: 700 },
  memDrawerBody: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' },
  memSection: { display: 'flex', flexDirection: 'column', gap: '3px' },
  memCheckOn: { border: '1px solid color-mix(in srgb, var(--mu-accent) 70%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 30%, transparent)', color: 'var(--mu-text)' },
  memDrawerFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexShrink: 0, paddingTop: '12px', borderTop: '1px solid var(--mu-line)' },
  imgFolderRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)' },
  imgFolderPath: { fontSize: '12.5px', fontWeight: 600, color: 'var(--mu-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  imgCaptionList: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--mu-line)' },
  imgCaptionRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  imgCaptionName: { flexShrink: 0, width: '110px', fontSize: '11.5px', color: 'var(--mu-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  imgCaptionInput: { flex: 1, minWidth: 0, fontSize: '12.5px', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)', color: 'var(--mu-text)', fontFamily: 'inherit' },
  memDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  modeRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  modeChip: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600, padding: '7px 14px', borderRadius: '999px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-wash-2)', color: 'var(--mu-text-3)', cursor: 'pointer', fontFamily: 'inherit' },
  modeChipOn: { border: '1px solid color-mix(in srgb, var(--mu-accent) 60%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 16%, transparent)', color: 'var(--mu-link)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--mu-accent) 35%, transparent)' },
  freshBadge: { alignSelf: 'flex-start', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mu-ok)', background: 'color-mix(in srgb, var(--mu-ok) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--mu-ok) 30%, transparent)', borderRadius: '999px', padding: '3px 9px' },
  laneBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--mu-link)', background: 'color-mix(in srgb, var(--mu-accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--mu-accent) 30%, transparent)', borderRadius: '999px', padding: '3px 10px' },
  stepCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', padding: '16px 18px', borderRadius: '14px', border: '1px solid var(--mu-line)', background: 'var(--mu-wash)' },
  stepTitle: { margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--mu-text)' },
  promptBox: { width: '100%', boxSizing: 'border-box', margin: 0, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11.5px', lineHeight: 1.55, color: 'var(--mu-text-2)', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--mu-line)', borderRadius: '10px', padding: '12px 14px', maxHeight: '260px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left' },
  primary: { width: '100%', maxWidth: '440px', fontSize: '16px', fontWeight: 600, letterSpacing: '0.01em', padding: '15px 22px', borderRadius: '14px', border: '1px solid var(--mu-line-2)', cursor: 'pointer', color: '#ffffff', background: 'linear-gradient(180deg, #2f6fe6 0%, #2560d0 55%, #1d4fb0 100%)', boxShadow: '0 8px 22px rgba(37,99,235,0.32), inset 0 1px 0 var(--mu-line-3)' },
  secondary: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 600, letterSpacing: '0.01em', padding: '11px 18px', borderRadius: '12px', border: '1px solid var(--mu-line-2)', background: 'var(--mu-wash-2)', color: 'var(--mu-text-2)', cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' },
  back: { background: 'none', border: 'none', color: 'var(--mu-text-4)', fontSize: '14px', cursor: 'pointer' },
  error: { background: 'color-mix(in srgb, var(--mu-err-bg) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--mu-err-bg) 25%, transparent)', color: 'var(--mu-err)', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', textAlign: 'center' },

  // Done. Same scroller/inner split as the dashboard (edge-hugging scrollbar).
  // Full-height column: header + notice keep their natural size, the document
  // takes the rest. No page scroll, no dead space under a boxed preview.
  doneWrap: { flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px', padding: 'clamp(14px, 3vw, 24px)', animation: 'ab-fade 0.45s ease both' },
  doneHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', flexShrink: 0 },
  doneTitleCol: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 420px', minWidth: 0 },
  // Two lines max on a wide measure — a long purpose used to wrap into a
  // narrow column and push the whole page down.
  doneSub: { fontSize: '14px', color: 'var(--mu-text-3)', margin: 0, lineHeight: 1.5, maxWidth: '90ch', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  doneNote: { margin: 0, fontSize: '12.5px', lineHeight: 1.5, wordBreak: 'break-word', flexShrink: 0 },
  preview: { flex: 1, minHeight: '240px', width: '100%', border: '1px solid var(--mu-line)', borderRadius: '18px', background: '#fff', boxShadow: '0 18px 50px rgba(0,0,0,0.45)' },
};
