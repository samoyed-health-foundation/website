/**
 * Content negotiation policy for the site's Markdown twins.
 *
 * This module is the single source of truth shared by the Netlify edge
 * function (production) and the local built-site server (tests). It is pure
 * and dependency-free: it only turns an `Accept` header and a URL path into
 * decisions, and never touches the filesystem, network, or framework APIs.
 *
 * The twin convention mirrors the build output:
 *   _site/index.html                     → /index.md
 *   _site/diseases/index.html            → /diseases.md
 *   _site/diseases/hip-dysplasia-hd/…    → /diseases/hip-dysplasia-hd.md
 */

const MARKDOWN_TYPE = 'text/markdown';
const HTML_TYPE = 'text/html';

/**
 * @typedef {'markdown' | 'html' | 'not-acceptable'} NegotiatedType
 * @typedef {{ type: string, subtype: string, q: number }} MediaRange
 */

/**
 * Parse an Accept header into media ranges.
 *
 * An absent, empty, or whitespace-only header is equivalent to the any-type
 * wildcard, per RFC 9110. Invalid ranges are ignored; if nothing parses, no
 * representation is acceptable.
 *
 * @param {string | null | undefined} accept
 * @returns {MediaRange[]}
 */
function parseAccept(accept) {
  if (typeof accept !== 'string' || accept.trim() === '') {
    return [{ type: '*', subtype: '*', q: 1 }];
  }

  return accept
    .split(',')
    .map(parseMediaRange)
    .filter((range) => range !== null);
}

/**
 * @param {string} part
 * @returns {MediaRange | null}
 */
function parseMediaRange(part) {
  const [range, ...parameters] = part.split(';');
  const mediaRange = range.trim().toLowerCase();
  const slash = mediaRange.indexOf('/');

  if (slash === -1) return null;

  const type = mediaRange.slice(0, slash).trim();
  const subtype = mediaRange.slice(slash + 1).trim();
  // Only a fully wildcard subtype may follow a wildcard type.
  if (!type || !subtype || (type === '*' && subtype !== '*')) return null;

  let q = 1;
  for (const parameter of parameters) {
    const [name, value] = parameter.split('=');
    if (name && name.trim().toLowerCase() === 'q') {
      q = parseQuality(value);
    }
  }

  return { type, subtype, q };
}

/**
 * @param {string | undefined} value
 * @returns {number} a q-value clamped to 0..1; unparseable values count as 0
 */
