(function () {
  "use strict";

  document.querySelectorAll("[data-gallery-image]").forEach(function (button) {
    button.addEventListener("click", function () {
      var gallery = button.closest(".product-gallery");
      var mainImage = gallery && gallery.querySelector("[data-gallery-main]");
      if (!mainImage) return;

      mainImage.src = button.dataset.galleryImage;
      mainImage.alt = button.dataset.galleryAlt || mainImage.alt;
      var caption = gallery.querySelector("[data-gallery-caption]");
      if (caption) caption.textContent = button.dataset.galleryCaption;
      gallery.querySelectorAll("[data-gallery-image]").forEach(function (candidate) {
        candidate.classList.toggle("is-active", candidate === button);
        candidate.setAttribute("aria-pressed", String(candidate === button));
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
  var summary = document.querySelector("[data-order-summary]");

  function selectedProduct() {
    return Object.prototype.hasOwnProperty.call(window.TRADE_ARTS_PRODUCTS, productSelect.value)
      ? window.TRADE_ARTS_PRODUCTS[productSelect.value] : null;
  }

  function updateSummary() {
    if (!summary) return;
    var product = selectedProduct();
    summary.querySelector("[data-summary-empty]").hidden = !!product;
    summary.querySelector("[data-summary-content]").hidden = !product;
    if (!product) return;

    var photo = summary.querySelector("[data-summary-image]");
    photo.src = product.image;
    photo.alt = "";
    var title = summary.querySelector("[data-summary-title]");
    title.textContent = product.title;
    title.href = "/shop/products/" + productSelect.value + "/";
    var quantity = Number(quantityInput.value);
    var validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;
    var selectedSize = sizeSelect.value || "Choose a size";
    summary.querySelector("[data-summary-selection]").textContent = selectedSize + " · " + (validQuantity ? "Quantity " + quantity : "Choose a quantity from 1–99");
    summary.querySelector("[data-summary-total]").textContent = validQuantity
      ? "$" + (product.priceAmount * quantity).toFixed(2) + " AUD" : "—";
  }

  function updateSizes(preferredSize) {
    var product = selectedProduct();
    sizeSelect.innerHTML = "";
    sizeSelect.disabled = !product;

    if (!product) {
      sizeSelect.append(new Option("Select a product first", ""));
      subjectInput.value = "New Trade Arts Shop product enquiry";
      updateSummary();
      return;
    }

    product.sizes.forEach(function (size) {
      sizeSelect.append(new Option(size, size, false, size === preferredSize));
    });
    subjectInput.value = "Shop enquiry — " + product.title;
    updateSummary();
  }

  productSelect.addEventListener("change", function () {
    updateSizes(sizeSelect.value);
  });
  sizeSelect.addEventListener("change", updateSummary);
  quantityInput.addEventListener("input", updateSummary);
  orderForm.addEventListener("reset", function () {
    window.setTimeout(function () { updateSizes(""); }, 0);
  });

  var requestedProduct = parameters.get("product");
  var requestedSize = parameters.get("size");
  var requestedQuantity = Number(parameters.get("quantity"));

  if (requestedProduct && Object.prototype.hasOwnProperty.call(window.TRADE_ARTS_PRODUCTS, requestedProduct)) {
    productSelect.value = requestedProduct;
  }
  updateSizes(requestedSize || "");
  if (Number.isInteger(requestedQuantity) && requestedQuantity > 0 && requestedQuantity <= 99) {
    quantityInput.value = requestedQuantity;
  }
  updateSummary();
}());

window.Webflow = window.Webflow || [];
window.Webflow.push(function () {
  document
    .querySelectorAll(".navbar5_menu-button > .hamburger-menu-hm10.w-nav-button")
    .forEach(function (innerButton) {
      var visual = innerButton.cloneNode(true);

      visual.classList.remove("w-nav-button", "w--open");
      visual.removeAttribute("data-w-id");
      visual.setAttribute("aria-hidden", "true");

      [
        "aria-label",
        "role",
        "tabindex",
        "aria-controls",
        "aria-haspopup",
        "aria-expanded"
      ].forEach(function (attribute) {
        visual.removeAttribute(attribute);
      });

      innerButton.replaceWith(visual);
    });
});
