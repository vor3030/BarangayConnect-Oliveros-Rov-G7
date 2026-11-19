import Alpine from "alpinejs";
import "./fonts.css";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

Alpine.data("motionScene", () => ({
  paused: false,
  view: "neighborhood",
  ready: false,
  controller: null,
  display: null,
  preferenceChanged: null,
  loading: false,

  init() {
    this.display = window.matchMedia("(min-width: 47rem)");
    this.preferenceChanged = () => this.mount();
    this.display.addEventListener("change", this.preferenceChanged);
    reducedMotion.addEventListener("change", this.preferenceChanged);
    this.mount();
  },

  async mount() {
    if (this.loading || this.controller || reducedMotion.matches || !this.display.matches) return;
    this.loading = true;
    try {
      const { mountNeighborhood } = await import("./neighborhood.js");
      if (!this.$root.isConnected || reducedMotion.matches || !this.display.matches) return;
      this.controller = mountNeighborhood(this.$root, reducedMotion);
      this.ready = Boolean(this.controller);
      this.$root.dispatchEvent(new CustomEvent("scene:ready"));
    } catch {
      // The illustrated background remains available when WebGL cannot start.
    } finally {
      this.loading = false;
    }
  },

  toggle() {
    this.paused = !this.paused;
    this.controller?.setPaused(this.paused);
    this.$root.dataset.motionPaused = String(this.paused);
    this.$root.dispatchEvent(new CustomEvent("scene:pause", { detail: this.paused }));
  },

  setView(value) {
    this.view = value;
    this.controller?.setView(value);
  },

  destroy() {
    this.display?.removeEventListener("change", this.preferenceChanged);
    reducedMotion.removeEventListener("change", this.preferenceChanged);
    this.controller?.destroy();
  },
}));

Alpine.start();

import("./interactions.js").then(({ mountInteractions }) => mountInteractions()).catch(() => {});

import("./motion.js").then(({ mountMotion }) => mountMotion()).catch(() => {
  // Content is visible and usable even when animation enhancements are unavailable.
});

if (document.querySelector("[data-icon-animation]")) {
  import("./icons.js").then(({ mountIcons }) => mountIcons(reducedMotion)).catch(() => {});
}
if (document.querySelector("[data-account-chart]")) {
  import("./account-chart.js").then(({ mountAccountChart }) => mountAccountChart(reducedMotion)).catch(() => {});
}
if (document.querySelector("[data-showcase]")) {
  import("./showcase.js").then(({ mountShowcase }) => mountShowcase()).catch(() => {});
}
