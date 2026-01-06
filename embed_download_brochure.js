(function () {
  const STYLE_ID = "brevo-popup-widget-style";
  const ROOT_ID = "brevo-popup-widget-root";
  const MODAL_ID = "brevo-popup-framewrap";

  let __bpw_lastIframeHeight = 0;
  let __bpw_resizeRaf = 0;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
#${ROOT_ID}{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:2147483647}
#${ROOT_ID}[data-open="true"]{display:flex}
#${ROOT_ID} .bpw-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}
#${ROOT_ID} .bpw-modal{position:relative;width:min(92vw,540px);height:auto;max-height:86vh;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.35)}
#${ROOT_ID} .bpw-close{position:absolute;top:10px;right:10px;z-index:3;border:0;background:rgba(0,0,0,.55);color:#fff;width:36px;height:36px;border-radius:999px;cursor:pointer;font-size:18px;line-height:36px}
#${ROOT_ID} .framewrap{height:420px}
#${ROOT_ID} iframe{border:0;width:100%;height:395px;display:block}
#${ROOT_ID} .bpw-success{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:26px;text-align:center}
#${ROOT_ID}[data-success="true"] iframe{display:none}
#${ROOT_ID}[data-success="true"] .bpw-success{display:flex}
#${ROOT_ID} .bpw-card{max-width:520px}
#${ROOT_ID} .bpw-title{margin:0 0 15px 0;font-size:22px}
#${ROOT_ID} .bpw-text{margin:0 0 20px 0;font-size:16px;opacity:.85;line-height:1.75}
#${ROOT_ID} .bpw-email{font-weight:600;word-break:break-word}
#${ROOT_ID} .bpw-btn{border:1.3px solid #1775ba;border-radius:5px;padding:13px 24px;font-family:Helvetica, sans-serif;font-size:15px;text-transform:capitalize;line-height:1;cursor:pointer;background-color:#fff;color:#3c4858}
#${ROOT_ID} .bpw-btn:hover{background-color:#1775ba;color:#fff}
`;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `
      <div class="bpw-backdrop" data-bpw-close></div>
      <div class="bpw-modal" role="document">
        <div id="brevo-popup-framewrap" class=bpw-framewrap>
          <button class="bpw-close" type="button" aria-label="Close" data-bpw-close>×</button>
          <iframe title="Brochure download form" loading="eager"></iframe>
  
          <div class="bpw-success" aria-live="polite">
            <div class="bpw-card">
              <h2 class="bpw-title">Brochure successfully sent!</h2>
              <div style="text-align: center; margin-top: 15px;">
                <svg width="104" height="100" viewBox="0 0 104 100" class="tw-inline tw-align-baseline wt-icon" style="width: 80px; height: 80px;">
                  <g stroke-width="3" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"><path d="M91.16 34.168A46.13 46.13 0 0194.728 52c0 25.678-20.685 46.364-46.363 46.364C22.685 98.364 2 77.678 2 52 2 26.322 22.685 5.636 48.364 5.636c9.094 0 17.653 2.675 24.786 7.133" stroke="#DDDEDF">
                    </path><path stroke="#1775ba" d="M29.273 37.152l18.182 17.575L102 2"></path>
                  </g>
                </svg>
              </div>
              <p class="bpw-text">
                We&#039;ve sent the Suwannee River Sea Kayak Skills Expedition Brochure to
                <span class="bpw-email" data-bpw-email></span>.
                <br/>Check your inbox!
              </p>
              <button class="bpw-btn" type="button" data-bpw-close>Close</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    root.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.matches("[data-bpw-close]")) closePopup();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root.getAttribute("data-open") === "true") closePopup();
    });

    return root;
  }

  function buildUrlWithUtm(url, utmSource) {
    if (!utmSource) return url;
    try {
      const u = new URL(url, window.location.href);
      u.searchParams.set("utm_source", utmSource);
      return u.toString();
    } catch (_) {
      // If URL is relative or invalid, fallback
      const sep = url.includes("?") ? "&" : "?";
      return url + sep + "utm_source=" + encodeURIComponent(utmSource);
    }
  }

  function openPopup(formUrl, utmSource) {
    injectStyles();
    const root = ensureRoot();
    const iframe = root.querySelector("iframe");

    root.setAttribute("data-success", "false");
    root.setAttribute("data-open", "true");
    document.documentElement.style.overflow = "hidden";

    const modal = document.getElementById(MODAL_ID);
    modal.style.height = "420px";

    __bpw_lastIframeHeight = 0

    iframe.src = buildUrlWithUtm(formUrl, utmSource || "");
    iframe.style.height = "395px";
    iframe.focus();
  }

  function closePopup() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const iframe = root.querySelector("iframe");
    root.setAttribute("data-open", "false");
    root.setAttribute("data-success", "false");
    document.documentElement.style.overflow = "";
    iframe.src = "about:blank";
  }

  // Listen for success from iframe (sent by brevo-form.html)
  window.addEventListener("message", (event) => {
    if (!event || !event.data) return;

    // Resize message from brevo-form.html
    if (event.data.type === "BREVO_HEIGHT") {
      const root = document.getElementById(ROOT_ID);
      if (!root) return;

      const iframe = root.querySelector("iframe");
      if (!iframe) return;

      const modal = document.getElementById(MODAL_ID);
      if (!modal) return;
      console.log(modal);

      const raw = Number(event.data.height);
      if (!Number.isFinite(raw) || raw <= 0) return;

      const max = Math.floor(window.innerHeight * 0.86);
      const target = Math.min(Math.max(raw, 240), max);

      // Hysteresis: ignore tiny changes that cause oscillation (scrollbar/wrapping)
      if (Math.abs(target - __bpw_lastIframeHeight) < 12) return;
  
      // Debounce to next animation frame
      if (__bpw_resizeRaf) cancelAnimationFrame(__bpw_resizeRaf);
      __bpw_resizeRaf = requestAnimationFrame(() => {
        modal.style.height = target + 20 + "px";
        __bpw_lastIframeHeight = target;
        __bpw_resizeRaf = 0;
      });
      
      iframe.style.height = target + "px";
      return;
    }
    
    // Existing success handler
    if (event.data.type === "BREVO_SUCCESS") {
      const root = document.getElementById(ROOT_ID);
      if (!root) return;

      const email = (event.data.email || "").trim() || "your email";
      const emailEl = root.querySelector("[data-bpw-email]");
      if (emailEl) emailEl.textContent = email;

      root.setAttribute("data-success", "true");
    }
  });

  // Bind buttons:
  // <button data-brevo-popup data-brevo-form-url="https://.../brevo-form.html" data-utm-source="...">Download</button>
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-brevo-popup]");
    if (!btn) return;
    e.preventDefault();

    const formUrl = btn.getAttribute("data-brevo-form-url");
    if (!formUrl) {
      console.error("Brevo Popup: missing data-brevo-form-url on trigger button.");
      return;
    }

    const utm = btn.getAttribute("data-utm-source") || "";
    openPopup(formUrl, utm);
  });

  window.BrevoPopup = { open: openPopup, close: closePopup };
})();























