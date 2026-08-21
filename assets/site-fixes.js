(function () {
  "use strict";

  function syncMenuButton(button) {
    button.setAttribute("aria-expanded", button.classList.contains("w--open") ? "true" : "false");
    if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", "Menu");
  }

  document.querySelectorAll(".navbar5_menu-button").forEach(function (button) {
    syncMenuButton(button);
    new MutationObserver(function () { syncMenuButton(button); }).observe(button, {
      attributes: true,
      attributeFilter: ["class"]
    });
    button.addEventListener("click", function () {
      window.requestAnimationFrame(function () { syncMenuButton(button); });
    });
  });

  document.querySelectorAll('form[action*="formsubmit.co"]').forEach(function (form) {
    if (form.parentElement.querySelector(".form-privacy-note")) return;
    var note = document.createElement("p");
    note.className = "form-privacy-note";
    note.innerHTML = 'We use your details only to respond to this enquiry. See our <a href="/privacy/">privacy notice</a>.';
    form.insertAdjacentElement("afterend", note);
  });
})();
