/**
 * odFiles.ts — reading the Open Design catalogue OFF DISK.
 *
 * The adapters that turn those bytes into an OdSystem are pure and live in
 * handoff.ts (and are tested there). What is left here is the part that talks
 * to the filesystem, which is exactly what those tests cannot cover — keeping
 * the two apart is what makes the pure half testable at all.
 */
import { buildOdSystem, inlineOdStylesheet, OD_PAGE_FILES, OD_SYSTEMS_DIR, type OdSystem } from '../handoff';
import { joinPath } from '../appLogic';
import { invokeHost } from './host';

/** Folder names under design-systems/ — the catalogue's real inventory on
 *  disk. Shared by the import loop and the "check" button so both answer the
 *  same question the same way: what is actually there, right now. */
export async function readOdSystems(sysDir: string): Promise<string[]> {
  try {
    const r = await invokeHost<{ success?: boolean; files?: Array<{ name: string; isDirectory: boolean }> }>(
      'dialog.readDir', { dirPath: sysDir });
    if (r?.success && Array.isArray(r.files)) {
      return r.files.filter((f) => f.isDirectory && !f.name.startsWith('_') && !f.name.startsWith('.')).map((f) => f.name);
    }
  } catch { /* not checked out yet */ }
  return [];
}

/** Read ONE Open Design system off disk: the three metadata files plus its
 *  reference pages. Two callers need it — opening a system in the studio, and
 *  restoring the one a saved document was rendered with. Null when the tokens
 *  are unreadable (deleted catalogue, truncated clone): the caller must say so
 *  rather than quietly design something else. */
export async function loadOdSystem(libPath: string, id: string): Promise<OdSystem | null> {
  const dir = joinPath(joinPath(libPath, OD_SYSTEMS_DIR), id);
  const read = async (file: string): Promise<string | null> => {
    try {
      // Path segments, not a raw join: preview/colors.html must become a real
      // nested path on Windows too.
      const filePath = file.split('/').reduce((acc, seg) => joinPath(acc, seg), dir);
      const r = await invokeHost<{ success?: boolean; content?: string }>('dialog.readFile', { filePath });
      if (!r?.success || typeof r.content !== 'string') return null;
      // The biggest components.html in the catalogue is ~56 KB; an order of
      // magnitude past that is not a reference page.
      return r.content.length > 400_000 ? null : r.content;
    } catch { return null; }
  };
  const [manifest, tokens, design, css, ...pageContents] = await Promise.all([
    read('manifest.json'), read('design-tokens.json'), read('DESIGN.md'), read('tokens.css'),
    ...OD_PAGE_FILES.map(([, file]) => read(file)),
  ]);
  // preview/*.html LINK ../tokens.css, which resolves to nothing in a srcDoc
  // iframe — inline it or the page renders as unstyled text.
  const pages = Object.fromEntries(
    OD_PAGE_FILES.map(([key], i) => [key, inlineOdStylesheet(pageContents[i], css)]));
  return buildOdSystem(id, dir, { manifest, tokens, design, pages });
}
