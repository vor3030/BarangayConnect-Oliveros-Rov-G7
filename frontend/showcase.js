import { animate, stagger } from "animejs";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animate as motionAnimate } from "motion";

gsap.registerPlugin(ScrollTrigger);

export function mountShowcase() {
  const root = document.querySelector("[data-showcase]");
  if (!root) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tabs = [...root.querySelectorAll("[data-preview-tab]")];
  const panels = [...root.querySelectorAll("[data-preview-panel]")];
  const scrollProgress = document.querySelector("[data-scroll-progress]");

  const listeners = [];
  const activeAnims = new Set();
  let panelAnim;
  let chartController = null;
  let atmosphereController = null;
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
      if (selected && shouldAnimate && !reducedMotion.matches) {
        panelAnim = track(
          animate(panel, {
            opacity: [0.76, 1],
            translateY: [6, 0],
            duration: 200,
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
    if (!scrollProgress || rafPending || reducedMotion.matches || supportsScrollTimeline) return;
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

  function syncMotionPreference() {
    document.documentElement.dataset.pageMotion = reducedMotion.matches ? "reduced" : "full";
    if (reducedMotion.matches) {
      activeAnims.forEach((anim) => anim.pause?.());
      activeAnims.clear();
      root.querySelectorAll("[data-hero-item], [data-preview-panel]").forEach(clearInlineVisualProps);
    }
  }
  listen(reducedMotion, "change", syncMotionPreference);

  const initialTab = tabs[0]?.dataset.previewTab || "request";
  selectTab(initialTab, false);
  const controls = root.querySelector("[data-showcase-controls]");
  if (controls) controls.hidden = false;
  syncMotionPreference();
  updateScrollProgress();
  root.dataset.showcaseReady = "true";

  // 1. Anime.js staggered hero entrance on load
  const heroItems = [...root.querySelectorAll("[data-hero-item]")];
  if (heroItems.length && !reducedMotion.matches) {
    track(
      animate(heroItems, {
        opacity: [0.85, 1],
        translateY: [10, 0],
        duration: 320,
        delay: stagger(45),
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

  // 2. Anime.js + Framer Motion feedback when switching certificates or lighting moods
  listen(window, "barangay:service-change", () => {
    if (reducedMotion.matches) return;
    const fields = [...root.querySelectorAll(".smoked-field")];
    if (fields.length) {
      track(
        animate(fields, {
          opacity: [0.72, 1],
          translateY: [4, 0],
          duration: 210,
          delay: stagger(25),
          ease: "outCubic",
          onComplete: () => fields.forEach(clearInlineVisualProps),
        })
      );
    }
    const launcher = root.querySelector(".floating-launcher");
    if (launcher) {
      motionAnimate(launcher, { scale: [1, 1.01, 1] }, { duration: 0.24 });
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

  // 3. GSAP ScrollTrigger scrubbed depth parallax on the barangay hall hero backdrop
  const heroOuter = root.querySelector(".sanctuary-hero-outer");
  const heroBackdrop = root.querySelector(".sanctuary-backdrop");
  const gsapCtx = gsap.context(() => {
    if (reducedMotion.matches) return;
    if (heroOuter && heroBackdrop) {
      gsap.to(heroBackdrop, {
        yPercent: 9,
        ease: "none",
        scrollTrigger: {
          trigger: heroOuter,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }
    root.querySelectorAll("[data-gsap-lift]").forEach((section) => {
      gsap.fromTo(
        section,
        { y: 16 },
        {
          y: 0,
          duration: 0.45,
          ease: "power2.out",
          clearProps: "transform",
          scrollTrigger: {
            trigger: section,
            start: "top 88%",
            once: true,
          },
        }
      );
    });
  }, root);

  // 4. Compositor-only mouse-reactive depth on the barangay hall photography
  let heroRect = heroOuter ? heroOuter.getBoundingClientRect() : null;
  let parallaxRaf = 0;
  let targetPx = 0;
  let targetPy = 0;
  let currentPx = 0;
  let currentPy = 0;

  function tickParallax() {
    parallaxRaf = 0;
    if (!heroBackdrop || reducedMotion.matches) return;
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
      if (reducedMotion.matches || !heroRect || !heroRect.width || !heroRect.height) return;
      targetPx = -((event.clientX - heroRect.left) / heroRect.width - 0.5) * 22;
      targetPy = -((event.clientY - heroRect.top) / heroRect.height - 0.5) * 14;
      if (!parallaxRaf) parallaxRaf = requestAnimationFrame(tickParallax);
    });
    listen(heroOuter, "pointerleave", () => {
      targetPx = 0;
      targetPy = 0;
      if (!parallaxRaf && !reducedMotion.matches) parallaxRaf = requestAnimationFrame(tickParallax);
    });
    listen(window, "resize", () => {
      heroRect = heroOuter.getBoundingClientRect();
    }, { passive: true });
  }

  // 5. Three.js Interactive Barangay Twilight Lantern Particle Atmosphere
  if (heroOuter && heroOuter.querySelector("[data-barangay-atmosphere]")) {
    import("./barangay-atmosphere.js")
      .then(({ mountBarangayAtmosphere }) => {
        if (!root.isConnected) return;
        atmosphereController = mountBarangayAtmosphere(heroOuter, { density: 56 });
      })
      .catch(() => {
        // Photography remains crisp even when WebGL is unavailable.
      });
  }

  // 6. Three.js Interactive 3D Purok Coverage Chart
  const chartSection = root.querySelector("[data-three-chart-section]");
  if (chartSection) {
    import("./three-chart.js")
      .then(({ mountThreeChart }) => {
        if (!root.isConnected) return;
        chartController = mountThreeChart(chartSection);
      })
      .catch(() => {
        // Fallback text stays available if WebGL cannot start.
      });
  }

  return () => {
    cancelAnimationFrame(parallaxRaf);
    gsapCtx.revert();
    bodyResizeObserver.disconnect();
    activeAnims.forEach((anim) => anim.pause?.());
    activeAnims.clear();
    listeners.forEach((remove) => remove());
    atmosphereController?.destroy();
    chartController?.destroy();
  };
}
