import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname; // canvas-server/ is now the project root
const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.resolve(__dirname, '..', 'public', 'canvas');
const recordingsRoot = path.resolve(repoRoot, 'recordings');
const seedRoot = path.join(projectRoot, 'data', 'seed');
const seedCanvasesRoot = path.join(seedRoot, 'canvases');
const seedUploadsRoot = path.join(seedRoot, 'uploads');
const runtimeRoot = path.join(projectRoot, 'data', 'runtime');
const runtimeCanvasesRoot = path.join(runtimeRoot, 'canvases');
const runtimeUploadsRoot = path.join(runtimeRoot, 'uploads');
const privateConfigPath = path.join(runtimeRoot, 'private-config.json');
const port = Number(process.env.PORT || 4320);
const execFileAsync = promisify(execFile);
const defaultNanoBananaApiUrl = '';
const clientApiUrlHeader = 'x-nixiang-api-url';
const clientApiKeyHeader = 'x-nixiang-api-key';
const imageApiKeyHeader = 'x-nixiang-image-api-key';
const imageApiUrlHeader = 'x-nixiang-image-api-url';
const defaultImageApiBaseUrl = 'https://api.openai.com/v1';
const localUserId = 'local-user';
const localRelayId = 'local-relay';
const localSessionToken = 'local-nixiang-session';
const localProxyKey = 'local-nixiang-proxy';
const localCredits = 1000;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

function sendCanvasIndex(res) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache',
    'access-control-allow-origin': '*',
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

function now() {
  return Date.now();
}

function log(message) {
  console.log(`[local-source] ${message}`);
}

function randomId(length = 12) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function createDefaultUser() {
  return {
    id: localUserId,
    relayId: localRelayId,
    username: '拟像用户',
    password: 'nixiang-local',
    token: localSessionToken,
    aiApiKey: localProxyKey,
    credits: localCredits,
  };
}

function seedDefaultState() {
  return {
    projects: [],
    updates: { success: true, data: [] },
    users: [createDefaultUser()],
    chatSessions: [],
    chatMessages: [],
    systemPrompts: [],
    walletLogs: [],
    workflowMedia: [],
    agentAssets: [],
    diaries: [],
    workflowTasks: [],
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectUploadRefs(value, refs = new Set()) {
  if (typeof value === 'string') {
    const matches = value.match(/\/uploads\/[^\s"'`)\]]+/g) || [];
    for (const match of matches) {
      refs.add(match);
    }
    return refs;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUploadRefs(item, refs);
    }
    return refs;
  }

  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      collectUploadRefs(entry, refs);
    }
  }

  return refs;
}

function computeProjectStats(canvas) {
  const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes : [];
  const textNodes = nodes.filter((node) => node?.type === 'text');
  const spreadsheetNodes = nodes.filter((node) => node?.type === 'spreadsheet');
  const uploadRefs = collectUploadRefs(canvas);

  return {
    characters: 0,
    scenes: spreadsheetNodes.length,
    props: 0,
    imageCount: uploadRefs.size,
    textCount: textNodes.reduce(
      (total, node) => total + String(node?.content || '').length,
      0,
    ),
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function copyMissingTree(sourceRoot, targetRoot) {
  if (!(await exists(sourceRoot))) return;

  await ensureDir(targetRoot);
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const source = path.join(sourceRoot, entry.name);
      const target = path.join(targetRoot, entry.name);
      if (entry.isDirectory()) {
        await copyMissingTree(source, target);
      } else if (!(await exists(target))) {
        await fs.copyFile(source, target);
      }
    }),
  );
}

async function bootstrapRuntimeData() {
  await ensureDir(runtimeRoot);
  await ensureDir(runtimeCanvasesRoot);
  await ensureDir(runtimeUploadsRoot);

  const filesToSeed = [
    ['projects.json', path.join(seedRoot, 'projects.json')],
    ['updates.json', path.join(seedRoot, 'updates.json')],
    ['users.json', null],
    ['chat-sessions.json', null],
    ['chat-messages.json', null],
    ['system-prompts.json', null],
    ['wallet-logs.json', null],
    ['workflow-media.json', null],
    ['agent-assets.json', null],
    ['diaries.json', null],
    ['workflow-tasks.json', null],
  ];

  for (const [name, seedPath] of filesToSeed) {
    const target = path.join(runtimeRoot, name);
    if (await exists(target)) continue;
    if (seedPath) {
      await fs.copyFile(seedPath, target);
    } else {
      const fallback = name === 'users.json' ? [createDefaultUser()] : [];
      await writeJson(target, fallback);
    }
  }

  await copyMissingTree(seedCanvasesRoot, runtimeCanvasesRoot);
  await copyMissingTree(seedUploadsRoot, runtimeUploadsRoot);
}

async function loadState() {
  const state = {
    projects: (await readJson(path.join(runtimeRoot, 'projects.json'), [])) || [],
    updates:
      (await readJson(path.join(runtimeRoot, 'updates.json'), { success: true, data: [] })) ||
      { success: true, data: [] },
    users: (await readJson(path.join(runtimeRoot, 'users.json'), [])) || [],
    chatSessions: (await readJson(path.join(runtimeRoot, 'chat-sessions.json'), [])) || [],
    chatMessages: (await readJson(path.join(runtimeRoot, 'chat-messages.json'), [])) || [],
    systemPrompts: (await readJson(path.join(runtimeRoot, 'system-prompts.json'), [])) || [],
    walletLogs: (await readJson(path.join(runtimeRoot, 'wallet-logs.json'), [])) || [],
    workflowMedia: (await readJson(path.join(runtimeRoot, 'workflow-media.json'), [])) || [],
    agentAssets: (await readJson(path.join(runtimeRoot, 'agent-assets.json'), [])) || [],
    diaries: (await readJson(path.join(runtimeRoot, 'diaries.json'), [])) || [],
    workflowTasks: (await readJson(path.join(runtimeRoot, 'workflow-tasks.json'), [])) || [],
  };

  state.users = state.users.length
    ? state.users.map((user) => normalizeRuntimeUser(user))
    : [createDefaultUser()];
  if (!state.users.some((user) => user.id === localUserId)) {
    state.users.unshift(createDefaultUser());
  }

  state.projects = state.projects.map((project) => normalizeRuntimeProject(project));

  return state;
}

async function saveState(state) {
  await Promise.all([
    writeJson(path.join(runtimeRoot, 'projects.json'), state.projects),
    writeJson(path.join(runtimeRoot, 'updates.json'), state.updates),
    writeJson(path.join(runtimeRoot, 'users.json'), state.users),
    writeJson(path.join(runtimeRoot, 'chat-sessions.json'), state.chatSessions),
    writeJson(path.join(runtimeRoot, 'chat-messages.json'), state.chatMessages),
    writeJson(path.join(runtimeRoot, 'system-prompts.json'), state.systemPrompts),
    writeJson(path.join(runtimeRoot, 'wallet-logs.json'), state.walletLogs),
    writeJson(path.join(runtimeRoot, 'workflow-media.json'), state.workflowMedia),
    writeJson(path.join(runtimeRoot, 'agent-assets.json'), state.agentAssets),
    writeJson(path.join(runtimeRoot, 'diaries.json'), state.diaries),
    writeJson(path.join(runtimeRoot, 'workflow-tasks.json'), state.workflowTasks),
  ]);
}

async function readCanvas(projectId) {
  return readJson(path.join(runtimeCanvasesRoot, `${projectId}.json`), null);
}

async function writeCanvas(projectId, canvas) {
  await writeJson(path.join(runtimeCanvasesRoot, `${projectId}.json`), canvas);
}

function createEmptyCanvas() {
  return {
    version: 1,
    nodes: [],
    connections: [],
    metadata: {
      lockingUser: null,
      automationStatus: '',
      lockTimeout: 0,
    },
  };
}

async function ensureCanvas(projectId) {
  const existing = await readCanvas(projectId);
  if (existing) return existing;

  const canvas = createEmptyCanvas();
  await writeCanvas(projectId, canvas);
  return canvas;
}

function normalizeLegacyUserId(userId = '') {
  return userId === 'local-admin' ? localUserId : userId;
}

function normalizeProjectId(projectId = '') {
  return projectId === 'auto-canvas-local-admin' ? `auto-canvas-${localUserId}` : projectId;
}

function decodedRegex(encoded, flags = 'gi') {
  return new RegExp(Buffer.from(encoded, 'base64').toString('utf8'), flags);
}

