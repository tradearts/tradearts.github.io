(function () {
  "use strict";

  // Keep the catalogue headings below the shared sticky Webflow navigation.
  // Webflow's delegated smooth-scroll handler otherwise ignores scroll-margin.
  document.addEventListener("click", function (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest(".shop-edition a[href^='#']");
    if (!link) return;
    var target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start"
    });
    window.history.pushState(null, "", link.getAttribute("href"));
  }, true);
}());
