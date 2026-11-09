#!/usr/bin/env node
// Extract failed links from a `Links` (lychee) workflow log and attribute each
// one to the source files that contain it.
//
//   node collect-failures.mjs <log-file> [repo-root]
//
// Prints JSON on stdout. Stdout stays clean so it can be redirected to a file.

import fs from "node:fs";
import path from "node:path";

const [logPath, rootArg] = process.argv.slice(2);

if (!logPath) {
  console.error("usage: collect-failures.mjs <log-file> [repo-root]");
  process.exit(1);
}

const root = path.resolve(rootArg ?? process.cwd());

// Actions log lines look like:
//   check-links\tUNKNOWN STEP\t2026-11-08T18:05:34.5645348Z <message>
const stripPrefix = (line) =>
  line.replace(/^[^\t]*\t[^\t]*\t\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/, "");

const PAGE_RE = /^### Errors in (.+)$/;
// Lychee lists each broken link as "* [<status>] <url> (at line:col) | <reason>",
// where <status> is an HTTP code, ERROR, or TIMEOUT.
const ERROR_RE = /^\* \[([^\]]+)\] <(.+?)>(?: \(at \d+:\d+\))? \| (.*)$/;

const failures = new Map();
let totalErrors = 0;
let page = null;

for (const rawLine of fs.readFileSync(logPath, "utf8").split(/\r?\n/)) {
  const line = stripPrefix(rawLine);
  const pageMatch = PAGE_RE.exec(line);
  if (pageMatch) {
    page = pageMatch[1].trim();
    continue;
  }
  const errorMatch = ERROR_RE.exec(line);
  if (!errorMatch) continue;

  totalErrors += 1;
  const [, status, url, reason] = errorMatch;
  const failure = failures.get(url) ?? {
    url,
    status,
    kind: url.startsWith("file://") ? "local-file" : "external",
    pages: [],
    sources: {},
  };
  if (page && !failure.pages.includes(page)) failure.pages.push(page);
  failures.set(url, failure);
}

const SOURCE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".html",
  ".njk",
  ".liquid",
  ".yaml",
  ".yml",
  ".json",
  ".js",
  ".txt",
]);

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) found.push(full);
  }
  return found;
}

const sourceFiles = walk(path.join(root, "src"));
const contents = new Map(
  sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8").split(/\r?\n/)]),
);

// Rendered page -> the source files that can produce it.
function sourceCandidates(pagePath) {
  const rel = pagePath.replace(/^_site\//, "").replace(/index\.html$/, "");
  const base = rel.replace(/\/$/, "");
  if (!base) return ["src/index.html"];
  return [
    `src/${base}.md`,
    `src/${base}.markdown`,
    `src/${base}.html`,
    `src/${base}/index.md`,
    `src/${base}/index.html`,
  ];
}

// A replaced link often lives inside a web.archive.org URL, which embeds the
// original address. Strip those wrappers first so a fixed link is not reported
// as still present.
const ARCHIVE_URL_RE = /https?:\/\/web\.archive\.org\/web\/[^\s)\]"'<>]+/g;

function findOccurrences(needle) {
  const hits = {};
  for (const [file, lines] of contents) {
    lines.forEach((line, index) => {
      const plain = line.replace(ARCHIVE_URL_RE, "");
      for (let at = plain.indexOf(needle); at !== -1; at = plain.indexOf(needle, at + 1)) {
        // `[http://old.example](https://web.archive.org/...)` is a label, not a reference.
        const isLabel = plain[at - 1] === "[" && plain[at + needle.length] === "]";
        if (isLabel) continue;
        const rel = path.relative(root, file);
        (hits[rel] ??= []).push(index + 1);
        break;
      }
    });
  }
  return hits;
}

// A local file URL points at the built site; the source usually lives under
// src/static. Report the real on-disk name when the reference has the wrong case.
function inspectLocalFile(failure) {
  const marker = "/_site/";
  const at = failure.url.indexOf(marker);
  if (at === -1) return;
  const builtPath = decodeURIComponent(failure.url.slice(at + marker.length));
  const target = path.join(root, "_site", builtPath);
  const sourcePath = path.join(root, "src/static", builtPath);
  const dir = path.dirname(sourcePath);
  const base = path.basename(sourcePath);
  let exact = false;
  let actual = null;

  // Compare returned names, not fs.existsSync: macOS matches case-insensitively.
  if (fs.existsSync(dir)) {
    const names = fs.readdirSync(dir);
    exact = names.includes(base);
    const match = names.find((name) => name.toLowerCase() === base.toLowerCase());
    if (match && !exact) actual = path.relative(root, path.join(dir, match));
  }

  failure.local = {
    target: path.relative(root, target),
    sourcePath: path.relative(root, sourcePath),
    sourceExists: exact,
    actual,
  };

  // A relative link can point at a page rather than an asset; match its slug too.
  if (!exact && !actual) {
    const wanted = base.toLowerCase();
    const page = sourceFiles.find((file) => {
      const name = path.basename(file).toLowerCase();
      return name === wanted || name.slice(0, -path.extname(name).length) === wanted;
    });
    if (page) failure.local.page = path.relative(root, page);
  }
}

const failuresWithSources = [...failures.values()].map((failure) => {
  if (failure.kind === "local-file") {
    inspectLocalFile(failure);
    const builtPath = failure.local?.target?.replace(/^_site\//, "");
    if (builtPath) failure.sources = findOccurrences(builtPath);
  } else {
    // The href may be percent-encoded, or differ only by a trailing slash.
    failure.sources = findOccurrences(failure.url);
    if (Object.keys(failure.sources).length === 0) {
      failure.sources = findOccurrences(failure.url.replace(/\/$/, ""));
    }
    if (Object.keys(failure.sources).length === 0) {
      failure.sources = findOccurrences(`${failure.url}/`);
    }
  }

  if (failure.pages.length > 0) {
    failure.pageSources = [
      ...new Set(
        failure.pages.flatMap((page) =>
          sourceCandidates(page).filter((candidate) => contents.has(path.join(root, candidate))),
        ),
      ),
    ];
  }
  return failure;
});

failuresWithSources.sort((a, b) => a.url.localeCompare(b.url));

process.stdout.write(
  JSON.stringify(
    {
      log: path.resolve(logPath),
      root,
      totalErrors,
      uniqueUrls: failuresWithSources.length,
      failures: failuresWithSources,
    },
    null,
    2,
  ) + "\n",
);

console.error(
  `${totalErrors} failures, ${failuresWithSources.length} unique URLs, ` +
    `${failuresWithSources.filter((f) => Object.keys(f.sources).length === 0).length} with no source hits`,
);
