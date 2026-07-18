/* entrance.js — "circuit traces" entrance.
 * When the boot screen's build meter fills, gold circuit traces grow outward from the centre and
 * route across the WHOLE viewport in PCB fashion (45° turns, branches, solder pads). Only once the
 * board is complete does the site power up underneath it; the traces then fade away.
 *
 * A coverage grid steers the routing toward whatever is still empty, so the board always finishes
 * edge to edge instead of leaving bald patches. The canvas is never cleared, so each frame only
 * draws the few new pixels at the growing tips. Honours prefers-reduced-motion.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 768px)").matches;

  var GOLD = "#d4af37";
  var GOLD_HOT = "#f9edc4";
  var WINE = "#a63a50";

  function run() {
    var boot = document.getElementById("boot");
    if (reduce) { if (boot) boot.classList.add("boot-skip"); return; }
    if (!boot || boot.classList.contains("boot-skip")) { if (boot) boot.style.display = "none"; return; }

    // The terminal text has done its job — clear it out before routing starts, so the board is
    // drawn on a clean dark surface instead of over the boot log. The dark backdrop itself stays.
    var inner = boot.querySelector(".boot-inner");
    if (inner) {
      inner.style.transition = "opacity .3s ease";
      inner.style.opacity = "0";
    }

    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    Object.assign(c.style, {
      position: "fixed", inset: "0", zIndex: "10000", pointerEvents: "none",
      transition: "opacity .5s ease",
    });
    document.body.appendChild(c);
    var ctx = c.getContext("2d");
    if (!ctx) { boot.classList.add("boot-skip"); c.remove(); return; }
    window.__entranceRunning = true; // tells effects.js's safety timeout to stand down

    var W = window.innerWidth, H = window.innerHeight;
    var RES = desktop ? 1 : 0.85;
    c.width = Math.round(W * RES);
    c.height = Math.round(H * RES);
    c.style.width = "100%";
    c.style.height = "100%";
    if (RES !== 1) ctx.scale(RES, RES);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 8 routing directions: orthogonal + 45° diagonals, the way real PCB traces are laid out.
    var DIRS = [];
    for (var d = 0; d < 8; d++) DIRS.push([Math.cos((d * Math.PI) / 4), Math.sin((d * Math.PI) / 4)]);

    // ---- coverage grid: tells the router where the board is still empty ----
    var CELL = desktop ? 74 : 62;
    var COLS = Math.ceil(W / CELL), ROWS = Math.ceil(H / CELL);
    var grid = new Uint8Array(COLS * ROWS);
    var covered = 0, TOTAL = COLS * ROWS;
    var TARGET = 0.9;                              // board is "done" at 90% of cells touched
    function mark(x, y) {
      var gx = (x / CELL) | 0, gy = (y / CELL) | 0;
      if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return;
      var k = gy * COLS + gx;
      if (!grid[k]) { grid[k] = 1; covered++; }
    }
    // nearest empty cell to (x,y) — used to steer new tips at whatever is still bare
    function nearestEmpty(x, y) {
      var bx = -1, by = -1, best = Infinity;
      for (var gy = 0; gy < ROWS; gy++) {
        for (var gx = 0; gx < COLS; gx++) {
          if (grid[gy * COLS + gx]) continue;
          var dx = (gx + 0.5) * CELL - x, dy = (gy + 0.5) * CELL - y;
          var dist = dx * dx + dy * dy;
          if (dist < best) { best = dist; bx = gx; by = gy; }
        }
      }
      return bx < 0 ? null : { x: (bx + 0.5) * CELL, y: (by + 0.5) * CELL };
    }
    function dirToward(fromX, fromY, toX, toY) {
      var ang = Math.atan2(toY - fromY, toX - fromX);
      return ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    }

    var MAX_TIPS = desktop ? 60 : 34;
    var SPEED = Math.sqrt(W * W + H * H) / (desktop ? 150 : 115); // px per frame

    var cx = W / 2, cy = H / 2;
    var tips = [];
    function newTip(x, y, dir, gen) {
      return { x: x, y: y, dir: dir, left: 30 + Math.random() * 95, gen: gen, wine: Math.random() < 0.18 };
    }
    for (var i = 0; i < 8; i++) tips.push(newTip(cx, cy, i, 0));

    function pad(x, y, hot) {
      ctx.beginPath();
      ctx.arc(x, y, hot ? 3.6 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = hot ? GOLD_HOT : GOLD;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, hot ? 6.5 : 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(212,175,55,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    pad(cx, cy, true);                              // the origin pad
    mark(cx, cy);

    // phases: 0 = routing the board, 1 = hold on the finished board,
    // 2 = outro (traces dissolve, then the backdrop eases away to reveal the site)
    var phase = 0, phaseStart = 0;
    var removed = false, bloomed = false;   // outro bookkeeping: canvas torn down, bloom applied
    var GROW_CAP = 7000;                            // hard stop so it can never hang
    var start = null, lastFrame = 0, MIN_DT = desktop ? 0 : 32;

    function step(t) {
      if (start === null) { start = t; phaseStart = t; }
      if (t - lastFrame < MIN_DT) { requestAnimationFrame(step); return; }
      lastFrame = t;

      if (phase === 0) {
        ctx.save();
        // The glow is per-stroke and shadowBlur is one of the most expensive canvas features on
        // phones — desktop gets the halo, mobile gets slightly brighter traces instead.
        if (desktop) {
          ctx.shadowColor = "rgba(212,175,55,0.8)";
          ctx.shadowBlur = 8;
        }
        for (var i = tips.length - 1; i >= 0; i--) {
          var tp = tips[i];
          var dir = DIRS[tp.dir];
          var nx = tp.x + dir[0] * SPEED, ny = tp.y + dir[1] * SPEED;

          ctx.beginPath();
          ctx.moveTo(tp.x, tp.y);
          ctx.lineTo(nx, ny);
          ctx.strokeStyle = tp.wine ? WINE : desktop ? GOLD : GOLD_HOT; // no halo on mobile → brighter
          ctx.lineWidth = tp.gen === 0 ? 2.4 : tp.gen === 1 ? 1.8 : 1.3;
          ctx.stroke();

          tp.x = nx; tp.y = ny;
          tp.left -= SPEED;
          mark(nx, ny);

          var off = nx < -30 || nx > W + 30 || ny < -30 || ny > H + 30;
          if (off) { tips.splice(i, 1); continue; }
          if (tp.left > 0) continue;

          // segment finished: turn, branch, or cap it with a solder pad
          var roll = Math.random();
          if (roll < 0.22 || tips.length >= MAX_TIPS) {
            pad(tp.x, tp.y, tp.gen === 0);
            tips.splice(i, 1);
          } else {
            var turn = Math.random() < 0.5 ? 1 : -1;             // 45° turn, PCB style
            tp.dir = (tp.dir + turn + 8) % 8;
            tp.left = 30 + Math.random() * 95;
            if (roll > 0.68 && tips.length < MAX_TIPS) {         // fork a branch
              pad(tp.x, tp.y, false);
              tips.push(newTip(tp.x, tp.y, (tp.dir - turn * 2 + 8) % 8, tp.gen + 1));
            }
          }
        }
        ctx.restore();

        // Keep the board filling: whenever routing thins out, start fresh tips aimed at the
        // emptiest area, so the traces reach every corner instead of stalling in the middle.
        var done = covered / TOTAL >= TARGET;
        if (!done && tips.length < (desktop ? 14 : 9)) {
          for (var r = 0; r < 3 && tips.length < MAX_TIPS; r++) {
            var spot = nearestEmpty(Math.random() * W, Math.random() * H);
            if (!spot) break;
            var sx = Math.max(0, Math.min(W, spot.x + (Math.random() - 0.5) * CELL * 3));
            var sy = Math.max(0, Math.min(H, spot.y + (Math.random() - 0.5) * CELL * 3));
            var nt = newTip(sx, sy, dirToward(sx, sy, spot.x, spot.y), 1);
            pad(sx, sy, false);
            tips.push(nt);
          }
        }

        if (done || t - phaseStart > GROW_CAP || tips.length === 0) {
          phase = 1; phaseStart = t;                 // board complete → power up the page
        }
      } else if (phase === 1) {
        // beat on the completed board before anything moves
        if (t - phaseStart > 400) { phase = 2; phaseStart = t; }
      } else {
        // Outro on a single clock. The traces dissolve first; the backdrop only starts lifting once
        // they are all but gone (T=520, ~14% left), which removes the dead black beat that made the
        // reveal feel abrupt — and it eases out slowly instead of cutting.
        var T = t - phaseStart;
        var tf = Math.min(1, T / 620);
        if (!removed) c.style.opacity = String(1 - tf);
        if (tf >= 1 && !removed) { removed = true; c.remove(); }

        if (T > 520) {
          var bf = Math.min(1, (T - 520) / 1100);
          var eased = 1 - Math.pow(1 - bf, 3);          // easeOutCubic: quick start, gentle landing
          boot.style.opacity = String(1 - eased);
          // warm gold bloom at the centre as the board's power flows into the page
          if (!bloomed) {
            bloomed = true;
            boot.style.background =
              "radial-gradient(circle at 50% 50%, rgba(212,175,55,0.13), rgba(125,31,53,0.06) 42%, #0a0a0a 72%)";
          }
          if (bf >= 1) { boot.classList.add("boot-skip"); boot.style.display = "none"; return; }
        }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Fires once the build meter has filled (bar starts 1.85s, runs 0.62s, "100%" lands at 2.42s).
  function boot() {
    try { if (document.getElementById("boot")) window.setTimeout(run, 2600); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
