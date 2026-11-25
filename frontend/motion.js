import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

export function mountMotion() {
  if (document.querySelector("[data-showcase]")) {
    document.documentElement.dataset.motionReady = "true";
    return () => {};
  }

  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const cleanups = [];
    const progress = document.querySelector("[data-scroll-progress]");
    if (progress) {
      gsap.to(progress, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
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

    return () => cleanups.forEach((cleanup) => cleanup());
  });

  document.documentElement.dataset.motionReady = "true";
  return () => media.revert();
}
