/* skills-globe.js — 3D "skills universe", reproduced from the original site.
 *
 * Two overlaid renderers share one camera:
 *   • WebGLRenderer  → the wireframe icosahedron globe + dark core + orange glow shell
 *                      (icosahedron radius 2.8 detail 2, exactly like the source).
 *   • CSS3DRenderer  → the Devicon skill icons, placed on the vertices of an icosahedron
 *                      of radius 3.3 (just outside the globe), billboarded to face the camera.
 *
 * Nodes on the FAR side of the globe fade out and shrink (dot-product vs the camera), so only the
 * front hemisphere reads clearly — this is what keeps it from looking cramped. OrbitControls give a
 * slow auto-rotate (0.8) plus drag-to-rotate. Three.js is loaded from a CDN via the page import map.
 */
// Three.js (~700KB via CDN) is imported lazily — see the bootstrap at the bottom of this file.
// These are assigned by loadGlobe() right before initGlobe() runs.
let THREE, CSS3DRenderer, CSS3DObject, OrbitControls;

const ACCENT = "#d4af37";
const GLOBE_RADIUS = 2.8; // wireframe globe (world units)
const NODE_RADIUS = 3.3; // skill icons sit just outside the globe
const NODE_SCALE = 0.007; // world-units per CSS pixel for the DOM nodes

const SKILLS = [
  { icon: "devicon-nodejs-plain", label: "Node.js" },
  { icon: "devicon-typescript-plain", label: "TypeScript" },
  { icon: "devicon-javascript-plain", label: "JavaScript" },
  { icon: "devicon-react-original", label: "React" },
  { icon: "devicon-nextjs-plain", label: "Next.js" },
  { icon: "devicon-python-plain", label: "Python" },
  { icon: "devicon-django-plain", label: "Django" },
  { icon: "devicon-fastapi-plain", label: "FastAPI" },
  { icon: "devicon-express-original", label: "Express" },
  { icon: "devicon-nestjs-plain", label: "NestJS" },
  { icon: "devicon-laravel-original", label: "Laravel" },
  { icon: "devicon-php-plain", label: "PHP" },
  { icon: "devicon-react-original", label: "React Native" },
  { icon: "devicon-flutter-plain", label: "Flutter" },
  { icon: "devicon-dart-plain", label: "Dart" },
  { icon: "devicon-tailwindcss-original", label: "Tailwind" },
  { icon: "devicon-postgresql-plain", label: "PostgreSQL" },
  { icon: "devicon-mongodb-plain", label: "MongoDB" },
  { icon: "devicon-redis-plain", label: "Redis" },
  { icon: "devicon-sqlite-plain", label: "SQLite" },
  { icon: "devicon-docker-plain", label: "Docker" },
  { icon: "devicon-githubactions-plain", label: "GitHub Actions" },
  { icon: "devicon-git-plain", label: "Git" },
  { icon: "devicon-prometheus-original", label: "Prometheus" },
  { icon: "devicon-linux-plain", label: "Linux" },
  { icon: "devicon-kalilinux-plain", label: "Kali Linux" },
  { icon: "devicon-bash-plain", label: "Bash" },
  { icon: "devicon-html5-plain", label: "HTML5" },
  { icon: "devicon-css3-plain", label: "CSS3" },
  { icon: "devicon-handlebars-plain", label: "Handlebars" },
  { icon: "devicon-jest-plain", label: "Jest" },
];

// Icons whose Devicon brand colour is very dark (low luminance) and would vanish on the dark globe —
// these get a white glow via the "is-dark" class (see skills-globe.css).
const DARK_ICONS = new Set([
  "devicon-nextjs-plain",
  "devicon-express-original",
  "devicon-django-plain",
  "devicon-handlebars-plain",
  "devicon-linux-plain",
  "devicon-bash-plain",
]);

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Unique vertex directions of an icosahedron (radius r, detail 1) — same placement basis as the source.
function icosahedronDirections(r) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  const seen = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!seen.some((s) => s.distanceTo(v) < 0.1)) seen.push(v);
  }
  geo.dispose();
  return seen.map((v) => v.normalize());
}

