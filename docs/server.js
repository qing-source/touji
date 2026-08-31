// server.js — 静态服务器（无缓存，确保每次都是最新版本）
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer((q, s) => {
  let p = q.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(root, decodeURIComponent(p));
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); s.end('404'); return; }
    s.writeHead(200, {
      'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });
    s.end(d);
  });
}).listen(8686, () => console.log('server v2 (no-cache) on http://127.0.0.1:8686'));
