/* entrance.js — "compile sweep" entrance.
 * When the boot screen's build meter fills, a bright gold "compiler head" (a glowing vertical seam)
 * sweeps left→right across the viewport. AHEAD of it (the still-dark region) lines of code rain
 * down over the veil; in its WAKE the real site is uncovered and dragged in from the left, as if the
 * code were being compiled straight into the page. The seam consumes the code field as it advances.
 *
 * Mechanic mirrors the sibling portfolios: the dark #boot overlay is revealed with a cheap clip-path
 * inset (Leonel's tornado) and the page shell is translated in behind the seam (Geovana's swarm), so
 * the site feels pulled along rather than cross-faded. Reduced resolution + 30fps cap on phones.
 * Honours prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 768px)").matches;

  var GOLD = "#d4af37";
  var GOLD_HOT = "#f9edc4";

  // Code-ish glyphs — letters + operators so the rain reads as source, not random noise.
  var CHARS = "01{}()[]<>/;=+*-&|!.#$_:absync await return const let=>funclassimportexport".split("");

  function run() {
    var boot = document.getElementById("boot");
    if (reduce) { if (boot) boot.classList.add("boot-skip"); return; }
    if (!boot || boot.classList.contains("boot-skip")) { if (boot) boot.style.display = "none"; return; }

    // The terminal text has done its job — fade it before the sweep so the code rain draws clean.
    var inner = boot.querySelector(".boot-inner");
    if (inner) { inner.style.transition = "opacity .25s ease"; inner.style.opacity = "0"; }

    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    Object.assign(c.style, {
      position: "fixed", inset: "0", zIndex: "10000", pointerEvents: "none",
      transition: "opacity .3s ease",
    });
    document.body.appendChild(c);
    var ctx = c.getContext("2d");
    if (!ctx) { boot.classList.add("boot-skip"); c.remove(); return; }
    window.__entranceRunning = true; // tells effects.js's safety timeout to stand down

    var W = window.innerWidth, H = window.innerHeight;
    var RES = desktop ? 1 : 0.8;
    c.width = Math.round(W * RES);
    c.height = Math.round(H * RES);
    c.style.width = "100%";
    c.style.height = "100%";
    if (RES !== 1) ctx.scale(RES, RES);
    ctx.textBaseline = "top";

    // ---- code rain columns (drawn only in the dark region ahead of the seam) ----
    var FONT = desktop ? 15 : 13;
    var GAP = FONT + (desktop ? 6 : 8);
    var NCOLS = Math.ceil(W / GAP) + 1;
    var cols = [];
    for (var i = 0; i < NCOLS; i++) {
      cols.push({
        x: i * GAP,
        y: Math.random() * H,                       // spread across the screen from frame 1
        spd: (desktop ? 2.4 : 2.0) + Math.random() * 3.6,
        len: (desktop ? 5 : 4) + (Math.random() * (desktop ? 7 : 4) | 0),
      });
    }

    var shell = document.querySelector(".min-h-screen.bg-dark-200");
    var DRAG = 44;                                  // px the page is dragged in behind the seam
    if (desktop && shell) {
      shell.style.willChange = "transform";
      shell.style.transform = "translate3d(" + (-DRAG) + "px,0,0)";
      void shell.offsetHeight;                      // promote the layer now, under the veil
    }

    var start = null, lastFrame = 0, MIN_DT = desktop ? 0 : 32;
    var RAIN = desktop ? 1100 : 900;                // let the code fill the screen before the sweep
    var DUR = desktop ? 3200 : 2800, OUTRO = 420, PAD = 60;
    var lastEdge = -100, done = false, outroStart = 0, cleaned = false;

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      window.__entranceRunning = false;
      c.remove();
      boot.classList.add("boot-skip");
      boot.style.display = "none";
      if (shell) { shell.style.transform = ""; shell.style.willChange = ""; }
    }
    window.setTimeout(cleanup, 2600 + RAIN + DUR + OUTRO + 1500);  // failsafe: never outlive the entrance

    function draw(t) {
      if (cleaned) return;
      if (start === null) start = t;
      if (t - lastFrame < MIN_DT) { requestAnimationFrame(draw); return; }
      lastFrame = t;

      // Phase 1 (0..RAIN): code rains and fills the screen, seam parked off-screen left.
      // Phase 2 (RAIN..RAIN+DUR): the seam sweeps across and compiles the site in.
      var p = Math.min(1, Math.max(0, (t - start - RAIN) / DUR));
      var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // easeInOut
      var seamX = -PAD + eased * (W + PAD * 2);

      ctx.clearRect(0, 0, W, H);

      // --- code rain, only to the RIGHT of the seam (the still-dark, uncompiled region) ---
      ctx.font = FONT + "px 'Geist Mono', 'Geist Mono Fallback', monospace";
      for (var k = 0; k < cols.length; k++) {
        var col = cols[k];
        col.y += col.spd;
        if (col.y - col.len * FONT > H) col.y = -Math.random() * H * 0.4;
        if (col.x < seamX - GAP) continue;          // already consumed by the seam
        var head = col.y;
        for (var j = 0; j < col.len; j++) {
          var cy = head - j * FONT;
          if (cy < -FONT || cy > H) continue;
          var ch = CHARS[(Math.random() * CHARS.length) | 0];
          if (j === 0) {
            ctx.fillStyle = GOLD_HOT;               // bright leading char
          } else {
            ctx.fillStyle = "rgba(212,175,55," + ((1 - j / col.len) * 0.55).toFixed(3) + ")";
          }
          ctx.fillText(ch, col.x, cy);
        }
      }

      // --- the compiler head: a glowing vertical seam riding the boundary ---
      if (seamX > -PAD && seamX < W + PAD) {
        if (desktop) { ctx.shadowColor = "rgba(249,237,196,0.9)"; ctx.shadowBlur = 22; }
        var g = ctx.createLinearGradient(seamX - 18, 0, seamX + 18, 0);
        g.addColorStop(0, "rgba(212,175,55,0)");
        g.addColorStop(0.5, "rgba(249,237,196,0.85)");
        g.addColorStop(1, "rgba(212,175,55,0)");
        ctx.fillStyle = g;
        ctx.fillRect(seamX - 18, 0, 36, H);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(249,237,196,0.95)";   // bright core line
        ctx.fillRect(seamX - 1, 0, 2, H);
      }

      // --- reveal the site in the seam's wake (clip the veil away from the left) ---
      var edge = Math.max(0, Math.min(100, (seamX / W) * 100));
      if (edge - lastEdge > 0.6) {                  // skip sub-pixel updates
        lastEdge = edge;
        boot.style.clipPath = "inset(0 0 0 " + edge.toFixed(1) + "%)";
      }
      // --- drag the page in from behind the seam (desktop only; no shell layer to move on mobile) ---
      if (desktop && shell && !done) {
        shell.style.transform = "translate3d(" + (-DRAG * (1 - eased)).toFixed(2) + "px,0,0)";
      }

      if (p >= 1 && !done) {
        done = true;
        outroStart = t;
        boot.style.clipPath = "";
        boot.classList.add("boot-skip");
        boot.style.display = "none";
        if (shell) { shell.style.transform = ""; shell.style.willChange = ""; }
      }
      if (done) {
        var T = t - outroStart;                     // the seam is off-screen; fade the last sparks
        c.style.opacity = String(Math.max(0, 1 - T / OUTRO));
        if (T >= OUTRO) { cleanup(); return; }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // Fires once the build meter has filled (bar starts 1.85s, runs 0.62s, "100%" lands at 2.42s).
  function boot() {
    try { if (document.getElementById("boot")) window.setTimeout(run, 2600); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
