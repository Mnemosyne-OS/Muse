// Framing chat (BMAD one-question-at-a-time) + the recap/options panel once
// a brief has been produced. Extracted out of App.tsx's view chain — owns
// no state, just renders what App() already tracks.
import type { RefObject } from 'react';
import { STYLE_PRESETS } from '../DesignStudio';
import { GBack, GDoc, GFolder, GPalette, GSliders, GSpark } from '../Glyphs';
import { S, btn } from '../Chrome';
import { type ChatMsg, type FramingBrief, type MemorySource , type OdSystem } from '../handoff';
import { memLabelUI, type Installable } from '../appLogic';

type T = (key: string, vars?: Record<string, string | number>) => string;

export function BriefScreen({
  t, groundingBadge, chat, thinking, brief, chatRef, chatInputRef, chatInput, setChatInput,
  folder, docsState, error, memVault, installables,
  docStyle, setDocStyle, docTier, setDocTier, docFormat, setDocFormat, docImages, docSvg,
  docSystem, docSystemMissing, onPickDocSystem,
  briefBlocked, scaffolding,
  onBack, onGoOnboarding, onInstallClick, onOpenImgPanel, onToggleSvg,
  onSendAnswer, onConcludeNow, onExpressMode, onGenerate, onScaffoldApp,
}: {
  t: T;
  groundingBadge: JSX.Element | null;
  chat: ChatMsg[];
  thinking: boolean;
  brief: FramingBrief | null;
  chatRef: RefObject<HTMLDivElement>;
  chatInputRef: RefObject<HTMLInputElement>;
  chatInput: string;
  setChatInput: (v: string) => void;
  folder: string;
  docsState: 'loading' | 'ok' | 'missing';
  error: string;
  memVault: MemorySource;
  installables: Installable[];
  docStyle: string | null;
  /** Open Design system chosen for this document (exclusive with docStyle). */
  docSystem: OdSystem | null;
  docSystemMissing: string | null;
  onPickDocSystem: () => void;
  setDocStyle: (id: string | null) => void;
  docTier: 'eco' | 'standard' | 'max';
  setDocTier: (tier: 'eco' | 'standard' | 'max') => void;
  docFormat: 'page' | 'long' | 'slides';
  setDocFormat: (f: 'page' | 'long' | 'slides') => void;
  docImages: unknown[];
  docSvg: boolean;
  briefBlocked: boolean;
  scaffolding: boolean;
  onBack: () => void;
  onGoOnboarding: () => void;
  onInstallClick: (item: Installable) => void;
  onOpenImgPanel: () => void;
  onToggleSvg: () => void;
  onSendAnswer: () => void;
  onConcludeNow: () => void;
  onExpressMode: () => void;
  onGenerate: () => void;
  onScaffoldApp: () => void;
}) {
  return (
    <div style={S.briefWrap}>
      <div style={S.doneHead}>
        <div>
          <h1 style={S.h1small}>{t('brief.title')}</h1>
          <p style={S.sub}>{t('brief.subtitle1')} <b style={{ color: 'var(--mu-link)' }}>{t('brief.subtitleBold')}</b>.</p>
          {/* The coach now runs on the picked memory — show what it got. */}
          {groundingBadge && <div style={{ marginTop: '8px' }}>{groundingBadge}</div>}
        </div>
        <button className="mu-btn" style={S.secondary} onClick={onBack}><GBack size={13} />{t('common.back')}</button>
      </div>
      <div ref={chatRef} style={S.chatList}>
        {chat.map((m, i) => (
          <div key={i} style={m.role === 'muse' ? S.bubbleMuse : S.bubbleUser}>{m.text}</div>
        ))}
        {thinking && <div style={{ ...S.bubbleMuse, opacity: 0.65 }}>…</div>}
        {brief && (
          <div style={S.recap}>
            <span style={S.laneBadge}>{t(`lane.badge.${brief.lane}`)}</span>
            <p style={S.stepTitle}>📐 {brief.name}</p>
            <p style={S.sub}>{brief.purpose}</p>
            {brief.features.length > 0 && (
              <ul style={S.recapList}>{brief.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
            )}
            {brief.nextSteps.length > 0 && (
              <p style={S.recapNext}>{t('brief.recapNextLabel')} {brief.nextSteps.join(' · ')}</p>
            )}
            {brief.lane !== 'doc' && !folder && (
              <p style={S.prereqRow}>{t('brief.needSpace')} <button className="mu-btn" style={S.ideLinkPrimary} onClick={onGoOnboarding}>{t('brief.goOnboarding')}</button></p>
            )}
            {brief.lane !== 'doc' && folder && docsState !== 'ok' && (
              <p style={S.prereqRow}>⚠️ {t('brief.needMemory')} <button className="mu-btn" style={S.ideLinkPrimary} onClick={() => onInstallClick(installables[0])}>{t('install.installButtonArrow')}</button></p>
            )}
            {error && <div style={S.error}>⚠️ {error}</div>}
            {brief.lane === 'doc' ? (
              <>
                {/* Same presets as the site/app lanes — a document should
                    not be the one creation with no design choice. */}
                <p style={S.memLabel}><GPalette size={11} />{t('brief.docStyleLabel')}</p>
                <div style={S.styleRow}>
                  <button
                    style={{ ...S.styleCard, ...(docStyle === null ? S.styleCardOn : {}) }}
                    onClick={() => setDocStyle(null)}
                  >
                    <span style={{ ...S.styleThumb, background: 'linear-gradient(135deg,#1a1f2e,#2b3350)', color: 'rgba(200,215,245,0.6)' }}>{t('brief.styleAutoMark')}</span>
                    <span style={S.styleCardName}>{t('brief.styleAuto')}</span>
                  </button>
                  {STYLE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      style={{ ...S.styleCard, ...(docStyle === p.id ? S.styleCardOn : {}) }}
                      title={t(`style.desc.${p.id}`)}
                      onClick={() => setDocStyle(p.id)}
                    >
                      <span style={{ ...S.styleThumb, ...p.bn }}>Aa</span>
                      <span style={S.styleCardName}>{p.name}</span>
                    </button>
                  ))}
                  {/* The imported systems are a design choice like any other —
                      a document reaches them the same way a site does. */}
                  <button
                    style={{ ...S.styleCard, ...(docSystem ? S.styleCardOn : {}) }}
                    onClick={onPickDocSystem}
                  >
                    <span style={{
                      ...S.styleThumb,
                      background: docSystem?.palette.background ?? 'linear-gradient(135deg,#141a26,#1e2a3d)',
                      color: docSystem?.palette.text ?? 'rgba(200,215,245,0.6)',
                    }}>{docSystem ? 'Aa' : '🎛'}</span>
                    <span style={S.styleCardName}>
                      {docSystem ? docSystem.name : docSystemMissing ? t('od.docSystemMissing', { id: docSystemMissing }) : t('od.docSystemPick')}
                    </span>
                  </button>
                </div>
                <p style={S.memLabel}><GSliders size={11} />{t('brief.engine')}</p>
                <div style={S.optRow}>
                  {(['eco', 'standard', 'max'] as const).map((tr) => (
                    <button key={tr} style={{ ...S.modeChip, ...(docTier === tr ? S.modeChipOn : {}) }} onClick={() => setDocTier(tr)}>
                      {t(`tier.${tr}`)}
                    </button>
                  ))}
                </div>
                <p style={S.recapNext}>{t('brief.engineHint')}</p>

                {/* Shape: a document was always a single style + engine —
                    length and layout were never a choice. */}
                <p style={S.memLabel}><GDoc size={11} />{t('brief.formatLabel')}</p>
                <div style={S.optRow}>
                  {(['page', 'long', 'slides'] as const).map((f) => (
                    <button key={f} style={{ ...S.modeChip, ...(docFormat === f ? S.modeChipOn : {}) }} onClick={() => setDocFormat(f)}>
                      {t(`brief.format.${f}`)}
                    </button>
                  ))}
                </div>
                <p style={S.recapNext}>{t(`brief.formatHint.${docFormat}`)}</p>

                {/* Visuals: real photos from a folder the user picks
                    explicitly (paths, never pasted as data — one picture
                    would blow past history's 200 KB ceiling) and/or
                    model-drawn SVG diagrams. Not gated on the app space:
                    a document's pictures live wherever the user's own
                    photos are, unrelated to whether a project folder
                    exists yet. */}
                <p style={S.memLabel}><GPalette size={11} />{t('brief.visuals')}</p>
                <div style={S.optRow}>
                  <button
                    className="mu-btn"
                    style={{ ...S.modeChip, ...(docImages.length ? S.modeChipOn : {}) }}
                    onClick={onOpenImgPanel}
                  >
                    <GFolder size={12} />
                    {docImages.length ? t('brief.imagesCount', { n: docImages.length }) : t('brief.imagesNone')}
                  </button>
                  <button
                    className="mu-btn"
                    style={{ ...S.modeChip, ...(docSvg ? S.modeChipOn : {}) }}
                    onClick={onToggleSvg}
                  >{t('brief.svgToggle')}</button>
                </div>

                <button style={btn(thinking)} disabled={thinking} onClick={onGenerate}><GSpark size={13} />{t('brief.generate')}</button>
                <p style={S.recapNext}>
                  {t('brief.genFooterLead')} <b>{memLabelUI(memVault, t)}</b>
                  {docStyle ? <> {t('brief.genFooterStyle')} <b>{STYLE_PRESETS.find((p) => p.id === docStyle)?.name}</b></> : ''}.
                </p>
              </>
            ) : (
              <button style={btn(briefBlocked)} disabled={briefBlocked} onClick={onScaffoldApp}>
                {scaffolding ? t('brief.scaffolding') : brief.lane === 'site' ? t('brief.prepareSite') : t('brief.prepareApp')}
              </button>
            )}
          </div>
        )}
      </div>
      {!brief && (
        <>
          <div style={S.chatRow}>
            <input
              ref={chatInputRef}
              autoFocus style={S.chatInput} value={chatInput} placeholder={t('brief.answerPlaceholder')} aria-label={t('brief.answerPlaceholder')}
              disabled={thinking}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendAnswer()}
            />
            <button
              style={{ ...S.chatSend, ...(thinking || !chatInput.trim() ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
              disabled={thinking || !chatInput.trim()} onClick={onSendAnswer}
              aria-label={t('brief.sendAnswer')}
            >➤</button>
          </div>
          <div style={S.chatFootRow}>
            <span style={S.soonNote}>🎙️ {t('brief.voiceSoon')}</span>
            <span style={{ flex: 1 }} />
            <button className="mu-btn" style={S.linkBtn} onClick={onConcludeNow}>{t('brief.concludeNow')}</button>
            <button className="mu-btn" style={S.linkBtn} onClick={onExpressMode}>{t('brief.expressMode')}</button>
          </div>
        </>
      )}
    </div>
  );
}
