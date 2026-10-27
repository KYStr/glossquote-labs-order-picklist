import { lstat, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, ASSETS } from './assets.mjs';
import { ORIGIN, TOOL_SLUG, URLS, releaseHtml, releaseBody, inspectReleaseHtml, splitHead } from './release-html.mjs';

// Reviewed R01 public bytes. These pins are independent of the output manifest.
export const SOURCE_PINS = Object.freeze([
  ['_headers', 344, 'e15cd50c4cb61192cac4ec7b08b0f53e4cf53414b269c831bd71e6c96f643223'],
  ['en/index.html', 8456, '6d4e791ac7e9755f94d2b8014cdfb4cb62d32d80bb4d7eaf64f76970141e0faa'],
  ['index.html', 8009, '40c20f6dc36ceb8d86e2651e75cb5e166e3eb034e41ab3dc9bd8df259ea9e9b5'],
  ['js/app.js', 8992, 'a2ab1f45b1eb2590e4451dc78a258527851d87576afb0f2d39c4e819b66e3fa5'],
  ['js/copy.mjs', 7962, '8f1a31d297d701b3268420ba426ab75d35a5f519d7377796867247471d2efe4f'],
  ['js/core/csv.mjs', 2812, 'ecba4c5445a2f8836fc08a7177236fd11b35a5776420812e5018df0ad2bd5bb7'],
  ['js/core/errors.mjs', 650, 'c580912643f577bbf1c10ad18efa489fe8ae191b925d4556a91d176a099a6426'],
  ['js/core/export.mjs', 2890, '6401aede88a323393d544e73e8e90a65824b142b800acdda8ad90116637ae1b8'],
  ['js/core/orders.mjs', 4355, '5208fd8643d47dbadc82f11dbb97ad00a94f35e4a0e7c85c09e75b2644e43ba6'],
  ['js/core/session.mjs', 5127, 'b9a855991d88e9ada1ebf2ef3f0ff3ecb6c1c70ac3b36142f314724b65bfe417'],
  ['js/view.mjs', 4221, '49f59a31fdc5215237f6c3bc8d9dfbfbd69da2af474748a22bb6b678f0485503'],
  ['robots.txt', 26, '331ea9090db0c9f6f597bd9840fd5b171830f6e0b3ba1cb24dfa91f0c95aedc1'],
  ['styles/app.css', 10421, 'd22203d2191dd658916accca60ed3e40cf4e53a10134e74e4c16640d15d4fbe9'],
].map(([path, bytes, sha256]) => Object.freeze({ path, bytes, sha256 })));

export const SITE_PATHS = Object.freeze([...new Set([...ASSETS, 'robots.txt', '_headers', 'sitemap.xml'])].sort());
const OUTPUT_PATHS = ['manifest.json', ...SITE_PATHS.map(path => `site/${path}`)].sort();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const utf8 = text => Buffer.from(text, 'utf8');
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const requireValue = (value, code) => { if (!value) throw new Error(code); };

async function statMaybe(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function safeRoot(root) {
  const resolved = resolve(root);
  const fixtureBase = join(ROOT, 'evidence', 'm2a', 'fixtures');
  const child = relative(fixtureBase, resolved);
  requireValue(resolved === ROOT || (child !== '' && child !== '..' && !child.startsWith('..\\') && !child.startsWith('../') && !isAbsolute(child)), 'ROOT_OUTSIDE_TASK');
  return resolved;
}

async function checkedRoot(root) {
  const resolved = safeRoot(root);
  let cursor = ROOT;
  for (const part of ['', ...relative(ROOT, resolved).split(/[\\/]/).filter(Boolean)]) {
    if (part) cursor = join(cursor, part);
    const stat = await lstat(cursor);
    requireValue(!stat.isSymbolicLink() && stat.isDirectory(), 'ROOT_INVALID');
  }
  return resolved;
}

function directories(paths) {
  const expected = new Set();
  for (const path of paths) {
    const parts = path.split('/');
    requireValue(parts.every(part => part && part !== '.' && part !== '..' && !part.includes('\\') && !part.includes(':')), 'UNSAFE_ASSET_PATH');
    for (let i = 1; i < parts.length; i++) expected.add(parts.slice(0, i).join('/'));
  }
  return expected;
}

async function closedTree(root, paths) {
  const rootStat = await lstat(root);
  requireValue(!rootStat.isSymbolicLink() && rootStat.isDirectory(), 'DIRECTORY_OR_LINK_INVALID');
  const expectedFiles = new Set(paths);
  const expectedDirectories = directories(paths);
  const found = [];
  async function walk(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const path = prefix ? prefix + '/' + name : name;
      const absolute = join(directory, name);
      const stat = await lstat(absolute);
      requireValue(!stat.isSymbolicLink(), 'SYMLINK_OR_JUNCTION_REJECTED');
      if (stat.isDirectory()) {
        requireValue(expectedDirectories.has(path), 'UNKNOWN_DIRECTORY');
        await walk(absolute, path);
      } else {
        requireValue(stat.isFile() && expectedFiles.has(path), 'UNKNOWN_FILE');
        found.push(path);
      }
    }
  }
  await walk(root);
  requireValue(JSON.stringify(found.sort()) === JSON.stringify([...paths].sort()), 'MISSING_FILE');
}

async function exactBytes(path, expected, code) {
  const stat = await lstat(path);
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size === expected.length, code);
  const bytes = await readFile(path);
  requireValue(bytes.equals(expected), code);
  return bytes;
}

