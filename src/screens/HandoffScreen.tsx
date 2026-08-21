// The project board: header (launch/open-folder/back), mini-Gantt, the
// selected step's detail panel (cadrage/scaffold/design/artifacts/handoff/
// build/verify/publish), and the live project-files proof panel. Extracted
// out of App.tsx's view chain — owns no state, just renders what App()
// already tracks.
import type { CSSProperties } from 'react';
import { STYLE_PRESETS } from '../DesignStudio';
import {
  GBack, GBuild, GCheck, GCompass, GCopy, GDraft, GEye, GFolder, GHandoff, GLaunch,
  GMemory, GPalette, GPlay, GShield,
} from '../Glyphs';
import { S } from '../Chrome';
import { copyText, fileIcon, joinPath, memLabelUI, projectPhases, type PhaseStatus } from '../appLogic';
import {
  hslToHex, mcpSnippet, type ArtifactKind, type Harmony, type Lane, type McpIde, type MemorySource, type VerityAlert,
} from '../handoff';

// Project-board phases (mini-Gantt) icon lookup — projectPhases() itself
// returns plain data (id/title/status), no component reference, so it stays
// Node-testable (see appLogic.ts). `id` doubles as the key here.
const PHASE_ICON: Record<string, (p: { size?: number }) => JSX.Element> = {
  cadrage: GCompass, scaffold: GFolder, design: GPalette, artifacts: GDraft,
  handoff: GHandoff, build: GBuild, verify: GShield, publish: GLaunch,
};
const PHASE_DOT: Record<PhaseStatus, CSSProperties> = {
  done: { background: 'color-mix(in srgb, var(--mu-ok) 18%, transparent)', border: '2px solid var(--mu-ok)', color: 'var(--mu-ok)' },
  current: { background: 'color-mix(in srgb, var(--mu-accent) 20%, transparent)', border: '2px solid var(--mu-link)', color: 'var(--mu-link)', boxShadow: '0 0 14px color-mix(in srgb, var(--mu-accent) 55%, transparent)' },
  next: { background: 'var(--mu-wash-2)', border: '2px solid rgba(159,178,214,0.55)', color: 'var(--mu-text-3)' },
  soon: { background: 'transparent', border: '2px dashed rgba(95,111,146,0.5)', color: 'var(--mu-text-4)' },
  optional: { background: 'rgba(139,124,240,0.12)', border: '2px dashed rgba(139,124,240,0.65)', color: '#a99df5' },
};
// Support artifacts the user can generate into <appDir>/docs/ (project board).
// Labels are translated at render time (t(`step.artifact.${id}`)).
const ARTIFACTS: Array<{ id: ArtifactKind; icon: string; fileName: string }> = [
  { id: 'spec', icon: '📄', fileName: 'SPEC.md' },
  { id: 'mermaid', icon: '🧭', fileName: 'DIAGRAMS.md' },
];

type T = (key: string, vars?: Record<string, string | number>) => string;

