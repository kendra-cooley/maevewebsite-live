/* The /calendar/ page: drops anything already past, then searches and filters
   the server-rendered lists through their data-* attributes. Filter state is
   mirrored in the URL (?q=bsides&region=Europe) so a filtered view can be
   shared. No dependencies. */
(function () {
  "use strict";

  var form = document.querySelector("[data-cc-filters]");
  if (!form) return;

  // Today in the visitor's own time zone, as YYYY-MM-DD, to compare with the
  // ISO dates in the markup.
  var now = new Date();
  var today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")].join("-");

  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function remove(el) { el.parentNode.removeChild(el); }

  // The page was built on an earlier day: drop what has ended since.
  all("[data-cc-event]").forEach(function (el) { if (el.dataset.end < today) remove(el); });
  all("[data-deadline]").forEach(function (el) { if (el.dataset.deadline < today) remove(el); });
  all(".cc-event__cfps").forEach(function (ul) { if (!ul.children.length) remove(ul); });

  var events = all("[data-cc-event]");
  var groups = all("[data-cc-month-group]");
  var cfps = all("[data-cc-cfp]");
  events.forEach(function (el) { el.dataset.cfp = el.querySelector(".cc-event__cfps li") ? "true" : "false"; });
  groups.forEach(function (g) { if (!g.querySelector("[data-cc-event]")) remove(g); });

  var q = form.querySelector("[data-cc-q]");
  var region = form.querySelector("[data-cc-region]");
  var type = form.querySelector("[data-cc-type]");
  var month = form.querySelector("[data-cc-month]");
  var flags = all("[data-cc-flag]", form);
  var count = form.querySelector("[data-cc-count]");

  // Months that are now entirely past have nothing left to show.
  all("option", month).forEach(function (o) {
    if (o.value && !document.querySelector('[data-cc-month-group="' + o.value + '"]')) remove(o);
  });

  function terms() {
    return q.value.toLowerCase().split(/\s+/).filter(Boolean);
  }
  function hasAll(el, words) {
    var text = el.dataset.search || "";
    return words.every(function (w) { return text.indexOf(w) !== -1; });
  }

  // Both lists show three months at a time; "Show more" adds three more. Any
  // change to the search or filters starts again from the first three.
  var PAGE = 3;
  var limit = { events: PAGE, cfps: PAGE };

  // Of the items that match, keep only those in the first `months` distinct
  // months (items are in date order). Returns [shown, matching, hasMore].
  function page(items, matches, months) {
    var seen = [], shown = 0, total = 0;
    items.forEach(function (el) {
      if (!matches(el)) { el.hidden = true; return; }
      total++;
      var m = el.dataset.month;
      if (seen.indexOf(m) === -1) seen.push(m);
      el.hidden = seen.indexOf(m) >= months;
      if (!el.hidden) shown++;
    });
    return [shown, total, seen.length > months];
  }

  function apply(keepPaging) {
    if (keepPaging !== true) { limit.events = PAGE; limit.cfps = PAGE; }
    var words = terms();
    var on = {};
    flags.forEach(function (f) { on[f.dataset.ccFlag] = f.checked; });

    var ev = page(events, function (el) {
      var d = el.dataset;
      return hasAll(el, words) &&
        (!region.value || d.region === region.value) &&
        (!type.value || d.type === type.value) &&
        (!month.value || d.month === month.value) &&
        (!on.women || d.women === "true") &&
        (!on.cfp || d.cfp === "true") &&
        (!on.virtual || d.virtual === "true");
    }, limit.events);
    groups.forEach(function (g) {
      g.hidden = !g.querySelector("[data-cc-event]:not([hidden])");
    });
    count.textContent = count.dataset.template
      .replace("{shown}", ev[0]).replace("{total}", ev[1]);
    document.querySelector("[data-cc-empty]").hidden = ev[1] > 0;
    document.querySelector('[data-cc-more-wrap="events"]').hidden = !ev[2];

    // The deadlines list follows the search and region.
    var cf = page(cfps, function (el) {
      return hasAll(el, words) && (!region.value || el.dataset.region === region.value);
    }, limit.cfps);
    document.querySelector("[data-cc-cfp-empty]").hidden = cf[1] > 0;
    document.querySelector('[data-cc-more-wrap="cfps"]').hidden = !cf[2];

    syncUrl();
  }

  // Show three more months, then move focus to the first item revealed so
  // keyboard and screen-reader users land on the new content.
  all("[data-cc-more]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var which = btn.dataset.ccMore;
      var items = which === "events" ? events : cfps;
      var before = items.filter(function (el) { return !el.hidden; }).length;
      limit[which] += PAGE;
      apply(true);
      var next = items.filter(function (el) { return !el.hidden; })[before];
      var target = next && (which === "events"
        ? next.closest("[data-cc-month-group]").querySelector(".cc-month__title")
        : next.querySelector(".cc-event__title"));
      if (target && next.closest("[data-cc-month-group]") &&
          next.closest("[data-cc-month-group]").querySelector("[data-cc-event]:not([hidden])") !== next) {
        target = next.querySelector(".cc-event__title");
      }
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus();
      }
    });
  });

  function syncUrl() {
    var params = new URLSearchParams();
    if (q.value.trim()) params.set("q", q.value.trim());
    [region, type, month].forEach(function (s) { if (s.value) params.set(s.name, s.value); });
    flags.forEach(function (f) { if (f.checked) params.set(f.name, "1"); });
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  function readUrl() {
    var params = new URLSearchParams(location.search);
    q.value = params.get("q") || "";
    [region, type, month].forEach(function (s) {
      var v = params.get(s.name);
      if (v && all("option", s).some(function (o) { return o.value === v; })) s.value = v;
    });
    flags.forEach(function (f) { f.checked = params.get(f.name) === "1"; });
  }

  var timer;
  q.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { apply(); }, 120);
  });
  form.addEventListener("change", function () { apply(); });
  form.addEventListener("submit", function (e) { e.preventDefault(); apply(); });
  // type="reset" clears the controls first; re-filter on the next tick.
  form.addEventListener("reset", function () { setTimeout(function () { apply(); }, 0); });

  readUrl();
  form.hidden = false;
  apply();
})();
