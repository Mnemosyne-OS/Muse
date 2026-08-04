/**
 * check-version — the manifest and package.json must carry the SAME semver.
 *
 * The version is displayed in the footer, stamped into every generated
 * artifact (`generator: muse@x.y.z`) and read by the host/store — all from
 * mnemo-plugin.json. package.json drifting silently would make npm/GitHub
 * tell a different story than the running app, so the build breaks instead.
 *
 * Accepted shape: MAJOR.MINOR.PATCH with an optional -alpha.N/-beta.N/-rc.N
 * pre-release tag. The Beta badge in the UI derives from that tag: shipping
 * a final x.y.z removes it everywhere at once.
 *
 * Run: node scripts/check-version.mjs  (wired into `build`)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf-8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

const SEMVER = /^\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$/;

let failed = false;
if (!SEMVER.test(manifest.version)) {
  failed = true;
  console.error(`✗ mnemo-plugin.json version "${manifest.version}" is not MAJOR.MINOR.PATCH[-beta.N]`);
}
if (manifest.version !== pkg.version) {
  failed = true;
  console.error(`✗ version drift — mnemo-plugin.json says "${manifest.version}", package.json says "${pkg.version}"`);
}

if (failed) process.exit(1);
console.log(`✓ version OK — ${manifest.version} (manifest + package.json aligned)`);
