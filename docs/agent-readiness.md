# Agent readiness

How this site presents itself to crawlers, AI assistants, and coding agents.

## Content policy

The site allows search engines and live AI input, and disallows AI training.
The policy is published as [Content Signals](https://contentsignals.org/) in
`robots.txt`, with one `Content-Signal:` line covering `search`, `ai-input`,
and `ai-train`.

`src/_data/contentPolicy.js` is the single source of truth. Change `aiTrain`
there (and the other fields if the policy changes); `robots.txt` is generated
from those values at build time. No template hard-codes the signal string.

## Generated files

All discovery files are produced by the Eleventy build, so there is no
hand-maintained URL list to keep in sync.

| File | Source | Notes |
| --- | --- | --- |
| `/robots.txt` | `src/robots.njk` + `src/_data/contentPolicy.js` | `User-agent: *`, a `Content-Signal:` line from the policy data, and an absolute `Sitemap:` line from `settings.baseUrl`. |
| `/sitemap.xml` | `src/sitemap.njk` | Every indexable HTML page in `collections.all`, with absolute `.org` URLs. Excludes `/admin/`, pages with `noindex` front matter, and non-HTML routes (`robots.txt`, `sitemap.xml`, `llms.txt`). A new page is listed automatically. |
| `/llms.txt` | `src/llms.njk` | Curated [llmstxt.org](https://llmstxt.org/) file: the site summary plus groups for Diseases, Owners, Breeders, Research, Databases, and About/Help. Links point at the Markdown twins. |
| `*.md` twins | Build step in `eleventy.config.js` | One Markdown representation per indexable HTML page, generated from the rendered `<main>` content. The HTML stays the single source of truth. |

`/llms-full.txt` is not a file. The edge adapter redirects it to `/index.md`,
the Markdown twin of the front page.

The `.md` links in `llms.txt` are written ahead of the twin generator and the
negotiation adapters, which land in separate tickets. Until those ship, the
links have no target.

## Changing a page

Write or edit the page once. The sitemap entry, the Markdown twin, and the
alternate links are generated from the rendered page, so no registration step
is needed. To keep a page out of the agent-facing surface, mark it `noindex`
or place it under `/admin/`.

## Release check

After deploying, verify the live site with these external scanners:

- <https://acceptmarkdown.com/> — checks `Accept: text/markdown` negotiation
  and Markdown alternates.
- <https://isitagentready.com/> — checks robots policy, sitemap, `llms.txt`,
  and the Markdown surface.

These are a release checklist step, not part of CI. CI runs the Playwright
suite, including the agent-readiness HTTP tests.
