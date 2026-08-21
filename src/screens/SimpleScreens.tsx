// The four smallest, most self-contained views in App.tsx's `view` state
// machine — no business logic of their own, just a handful of props and a
// couple of setView() calls. Extracted first (of the eventual full-screen
// decomposition) precisely because they're this small: each one's full set
// of dependencies fits in one typed props object, so nothing can be silently
// missed — an omitted prop is a compile error, not a runtime surprise.
import { ChannelBadge, Logo, InfinityLoader, S, btn } from '../Chrome';

type T = (key: string, vars?: Record<string, string | number>) => string;

/** First screen: the animated Muse mark, tagline, click-through to onboarding
 *  (first run) or straight to the dashboard (returning user). */
export function IntroScreen({ t, onboarded, onEnter }: {
  t: T;
  onboarded: boolean;
  onEnter: (next: 'onboarding' | 'dashboard') => void;
}) {
  return (
    <div style={S.intro} onClick={() => onEnter(onboarded ? 'dashboard' : 'onboarding')}>
      <Logo mode="intro" />
      <div className="ab-word" style={S.wordRow}>
        <span style={{ ...S.word, marginTop: 0 }}>Muse</span>
        <ChannelBadge size="lg" />
      </div>
      <div className="ab-t1" style={S.t1}>{t('intro.tagline1')} <b style={{ color: 'var(--mu-link)' }}>{t('intro.neural')}</b></div>
      <div className="ab-t2" style={S.t2}>{t('intro.tagline2')}<br />{t('intro.tagline3')}</div>
      <InfinityLoader />
    </div>
  );
}

/** Onboarding-handover screen: the mark, a breath, then the dashboard. */
export function ReadyScreen({ t }: { t: T }) {
  return (
    <div style={S.ready}>
      <div className="mu-ready-in">
        <Logo mode="ambient" />
      </div>
      <div className="mu-ready-word" style={S.readyWord}>{t('ready.title')}</div>
    </div>
  );
}

/** Naming screen: the last step before generation — asks for a name, then
 *  kicks off `onGenerate` (Enter or the primary button, both gated on a
 *  non-empty trimmed name). `onAdvanced` opens the block-by-block builder
 *  instead of the one-shot render — same gate, quieter affordance. */
export function NameScreen({ t, purpose, name, onNameChange, onGenerate, onAdvanced, onBack }: {
  t: T;
  purpose: string;
  name: string;
  onNameChange: (name: string) => void;
  onGenerate: () => void;
  onAdvanced?: () => void;
  onBack: () => void;
}) {
  return (
    <div style={S.center}>
      <div style={S.hero}>🏷️</div>
      <h1 style={S.h1}>{t('name.title')}</h1>
      <p style={S.sub}>« {purpose} »</p>
      <input
        autoFocus style={S.input} value={name}
        placeholder={t('name.placeholder')} aria-label={t('name.placeholder')}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && onGenerate()}
      />
      <button style={btn(!name.trim())} disabled={!name.trim()} onClick={onGenerate}>{t('name.create')}</button>
      {onAdvanced && (
        <button
          style={{ ...S.linkBtn, opacity: name.trim() ? 1 : 0.45, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
          disabled={!name.trim()}
          onClick={onAdvanced}
        >
          {t('name.advanced')}
        </button>
      )}
      <button style={S.back} onClick={onBack}>{t('name.back')}</button>
    </div>
  );
}

/** Generation-in-progress screen: an ambient mark plus a stage-appropriate
 *  status line (planning vs. rendering, and eco skips the illustration pass). */
export function GeneratingScreen({ t, name, genStage, docTier }: {
  t: T;
  name: string;
  genStage: 'plan' | 'render';
  docTier: 'eco' | 'standard' | 'max';
}) {
  return (
    <div style={S.center}>
      <Logo mode="ambient" />
      <h1 style={S.h1}>{t('gen.making', { name })}</h1>
      <p style={S.sub}>
        {genStage === 'plan' ? t('gen.plan') : docTier === 'eco' ? t('gen.layoutOnly') : t('gen.layout')}
      </p>
    </div>
  );
}
