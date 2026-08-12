(() => {
  "use strict";

  document.querySelectorAll("[data-language-switch]").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        localStorage.setItem("timecalc:language", link.hreflang || link.lang || "en");
      } catch (_) {}
    });

    if (location.hash.startsWith("#p=")) {
      link.href = `${link.getAttribute("href").split("#")[0]}${location.hash}`;
    }
  });
})();
