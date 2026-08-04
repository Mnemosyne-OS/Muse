/**
 * DocStudio — the ADVANCED document mode (Tony: "un plan général puis des
 * blocs"). The quick lane renders a whole document in one shot; here the plan
 * is visible and editable, each section generates ALONE (and regenerates alone,
 * with a human remark carried at highest priority), manual text and image
 * blocks slot in between, and the assembly is deterministic — zero credits.
 *
 * Video/audio blocks are announced as "soon" and DISABLED — a block type that
 * pretends to work would be worse than its absence (truth-pass house rule).
 *
 * State of record is the DocBuild checkpoint (spine MUSE_DOCBUILD, latest
 * wins), written after every structural change — a crash never loses a plan.
 */
import { useRef, useState, type CSSProperties } from 'react';
import { useI18n } from './i18n/useI18n';
import { S, btn } from './Chrome';
import { STYLE_PRESETS } from './DesignStudio';
import {
  assembleDoc, buildDocPlanPrompt, buildDocSectionPrompt, buildDocShellCss,
  imageBlockHtml, outlineToPlanText, parseDocPlan, stripToSection, textBlockHtml,
  type DocBlock, type DocBuild, type DocOutline, type DocSection,
} from './handoff';
import type { DocImage } from './appLogic';

type Tier = 'eco' | 'standard' | 'max';

/** Plain-text excerpt of a generated block, for "already written" context. */
function excerpt(html: string, cap = 180): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > cap ? `${text.slice(0, cap)}…` : text;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** The assembled HTML for the CURRENT blocks — empty gen blocks are skipped,
 *  so a preview mid-construction shows what exists instead of failing. */
export function assembleBuild(o: { name: string; message?: string; blocks: DocBlock[]; presetId: string | null }): string {
  const preset = o.presetId ? STYLE_PRESETS.find((p) => p.id === o.presetId) ?? null : null;
  const css = buildDocShellCss(preset ? { scheme: preset.scheme, palette: preset.palette } : {});
  const blocksHtml = o.blocks.map((b) => {
    if (b.kind === 'text') return b.text?.trim() ? textBlockHtml(b.text) : '';
    if (b.kind === 'image') return typeof b.imgIndex === 'number' ? imageBlockHtml(b.imgIndex, b.caption) : '';
    return b.html ? stripToSection(b.html) : '';
  }).filter(Boolean);
  return assembleDoc({ title: o.name, subtitle: o.message, css, blocksHtml });
}

