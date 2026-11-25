import { animate as motionAnimate, hover, press } from "motion";
import { animate as animeAnimate, stagger } from "animejs";
import { isReducedMotion, mountMotionOverrideBanner, subscribeMotionChange } from "./motion-pref.js";

export function mountInteractions() {
  mountMotionOverrideBanner();

  const cleanups = [];
  const activeMotion = new Map();
  const activeAnime = new Set();

  const spring = { type: "spring", stiffness: 420, damping: 26 };
  const runSpring = (el, values) => {
    activeMotion.get(el)?.stop();
    activeMotion.set(el, motionAnimate(el, values, spring));
  };

  function bindSpotlightCards() {
    document.querySelectorAll("[data-spotlight-card]").forEach((card) => {
      const onMove = (event) => {
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty("--card-mx", `${x.toFixed(1)}%`);
        card.style.setProperty("--card-my", `${y.toFixed(1)}%`);
        card.style.setProperty("--card-glow", "1");
      };
      const onLeave = () => {
        card.style.setProperty("--card-glow", "0");
      };
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
      });
    });
  }

  function bindMotionPhysics() {
    while (cleanups.length) cleanups.pop()();
    activeMotion.forEach((anim, el) => {
      anim.stop();
      el.style.removeProperty("transform");
    });
    activeMotion.clear();

    bindSpotlightCards();
    if (isReducedMotion()) return;

    // Framer Motion spring hover + tactile press physics
    cleanups.push(
      hover("[data-spring-pill]", (el) => {
        runSpring(el, { y: -2.5, scale: 1.035 });
        return () => runSpring(el, { y: 0, scale: 1 });
      })
    );
    cleanups.push(
      press("[data-spring-pill]", (el) => {
        runSpring(el, { scale: 0.94 });
        return () => runSpring(el, { scale: 1 });
      })
    );
    cleanups.push(
      hover("[data-spring-card]", (el) => {
        runSpring(el, { y: -5, scale: 1.01 });
        return () => runSpring(el, { y: 0, scale: 1 });
      })
    );
    cleanups.push(
      press("[data-spring-card]", (el) => {
        runSpring(el, { scale: 0.985 });
        return () => runSpring(el, { scale: 1 });
      })
    );
  }

  // Anime.js staggered auth form field entrance + smooth KPI roll-ups
  function mountAnimeChoreography() {
    if (isReducedMotion()) return;

    const authItems = [...document.querySelectorAll(".auth-form .form-field, .auth-form h1, .auth-form .form-description, .auth-form .button, .portal-benefits article")];
    if (authItems.length) {
      const anim = animeAnimate(authItems, {
        opacity: [0.78, 1],
        translateY: [10, 0],
        duration: 320,
        delay: stagger(35),
        ease: "outCubic",
        onComplete: () => {
          authItems.forEach((el) => {
            el.style.removeProperty("opacity");
            el.style.removeProperty("transform");
          });
          activeAnime.delete(anim);
        },
      });
      activeAnime.add(anim);
    }

    const counters = [...document.querySelectorAll("[data-count-up]")];
    if (!counters.length) return;
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
            duration: 680,
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
      { threshold: 0.2 }
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
  mountAnimeChoreography();
  const unsub = subscribeMotionChange(() => {
    bindMotionPhysics();
    mountAnimeChoreography();
  });
  document.documentElement.dataset.interactionsReady = "true";

  return () => {
    unsub();
    while (cleanups.length) cleanups.pop()();
    activeMotion.forEach((anim) => anim.stop());
    activeAnime.forEach((anim) => anim.pause?.());
  };
}
