export const ORIGIN = 'https://picklist.glossquote.com';
export const TOOL_SLUG = 'order-picklist';
export const URLS = Object.freeze({ zh: `${ORIGIN}/index.html`, en: `${ORIGIN}/en/index.html` });
export const RELEASE_BANNERS = Object.freeze({
  zh: Object.freeze({ preview: '<p class="preview-label">本地預覽候選</p>', published: '<p class="preview-label">檔案在此瀏覽器處理</p>' }),
  en: Object.freeze({ preview: '<p class="preview-label">Local preview candidate</p>', published: '<p class="preview-label">Files are processed in this browser</p>' }),
});

function requireValue(condition, code) { if (!condition) throw new Error(code); }

export function releaseBody(sourceBody, language) {
  requireValue(Object.hasOwn(RELEASE_BANNERS, language), 'HTML_LANGUAGE_INVALID');
  const banner = RELEASE_BANNERS[language];
  requireValue(sourceBody.split(banner.preview).length === 2, 'SOURCE_BANNER_INVALID');
  return sourceBody.replace(banner.preview, banner.published);
}

export function splitHead(html) {
  const starts = [...html.matchAll(/<head\s*>/gi)];
  const ends = [...html.matchAll(/<\/head\s*>/gi)];
  requireValue(starts.length === 1 && ends.length === 1 && ends[0].index > starts[0].index, 'HTML_HEAD_INVALID');
  const start = starts[0].index + starts[0][0].length;
  const end = ends[0].index;
  return { before: html.slice(0, start), head: html.slice(start, end), after: html.slice(end) };
}

export function readHeadTags(html) {
  const { head } = splitHead(html);
  return [...head.matchAll(/<(meta|link)\b([^>]*)>/gi)].map(match => {
    const attrs = {};
    let tail = match[2];
    while (tail.trim() !== '') {
      const attr = /^\s+([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tail);
      requireValue(attr && !Object.hasOwn(attrs, attr[1].toLowerCase()), 'HTML_ATTRIBUTE_INVALID');
      attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3];
      tail = tail.slice(attr[0].length);
    }
    return { tag: match[1].toLowerCase(), attrs, raw: match[0] };
  });
}

export function inspectReleaseHtml(html, language) {
  requireValue(language === 'zh' || language === 'en', 'HTML_LANGUAGE_INVALID');
  const tags = readHeadTags(html);
  const canonical = tags.filter(entry => entry.tag === 'link' && entry.attrs.rel === 'canonical');
  requireValue(canonical.length === 1 && canonical[0].attrs.href === URLS[language], 'HTML_CANONICAL_INVALID');
  const alternate = tags.filter(entry => entry.tag === 'link' && entry.attrs.rel === 'alternate' && Object.hasOwn(entry.attrs, 'hreflang'));
  requireValue(alternate.length === 3, 'HTML_ALTERNATES_INVALID');
  const expected = { 'zh-Hant': URLS.zh, en: URLS.en, 'x-default': URLS.zh };
  requireValue(new Set(alternate.map(entry => entry.attrs.hreflang)).size === 3, 'HTML_ALTERNATES_INVALID');
  for (const entry of alternate) requireValue(Object.hasOwn(expected, entry.attrs.hreflang) && expected[entry.attrs.hreflang] === entry.attrs.href, 'HTML_ALTERNATES_INVALID');
  const robots = tags.filter(entry => entry.tag === 'meta' && entry.attrs.name === 'robots');
  requireValue(robots.length === 1 && robots[0].attrs.content === 'index, follow', 'HTML_ROBOTS_INVALID');
  requireValue(new RegExp(`<html lang="${language === 'en' ? 'en' : 'zh-Hant'}">`).test(html), 'HTML_LANGUAGE_INVALID');
  const body = splitHead(html).after;
  requireValue(body.split(RELEASE_BANNERS[language].published).length === 2 && !body.includes(RELEASE_BANNERS[language].preview), 'HTML_BANNER_INVALID');
  return { canonical: canonical[0].attrs.href, alternates: Object.fromEntries(alternate.map(entry => [entry.attrs.hreflang, entry.attrs.href])), robots: robots[0].attrs.content };
}

export function releaseHtml(source, language) {
  const parts = splitHead(source);
  const sourceTags = readHeadTags(source);
  const robots = sourceTags.filter(entry => entry.tag === 'meta' && entry.attrs.name === 'robots');
  requireValue(robots.length === 1 && robots[0].attrs.content === 'noindex, nofollow', 'SOURCE_PREVIEW_ROBOTS_INVALID');
  let head = parts.head.replace(robots[0].raw, robots[0].raw.replace('content="noindex, nofollow"', 'content="index, follow"'));
  for (const entry of sourceTags) {
    if (entry.tag === 'link' && (entry.attrs.rel === 'canonical' || (entry.attrs.rel === 'alternate' && Object.hasOwn(entry.attrs, 'hreflang')))) head = head.replace(entry.raw, '');
  }
  head += `  <link rel="canonical" href="${URLS[language]}">\n`;
  head += `  <link rel="alternate" hreflang="zh-Hant" href="${URLS.zh}">\n`;
  head += `  <link rel="alternate" hreflang="en" href="${URLS.en}">\n`;
  head += `  <link rel="alternate" hreflang="x-default" href="${URLS.zh}">\n`;
  const html = parts.before + head + releaseBody(parts.after, language);
  inspectReleaseHtml(html, language);
  return html;
}
