import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const canvasRoot = path.join(rootDir, 'public', 'canvas');
const backendPort = Number(process.env.NIXIANG_BACKEND_PORT || 4320);
const frontendPort = Number(process.env.NIXIANG_FRONTEND_PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendIndex(res) {
  res.writeHead(200, {
    'Content-Type': mime['.html'],
    'Cache-Control': 'no-cache',
  });
  res.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>拟像：AI 视频与图像 Agent</title>
    <script src="/vendor/tailwindcss.js"></script>
    <style>
      html, body, #root {
        width: 100%;
        height: 100%;
        margin: 0;
        background: #04060e;
      }
      * { box-sizing: border-box; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="/api-config-panel.js"></script>
    <script src="/ui-magic.js"></script>
    <script src="/nixiang-session.js"></script>
    <script src="/nixiang-bridge.js"></script>
    <script src="/nixiang-privacy.js"></script>
    <script type="module" src="/assets/index-Cn4IK0Yz.js"></script>
  </body>
</html>`);
}

function proxy(req, res) {
  const target = http.request(
    {
      hostname: '127.0.0.1',
      port: backendPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  target.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: `Backend unavailable: ${error.message}` }));
  });

  req.pipe(target);
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/' || pathname === '/index.html') {
    sendIndex(res);
    return;
  }

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/uploads/')
  ) {
    proxy(req, res);
    return;
  }

  const filePath = path.resolve(canvasRoot, `.${pathname}`);
  const rootPath = path.resolve(canvasRoot);
  if (!filePath.startsWith(rootPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

http.createServer(serveStatic).listen(frontendPort, '0.0.0.0', () => {
  console.log(`拟像 canvas ready at http://localhost:${frontendPort}`);
});
