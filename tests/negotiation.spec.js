// @ts-check
const { test, expect } = require('@playwright/test');

// The module is ESM so both the Netlify edge function and the local Node
// server can share it. Import it once; Playwright runs these tests in workers.
const negotiation = import('../lib/markdown-negotiation.mjs');

/** @type {Array<[string | undefined, 'markdown' | 'html' | 'not-acceptable', string]>} */
const acceptCases = [
  [undefined, 'html', 'no header behaves like */*'],
  ['', 'html', 'empty header behaves like */*'],
  ['   ', 'html', 'whitespace-only header behaves like */*'],
  ['*/*', 'html', 'wildcard prefers the designed HTML page'],
  ['text/html', 'html', 'explicit HTML'],
  ['text/markdown', 'markdown', 'explicit Markdown'],
  ['text/html, text/markdown;q=0.5', 'html', 'higher HTML q-value wins'],
  ['text/html;q=0.4, text/markdown;q=0.9', 'markdown', 'higher Markdown q-value wins'],
  ['text/markdown, text/html', 'markdown', 'equal weight with Markdown named explicitly resolves to Markdown'],
  ['text/html, text/markdown', 'markdown', 'order does not change the explicit tie'],
  ['text/markdown;q=0.5, text/html;q=0.5', 'markdown', 'explicit equal q-values resolve to Markdown'],
  ['text/*', 'html', 'text wildcard is not an explicit Markdown request'],
  ['text/*;q=0.9, text/html;q=0.5', 'markdown', 'most specific media range determines the q-value'],
  ['text/markdown;q=0.5, */*;q=0.9', 'html', 'wildcard beats a less specific Markdown q-value'],
  ['text/*, text/markdown', 'markdown', 'explicit Markdown wins the tie'],
  ['text/markdown; charset=utf-8', 'markdown', 'parameters other than q are ignored'],
  ['TEXT/MARKDOWN', 'markdown', 'media types are case-insensitive'],
  ['text/html;level=1', 'html', 'parameters other than q are ignored for HTML'],
  ['text/html;q=0, text/markdown', 'markdown', 'q=0 removes HTML from consideration'],
  ['text/markdown;q=0, */*', 'html', 'explicit q=0 on Markdown removes it even under a wildcard'],
  ['text/markdown;q=0', 'not-acceptable', 'only Markdown, excluded with q=0'],
  ['*/*;q=0', 'not-acceptable', 'all types excluded with q=0'],
  ['image/png', 'not-acceptable', 'unsupported type only'],
  ['application/json, image/png', 'not-acceptable', 'no supported type named'],
  ['text/plain', 'not-acceptable', 'other text types are not HTML or Markdown'],
  ['application/xhtml+xml', 'not-acceptable', 'does not substring-match html'],
];

test.describe('negotiate', () => {
  for (const [accept, expected, label] of acceptCases) {
    test(label, async () => {
      const { negotiate } = await negotiation;
      expect(negotiate(accept)).toBe(expected);
    });
  }
});

/** @type {Array<[string, string, string]>} */
const toMarkdownCases = [
  ['/', '/index.md', 'root maps to the index twin'],
  ['/index.html', '/index.md', 'rendered index HTML maps to the index twin'],
  ['/diseases', '/diseases.md', 'section landing maps to its twin'],
  ['/diseases/', '/diseases.md', 'trailing slash is tolerated'],
  ['/diseases/index.html', '/diseases.md', 'rendered section index maps to the section twin'],
  ['/diseases/hip-dysplasia-hd', '/diseases/hip-dysplasia-hd.md', 'article maps to its twin'],
  ['/diseases/hip-dysplasia-hd/', '/diseases/hip-dysplasia-hd.md', 'article trailing slash is tolerated'],
  ['/about.html', '/about.md', 'HTML-authored page maps to its twin'],
  ['/diseases/hip-dysplasia-hd.md', '/diseases/hip-dysplasia-hd.md', 'a twin is its own twin'],
];

test.describe('toMarkdownPath', () => {
  for (const [path, expected, label] of toMarkdownCases) {
    test(label, async () => {
      const { toMarkdownPath } = await negotiation;
      expect(toMarkdownPath(path)).toBe(expected);
    });
  }
});

/** @type {Array<[string, string, string]>} */
const toHtmlCases = [
  ['/index.md', '/', 'index twin maps back to the root'],
  ['/diseases.md', '/diseases', 'section twin maps back to its landing'],
  ['/diseases/hip-dysplasia-hd.md', '/diseases/hip-dysplasia-hd', 'article twin maps back to its article'],
  ['/diseases', '/diseases', 'an HTML path stays an HTML path'],
  ['/diseases/', '/diseases', 'an HTML trailing slash is normalised away'],
  ['/', '/', 'the root stays the root'],
];

