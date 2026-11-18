import Alpine from "alpinejs";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

Alpine.data("motionScene", () => ({
  paused: false,
  ready: false,
  controller: null,

  async init() {
    const display = window.matchMedia("(min-width: 47rem)");
    if (reducedMotion.matches || !display.matches) return;
    try {
      const { mountNeighborhood } = await import("./neighborhood.js");
      this.controller = mountNeighborhood(this.$el, reducedMotion);
      this.ready = Boolean(this.controller);
    } catch {
      // The illustrated background remains available when WebGL cannot start.
    }
  },

  toggle() {
    this.paused = !this.paused;
    this.controller?.setPaused(this.paused);
  },

  destroy() {
    this.controller?.destroy();
  },
}));

Alpine.start();

if (document.querySelector("[data-icon-animation]")) {
  import("./icons.js").then(({ mountIcons }) => mountIcons(reducedMotion)).catch(() => {});
}
if (document.querySelector("[data-account-chart]")) {
  import("./account-chart.js").then(({ mountAccountChart }) => mountAccountChart(reducedMotion)).catch(() => {});
}
