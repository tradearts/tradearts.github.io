/* Native project loops: visible-only playback, visitor pause and motion preferences. */
(function () {
  "use strict";
  var videos = document.querySelectorAll("video[data-project-loop]");
  if (!videos.length) return;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var states = new Map();
  function sync(state) {
    if (!state.visible || document.hidden || (motion.matches && !state.explicit)) {
      state.video.pause();
    } else if (!state.userPaused) {
      state.video.play().catch(function () { /* Native play control remains available. */ });
    }
  }
  videos.forEach(function (video) {
    video.muted = true;
    var state = { video: video, visible: false, userPaused: false, explicit: false };
    states.set(video, state);
    video.addEventListener("pause", function () {
      if (state.visible && !document.hidden && (!motion.matches || state.explicit)) state.userPaused = true;
    });
    video.addEventListener("play", function () {
      state.userPaused = false;
      state.explicit = true;
      if (!state.visible || document.hidden) video.pause();
    });
  });
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var state = states.get(entry.target);
        state.visible = entry.isIntersecting && entry.intersectionRatio >= .15;
        sync(state);
      });
    }, { threshold: [0, .15] });
    videos.forEach(function (video) { observer.observe(video); });
  } else {
    // Older browsers keep native manual playback; no autoplay is required.
    states.forEach(function (state) { state.visible = true; state.userPaused = true; });
  }
  document.addEventListener("visibilitychange", function () { states.forEach(sync); });
  function preferenceChanged() {
    states.forEach(function (state) { state.explicit = false; sync(state); });
  }
  if (motion.addEventListener) motion.addEventListener("change", preferenceChanged);
  else motion.addListener(preferenceChanged);
})();
