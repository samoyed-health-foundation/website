import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';
import * as gfmMod from 'turndown-plugin-gfm';

function walkHtmlFiles(root) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        results.push(full);
      }
    }
  }
  walk(root);
  return results;
}

function isNoindex(html) {
  return /<meta[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*noindex/i.test(html)
    || /<meta[^>]*content\s*=\s*["'][^"']*noindex[^"']*["'][^>]*name\s*=\s*["']robots["']/i.test(html);
}

function twinRelativePath(htmlRelativePath) {
  // htmlRelativePath uses posix separators, relative to output root
  const parts = htmlRelativePath.split('/');
  const base = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  if (base.toLowerCase() === 'index.html') {
    const dirName = dirParts.length ? dirParts[dirParts.length - 1] : '';
    if (!dirName || dirName === '.') return 'index.md';
    return dirParts.join('/') + '.md'.replace(/^/, ''); // placeholder
  }
  // non-index html file: strip .html add .md
  const name = base.replace(/\.html$/i, '.md');
  return [...dirParts, name].join('/');
}

// Fix twinRelativePath for index.html case properly
function twinRel(htmlRelativePath) {
  const posix = htmlRelativePath.split(path.sep).join('/');
  const parts = posix.split('/');
  const base = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  if (base.toLowerCase() === 'index.html') {
    if (dirParts.length === 0) return 'index.md';
    return dirParts.join('/') + '.md';
  }
  const name = base.replace(/\.html$/i, '.md');
  return [...dirParts, name].join('/');
}

function cleanHtml(html) {
  return html
    .replace(/<(script|style|form|nav|footer)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|form|nav|footer)\b[^>]*\/>/gi, '');
}

function convert(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const mainHtml = mainMatch ? mainMatch[1] : html;

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  td.use(gfmMod.gfm);
  td.addRule('figure', {
    filter: 'figure',
    replacement: (content, node) => {
      const imgs = Array.from(node.querySelectorAll('img'))
        .map((img) => `![${(img.getAttribute('alt') || '').trim()}](${(img.getAttribute('src') || '').trim()})`)
        .join('\n');
      const caption = node.querySelector('figcaption');
      const capText = caption ? caption.textContent.replace(/\s+/g, ' ').trim() : '';
      let out = '';
      if (imgs) out += `\n\n${imgs}\n`;
      if (capText) out += `\n${capText}\n`;
      return out ? `${out}\n` : '\n';
    },
  });

  let md = td.turndown(cleanHtml(mainHtml));
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  // Ensure a top-level heading exists
  if (title && !/^#\s/m.test(md)) {
    md = `# ${title}\n\n${md}`;
  }

  return md + '\n';
}

export async function generateMarkdownTwins(outputDir) {
  const root = path.resolve(outputDir);
  if (!fs.existsSync(root)) return;

  const htmlFiles = walkHtmlFiles(root);
  for (const file of htmlFiles) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    // skip admin area
    if (rel === 'admin' || rel.startsWith('admin/')) continue;

    const html = fs.readFileSync(file, 'utf8');
    if (isNoindex(html)) continue;

    const twinRelPath = twinRel(rel);
    const twinAbs = path.join(root, twinRelPath);
    const md = convert(html);
    fs.mkdirSync(path.dirname(twinAbs), { recursive: true });
    fs.writeFileSync(twinAbs, md, 'utf8');
  }
}

// CLI support
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate-markdown-twins.mjs');
if (isMain) {
  const dir = process.argv[2] || '_site';
  generateMarkdownTwins(dir).then(() => {
    console.log(`Generated Markdown twins in ${dir}`);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
