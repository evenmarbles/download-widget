/**
 * Brochure Popup Widget (iframe modal + UTM + success screen)
 * - Mount: <div data-brochure-widget ...></div>
 * - Opens a modal with iframe (scripts run)
 * - Appends UTM params to iframe URL
 * - Listens for postMessage:
 *    - { type: "VO_IFRAME_HEIGHT", height: number }
 *    - { type: "VO_SUCCESS", message?: string, autocloseMs?: number }
 */
(function () {
  "use strict";

  const DEFAULTS = {
    iframeUrl: "", // REQUIRED
    buttonText: "Download brochure",
    buttonClass: "",
    zIndex: 9999,
    maxWidth: 540,
    maxHeightVh: 85,
    overlayClose: true,
    escClose: true,
    showCloseButton: true,
    iframeTitle: "Brochure Signup",

    // Auto-resize iframe height (optional)
    autoResize: true,

    // Security: restrict allowed message origins (recommended)
    // Example: ["https://yourdomain.com"]
    allowedMessageOrigins: [],

    // Success UI
    successTitle: "Success!",
    successMessage: "Thanks — your brochure is on the way.",
    successAutoCloseMs: 2500, // default autoclose if iframe doesn’t specify
    showSuccessCloseButton: true,

    // UTM defaults (optional; can be overridden by data-utm-*)
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: ""
  };

  function merge(a, b) {
    const out = Object.assign({}, a);
    for (const k in b) out[k] = b[k];
    return out;
  }

  function toNum(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function parseBool(v, fallback) {
    if (v === undefined || v === null || v === "") return fallback;
    return String(v).toLowerCase() !== "false";
  }

  function buildUrlWithUtm(baseUrl, utm) {
    try {
      const u = new URL(baseUrl, window.location.href);

      // Only set if value is provided (don’t overwrite existing params unless you want to)
      const map = {
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_content: utm.utm_content,
        utm_term: utm.utm_term
      };

      Object.keys(map).forEach((k) => {
        const val = map[k];
        if (val) u.searchParams.set(k, val);
      });

      return u.toString();
    } catch (e) {
      // Fallback: if URL() fails for any reason, return original
      return baseUrl;
    }
  }

  function buildModal(opts) {
    let overlay = document.getElementById("vo-brochure-modal");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "vo-brochure-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(0,0,0,0.6);
      z-index: ${opts.zIndex};
    `;

    const panel = document.createElement("div");
    panel.id = "vo-brochure-panel";
    panel.style.cssText = `
      position: relative;
      width: min(${opts.maxWidth}px, 100%);
      height: min(${opts.maxHeightVh}vh, 485px);
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 18px 60px rgba(0,0,0,0.35);
      overflow: hidden;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 25px 25px 0 25px;
      background: #fff;
      height: 59px;
      box-sizing: border-box;
    `;

    const headerText = document.createElement("div");
    headerText.type = "div";
    headerText.style.cssText = `
      width: 100%;
      height: 38px;
      padding: 0 0 0 32px;
      font-family: Poppins, "sans-serif";
      font-size: 20px;
      font-weight: 500;
      color: #4f5758;
      text-transform: capitalize;
      line-height: 1;
      display: grid;
      text-algin: left;
      aglin-items: center;
    `;
    headerText.textContent = "Download Brochure";
    header.appendChild(headerText);
    
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close popup");
    closeBtn.style.cssText = `
      width: 38px;
      height: 38px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,0.15);
      background: #fff;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      display: grid;
      place-items: center;
    `;
    closeBtn.textContent = "×";
    if (opts.showCloseButton) header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.id = "vo-brochure-body";
    body.style.cssText = `
      width: 100%;
      height: calc(100% - 59px);
      background: #fff;
      position: relative;
    `;

    // Iframe view
    const iframeWrap = document.createElement("div");
    iframeWrap.id = "vo-brochure-iframe-wrap";
    iframeWrap.style.cssText = `width:100%; height:100%;`;

    const iframe = document.createElement("iframe");
    iframe.id = "vo-brochure-iframe";
    iframe.title = opts.iframeTitle;
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("loading", "lazy");
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    `;
    iframeWrap.appendChild(iframe);

    // Success view (hidden by default)
    const success = document.createElement("div");
    success.id = "vo-brochure-success";
    success.style.cssText = `
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 22px;
      background: #fff;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      text-align: center;
    `;

    const successCard = document.createElement("div");
    successCard.style.cssText = `
      width: min(520px, 100%);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 14px;
      padding: 18px;
      box-shadow: 0 10px 35px rgba(0,0,0,0.08);
    `;

    const successH = document.createElement("div");
    successH.id = "vo-success-title";
    successH.style.cssText = `font-weight: 800; font-size: 20px; margin-bottom: 8px;`;
    successH.textContent = opts.successTitle;

    const successP = document.createElement("div");
    successP.id = "vo-success-message";
    successP.style.cssText = `opacity: 0.85; font-size: 14px; line-height: 1.4; margin-bottom: 14px;`;
    successP.textContent = opts.successMessage;

    const successClose = document.createElement("button");
    successClose.type = "button";
    successClose.textContent = "Close";
    successClose.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.18);
      background: #111;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    `;
    if (!opts.showSuccessCloseButton) successClose.style.display = "none";

    successCard.appendChild(successH);
    successCard.appendChild(successP);
    successCard.appendChild(successClose);
    success.appendChild(successCard);

    body.appendChild(iframeWrap);
    body.appendChild(success);

    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let autoCloseTimer = null;

    function clearAutoClose() {
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }
    }

    function hideModal() {
      clearAutoClose();
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");

      // Reset views
      const s = document.getElementById("vo-brochure-success");
      const wrap = document.getElementById("vo-brochure-iframe-wrap");
      if (s) s.style.display = "none";
      if (wrap) wrap.style.display = "block";

      // Clear iframe src (prevents background activity; comment out if you want state preserved)
      const fr = document.getElementById("vo-brochure-iframe");
      if (fr) fr.src = "about:blank";
    }

    function showModal() {
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      if (opts.showCloseButton) closeBtn.focus();
    }

    function showSuccess(message, autocloseMs) {
      clearAutoClose();

      const s = document.getElementById("vo-brochure-success");
      const wrap = document.getElementById("vo-brochure-iframe-wrap");
      const msgEl = document.getElementById("vo-success-message");
      const titleEl = document.getElementById("vo-success-title");

      if (wrap) wrap.style.display = "none";
      if (s) s.style.display = "flex";

      if (titleEl) titleEl.textContent = opts.successTitle;
      if (msgEl) msgEl.textContent = message || opts.successMessage;

      const ms = toNum(autocloseMs, opts.successAutoCloseMs);
      if (ms > 0) autoCloseTimer = setTimeout(hideModal, ms);
    }

    // Attach to overlay for external access
    overlay.__voShow = showModal;
    overlay.__voHide = hideModal;
    overlay.__voShowSuccess = showSuccess;

    // Close handlers
    if (opts.showCloseButton) closeBtn.addEventListener("click", hideModal);
    successClose.addEventListener("click", hideModal);

    if (opts.overlayClose) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) hideModal();
      });
    }

    if (opts.escClose) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.style.display === "flex") hideModal();
      });
    }

    return overlay;
  }

  function setIframeSrc(url) {
    const iframe = document.getElementById("vo-brochure-iframe");
    if (!iframe) return;
    iframe.src = url;
  }

  function initPostMessageHandlers(opts) {
    window.addEventListener("message", (event) => {
      // origin allowlist (recommended)
      if (Array.isArray(opts.allowedMessageOrigins) && opts.allowedMessageOrigins.length) {
        if (!opts.allowedMessageOrigins.includes(event.origin)) return;
      }

      if (!event.data || typeof event.data !== "object") return;

      // Resize
      if (opts.autoResize && event.data.type === "VO_IFRAME_HEIGHT") {
        const iframe = document.getElementById("vo-brochure-iframe");
        const body = document.getElementById("vo-brochure-body");
        if (!iframe || !body) return;

        const h = toNum(event.data.height, 0);
        if (h > 0) {
          const max = body.clientHeight; // already excludes header
          iframe.style.height = Math.min(h, max) + "px";
        }
        return;
      }

      // Success
      if (event.data.type === "VO_SUCCESS") {
        const overlay = document.getElementById("vo-brochure-modal");
        if (!overlay || typeof overlay.__voShowSuccess !== "function") return;

        const message = typeof event.data.message === "string" ? event.data.message : "";
        const autocloseMs = event.data.autocloseMs;
        overlay.__voShowSuccess(message, autocloseMs);
      }
    });
  }

  function initOne(el) {
    const d = el.dataset || {};

    const opts = merge(DEFAULTS, {
      iframeUrl: d.iframeUrl || d.popupUrl || DEFAULTS.iframeUrl,
      buttonText: d.buttonText || DEFAULTS.buttonText,
      buttonClass: d.buttonClass || DEFAULTS.buttonClass,
      zIndex: d.zIndex ? toNum(d.zIndex, DEFAULTS.zIndex) : DEFAULTS.zIndex,
      maxWidth: d.maxWidth ? toNum(d.maxWidth, DEFAULTS.maxWidth) : DEFAULTS.maxWidth,
      maxHeightVh: d.maxHeightVh ? toNum(d.maxHeightVh, DEFAULTS.maxHeightVh) : DEFAULTS.maxHeightVh,
      overlayClose: parseBool(d.overlayClose, DEFAULTS.overlayClose),
      escClose: parseBool(d.escClose, DEFAULTS.escClose),
      showCloseButton: parseBool(d.showCloseButton, DEFAULTS.showCloseButton),
      iframeTitle: d.iframeTitle || DEFAULTS.iframeTitle,

      autoResize: parseBool(d.autoResize, DEFAULTS.autoResize),
      allowedMessageOrigins: d.allowedMessageOrigins
        ? d.allowedMessageOrigins.split(",").map((s) => s.trim()).filter(Boolean)
        : DEFAULTS.allowedMessageOrigins,

      successTitle: d.successTitle || DEFAULTS.successTitle,
      successMessage: d.successMessage || DEFAULTS.successMessage,
      successAutoCloseMs: d.successAutoCloseMs ? toNum(d.successAutoCloseMs, DEFAULTS.successAutoCloseMs) : DEFAULTS.successAutoCloseMs,
      showSuccessCloseButton: parseBool(d.showSuccessCloseButton, DEFAULTS.showSuccessCloseButton),

      // UTM from data-utm-*
      utm_source: d.utmSource || DEFAULTS.utm_source,
      utm_medium: d.utmMedium || DEFAULTS.utm_medium,
      utm_campaign: d.utmCampaign || DEFAULTS.utm_campaign,
      utm_content: d.utmContent || DEFAULTS.utm_content,
      utm_term: d.utmTerm || DEFAULTS.utm_term
    });

    if (!opts.iframeUrl) {
      el.innerHTML = `<div style="font-family:system-ui;color:#b00020;">
        Brochure widget error: <code>data-iframe-url</code> is required.
      </div>`;
      return;
    }

    const overlay = buildModal(opts);
    initPostMessageHandlers(opts);

    // Render button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opts.buttonText;
    btn.style.cssText = `
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:12px 16px;
      border-radius:999px;
      border:1px solid rgba(0,0,0,0.18);
      background:#0b5fff;
      color:#fff;
      font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
      cursor:pointer;
    `;
    if (opts.buttonClass) btn.className = opts.buttonClass;

    btn.addEventListener("click", () => {
      // Reset success view each open
      const s = document.getElementById("vo-brochure-success");
      const wrap = document.getElementById("vo-brochure-iframe-wrap");
      if (s) s.style.display = "none";
      if (wrap) wrap.style.display = "block";

      const urlWithUtm = buildUrlWithUtm(opts.iframeUrl, opts);
      setIframeSrc(urlWithUtm);
      overlay.__voShow();
    });

    el.innerHTML = "";
    el.appendChild(btn);
  }

  function initAll() {
    document.querySelectorAll("[data-brochure-widget]").forEach(initOne);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  window.BrochurePopupWidget = { init: initAll };
})();



