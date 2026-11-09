---
name: Fix link check run
description: Fix the dead links reported by a failing Links (lychee) workflow run and open a draft PR with a before/after link table. Use when given a GitHub Actions run URL that failed the Links / check-links job, or asked to fix dead links from a link check.
---

# Fix link check run

Input: the URL of a failed run of the `Links` workflow (`.github/workflows/links.yml`), e.g.
`https://github.com/samoyed-health-foundation/website/actions/runs/42507915882`.
Output: a draft PR whose description pairs every old link with a verified replacement.

Work on a fresh branch off `origin/master`. The run was built from an older commit and
master may already contain some of the fixes.

## 1. Get the failures

Extract the run ID from the URL, then:

```sh
gh run view <run-id> --log-failed > /tmp/linkcheck.log   # add --log if --log-failed is thin
grep -cE '\* \[([0-9]{3}|ERROR|TIMEOUT)\]' /tmp/linkcheck.log
```

Lychee lists failures as `* [<status>] <url> (at line:col) | <reason>`, where the status is an
HTTP code, `ERROR`, or `TIMEOUT`.

**Done when** the log has `### Errors in _site/...` sections and at least one `* [...]` line.

## 2. Build the inventory

```sh
git fetch origin
git switch -c fix/dead-links-<yyyy-mm> origin/master
node .agents/skills/fix-link-check-run/scripts/collect-failures.mjs /tmp/linkcheck.log > /tmp/inventory.json
```

Read the JSON. For each failure:

- `sources` — file and line numbers to edit. Empty means master already fixed it: drop the row.
- `pageSources` — pages that reported the link; use for the PR's Page(s) column.
- `local.sourceExists` — false when a relative link misses its built file. `local.actual` is
  the real asset name (wrong case or extension) and `local.page` a source page with that slug.

Lychee reports the rendered `_site/` page, so the link can live in a layout or include.
When `sources` is empty but `pageSources` is not, grep those pages for the URL.

**Done when** every URL you will fix has a `sources` or `pageSources` entry, and every
URL with neither is recorded as already fixed upstream (keep it out of the PR).

## 3. Pick replacements

For each dead URL, in order:

1. **Live page.** Search the publisher's site for where the content moved. Prefer the
   current page over a snapshot.
2. **Wayback snapshot.** If the page is gone:
   ```sh
   curl -s 'https://archive.org/wayback/available?url=<old-url>' | jq -r '.archived_snapshots.closest.url'
   ```
   Write it as `https://web.archive.org/web/<timestamp>/<old-url>`. Never `http://web.archive.org`.
3. **Unlink.** If no capture exists and the host has no replacement, drop the href and keep
   the link text. List it under "Removed links" in the PR.

Add a narrowly anchored pattern to `.lycheeignore` only when the page is valid but the host
reliably blocks automated requests.

Verify every candidate the way CI will:

```sh
curl -sSL -o /dev/null -w '%{http_code} %{url_effective}\n' \
  -A 'Mozilla/5.0 (compatible; link check)' <new-url>
```

Accepted: `200-204`, `403`, `429` — CI's `--accept` list. A `403` means a bot wall: the check
passes, but confirm in a browser that a reader reaches the content.

Local links: point the reference at `local.actual`, or use the slug of `local.page`. Leave the
file or page name alone.

**Done when** every old URL has one new URL returning an accepted status, and no candidate
returns 404 or 410.

## 4. Replace

Edit every occurrence in every `sources` file, keeping the link text. An old URL that survives
only inside a `web.archive.org` href, or as link text, is already fixed.

**Done when** the next step's re-run of the inventory reports no `sources` hits.

## 5. Build and check

```sh
npm ci                       # first run in a checkout only
npm run build
lychee --cache --max-cache-age 1d --no-progress \
  --accept '200..=204, 403, 429' --suggest \
  --root-dir "$(pwd)/_site" _site/
```

`lychee` is a Rust binary: `brew install lychee` on macOS, otherwise take the release binary
for this platform. If HTTP checks are unavailable, curl every changed URL and say so in the PR.

Re-run the inventory against the fixed tree — it must find no surviving references:

```sh
node .agents/skills/fix-link-check-run/scripts/collect-failures.mjs /tmp/linkcheck.log > /tmp/inventory-after.json
```

**Done when** the build exits 0, no inventory URL fails, and `inventory-after.json` has an
empty `sources` for every failure. Re-check a timeout, reset, or 5xx once before calling it
fixed — that is a flaky check, not a dead link.

## 6. Commit and open the draft PR

```sh
git add -A
git commit -m 'Fix dead links flagged by the link check workflow'
git push -u origin fix/dead-links-<yyyy-mm>
```

Write the body from `references/pr-body-template.md`: one row per unique old → new URL,
grouped by publisher, with every affected source path in the Page(s) cell. Then:

```sh
gh pr create --draft --base master \
  --title 'Fix dead links flagged by the link check workflow' \
  --body-file /tmp/pr-body.md
```

**Done when** the PR is a draft, its description links the run, and each row's old link fails
while its new link resolves (bot walls noted). Hand the URL back; do not mark ready or merge
unless asked.

## Reference

- `scripts/collect-failures.mjs` — log → inventory JSON.
- `references/pr-body-template.md` — PR description skeleton.
- CI definition: `.github/workflows/links.yml`. Ignore list: `.lycheeignore`.
