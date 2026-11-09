# PR body template

Copy the block below to `/tmp/pr-body.md`, fill every placeholder, then
`gh pr create --draft --body-file /tmp/pr-body.md`.

<!--
Author notes, not copied into the PR:

- N is the total failure count (`totalErrors`); U is `uniqueUrls` when they differ.
- One row per unique old -> new URL, not one row per page.
- Groups are publishers of the new URL, alphabetical. Local assets go last.
- Page(s): every entry in `sources` (fall back to `pageSources`), sorted, in backticks,
  joined with `<br>`.
- Old links are written as bare `<url>` autolinks so they stay clickable even with `?` and
  parentheses. New links too.
- For a local asset, the old link is the GitHub blob URL on master with the path exactly as
  the source wrote it (a 404 is the evidence); the new link is the blob URL with the real
  filename. Use the repo's `master` branch.
- Add a row to "Removed links" for every href dropped instead of replaced.
- Say so next to any 403 replacement if only a bot wall answered.
-->

```markdown
# Fix dead links flagged by the link check workflow

Resolves the <N> failures in [run <run-id>](<run-url>).

Where the original publisher still hosts the same content under a new URL, the link now
points at the live page. Where the page is gone (or the host now blocks automated checks),
the link uses the `web.archive.org` snapshot that the link checker suggested. <Local asset
sentence, only if any: "Three local asset links were also corrected to match the real
filenames in `src/static/files/`.">

## Before / after links

Click the old link to confirm how it fails, then the new link to confirm the replacement is
the right content. Page names are source paths; the rendered URL is the same without `src/`
and `.md`.

### <Publisher name>

| Page(s) | Old link | New link |
| --- | --- | --- |
| `src/path/to/page.md`<br>`src/other/page.md` | <http://old.example/page> | <https://new.example/page> |

### Local assets

| Page(s) | Old link | New link |
| --- | --- | --- |
| `src/path/to/page.md` | <https://github.com/<owner>/<repo>/blob/master/src/static/files/Wrong-Case.pdf> | <https://github.com/<owner>/<repo>/blob/master/src/static/files/real-case.pdf> |

<!-- only when a link was dropped instead of replaced -->
## Removed links

These pages are gone and no capture exists, so the href was removed and the text kept.

| Page(s) | Old link |
| --- | --- |
| `src/path/to/page.md` | <http://gone.example/page> |
```

## Example row groups

The run that produced this skill had these shapes; reuse them as models.

- Publisher still serves the file at a new path: `akcchf.org/research/research-portfolio/0706.html`
  → `akcchf.org/grant-directory/00615b/`.
- Publisher rebuilt one page for many old paths: five WSU pet-health topics all moved under
  `hospital.vetmed.wsu.edu`, each old link still pairing with its own new post.
- Page gone, snapshot used: `akcchf.org/.../The-Dominant-Dog-07-1997.pdf` →
  `https://web.archive.org/web/20241214034658/https://www.akcchf.org/.../The-Dominant-Dog-07-1997.pdf`.
- Filename case: `files/SCARF_Donation_Form.pdf` → `files/scarf_donation_form.pdf`.
