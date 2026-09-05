(() => {
  "use strict";

  const STORAGE_KEY = "tradearts-consent-v1";
  const GRANTED = "granted";
  const DENIED = "denied";
  let savedChoice = null;
  let analyticsActivated = false;
  let returnFocus = null;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function updateConsent(analyticsChoice) {
    window.gtag("consent", "update", {
      ad_storage: "denied",
      analytics_storage: analyticsChoice === GRANTED ? "granted" : "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
  }

  window.gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });

  try {
    savedChoice = window.localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    savedChoice = null;
  }

  if (savedChoice === GRANTED) updateConsent(GRANTED);

  // Keep conversion tracking behind the same explicit choice as page analytics.
  // Only this fixed, non-personal event is accepted; form values never enter analytics.
  window.tradeArtsTrackEnquiry = function (kind) {
    if (savedChoice !== GRANTED || !["project", "product"].includes(kind)) return;
    window.gtag("event", "generate_lead", { enquiry_type: kind });
  };

  function activateAnalytics() {
    if (analyticsActivated) return;
    analyticsActivated = true;
    document.querySelectorAll('script[data-consent="analytics"]').forEach((blocked) => {
      const script = document.createElement("script");
      for (const attribute of blocked.attributes) {
        if (!["type", "data-consent", "data-consent-src"].includes(attribute.name)) {
          script.setAttribute(attribute.name, attribute.value);
        }
      }
      const source = blocked.dataset.consentSrc;
      if (source) script.src = source;
      if (blocked.textContent) script.textContent = blocked.textContent;
      blocked.replaceWith(script);
    });
  }

  function setBackgroundInert(active, banner = null) {
    for (const child of document.body.children) {
      if (child !== banner) child.inert = active;
    }
  }

  function closeBanner() {
    document.querySelector(".consent-banner")?.remove();
    setBackgroundInert(false);
    const target = returnFocus?.isConnected
      ? returnFocus
      : document.querySelector(".consent-settings");
    target?.focus({ preventScroll: true });
    returnFocus = null;
  }

  function saveChoice(choice) {
    const withdrawing = choice === DENIED && analyticsActivated;
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch (_) {
      // Consent remains effective for this page view when storage is unavailable.
    }
    savedChoice = choice;
    if (withdrawing) {
      window.location.reload();
      return;
    }
    updateConsent(choice);
    if (choice === GRANTED) activateAnalytics();
    closeBanner();
  }

  function keepFocusInside(event, banner) {
    if (event.key !== "Tab") return;
    const focusable = [...banner.querySelectorAll('a[href], button:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function showBanner(trigger) {
    if (document.querySelector(".consent-banner")) return;
    returnFocus = trigger || document.activeElement;
    const banner = document.createElement("section");
    banner.className = "consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "true");
    banner.setAttribute("aria-labelledby", "consent-title");
    banner.setAttribute("aria-describedby", "consent-description");
    banner.innerHTML = `
      <div class="consent-banner__copy">
        <h2 id="consent-title">Privacy choices</h2>
        <p id="consent-description">Optional Google Analytics helps us understand which pages are useful. It stays off unless you accept. Advertising storage and personalisation stay off. <a href="/privacy/">Privacy details</a>.</p>
      </div>
      <div class="consent-banner__actions">
        <button type="button" data-choice="denied">Essential only</button>
        <button type="button" class="is-primary" data-choice="granted">Accept analytics</button>
      </div>`;
    banner.addEventListener("click", (event) => {
      const button = event.target.closest("[data-choice]");
      if (button) saveChoice(button.dataset.choice);
    });
    banner.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        saveChoice(savedChoice === GRANTED ? GRANTED : DENIED);
        return;
      }
      keepFocusInside(event, banner);
    });
    document.body.appendChild(banner);
    setBackgroundInert(true, banner);
    banner.querySelector("[data-choice]")?.focus();
  }

  function addSettingsButton() {
    if (document.querySelector(".consent-settings")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "consent-settings";
    button.textContent = "Privacy settings";
    button.addEventListener("click", (event) => showBanner(event.currentTarget));
    document.body.appendChild(button);
  }

  document.addEventListener("DOMContentLoaded", () => {
    addSettingsButton();
    if (savedChoice === GRANTED) activateAnalytics();
    if (savedChoice !== GRANTED && savedChoice !== DENIED) {
      showBanner(document.querySelector(".consent-settings"));
    }
  });
})();
