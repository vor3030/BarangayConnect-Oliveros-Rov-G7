import Alpine from "alpinejs";
import "./fonts.css";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const LANDING_SERVICES = [
  {
    title: "Barangay Clearance",
    use: "Employment & ID",
    copies: "1 to 5 copies",
    badge: "Most requested",
  },
  {
    title: "Certificate of Indigency",
    use: "Medical & scholarship",
    copies: "1 to 5 copies",
    badge: "Assistance",
  },
  {
    title: "Certificate of Residency",
    use: "School & bank proof",
    copies: "1 to 5 copies",
    badge: "Address proof",
  },
  {
    title: "Barangay Business Clearance",
    use: "Local permit renewal",
    copies: "1 to 5 copies",
    badge: "Business",
  },
  {
    title: "First-Time Jobseeker Certificate",
    use: "RA 11261 fee waiver",
    copies: "1 to 5 copies",
    badge: "Jobseeker",
  },
];

Alpine.data("landingPortal", () => ({
  services: LANDING_SERVICES,
  serviceIndex: 0,
  selectedType: LANDING_SERVICES[0].title,
  helpOpen: false,

  init() {
    this.$watch("selectedType", (value) => {
      const idx = this.services.findIndex((item) => item.title === value);
      if (idx !== -1) this.serviceIndex = idx;
    });
  },

  get activeService() {
    return this.services[this.serviceIndex] || this.services[0];
  },

  get activeServiceUrl() {
    return `/requests/new/?document_type=${encodeURIComponent(this.activeService.title)}`;
  },

  nextService() {
    this.serviceIndex = (this.serviceIndex + 1) % this.services.length;
    this.selectedType = this.activeService.title;
  },

  prevService() {
    this.serviceIndex = (this.serviceIndex - 1 + this.services.length) % this.services.length;
    this.selectedType = this.activeService.title;
  },

  selectService(index) {
    if (index >= 0 && index < this.services.length) {
      this.serviceIndex = index;
      this.selectedType = this.activeService.title;
    }
  },

  openHelp() {
    this.helpOpen = true;
    this.$nextTick(() => this.$refs.helpClose?.focus());
  },

  closeHelp(returnFocus = false) {
    if (!this.helpOpen) return;
    this.helpOpen = false;
    if (returnFocus) {
      this.$nextTick(() => this.$refs.helpTrigger?.focus());
    }
  },

  toggleHelp() {
    if (this.helpOpen) this.closeHelp(true);
    else this.openHelp();
  },
}));

Alpine.data("dashboardFilter", () => ({
  status: "all",
  query: "",
  visibleCount: 0,

  init() {
    this.$nextTick(() => this.syncCount());
    this.$watch("status", () => this.$nextTick(() => this.syncCount()));
    this.$watch("query", () => this.$nextTick(() => this.syncCount()));
  },

  matches(itemStatus, searchText) {
    if (this.status !== "all" && itemStatus !== this.status) return false;
    const term = this.query.trim().toLowerCase();
    if (!term) return true;
    return String(searchText || "").toLowerCase().includes(term);
  },

  syncCount() {
    const items = this.$root.querySelectorAll("[data-filter-item]");
    let count = 0;
    items.forEach((el) => {
      if (this.matches(el.dataset.filterStatus || "", el.dataset.filterSearch || "")) {
        count += 1;
      }
    });
    this.visibleCount = count;
  },

  reset() {
    this.status = "all";
    this.query = "";
  },
}));

Alpine.data("reviewPresets", () => ({
  applyPreset(statusValue, remarkText) {
    const statusSelect = this.$root.querySelector("select[name='status']");
    const remarksField = this.$root.querySelector("textarea[name='staff_remarks']");
    if (statusSelect && statusValue) {
      const hasOption = [...statusSelect.options].some((opt) => opt.value === statusValue);
      if (hasOption) statusSelect.value = statusValue;
    }
    if (remarksField) {
      remarksField.value = remarkText;
      remarksField.focus();
    }
  },
}));

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
      // Static neighborhood illustration remains available when WebGL cannot start.
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
  // Content remains visible and usable even when animation enhancements are unavailable.
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
