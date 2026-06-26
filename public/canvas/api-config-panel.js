(() => {
  const storageKey = 'nixiang_api_config_v1';
  const defaultApiUrl = 'https://your-api.example.com/api/v1';
  const apiUrlHeader = 'x-nixiang-api-url';
  const apiKeyHeader = 'x-nixiang-api-key';
  const legacyWorkflowAction = [String.fromCharCode(99, 111, 109, 102, 121), 'submit'].join('_');

  function readConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        apiUrl: typeof parsed.apiUrl === 'string' ? parsed.apiUrl.trim() : '',
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
      };
    } catch {
      return { apiUrl: '', apiKey: '' };
    }
  }

  function saveConfig(config) {
    const next = {
      apiUrl: String(config.apiUrl || '').trim().replace(/\/+$/, ''),
      apiKey: String(config.apiKey || '').trim(),
    };
    localStorage.setItem(storageKey, JSON.stringify(next));
    return next;
  }

  function makeHeaders(config) {
    const headers = {};
    if (config.apiUrl) headers[apiUrlHeader] = config.apiUrl;
    if (config.apiKey) headers[apiKeyHeader] = config.apiKey;
    return headers;
  }

  function getJsonAction(init = {}) {
    if (typeof init.body !== 'string') return '';
    try {
      const body = JSON.parse(init.body);
      return typeof body.action === 'string' ? body.action : '';
    } catch {
      return '';
    }
  }

  function shouldAttachConfig(input, init = {}) {
    try {
      const requestUrl = typeof input === 'string' ? input : input.url;
      const url = new URL(requestUrl, window.location.href);
      if (url.origin !== window.location.origin) return false;
      if (url.pathname === '/api/_bridge/nixiang/images') return true;
      if (url.pathname === '/api/_bridge/nixiang/image-api') return true;
      return (
        url.pathname === '/api/user.php' &&
        [legacyWorkflowAction, 'workflow_submit'].includes(getJsonAction(init))
      );
    } catch {
      return false;
    }
  }

  function installFetchConfigHeaders() {
    const originalFetch = window.fetch.bind(window);

    window.fetch = function fetchWithApiConfig(input, init = {}) {
      const config = readConfig();
      if (!config.apiUrl && !config.apiKey) {
        return originalFetch(input, init);
      }
      if (!shouldAttachConfig(input, init)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(
        init.headers || (input instanceof Request ? input.headers : undefined),
      );
      const configHeaders = makeHeaders(config);
      for (const [name, value] of Object.entries(configHeaders)) {
        headers.set(name, value);
      }

      return originalFetch(input, {
        ...init,
        headers,
      });
    };
  }

  function installPanel() {
    const style = document.createElement('style');
    style.textContent = `
      .nx-api-config {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 2147483000;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #f8fafc;
      }
      .nx-api-config * {
        box-sizing: border-box;
      }
      .nx-api-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 34px;
        min-width: 76px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 8px;
        background: rgba(5, 8, 18, 0.88);
        color: #f8fafc;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.36);
        backdrop-filter: blur(14px);
      }
      .nx-api-button:hover {
        border-color: rgba(56, 189, 248, 0.62);
        background: rgba(8, 15, 32, 0.96);
      }
      .nx-api-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #64748b;
      }
      .nx-api-dot[data-ready="true"] {
        background: #22c55e;
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
      }
      .nx-api-panel {
        position: absolute;
        top: 42px;
        right: 0;
        width: min(360px, calc(100vw - 28px));
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 8px;
        background: rgba(4, 6, 14, 0.96);
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.52);
        padding: 14px;
        display: none;
        backdrop-filter: blur(18px);
      }
      .nx-api-panel[data-open="true"] {
        display: block;
      }
      .nx-api-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .nx-api-title strong {
        font-size: 13px;
        line-height: 1.2;
      }
      .nx-api-close {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: transparent;
        color: #cbd5e1;
        cursor: pointer;
      }
      .nx-api-field {
        display: grid;
        gap: 6px;
        margin-top: 10px;
      }
      .nx-api-field label {
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
      }
      .nx-api-field input {
        width: 100%;
        height: 36px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.78);
        color: #f8fafc;
        font-size: 12px;
        outline: none;
        padding: 0 10px;
      }
      .nx-api-field input:focus {
        border-color: rgba(56, 189, 248, 0.72);
      }
      .nx-api-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 12px;
      }
      .nx-api-actions button {
        height: 32px;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        background: rgba(15, 23, 42, 0.78);
        color: #e2e8f0;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        padding: 0 12px;
      }
      .nx-api-actions button[data-primary="true"] {
        border-color: rgba(56, 189, 248, 0.6);
        background: #0284c7;
        color: white;
      }
      .nx-api-status {
        min-height: 18px;
        margin-top: 10px;
        color: #38bdf8;
        font-size: 11px;
        line-height: 1.45;
      }
      @media (max-width: 640px) {
        .nx-api-config {
          top: 12px;
          right: 12px;
        }
        .nx-api-button {
          min-width: 66px;
        }
      }
    `;

    const root = document.createElement('div');
    root.className = 'nx-api-config';
    root.innerHTML = `
      <button class="nx-api-button" type="button" aria-haspopup="dialog" aria-expanded="false">
        <span class="nx-api-dot"></span>
        <span>API</span>
      </button>
      <section class="nx-api-panel" role="dialog" aria-label="API 设置">
        <div class="nx-api-title">
          <strong>API 设置</strong>
          <button class="nx-api-close" type="button" aria-label="关闭">×</button>
        </div>
        <div class="nx-api-field">
          <label for="nx-api-url">模型 API URL</label>
          <input id="nx-api-url" type="url" placeholder="${defaultApiUrl}" autocomplete="off" spellcheck="false" />
        </div>
        <div class="nx-api-field">
          <label for="nx-api-key">API Key 可选</label>
          <input id="nx-api-key" type="password" placeholder="Bearer token / API key" autocomplete="off" spellcheck="false" />
        </div>
        <div class="nx-api-actions">
          <button type="button" data-action="clear">清空</button>
          <button type="button" data-action="save" data-primary="true">保存</button>
        </div>
        <div class="nx-api-status" aria-live="polite"></div>
      </section>
    `;

    document.head.appendChild(style);
    document.body.appendChild(root);

    const button = root.querySelector('.nx-api-button');
    const dot = root.querySelector('.nx-api-dot');
    const panel = root.querySelector('.nx-api-panel');
    const closeButton = root.querySelector('.nx-api-close');
    const apiUrlInput = root.querySelector('#nx-api-url');
    const apiKeyInput = root.querySelector('#nx-api-key');
    const status = root.querySelector('.nx-api-status');

    function setOpen(open) {
      panel.dataset.open = String(open);
      button.setAttribute('aria-expanded', String(open));
      if (open) apiUrlInput.focus();
    }

    function syncInputs() {
      const config = readConfig();
      apiUrlInput.value = config.apiUrl;
      apiKeyInput.value = config.apiKey;
      dot.dataset.ready = String(Boolean(config.apiUrl || config.apiKey));
    }

    function setStatus(message, isError = false) {
      status.textContent = message;
      status.style.color = isError ? '#f87171' : '#38bdf8';
    }

    button.addEventListener('click', () => {
      syncInputs();
      setStatus('');
      setOpen(panel.dataset.open !== 'true');
    });
    closeButton.addEventListener('click', () => setOpen(false));

    root.querySelector('[data-action="save"]').addEventListener('click', () => {
      const apiUrl = apiUrlInput.value.trim();
      if (apiUrl) {
        try {
          const parsed = new URL(apiUrl);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('invalid protocol');
          }
        } catch {
          setStatus('API URL 格式不正确', true);
          return;
        }
      }
      saveConfig({
        apiUrl,
        apiKey: apiKeyInput.value,
      });
      syncInputs();
      setStatus('已保存到当前浏览器');
    });

    root.querySelector('[data-action="clear"]').addEventListener('click', () => {
      localStorage.removeItem(storageKey);
      syncInputs();
      setStatus('已清空');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.dataset.open === 'true') {
        setOpen(false);
      }
    });

    syncInputs();
  }

  window.NixiangApiConfig = {
    get: readConfig,
    save: saveConfig,
    makeHeaders: () => makeHeaders(readConfig()),
    storageKey,
  };

  installFetchConfigHeaders();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPanel, { once: true });
  } else {
    installPanel();
  }
})();
