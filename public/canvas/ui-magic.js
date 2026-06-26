(() => {
  const rootClass = 'nx-magic-ui';
  const storageKey = 'nixiang_magic_ui_v2';

  const presets = [
    '生成一条 UGC 风格产品广告，真实人物口播，前三秒强钩子，适合短视频投放',
    '把参考图扩展成品牌片主视觉，保持主体一致，增加电影级布光和景深',
    '制作 16:9 社媒封面，黑底荧光标题区，人物/产品在右侧形成视觉焦点',
    '生成一组品牌视觉分镜：开场、产品细节、使用场景、结尾 CTA，风格统一',
  ];

  const modeLabels = {
    text: '文生视觉',
    reference: '参考改片',
  };

  let landingActive = !new URLSearchParams(window.location.search).has('app');

  const state = (() => {
    try {
      return {
        dockCollapsed: false,
        focus: false,
        mode: 'text',
        ...JSON.parse(localStorage.getItem(storageKey) || '{}'),
      };
    } catch {
      return { dockCollapsed: false, focus: false, mode: 'text' };
    }
  })();

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function addStyle() {
    const style = document.createElement('style');
    style.dataset.nxMagic = 'true';
    style.textContent = `
      :root {
        --nx-page: #030403;
        --nx-surface: rgba(12, 13, 10, 0.84);
        --nx-surface-solid: rgba(14, 15, 12, 0.96);
        --nx-surface-soft: rgba(28, 30, 24, 0.68);
        --nx-line: rgba(234, 244, 207, 0.16);
        --nx-line-strong: rgba(226, 255, 96, 0.34);
        --nx-text: #fbfff3;
        --nx-text-soft: #e3ead1;
        --nx-muted: #9da58d;
        --nx-accent: #dcff3f;
        --nx-accent-2: #aaff5a;
        --nx-purple: #9b78ff;
        --nx-coral: #ff795b;
        --nx-amber: #ffd166;
        --nx-shadow: 0 24px 76px rgba(0, 0, 0, 0.56);
        --nx-left: 92px;
        --nx-right-panel: 360px;
      }

      html,
      body,
      #root {
        background:
          radial-gradient(circle at 18% 14%, rgba(220, 255, 63, 0.14), transparent 28%),
          radial-gradient(circle at 68% 8%, rgba(155, 120, 255, 0.12), transparent 25%),
          radial-gradient(circle at 38% 88%, rgba(255, 121, 91, 0.1), transparent 27%),
          linear-gradient(135deg, #030403 0%, #080906 46%, #040604 100%) !important;
      }

      .${rootClass} * {
        box-sizing: border-box;
      }

      .nx-topbar,
      .nx-studio-dock,
      .nx-canvas-hud,
      .nx-empty-guide,
      .nx-toast,
      .nx-command-panel,
      .nx-landing-page {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .${rootClass}.nx-landing-active {
        overflow: hidden;
      }

      .${rootClass}.nx-landing-active #root,
      .${rootClass}.nx-landing-active .nx-topbar,
      .${rootClass}.nx-landing-active .nx-studio-dock,
      .${rootClass}.nx-landing-active .nx-canvas-hud,
      .${rootClass}.nx-landing-active .nx-empty-guide,
      .${rootClass}.nx-landing-active .nx-command-panel,
      .${rootClass}.nx-landing-active .nx-api-config {
        pointer-events: none;
        visibility: hidden;
      }

      .nx-landing-page {
        position: fixed;
        inset: 0;
        z-index: 2147483600;
        overflow-y: auto;
        background: #000;
        color: #fff;
      }

      .${rootClass}:not(.nx-landing-active) .nx-landing-page {
        display: none;
      }

      .nx-landing-hero {
        position: relative;
        display: grid;
        isolation: isolate;
        min-height: 100vh;
        overflow: hidden;
        background: #000;
      }

      .nx-landing-hero::before {
        content: "";
        position: absolute;
        inset: -18px;
        background:
          url("/login-scene-bg.png") center / cover no-repeat,
          #000;
        filter: brightness(0.9) saturate(1.05) contrast(1.06) blur(0.2px);
        opacity: 1;
        transform: scale(1.02);
        z-index: -2;
      }

      .nx-landing-hero::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse at 50% 47%, rgba(0, 0, 0, 0.18) 0 28%, rgba(0, 0, 0, 0.1) 46%, transparent 66%),
          radial-gradient(circle at 50% 53%, rgba(255, 245, 117, 0.1), transparent 25%),
          linear-gradient(180deg, rgba(0, 0, 0, 0.52) 0%, rgba(0, 0, 0, 0.12) 34%, rgba(0, 0, 0, 0.72) 100%),
          linear-gradient(90deg, rgba(0, 0, 0, 0.48), transparent 28%, transparent 72%, rgba(0, 0, 0, 0.5));
        z-index: -1;
      }

      .nx-landing-nav {
        position: fixed;
        top: 18px;
        left: 50%;
        z-index: 2147483620;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        width: min(1760px, calc(100vw - 260px));
        min-height: 100px;
        border: 1px solid rgba(255, 255, 255, 0.13);
        border-radius: 28px;
        background: rgba(9, 10, 10, 0.76);
        box-shadow: 0 20px 80px rgba(0, 0, 0, 0.5);
        padding: 0 38px;
        transform: translateX(-50%);
        backdrop-filter: blur(18px) saturate(1.1);
      }

      .nx-landing-logo {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        color: #f7ff82;
        font-size: 15px;
        font-weight: 850;
      }

      .nx-landing-logo-mark {
        position: relative;
        width: 25px;
        height: 25px;
      }

      .nx-landing-logo-mark::before,
      .nx-landing-logo-mark::after {
        content: "";
        position: absolute;
        width: 15px;
        height: 15px;
        border: 2px solid #f4ff75;
        border-radius: 5px;
        transform: rotate(-28deg);
      }

      .nx-landing-logo-mark::before {
        left: 0;
        top: 2px;
      }

      .nx-landing-logo-mark::after {
        right: 0;
        bottom: 2px;
      }

      .nx-landing-links {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(38px, 4.5vw, 74px);
      }

      .nx-landing-links a,
      .nx-landing-lang {
        color: rgba(255, 255, 255, 0.72);
        font-size: 21px;
        font-weight: 800;
        text-decoration: none;
        white-space: nowrap;
      }

      .nx-landing-links a:hover {
        color: #ffffff;
      }

      .nx-landing-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 30px;
      }

      .nx-landing-lang {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 0;
        background: transparent;
        cursor: default;
      }

      .nx-landing-cta,
      .nx-landing-hero-cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 16px;
        background: #fff97d;
        color: #070806;
        box-shadow: 0 0 34px rgba(255, 249, 125, 0.18);
        cursor: pointer;
        font-weight: 900;
        letter-spacing: 0;
      }

      .nx-landing-cta {
        height: 56px;
        padding: 0 28px;
        font-size: 20px;
      }

      .nx-landing-hero-content {
        position: relative;
        z-index: 2;
        align-self: center;
        justify-self: center;
        width: min(1000px, calc(100vw - 48px));
        margin-top: 18px;
        text-align: center;
      }

      .nx-landing-title {
        margin: 0;
        color: #ffffff;
        font-size: clamp(64px, 7.2vw, 132px);
        font-weight: 900;
        line-height: 0.98;
        letter-spacing: 0;
      }

      .nx-landing-title span {
        display: block;
      }

      .nx-landing-title .nx-landing-title-highlight {
        color: #fff56f;
      }

      .nx-landing-subtitle {
        margin: 34px 0 0;
        color: rgba(255, 255, 255, 0.64);
        font-size: clamp(18px, 1.6vw, 30px);
        font-weight: 800;
        line-height: 1.45;
      }

      .nx-landing-hero-cta {
        min-width: 292px;
        height: 106px;
        margin-top: 56px;
        border-radius: 999px;
        font-size: 32px;
      }

      .nx-landing-section {
        min-height: 100vh;
        padding: 160px max(48px, 8vw) 120px;
        background:
          radial-gradient(circle at 20% 10%, rgba(255, 249, 125, 0.1), transparent 28%),
          #000;
      }

      .nx-landing-kicker {
        display: inline-flex;
        align-items: center;
        height: 28px;
        margin-bottom: 22px;
        border: 1px solid rgba(255, 249, 125, 0.2);
        border-radius: 999px;
        background: rgba(255, 249, 125, 0.08);
        color: #fff97d;
        padding: 0 13px;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .nx-landing-section h2 {
        margin: 0;
        font-size: clamp(42px, 5vw, 86px);
        font-weight: 900;
        line-height: 1.02;
      }

      .nx-landing-section p {
        max-width: 720px;
        color: rgba(255, 255, 255, 0.62);
        font-size: 20px;
        font-weight: 650;
        line-height: 1.7;
      }

      .nx-landing-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        margin-top: 48px;
      }

      .nx-landing-card {
        min-height: 260px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 22px;
        background:
          linear-gradient(150deg, rgba(255, 249, 125, 0.12), transparent 36%),
          rgba(255, 255, 255, 0.045);
        padding: 28px;
      }

      .nx-landing-card strong {
        display: block;
        color: #fff;
        font-size: 24px;
        font-weight: 900;
      }

      .nx-landing-card span {
        display: block;
        margin-top: 16px;
        color: rgba(255, 255, 255, 0.62);
        font-size: 16px;
        font-weight: 650;
        line-height: 1.65;
      }

      .nx-landing-split {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(340px, 1.1fr);
        gap: clamp(30px, 5vw, 90px);
        align-items: center;
      }

      .nx-landing-showcase {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .nx-landing-shot {
        min-height: 280px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 28px;
        overflow: hidden;
        background:
          linear-gradient(160deg, rgba(255, 249, 125, 0.2), transparent 34%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
          #080908;
        padding: 18px;
      }

      .nx-landing-shot:nth-child(2) {
        margin-top: 48px;
        background:
          linear-gradient(160deg, rgba(155, 120, 255, 0.22), transparent 34%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
          #080908;
      }

      .nx-landing-shot:nth-child(3) {
        background:
          linear-gradient(160deg, rgba(255, 121, 91, 0.22), transparent 34%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
          #080908;
      }

      .nx-landing-shot:nth-child(4) {
        margin-top: 48px;
      }

      .nx-landing-shot strong {
        display: block;
        color: #fff;
        font-size: 20px;
        font-weight: 900;
      }

      .nx-landing-shot span {
        display: block;
        margin-top: 160px;
        color: rgba(255, 255, 255, 0.62);
        font-size: 14px;
        font-weight: 700;
      }

      .nx-landing-metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
        margin-top: 54px;
      }

      .nx-landing-metric {
        border-top: 1px solid rgba(255, 255, 255, 0.14);
        padding-top: 24px;
      }

      .nx-landing-metric strong {
        display: block;
        color: #fff97d;
        font-size: clamp(42px, 5vw, 78px);
        font-weight: 900;
        line-height: 1;
      }

      .nx-landing-metric span {
        display: block;
        margin-top: 10px;
        color: rgba(255, 255, 255, 0.62);
        font-size: 15px;
        font-weight: 800;
      }

      .nx-landing-pill-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 38px;
      }

      .nx-landing-pill {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.055);
        color: rgba(255, 255, 255, 0.82);
        padding: 13px 18px;
        font-size: 15px;
        font-weight: 850;
      }

      .nx-landing-pricing-card {
        position: relative;
        min-height: 320px;
      }

      .nx-landing-pricing-card[data-featured="true"] {
        border-color: rgba(255, 249, 125, 0.42);
        background:
          linear-gradient(150deg, rgba(255, 249, 125, 0.2), transparent 48%),
          rgba(255, 255, 255, 0.06);
      }

      .nx-landing-price {
        display: block;
        margin-top: 32px;
        color: #fff97d;
        font-size: 34px;
        font-weight: 900;
      }

      .nx-landing-faq {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 46px;
      }

      .nx-landing-faq details {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.045);
        padding: 22px;
      }

      .nx-landing-faq summary {
        color: #fff;
        cursor: pointer;
        font-size: 18px;
        font-weight: 900;
      }

      .nx-landing-faq p {
        margin: 16px 0 0;
        font-size: 15px;
      }

      .nx-landing-footer {
        padding: 80px max(48px, 8vw) 56px;
        background: #000;
      }

      .nx-landing-footer-inner {
        display: grid;
        grid-template-columns: minmax(260px, 1.4fr) repeat(4, minmax(120px, 0.6fr));
        gap: 36px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        padding-top: 42px;
      }

      .nx-landing-footer strong {
        display: block;
        color: #fff;
        font-size: 18px;
        font-weight: 900;
      }

      .nx-landing-footer p,
      .nx-landing-footer a {
        display: block;
        margin: 12px 0 0;
        color: rgba(255, 255, 255, 0.56);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.7;
        text-decoration: none;
      }

      .nx-topbar {
        position: fixed;
        top: 14px;
        left: calc((100vw - var(--nx-right-panel)) / 2);
        z-index: 2147482200;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: min(520px, calc(100vw - var(--nx-right-panel) - 80px));
        min-height: 48px;
        padding: 6px;
        border: 1px solid var(--nx-line);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(17, 23, 35, 0.88), rgba(10, 15, 24, 0.84)),
          rgba(5, 7, 11, 0.74);
        color: var(--nx-text);
        box-shadow: var(--nx-shadow);
        backdrop-filter: blur(18px) saturate(1.12);
        transform: translateX(-50%);
      }

      .nx-command-title {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
        padding: 0 8px;
      }

      .nx-status-mark {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background:
          linear-gradient(135deg, rgba(220, 255, 63, 0.28), rgba(155, 120, 255, 0.16)),
          rgba(255, 255, 255, 0.05);
        color: var(--nx-accent);
        font-size: 18px;
        font-weight: 500;
        line-height: 1;
      }

      .nx-command-copy {
        min-width: 0;
      }

      .nx-command-copy strong {
        display: block;
        overflow: hidden;
        color: #ffffff;
        font-size: 13px;
        line-height: 1.1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nx-command-copy span {
        display: block;
        margin-top: 3px;
        color: var(--nx-muted);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .nx-top-actions,
      .nx-dock-controls,
      .nx-dock-actions,
      .nx-mode-tabs {
        display: flex;
        align-items: center;
      }

      .nx-top-actions {
        justify-content: flex-end;
        gap: 6px;
      }

      .nx-chip,
      .nx-icon-button,
      .nx-primary-button,
      .nx-ghost-button,
      .nx-mode-tab {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        border: 1px solid var(--nx-line);
        border-radius: 8px;
        background: rgba(15, 21, 32, 0.72);
        color: #e8eef8;
        font-size: 12px;
        font-weight: 750;
        line-height: 1;
        cursor: pointer;
        transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease;
      }

      .nx-chip {
        gap: 7px;
        padding: 0 10px;
        cursor: default;
      }

      .nx-chip::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--nx-accent);
        box-shadow: 0 0 0 4px rgba(220, 255, 63, 0.14);
      }

      .nx-icon-button {
        width: 34px;
        padding: 0;
      }

      .nx-primary-button,
      .nx-ghost-button {
        gap: 7px;
        padding: 0 12px;
        white-space: nowrap;
      }

      .nx-primary-button {
        border-color: rgba(220, 255, 63, 0.48);
        background:
          linear-gradient(135deg, rgba(220, 255, 63, 0.96), rgba(170, 255, 90, 0.86)),
          rgba(15, 21, 32, 0.82);
        color: #101306;
        box-shadow: 0 0 24px rgba(220, 255, 63, 0.16);
      }

      .nx-chip:hover,
      .nx-icon-button:hover,
      .nx-primary-button:hover,
      .nx-ghost-button:hover,
      .nx-mode-tab:hover {
        border-color: rgba(220, 255, 63, 0.46);
        background: rgba(21, 29, 43, 0.94);
        color: #ffffff;
        transform: translateY(-1px);
      }

      .nx-primary-button:hover {
        background: linear-gradient(135deg, #f0ff7a, var(--nx-accent-2));
        color: #101306;
      }

      .nx-studio-dock {
        position: fixed;
        top: 176px;
        left: var(--nx-left);
        z-index: 2147482100;
        display: grid;
        gap: 12px;
        width: 344px;
        max-height: calc(100vh - 212px);
        overflow: auto;
        padding: 12px;
        border: 1px solid var(--nx-line);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(17, 23, 35, 0.93), rgba(9, 14, 22, 0.9)),
          rgba(5, 7, 11, 0.86);
        color: var(--nx-text);
        box-shadow: var(--nx-shadow);
        backdrop-filter: blur(18px) saturate(1.12);
      }

      .nx-studio-dock::before {
        content: "";
        position: absolute;
        inset: 0 0 auto;
        height: 3px;
        border-radius: 8px 8px 0 0;
        background: linear-gradient(90deg, var(--nx-accent), var(--nx-purple), var(--nx-coral));
        opacity: 0.82;
      }

      .nx-studio-dock[data-collapsed="true"] {
        width: auto;
        max-width: 210px;
        overflow: visible;
      }

      .nx-studio-dock[data-collapsed="true"] .nx-dock-body,
      .nx-studio-dock[data-collapsed="true"] .nx-dock-subtitle,
      .nx-studio-dock[data-collapsed="true"] .nx-mode-tabs {
        display: none;
      }

      .nx-dock-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .nx-dock-title {
        min-width: 0;
      }

      .nx-eyebrow {
        display: inline-flex;
        align-items: center;
        height: 20px;
        margin-bottom: 6px;
        border: 1px solid rgba(220, 255, 63, 0.3);
        border-radius: 999px;
        background: rgba(220, 255, 63, 0.1);
        color: #d9f99d;
        padding: 0 8px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .nx-dock-title strong {
        display: block;
        color: #ffffff;
        font-size: 17px;
        line-height: 1.15;
      }

      .nx-dock-title span.nx-dock-subtitle {
        display: block;
        margin-top: 5px;
        color: var(--nx-muted);
        font-size: 12px;
        line-height: 1.45;
      }

      .nx-dock-controls {
        flex-shrink: 0;
        gap: 6px;
      }

      .nx-mode-tabs {
        gap: 6px;
        padding: 3px;
        border: 1px solid rgba(169, 181, 201, 0.14);
        border-radius: 8px;
        background: rgba(4, 7, 12, 0.38);
      }

      .nx-mode-tab {
        flex: 1;
        height: 30px;
        border-color: transparent;
        background: transparent;
        color: var(--nx-muted);
      }

      .nx-mode-tab[data-active="true"] {
        border-color: rgba(220, 255, 63, 0.44);
        background: rgba(220, 255, 63, 0.13);
        color: #f4ffd0;
      }

      .nx-dock-body {
        display: grid;
        gap: 10px;
      }

      .nx-prompt-box {
        display: grid;
        gap: 8px;
      }

      .nx-field-label {
        color: var(--nx-text-soft);
        font-size: 11px;
        font-weight: 800;
      }

      .nx-prompt-box textarea {
        width: 100%;
        min-height: 102px;
        resize: vertical;
        border: 1px solid rgba(169, 181, 201, 0.18);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(12, 17, 27, 0.86), rgba(5, 7, 11, 0.76));
        color: var(--nx-text);
        outline: none;
        padding: 11px;
        font: 500 12px/1.55 ui-sans-serif, system-ui, sans-serif;
      }

      .nx-prompt-box textarea::placeholder {
        color: rgba(138, 149, 168, 0.82);
      }

      .nx-prompt-box textarea:focus {
        border-color: rgba(220, 255, 63, 0.58);
        box-shadow: 0 0 0 3px rgba(220, 255, 63, 0.1);
      }

      .nx-prompt-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }

      .nx-select {
        width: 100%;
        height: 32px;
        border: 1px solid rgba(169, 181, 201, 0.18);
        border-radius: 8px;
        background: rgba(15, 21, 32, 0.82);
        color: #e8eef8;
        padding: 0 8px;
        font-size: 11px;
        font-weight: 750;
        outline: none;
      }

      .nx-preset-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .nx-preset-grid button {
        min-height: 50px;
        border: 1px solid rgba(169, 181, 201, 0.14);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.035);
        color: #cfd8e6;
        cursor: pointer;
        padding: 8px 9px;
        text-align: left;
        font-size: 10.5px;
        line-height: 1.35;
        transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
      }

      .nx-preset-grid button:hover {
        border-color: rgba(220, 255, 63, 0.38);
        background: rgba(220, 255, 63, 0.08);
        color: #ffffff;
      }

      .nx-dock-actions {
        justify-content: space-between;
        gap: 8px;
      }

      .nx-dock-actions .nx-primary-button {
        flex: 1;
      }

      .nx-canvas-hud {
        position: fixed;
        left: 456px;
        bottom: 18px;
        z-index: 2147482000;
        display: flex;
        align-items: center;
        gap: 10px;
        height: 38px;
        padding: 0 12px;
        border: 1px solid var(--nx-line);
        border-radius: 8px;
        background: rgba(7, 10, 16, 0.78);
        color: #dce6f5;
        box-shadow: 0 16px 44px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(14px);
        font-size: 11px;
        font-weight: 750;
      }

      .nx-hud-divider {
        width: 1px;
        height: 16px;
        background: rgba(169, 181, 201, 0.24);
      }

      .nx-empty-guide {
        position: fixed;
        top: 160px;
        left: 456px;
        z-index: 40;
        width: 430px;
        border: 1px solid rgba(169, 181, 201, 0.16);
        border-radius: 8px;
        background:
          radial-gradient(circle at 12% 0%, rgba(220, 255, 63, 0.12), transparent 34%),
          linear-gradient(180deg, rgba(17, 18, 14, 0.8), rgba(7, 8, 6, 0.72)),
          rgba(5, 7, 11, 0.58);
        color: var(--nx-text);
        padding: 18px;
        box-shadow: 0 20px 64px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        backdrop-filter: blur(16px);
      }

      .nx-empty-guide[data-visible="false"] {
        display: none;
      }

      .nx-empty-guide h2 {
        margin: 0;
        color: #ffffff;
        font-size: 30px;
        line-height: 1.02;
      }

      .nx-empty-guide p {
        margin: 10px 0 0;
        color: var(--nx-muted);
        font-size: 12px;
        line-height: 1.6;
      }

      .nx-hero-kicker {
        display: inline-flex;
        align-items: center;
        height: 24px;
        margin-bottom: 12px;
        border: 1px solid rgba(220, 255, 63, 0.28);
        border-radius: 999px;
        background: rgba(220, 255, 63, 0.09);
        color: #efffb0;
        padding: 0 10px;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .nx-hero-prompt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 48px;
        margin-top: 14px;
        border: 1px solid rgba(234, 244, 207, 0.16);
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.36);
        padding: 6px 6px 6px 14px;
      }

      .nx-hero-prompt span {
        color: #d7dec8;
        font-size: 12px;
        font-weight: 700;
      }

      .nx-hero-prompt b {
        display: inline-flex;
        align-items: center;
        height: 34px;
        border-radius: 8px;
        background: linear-gradient(135deg, var(--nx-accent), var(--nx-accent-2));
        color: #111407;
        padding: 0 12px;
        font-size: 12px;
        font-weight: 900;
      }

      .nx-hero-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
      }

      .nx-hero-tags span {
        border: 1px solid rgba(234, 244, 207, 0.14);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.035);
        color: var(--nx-text-soft);
        padding: 5px 8px;
        font-size: 10px;
        font-weight: 750;
      }

      .nx-guide-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        margin-top: 14px;
      }

      .nx-guide-item {
        position: relative;
        min-height: 88px;
        overflow: hidden;
        border: 1px solid rgba(169, 181, 201, 0.12);
        border-radius: 8px;
        background:
          linear-gradient(160deg, rgba(220, 255, 63, 0.12), transparent 42%),
          linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
        padding: 10px;
      }

      .nx-guide-index {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 8px;
        background: rgba(220, 255, 63, 0.12);
        color: #efffb0;
        font-size: 11px;
        font-weight: 850;
      }

      .nx-guide-item strong {
        display: block;
        margin-top: 20px;
        color: #f8fafc;
        font-size: 12px;
      }

      .nx-guide-item div > span {
        display: block;
        margin-top: 3px;
        color: var(--nx-muted);
        font-size: 11px;
        line-height: 1.4;
      }

      .nx-guide-item::after {
        content: "";
        position: absolute;
        right: -18px;
        bottom: -20px;
        width: 78px;
        height: 78px;
        border-radius: 999px;
        background: rgba(220, 255, 63, 0.08);
      }

      .nx-toast {
        position: fixed;
        left: calc((100vw - var(--nx-right-panel)) / 2);
        bottom: 20px;
        z-index: 2147482400;
        max-width: min(420px, calc(100vw - 32px));
        border: 1px solid rgba(220, 255, 63, 0.32);
        border-radius: 8px;
        background: rgba(6, 10, 16, 0.94);
        color: #f4ffd0;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.34);
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 750;
        opacity: 0;
        transform: translate(-50%, 8px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
      }

      .nx-toast[data-visible="true"] {
        opacity: 1;
        transform: translate(-50%, 0);
      }

      .nx-command-panel {
        position: fixed;
        top: 74px;
        left: calc((100vw - var(--nx-right-panel)) / 2);
        z-index: 2147482300;
        width: min(320px, calc(100vw - 36px));
        border: 1px solid var(--nx-line);
        border-radius: 8px;
        background: rgba(7, 10, 16, 0.94);
        color: var(--nx-text);
        box-shadow: var(--nx-shadow);
        padding: 10px;
        display: none;
        transform: translateX(-50%);
        backdrop-filter: blur(18px);
      }

      .nx-command-panel[data-open="true"] {
        display: block;
      }

      .nx-command-panel h3 {
        margin: 0 0 8px;
        color: #ffffff;
        font-size: 12px;
      }

      .nx-command-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 31px;
        border-top: 1px solid rgba(169, 181, 201, 0.12);
        color: #cbd5e1;
        font-size: 11px;
      }

      .nx-command-row:first-of-type {
        border-top: 0;
      }

      .nx-command-row kbd {
        border: 1px solid rgba(169, 181, 201, 0.24);
        border-radius: 6px;
        background: rgba(15, 21, 32, 0.82);
        color: #eef4ff;
        padding: 3px 6px;
        font: 700 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      }

      .${rootClass} .nx-api-config {
        top: 74px;
        right: 18px;
      }

      .${rootClass} .nx-api-button {
        border-color: rgba(220, 255, 63, 0.26);
        background: rgba(7, 10, 16, 0.9);
      }

      .${rootClass} .nx-api-button:hover {
        border-color: rgba(220, 255, 63, 0.58);
        background: rgba(24, 28, 17, 0.96);
      }

      .${rootClass} .nx-api-dot[data-ready="true"] {
        background: var(--nx-accent);
        box-shadow: 0 0 0 3px rgba(220, 255, 63, 0.18);
      }

      .${rootClass} .nx-api-panel {
        border-color: rgba(220, 255, 63, 0.2);
        background:
          radial-gradient(circle at 10% 0%, rgba(220, 255, 63, 0.1), transparent 34%),
          rgba(5, 6, 4, 0.96);
      }

      .${rootClass} .nx-api-field input:focus {
        border-color: rgba(220, 255, 63, 0.68);
      }

      .${rootClass} .nx-api-actions button[data-primary="true"] {
        border-color: rgba(220, 255, 63, 0.62);
        background: linear-gradient(135deg, var(--nx-accent), var(--nx-accent-2));
        color: #111407;
      }

      .${rootClass} .nx-api-status {
        color: #eaff8d;
      }

      .${rootClass} [class*="react-flow__pane"],
      .${rootClass} [class*="ReactFlow__pane"] {
        background:
          linear-gradient(rgba(169, 181, 201, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(169, 181, 201, 0.035) 1px, transparent 1px) !important;
        background-size: 30px 30px !important;
      }

      .${rootClass} [class*="react-flow__node"],
      .${rootClass} [class*="ReactFlow__node"] {
        border-radius: 8px !important;
        filter: drop-shadow(0 16px 26px rgba(0, 0, 0, 0.25));
      }

      .${rootClass} [class*="react-flow__node"]:hover,
      .${rootClass} [class*="ReactFlow__node"]:hover {
        filter: drop-shadow(0 18px 34px rgba(220, 255, 63, 0.18));
      }

      .${rootClass} [class*="react-flow__controls"],
      .${rootClass} [class*="ReactFlow__controls"] {
        border: 1px solid var(--nx-line) !important;
        border-radius: 8px !important;
        background: rgba(7, 10, 16, 0.78) !important;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28) !important;
        overflow: hidden !important;
        backdrop-filter: blur(12px);
      }

      .${rootClass} button:not(.nx-icon-button):not(.nx-primary-button):not(.nx-ghost-button):not(.nx-api-button):not(.nx-mode-tab) {
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }

      .${rootClass} button:not(.nx-icon-button):not(.nx-primary-button):not(.nx-ghost-button):not(.nx-api-button):not(.nx-mode-tab):hover {
        transform: translateY(-1px);
      }

      .${rootClass}.nx-focus-mode .nx-studio-dock,
      .${rootClass}.nx-focus-mode .nx-api-config,
      .${rootClass}.nx-focus-mode .nx-command-panel,
      .${rootClass}.nx-focus-mode .nx-empty-guide {
        display: none;
      }

      .${rootClass}.nx-focus-mode .nx-topbar {
        opacity: 0.22;
      }

      .${rootClass}.nx-login-mode .nx-studio-dock,
      .${rootClass}.nx-login-mode .nx-canvas-hud,
      .${rootClass}.nx-login-mode .nx-empty-guide {
        display: none;
      }

      .${rootClass}.nx-empty-home .nx-canvas-hud {
        display: none;
      }

      .${rootClass}.nx-empty-home [class*="react-flow__controls"],
      .${rootClass}.nx-empty-home [class*="ReactFlow__controls"],
      .${rootClass}.nx-empty-home [data-nx-native-controls="true"] {
        display: none !important;
      }

      .${rootClass}.nx-login-mode .nx-topbar,
      .${rootClass}.nx-login-mode .nx-api-config,
      .${rootClass}.nx-login-mode .nx-command-panel,
      .${rootClass}.nx-login-mode .nx-toast {
        display: none !important;
      }

      .${rootClass}.nx-login-mode,
      .${rootClass}.nx-login-mode #root {
        background:
          linear-gradient(180deg, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.88)),
          #000 !important;
      }

      .${rootClass}.nx-login-mode #root {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
      }

      .${rootClass}.nx-login-mode #root::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.78)),
          radial-gradient(circle at 50% 40%, rgba(255, 249, 125, 0.1), transparent 24%),
          url("/login-scene-bg.png") center / cover no-repeat;
        filter: brightness(0.74) saturate(0.98) blur(1px);
        transform: scale(1.02);
        opacity: 1;
      }

      .${rootClass}.nx-login-mode #root::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(ellipse at 50% 42%, rgba(0, 0, 0, 0.2) 0 24%, rgba(0, 0, 0, 0.34) 58%, rgba(0, 0, 0, 0.74) 100%),
          linear-gradient(90deg, rgba(0, 0, 0, 0.48), transparent 32%, transparent 68%, rgba(0, 0, 0, 0.56));
        z-index: 9;
      }

      .${rootClass}.nx-login-mode #root > div {
        background: transparent !important;
      }

      .${rootClass}.nx-login-mode #root > div > div[class*="absolute"][class*="inset-0"][class*="z-0"] {
        display: none !important;
      }

      .${rootClass}.nx-login-mode #root > div > div[class*="absolute"][class*="top-6"][class*="right-6"],
      .${rootClass}.nx-login-mode #root [class*="border-t"][class*="shrink-0"][class*="z-20"] {
        display: none !important;
      }

      .${rootClass}.nx-login-mode #root [data-nx-copyless="true"] {
        color: transparent !important;
        font-size: 0 !important;
        line-height: 0 !important;
        letter-spacing: 0 !important;
        text-shadow: none !important;
      }

      .${rootClass}.nx-login-mode #root [data-nx-copyless="true"] svg {
        color: rgba(141, 252, 223, 0.9) !important;
        width: 18px !important;
        height: 18px !important;
      }

      .${rootClass}.nx-login-mode #root label,
      .${rootClass}.nx-login-mode #root h2,
      .${rootClass}.nx-login-mode #root p {
        color: transparent !important;
        font-size: 0 !important;
        line-height: 0 !important;
        margin: 0 !important;
      }

      .${rootClass}.nx-login-mode #root h1 {
        margin: 0 0 18px !important;
        color: #fff !important;
        background: linear-gradient(180deg, #fffdf2 0%, #fff47a 45%, #f3f1dc 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        font-size: clamp(92px, 9vw, 158px) !important;
        font-weight: 950 !important;
        line-height: 0.92 !important;
        letter-spacing: 0 !important;
        text-shadow: 0 28px 80px rgba(255, 245, 117, 0.16) !important;
      }

      .${rootClass}.nx-login-mode #root form {
        display: grid !important;
        gap: 18px !important;
      }

      .${rootClass}.nx-login-mode #root form > div {
        margin: 0 !important;
      }

      .${rootClass}.nx-login-mode #root input {
        height: 64px !important;
        border: 1px solid rgba(255, 249, 125, 0.22) !important;
        border-radius: 18px !important;
        background:
          linear-gradient(180deg, rgba(8, 9, 7, 0.78), rgba(2, 3, 3, 0.9)) !important;
        color: #f8fffb !important;
        caret-color: #fff97d !important;
        box-shadow:
          0 12px 34px rgba(0, 0, 0, 0.28),
          inset 0 0 0 1px rgba(255, 255, 255, 0.02) !important;
        padding-left: 56px !important;
      }

      .${rootClass}.nx-login-mode #root input::placeholder {
        color: transparent !important;
      }

      .${rootClass}.nx-login-mode #root input:focus {
        border-color: rgba(255, 249, 125, 0.72) !important;
        box-shadow:
          0 0 0 4px rgba(255, 249, 125, 0.09),
          0 18px 46px rgba(0, 0, 0, 0.34) !important;
      }

      .${rootClass}.nx-login-mode #root form button[type="submit"] {
        position: relative;
        height: 68px !important;
        border: 1px solid rgba(255, 249, 125, 0.42) !important;
        border-radius: 999px !important;
        background:
          linear-gradient(135deg, rgba(255, 249, 125, 0.98), rgba(255, 242, 152, 0.92)) !important;
        color: transparent !important;
        box-shadow:
          0 18px 56px rgba(255, 249, 125, 0.16),
          inset 0 0 0 1px rgba(255, 255, 255, 0.36) !important;
      }

      .${rootClass}.nx-login-mode #root form button[type="submit"]::after {
        content: "";
        width: 18px;
        height: 18px;
        border-top: 4px solid #020706;
        border-right: 4px solid #020706;
        transform: rotate(45deg);
      }

      @media (max-width: 1180px) {
        :root {
          --nx-right-panel: 320px;
          --nx-left: 84px;
        }

        .nx-empty-guide {
          display: none;
        }

        .nx-studio-dock {
          width: 330px;
        }
      }

      @media (max-width: 980px) {
        :root {
          --nx-right-panel: 0px;
        }

        .nx-landing-nav {
          top: 12px;
          grid-template-columns: auto 1fr;
          width: calc(100vw - 24px);
          min-height: 72px;
          border-radius: 22px;
          padding: 0 18px;
        }

        .nx-landing-links {
          display: none;
        }

        .nx-landing-actions {
          gap: 12px;
        }

        .nx-landing-lang {
          display: none;
        }

        .nx-landing-cta {
          height: 46px;
          padding: 0 18px;
          font-size: 15px;
        }

        .nx-landing-hero-content {
          margin-top: 72px;
        }

        .nx-landing-title {
          font-size: clamp(48px, 13vw, 82px);
        }

        .nx-landing-subtitle {
          margin-top: 24px;
          font-size: 17px;
        }

        .nx-landing-hero-cta {
          min-width: 210px;
          height: 74px;
          margin-top: 38px;
          font-size: 24px;
        }

        .nx-landing-grid {
          grid-template-columns: 1fr;
        }

        .nx-landing-split,
        .nx-landing-showcase,
        .nx-landing-metrics,
        .nx-landing-faq,
        .nx-landing-footer-inner {
          grid-template-columns: 1fr;
        }

        .nx-landing-shot,
        .nx-landing-shot:nth-child(2),
        .nx-landing-shot:nth-child(4) {
          margin-top: 0;
        }

        .nx-topbar {
          left: 12px;
          right: 12px;
          width: auto;
          transform: none;
        }

        .nx-top-actions {
          overflow-x: auto;
          justify-content: flex-end;
          padding-bottom: 2px;
        }

        .nx-studio-dock {
          top: auto;
          right: 12px;
          left: 12px;
          bottom: 60px;
          width: auto;
          max-height: 46vh;
        }

        .nx-canvas-hud {
          right: 12px;
          left: 12px;
          bottom: 12px;
          justify-content: center;
        }

        .nx-toast,
        .nx-command-panel {
          left: 50%;
        }
      }

      @media (max-width: 640px) {
        .nx-topbar {
          top: 10px;
          align-items: stretch;
          flex-direction: column;
        }

        .nx-command-title {
          padding: 0 4px;
        }

        .nx-chip {
          display: none;
        }

        .nx-prompt-meta {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createButton(className, label, title, onClick) {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.textContent = label;
    if (title) button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }

  function openApiPanel() {
    const button = document.querySelector('.nx-api-button');
    if (button instanceof HTMLElement) {
      button.click();
      toast('API 设置已打开');
      return;
    }
    toast('API 面板还没有加载完成');
  }

  function buildPrompt() {
    const input = document.querySelector('[data-nx-prompt]');
    const prompt = input?.value?.trim() || '';
    if (!prompt) return '';

    const aspect = document.querySelector('[data-nx-aspect]')?.value || '';
    const style = document.querySelector('[data-nx-style]')?.value || '';
    const quality = document.querySelector('[data-nx-quality]')?.value || '';
    const mode = modeLabels[state.mode] || modeLabels.text;

    return [prompt, `模式：${mode}`, `画幅：${aspect}`, `风格：${style}`, `质量：${quality}`]
      .filter(Boolean)
      .join('\\n');
  }

  function copyPrompt() {
    const value = buildPrompt();
    if (!value) {
      toast('先写一句提示词');
      return;
    }
    navigator.clipboard?.writeText(value).then(
      () => toast('提示词已复制，可以粘到画布节点里使用'),
      () => toast('复制失败，请手动选择提示词'),
    );
  }

  function fillPreset(text) {
    const input = document.querySelector('[data-nx-prompt]');
    if (!input) return;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setMode(mode) {
    state.mode = mode;
    persist();
    syncState();
  }

  function toggleDock() {
    state.dockCollapsed = !state.dockCollapsed;
    persist();
    syncState();
  }

  function toggleFocus() {
    state.focus = !state.focus;
    persist();
    syncState();
    toast(state.focus ? '已进入专注画布' : '已退出专注模式');
  }

  function toggleCommands() {
    const panel = document.querySelector('.nx-command-panel');
    if (!panel) return;
    panel.dataset.open = panel.dataset.open === 'true' ? 'false' : 'true';
  }

  function enterApp() {
    landingActive = false;
    syncState();
    toast('已进入拟像画布');
  }

  function syncState() {
    document.body.classList.toggle('nx-landing-active', landingActive);
    document.body.classList.toggle('nx-focus-mode', !!state.focus);
    const dock = document.querySelector('.nx-studio-dock');
    if (dock) dock.dataset.collapsed = String(!!state.dockCollapsed);

    for (const button of document.querySelectorAll('[data-nx-mode]')) {
      button.dataset.active = String(button.dataset.nxMode === state.mode);
    }

    const focusButton = document.querySelector('[data-nx-focus]');
    if (focusButton) focusButton.textContent = state.focus ? '退出' : '专注';
  }

  let toastTimer = null;
  function toast(message) {
    const el = document.querySelector('.nx-toast');
    if (!el) return;
    el.textContent = message;
    el.dataset.visible = 'true';
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      el.dataset.visible = 'false';
    }, 2200);
  }

  function createLandingPage() {
    const page = document.createElement('main');
    page.className = 'nx-landing-page';
    page.innerHTML = `
      <nav class="nx-landing-nav" aria-label="主页导航">
        <a class="nx-landing-logo" href="#home" aria-label="拟像首页">
          <span class="nx-landing-logo-mark" aria-hidden="true"></span>
          <span>拟像</span>
        </a>
        <div class="nx-landing-links">
          <a href="#home">首页</a>
          <a href="#models">AI 模型</a>
          <a href="#showcase">作品展示</a>
          <a href="#pricing">定价</a>
        </div>
        <div class="nx-landing-actions">
          <button class="nx-landing-lang" type="button">中文⌄</button>
          <button class="nx-landing-cta" type="button" data-nx-enter-app>免费开始 →</button>
        </div>
      </nav>
      <section class="nx-landing-hero" id="home">
        <div class="nx-landing-hero-content">
          <h1 class="nx-landing-title">
            <span class="nx-landing-title-highlight">全自动</span>
            <span>AI 视频创作平台</span>
          </h1>
          <p class="nx-landing-subtitle">一站式 AI 视频生成器，覆盖剧本、分镜、镜头与剪辑。</p>
          <button class="nx-landing-hero-cta" type="button" data-nx-enter-app>免费开始</button>
        </div>
      </section>
      <section class="nx-landing-section" id="models">
        <span class="nx-landing-kicker">AI Models</span>
        <h2>一个入口，调度所有主流 AI 模型</h2>
        <p>把图像生成、视频生成、参考改图和多模型对比整合进一个画布工作流。填入自己的 API URL 后，就能按你的成本和模型策略运行。</p>
        <div class="nx-landing-grid">
          <div class="nx-landing-card"><strong>Image Agent</strong><span>文生图、参考图重绘、产品海报、社媒封面，统一放在画布节点中管理。</span></div>
          <div class="nx-landing-card"><strong>Video Agent</strong><span>从一句想法拆解成镜头方向，适合 UGC 广告、品牌片和短视频脚本。</span></div>
          <div class="nx-landing-card"><strong>API Router</strong><span>让团队填入自己的生成服务地址，减少中间加价，方便部署给更多人使用。</span></div>
        </div>
        <div class="nx-landing-metrics" aria-label="平台能力数据">
          <div class="nx-landing-metric"><strong>30+</strong><span>可接入的视频、图像与多模态生成模型</span></div>
          <div class="nx-landing-metric"><strong>1</strong><span>统一画布入口，集中管理提示词、参考图与结果</span></div>
          <div class="nx-landing-metric"><strong>API</strong><span>支持自带服务地址，适配 Railway 部署后的多人使用</span></div>
        </div>
      </section>
      <section class="nx-landing-section">
        <div class="nx-landing-split">
          <div>
            <span class="nx-landing-kicker">Ad Creatives</span>
            <h2>用 AI 批量生成更好的视频广告</h2>
            <p>围绕短视频投放常见流程，快速测试开场钩子、口播脚本、产品卖点、封面方向和不同平台比例。</p>
            <div class="nx-landing-pill-grid" aria-label="广告创意类型">
              <span class="nx-landing-pill">UGC 开箱</span>
              <span class="nx-landing-pill">真人口播</span>
              <span class="nx-landing-pill">产品细节</span>
              <span class="nx-landing-pill">Founder Hook</span>
              <span class="nx-landing-pill">社媒封面</span>
              <span class="nx-landing-pill">A/B 版本</span>
            </div>
          </div>
          <div class="nx-landing-showcase" aria-label="广告创意展示">
            <div class="nx-landing-shot"><strong>Skincare</strong><span>自然光产品展示 · UGC 口播</span></div>
            <div class="nx-landing-shot"><strong>Fitness</strong><span>竖屏节奏剪辑 · App testimonial</span></div>
            <div class="nx-landing-shot"><strong>DTC</strong><span>创始人钩子 · 三秒留存测试</span></div>
            <div class="nx-landing-shot"><strong>Tech</strong><span>功能演示 · 多版本 cutdown</span></div>
          </div>
        </div>
      </section>
      <section class="nx-landing-section">
        <span class="nx-landing-kicker">Toolbox</span>
        <h2>真正会用到的创作动作，都放进画布</h2>
        <p>从一帧重做、角色连续性、参考图重绘到分镜拆解，把“生成一次”变成可以反复迭代的生产工作流。</p>
        <div class="nx-landing-grid">
          <div class="nx-landing-card"><strong>Re-roll any frame</strong><span>选中一张结果，重新生成同构图的新版本，快速替换情绪、光线和质感。</span></div>
          <div class="nx-landing-card"><strong>Auto-continuity</strong><span>把角色、道具和风格要求留在节点关系里，下一轮生成不必重复解释。</span></div>
          <div class="nx-landing-card"><strong>Storyboard mode</strong><span>把想法拆成镜头卡片，逐步补充画面描述、参考图和输出比例。</span></div>
          <div class="nx-landing-card"><strong>Reference edit</strong><span>拖入参考图后在原图基础上改，适合产品图、人物一致性和风格迁移。</span></div>
          <div class="nx-landing-card"><strong>Canvas archive</strong><span>每次生成结果都留在无限画布中，方便和团队复盘、对比和继续延展。</span></div>
          <div class="nx-landing-card"><strong>Export anywhere</strong><span>生成素材可用于短视频、广告封面、项目提案和后续剪辑素材整理。</span></div>
        </div>
      </section>
      <section class="nx-landing-section" id="showcase">
        <span class="nx-landing-kicker">Showcase</span>
        <h2>作品、素材、版本，都沉淀在同一个无限画布</h2>
        <p>每一次提示词、参考图、生成结果和修改记录都能留成节点，方便复盘、对比和继续扩写成完整项目。</p>
        <div class="nx-landing-grid">
          <div class="nx-landing-card"><strong>UGC 广告</strong><span>快速生成开场钩子、产品卖点、真人口播和结尾 CTA 的视觉方案。</span></div>
          <div class="nx-landing-card"><strong>品牌片</strong><span>把品牌调性、参考图和分镜组合成一套可持续迭代的视觉板。</span></div>
          <div class="nx-landing-card"><strong>社媒短片</strong><span>按 9:16、4:5、16:9 输出不同平台版本，统一管理素材和方向。</span></div>
        </div>
      </section>
      <section class="nx-landing-section" id="pricing">
        <span class="nx-landing-kicker">Pricing</span>
        <h2>先免费开始，再接入你自己的模型成本</h2>
        <p>本地部署默认可试用画布能力。真正生成时，你可以在 API 设置里填入自己的服务地址和 key。</p>
        <div class="nx-landing-grid">
          <div class="nx-landing-card nx-landing-pricing-card"><strong>Free</strong><span class="nx-landing-price">0 元</span><span>本地打开、整理提示词、搭建项目画布和演示原型。</span></div>
          <div class="nx-landing-card nx-landing-pricing-card" data-featured="true"><strong>Bring Your API</strong><span class="nx-landing-price">自带成本</span><span>连接自有 API URL，按你的服务计费，不被额外产品层绑死。</span></div>
          <div class="nx-landing-card nx-landing-pricing-card"><strong>Team Deploy</strong><span class="nx-landing-price">按部署</span><span>部署到 Railway 后，让更多人通过浏览器直接使用。</span></div>
        </div>
      </section>
      <section class="nx-landing-section">
        <span class="nx-landing-kicker">FAQ</span>
        <h2>常见问题</h2>
        <div class="nx-landing-faq">
          <details open><summary>拟像是什么？</summary><p>它是一个基于无限画布的 AI 视频与图像创作入口，用来管理提示词、参考图、生成结果和版本。</p></details>
          <details><summary>一定要使用固定模型吗？</summary><p>不需要。你可以在 API 面板中填入自己的服务 URL 和密钥，按自己的模型和成本策略运行。</p></details>
          <details><summary>适合生产系统吗？</summary><p>当前更适合想法验证、Demo 展示和内部原型。正式商用前还需要权限、计费、稳定性和内容安全策略。</p></details>
          <details><summary>部署后别人怎么用？</summary><p>部署到 Railway 后，团队成员打开浏览器即可进入首页，点击免费开始后在画布内填写 API 配置并开始生成。</p></details>
        </div>
      </section>
      <section class="nx-landing-section">
        <div class="nx-landing-split">
          <div>
            <span class="nx-landing-kicker">Yours to direct</span>
            <h2>你的想法，你的工具，由你导演</h2>
            <p>先用首页承接用户，再用画布完成真正的创作流程。它使用拟像自己的电影感首屏，也支持你自己的 API 和部署逻辑。</p>
          </div>
          <div class="nx-landing-card">
            <strong>进入创作画布</strong>
            <span>点击免费开始后隐藏官网首页，打开无限画布、API 配置、生图与参考图改图工作流。</span>
            <button class="nx-landing-hero-cta" type="button" data-nx-enter-app>免费开始</button>
          </div>
        </div>
      </section>
      <footer class="nx-landing-footer">
        <div class="nx-landing-footer-inner">
          <div>
            <strong>拟像</strong>
            <p>一个个人 AI 影像工作室。把想法、模型、参考素材和生成结果放进同一个连续画布。</p>
          </div>
          <div><strong>Product</strong><a href="#home">首页</a><a href="#models">AI 模型</a><a href="#pricing">定价</a></div>
          <div><strong>Make</strong><a href="#showcase">作品展示</a><a href="#home">创作画布</a><a href="#models">提示词库</a></div>
          <div><strong>Resources</strong><a href="#models">API</a><a href="#pricing">Railway 部署</a><a href="#showcase">案例</a></div>
          <div><strong>Legal</strong><p>请替换为你自己的品牌名、条款、隐私政策和内容规范后再公开上线。</p></div>
        </div>
      </footer>
    `;

    page.querySelectorAll('[data-nx-enter-app]').forEach((button) => {
      button.addEventListener('click', enterApp);
    });

    page.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const id = link.getAttribute('href');
        const target = id ? page.querySelector(id) : null;
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.body.appendChild(page);
  }

  function createTopbar() {
    const topbar = document.createElement('header');
    topbar.className = 'nx-topbar';
    topbar.innerHTML = `
      <div class="nx-command-title">
        <div class="nx-status-mark" aria-hidden="true">+</div>
        <div class="nx-command-copy">
          <strong>拟像 Agent Studio</strong>
          <span>AI Video & Image Agent</span>
        </div>
      </div>
      <div class="nx-top-actions">
        <div class="nx-chip"><b>Ready to Direct</b></div>
      </div>
    `;

    const actions = topbar.querySelector('.nx-top-actions');
    const focusButton = createButton('nx-primary-button', '专注', '隐藏辅助面板，专注画布', toggleFocus);
    focusButton.dataset.nxFocus = 'true';
    actions.append(
      createButton('nx-ghost-button', 'API', '打开 API 设置', openApiPanel),
      focusButton,
      createButton('nx-icon-button', '?', '快捷键', toggleCommands),
    );

    document.body.appendChild(topbar);
  }

  function createDock() {
    const dock = document.createElement('aside');
    dock.className = 'nx-studio-dock';
    dock.dataset.collapsed = String(!!state.dockCollapsed);

    dock.innerHTML = `
      <div class="nx-dock-head">
        <div class="nx-dock-title">
          <span class="nx-eyebrow">Creative Console</span>
          <strong>导演控制台</strong>
          <span class="nx-dock-subtitle">从文字、图片或视频出发，生成 UGC 广告、品牌片和社交内容。</span>
        </div>
        <div class="nx-dock-controls"></div>
      </div>
      <div class="nx-mode-tabs" aria-label="生成模式">
        <button class="nx-mode-tab" type="button" data-nx-mode="text">文本开拍</button>
        <button class="nx-mode-tab" type="button" data-nx-mode="reference">参考续拍</button>
      </div>
      <div class="nx-dock-body">
        <div class="nx-prompt-box">
          <label class="nx-field-label" for="nx-prompt-input">创作指令</label>
          <textarea id="nx-prompt-input" data-nx-prompt spellcheck="false" placeholder="告诉拟像你想拍什么：产品广告、品牌片、剧情短片..."></textarea>
          <div class="nx-prompt-meta">
            <select class="nx-select" data-nx-aspect aria-label="画幅">
              <option>16:9 影视横版</option>
              <option>1:1 方图</option>
              <option>4:5 社媒图</option>
              <option>9:16 竖版</option>
            </select>
            <select class="nx-select" data-nx-style aria-label="风格">
              <option>UGC 广告</option>
              <option>品牌大片</option>
              <option>电影分镜</option>
              <option>产品海报</option>
            </select>
            <select class="nx-select" data-nx-quality aria-label="质量">
              <option>High detail</option>
              <option>Fast draft</option>
              <option>Reference edit</option>
            </select>
          </div>
          <div class="nx-preset-grid" data-nx-presets></div>
          <div class="nx-dock-actions">
            <button class="nx-ghost-button" type="button" data-nx-clear>清空</button>
            <button class="nx-primary-button" type="button" data-nx-copy>开始创作</button>
          </div>
        </div>
      </div>
    `;

    const controls = dock.querySelector('.nx-dock-controls');
    controls.append(
      createButton('nx-icon-button', 'API', '打开 API 设置', openApiPanel),
      createButton('nx-icon-button', '-', '折叠导演控制台', toggleDock),
    );

    for (const button of dock.querySelectorAll('[data-nx-mode]')) {
      button.addEventListener('click', () => setMode(button.dataset.nxMode));
    }

    const presetRoot = dock.querySelector('[data-nx-presets]');
    for (const preset of presets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = preset;
      button.addEventListener('click', () => fillPreset(preset));
      presetRoot.appendChild(button);
    }

    dock.querySelector('[data-nx-copy]').addEventListener('click', copyPrompt);
    dock.querySelector('[data-nx-clear]').addEventListener('click', () => fillPreset(''));

    document.body.appendChild(dock);
  }

  function createHud() {
    const hud = document.createElement('div');
    hud.className = 'nx-canvas-hud';
    hud.innerHTML = `
      <span data-nx-node-count>0 节点</span>
      <span class="nx-hud-divider"></span>
      <span data-nx-current-mode>文生视觉</span>
    `;
    document.body.appendChild(hud);
  }

  function createEmptyGuide() {
    const guide = document.createElement('section');
    guide.className = 'nx-empty-guide';
    guide.dataset.visible = 'false';
    guide.innerHTML = `
      <span class="nx-hero-kicker">Autonomous AI Creation Platform</span>
      <h2>把一个想法变成可投放的视觉内容</h2>
      <p>拟像把提示词、参考图、生成结果和版本对比放进同一个无限画布，让每个人都能像导演一样创作。</p>
      <div class="nx-hero-prompt">
        <span>告诉拟像你想做什么</span>
        <b>Start free</b>
      </div>
      <div class="nx-hero-tags">
        <span>UGC 广告</span>
        <span>品牌片</span>
        <span>社媒短片</span>
        <span>多模型工作流</span>
      </div>
      <div class="nx-guide-list">
        <div class="nx-guide-item"><span class="nx-guide-index">01</span><div><strong>Director Agent</strong><span>把一句想法拆成画面、风格和输出规格。</span></div></div>
        <div class="nx-guide-item"><span class="nx-guide-index">02</span><div><strong>Visual Canvas</strong><span>把参考图、提示词和生成结果沉淀成节点。</span></div></div>
        <div class="nx-guide-item"><span class="nx-guide-index">03</span><div><strong>Model Router</strong><span>填入自己的 API URL，走你自己的生成服务。</span></div></div>
        <div class="nx-guide-item"><span class="nx-guide-index">04</span><div><strong>Ship Faster</strong><span>快速对比方案，拿到能演示的视觉原型。</span></div></div>
      </div>
    `;
    document.body.appendChild(guide);
  }

  function createCommandPanel() {
    const panel = document.createElement('section');
    panel.className = 'nx-command-panel';
    panel.dataset.open = 'false';
    panel.innerHTML = `
      <h3>快捷操作</h3>
      <div class="nx-command-row"><span>专注画布</span><kbd>F</kbd></div>
      <div class="nx-command-row"><span>打开 API 设置</span><kbd>A</kbd></div>
      <div class="nx-command-row"><span>折叠导演控制台</span><kbd>D</kbd></div>
      <div class="nx-command-row"><span>隐藏本面板</span><kbd>?</kbd></div>
    `;
    document.body.appendChild(panel);
  }

  function createToast() {
    const el = document.createElement('div');
    el.className = 'nx-toast';
    el.dataset.visible = 'false';
    document.body.appendChild(el);
  }

  function markNativeCanvasControls() {
    for (const el of document.querySelectorAll('[data-nx-native-controls="true"]')) {
      el.removeAttribute('data-nx-native-controls');
    }

    for (const el of document.querySelectorAll('span')) {
      if (el.textContent?.trim() !== '100%') continue;
      let candidate = el.parentElement;
      while (candidate && candidate !== document.body) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width >= 150 && rect.width <= 260 && rect.height >= 32 && rect.height <= 68) {
          candidate.dataset.nxNativeControls = 'true';
          break;
        }
        candidate = candidate.parentElement;
      }
    }
  }

  function scrubLoginCopy(loginMode) {
    const marked = document.querySelectorAll('[data-nx-copyless="true"]');
    if (!loginMode) {
      marked.forEach((el) => {
        el.removeAttribute('data-nx-copyless');
      });
      document.querySelectorAll('#root input[data-nx-old-placeholder]').forEach((input) => {
        input.setAttribute('placeholder', input.dataset.nxOldPlaceholder || '');
        delete input.dataset.nxOldPlaceholder;
      });
      return;
    }

    const copyTargets = document.querySelectorAll(
      '#root h1, #root h2, #root h3, #root p, #root label, #root span, #root strong, #root a, #root button',
    );
    copyTargets.forEach((el) => {
      if (!el.isConnected || el.closest('.nx-landing-page')) return;
      if (el.matches('input, textarea, select') || el.querySelector('input, textarea, select')) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 120) return;
      if (el.tagName === 'H1' && text.includes('拟像')) return;
      el.dataset.nxCopyless = 'true';
      if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !el.getAttribute('aria-label')) {
        el.setAttribute('aria-label', text);
      }
    });

    document.querySelectorAll('#root input').forEach((input) => {
      if (!input.dataset.nxOldPlaceholder) {
        input.dataset.nxOldPlaceholder = input.getAttribute('placeholder') || '';
      }
      input.setAttribute('placeholder', '');
    });
  }

  function updateStats() {
    const bodyText = document.body.innerText || '';
    let nodeCount = document.querySelectorAll('[class*="react-flow__node"], [class*="ReactFlow__node"]').length;
    if (nodeCount === 0) {
      const demoNodeHints = ['API 节点矩阵', '图像生成器', '视频生成器', '分镜表 / 表格节点'];
      nodeCount = demoNodeHints.filter((hint) => bodyText.includes(hint)).length;
    }
    const loginMode = nodeCount === 0 && /ACCOUNT|PASSWORD|进入系统|LOGIN|REGISTER/.test(bodyText);
    const emptyHome = nodeCount === 0 && !loginMode;
    document.body.classList.toggle('nx-login-mode', loginMode);
    document.body.classList.toggle('nx-empty-home', emptyHome);
    markNativeCanvasControls();
    scrubLoginCopy(loginMode);

    const label = document.querySelector('[data-nx-node-count]');
    if (label) label.textContent = `${nodeCount} 节点`;

    const modeLabel = document.querySelector('[data-nx-current-mode]');
    if (modeLabel) modeLabel.textContent = modeLabels[state.mode] || modeLabels.text;

    const guide = document.querySelector('.nx-empty-guide');
    if (guide) guide.dataset.visible = String(emptyHome);
  }

  function installKeyboard() {
    window.addEventListener('keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tagName = event.target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFocus();
      }
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        openApiPanel();
      }
      if (event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        toggleDock();
      }
      if (event.key === '?') {
        event.preventDefault();
        toggleCommands();
      }
    });
  }

  function rewriteBranding() {
    const replacements = new Map([
      ['共创无限画布', 'AI VIDEO & IMAGE AGENT'],
    ]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue.trim();
      if (replacements.has(value)) {
        node.nodeValue = replacements.get(value);
      }
    }
  }

  function boot() {
    if (document.body.classList.contains(rootClass)) return;
    document.body.classList.add(rootClass);
    document.title = '拟像：AI 视频与图像 Agent';
    addStyle();
    createLandingPage();
    createTopbar();
    createDock();
    createHud();
    createEmptyGuide();
    createCommandPanel();
    createToast();
    installKeyboard();
    syncState();
    rewriteBranding();
    updateStats();

    let scheduled = false;
    const scheduleRefresh = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        rewriteBranding();
        updateStats();
      });
    };

    const observer = new MutationObserver(() => {
      scheduleRefresh();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
