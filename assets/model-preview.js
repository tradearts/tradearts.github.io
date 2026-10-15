/* Progressive enhancement for existing Sketchfab models. Geometry is untouched.
   Viewer readiness uses the official API, not iframe.onload.
   https://sketchfab.com/developers/viewer */
(function () {
  'use strict';
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.model-preview[data-model-url]').forEach(function (frame) {
    var iframe = frame.querySelector('iframe');
    var status = frame.querySelector('.model-preview__status');
    var retry = frame.querySelector('.model-preview__retry');
    var url = new URL(frame.dataset.modelUrl);
    var uid = url.pathname.split('/')[2];
    var generation = 0, timer, api;
    function state(value, message) {
      frame.dataset.modelState = value;
      iframe.setAttribute('aria-hidden', String(value !== 'ready'));
      iframe.tabIndex = value === 'ready' ? 0 : -1;
      status.textContent = message;
      retry.hidden = value !== 'failed';
      frame.setAttribute('aria-busy', String(value === 'loading'));
    }
    function start() {
      var attempt = ++generation;
      window.clearTimeout(timer);
      state('loading', 'Loading interactive 3D model…');
      function failed() {
        if (attempt !== generation) return;
        window.clearTimeout(timer);
        state('failed', '3D preview is taking longer than expected. The project image remains available.');
      }
      if (!window.Sketchfab) { failed(); return; }
      var options = {};
      url.searchParams.forEach(function (value, key) { options[key] = value; });
      options.autostart = 1;
      options.autospin = motion.matches ? 0 : (options.autospin || 0);
      options.success = function (viewer) {
        if (attempt !== generation) return;
        api = viewer;
        viewer.addEventListener('viewerready', function () {
          if (attempt !== generation) return;
          window.clearTimeout(timer);
          state('ready', 'Drag to rotate · Scroll or pinch to zoom');
        });
        viewer.start();
      };
      options.error = failed;
      timer = window.setTimeout(failed, 20000);
      try { new window.Sketchfab('1.12.1', iframe).init(uid, options); }
      catch (_) { failed(); }
    }
    retry.addEventListener('click', function () {
      if (api) { try { api.stop(); } catch (_) {} }
      // A fresh frame isolates late messages from the previous attempt.
      var fresh = iframe.cloneNode(false);
      fresh.src = 'about:blank';
      iframe.replaceWith(fresh); iframe = fresh; api = null;
      start();
    });
    start();
  });
})();