export async function expectedRelease(root = ROOT) {
  root = await checkedRoot(root);
  const origin = new URL(ORIGIN);
  requireValue(origin.protocol === 'https:' && origin.hostname === 'picklist.glossquote.com' && origin.origin === ORIGIN && origin.pathname === '/' && !origin.port && !origin.username && !origin.password && !origin.search && !origin.hash, 'ORIGIN_INVALID');
  requireValue(JSON.stringify([...ASSETS].sort()) === JSON.stringify(SOURCE_PINS.map(entry => entry.path)), 'SOURCE_ALLOWLIST_CHANGED');
  await closedTree(join(root, 'public'), SOURCE_PINS.map(entry => entry.path));
  const source = new Map();
  for (const pin of SOURCE_PINS) {
    const path = join(root, 'public', pin.path);
    const stat = await lstat(path);
    requireValue(stat.size === pin.bytes, 'SOURCE_CHANGED');
    const bytes = await readFile(path);
    requireValue(sha(bytes) === pin.sha256, 'SOURCE_CHANGED');
    source.set(pin.path, bytes);
  }
  const site = new Map(source);
  for (const [path, language] of [['index.html', 'zh'], ['en/index.html', 'en']]) {
    const preview = decode(source.get(path));
    const transformed = releaseHtml(preview, language);
    const a = splitHead(preview); const b = splitHead(transformed);
    requireValue(a.before === b.before && releaseBody(a.after, language) === b.after, 'VISIBLE_HTML_CHANGED');
    site.set(path, utf8(transformed));
  }
  const headers = decode(source.get('_headers'));
  const matches = [...headers.matchAll(/^([ \t]*X-Robots-Tag:[ \t]*)noindex, nofollow([ \t]*\r?)$/gm)];
  requireValue(matches.length === 1, 'SOURCE_HEADERS_INVALID');
  site.set('_headers', utf8(headers.replace(matches[0][0], matches[0][1] + 'index, follow' + matches[0][2])));
  site.set('robots.txt', utf8(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`));
  site.set('sitemap.xml', utf8(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${URLS.zh}</loc></url>\n  <url><loc>${URLS.en}</loc></url>\n</urlset>\n`));
  const files = SITE_PATHS.map(path => ({ path, bytes: site.get(path).length, sha256: sha(site.get(path)) }));
  const manifest = { schemaVersion: 1, mode: 'release-candidate', origin: ORIGIN, toolSlug: TOOL_SLUG, files, sourceFiles: SOURCE_PINS.map(entry => ({ ...entry })) };
  return { site, manifest, manifestBytes: utf8(JSON.stringify(manifest, null, 2) + '\n') };
}

async function checkOutput(root, expected) {
  const output = join(root, 'release-artifacts');
  await closedTree(output, OUTPUT_PATHS);
  await exactBytes(join(output, 'manifest.json'), expected.manifestBytes, 'MANIFEST_MISMATCH');
  for (const [path, bytes] of expected.site) await exactBytes(join(output, 'site', path), bytes, 'OUTPUT_MISMATCH');
  // Parse actual output independently of its manifest in addition to byte checks.
  for (const [path, language] of [['index.html', 'zh'], ['en/index.html', 'en']]) inspectReleaseHtml(decode(await readFile(join(output, 'site', path))), language);
}

export async function runRelease(mode, { root = ROOT } = {}) {
  requireValue(mode === 'build' || mode === 'check', 'MODE_INVALID');
  root = safeRoot(root);
  const rootStat = await lstat(root);
  requireValue(!rootStat.isSymbolicLink() && rootStat.isDirectory(), 'ROOT_INVALID');
  const expected = await expectedRelease(root);
  const output = join(root, 'release-artifacts');
  const existing = await statMaybe(output);
  if (mode === 'check' || existing) {
    requireValue(existing, 'OUTPUT_MISSING');
    await checkOutput(root, expected);
    return { mode, files: expected.manifest.files.length, bytes: expected.manifest.files.reduce((sum, file) => sum + file.bytes, 0), reused: mode === 'build' };
  }
  // All inputs and any existing output are checked before the first write.
  // Exclusive creation never overwrites user files. Partial I/O failures are kept.
  await mkdir(output);
  for (const path of [...directories(OUTPUT_PATHS)].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b, 'en'))) await mkdir(join(output, path));
  for (const path of SITE_PATHS) await writeFile(join(output, 'site', path), expected.site.get(path), { flag: 'wx' });
  await writeFile(join(output, 'manifest.json'), expected.manifestBytes, { flag: 'wx' });
  await checkOutput(root, expected);
  return { mode, files: expected.manifest.files.length, bytes: expected.manifest.files.reduce((sum, file) => sum + file.bytes, 0), reused: false };
}

export function parseMode(args) {
  requireValue(args.length === 1 && (args[0] === 'build' || args[0] === 'check'), 'USAGE_EXPECTED_BUILD_OR_CHECK');
  return args[0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runRelease(parseMode(process.argv.slice(2)));
    console.log(`PASS: ${result.mode} release candidate; ${result.files} files, ${result.bytes} site bytes; origin ${ORIGIN}; unpublished. Existing verified output reused: ${result.reused}.`);
  } catch (error) {
    // Do not log filesystem paths or arbitrary exception contents.
    const allowed = /^[A-Z][A-Z0-9_]+$/;
    console.error(`Release preparation blocked: ${allowed.test(error.message) ? error.message : 'FILESYSTEM_OR_INTERNAL_ERROR'}. No publication or deployment was attempted.`);
    process.exitCode = 1;
  }
}