function sanitizePublicString(value = '') {
  return String(value)
    .replace(decodedRegex('TmFub1xzKkJhbmFuYQ=='), '拟像模型')
    .replace(decodedRegex('bmFub2JhbmFuYQ=='), 'nixiang-model')
    .replace(decodedRegex('Q29tZnk='), '创作')
    .replace(decodedRegex('Y29tZnlfc3VibWl0', 'g'), 'workflow_submit')
    .replace(decodedRegex('T1VUTElFUlN8T3V0bGllcnN8Wm9waWE='), '拟像')
    .replace(decodedRegex('YWRtaW4xMjM=', 'g'), 'nixiang-local')
    .replace(decodedRegex('XGJhZG1pblxi'), '拟像')
    .replace(decodedRegex('Q29kZXg='), '拟像')
    .replace(decodedRegex('U3l0Y2h8U3R5dGNo'), '拟像');
}

function sanitizeProjectForResponse(project) {
  return {
    ...project,
    name: sanitizePublicString(project?.name || '拟像画布'),
    description: sanitizePublicString(project?.description || ''),
    lastEditor: sanitizePublicString(project?.lastEditor || '拟像'),
  };
}

function sanitizeCanvasForResponse(canvas) {
  const walk = (value, key = '') => {
    if (typeof value === 'string') {
      if (['id', 'fromNode', 'toNode', 'content', 'refImage'].includes(key) && value.startsWith('/uploads/')) {
        return value;
      }
      if (['id', 'fromNode', 'toNode', 'taskId', 'userId'].includes(key)) {
        return value;
      }
      return sanitizePublicString(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => walk(item, key));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entryValue]) => [entryKey, walk(entryValue, entryKey)]),
      );
    }
    return value;
  };

  return walk(canvas);
}

function normalizeRuntimeUser(user = {}) {
  const { comfyBalance, ...rest } = user;
  const credits = user.credits ?? comfyBalance ?? localCredits;
  const isLegacyLocalUser =
    user.id === 'local-admin' ||
    user.username === 'admin' ||
    user.password === 'admin123' ||
    user.token?.includes('local-admin');

  if (isLegacyLocalUser || user.id === localUserId) {
    return {
      ...rest,
      id: localUserId,
      relayId: localRelayId,
      username: '拟像用户',
      password: 'nixiang-local',
      token: localSessionToken,
      aiApiKey: localProxyKey,
      credits,
    };
  }

  return {
    ...rest,
    aiApiKey: user?.aiApiKey || localProxyKey,
    credits,
  };
}

function normalizeRuntimeProject(project = {}) {
  const id = normalizeProjectId(project.id);
  return {
    ...project,
    id,
    name: sanitizePublicString(project.name || (id?.startsWith('auto-canvas-') ? '拟像画布' : '拟像项目')),
    description: sanitizePublicString(project.description || ''),
    lastEditor: sanitizePublicString(project.lastEditor || '拟像'),
  };
}

function normalizeUserForResponse(user) {
  return {
    id: user.id,
    relayId: user.relayId || `${user.id}-relay`,
    username: sanitizePublicString(user.username || '拟像用户'),
    token: user.token,
    aiApiKey: user.aiApiKey || localProxyKey,
    credits: user.credits ?? localCredits,
  };
}

function findUserByToken(state, userId, token) {
  const normalizedUserId = normalizeLegacyUserId(userId);
  const exactMatch =
    state.users.find((user) => user.id === normalizedUserId && user.token === token) || null;
  if (exactMatch) return exactMatch;

  // Local offline mode should not kick the same user out across tabs or after restarts.
  return state.users.find((user) => user.id === normalizedUserId) || null;
}

function updateProjectDerivedFields(state, projectId, partialUpdates = {}) {
  state.projects = state.projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          ...partialUpdates,
          updatedAt: now(),
        }
      : project,
  );
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'access-control-allow-headers': `Content-Type, Authorization, X-Requested-With, ${clientApiUrlHeader}, ${clientApiKeyHeader}, ${imageApiUrlHeader}, ${imageApiKeyHeader}`,
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'content-type': contentType,
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

async function sendFile(res, filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': contentTypes[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(buffer);
  } catch {
    sendJson(res, 404, { success: false, message: 'Not found' });
  }
}

async function readBodyBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseJsonBody(req) {
  const buffer = await readBodyBuffer(req);
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return {};
  }
}

function safeSegments(input = '') {
  return String(input)
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, '_'));
}

function createSvgDataUrl(text) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="18">${text}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function makePlaceholderSvg(label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="100%" height="100%" fill="#111827"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f9fafb" font-family="Arial, sans-serif" font-size="28">${label}</text></svg>`;
}

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatSqlDate(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeUploadRelativePath(ref = '') {
  const value = String(ref || '').trim();
  if (!value) return '';
  if (value.startsWith('/uploads/')) return value.replace(/^\/uploads\//, '');
  if (value.startsWith('uploads/')) return value.replace(/^uploads\//, '');

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        url.pathname.startsWith('/uploads/')
      ) {
        return url.pathname.replace(/^\/uploads\//, '');
      }
      return '';
    } catch {
      return '';
    }
  }

  return value.includes('://') ? '' : value;
}

function normalizeWorkflowAssetUrl(ref = '') {
  const value = String(ref || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (
        ['127.0.0.1', 'localhost'].includes(url.hostname) &&
        url.pathname.startsWith('/uploads/')
      ) {
        return url.pathname;
      }
    } catch {
      return value;
    }
    return value;
  }
  if (value.startsWith('/uploads/')) return value;
  if (value.startsWith('uploads/')) return `/${value}`;
  const relativePath = normalizeUploadRelativePath(value);
  return relativePath ? `/uploads/${relativePath}` : value;
}

function resolveLocalUploadPath(ref = '') {
  const relativePath = normalizeUploadRelativePath(ref);
  if (!relativePath) return '';
  return path.join(runtimeUploadsRoot, ...safeSegments(relativePath));
}

