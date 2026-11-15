import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";
import markdownItTableOfContents from "markdown-it-table-of-contents";
import { load as loadYaml } from "js-yaml";

export default async function (eleventyConfig) {
  const { generateMarkdownTwins } = await import("./scripts/generate-markdown-twins.mjs");
  const negotiation = await import("./lib/markdown-negotiation.mjs");

  // https://www.11ty.dev/docs/ignores/#opt-out-of-using-.gitignore
  eleventyConfig.setUseGitIgnore(false);

  // Tailwind/PostCSS writes straight to _site, outside of Eleventy's watcher,
  // so tell the dev server to live reload when the generated CSS changes.
  eleventyConfig.setServerOptions({
    watch: ["./_site/css/style.css"],
  });

  // Use custom markdown-it instance so it can be set as a filter, too
  const markdownLib = markdownIt({ html: true })
    .use(markdownItAttrs)
    .use(markdownItAnchor)
    .use(markdownItTableOfContents);
  eleventyConfig.setLibrary("md", markdownLib);
  eleventyConfig.addFilter("markdown", (content) => {
    return markdownLib.render(content);
  });

  eleventyConfig.addFilter("toMarkdownPath", (url) => {
    return negotiation.toMarkdownPath(url);
  });

  // Custom shortcode for figure
  eleventyConfig.addShortcode("figure", function (srcs, title = "") {
    const imgTags = srcs.split(',')
      .map(src => src.trim())
      .map(src => `<img src="${src}" ${title ? `alt="${title}"` : ""}>`)
      .join("\n");

    return `
    <figure>
      ${imgTags}
      ${title ? `<figcaption>${title}</figcaption>` : ""}
    </figure>
  `;
  });

  // First path segment for a page URL, which equates to our website "sections"
  eleventyConfig.addFilter("firstPathSegment", (pageUrl) => {
    const parts = pageUrl.split('/').filter(part => part !== '');

    return parts.length <= 1 ? 'root' : parts[0];
  });

  // https://www.11ty.dev/docs/data-custom/#yaml
  eleventyConfig.addDataExtension("yaml", (contents) => loadYaml(contents));

  // https://www.11ty.dev/docs/copy/
  // Copy files to /_site
  eleventyConfig.addPassthroughCopy({
    "./src/admin/config.yml": "./admin/config.yml",
    "./node_modules/alpinejs/dist/cdn.min.js": "./static/js/alpine.js",
    "./node_modules/algoliasearch/dist/lite/builds/browser.umd.js":
      "./static/js/algoliasearch.js",
    "./node_modules/instantsearch.js/dist/instantsearch.production.min.js":
      "./static/js/instantsearch.js",
  });
  // Copy static folder to /_site
  eleventyConfig.addPassthroughCopy({ "src/static/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/static/files": "files" });
  eleventyConfig.addPassthroughCopy({ "src/static/img": "img" });
  eleventyConfig.addPassthroughCopy({ "src/static/webfonts": "webfonts" });
  // Copy favicon to /_site
  eleventyConfig.addPassthroughCopy("./src/favicon.ico");

  eleventyConfig.on("eleventy.after", async ({ directories }) => {
    try {
      await generateMarkdownTwins(directories.output);
    } catch (error) {
      console.error("Failed to generate Markdown twins:", error);
      throw error;
    }
  });

  return {
    // https://www.11ty.dev/docs/config/#input-directory
    dir: {
      input: "src",
    },
    templateFormats: ["html", "liquid", "md", "njk"],
    // https://www.11ty.dev/docs/config/#default-template-engine-for-html-files
    // Use nunjucks instead of liquid for .html files
    htmlTemplateEngine: "njk",
  };
};
