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

const mount = document.getElementById("skills-globe");
if (mount) {
  if ("IntersectionObserver" in window) {
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