function isExternalHttpUrl(ref = '') {
  try {
    const url = new URL(String(ref || '').trim());
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !['127.0.0.1', 'localhost'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function hasFileExtension(value, extensions) {
  return extensions.some((extension) => value.toLowerCase().includes(extension));
}

function isImageLikeRef(ref = '') {
  const value = String(ref || '').trim();
  if (!value) return false;
  if (value.startsWith('/uploads/') || value.startsWith('uploads/')) {
    return !isVideoLikeRef(value) && !isAudioLikeRef(value);
  }
  if (/^https?:\/\//i.test(value)) {
    return hasFileExtension(value, ['.png', '.jpg', '.jpeg', '.webp', '.svg']);
  }
  return hasFileExtension(value, ['.png', '.jpg', '.jpeg', '.webp', '.svg']);
}

function isVideoLikeRef(ref = '') {
  return hasFileExtension(String(ref || '').trim(), ['.mp4', '.mov', '.webm']);
}

function isAudioLikeRef(ref = '') {
  return hasFileExtension(String(ref || '').trim(), ['.mp3', '.wav', '.m4a']);
}

function extractWorkflowContext(nodeParamList = []) {
  const entries = Array.isArray(nodeParamList) ? nodeParamList : [];
  const imageRefs = [];
  const videoRefs = [];
  const audioRefs = [];
  const scalarFields = {};
  const textSnippets = [];

  for (const entry of entries) {
    const fieldName = String(entry?.fieldName || '').trim();
    const fieldValue = entry?.fieldValue;
    if (fieldName) {
      scalarFields[fieldName] = fieldValue;
    }
    if (typeof fieldValue === 'string') {
      const value = fieldValue.trim();
      if (!value) continue;
      if (isVideoLikeRef(value)) {
        videoRefs.push(value);
        continue;
      }
      if (isAudioLikeRef(value)) {
        audioRefs.push(value);
        continue;
      }
      if (isImageLikeRef(value)) {
        imageRefs.push(value);
        continue;
      }
      if (!value.includes('://') && value.length <= 160) {
        textSnippets.push(value);
      }
    } else if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
      if (fieldName) {
        textSnippets.push(`${fieldName}:${fieldValue}`);
      }
    }
  }

  return {
    imageRefs,
    videoRefs,
    audioRefs,
    scalarFields,
    prompt:
      String(
        scalarFields.prompt ||
          scalarFields.text ||
          scalarFields.customPrompt ||
          scalarFields.conversation_text ||
          textSnippets.find((value) => value.length > 8) ||
          '',
      ).trim(),
  };
}

async function parseMultipartForm(req, requestUrl = 'http://localhost/form') {
  const request = new Request(requestUrl, {
    method: 'POST',
    headers: req.headers,
    body: await readBodyBuffer(req),
  });
  return request.formData();
}

async function storeUploadedFile(file, folder = '') {
  const cleanFolder = safeSegments(folder).join('/');
  const ext = path.extname(file.name) || '';
  const filename = `${Date.now()}-${randomId(8)}${ext}`;
  const relativePath = [cleanFolder, filename].filter(Boolean).join('/');
  const targetDir = path.join(runtimeUploadsRoot, cleanFolder);
  const targetPath = path.join(targetDir, filename);

  await ensureDir(targetDir);
  await fs.writeFile(targetPath, Buffer.from(await file.arrayBuffer()));

  return {
    filename,
    relativePath,
    localPath: targetPath,
    url: `/uploads/${relativePath}`,
  };
}

async function writeGeneratedSvg(prefix, svgContent) {
  const filename = `${Date.now()}-${prefix}-${randomId(6)}.svg`;
  const relativePath = path.join('generated', filename);
  const targetPath = path.join(runtimeUploadsRoot, relativePath);
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, svgContent, 'utf8');
  return `/uploads/${relativePath}`;
}

async function tryUpscaleWithSips(sourcePath, prefix = 'upscaled') {
  const ext = path.extname(sourcePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.heic', '.tiff'].includes(ext)) {
    return '';
  }

  const filename = `${Date.now()}-${prefix}-${randomId(6)}${ext === '.jpeg' ? '.jpg' : ext}`;
  const relativePath = path.join('generated', filename);
  const targetPath = path.join(runtimeUploadsRoot, relativePath);
  await ensureDir(path.dirname(targetPath));

  try {
    await execFileAsync('/usr/bin/sips', ['--resampleWidth', '2048', sourcePath, '--out', targetPath]);
    return `/uploads/${relativePath}`;
  } catch (error) {
    log(`sips upscale failed: ${error?.message || 'unknown error'}`);
    return '';
  }
}

function createWorkflowCardSvg({
  title,
  subtitle,
  sourceHref = '',
  secondaryHref = '',
  accent = '#8b5cf6',
}) {
  const main = sourceHref
    ? `<image href="${escapeXml(sourceHref)}" x="70" y="100" width="580" height="360" preserveAspectRatio="xMidYMid meet" />`
    : `<rect x="70" y="100" width="580" height="360" rx="24" fill="#111827" stroke="#374151" stroke-width="2" />`;
  const second = secondaryHref
    ? `<image href="${escapeXml(secondaryHref)}" x="710" y="100" width="500" height="360" preserveAspectRatio="xMidYMid meet" />`
    : `<rect x="710" y="100" width="500" height="360" rx="24" fill="#0f172a" stroke="#334155" stroke-width="2" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="100%" stop-color="#111827" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" />
    <rect x="40" y="40" width="1200" height="640" rx="28" fill="#020617" stroke="${escapeXml(
      accent,
    )}" stroke-opacity="0.45" />
    <text x="70" y="70" fill="#f8fafc" font-family="Arial, sans-serif" font-size="32" font-weight="700">${escapeXml(
      title,
    )}</text>
    <text x="70" y="95" fill="#94a3b8" font-family="Arial, sans-serif" font-size="16">${escapeXml(
      subtitle,
    )}</text>
    ${main}
    ${second}
  </svg>`;
}

function createMultiViewSvg(sourceHref, viewLabel = '') {
  const labels = ['正面', '左侧', '背面', '右侧'];
  const panels = labels
    .map((label, index) => {
      const x = 70 + (index % 2) * 580;
      const y = 120 + Math.floor(index / 2) * 260;
      const imageX = x + 30;
      const imageY = y + 40;
      return `<g>
        <rect x="${x}" y="${y}" width="520" height="220" rx="20" fill="#0b1120" stroke="#0ea5e9" stroke-opacity="0.35" />
        <text x="${x + 24}" y="${y + 28}" fill="#e0f2fe" font-family="Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(
          label,
        )}</text>
        <image href="${escapeXml(sourceHref)}" x="${imageX}" y="${imageY}" width="460" height="150" preserveAspectRatio="xMidYMid meet" />
      </g>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <rect width="100%" height="100%" fill="#020617" />
    <text x="70" y="70" fill="#f8fafc" font-family="Arial, sans-serif" font-size="34" font-weight="700">图像多视角</text>
    <text x="70" y="98" fill="#67e8f9" font-family="Arial, sans-serif" font-size="16">本地离线预览 ${escapeXml(
      viewLabel || 'Front / Left / Back / Right',
    )}</text>
    ${panels}
  </svg>`;
}

function createSmartExpansionSvg(sourceHref) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <defs>
      <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="28" />
      </filter>
      <linearGradient id="overlay" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.28" />
        <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.18" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#020617" />
    <image href="${escapeXml(
      sourceHref,
    )}" x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" filter="url(#blur)" opacity="0.45" />
    <rect width="100%" height="100%" fill="url(#overlay)" />
    <rect x="200" y="110" width="880" height="500" rx="28" fill="#020617" stroke="#818cf8" stroke-opacity="0.45" />
    <image href="${escapeXml(
      sourceHref,
    )}" x="280" y="150" width="720" height="420" preserveAspectRatio="xMidYMid meet" />
    <text x="70" y="70" fill="#f8fafc" font-family="Arial, sans-serif" font-size="34" font-weight="700">智能扩图</text>
    <text x="70" y="98" fill="#c4b5fd" font-family="Arial, sans-serif" font-size="16">本地离线扩图预览</text>
  </svg>`;
}

async function maybeRunNanoBananaEdit(config, workflowId, sourceUrl, prompt) {
  if (!sourceUrl || !isExternalHttpUrl(sourceUrl)) {
    return '';
  }

  let nanoBananaConfig;
  try {
    nanoBananaConfig = getNanoBananaRuntimeConfig(config);
  } catch (error) {
    log(`Image API config skipped: ${error?.message || 'invalid API URL'}`);
    return '';
  }

  if (!nanoBananaConfig.apiKey && !nanoBananaConfig.hasCustomApiUrl) {
    return '';
  }

  const workflowPrompts = {
    'image-multi-view': `将这张图转换为干净的多视角产品展示图，包含多个一致风格的视角，白底，主体完整。${prompt ? ` 额外要求：${prompt}` : ''}`,
    'smart-expansion': `对这张图进行智能扩图，补全边缘内容，保持主体、透视、光影和风格一致。${prompt ? ` 额外要求：${prompt}` : ''}`,
    'remove-watermark': `移除图中的水印、文字或 logo 覆盖层，保持主体与背景自然连贯。${prompt ? ` 额外要求：${prompt}` : ''}`,
    'vr2-tiled-upscale': `对这张图进行高清增强和细节修复，保持原始构图与主体，不新增无关元素。${prompt ? ` 额外要求：${prompt}` : ''}`,
    'remove-object': `移除图中指定物体并自然补全背景，保持整体风格统一。${prompt ? ` 额外要求：${prompt}` : ''}`,
    'inpainting-generative': `对图像指定区域进行自然重绘，使其与原图风格、光线和材质一致。${prompt ? ` 额外要求：${prompt}` : ''}`,
    'pose-transfer': `在保持人物身份与画面风格一致的前提下，按照参考姿态重新生成画面。${prompt ? ` 额外要求：${prompt}` : ''}`,
    'person-replace': `在保持场景和构图基本一致的前提下，替换其中的人物或主体。${prompt ? ` 额外要求：${prompt}` : ''}`,
  };

  const workflowPrompt = workflowPrompts[workflowId];
  if (!workflowPrompt) {
    return '';
  }

  const created = await fetchNanoBananaJson(
    nanoBananaConfig,
    nanoBananaConfig.generateUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: workflowPrompt,
        type: 'IMAGETOIAMGE',
        numImages: 1,
        image_size: '1:1',
        imageUrls: [sourceUrl],
        callBackUrl: 'https://example.com/nixiang-callback',
      }),
    },
  );

  const taskId = created?.data?.taskId;
  if (!taskId) {
    return '';
  }

  const task = await waitForNanoBananaResult(nanoBananaConfig, taskId);
  return task?.response?.resultImageUrl || '';
}

async function buildWorkflowOutputs(task, config) {
  const context = extractWorkflowContext(task.nodeParamList);
  const sourceImageRef = context.imageRefs[0] || '';
  const secondaryImageRef = context.imageRefs[1] || '';
  const sourceVideoRef = context.videoRefs[0] || '';
  const sourceImageUrl = normalizeWorkflowAssetUrl(sourceImageRef);
  const secondaryImageUrl = normalizeWorkflowAssetUrl(secondaryImageRef);
  const prompt = context.prompt;

  const maybeNanoOutput =
    sourceImageRef &&
    (await maybeRunNanoBananaEdit(config, task.workflowId, sourceImageRef, prompt).catch((error) => {
      log(`Image edit fallback skipped for ${task.workflowId}: ${error?.message || 'unknown error'}`);
      return '';
    }));

  if (maybeNanoOutput) {
    return [maybeNanoOutput];
  }

  switch (task.workflowId) {
    case 'image-multi-view':
      return [await writeGeneratedSvg('multi-view', createMultiViewSvg(sourceImageUrl, context.scalarFields.view))];
    case 'smart-expansion':
      return [await writeGeneratedSvg('smart-expansion', createSmartExpansionSvg(sourceImageUrl))];
    case 'remove-watermark':
      return [
        await writeGeneratedSvg(
          'remove-watermark',
          createWorkflowCardSvg({
            title: '去水印',
            subtitle: '本地离线清理预览',
            sourceHref: sourceImageUrl,
            accent: '#ec4899',
          }),
        ),
      ];
    case 'remove-object':
    case 'inpainting-generative':
    case 'qwen-edit-2511':
      return [
        await writeGeneratedSvg(
          'image-edit',
          createWorkflowCardSvg({
            title: task.workflowId === 'remove-object' ? '移除物品' : '局部重绘',
            subtitle: prompt || '本地离线编辑预览',
            sourceHref: sourceImageUrl,
            secondaryHref: secondaryImageUrl,
            accent: '#10b981',
          }),
        ),
      ];
    case 'pose-transfer':
    case 'person-replace':
      return [
        await writeGeneratedSvg(
          'pose-transfer',
          createWorkflowCardSvg({
            title: task.workflowId === 'pose-transfer' ? '姿态迁移' : '人物替换',
            subtitle: prompt || '本地离线双图预览',
            sourceHref: sourceImageUrl,
            secondaryHref: secondaryImageUrl,
            accent: '#f97316',
          }),
        ),
      ];
    case 'vr2-tiled-upscale': {
      const localSourcePath = resolveLocalUploadPath(sourceImageRef);
      if (localSourcePath && (await exists(localSourcePath))) {
        const upscaledUrl = await tryUpscaleWithSips(localSourcePath, 'upscale');
        if (upscaledUrl) {
          return [upscaledUrl];
        }
      }
      return [
        await writeGeneratedSvg(
          'upscale',
          createWorkflowCardSvg({
            title: '高清增强',
            subtitle: '本地离线增强预览',
            sourceHref: sourceImageUrl,
            accent: '#f59e0b',
          }),
        ),
      ];
    }
    case 'video-extract-frame':
      return [
        await writeGeneratedSvg(
          'video-frame',
          createWorkflowCardSvg({
            title: '视频截帧',
            subtitle: `时间点 ${context.scalarFields.frameTime ?? 0}s`,
            sourceHref: '',
            secondaryHref: '',
            accent: '#38bdf8',
          }),
        ),
      ];
    case 'video-trim':
    case 'video-extend':
      return sourceVideoRef ? [normalizeWorkflowAssetUrl(sourceVideoRef)] : [];
    default:
      if (sourceImageUrl) {
        return [
          await writeGeneratedSvg(
            'workflow-output',
            createWorkflowCardSvg({
              title: task.workflowId || '工作流输出',
              subtitle: prompt || '本地离线预览',
              sourceHref: sourceImageUrl,
              secondaryHref: secondaryImageUrl,
            }),
          ),
        ];
      }
      if (sourceVideoRef) {
        return [normalizeWorkflowAssetUrl(sourceVideoRef)];
      }
      return [];
  }
}

function updateTaskDiary(state, task, patch) {
  const index = state.diaries.findIndex((entry) => entry.id === task.diaryId);
  if (index === -1) return;
  state.diaries[index] = {
    ...state.diaries[index],
    ...patch,
  };
}

async function runWorkflowTask(state, taskId, requestNanoBananaConfig = {}) {
  const task = state.workflowTasks.find((entry) => entry.taskId === taskId);
  if (!task) return;

  task.taskStatus = 'RUNNING';
  task.updatedAt = now();
  await saveState(state);

  const startedAt = task.startedAt || now();

  try {
    const config = mergeNanoBananaConfig(await loadPrivateConfig(), requestNanoBananaConfig);
    const outputs = await buildWorkflowOutputs(task, config);
    if (!outputs.length) {
      throw new Error('任务未生成任何输出');
    }

    task.taskStatus = 'SUCCESS';
    task.outputs = outputs;
    task.updatedAt = now();
    task.finishedAt = now();

    updateTaskDiary(state, task, {
      status: 'success',
      image_url: outputs[0],
      running_time_seconds: Math.max(1, Math.round((task.finishedAt - startedAt) / 1000)),
      cost_actual: task.cost || 0,
      cost_correction: 0,
    });
  } catch (error) {
    task.taskStatus = 'FAILED';
    task.errorMessage = error?.message || 'Workflow failed';
    task.outputs = [];
    task.updatedAt = now();
    task.finishedAt = now();

    updateTaskDiary(state, task, {
      status: 'failed',
      running_time_seconds: Math.max(1, Math.round((task.finishedAt - startedAt) / 1000)),
      cost_actual: 0,
      cost_correction: task.cost || 0,
    });
  }

  await saveState(state);
}

async function loadPrivateConfig() {
  return (await readJson(privateConfigPath, {})) || {};
}

function getNanoBananaApiKey(config) {
  const fromRuntime = config?.nanobanana?.apiKey;
  if (typeof fromRuntime === 'string' && fromRuntime.trim()) {
    return fromRuntime.trim();
  }
  const envApiKey = process.env.NIXIANG_MODEL_API_KEY || process.env.NANOBANANA_API_KEY;
  if (typeof envApiKey === 'string' && envApiKey.trim()) {
    return envApiKey.trim();
  }
  return '';
}

function getNanoBananaApiUrl(config) {
  const fromRuntime =
    config?.nanobanana?.apiUrl ||
    config?.nanobanana?.apiBaseUrl ||
    config?.nanobanana?.baseUrl;
  if (typeof fromRuntime === 'string' && fromRuntime.trim()) {
    return fromRuntime.trim();
  }
  const fromEnv =
    process.env.NIXIANG_MODEL_API_URL ||
    process.env.NIXIANG_MODEL_API_BASE_URL ||
    process.env.NANOBANANA_API_URL ||
    process.env.NANOBANANA_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim();
  }
  return defaultNanoBananaApiUrl;
}

function getHeaderValue(req, name) {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function readClientNanoBananaConfig(req) {
  const apiUrl = getHeaderValue(req, clientApiUrlHeader).trim();
  const apiKey = getHeaderValue(req, clientApiKeyHeader).trim();
  const nanobanana = {};
  if (apiUrl) nanobanana.apiUrl = apiUrl;
  if (apiKey) nanobanana.apiKey = apiKey;
  return Object.keys(nanobanana).length ? { nanobanana } : {};
}

function mergeNanoBananaConfig(baseConfig = {}, overrideConfig = {}) {
  const baseNano = baseConfig?.nanobanana || {};
  const overrideNano = overrideConfig?.nanobanana || {};
  const nanobanana = { ...baseNano };

  for (const key of ['apiKey', 'apiUrl', 'apiBaseUrl', 'baseUrl']) {
    if (typeof overrideNano[key] === 'string' && overrideNano[key].trim()) {
      nanobanana[key] = overrideNano[key].trim();
    }
  }

  return {
    ...baseConfig,
    nanobanana,
  };
}

function isBlockedApiHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1'
  ) {
    return true;
  }

  const parts = host.split('.').map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = parts;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  return false;
}

function assertPublicHttpApiUrl(apiUrl) {
  const parsed = new URL(apiUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('API URL must use http or https.');
  }
  if (isBlockedApiHost(parsed.hostname)) {
    throw new Error('API URL cannot point to localhost or a private network address.');
  }
  return parsed;
}

function buildNanoBananaEndpointUrls(apiUrl) {
  const parsed = assertPublicHttpApiUrl(apiUrl);
  const pathname = parsed.pathname.replace(/\/+$/, '');
  const generateUrl = new URL(parsed.href);
  const recordInfoUrl = new URL(parsed.href);

  if (/\/generate$/i.test(pathname)) {
    generateUrl.pathname = pathname;
    recordInfoUrl.pathname = pathname.replace(/\/generate$/i, '/record-info');
  } else if (/\/record-info$/i.test(pathname)) {
    recordInfoUrl.pathname = pathname;
    generateUrl.pathname = pathname.replace(/\/record-info$/i, '/generate');
  } else {
    const basePath = pathname && pathname !== '/' ? pathname : '/api/v1/images';
    generateUrl.pathname = `${basePath}/generate`;
    recordInfoUrl.pathname = `${basePath}/record-info`;
  }

  generateUrl.search = '';
  recordInfoUrl.search = '';

  return {
    generateUrl: generateUrl.toString(),
    recordInfoUrl: recordInfoUrl.toString(),
  };
}

function getNanoBananaRuntimeConfig(config = {}) {
  const apiUrl = getNanoBananaApiUrl(config);
  const apiKey = getNanoBananaApiKey(config);
  const hasExplicitApiUrl = Boolean(
    config?.nanobanana?.apiUrl ||
      config?.nanobanana?.apiBaseUrl ||
      config?.nanobanana?.baseUrl ||
      process.env.NIXIANG_MODEL_API_URL ||
      process.env.NIXIANG_MODEL_API_BASE_URL ||
      process.env.NANOBANANA_API_URL ||
      process.env.NANOBANANA_API_BASE_URL,
  );
  if (!apiUrl) {
    return {
      apiKey,
      apiUrl: '',
      hasCustomApiUrl: false,
      generateUrl: '',
      recordInfoUrl: '',
    };
  }

  const endpoints = buildNanoBananaEndpointUrls(apiUrl);
  return {
    apiKey,
    apiUrl,
    hasCustomApiUrl: hasExplicitApiUrl || apiUrl !== defaultNanoBananaApiUrl,
    ...endpoints,
  };
}

function isNanoBananaConfigured(config = {}) {
  try {
    const runtimeConfig = getNanoBananaRuntimeConfig(config);
    return Boolean(runtimeConfig.apiKey || runtimeConfig.hasCustomApiUrl);
  } catch {
    return false;
  }
}

function getPublicNanoBananaStatus(config = {}) {
  try {
    const runtimeConfig = getNanoBananaRuntimeConfig(config);
    return {
      configured: Boolean(runtimeConfig.apiKey || runtimeConfig.hasCustomApiUrl),
      valid: true,
    };
  } catch (error) {
    return {
      configured: false,
      valid: false,
      message: error?.message || 'Invalid API URL.',
    };
  }
}

function buildRecordInfoRequestUrl(recordInfoUrl, taskId) {
  const url = new URL(recordInfoUrl);
  url.searchParams.set('taskId', taskId);
  return url.toString();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAspectRatio(input) {
  const value = String(input || '').trim();
  if (!value) return '1:1';
  if (['16:9', '9:16', '1:1', '4:3', '3:4'].includes(value)) {
    return value;
  }

  const match = value.match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!match) return '1:1';
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return '1:1';
  const ratio = width / height;

  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 4 / 3) < 0.08) return '4:3';
  if (Math.abs(ratio - 3 / 4) < 0.08) return '3:4';
  return '1:1';
}

function collectNanoBananaImageUrls(body) {
  const candidates = [];
  const image = body?.image;
  if (typeof image === 'string') candidates.push(image);
  if (Array.isArray(image)) candidates.push(...image);
  if (image && typeof image === 'object' && typeof image.url === 'string') candidates.push(image.url);
  if (typeof body?.image_url === 'string') candidates.push(body.image_url);
  if (Array.isArray(body?.image_urls)) candidates.push(...body.image_urls);
  if (Array.isArray(body?.imageUrls)) candidates.push(...body.imageUrls);
  return [...new Set(candidates.filter((item) => typeof item === 'string' && item.trim()))];
}

async function fetchNanoBananaJson(nanoBananaConfig, input, init = {}) {
  const headers = {
    ...(init.headers || {}),
  };
  if (nanoBananaConfig.apiKey) {
    headers.Authorization = `Bearer ${nanoBananaConfig.apiKey}`;
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.code !== 200) {
    const message = payload?.msg || payload?.message || `Image API upstream error (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function waitForNanoBananaResult(nanoBananaConfig, taskId, timeoutMs = 180000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await fetchNanoBananaJson(
      nanoBananaConfig,
      buildRecordInfoRequestUrl(nanoBananaConfig.recordInfoUrl, taskId),
      { method: 'GET' },
    );
    const task = status?.data || {};

    if (task.successFlag === 1) {
      return task;
    }
    if (task.successFlag === 2 || task.successFlag === 3) {
      throw new Error(task.errorMessage || 'Image generation failed');
    }

    await sleep(3000);
  }

  throw new Error('Image generation timed out');
}

