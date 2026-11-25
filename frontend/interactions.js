import { animate as motionAnimate, hover, press } from "motion";
import { animate as animeAnimate } from "animejs";

export function mountInteractions() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cleanups = [];
  const activeMotion = new Map();
  const activeAnime = new Set();

  const spring = { type: "spring", stiffness: 420, damping: 28 };
  const runSpring = (el, values) => {
    activeMotion.get(el)?.stop();
    activeMotion.set(el, motionAnimate(el, values, spring));
  };

  function bindMotionPhysics() {
    while (cleanups.length) cleanups.pop()();
    activeMotion.forEach((anim, el) => {
      anim.stop();
      el.style.removeProperty("transform");
    });
    activeMotion.clear();

    if (reduced.matches) return;

    // Framer Motion spring hover + tactile press on dedicated spring-enabled controls
    cleanups.push(
      hover("[data-spring-pill]", (el) => {
        runSpring(el, { y: -2, scale: 1.03 });
        return () => runSpring(el, { y: 0, scale: 1 });
      })
    );
    cleanups.push(
      press("[data-spring-pill]", (el) => {
        runSpring(el, { scale: 0.95 });
        return () => runSpring(el, { scale: 1 });
      })
    );
    cleanups.push(
      hover("[data-spring-card]", (el) => {
        runSpring(el, { y: -4 });
        return () => runSpring(el, { y: 0 });
      })
    );
  }

  // Anime.js smooth numeric roll-up on dashboard KPI counters
  function mountCounters() {
    const counters = [...document.querySelectorAll("[data-count-up]")];
    if (!counters.length || reduced.matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          observer.unobserve(el);
          const target = Number.parseInt(el.dataset.countUp || el.textContent || "0", 10);
          if (!Number.isFinite(target) || target <= 0) return;
          const state = { value: 0 };
          const anim = animeAnimate(state, {
            value: target,
            duration: 620,
            ease: "outExpo",
            onUpdate: () => {
              el.textContent = String(Math.round(state.value));
            },
            onComplete: () => {
              el.textContent = String(target);
              activeAnime.delete(anim);
            },
          });
          activeAnime.add(anim);
        });
      },
      { threshold: 0.25 }
    );
    counters.forEach((el) => observer.observe(el));
    cleanups.push(() => observer.disconnect());
  }

  // Accessible password visibility toggles
  const passwordInputs = [...document.querySelectorAll("input[type='password']")];
  const multiplePasswords = passwordInputs.length > 1;

  for (const input of passwordInputs) {
    const wrapper = document.createElement("div");
    wrapper.className = "password-control";
    input.before(wrapper);
    wrapper.append(input);

    const associatedLabel = input.id
      ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent?.trim()
      : "";
    const labelSuffix = multiplePasswords && associatedLabel ? ` (${associatedLabel})` : "";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.textContent = "Show";
    toggle.setAttribute("aria-label", `Show characters for this field${labelSuffix}`);
    if (input.id) toggle.setAttribute("aria-controls", input.id);
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.textContent = show ? "Hide" : "Show";
      toggle.setAttribute("aria-label", `${show ? "Hide" : "Show"} characters for this field${labelSuffix}`);
      toggle.setAttribute("aria-pressed", String(show));
    });
    wrapper.append(toggle);
  }

  document.querySelector("[data-error-summary]")?.focus({ preventScroll: false });
  bindMotionPhysics();
  mountCounters();
  reduced.addEventListener("change", bindMotionPhysics);
  document.documentElement.dataset.interactionsReady = "true";

  return () => {
    while (cleanups.length) cleanups.pop()();
    activeMotion.forEach((anim) => anim.stop());
    activeAnime.forEach((anim) => anim.pause?.());
    reduced.removeEventListener("change", bindMotionPhysics);
  };
}
