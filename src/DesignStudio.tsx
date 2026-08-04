/**
 * Design Studio — dedicated full-screen module (Tony: the board panel mixed
 * everything). Tabs: Couleurs (wheel + harmony), Styles (gallery list + LIVE
 * mock-page preview), Effets, Tendances (reserved slot). Presets mirror the
 * apps/design-showcase gallery exactly; the result feeds design-tokens.json.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { computePalette, hslToHex, isOdCatalog, odAvailablePages, fontStack, FONT_CANDIDATES, FONT_ROLES, odElapsedLabel, odPercent, OD_CATALOG_ID, OD_EXPECTED_SYSTEMS, type Harmony, type Lane, type DesignMix, type DesignRole, type FontRole, type OdPages, type OdSystem, type ResolvedDesign, type RefLibrary } from './handoff';
import { useI18n } from './i18n/useI18n';

/** Which of FONT_CANDIDATES are actually installed.
 *
 *  A browser cannot list your fonts — `queryLocalFonts` is permission-gated
 *  and unavailable in a sandboxed iframe — so this measures instead: a string
 *  rendered in "Family, fallback" that comes out a different width from the
 *  fallback alone proves the family resolved. It answers only about names we
 *  ask about, which is why the UI says "among a known list".
 *
 *  Returns [] rather than a guess when no 2D context is available. */
export function detectInstalledFonts(): string[] {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return [];
  const PROBE = 'mmmmmmmmmmlliWWWWWWQ@';
  const GENERICS = ['monospace', 'serif', 'sans-serif'];
  const baseline = new Map<string, number>();
  for (const g of GENERICS) {
    ctx.font = `72px ${g}`;
    baseline.set(g, ctx.measureText(PROBE).width);
  }
  return FONT_CANDIDATES
    .filter(({ family }) => GENERICS.some((g) => {
      ctx.font = `72px "${family}", ${g}`;
      return ctx.measureText(PROBE).width !== baseline.get(g);
    }))
    .map((f) => f.family);
}

export type StylePreset ={ id: string; name: string; scheme: 'dark' | 'light'; palette: string[]; desc: string; traits: string[]; bn: CSSProperties };

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'mnemosyne', name: 'Mnemosyne OS', scheme: 'dark', palette: ['#05040A', '#7B5EA7', '#C9A6FF', '#C5973A'],
    desc: 'Violet mnémique · grain · Playfair + Space Grotesk',
    traits: ['deep violet-black background (#05040A)', 'mnemonic violet palette (#7B5EA7, #C9A6FF) + gold touch (#C5973A)', 'film-grain texture overlay', 'Playfair Display for headings, Space Grotesk for UI'],
    bn: { background: 'linear-gradient(135deg, #05040A, #1b1030)', color: 'rgba(201,166,255,0.55)', fontFamily: 'Georgia, "Playfair Display", serif', fontWeight: 700 },
  },
  {
    id: 'dark-luxury', name: 'Dark Luxury', scheme: 'dark', palette: ['#090806', '#C9A84C', '#E8C97A', '#3A2810'],
    desc: 'Noir chaud · shimmer doré · serif italique · transitions lentes',
    traits: ['warm near-black background (#090806)', 'gold shimmer gradients (#C9A84C→#E8C97A)', 'italic serif display headings', 'slow, luxurious transitions'],
    bn: { background: 'linear-gradient(135deg, #090806, #241c08)', color: 'rgba(232,201,122,0.6)', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700 },
  },
  {
    id: 'brutalist', name: 'Brutalist', scheme: 'light', palette: ['#F5F2EC', '#0A0A0A', '#FF2D00', '#1A1A1A'],
    desc: 'Raw · typo massive · ombres offset · zéro arrondi',
    traits: ['raw contrast (#F5F2EC vs #0A0A0A) + signal red (#FF2D00)', 'massive UPPERCASE typography', 'hard offset shadows (no blur)', 'zero border-radius, 2px+ solid borders'],
    bn: { background: '#F5F2EC', color: 'rgba(10,10,10,0.4)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' },
  },
  {
    id: 'generative', name: 'Generative', scheme: 'dark', palette: ['#040508', '#6366F1', '#8B5CF6', '#06B6D4'],
    desc: 'Orbs animés · glassmorphism · blobs organiques · particules',
    traits: ['near-black base (#040508)', 'animated gradient orbs (#6366F1, #8B5CF6, #06B6D4)', 'glassmorphism panels (blur + rgba)', 'organic blobs and floating particles'],
    bn: { background: 'linear-gradient(135deg, #040508, #12123a)', color: 'rgba(139,124,246,0.6)', fontWeight: 700 },
  },
  {
    id: 'paper-ink', name: 'Paper & Ink', scheme: 'light', palette: ['#F8F5EE', '#1A1410', '#C14B28', '#9C9488'],
    desc: 'Blanc cassé · typographie éditoriale · rouge brique · texture papier',
    traits: ['off-white paper background (#F8F5EE), ink text (#1A1410)', 'editorial serif headlines, ruled separators', 'brick-red accent (#C14B28)', 'paper texture, print-like rhythm, zero glow'],
    bn: { background: '#F8F5EE', color: 'rgba(26,20,16,0.35)', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700 },
  },
  {
    id: 'mineral-light', name: 'Mineral Light', scheme: 'light', palette: ['#F5F0E8', '#2A2218', '#8B4513', '#C8BCA8'],
    desc: 'Sable · pierre · argile · Aesop / Muji · calme organique',
    traits: ['sand/stone palette (#F5F0E8, #C8BCA8), clay accent (#8B4513)', 'Aesop/Muji organic calm — minimal, warm', 'soft diagonal gradients, tactile rounded cards', 'muted ink text (#2A2218)'],
    bn: { background: 'linear-gradient(145deg, #F5F0E8, #C8BCA8)', color: 'rgba(42,34,24,0.4)', fontWeight: 600 },
  },
  {
    id: 'acid-light', name: 'Acid Light', scheme: 'light', palette: ['#FFFFFF', '#000000', '#FFFF00', '#FF2D00'],
    desc: 'Blanc pur · jaune acide · Bebas Neue · ombres offset · rave culture',
    traits: ['pure white base, acid-yellow (#FFFF00) blocks, black type, red hits (#FF2D00)', 'condensed poster caps (Bebas Neue-like)', 'hard offset shadows', 'rave-poster energy, flat and loud'],
    bn: { background: 'linear-gradient(135deg, #FFFFFF, #FFFDE0)', color: 'rgba(0,0,0,0.3)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' },
  },
  {
    id: 'swiss', name: 'Swiss Modernism', scheme: 'light', palette: ['#FFFFFF', '#1A1A1A', '#E63329', '#AAAAAA'],
    desc: 'Grille mathématique · Helvetica · rouge signal · multiples de 8',
    traits: ['mathematical grid — every spacing a multiple of 8px', 'Helvetica/neo-grotesque typography', 'signal red (#E63329) on white/near-black', 'flat: no shadows, no gradients, pure hierarchy'],
    bn: { background: '#FFFFFF', color: 'rgba(26,26,26,0.3)', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em' },
  },
];

