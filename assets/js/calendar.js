/* ---------------------------------------------------------------------------
 * The month calendar on /events/.
 *
 * Builds a real <table> — caption, column headers, one cell per day — because
 * a calendar IS tabular data, and a grid of <div>s would have to reinvent
 * every relationship the table markup already carries.
 *
 * A day with an event renders the day number as a link to that event's page.
 * More than one that day: the number links to the earliest, and a dot-link per
 * extra event sits beneath it, each labelled with its own title. Nothing is
 * unreachable, and there is no popover to keep track of.
 *
 * Every visible string comes from _data/events.yml via the JSON block in
 * _includes/calendar.html — none is written here.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  // `root` is the whole block — heading included — so unhiding it at the end
  // never leaves a heading standing over nothing. `grid` is the panel the nav
  // and table are built into.
  var root = document.querySelector("[data-calendar]");
  var grid = root && root.querySelector("[data-calendar-grid]");
  if (!root || !grid) return;

  var dataEl = document.querySelector("[data-events]");
  var uiEl = document.querySelector("[data-calendar-ui]");
  if (!dataEl || !uiEl) return;

  var events, ui;
  try {
    events = JSON.parse(dataEl.textContent);
    ui = JSON.parse(uiEl.textContent);
  } catch (err) {
    // Leave the calendar hidden rather than showing a broken one; the list
    // below is unaffected.
    return;
  }

  /* Group events by "YYYY-MM-DD". A multi-day event is registered against
     every day it spans, so a conference is marked across the whole run. */
  var byDay = {};
  events.forEach(function (ev) {
    var d = parseISO(ev.date);
    var last = parseISO(ev.end || ev.date);
    if (!d || !last) return;
    while (d <= last) {
      var k = key(d);
      (byDay[k] = byDay[k] || []).push(ev);
      d = addDays(d, 1);
    }
  });
  Object.keys(byDay).forEach(function (k) {
    byDay[k].sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  });

  var today = startOfDay(new Date());
  var view = new Date(today.getFullYear(), today.getMonth(), 1);

  /* -- date helpers -------------------------------------------------------- */

  function parseISO(s) {
    // Split rather than new Date(s): "2026-08-14" is parsed as UTC midnight by
    // the Date constructor, which lands on the 13th anywhere west of Greenwich.
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function key(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function sameDay(a, b) { return key(a) === key(b); }

  /* -- chrome -------------------------------------------------------------- */

  var nav = el("div", "cal__nav");
  var caption;

  function navButton(cls, label, text, onClick) {
    var b = el("button", "cal__nav-btn " + cls);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }

  nav.appendChild(navButton("cal__nav-btn--yr", ui.prev_year, "«", function () { shift(-12); }));
  nav.appendChild(navButton("", ui.prev_month, "‹", function () { shift(-1); }));
  var todayBtn = el("button", "cal__today");
  todayBtn.type = "button";
  todayBtn.textContent = ui.today;
  todayBtn.addEventListener("click", function () {
    view = new Date(today.getFullYear(), today.getMonth(), 1);
    render();
  });
  nav.appendChild(todayBtn);
  nav.appendChild(navButton("", ui.next_month, "›", function () { shift(1); }));
  nav.appendChild(navButton("cal__nav-btn--yr", ui.next_year, "»", function () { shift(12); }));

  var table = el("table", "cal__table");
  grid.appendChild(nav);
  grid.appendChild(table);

  function shift(months) {
    view = new Date(view.getFullYear(), view.getMonth() + months, 1);
    render();
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /* -- the grid ------------------------------------------------------------ */

  function render() {
    table.replaceChildren();

    caption = el("caption", "cal__caption");
    // Announced on change; the buttons themselves say only "next month".
    caption.setAttribute("aria-live", "polite");
    caption.textContent = ui.months[view.getMonth()] + " " + view.getFullYear();
    table.appendChild(caption);

    var thead = el("thead");
    var hrow = el("tr");
    ui.weekdays.forEach(function (w) {
      var th = el("th", "cal__wd");
      th.scope = "col";
      var abbr = el("abbr");
      abbr.title = w.full;
      abbr.textContent = w.short;
      th.appendChild(abbr);
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    var tbody = el("tbody");
    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    // Weeks start Monday, matching the column headers in _data/events.yml.
    var lead = (first.getDay() + 6) % 7;
    var cursor = addDays(first, -lead);

    for (var w = 0; w < 6; w++) {
      var tr = el("tr");
      for (var i = 0; i < 7; i++) {
        tr.appendChild(cell(cursor));
        cursor = addDays(cursor, 1);
      }
      tbody.appendChild(tr);
      // Stop once the month is behind us — most months need five rows, not six.
      if (cursor.getMonth() !== view.getMonth() && cursor > first) break;
    }
    table.appendChild(tbody);
  }

  function cell(date) {
    var td = el("td", "cal__cell");
    var outside = date.getMonth() !== view.getMonth();
    if (outside) td.className += " cal__cell--out";
    if (sameDay(date, today)) {
      td.className += " cal__cell--today";
      // Shape as well as colour, so "today" is not signalled by hue alone.
      td.setAttribute("aria-current", "date");
    }

    var list = outside ? null : byDay[key(date)];
    if (!list || !list.length) {
      var span = el("span", "cal__day");
      span.textContent = date.getDate();
      td.appendChild(span);
      return td;
    }

    td.className += " cal__cell--has";

    var a = el("a", "cal__day cal__day--has");
    a.href = list[0].url;
    a.textContent = date.getDate();
    a.setAttribute("aria-label", label(date, list[0]));
    td.appendChild(a);

    if (list.length > 1) {
      var extra = el("span", "cal__dots");
      list.slice(1).forEach(function (ev) {
        var dot = el("a", "cal__dot");
        dot.href = ev.url;
        dot.setAttribute("aria-label", label(date, ev));
        dot.textContent = "•";
        extra.appendChild(dot);
      });
      td.appendChild(extra);
    }
    return td;
  }

  function label(date, ev) {
    return ui.day_has_event + " " + date.getDate() + " " +
      ui.months[date.getMonth()] + ": " + ev.title + ", " + ev.time;
  }

  render();
  root.hidden = false;
})();
