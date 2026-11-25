const STORAGE_KEY = "bc-motion-override";
const osReducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

export function getMotionOverride() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function isReducedMotion() {
  const override = getMotionOverride();
  if (override === "full") return false;
  if (override === "reduce") return true;
  return osReducedQuery.matches;
}

export function syncMotionAttribute() {
  const override = getMotionOverride();
  if (override === "full") {
    document.documentElement.dataset.motionOverride = "full";
  } else if (override === "reduce") {
    document.documentElement.dataset.motionOverride = "reduce";
  } else {
    delete document.documentElement.dataset.motionOverride;
  }
  document.documentElement.dataset.pageMotion = isReducedMotion() ? "reduced" : "full";
}

export function setMotionOverride(mode) {
  try {
    if (mode) window.localStorage.setItem(STORAGE_KEY, mode);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage quota / private-mode restrictions.
  }
  syncMotionAttribute();
  window.dispatchEvent(new CustomEvent("bc:motion-change", { detail: { reduced: isReducedMotion(), override: mode } }));
}

export function subscribeMotionChange(callback) {
  const handler = () => callback(isReducedMotion());
  osReducedQuery.addEventListener("change", handler);
  window.addEventListener("bc:motion-change", handler);
  return () => {
    osReducedQuery.removeEventListener("change", handler);
    window.removeEventListener("bc:motion-change", handler);
  };
}

export function mountMotionOverrideBanner() {
  syncMotionAttribute();
  if (document.querySelector("[data-motion-override-pill]")) return;

  // Only surface the one-click unlock pill when the OS forces reduced motion on a desktop/tablet viewport.
  if (!osReducedQuery.matches || getMotionOverride() === "full") return;

  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "motion-unlock-pill";
  pill.dataset.motionOverridePill = "true";
  pill.innerHTML =
    '<span class="motion-unlock-dot" aria-hidden="true"></span><span>Windows reduced motion is on &middot; <strong>Enable live effects</strong></span>';
  pill.addEventListener("click", () => {
    setMotionOverride("full");
    pill.remove();
  });
  document.body.append(pill);
}