function buildGlobe() {
  const group = new THREE.Group();
  const ico = new THREE.IcosahedronGeometry(GLOBE_RADIUS, 2);
  group.add(
    new THREE.Mesh(
      ico,
      new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.08, side: THREE.FrontSide })
    )
  );
  group.add(
    new THREE.Mesh(
      ico,
      new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.02, side: THREE.BackSide })
    )
  );
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2.75, 16, 16),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    )
  );
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2.9, 16, 16),
      new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, side: THREE.BackSide })
    )
  );
  return group;
}

function buildNode(skill, dir) {
  const wrapper = document.createElement("div");
  const inner = document.createElement("div");
  inner.className = "skill-node";
  inner.title = skill.label;
  const icon = document.createElement("i");
  icon.className = skill.icon + " colored" + (DARK_ICONS.has(skill.icon) ? " is-dark" : ""); // ".colored" applies Devicon's brand colours
  const label = document.createElement("span");
  label.textContent = skill.label;
  inner.append(icon, label);
  wrapper.appendChild(inner);
  const obj = new CSS3DObject(wrapper);
  obj.position.copy(dir).multiplyScalar(NODE_RADIUS);
  obj.userData = { dir: dir.clone(), inner };
  return obj;
}

function initGlobe(mount) {
  const skills = shuffle(SKILLS);
  const dirs = icosahedronDirections(NODE_RADIUS);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 9); // direction seed; resize() adjusts the actual distance adaptively

  const gl = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  Object.assign(gl.domElement.style, { position: "absolute", inset: "0", zIndex: "1" });
  mount.appendChild(gl.domElement);

  const css = new CSS3DRenderer();
  Object.assign(css.domElement.style, { position: "absolute", inset: "0", zIndex: "2", pointerEvents: "none" });
  mount.appendChild(css.domElement);

  scene.add(buildGlobe());

  const nodes = dirs.map((dir, i) => {
    const obj = buildNode(skills[i % skills.length], dir);
    obj.scale.setScalar(NODE_SCALE);
    scene.add(obj);
    return obj;
  });

  const controls = new OrbitControls(camera, gl.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotateSpeed = 0.8;

  const camDir = new THREE.Vector3();

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    camera.aspect = w / h;
    // Adaptive distance: frame the node sphere to ~95% of the smaller mount dimension,
    // so the globe reads large on any monitor instead of a fixed world-space size.
    const bound = NODE_RADIUS + 0.4; // sphere radius + node card overhang
    const halfV = Math.tan((camera.fov * Math.PI) / 360);
    const distV = bound / (0.95 * halfV);
    const distH = bound / (0.95 * halfV * camera.aspect);
    camera.position.setLength(Math.max(distV, distH));
    camera.updateProjectionMatrix();
    gl.setSize(w, h);
    css.setSize(w, h);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    camera.getWorldPosition(camDir).normalize();
    for (const obj of nodes) {
      obj.quaternion.copy(camera.quaternion); // billboard toward the camera
      const facing = obj.userData.dir.dot(camDir); // 1 = front of globe, <0 = behind
      const s = facing > 0.1 ? Math.max(0, Math.min(1, (facing - 0.1) * 2)) : 0;
      obj.userData.inner.style.opacity = String(s);
      obj.userData.inner.style.pointerEvents = s > 0.8 ? "auto" : "none";
      obj.scale.setScalar(NODE_SCALE * (0.8 + 0.4 * s));
    }
    gl.render(scene, camera);
    css.render(scene, camera);
  }

  resize();
  controls.update();
  animate();

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(mount);
  else window.addEventListener("resize", resize);
}

// ---- Lazy bootstrap ----
// The CDN download only starts when the skills section approaches the viewport (600px early).
// If the CDN is unreachable, a quiet fallback note appears instead of an empty void.
function loadGlobe(mount) {
  Promise.all([
    import("three"),
    import("three/addons/renderers/CSS3DRenderer.js"),
    import("three/addons/controls/OrbitControls.js"),
  ])
    .then(function (mods) {
      THREE = mods[0];
      CSS3DRenderer = mods[1].CSS3DRenderer;
      CSS3DObject = mods[1].CSS3DObject;
      OrbitControls = mods[2].OrbitControls;
      initGlobe(mount);
    })
    .catch(function () {
      mount.innerHTML =
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:12px;color:#8b949e">// universo 3D indisponível no momento</div>';
    });
}

