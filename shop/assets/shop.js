(function () {
  "use strict";

  document.querySelectorAll("[data-gallery-image]").forEach(function (button) {
    button.addEventListener("click", function () {
      var gallery = button.closest(".product-gallery");
      var mainImage = gallery && gallery.querySelector("[data-gallery-main]");
      if (!mainImage) return;

      mainImage.src = button.dataset.galleryImage;
      gallery.querySelectorAll("[data-gallery-image]").forEach(function (candidate) {
        candidate.classList.toggle("is-active", candidate === button);
      });
    });
  });

  var orderForm = document.querySelector("[data-order-form]");
  if (!orderForm || !window.TRADE_ARTS_PRODUCTS) return;

  var productSelect = orderForm.querySelector("[data-product-select]");
  var sizeSelect = orderForm.querySelector("[data-size-select]");
  var subjectInput = orderForm.querySelector("[data-order-subject]");
  var quantityInput = orderForm.querySelector('[name="quantity"]');
  var parameters = new URLSearchParams(window.location.search);

  function updateSizes(preferredSize) {
    var product = window.TRADE_ARTS_PRODUCTS[productSelect.value];
    sizeSelect.innerHTML = "";

    if (!product) {
      sizeSelect.append(new Option("Select a product first", ""));
      subjectInput.value = "New Trade Arts Shop product enquiry";
      return;
    }

    product.sizes.forEach(function (size) {
      sizeSelect.append(new Option(size, size, false, size === preferredSize));
    });
    subjectInput.value = "Shop enquiry — " + product.title;
  }

  productSelect.addEventListener("change", function () {
    updateSizes("");
  });

  var requestedProduct = parameters.get("product");
  var requestedSize = parameters.get("size");
  var requestedQuantity = Number.parseInt(parameters.get("quantity"), 10);

  if (requestedProduct && window.TRADE_ARTS_PRODUCTS[requestedProduct]) {
    productSelect.value = requestedProduct;
  }
  updateSizes(requestedSize || "");
  if (Number.isFinite(requestedQuantity) && requestedQuantity > 0 && requestedQuantity <= 99) {
    quantityInput.value = requestedQuantity;
  }
}());
