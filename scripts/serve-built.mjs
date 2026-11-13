#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  negotiate,
  classifyPath,
  toMarkdownPath,
  toHtmlPath,
  linkAlternate,
  MARKDOWN_CONTENT_TYPE,
  HTML_CONTENT_TYPE,
  VARY_ACCEPT,
  LLMS_FULL_PATH,
  llmsFullRedirectTarget,
} from '../lib/markdown-negotiation.mjs';

const args = process.argv.slice(2);
let outputDir = process.env.SERVE_DIR || '_site';
let port = process.env.PORT || process.env.SERVE_PORT || 8081;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dir' || a === '-d') {
    outputDir = args[++i];
  } else if (a.startsWith('--dir=')) {
    outputDir = a.slice('--dir='.length);
  } else if (a === '--port' || a === '-p') {
    port = args[++i];
  } else if (a.startsWith('--port=')) {
    port = a.slice('--port='.length);
  }
  // positional args are handled below
}

if (args.length >= 1 && !args[0].startsWith('-')) {
  outputDir = args[0];
}
if (args.length >= 2 && !args[1].startsWith('-')) {
  port = args[1];
}

outputDir = path.resolve(outputDir);
port = Number(port);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(urlPath) {
  // returns absolute file path if exists, else null
  const cleaned = urlPath.split('?')[0].split('#')[0];
  // Netlify-like: try exact, then .html, then index.html
  const candidates = [];
  const base = path.join(outputDir, cleaned.replace(/^\/+/, ''));
  candidates.push(base);
  if (!path.extname(base)) {
    candidates.push(base + '.html');
    candidates.push(path.join(base, 'index.html'));
  }
  // also handle trailing slash
  if (cleaned.endsWith('/')) {
    candidates.push(path.join(base, 'index.html'));
  }
  for (const c of candidates) {
    try {
      const st = fs.statSync(c);
      if (st.isFile()) return c;
    } catch {}
  }
  return null;
}

function readBody(filePath) {
  return fs.readFileSync(filePath);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // llms-full.txt redirect
  if (pathname === LLMS_FULL_PATH) {
    res.statusCode = 302;
    res.setHeader('Location', llmsFullRedirectTarget());
    res.end();
    return;
  }

  const kind = classifyPath(pathname);

  if (kind === 'passthrough') {
    const filePath = resolveFile(pathname);
    if (!filePath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    let ct = MIME[ext] || 'application/octet-stream';
    if (pathname === '/llms.txt') ct = 'text/markdown; charset=utf-8';
    const body = readBody(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Length', String(body.length));
    res.end(body);
    return;
  }

  if (kind === 'markdown') {
    const filePath = resolveFile(pathname);
    if (!filePath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const body = readBody(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', MARKDOWN_CONTENT_TYPE);
    res.setHeader('Vary', VARY_ACCEPT);
    res.setHeader('Link', linkAlternate(pathname));
    res.setHeader('Content-Length', String(body.length));
    res.end(body);
    return;
  }

  // html content
  const filePath = resolveFile(pathname);
  // If the underlying HTML does not exist, pass through to 404
  if (!filePath) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const accept = req.headers['accept'];
  const negotiated = negotiate(accept);

  if (negotiated === 'not-acceptable') {
    res.statusCode = 406;
    res.setHeader('Vary', VARY_ACCEPT);
    res.end('Not Acceptable');
    return;
  }

  if (negotiated === 'markdown') {
    const twinPath = toMarkdownPath(pathname);
    const twinFile = resolveFile(twinPath);
    if (!twinFile) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const body = readBody(twinFile);
    res.statusCode = 200;
    res.setHeader('Content-Type', MARKDOWN_CONTENT_TYPE);
    res.setHeader('Vary', VARY_ACCEPT);
    res.setHeader('Link', linkAlternate(twinPath));
    res.setHeader('Content-Length', String(body.length));
    res.end(body);
    return;
  }

  // html
  const body = readBody(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', HTML_CONTENT_TYPE);
  res.setHeader('Vary', VARY_ACCEPT);
  res.setHeader('Link', linkAlternate(pathname));
  res.setHeader('Content-Length', String(body.length));
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serve-built: serving ${outputDir} on http://127.0.0.1:${port}`);
});