test.describe('toHtmlPath', () => {
  for (const [path, expected, label] of toHtmlCases) {
    test(label, async () => {
      const { toHtmlPath } = await negotiation;
      expect(toHtmlPath(path)).toBe(expected);
    });
  }

  test('round-trips article and section paths', async () => {
    const { toHtmlPath, toMarkdownPath } = await negotiation;
    for (const path of ['/', '/diseases', '/diseases/hip-dysplasia-hd', '/about']) {
      expect(toHtmlPath(toMarkdownPath(path))).toBe(path);
    }
  });
});

/** @type {Array<[string, 'html' | 'markdown' | 'passthrough', string]>} */
const classifyCases = [
  ['/', 'html', 'root is content'],
  ['/diseases', 'html', 'section landing is content'],
  ['/diseases/hip-dysplasia-hd', 'html', 'article is content'],
  ['/about.html', 'html', 'HTML-authored page is content'],
  ['/diseases.md', 'markdown', 'a twin is a Markdown representation'],
  ['/index.md', 'markdown', 'the root twin is a Markdown representation'],
  ['/admin', 'passthrough', 'admin is excluded'],
  ['/admin/', 'passthrough', 'admin with a slash is excluded'],
  ['/admin/index.html', 'passthrough', 'admin pages are excluded'],
  ['/admin/config.yml', 'passthrough', 'admin assets are excluded'],
  ['/css/style.css', 'passthrough', 'stylesheet assets pass through'],
  ['/img/scarf-logo.png', 'passthrough', 'image assets pass through'],
  ['/files/akcchf02696pub.pdf', 'passthrough', 'document assets pass through'],
  ['/webfonts/inter.woff2', 'passthrough', 'font assets pass through'],
  ['/static/anything', 'passthrough', 'static passthrough copies are excluded'],
  ['/favicon.ico', 'passthrough', 'the favicon passes through'],
  ['/robots.txt', 'passthrough', 'robots.txt is not a content page'],
  ['/sitemap.xml', 'passthrough', 'the sitemap is not a content page'],
  ['/llms.txt', 'passthrough', 'llms.txt is served directly, not negotiated'],
  ['/llms-full.txt', 'passthrough', 'llms-full.txt is a redirect, not a content page'],
  ['/algolia.json', 'passthrough', 'the search index is not a content page'],
  ['/images-are-not-img', 'html', 'prefix matching does not leak into sibling names'],
];

test.describe('classifyPath', () => {
  for (const [path, expected, label] of classifyCases) {
    test(label, async () => {
      const { classifyPath } = await negotiation;
      expect(classifyPath(path)).toBe(expected);
    });
  }
});

test.describe('response header helpers', () => {
  test('content types include a charset', async () => {
    const { MARKDOWN_CONTENT_TYPE, HTML_CONTENT_TYPE } = await negotiation;
    expect(MARKDOWN_CONTENT_TYPE).toBe('text/markdown; charset=utf-8');
    expect(HTML_CONTENT_TYPE).toBe('text/html; charset=utf-8');
  });

  test('Vary names Accept', async () => {
    const { VARY_ACCEPT } = await negotiation;
    expect(VARY_ACCEPT).toBe('Accept');
  });

  test('an HTML page advertises its Markdown twin', async () => {
    const { linkAlternate } = await negotiation;
    expect(linkAlternate('/diseases/hip-dysplasia-hd')).toBe(
      '</diseases/hip-dysplasia-hd.md>; rel="alternate"; type="text/markdown"',
    );
  });

  test('the root advertises its Markdown twin', async () => {
    const { linkAlternate } = await negotiation;
    expect(linkAlternate('/')).toBe('</index.md>; rel="alternate"; type="text/markdown"');
  });

  test('a twin advertises the canonical HTML page', async () => {
    const { linkAlternate } = await negotiation;
    expect(linkAlternate('/diseases/hip-dysplasia-hd.md')).toBe(
      '</diseases/hip-dysplasia-hd>; rel="alternate"; type="text/html"',
    );
  });

  test('the root twin advertises the root page', async () => {
    const { linkAlternate } = await negotiation;
    expect(linkAlternate('/index.md')).toBe('</>; rel="alternate"; type="text/html"');
  });
});

test.describe('llms-full.txt policy', () => {
  test('the reserved path and redirect target live in the module', async () => {
    const { LLMS_FULL_PATH, LLMS_FULL_REDIRECT, llmsFullRedirectTarget } = await negotiation;
    expect(LLMS_FULL_PATH).toBe('/llms-full.txt');
    expect(LLMS_FULL_REDIRECT).toBe('/index.md');
    expect(llmsFullRedirectTarget()).toBe('/index.md');
  });
});