export const FX_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'glow', label: '✨ Glow néon' },
  { id: 'glass', label: '🌫 Verre / blur' },
  { id: 'gradients', label: '🌊 Dégradés' },
  { id: 'motion', label: '🎞 Animations douces' },
  { id: 'hard-shadows', label: '⬛ Ombres franches' },
];

/** LIVE previews — one DISTINCT composition per template (Tony: the pages
 *  differ even in typography, a recolored single layout lies). System font
 *  stacks stand in for the real ones: Georgia≈Playfair, Impact≈Bebas,
 *  Helvetica≈neo-grotesque — no external fonts inside the sandboxed iframe. */
const SERIF = 'Georgia, "Times New Roman", serif';
const POSTER = 'Impact, "Arial Narrow", Haettenschweiler, sans-serif';
const GROTESK = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function Bars({ c, ws }: { c: string; ws: string[] }) {
  return <>{ws.map((w, i) => <span key={i} style={{ display: 'block', height: '7px', width: w, borderRadius: '4px', background: c }} />)}</>;
}

function StyleMock({ p }: { p: StylePreset }) {
  const box: CSSProperties = { position: 'relative', overflow: 'hidden', borderRadius: '12px', minHeight: '320px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)' };

  switch (p.id) {
    case 'mnemosyne': return (
      <div style={{ ...box, background: '#05040A', color: '#E8E4F0', padding: '18px 20px', gap: '12px' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 78% 12%, rgba(123,94,167,0.3), transparent 55%)', pointerEvents: 'none' }} />
        <svg viewBox="0 0 200 60" style={{ position: 'absolute', right: '10px', top: '10px', width: '150px', opacity: 0.6, pointerEvents: 'none' }} aria-hidden>
          <polyline points="12,48 55,14 98,38 150,10 185,42" fill="none" stroke="#7B5EA7" strokeWidth="1" />
          {[[12, 48], [55, 14], [98, 38], [150, 10], [185, 42]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#C9A6FF" />)}
        </svg>
        <span style={{ fontSize: '9px', letterSpacing: '0.4em', color: '#C5973A', textTransform: 'uppercase' }}>Mnemosyne OS</span>
        <span style={{ fontFamily: SERIF, fontSize: '30px', lineHeight: 1.1, maxWidth: '75%' }}>La mémoire devient <i style={{ color: '#C9A6FF' }}>création</i></span>
        <Bars c="rgba(232,228,240,0.16)" ws={['58%', '42%']} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: 'auto' }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(123,94,167,0.12)', border: '1px solid rgba(201,166,255,0.25)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ width: '20px', height: '4px', background: '#C5973A' }} />
              <Bars c="rgba(232,228,240,0.16)" ws={['84%', '58%']} />
            </div>
          ))}
        </div>
      </div>
    );
    case 'dark-luxury': return (
      <div style={{ ...box, background: '#090806', color: '#E8E4F0', padding: '20px 22px', alignItems: 'center', textAlign: 'center', gap: '11px' }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.3em', color: '#C9A84C', textTransform: 'uppercase', marginTop: '8px' }}>Maison · Collection</span>
        <span style={{ width: '150px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)' }} />
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '34px', lineHeight: 1.05, background: 'linear-gradient(90deg, #8B6914, #E8C97A 45%, #C9A84C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>L’élégance sombre</span>
        <span style={{ width: '150px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.6), transparent)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '14px', width: '100%', marginTop: 'auto', textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            <Bars c="rgba(232,228,240,0.14)" ws={['92%', '76%', '58%']} />
          </div>
          <div style={{ border: '1px solid rgba(201,168,76,0.4)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '20px', color: '#E8C97A' }}>N°1</span>
            <span style={{ fontSize: '8px', letterSpacing: '0.3em', color: 'rgba(232,228,240,0.5)', textTransform: 'uppercase' }}>Signature</span>
          </div>
        </div>
      </div>
    );
    case 'brutalist': return (
      <div style={{ ...box, background: '#F5F2EC', color: '#0A0A0A', padding: '16px 18px', gap: '10px', borderRadius: '12px' }}>
        <span style={{ fontFamily: POSTER, fontSize: '46px', lineHeight: 0.9, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Brut—</span>
        <div style={{ border: '3px solid #0A0A0A', boxShadow: '7px 7px 0 #0A0A0A', padding: '10px 14px', background: '#F5F2EC', width: 'fit-content' }}>
          <span style={{ fontFamily: POSTER, fontSize: '21px', textTransform: 'uppercase' }}>Zéro arrondi.</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ background: '#FF2D00', color: '#F5F2EC', fontFamily: POSTER, fontSize: '13px', padding: '4px 10px', textTransform: 'uppercase' }}>V0</span>
          <Bars c="rgba(10,10,10,0.25)" ws={['110px']} />
        </div>
        <div style={{ marginTop: 'auto', margin: '-16px -18px 0', background: '#0A0A0A', color: '#F5F2EC', fontFamily: POSTER, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '8px 18px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          Raw · typo massive · ombres offset · Raw · typo massive · ombres offset ·
        </div>
      </div>
    );
    case 'generative': return (
      <div style={{ ...box, background: '#040508', color: '#F0F4FF', padding: '18px 20px', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ position: 'absolute', width: '150px', height: '150px', borderRadius: '50%', left: '-35px', top: '-35px', background: 'radial-gradient(circle, rgba(99,102,241,0.55), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '130px', height: '130px', borderRadius: '50%', right: '-25px', bottom: '-25px', background: 'radial-gradient(circle, rgba(6,182,212,0.45), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '60px', height: '60px', borderRadius: '46% 54% 60% 40%/50% 40% 60% 50%', right: '60px', top: '30px', background: 'rgba(139,92,246,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '18px', padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', backdropFilter: 'blur(6px)', width: '78%' }}>
          <span style={{ fontSize: '26px', fontWeight: 800, background: 'linear-gradient(135deg, #F0F4FF, #818CF8 50%, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center', lineHeight: 1.15 }}>Vivant par défaut</span>
          <Bars c="rgba(240,244,255,0.18)" ws={['70%', '50%']} />
          <span style={{ padding: '7px 18px', borderRadius: '999px', background: 'linear-gradient(135deg, #6366F1, #06B6D4)', fontSize: '11px', fontWeight: 800 }}>Générer →</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
          {['orbs', 'blobs', 'particules'].map((t) => <span key={t} style={{ fontSize: '9.5px', padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(129,140,248,0.4)', color: 'rgba(240,244,255,0.7)' }}>{t}</span>)}
        </div>
      </div>
    );
    case 'paper-ink': return (
      <div style={{ ...box, background: '#F8F5EE', color: '#1A1410', padding: '16px 20px', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(26,20,16,0.6)' }}>Édition · N°12</span>
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '10px', color: 'rgba(26,20,16,0.55)' }}>ce matin</span>
        </div>
        <div style={{ height: '2px', background: '#1A1410' }} />
        <span style={{ fontFamily: SERIF, fontSize: '27px', lineHeight: 1.12 }}>Le journal de bord d’une mémoire</span>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginTop: '4px', flex: 1 }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ fontFamily: SERIF, fontSize: '34px', lineHeight: 1, background: '#1A1410', color: '#F8F5EE', padding: '4px 9px', height: 'fit-content' }}>U</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, paddingTop: '4px' }}>
              <Bars c="rgba(26,20,16,0.18)" ws={['100%', '94%', '88%', '96%', '60%']} />
            </div>
          </div>
          <div style={{ borderLeft: '2px solid #C14B28', paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '12px', color: '#C14B28' }}>« La marge parle »</span>
            <Bars c="rgba(26,20,16,0.14)" ws={['90%', '70%']} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(26,20,16,0.3)', paddingTop: '6px' }}>
          <span style={{ fontSize: '8.5px', letterSpacing: '0.2em', color: 'rgba(26,20,16,0.5)' }}>PAPIER — ENCRE</span>
          <span style={{ fontSize: '8.5px', color: 'rgba(26,20,16,0.5)' }}>p. 3</span>
        </div>
      </div>
    );
    case 'mineral-light': return (
      <div style={{ ...box, background: '#F5F0E8', color: '#2A2218', padding: '18px 22px', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', alignSelf: 'stretch', justifyContent: 'center' }}>
          {['objets', 'rituels', 'soin'].map((n) => <span key={n} style={{ fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(42,34,24,0.55)' }}>{n}</span>)}
        </div>
        <div style={{ width: '120px', height: '92px', borderRadius: '80px 80px 6px 6px', background: 'linear-gradient(145deg, #EDE6D8, #C8BCA8)', border: '1px solid rgba(42,34,24,0.15)', marginTop: '4px' }} />
        <span style={{ fontFamily: SERIF, fontSize: '24px', color: '#2A2218' }}>Calme minéral</span>
        <Bars c="rgba(42,34,24,0.15)" ws={['46%']} />
        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
          <span style={{ padding: '8px 18px', borderRadius: '999px', background: '#8B4513', color: '#F5F0E8', fontSize: '10.5px', fontWeight: 600 }}>Découvrir</span>
          <span style={{ padding: '8px 18px', borderRadius: '999px', border: '1px solid rgba(42,34,24,0.3)', fontSize: '10.5px' }}>La matière</span>
        </div>
      </div>
    );
    case 'acid-light': return (
      <div style={{ ...box, background: '#FFFFFF', color: '#000000', padding: '16px 18px', gap: '8px' }}>
        <div style={{ position: 'absolute', left: '-12px', top: '38px', width: '75%', height: '58px', background: '#FFFF00', transform: 'rotate(-3deg)', pointerEvents: 'none' }} />
        <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Rave · Culture · 24/7</span>
        <span style={{ position: 'relative', fontFamily: POSTER, fontSize: '52px', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '0.01em' }}>Acid<br />Light</span>
        <div style={{ position: 'absolute', right: '16px', top: '52px', width: '54px', height: '54px', borderRadius: '50%', background: '#FF2D00', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: POSTER, fontSize: '15px', transform: 'rotate(10deg)', border: '2px solid #000' }}>★</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <span style={{ border: '2px solid #000', boxShadow: '4px 4px 0 #000', padding: '5px 12px', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', background: '#fff' }}>Entrer</span>
          <span style={{ border: '2px solid #000', padding: '5px 12px', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', background: '#FFFF00' }}>Line-up</span>
        </div>
        <div style={{ marginTop: 'auto', margin: '-16px -18px 0', background: '#000', color: '#FFFF00', fontFamily: POSTER, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', padding: '7px 18px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          ★ ce soir ★ demain ★ toujours ★ ce soir ★ demain ★ toujours
        </div>
      </div>
    );
    case 'swiss': default: return (
      <div style={{ ...box, background: '#FFFFFF', color: '#1A1A1A', padding: '0', gap: '0' }}>
        <div style={{ height: '6px', background: '#E63329' }} />
        <div style={{ padding: '14px 18px 10px', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: GROTESK }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#AAAAAA' }}>
            <span>Grille — 8pt</span><span>CH · 2026</span>
          </div>
          <span style={{ fontSize: '38px', fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.03em' }}>Grille &<br />raison.</span>
          <span style={{ width: '14px', height: '14px', background: '#E63329' }} />
        </div>
        <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', padding: '10px 18px 16px', fontFamily: GROTESK }}>
          {['01', '02', '03'].map((n) => (
            <div key={n} style={{ borderTop: '2px solid #1A1A1A', paddingTop: '7px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800 }}>{n}</span>
              <Bars c="rgba(26,26,26,0.18)" ws={['88%', '62%']} />
            </div>
          ))}
        </div>
      </div>
    );
  }
}

/** Browser for the Open Design catalogue: 151 system names on the left, the
 *  opened system rendered with ITS OWN colours and font stack on the right.
 *  The preview is deliberately built from the adapted tokens rather than from
 *  their components.html — what the user judges here must be exactly what
 *  lands in design-tokens.json, not a prettier rendering of something else. */
function OdSystemBrowser(props: {
  lib: RefLibrary;
  filter: string; setFilter: (s: string) => void;
  preview: OdSystem | null;
  state: 'idle' | 'loading' | 'error';
  msg: string;
  designSystem: OdSystem | null;
  onOpen: (id: string) => void;
  onUse: (sys: OdSystem) => void;
  onClear: () => void;
  onCheck: () => void;
  onOpenFolder: () => void;
  /** Assign ONE role of the mix to this system (colours, typography or
   *  components) — the whole point of "Open Design first + mixing". */
  onAssignRole: (role: DesignRole, sys: OdSystem) => void;
  roleOf: (role: DesignRole) => string | null;
  busy: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { t } = props;
  const [page, setPage] = useState<keyof OdPages>('components');
  const all = props.lib.systems ?? [];
  const q = props.filter.trim().toLowerCase();
  const shown = q ? all.filter((id) => id.includes(q)) : all;
  const sys = props.preview;
  // Only offer tabs for pages that actually came back, and never leave the
  // view pointing at one this system does not have.
  const pages = sys ? odAvailablePages(sys) : [];
  const view = pages.includes(page) ? page : pages[0];
  const attached = !!sys && props.designSystem?.id === sys.id;
  const p = sys?.palette ?? {};
  const font = (sys?.fonts[0] ?? '').split(',')[0].replace(/["']/g, '').trim();
  const accent = sys?.accents[0] ?? p.base ?? p.text ?? '#888';

  return (
    <>
      {/* The stored count is a memory of an older import; "Check" re-reads the
          disk, which is the only place the real answer lives. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
        <span style={DS.libTitle}>🎛 {props.lib.id}</span>
        <span style={DS.hint}>{t('od.libMeta', { n: all.length })}</span>
        <span style={{ flex: 1 }} />
        <button style={DS.link} disabled={props.busy} onClick={props.onCheck}>
          {props.busy ? t('od.checking') : t('od.check')}
        </button>
        <button style={DS.link} onClick={props.onOpenFolder}>{t('common.openFolder')}</button>
      </div>
      <div style={DS.libGrid} className="studio-styles">
      <div style={DS.libList}>
        <input
          style={{ ...DS.refInput, minWidth: 0, marginBottom: '6px' }}
          placeholder={t('od.filter')}
          value={props.filter}
          onChange={(e) => props.setFilter(e.target.value)}
        />
        {shown.map((id) => (
          <button
            key={id}
            style={{ ...DS.libRow, ...(sys?.id === id ? DS.libRowFocus : {}), ...(props.designSystem?.id === id ? DS.libRowOn : {}) }}
            onClick={() => props.onOpen(id)}
          >
            <span style={DS.libRowName}>{props.designSystem?.id === id ? '✓ ' : ''}{id}</span>
          </button>
        ))}
        {shown.length === 0 && <p style={DS.hint}>{t('od.noMatch', { q: props.filter })}</p>}
      </div>

      <div style={DS.libDetail}>
        {props.state === 'loading' && <p style={DS.hint}>{t('od.loading')}</p>}
        {props.state === 'error' && <p style={{ ...DS.hint, color: '#fca5a5' }}>⚠️ {props.msg}</p>}
        {!sys && props.state === 'idle' && (
          <p style={DS.hint}>{t('od.pickOne', { n: all.length })}</p>
        )}
        {sys && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
              <span style={DS.libTitle}>{sys.name}</span>
              {sys.category && <span style={DS.hint}>{sys.category}</span>}
              <span style={{ flex: 1 }} />
              {attached
                ? <button style={DS.link} onClick={props.onClear}>{t('od.attached')}</button>
                : <button style={{ ...DS.primary, padding: '9px 16px', fontSize: '13px' }} onClick={() => props.onUse(sys)}>{t('od.use')}</button>}
            </div>
            {/* Take only part of it: this is where a mix starts. Each button
                assigns ONE role, so the design says what came from where. */}
            <div style={DS.chipRow}>
              <span style={DS.hint}>{t('mix.takeFrom')}</span>
              {(['colors', 'typography', 'components'] as const).map((role) => (
                <button
                  key={role}
                  style={{ ...DS.chip, ...(props.roleOf(role) === sys.id ? DS.chipOn : {}) }}
                  onClick={() => props.onAssignRole(role, sys)}
                >
                  {props.roleOf(role) === sys.id ? '✓ ' : ''}{t(`mix.role.${role}`)}
                </button>
              ))}
            </div>

            {/* The system's OWN reference pages — real buttons, forms, cards,
                elevation. A mock we draw ourselves can only ever show a
                headline and two rectangles, which is not what you pick a
                design system for. Falls back to that mock only when the pages
                are missing on disk. */}
            {pages.length > 0 ? (
              <>
                {pages.length > 1 && (
                  <div style={DS.chipRow}>
                    {pages.map((k) => (
                      <button key={k} style={{ ...DS.chip, ...(view === k ? DS.chipOn : {}) }} onClick={() => setPage(k)}>
                        {t(`od.page.${k}`)}
                      </button>
                    ))}
                  </div>
                )}
                <iframe
                  title={`${sys.name} — ${t(`od.page.${view}`)}`}
                  sandbox="allow-scripts"
                  srcDoc={sys.pages[view] ?? ''}
                  style={{ width: '100%', height: '64vh', minHeight: '380px', border: '1px solid rgba(128,128,128,0.28)', borderRadius: '12px', background: '#fff' }}
                />
                <p style={DS.hint}>{t('od.pageHint')}</p>
              </>
            ) : (
            <div style={{
              width: '100%', borderRadius: '12px', overflow: 'hidden',
              border: '1px solid rgba(128,128,128,0.28)',
              background: p.background ?? '#111', color: p.text ?? '#eee',
              padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '190px',
            }}>
              <span style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: p.muted ?? p.text }}>
                {sys.id}
              </span>
              <span style={{ fontFamily: font ? `${JSON.stringify(font)}, sans-serif` : 'inherit', fontSize: '27px', lineHeight: 1.15, fontWeight: 700, maxWidth: '80%' }}>
                {t('od.mockHeadline')}
              </span>
              <span style={{ fontSize: '13px', color: p.muted ?? p.text, maxWidth: '70%' }}>{t('od.mockBody')}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: 'auto', flexWrap: 'wrap' }}>
                <span style={{ background: accent, color: p.background ?? '#000', padding: '9px 17px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600 }}>
                  {t('od.mockCta')}
                </span>
                <span style={{ background: p.surface ?? 'transparent', border: `1px solid ${p.muted ?? 'rgba(128,128,128,.4)'}`, padding: '8px 16px', borderRadius: '7px', fontSize: '12.5px' }}>
                  {t('od.mockSecondary')}
                </span>
              </div>
            </div>
            )}

            {sys.intent && <p style={DS.hint}>{sys.intent}</p>}

            <div style={DS.chipRow}>
              {([['bg', p.background], ['surface', p.surface], ['text', p.text], ['muted', p.muted], ['base', p.base]] as Array<[string, string | undefined]>)
                .filter(([, c]) => !!c)
                .concat(sys.accents.map((c, i) => [`accent ${i + 1}`, c] as [string, string]))
                .map(([label, c]) => (
                  <span key={label} title={`${label}: ${c}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ ...DS.roleSw, width: '20px', height: '20px', background: c }} />
                    <span style={DS.roleHex}>{label}</span>
                  </span>
                ))}
            </div>

            {sys.fonts.length > 0 && <p style={DS.hint}>🔤 {sys.fonts.join(' · ')}</p>}
            <p style={DS.hint}>{t('od.tokenCount', { n: sys.tokenCount })}</p>

            {/* Anti-patterns: only 6 of 150 systems author their own. Showing the
                boilerplate as if it were curated guidance would be a fabricated
                value — so it is named for what it is. */}
            {sys.authoredAntiPatterns ? (
              <div style={{ width: '100%' }}>
                <p style={DS.label}>{t('od.rules')}</p>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                  {sys.antiPatterns.map((a) => <li key={a} style={{ ...DS.hint, margin: '2px 0' }}>{a}</li>)}
                </ul>
              </div>
            ) : (
              <p style={DS.hint}>{t('od.genericRules')}</p>
            )}

            <p style={DS.hint}>{t('od.onDisk', { path: `design-refs/${OD_CATALOG_ID}/design-systems/${sys.id}/` })}</p>
            <p style={DS.hint}>{t('od.paletteWins')}</p>
          </>
        )}
      </div>
      </div>
    </>
  );
}

export function DesignStudio(props: {
  projectName: string;
  lane: Lane;
  hue: number; setHue: (h: number) => void;
  harmony: Harmony; setHarmony: (h: Harmony) => void;
  styleId: string | null; setStyleId: (id: string | null) => void;
  fx: Set<string>; setFx: (f: Set<string>) => void;
  saveState: 'idle' | 'saving' | 'done' | 'error';
  error: string;
  refState: 'idle' | 'working' | 'done' | 'error';
  refMsg: string;
  libraries: RefLibrary[];
  /** Open Design catalogue: the system being BROWSED (odPreview) is not the
   *  one attached to the project (designSystem) — see App.tsx. */
  odPreview: OdSystem | null;
  odState: 'idle' | 'loading' | 'error';
  odMsg: string;
  odProgress: { phase: 'fetch' | 'checkout'; count: number } | null;
  odElapsed: number;
  designSystem: OdSystem | null;
  onImportOdCatalog: () => void;
  onCheckOdCatalog: () => void;
  onOpenOdFolder: () => void;
  /** 'doc' = choosing a design for a document generated inside Muse. There is
   *  no project folder and no design-tokens.json to write, so the studio shows
   *  only what a document can actually use and drops the save footer. */
  mode: 'project' | 'doc' | 'pref';
  /** True when this creation shows the GLOBAL default rather than a design of
   *  its own — said out loud, never implied. */
  inherited: boolean;
  prefState: 'idle' | 'saving' | 'done' | 'error';
  onSavePref: () => void;
  /** The mix being edited, and what it resolves to right now. */
  mix: DesignMix;
  resolved: ResolvedDesign;
  onAssignRole: (role: DesignRole, sys: OdSystem) => void;
  onClearRole: (role: DesignRole) => void;
  onSetFontRole: (role: FontRole, family: string | null) => void;
  onOpenOdSystem: (id: string) => void;
  onUseOdSystem: (sys: OdSystem) => void;
  onClearOdSystem: () => void;
  onSave: () => void;
  onBack: () => void;
  onViewTokens: () => void;
}) {
  const { t } = useI18n();
  type Tab = 'colors' | 'styles' | 'fx' | 'ref' | 'trends' | 'mine';
  const [tab, setTab] = useState<Tab>('ref');
  const [previewId, setPreviewId] = useState<string>(props.styleId ?? STYLE_PRESETS[0].id);
  const [odFilter, setOdFilter] = useState('');
  // Probed once: the installed set does not change while the studio is open.
  const installed = useMemo(() => detectInstalledFonts(), []);
  const preset = STYLE_PRESETS.find((p) => p.id === props.styleId) ?? null;
  const previewPreset = STYLE_PRESETS.find((p) => p.id === previewId) ?? STYLE_PRESETS[0];
  const pal = computePalette(props.hue, props.harmony, preset?.scheme ?? 'dark');
  // A document is rendered inside Muse from a text directive: the wheel, the
  // effects and the GitHub reference feed design-tokens.json, which no document
  // reads. Showing them here would be offering choices that change nothing.
  // Open Design first (Tony): the 151 systems ARE the studio, "Mon design"
  // holds the mix they feed, and the older screens move behind them.
  const TABS: Array<[Tab, string]> = props.mode === 'pref'
    ? [['ref', `🎛 ${t('mix.tabSystems')}`], ['mine', `🎨 ${t('mix.tabMine')}`], ['colors', '🎡 Couleurs'], ['fx', '✨ Effets']]
    : props.mode === 'doc'
    ? [['ref', `🎛 ${t('mix.tabSystems')}`], ['mine', `🎨 ${t('mix.tabMine')}`]]
    : props.lane === 'site'
      ? [['ref', `🎛 ${t('mix.tabSystems')}`], ['mine', `🎨 ${t('mix.tabMine')}`], ['styles', '🖼 Styles'], ['colors', '🎡 Couleurs'], ['fx', '✨ Effets'], ['trends', '🔮 Tendances']]
      : [['ref', `🎛 ${t('mix.tabSystems')}`], ['mine', `🎨 ${t('mix.tabMine')}`], ['colors', '🎡 Couleurs'], ['fx', '✨ Effets'], ['trends', '🔮 Tendances']];

  return (
    <div style={DS.wrap}>
      <div style={DS.inner}>
        <div style={DS.head}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
            <h1 style={DS.title}>🎨 {props.mode === 'pref' ? t('pref.title') : 'Studio design'}</h1>
            <p style={DS.sub}>{props.mode === 'pref' ? t('pref.subtitle') : <>{props.projectName} — tes choix sortent dans <b>design-tokens.json</b>, l’agent IDE les applique tels quels.</>}</p>
            {props.inherited && <p style={{ ...DS.hint, color: '#f0c674' }}>{t('pref.inherited')}</p>}
          </div>
          <button style={DS.secondary} onClick={props.onBack}>← Retour au projet</button>
        </div>

        <div style={DS.tabRow}>
          {TABS.map(([id, label]) => (
            <button key={id} style={{ ...DS.tab, ...(tab === id ? DS.tabOn : {}) }} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* ── Mon design: the mix itself, one card per role, provenance shown
             on every card. An unset role says it follows the base rather than
             showing a value with no origin. ────────────────────────────── */}
        {tab === 'mine' && (
          <div style={DS.panel}>
            <p style={DS.label}>{t('mix.title')}</p>
            <p style={DS.hint}>{t('mix.hint')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(228px, 1fr))', gap: '11px', width: '100%' }}>
              {(['colors', 'typography', 'components'] as const).map((role) => {
                const prov = props.resolved.provenance[role];
                const explicit = props.mix.roles[role];
                return (
                  <div key={role} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)' }}>
                    <span style={DS.label}>{t(`mix.role.${role}`)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: prov ? '#eaf2ff' : '#5f6f92' }}>
                      {prov?.kind === 'system' ? prov.name : prov?.kind === 'manual' ? t('mix.byYou') : t('mix.unset')}
                    </span>
                    <span style={DS.hint}>
                      {explicit ? t('mix.explicit') : prov ? t('mix.fromBase') : t('mix.unsetHint')}
                    </span>
                    {role === 'colors' && (
                      <div style={DS.chipRow}>
                        {[props.resolved.palette.background, props.resolved.palette.surface, props.resolved.palette.text, props.resolved.palette.muted, props.resolved.palette.base]
                          .filter(Boolean)
                          .map((c, i) => <span key={i} style={{ ...DS.roleSw, width: '20px', height: '20px', background: c }} />)}
                      </div>
                    )}
                    {role === 'typography' && props.resolved.fonts.length > 0 && (
                      <span style={DS.hint}>{props.resolved.fonts.join(' · ')}</span>
                    )}
                    {role === 'components' && props.resolved.componentsFrom && (
                      <span style={DS.hint}>{t('mix.componentsPath')}</span>
                    )}
                    {explicit && <button style={DS.link} onClick={() => props.onClearRole(role)}>{t('mix.clearRole')}</button>}
                  </div>
                );
              })}
              {/* Effects are nobody's system — the card says so instead of
                  letting them look like part of a design system. */}
              <div style={{ border: '1px dashed rgba(255,255,255,0.14)', borderRadius: '12px', padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={DS.label}>{t('mix.role.effects')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: props.fx.size ? '#eaf2ff' : '#5f6f92' }}>
                  {props.fx.size ? t('mix.byYou') : t('mix.unset')}
                </span>
                <span style={DS.hint}>{t('mix.effectsHint')}</span>
                <div style={DS.chipRow}>
                  {FX_OPTIONS.map((fx) => (
                    <button
                      key={fx.id}
                      style={{ ...DS.chip, ...(props.fx.has(fx.id) ? DS.chipOn : {}) }}
                      onClick={() => { const nx = new Set(props.fx); if (nx.has(fx.id)) nx.delete(fx.id); else nx.add(fx.id); props.setFx(nx); }}
                    >{fx.label}</button>
                  ))}
                </div>
              </div>
            </div>
            {/* Typography per tag, from the fonts really installed here. */}
            <p style={DS.label}>{t('font.title')}</p>
            <p style={DS.hint}>{t('font.hint', { n: installed.length })}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))', gap: '10px', width: '100%' }}>
              {FONT_ROLES.map((role) => {
                const chosen = props.mix.fontRoles?.[role];
                return (
                  <div key={role} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: '11px', padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <span style={DS.label}>{t(`font.role.${role}`)}</span>
                    <span style={{
                      fontFamily: chosen ? fontStack(chosen) : 'inherit',
                      fontSize: role === 'h1' ? '22px' : role === 'h2' ? '18px' : '15px',
                      fontWeight: role.startsWith('h') ? 700 : 400,
                      color: chosen ? '#eaf2ff' : '#5f6f92',
                      lineHeight: 1.2,
                    }}>{chosen ?? t('font.unset')}</span>
                    <select
                      style={{ ...DS.refInput, padding: '7px 9px', fontSize: '12px', minWidth: 0 }}
                      value={chosen ?? ''}
                      onChange={(e) => props.onSetFontRole(role, e.target.value || null)}
                    >
                      <option value="">{t('font.fromSystem')}</option>
                      {installed.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            {installed.length === 0 && <p style={DS.hint}>{t('font.none')}</p>}
            {props.resolved.empty && <p style={DS.hint}>{t('mix.emptyHint')}</p>}
          </div>
        )}

        {tab === 'colors' && (
          <div style={DS.panel}>
            {/* An attached system's palette wins in design-tokens.json. Saying
                so here is the whole point: a wheel that no longer drives
                anything, left looking live, is a label pretending to be state. */}
            {props.designSystem && (
              <p style={{ ...DS.hint, color: '#f0c674' }}>{t('od.wheelOverridden', { name: props.designSystem.name })}</p>
            )}
            <div style={DS.colorsGrid}>
              <div style={DS.col}>
                <p style={DS.label}>Roue chromatique — clique ta teinte</p>
                <div
                  style={DS.wheel}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const dx = e.clientX - (r.left + r.width / 2);
                    const dy = e.clientY - (r.top + r.height / 2);
                    props.setHue(Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360));
                  }}
                >
                  <span style={{ ...DS.wheelDot, left: `${50 + 42 * Math.sin(props.hue * Math.PI / 180)}%`, top: `${50 - 42 * Math.cos(props.hue * Math.PI / 180)}%`, background: hslToHex(props.hue, 72, 56) }} />
                </div>
                <div style={DS.chipRow}>
                  {([['analogous', 'Analogue'], ['complementary', 'Complémentaire'], ['triadic', 'Triade'], ['mono', 'Mono']] as Array<[Harmony, string]>).map(([h, label]) => (
                    <button key={h} style={{ ...DS.chip, ...(props.harmony === h ? DS.chipOn : {}) }} onClick={() => props.setHarmony(h)}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={DS.col}>
                <p style={DS.label}>Palette de rôles — concordance calculée</p>
                <div style={DS.roleList}>
                  {([['Base', pal.base], ...pal.accents.map((a, i) => [`Accent ${i + 1}`, a] as [string, string]), ['Fond', pal.background], ['Surface', pal.surface], ['Texte', pal.text]] as Array<[string, string]>).map(([label, c]) => (
                    <div key={label} style={DS.roleRow}>
                      <span style={{ ...DS.roleSw, background: c }} />
                      <span style={DS.roleName}>{label}</span>
                      <span style={DS.roleHex}>{c}</span>
                    </div>
                  ))}
                </div>
                <p style={DS.hint}>Le thème clair/sombre suit le style choisi ({preset ? preset.name : 'aucun → sombre'}).</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'styles' && (
          <div style={DS.panel}>
            <div style={DS.stylesGrid} className="studio-styles">
              <div style={DS.styleList}>
                {STYLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    style={{ ...DS.styleRow, ...(previewId === p.id ? DS.styleRowFocus : {}), ...(props.styleId === p.id ? DS.styleRowOn : {}) }}
                    onClick={() => setPreviewId(p.id)}
                  >
                    <span style={{ ...DS.styleThumb, ...p.bn }}>{p.name}</span>
                    <span style={DS.styleMeta}>
                      <span style={DS.styleName}>{props.styleId === p.id ? '✓ ' : ''}{p.name}</span>
                      <span style={DS.styleTag}>{p.scheme === 'dark' ? '◐ DARK' : '☀ LIGHT'}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div style={DS.previewCol}>
                <StyleMock p={previewPreset} />
                <p style={DS.previewDesc}>{previewPreset.desc}</p>
                <button
                  style={{ ...DS.primary, ...(props.styleId === previewPreset.id ? DS.primaryOk : {}) }}
                  onClick={() => props.setStyleId(props.styleId === previewPreset.id ? null : previewPreset.id)}
                >
                  {props.styleId === previewPreset.id ? '✓ Style choisi — cliquer pour retirer' : `Utiliser « ${previewPreset.name} »`}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'fx' && (
          <div style={DS.panel}>
            <p style={DS.label}>Effets voulus — l’agent les respecte (et n’en ajoute pas d’autres)</p>
            <div style={DS.chipRow}>
              {FX_OPTIONS.map((fx) => (
                <button
                  key={fx.id}
                  style={{ ...DS.chip, ...(props.fx.has(fx.id) ? DS.chipOn : {}) }}
                  onClick={() => { const nx = new Set(props.fx); if (nx.has(fx.id)) nx.delete(fx.id); else nx.add(fx.id); props.setFx(nx); }}
                >{fx.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Systems: the catalogue IS this screen now. The GitHub-kit importer
             and its button-adapting agent were removed — Open Design covers
             the need with declared tokens instead of scraped CSS. */}
        {tab === 'ref' && (
          <div style={DS.panel}>
            {!props.libraries.some(isOdCatalog) && (
              <div style={DS.adaptBox}>
                <p style={DS.label}>{t('od.title')}</p>
                <p style={DS.hint}>{t('od.pitch')}</p>
                <p style={DS.hint}>{t('od.weight')}</p>
                <button
                  style={{ ...DS.primary, padding: '10px 18px', fontSize: '13.5px', ...(props.refState === 'working' ? { opacity: 0.6, cursor: 'wait' } : {}) }}
                  disabled={props.refState === 'working'}
                  onClick={props.onImportOdCatalog}
                >
                  {props.refState === 'working' ? t('od.importing') : t('od.import')}
                </button>
                {props.odProgress && (() => {
                  const pct = odPercent(props.odProgress.count, props.odProgress.phase === 'checkout' ? OD_EXPECTED_SYSTEMS : null);
                  return (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <div style={{ position: 'relative', height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        {pct !== null
                          ? <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: '999px', background: 'linear-gradient(90deg, #3b82f6, #7dd3fc)', transition: 'width .45s ease' }} />
                          : <span className="mu-indet" style={{ background: 'linear-gradient(90deg, transparent, rgba(125,211,252,0.8), transparent)' }} />}
                      </div>
                      <p style={DS.hint}>
                        {pct !== null
                          ? t('od.progressCheckout', { n: props.odProgress.count, total: OD_EXPECTED_SYSTEMS, pct })
                          : t('od.progressFetch')}
                        {' · '}{odElapsedLabel(props.odElapsed)}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
            {props.refMsg && (
              <p style={{ ...DS.hint, color: props.refState === 'error' ? '#fca5a5' : props.refState === 'done' ? '#5ed6a0' : '#9fb2d6' }}>
                {props.refState === 'done' ? '✅ ' : props.refState === 'error' ? '⚠️ ' : ''}{props.refMsg}
              </p>
            )}
            {(() => {
              const cat = props.libraries.find(isOdCatalog);
              if (!cat) return null;
              return (
                <OdSystemBrowser
                  lib={cat}
                  filter={odFilter} setFilter={setOdFilter}
                  preview={props.odPreview} state={props.odState} msg={props.odMsg}
                  designSystem={props.designSystem}
                  onOpen={props.onOpenOdSystem}
                  onUse={props.onUseOdSystem}
                  onClear={props.onClearOdSystem}
                  onCheck={props.onCheckOdCatalog}
                  onOpenFolder={props.onOpenOdFolder}
                  onAssignRole={props.onAssignRole}
                  roleOf={(role) => props.mix.roles[role] ?? null}
                  busy={props.refState === 'working'}
                  t={t}
                />
              );
            })()}
          </div>
        )}
        {tab === 'trends' && (
          <div style={DS.panel}>
            <div style={DS.trendBox}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#c9b8ff' }}>🔮 Check tendances — bientôt</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#9fb2d6', lineHeight: 1.6 }}>
                L’espace est réservé : scrap Pinterest, moodboards, tendances du moment, articles design.
                Tu cocheras ce qui t’inspire et l’agent IDE recevra tes références avec les tokens.
              </p>
            </div>
          </div>
        )}

        {props.error && <div style={DS.error}>⚠️ {props.error}</div>}
        {/* Document mode has nothing to save: the choice is carried back to the
            document itself, so a save button here would write nowhere. */}
        {props.mode === 'pref' ? (
          <div style={DS.footRow}>
            <button style={DS.primary} disabled={props.prefState === 'saving'} onClick={props.onSavePref}>
              {props.prefState === 'saving' ? t('pref.saving') : props.prefState === 'done' ? t('pref.saved') : t('pref.save')}
            </button>
            <span style={{ flex: 1 }} />
            <span style={DS.hint}>{t('pref.footHint')}</span>
            <button style={DS.secondary} onClick={props.onBack}>{t('pref.back')}</button>
          </div>
        ) : props.mode === 'doc' ? (
          <div style={DS.footRow}>
            <span style={DS.hint}>
              {props.designSystem ? t('od.docAttached', { name: props.designSystem.name }) : t('od.docPickHint')}
            </span>
            <span style={{ flex: 1 }} />
            <button style={DS.secondary} onClick={props.onBack}>{t('od.docBack')}</button>
          </div>
        ) : (
        <div style={DS.footRow}>
          <button style={DS.primary} disabled={props.saveState === 'saving'} onClick={props.onSave}>
            {props.saveState === 'saving' ? '⏳ Enregistrement…' : props.saveState === 'done' ? '✓ Design enregistré' : '💾 Enregistrer le design'}
          </button>
          {props.saveState === 'done' && <button style={DS.link} onClick={props.onViewTokens}>👁 voir les tokens</button>}
          <span style={{ flex: 1 }} />
          <span style={DS.hint}>
            {preset ? `Style : ${preset.name}` : 'Style : aucun'} · Teinte {props.hue}° · {props.fx.size} effet{props.fx.size > 1 ? 's' : ''}
            {props.designSystem ? ` · ${t('od.footSystem', { name: props.designSystem.name })}` : ''}
          </span>
        </div>
        )}
      </div>
    </div>
  );
}

const DS: Record<string, CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, overflowY: 'auto', width: '100%', boxSizing: 'border-box', animation: 'ab-fade 0.45s ease both' },
  inner: { width: '100%', maxWidth: '1280px', margin: '0 auto', padding: 'clamp(14px, 3vw, 26px)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' },
  head: { display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' },
  title: { fontSize: '22px', fontWeight: 700, margin: 0, color: '#eaf2ff' },
  sub: { fontSize: '13.5px', color: '#9fb2d6', margin: 0 },
  secondary: { fontSize: '14px', fontWeight: 600, padding: '11px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', color: '#dbe7ff', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' },
  tab: { fontSize: '13px', fontWeight: 700, padding: '9px 16px', borderRadius: '10px', border: '1px solid transparent', background: 'none', color: '#9fb2d6', cursor: 'pointer', fontFamily: 'inherit' },
  tabOn: { border: '1px solid rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.14)', color: '#7dd3fc' },
  panel: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' },
  colorsGrid: { display: 'flex', gap: '28px', flexWrap: 'wrap' },
  col: { display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 280px', minWidth: '250px' },
  label: { margin: 0, fontSize: '12px', fontWeight: 700, color: '#9fb2d6', textTransform: 'uppercase', letterSpacing: '0.06em' },
  wheel: { width: '190px', height: '190px', borderRadius: '50%', position: 'relative', cursor: 'crosshair', flexShrink: 0, background: 'conic-gradient(from 0deg, #f00, #ff0 60deg, #0f0 120deg, #0ff 180deg, #00f 240deg, #f0f 300deg, #f00 360deg)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.35)' },
  wheelDot: { position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #fff', transform: 'translate(-50%, -50%)', boxShadow: '0 0 10px rgba(0,0,0,0.65)', pointerEvents: 'none' },
  chipRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: { fontSize: '12.5px', fontWeight: 600, padding: '7px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#9fb2d6', cursor: 'pointer', fontFamily: 'inherit' },
  chipOn: { border: '1px solid rgba(59,130,246,0.6)', background: 'rgba(59,130,246,0.16)', color: '#7dd3fc' },
  roleList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  roleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  roleSw: { width: '30px', height: '30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0 },
  roleName: { fontSize: '13px', fontWeight: 600, color: '#dbe7ff', width: '84px' },
  roleHex: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11.5px', color: '#5f6f92' },
  hint: { margin: 0, fontSize: '12px', color: '#5f6f92' },
  stylesGrid: { display: 'flex', gap: '18px', alignItems: 'stretch' },
  styleList: { display: 'flex', flexDirection: 'column', gap: '6px', width: '250px', flexShrink: 0, maxHeight: '430px', overflowY: 'auto', paddingRight: '4px' },
  styleRow: { display: 'flex', flexDirection: 'column', gap: '5px', padding: '8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', font: 'inherit', color: '#eaf2ff', textAlign: 'left' },
  styleRowFocus: { border: '1px solid rgba(125,211,252,0.45)' },
  styleRowOn: { background: 'rgba(59,130,246,0.1)', boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.45)' },
  styleThumb: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '34px', borderRadius: '6px', fontSize: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' },
  styleMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  styleName: { fontSize: '12.5px', fontWeight: 700 },
  styleTag: { fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#5f6f92' },
  previewCol: { flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px' },
  previewDesc: { margin: 0, fontSize: '12.5px', color: '#9fb2d6' },
  primary: { fontSize: '15px', fontWeight: 700, padding: '13px 22px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.14)', cursor: 'pointer', color: '#ffffff', background: 'linear-gradient(180deg, #4f93ff 0%, #2f6fe6 55%, #2560d0 100%)', boxShadow: '0 8px 22px rgba(37,99,235,0.32)', fontFamily: 'inherit' },
  primaryOk: { background: 'linear-gradient(180deg, #34d399 0%, #10b981 60%, #0a9e6e 100%)', boxShadow: '0 8px 22px rgba(16,185,129,0.3)' },
  link: { background: 'none', border: 'none', color: '#7dd3fc', cursor: 'pointer', fontSize: '13px', fontWeight: 600, textDecoration: 'underline', fontFamily: 'inherit' },
  trendBox: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '22px 24px', borderRadius: '14px', border: '1px dashed rgba(139,124,240,0.4)', background: 'rgba(139,124,240,0.06)' },
  refInput: { flex: 1, minWidth: '240px', boxSizing: 'border-box', fontSize: '13.5px', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#eaf2ff', outline: 'none', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
  libGrid: { display: 'flex', gap: '16px', alignItems: 'stretch', width: '100%' },
  libList: { display: 'flex', flexDirection: 'column', gap: '6px', width: '220px', flexShrink: 0, maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' },
  libRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', font: 'inherit', color: '#eaf2ff', textAlign: 'left', width: '100%', boxSizing: 'border-box' },
  libRowFocus: { border: '1px solid rgba(125,211,252,0.45)' },
  libRowOn: { background: 'rgba(94,214,160,0.08)', boxShadow: 'inset 0 0 0 1px rgba(94,214,160,0.35)' },
  libRowName: { fontSize: '13px', fontWeight: 700 },
  libRowMeta: { fontSize: '10.5px', color: '#5f6f92' },
  libDetail: { flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', boxSizing: 'border-box' },
  libTitle: { fontSize: '15px', fontWeight: 700, color: '#eaf2ff' },
  scaleList: { display: 'flex', flexDirection: 'column', gap: '5px', width: '100%', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' },
  scaleRow: { display: 'flex', alignItems: 'center', gap: '4px' },
  scaleName: { width: '96px', flexShrink: 0, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '10.5px', color: '#9fb2d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  scaleSw: { width: '18px', height: '18px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.14)', flexShrink: 0 },
  adaptBox: { width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: '12px', padding: '12px 16px', fontSize: '13px' },
  footRow: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
};
