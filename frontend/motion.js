import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { isReducedMotion, subscribeMotionChange } from "./motion-pref.js";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

export function mountMotion() {
  if (document.querySelector("[data-showcase]")) {
    document.documentElement.dataset.motionReady = "true";
    return () => {};
  }

  const atmosphereControllers = [];
  const atmosphereHosts = [...document.querySelectorAll("[data-atmosphere-host], .hero")].filter((el) =>
    el.querySelector("[data-barangay-atmosphere]")
  );
  if (atmosphereHosts.length) {
    import("./barangay-atmosphere.js")
      .then(({ mountBarangayAtmosphere }) => {
        atmosphereHosts.forEach((host) => {
          if (!host.isConnected) return;
          const isAuth = host.hasAttribute("data-atmosphere-host");
          const ctrl = mountBarangayAtmosphere(host, {
            density: isAuth ? 58 : 38,
            constellations: true,
          });
          if (ctrl) atmosphereControllers.push(ctrl);
        });
      })
      .catch(() => {});
  }

  const onMoodChange = (event) => {
    const mood = event.detail?.mood || "twilight";
    atmosphereControllers.forEach((ctrl) => {
      ctrl.setMood(mood);
      ctrl.pulseCenter();
    });
  };
  window.addEventListener("barangay:mood-change", onMoodChange);

  let gsapCtx = null;
  let cleanups = [];

  function teardownGsap() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    gsapCtx?.revert();
    gsapCtx = null;
  }

  function setupGsap() {
    teardownGsap();
    if (isReducedMotion()) return;

    gsapCtx = gsap.context(() => {
      const progress = document.querySelector("[data-scroll-progress]");
      const supportsScrollTimeline =
        typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline: scroll()");
      if (progress && !supportsScrollTimeline) {
        gsap.to(progress, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
        });
      }

      // Subtle scroll-linked parallax on Auth & Dashboard barangay backdrops
      const authBackdrop = document.querySelector(".auth-bg-layer");
      if (authBackdrop) {
        gsap.to(authBackdrop, {
          yPercent: 10,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.4 },
        });
      }

      document.querySelectorAll("[x-data='motionScene']").forEach((panel) => {
        const stage = panel.querySelector(".neighborhood-stage");
        const path = panel.querySelector(".connection-path");
        const traveler = panel.querySelector(".connection-traveler");
        if (!stage || !path || !traveler) return;
        let visible = false;
        let paused = panel.dataset.motionPaused === "true";
        const display = window.matchMedia("(min-width: 47rem)");
        const loop = gsap.timeline({ repeat: -1, paused: true });
        gsap.set(traveler, { visibility: "visible" });
        loop.to(
          traveler,
          {
            duration: 16,
            ease: "none",
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
          },
          0
        );
        loop.progress(0.001);
        const sync = () =>
          loop.paused(
            paused || !visible || document.hidden || !display.matches || panel.dataset.sceneReady !== "true"
          );
        const onPause = (event) => {
          paused = event.detail;
          sync();
        };
        const observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        });
        observer.observe(stage);
        panel.addEventListener("scene:pause", onPause);
        panel.addEventListener("scene:ready", sync);
        document.addEventListener("visibilitychange", sync);
        display.addEventListener("change", sync);
        cleanups.push(() => {
          observer.disconnect();
          panel.removeEventListener("scene:pause", onPause);
          panel.removeEventListener("scene:ready", sync);
          document.removeEventListener("visibilitychange", sync);
          display.removeEventListener("change", sync);
        });
      });
    });
  }

  setupGsap();
  const unsubMotion = subscribeMotionChange(setupGsap);

  document.documentElement.dataset.motionReady = "true";
  return () => {
    unsubMotion();
    window.removeEventListener("barangay:mood-change", onMoodChange);
    teardownGsap();
    atmosphereControllers.forEach((ctrl) => ctrl.destroy());
  };
}