function parseQuality(value) {
  const q = Number.parseFloat(String(value ?? '').replace(/"/g, ''));
  if (!Number.isFinite(q)) return 0;
  return Math.min(1, Math.max(0, q));
}

/**
 * The quality assigned to `type/subtype` by the most specific matching range.
 * A type that no range matches is not acceptable (quality 0).
 *
 * @param {MediaRange[]} ranges
 * @param {string} type
 * @param {string} subtype
 * @returns {number}
 */
function qualityFor(ranges, type, subtype) {
  /** @type {{ specificity: number, q: number } | null} */
  let match = null;

  for (const range of ranges) {
    const typeMatches = range.type === '*' || range.type === type;
    const subtypeMatches = range.subtype === '*' || range.subtype === subtype;
    if (!typeMatches || !subtypeMatches) continue;

    const specificity = (range.type === '*' ? 0 : 1) + (range.subtype === '*' ? 0 : 1);
    if (match === null || specificity > match.specificity) {
      match = { specificity, q: range.q };
    }
  }

  return match === null ? 0 : match.q;
}

/**
 * Choose the representation for an Accept header.
 *
 * Rules, in order:
 *  1. Compare q-values; never substring-match the header.
 *  2. Neither type acceptable → `not-acceptable`.
 *  3. Higher q-value wins.
 *  4. An exact tie resolves to Markdown only when `text/markdown` was
 *     explicitly named by a range with a positive q-value; otherwise HTML.
 *
 * @param {string | null | undefined} accept
 * @returns {NegotiatedType}
 */
export function negotiate(accept) {
  const ranges = parseAccept(accept);
  const markdownQ = qualityFor(ranges, 'text', 'markdown');
  const htmlQ = qualityFor(ranges, 'text', 'html');

  if (markdownQ <= 0 && htmlQ <= 0) return 'not-acceptable';
  if (markdownQ > htmlQ) return 'markdown';
  if (htmlQ > markdownQ) return 'html';

  const markdownExplicit = ranges.some(
    (range) => range.type === 'text' && range.subtype === 'markdown' && range.q > 0,
  );

  return markdownExplicit ? 'markdown' : 'html';
}

/** `Content-Type` for a Markdown representation. */
export const MARKDOWN_CONTENT_TYPE = `${MARKDOWN_TYPE}; charset=utf-8`;

/** `Content-Type` for an HTML representation. */
export const HTML_CONTENT_TYPE = `${HTML_TYPE}; charset=utf-8`;

/** `Vary` header value for both representations. */
export const VARY_ACCEPT = 'Accept';

/** The reserved path that redirects to the Markdown front page. */
export const LLMS_FULL_PATH = '/llms-full.txt';

/** Where `/llms-full.txt` redirects: the Markdown front page. */
export const LLMS_FULL_REDIRECT = '/index.md';

/**
 * Where `/llms-full.txt` should redirect. A content site has no concatenated
 * corpus, so bulk ingestion starts from the Markdown front page.
 *
 * @returns {string}
 */
export function llmsFullRedirectTarget() {
  return LLMS_FULL_REDIRECT;
}

/**
 * Normalise a URL path for comparison. Inputs are expected to be pathnames
 * (query strings and fragments are the caller's concern). A missing leading
 * slash is added and trailing slashes are removed, except for the root.
 *
 * @param {string} path
 * @returns {string}
 */
function normalisePath(path) {
  let normalised = typeof path === 'string' ? path.trim() : '';
  if (normalised === '') return '/';
  if (!normalised.startsWith('/')) normalised = `/${normalised}`;
  if (normalised.length > 1) normalised = normalised.replace(/\/+$/, '');
  return normalised === '' ? '/' : normalised;
}

/**
 * Map an HTML page path to its Markdown twin.
 *
 * `/` → `/index.md`; `/diseases` → `/diseases.md`;
 * `/diseases/hip-dysplasia-hd` → `/diseases/hip-dysplasia-hd.md`. Rendered
 * `index.html` paths and trailing slashes are accepted, and a twin path is
 * returned unchanged.
 *
 * @param {string} path
 * @returns {string}
 */
export function toMarkdownPath(path) {
  let normalised = normalisePath(path);
  if (normalised.endsWith('.md')) return normalised;

  if (normalised.endsWith('/index.html')) {
    normalised = normalised.slice(0, -'/index.html'.length);
  } else if (normalised.endsWith('.html')) {
    normalised = normalised.slice(0, -'.html'.length);
  }

  if (normalised === '' || normalised === '/' || normalised === '/index') {
    return '/index.md';
  }

  return `${normalised}.md`;
}

/**
 * Map a Markdown twin path back to its canonical HTML page.
 *
 * `/index.md` → `/`; `/diseases.md` → `/diseases`;
 * `/diseases/hip-dysplasia-hd.md` → `/diseases/hip-dysplasia-hd`. Non-twin
 * paths are normalised and returned unchanged.
 *
 * @param {string} path
 * @returns {string}
 */
export function toHtmlPath(path) {
  const normalised = normalisePath(path);
  if (!normalised.endsWith('.md')) return normalised;

  const withoutExtension = normalised.slice(0, -'.md'.length);
  if (withoutExtension === '' || withoutExtension === '/index') return '/';

  return withoutExtension;
}

/** Route prefixes that are never content pages. */
const PASSTHROUGH_PREFIXES = ['/admin', '/css', '/img', '/files', '/webfonts', '/static'];

/** Fixed non-content routes served as their own files, never negotiated. */
const NON_CONTENT_FILES = new Set(['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt']);

/**
 * @param {string} path
 * @param {string} prefix
 * @returns {boolean}
 */
function hasPathPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Classify a path so both adapters agree on what gets a twin or negotiation.
 *
 * - `html`: an indexable content page; negotiate and advertise its twin.
 * - `markdown`: an explicit `.md` twin; serve it as Markdown without 406.
 * - `passthrough`: admin, binary/static assets, discovery files, and other
 *   non-content routes; leave the response untouched.
 *
 * This classifies by shape only. Whether a content page exists is the
 * adapter's concern (a missing page still produces the normal 404).
 *
 * @param {string} path
 * @returns {'html' | 'markdown' | 'passthrough'}
 */
export function classifyPath(path) {
  const normalised = normalisePath(path);

  if (NON_CONTENT_FILES.has(normalised)) return 'passthrough';
  if (PASSTHROUGH_PREFIXES.some((prefix) => hasPathPrefix(normalised, prefix))) {
    return 'passthrough';
  }

  const lastSegment = normalised.slice(normalised.lastIndexOf('/') + 1);
  if (lastSegment.endsWith('.md')) return 'markdown';
  if (lastSegment === '') return 'html';

  const dot = lastSegment.lastIndexOf('.');
  if (dot === -1) return 'html';

  const extension = lastSegment.slice(dot).toLowerCase();
  return extension === '.html' || extension === '.htm' ? 'html' : 'passthrough';
}

/**
 * The `Link` header value pointing at the other representation of a path:
 * HTML pages advertise their Markdown twin, and twins advertise the canonical
 * HTML page.
 *
 * @param {string} path
 * @returns {string}
 */
export function linkAlternate(path) {
  if (classifyPath(path) === 'markdown') {
    return `<${toHtmlPath(path)}>; rel="alternate"; type="${HTML_TYPE}"`;
  }

  return `<${toMarkdownPath(path)}>; rel="alternate"; type="${MARKDOWN_TYPE}"`;
}