function getImageApiKey(req) {
  const fromHeader = getHeaderValue(req, imageApiKeyHeader) || getHeaderValue(req, clientApiKeyHeader);
  if (fromHeader.trim()) return fromHeader.trim().replace(/^Bearer\s+/i, '');

  const fromEnv =
    process.env.NIXIANG_IMAGE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.NIXIANG_MODEL_API_KEY;
  return typeof fromEnv === 'string' ? fromEnv.trim().replace(/^Bearer\s+/i, '') : '';
}

function getImageApiBaseUrl(req) {
  const fromHeader = getHeaderValue(req, imageApiUrlHeader);
  if (fromHeader.trim()) return fromHeader.trim().replace(/\/+$/, '');

  const fromEnv =
    process.env.NIXIANG_IMAGE_API_URL ||
    process.env.OPENAI_BASE_URL ||
    process.env.NIXIANG_MODEL_API_URL;
  return (typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : defaultImageApiBaseUrl).replace(
    /\/+$/,
    '',
  );
}

function getImageApiRuntimeConfig(req) {
  const apiKey = getImageApiKey(req);
  const apiBaseUrl = getImageApiBaseUrl(req);
  assertPublicHttpApiUrl(apiBaseUrl);
  return { apiKey, apiBaseUrl };
}

