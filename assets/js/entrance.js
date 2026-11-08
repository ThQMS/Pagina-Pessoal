/* entrance.js — "data tunnel" entrance.
 * The camera travels down a tunnel of gold/wine light streaks (packets racing through fibre) that
 * accelerates into warp; the light at the end of the tunnel then opens up and becomes the site.
 * Drawn live on a canvas at the screen's own resolution, so it stays sharp on any display.
 *
 *  - the #boot overlay is the dark veil; a growing radial mask cuts the "tunnel exit" through it
 *  - desktop: the page also zooms/unblurs in through the exit (too heavy for phones)
 *  - click / tap / any key / "skip" button jumps straight to the exit
 *  - plays once per browser session (reloads go straight to the site)
 * Honours prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 768px)").matches;

  var G = [212, 175, 55], HOT = [249, 237, 196], WINE = [168, 44, 74];
  var EXIT_AT = 2.25, EXIT_DUR = 0.8, END = 3.3; // seconds

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function eout(t) { return 1 - Math.pow(1 - t, 3); }
  function ein(t) { return t * t * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function seen() {
    try { return sessionStorage.getItem("introSeen") === "1"; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
  }

  function run() {
    var boot = document.getElementById("boot");
    if (!boot) return;
    if (reduce || seen()) { boot.classList.add("boot-skip"); boot.style.display = "none"; return; }

    var cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:10000;pointer-events:none;";
    var ctx = cv.getContext("2d");
    if (!ctx) { boot.classList.add("boot-skip"); return; }
    document.body.appendChild(cv);
    window.__entranceRunning = true; // tells effects.js's safety timeout to stand down

    var skipBtn = boot.querySelector(".boot-skip-btn");
    try { if (localStorage.getItem("lang") === "en" && skipBtn) skipBtn.textContent = "skip ›"; } catch (e) {}

    var shell = document.querySelector(".min-h-screen.bg-dark-200");

    var W, H, CX, CY, RMAX, F;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      CX = W / 2; CY = H / 2; RMAX = Math.hypot(W, H) / 2; F = Math.min(W, H) * 0.5;
    }
    resize();
    window.addEventListener("resize", resize);

    // pre-rendered glow sprite (much cheaper than shadowBlur)
    var SG = document.createElement("canvas");
    SG.width = SG.height = 128;
    (function () {
      var g = SG.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(HOT, 1)); gr.addColorStop(0.12, rgba(G, 0.9));
      gr.addColorStop(0.4, rgba(G, 0.25)); gr.addColorStop(1, rgba(G, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    })();
    function glow(x, y, r, a) {
      if (a <= 0 || r <= 0) return;
      ctx.globalAlpha = Math.min(1, a); ctx.drawImage(SG, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1;
    }
    function hole(r) {
      var m = r > 0 ? "radial-gradient(circle at 50% 50%, transparent " + r + "px, #000 " + (r + 50) + "px)" : "";
      boot.style.webkitMaskImage = m; boot.style.maskImage = m;
    }
    function rise(p) {
      if (!desktop || !shell) return;
      shell.style.transform = p >= 1 ? "" : "scale(" + (0.82 + 0.18 * eout(p)).toFixed(4) + ")";
      shell.style.filter = p >= 1 ? "" : "blur(" + ((1 - eout(p)) * 8).toFixed(2) + "px)";
    }

    // streaks on a cylinder ahead of the camera
    var N = desktop ? 820 : 380, ZF = 40, P = [];
    for (var i = 0; i < N; i++) {
      var r = Math.random();
      P.push({ a: rnd(0, 6.283), r: rnd(0.8, 1.7), z: rnd(0.5, ZF), col: r < 0.14 ? WINE : r < 0.24 ? HOT : G });
    }

    if (desktop && shell) { shell.style.transformOrigin = "50% " + (window.scrollY + H / 2) + "px"; rise(0); }

    var t = 0, last = null, camZ = 0, rot = 0, done = false;

    function finish() {
      if (done) return;
      done = true;
      markSeen();
      window.removeEventListener("resize", resize);
      cv.remove();
      hole(0);
      boot.classList.add("boot-skip");
      boot.style.display = "none";
      if (shell) { shell.style.transform = ""; shell.style.filter = ""; shell.style.transformOrigin = ""; } // restore position:fixed children
      window.__entranceRunning = false;
    }

    function skip() { if (t < EXIT_AT) t = EXIT_AT; } // jump to the tunnel exit rather than cutting
    boot.addEventListener("click", skip);
    window.addEventListener("keydown", function onKey() { window.removeEventListener("keydown", onKey); skip(); });
    window.setTimeout(finish, 9000); // hard failsafe

    function frame(now) {
      if (done) return;
      var dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000); // clamp: tab switches don't jump
      last = now;
      t += dt;

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      var v = 3 + 70 * ein(seg(t, 0.3, 2.4));
      camZ += v * dt;
      rot += dt * (0.25 + 0.9 * seg(t, 0.3, 2.4));
      var L = 0.04 + v * 0.03, e = seg(t, EXIT_AT, EXIT_AT + EXIT_DUR), app = seg(t, 0, 0.5);

      // faint structural rings
      ctx.lineWidth = 1;
      for (var k = 0; k < 12; k++) {
        var zr = (((k * 3 - camZ) % 36) + 36) % 36 + 0.5;
        ctx.strokeStyle = rgba(G, 0.08 * (1 - zr / 36) * app * (1 - e));
        ctx.beginPath(); ctx.arc(CX, CY, 1.8 * F / zr, 0, 6.283); ctx.stroke();
      }

      // light at the end of the tunnel
      glow(CX, CY, 40 + 140 * seg(t, 0.5, 2.3), 0.25 + 0.6 * seg(t, 1.2, 2.3));

      for (var j = 0; j < P.length; j++) {
        var p = P[j], rel = p.z - camZ;
        if (rel < 0.25) { if (e > 0) continue; p.z += ZF; rel += ZF; }
        var ang = p.a + rot, x = Math.cos(ang) * p.r, y = Math.sin(ang) * p.r;
        var x1 = CX + x * F / rel, y1 = CY + y * F / rel;
        var x2 = CX + x * F / (rel + L), y2 = CY + y * F / (rel + L);
        var a = clamp(1 - rel / ZF, 0, 1) * app;
        ctx.strokeStyle = rgba(p.col, a * 0.8);
        ctx.lineWidth = clamp(3 / rel, 0.5, 3);
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y1); ctx.stroke();
        if (p.col === HOT) glow(x1, y1, clamp(14 / rel, 2, 14), a);
      }

      // exit: the end of the tunnel opens onto the site
      if (e > 0) {
        var R = ein(e) * RMAX * 1.15;
        hole(R);
        ctx.strokeStyle = rgba(HOT, 0.7 * (1 - e)); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(CX, CY, R + 25, 0, 6.283); ctx.stroke();
        glow(CX, CY, R + 120, 0.5 * (1 - e));
        if (skipBtn) skipBtn.style.visibility = "hidden"; // (opacity is held by its fade-in animation)
        if (e >= 1) boot.style.opacity = "0";
      }
      rise(e);
      cv.style.opacity = String(1 - seg(t, END - 0.4, END));

      if (t >= END) { finish(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
