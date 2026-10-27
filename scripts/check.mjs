import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, assertAssets } from './assets.mjs';
import { auditAsset } from './audit.mjs';

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
if (!pkg.private || pkg.type !== 'module' || pkg.engines.node !== '>=24') throw new Error('PACKAGE_CONTRACT');
if (Object.keys(pkg.dependencies ?? {}).length || Object.keys(pkg.devDependencies ?? {}).length) throw new Error('DEPENDENCIES_REJECTED');
for (const name of await readdir(join(ROOT, 'scripts'))) {
  if (!name.endsWith('.mjs')) throw new Error('UNKNOWN_SCRIPT_TYPE');
  const checked = spawnSync(process.execPath, ['--check', join(ROOT, 'scripts', name)], { shell: false, windowsHide: true, encoding: 'utf8' });
  if (checked.status !== 0) throw new Error(`SCRIPT_SYNTAX_CHECK_FAILED:${name}`);
}
const assets = await assertAssets(join(ROOT, 'public'));
for (const path of assets) {
  const source = await readFile(join(ROOT, 'public', path), 'utf8');
  if (/\.(?:js|mjs)$/.test(path)) {
    const checked = spawnSync(process.execPath, ['--check', join(ROOT, 'public', path)], { shell: false, windowsHide: true, encoding: 'utf8' });
    if (checked.status !== 0) throw new Error(`SYNTAX_CHECK_FAILED:${path}`);
  }
  const errors = auditAsset(path, source);
  if (errors.length) throw new Error(`ASSET_AUDIT:${path}:${errors.join(',')}`);
}
console.log(`PASS: package contract, closed public allowlist (${assets.length} files), ESM syntax, two language documents/links/labels/noindex and static safety scan. Static checks are not browser verification.`);
