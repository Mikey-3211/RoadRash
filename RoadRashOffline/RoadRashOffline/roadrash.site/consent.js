// Analytics is enabled by default without an automatic banner. A saved opt-out takes precedence.
// Advertising signals remain denied; the privacy page can open the choice controls.
(function () {
  var ID = "G-ZEDKHKLWXC", KEY = "rr-analytics-consent", NOTICE_KEY = "rr-analytics-notice", NOTICE_VERSION = "support-ip-1";
  var w = window, d = document;
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = gtag;

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(value) { try { localStorage.setItem(KEY, value); } catch (e) { /* storage unavailable: keep the choice for this page */ } }
  var choice = read();
  if (choice !== "granted" && choice !== "denied") { choice = "granted"; write(choice); }
  if (choice === "granted") { try { localStorage.setItem(NOTICE_KEY, NOTICE_VERSION); } catch (e) {} }

  var NO_ADS = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  function defaults(analytics, extra) {
    var settings = { analytics_storage: analytics, wait_for_update: 500 };
    for (var k in NO_ADS) settings[k] = NO_ADS[k];
    for (var e in extra || {}) settings[e] = extra[e];
    gtag("consent", "default", settings);
  }
  defaults(choice);
  gtag("js", new Date());
  // The outer mobile page already records the automatic page view.
  gtag("config", ID, { send_page_view: w.frameElement?.dataset.landscapeShell !== 'true' });

  // Declining after accepting also removes the Google Analytics cookies already set.
  function clearCookies() {
    var host = location.hostname, domains = ["", host, "." + host.replace(/^www\./, "")];
    d.cookie.split(";").forEach(function (part) {
      var name = part.split("=")[0].trim();
      if (!/^_ga/.test(name)) return;
      domains.forEach(function (domain) {
        d.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (domain ? "; domain=" + domain : "");
      });
    });
  }

  function decide(value) {
    choice = value; write(value);
    try { localStorage.setItem(NOTICE_KEY, NOTICE_VERSION); } catch (e) {}
    gtag("consent", "update", { analytics_storage: value });
    if (value === "denied") clearCookies();
    hide();
  }

  var banner = null;
  function hide() { if (banner) { banner.remove(); banner = null; } }
  function show() {
    if (banner || !d.body) return;
    if (!d.getElementById("rr-consent-style")) {
      var style = d.createElement("style"); style.id = "rr-consent-style";
      style.textContent =
        ".rr-consent{position:fixed;z-index:2147483000;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);" +
        "box-sizing:border-box;width:min(720px,calc(100vw - 24px));padding:14px 16px;border:1px solid #f8f078;border-radius:6px;" +
        "background:#171710;color:#e9efe6;font:15px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 6px 24px #000a;" +
        "display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}" +
        ".rr-consent p{margin:0;flex:1 1 320px}.rr-consent a{color:#f8f078;text-underline-offset:3px}" +
        ".rr-consent .rr-actions{display:flex;gap:10px;flex:0 0 auto}" +
        ".rr-consent button{min-height:40px;min-width:96px;padding:8px 16px;border-radius:4px;border:1px solid #f8f078;" +
        "font:600 15px system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;touch-action:manipulation}" +
        ".rr-consent .rr-accept{background:#f8f078;color:#171710}.rr-consent .rr-decline{background:transparent;color:#f8f078}" +
        ".rr-consent button:focus-visible,.rr-consent a:focus-visible{outline:3px solid #f8f078;outline-offset:3px}";
      d.head.appendChild(style);
    }
    banner = d.createElement("section");
    banner.className = "rr-consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie choice");
    banner.innerHTML =
      "<p>We'd like to use analytics to see how people play. For support choices, our server also records your IP address and approximate location for 30 days. " +
      "No ads, nothing sold. <a href=\"/privacy/\">Privacy policy</a></p>" +
      "<div class=\"rr-actions\"><button type=\"button\" class=\"rr-decline\">Decline</button>" +
      "<button type=\"button\" class=\"rr-accept\">Accept</button></div>";
    banner.querySelector(".rr-accept").addEventListener("click", function () { decide("granted"); });
    banner.querySelector(".rr-decline").addEventListener("click", function () { decide("denied"); });
    // Keys pressed on the banner must not also drive the game behind it.
    banner.addEventListener("keydown", function (e) { e.stopPropagation(); });
    d.body.appendChild(banner);
  }

  w.rrConsent = {
    choice: function () { return choice; },
    state: function () { return choice; },
    open: show, accept: function () { decide("granted"); }, decline: function () { decide("denied"); }
  };
})();
