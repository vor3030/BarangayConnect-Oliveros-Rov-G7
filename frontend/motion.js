import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

export function mountMotion() {
  // The showcase owns its transitions so its page-motion control covers every effect.
  if (document.querySelector("[data-showcase]")) {
    document.documentElement.dataset.motionReady = "true";
    return () => {};
  }
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const cleanups = [];
    const progress = document.querySelector("[data-scroll-progress]");
    if (progress) gsap.to(progress, {
      scaleX: 1, ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: .25 },
    });
    const headings = document.querySelectorAll("h1:not([data-showcase-heading])");
    if (headings.length) gsap.from(headings, {
      clipPath: "inset(0 0 100% 0)", y: 9, duration: .45,
      ease: "power2.out", clearProps: "clipPath,transform",
    });
    const navigation = document.querySelectorAll(".sidebar-nav a");
    if (navigation.length) gsap.from(navigation, {
      x: -12, opacity: 0, duration: .45, stagger: .055,
      ease: "power2.out", clearProps: "opacity,transform",
    });
    const notices = document.querySelectorAll(".notice");
    if (notices.length) gsap.from(notices, {
      y: -9, scale: .98, opacity: 0, duration: .45,
      ease: "back.out(1.2)", clearProps: "opacity,transform",
    });
    document.querySelectorAll(".account-stats strong").forEach((element) => {
      if (!/^\d+$/.test(element.textContent.trim())) return;
      const total = Number(element.textContent.trim());
      const counter = { value: 0 };
      gsap.to(counter, {
        value: total, duration: .8, ease: "power2.out",
        scrollTrigger: { trigger: element, start: "top 95%", once: true },
        onUpdate: () => { element.textContent = String(Math.round(counter.value)); },
        onComplete: () => { element.textContent = String(total); },
      });
      cleanups.push(() => { element.textContent = String(total); });
    });
    document.querySelectorAll("[data-reveal]").forEach((element, index) => {
      gsap.from(element, {
        y: 14, opacity: 0, immediateRender: false, duration: .55, delay: Math.min(index * .04, .16),
        ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 96%", once: true },
        clearProps: "transform,opacity,visibility",
        onComplete: () => { element.dataset.revealed = "true"; },
      });
    });

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
      loop.to(traveler, {
        duration: 16, ease: "none",
        motionPath: { path, align: path, alignOrigin: [.5, .5] },
      }, 0);
      loop.to(path, { strokeDashoffset: -80, duration: 16, ease: "none" }, 0);
      loop.progress(.001);
      const sync = () => loop.paused(paused || !visible || document.hidden || !display.matches || panel.dataset.sceneReady !== "true");
      const onPause = (event) => { paused = event.detail; sync(); };
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
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

    document.querySelectorAll(".community-art [data-draw]").forEach((path) => {
      const length = path.getTotalLength();
      gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, {
        strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut",
        scrollTrigger: { trigger: path, start: "top 95%", once: true },
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  });

  media.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
    const cleanups = [];
    document.querySelectorAll(".quick-link").forEach((card) => {
      const highlight = (event) => {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty("--pointer-x", `${Math.round(event.clientX - bounds.left)}px`);
        card.style.setProperty("--pointer-y", `${Math.round(event.clientY - bounds.top)}px`);
      };
      card.addEventListener("pointermove", highlight);
      cleanups.push(() => {
        card.removeEventListener("pointermove", highlight);
        card.style.removeProperty("--pointer-x");
        card.style.removeProperty("--pointer-y");
      });
    });
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      const x = gsap.quickTo(card, "rotationY", { duration: .6, ease: "power3.out" });
      const y = gsap.quickTo(card, "rotationX", { duration: .6, ease: "power3.out" });
      gsap.set(card, { transformPerspective: 1100 });
      const move = (event) => {
        const bounds = card.getBoundingClientRect();
        x(((event.clientX - bounds.left) / bounds.width - .5) * 2);
        y(-((event.clientY - bounds.top) / bounds.height - .5) * 2);
      };
      const reset = () => { x(0); y(0); };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", reset);
      cleanups.push(() => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", reset); });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  });
  document.documentElement.dataset.motionReady = "true";
  return () => media.revert();
}