// Lightweight static grid for mobile — avoids the ~700KB Three.js download and the WebGL/CSS3D
// render loop that stutters on phones. Same skills, same Devicon icons, no runtime cost.
function renderStatic(mount) {
  var wrap = document.createElement("div");
  wrap.className = "skills-static";
  shuffle(SKILLS).forEach(function (s) {
    var item = document.createElement("div");
    item.className = "ss-item";
    item.title = s.label;
    var icon = document.createElement("i");
    icon.className = s.icon + " colored" + (DARK_ICONS.has(s.icon) ? " is-dark" : "");
    var label = document.createElement("span");
    label.textContent = s.label;
    item.append(icon, label);
    wrap.appendChild(item);
  });
  mount.appendChild(wrap);
  var caption = document.getElementById("skills-caption");
  if (caption) caption.style.display = "none"; // static grid: nothing to drag
}

// Geodesic sphere — subdivides an icosahedron exactly like THREE.IcosahedronGeometry(r, detail),
// returning unit vertices + unique edges. detail=2 matches the desktop globe's dense cage.
function buildGeodesic(detail) {
  var t = (1 + Math.sqrt(5)) / 2;
  var base = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
              [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  var faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
               [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8],
               [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  function lerp(p, q, s) { return [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s]; }
  function norm(p) { var l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }
  var verts = [], vmap = {}, edges = {}, cols = detail + 1;
  function addV(p) {
    var n = norm(p), k = n[0].toFixed(3) + "," + n[1].toFixed(3) + "," + n[2].toFixed(3);
    if (vmap[k] === undefined) { vmap[k] = verts.length; verts.push(n); }
    return vmap[k];
  }
  function addE(i, j) { if (i !== j) edges[Math.min(i, j) + "_" + Math.max(i, j)] = [Math.min(i, j), Math.max(i, j)]; }
  faces.forEach(function (f) {
    var a = base[f[0]], b = base[f[1]], c = base[f[2]], grid = [];
    for (var i = 0; i <= cols; i++) {
      grid[i] = [];
      var aj = lerp(a, c, i / cols), bj = lerp(b, c, i / cols), rows = cols - i;
      for (var j = 0; j <= rows; j++) grid[i][j] = rows === 0 ? addV(aj) : addV(lerp(aj, bj, j / rows));
    }
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < 2 * (cols - i) - 1; j++) {
        var k = Math.floor(j / 2), v1, v2, v3;
        if (j % 2 === 0) { v1 = grid[i][k + 1]; v2 = grid[i + 1][k]; v3 = grid[i][k]; }
        else { v1 = grid[i][k + 1]; v2 = grid[i + 1][k + 1]; v3 = grid[i + 1][k]; }
        addE(v1, v2); addE(v2, v3); addE(v3, v1);
      }
    }
  });
  return { verts: verts, edges: Object.keys(edges).map(function (k) { return edges[k]; }) };
}

