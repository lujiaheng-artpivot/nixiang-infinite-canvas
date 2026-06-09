(function () {
  const originalFetch = window.fetch.bind(window);

  function getRequestUrl(input) {
    return typeof input === 'string' ? input : input.url;
  }

  async function parseJsonBody(input, init) {
    const rawBody = init && init.body;
    if (typeof rawBody === 'string') {
      try {
        return JSON.parse(rawBody);
      } catch {
        return null;
      }
    }

    if (input instanceof Request) {
      const cloned = input.clone();
      const contentType = cloned.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          return await cloned.json();
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  function shouldBridge(url, body) {
    return (
      url.hostname === 'api.bltcy.ai' &&
      /\/v1\/images\/(generations|edits)$/.test(url.pathname) &&
      body &&
      typeof body.model === 'string' &&
      body.model.startsWith('nano-banana')
    );
  }

  window.fetch = async function nanobananaBridgeFetch(input, init) {
    const requestUrl = getRequestUrl(input);
    const url = new URL(requestUrl, window.location.href);
    const body = await parseJsonBody(input, init);

    if (!shouldBridge(url, body)) {
      return originalFetch(input, init);
    }

    return originalFetch('/api/_bridge/nanobanana/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  console.log('[nanobanana-bridge] ready');
})();
