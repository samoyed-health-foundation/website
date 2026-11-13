# SCARF

## Technologies used

- Eleventy (static site generator)
- Decap CMS (content management system with a Git workflow)
- Tailwind (CSS framework), Flowbite (Tailwind component library)
- Alpine.js (lightweight JavaScript framework -- used for the nav menu)

## Getting Started

Install asdf version manager: <https://asdf-vm.com/guide/getting-started.html>

```bash
asdf install

npm install

npm run build

npx playwright install --with-deps

npx playwright test

npm start
```

## Agent readiness

See [docs/agent-readiness.md](docs/agent-readiness.md) for the crawler content
policy, the generated discovery files (`robots.txt`, `sitemap.xml`,
`llms.txt`, Markdown twins), and the post-deploy release check.

## Updating Playwright snapshots

```bash
npx playwright test --update-snapshots=changed
CI=true npx playwright test navbar --update-snapshots=changed
```

## Enjoy!! 🐶