// Light globe — a real rotating 3D icon sphere built from plain DOM nodes projected by hand
// (fibonacci distribution + Y/X rotation + perspective scale). ~31 nodes, no WebGL, no Three.js:
// the phone downloads nothing extra and the loop is cheap. Drag horizontally to spin.
function renderLightGlobe(mount) {
  var skills = shuffle(SKILLS);
  var N = skills.length;
  var container = document.createElement("div");
  container.className = "light-globe";

  var nodes = skills.map(function (s, i) {
    var el = document.createElement("div");
    el.className = "lg-node";
    var icon = document.createElement("i");
    icon.className = s.icon + " colored" + (DARK_ICONS.has(s.icon) ? " is-dark" : "");
    var label = document.createElement("span");
    label.textContent = s.label;
    el.append(icon, label);
    container.appendChild(el);
    var y = 1 - (i / (N - 1)) * 2;        // 1 .. -1
    var rad = Math.sqrt(Math.max(0, 1 - y * y));
    var theta = i * 2.399963;             // golden angle
    return { el: el, x: Math.cos(theta) * rad, y: y, z: Math.sin(theta) * rad };
  });
  mount.appendChild(container);

  // Wireframe cage: an icosahedron (12 verts, 30 edges) drawn on a light canvas behind the icons,
  // rotating with them — same shape the desktop WebGL globe uses, at a fraction of the cost.
  var wire = document.createElement("canvas");
  wire.className = "lg-wire";
  container.insertBefore(wire, container.firstChild);
  var wctx = wire.getContext("2d");
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  var geo = buildGeodesic(2); // detail 2 — same dense cage as the desktop globe
  var wv = geo.verts, wedges = geo.edges;
  var wsize = 0;

  var BASE = 0.008;
  var angY = 0, angX = -0.32, velY = BASE, velX = 0;
  var dragging = false, lastX = 0, lastY = 0;

  function coords(e) { var t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
  function down(e) { dragging = true; var p = coords(e); lastX = p.x; lastY = p.y; }
  function move(e) {
    if (!dragging) return;
    var p = coords(e), dx = p.x - lastX, dy = p.y - lastY;
    angY += dx * 0.007;
    velY = dx * 0.0009;
    if (e.type !== "touchmove") { angX += -dy * 0.007; velX = -dy * 0.0009; } // vertical tilt: mouse only
    lastX = p.x; lastY = p.y;
  }
  function up() { dragging = false; }
  container.addEventListener("touchstart", down, { passive: true });
  container.addEventListener("touchmove", move, { passive: true });
  container.addEventListener("touchend", up);
  container.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);

  var last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < 33) return; // ~30fps is plenty and light
    last = t;
    if (!dragging) {
      angY += velY; angX += velX;
      velY += (BASE - velY) * 0.03; // ease back to gentle auto-rotate
      velX *= 0.94;
    }
    if (angX > 0.6) angX = 0.6; else if (angX < -0.6) angX = -0.6;
    var w = mount.clientWidth, h = mount.clientHeight;
    var R = Math.min(w, h) * 0.4, cx = w / 2, cy = h / 2;
    var cy_ = Math.cos(angY), sy = Math.sin(angY), cx_ = Math.cos(angX), sx = Math.sin(angX);

    // --- wireframe cage ---
    if (wsize !== w * 10000 + h) { // resize canvas only when needed
      wsize = w * 10000 + h;
      wire.width = w * DPR; wire.height = h * DPR;
      wire.style.width = w + "px"; wire.style.height = h + "px";
      wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    wctx.clearRect(0, 0, w, h);
    var Rw = R * 0.82;
    var wp = wv.map(function (v) {
      var x1 = v[0] * cy_ - v[2] * sy, z1 = v[0] * sy + v[2] * cy_;
      var y2 = v[1] * cx_ - z1 * sx, z2 = v[1] * sx + z1 * cx_;
      return { x: cx + x1 * Rw, y: cy + y2 * Rw, z: z2 };
    });
    wctx.lineWidth = 1;
    for (var e = 0; e < wedges.length; e++) {
      var pa = wp[wedges[e][0]], pb = wp[wedges[e][1]];
      var op = ((pa.z + pb.z) / 2 + 1.15) / 2.15 * 0.26; // ~0.02 back → ~0.26 front, like desktop
      wctx.strokeStyle = "rgba(212,175,55," + op.toFixed(3) + ")";
      wctx.beginPath();
      wctx.moveTo(pa.x, pa.y);
      wctx.lineTo(pb.x, pb.y);
      wctx.stroke();
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var x1 = n.x * cy_ - n.z * sy;
      var z1 = n.x * sy + n.z * cy_;
      var y2 = n.y * cx_ - z1 * sx;
      var z2 = n.y * sx + z1 * cx_;
      var sc = (z2 + 1.7) / 2.7;                                  // depth -> scale
      var op = Math.max(0, Math.min(1, (z2 + 1.1) / 1.7));        // depth -> opacity
      n.el.style.left = (cx + x1 * R) + "px";
      n.el.style.top = (cy + y2 * R) + "px";
      n.el.style.transform = "translate(-50%,-50%) scale(" + sc.toFixed(3) + ")";
      n.el.style.opacity = op.toFixed(2);
      n.el.style.zIndex = ((z2 + 1) * 100) | 0;
      n.el.style.pointerEvents = op > 0.75 ? "auto" : "none";
    }
  }
  requestAnimationFrame(frame);
}

const mount = document.getElementById("skills-globe");
const isMobile = window.matchMedia("(max-width: 767px)").matches;
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (mount) {
  if (isMobile) {
    if (prefersReduced) renderStatic(mount); // no motion requested -> static grid
    else renderLightGlobe(mount);            // lightweight rotating sphere, no WebGL
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          io.disconnect();
          loadGlobe(mount);
        }
      },
      { rootMargin: "600px" }
    );
    io.observe(mount);
  } else {
    loadGlobe(mount);
  }
}
