import { animate, onScroll, stagger, svg } from "animejs";

export function mountShowcase() {
  const root = document.querySelector("[data-showcase]");
  if (!root) return;

  const tabs = [...root.querySelectorAll("[data-preview-tab]")];
  const panels = [...root.querySelectorAll("[data-preview-panel]")];
  const previewWindow = root.querySelector("[data-preview-window]");
  const scrollProgress = document.querySelector("[data-scroll-progress]");

  const listeners = [];
  const activeAnims = new Set();
  const scrollObservers = [];
  let panelAnim;
  let bgController = null;
  let chartController = null;

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
      if (selected && shouldAnimate) {
        panelAnim = track(
          animate(panel, {
            opacity: [0.5, 1],
            translateY: [8, 0],
            duration: 300,
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
      bgController?.pulse((index - 1) * 0.45, -0.15);
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

  function updateScrollProgress() {
    if (!scrollProgress) return;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    scrollProgress.style.transform = `scaleX(${ratio.toFixed(4)})`;
  }

  function setupScrollEffects() {
    // Smooth staggered section reveals with Anime.js onScroll
    root.querySelectorAll("[data-scroll-section]").forEach((section) => {
      const items = [...section.querySelectorAll("[data-scroll-reveal]")];
      if (!items.length) return;
      const obs = onScroll({
        target: section,
        enter: "bottom-=70 top",
        onEnter: () => {
          const anim = animate(items, {
            opacity: [0, 1],
            translateY: [26, 0],
            duration: 680,
            delay: stagger(90),
            ease: "outCubic",
            onComplete: () => {
              items.forEach((item) => {
                clearInlineVisualProps(item);
                item.dataset.scrollShown = "true";
              });
              activeAnims.delete(anim);
            },
          });
          track(anim);
        },
      });
      scrollObservers.push(obs);
    });

    // Subtle scroll-scrubbed scale lift on the preview window & 3D chart frame
    [previewWindow, root.querySelector(".chart-frame")].forEach((frame) => {
      if (!frame) return;
      const anim = animate(frame, {
        scale: [0.975, 1],
        ease: "linear",
        autoplay: onScroll({
          target: frame,
          enter: "bottom top",
          leave: "center center",
          sync: 0.35,
        }),
      });
      track(anim);
    });

    // Scroll-drawn horizontal rule across the highlights strip
    const rulePaths = root.querySelectorAll("[data-scroll-draw]");
    const ruleSection = root.querySelector(".highlights-section");
    if (rulePaths.length && ruleSection) {
      try {
        const drawables = svg.createDrawable(rulePaths);
        const drawAnim = animate(drawables, {
          draw: ["0 0", "0 1"],
          ease: "linear",
          autoplay: onScroll({
            target: ruleSection,
            enter: "bottom-=40 top",
            leave: "center top",
            sync: 0.4,
          }),
        });
        track(drawAnim);
      } catch {
        // Keep static rule visible if SVG drawable fails.
      }
    }
  }

  listen(window, "scroll", updateScrollProgress, { passive: true });

  // Initial state
  selectTab("profile", false);
  const controls = root.querySelector("[data-showcase-controls]");
  if (controls) controls.hidden = false;
  document.documentElement.dataset.pageMotion = "full";
  updateScrollProgress();
  setupScrollEffects();
  root.dataset.showcaseReady = "true";

  // Calm opening Anime.js hero entrance
  const heroItems = [...root.querySelectorAll("[data-hero-item]")];
  if (heroItems.length) {
    track(
      animate(heroItems, {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 680,
        delay: stagger(95),
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

  // Gentle breathing pulse on the scroll cue line
  const cueLine = root.querySelector(".scroll-cue-line");
  if (cueLine) {
    track(
      animate(cueLine, {
        scaleY: [0.65, 1, 0.65],
        opacity: [0.45, 1, 0.45],
        duration: 2400,
        loop: true,
        ease: "inOutSine",
      })
    );
  }

  // Mount interactive Three.js background & 3D community chart
  const bgContainer = document.querySelector("[data-showcase-bg]");
  if (bgContainer) {
    import("./showcase-bg.js")
      .then(({ mountShowcaseBackground }) => {
        if (!root.isConnected) return;
        bgController = mountShowcaseBackground(bgContainer);
      })
      .catch(() => {});
  }

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
    for (const anim of activeAnims) anim.pause?.();
    activeAnims.clear();
    while (scrollObservers.length) scrollObservers.pop().revert?.();
    bgController?.destroy();
    chartController?.destroy();
    listeners.forEach((cleanup) => cleanup());
    document.documentElement.removeAttribute("data-page-motion");
  };
}
