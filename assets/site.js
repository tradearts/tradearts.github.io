(() => {
  const menuButton = document.querySelector("[data-menu-button]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  let menuPreviouslyFocused = null;

  const focusableIn = (root) =>
    [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

  const closeMenu = ({ restoreFocus = true } = {}) => {
    if (!menuButton || !mobileNav || mobileNav.dataset.open !== "true") return;
    mobileNav.dataset.open = "false";
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "Menu";
    document.body.classList.remove("menu-open");
    if (restoreFocus && menuPreviouslyFocused) menuPreviouslyFocused.focus();
  };

  const openMenu = () => {
    if (!menuButton || !mobileNav) return;
    menuPreviouslyFocused = menuButton;
    mobileNav.dataset.open = "true";
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.textContent = "Close";
    document.body.classList.add("menu-open");
    focusableIn(mobileNav)[0]?.focus();
  };

  menuButton?.addEventListener("click", () => {
    if (mobileNav?.dataset.open === "true") closeMenu();
    else openMenu();
  });

  mobileNav?.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu({ restoreFocus: false });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileNav?.dataset.open === "true") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== "Tab" || mobileNav?.dataset.open !== "true") return;
    const focusable = focusableIn(mobileNav);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const filterButtons = [...document.querySelectorAll("[data-filter]")];
  const projectCards = [...document.querySelectorAll("[data-category]")];
  const filterStatus = document.querySelector("[data-filter-status]");
  const validFilters = new Set(["all", ...filterButtons.map((button) => button.dataset.filter)]);

  const applyFilter = (requested, { updateHistory = false } = {}) => {
    if (!filterButtons.length || !projectCards.length) return;
    const filter = validFilters.has(requested) ? requested : "all";
    let visible = 0;
    filterButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
    });
    projectCards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.hidden = !show;
      if (show) visible += 1;
    });
    const label = filterButtons.find((button) => button.dataset.filter === filter)?.textContent.trim() || "All work";
    if (filterStatus) {
      filterStatus.textContent = `${visible} ${visible === 1 ? "project" : "projects"} shown · ${label}`;
    }
    if (updateHistory) {
      const url = new URL(window.location.href);
      if (filter === "all") url.searchParams.delete("filter");
      else url.searchParams.set("filter", filter);
      history.pushState({ filter }, "", `${url.pathname}${url.search}`);
    }
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => applyFilter(button.dataset.filter, { updateHistory: true }));
  });

  if (filterButtons.length) {
    const initial = new URL(window.location.href).searchParams.get("filter") || "all";
    applyFilter(initial);
    window.addEventListener("popstate", () => {
      applyFilter(new URL(window.location.href).searchParams.get("filter") || "all");
    });
  }

  const form = document.querySelector("[data-prototype-form]");
  if (!form) return;

  const errorSummary = form.querySelector("[data-error-summary]");
  const errorList = form.querySelector("[data-error-list]");
  const formStatus = form.querySelector("[data-form-status]");

  const messages = {
    name: "Enter your name.",
    email: "Enter a valid email address.",
    projectType: "Choose what you are making.",
    location: "Enter the project location.",
    timing: "Enter a required date or choose flexible timing.",
    budget: "Choose a budget range.",
    brief: "Describe the project in at least 80 characters.",
    projectLink: "Enter a complete HTTPS project-file link.",
    consent: "Confirm that Trade Arts may use these details to assess the enquiry."
  };

  const validateField = (field) => {
    let valid = field.checkValidity();
    if (field.name === "brief" && field.value.trim().length < 80) valid = false;
    field.setAttribute("aria-invalid", String(!valid));
    const error = form.querySelector(`#${field.id}-error`);
    if (error) {
      error.textContent = valid ? "" : messages[field.name] || "Check this field.";
    }
    return valid;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = [...form.querySelectorAll("[data-validate]")];
    const invalid = fields.filter((field) => !validateField(field));
    if (invalid.length) {
      errorList.innerHTML = invalid
        .map((field) => `<li><a href="#${field.id}">${messages[field.name] || "Check this field."}</a></li>`)
        .join("");
      errorSummary.hidden = false;
      errorSummary.focus();
      formStatus.textContent = "";
      return;
    }
    errorSummary.hidden = true;
    errorList.innerHTML = "";
    formStatus.textContent = "Prototype check complete. Nothing was sent or stored. For a real enquiry, email info@tradearts.work.";
    formStatus.focus();
  });

  form.addEventListener(
    "blur",
    (event) => {
      if (event.target.matches("[data-validate]")) validateField(event.target);
    },
    true
  );
})();
