(() => {
  const encodedRules = [
    ['T1VUTElFUlM=', '拟像'],
    ['T3V0bGllcnM=', '拟像'],
    ['Wm9waWE=', '拟像'],
    ['Q29kZXg=', '拟像'],
    ['TmFubyBCYW5hbmE=', '拟像图像'],
    ['TmFub0JhbmFuYQ==', '拟像图像'],
    ['bmFuby1iYW5hbmE=', '拟像图像'],
    ['bmFub2JhbmFuYQ==', '拟像图像'],
    ['bmFub2JhbmFuYWFwaQ==', 'model-api'],
    ['YXBpLmJsdGN5LmFp', 'api.nixiang.local'],
    ['Y29tZmx5', '拟像服务'],
    ['Q29tZnk=', '创作'],
    ['Y29tZnk=', 'workflow'],
    ['Q2hhdEdQVA==', '文本模型'],
    ['R1BU', '文本模型'],
    ['Q2xhdWRl', '文本模型'],
    ['R3Jvaw==', '文本模型'],
    ['RGVlcFNlZWs=', '文本模型'],
    ['ZGVlcHNlZWs=', '文本模型'],
    ['R2VtaW5p', '文本模型'],
    ['S2xpbmc=', '视频模型'],
    ['TWlkam91cm5leQ==', '图像模型'],
    ['U29yYQ==', '视频模型'],
    ['VmVv', '视频模型'],
    ['RG91YmFv', '视频模型'],
    ['6LGG5YyF', '视频模型'],
    ['UnVud2F5', '视频模型'],
    ['U3Vubw==', '音乐模型'],
    ['YWRtaW4xMjM=', 'nixiang-local'],
    ['YWRtaW4=', '拟像用户'],
  ];
  const attrNames = ['aria-label', 'title', 'placeholder', 'alt'];

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function decodeRule(encoded) {
    try {
      return decodeURIComponent(escape(window.atob(encoded)));
    } catch {
      return '';
    }
  }

  const replacements = encodedRules
    .map(([encoded, replacement]) => {
      const value = decodeRule(encoded);
      return value ? [new RegExp(escapeRegExp(value), 'gi'), replacement] : null;
    })
    .filter(Boolean);

  function redact(value) {
    if (!value || typeof value !== 'string') return value;
    return replacements.reduce((next, [pattern, replacement]) => next.replace(pattern, replacement), value);
  }

  function redactNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const next = redact(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of attrNames) {
      if (!node.hasAttribute(attr)) continue;
      const value = node.getAttribute(attr);
      const next = redact(value);
      if (next !== value) node.setAttribute(attr, next);
    }
  }

  function redactTree(root = document.body) {
    if (!root) return;
    redactNode(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) redactNode(walker.currentNode);
  }

  function install() {
    redactTree();
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        redactTree();
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: attrNames,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
