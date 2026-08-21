(function () {
  "use strict";

  var players = document.querySelectorAll("[data-vimeo-player-init]");
  if (!players.length) return;

  function visiblePlaceholder(player) {
    return Array.from(player.querySelectorAll(".vimeo-player__placeholder")).find(
      function (image) {
        return !image.classList.contains("w-condition-invisible") &&
          !image.classList.contains("w-dyn-bind-empty");
      }
    );
  }

  function configureStill(player) {
    var image = visiblePlaceholder(player);
    var wrapper = player.parentElement;
    if (!image || !wrapper) return;

    function sizeWrapper() {
      var height = image.getBoundingClientRect().height;
      if (height > 0) wrapper.style.height = Math.round(height) + "px";
    }

    wrapper.style.display = "flex";
    player.classList.add("is-still");
    image.loading = "lazy";
    if (image.complete) sizeWrapper();
    image.addEventListener("load", sizeWrapper, { once: true });
    window.addEventListener("resize", sizeWrapper, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(sizeWrapper).observe(image);
  }

  function activate(player) {
    if (player.dataset.vimeoActivated === "true") return;
    var videoId = player.getAttribute("data-vimeo-video-id");
    if (!videoId) return;

    player.dataset.vimeoActivated = "true";
    var iframe = document.createElement("iframe");
    iframe.className = "vimeo-player__iframe";
    iframe.width = "640";
    iframe.height = "360";
    iframe.loading = "lazy";
    iframe.title = "Trade Arts project video";
    iframe.tabIndex = -1;
    iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("aria-hidden", "true");
    function markPlaying(event) {
      if (event.origin !== "https://player.vimeo.com" || event.source !== iframe.contentWindow) return;
      var data = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (error) { return; }
      }
      if (!data) return;
      if (data.event === "ready") {
        iframe.contentWindow.postMessage(
          JSON.stringify({ method: "addEventListener", value: "play" }),
          "https://player.vimeo.com"
        );
        return;
      }
      if (data.event !== "play") return;
      player.dataset.vimeoLoaded = "true";
      window.removeEventListener("message", markPlaying);
    }
    window.addEventListener("message", markPlaying);
    iframe.src = "https://player.vimeo.com/video/" + encodeURIComponent(videoId) +
      "?api=1&background=1&autoplay=1&loop=1&muted=1&dnt=1";

    var before = player.querySelector(".vimeo-player__before");
    if (before) before.insertAdjacentElement("afterend", iframe);
    else player.prepend(iframe);
  }

  var observer = "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          activate(entry.target);
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "300px 0px" })
    : null;

  players.forEach(function (player) {
    var videoId = player.getAttribute("data-vimeo-video-id");
    if (!videoId) configureStill(player);
    else if (observer) observer.observe(player);
    else activate(player);
  });
})();
