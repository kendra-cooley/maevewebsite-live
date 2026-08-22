/* ---------------------------------------------------------------------------
 * Nomination modal.
 *
 * Sibling of notify.js: same IIFE shape, same data-* configuration, and the
 * same transparent Google Forms submit — a no-cors POST whose opaque response
 * is treated as success either way. That ~20 lines is duplicated rather than
 * shared: the two forms have different shapes (one field vs eleven), and
 * factoring it out would mean editing the script currently collecting real
 * sign-ups on "/". Keep the two in step by hand.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;

  var modal = document.querySelector("[data-nominate-modal]");
  if (!modal || typeof modal.showModal !== "function") return;

  var form = modal.querySelector("[data-nominate-form]");
  var button = modal.querySelector("[data-nominate-submit]");
  var summaryEl = modal.querySelector("[data-nominate-error]");
  var successEl = modal.querySelector("[data-nominate-success]");
  var fields = Array.prototype.slice.call(modal.querySelectorAll("[data-nominate-field]"));

  var formId = modal.getAttribute("data-form-id") || "";
  var labelIdle = modal.getAttribute("data-label-idle") || "SEND NOMINATION";
  var labelSending = modal.getAttribute("data-label-sending") || "SENDING…";
  var msgSummary = modal.getAttribute("data-error-summary") || "Please check the highlighted fields.";
  var msgRequired = modal.getAttribute("data-error-required") || "%s is required.";
  var msgEmail = modal.getAttribute("data-error-email") || "Please enter a valid email address.";
  var msgUrl = modal.getAttribute("data-error-url") || "Please enter a full address, starting with https://";

  var submitting = false;
  var sent = false;

  // A single REPLACE_ anywhere means the Google Form is not wired up yet.
  var entryIds = fields.map(function (el) { return nameOf(el); });
  var configured =
    formId.indexOf("REPLACE_") === -1 &&
    entryIds.every(function (id) { return id && id.indexOf("REPLACE_") === -1; });

  // JS is available, so the no-tab path is live: drop the new-tab fallback.
  form.removeAttribute("target");

  /* --- field helpers ------------------------------------------------------ */

  // A radio group is a <fieldset>, so its value and name live on its inputs.
  function isRadio(el) { return el.getAttribute("data-type") === "radio"; }

  function nameOf(el) {
    if (!isRadio(el)) return el.name;
    var first = el.querySelector("input[type=radio]");
    return first ? first.name : "";
  }

  function valueOf(el) {
    if (!isRadio(el)) return (el.value || "").trim();
    var checked = el.querySelector("input[type=radio]:checked");
    return checked ? checked.value : "";
  }

  function errorNode(el) {
    return modal.querySelector("#" + CSS.escape(el.getAttribute("data-error-id")));
  }

  function focusable(el) {
    return isRadio(el) ? el.querySelector("input[type=radio]") : el;
  }

  /* --- validation --------------------------------------------------------- */

  function setFieldError(el, message) {
    var node = errorNode(el);
    if (node) {
      node.textContent = message;
      node.hidden = false;
    }
    el.setAttribute("aria-invalid", "true");
    el.classList.add("is-invalid");
  }

  function clearFieldError(el) {
    var node = errorNode(el);
    if (node && !node.hidden) {
      node.textContent = "";
      node.hidden = true;
    }
    el.removeAttribute("aria-invalid");
    el.classList.remove("is-invalid");
  }

  // Returns an error message, or "" when the field is acceptable.
  function checkField(el) {
    var value = valueOf(el);
    var required = el.getAttribute("data-required") === "true";
    var type = el.getAttribute("data-type");

    if (!value) {
      return required ? msgRequired.replace("%s", el.getAttribute("data-label")) : "";
    }
    if (type === "email" && !EMAIL_RE.test(value)) return msgEmail;
    if (type === "url" && !URL_RE.test(value)) return msgUrl;
    return "";
  }

  function validate() {
    var firstInvalid = null;

    fields.forEach(function (el) {
      var message = checkField(el);
      if (message) {
        setFieldError(el, message);
        if (!firstInvalid) firstInvalid = el;
      } else {
        clearFieldError(el);
      }
    });

    if (firstInvalid) {
      summaryEl.textContent = msgSummary;
      summaryEl.hidden = false;
      focusable(firstInvalid).focus();
      return false;
    }

    summaryEl.textContent = "";
    summaryEl.hidden = true;
    return true;
  }

  /* --- submit ------------------------------------------------------------- */

  function setSubmitting(state) {
    submitting = state;
    button.disabled = state;
    button.textContent = state ? labelSending : labelIdle;
  }

  function showSuccess() {
    sent = true;
    form.hidden = true;
    successEl.hidden = false;
    successEl.setAttribute("role", "status");
    successEl.setAttribute("tabindex", "-1");
    successEl.focus();
  }

  function body() {
    var pairs = [];
    fields.forEach(function (el) {
      var value = valueOf(el);
      if (!value) return; // skip empty optionals rather than posting blanks
      pairs.push(nameOf(el) + "=" + encodeURIComponent(value));
    });
    return pairs.join("&");
  }

  function submit() {
    if (submitting || !validate()) return;

    setSubmitting(true);

    if (!configured) {
      console.warn(
        "[maeve] Google Form not configured — set google_form.form_id and " +
          "every field's entry_id in _data/nominate.yml. Skipping submission."
      );
      setSubmitting(false);
      showSuccess();
      return;
    }

    var url = "https://docs.google.com/forms/d/e/" + formId + "/formResponse";

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
          body: body()
        })
        .then(done, done);
    } else {
      // Legacy fallback: a form POST into a hidden iframe, same opaque result.
      var frame = document.createElement("iframe");
      frame.name = "maeve-nominate-sink";
      frame.style.display = "none";
      document.body.appendChild(frame);
      form.target = frame.name;
      form.submit();
      window.setTimeout(done, 600);
    }
  }

  /* --- open / close ------------------------------------------------------- */

  function open() {
    modal.showModal();
    // Land on the first field rather than the close button. Once the form has
    // been sent there is no field to land on — the success card takes focus.
    if (!sent && fields.length) focusable(fields[0]).focus();
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-nominate-open]");
    if (!trigger) return;
    event.preventDefault();
    open();
  });

  modal.addEventListener("click", function (event) {
    // Clicks on the backdrop land on the <dialog> itself; anything inside the
    // panel does not. Esc is handled natively.
    if (event.target === modal) modal.close();
    if (event.target.closest("[data-nominate-close]")) modal.close();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submit();
  });

  fields.forEach(function (el) {
    el.addEventListener(isRadio(el) ? "change" : "input", function () {
      clearFieldError(el);
    });
  });
})();
