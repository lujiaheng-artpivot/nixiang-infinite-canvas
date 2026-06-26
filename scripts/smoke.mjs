const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4320';

function decodedRegex(encoded, flags = 'i') {
  return new RegExp(Buffer.from(encoded, 'base64').toString('utf8'), flags);
}

const forbidden = [
  decodedRegex('bmFub2JhbmFuYQ=='),
  decodedRegex('TmFub0JhbmFuYQ==', ''),
  decodedRegex('YXBpXC5uYW5vYmFuYW5h'),
  decodedRegex('YXBpXC5ibHRjeQ=='),
  decodedRegex('YWRtaW4xMjM='),
  decodedRegex('XGJhZG1pblxi'),
  decodedRegex('T3V0bGllcnM='),
  decodedRegex('T1VUTElFUlM=', ''),
  decodedRegex('Wm9waWE='),
  decodedRegex('Q29kZXg='),
  decodedRegex('Y29tZnk='),
  decodedRegex('Q29tZnk=', ''),
  decodedRegex('U3l0Y2g='),
  decodedRegex('U3R5dGNo'),
];

async function request(pathname, init, allowedStatuses = [200]) {
  const response = await fetch(new URL(pathname, baseUrl), init);
  const text = await response.text();
  if (!allowedStatuses.includes(response.status)) {
    throw new Error(`${pathname} returned ${response.status}: ${text.slice(0, 200)}`);
  }
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`${pathname} leaked forbidden text: ${pattern}`);
    }
  }
  return text;
}

await request('/healthz');
await request('/api/_offline/meta');
await request('/');
await request('/api/projects.php');
await request('/api/canvas.php?projectId=auto-canvas-local-user');
await request('/api/canvas.php?projectId=auto-canvas-local-admin');
await request('/nixiang-session.js');
await request('/nixiang-bridge.js');
await request('/nixiang-privacy.js');
await request('/api-config-panel.js');

await request('/api/auth.php', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'login', username: 'admin', password: 'admin123' }),
});

await request('/api/user.php', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'get_balance',
    userId: 'local-user',
    token: 'local-nixiang-session',
  }),
});

await request(
  '/api/_bridge/nixiang/image-api',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: '拟像 smoke test', n: 1 }),
  },
  [200, 503],
);

console.log(`smoke ok: ${baseUrl}`);
