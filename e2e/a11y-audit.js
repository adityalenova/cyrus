/* ══ The browser-side half of e2e/a11y.spec.ts.
   Kept as a plain .js file because Playwright serialises `page.evaluate`
   callbacks verbatim - any TypeScript annotation inside would reach the page
   as a syntax error. Injected with addScriptTag after each navigation, so the
   spec only has to ask for `window.__cyrusA11yScan()` and assert on what
   comes back. Everything here is a fact about the DOM, never a judgement:
   the thresholds live in the spec.                                            ═ */
(function () {
  var ownText = function (el) {
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return t;
  };

  var boxOf = function (el) { return el.getBoundingClientRect(); };

  var shown = function (el) {
    var r = boxOf(el);
    var s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05;
  };

  /* Hidden from assistive tech means hidden from the audit too: the hero's
     "+" registration marks are aria-hidden decoration, and judging their
     contrast would be a false positive the spec would spend its life
     explaining away. */
  var hiddenFromAT = function (el) {
    return !!(el.closest && el.closest('[aria-hidden="true"]')) ||
      el.getAttribute("aria-hidden") === "true";
  };

  /* The accessible name, computed the way a screen reader would roughly
     reach it: explicit ARIA, then a real <label>, then an inner image's alt,
     then the element's own text, then title as a last resort. */
  var name = function (el) {
    var a = el.getAttribute("aria-label");
    if (a && a.trim()) return a.trim();
    var ref = el.getAttribute("aria-labelledby");
    if (ref) {
      var t = ref.split(/\s+/)
        .map(function (id) { var n = document.getElementById(id); return n ? ownText(n) : ""; })
        .filter(Boolean).join(" ");
      if (t) return t;
    }
    if (el.tagName === "IMG") return (el.getAttribute("alt") || "").trim();
    var img = el.querySelector("img[alt]");
    if (img && img.getAttribute("alt") && img.getAttribute("alt").trim()) return img.getAttribute("alt").trim();
    var lab = el.labels;
    if (lab && lab.length) {
      var lt = Array.prototype.map.call(lab, function (l) { return ownText(l); }).filter(Boolean).join(" ");
      if (lt) return lt;
    }
    var text = ownText(el);
    if (text) return text;
    return (el.getAttribute("title") || "").trim();
  };

  /* WCAG relative luminance from a computed rgba() string; null when the
     colour is translucent, because then the background underneath belongs to
     a layer this function cannot see. */
  var lum = function (c) {
    var m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[,\s/]+/).filter(function (x) { return x !== ""; }).map(Number);
    var r = p[0], g = p[1], b = p[2], a = p.length > 3 ? p[3] : 1;
    if (a < 0.6) return null;
    var f = function (v) { return v <= 39.24 ? v / 1292 : Math.pow((v / 255 + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  var bgOf = function (el) {
    var n = el;
    while (n && n !== document.documentElement) {
      var s = getComputedStyle(n);
      /* A gradient fill is not a colour this function can reduce to one
         luminance, and the tiles that use one (the avatar fallbacks) are dark
         by construction. Guessing with the colour behind it would invent a
         failure the page does not have. */
      if (/gradient/.test(s.backgroundImage || "")) return null;
      var c = s.backgroundColor;
      if (lum(c) !== null) return c;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };

  var all = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  window.__cyrusA11yScan = function () {
    var out = {
      lang: document.documentElement.getAttribute("lang") || "",
      mains: all("main, [role=main]").length,
      h1: [], headingSkips: [], imgNoAlt: [], imgDecorativeAlone: [],
      unnamed: [], placeholderOnly: [], unnamedNav: [], lowContrast: [],
      landmarks: {},
    };

    out.landmarks = {
      header: all("header, [role=banner]").length,
      nav: all("nav, [role=navigation]").length,
      footer: all("footer, [role=contentinfo]").length,
    };

    /* headings: one h1, and never a jump of two levels - a reader navigates a
       page by that ladder. */
    var prev = 0;
    all("h1,h2,h3,h4,h5,h6").forEach(function (h) {
      var lvl = +h.tagName[1];
      var txt = ownText(h).slice(0, 60);
      if (lvl === 1) out.h1.push(txt);
      if (prev && lvl > prev + 1) out.headingSkips.push("h" + prev + " -> h" + lvl + ': "' + txt + '"');
      prev = lvl;
    });

    all("img").forEach(function (im) {
      if (hiddenFromAT(im)) return;
      if (im.getAttribute("alt") === null) {
        if (im.closest("picture,figure")) { /* still a missing decision */ }
        out.imgNoAlt.push((im.currentSrc || im.src || "(no src)").slice(0, 90));
        return;
      }
      if (im.getAttribute("alt").trim()) return;
      /* alt="" claims "decorative"; true only if a neighbour says what the
         picture shows and the picture is not the main thing in the box. */
      var r = boxOf(im);
      if (r.width < 96 || r.height < 96 || !shown(im)) return;
      var host = im.parentElement;
      var words = 0;
      for (var d = 0; d < 3 && host; d++, host = host.parentElement) {
        words = ownText(host).split(" ").filter(Boolean).length;
        if (words >= 4) break;
      }
      if (words < 4) out.imgDecorativeAlone.push((im.currentSrc || im.src || "img").slice(0, 90));
    });

    var SEL = "a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=combobox], [role=switch], [role=checkbox]";
    all(SEL).forEach(function (el) {
      if (!shown(el) || hiddenFromAT(el)) return;
      var tag = el.tagName.toLowerCase();
      if (tag === "input" && /^(hidden|submit|reset)$/.test(el.type)) return;
      var href = el.getAttribute("href");
      if (href === "#" || href === "") return;             /* styled spacer, not a link */
      var n = name(el);
      if (!n) { out.unnamed.push(tag + " " + el.outerHTML.slice(0, 170)); return; }
      if (/^[•…\-*_+×✕×]$/ .test(n)) { out.unnamed.push(tag + ' "' + n + '" ' + el.outerHTML.slice(0, 130)); return; }
      if (/^(input|select|textarea)$/.test(tag)) {
        var hasLabel = el.labels && el.labels.length;
        if (!hasLabel && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")
          && el.getAttribute("placeholder") && n === el.getAttribute("placeholder"))
          out.placeholderOnly.push(tag + ' "' + n + '"');
      }
    });

    all("nav").forEach(function (nv) {
      if (!name(nv)) out.unnamedNav.push(ownText(nv.querySelector("a") || nv).slice(0, 30));
    });

    /* Contrast, limited to short runs of text on a solid background: chips,
       captions, footers - the places a dense directory page gets it wrong. */
    var seen = {};
    all("body *").forEach(function (el) {
      var textNodes = Array.prototype.filter.call(el.childNodes, function (n) {
        return n.nodeType === 3 && (n.textContent || "").trim();
      });
      if (!textNodes.length || seen[ownText(el)] || !shown(el) || hiddenFromAT(el)) return;
      var txt = ownText(el);
      if (txt.length > 120) return;
      var s = getComputedStyle(el);
      var l1 = lum(s.color), l2 = lum(bgOf(el));
      if (l1 === null || l2 === null) return;
      var ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      var size = parseFloat(s.fontSize);
      var bold = parseInt(s.fontWeight || "400", 10) >= 700;
      var need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
      if (ratio < need) {
        seen[txt] = 1;
        out.lowContrast.push(ratio.toFixed(2) + " < " + need + ' "' + txt.slice(0, 44) + '" ' + s.color +
          " on " + bgOf(el) + " @" + size + "px w" + s.fontWeight);
      }
    });

    return out;
  };

  window.__cyrusTargets = function (min) {
    var bad = [];
    all("a[href], button, input, select, [role=button]").forEach(function (el) {
      var r = boxOf(el);
      if (!r.width || !r.height) return;
      if (r.height < min || r.width < min) {
        bad.push(el.tagName.toLowerCase() + ' "' + ownText(el).slice(0, 22) + '" ' +
          Math.round(r.width) + "x" + Math.round(r.height));
      }
    });
    return bad;
  };
})();