export function DocStudio(props: {
  name: string;
  purpose: string;
  tier: Tier;
  setTier: (t: Tier) => void;
  stylePresetId: string | null;
  memoryName?: string;
  svgAllowed: boolean;
  images: DocImage[];
  onOpenImages: () => void;
  /** Latest MUSE_DOCBUILD checkpoint, if any — offered as a resume. */
  savedBuild: DocBuild | null;
  /** Reopen THIS build directly (the done screen's "back to the studio") —
   *  loads immediately, no resume banner. */
  initialBuild?: DocBuild | null;
  onCheckpoint: (b: DocBuild) => void;
  runInfer: (prompt: string, o: { maxTokens: number; temperature: number }) => Promise<string>;
  resolveHtml: (html: string) => Promise<string>;
  onSave: (build: DocBuild, html: string) => Promise<void>;
  onBack: () => void;
}) {
  const { t } = useI18n();
  // A FRESH docId unless a build was handed in — declining the resume banner
  // must never leave the old docId around (saving a new document would have
  // appended its versions to the OLD one). Resuming sets it explicitly.
  const [docId, setDocId] = useState(() => props.initialBuild?.docId ?? `doc#${Date.now()}`);
  // Title + intent are OWNED here (seeded by the props): the dashboard entry
  // arrives with only a typed sentence — or nothing — and both stay editable
  // for the whole construction.
  const [title, setTitle] = useState(props.initialBuild?.name ?? props.name);
  const [intent, setIntent] = useState(props.initialBuild?.purpose ?? props.purpose);
  const [outline, setOutline] = useState<DocOutline | null>(props.initialBuild?.outline ?? null);
  const [blocks, setBlocks] = useState<DocBlock[]>(props.initialBuild?.blocks ?? []);
  const [stage, setStage] = useState<'plan' | 'blocks'>(props.initialBuild && props.initialBuild.blocks.length > 0 ? 'blocks' : 'plan');
  const [planBusy, setPlanBusy] = useState(false);
  const [planErr, setPlanErr] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  /** The resume offer shows only until the human decides — either way. A
   *  direct reopen (initialBuild) never shows it: the choice was already made. */
  const [resumeOffered, setResumeOffered] = useState(!props.initialBuild && !!props.savedBuild);

  // Keep the latest state reachable from async completions without stale
  // closures — generation of block A must not clobber an edit on block B.
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const outlineRef = useRef(outline);
  outlineRef.current = outline;
  const titleRef = useRef(title);
  titleRef.current = title;
  const intentRef = useRef(intent);
  intentRef.current = intent;

  const checkpoint = (nextOutline: DocOutline | null, nextBlocks: DocBlock[]) => {
    if (!nextOutline) return;
    props.onCheckpoint({ docbuild: true, docId, name: titleRef.current, purpose: intentRef.current, outline: nextOutline, blocks: nextBlocks, ts: Date.now() });
  };

  const setBlocksAnd = (next: DocBlock[], save = true) => {
    setBlocks(next);
    if (save) checkpoint(outlineRef.current, next);
  };

  // ── Plan stage ────────────────────────────────────────────────────────────
  const proposePlan = async () => {
    setPlanBusy(true);
    setPlanErr('');
    try {
      const reply = await props.runInfer(
        buildDocPlanPrompt({ name: titleRef.current, purpose: intentRef.current, memoryName: props.memoryName }),
        { maxTokens: 900, temperature: 0.4 },
      );
      const parsed = parseDocPlan(reply);
      if (!parsed) throw new Error(t('studio.planUnparsed'));
      setOutline(parsed);
      checkpoint(parsed, blocksRef.current);
    } catch (err) {
      setPlanErr((err as Error)?.message || t('err.genericFailed'));
    } finally {
      setPlanBusy(false);
    }
  };

  const emptyPlan = () => {
    const o: DocOutline = { sections: [{ title: '', brief: '', form: '' }] };
    setOutline(o);
  };

  const patchSection = (i: number, patch: Partial<DocSection>) => {
    if (!outline) return;
    const sections = outline.sections.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setOutline({ ...outline, sections });
  };

  const moveSection = (i: number, dir: -1 | 1) => {
    if (!outline) return;
    const sections = [...outline.sections];
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    [sections[i], sections[j]] = [sections[j], sections[i]];
    setOutline({ ...outline, sections });
  };

  const removeSection = (i: number) => {
    if (!outline) return;
    setOutline({ ...outline, sections: outline.sections.filter((_, j) => j !== i) });
  };

  const addSection = () => {
    if (!outline) return;
    setOutline({ ...outline, sections: [...outline.sections, { title: '', brief: '', form: '' }] });
  };

  /** Plan → blocks: one gen block per section. Re-entering the plan keeps the
   *  blocks already generated when titles still match (cheap-first). */
  const buildBlocks = () => {
    if (!outline) return;
    const kept = new Map(blocksRef.current.filter((b) => b.kind === 'gen' && b.html).map((b) => [b.title, b]));
    const next: DocBlock[] = outline.sections
      .filter((s) => s.title.trim())
      .map((s) => {
        const prev = kept.get(s.title);
        return prev
          ? { ...prev, brief: s.brief, form: s.form }
          : { id: newId(), kind: 'gen' as const, title: s.title, brief: s.brief, form: s.form };
      });
    // Manual blocks survive a re-plan — they were placed by hand.
    const manual = blocksRef.current.filter((b) => b.kind !== 'gen');
    setBlocksAnd([...next, ...manual]);
    setStage('blocks');
    checkpoint(outline, [...next, ...manual]);
  };

  // ── Blocks stage ──────────────────────────────────────────────────────────
  const generateBlock = async (id: string) => {
    const o = outlineRef.current;
    const b = blocksRef.current.find((x) => x.id === id);
    if (!o || !b || b.kind !== 'gen') return;
    setBusy((m) => ({ ...m, [id]: true }));
    setErrs((m) => ({ ...m, [id]: '' }));
    try {
      const list = blocksRef.current;
      const index = list.findIndex((x) => x.id === id);
      const prior = list.slice(0, index)
        .map((x) => (x.kind === 'text' ? x.text ?? '' : x.html ?? ''))
        .filter(Boolean)
        .map((h) => excerpt(h));
      const reply = await props.runInfer(
        buildDocSectionPrompt({
          name: titleRef.current, purpose: intentRef.current,
          planText: outlineToPlanText(o), index: Math.max(index, 0),
          section: { title: b.title, brief: b.brief ?? '', form: b.form ?? '' },
          prior, remark: remarks[id]?.trim() || undefined,
          memoryName: props.memoryName, svg: props.svgAllowed,
        }),
        { maxTokens: 2200, temperature: 0.6 },
      );
      const html = stripToSection(reply);
      if (!html) throw new Error(t('studio.blockEmpty'));
      const next = blocksRef.current.map((x) => (x.id === id ? { ...x, html } : x));
      setBlocksAnd(next);
    } catch (err) {
      setErrs((m) => ({ ...m, [id]: (err as Error)?.message || t('err.genericFailed') }));
    } finally {
      setBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const addBlock = (kind: 'text' | 'image' | 'gen') => {
    const b: DocBlock = kind === 'gen'
      ? { id: newId(), kind, title: t('studio.newSection'), brief: '', form: '' }
      : { id: newId(), kind, title: '' };
    setBlocksAnd([...blocksRef.current, b]);
  };

  const patchBlock = (id: string, patch: Partial<DocBlock>, save = false) => {
    setBlocksAnd(blocksRef.current.map((x) => (x.id === id ? { ...x, ...patch } : x)), save);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const list = [...blocksRef.current];
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setBlocksAnd(list);
  };

  const removeBlock = (id: string) => {
    setBlocksAnd(blocksRef.current.filter((x) => x.id !== id));
  };

  const readyCount = blocks.filter((b) =>
    (b.kind === 'gen' && b.html) || (b.kind === 'text' && b.text?.trim()) || (b.kind === 'image' && typeof b.imgIndex === 'number'),
  ).length;

  const doPreview = async () => {
    const html = assembleBuild({ name: titleRef.current, message: outline?.message, blocks: blocksRef.current, presetId: props.stylePresetId });
    setPreview(await props.resolveHtml(html));
  };

  const doSave = async () => {
    const o = outlineRef.current;
    if (!o || readyCount === 0 || saving || !titleRef.current.trim()) return;
    setSaving(true);
    setSaveErr('');
    try {
      const html = assembleBuild({ name: titleRef.current, message: o.message, blocks: blocksRef.current, presetId: props.stylePresetId });
      await props.onSave({ docbuild: true, docId, name: titleRef.current, purpose: intentRef.current, outline: o, blocks: blocksRef.current, ts: Date.now() }, html);
    } catch (err) {
      setSaveErr((err as Error)?.message || t('err.genericFailed'));
      setSaving(false);
    }
  };

  const resume = () => {
    const s = props.savedBuild;
    if (!s) return;
    setDocId(s.docId);
    setTitle(s.name);
    setIntent(s.purpose);
    setOutline(s.outline);
    setBlocks(s.blocks);
    setStage(s.blocks.length > 0 ? 'blocks' : 'plan');
    setResumeOffered(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const tierChip = (id: Tier, label: string) => (
    <button
      key={id}
      className="mu-btn"
      style={{ ...SD.chip, ...(props.tier === id ? SD.chipOn : {}) }}
      onClick={() => props.setTier(id)}
    >{label}</button>
  );

  return (
    <div style={S.dash}>
      <div style={{ ...S.dashInner, maxWidth: '860px' }}>
        <header style={S.dashHead}>
          <div style={S.brand}>
            <button className="mu-btn" style={S.iconBtn} title={t('studio.back')} onClick={props.onBack}>←</button>
            <span style={{ ...S.brandName, fontSize: '19px' }}>{title.trim() || t('studio.untitled')}</span>
            <span style={S.brandTag}>{t('studio.tag')}</span>
          </div>
          <div style={S.headActions}>
            {tierChip('eco', t('tier.eco'))}
            {tierChip('standard', t('tier.standard'))}
            {tierChip('max', t('tier.max'))}
          </div>
        </header>

        {resumeOffered && props.savedBuild && (
          <div style={SD.resume}>
            <span style={{ flex: 1 }}>{t('studio.resumeBanner', { name: props.savedBuild.name })}</span>
            <button className="mu-btn mu-cta" style={SD.smallBtn} onClick={resume}>{t('studio.resume')}</button>
            <button className="mu-btn" style={SD.smallBtn} onClick={() => setResumeOffered(false)}>✕</button>
          </div>
        )}

        {/* ── Stage: plan ── */}
        {stage === 'plan' && (
          <section style={SD.panel}>
            <h2 style={SD.h2}>{t('studio.planTitle')}</h2>
            <p style={S.sub}>{t('studio.planHint')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                style={SD.rowInput} value={title} placeholder={t('studio.titlePh')}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => checkpoint(outlineRef.current, blocksRef.current)}
              />
              <input
                style={{ ...SD.rowInput, fontSize: '12.5px', color: '#c9d6f2' }} value={intent} placeholder={t('studio.intentPh')}
                onChange={(e) => setIntent(e.target.value)}
                onBlur={() => checkpoint(outlineRef.current, blocksRef.current)}
              />
            </div>
            {!outline && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button style={btn(planBusy || !title.trim())} disabled={planBusy || !title.trim()} onClick={() => { void proposePlan(); }}>
                  {planBusy ? t('studio.planBusy') : t('studio.planPropose')}
                </button>
                <button className="mu-btn" style={SD.ghostBtn} disabled={planBusy || !title.trim()} onClick={emptyPlan}>{t('studio.planEmpty')}</button>
              </div>
            )}
            {planErr && <div style={SD.err}>⚠️ {planErr}</div>}
            {outline && (
              <>
                {outline.message && <p style={{ ...S.sub, fontStyle: 'italic' }}>{outline.message}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {outline.sections.map((s, i) => (
                    <div key={i} style={SD.planRow}>
                      <span style={SD.planNum}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          style={SD.rowInput} value={s.title} placeholder={t('studio.sectionTitle')}
                          onChange={(e) => patchSection(i, { title: e.target.value })}
                          onBlur={() => checkpoint(outlineRef.current, blocksRef.current)}
                        />
                        <input
                          style={{ ...SD.rowInput, fontSize: '12px', color: '#9fb2d6' }} value={s.brief} placeholder={t('studio.sectionBrief')}
                          onChange={(e) => patchSection(i, { brief: e.target.value })}
                          onBlur={() => checkpoint(outlineRef.current, blocksRef.current)}
                        />
                      </div>
                      <div style={SD.rowActions}>
                        <button className="mu-btn" style={SD.tinyBtn} onClick={() => moveSection(i, -1)}>↑</button>
                        <button className="mu-btn" style={SD.tinyBtn} onClick={() => moveSection(i, 1)}>↓</button>
                        <button className="mu-btn mu-danger" style={SD.tinyBtn} onClick={() => removeSection(i)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="mu-btn" style={SD.ghostBtn} onClick={addSection}>+ {t('studio.addSection')}</button>
                  <button className="mu-btn" style={SD.ghostBtn} disabled={planBusy} onClick={() => { void proposePlan(); }}>{t('studio.planAgain')}</button>
                  <span style={{ flex: 1 }} />
                  <button style={btn(outline.sections.every((s) => !s.title.trim()))} onClick={buildBlocks}>
                    {t('studio.toBlocks')} →
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* ── Stage: blocks ── */}
        {stage === 'blocks' && outline && (
          <section style={SD.panel}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={SD.h2}>{t('studio.blocksTitle')}</h2>
              <button className="mu-btn" style={SD.tinyBtn} onClick={() => setStage('plan')}>← {t('studio.backToPlan')}</button>
              <span style={{ ...S.sub, fontSize: '12px' }}>{t('studio.readyCount', { n: readyCount, total: blocks.length })}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {blocks.map((b, i) => (
                <div key={b.id} style={SD.blockCard}>
                  <div style={SD.blockHead}>
                    <span style={SD.planNum}>{i + 1}</span>
                    <span style={SD.blockKind}>
                      {b.kind === 'gen' ? t('studio.kindGen') : b.kind === 'text' ? t('studio.kindText') : t('studio.kindImage')}
                    </span>
                    <span style={SD.blockTitle}>{b.kind === 'gen' ? b.title : ''}</span>
                    <span style={{ flex: 1 }} />
                    <button className="mu-btn" style={SD.tinyBtn} onClick={() => moveBlock(b.id, -1)}>↑</button>
                    <button className="mu-btn" style={SD.tinyBtn} onClick={() => moveBlock(b.id, 1)}>↓</button>
                    <button className="mu-btn mu-danger" style={SD.tinyBtn} onClick={() => removeBlock(b.id)}>✕</button>
                  </div>

                  {b.kind === 'gen' && (
                    <>
                      {b.html
                        ? <p style={SD.excerpt}>{excerpt(b.html, 260)}</p>
                        : <p style={{ ...SD.excerpt, fontStyle: 'italic' }}>{b.brief || t('studio.notGenerated')}</p>}
                      {errs[b.id] && <div style={SD.err}>⚠️ {errs[b.id]}</div>}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          className="mu-btn mu-cta" style={SD.smallBtn} disabled={!!busy[b.id]}
                          onClick={() => { void generateBlock(b.id); }}
                        >
                          {busy[b.id] ? t('studio.generating') : b.html ? t('studio.regenerate') : t('studio.generate')}
                        </button>
                        <input
                          style={{ ...SD.rowInput, flex: 1, minWidth: '160px', fontSize: '12px' }}
                          placeholder={t('studio.remarkPh')}
                          value={remarks[b.id] ?? ''}
                          onChange={(e) => setRemarks((m) => ({ ...m, [b.id]: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  {b.kind === 'text' && (
                    <textarea
                      style={SD.textarea}
                      rows={5}
                      placeholder={t('studio.textPh')}
                      value={b.text ?? ''}
                      onChange={(e) => patchBlock(b.id, { text: e.target.value })}
                      onBlur={() => checkpoint(outlineRef.current, blocksRef.current)}
                    />
                  )}

                  {b.kind === 'image' && (
                    props.images.length === 0 ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ ...S.sub, fontSize: '12.5px' }}>{t('studio.noImages')}</span>
                        <button className="mu-btn" style={SD.smallBtn} onClick={props.onOpenImages}>{t('studio.pickImages')}</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {props.images.map((img, idx) => (
                            <button
                              key={img.path}
                              className="mu-btn"
                              style={{ ...SD.tinyBtn, ...(b.imgIndex === idx ? SD.chipOn : {}), maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={img.rel}
                              onClick={() => patchBlock(b.id, { imgIndex: idx }, true)}
                            >{img.rel.split('/').pop()}</button>
                          ))}
                        </div>
                        <input
                          style={{ ...SD.rowInput, fontSize: '12px' }}
                          placeholder={t('studio.captionPh')}
                          value={b.caption ?? ''}
                          onChange={(e) => patchBlock(b.id, { caption: e.target.value })}
                          onBlur={() => checkpoint(outlineRef.current, blocksRef.current)}
                        />
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>

            {/* Add-block bar — video/audio are announced, disabled, and honest. */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="mu-btn" style={SD.ghostBtn} onClick={() => addBlock('gen')}>+ {t('studio.addGen')}</button>
              <button className="mu-btn" style={SD.ghostBtn} onClick={() => addBlock('text')}>+ {t('studio.addText')}</button>
              <button className="mu-btn" style={SD.ghostBtn} onClick={() => addBlock('image')}>+ {t('studio.addImage')}</button>
              <button className="mu-btn" style={{ ...SD.ghostBtn, opacity: 0.45, cursor: 'not-allowed' }} disabled title={t('studio.soonTip')}>{t('studio.addVideo')} · {t('studio.soon')}</button>
              <button className="mu-btn" style={{ ...SD.ghostBtn, opacity: 0.45, cursor: 'not-allowed' }} disabled title={t('studio.soonTip')}>{t('studio.addAudio')} · {t('studio.soon')}</button>
            </div>

            {saveErr && <div style={SD.err}>⚠️ {saveErr}</div>}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="mu-btn" style={SD.ghostBtn} disabled={readyCount === 0} onClick={() => { void doPreview(); }}>👁 {t('studio.preview')}</button>
              <span style={{ flex: 1 }} />
              <button style={btn(readyCount === 0 || saving || !title.trim())} disabled={readyCount === 0 || saving || !title.trim()} onClick={() => { void doSave(); }}>
                {saving ? t('studio.saving') : t('studio.save')}
              </button>
            </div>
          </section>
        )}

        {/* ── Preview overlay ── */}
        {preview !== null && (
          <div style={S.overlay} onClick={() => setPreview(null)}>
            <div style={{ ...S.modal, maxWidth: '900px', height: '86vh', padding: '12px', alignItems: 'stretch' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="mu-btn" style={SD.tinyBtn} onClick={() => setPreview(null)}>✕</button>
              </div>
              <iframe sandbox="" srcDoc={preview} style={{ flex: 1, border: 'none', borderRadius: '10px', background: '#fff' }} title={t('studio.preview')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SD: Record<string, CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: 'clamp(14px, 3vw, 22px)', background: 'rgba(255,255,255,0.02)' },
  h2: { fontSize: '17px', fontWeight: 700, margin: 0, color: '#eaf2ff' },
  chip: { fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)', color: '#9fb2d6', cursor: 'pointer', fontFamily: 'inherit' },
  chipOn: { border: '1px solid rgba(59,130,246,0.7)', background: 'rgba(59,130,246,0.16)', color: '#cfe4ff' },
  ghostBtn: { fontSize: '12.5px', fontWeight: 600, padding: '8px 13px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)', color: '#c9d6f2', cursor: 'pointer', fontFamily: 'inherit' },
  smallBtn: { fontSize: '12.5px', fontWeight: 700, padding: '8px 13px', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.45)', background: 'rgba(59,130,246,0.14)', color: '#cfe4ff', cursor: 'pointer', fontFamily: 'inherit' },
  tinyBtn: { fontSize: '12px', padding: '4px 9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: '#9fb2d6', cursor: 'pointer', fontFamily: 'inherit' },
  planRow: { display: 'flex', gap: '10px', alignItems: 'flex-start', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)' },
  planNum: { fontSize: '12px', fontWeight: 700, color: '#7dd3fc', width: '20px', textAlign: 'center', flexShrink: 0, paddingTop: '8px' },
  rowInput: { boxSizing: 'border-box', width: '100%', fontSize: '13.5px', padding: '7px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#eaf2ff', outline: 'none', fontFamily: 'inherit' },
  rowActions: { display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 },
  blockCard: { display: 'flex', flexDirection: 'column', gap: '9px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)' },
  blockHead: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  blockKind: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7dd3fc', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '999px', padding: '2px 8px', flexShrink: 0 },
  blockTitle: { fontSize: '13.5px', fontWeight: 600, color: '#eaf2ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  excerpt: { fontSize: '12.5px', lineHeight: 1.55, color: '#9fb2d6', margin: 0 },
  textarea: { boxSizing: 'border-box', width: '100%', fontSize: '13.5px', lineHeight: 1.6, padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#eaf2ff', outline: 'none', fontFamily: 'inherit', resize: 'vertical' },
  err: { fontSize: '12.5px', color: '#fca5a5' },
  resume: { display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(94,214,160,0.35)', background: 'rgba(94,214,160,0.06)', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: '#dbe7ff' },
};