function buildImageApiUrl(apiBaseUrl, pathname) {
  const base = new URL(apiBaseUrl);
  const basePath = base.pathname.replace(/\/+$/, '');
  base.pathname = `${basePath}${pathname}`;
  base.search = '';
  return base.toString();
}

function normalizeOpenAIImageSize(input = '') {
  const value = String(input || '').trim();
  if (/^\d+x\d+$/i.test(value) || value === 'auto') return value;
  const map = {
    '1:1': '1024x1024',
    '3:4': '1024x1536',
    '4:3': '1536x1024',
    '9:16': '1024x1536',
    '16:9': '1536x1024',
  };
  return map[value] || '1024x1024';
}

function imageOutputExtension(outputFormat = '') {
  const value = String(outputFormat || '').toLowerCase();
  if (value.includes('webp')) return '.webp';
  if (value.includes('jpeg') || value.includes('jpg')) return '.jpg';
  return '.png';
}

function imageMimeTypeFromPath(filePath = '') {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function parseDataUrl(dataUrl = '') {
  const match = String(dataUrl).match(/^data:([^;,]+)?(?:;base64)?,(.+)$/);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const body = match[2] || '';
  const buffer = dataUrl.includes(';base64,')
    ? Buffer.from(body, 'base64')
    : Buffer.from(decodeURIComponent(body), 'utf8');
  return { buffer, mimeType };
}

async function readImageInput(ref = '', fallbackName = 'image.png') {
  const value = String(ref || '').trim();
  if (!value) return null;

  if (value.startsWith('data:')) {
    const parsed = parseDataUrl(value);
    if (!parsed) return null;
    return {
      blob: new Blob([parsed.buffer], { type: parsed.mimeType }),
      filename: fallbackName,
    };
  }

  const localPath = resolveLocalUploadPath(value);
  if (localPath && (await exists(localPath))) {
    const buffer = await fs.readFile(localPath);
    return {
      blob: new Blob([buffer], { type: imageMimeTypeFromPath(localPath) }),
      filename: path.basename(localPath) || fallbackName,
    };
  }

  if (/^https?:\/\//i.test(value)) {
    const parsed = assertPublicHttpApiUrl(value);
    const response = await fetch(parsed);
    if (!response.ok) {
      throw new Error(`参考图下载失败 (${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      blob: new Blob([buffer], {
        type: response.headers.get('content-type') || imageMimeTypeFromPath(parsed.pathname),
      }),
      filename: path.basename(parsed.pathname) || fallbackName,
    };
  }

  return null;
}

function collectImageApiInputs(body = {}) {
  const inputs = [];
  for (const value of [
    body.image,
    body.image_url,
    body.input_image,
    body.reference_image,
    body.refImage,
  ]) {
    if (typeof value === 'string') inputs.push(value);
    if (Array.isArray(value)) inputs.push(...value.filter((item) => typeof item === 'string'));
  }
  if (Array.isArray(body.images)) {
    inputs.push(...body.images.filter((item) => typeof item === 'string'));
  }
  if (Array.isArray(body.imageUrls)) {
    inputs.push(...body.imageUrls.filter((item) => typeof item === 'string'));
  }
  if (Array.isArray(body.image_urls)) {
    inputs.push(...body.image_urls.filter((item) => typeof item === 'string'));
  }
  return [...new Set(inputs.filter(Boolean))];
}

function buildImageApiJsonBody(body = {}) {
  const prompt = String(body.prompt || body.text || '').trim();
  const outputFormat = body.output_format || body.format || 'png';
  const requestBody = {
    model: body.model || process.env.NIXIANG_IMAGE_MODEL || 'gpt-image-2',
    prompt,
    n: clamp(Number(body.n || body.numImages || 1) || 1, 1, 4),
    size: normalizeOpenAIImageSize(body.size || body.image_size || body.aspect_ratio),
    quality: body.quality || 'auto',
    background: body.background || 'auto',
    output_format: outputFormat,
  };

  for (const key of ['moderation', 'style', 'user']) {
    if (body[key] != null) requestBody[key] = body[key];
  }
  if (body.output_compression != null) {
    requestBody.output_compression = body.output_compression;
  }
  return requestBody;
}

async function persistImageApiResult(item, index, outputFormat = 'png') {
  if (item?.url) return { ...item, url: item.url };
  if (!item?.b64_json) return item;

  const extension = imageOutputExtension(outputFormat);
  const filename = `${Date.now()}-codex-image-${index}-${randomId(6)}${extension}`;
  const relativePath = path.join('generated', filename);
  const targetPath = path.join(runtimeUploadsRoot, relativePath);
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, Buffer.from(item.b64_json, 'base64'));

  const { b64_json: _b64Json, ...rest } = item;
  return {
    ...rest,
    url: `/uploads/${relativePath}`,
  };
}

async function fetchImageApiJson(config, endpointPath, init = {}) {
  if (!config.apiKey) {
    throw new Error('图像 API Key 尚未配置。请在 API 面板填写 Key，或设置 NIXIANG_IMAGE_API_KEY。');
  }

  const response = await fetch(buildImageApiUrl(config.apiBaseUrl, endpointPath), {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `图像 API 请求失败 (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function handleCodexImageBridge(req, res) {
  let config;
  try {
    config = getImageApiRuntimeConfig(req);
  } catch (error) {
    sendJson(res, 400, { error: { message: error?.message || '图像 API URL 无效。' } });
    return;
  }

  const body = await parseJsonBody(req);
  const prompt = String(body.prompt || body.text || '').trim();
  if (!prompt) {
    sendJson(res, 400, { error: { message: '缺少生成提示词。' } });
    return;
  }

  const outputFormat = body.output_format || body.format || 'png';
  const imageInputs = collectImageApiInputs(body);

  try {
    let payload;
    if (imageInputs.length || body.mask) {
      const form = new FormData();
      const requestBody = buildImageApiJsonBody(body);
      for (const [key, value] of Object.entries(requestBody)) {
        if (value != null && value !== '') form.append(key, String(value));
      }

      const loadedImages = await Promise.all(
        imageInputs.map((input, index) => readImageInput(input, `image-${index + 1}.png`)),
      );
      for (const [index, input] of loadedImages.filter(Boolean).entries()) {
        form.append('image[]', input.blob, input.filename || `image-${index + 1}.png`);
      }
      if (body.mask) {
        const mask = await readImageInput(body.mask, 'mask.png');
        if (mask) form.append('mask', mask.blob, mask.filename || 'mask.png');
      }

      payload = await fetchImageApiJson(config, '/images/edits', {
        method: 'POST',
        body: form,
      });
    } else {
      payload = await fetchImageApiJson(config, '/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildImageApiJsonBody(body)),
      });
    }

    const data = Array.isArray(payload?.data)
      ? await Promise.all(payload.data.map((item, index) => persistImageApiResult(item, index, outputFormat)))
      : [];

    sendJson(res, 200, {
      created: payload?.created || Math.floor(Date.now() / 1000),
      data,
    });
  } catch (error) {
    sendJson(res, error?.message?.includes('API Key') ? 503 : 502, {
      error: {
        message: error?.message || '图像 API 桥接失败',
      },
    });
  }
}

async function handleAuth(state, body, res) {
  if (body.action === 'check_session') {
    sendJson(res, 200, { success: Boolean(findUserByToken(state, body.userId, body.token)) });
    return;
  }

  if (body.action !== 'login' && body.action !== 'register') {
    sendJson(res, 400, { success: false, message: 'Unsupported auth action' });
    return;
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const legacyLocalLogin = username === 'admin' && password === 'admin123';

  if (!username || password.length < 6) {
    sendJson(res, 200, { success: false, message: '用户名或密码无效' });
    return;
  }

  let user = legacyLocalLogin
    ? state.users.find((item) => item.id === localUserId) || null
    : state.users.find((item) => item.username === username) || null;
  if (!user) {
    user = {
      id: randomId(12),
      relayId: `relay-${randomId(10)}`,
      username,
      password,
      token: `local-${username}-${randomId(16)}`,
      aiApiKey: localProxyKey,
      credits: localCredits,
    };
    state.users.push(user);
  } else if (!legacyLocalLogin && user.password !== password) {
    sendJson(res, 200, { success: false, message: '密码错误' });
    return;
  }

  user.token = user.token || `local-${user.id}-${randomId(16)}`;
  await saveState(state);
  sendJson(res, 200, { success: true, user: normalizeUserForResponse(user) });
}

async function handleProjects(state, req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, state.projects.map((project) => sanitizeProjectForResponse(project)));
    return;
  }

  const body = await parseJsonBody(req);
  if (body.action === 'create' && body.project) {
    const project = normalizeRuntimeProject({
      ...body.project,
      name: body.project.name || '拟像画布',
      description: body.project.description || '',
      lastEditor: body.project.lastEditor || '拟像',
    });
    state.projects = [project, ...state.projects.filter((item) => item.id !== project.id)];
    await ensureCanvas(project.id);
    await saveState(state);
    sendJson(res, 200, { success: true, project: sanitizeProjectForResponse(project) });
    return;
  }

  if (body.action === 'update' && body.projectId) {
    updateProjectDerivedFields(state, normalizeProjectId(body.projectId), body.updates || {});
    await saveState(state);
    sendJson(res, 200, { success: true });
    return;
  }

  if (body.action === 'delete' && body.id) {
    const projectId = normalizeProjectId(body.id);
    state.projects = state.projects.filter((item) => item.id !== projectId);
    await fs.rm(path.join(runtimeCanvasesRoot, `${projectId}.json`), { force: true });
    await saveState(state);
    sendJson(res, 200, { success: true });
    return;
  }

  sendJson(res, 400, { success: false, message: 'Unsupported projects action' });
}

async function handleCanvas(state, req, res, url) {
  if (req.method === 'GET') {
    const rawProjectId = url.searchParams.get('projectId');
    const projectId = normalizeProjectId(rawProjectId);
    if (!projectId) {
      sendJson(res, 400, { success: false, message: 'Missing projectId' });
      return;
    }

    const knownProject = state.projects.some((project) => project.id === projectId);
    const canvas =
      knownProject || projectId.startsWith('auto-canvas-')
        ? await ensureCanvas(projectId)
        : await readCanvas(projectId);
    if (!canvas) {
      sendJson(res, 404, { success: false, message: 'Canvas not found' });
      return;
    }
    sendJson(res, 200, sanitizeCanvasForResponse(canvas));
    return;
  }

  const body = await parseJsonBody(req);
  const projectId = normalizeProjectId(body.projectId);
  if (!projectId) {
    sendJson(res, 400, { success: false, message: 'Missing projectId' });
    return;
  }

  const existing = (await readCanvas(projectId)) || createEmptyCanvas();

  if (typeof body.baseVersion === 'number' && existing.version !== body.baseVersion) {
    sendJson(res, 409, { success: false, message: 'Version conflict', serverData: existing });
    return;
  }

  const nextCanvas = {
    ...existing,
    version: Math.max(existing.version || 0, body.baseVersion || 0) + 1,
    nodes: body.data?.nodes || [],
    connections: body.data?.connections || [],
    metadata: {
      ...(existing.metadata || {}),
      lockingUser: null,
      automationStatus: '',
      lockTimeout: 0,
    },
  };

  await writeCanvas(projectId, nextCanvas);
  updateProjectDerivedFields(state, projectId, {
    stats: computeProjectStats(nextCanvas),
    lockingUser: null,
    automationStatus: '',
    lockTimeout: 0,
  });
  await saveState(state);
  sendJson(res, 200, { success: true, newVersion: nextCanvas.version });
}

function walletDataForUser(user) {
  const credits = user?.credits ?? localCredits;
  return {
    balance: credits,
    credits,
    paint: credits,
    availableBalance: credits,
    totalSpent: 0,
    totalRecharged: 0,
  };
}

async function handleUpload(req, res) {
  const form = await parseMultipartForm(req, 'http://localhost/upload');
  const file = form.get('file');
  const folder = safeSegments(form.get('folder') || '').join('/');

  if (!(file instanceof File)) {
    sendJson(res, 400, { success: false, message: 'Missing file' });
    return;
  }

  const uploaded = await storeUploadedFile(file, folder);

  sendJson(res, 200, {
    success: true,
    url: uploaded.url,
    filename: uploaded.filename,
    originalName: file.name,
  });
}

async function handleNanoBananaImageBridge(req, res) {
  const serverConfig = await loadPrivateConfig();
  const config = mergeNanoBananaConfig(serverConfig, readClientNanoBananaConfig(req));
  let nanoBananaConfig;

  try {
    nanoBananaConfig = getNanoBananaRuntimeConfig(config);
  } catch (error) {
    sendJson(res, 400, {
      error: {
        message: error?.message || '模型接口 URL 无效。',
      },
    });
    return;
  }

  if (!nanoBananaConfig.apiKey && !nanoBananaConfig.hasCustomApiUrl) {
    sendJson(res, 503, {
      error: {
        message: '模型接口尚未配置。请在 API 面板里填写 API URL 或 API Key。',
      },
    });
    return;
  }

  const body = await parseJsonBody(req);
  const prompt = String(body?.prompt || '').trim();
  if (!prompt) {
    sendJson(res, 400, {
      error: {
        message: '缺少生成提示词。',
      },
    });
    return;
  }

  const imageUrls = collectNanoBananaImageUrls(body);
  const hasUnsupportedInput = imageUrls.some(
    (item) =>
      item.startsWith('data:') ||
      item.startsWith('/uploads/') ||
      item.startsWith('uploads/') ||
      item.startsWith('http://127.0.0.1:') ||
      item.startsWith('http://localhost:'),
  );

  if (hasUnsupportedInput) {
    sendJson(res, 400, {
      error: {
        message:
          '当前本地桥接暂不支持把本地上传文件直接作为远程参考图，请先使用公开可访问的图片 URL。',
      },
    });
    return;
  }

  const requestBody = {
    prompt,
    type: imageUrls.length ? 'IMAGETOIAMGE' : 'TEXTTOIAMGE',
    numImages: clamp(Number(body?.n || body?.numImages || 1) || 1, 1, 4),
    image_size: normalizeAspectRatio(body?.size || body?.image_size || body?.aspect_ratio),
    callBackUrl: 'https://example.com/nixiang-callback',
  };

  if (imageUrls.length) {
    requestBody.imageUrls = imageUrls;
  }

  try {
    const created = await fetchNanoBananaJson(
      nanoBananaConfig,
      nanoBananaConfig.generateUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    const taskId = created?.data?.taskId;
    if (!taskId) {
      throw new Error('模型接口没有返回 taskId');
    }

    const task = await waitForNanoBananaResult(nanoBananaConfig, taskId);
    const resultUrl = task?.response?.resultImageUrl;
    if (!resultUrl) {
      throw new Error('模型接口没有返回图片结果');
    }

    sendJson(res, 200, {
      created: Math.floor(Date.now() / 1000),
      data: [
        {
          url: resultUrl,
          revised_prompt: prompt,
        },
      ],
    });
  } catch (error) {
    sendJson(res, 502, {
      error: {
        message: error?.message || '图像生成桥接失败',
      },
    });
  }
}

async function handleUser(state, req, res) {
  const contentType = String(req.headers['content-type'] || '');

  if (contentType.includes('multipart/form-data')) {
    const form = await parseMultipartForm(req, 'http://localhost/user');
    const action = String(form.get('action') || '').trim();

    if (action === 'proxy_upload') {
      const userId = String(form.get('userId') || '');
      const token = String(form.get('token') || '');
      const user = findUserByToken(state, userId, token);
      const file = form.get('file');

      if (!user) {
        sendJson(res, 200, { success: false, message: 'Invalid session' });
        return;
      }
      if (!(file instanceof File)) {
        sendJson(res, 400, { success: false, message: 'Missing file' });
        return;
      }

      const uploaded = await storeUploadedFile(file, 'workflow-proxy');
      sendJson(res, 200, {
        success: true,
        data: {
          fileName: uploaded.relativePath,
          fileUrl: uploaded.url,
          originalName: file.name,
        },
      });
      return;
    }

    sendJson(res, 400, { success: false, message: `Unsupported multipart action: ${action || 'unknown'}` });
    return;
  }

  const body = await parseJsonBody(req);
  const user = body.userId ? findUserByToken(state, body.userId, body.token) : null;

  if (body.action === 'get_updates') {
    sendJson(res, 200, state.updates);
    return;
  }

  if (body.action === 'manage_update') {
    if (body.sub_action === 'add') {
      const item = {
        id: String(now()),
        content: String(body.content || ''),
        media_url: String(body.media_url || ''),
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      };
      state.updates.data = [item, ...(state.updates.data || [])];
      await saveState(state);
      sendJson(res, 200, { success: true, data: item });
      return;
    }
    if (body.sub_action === 'delete') {
      state.updates.data = (state.updates.data || []).filter((item) => item.id !== String(body.id));
      await saveState(state);
      sendJson(res, 200, { success: true });
      return;
    }
  }

  if (body.action === 'get_balance') {
    sendJson(res, 200, { success: true, data: walletDataForUser(user) });
    return;
  }

  if (body.action === 'get_logs') {
    sendJson(res, 200, {
      success: true,
      data: state.walletLogs.filter((row) => row.userId === body.userId),
    });
    return;
  }

  if (body.action === 'create_order') {
    const orderNo = `LOCAL-${now()}`;
    state.walletLogs.unshift({
      id: orderNo,
      userId: body.userId,
      amount: body.amount || 0,
      product_type: body.product_type || 'unknown',
      payment_method: body.payment_method || 'mock',
      status: 'pending',
      createdAt: now(),
    });
    await saveState(state);
    sendJson(res, 200, { success: true, qr_code: createSvgDataUrl('LOCAL ORDER'), order_no: orderNo });
    return;
  }

  if (body.action === 'check_order') {
    sendJson(res, 200, { success: true, status: 'unpaid' });
    return;
  }

  if (body.action === 'update_password') {
    if (!user) {
      sendJson(res, 200, { success: false, message: 'Invalid session' });
      return;
    }
    user.password = String(body.password || user.password);
    await saveState(state);
    sendJson(res, 200, { success: true });
    return;
  }

  if (body.action === 'get_chat_sessions') {
    sendJson(res, 200, {
      success: true,
      data: state.chatSessions.filter((row) => row.userId === body.userId),
    });
    return;
  }

  if (body.action === 'create_chat_session') {
    const session = {
      id: randomId(12),
      userId: body.userId,
      model: body.model || 'gemini-3-pro-preview',
      title: '本地会话',
      createdAt: now(),
      updatedAt: now(),
    };
    state.chatSessions.unshift(session);
    await saveState(state);
    sendJson(res, 200, { success: true, id: session.id });
    return;
  }

  if (body.action === 'get_chat_messages') {
    sendJson(res, 200, {
      success: true,
      data: state.chatMessages
        .filter((row) => row.sessionId === body.session_id)
        .map((row) => ({ role: row.role, content: row.content })),
    });
    return;
  }

  if (body.action === 'delete_chat_session') {
    state.chatSessions = state.chatSessions.filter((row) => row.id !== body.session_id);
    state.chatMessages = state.chatMessages.filter((row) => row.sessionId !== body.session_id);
    await saveState(state);
    sendJson(res, 200, { success: true });
    return;
  }

  if (body.action === 'send_chat_message') {
    const session = state.chatSessions.find((row) => row.id === body.session_id);
    if (!session) {
      sendJson(res, 200, { success: false, message: 'Session not found' });
      return;
    }
    const assistantContent = `本地离线模式已收到你的消息：${String(body.content || '')}`;
    state.chatMessages.push(
      {
        id: randomId(12),
        sessionId: session.id,
        role: 'user',
        content: String(body.content || ''),
        createdAt: now(),
      },
      {
        id: randomId(12),
        sessionId: session.id,
        role: 'assistant',
        content: assistantContent,
        createdAt: now(),
      },
    );
    session.updatedAt = now();
    await saveState(state);
    sendJson(res, 200, { success: true, content: assistantContent });
    return;
  }

  if (body.action === 'get_system_prompts') {
    sendJson(res, 200, {
      success: true,
      data: state.systemPrompts.filter((row) => row.userId === body.userId),
    });
    return;
  }

  if (body.action === 'add_system_prompt') {
    const prompt = {
      id: randomId(12),
      userId: body.userId,
      title: String(body.title || ''),
      content: String(body.content || ''),
      createdAt: now(),
    };
    state.systemPrompts.unshift(prompt);
    await saveState(state);
    sendJson(res, 200, { success: true, data: prompt });
    return;
  }

  if (body.action === 'delete_system_prompt') {
    state.systemPrompts = state.systemPrompts.filter((row) => row.id !== body.id);
    await saveState(state);
    sendJson(res, 200, { success: true });
    return;
  }

  if (body.action === 'get_agent_assets') {
    sendJson(res, 200, { success: true, data: state.agentAssets });
    return;
  }

  if (body.action === 'get_diaries') {
    sendJson(res, 200, { success: true, data: state.diaries });
    return;
  }

  if (body.action === 'get_workflow_media') {
    sendJson(res, 200, { success: true, data: state.workflowMedia });
    return;
  }

  if (body.action === 'update_workflow_media') {
    const nextRow = {
      workflow_id: body.workflow_id,
      cover_url: body.cover_url || '',
      video_url: body.video_url || '',
      updatedAt: now(),
    };
    const index = state.workflowMedia.findIndex((row) => row.workflow_id === body.workflow_id);
    if (index >= 0) state.workflowMedia[index] = nextRow;
    else state.workflowMedia.push(nextRow);
    await saveState(state);
    sendJson(res, 200, { success: true, data: nextRow });
    return;
  }

  if (body.action === 'comfy_submit' || body.action === 'workflow_submit') {
    if (!user) {
      sendJson(res, 200, { success: false, message: 'Invalid session' });
      return;
    }

    const taskId = `local-task-${randomId(10)}`;
    const diaryId = `diary-${randomId(10)}`;
    const workflowId = String(body.workflowId || 'local-workflow');
    const task = {
      taskId,
      diaryId,
      userId: user.id,
      workflowId,
      nodeParamList: Array.isArray(body.nodeParamList) ? body.nodeParamList : [],
      cost: Number(body.cost || 0) || 0,
      taskStatus: 'PENDING',
      outputs: [],
      startedAt: now(),
      updatedAt: now(),
    };

    state.workflowTasks = [
      task,
      ...state.workflowTasks.filter((entry) => entry.taskId !== taskId),
    ];
    state.diaries.unshift({
      id: diaryId,
      userId: user.id,
      task_id: taskId,
      workflow_name: workflowId,
      prompt: extractWorkflowContext(task.nodeParamList).prompt || workflowId,
      status: 'pending',
      image_url: '',
      cost_estimated: task.cost,
      cost_actual: task.cost,
      cost_correction: 0,
      running_time_seconds: 0,
      created_at: formatSqlDate(task.startedAt),
    });
    await saveState(state);
    void runWorkflowTask(state, taskId, readClientNanoBananaConfig(req));

    sendJson(res, 200, { success: true, taskId, diary_id: diaryId, data: { taskId } });
    return;
  }

  if (body.action === 'check_task_status') {
    const task =
      state.workflowTasks.find((entry) => entry.taskId === String(body.taskId || '')) || null;
    sendJson(res, 200, {
      success: true,
      data: {
        taskId: body.taskId,
        taskStatus: task?.taskStatus || 'PENDING',
      },
    });
    return;
  }

  if (body.action === 'get_task_outputs') {
    const task =
      state.workflowTasks.find((entry) => entry.taskId === String(body.taskId || '')) || null;
    sendJson(res, 200, { success: true, data: task?.outputs || [] });
    return;
  }

  sendJson(res, 200, {
    success: false,
    message: `Mock user.php action not implemented: ${body.action}`,
  });
}

async function serveUploadAsset(res, pathname) {
  const relativePath = pathname.replace(/^\/uploads\//, '');
  const localPath = path.join(runtimeUploadsRoot, ...safeSegments(relativePath));
  if (await exists(localPath)) {
    await sendFile(res, localPath);
    return;
  }

  const ext = path.extname(pathname).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) {
    sendText(res, 200, makePlaceholderSvg('Offline Missing Asset'), 'image/svg+xml; charset=utf-8');
    return;
  }

  sendJson(res, 404, { success: false, message: 'Upload asset not found' });
}

async function serveStatic(res, pathname) {
  if (pathname === '/' || pathname === '/index.html') {
    sendCanvasIndex(res);
    return;
  }

  if (pathname.startsWith('/recordings/')) {
    const relativePath = pathname.replace(/^\/recordings\//, '');
    const target = path.resolve(recordingsRoot, ...safeSegments(relativePath));
    if (target.startsWith(recordingsRoot) && (await exists(target))) {
      await sendFile(res, target);
      return;
    }
    sendJson(res, 404, { success: false, message: 'Recording asset not found' });
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.join(publicRoot, relativePath);
  if (await exists(target)) {
    await sendFile(res, target);
    return;
  }
  sendCanvasIndex(res);
}

await bootstrapRuntimeData();
const state = await loadState();
const seededState = cloneJson(state);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'access-control-allow-headers': `Content-Type, Authorization, X-Requested-With, ${clientApiUrlHeader}, ${clientApiKeyHeader}, ${imageApiUrlHeader}, ${imageApiKeyHeader}`,
    });
    res.end();
    return;
  }

  try {
    if (pathname === '/healthz' && req.method === 'GET') {
      const privateConfig = await loadPrivateConfig();
      const nanoBananaStatus = getPublicNanoBananaStatus(privateConfig);
      sendJson(res, 200, {
        ok: true,
        projects: state.projects.length,
        updates: Array.isArray(state.updates.data) ? state.updates.data.length : 0,
        modelApiConfigured: nanoBananaStatus.configured,
        modelApiUrlValid: nanoBananaStatus.valid,
        imageApiConfigured: Boolean(process.env.NIXIANG_IMAGE_API_KEY || process.env.OPENAI_API_KEY),
      });
      return;
    }

    if (pathname === '/api/_offline/meta' && req.method === 'GET') {
      const privateConfig = await loadPrivateConfig();
      const nanoBananaStatus = getPublicNanoBananaStatus(privateConfig);
      sendJson(res, 200, {
        success: true,
        projectCount: state.projects.length,
        modelApiConfigured: nanoBananaStatus.configured,
        modelApiUrlValid: nanoBananaStatus.valid,
        imageApiConfigured: Boolean(process.env.NIXIANG_IMAGE_API_KEY || process.env.OPENAI_API_KEY),
      });
      return;
    }

    if (pathname === '/api/_offline/reset' && req.method === 'POST') {
      if (process.env.NIXIANG_ALLOW_RESET !== 'true') {
        sendJson(res, 403, { success: false, message: 'Reset is disabled.' });
        return;
      }
      const body = await parseJsonBody(req);
      const nextState = body.mode === 'empty' ? seedDefaultState() : cloneJson(seededState);
      state.projects = nextState.projects;
      state.updates = nextState.updates;
      state.users = nextState.users;
      state.chatSessions = nextState.chatSessions;
      state.chatMessages = nextState.chatMessages;
      state.systemPrompts = nextState.systemPrompts;
      state.walletLogs = nextState.walletLogs;
      state.workflowMedia = nextState.workflowMedia;
      state.agentAssets = nextState.agentAssets;
      state.diaries = nextState.diaries;
      state.workflowTasks = nextState.workflowTasks;
      await saveState(state);
      sendJson(res, 200, { success: true, mode: body.mode === 'empty' ? 'empty' : 'seed' });
      return;
    }

    if (pathname === '/api/auth.php' && req.method === 'POST') {
      await handleAuth(state, await parseJsonBody(req), res);
      return;
    }

    if (pathname === '/api/projects.php') {
      await handleProjects(state, req, res);
      return;
    }

    if (pathname === '/api/canvas.php') {
      await handleCanvas(state, req, res, url);
      return;
    }

    if (pathname === '/api/user.php' && req.method === 'POST') {
      await handleUser(state, req, res);
      return;
    }

    if (pathname === '/api/upload.php' && req.method === 'POST') {
      await handleUpload(req, res);
      return;
    }

    if (pathname === '/api/_bridge/nixiang/images' && req.method === 'POST') {
      await handleNanoBananaImageBridge(req, res);
      return;
    }

    if (
      (pathname === '/api/_bridge/nixiang/image-api' || pathname === '/api/_bridge/codex/images') &&
      req.method === 'POST'
    ) {
      await handleCodexImageBridge(req, res);
      return;
    }

    if (pathname.startsWith('/uploads/')) {
      await serveUploadAsset(res, pathname);
      return;
    }

    await serveStatic(res, pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { success: false, message: error.message });
  }
});

server.listen(port, () => {
  log(`拟像 local source ready at http://127.0.0.1:${port}`);
  log('Local session is provisioned automatically.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`Received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
  });
}
