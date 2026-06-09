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
const publicRoot = path.resolve(__dirname, '..', 'public', 'canvas');
const seedRoot = path.join(projectRoot, 'data', 'seed');
const seedCanvasesRoot = path.join(seedRoot, 'canvases');
const seedUploadsRoot = path.join(seedRoot, 'uploads');
const runtimeRoot = path.join(projectRoot, 'data', 'runtime');
const runtimeCanvasesRoot = path.join(runtimeRoot, 'canvases');
const runtimeUploadsRoot = path.join(runtimeRoot, 'uploads');
const privateConfigPath = path.join(runtimeRoot, 'private-config.json');
const port = Number(process.env.PORT || 4320);
const execFileAsync = promisify(execFile);

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
    id: 'local-admin',
    relayId: 'local-relay',
    username: 'admin',
    password: 'admin123',
    token: `local-local-admin-${randomId(16)}`,
    aiApiKey: 'local-nanobanana-proxy',
    comfyBalance: 1000,
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

  state.users = state.users.map((user) => ({
    ...user,
    aiApiKey: user?.aiApiKey || 'local-nanobanana-proxy',
  }));

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

function normalizeUserForResponse(user) {
  return {
    id: user.id,
    relayId: user.relayId || `${user.id}-relay`,
    username: user.username,
    token: user.token,
    aiApiKey: user.aiApiKey || 'local-nanobanana-proxy',
    comfyBalance: user.comfyBalance ?? 1000,
  };
}

function findUserByToken(state, userId, token) {
  const exactMatch =
    state.users.find((user) => user.id === userId && user.token === token) || null;
  if (exactMatch) return exactMatch;

  // Local offline mode should not kick the same user out across tabs or after restarts.
  return state.users.find((user) => user.id === userId) || null;
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
    'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With',
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

  const apiKey = getNanoBananaApiKey(config);
  if (!apiKey) {
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
    apiKey,
    'https://api.nanobananaapi.ai/api/v1/nanobanana/generate',
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
        callBackUrl: 'https://example.com/nanobanana-callback',
      }),
    },
  );

  const taskId = created?.data?.taskId;
  if (!taskId) {
    return '';
  }

  const task = await waitForNanoBananaResult(apiKey, taskId);
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
      log(`NanoBanana edit fallback skipped for ${task.workflowId}: ${error?.message || 'unknown error'}`);
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

