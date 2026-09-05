(function () {
  "use strict";

  function setStatus(form, state, message) {
    var wrapper = form.closest(".w-form, [data-form-wrapper]");
    if (!wrapper) return;
    var success = wrapper.querySelector(".w-form-done, [data-form-success]");
    var failure = wrapper.querySelector(".w-form-fail, [data-form-failure]");

    if (success) {
      success.style.display = state === "success" ? "block" : "none";
      if (state === "success" && message) success.textContent = message;
    }
    if (failure) {
      failure.style.display = state === "failure" ? "block" : "none";
      if (state === "failure" && message) failure.textContent = message;
    }
  }

  function ajaxEndpoint(action) {
    return action.replace("https://formsubmit.co/", "https://formsubmit.co/ajax/");
  }

  var projectForm = document.querySelector("form[data-email-form]:not([data-order-form])");
  if (projectForm) {
    var parameters = new URLSearchParams(window.location.search);
    var requestedType = parameters.get("project_type");
    var typeSelect = projectForm.querySelector('select[name="project_type"]');
    if (requestedType && typeSelect && !typeSelect.value &&
        Array.from(typeSelect.options).some(function (option) { return option.value === requestedType; })) {
      typeSelect.value = requestedType;
    }
    var project = parameters.get("project");
    var service = parameters.get("service");
    var context = (project || service || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
    if (context) {
      var note = document.createElement("p");
      note.className = "form-context-note";
      note.textContent = (project ? "Inspired by: " : "Interested in: ") + context;
      projectForm.prepend(note);
      var message = projectForm.querySelector('[name="message"]');
      if (message && !message.value.trim()) {
        message.value = project
          ? "I’d like to discuss a project similar to " + context + ".\n\n"
          : "I’m interested in " + context + " for a project.\n\n";
      }
    }
  }

  document.addEventListener("submit", async function (event) {
    var form = event.target.closest("form[data-email-form]");
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (form.dataset.submitting === "true" || !form.reportValidity()) return;

    var submit = form.querySelector('[type="submit"]');
    var originalLabel = submit ? (submit.value || submit.textContent) : "";
    var formData = new FormData(form);

    if (formData.get("_honey")) return;

    form.dataset.submitting = "true";
    form.setAttribute("aria-busy", "true");

    if (submit) {
      submit.disabled = true;
      if (submit.tagName === "INPUT") submit.value = submit.dataset.wait || "Sending…";
      else submit.textContent = submit.dataset.wait || "Sending…";
    }
    setStatus(form, "idle");

    try {
      var payload = {};
      formData.forEach(function (value, key) {
        payload[key] = value;
      });

      var response = await fetch(ajaxEndpoint(form.action), {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Submission failed");
      var result = await response.json();
      if (!result || (result.success !== true && result.success !== "true")) {
        throw new Error("Submission was not accepted");
      }

      if (typeof window.tradeArtsTrackEnquiry === "function") {
        try {
          window.tradeArtsTrackEnquiry(form.hasAttribute("data-order-form") ? "product" : "project");
        } catch (_) {
          // Optional measurement must never interfere with a successful enquiry.
        }
      }

      form.reset();
      setStatus(form, "success", form.dataset.successMessage || "Thanks — your enquiry has been sent.");
    } catch (error) {
      setStatus(form, "failure", "Sorry, the form could not be sent. Please email info@tradearts.work directly.");
    } finally {
      delete form.dataset.submitting;
      form.removeAttribute("aria-busy");
      if (submit) {
        submit.disabled = false;
        if (submit.tagName === "INPUT") submit.value = originalLabel;
        else submit.textContent = originalLabel;
      }
    }
  }, true);
}());
