/**
 * useVerity — the truth pass, its state and its two entry points.
 *
 * Layer 1 is deterministic and free: heuristics over the project's own sources
 * (todo-left, silent-catch, lorem…). Layer 2 is an adversarial agent that
 * judges each PROMISED feature against the code actually on disk, and only
 * runs above the 'eco' tier. docs/VERITY.md is written either way — a pass
 * that found nothing is still a pass on the record.
 *
 * Everything it needs from the app arrives as one explicit `deps` object.
 * That list is long on purpose: the truth pass reads the project, the promise
 * AND the memory the project was framed on, and hiding that behind a context
 * would only make the coupling invisible, not smaller.
 */
import { useState } from 'react';
import {
  appendVerityLog, buildVerityPrompt, buildVerityReport, languageSystemPrompt,
  parseVerityReply, runVerityHeuristics, type Lane, type VerityAlert,
} from '../handoff';
import { isHostTimeout, joinPath, type Localized } from '../appLogic';
import { dateLocale, type LangCode } from '../i18n/useI18n';
import { invokeHost } from '../lib/host';

type Tier = 'eco' | 'standard' | 'max';
type VerityRunState = 'idle' | 'scanning' | 'thinking' | 'writing' | 'done' | 'error';

export type VerityDeps = {
  appDir: string;
  projFiles: Array<{ rel: string; path: string }>;
  /** The promise the delivered code is judged against. */
  name: string;
  purpose: string;
  feats: string[];
  lane: Lane;
  /** [MEMORY-SCOPE] the same memory the project was framed on. */
  projectRagQuery: string;
  memScope: Record<string, unknown>;
  noteGrounding: (res: unknown) => void;
  bumpProjScan: () => void;
  setError: (msg: Localized) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  lang: LangCode;
};

