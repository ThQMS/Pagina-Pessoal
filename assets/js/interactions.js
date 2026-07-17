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

  // This script is the last classic script in <body>, so the whole DOM above it already exists —
  // run immediately instead of waiting for DOMContentLoaded (which ES-module CDN imports can delay).
  renderIcons();
  typeTerminal();
  revealOnScroll();
  setupContactForm();
})();
