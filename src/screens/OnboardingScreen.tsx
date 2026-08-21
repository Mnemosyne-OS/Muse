// First-run onboarding (5 steps: welcome -> editor -> space -> install -> ready).
// Extracted out of App.tsx's view chain — this screen owns no state of its
// own beyond what App() already tracks; it receives it all as props.
import { detectOs, downloadUrl, osLabel, type Installable } from '../appLogic';
import { Logo, LogoIcon, S, btn } from '../Chrome';

export type Ide = {
  id: string; name: string; page: string;
  direct?: string; directByOs?: { win: string; mac: string; linux: string };
  tagKind?: 'reco' | 'expert';
};

// Ordered by beginner-friendliness: agent-first tools that code out of the box
// first; VS Code last (no built-in agent — needs extension/API config = expert).
// `desc` and the tag text are looked up as t(`ide.desc.${id}`) /
// t(`ide.tag.${tagKind}`) at render time — this array is module-level,
// outside the component's useI18n() closure.
export const IDES: Ide[] = [
  { id: 'antigravity', name: 'Antigravity', tagKind: 'reco', direct: 'https://antigravity.google/download', page: 'https://antigravity.google' },
  { id: 'claude-code', name: 'Claude Code', direct: 'https://claude.com/download', page: 'https://claude.com/product/claude-code' },
  { id: 'cursor', name: 'Cursor', direct: 'https://cursor.com/download', page: 'https://cursor.com' },
  {
    id: 'vscode', name: 'VS Code', tagKind: 'expert',
    directByOs: {
      win: 'https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user',
      mac: 'https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal',
      linux: 'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64',
    },
    page: 'https://code.visualstudio.com/Download',
  },
];

type T = (key: string, vars?: Record<string, string | number>) => string;

