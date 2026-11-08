/* photo-depth.js — "3D photo": a tiny WebGL shader that shifts each pixel of the
 * profile photo by its depth (depth map generated once with Depth Anything v2),
 * so the photo gains volume as the pointer moves.
 *   - desktop: follows the pointer anywhere on the page, drifts on its own when idle
 *   - phones:  follows device tilt where available, otherwise a slow idle drift
 *   - only renders while on screen; the plain <img> stays as fallback
 *     (no WebGL, image load error, or prefers-reduced-motion)
 */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var img = document.querySelector("img[data-depth]");
  if (!img) return;

  var STRENGTH = 0.045; // max uv shift at full tilt
  var FOCUS = 0.5;      // depth that stays still (0 = far, 1 = near)
  var ZOOM = 1.1;       // slight crop so shifted edges never show

  var canvas = document.createElement("canvas");
  canvas.className = img.className;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  var gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return;

  var VS =
    "attribute vec2 p;varying vec2 v;" +
    "void main(){v=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}";
  var FS =
    "precision mediump float;" +
    "uniform sampler2D uImg,uDepth;uniform vec2 uOff;uniform float uFocus,uZoom;varying vec2 v;" +
    "void main(){" +
    "  vec2 uv=(v-0.5)/uZoom+0.5;" +
    "  float d=texture2D(uDepth,uv).r;" +
    "  vec2 o=uOff*(d-uFocus);" +
    // one refinement step: re-read depth where we actually sample, reduces smearing at edges
    "  d=texture2D(uDepth,uv+o).r;" +
    "  o=uOff*(d-uFocus);" +
    "  gl_FragColor=texture2D(uImg,uv+o);" +
    "}";

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uOff = gl.getUniformLocation(prog, "uOff");
  gl.uniform1f(gl.getUniformLocation(prog, "uFocus"), FOCUS);
  gl.uniform1f(gl.getUniformLocation(prog, "uZoom"), ZOOM);
  gl.uniform1i(gl.getUniformLocation(prog, "uImg"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "uDepth"), 1);

  function load(src) {
    return new Promise(function (ok, fail) {
      var i = new Image();
      i.onload = function () { ok(i); };
      i.onerror = fail;
      i.src = src;
    });
  }
  function texture(unit, image) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /* ---- input: target tilt in [-1, 1] ---- */
  var tx = 0, ty = 0, cx = 0, cy = 0;
  var lastInput = -1e9;

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    var r = canvas.getBoundingClientRect();
    var mx = r.left + r.width / 2, my = r.top + r.height / 2;
    tx = Math.max(-1, Math.min(1, (e.clientX - mx) / (window.innerWidth * 0.5)));
    ty = Math.max(-1, Math.min(1, (e.clientY - my) / (window.innerHeight * 0.5)));
    lastInput = performance.now();
  }, { passive: true });

  window.addEventListener("deviceorientation", function (e) {
    if (e.gamma == null || e.beta == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 25));
    ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25)); // phone held at ~45°
    lastInput = performance.now();
  }, { passive: true });

  /* ---- render loop, only while visible ---- */
  var visible = false, running = false, size = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var s = Math.round(canvas.clientWidth * dpr);
    if (s && s !== size) {
      size = s;
      canvas.width = canvas.height = s;
      gl.viewport(0, 0, s, s);
    }
  }

  function frame(t) {
    if (!visible || document.hidden) { running = false; return; }
    if (t - lastInput > 2500) { // idle: slow figure-eight drift
      var k = t * 0.001;
      tx = Math.sin(k * 0.7) * 0.6;
      ty = Math.sin(k * 0.5) * Math.cos(k * 0.35) * 0.5;
    }
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    resize();
    // pointer to the right -> near pixels move left, like peeking around the subject
    gl.uniform2f(uOff, -cx * STRENGTH, cy * STRENGTH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }
  function start() {
    if (!running && visible) { running = true; requestAnimationFrame(frame); }
  }

  Promise.all([load(img.currentSrc || img.src), load(img.getAttribute("data-depth"))]).then(function (imgs) {
    texture(0, imgs[0]);
    texture(1, imgs[1]);
    img.parentNode.appendChild(canvas);
    img.style.visibility = "hidden"; // keeps alt text / layout; canvas paints over it
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      start();
    }).observe(canvas);
    document.addEventListener("visibilitychange", start);
  }).catch(function () { /* keep the plain photo */ });
})();
