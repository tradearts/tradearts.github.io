(function () {
  "use strict";

  var players = document.querySelectorAll("[data-vimeo-player-init]");
  if (!players.length) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var states = new Map();
  var origin = "https://player.vimeo.com";

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

  function wantsPlayback(state) {
    return state.visible && !document.hidden && !state.userPaused &&
      (!reducedMotion.matches || state.explicitPlay);
  }

  function updateControl(state) {
    var action = state.playing || state.pending ? "Pause" : "Play";
    state.button.textContent = action + " video";
    state.button.setAttribute("aria-label", action + " " + state.title + " video preview");
    state.player.dataset.vimeoPlaying = String(state.playing);
  }

  function post(state, method, value) {
    if (!state.iframe || !state.iframe.contentWindow) return;
    var message = { method: method };
    if (value !== undefined) message.value = value;
    state.iframe.contentWindow.postMessage(JSON.stringify(message), origin);
  }

  function activate(state) {
    if (state.iframe) return;
    var iframe = document.createElement("iframe");
    iframe.className = "vimeo-player__iframe";
    iframe.width = "640";
    iframe.height = "360";
    iframe.title = state.title + " video preview";
    iframe.tabIndex = -1;
    iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("aria-hidden", "true");
    // Start paused: visibility, motion preferences and the visitor control playback.
    iframe.src = origin + "/video/" + encodeURIComponent(state.videoId) +
      "?api=1&background=1&autoplay=0&loop=1&muted=1&dnt=1&autopause=0";
    state.iframe = iframe;
    state.player.dataset.vimeoActivated = "true";
    var before = state.player.querySelector(".vimeo-player__before");
    if (before) before.insertAdjacentElement("afterend", iframe);
    else state.player.prepend(iframe);
  }

  function sync(state) {
    var play = wantsPlayback(state);
    if (play) activate(state);
    if (!state.iframe) return;
    state.pending = play && !state.playing;
    if (!play) state.playing = false;
    updateControl(state);
    if (state.ready && state.requested !== play) {
      state.requested = play;
      post(state, play ? "play" : "pause");
    }
  }

  function configureVideo(player, index) {
    var card = player.closest("a");
    var heading = card && card.querySelector(".home_feature-works-item");
    var pageHeading = document.querySelector("h1");
    var image = visiblePlaceholder(player);
    var title = heading ? heading.firstElementChild.textContent.trim() :
      (pageHeading ? pageHeading.textContent.trim() : (image && image.alt) || "Trade Arts project");
    var button = document.createElement("button");
    button.type = "button";
    button.className = "media-preview-control";
    if (!player.id) player.id = "project-video-" + (index + 1);
    button.setAttribute("aria-controls", player.id);

    // Homepage previews are links: keep their controls outside the anchor.
    if (card && card.parentElement) {
      card.parentElement.classList.add("media-preview-card");
      card.insertAdjacentElement("afterend", button);
    } else {
      player.appendChild(button);
    }

    var state = {
      player: player, videoId: player.getAttribute("data-vimeo-video-id"),
      title: title, button: button, iframe: null, ready: false, visible: false,
      playing: false, pending: false, requested: null, userPaused: false, explicitPlay: false
    };
    states.set(player, state);
    updateControl(state);
    button.addEventListener("click", function () {
      if (state.playing || state.pending) {
        state.userPaused = true;
      } else {
        state.userPaused = false;
        state.explicitPlay = true;
      }
      state.requested = null;
      sync(state);
    });
    return state;
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (error) { return; }
    }
    if (!data || typeof data !== "object") return;
    states.forEach(function (state) {
      if (!state.iframe || event.source !== state.iframe.contentWindow) return;
      if (data.event === "ready" || data.method === "ping") {
        if (state.ready) return;
        state.ready = true;
        ["play", "pause", "error"].forEach(function (name) {
          post(state, "addEventListener", name);
        });
        state.requested = null;
        sync(state);
      } else if (data.event === "play") {
        state.pending = false;
        state.player.dataset.vimeoLoaded = "true";
        state.playing = wantsPlayback(state);
        // Handle a delayed play event after scrolling away or selecting pause.
        if (!state.playing) post(state, "pause");
        updateControl(state);
      } else if (data.event === "pause" || data.event === "error") {
        state.pending = false;
        state.playing = false;
        state.requested = null;
        updateControl(state);
      }
    });
  });

  var observer = "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var state = states.get(entry.target);
          state.visible = entry.isIntersecting && entry.intersectionRatio > 0;
          sync(state);
        });
      }, { threshold: [0, 0.01] })
    : null;

  players.forEach(function (player, index) {
    if (!player.getAttribute("data-vimeo-video-id")) configureStill(player);
    else {
      configureVideo(player, index);
      if (observer) observer.observe(player);
    }
  });

  if (!observer) {
    var scheduled = false;
    function checkVisibility() {
      scheduled = false;
      states.forEach(function (state) {
        var bounds = state.player.getBoundingClientRect();
        state.visible = bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 &&
          bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth;
        sync(state);
      });
    }
    function scheduleVisibility() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(checkVisibility);
    }
    window.addEventListener("scroll", scheduleVisibility, { passive: true });
    window.addEventListener("resize", scheduleVisibility, { passive: true });
    checkVisibility();
  }

  document.addEventListener("visibilitychange", function () { states.forEach(sync); });
  function motionChanged() {
    states.forEach(function (state) {
      if (reducedMotion.matches) state.explicitPlay = false;
      sync(state);
    });
  }
  if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", motionChanged);
  else reducedMotion.addListener(motionChanged);
})();
