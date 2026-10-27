import { lstat, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ASSETS = Object.freeze([
  'index.html', 'en/index.html', 'styles/app.css', 'js/app.js',
  'js/core/errors.mjs', 'js/core/csv.mjs', 'js/core/orders.mjs',
  'js/core/export.mjs',
  'js/core/session.mjs', 'js/copy.mjs', 'js/view.mjs', '_headers', 'robots.txt',
]);

export async function walkFiles(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('SYMLINK_REJECTED');
    if (stat.isDirectory()) files.push(...await walkFiles(path, root));
    else if (stat.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
    else throw new Error('SPECIAL_FILE_REJECTED');
  }
  return files.sort();
}

export async function assertAssets(directory) {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('SYMLINK_REJECTED');
  const actual = await walkFiles(directory);
  if (JSON.stringify(actual) !== JSON.stringify([...ASSETS].sort())) throw new Error('ASSET_ALLOWLIST_MISMATCH');
  return actual;
}
