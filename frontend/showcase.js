import { gsap } from "gsap";

export function mountShowcase() {
  const root = document.querySelector("[data-showcase]");
  if (!root) return;
  const tabs = [...root.querySelectorAll("[data-preview-tab]")];
  const panels = [...root.querySelectorAll("[data-preview-panel]")];
  const previewWindow = root.querySelector("[data-preview-window]");
  const motionButton = root.querySelector("[data-showcase-pause]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wide = window.matchMedia("(min-width: 47rem)");
  const listeners = [];
  const tweens = new Set();
  let paused = false;
  let requestedDevice = "desktop";
  let panelTween;
  let deviceTween;
  let identifierTween;

  const motionAllowed = () => !paused && !reduced.matches;
  function listen(target, event, callback) {
    target.addEventListener(event, callback);
    listeners.push(() => target.removeEventListener(event, callback));
  }
  function stop(tween) {
    tween?.kill();
    tweens.delete(tween);
  }
  function transition(element, from, duration = .24, complete) {
    const tween = gsap.fromTo(element, from, {
      opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration,
      ease: "power3.out", clearProps: "opacity,transform,clipPath",
      onComplete: () => { tweens.delete(tween); complete?.(); },
    });
    tweens.add(tween);
    return tween;
  }
  function selectTab(name, animate = true) {
    stop(panelTween);
    tabs.forEach((tab) => {
      const selected = tab.dataset.previewTab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      const selected = panel.dataset.previewPanel === name;
      panel.hidden = !selected;
      panel.style.removeProperty("opacity");
      panel.style.removeProperty("transform");
      panel.style.removeProperty("clip-path");
      if (selected && animate && motionAllowed()) panelTween = transition(panel, { opacity: .55, y: 5 });
    });
    root.dataset.activePreview = name;
  }
  tabs.forEach((tab, index) => {
    listen(tab, "click", () => selectTab(tab.dataset.previewTab));
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

  function syncDevice(animate = false) {
    stop(deviceTween);
    previewWindow.dataset.device = wide.matches ? requestedDevice : "responsive";
    root.querySelectorAll("[data-preview-device]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.previewDevice === requestedDevice));
    });
    if (animate && motionAllowed()) deviceTween = transition(previewWindow, { opacity: .65, y: 5 });
    else {
      previewWindow.style.removeProperty("opacity");
      previewWindow.style.removeProperty("transform");
      previewWindow.style.removeProperty("clip-path");
    }
  }
  root.querySelectorAll("[data-preview-device]").forEach((button) => {
    listen(button, "click", () => { requestedDevice = button.dataset.previewDevice; syncDevice(true); });
  });
  listen(wide, "change", () => syncDevice());

  const identifier = root.querySelector("[data-identifier-value]");
  root.querySelectorAll("[data-identifier]").forEach((button) => {
    listen(button, "click", () => {
      stop(identifierTween);
      root.querySelectorAll("[data-identifier]").forEach((control) => control.setAttribute("aria-pressed", String(control === button)));
      identifier.textContent = button.dataset.identifier === "email" ? "resident@example.com" : "resident";
      if (motionAllowed()) identifierTween = transition(identifier, { opacity: .5, y: 4 });
    });
  });

  function syncMotion() {
    const disabled = !motionAllowed();
    root.dataset.showcasePaused = String(disabled);
    document.documentElement.dataset.pageMotion = disabled ? "reduced" : "full";
    motionButton.setAttribute("aria-pressed", String(disabled));
    motionButton.disabled = reduced.matches;
    motionButton.textContent = reduced.matches ? "Reduced motion enabled" : paused ? "Enable page motion" : "Reduce page motion";
    if (disabled) {
      [...tweens].forEach((tween) => { tween.progress(1); tween.kill(); });
      tweens.clear();
      root.dataset.showcaseSettled = "true";
    }
    window.dispatchEvent(new Event("page-motion-change"));
  }
  listen(motionButton, "click", () => { paused = !paused; syncMotion(); });
  listen(reduced, "change", syncMotion);

  selectTab("profile", false);
  syncDevice();
  root.querySelector("[data-showcase-controls]").hidden = false;
  root.querySelector("[data-identifier-controls]").hidden = false;
  motionButton.hidden = false;
  syncMotion();
  root.dataset.showcaseReady = "true";
  if (motionAllowed()) {
    transition(previewWindow, { opacity: .8, y: 10, clipPath: "inset(0 0 7% 0)" }, .65, () => { root.dataset.showcaseSettled = "true"; });
  }
  return () => {
    tweens.forEach((tween) => tween.kill());
    listeners.forEach((cleanup) => cleanup());
    document.documentElement.removeAttribute("data-page-motion");
    window.dispatchEvent(new Event("page-motion-change"));
  };
}
