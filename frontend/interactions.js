import { animate, hover, press } from "motion";

export function mountInteractions() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new Map();
  let cleanups = [];
  const spring = { type: "spring", stiffness: 420, damping: 32 };
  const move = (element, values) => {
    animations.get(element)?.stop();
    animations.set(element, animate(element, values, spring));
  };
  const bindGestures = () => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
    animations.forEach((animation, element) => {
      animation.stop();
      element.style.removeProperty("transform");
    });
    animations.clear();
    if (reduced.matches || document.documentElement.dataset.pageMotion === "reduced") return;
    cleanups.push(hover(".quick-link", (element) => {
      move(element, { y: -3 });
      return () => move(element, { y: 0 });
    }));
    cleanups.push(press(".button, .password-toggle", (element) => {
      move(element, { scale: .98 });
      return () => move(element, { scale: 1 });
    }));
  };

  for (const input of document.querySelectorAll("input[type='password']")) {
    const wrapper = document.createElement("div");
    wrapper.className = "password-control";
    input.before(wrapper);
    wrapper.append(input);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.textContent = "Show";
    toggle.setAttribute("aria-label", "Show characters for this field");
    toggle.setAttribute("aria-controls", input.id);
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.textContent = show ? "Hide" : "Show";
      toggle.setAttribute("aria-label", `${show ? "Hide" : "Show"} characters for this field`);
      toggle.setAttribute("aria-pressed", String(show));
    });
    wrapper.append(toggle);
  }

  document.querySelectorAll(".faq-list details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (details.open && !reduced.matches && document.documentElement.dataset.pageMotion !== "reduced") {
        animate(details.querySelector("p"), { opacity: [0, 1], y: [-4, 0] }, { duration: .18 });
      }
    });
  });
  document.querySelector("[data-error-summary]")?.focus({ preventScroll: false });
  bindGestures();
  reduced.addEventListener("change", bindGestures);
  window.addEventListener("page-motion-change", bindGestures);
  document.documentElement.dataset.interactionsReady = "true";
  return () => {
    cleanups.forEach((cleanup) => cleanup());
    animations.forEach((animation) => animation.stop());
    reduced.removeEventListener("change", bindGestures);
    window.removeEventListener("page-motion-change", bindGestures);
  };
}
