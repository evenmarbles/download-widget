/**
 * Brochure Popup Widget – Borderless / Full-bleed iframe
 */
(function () {
  "use strict";

  const DEFAULTS = {
    iframeUrl: "",
    buttonText: "Download brochure",
    buttonClass: "",
    zIndex: 9999,
    maxWidth: 900,
    maxHeightVh: 90,

    overlayClose: true,
    escClose: true,

    autoResize: true,
    allowedMessageOrigins: [],

    // Success UI
    successMessage: "Thanks — your brochure is on the way.",
    successAutoCloseMs: 3000,

    // UTM
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: ""
  };

  const merge = (a, b) => Object.assign({}, a, b);
  const num = (v, f) => (isFinite(+v) ? +v : f);
  const bool = (v, f) => (v == null ? f : String(v) !== "false");

  function buildUrl(base, utm) {
    const u = new URL(base, location.href);
    ["source", "medium", "campaign", "content", "term"].forEach(k => {
      const val = utm["utm_" + k];
      if (val) u.searchParams.set("utm_" + k, val);
    });
    return u.toString();
  }

  function buildModal(opts) {
    if (document.getElementById("vo-modal")) return;

    const overlay = document.createElement("div");
    overlay.id = "vo-modal";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.65);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: ${opts.zIndex};
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      width: min(${opts.maxWidth}px, 100%);
      height: min(${opts.maxHeightVh}vh, 100%);
      background: transparent;
      border-radius: 0;
      overflow: hidden;
    `;

    const iframe = document.createElement("iframe");
    iframe.id = "vo-iframe";
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      display: block;
      background: transparent;
    `;
    iframe.setAttribute("loading", "lazy");

    const success = document.createElement("div");
    success.id = "vo-success";
    success.style.cssText = `
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      font-family: system-ui;
      background: white;
    `;
    success.innerHTML = `<div id="vo-success-text"></div>`;

    panel.appendChild(iframe);
    panel.appendChild(success);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.__show = () => overlay.style.display = "flex";
    overlay.__hide = () => {
      overlay.style.display = "none";
      iframe.src = "about:blank";
      success.style.display = "none";
    };
    overlay.__success = (msg, ms) => {
      success.style.display = "flex";
      document.getElementById("vo-success-text").textContent =
        msg || opts.successMessage;
      setTimeout(overlay.__hide, num(ms, opts.successAutoCloseMs));
    };

    if (opts.overlayClose) {
      overlay.addEventListener("click", e => {
        if (e.target === overlay) overlay.__hide();
      });
    }

    if (opts.escClose) {
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") overlay.__hide();
      });
    }

    // postMessage handling
    window.addEventListener("message", e => {
      if (opts.allowedMessageOrigins.length &&
          !opts.allowedMessageOrigins.includes(e.origin)) return;

      if (opts.autoResize && e.data?.type === "VO_IFRAME_HEIGHT") {
        iframe.style.height =
          Math.min(e.data.height, panel.clientHeight) + "px";
      }

      if (e.data?.type === "VO_SUCCESS") {
        overlay.__success(e.data.message, e.data.autocloseMs);
      }
    });
  }

  function init(el) {
    const d = el.dataset;
    const opts = merge(DEFAULTS, {
      iframeUrl: d.iframeUrl,
      buttonText: d.buttonText,
      buttonClass: d.buttonClass,
      maxWidth: num(d.maxWidth, DEFAULTS.maxWidth),
      maxHeightVh: num(d.maxHeightVh, DEFAULTS.maxHeightVh),
      utm_source: d.utmSource,
      utm_medium: d.utmMedium,
      utm_campaign: d.utmCampaign,
      utm_content: d.utmContent,
      utm_term: d.utmTerm,
      allowedMessageOrigins: d.allowedMessageOrigins
        ? d.allowedMessageOrigins.split(",")
        : []
    });

    if (!opts.iframeUrl) {
      el.textContent = "Missing data-iframe-url";
      return;
    }

    buildModal(opts);

    const btn = document.createElement("button");
    btn.textContent = opts.buttonText;
    btn.className = opts.buttonClass || "";
    if (!opts.buttonClass) {
      btn.style.cssText = `
        padding: 12px 16px;
        border-radius: 999px;
        background: #0b5fff;
        color: white;
        border: none;
        font-weight: 600;
        cursor: pointer;
      `;
    }

    btn.onclick = () => {
      const url = buildUrl(opts.iframeUrl, opts);
      const iframe = document.getElementById("vo-iframe");
      iframe.src = url;
      document.getElementById("vo-modal").__show();
    };

    el.replaceChildren(btn);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document
      .querySelectorAll("[data-brochure-widget]")
      .forEach(init);
  });
})();
