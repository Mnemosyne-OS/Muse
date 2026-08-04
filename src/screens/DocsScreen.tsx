// Doc library: folder tree + reader side by side. Extracted out of App.tsx's
// view chain — owns no state, just renders what App() already tracks.
import { Markdown } from '../Markdown';
import { GBack } from '../Glyphs';
import { DocTreeView, S } from '../Chrome';
import type { DocEntry, DocFolder, Installable } from '../appLogic';

type T = (key: string, vars?: Record<string, string | number>) => string;

export function DocsScreen({
  t, selDoc, docQuery, setDocQuery, docsState, folder, docs, docMatches, docTree, expanded,
  readerLoading, docContent, installables,
  onBack, onInstallClick, onGoOnboarding, onToggleFolder, onOpenDoc, onOpenExternal,
}: {
  t: T;
  selDoc: DocEntry | null;
  docQuery: string;
  setDocQuery: (q: string) => void;
  docsState: 'loading' | 'ok' | 'missing';
  folder: string;
  docs: DocEntry[];
  docMatches: DocEntry[];
  docTree: DocFolder;
  expanded: Set<string>;
  readerLoading: boolean;
  docContent: string;
  installables: Installable[];
  onBack: () => void;
  onInstallClick: (item: Installable) => void;
  onGoOnboarding: () => void;
  onToggleFolder: (rel: string) => void;
  onOpenDoc: (doc: DocEntry) => void;
  onOpenExternal: (url: string) => void;
}) {
  return (
    <div style={S.docsWrap}>
      <div style={S.readerHead}>
        <button className="mu-btn" style={S.secondary} onClick={onBack}><GBack size={13} />{t('common.back')}</button>
        <span style={S.readerTitle}>
          {selDoc ? selDoc.rel.split('/').join(' › ') : t('dash.docLibrary')}
        </span>
      </div>
      <div className="docs-body" style={S.docsBody}>
        <aside className="docs-side" style={S.docsSide}>
          <input
            style={S.docsSearch}
            placeholder={t('docs.filterPlaceholder')}
            value={docQuery}
            onChange={(e) => setDocQuery(e.target.value)}
          />
          <div style={S.docsTree}>
            {docsState === 'loading' && <p style={S.empty}>{t('docs.searching')}</p>}
            {docsState === 'missing' && (
              <p style={S.empty}>
                {folder
                  ? <>{t('docs.needInstallPre')} <b>Mnemosyne Neural OS</b> {t('docs.needInstallEnd')} <button className="mu-btn" style={S.ideLinkPrimary} onClick={() => onInstallClick(installables[0])}>{t('install.installButton')}</button></>
                  : <>{t('docs.needSpaceMsg')} <button className="mu-btn" style={S.ideLinkPrimary} onClick={onGoOnboarding}>{t('install.onboardingButton')}</button></>}
              </p>
            )}
            {docsState === 'ok' && docs.length === 0 && <p style={S.empty}>{t('docs.none')}</p>}
            {docsState === 'ok' && docs.length > 0 && (docQuery.trim() ? (
              <>
                {docMatches.length === 0 && <p style={S.empty}>{t('docs.noResults')}</p>}
                {docMatches.map((d) => (
                  <button
                    key={d.rel}
                    style={{ ...S.treeFile, ...(selDoc?.rel === d.rel ? S.treeFileOn : {}) }}
                    title={d.rel}
                    onClick={() => onOpenDoc(d)}
                  >
                    <span style={S.docIcon}>📄</span>
                    <span style={S.treeLabel}>{d.rel}</span>
                  </button>
                ))}
              </>
            ) : (
              <DocTreeView
                folder={docTree}
                depth={0}
                expanded={expanded}
                selRel={selDoc?.rel ?? null}
                onToggle={onToggleFolder}
                onOpen={onOpenDoc}
              />
            ))}
          </div>
        </aside>
        <div style={S.readerBody}>
          {!selDoc && (
            <div style={S.readerPlaceholder}>
              <div style={{ fontSize: '34px' }}>📖</div>
              <p style={S.sub}>{t('docs.pickDoc')}</p>
            </div>
          )}
          {selDoc && (readerLoading
            ? <p style={S.empty}>{t('common.loading')}</p>
            : <Markdown source={docContent} onLink={onOpenExternal} />)}
        </div>
      </div>
    </div>
  );
}
