/**
 * host.ts — the one door between Muse and the shell.
 *
 * Everything that leaves this cartridge goes through here: the SDK instance,
 * the typed action bridge, opening a URL, and the patience loop that survives
 * a bridge timeout. It lives apart from App.tsx so that "what can Muse ask the
 * host for?" is answerable by reading one short file instead of grepping a
 * three-thousand-line component.
 *
 * Host actions are catalogued in doc 52; the main process is the one enforcing
 * what each of them may touch.
 */
import { MnemoCartridgeSDK } from '../sdk/mnemo-sdk';

/** Must match "name" in mnemo-plugin.json — the host keys this cartridge's
 *  sandbox vault on it. Renaming later orphans the old vault (no migration). */
export const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/muse');

/** Typed pass-through to the host action bridge (actions: doc 52). */
export function invokeHost<T>(action: string, payload: unknown): Promise<T> {
  const fn = (sdk as { invoke?: (a: string, p: unknown) => Promise<unknown> }).invoke;
  if (!fn) return Promise.reject(new Error('SDK invoke unavailable'));
  return fn.call(sdk, action, payload) as Promise<T>;
}

/** Open a URL in the OS browser. Sandboxed cartridge iframes block
 *  target="_blank", so external links MUST route through the host
 *  shell.openExternal action (doc 52). */
export const openExternal = (url: string): void => {
  (sdk as { invoke?: (a: string, p: unknown) => Promise<unknown> }).invoke?.('shell.openExternal', { url })
    ?.catch((e: unknown) => console.warn('openExternal failed:', e));
};

/** Delays for `ms`. Used by waitForClone below, and by the catalogue import
 *  loop that polls the same way. */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Patience mode after a bridge timeout: the clone keeps running host-side,
 *  so poll the destination until the working tree appears and stabilizes
 *  (shallow clones check files out last → a stable non-.git listing ≈ done).
 *  `onTick` gets the raw file count, not a message: this module has no `t()`,
 *  so the caller renders the translated progress line. */
export async function waitForClone(dest: string, onTick?: (count: number) => void): Promise<boolean> {
  let lastCount = -1;
  let stable = 0;
  for (let i = 0; i < 60; i++) { // ~4 minutes max
    await sleep(4000);
    let names: string[] = [];
    try {
      const r = await invokeHost<{ success?: boolean; files?: { name: string }[] }>('dialog.readDir', { dirPath: dest });
      if (r?.success && Array.isArray(r.files)) names = r.files.map((f) => f.name);
    } catch { /* destination not created yet — keep waiting */ }
    const workCount = names.filter((n) => n !== '.git').length;
    if (workCount > 0) onTick?.(workCount);
    if (workCount > 0 && workCount === lastCount) {
      stable++;
      if (stable >= 2) return true;
    } else {
      stable = 0;
    }
    lastCount = workCount;
  }
  return false;
}
