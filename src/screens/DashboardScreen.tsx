// The dashboard: quick-launch input, mode chips, memory bar, saved-framing
// resume banner, stats, and the project history list (with per-version
// chips and cost tooltips). Extracted out of App.tsx's view chain — owns
// no state, just renders what App() already tracks.
import { STYLE_PRESETS } from '../DesignStudio';
import { GBan, GClock, GClose, GCost, GForward, GGlobe, GLaunch, GMemory, GSliders, GTrash, GPalette } from '../Glyphs';
import { BookIcon, ChannelBadge, Logo, S } from '../Chrome';
import { formatCost, memLabelUI, versionTail, type GenCost, type Project } from '../appLogic';
import { memoryMode, type MemorySource } from '../handoff';
import { dateLocale, type LangCode } from '../i18n/useI18n';

type T = (key: string, vars?: Record<string, string | number>) => string;
type Mode = { id: string; Icon: (p: { size?: number }) => JSX.Element; key: string };
type Lane = 'doc' | 'site' | 'cartridge';

export function DashboardScreen({
  t, lang, error, onOpenDocs, onOpenDesignPref, onQuickLaunch,
  modes, mode, onSetMode,
  memVault, onSetMemVault, onOpenMemPanel, groundingBadge, laneIcon,
  savedFraming, onResumeFraming, onDismissFraming,
  toPublishCount, inProgressCount, docsCount,
  projects, onOpenProject, launching, onLaunchApp, launchMsg, launchOk,
  onDeleteProject,
}: {
  t: T;
  lang: LangCode;
  error: string;
  onOpenDocs: () => void;
  /** Opens the studio on the GLOBAL design preference — no project needed. */
  onOpenDesignPref: () => void;
  onQuickLaunch: (value: string) => void;
  modes: Mode[];
  mode: string;
  onSetMode: (id: string) => void;
  memVault: MemorySource;
  onSetMemVault: (updater: (cur: MemorySource) => MemorySource) => void;
  onOpenMemPanel: () => void;
  groundingBadge: JSX.Element | null;
  laneIcon: (lane: Lane) => (p: { size?: number }) => JSX.Element;
  savedFraming: { idea: string } | null;
  onResumeFraming: () => void;
  onDismissFraming: () => void;
  toPublishCount: number;
  inProgressCount: number;
  docsCount: number | '—';
  projects: Project[];
  onOpenProject: (p: Project, version?: number) => void;
  launching: string;
  onLaunchApp: (path: string, name: string) => void;
  launchMsg: string;
  /** Outcome of the last launch — never re-derived from the message text,
   *  which is translated (see App.tsx's launchOk state). */
  launchOk: boolean | null;
  onDeleteProject: (p: Project) => void;
}) {
  return (
    <div style={S.dash}>
      <div style={S.dashInner}>
      <header style={S.dashHead}>
        <div style={S.brand}>
          <Logo mode="mark" />
          <span style={S.brandName}>Muse</span>
          <ChannelBadge />
          <span style={S.brandTag}>Neural Coding</span>
        </div>
        {/* Top action bar — more icons will land here over time. */}
        <div style={S.headActions}>
          <button style={S.iconBtn} title={t('pref.open')} onClick={onOpenDesignPref}>
            <GPalette size={15} />
          </button>
          <button style={S.iconBtn} title={t('dash.docLibrary')} onClick={onOpenDocs}>
            <BookIcon />
          </button>
        </div>
      </header>
      {error && <div style={S.error}>⚠️ {error}</div>}

      <section style={S.quick}>
        <label style={S.quickLabel}>{t('dash.question')}</label>
        <input
          autoFocus style={S.quickInput}
          placeholder={t('dash.placeholder')}
          onKeyDown={(e) => {
            const v = (e.target as HTMLInputElement).value;
            if (e.key === 'Enter' && v.trim()) onQuickLaunch(v);
          }}
        />
        {/* Router chips: Auto lets the coach route; the human can force a lane. */}
        <div style={S.modeRow}>
          {modes.map((m) => (
            <button
              key={m.id}
              className="mu-btn"
              style={{ ...S.modeChip, ...(mode === m.id ? S.modeChipOn : {}) }}
              onClick={() => onSetMode(m.id)}
            ><m.Icon size={12} />{t(m.key)}</button>
          ))}
        </div>
        {/* Memory source: the host scopes RAG to ONE vault (model.infer →
            vaultId) or runs federated — so this is a single choice, not a
            multi-select. It follows the project all the way to the IDE. */}
        {/* Memory source: three real host behaviours — none (disableRAG),
            all (federated), or a mix (vaultIds, merged main-side). The list
            lives in a drawer so the dashboard stays a dashboard. */}
        <div style={S.memBar}>
          <span style={S.memLabel}><GMemory size={12} />{t('mem.label')}</span>
          <button className="mu-btn mu-cta" style={S.memSummary} onClick={onOpenMemPanel}>
            {memoryMode(memVault) === 'none' ? <GBan size={12} /> : memoryMode(memVault) === 'all' ? <GGlobe size={12} /> : <GSliders size={12} />}
            {memLabelUI(memVault, t)} <span style={S.memCount}>{t('mem.modify')}</span><GForward size={10} />
          </button>
          {memoryMode(memVault) === 'pick' && memVault?.vaults.map((v) => (
            <span key={v.vaultId} style={S.memPick}>
              {v.displayName}
              <button
                className="mu-btn"
                style={S.memPickX}
                title={t('mem.remove', { name: v.displayName })}
                onClick={() => onSetMemVault((cur) => {
                  const left = (cur?.vaults ?? []).filter((x) => x.vaultId !== v.vaultId);
                  return left.length ? { mode: 'pick', vaults: left } : { mode: 'all', vaults: [] };
                })}
              ><GClose size={9} /></button>
            </span>
          ))}
          {groundingBadge}
        </div>
      </section>

      {savedFraming && (
        <div style={S.resumeRow}>
          <span style={S.resumeText}>{t('brief.resumeLabel')} « {savedFraming.idea.slice(0, 90)}{savedFraming.idea.length > 90 ? '…' : ''} »</span>
          <button className="mu-btn" style={S.ideLinkPrimary} onClick={onResumeFraming}>{t('brief.resumeCta')}</button>
          <button className="mu-btn" style={S.linkBtn} title={t('brief.resumeDismiss')} onClick={onDismissFraming}>✕</button>
        </div>
      )}

      <section style={S.stats}>
        <div style={S.statCard}>
          <span style={S.statNum}>{toPublishCount}</span>
          <span style={S.statLabel}>{t(toPublishCount > 1 ? 'dash.statAppsPlural' : 'dash.statApps')}</span>
        </div>
        <div style={S.statCard}>
          <span style={S.statNum}>{inProgressCount}</span>
          <span style={S.statLabel}>{t('dash.statDrafts')}</span>
        </div>
        <div style={S.statCard}>
          <span style={S.statNum}>{docsCount}</span>
          <span style={S.statLabel}>{t('dash.statDocs')}</span>
        </div>
      </section>

      <section style={S.col}>
        <h3 style={S.colTitle}>{t('dash.historyTitle')}</h3>
        {projects.length === 0
          ? <p style={S.empty}>{t('dash.empty')}</p>
          : projects.map((p, i) => (
              <div key={i} style={S.histBlock}>
              <div style={S.histLine}>
                <button className="mu-row" style={S.histRow} title={p.purpose} onClick={() => onOpenProject(p)}>
                  <span style={S.docIcon}>{(() => { const I = laneIcon(p.lane ?? 'cartridge'); return <I size={14} />; })()}</span>
                  <span style={S.histName}>{p.name}</span>
                  {p.status === 'draft' && <span style={S.soon}>{t('dash.inProgress')}</span>}
                  <span style={S.histDate}>{p.ts ? new Date(p.ts).toLocaleDateString() : ''}</span>
                  <span style={S.histOpen}>{t(p.status === 'draft' ? 'dash.resume' : 'dash.open')}<span className="mu-go" style={{ display: 'inline-flex', marginLeft: '5px' }}><GForward size={10} /></span></span>
                </button>
                {/* Run it without entering the project: cartridge apps open
                    in their own Mnemosyne window straight from here. */}
                {p.path && p.lane !== 'site' && p.lane !== 'doc' && (
                  <button
                    className="mu-btn mu-cta"
                    style={{ ...S.histLaunch, ...(launching === p.path ? { opacity: 0.6, cursor: 'wait' } : {}) }}
                    disabled={!!launching}
                    title={t('dash.launchTitle', { name: p.name })}
                    onClick={() => onLaunchApp(p.path as string, p.name)}
                  ><GLaunch size={14} /></button>
                )}
                <button
                  className="mu-btn mu-danger"
                  style={S.histDelete}
                  title={t('dash.deleteTitle', { name: p.name })}
                  onClick={() => onDeleteProject(p)}
                ><GTrash size={14} /></button>
              </div>
              {/* Every take, one click away — comparing v1 and v3 no longer
                  means opening the document and hunting the switcher. */}
              {(p.versions?.length ?? 0) > 1 && (
                <div style={S.histVersions}>
                  <span style={S.histVerLabel}><GClock size={10} />{t('dash.versions', { count: p.versions?.length ?? 0 })}</span>
                  {(() => {
                    // Project total = the sum of what was actually billed.
                    // Unmeasured takes are counted apart instead of being
                    // folded in as zero, which would understate the total.
                    const billed = (p.versions ?? []).map((v) => v.cost).filter((c): c is { usdMicro: number } => !!c && 'usdMicro' in c);
                    if (!billed.length) return null;
                    const total = billed.reduce((sum, c) => sum + c.usdMicro, 0);
                    const rest = (p.versions?.length ?? 0) - billed.length;
                    return (
                      <span style={S.histVerLabel} title={`${t('verity.billedTitle', { n: billed.length })}${rest > 0 ? t('verity.billedUnmeasured', { n: rest }) : ''}`}>
                        <GCost size={10} />{formatCost({ usdMicro: total } as GenCost, t, lang)}
                      </span>
                    );
                  })()}
                  {p.versions?.map((v) => (
                    <button
                      key={v.version}
                      className="mu-btn" style={S.histVerChip}
                      title={`${t('doc.openVersionTitle', { n: v.version })} — ${new Date(v.ts).toLocaleString(dateLocale(lang))}${versionTail(v, v.style ? (STYLE_PRESETS.find((s) => s.id === v.style)?.name ?? v.style) : null, t, lang)}`}
                      onClick={() => onOpenProject(p, v.version)}
                    >v{v.version}</button>
                  ))}
                </div>
              )}
              </div>
            ))}
        {launchMsg && (
          <p style={{ ...S.soonNote, color: launchOk === false ? '#fca5a5' : '#5ed6a0' }}>
            {launchOk === false ? '⚠️ ' : '🚀 '}{launchMsg}
          </p>
        )}
      </section>
      </div>
    </div>
  );
}
