import { animate, stagger } from "animejs";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animate as motionAnimate } from "motion";
import { isReducedMotion, subscribeMotionChange } from "./motion-pref.js";

gsap.registerPlugin(ScrollTrigger);

export function mountShowcase() {
  const root = document.querySelector("[data-showcase]");
  if (!root) return;

  const tabs = [...root.querySelectorAll("[data-preview-tab]")];
  const panels = [...root.querySelectorAll("[data-preview-panel]")];
  const scrollProgress = document.querySelector("[data-scroll-progress]");

  const listeners = [];
  const activeAnims = new Set();
  let panelAnim;
  let chartController = null;
  let atmosphereController = null;
  let gsapCtx = null;
  let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

  function listen(target, event, callback, options) {
    if (!target) return;
    target.addEventListener(event, callback, options);
    listeners.push(() => target.removeEventListener(event, callback, options));
  }

  function track(anim) {
    if (!anim) return anim;
    activeAnims.add(anim);
    return anim;
  }

  function clearInlineVisualProps(element) {
    if (!element) return;
    element.style.removeProperty("opacity");
    element.style.removeProperty("transform");
  }

  function selectTab(name, shouldAnimate = true) {
    if (panelAnim) {
      panelAnim.pause?.();
      activeAnims.delete(panelAnim);
    }
    tabs.forEach((tab) => {
      const selected = tab.dataset.previewTab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      const selected = panel.dataset.previewPanel === name;
      panel.hidden = !selected;
      clearInlineVisualProps(panel);
      if (selected && shouldAnimate && !isReducedMotion()) {
        panelAnim = track(
          animate(panel, {
            opacity: [0.74, 1],
            translateY: [8, 0],
            duration: 240,
            ease: "outCubic",
            onComplete: () => {
              clearInlineVisualProps(panel);
              activeAnims.delete(panelAnim);
            },
          })
        );
      }
    });
    root.dataset.activePreview = name;
  }

  tabs.forEach((tab, index) => {
    listen(tab, "click", () => {
      selectTab(tab.dataset.previewTab);
    });
    listen(tab, "keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectTab(tabs[next].dataset.previewTab);
      tabs[next].focus();
    });
  });

  panels.forEach((panel) => {
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `tab-${panel.dataset.previewPanel}`);
    panel.tabIndex = 0;
  });

  const supportsScrollTimeline =
    typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline: scroll()");

  let rafPending = false;
  function updateScrollProgress() {
    if (!scrollProgress || rafPending || isReducedMotion() || supportsScrollTimeline) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      scrollProgress.style.transform = `scaleX(${ratio.toFixed(4)})`;
    });
  }

  const bodyResizeObserver = new ResizeObserver(() => {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  });
  bodyResizeObserver.observe(document.documentElement);

  if (!supportsScrollTimeline) {
    listen(window, "scroll", updateScrollProgress, { passive: true });
  }

  function setupScrollChoreography() {
    gsapCtx?.revert();
    gsapCtx = null;
    if (isReducedMotion()) return;

    const heroOuter = root.querySelector(".sanctuary-hero-outer");
    const heroBackdrop = root.querySelector(".sanctuary-backdrop");
    const heroHeadline = root.querySelector(".sanctuary-headline-col");
    const heroCard = root.querySelector(".smoked-service-card");
    const heroLauncher = root.querySelector(".floating-launcher-wrap");

    gsapCtx = gsap.context(() => {
      // Multi-layer scrubbed depth parallax across the Barangay Hall hero on scroll
      if (heroOuter && heroBackdrop) {
        gsap.to(heroBackdrop, {
          yPercent: 14,
          scale: 1.15,
          ease: "none",
          scrollTrigger: {
            trigger: heroOuter,
            start: "top top",
            end: "bottom top",
            scrub: 0.45,
          },
        });
      }
      if (heroOuter && heroHeadline) {
        gsap.to(heroHeadline, {
          y: -36,
          opacity: 0.45,
          ease: "none",
          scrollTrigger: {
            trigger: heroOuter,
            start: "top top",
            end: "bottom top",
            scrub: 0.35,
          },
        });
      }
      if (heroOuter && heroCard) {
        gsap.to(heroCard, {
          y: -18,
          ease: "none",
          scrollTrigger: {
            trigger: heroOuter,
            start: "top top",
            end: "bottom top",
            scrub: 0.35,
          },
        });
      }
      if (heroOuter && heroLauncher) {
        gsap.to(heroLauncher, {
          y: 12,
          ease: "none",
          scrollTrigger: {
            trigger: heroOuter,
            start: "top top",
            end: "bottom top",
            scrub: 0.35,
          },
        });
      }

      // Self-drawing SVG path + staggered scroll-triggered journey steps
      const journeyBand = root.querySelector("[data-journey-band]");
      const journeyLine = root.querySelector("[data-journey-line]");
      if (journeyBand && journeyLine && typeof journeyLine.getTotalLength === "function") {
        const len = journeyLine.getTotalLength();
        gsap.set(journeyLine, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(journeyLine, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: journeyBand,
            start: "top 82%",
            end: "bottom 58%",
            scrub: 0.5,
          },
        });
      }

      const journeyCards = [...root.querySelectorAll("[data-journey-step]")];
      if (journeyBand && journeyCards.length) {
        gsap.fromTo(
          journeyCards,
          { y: 26, scale: 0.97 },
          {
            y: 0,
            scale: 1,
            duration: 0.55,
            stagger: 0.11,
            ease: "power3.out",
            clearProps: "transform",
            scrollTrigger: {
              trigger: journeyBand,
              start: "top 80%",
              once: true,
            },
          }
        );
      }

      // Smooth architectural lift on lower interactive frames
      root.querySelectorAll("[data-gsap-lift]").forEach((section) => {
        gsap.fromTo(
          section,
          { y: 28, scale: 0.985 },
          {
            y: 0,
            scale: 1,
            duration: 0.55,
            ease: "power3.out",
            clearProps: "transform",
            scrollTrigger: {
              trigger: section,
              start: "top 85%",
              once: true,
            },
          }
        );
      });
    }, root);
  }

  function syncMotionPreference() {
    document.documentElement.dataset.pageMotion = isReducedMotion() ? "reduced" : "full";
    if (isReducedMotion()) {
      activeAnims.forEach((anim) => anim.pause?.());
      activeAnims.clear();
      gsapCtx?.revert();
      gsapCtx = null;
      root.querySelectorAll("[data-hero-item], [data-preview-panel]").forEach(clearInlineVisualProps);
    } else {
      setupScrollChoreography();
    }
  }
  const unsubMotion = subscribeMotionChange(syncMotionPreference);

  const initialTab = tabs[0]?.dataset.previewTab || "request";
  selectTab(initialTab, false);
  const controls = root.querySelector("[data-showcase-controls]");
  if (controls) controls.hidden = false;
  syncMotionPreference();
  updateScrollProgress();
  root.dataset.showcaseReady = "true";

  // 1. Anime.js staggered hero entrance on load
  const heroItems = [...root.querySelectorAll("[data-hero-item]")];
  if (heroItems.length && !isReducedMotion()) {
    track(
      animate(heroItems, {
        opacity: [0.85, 1],
        translateY: [14, 0],
        duration: 340,
        delay: stagger(55),
        ease: "outCubic",
        onComplete: () => {
          heroItems.forEach(clearInlineVisualProps);
          root.dataset.showcaseSettled = "true";
        },
      })
    );
  } else {
    root.dataset.showcaseSettled = "true";
  }

  // 2. Anime.js + Framer Motion feedback when switching certificates or moods
  listen(window, "barangay:service-change", () => {
    if (isReducedMotion()) return;
    const fields = [...root.querySelectorAll(".smoked-field")];
    if (fields.length) {
      track(
        animate(fields, {
          opacity: [0.68, 1],
          translateY: [6, 0],
          duration: 240,
          delay: stagger(30),
          ease: "outCubic",
          onComplete: () => fields.forEach(clearInlineVisualProps),
        })
      );
    }
    const launcher = root.querySelector(".floating-launcher");
    if (launcher) {
      motionAnimate(launcher, { scale: [1, 1.015, 1] }, { duration: 0.26 });
    }
  });

  listen(window, "barangay:mood-change", (event) => {
    const mood = event.detail?.mood || "twilight";
    atmosphereController?.setMood(mood);
    atmosphereController?.pulseCenter();
  });

  listen(window, "barangay:atmosphere-toggle", (event) => {
    atmosphereController?.setPaused(Boolean(event.detail?.paused));
  });

  // 3. Compositor-only mouse-reactive depth on the barangay hall photography
  const heroOuter = root.querySelector(".sanctuary-hero-outer");
  const heroBackdrop = root.querySelector(".sanctuary-backdrop");
  let heroRect = heroOuter ? heroOuter.getBoundingClientRect() : null;
  let parallaxRaf = 0;
  let targetPx = 0;
  let targetPy = 0;
  let currentPx = 0;
  let currentPy = 0;

  function tickParallax() {
    parallaxRaf = 0;
    if (!heroBackdrop || isReducedMotion()) return;
    currentPx += (targetPx - currentPx) * 0.09;
    currentPy += (targetPy - currentPy) * 0.09;
    heroBackdrop.style.setProperty("--hero-px", `${currentPx.toFixed(2)}px`);
    heroBackdrop.style.setProperty("--hero-py", `${currentPy.toFixed(2)}px`);
    if (Math.abs(targetPx - currentPx) > 0.08 || Math.abs(targetPy - currentPy) > 0.08) {
      parallaxRaf = requestAnimationFrame(tickParallax);
    }
  }

  if (heroOuter && heroBackdrop) {
    listen(heroOuter, "pointermove", (event) => {
      if (isReducedMotion() || !heroRect || !heroRect.width || !heroRect.height) return;
      targetPx = -((event.clientX - heroRect.left) / heroRect.width - 0.5) * 26;
      targetPy = -((event.clientY - heroRect.top) / heroRect.height - 0.5) * 16;
      if (!parallaxRaf) parallaxRaf = requestAnimationFrame(tickParallax);
    });
    listen(heroOuter, "pointerleave", () => {
      targetPx = 0;
      targetPy = 0;
      if (!parallaxRaf && !isReducedMotion()) parallaxRaf = requestAnimationFrame(tickParallax);
    });
    listen(window, "resize", () => {
      heroRect = heroOuter.getBoundingClientRect();
    }, { passive: true });
  }

  // 4. Three.js Interactive Barangay Lantern & Constellation WebGL Field
  if (heroOuter && heroOuter.querySelector("[data-barangay-atmosphere]")) {
    import("./barangay-atmosphere.js")
      .then(({ mountBarangayAtmosphere }) => {
        if (!root.isConnected) return;
        atmosphereController = mountBarangayAtmosphere(heroOuter, { density: 68, constellations: true });
      })
      .catch(() => {});
  }

  // 5. Three.js Interactive 3D Purok Coverage Chart
  const chartSection = root.querySelector("[data-three-chart-section]");
  if (chartSection) {
    import("./three-chart.js")
      .then(({ mountThreeChart }) => {
        if (!root.isConnected) return;
        chartController = mountThreeChart(chartSection);
      })
      .catch(() => {});
  }

  return () => {
    unsubMotion();
    cancelAnimationFrame(parallaxRaf);
    gsapCtx?.revert();
    bodyResizeObserver.disconnect();
    activeAnims.forEach((anim) => anim.pause?.());
    activeAnims.clear();
    listeners.forEach((remove) => remove());
    atmosphereController?.destroy();
    chartController?.destroy();
  };
}
