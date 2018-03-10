# SCARF

The code for http://samoyedhealthfoundation.com/

## Overview

The repo was forked from Netlify's Hugo starter at
https://github.com/netlify/victor-hugo

It uses the Universal theme from Bootstrapious which was ported to a Hugo theme at
https://github.com/devcows/hugo-universal-theme

## Applying updates

You can subscribe to the GitHub repos listed above to be notified of any changes.

### Hugo starter updates

TODO

### Theme updates

To apply an update to the theme, just download the patch file from GitHub and apply it like so:

```bash
git apply \
  --directory=site/themes/hugo-universal-theme \
  ~/Downloads/f2f2c4fe4612ca8698692b547cbb6c960a1b2c82.patch
```

## Usage

### Prerequisites

```bash
# Install node and npm
brew install node

# Fetch project dependencies
npm install
```

### Development

```bash
# Compile site and start a development server to host it locally
npm run start
```

BrowserSync will automatically open a browser and refresh the page when stylesheets or content changes.

### Static build

To build a static version of the website inside the `/dist` folder, run:

```bash
npm run build
```

To get a preview of posts or articles not yet published, run:

```bash
npm run build-preview
```

## Structure

```
|--site                // Everything in here will be built with hugo
|  |--content          // Pages and collections - ask if you need extra pages
|  |--data             // YAML data files with any data for use in examples
|  |--layouts          // This is where all templates go
|  |  |--partials      // This is where includes live
|  |  |--index.html    // The index page
|  |--static           // Files in here ends up in the public folder
|--src                 // Files that will pass through the asset pipeline
|  |--css              // CSS files in the root of this folder will end up in /css/...
|  |--js               // app.js will be compiled to /app.js with babel
```

## Deploying to Netlify

Netlify will automatically deploy changes to the `master` branch.

You can also click this button:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://gitlab.com/modille/scarf-website)

## Enjoy!! 🐶
