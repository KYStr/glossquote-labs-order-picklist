import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, copyFile, readFile, writeFile, readdir, lstat, unlink, symlink, rmdir } from 'node:fs/promises';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, ASSETS } from '../scripts/assets.mjs';
import { runRelease, expectedRelease, SOURCE_PINS, SITE_PATHS, parseMode } from '../scripts/release.mjs';
import { ORIGIN, TOOL_SLUG, splitHead, releaseBody, inspectReleaseHtml } from '../scripts/release-html.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtureBase = join(ROOT, 'evidence', 'm2a', 'fixtures');
async function fixture() {
  await mkdir(fixtureBase, { recursive: true });
  const root = await mkdtemp(join(fixtureBase, 'release-'));
  for (const file of [...ASSETS.map(path => 'public/' + path), 'scripts/assets.mjs', 'scripts/release-html.mjs', 'scripts/release.mjs']) {
    const target = join(root, file); await mkdir(dirname(target), { recursive: true }); await copyFile(join(ROOT, file), target);
  }
  return root;
}
async function inventory(root, prefix = '') {
  const result = [];
  for (const name of (await readdir(root)).sort()) {
    const path = prefix ? prefix + '/' + name : name;
    const full = join(root, name); const stat = await lstat(full);
    if (stat.isSymbolicLink()) result.push([path, 'link']);
    else if (stat.isDirectory()) { result.push([path, 'directory']); result.push(...await inventory(full, path)); }
    else result.push([path, stat.size, hash(await readFile(full))]);
  }
  return result;
}
async function builtFixture() { const root = await fixture(); await runRelease('build', { root }); return root; }
async function setAssetAndManifest(root, path, value) {
  const bytes = Buffer.from(value);
  const manifestPath = join(root, 'release-artifacts/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = manifest.files.find(file => file.path === path);
  entry.bytes = bytes.length; entry.sha256 = hash(bytes);
  await writeFile(join(root, 'release-artifacts/site', path), bytes);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
function ownTarget(root, path) {
  const absolute = resolve(root, path); const child = relative(root, absolute);
  assert.ok(child && child !== '..' && !child.startsWith('../') && !child.startsWith('..\\') && !/^[A-Za-z]:/.test(child));
  assert.ok(relative(fixtureBase, root) && !relative(fixtureBase, root).startsWith('..'));
  return absolute;
}

test('release constants, pinned sources and deduplicated site routes are fixed', async () => {
  assert.equal(ORIGIN, 'https://picklist.glossquote.com'); assert.equal(TOOL_SLUG, 'order-picklist');
  const expected = await expectedRelease();
  assert.deepEqual(SOURCE_PINS.map(pin => pin.path), [...ASSETS].sort());
  assert.equal(SOURCE_PINS.length, 13); assert.equal(SITE_PATHS.length, 14);
  assert.deepEqual(Object.keys(expected.manifest), ['schemaVersion', 'mode', 'origin', 'toolSlug', 'files', 'sourceFiles']);
  assert.equal(expected.manifest.schemaVersion, 1); assert.equal(expected.manifest.mode, 'release-candidate');
  assert.deepEqual(expected.manifest.files.map(file => file.path), [...new Set(expected.manifest.files.map(file => file.path))].sort());
  assert.ok(!expected.manifest.files.some(file => file.path.includes('manifest')));
});

test('both actual release HTML documents have reciprocal exact-domain canonical and three hreflangs', async () => {
  const root = await builtFixture();
  for (const [path, language] of [['index.html', 'zh-Hant'], ['en/index.html', 'en']]) {
    const html = await readFile(join(root, 'release-artifacts/site', path), 'utf8');
    // Separate literal attribute extraction checks actual output, not manifest data.
    const links = [...html.matchAll(/<link\b[^>]*>/g)].map(match => Object.fromEntries([...match[0].matchAll(/([a-z-]+)="([^"]*)"/g)].map(attr => [attr[1], attr[2]])));
    assert.deepEqual(links.filter(link => link.rel === 'canonical'), [{ rel: 'canonical', href: `https://picklist.glossquote.com/${path}` }]);
    assert.deepEqual(links.filter(link => link.rel === 'alternate'), [
      { rel: 'alternate', hreflang: 'zh-Hant', href: 'https://picklist.glossquote.com/index.html' },
      { rel: 'alternate', hreflang: 'en', href: 'https://picklist.glossquote.com/en/index.html' },
      { rel: 'alternate', hreflang: 'x-default', href: 'https://picklist.glossquote.com/index.html' },
    ]);
    assert.ok(html.includes(`<html lang="${language}">`));
    assert.match(html, /<meta name="robots" content="index, follow">/);
    assert.equal((html.match(/name="robots"/g) ?? []).length, 1);
  }
});

test('release changes only SEO and the exact banner; runtime and preview bytes stay unchanged', async () => {
  const root = await fixture(); const before = await inventory(join(root, 'public'));
  await runRelease('build', { root });
  assert.deepEqual(await inventory(join(root, 'public')), before);
  for (const path of ASSETS) {
    const original = await readFile(join(root, 'public', path)); const released = await readFile(join(root, 'release-artifacts/site', path));
    if (path.endsWith('.html')) {
      const source = splitHead(original.toString('utf8')); const output = splitHead(released.toString('utf8'));
      assert.equal(source.before, output.before);
      const oldBanner = path === 'index.html' ? '<p class="preview-label">本地預覽候選</p>' : '<p class="preview-label">Local preview candidate</p>';
      const newBanner = path === 'index.html' ? '<p class="preview-label">檔案在此瀏覽器處理</p>' : '<p class="preview-label">Files are processed in this browser</p>';
      assert.equal(source.after.split(oldBanner).length, 2);
      assert.equal(output.after, source.after.replace(oldBanner, newBanner));
      const withoutSeo = head => head.replace(/<meta name="robots"[^>]*>/g, '').replace(/<link rel="(?:alternate|canonical)"[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      assert.equal(withoutSeo(source.head), withoutSeo(output.head));
      assert.ok(original.includes(Buffer.from('noindex, nofollow')));
      assert.ok(original.includes(Buffer.from(oldBanner)));
      assert.ok(released.includes(Buffer.from(newBanner)));
      assert.ok(!released.includes(Buffer.from(oldBanner)));
    } else if (!['_headers', 'robots.txt'].includes(path)) assert.deepEqual(released, original, path);
  }
});

test('M2A banner transform rejects missing, duplicate or structurally changed source banner', () => {
  for (const [language, preview, published] of [
    ['zh', '<p class="preview-label">本地預覽候選</p>', '<p class="preview-label">檔案在此瀏覽器處理</p>'],
    ['en', '<p class="preview-label">Local preview candidate</p>', '<p class="preview-label">Files are processed in this browser</p>'],
  ]) {
    const before = '<body><h1>Unchanged</h1>' + preview + '<p>Keep every other byte.</p></body>';
    assert.equal(releaseBody(before, language), before.replace(preview, published));
    for (const invalid of [before.replace(preview,''), before + preview, before.replace('preview-label','different-class')]) assert.throws(() => releaseBody(invalid, language), /SOURCE_BANNER_INVALID/);
  }
  assert.throws(() => releaseBody('anything','fr'), /HTML_LANGUAGE_INVALID/);
});

test('M2A arbitrary body difference with a matching altered manifest is still rejected', async () => {
  const root = await builtFixture();
  const path = join(root,'release-artifacts/site/index.html');
  const original = await readFile(path,'utf8');
  const changed = original.replace('先集中揀貨，再逐單核對','FAKE_ARBITRARY_BODY_CHANGE');
  assert.notEqual(changed,original);
  await setAssetAndManifest(root,'index.html',changed);
  const before = await inventory(join(root,'release-artifacts'));
  for(const mode of ['check','build']) await assert.rejects(runRelease(mode,{root}),/MANIFEST_MISMATCH/);
  assert.deepEqual(await inventory(join(root,'release-artifacts')),before);
});

test('M2A release checker rejects the preview or an arbitrary replacement banner', async () => {
  const root = await builtFixture();
  const original = await readFile(join(root,'release-artifacts/site/en/index.html'),'utf8');
  for (const text of ['Local preview candidate','FAKE_RELEASE_CLAIM']) {
    const changed = original.replace('Files are processed in this browser',text);
    assert.throws(()=>inspectReleaseHtml(changed,'en'),/HTML_BANNER_INVALID/);
    await setAssetAndManifest(root,'en/index.html',changed);
    await assert.rejects(runRelease('check',{root}),/MANIFEST_MISMATCH/);
  }
});

test('M2A Wrangler configuration is assets-only and exactly constrained to the authorized domain', async () => {
  const config = JSON.parse(await readFile(join(ROOT,'wrangler.jsonc'),'utf8'));
  assert.deepEqual(config,{
    name:'glossquote-order-picklist', compatibility_date:'2026-10-24',
    workers_dev:false, preview_urls:false, send_metrics:false,
    observability:{enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}},
    assets:{directory:'./release-artifacts/site',run_worker_first:false,html_handling:'none',not_found_handling:'none'},
    build:{command:'node scripts/release.mjs build'},
    routes:[{pattern:'picklist.glossquote.com',custom_domain:true}],
  });
});

test('robots, two-URL sitemap and privacy/security headers are exact release configurations', async () => {
  const root = await builtFixture(); const site = join(root, 'release-artifacts/site');
  assert.equal(await readFile(join(site, 'robots.txt'), 'utf8'), 'User-agent: *\nAllow: /\nSitemap: https://picklist.glossquote.com/sitemap.xml\n');
  const sitemap = await readFile(join(site, 'sitemap.xml'), 'utf8');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), ['https://picklist.glossquote.com/index.html', 'https://picklist.glossquote.com/en/index.html']);
  assert.equal((sitemap.match(/<url>/g) ?? []).length, 2); assert.doesNotMatch(sitemap, /lastmod|noindex/);
  const original = await readFile(join(root, 'public/_headers'), 'utf8');
  const headers = await readFile(join(site, '_headers'), 'utf8');
  assert.equal(headers, original.replace('X-Robots-Tag: noindex, nofollow', 'X-Robots-Tag: index, follow'));
  assert.match(headers, /connect-src 'none'/); assert.match(headers, /script-src 'self'/); assert.match(headers, /Referrer-Policy: no-referrer/);
});

test('legal rebuild is byte deterministic and reuses verified managed output', async () => {
  const root = await builtFixture(); const before = await inventory(join(root, 'release-artifacts'));
  const result = await runRelease('build', { root }); assert.equal(result.reused, true);
  assert.deepEqual(await inventory(join(root, 'release-artifacts')), before);
  await runRelease('check', { root });
  const second = await builtFixture();
  assert.deepEqual(await inventory(join(second, 'release-artifacts')), before);
  const text = await readFile(join(root, 'release-artifacts/manifest.json'), 'utf8');
  assert.doesNotMatch(text, /createdAt|timestamp|[A-Z]:\\/);
  assert.ok(!text.includes(root) && !text.includes(basename(root)));
});

test('check does not create missing output', async () => {
  const root = await fixture(); const before = await inventory(root);
  await assert.rejects(runRelease('check', { root }), /OUTPUT_MISSING/);
  assert.deepEqual(await inventory(root), before);
});

test('tampered output is rejected by check and build without overwriting the tamper', async () => {
  const root = await builtFixture(); const path = join(root, 'release-artifacts/site/js/app.js');
  await writeFile(path, 'FAKE_TAMPER'); const before = await inventory(join(root, 'release-artifacts'));
  for (const mode of ['check', 'build']) await assert.rejects(runRelease(mode, { root }), /OUTPUT_MISMATCH/);
  assert.deepEqual(await inventory(join(root, 'release-artifacts')), before);
});

test('manifest and runtime asset tampered together still fail independent expected-byte reconstruction', async () => {
  const root = await builtFixture();
  await setAssetAndManifest(root, 'js/app.js', 'FAKE_TAMPER_WITH_MATCHING_MANIFEST');
  const before = await inventory(join(root, 'release-artifacts'));
  for (const mode of ['check', 'build']) await assert.rejects(runRelease(mode, { root }), /MANIFEST_MISMATCH/);
  assert.deepEqual(await inventory(join(root, 'release-artifacts')), before);
});

test('wrong manifest origin, slug, schema, extra field and duplicate path are rejected', async () => {
  const root = await builtFixture(); const path = join(root, 'release-artifacts/manifest.json');
  const original = JSON.parse(await readFile(path, 'utf8'));
  const variations = [
    { ...original, origin: 'https://wrong.glossquote.com' }, { ...original, toolSlug: 'wrong' },
    { ...original, schemaVersion: 2 }, { ...original, unexpected: true }, { ...original, files: [...original.files, original.files[0]] },
  ];
  for (const manifest of variations) {
    const bytes = JSON.stringify(manifest, null, 2) + '\n'; await writeFile(path, bytes);
    await assert.rejects(runRelease('check', { root }), /MANIFEST_MISMATCH/);
    await assert.rejects(runRelease('build', { root }), /MANIFEST_MISMATCH/);
    assert.equal(await readFile(path, 'utf8'), bytes);
  }
});

test('extra output file, extra empty directory and extra sibling are rejected and preserved', async () => {
  for (const extra of ['site/extra.txt', 'site/unknown-directory/', 'unmanaged.txt']) {
    const root = await builtFixture(); const path = ownTarget(root, 'release-artifacts/' + extra);
    if (extra.endsWith('/')) await mkdir(path); else await writeFile(path, 'FAKE_USER_FILE');
    const before = await inventory(join(root, 'release-artifacts'));
    for (const mode of ['check', 'build']) await assert.rejects(runRelease(mode, { root }), /UNKNOWN_(?:FILE|DIRECTORY)/);
    assert.deepEqual(await inventory(join(root, 'release-artifacts')), before);
  }
});

test('missing site file and missing manifest are rejected without repairing output', async () => {
  for (const missing of ['site/js/app.js', 'manifest.json']) {
    const root = await builtFixture(); await unlink(ownTarget(root, 'release-artifacts/' + missing));
    const before = await inventory(join(root, 'release-artifacts'));
    for (const mode of ['check', 'build']) await assert.rejects(runRelease(mode, { root }), /MISSING_FILE/);
    assert.deepEqual(await inventory(join(root, 'release-artifacts')), before);
  }
});

test('source, site and manifest changed together cannot bypass reviewed source pins', async () => {
  const root = await builtFixture(); const path = join(root, 'public/js/app.js');
  const data = await readFile(path); data[0] ^= 1; await writeFile(path, data);
  await setAssetAndManifest(root, 'js/app.js', data);
  const manifestPath = join(root, 'release-artifacts/manifest.json'); const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const source = manifest.sourceFiles.find(entry => entry.path === 'js/app.js'); source.sha256 = hash(data);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const before = await inventory(root);
  for (const mode of ['check', 'build']) await assert.rejects(runRelease(mode, { root }), /SOURCE_CHANGED/);
  assert.deepEqual(await inventory(root), before);
});

test('missing, extra and unknown-directory source fails preflight before creating outputs', async () => {
  for (const variation of ['missing', 'extra', 'directory']) {
    const root = await fixture();
    if (variation === 'missing') await unlink(ownTarget(root, 'public/js/app.js'));
    if (variation === 'extra') await writeFile(join(root, 'public/extra.txt'), 'FAKE');
    if (variation === 'directory') await mkdir(join(root, 'public/extra-directory'));
    const before = await inventory(root);
    await assert.rejects(runRelease('build', { root }), /MISSING_FILE|UNKNOWN_(?:FILE|DIRECTORY)/);
    assert.deepEqual(await inventory(root), before);
  }
});

test('source and output junctions are rejected without traversing or writing targets', async () => {
  const source = await fixture();
  const sourceLink = ownTarget(source, 'public/unknown-junction');
  await symlink(join(source, 'public/js'), sourceLink, 'junction');
  try { await assert.rejects(runRelease('build', { root: source }), /SYMLINK_OR_JUNCTION_REJECTED/); }
  finally { await rmdir(sourceLink); } // Remove only this test-owned link, never recurse.
  const output = await fixture(); const target = ownTarget(output, 'owned-target'); await mkdir(target);
  const outputLink = ownTarget(output, 'release-artifacts');
  await symlink(target, outputLink, 'junction');
  try { await assert.rejects(runRelease('build', { root: output }), /DIRECTORY_OR_LINK_INVALID/); }
  finally { await rmdir(outputLink); }
  assert.deepEqual(await readdir(target), []);
});

test('unmanaged empty or occupied output root is never adopted or overwritten', async () => {
  for (const occupied of [false, true]) {
    const root = await fixture(); await mkdir(join(root, 'release-artifacts'));
    if (occupied) await writeFile(join(root, 'release-artifacts/user-note.txt'), 'FAKE_USER_NOTE');
    const before = await inventory(root);
    await assert.rejects(runRelease('build', { root }), /MISSING_FILE|UNKNOWN_FILE/);
    assert.deepEqual(await inventory(root), before);
  }
});

test('paired HTML+manifest SEO tampering fails byte reconstruction and semantic checks', async () => {
  const variations = [
    html => html.replace('rel="canonical" href="https://picklist.glossquote.com/index.html"', 'rel="canonical" href="https://wrong.glossquote.com/index.html"'),
    html => html.replace('hreflang="x-default" href="https://picklist.glossquote.com/index.html"', 'hreflang="x-default" href="https://picklist.glossquote.com/en/index.html"'),
    html => html.replace('name="robots" content="index, follow"', 'name="robots" content="noindex, nofollow"'),
  ];
  for (const mutate of variations) {
    const root = await builtFixture(); const original = await readFile(join(root, 'release-artifacts/site/index.html'), 'utf8');
    const changed = mutate(original); assert.notEqual(changed, original);
    assert.throws(() => inspectReleaseHtml(changed, 'zh'), /HTML_(?:CANONICAL|ALTERNATES|ROBOTS)_INVALID/);
    await setAssetAndManifest(root, 'index.html', changed);
    await assert.rejects(runRelease('check', { root }), /MANIFEST_MISMATCH/);
  }
});

test('CLI rejects absent, wrong and extra parameters in a task copy; valid modes work offline', async () => {
  const root = await fixture(); const script = join(root, 'scripts/release.mjs'); const before = await inventory(root);
  for (const args of [[], ['deploy'], ['build', 'extra'], ['check', '--origin', 'https://wrong.glossquote.com'], ['--origin=https://wrong.glossquote.com']]) {
    assert.throws(() => parseMode(args), /USAGE_EXPECTED_BUILD_OR_CHECK/);
    const run = spawnSync(process.execPath, [script, ...args], { cwd: root, shell: false, windowsHide: true, encoding: 'utf8' });
    assert.equal(run.status, 1); assert.match(run.stderr, /USAGE_EXPECTED_BUILD_OR_CHECK/);
    assert.deepEqual(await inventory(root), before);
  }
  for (const mode of ['build', 'check']) {
    const run = spawnSync(process.execPath, [script, mode], { cwd: root, shell: false, windowsHide: true, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /unpublished/);
  }
});
