(function () {
  "use strict";

  var overlay = document.querySelector("[data-idle-brick-builder]");
  var logo = document.querySelector("[data-idle-brick-logo]");
  var pieces = document.querySelector("[data-idle-brick-pieces]");

  if (!overlay || !logo || !pieces) return;

  var source = "/shop/assets/images/trade-arts-brick-logo-v1.png";
  var idleDelay = 8000;
  var cycleDelay = 6500;
  var idleTimer = 0;
  var cycleTimer = 0;
  var isIdle = false;
  var logoReady = false;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var sourceImage = new Image();

  function tileHasInk(alpha, imageWidth, x, y, width, height) {
    var maxX = Math.min(x + width, sourceImage.naturalWidth);
    var maxY = Math.min(y + height, sourceImage.naturalHeight);

    for (var py = Math.max(0, y); py < maxY; py += 3) {
      for (var px = Math.max(0, x); px < maxX; px += 3) {
        if (alpha[(py * imageWidth + px) * 4 + 3] > 24) return true;
      }
    }

    return false;
  }

  function createBrick(x, y, width, height, row, column, rows, imageWidth, imageHeight) {
    var brick = document.createElement("span");
    var image = document.createElement("img");
    var rowFromBottom = rows - row - 1;
    var delay = rowFromBottom * 0.3 + column * 0.028;
    var drift = ((column % 5) - 2) * 13;
    var turn = ((column * 7 + row * 5) % 13) - 6;

    brick.className = "idle-brick-builder__piece";
    brick.style.inset = "auto";
    brick.style.left = (x / imageWidth * 100) + "%";
    brick.style.top = (y / imageHeight * 100) + "%";
    brick.style.width = (width / imageWidth * 100) + "%";
    brick.style.height = (height / imageHeight * 100) + "%";
    brick.style.setProperty("--brick-delay", delay.toFixed(3) + "s");
    brick.style.setProperty("--brick-drift", drift + "px");
    brick.style.setProperty("--brick-turn", turn + "deg");

    image.src = source;
    image.alt = "";
    image.draggable = false;
    image.style.width = (imageWidth / width * 100) + "%";
    image.style.height = (imageHeight / height * 100) + "%";
    image.style.left = (-x / width * 100) + "%";
    image.style.top = (-y / height * 100) + "%";

    brick.appendChild(image);
    pieces.appendChild(brick);
  }

  function prepareLogo() {
    var imageWidth = sourceImage.naturalWidth;
    var imageHeight = sourceImage.naturalHeight;
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d", { willReadFrequently: true });
    var brickWidth = 58;
    var brickHeight = 19;
    var rows = Math.ceil(imageHeight / brickHeight);

    canvas.width = imageWidth;
    canvas.height = imageHeight;
    context.drawImage(sourceImage, 0, 0);

    var pixels = context.getImageData(0, 0, imageWidth, imageHeight).data;
    pieces.textContent = "";

    for (var row = 0; row < rows; row += 1) {
      var y = row * brickHeight;
      var offset = row % 2 ? -brickWidth / 2 : 0;
      var column = 0;

      for (var x = offset; x < imageWidth; x += brickWidth) {
        var visibleX = Math.max(0, x);
        var width = Math.min(x + brickWidth, imageWidth) - visibleX;
        var height = Math.min(brickHeight, imageHeight - y);

        if (width > 0 && height > 0 && tileHasInk(pixels, imageWidth, visibleX, y, width, height)) {
          createBrick(visibleX, y, width, height, row, column, rows, imageWidth, imageHeight);
        }

        column += 1;
      }
    }

    logoReady = true;
  }

  function restartBuild() {
    window.clearTimeout(cycleTimer);
    overlay.classList.remove("is-building");
    void overlay.offsetWidth;
    overlay.classList.add("is-building");

    if (!reduceMotion.matches) {
      cycleTimer = window.setTimeout(function repeatBuild() {
        if (!isIdle) return;
        restartBuild();
      }, cycleDelay);
    }
  }

  function showIdle() {
    if (!logoReady || document.visibilityState !== "visible") {
      scheduleIdle();
      return;
    }

    isIdle = true;
    overlay.classList.add("is-active");
    document.documentElement.classList.add("is-shop-idle");
    restartBuild();
  }

  function hideIdle() {
    if (!isIdle) return;
    isIdle = false;
    overlay.classList.remove("is-active", "is-building");
    document.documentElement.classList.remove("is-shop-idle");
    window.clearTimeout(cycleTimer);
  }

  function scheduleIdle() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(showIdle, idleDelay);
  }

  function registerActivity() {
    hideIdle();
    scheduleIdle();
  }

  sourceImage.addEventListener("load", function () {
    prepareLogo();
    scheduleIdle();
  }, { once: true });

  sourceImage.addEventListener("error", function () {
    window.clearTimeout(idleTimer);
  }, { once: true });

  sourceImage.decoding = "async";
  sourceImage.src = source;

  ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"].forEach(function (eventName) {
    window.addEventListener(eventName, registerActivity, { passive: true, capture: true });
  });

  document.addEventListener("visibilitychange", function () {
    hideIdle();
    if (document.visibilityState === "visible") scheduleIdle();
  });
}());
