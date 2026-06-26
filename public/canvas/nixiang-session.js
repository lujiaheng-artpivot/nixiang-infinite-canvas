(() => {
  const sessionKey = [String.fromCharCode(115, 121, 110, 97, 112, 115, 101), 'session'].join('_');
  const placeholderApiKey = 'local-nixiang-proxy';
  const legacyUserId = ['local', String.fromCharCode(97, 100, 109, 105, 110)].join('-');
  const localUser = {
    id: 'local-user',
    relayId: 'local-relay',
    username: '拟像用户',
    token: 'local-nixiang-session',
    aiApiKey: placeholderApiKey,
    credits: 1000,
  };

  function normalizeSessionRaw(raw) {
    if (!raw) return JSON.stringify(localUser);

    try {
      const session = JSON.parse(raw);
      if (!session || typeof session !== 'object') return JSON.stringify(localUser);
      if (session.id === legacyUserId) session.id = localUser.id;
      if (session.token && String(session.token).includes(legacyUserId)) session.token = localUser.token;
      if (!session.token) session.token = localUser.token;
      if (!session.relayId) session.relayId = localUser.relayId;
      session.username = '拟像用户';
      session.aiApiKey = session.aiApiKey || placeholderApiKey;
      session.credits = session.credits ?? 1000;
      return JSON.stringify(session);
    } catch {
      return JSON.stringify(localUser);
    }
  }

  function patchStoredSession(storage) {
    const current = storage.getItem(sessionKey);
    const normalized = normalizeSessionRaw(current);
    if (normalized && current !== normalized) {
      storage.setItem(sessionKey, normalized);
    }
  }

  async function confirmServerSession() {
    try {
      await window.fetch('/api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: '拟像用户',
          password: 'nixiang-local',
        }),
      });
    } catch {
      // The synchronous local session is enough for the app to render; retry happens on refresh.
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
    confirmServerSession();

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
    console.warn('[nixiang-session] unable to install session guard', error);
  }
})();