export function OnboardingScreen({
  t, error, onRetryBoot, obStep, setObStep, os, setOs, ide, setIde, folder, installed, installables,
  onPickFolder, onCompleteOnboarding, onDocsOnly, onOpenExternal, onInstallClick,
}: {
  t: T;
  error: string;
  /** Set ONLY when the sandbox boot failed — the banner then offers a retry
   *  (first-run authorization answered too late; the grant persists). */
  onRetryBoot?: () => void;
  obStep: number;
  setObStep: (step: number) => void;
  os: string;
  setOs: (os: string) => void;
  ide: string;
  setIde: (id: string) => void;
  folder: string;
  installed: Record<string, boolean>;
  installables: Installable[];
  onPickFolder: () => void;
  onCompleteOnboarding: () => void;
  /** "Documents only": finishes onboarding on the spot — no IDE, no app
   *  space, no repo. The doc lane needs none of it, so none of it is asked. */
  onDocsOnly: () => void;
  onOpenExternal: (url: string) => void;
  onInstallClick: (item: Installable) => void;
}) {
  return (
    <div style={S.ob}>
      <div style={S.obDots}>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ ...S.dot, ...(i <= obStep ? S.dotOn : {}) }} />)}
      </div>
      {error && (
        <div role="alert" style={S.error}>
          ⚠️ {error}
          {onRetryBoot && <button className="mu-btn" style={{ marginLeft: 10 }} onClick={onRetryBoot}>{t('err.retry')}</button>}
        </div>
      )}

      {obStep === 0 && (
        <div style={S.obBody}>
          <Logo mode="intro" />
          <h1 style={S.h1}>{t('ob.welcome')}</h1>
          <p style={S.sub}>{t('ob.welcomeSub')}</p>
          {/* The fork Tony asked for: document-only people skip the whole IDE /
              space / repo journey — their Muse is the studio, nothing else. */}
          <button className="mu-btn mu-cta" style={S.primary} onClick={() => setObStep(1)}>{t('ob.fullCreate')}</button>
          <button className="mu-btn mu-cta" style={{ ...S.primary, background: 'color-mix(in srgb, var(--mu-accent) 10%, transparent)', color: 'var(--mu-text)' }} onClick={onDocsOnly}>{t('ob.docsOnly')}</button>
          <button className="mu-btn" style={S.back} onClick={onCompleteOnboarding}>{t('ob.skip')}</button>
        </div>
      )}

      {obStep === 1 && (
        <div style={S.obBody}>
          <h1 style={S.h1}>{t('ob.editorTitle')}</h1>
          <p style={S.sub}>{t('ob.editorSub')}</p>
          {!os
            ? <button className="mu-btn" style={S.secondary} onClick={() => setOs(detectOs())}>{t('ob.detect')}</button>
            : <p style={S.sub}>{t('ob.system')} <b style={{ color: 'var(--mu-link)' }}>{osLabel(os, t)}</b> · <button className="mu-btn" style={S.linkBtn} onClick={() => setOs('')}>{t('ob.change')}</button></p>}
          <div className="ide-grid" style={S.ideGrid}>
            {IDES.map((o) => (
              <button key={o.id} style={{ ...S.ideCard, ...(ide === o.id ? S.ideCardOn : {}) }} onClick={() => setIde(o.id)}>
                <LogoIcon id={o.id} />
                <span style={S.ideName}>{o.name}</span>
                {o.tagKind && <span style={o.tagKind === 'expert' ? S.tagExpert : S.tagReco}>{t(`ide.tag.${o.tagKind}`)}</span>}
                <span style={S.ideDesc}>{t(`ide.desc.${o.id}`)}</span>
                {os && (
                  <span style={S.ideLinks}>
                    <button className="mu-btn" style={S.ideLinkPrimary} onClick={(e) => { e.stopPropagation(); onOpenExternal(downloadUrl(o, os)); }}>{t('ob.download')}</button>
                    <button style={S.ideLink} onClick={(e) => { e.stopPropagation(); onOpenExternal(o.page); }}>{t('ob.pageLink')}</button>
                  </span>
                )}
              </button>
            ))}
          </div>
          <button style={btn(!ide)} disabled={!ide} onClick={() => setObStep(2)}>{t('ob.next')}</button>
          <button style={S.back} onClick={() => setObStep(0)}>{t('ob.backStep')}</button>
        </div>
      )}

      {obStep === 2 && (
        <div style={S.obBody}>
          <h1 style={S.h1}>{t('ob.spaceTitle')}</h1>
          <p style={S.sub}>{t('ob.spaceSub1')} <b style={{ color: 'var(--mu-link)' }}>{t('ob.spaceSubBold')}</b> {t('ob.spaceSub2')}</p>
          <button className="mu-btn" style={S.secondary} onClick={onPickFolder}>📁 {folder ? t('ob.changeFolder') : t('ob.chooseFolder')}</button>
          {folder && <p style={S.pathLabel}>✓ {folder}</p>}
          <p style={S.soonNote}>{t('ob.anyOs')}</p>
          <button style={btn(!folder)} disabled={!folder} onClick={() => setObStep(3)}>{t('ob.next')}</button>
          <button style={S.back} onClick={() => setObStep(1)}>{t('ob.backStep')}</button>
        </div>
      )}

      {obStep === 3 && (
        <div style={S.obBody}>
          <h1 style={S.h1}>{t('ob.codeAndExamplesTitle')}</h1>
          <p style={S.sub}>{t('ob.installOne')} <b style={{ color: 'var(--mu-link)' }}>{t('ob.yourSpace')}</b>{t('ob.installTwo')}</p>

          <div style={S.exList}>
            {installables.map((item) => (
              <div key={item.id} style={S.exRow}>
                <span style={S.exIcon}>{item.icon}</span>
                <span style={S.exInfo}>
                  <span style={S.exName}>{item.name}</span>
                  <span style={S.exDesc}>{t(`install.desc.${item.id}`)}</span>
                </span>
                <button style={S.ideLink} title={t('install.viewOnGithub')} aria-label={t('install.viewOnGithub')} onClick={() => onOpenExternal(item.repo)}>↗</button>
                {installed[item.id]
                  ? <span style={S.installedTag}>{t('ob.installed')}</span>
                  : <button className="mu-btn" style={S.installBtn} onClick={() => onInstallClick(item)}>{t('install.installButton')}</button>}
              </div>
            ))}
          </div>

          <button style={S.primary} onClick={() => setObStep(4)}>{t('ob.next')}</button>
          <button style={S.back} onClick={() => setObStep(2)}>{t('ob.backStep')}</button>
        </div>
      )}

      {obStep === 4 && (
        <div style={S.obBody}>
          <Logo />
          <h1 style={S.h1}>{t('ob.readyTitle')}</h1>
          <p style={S.sub}>{t('ob.readySub')}</p>
          <button style={S.primary} onClick={onCompleteOnboarding}>{t('ob.enterMuse')}</button>
        </div>
      )}
    </div>
  );
}
