/* ---------------------------------------------------------------------------
 * Episode player — swaps the facade for a real YouTube iframe on click.
 *
 * The markup (_includes/embed.html) ships a poster and a play button, and no
 * third-party request at all. This turns that into an iframe only once the
 * visitor asks for the video, which is what keeps the page free of Google
 * cookies for everyone who never presses play.
 *
 * youtube-nocookie.com is YouTube's own privacy-enhanced host: it holds back
 * personalisation cookies until playback actually starts.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; " +
    "gyroscope; picture-in-picture; web-share";

  var root = document.querySelector("[data-embed]");
  if (!root) return;

  var button = root.querySelector("[data-embed-play]");
  if (!button) return;

  var id = root.getAttribute("data-id") || "";
  var title = root.getAttribute("data-title") || "";

  button.addEventListener("click", function () {
    if (!id) return;

    var frame = document.createElement("iframe");
    // autoplay=1 because the click WAS the play instruction — without it the
    // visitor has to press play a second time, inside the iframe.
    frame.src = "https://www.youtube-nocookie.com/embed/" +
      encodeURIComponent(id) + "?autoplay=1&rel=0";
    frame.title = title;
    frame.allow = ALLOW;
    frame.allowFullscreen = true;
    frame.setAttribute("frameborder", "0");

    root.replaceChildren(frame);
    root.classList.add("is-playing");
    // The button that had focus is gone; move focus into the player so the
    // keyboard path continues where it left off instead of jumping to <body>.
    frame.focus();
  });
})();
