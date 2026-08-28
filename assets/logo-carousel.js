(function () {
  var additionalLogos = [
    ["/assets/client-logos/apple-tv-plus-dark-transparent.png", "Apple TV+ logo", "carousel-apple-tv"],
    ["/assets/client-logos/lego-transparent.png", "LEGO logo", "carousel-lego"],
    ["/assets/client-logos/universal-music-dark-transparent.png", "Universal Music Group logo", "carousel-universal-music"],
    ["/assets/client-logos/xzibit-dark-transparent.png", "Xzibit logo", "carousel-xzibit"],
    ["/assets/client-logos/blueys-world-transparent.png", "Bluey’s World logo", "carousel-blueys-world"],
    ["/assets/client-logos/city-of-coffs-harbour-transparent.png", "City of Coffs Harbour logo", "carousel-city-coffs"],
    ["/assets/client-logos/rockstar-agency-transparent.png", "Rockstar Agency logo", "carousel-rockstar"]
  ];

  function initialiseLogoCarousel() {
    var wrapper = document.querySelector(".logo-wrapper");
    var originalGroup = wrapper && wrapper.querySelector(":scope > .logo-block");

    if (!wrapper || !originalGroup || wrapper.dataset.carouselReady === "true") {
      return;
    }

    wrapper.dataset.carouselReady = "true";
    wrapper.classList.add("client-logo-carousel");
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Client logos");

    var existingSources = Array.from(originalGroup.querySelectorAll("img")).map(function (image) {
      return image.getAttribute("src");
    });

    additionalLogos.forEach(function (logo) {
      if (existingSources.indexOf(logo[0]) !== -1) return;

      var image = document.createElement("img");
      image.src = logo[0];
      image.alt = logo[1];
      image.loading = "eager";
      image.className = "logo " + logo[2];
      originalGroup.append(image);
    });

    var track = document.createElement("div");
    var duplicateGroup = originalGroup.cloneNode(true);

    track.className = "logo-carousel__track";
    originalGroup.classList.add("logo-carousel__group");
    duplicateGroup.classList.add("logo-carousel__group");
    duplicateGroup.setAttribute("aria-hidden", "true");

    duplicateGroup.querySelectorAll("img").forEach(function (image) {
      image.alt = "";
      image.removeAttribute("id");
    });

    originalGroup.replaceWith(track);
    track.append(originalGroup, duplicateGroup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseLogoCarousel);
  } else {
    initialiseLogoCarousel();
  }
})();
