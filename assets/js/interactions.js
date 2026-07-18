/* interactions.js — front-end behaviour for the static design system.
 * Replaces the original Next.js/GSAP runtime with a lightweight, dependency-free version.
 *  1. Renders every <i data-lucide> placeholder into an inline SVG via the Lucide runtime.
 *  2. Reveals the hero terminal code lines with a staggered "typing" fade-in.
 *  3. Fades in [data-animate-on-scroll] elements as they enter the viewport (IntersectionObserver),
 *     mirroring the original scroll-reveal feel while degrading gracefully to fully visible.
 */
(function () {
  "use strict";

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  // Terminal typewriter — types the code token by token like the original site.
  // Full text is captured once at load so a mid-animation replay never loses characters.
  var TERMINAL_SEQ = null;
  var typingRun = 0;

  function collectTerminalSeq() {
    if (TERMINAL_SEQ) return TERMINAL_SEQ;
    TERMINAL_SEQ = [];
    document.querySelectorAll("[data-terminal-line]").forEach(function (line) {
      var tokens = Array.prototype.slice.call(line.children).slice(1).map(function (span) {
        return { el: span, text: span.textContent };
      });
      TERMINAL_SEQ.push({ line: line, tokens: tokens });
    });
    return TERMINAL_SEQ;
  }

  var REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function typeTerminal() {
    if (REDUCED_MOTION) {
      document.querySelectorAll("[data-terminal-line]").forEach(function (line) {
        line.style.opacity = "1";
      });
      return;
    }
    var seq = collectTerminalSeq();
    var run = ++typingRun;
    seq.forEach(function (item) {
      item.line.style.opacity = "0";
      item.tokens.forEach(function (t) {
        t.el.textContent = "";
      });
    });
    var li = 0, ti = 0, ci = 0;
    function step() {
      if (run !== typingRun || li >= seq.length) return;
      var item = seq[li];
      item.line.style.opacity = "1";
      if (ti >= item.tokens.length) {
        li++; ti = 0; ci = 0;
        window.setTimeout(step, 100); // pause between lines
        return;
      }
      var tok = item.tokens[ti];
      if (ci >= tok.text.length) {
        ti++; ci = 0;
        step();
        return;
      }
      ci++;
      tok.el.textContent = tok.text.slice(0, ci);
      window.setTimeout(step, 16);
    }
    window.setTimeout(step, 250);
  }

  // Section navigation map for the right rail, sidebar and mobile bottom nav (aria-label → section id).
  var NAV_TARGETS = {
    "Início": "hero", "Sobre": "about", "Habilidades": "skills", "Experiência": "experience",
    "Projetos": "projects", "Formação": "formacao", "Contato": "contact",
    "Ir para main.ts": "hero", "Ir para about.md": "about", "Ir para skills.json": "skills",
    "Ir para experience.git": "experience", "Ir para projects/": "projects",
    "Ir para formacao.md": "formacao", "Ir para contact.exe": "contact",
  };

  function scrollToSection(id) {
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Ordered list of the page sections — drives the right rail's active dot,
  // the keyboard (↑/↓) navigation and the hero's "scroll down" chevron.
  var SECTIONS = ["hero", "about", "skills", "experience", "projects", "formacao", "contact"];
  var currentIndex = 0;

  function goSection(dir) {
    var next = Math.min(SECTIONS.length - 1, Math.max(0, currentIndex + dir));
    if (next !== currentIndex) scrollToSection(SECTIONS[next]);
  }

  // Mobile hamburger menu: open/close the slide-in panel and navigate on item tap.
  function setupMobileMenu() {
    var toggle = document.getElementById("mobile-menu-toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;
    function open() { menu.classList.add("open"); toggle.setAttribute("aria-expanded", "true"); menu.setAttribute("aria-hidden", "false"); }
    function close() { menu.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-hidden", "true"); }
    toggle.addEventListener("click", function () {
      if (menu.classList.contains("open")) close(); else open();
    });
    menu.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("#mobile-menu-close") || (t.classList && t.classList.contains("mm-backdrop"))) { close(); return; }
      var link = t.closest && t.closest(".mm-link");
      if (link && link.getAttribute("data-nav")) { scrollToSection(link.getAttribute("data-nav")); close(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) close();
    });
  }
  setupMobileMenu();

  // One delegated listener handles every button — survives icon replacement and any init-order issue.
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;
    if (btn.id === "btn-about") {
      scrollToSection("about");
      return;
    }
    if (btn.id === "btn-view-projects") {
      scrollToSection("projects");
      return;
    }
    if (btn.id === "scroll-down-hint") {
      goSection(1);
      return;
    }
    var navId = NAV_TARGETS[btn.getAttribute("aria-label")];
    if (navId) scrollToSection(navId);
  });

  function revealOnScroll() {
    var targets = document.querySelectorAll("[data-animate-on-scroll]");
    if (window.location.search.indexOf("noanim") !== -1) return; // test mode: keep everything visible
    if (REDUCED_MOTION) return; // respect prefers-reduced-motion: no fade/slide reveals
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.style.opacity = "1";
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.transition = "opacity .5s ease-out, transform .5s ease-out";
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach(function (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      observer.observe(el);
    });
  }

  // ---- Contact form ----
  // With no backend on a static page, the form falls back to mailto: (opens the visitor's mail app
  // with everything pre-filled). To upgrade to direct sending, create a free endpoint at
  // https://formspree.io (or https://web3forms.com) and paste its URL below — nothing else changes.
  var CONTACT_ENDPOINT = "https://formspree.io/f/mlgqjzbk"; // Formspree → thqueirozsilva@gmail.com
  var CONTACT_EMAIL = "thqueirozsilva@gmail.com";

  function setupContactForm() {
    var form = document.querySelector("#contact form");
    if (!form) return;
    var button = form.querySelector('button[type="submit"]');
    var label = button ? button.querySelector("span") : null;

    function setStatus(text, done) {
      if (label) label.textContent = text;
      if (button) button.disabled = !done;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.querySelector("#website").value) return; // honeypot: silently drop bots

      var name = form.querySelector("#contact-name").value.trim();
      var email = form.querySelector("#contact-email").value.trim();
      var subject = form.querySelector("#contact-subject").value.trim() || "Contato via portfólio";
      var message = form.querySelector("#contact-message").value.trim();

      if (CONTACT_ENDPOINT) {
        setStatus("Enviando...", false);
        fetch(CONTACT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: name, email: email, subject: subject, message: message }),
        })
          .then(function (res) {
            if (!res.ok) throw new Error(res.status);
            setStatus("✓ Mensagem enviada!", true);
            form.reset();
            window.setTimeout(function () { setStatus("Enviar Mensagem", true); }, 4000);
          })
          .catch(function () {
            setStatus("Erro — tente de novo", true);
            window.setTimeout(function () { setStatus("Enviar Mensagem", true); }, 4000);
          });
      } else {
        var body = message + "\n\n— " + name + " (" + email + ")";
        window.location.href =
          "mailto:" + CONTACT_EMAIL +
          "?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(body);
        setStatus("Abrindo seu e-mail...", true);
        window.setTimeout(function () { setStatus("Enviar Mensagem", true); }, 4000);
      }
    });
  }

  // ---- Section navigation: right-rail active dot + keyboard (↑/↓) ----
  // Lights up the rail dot for the section currently in view (and keeps its name
  // label visible, not only on hover), and lets the visitor move section-by-section
  // with the arrow keys. Runs after renderIcons() so the <i> placeholders are SVGs.
  function setupSectionNav() {
    var rail = document.getElementById("rail-nav");
    var buttons = rail ? Array.prototype.slice.call(rail.querySelectorAll("button")) : [];

    // Resolve the state-carrying children of one rail button.
    function parts(btn) {
      var labelDiv = btn.children[0];
      var spans = labelDiv.querySelectorAll("span");
      var wrapper = btn.children[1];
      return {
        labelDiv: labelDiv,
        labelSpan: spans[spans.length - 1], // the section name (last span; first is the "＞")
        ring: wrapper.children[0],
        dot: wrapper.children[1],
        icon: wrapper.children[1].firstElementChild, // <svg> after Lucide render
      };
    }

    // Capture the active/inactive class strings straight from the markup:
    // button[0] ships active, button[1] inactive — so the look stays in sync with the theme.
    var ACT = null, INA = null;
    if (buttons.length >= 2) {
      var p0 = parts(buttons[0]), p1 = parts(buttons[1]);
      ACT = { span: p0.labelSpan.getAttribute("class"), ring: p0.ring.getAttribute("class"), dot: p0.dot.getAttribute("class") };
      INA = { span: p1.labelSpan.getAttribute("class"), ring: p1.ring.getAttribute("class"), dot: p1.dot.getAttribute("class") };
    }

    function setIcon(icon, on) {
      if (!icon) return;
      icon.classList.remove("w-0", "h-0", "opacity-0", "scale-0", "w-4", "h-4", "opacity-100", "scale-100");
      icon.classList.add.apply(icon.classList, on ? ["w-4", "h-4", "opacity-100", "scale-100"] : ["w-0", "h-0", "opacity-0", "scale-0"]);
    }

    function paint(idx) {
      if (!ACT) return;
      buttons.forEach(function (btn, i) {
        var p = parts(btn), on = i === idx, t = on ? ACT : INA;
        p.labelSpan.setAttribute("class", t.span);
        p.ring.setAttribute("class", t.ring);
        p.dot.setAttribute("class", t.dot);
        setIcon(p.icon, on);
        // Keep the active section's name permanently visible; others revert to hover-only.
        p.labelDiv.style.opacity = on ? "1" : "";
        p.labelDiv.style.transform = on ? "translateX(0)" : "";
      });
    }

    var sectionEls = SECTIONS.map(function (id) { return document.getElementById(id); });

    // Scrollspy: the active section is the last one whose top has crossed ~35% of the
    // viewport; at the very bottom of the page we force the last section (which may be
    // too short to ever reach the middle line).
    function computeActive() {
      var line = window.innerHeight * 0.35;
      var idx = 0;
      for (var i = 0; i < sectionEls.length; i++) {
        var el = sectionEls[i];
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) idx = SECTIONS.length - 1;
      if (idx !== currentIndex) { currentIndex = idx; paint(idx); }
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { computeActive(); ticking = false; });
    }, { passive: true });
    window.addEventListener("resize", computeActive);

    // Arrow keys move between sections (ignored while typing in the contact form).
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var el = e.target, tag = (el && el.tagName ? el.tagName : "").toLowerCase();
      if (tag === "input" || tag === "textarea" || (el && el.isContentEditable)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); goSection(1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); goSection(-1); }
    });

    paint(currentIndex);
    computeActive();
  }

  // This script is the last classic script in <body>, so the whole DOM above it already exists —
  // run immediately instead of waiting for DOMContentLoaded (which ES-module CDN imports can delay).
  renderIcons();
  typeTerminal();
  revealOnScroll();
  setupContactForm();
  setupSectionNav();
})();
