import { copyFile, mkdir, lstat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ROOT, ASSETS, assertAssets } from './assets.mjs';
import { auditAsset } from './audit.mjs';

await assertAssets(join(ROOT, 'public'));
for (const file of ASSETS) {
  if (auditAsset(file, await readFile(join(ROOT, 'public', file), 'utf8')).length) throw new Error('PUBLIC_AUDIT_FAILED');
}
const output = join(ROOT, 'dist');
try { await assertAssets(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, { recursive: true });
if ((await lstat(output)).isSymbolicLink()) throw new Error('SYMLINK_REJECTED');
for (const file of ASSETS) {
  const target = join(output, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(ROOT, 'public', file), target);
}
await assertAssets(output);
for (const file of ASSETS) {
  if (!(await readFile(join(output, file))).equals(await readFile(join(ROOT, 'public', file)))) throw new Error('BUILD_BYTES_MISMATCH');
}
console.log(`PASS: ${ASSETS.length} reviewed preview assets copied to dist; unknown/stale files are rejected, never removed.`);
