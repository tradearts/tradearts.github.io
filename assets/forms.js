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

  document.addEventListener("submit", async function (event) {
    var form = event.target.closest("form[data-email-form]");
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    var submit = form.querySelector('[type="submit"]');
    var originalLabel = submit ? (submit.value || submit.textContent) : "";
    var formData = new FormData(form);

    if (formData.get("_honey")) return;

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

      form.reset();
      setStatus(form, "success", form.dataset.successMessage || "Thanks — your enquiry has been sent.");
    } catch (error) {
      setStatus(form, "failure", "Sorry, the form could not be sent. Please email info@tradearts.work directly.");
    } finally {
      if (submit) {
        submit.disabled = false;
        if (submit.tagName === "INPUT") submit.value = originalLabel;
        else submit.textContent = originalLabel;
      }
    }
  }, true);
}());
