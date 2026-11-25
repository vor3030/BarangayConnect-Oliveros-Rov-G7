import Alpine from "alpinejs";
import "./fonts.css";
import { isReducedMotion, subscribeMotionChange } from "./motion-pref.js";

const LANDING_SERVICES = [
  {
    title: "Barangay Clearance",
    use: "Employment & ID",
    copies: "1 to 5 copies",
    badge: "Most requested",
    samplePurpose: "Local employment application",
    requirement: "Bring one valid government or school ID when claiming your signed clearance at Window 2.",
  },
  {
    title: "Certificate of Indigency",
    use: "Medical & scholarship",
    copies: "1 to 5 copies",
    badge: "Assistance",
    samplePurpose: "Hospital medical assistance",
    requirement: "Used for DSWD, hospital, or scholarship assistance. State the beneficiary and purpose clearly.",
  },
  {
    title: "Certificate of Residency",
    use: "School & bank proof",
    copies: "1 to 5 copies",
    badge: "Address proof",
    samplePurpose: "Bank account opening requirement",
    requirement: "Confirms your barangay address on file. Add your purok or street in Additional details.",
  },
  {
    title: "Barangay Business Clearance",
    use: "Local permit renewal",
    copies: "1 to 5 copies",
    badge: "Business",
    samplePurpose: "Annual sari-sari store permit renewal",
    requirement: "Include your business trade name and purok location in Additional details for faster verification.",
  },
  {
    title: "First-Time Jobseeker Certificate",
    use: "RA 11261 fee waiver",
    copies: "1 to 5 copies",
    badge: "Jobseeker",
    samplePurpose: "First-time jobseeker pre-employment requirements",
    requirement: "Issued under RA 11261 for eligible first-time jobseekers waiving government document fees.",
  },
];

const TRACKING_STAGES = [
  {
    key: "pending",
    label: "Pending",
    progress: 0.34,
    headline: "Submitted online — queued for staff verification",
    remark: "Your reference code is live. You can still edit purpose, copy count, or cancel while Pending.",
    actor: "Queued at Barangay Desk",
  },
  {
    key: "approved",
    label: "Approved",
    progress: 0.68,
    headline: "Verified — ready for pickup at Window 2",
    remark: "Verified residency record. Ready for pickup at Window 2, Mon–Fri 8:00 AM–5:00 PM (bring a valid ID).",
    actor: "Reviewed by Barangay Secretary",
  },
  {
    key: "completed",
    label: "Completed",
    progress: 1,
    headline: "Document released & transaction archived",
    remark: "Certificate claimed and signed at the barangay hall. Full activity history remains saved in your portal.",
    actor: "Released at Barangay Hall",
  },
];

const STAFF_QUEUE_SAMPLES = [
  { ref: "REQ-2026-0108", doc: "Barangay Clearance", resident: "Maria Santos", status: "pending", copies: "2 copies" },
  { ref: "REQ-2026-0109", doc: "Certificate of Residency", resident: "Jose Dela Cruz", status: "approved", copies: "1 copy" },
  { ref: "REQ-2026-0110", doc: "Certificate of Indigency", resident: "Elena Reyes", status: "pending", copies: "1 copy" },
];

const BARANGAY_HOTSPOTS = [
  {
    id: "hall",
    label: "Barangay Hall Desk",
    subtitle: "Window 2 — Document Release",
    detail: "Mon–Fri, 8:00 AM to 5:00 PM. Bring one valid government or school ID when claiming Approved certificates.",
    cta: "Request Barangay Clearance",
    docIndex: 0,
  },
  {
    id: "plaza",
    label: "Community Plaza",
    subtitle: "Purok 1 to Purok 5 Coverage",
    detail: "Residents across all five barangay puroks can file requests online and track verification without waiting in line.",
    cta: "Request Certificate of Residency",
    docIndex: 2,
  },
  {
    id: "assistance",
    label: "Assistance & Jobseeker Desk",
    subtitle: "Indigency & RA 11261 Waiver",
    detail: "Apply online for Medical/Scholarship Indigency or First-Time Jobseeker Certificates with real-time staff remarks.",
    cta: "Request Indigency Certificate",
    docIndex: 1,
  },
];

