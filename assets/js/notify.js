/* ---------------------------------------------------------------------------
 * Coming-soon email capture.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var root = document.querySelector("[data-notify]");
  if (!root) return;

  var form = root.querySelector("[data-notify-form]");
  var input = root.querySelector("[data-notify-input]");
  var button = root.querySelector("[data-notify-submit]");
  var errorEl = root.querySelector("[data-notify-error]");
  var successEl = root.querySelector("[data-notify-success]");

  var formId = root.getAttribute("data-form-id") || "";
  var entryId = root.getAttribute("data-entry-id") || "";
  var msgInvalid = root.getAttribute("data-error-invalid") || "Please enter a valid email address.";
  var labelIdle = root.getAttribute("data-label-idle") || "NOTIFY ME";
  var labelSending = root.getAttribute("data-label-sending") || "SENDING…";

  var configured = formId.indexOf("REPLACE_") === -1 && entryId.indexOf("REPLACE_") === -1;
  var submitting = false;

  // JS is available, so the no-tab path is live: drop the new-tab fallback.
  form.removeAttribute("target");

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    input.setAttribute("aria-invalid", "true");
  }

  function clearError() {
    if (errorEl.hidden) return;
    errorEl.textContent = "";
    errorEl.hidden = true;
    input.removeAttribute("aria-invalid");
  }

  function setSubmitting(state) {
    submitting = state;
    button.disabled = state;
    button.textContent = state ? labelSending : labelIdle;
  }

  function showSuccess() {
    form.hidden = true;
    successEl.hidden = false;
    successEl.setAttribute("role", "status");
    successEl.setAttribute("tabindex", "-1");
    successEl.focus();
  }

  function submit() {
    if (submitting) return;

    var email = (input.value || "").trim();
    if (!EMAIL_RE.test(email)) {
      showError(msgInvalid);
      input.focus();
      return;
    }

    clearError();
    setSubmitting(true);

    if (!configured) {
      console.warn(
        "[maeve] Google Form not configured — set google_form.form_id and " +
          "google_form.entry_id in _data/coming_soon.yml. Skipping submission."
      );
      setSubmitting(false);
      showSuccess();
      return;
    }

    var url = "https://docs.google.com/forms/d/e/" + formId + "/formResponse";
    var body = entryId + "=" + encodeURIComponent(email);

    var done = function () {
      setSubmitting(false);
      showSuccess();
    };

    if (typeof window.fetch === "function") {
      window
        .fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body
        })
        .then(done, done);
    } else {
      // Legacy fallback: a form POST into a hidden iframe, same opaque result.
      var frame = document.createElement("iframe");
      frame.name = "maeve-notify-sink";
      frame.style.display = "none";
      document.body.appendChild(frame);
      form.target = frame.name;
      form.submit();
      window.setTimeout(done, 600);
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submit();
  });

  input.addEventListener("input", clearError);
})();
