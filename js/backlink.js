/**
 * "Back to the library" link for any app. Add one line to the app's page:
 *
 *   apps in this folder:   <script src="../../assets/js/backlink.js" defer></script>
 *   apps with own server:  copy this file into the app and load it the same way
 *
 * It adds a slim bar at the very top of the page with a "< Library" link in the
 * top-left corner, pushing the app's content down so nothing is covered.
 * Plain script, no dependencies. Does nothing inside an iframe or if already added.
 *
 * The library runs on port 8080. If you change it, change LIBRARY_PORT below.
 */
(function () {
  var LIBRARY_PORT = "8080";

  if (window.top !== window.self || document.getElementById("library-backlink")) return;

  // On the library's own server a relative link works; elsewhere point at the same host, library port.
  var href = location.port === LIBRARY_PORT
    ? "/"
    : location.protocol + "//" + location.hostname + ":" + LIBRARY_PORT + "/";

  function add() {
    var a = document.createElement("a");
    a.id = "library-backlink";
    a.href = href;
    a.setAttribute("aria-label", "Back to Webapp Library");
    a.textContent = "‹  Library";
    a.style.cssText = [
      "display:flex", "align-items:center", "box-sizing:border-box",
      "width:100%", "min-height:44px",
      "padding:0 16px 0 max(16px,env(safe-area-inset-left,0px))",
      "font:600 15px/1 Bahnschrift,'Segoe UI',system-ui,-apple-system,Arial,sans-serif",
      "letter-spacing:.02em", "text-decoration:none", "white-space:pre",
      "color:#f1eee4", "background:#0d0e0c",
      "border-bottom:1px solid rgba(241,238,228,.18)",
      "-webkit-tap-highlight-color:transparent"
    ].join(";");
    document.body.insertBefore(a, document.body.firstChild);
  }

  // Pull-to-refresh for phones lives next to this file, so every app that has the back bar gets it.
  var self = document.currentScript;
  if (self && self.src) {
    var ptr = document.createElement("script");
    ptr.src = self.src.replace(/backlink\.js(\?.*)?$/, "pullrefresh.js");
    ptr.defer = true;
    document.head.appendChild(ptr);
  }

  if (document.body) add();
  else document.addEventListener("DOMContentLoaded", add);
})();
