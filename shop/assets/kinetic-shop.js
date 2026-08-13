(function () {
  "use strict";

  var stage = document.querySelector("[data-tool-stage]");
  if (!stage) return;

  var sprites = Array.from(stage.querySelectorAll(".tool-sprite"));
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bounds = stage.getBoundingClientRect();
  var pointer = { active: false, x: 0, y: 0 };
  var previousTime = performance.now();
  var running = true;

  var bodies = sprites.map(function (element, index) {
    var width = element.offsetWidth;
    var height = element.offsetHeight;
    var x = (Number(element.dataset.x) / 100) * Math.max(1, bounds.width - width);
    var y = (Number(element.dataset.y) / 100) * Math.max(1, bounds.height - height);
    var body = {
      element: element,
      x: x,
      y: y,
      width: width,
      height: height,
      vx: Number(element.dataset.vx) || 55 + index * 4,
      vy: Number(element.dataset.vy) || 45 + index * 3,
      angle: index * 31,
      spin: Number(element.dataset.spin) || 20,
    };
    element.style.transform = "translate3d(" + x + "px," + y + "px,0) rotate(" + body.angle + "deg)";
    return body;
  });

  function refreshBounds() {
    bounds = stage.getBoundingClientRect();
    bodies.forEach(function (body) {
      body.width = body.element.offsetWidth;
      body.height = body.element.offsetHeight;
      body.x = Math.min(body.x, Math.max(0, bounds.width - body.width));
      body.y = Math.min(body.y, Math.max(0, bounds.height - body.height));
    });
  }

  function updatePointer(event) {
    bounds = stage.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = pointer.x >= 0 && pointer.x <= bounds.width && pointer.y >= 0 && pointer.y <= bounds.height;
  }

  function animate(time) {
    if (!running) {
      previousTime = time;
      requestAnimationFrame(animate);
      return;
    }

    var delta = Math.min(0.033, Math.max(0.001, (time - previousTime) / 1000));
    previousTime = time;

    bodies.forEach(function (body) {
      if (pointer.active) {
        var centerX = body.x + body.width / 2;
        var centerY = body.y + body.height / 2;
        var dx = centerX - pointer.x;
        var dy = centerY - pointer.y;
        var distance = Math.max(1, Math.hypot(dx, dy));
        var radius = 190;
        if (distance < radius) {
          var force = (1 - distance / radius) * 1250 * delta;
          body.vx += (dx / distance) * force;
          body.vy += (dy / distance) * force;
          body.spin += (dx >= 0 ? 1 : -1) * force * 0.08;
        }
      }

      body.vx *= Math.pow(0.998, delta * 60);
      body.vy *= Math.pow(0.998, delta * 60);
      body.spin *= Math.pow(0.999, delta * 60);
      body.x += body.vx * delta;
      body.y += body.vy * delta;
      body.angle += body.spin * delta;

      var maxX = Math.max(0, bounds.width - body.width);
      var maxY = Math.max(0, bounds.height - body.height);
      if (body.x <= 0 || body.x >= maxX) {
        body.x = Math.max(0, Math.min(maxX, body.x));
        body.vx *= -0.94;
        body.spin *= -0.92;
      }
      if (body.y <= 0 || body.y >= maxY) {
        body.y = Math.max(0, Math.min(maxY, body.y));
        body.vy *= -0.94;
        body.spin *= -0.92;
      }

      body.element.style.transform = "translate3d(" + body.x.toFixed(2) + "px," + body.y.toFixed(2) + "px,0) rotate(" + body.angle.toFixed(2) + "deg)";
    });

    requestAnimationFrame(animate);
  }

  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerleave", function () { pointer.active = false; });
  window.addEventListener("resize", refreshBounds, { passive: true });
  document.addEventListener("visibilitychange", function () { running = !document.hidden; });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      running = entries[0] && entries[0].isIntersecting && !document.hidden;
    }, { threshold: 0 }).observe(stage);
  }

  if (!reducedMotion) requestAnimationFrame(animate);
}());
