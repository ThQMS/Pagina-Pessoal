/* effects.js — ambient dev/architecture effects, all decorative and self-contained:
 *   1. Matrix code rain  — gold/wine glyphs falling behind the content
 *   2. Compile bar       — top scroll-progress bar styled as a build meter
 *   3. Blueprint spine   — a left-gutter system trace that draws as you scroll (lg+)
 * Everything degrades gracefully and honours prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- 1. Matrix code rain ---------------- */
  function initMatrix() {
    if (window.matchMedia("(max-width: 767px)").matches) return; // skip the animated canvas on phones
    var shell = document.querySelector(".min-h-screen.bg-dark-200") || document.body;
    var canvas = document.createElement("canvas");
    canvas.id = "matrix-bg";
    canvas.setAttribute("aria-hidden", "true");
    shell.insertBefore(canvas, shell.firstChild); // above shell bg, below content
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var GLYPHS = "01</>{}();=+*[]#01ｱｲｳｴｵｶｷｸｹｺﾊﾋﾌﾍﾎ".split("");
    var FONT = 15;
    var drops = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      var cols = Math.floor(canvas.width / FONT);
      drops = [];
      for (var i = 0; i < cols; i++) drops[i] = Math.random() * -60;
    }
    resize();
    window.addEventListener("resize", resize);

    if (reduce) return; // no animation when reduced motion is requested

    var last = 0;
    function frame(t) {
      requestAnimationFrame(frame);
      if (t - last < 65) return; // ~15 fps: classic matrix cadence, cheap
      last = t;
      ctx.fillStyle = "rgba(16,16,16,0.10)"; // fade trail toward page black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = FONT + "px monospace";
      for (var i = 0; i < drops.length; i++) {
        var ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        var x = i * FONT;
        var y = drops[i] * FONT;
        var r = Math.random();
        ctx.fillStyle = r > 0.986 ? "#a03048" : r > 0.9 ? "#f0d98a" : "#b8942e";
        ctx.fillText(ch, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 2. Compile progress bar ---------------- */
  function initProgress() {
    var bar = document.createElement("div");
    bar.id = "compile-bar";
    var fill = document.createElement("div");
    fill.id = "compile-fill";
    bar.appendChild(fill);
    var pct = document.createElement("div");
    pct.id = "compile-pct";
    pct.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    document.body.appendChild(pct);

    var ticking = false;
    function apply() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      var v = Math.round(p * 100);
      fill.style.width = v + "%";
      pct.textContent = "build " + (v >= 100 ? "[done]" : "[" + v + "%]");
      pct.style.opacity = p > 0.01 ? "1" : "0";
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", apply);
    apply();
  }

  /* ---------------- 3. Blueprint spine ---------------- */
  function initBlueprint() {
    var SECTIONS = ["hero", "about", "skills", "experience", "projects", "formacao", "contact"];
    var wrap = document.createElement("div");
    wrap.id = "blueprint";
    wrap.setAttribute("aria-hidden", "true");
    var track = document.createElement("div");
    track.className = "bp-track";
    var fill = document.createElement("div");
    fill.className = "bp-fill";
    wrap.appendChild(track);
    wrap.appendChild(fill);

    var TOP = 8, SPAN = 84; // percentages, matching effects.css
    var nodes = SECTIONS.map(function (id, i) {
      var n = document.createElement("span");
      n.className = "bp-node";
      n.style.top = TOP + (SPAN * i) / (SECTIONS.length - 1) + "%";
      wrap.appendChild(n);
      return n;
    });
    document.body.appendChild(wrap);

    var activeIndex = 0;
    function paintNodes() {
      nodes.forEach(function (n, i) {
        n.classList.toggle("active", i === activeIndex);
        n.classList.toggle("passed", i < activeIndex);
      });
    }

    var ticking = false;
    function apply() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.height = p * SPAN + "%";
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", apply);
    apply();

    // Light the node of whichever section is most in view.
    if ("IntersectionObserver" in window) {
      var visible = {};
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0;
          });
          var best = -1, bestRatio = 0;
          SECTIONS.forEach(function (id, i) {
            if ((visible[id] || 0) > bestRatio) { bestRatio = visible[id]; best = i; }
          });
          if (best >= 0 && best !== activeIndex) { activeIndex = best; paintNodes(); }
        },
        { threshold: [0.15, 0.4, 0.7] }
      );
      SECTIONS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
    paintNodes();
  }

  /* ---------------- 4. Boot sequence: click / tap to skip ---------------- */
  function initBootSkip() {
    var el = document.getElementById("boot");
    if (!el) return;
    el.addEventListener("click", function () { el.classList.add("boot-skip"); });
    // Safety net: guarantee the overlay is gone even if the CSS animation never runs.
    window.setTimeout(function () { el.classList.add("boot-skip"); }, 2600);
  }

  /* ---------------- 5. Count-up on stats (when they scroll into view) ---------------- */
  function initCountUp() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    function run(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var dur = 900, start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target;
      }
      requestAnimationFrame(step);
    }
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- 6. Scramble section headings (decode effect) ---------------- */
  function initScramble() {
    if (reduce || !("IntersectionObserver" in window)) return;
    var CH = "!<>-_\\/[]{}=+*^?#01";
    var headings = document.querySelectorAll("main section h2.font-mono");
    function textNodeOf(h) {
      for (var i = h.childNodes.length - 1; i >= 0; i--) {
        var n = h.childNodes[i];
        if (n.nodeType === 3 && n.textContent.trim().length > 1) return n;
      }
      return null;
    }
    function scramble(node) {
      var finalText = node.textContent;
      var lead = finalText.match(/^\s*/)[0];
      var core = finalText.slice(lead.length);
      var frame = 0, total = core.length + 12;
      function tick() {
        var out = "";
        for (var i = 0; i < core.length; i++) {
          if (core[i] === " ") { out += " "; continue; }
          var revealAt = i + 6;
          if (frame >= revealAt) out += core[i];
          else out += CH[(Math.random() * CH.length) | 0];
        }
        node.textContent = lead + out;
        frame++;
        if (frame <= total) setTimeout(tick, 28);
        else node.textContent = finalText;
      }
      tick();
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var node = textNodeOf(e.target);
        if (node) scramble(node);
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    headings.forEach(function (h) { io.observe(h); });
  }

  function boot() {
    try { initMatrix(); } catch (e) {}
    try { initProgress(); } catch (e) {}
    try { initBlueprint(); } catch (e) {}
    try { initBootSkip(); } catch (e) {}
    try { initCountUp(); } catch (e) {}
    try { initScramble(); } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
