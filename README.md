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

npx playwright test

npm start
```

## Updating Playwright snapshots

```bash
npx playwright test --update-snapshots
CI=true npx playwright test navbar --update-snapshots
```

## Enjoy!! 🐶
