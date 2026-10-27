import { posix } from 'node:path';
import { ASSETS } from './assets.mjs';

export function auditAsset(path, source) {
  const errors = [];
  if (/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts|serviceWorker)\b|\bconsole\.|document\.cookie|new\s+(?:Function|Worker)\s*\(/.test(source)) errors.push('UNSAFE_API');
  const withoutHomes = source.replaceAll('https://glossquote.com/index.html', '').replaceAll('https://glossquote.com/en/index.html', '');
  if (/https?:\/\//i.test(withoutHomes) || (path.endsWith('.css') && /@import|\burl\s*\(/i.test(source))) errors.push('REMOTE_OR_CSS_RESOURCE');
  if (/\.(?:js|mjs)$/.test(path)) {
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      const target = posix.normalize(posix.join(posix.dirname(path), match[1]));
      if (!match[1].startsWith('.') || !ASSETS.includes(target)) errors.push('IMPORT_NOT_IN_PUBLIC');
    }
    if (/\bimport\s*\(/.test(source)) errors.push('DYNAMIC_IMPORT');
  }
  if (!path.endsWith('.html')) return errors;
  const en = path === 'en/index.html';
  const home = en ? 'https://glossquote.com/en/index.html' : 'https://glossquote.com/index.html';
  const title = en ? 'Order Pick List and Packing Lists | Group by SKU' : '訂單揀貨與裝箱單｜依 SKU 彙總訂單明細';
  const h1 = en ? 'Pick products together, then pack each order' : '先集中揀貨，再逐單核對';
  if (!source.includes(`<html lang="${en ? 'en' : 'zh-Hant'}">`) || !source.includes(`<title>${title}</title>`) || !source.includes(`<h1>${h1}</h1>`)) errors.push('DOCUMENT_IDENTITY');
  if (!/<meta name="description" content="[^"<>]{20,}">/.test(source)) errors.push('DESCRIPTION');
  if (!source.includes('<meta name="robots" content="noindex, nofollow">') || /rel="canonical"|sitemap/i.test(source)) errors.push('PREVIEW_INDEXING');
  if (/\son[a-z]+\s*=|<iframe|<object|<embed|<form\b|<style\b|style\s*=/i.test(source)) errors.push('INLINE_OR_ACTIVE_MARKUP');
  if ([...source.matchAll(/<script\b/g)].length !== 1 || !source.includes(`<script type="module" src="${en ? '../' : './'}js/app.js"></script>`)) errors.push('SCRIPT_CONTRACT');
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (ids.length !== new Set(ids).size) errors.push('DUPLICATE_ID');
  for (const match of source.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (value === home) continue;
    if (value.startsWith('#')) { if (!ids.includes(value.slice(1))) errors.push('ANCHOR_TARGET'); continue; }
    const target = posix.normalize(posix.join(posix.dirname(path), value));
    if (!ASSETS.includes(target) || !value.startsWith('.')) errors.push('LINK_NOT_IN_PUBLIC');
  }
  for (const match of source.matchAll(/\b(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)) {
    if (match[1].split(' ').some(id => !ids.includes(id))) errors.push('LABEL_REFERENCE');
  }
  if (!source.includes(`href="${home}"`) || !source.includes(`hreflang="${en ? 'zh-Hant' : 'en'}"`)) errors.push('LANGUAGE_HOME');
  for (const id of ['csv-file', 'map-orderId', 'map-sku', 'map-name', 'map-quantity']) if (!source.includes(`for="${id}"`)) errors.push('FIELD_LABEL');
  if (!source.includes('role="status"') || !source.includes('aria-live="polite"') || !source.includes('role="region"')) errors.push('ACCESSIBILITY_HOOKS');
  return [...new Set(errors)];
}
