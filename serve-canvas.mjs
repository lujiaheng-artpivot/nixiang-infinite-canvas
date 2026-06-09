import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const canvasRoot = path.join(rootDir, 'public', 'canvas');
const backendPort = Number(process.env.TUCHU_BACKEND_PORT || 4320);
const frontendPort = Number(process.env.TUCHU_FRONTEND_PORT || 3000);

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
    <title>拟像 无限画布</title>
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
    <script src="/nanobanana-bridge.js"></script>
    <script src="/nanobanana-session-fix.js"></script>
    <script type="module" src="/assets/index-Cn4IK0Yz.js"></script>
    <script>
      (() => {
        const brandName = '拟像 无限画布';
        document.title = brandName;
        const replacements = new Map([
          ['OUTLIERS', brandName],
          ['共创无限画布', 'AI WORKBENCH'],
        ]);

        const rewriteText = (root) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          const duplicateLabels = [];
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const value = node.nodeValue.trim();
            if (value === 'Outliers') {
              duplicateLabels.push(node.parentElement);
              continue;
            }
            const next = replacements.get(value);
            if (next) node.nodeValue = next;
          }

          for (const label of duplicateLabels) {
            if (!label?.isConnected) continue;
            if (label.tagName === 'H2') {
              label.parentElement?.remove();
            } else {
              label.remove();
            }
          }
        };

        rewriteText(document.body);
        new MutationObserver(() => rewriteText(document.body)).observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      })();
    </script>
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
  console.log(`Nixiang Infinite Canvas ready at http://localhost:${frontendPort}`);
});