async function runWorkflowTask(state, taskId) {
  const task = state.workflowTasks.find((entry) => entry.taskId === taskId);
  if (!task) return;

  task.taskStatus = 'RUNNING';
  task.updatedAt = now();
  await saveState(state);

  const startedAt = task.startedAt || now();

  try {
    const config = await loadPrivateConfig();
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
  if (typeof process.env.NANOBANANA_API_KEY === 'string' && process.env.NANOBANANA_API_KEY.trim()) {
    return process.env.NANOBANANA_API_KEY.trim();
  }
  return '';
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

async function fetchNanoBananaJson(apiKey, input, init = {}) {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.code !== 200) {
    const message = payload?.msg || payload?.message || `NanoBanana upstream error (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function waitForNanoBananaResult(apiKey, taskId, timeoutMs = 180000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await fetchNanoBananaJson(
      apiKey,
      `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`,
      { method: 'GET' },
    );
    const task = status?.data || {};

    if (task.successFlag === 1) {
      return task;
    }
    if (task.successFlag === 2 || task.successFlag === 3) {
      throw new Error(task.errorMessage || 'NanoBanana generation failed');
    }

    await sleep(3000);
  }

  throw new Error('NanoBanana generation timed out');
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

  if (!username || password.length < 6) {
    sendJson(res, 200, { success: false, message: '用户名或密码无效' });
    return;
  }

  let user = state.users.find((item) => item.username === username) || null;
  if (!user) {
    user = {
      id: randomId(12),
      relayId: `relay-${randomId(10)}`,
      username,
      password,
      token: `local-${username}-${randomId(16)}`,
      aiApiKey: 'local-nanobanana-proxy',
      comfyBalance: 1000,
    };
    state.users.push(user);
  } else if (user.password !== password) {
    sendJson(res, 200, { success: false, message: '密码错误' });
    return;
  }

  user.token = user.token || `local-${user.id}-${randomId(16)}`;
  await saveState(state);
  sendJson(res, 200, { success: true, user: normalizeUserForResponse(user) });
}

async function handleProjects(state, req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, state.projects);
    return;
  }

  const body = await parseJsonBody(req);
  if (body.action === 'create' && body.project) {
    state.projects = [body.project, ...state.projects.filter((item) => item.id !== body.project.id)];
    await saveState(state);
    sendJson(res, 200, { success: true, project: body.project });
    return;
  }

  if (body.action === 'update' && body.projectId) {
    updateProjectDerivedFields(state, body.projectId, body.updates || {});
    await saveState(state);
    sendJson(res, 200, { success: true });
    return;
  }

  if (body.action === 'delete' && body.id) {
    state.projects = state.projects.filter((item) => item.id !== body.id);
    await fs.rm(path.join(runtimeCanvasesRoot, `${body.id}.json`), { force: true });
    await saveState(state);
    sendJson(res, 200, { success: true });
    return;
  }

  sendJson(res, 400, { success: false, message: 'Unsupported projects action' });
}

async function handleCanvas(state, req, res, url) {
  if (req.method === 'GET') {
    const projectId = url.searchParams.get('projectId');
    const canvas = projectId ? await readCanvas(projectId) : null;
    if (!canvas) {
      sendJson(res, 404, { success: false, message: 'Canvas not found' });
      return;
    }
    sendJson(res, 200, canvas);
    return;
  }

  const body = await parseJsonBody(req);
  const projectId = body.projectId;
  if (!projectId) {
    sendJson(res, 400, { success: false, message: 'Missing projectId' });
    return;
  }

  const existing = (await readCanvas(projectId)) || {
    version: 0,
    nodes: [],
    connections: [],
    metadata: {
      lockingUser: null,
      automationStatus: '',
      lockTimeout: 0,
    },
  };

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
  return {
    balance: user?.comfyBalance ?? 1000,
    comfyBalance: user?.comfyBalance ?? 1000,
    availableBalance: user?.comfyBalance ?? 1000,
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
  const config = await loadPrivateConfig();
  const apiKey = getNanoBananaApiKey(config);
  if (!apiKey) {
    sendJson(res, 503, {
      error: {
        message: 'NanoBanana API key is not configured on the local server.',
      },
    });
    return;
  }

  const body = await parseJsonBody(req);
  const prompt = String(body?.prompt || '').trim();
  if (!prompt) {
    sendJson(res, 400, {
      error: {
        message: 'Missing prompt for NanoBanana image generation.',
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
          'The local NanoBanana bridge currently supports text-to-image. Local upload URLs and data URLs are not publicly reachable by the NanoBanana API yet.',
      },
    });
    return;
  }

  const requestBody = {
    prompt,
    type: imageUrls.length ? 'IMAGETOIAMGE' : 'TEXTTOIAMGE',
    numImages: clamp(Number(body?.n || body?.numImages || 1) || 1, 1, 4),
    image_size: normalizeAspectRatio(body?.size || body?.image_size || body?.aspect_ratio),
    callBackUrl: 'https://example.com/nanobanana-callback',
  };

  if (imageUrls.length) {
    requestBody.imageUrls = imageUrls;
  }

  try {
    const created = await fetchNanoBananaJson(
      apiKey,
      'https://api.nanobananaapi.ai/api/v1/nanobanana/generate',
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
      throw new Error('NanoBanana did not return a taskId');
    }

    const task = await waitForNanoBananaResult(apiKey, taskId);
    const resultUrl = task?.response?.resultImageUrl;
    if (!resultUrl) {
      throw new Error('NanoBanana completed without a result image URL');
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
        message: error?.message || 'NanoBanana image bridge failed',
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

  if (body.action === 'comfy_submit') {
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
    void runWorkflowTask(state, taskId);

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
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.join(publicRoot, relativePath);
  if (await exists(target)) {
    await sendFile(res, target);
    return;
  }
  await sendFile(res, path.join(publicRoot, 'index.html'));
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
      'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With',
    });
    res.end();
    return;
  }

  try {
    if (pathname === '/healthz' && req.method === 'GET') {
      const privateConfig = await loadPrivateConfig();
      sendJson(res, 200, {
        ok: true,
        projects: state.projects.length,
        updates: Array.isArray(state.updates.data) ? state.updates.data.length : 0,
        nanobananaConfigured: Boolean(getNanoBananaApiKey(privateConfig)),
      });
      return;
    }

    if (pathname === '/api/_offline/meta' && req.method === 'GET') {
      const privateConfig = await loadPrivateConfig();
      sendJson(res, 200, {
        success: true,
        projectRoot,
        publicRoot,
        runtimeRoot,
        projectCount: state.projects.length,
        nanobananaConfigured: Boolean(getNanoBananaApiKey(privateConfig)),
      });
      return;
    }

    if (pathname === '/api/_offline/reset' && req.method === 'POST') {
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

    if (pathname === '/api/_bridge/nanobanana/images' && req.method === 'POST') {
      await handleNanoBananaImageBridge(req, res);
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
  log(`Offline local source ready at http://127.0.0.1:${port}`);
  log('Default local account: admin / admin123');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`Received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
  });
}
