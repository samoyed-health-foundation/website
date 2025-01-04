import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";
import markdownItTableOfContents from "markdown-it-table-of-contents";
import yaml from "js-yaml";
import { DateTime } from "luxon";

export default async function (eleventyConfig) {
  // https://www.11ty.dev/docs/ignores/#opt-out-of-using-.gitignore
  eleventyConfig.setUseGitIgnore(false);

  // Use custom markdown-it instance so it can be set as a filter, too
  const markdownLib = markdownIt({ html: true })
    .use(markdownItAttrs)
    .use(markdownItAnchor)
    .use(markdownItTableOfContents);
  eleventyConfig.setLibrary("md", markdownLib);
  eleventyConfig.addFilter("markdown", (content) => {
    return markdownLib.render(content);
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

  // Human-readable dates
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toLocaleString(
      DateTime.DATETIME_FULL_WITH_SECONDS
    );
  });

  // First path segment for a page URL, which equates to our website "sections"
  eleventyConfig.addFilter("firstPathSegment", (pageUrl) => {
    const parts = pageUrl.split('/').filter(part => part !== '');

    return parts.length <= 1 ? 'root' : parts[0];
  });

  // https://www.11ty.dev/docs/data-custom/#yaml
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // https://www.11ty.dev/docs/copy/
  // Copy files to /_site
  eleventyConfig.addPassthroughCopy({
    "./src/admin/config.yml": "./admin/config.yml",
    "./node_modules/alpinejs/dist/cdn.min.js": "./static/js/alpine.js",
  });
  // Copy static folder to /_site
  eleventyConfig.addPassthroughCopy({ "src/static/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/static/files": "files" });
  eleventyConfig.addPassthroughCopy({ "src/static/img": "img" });
  eleventyConfig.addPassthroughCopy({ "src/static/webfonts": "webfonts" });
  // Copy favicon to /_site
  eleventyConfig.addPassthroughCopy("./src/favicon.ico");

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
