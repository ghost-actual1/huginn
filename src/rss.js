/**
 * RSS 2.0 / Atom parser.
 * =====================================================================
 * Deliberately regex-based: React Native has no DOMParser, and pulling in a
 * full XML parser for feeds is not worth the bundle. Handles CDATA, both feed
 * shapes, and the entity soup that real feeds emit.
 */

export const MAX_ARTICLES_PER_SOURCE = 20;

export function parseRSS(xmlText, sourceId, limit = MAX_ARTICLES_PER_SOURCE) {
  const items = [];
  const push = (item, index) => {
    const title = extractTag(item, 'title');
    if (!title) return false;
    const link = extractTag(item, 'link') || extractAttr(item, 'link', 'href');
    const desc = extractTag(item, 'description') || extractTag(item, 'summary') || extractTag(item, 'content');
    const date = extractTag(item, 'pubDate') || extractTag(item, 'published') || extractTag(item, 'updated');
    const category = extractTag(item, 'category') || extractAttr(item, 'category', 'term');
    items.push({
      id: `${sourceId}-${index}-${Date.now()}`,
      sourceId,
      title: decodeEntities(title),
      link: link || '',
      description: (desc || '').replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
      pubDate: date ? new Date(decodeEntities(date)) : new Date(),
      category: category || '',
    });
    return true;
  };

  const blocks = (tag) => {
    const out = [];
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
    let m;
    while ((m = re.exec(xmlText)) !== null) out.push(m[1]);
    return out;
  };

  let blocksFound = blocks('item');
  if (blocksFound.length === 0) blocksFound = blocks('entry');

  for (let i = 0; i < blocksFound.length && items.length < limit; i++) {
    push(blocksFound[i], i);
  }

  return items;
}

export function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdata);
  if (cdataMatch) return cdataMatch[1].trim();
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

export function extractAttr(xml, tag, attr) {
  const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018',
  rdquo: '\u201d', ldquo: '\u201c', eacute: '\u00e9', egrave: '\u00e8', agrave: '\u00e0',
  ccedil: '\u00e7', uuml: '\u00fc', ouml: '\u00f6', auml: '\u00e4', szlig: '\u00df',
};

export function decodeEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (whole, name) => (NAMED[name] !== undefined ? NAMED[name] : whole))
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .trim();
}

function safeChar(code) {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return '';
  return String.fromCodePoint(code);
}