Alpine.data("landingPortal", () => ({
  services: LANDING_SERVICES,
  serviceIndex: 0,
  selectedType: LANDING_SERVICES[0].title,
  purposeInput: "",
  helpOpen: false,
  mood: "twilight",
  atmospherePaused: false,
  hotspots: BARANGAY_HOTSPOTS,
  activeHotspotId: null,
  trackingIndex: 1,
  trackingStages: TRACKING_STAGES,
  staffFilter: "all",
  staffSamples: STAFF_QUEUE_SAMPLES,

  init() {
    this.$watch("selectedType", (value) => {
      const idx = this.services.findIndex((item) => item.title === value);
      if (idx !== -1 && idx !== this.serviceIndex) {
        this.serviceIndex = idx;
        window.dispatchEvent(new CustomEvent("barangay:service-change", { detail: { index: idx } }));
      }
    });
  },

  get activeService() {
    return this.services[this.serviceIndex] || this.services[0];
  },

  get activeServiceUrl() {
    const params = new URLSearchParams({ document_type: this.activeService.title });
    if (this.purposeInput.trim()) params.set("purpose", this.purposeInput.trim());
    return `/requests/new/?${params.toString()}`;
  },

  get activeHotspot() {
    return this.hotspots.find((h) => h.id === this.activeHotspotId) || null;
  },

  get activeTrackingStage() {
    return this.trackingStages[this.trackingIndex] || this.trackingStages[0];
  },

  get filteredStaffSamples() {
    if (this.staffFilter === "all") return this.staffSamples;
    return this.staffSamples.filter((item) => item.status === this.staffFilter);
  },

  nextService() {
    this.serviceIndex = (this.serviceIndex + 1) % this.services.length;
    this.selectedType = this.activeService.title;
    window.dispatchEvent(new CustomEvent("barangay:service-change", { detail: { index: this.serviceIndex } }));
  },

  prevService() {
    this.serviceIndex = (this.serviceIndex - 1 + this.services.length) % this.services.length;
    this.selectedType = this.activeService.title;
    window.dispatchEvent(new CustomEvent("barangay:service-change", { detail: { index: this.serviceIndex } }));
  },

  selectService(index) {
    if (index >= 0 && index < this.services.length) {
      this.serviceIndex = index;
      this.selectedType = this.activeService.title;
      window.dispatchEvent(new CustomEvent("barangay:service-change", { detail: { index } }));
    }
  },

  quickFill(index) {
    this.selectService(index);
    this.purposeInput = this.activeService.samplePurpose;
  },

  setMood(nextMood) {
    this.mood = nextMood;
    window.dispatchEvent(new CustomEvent("barangay:mood-change", { detail: { mood: nextMood } }));
  },

  toggleAtmosphere() {
    this.atmospherePaused = !this.atmospherePaused;
    window.dispatchEvent(
      new CustomEvent("barangay:atmosphere-toggle", { detail: { paused: this.atmospherePaused } })
    );
  },

  toggleHotspot(id) {
    this.activeHotspotId = this.activeHotspotId === id ? null : id;
  },

  applyHotspot(hotspot) {
    if (!hotspot) return;
    this.quickFill(hotspot.docIndex);
    this.activeHotspotId = null;
  },

  nextTrackingStage() {
    this.trackingIndex = (this.trackingIndex + 1) % this.trackingStages.length;
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
  docType: "all",
  query: "",
  visibleCount: 0,

  init() {
    this.$nextTick(() => this.syncCount());
    this.$watch("status", () => this.$nextTick(() => this.syncCount()));
    this.$watch("docType", () => this.$nextTick(() => this.syncCount()));
    this.$watch("query", () => this.$nextTick(() => this.syncCount()));
  },

  matches(itemStatus, searchText, itemDocType = "") {
    if (this.status !== "all" && itemStatus !== this.status) return false;
    if (this.docType !== "all" && itemDocType && itemDocType !== this.docType) return false;
    const term = this.query.trim().toLowerCase();
    if (!term) return true;
    return String(searchText || "").toLowerCase().includes(term);
  },

  syncCount() {
    const items = this.$root.querySelectorAll("[data-filter-item]");
    let count = 0;
    items.forEach((el) => {
      if (
        this.matches(
          el.dataset.filterStatus || "",
          el.dataset.filterSearch || "",
          el.dataset.filterType || ""
        )
      ) {
        count += 1;
      }
    });
    this.visibleCount = count;
  },

  reset() {
    this.status = "all";
    this.docType = "all";
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

Alpine.data("authMood", () => ({
  mood: "twilight",
  setMood(next) {
    this.mood = next;
    window.dispatchEvent(new CustomEvent("barangay:mood-change", { detail: { mood: next } }));
  },
}));

Alpine.data("motionScene", () => ({
  paused: false,
  view: "neighborhood",
  ready: false,
  controller: null,
  display: null,
  preferenceChanged: null,
  unsubMotion: null,
  loading: false,

  init() {
    this.display = window.matchMedia("(min-width: 47rem)");
    this.preferenceChanged = () => this.mount();
    this.display.addEventListener("change", this.preferenceChanged);
    this.unsubMotion = subscribeMotionChange(this.preferenceChanged);
    this.mount();
  },

  async mount() {
    if (this.loading || this.controller || isReducedMotion() || !this.display.matches) return;
    this.loading = true;
    try {
      const { mountNeighborhood } = await import("./neighborhood.js");
      if (!this.$root.isConnected || isReducedMotion() || !this.display.matches) return;
      this.controller = mountNeighborhood(this.$root);
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
    this.unsubMotion?.();
    this.controller?.destroy();
  },
}));

Alpine.start();

const motionAdapter = {
  get matches() {
    return isReducedMotion();
  },
  addEventListener(_event, fn) {
    subscribeMotionChange(fn);
  },
};

import("./interactions.js").then(({ mountInteractions }) => mountInteractions()).catch(() => {});

import("./motion.js").then(({ mountMotion }) => mountMotion()).catch(() => {
  // Content remains visible and usable even when animation enhancements are unavailable.
});

if (document.querySelector("[data-icon-animation]")) {
  import("./icons.js").then(({ mountIcons }) => mountIcons(motionAdapter)).catch(() => {});
}
if (document.querySelector("[data-account-chart]")) {
  import("./account-chart.js").then(({ mountAccountChart }) => mountAccountChart(motionAdapter)).catch(() => {});
}
if (document.querySelector("[data-showcase]")) {
  import("./showcase.js").then(({ mountShowcase }) => mountShowcase()).catch(() => {});
}
