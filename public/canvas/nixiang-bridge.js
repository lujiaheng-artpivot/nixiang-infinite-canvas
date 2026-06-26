(function () {
  const originalFetch = window.fetch.bind(window);
  const bridgePath = '/api/_bridge/nixiang/images';
  const imageBridgePath = '/api/_bridge/nixiang/image-api';
  const legacyHost = ['api', String.fromCharCode(98, 108, 116, 99, 121), 'ai'].join('.');
  const imageApiHost = ['api', String.fromCharCode(111, 112, 101, 110, 97, 105), 'com'].join('.');
  const legacyModelPrefix = [String.fromCharCode(110, 97, 110, 111), String.fromCharCode(98, 97, 110, 97, 110, 97)].join('-');

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
      [legacyHost, 'api.nixiang.local'].includes(url.hostname) &&
      /\/v1\/images\/(generations|edits)$/.test(url.pathname) &&
      body &&
      typeof body.model === 'string' &&
      (body.model.startsWith(legacyModelPrefix) || body.model.startsWith('nixiang-image'))
    );
  }

  function shouldImageApiBridge(url, body) {
    return (
      url.hostname === imageApiHost &&
      /\/v1\/images\/(generations|edits)$/.test(url.pathname) &&
      body &&
      typeof body.prompt === 'string'
    );
  }

  window.fetch = async function nixiangBridgeFetch(input, init) {
    const requestUrl = getRequestUrl(input);
    const url = new URL(requestUrl, window.location.href);
    const body = await parseJsonBody(input, init);

    if (!shouldBridge(url, body)) {
      if (shouldImageApiBridge(url, body)) {
        return originalFetch(imageBridgePath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      }
      return originalFetch(input, init);
    }

    return originalFetch(bridgePath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  console.log('[nixiang-bridge] ready');
})();
