// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'http://127.0.0.1:8081';
const negotiationPromise = import('../lib/markdown-negotiation.mjs');

function isMarkdown(ct) {
  return /text\/markdown/i.test(ct || '');
}
function isHtml(ct) {
  return /text\/html/i.test(ct || '');
}

test.describe('agent readiness (built site)', () => {
  test('robots.txt is served as text with content signals and sitemap', async ({ request }) => {
    const res = await request.get(`${BASE}/robots.txt`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('search=yes');
    expect(body).toContain('ai-input=yes');
    expect(body).toContain('ai-train=no');
    expect(body).toContain('https://www.samoyedhealthfoundation.org/sitemap.xml');
  });

  test('sitemap.xml is XML, includes pages, excludes admin', async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('<?xml');
    expect(body).toContain('<urlset');
    expect(body).toContain('</urlset>');
    expect(body).toContain('https://www.samoyedhealthfoundation.org/');
    expect(body).toContain('https://www.samoyedhealthfoundation.org/diseases');
    expect(body).toContain('hip-dysplasia-hd');
    expect(body).not.toContain('/admin');
  });

  test('llms.txt is Markdown and covers sections with .md links', async ({ request }) => {
    const res = await request.get(`${BASE}/llms.txt`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('# SCARF');
    for (const section of ['## Diseases', '## Owners', '## Breeders', '## Research', '## Databases', '## About and help']) {
      expect(body).toContain(section);
    }
    expect(body).toMatch(/\.md/);
  });

  test('llms-full.txt redirects to the Markdown front page', async ({ request }) => {
    const res = await request.get(`${BASE}/llms-full.txt`);
    expect(res.status()).toBe(200);
    expect(res.url()).toContain('/index.md');
    expect(res.headers()['content-type']).toContain('text/markdown');
  });

  test('Markdown twin for the root page', async ({ request }) => {
    const res = await request.get(`${BASE}/index.md`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('Samoyed Club of America Education and Research Foundation');
    expect(body).not.toMatch(/<nav|<footer|<script|<form/i);
  });

  test('Markdown twin for a list page', async ({ request }) => {
    const res = await request.get(`${BASE}/owners.md`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('Owners');
    expect(body).not.toMatch(/<nav|<footer|<script|<form/i);
  });

  test('Markdown twin for a disease article preserves figure', async ({ request }) => {
    const res = await request.get(`${BASE}/diseases/sebaceous-adenitis-sa-living-with.md`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('Living With Sebaceous Adenitis');
    expect(body).toContain('/img/1a.jpg');
    expect(body).toContain('Photo 1 of 4: the dog\'s affected coat and skin');
    expect(body).not.toMatch(/<nav|<footer|<script|<form/i);
  });

  test('Markdown twin for an HTML-authored page', async ({ request }) => {
    const res = await request.get(`${BASE}/about.md`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('About SCARF');
    expect(body).not.toMatch(/<nav|<footer|<script|<form/i);
  });

  test('every sitemap URL has a Markdown twin (sampled)', async ({ request }) => {
    const { toMarkdownPath } = await negotiationPromise;
    const sitemapRes = await request.get(`${BASE}/sitemap.xml`);
    const xml = await sitemapRes.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    // sample up to 25
    const sample = urls.filter((_, i) => i % Math.max(1, Math.floor(urls.length / 25)) === 0).slice(0, 25);
    for (const u of sample) {
      const path = new URL(u).pathname;
      const twin = toMarkdownPath(path);
      const res = await request.get(`${BASE}${twin}`);
      expect(res.status(), `twin ${twin} for ${path}`).toBe(200);
    }
  });

  test('Accept negotiation matrix', async ({ request }) => {
    const url = `${BASE}/diseases/hip-dysplasia-hd`;
    const cases = [
      { accept: 'text/markdown', type: 'markdown' },
      { accept: 'text/html, text/markdown;q=0.5', type: 'html' },
      { accept: 'text/markdown, text/html', type: 'markdown' },
      { accept: '*/*', type: 'html' },
    ];
    for (const c of cases) {
      const res = await request.get(url, { headers: { Accept: c.accept } });
      expect(res.status()).toBe(200);
      const ct = res.headers()['content-type'] || '';
      if (c.type === 'markdown') expect(ct).toContain('text/markdown');
      else expect(ct).toContain('text/html');
      expect(res.headers()['vary']).toContain('Accept');
    }
    for (const accept of ['image/png', 'application/json']) {
      const res = await request.get(url, { headers: { Accept: accept } });
      expect(res.status()).toBe(406);
    }
  });

  test('HTML carries Link header and head alternate', async ({ request }) => {
    const res = await request.get(`${BASE}/diseases/hip-dysplasia-hd`, { headers: { Accept: 'text/html' } });
    expect(res.status()).toBe(200);
    const link = res.headers()['link'] || '';
    expect(link).toContain('/diseases/hip-dysplasia-hd.md');
    expect(link).toContain('rel="alternate"');
    expect(link).toContain('type="text/markdown"');
    const body = await res.text();
    expect(body).toMatch(/<link rel="alternate" type="text\/markdown"[^>]*href="\/diseases\/hip-dysplasia-hd\.md"/);
  });

  test('Markdown twin carries Link back to HTML', async ({ request }) => {
    const res = await request.get(`${BASE}/diseases/hip-dysplasia-hd.md`);
    expect(res.status()).toBe(200);
    const link = res.headers()['link'] || '';
    expect(link).toContain('/diseases/hip-dysplasia-hd');
    expect(link).toContain('rel="alternate"');
    expect(link).toContain('type="text/html"');
  });

  test('Vary: Accept on both representations', async ({ request }) => {
    const htmlRes = await request.get(`${BASE}/diseases/hip-dysplasia-hd`, { headers: { Accept: 'text/html' } });
    const mdRes = await request.get(`${BASE}/diseases/hip-dysplasia-hd.md`);
    expect(htmlRes.headers()['vary']).toContain('Accept');
    expect(mdRes.headers()['vary']).toContain('Accept');
  });

  test('semantics: one h1, main landmark, alt text, no skipped headings', async ({ request }) => {
    const pages = ['/', '/about', '/contact-us', '/diseases/hip-dysplasia-hd', '/owners', '/diseases'];
    for (const p of pages) {
      const res = await request.get(`${BASE}${p}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const h1s = html.match(/<h1\b/gi) || [];
      expect(h1s.length, `${p} h1 count`).toBe(1);
      expect(html, `${p} main landmark`).toMatch(/<main\b/i);
      // images have alt
      const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
      for (const img of imgs) {
        expect(img, `${p} img missing alt`).toMatch(/\salt\s*=\s*["'][^"']+["']/i);
      }
      // heading levels no skips
      const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
      expect(headings.length).toBeGreaterThan(0);
      expect(headings[0]).toBe(1);
      let prev = headings[0];
      for (const lvl of headings.slice(1)) {
        expect(lvl - prev, `${p} heading skip ${prev}->${lvl}`).toBeLessThanOrEqual(1);
        // allow any decrease
        prev = lvl;
      }
    }
  });
});

// Note on .com -> .org redirect: Netlify's wildcard 301s in netlify.toml already
// cover *.md paths (the `from = "https://...com/*"` splat includes .md). This is
// a platform-level behaviour that cannot be reproduced by the local server, so it
// is verified as a manual release check after deployment rather than in CI.