export function HandoffScreen({
  t, lane, name, memVault, laneIcon, launching, launchMsg, launchOk, appDir, projFiles, projDisk,
  boardStep, setBoardStep, purpose, feats, nextSteps, error,
  designHue, designHarmony, designStyle, designFx, designState,
  artModel, setArtModel, artState,
  handoffPrompt, copied, setCopied, showPrompt, setShowPrompt, setError,
  mcpConfigured, showMcp, setShowMcp, mcpIde, setMcpIde, setMcpState, setMcpMsg, setMcpShowSnippet,
  mcpTargets, mcpState, mcpMsg, mcpShowSnippet,
  builtEntry, verityState, verityHeuristics, verityAgent, fixRound,
  onLaunchApp, onOpenAppDir, onBack, onSetView, onViewDoc, onGenerateArtifact, onAutoConfigureMcp, onViewBuiltApp,
}: {
  t: T;
  lane: Lane;
  name: string;
  memVault: MemorySource;
  laneIcon: (lane: Lane) => (p: { size?: number }) => JSX.Element;
  launching: string;
  launchMsg: string;
  /** Outcome of the last launch — never re-derived from the message text,
   *  which is translated (see App.tsx's launchOk state). */
  launchOk: boolean | null;
  appDir: string;
  projFiles: Array<{ rel: string; path: string }>;
  projDisk: { tokens: boolean; artifacts: boolean; adapted: boolean; built: boolean; verity: boolean };
  boardStep: string;
  setBoardStep: (step: string) => void;
  purpose: string;
  feats: string[];
  nextSteps: string[];
  error: string;
  designHue: number;
  designHarmony: Harmony;
  designStyle: string | null;
  designFx: Set<string>;
  designState: 'idle' | 'saving' | 'done' | 'error';
  artModel: 'eco' | 'standard' | 'max';
  setArtModel: (m: 'eco' | 'standard' | 'max') => void;
  artState: Record<string, 'idle' | 'running' | 'done' | 'error'>;
  handoffPrompt: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
  showPrompt: boolean;
  setShowPrompt: (updater: (v: boolean) => boolean) => void;
  setError: (msg: string) => void;
  mcpConfigured: boolean;
  showMcp: boolean;
  setShowMcp: (updater: (v: boolean) => boolean) => void;
  mcpIde: McpIde;
  setMcpIde: (id: McpIde) => void;
  setMcpState: (s: 'idle' | 'writing' | 'done' | 'error') => void;
  setMcpMsg: (msg: string) => void;
  setMcpShowSnippet: (v: boolean) => void;
  mcpTargets: Record<McpIde, { label: string; rel: string; rootKey: 'mcpServers' | 'servers'; scope: 'project' | 'home' }>;
  mcpState: 'idle' | 'writing' | 'done' | 'error';
  mcpMsg: string;
  mcpShowSnippet: boolean;
  builtEntry: { rel: string; path: string } | null;
  verityState: 'idle' | 'scanning' | 'thinking' | 'writing' | 'done' | 'error';
  verityHeuristics: VerityAlert[];
  verityAgent: { alerts: Array<{ severity: string }>; features: Array<{ status: string }> } | null;
  fixRound: number;
  onLaunchApp: (dir: string, label: string) => void;
  onOpenAppDir: () => void;
  onBack: () => void;
  onSetView: (v: 'dashboard' | 'design' | 'verify') => void;
  onViewDoc: (title: string, filePath: string) => void;
  onGenerateArtifact: (art: { id: ArtifactKind; fileName: string }) => void;
  onAutoConfigureMcp: () => void;
  onViewBuiltApp: () => void;
}) {
  return (
    <div style={S.dash}>
      <div style={{ ...S.dashInner, maxWidth: '1280px' }}>
        <div style={S.doneHead}>
          <div style={S.boardTitleCol}>
            <div style={S.boardTitleRow}>
              <h1 style={S.h1small}>{(() => { const I = laneIcon(lane); return <I size={17} />; })()}{name || t('board.untitled')}</h1>
              <span style={S.laneBadge}>{t(`lane.badge.${lane}`)}</span>
              <span style={S.laneBadge} title={t('board.memoryTitle')}>
                <GMemory size={11} />{memLabelUI(memVault, t)}
              </span>
            </div>
            {purpose && <p style={S.sub}>{purpose}</p>}
          </div>
          <div style={S.headActions}>
            {projFiles.some((f) => f.rel === 'mnemo-plugin.json') && (
              <button
                style={{ ...S.launchBtn, ...(launching ? { opacity: 0.6, cursor: 'wait' } : {}) }}
                disabled={!!launching}
                title={t('board.launchTitle')}
                onClick={() => onLaunchApp(appDir, name || t('board.unnamedApp'))}
              ><GLaunch size={13} />{t(launching ? 'board.launching' : 'board.launch')}</button>
            )}
            <button className="mu-btn" style={S.secondary} onClick={onOpenAppDir}><GFolder size={13} />{t('common.openFolder')}</button>
            <button className="mu-btn" style={S.secondary} onClick={onBack}><GBack size={13} />{t('common.back')}</button>
          </div>
        </div>
        {launchMsg && (
          <p style={{ ...S.soonNote, color: launchOk === false ? 'var(--mu-err)' : 'var(--mu-ok)' }}>
            {launchOk === false ? '⚠️ ' : '🚀 '}{launchMsg}
          </p>
        )}

        {/* Mini-Gantt: computed statuses, clickable steps, side-scrolls in small widgets. */}
        <div style={S.gantt}>
          {projectPhases(lane, projDisk, t).map((ph, i, arr) => {
            const Icon = PHASE_ICON[ph.id];
            return (
            <div key={ph.id} style={i < arr.length - 1 ? S.ganttSeg : S.ganttSegLast}>
              <button style={S.ganttNode} onClick={() => setBoardStep(ph.id)}>
                <span style={{ ...S.ganttDot, ...PHASE_DOT[ph.status], ...(boardStep === ph.id ? S.ganttDotSel : {}) }}><Icon size={14} /></span>
                <span style={{ ...S.ganttLabel, ...(boardStep === ph.id ? { color: 'var(--mu-text)' } : {}) }}>{ph.title}</span>
                <span style={S.ganttStatus}>{t(`board.phaseStatus.${ph.status}`)}</span>
              </button>
              {i < arr.length - 1 && (
                <span style={{ ...S.ganttLine, ...(ph.status === 'done' ? { background: 'color-mix(in srgb, var(--mu-ok) 45%, transparent)' } : {}) }} />
              )}
            </div>
            );
          })}
        </div>

        {/* Selected step detail + the live proof panel (project files). */}
        <div className="proj-cols" style={S.boardCols}>
        <div style={{ ...S.boardDetail, flex: 1, minWidth: 0 }}>
          {boardStep === 'cadrage' && (
            <>
              <p style={S.stepTitle}>{t('step.cadrageTitle')}</p>
              <p style={S.sub}>{purpose}</p>
              {feats.filter(Boolean).length > 0 && (
                <ul style={S.recapList}>{feats.filter(Boolean).map((f, i) => <li key={i}>{f}</li>)}</ul>
              )}
              {nextSteps.length > 0 && <p style={S.recapNext}>{t('step.keptForLater')} {nextSteps.join(' · ')}</p>}
            </>
          )}
          {boardStep === 'scaffold' && (
            <>
              <p style={S.stepTitle}>{t('step.scaffoldTitle')}</p>
              <code style={S.code}>{appDir}</code>
              <p style={S.sub}>{t('step.scaffoldDescPre')} <b>BRIEF.md</b> {t('step.scaffoldDescMid')} <b>app-spec.json</b> {t('step.scaffoldDescEnd')}</p>
              {error && <div style={S.error}>⚠️ {error}</div>}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="mu-btn" style={S.secondary} onClick={() => onViewDoc('BRIEF.md', joinPath(appDir, 'BRIEF.md'))}><GEye size={13} />{t('step.viewBrief')}</button>
                <button className="mu-btn" style={S.secondary} onClick={onOpenAppDir}><GFolder size={13} />{t('common.openFolder')}</button>
              </div>
            </>
          )}
          {boardStep === 'design' && (
            <>
              <p style={S.stepTitle}><GPalette size={14} />{t('step.design')}</p>
              <div style={S.optRow}>
                <span style={{ ...S.sw, background: hslToHex(designHue, 72, 56) }} title={t('step.hueTitle', { n: designHue })} />
                <span style={S.designSummary}>
                  {t('step.hueLabel', { n: designHue })} · {t(`step.harmony${designHarmony.charAt(0).toUpperCase()}${designHarmony.slice(1)}`)} · {t('doc.styleTag', { name: STYLE_PRESETS.find((p) => p.id === designStyle)?.name ?? '—' })} · {t('step.fxCount', { n: designFx.size })} · {designState === 'done' ? t('step.designSaved') : t('step.designNotSaved')}
                </span>
              </div>
              {error && <div style={S.error}>⚠️ {error}</div>}
              <button style={{ ...S.primary, maxWidth: '340px' }} onClick={() => onSetView('design')}><GPalette size={13} />{t('step.openDesignStudio')}</button>
              {designState === 'done' && <button className="mu-btn" style={S.ideLinkPrimary} onClick={() => onViewDoc('design-tokens.json', joinPath(appDir, 'design-tokens.json'))}><GEye size={12} />{t('step.viewTokens')}</button>}
            </>
          )}
          {boardStep === 'artifacts' && (
            <>
              <p style={S.stepTitle}>{t('step.artifactsTitle')}</p>
              <p style={S.sub}>{t('step.artifactsDesc')} <b>docs/</b> {t('step.artifactsDescEnd')}</p>
              <div style={S.optRow}>
                <span style={S.optLabel}>{t('step.model')}</span>
                {(['eco', 'standard', 'max'] as const).map((m) => (
                  <button key={m} style={{ ...S.modeChip, ...(artModel === m ? S.modeChipOn : {}) }} onClick={() => setArtModel(m)}>
                    {t(`tier.${m}`)}
                  </button>
                ))}
              </div>
              <p style={S.creditLine}>{t('step.creditsLine')}</p>
              <div style={S.artRow}>
                {ARTIFACTS.map((a) => (
                  <div key={a.id} style={S.artCard}>
                    <span style={{ fontSize: '22px' }}>{a.icon}</span>
                    <span style={S.artName}>{t(`step.artifact.${a.id}`)}</span>
                    <span style={S.artFile}>docs/{a.fileName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        style={{ ...S.installBtn, ...(artState[a.id] === 'running' ? { opacity: 0.55, cursor: 'wait' } : {}) }}
                        disabled={artState[a.id] === 'running'}
                        onClick={() => onGenerateArtifact(a)}
                      >
                        {artState[a.id] === 'running' ? t('step.artGenerating') : artState[a.id] === 'done' ? t('step.artRegenerate') : artState[a.id] === 'error' ? t('step.artRetry') : t('step.artGenerate')}
                      </button>
                      <button className="mu-btn" style={S.installBtn} onClick={() => onViewDoc(`${t(`step.artifact.${a.id}`)} — docs/${a.fileName}`, joinPath(joinPath(appDir, 'docs'), a.fileName))}><GEye size={12} />{t('step.view')}</button>
                      {artState[a.id] === 'done' && <span style={S.installedTag}>✓ {t('step.written')}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {error && <div style={S.error}>⚠️ {error}</div>}
              <button className="mu-btn" style={S.secondary} onClick={onOpenAppDir}><GFolder size={13} />{t('common.openFolder')}</button>
            </>
          )}
          {boardStep === 'handoff' && (
            <>
              <p style={S.stepTitle}>{t('step.handoffTitle')}</p>
              <p style={S.sub}>{t('step.handoffHow')}</p>
              {error && <div style={S.error}>⚠️ {error}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <button
                  style={{ ...S.primary, maxWidth: '340px' }}
                  onClick={async () => {
                    const ok = await copyText(handoffPrompt);
                    setCopied(ok);
                    if (!ok) {
                      setShowPrompt(() => true);
                      setError(t('step.copyBlocked'));
                    }
                  }}
                >{copied ? <><GCheck size={13} />{t('step.copied')}</> : <><GCopy size={13} />{t('step.copyPrompt')}</>}</button>
                <button className="mu-btn" style={S.linkBtn} onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? t('step.hidePrompt') : t('step.showFullPrompt')}</button>
              </div>
              {showPrompt && <pre style={S.promptBox}>{handoffPrompt}</pre>}

              {/* MCP preflight — one collapsed line, details on demand. */}
              <div style={S.mcpCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
                  <p style={{ ...S.stepTitle, margin: 0 }}>{t('step.mcpTitle')}{mcpConfigured ? ` ${t('step.mcpConnected')}` : ''}</p>
                  <span style={{ flex: 1 }} />
                  <button className="mu-btn" style={S.linkBtn} onClick={() => setShowMcp((v) => !v)}>
                    {showMcp ? t('step.collapse') : mcpConfigured ? t('step.manage') : t('step.connectIde')}
                  </button>
                </div>
                {!showMcp && !mcpConfigured && <p style={S.soonNote}>{t('step.mcpHint')}</p>}
                {showMcp && (<>
                <div style={S.optRow}>
                  {(Object.keys(mcpTargets) as McpIde[]).map((id) => (
                    <button key={id} style={{ ...S.modeChip, ...(mcpIde === id ? S.modeChipOn : {}) }} onClick={() => { setMcpIde(id); setMcpState('idle'); setMcpMsg(''); setMcpShowSnippet(false); }}>
                      {mcpTargets[id].label}
                    </button>
                  ))}
                </div>
                <p style={S.soonNote}>
                  {t('step.mcpFileLabel', { scope: mcpTargets[mcpIde].scope === 'home' ? t('step.mcpFileGlobal') : t('step.mcpFileProject') })} <b>{mcpTargets[mcpIde].scope === 'home' ? `~/${mcpTargets[mcpIde].rel}` : mcpTargets[mcpIde].rel}</b>
                  {' '}{mcpTargets[mcpIde].scope === 'home' ? t('step.mcpFileGlobalHint') : t('step.mcpFileProjectHint')}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    style={{ ...S.installBtn, ...(mcpState === 'writing' ? { opacity: 0.55, cursor: 'wait' } : {}) }}
                    disabled={mcpState === 'writing'}
                    onClick={onAutoConfigureMcp}
                  >
                    {mcpState === 'writing' ? t('step.mcpWriting') : mcpState === 'done' ? t('step.mcpReconfigure') : t('step.mcpAutoConfig')}
                  </button>
                  <button
                    className="mu-btn" style={S.installBtn}
                    onClick={async () => {
                      const ok = await copyText(mcpSnippet(mcpTargets[mcpIde].rootKey, memVault));
                      setMcpState('idle');
                      setMcpShowSnippet(!ok);
                      setMcpMsg(ok ? t('step.snippetCopied') : t('step.snippetCopyBlocked'));
                    }}
                  >
                    {t('step.copySnippet')}
                  </button>
                </div>
                {mcpShowSnippet && <pre style={S.mcpSnippet}>{mcpSnippet(mcpTargets[mcpIde].rootKey, memVault)}</pre>}
                {mcpMsg && (
                  <p style={{ ...S.soonNote, color: mcpState === 'error' ? 'var(--mu-err)' : mcpState === 'done' ? 'var(--mu-ok)' : 'var(--mu-text-3)' }}>
                    {mcpState === 'done' ? '✅ ' : mcpState === 'error' ? '⚠️ ' : ''}{mcpMsg}
                  </p>
                )}
                </>)}
              </div>
            </>
          )}
          {boardStep === 'build' && (
            <>
              {builtEntry ? (
                <>
                  <p style={S.stepTitle}>{t('step.builtTitle')}</p>
                  <p style={S.sub}>{t('step.built')} <b>{builtEntry.rel}</b> {t('step.builtDescEnd')} {builtEntry.rel}{t('step.builtDescEnd2')}</p>
                  {error && <div style={S.error}>⚠️ {error}</div>}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button style={{ ...S.primary, maxWidth: '300px' }} onClick={onViewBuiltApp}><GPlay size={13} />{t('step.viewMyApp')}</button>
                    <button className="mu-btn" style={S.secondary} onClick={onOpenAppDir}><GFolder size={13} />{t('common.openFolder')}</button>
                  </div>
                  {nextSteps.length > 0 && <p style={S.recapNext}>{t('step.nextWhenReady')} {nextSteps.join(' · ')} {t('step.nextWhenReadyEnd')}</p>}
                </>
              ) : (
                <>
                  <p style={S.stepTitle}>🔨 {lane === 'site' ? t('step.siteBuildTitle') : t('step.appBuildTitle')}</p>
                  <p style={S.sub}>
                    {lane === 'site' ? t('step.siteBuildDesc') : t('step.appBuildDesc')}
                  </p>
                  <p style={S.sub}>{t('step.buildSuggestions')}</p>
                  {nextSteps.length > 0 && <p style={S.recapNext}>{t('step.afterV0')} {nextSteps.join(' · ')}</p>}
                </>
              )}
            </>
          )}
          {boardStep === 'verify' && (() => {
            const vBusy = verityState === 'scanning' || verityState === 'thinking' || verityState === 'writing';
            const reds = verityHeuristics.filter((h) => h.severity === 'alert').length
              + (verityAgent?.alerts.filter((a) => a.severity === 'alert').length ?? 0)
              + (verityAgent?.features.filter((f) => f.status === 'missing').length ?? 0);
            const canVerify = !!builtEntry || projFiles.some((f) => /\.(html?|js|jsx|ts|tsx)$/i.test(f.rel));
            return (
              <>
                <p style={S.stepTitle}><GShield size={14} />{t('step.verifyTitle')}</p>
                <p style={S.sub}>{t('step.verifyDesc')}</p>
                {verityState === 'done' && (
                  <p style={{ ...S.soonNote, color: reds ? 'var(--mu-err)' : 'var(--mu-ok)' }}>
                    {reds ? t('step.verityLastBad', { n: reds }) : t('step.verityLastGood')}
                    {fixRound > 0 ? ` ${t('step.verityFixRounds', { n: fixRound })}` : ''}
                  </p>
                )}
                {!canVerify && <p style={S.sub}>{t('step.verifyNothing')}</p>}
                <button
                  style={{ ...S.primary, maxWidth: '340px', ...(vBusy ? { opacity: 0.6, cursor: 'wait' } : {}) }}
                  onClick={() => onSetView('verify')}
                ><GShield size={13} />{t(vBusy ? 'step.verifyBusy' : 'step.verifyOpen')}</button>
              </>
            );
          })()}
          {boardStep === 'publish' && (
            <>
              <p style={S.stepTitle}>🚀 {lane === 'site' ? t('step.publishSiteTitle') : t('step.publishCartridgeTitle')}</p>
              <p style={S.sub}>
                {lane === 'site' ? t('step.publishSiteDesc') : t('step.publishCartridgeDesc')}
              </p>
            </>
          )}
        </div>

        {/* The proof: what the project folder ACTUALLY contains, live. */}
        <aside className="proj-files" style={S.projFilesPanel}>
          <p style={S.projFilesTitle}>{t('step.projFilesTitle', { n: projFiles.length })}</p>
          {projFiles.length === 0
            ? <p style={S.empty}>{t('step.scanningFolder')}</p>
            : projFiles.map((f) => (
                <button key={f.rel} style={S.projFileRow} title={t('step.viewFile', { name: f.rel })} onClick={() => onViewDoc(f.rel, f.path)}>
                  <span style={{ flexShrink: 0 }}>{fileIcon(f.rel)}</span>
                  <span style={S.projFileName}>{f.rel}</span>
                </button>
              ))}
        </aside>
        </div>
      </div>
    </div>
  );
}
