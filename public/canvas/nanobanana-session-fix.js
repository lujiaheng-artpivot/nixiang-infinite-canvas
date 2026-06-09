(() => {
  const sessionKey = 'synapse_session';
  const placeholderApiKey = 'local-nanobanana-proxy';

  function normalizeSessionRaw(raw) {
    if (!raw) return raw;

    try {
      const session = JSON.parse(raw);
      if (!session || typeof session !== 'object') return raw;
      if (!session.aiApiKey) {
        session.aiApiKey = placeholderApiKey;
      }
      return JSON.stringify(session);
    } catch {
      return raw;
    }
  }

  function patchStoredSession(storage) {
    const current = storage.getItem(sessionKey);
    const normalized = normalizeSessionRaw(current);
    if (current && normalized && current !== normalized) {
      storage.setItem(sessionKey, normalized);
      console.log('[nanobanana-session-fix] patched local session aiApiKey');
    }
  }

  try {
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;

    Storage.prototype.getItem = function patchedGetItem(key) {
      const value = originalGetItem.call(this, key);
      if (key !== sessionKey) return value;

      const normalized = normalizeSessionRaw(value);
      if (value && normalized && value !== normalized) {
        originalSetItem.call(this, key, normalized);
      }
      return normalized;
    };

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      const nextValue = key === sessionKey ? normalizeSessionRaw(value) : value;
      return originalSetItem.call(this, key, nextValue);
    };

    patchStoredSession(window.localStorage);

    // The bundle may rewrite the session shortly after boot; keep repairing it for a brief window.
    let attempts = 0;
    const timer = window.setInterval(() => {
      patchStoredSession(window.localStorage);
      attempts += 1;
      if (attempts >= 20) {
        window.clearInterval(timer);
      }
    }, 1000);
  } catch (error) {
    console.warn('[nanobanana-session-fix] unable to install session guard', error);
  }
})();
