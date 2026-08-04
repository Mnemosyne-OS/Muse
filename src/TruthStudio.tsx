/**
 * Truth Studio — dedicated full-screen module (Tony: the whole loop was piled
 * at the bottom of the project board, so every round meant scrolling). The
 * repair loop is a cycle, so it gets a screen of its own: left column = what
 * I observe + how deep to look + run, right column = what came back + the
 * hand-off box back to the IDE. Everything visible at once, no scroll hunt.
 */
import { type CSSProperties } from 'react';
import { useI18n } from './i18n/useI18n';
import type { parseVerityReply, VerityAlert } from './handoff';

export type VerityAgentResult = ReturnType<typeof parseVerityReply>;
export type VerityState = 'idle' | 'scanning' | 'thinking' | 'writing' | 'done' | 'error';

export function TruthStudio(props: {
  projectName: string;
  tier: 'eco' | 'standard' | 'max';
  setTier: (t: 'eco' | 'standard' | 'max') => void;
  state: VerityState;
  msg: string;
  error: string;
  heuristics: VerityAlert[];
  agent: VerityAgentResult;
  userNote: string;
  setUserNote: (v: string) => void;
  ideReply: string;
  setIdeReply: (v: string) => void;
  fixRound: number;
  canRun: boolean;
  hasReport: boolean;
  hasLog: boolean;
  onRun: () => void;
  onCopyFix: () => void;
  onArchive: () => void;
  onViewReport: () => void;
  onViewLog: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const busy = props.state === 'scanning' || props.state === 'thinking' || props.state === 'writing';
  const done = props.state === 'done';
  const feats = props.agent?.features ?? [];
  const alerts = [
    ...props.heuristics.map((h) => ({ sev: h.severity, text: `${h.rule} — ${h.file}:${h.line} · ${h.excerpt}` })),
    ...(props.agent?.alerts ?? []).map((a) => ({ sev: a.severity, text: `${a.rule} (${a.file}) — ${a.note}` })),
  ];
  const reds = alerts.filter((a) => a.sev === 'alert').length + feats.filter((f) => f.status === 'missing').length;
  const runLabel = props.state === 'scanning' ? t('truth.reading')
    : props.state === 'thinking' ? t('truth.checking')
    : props.state === 'writing' ? t('truth.writing')
    : t(done ? 'truth.rerun' : 'truth.run');

  return (
    <div style={TS.wrap}>
      <div style={TS.inner}>
        <div style={TS.head}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
            <h1 style={TS.title}>{t('truth.title')}</h1>
            <p style={TS.sub}>
              {t('truth.subject', { project: props.projectName })} <b>{t('truth.notProof')}</b> : {t('truth.notProofTail')}
            </p>
          </div>
          <button className="mu-btn" style={TS.secondary} onClick={props.onBack}>{t('truth.back')}</button>
        </div>

        <div style={TS.cols}>
          {/* ── Left: what I see + how deep + run ─────────────────────────── */}
          <div style={TS.col}>
            <div style={TS.panel}>
              <p style={TS.step}>{t('truth.step1')}</p>
              <p style={TS.hint}>{t('truth.step1Hint')}</p>
              <textarea
                style={TS.box}
                value={props.userNote}
                onChange={(e) => props.setUserNote(e.target.value)}
                placeholder={t('truth.step1Placeholder')}
                rows={5}
              />
              <p style={TS.hint}>{t('truth.step1Keep')}</p>
            </div>

            <div style={TS.panel}>
              <p style={TS.step}>{t('truth.step2')}</p>
              <div style={TS.chipRow}>
                {(['eco', 'standard', 'max'] as const).map((tier) => (
                  <button key={tier} className="mu-btn" style={{ ...TS.chip, ...(props.tier === tier ? TS.chipOn : {}) }} onClick={() => props.setTier(tier)}>
                    {t(tier === 'eco' ? 'truth.tierEco' : tier === 'standard' ? 'truth.tierStandard' : 'truth.tierMax')}
                  </button>
                ))}
              </div>
              <p style={TS.hint}>{t('truth.step2Hint')}</p>
              {props.error && <div style={TS.error}>⚠️ {props.error}</div>}
              <button
                style={{ ...TS.primary, ...(busy ? { opacity: 0.6, cursor: 'wait' } : {}), ...(!props.canRun && !busy ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={busy || !props.canRun}
                onClick={props.onRun}
              >{runLabel}</button>
              {!props.canRun && !busy && <p style={TS.hint}>{t('truth.nothingYet')}</p>}
              {props.msg && (
                <p style={{ ...TS.hint, color: props.state === 'error' ? '#fca5a5' : done ? '#5ed6a0' : '#9fb2d6' }}>
                  {done ? '✅ ' : props.state === 'error' ? '⚠️ ' : ''}{props.msg}
                </p>
              )}
              <div style={TS.btnRow}>
                {props.hasReport && <button className="mu-btn" style={TS.link} onClick={props.onViewReport}>{t('truth.report')}</button>}
                {props.hasLog && <button className="mu-btn" style={TS.link} onClick={props.onViewLog}>{t('truth.log')}</button>}
              </div>
            </div>
          </div>

          {/* ── Right: verdict + the loop back to the IDE ─────────────────── */}
          <div style={TS.col}>
            <div style={TS.panel}>
              <p style={TS.step}>
                {t('truth.step3')}
                {done && <span style={{ ...TS.badge, ...(reds ? TS.badgeRed : TS.badgeGreen) }}>{reds ? t('truth.redAlerts', { n: reds }) : t('truth.noRedAlerts')}</span>}
              </p>
              {!done && !busy && <p style={TS.hint}>{t('truth.waiting')}</p>}
              {busy && <p style={TS.hint}>{props.msg || t('truth.analysing')}</p>}
              {done && (
                <div style={TS.scroll}>
                  {feats.length > 0 && (
                    <>
                      <p style={TS.listTitle}>{t('truth.features')}</p>
                      {feats.map((f) => (
                        <p key={f.name} style={TS.item}>
                          {f.status === 'ok' ? '✅' : f.status === 'missing' ? '❌' : '❓'} <b>{f.name}</b>{f.note ? ` — ${f.note}` : ''}
                        </p>
                      ))}
                    </>
                  )}
                  {props.agent?.summary && <p style={{ ...TS.item, fontStyle: 'italic', color: '#9fb2d6' }}>{props.agent.summary}</p>}
                  {alerts.length > 0 && (
                    <>
                      <p style={TS.listTitle}>{t('truth.alerts')}</p>
                      {alerts.map((a, i) => (
                        <p key={i} style={TS.item}>{a.sev === 'alert' ? '🔴' : a.sev === 'warn' ? '🟡' : 'ℹ️'} {a.text}</p>
                      ))}
                    </>
                  )}
                  {!feats.length && !alerts.length && <p style={TS.item}>✅ {t('truth.clean')}</p>}
                </div>
              )}
            </div>

            <div style={TS.panel}>
              <p style={TS.step}>{t('truth.step4')}</p>
              <p style={TS.hint}>{t('truth.step4Hint')}</p>
              <button
                style={{ ...TS.primary, ...(done ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
                disabled={!done}
                onClick={props.onCopyFix}
              >{props.fixRound > 0 ? t('truth.copyFixRound', { n: props.fixRound + 1 }) : t('truth.copyFix')}</button>
              <textarea
                style={TS.box}
                value={props.ideReply}
                onChange={(e) => props.setIdeReply(e.target.value)}
                placeholder={t('truth.replyPlaceholder')}
                rows={7}
              />
              <button
                style={{ ...TS.primary, ...((!props.ideReply.trim() && !props.userNote.trim()) || busy ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                disabled={(!props.ideReply.trim() && !props.userNote.trim()) || busy}
                onClick={props.onArchive}
              >{t('truth.archive')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TS: Record<string, CSSProperties> = {
  wrap: { flex: 1, minHeight: 0, overflowY: 'auto', width: '100%', boxSizing: 'border-box', animation: 'ab-fade 0.45s ease both' },
  inner: { width: '100%', maxWidth: '1280px', margin: '0 auto', padding: 'clamp(14px, 3vw, 26px)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' },
  head: { display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' },
  title: { fontSize: '22px', fontWeight: 700, margin: 0, color: '#eaf2ff' },
  sub: { fontSize: '13.5px', color: '#9fb2d6', margin: 0, lineHeight: 1.6 },
  secondary: { fontSize: '14px', fontWeight: 600, padding: '11px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', color: '#dbe7ff', cursor: 'pointer', whiteSpace: 'nowrap' },
  cols: { display: 'flex', gap: '18px', alignItems: 'flex-start', flexWrap: 'wrap' },
  col: { display: 'flex', flexDirection: 'column', gap: '14px', flex: '1 1 400px', minWidth: '300px' },
  panel: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 18px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', boxSizing: 'border-box' },
  step: { margin: 0, fontSize: '12px', fontWeight: 700, color: '#9fb2d6', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  hint: { margin: 0, fontSize: '12.5px', lineHeight: 1.6, color: '#8296bb' },
  listTitle: { margin: '4px 0 0', fontSize: '11.5px', fontWeight: 700, color: '#5f6f92', textTransform: 'uppercase', letterSpacing: '0.06em' },
  item: { margin: 0, fontSize: '12.5px', lineHeight: 1.55, color: '#c9d6f2', wordBreak: 'break-word' },
  scroll: { display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '42vh', overflowY: 'auto', paddingRight: '4px' },
  box: { width: '100%', boxSizing: 'border-box', fontSize: '13px', lineHeight: 1.55, padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#e6eeff', outline: 'none', fontFamily: 'inherit', resize: 'vertical' },
  chipRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: { fontSize: '12.5px', fontWeight: 600, padding: '7px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#9fb2d6', cursor: 'pointer', fontFamily: 'inherit' },
  chipOn: { border: '1px solid rgba(59,130,246,0.6)', background: 'rgba(59,130,246,0.16)', color: '#7dd3fc' },
  primary: { fontSize: '14px', fontWeight: 700, padding: '12px 18px', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.16)', color: '#cfe4ff', cursor: 'pointer', fontFamily: 'inherit' },
  link: { fontSize: '13px', fontWeight: 600, padding: '9px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#dbe7ff', cursor: 'pointer', fontFamily: 'inherit' },
  btnRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  badge: { fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.02em', textTransform: 'none' },
  badgeRed: { border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(248,113,113,0.12)', color: '#fca5a5' },
  badgeGreen: { border: '1px solid rgba(94,214,160,0.45)', background: 'rgba(94,214,160,0.12)', color: '#5ed6a0' },
  error: { fontSize: '13px', color: '#fca5a5', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)' },
  code: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '11.5px', background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.15)', borderRadius: '5px', padding: '1px 5px', color: '#9fd8ff', margin: '0 4px' },
};
