// The finished document: header (badges describing the take ON SCREEN),
// save/print actions, the version switcher, the regenerate panel, and the
// document preview itself. Extracted out of App.tsx's view chain — owns no
// state, just renders what App() already tracks.
import { STYLE_PRESETS } from '../DesignStudio';
import { GBack, GCheck, GClock, GCost, GDoc, GFolder, GMemory, GPrint, GRefresh, GSave, GSpark } from '../Glyphs';
import { S } from '../Chrome';
import { formatCost, memLabelUI, versionTail, type DocImage, type DocVersion } from '../appLogic';
import type { DocFormat, MemorySource, OdSystem } from '../handoff';
import { dateLocale, type LangCode } from '../i18n/useI18n';

type T = (key: string, vars?: Record<string, string | number>) => string;

export function DoneScreen({
  t, lang, name, purpose, doneFrom, memVault,
  docVersions, curVersion, appHtml, appHtmlView,
  regenOpen, setRegenOpen, docSaving, folder, savedDocPath, docMsg, docOk,
  docTier, setDocTier, docStyle, setDocStyle, docFormat, setDocFormat, docImages, docSvg,
  docSystem, docSystemMissing, onPickDocSystem,
  onSaveDocument, onOpenSavedDoc, onBack, onSelectVersion, onOpenImgPanel, onToggleSvg, onRegenerate, onReopenStudio,
}: {
  t: T;
  lang: LangCode;
  name: string;
  purpose: string;
  doneFrom: 'new' | 'history';
  memVault: MemorySource;
  docVersions: DocVersion[];
  curVersion: number;
  appHtml: string;
  appHtmlView: string;
  regenOpen: boolean;
  setRegenOpen: (updater: (v: boolean) => boolean) => void;
  docSaving: boolean;
  folder: string;
  savedDocPath: string;
  docMsg: string;
  /** Outcome of the last save/open — never re-derived from the message text,
   *  which is translated (see App.tsx's docOk state). */
  docOk: boolean | null;
  docTier: 'eco' | 'standard' | 'max';
  setDocTier: (tier: 'eco' | 'standard' | 'max') => void;
  docStyle: string | null;
  /** Open Design system chosen for this document (exclusive with docStyle). */
  docSystem: OdSystem | null;
  docSystemMissing: string | null;
  onPickDocSystem: () => void;
  setDocStyle: (id: string | null) => void;
  docFormat: DocFormat;
  setDocFormat: (f: DocFormat) => void;
  docImages: DocImage[];
  docSvg: boolean;
  onSaveDocument: () => void;
  onOpenSavedDoc: () => void;
  onBack: () => void;
  onSelectVersion: (v: DocVersion) => void;
  onOpenImgPanel: () => void;
  onToggleSvg: () => void;
  onRegenerate: () => void;
  /** Back into the block-by-block builder — null when this document has no
   *  builder checkpoint to return to (quick-lane docs, lost checkpoints). */
  onReopenStudio: (() => void) | null;
}) {
  const nextVersion = Math.max(...docVersions.map((v) => v.version), 0) + 1;
  return (
    <div style={S.doneWrap}>
      <div style={S.doneHead}>
        <div style={S.doneTitleCol}>
          <div style={S.boardTitleRow}>
            <h1 style={S.h1small}><GDoc size={17} />{name || t('doc.untitled')}</h1>
            {doneFrom === 'new' && <span style={S.freshBadge}>{t('doc.fresh')}</span>}
            {(() => {
              // Everything here describes the take ON SCREEN. It used to
              // read the live picker, so an old version was labelled with
              // today's selection — the badge said "toute ma mémoire" over
              // a document that had actually been scoped to five vaults.
              const cur = docVersions.find((v) => v.version === curVersion);
              const g = cur?.grounding ?? null;
              return (
                <>
                  <span style={S.laneBadge} title={t('doc.memoryTitle')}>
                    <GMemory size={11} />{cur?.memSource !== undefined && cur?.memSource !== null ? memLabelUI(cur.memSource, t) : (cur?.memory ?? memLabelUI(memVault, t))}
                  </span>
                  {g && (
                    <span
                      style={{ ...S.laneBadge, ...(g.mode !== 'none' && g.count === 0 ? S.memGroundWarn : {}) }}
                      title={g.vaults.join(' · ')}
                    >
                      <GCheck size={11} />
                      {g.mode === 'none'
                        ? t('mem.groundOff')
                        : g.count > 0
                          ? t('doc.grounded', { n: g.count, v: String(g.vaults.length) })
                          : t('mem.groundNone')}
                    </span>
                  )}
                  {cur?.cost ? <span style={S.laneBadge} title={t('doc.costTitle')}><GCost size={11} />{formatCost(cur.cost, t, lang)}</span> : null}
                </>
              );
            })()}
          </div>
          {purpose && <p style={S.doneSub} title={purpose}>{purpose}</p>}
        </div>
        <div style={S.headActions}>
          {onReopenStudio && (
            <button
              style={S.secondary}
              title={t('studio.reopenHint')}
              onClick={onReopenStudio}
            >🧱 {t('studio.reopen')}</button>
          )}
          <button
            style={{ ...S.secondary, ...(regenOpen ? { color: 'var(--mu-link)', borderColor: 'color-mix(in srgb, var(--mu-accent) 50%, transparent)' } : {}) }}
            title={t('doc.regen')}
            onClick={() => setRegenOpen((v) => !v)}
          ><GRefresh size={13} />{t('doc.regen')}</button>
          <button
            style={{ ...S.launchBtn, ...(docSaving ? { opacity: 0.6, cursor: 'wait' } : {}) }}
            disabled={docSaving || !folder}
            title={folder ? t('doc.saveTitleReady') : t('doc.saveTitleNeedSpace')}
            onClick={onSaveDocument}
          ><GSave size={13} />{t(docSaving ? 'doc.saving' : 'doc.save')}</button>
          {savedDocPath && (
            <button className="mu-btn" style={S.secondary} title={t('doc.openPrintTitle')} onClick={onOpenSavedDoc}>
              <GPrint size={13} />{t('doc.openPrint')}
            </button>
          )}
          <button className="mu-btn" style={S.secondary} onClick={onBack}><GBack size={13} />{t('common.back')}</button>
        </div>
      </div>
      {docMsg && (
        <p style={{ ...S.doneNote, color: docOk === false ? 'var(--mu-err)' : 'var(--mu-ok)' }}>
          {docOk === false ? '⚠️ ' : '✅ '}{docMsg}
        </p>
      )}
      {/* Versions: every take is kept, none overwrites the previous one. */}
      {docVersions.length > 1 && (
        <div style={S.verRow}>
          <span style={S.memLabel}><GClock size={11} />{t('doc.versionsLabel')}</span>
          {docVersions.map((v) => (
            <button
              key={v.version}
              style={{ ...S.verChip, ...(curVersion === v.version ? S.verChipOn : {}) }}
              title={`${new Date(v.ts).toLocaleString(dateLocale(lang))}${versionTail(v, v.systemId ?? (v.style ? (STYLE_PRESETS.find((p) => p.id === v.style)?.name ?? v.style) : null), t, lang)}${v.memory ? ` · ${v.memory}` : ''}${v.grounding ? ` · ${t('doc.memoryItemsTag', { n: v.grounding.count })}${v.grounding.vaults.length ? ` (${v.grounding.vaults.join(' · ')})` : ''}` : ''}`}
              onClick={() => onSelectVersion(v)}
            >v{v.version}{v.version === docVersions[0].version ? ` · ${t('doc.latestTag')}` : ''}</button>
          ))}
        </div>
      )}
      {regenOpen && (
        <div style={S.regenPanel}>
          <p style={S.doneNote}>
            {t('doc.regenSame', { memory: memLabelUI(memVault, t) })}{' '}
            {t('doc.regenNext', { n: nextVersion })}
          </p>
          <div style={S.optRow}>
            {(['eco', 'standard', 'max'] as const).map((tr) => (
              <button key={tr} style={{ ...S.modeChip, ...(docTier === tr ? S.modeChipOn : {}) }} onClick={() => setDocTier(tr)}>
                {t(`tier.${tr}`)}
              </button>
            ))}
          </div>
          <div style={S.styleRow}>
            <button style={{ ...S.styleCard, ...(docStyle === null ? S.styleCardOn : {}) }} onClick={() => setDocStyle(null)}>
              <span style={{ ...S.styleThumb, background: 'linear-gradient(135deg,#1a1f2e,#2b3350)', color: 'rgba(200,215,245,0.6)' }}>{t('brief.styleAutoMark')}</span>
              <span style={S.styleCardName}>{t('brief.styleAuto')}</span>
            </button>
            {STYLE_PRESETS.map((p) => (
              <button key={p.id} style={{ ...S.styleCard, ...(docStyle === p.id ? S.styleCardOn : {}) }} title={t(`style.desc.${p.id}`)} onClick={() => setDocStyle(p.id)}>
                <span style={{ ...S.styleThumb, ...p.bn }}>Aa</span>
                <span style={S.styleCardName}>{p.name}</span>
              </button>
            ))}
            {/* Regenerating must offer the same choices as the brief did —
                otherwise a document rendered with a system could only ever be
                re-rendered with a preset. */}
            <button style={{ ...S.styleCard, ...(docSystem ? S.styleCardOn : {}) }} onClick={onPickDocSystem}>
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
          <div style={S.optRow}>
            {(['page', 'long', 'slides'] as const).map((f) => (
              <button key={f} style={{ ...S.modeChip, ...(docFormat === f ? S.modeChipOn : {}) }} onClick={() => setDocFormat(f)}>
                {t(`brief.format.${f}`)}
              </button>
            ))}
            <button
              className="mu-btn"
              style={{ ...S.modeChip, ...(docImages.length ? S.modeChipOn : {}) }}
              onClick={onOpenImgPanel}
            ><GFolder size={12} />{docImages.length ? t('brief.imagesCount', { n: docImages.length }) : t('brief.imagesNone')}</button>
            <button
              className="mu-btn"
              style={{ ...S.modeChip, ...(docSvg ? S.modeChipOn : {}) }}
              onClick={onToggleSvg}
            >{t('brief.svgToggle')}</button>
          </div>
          <button
            style={{ ...S.launchBtn, alignSelf: 'flex-start' }}
            onClick={onRegenerate}
          ><GSpark size={13} />{t('doc.regenGo', { n: nextVersion })}</button>
        </div>
      )}
      {/* The document is the point of this screen: it takes every pixel
          left, instead of a 640px box floating in an empty page. */}
      <iframe title={name} style={S.preview} sandbox="allow-scripts" srcDoc={appHtmlView || appHtml} />
    </div>
  );
}