export function useVerity(d: VerityDeps) {
  const [tier, setTier] = useState<Tier>('standard');
  const [state, setState] = useState<VerityRunState>('idle');
  const [msg, setMsg] = useState<Localized>('');
  const [heuristics, setHeuristics] = useState<VerityAlert[]>([]);
  const [agent, setAgent] = useState<ReturnType<typeof parseVerityReply>>(null);
  const [ideReply, setIdeReply] = useState('');          // paste box content
  const [lastIdeReply, setLastIdeReply] = useState('');  // archived claims fed to the truth agent
  const [userNote, setUserNote] = useState('');          // what the human sees — no heuristic can catch it
  const [fixRound, setFixRound] = useState(0);           // repair rounds already issued — the prompt escalates

  const busy = state === 'scanning' || state === 'thinking' || state === 'writing';

  /** Scan, judge, write docs/VERITY.md. `ideReport` is the agent's latest
   *  claims, when this run is a counter-verification of them. */
  const run = async (ideReport?: string) => {
    if (!d.appDir || busy) return;
    setState('scanning');
    setMsg({ key: 'verity.readingSources' });
    d.setError('');
    try {
      const candidates = d.projFiles.filter((f) => /\.(html?|css|js|jsx|ts|tsx)$/i.test(f.rel) && !f.rel.startsWith('design/')).slice(0, 12);
      const sources: Array<{ rel: string; content: string }> = [];
      let budget = 40_000;
      for (const f of candidates) {
        if (budget <= 0) break;
        try {
          const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: f.path });
          if (r?.success && typeof r.content === 'string' && r.content.trim()) {
            const slice = r.content.slice(0, Math.min(6000, budget));
            sources.push({ rel: f.rel, content: slice });
            budget -= slice.length;
          }
        } catch { /* unreadable — skip */ }
      }
      if (!sources.length) throw new Error(d.t('verity.noSourceFile'));
      const heur = runVerityHeuristics(sources);
      setHeuristics(heur);
      let judged: ReturnType<typeof parseVerityReply> = null;
      if (tier !== 'eco') {
        setState('thinking');
        setMsg({ key: 'verity.statusReading', vars: { tier: tier === 'max' ? d.t('tier.max') : d.t('tier.standard'), n: sources.length } });
        const claims = ideReport ?? lastIdeReply;
        const payload: Record<string, unknown> = {
          prompt: buildVerityPrompt({
            name: d.name, purpose: d.purpose, features: d.feats, lane: d.lane,
            sources: sources.map((s) => ({ name: s.rel, content: s.content })),
            ideReport: claims || undefined,
            userNote: userNote.trim() || undefined,
          }),
          temperature: 0.2,
          maxTokens: tier === 'max' ? 1800 : 1200,
          ragQuery: d.projectRagQuery, ...d.memScope,
          // [LANGUAGE] A dedicated system-channel pin — see languageSystemPrompt().
          systemPrompt: languageSystemPrompt(),
        };
        if (tier === 'max') payload.forceMode = 'cloud';
        const res = await invokeHost<{ success?: boolean; error?: string; text?: string; response?: string }>('model.infer', payload);
        d.noteGrounding(res);
        if (res && res.success === false) throw new Error(res.error || d.t('err.inferRefused'));
        judged = parseVerityReply(String(res?.text ?? res?.response ?? ''));
      }
      setAgent(judged);
      setState('writing');
      setMsg({ key: 'verity.writingReport' });
      const docsDir = joinPath(d.appDir, 'docs');
      await invokeHost('dialog.mkdir', { dirPath: docsDir });
      const report = buildVerityReport({
        name: d.name || d.t('board.untitled'), dateIso: new Date().toLocaleString(dateLocale(d.lang)), tier,
        heuristics: heur, agent: judged, claimsChecked: !!(judged && (ideReport ?? lastIdeReply)),
        userNote: userNote.trim() || undefined,
      });
      const w = await invokeHost<{ success?: boolean; error?: string }>('dialog.writeFile', { filePath: joinPath(docsDir, 'VERITY.md'), content: report });
      if (!w?.success) throw new Error(w?.error || d.t('err.writeFailed'));
      setState('done');
      const reds = heur.filter((h) => h.severity === 'alert').length
        + (judged?.alerts.filter((a) => a.severity === 'alert').length ?? 0)
        + (judged?.features.filter((f) => f.status === 'missing').length ?? 0);
      setMsg(reds ? { key: 'verity.redAlerts', vars: { n: reds } } : { key: 'verity.noRedAlerts' });
      d.bumpProjScan();
    } catch (err) {
      console.warn('Verity pass failed:', err);
      setState('error');
      setMsg(isHostTimeout(err)
        ? { key: 'verity.bridgeTimeout' }
        : { key: 'verity.passFailed', vars: { error: (err as Error).message } });
    }
  };

  /** Archive the pasted IDE reply into docs/VERITY-LOG.md, then immediately
   *  re-run the pass with those claims so they get cross-checked against the
   *  code actually on disk (counter-verification). */
  const saveIdeReply = async () => {
    const text = ideReply.trim();
    const note = userNote.trim();
    if (!d.appDir || (!text && !note) || busy) return;
    try {
      const docsDir = joinPath(d.appDir, 'docs');
      await invokeHost('dialog.mkdir', { dirPath: docsDir });
      const logPath = joinPath(docsDir, 'VERITY-LOG.md');
      let existing: string | null = null;
      try {
        const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath: logPath });
        if (r?.success && typeof r.content === 'string') existing = r.content;
      } catch { /* first entry — the log does not exist yet */ }
      const w = await invokeHost<{ success?: boolean; error?: string }>('dialog.writeFile', {
        filePath: logPath,
        content: appendVerityLog(existing, { dateIso: new Date().toLocaleString(dateLocale(d.lang)), text, note }),
      });
      if (!w?.success) throw new Error(w?.error || d.t('err.writeFailed'));
      // The remark stays in the box: it keeps feeding the truth agent and the
      // fix prompt until the user clears it (the problem is fixed).
      setLastIdeReply(text);
      setIdeReply('');
      d.bumpProjScan();
      await run(text);
    } catch (err) {
      console.warn('IDE-reply archive failed:', err);
      setState('error');
      setMsg({ key: 'err.archiveFailed', vars: { error: (err as Error).message } });
    }
  };

  /** Forget the previous project entirely. Callers used to poke eight setters
   *  in a row and the list drifted every time one was added — a pass that
   *  still shows the last project's alerts is worse than one showing none. */
  const reset = () => {
    setState('idle'); setMsg(''); setHeuristics([]); setAgent(null);
    setIdeReply(''); setLastIdeReply(''); setUserNote(''); setFixRound(0);
  };

  return {
    tier, setTier, state, setState, msg, setMsg, reset,
    heuristics, agent, ideReply, setIdeReply, lastIdeReply,
    userNote, setUserNote, fixRound, setFixRound,
    run, saveIdeReply,
  };
}
