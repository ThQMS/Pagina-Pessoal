/* project-viz.js — a small live animation at the top of each pinned project card, showing what
 * the project does:
 *   linkup      candidates and jobs getting matched by semantic score
 *   nexus       requests hitting the gateway; most are routed to services, some rate-limited (429)
 *   soundprint  an audio wave turning into a constellation of fingerprint peaks, then a match
 *   ioc         a radar sweep querying threat-intel feeds around an indicator, then a verdict
 *   abyssal     a procedural dungeon generating room by room, with the player walking through
 *   devpulse    live latency sparklines, with the occasional incident spike
 * One shared rAF loop (~40fps) draws only the cards on screen. Reduced motion: one still frame.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var G = [212, 175, 55], HOT = [249, 237, 196], WINE = [190, 52, 86], GREY = [120, 120, 120];
  var MONO = "'Geist Mono', 'Geist Mono Fallback', monospace";

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function eout(t) { return 1 - Math.pow(1 - t, 3); }

  // glow sprites
  function sprite(c) {
    var s = document.createElement("canvas"); s.width = s.height = 64;
    var g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(HOT, 1)); gr.addColorStop(0.15, rgba(c, 0.85));
    gr.addColorStop(0.45, rgba(c, 0.2)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
  }
  var SG = sprite(G), SW = sprite(WINE);

  function kit(ctx) {
    return {
      glow: function (s, x, y, r, a) {
        if (a <= 0) return;
        ctx.globalAlpha = Math.min(1, a); ctx.drawImage(s, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
      },
      line: function (x1, y1, x2, y2, c, a, w) {
        ctx.strokeStyle = rgba(c, a); ctx.lineWidth = w || 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      },
      dot: function (x, y, r, c, a) {
        ctx.fillStyle = rgba(c, a); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      },
      text: function (s, x, y, c, a, align, size) {
        ctx.font = (size || 9) + "px " + MONO; ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
        ctx.fillStyle = rgba(c, a); ctx.fillText(s, x, y);
      },
    };
  }

  /* ---------------- scenes: each returns draw(t, dt) for a w×h box ---------------- */
  var SCENES = {};

  SCENES.linkup = function (ctx, w, h) {
    var k = kit(ctx), n = 5, L = [], R = [], matches = [], next = 0.3, drift = [];
    for (var i = 0; i < n; i++) {
      var y = h * (0.16 + 0.68 * i / (n - 1));
      L.push({ x: w * 0.1, y: y, fl: 0 }); R.push({ x: w * 0.9, y: y, fl: 0 });
    }
    for (var j = 0; j < 22; j++) drift.push({ x: rnd(0.25, 0.75) * w, y: rnd(0.1, 0.9) * h, v: rnd(-6, 6), p: rnd(0, 6) });
    function bez(m, p) {
      var a = L[m.a], b = R[m.b], u = 1 - p;
      return [u * u * u * a.x + 3 * u * u * p * (w * 0.4) + 3 * u * p * p * (w * 0.6) + p * p * p * b.x,
              u * u * u * a.y + 3 * u * u * p * m.cy + 3 * u * p * p * m.cy + p * p * p * b.y];
    }
    return function (t, dt) {
      // "embedding space" dust in the middle
      drift.forEach(function (d) {
        d.y += d.v * dt; if (d.y < 4 || d.y > h - 4) d.v *= -1;
        k.dot(d.x, d.y, 0.9, G, 0.18 + 0.12 * Math.sin(t * 2 + d.p));
      });
      if (t > next) {
        next = t + rnd(0.7, 1.1);
        matches.push({ a: ri(0, n - 1), b: ri(0, n - 1), t0: t, cy: rnd(0.15, 0.85) * h, s: (rnd(0.82, 0.98)).toFixed(2), hit: false });
      }
      matches = matches.filter(function (m) {
        var age = t - m.t0, p = eout(clamp(age / 0.8, 0, 1)), fade = 1 - clamp((age - 1.6) / 0.5, 0, 1);
        if (fade <= 0) return false;
        ctx.strokeStyle = rgba(G, 0.55 * fade); ctx.lineWidth = 1.2; ctx.beginPath();
        for (var s = 0; s <= 24; s++) { var q = bez(m, p * s / 24); s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
        ctx.stroke();
        var head = bez(m, p);
        if (p < 1) k.glow(SG, head[0], head[1], 7, 0.9);
        else {
          if (!m.hit) { m.hit = true; L[m.a].fl = 1; R[m.b].fl = 1; }
          var mid = bez(m, 0.5);
          k.text("match " + m.s, mid[0], mid[1] - 8, HOT, 0.85 * fade, "center");
        }
        return true;
      });
      L.concat(R).forEach(function (p, i) {
        var isJob = i >= n;
        k.glow(SG, p.x, p.y, 6 + p.fl * 10, 0.25 + p.fl * 0.6);
        ctx.strokeStyle = rgba(G, 0.9); ctx.lineWidth = 1;
        if (isJob) ctx.strokeRect(p.x - 3, p.y - 3, 6, 6);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.283); ctx.stroke(); }
        p.fl *= Math.pow(0.15, dt);
      });
      k.text("candidatos", L[0].x - 2, h - 6, GREY, 0.6, "left", 8);
      k.text("vagas", R[0].x + 2, h - 6, GREY, 0.6, "right", 8);
    };
  };

  SCENES.nexus = function (ctx, w, h) {
    var k = kit(ctx), gx = w * 0.45, gy = h / 2, svc = [], pk = [], next = 0, flash = 0, rate = 0;
    ["auth", "users", "orders"].forEach(function (s, i) { svc.push({ x: w * 0.86, y: h * (0.22 + 0.28 * i), name: s, fl: 0 }); });
    return function (t, dt) {
      svc.forEach(function (s) { k.line(gx, gy, s.x - 18, s.y, G, 0.12); });
      if (t > next) {
        next = t + rnd(0.09, 0.28);
        pk.push({ x: -4, y: rnd(0.12, 0.88) * h, st: 0, blocked: Math.random() < 0.18, s: null });
        rate++;
      }
      pk = pk.filter(function (p) {
        if (p.st === 0) { // inbound to the gateway
          var dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy), v = 120 * dt;
          if (d < v + 12) {
            if (p.blocked) { p.st = 2; p.vx = -60; p.vy = rnd(-30, 30); p.life = 0.7; flash = 1; }
            else { p.st = 1; p.s = svc[ri(0, 2)]; }
          } else { p.x += dx / d * v; p.y += dy / d * v; }
          k.glow(SG, p.x, p.y, 5, 0.8);
        } else if (p.st === 1) { // routed to a service
          var ex = p.s.x - 18 - p.x, ey = p.s.y - p.y, e = Math.hypot(ex, ey), u = 140 * dt;
          if (e < u) { p.s.fl = 1; return false; }
          p.x += ex / e * u; p.y += ey / e * u;
          k.glow(SG, p.x, p.y, 5, 0.9);
        } else { // rate-limited: bounces back and fades
          p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.life <= 0) return false;
          k.glow(SW, p.x, p.y, 6, p.life / 0.7);
        }
        return true;
      });
      // gateway hexagon
      ctx.strokeStyle = rgba(flash > 0.05 ? WINE : G, 0.9); ctx.lineWidth = 1.3; ctx.beginPath();
      for (var i = 0; i <= 6; i++) { var a = i * Math.PI / 3; i ? ctx.lineTo(gx + 13 * Math.cos(a), gy + 13 * Math.sin(a)) : ctx.moveTo(gx + 13, gy); }
      ctx.stroke();
      k.glow(flash > 0.05 ? SW : SG, gx, gy, 16, 0.3 + flash * 0.4);
      k.text("GW", gx, gy, HOT, 0.9, "center", 8);
      if (flash > 0.05) k.text("429", gx, gy - 21, WINE, flash, "center");
      flash *= Math.pow(0.08, dt);
      svc.forEach(function (s) {
        ctx.strokeStyle = rgba(G, 0.5 + s.fl * 0.5); ctx.lineWidth = 1;
        ctx.strokeRect(s.x - 18, s.y - 7, 36, 14);
        k.glow(SG, s.x - 18, s.y, 4 + s.fl * 8, s.fl * 0.8);
        k.text(s.name, s.x, s.y, s.fl > 0.2 ? HOT : G, 0.8, "center", 8);
        s.fl *= Math.pow(0.1, dt);
      });
      rate *= Math.pow(0.5, dt);
      k.text("jwt · rate-limit", 6, h - 7, GREY, 0.6, "left", 8);
    };
  };

  SCENES.soundprint = function (ctx, w, h) {
    var k = kit(ctx), ww = w * 0.52, x0 = w * 0.6, x1 = w * 0.96, peaks = [], next = 0.4, matched = -1;
    return function (t, dt) {
      // waveform with a sweeping playhead
      var mid = h / 2, ph = (t * 0.35 % 1) * ww;
      ctx.lineWidth = 1.1; ctx.beginPath();
      for (var x = 4; x <= ww; x += 2) {
        var env = 0.35 + 0.65 * Math.abs(Math.sin(x * 0.018 + t * 0.6));
        var y = mid + Math.sin(x * 0.21 + t * 7) * Math.sin(x * 0.047 - t * 2) * h * 0.32 * env;
        x === 4 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(G, 0.75); ctx.stroke();
      k.line(ph, 8, ph, h - 8, HOT, 0.5);
      k.glow(SG, ph, mid, 8, 0.6);
      // spectrogram box
      ctx.strokeStyle = rgba(G, 0.15); ctx.strokeRect(x0 - 4, 6, x1 - x0 + 8, h - 12);
      if (matched < 0 && t > next) {
        next = t + 0.28;
        peaks.push({ x: x0 + (peaks.length / 13) * (x1 - x0) + rnd(-3, 3), y: rnd(14, h - 14), t0: t });
        if (peaks.length >= 14) matched = t;
      }
      peaks.forEach(function (p, i) {
        for (var j = 1; j <= 2; j++) { var q = peaks[i - j]; if (q) k.line(q.x, q.y, p.x, p.y, G, 0.28); }
        var pop = eout(clamp((t - p.t0) / 0.25, 0, 1));
        k.glow(matched >= 0 ? SG : SG, p.x, p.y, 5 * pop, 0.85);
      });
      if (matched >= 0) {
        var a = clamp(1 - (t - matched - 1.0) / 0.4, 0, 1);
        k.text("match · 300ms", (x0 + x1) / 2, h - 13, HOT, a, "center");
        if (t - matched > 1.4) { peaks = []; matched = -1; next = t + 0.3; }
      }
    };
  };

  SCENES.ioc = function (ctx, w, h) {
    var k = kit(ctx), cx = w / 2, cy = h / 2, feeds = [], names = ["VT", "OTX", "Abuse", "Shodan", "URLh", "MISP"];
    names.forEach(function (n, i) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / names.length;
      feeds.push({ a: a, x: cx + Math.cos(a) * w * 0.34, y: cy + Math.sin(a) * h * 0.36, name: n, fl: 0, bad: false, last: -1 });
    });
    var sweep = 0, cycle = -1, hits = 0, verdict = "", vt = 0;
    return function (t, dt) {
      var prev = sweep; sweep = (t * 1.6) % (Math.PI * 2);
      if (sweep < prev) { // new lap: new indicator
        if (cycle >= 0) { verdict = hits >= 2 ? "malicious" : "clean"; vt = t; }
        cycle++; hits = 0;
        feeds.forEach(function (f) { f.bad = Math.random() < 0.3; });
      }
      // radar wedge
      for (var s = 0; s < 14; s++) {
        var a = sweep - Math.PI / 2 - s * 0.05;
        k.line(cx, cy, cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * h * 0.46, G, 0.09 * (1 - s / 14), 2);
      }
      feeds.forEach(function (f) {
        var rel = ((f.a + Math.PI / 2) - sweep + Math.PI * 4) % (Math.PI * 2);
        if (rel > Math.PI * 2 - 0.12 && f.last !== cycle) { f.last = cycle; f.fl = 1; if (f.bad) hits++; }
        k.line(cx, cy, f.x, f.y, f.fl > 0.1 ? (f.bad ? WINE : G) : G, 0.12 + f.fl * 0.5);
        if (f.fl > 0.05) { // query travelling out and back
          var p = 1 - f.fl, q = p < 0.5 ? p * 2 : 2 - p * 2;
          k.glow(f.bad ? SW : SG, cx + (f.x - cx) * q, cy + (f.y - cy) * q, 4, 0.9);
        }
        k.glow(f.bad && f.fl > 0.05 ? SW : SG, f.x, f.y, 5 + f.fl * 8, 0.3 + f.fl * 0.6);
        k.text(f.name, f.x, f.y + (f.y > cy ? 9 : -9), f.fl > 0.2 ? (f.bad ? WINE : HOT) : GREY, 0.85, "center", 8);
        f.fl *= Math.pow(0.25, dt);
      });
      // indicator
      ctx.strokeStyle = rgba(G, 0.9); ctx.lineWidth = 1.2; ctx.beginPath();
      for (var i = 0; i <= 6; i++) { var b = i * Math.PI / 3 + Math.PI / 6; i ? ctx.lineTo(cx + 11 * Math.cos(b), cy + 11 * Math.sin(b)) : ctx.moveTo(cx + 11 * Math.cos(b), cy + 11 * Math.sin(b)); }
      ctx.stroke();
      k.text("IOC", cx, cy, HOT, 0.9, "center", 8);
      if (verdict) {
        var va = clamp(1 - (t - vt - 1.4) / 0.6, 0, 1);
        k.text(verdict, w - 6, h - 7, verdict === "malicious" ? WINE : G, va, "right");
      }
    };
  };

  SCENES.abyssal = function (ctx, w, h) {
    var k = kit(ctx), C = 7, cols = Math.floor(w / C), rows = Math.floor(h / C), ox = (w - cols * C) / 2, oy = (h - rows * C) / 2;
    var rooms, path, t0;
    function gen(t) {
      rooms = []; t0 = t;
      for (var tries = 0; tries < 200 && rooms.length < 7; tries++) {
        var rw = ri(4, 8), rh = ri(3, 5), r = { x: ri(1, cols - rw - 1), y: ri(1, rows - rh - 1), w: rw, h: rh };
        if (rooms.every(function (o) { return r.x > o.x + o.w + 1 || r.x + r.w + 1 < o.x || r.y > o.y + o.h + 1 || r.y + r.h + 1 < o.y; })) rooms.push(r);
      }
      rooms.sort(function (a, b) { return a.x - b.x; });
      path = [];
      rooms.forEach(function (r, i) {
        var c = { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) };
        if (i) { var p = path[path.length - 1]; path.push({ x: c.x, y: p.y }); }
        path.push(c);
      });
    }
    function px(cx) { return ox + cx * C + C / 2; }
    function py(cy) { return oy + cy * C + C / 2; }
    gen(0);
    return function (t, dt) {
      var age = t - t0, per = 0.3, built = age / per;
      // corridors
      for (var i = 1; i < path.length; i++) {
        var need = Math.ceil(i / 2) + 0.5;
        if (built < need) break;
        ctx.setLineDash([2, 3]);
        k.line(px(path[i - 1].x), py(path[i - 1].y), px(path[i].x), py(path[i].y), G, 0.35);
        ctx.setLineDash([]);
      }
      // rooms (floor tiles + walls)
      rooms.forEach(function (r, i) {
        var p = clamp(built - i, 0, 1);
        if (p <= 0) return;
        ctx.fillStyle = rgba(G, 0.06 * p);
        for (var x = 0; x < r.w; x++) for (var y = 0; y < r.h; y++) if ((x + y) % 2 === 0) ctx.fillRect(ox + (r.x + x) * C + 1, oy + (r.y + y) * C + 1, C - 2, C - 2);
        ctx.strokeStyle = rgba(G, 0.75 * p); ctx.lineWidth = 1;
        ctx.strokeRect(ox + r.x * C + 0.5, oy + r.y * C + 0.5, r.w * C * eout(p), r.h * C);
      });
      // chest in the last room
      var last = rooms[rooms.length - 1];
      if (built > rooms.length) k.glow(SW, px(last.x + (last.w >> 1)), py(last.y + (last.h >> 1)), 7, 0.8 + 0.2 * Math.sin(t * 5));
      // the player walks the path once the map is built
      var walk = (age - rooms.length * per - 0.3) * 9; // cells per second
      if (walk > 0) {
        var acc = 0, pos = path[0];
        for (var j = 1; j < path.length; j++) {
          var seg = Math.abs(path[j].x - path[j - 1].x) + Math.abs(path[j].y - path[j - 1].y);
          if (walk <= acc + seg) { var f = (walk - acc) / (seg || 1); pos = { x: path[j - 1].x + (path[j].x - path[j - 1].x) * f, y: path[j - 1].y + (path[j].y - path[j - 1].y) * f }; break; }
          acc += seg; pos = path[j];
        }
        k.glow(SG, px(pos.x), py(pos.y), 8, 0.9);
        k.dot(px(pos.x), py(pos.y), 1.8, HOT, 1);
        if (walk > acc + 40) gen(t); // loop: a new floor
      }
      k.text("floor " + (1 + Math.floor(t0 / 1) % 9), w - 6, h - 6, GREY, 0.55, "right", 8);
    };
  };

  SCENES.devpulse = function (ctx, w, h) {
    var k = kit(ctx), series = [], N = 48, next = 0;
    [["api", 42], ["ws", 18], ["queue", 65]].forEach(function (s) {
      var v = []; for (var i = 0; i < N; i++) v.push(s[1] * rnd(0.8, 1.2));
      series.push({ name: s[0], base: s[1], v: v, bad: [], spike: 0 });
      series[series.length - 1].bad = v.map(function () { return false; });
    });
    var x0 = 82, x1 = w - 8, rowH = (h - 8) / 3;
    return function (t, dt) {
      if (t > next) {
        next = t + 0.12;
        series.forEach(function (s) {
          if (s.spike <= 0 && Math.random() < 0.012) s.spike = ri(5, 9);
          var bad = s.spike > 0, val = bad ? s.base * rnd(2.8, 3.6) : s.base * rnd(0.6, 1.5);
          if (bad) s.spike--;
          s.v.shift(); s.v.push(val); s.bad.shift(); s.bad.push(bad);
        });
      }
      series.forEach(function (s, i) {
        var top = 4 + i * rowH, mid = top + rowH / 2, mx = s.base * 3.4, cur = s.v[N - 1], bad = s.bad[N - 1];
        k.line(x0, top + rowH - 3, x1, top + rowH - 3, G, 0.08);
        for (var j = 1; j < N; j++) {
          var xa = x0 + (j - 1) / (N - 1) * (x1 - x0), xb = x0 + j / (N - 1) * (x1 - x0);
          var ya = top + rowH - 3 - Math.min(1, s.v[j - 1] / mx) * (rowH - 6), yb = top + rowH - 3 - Math.min(1, s.v[j] / mx) * (rowH - 6);
          k.line(xa, ya, xb, yb, s.bad[j] ? WINE : G, s.bad[j] ? 0.95 : 0.7, 1.2);
        }
        var ly = top + rowH - 3 - Math.min(1, cur / mx) * (rowH - 6);
        k.glow(bad ? SW : SG, x1, ly, 6, 0.9);
        var pulse = bad ? 0.6 + 0.4 * Math.sin(t * 12) : 1;
        k.dot(8, mid, 2.5, bad ? WINE : [74, 222, 128], pulse);
        k.text(s.name, 15, mid, GREY, 0.8, "left", 8);
        k.text(Math.round(cur) + "ms", x0 - 4, mid, bad ? WINE : G, 0.9, "right", 8);
      });
    };
  };

  /* ---------------- runtime ---------------- */
  var items = [];
  document.querySelectorAll(".card-viz[data-viz]").forEach(function (el) {
    var make = SCENES[el.getAttribute("data-viz")], cv = el.querySelector("canvas");
    if (!make || !cv) return;
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    items.push({ el: el, cv: cv, ctx: ctx, make: make, draw: null, w: 0, h: 0, t: rnd(0, 2), visible: false });
  });
  if (!items.length) return;

  function setup(it) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = it.el.clientWidth, h = it.el.clientHeight;
    if (!w || !h) return false;
    if (w === it.w && h === it.h && it.draw) return true;
    it.w = w; it.h = h;
    it.cv.width = Math.round(w * dpr); it.cv.height = Math.round(h * dpr);
    it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    it.draw = it.make(it.ctx, w, h);
    return true;
  }
  function render(it, dt) {
    if (!setup(it)) return;
    it.t += dt;
    it.ctx.globalCompositeOperation = "source-over";
    it.ctx.clearRect(0, 0, it.w, it.h);
    it.ctx.globalCompositeOperation = "lighter";
    it.draw(it.t, dt);
  }

  if (reduce) { // one still frame, advanced a bit so each scene shows something
    items.forEach(function (it) { for (var i = 0; i < 90; i++) render(it, 1 / 30); });
    return;
  }

  var running = false, last = 0;
  function loop(now) {
    var any = false;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    if (dt === 0 || dt >= 0.024) { // ~40fps cap
      last = now;
      items.forEach(function (it) { if (it.visible) { any = true; render(it, dt); } });
    } else any = items.some(function (it) { return it.visible; });
    if (any && !document.hidden) requestAnimationFrame(loop);
    else { running = false; last = 0; }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var it = items.find(function (x) { return x.el === en.target; });
      if (it) it.visible = en.isIntersecting;
    });
    kick();
  }, { rootMargin: "60px" });
  items.forEach(function (it) { io.observe(it.el); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
  window.addEventListener("resize", function () { items.forEach(function (it) { it.w = 0; }); });
})();
