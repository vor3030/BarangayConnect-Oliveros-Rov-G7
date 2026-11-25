import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { animate } from "animejs";

const PUROK_ITEMS = [
  {
    id: "purok-1",
    short: "Purok 1",
    name: "Purok 1 — Mabini",
    primary: 42,
    secondary: 36,
    primaryLabel: "Active accounts",
    secondaryLabel: "Complete profiles",
    note: "Most households here have already added a contact number alongside their email.",
  },
  {
    id: "purok-2",
    short: "Purok 2",
    name: "Purok 2 — Rizal",
    primary: 58,
    secondary: 49,
    primaryLabel: "Active accounts",
    secondaryLabel: "Complete profiles",
    note: "Highest active participation — residents keep their details current from mobile.",
  },
  {
    id: "purok-3",
    short: "Purok 3",
    name: "Purok 3 — Luna",
    primary: 34,
    secondary: 28,
    primaryLabel: "Active accounts",
    secondaryLabel: "Complete profiles",
    note: "Steady sign-ins using both usernames and email addresses across shared family devices.",
  },
  {
    id: "purok-4",
    short: "Purok 4",
    name: "Purok 4 — Bonifacio",
    primary: 49,
    secondary: 41,
    primaryLabel: "Active accounts",
    secondaryLabel: "Complete profiles",
    note: "New resident registrations pick up quickly after barangay orientation.",
  },
  {
    id: "purok-5",
    short: "Purok 5",
    name: "Purok 5 — Silang",
    primary: 31,
    secondary: 25,
    primaryLabel: "Active accounts",
    secondaryLabel: "Complete profiles",
    note: "Clear online forms make first-time sign-up approachable for every household.",
  },
];

export function mountThreeChart(root) {
  const stage = root.querySelector("[data-three-chart-stage]");
  const canvas = root.querySelector("[data-three-chart]");
  const detailTitle = root.querySelector("[data-chart-detail-title]");
  const detailNote = root.querySelector("[data-chart-detail-note]");
  const detailPrimary = root.querySelector("[data-chart-detail-primary]");
  const detailPrimaryLabel = root.querySelector("[data-chart-detail-primary-label]");
  const detailSecondary = root.querySelector("[data-chart-detail-secondary]");
  const detailSecondaryLabel = root.querySelector("[data-chart-detail-secondary-label]");
  const detailCard = root.querySelector("[data-chart-detail-card]");
  const pillContainer = root.querySelector("[data-chart-item-pills]");
  const motionToggle = root.querySelector("[data-chart-motion-toggle]");

  if (!stage || !canvas) return null;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let selectedIndex = 1;
  let hoveredIndex = -1;
  let visible = false;
  let userPaused = false;
  let destroyed = false;
  let rafId = 0;
  let hoverRafId = 0;
  let pendingHoverEvent = null;
  let elapsed = 0;
  let lastTime = 0;

  let orbitAzimuth = 0.62;
  let targetAzimuth = 0.62;
  let orbitPolar = 0.52;
  let targetPolar = 0.52;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMoved = false;

  let stageRect = stage.getBoundingClientRect();
  let canvasRect = canvas.getBoundingClientRect();

  let renderer = null;
  let scene = null;
  let camera = null;
  let chartGroup = null;
  let barPairs = [];
  let raycaster = null;
  const pointerNdc = new Vector2(-99, -99);
  const pointerTilt = new Vector2(0, 0);
  const smoothTilt = new Vector2(0, 0);
  const activeAnims = new Set();

  function trackAnim(anim) {
    if (!anim) return anim;
    activeAnims.add(anim);
    return anim;
  }

  function updateRects() {
    stageRect = stage.getBoundingClientRect();
    canvasRect = canvas.getBoundingClientRect();
  }

  function updateDetailPanel(animateSwap = false) {
    const item = PUROK_ITEMS[selectedIndex] || PUROK_ITEMS[0];
    if (detailTitle) detailTitle.textContent = item.name;
    if (detailNote) detailNote.textContent = item.note;
    if (detailPrimaryLabel) detailPrimaryLabel.textContent = item.primaryLabel;
    if (detailSecondaryLabel) detailSecondaryLabel.textContent = item.secondaryLabel;

    if (animateSwap && !reducedMotion.matches && detailPrimary && detailSecondary) {
      const fromP = Number.parseInt(detailPrimary.textContent || "0", 10) || 0;
      const fromS = Number.parseInt(detailSecondary.textContent || "0", 10) || 0;
      const numState = { p: fromP, s: fromS };
      trackAnim(
        animate(numState, {
          p: item.primary,
          s: item.secondary,
          duration: 320,
          ease: "outExpo",
          onUpdate: () => {
            detailPrimary.textContent = String(Math.round(numState.p));
            detailSecondary.textContent = String(Math.round(numState.s));
          },
          onComplete: () => {
            detailPrimary.textContent = String(item.primary);
            detailSecondary.textContent = String(item.secondary);
          },
        })
      );
    } else {
      if (detailPrimary) detailPrimary.textContent = String(item.primary);
      if (detailSecondary) detailSecondary.textContent = String(item.secondary);
    }

    if (pillContainer) {
      pillContainer.querySelectorAll("button").forEach((btn, idx) => {
        btn.setAttribute("aria-pressed", String(idx === selectedIndex));
      });
    }

    if (animateSwap && detailCard && !reducedMotion.matches) {
      trackAnim(
        animate(detailCard, {
          opacity: [0.84, 1],
          translateY: [4, 0],
          duration: 180,
          ease: "outCubic",
          onComplete: () => {
            detailCard.style.removeProperty("opacity");
            detailCard.style.removeProperty("transform");
          },
        })
      );
    }
  }

  function renderPills() {
    if (!pillContainer) return;
    pillContainer.innerHTML = "";
    PUROK_ITEMS.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chart-pill";
      btn.textContent = item.short;
      btn.setAttribute("aria-pressed", String(idx === selectedIndex));
      btn.addEventListener("click", () => selectBar(idx, true));
      pillContainer.append(btn);
    });
  }

  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
  } catch {
    renderer = null;
  }

  const disposables = [];
  if (renderer) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "3D bar chart comparing active resident accounts and complete profiles across barangay puroks. Drag to rotate or use the purok buttons below to inspect each neighborhood."
    );

    scene = new Scene();
    camera = new PerspectiveCamera(36, 16 / 10, 0.1, 60);
    raycaster = new Raycaster();

    const hemi = new HemisphereLight(new Color(0xdcebf0), new Color(0x0d1518), 1.5);
    const keyLight = new DirectionalLight(0xf6e6c8, 1.55);
    keyLight.position.set(7, 12, 8);
    const rimLight = new DirectionalLight(0x6da6b8, 0.85);
    rimLight.position.set(-8, 6, -6);
    scene.add(hemi, keyLight, rimLight, new AmbientLight(0x9fc2cc, 0.3));

    chartGroup = new Group();
    scene.add(chartGroup);

    const plinthGeo = new BoxGeometry(9.6, 0.28, 4.4);
    const plinthMat = new MeshStandardMaterial({
      color: 0x1a2c33,
      roughness: 0.72,
      metalness: 0.08,
    });
    const plinth = new Mesh(plinthGeo, plinthMat);
    plinth.position.set(0, -0.14, 0);
    chartGroup.add(plinth);
    disposables.push(plinthGeo, plinthMat);

    const trimGeo = new BoxGeometry(9.8, 0.1, 4.6);
    const trimMat = new MeshStandardMaterial({ color: 0x0b1317, roughness: 0.68 });
    const trim = new Mesh(trimGeo, trimMat);
    trim.position.set(0, -0.32, 0);
    chartGroup.add(trim);
    disposables.push(trimGeo, trimMat);

    const guideGeo = new BoxGeometry(8.8, 0.025, 0.03);
    const guideMat = new MeshStandardMaterial({ color: 0x395561, roughness: 0.85 });
    disposables.push(guideGeo, guideMat);
    for (const h of [1.0, 2.0, 3.0]) {
      const guide = new Mesh(guideGeo, guideMat);
      guide.position.set(0, h, -1.65);
      chartGroup.add(guide);
    }

    const barGeo = new BoxGeometry(0.68, 1, 0.68);
    const capGeo = new CylinderGeometry(0.18, 0.18, 0.08, 18);
    const padGeo = new BoxGeometry(1.45, 0.06, 2.1);
    disposables.push(barGeo, capGeo, padGeo);

    const maxVal = 62;
    for (let i = 0; i < PUROK_ITEMS.length; i++) {
      const x = (i - 2) * 1.75;
      const group = new Group();
      group.position.set(x, 0, 0);

      const padMat = new MeshStandardMaterial({ color: 0x132228, roughness: 0.8 });
      const pad = new Mesh(padGeo, padMat);
      pad.position.set(0, 0.03, 0);
      pad.userData = { barIndex: i };
      group.add(pad);

      const primaryMat = new MeshStandardMaterial({
        color: 0x458e7e,
        roughness: 0.34,
        metalness: 0.08,
      });
      const primaryMesh = new Mesh(barGeo, primaryMat);
      primaryMesh.position.set(-0.28, 0.06, 0.18);
      primaryMesh.userData = { barIndex: i };
      group.add(primaryMesh);

      const secondaryMat = new MeshStandardMaterial({
        color: 0xd48e37,
        roughness: 0.38,
        metalness: 0.08,
      });
      const secondaryMesh = new Mesh(barGeo, secondaryMat);
      secondaryMesh.position.set(0.32, 0.06, -0.28);
      secondaryMesh.scale.set(0.76, 0.05, 0.76);
      secondaryMesh.userData = { barIndex: i };
      group.add(secondaryMesh);

      const capMat = new MeshStandardMaterial({ color: 0xe7d4b5, roughness: 0.32 });
      const cap = new Mesh(capGeo, capMat);
      cap.position.set(-0.28, 0.12, 0.18);
      cap.userData = { barIndex: i };
      group.add(cap);

      chartGroup.add(group);
      disposables.push(padMat, primaryMat, secondaryMat, capMat);

      barPairs.push({
        index: i,
        group,
        pad,
        padMat,
        primaryMesh,
        primaryMat,
        secondaryMesh,
        secondaryMat,
        cap,
        primaryH: (PUROK_ITEMS[i].primary / maxVal) * 3.35,
        secondaryH: (PUROK_ITEMS[i].secondary / maxVal) * 3.0,
        lift: i === selectedIndex ? 0.16 : 0,
      });
    }

    stage.dataset.threeChartReady = "true";
  }

  function applyBarGeometry() {
    for (const pair of barPairs) {
      const pH = Math.max(0.08, pair.primaryH);
      const sH = Math.max(0.08, pair.secondaryH);
      pair.primaryMesh.scale.set(1, pH, 1);
      pair.primaryMesh.position.y = pH * 0.5 + 0.06 + pair.lift;
      pair.cap.position.y = pH + 0.1 + pair.lift;

      pair.secondaryMesh.scale.set(0.76, sH, 0.76);
      pair.secondaryMesh.position.y = sH * 0.5 + 0.06 + pair.lift * 0.75;

      const isSelected = pair.index === selectedIndex;
      const isHovered = pair.index === hoveredIndex;
      pair.primaryMat.color.setHex(isSelected ? 0x7cc9b6 : isHovered ? 0x5fb09d : 0x458e7e);
      pair.primaryMat.emissive.setHex(isSelected ? 0x266355 : isHovered ? 0x163d34 : 0x000000);
      pair.primaryMat.emissiveIntensity = isSelected ? 0.32 : isHovered ? 0.18 : 0;

      pair.secondaryMat.color.setHex(isSelected ? 0xf0b25a : isHovered ? 0xe0a149 : 0xd48e37);
      pair.secondaryMat.emissive.setHex(isSelected ? 0x7c4810 : 0x000000);
      pair.secondaryMat.emissiveIntensity = isSelected ? 0.28 : 0;

      pair.padMat.color.setHex(isSelected ? 0x28414a : isHovered ? 0x1d3139 : 0x132228);
    }
  }

  function renderThree() {
    if (!renderer || !scene || !camera || destroyed) return;
    applyBarGeometry();
    const radius = 10.2;
    const drift = reducedMotion.matches || userPaused ? 0 : Math.sin(elapsed * 0.24) * 0.14;
    const angle = orbitAzimuth + drift + smoothTilt.x * 0.18;
    const elev = MathUtils.clamp(orbitPolar + smoothTilt.y * -0.08, 0.25, 0.85);
    camera.position.set(
      Math.sin(angle) * Math.cos(elev) * radius,
      Math.sin(elev) * radius + 1.0,
      Math.cos(angle) * Math.cos(elev) * radius
    );
    camera.lookAt(0, 1.3, 0);
    renderer.render(scene, camera);
  }

  function selectBar(index, animateSwap = true) {
    selectedIndex = MathUtils.clamp(index, 0, PUROK_ITEMS.length - 1);
    updateDetailPanel(animateSwap);
    if (!renderer) return;
    if (reducedMotion.matches) {
      barPairs.forEach((pair) => {
        pair.lift = pair.index === selectedIndex ? 0.16 : 0;
      });
      renderThree();
      return;
    }
    barPairs.forEach((pair) => {
      const targetLift = pair.index === selectedIndex ? 0.16 : 0;
      trackAnim(
        animate(pair, {
          lift: targetLift,
          duration: 180,
          ease: "outCubic",
          onUpdate: rafId ? undefined : renderThree,
          onComplete: renderThree,
        })
      );
    });
    if (!rafId) renderThree();
  }

  function resize() {
    if (!renderer || !camera) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    updateRects();
    renderThree();
  }

  function pickBarAt(clientX, clientY) {
    if (!raycaster || !camera || !chartGroup) return -1;
    if (!canvasRect.width || !canvasRect.height) return -1;
    pointerNdc.set(
      ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
      -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(chartGroup.children, true);
    for (const hit of hits) {
      const idx = hit.object?.userData?.barIndex;
      if (typeof idx === "number") return idx;
    }
    return -1;
  }

  function onPointerDown(event) {
    updateRects();
    isDragging = true;
    dragMoved = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    canvas.style.cursor = "grabbing";
  }

  function flushHover() {
    hoverRafId = 0;
    const event = pendingHoverEvent;
    pendingHoverEvent = null;
    if (!event || isDragging || destroyed) return;
    if (!stageRect.width || !stageRect.height) return;

    if (!reducedMotion.matches && !userPaused) {
      pointerTilt.set(
        ((event.clientX - stageRect.left) / stageRect.width - 0.5) * 2,
        ((event.clientY - stageRect.top) / stageRect.height - 0.5) * 2
      );
    }
    const hit = pickBarAt(event.clientX, event.clientY);
    canvas.style.cursor = hit >= 0 ? "pointer" : "grab";
    if (hit !== hoveredIndex) {
      hoveredIndex = hit;
      if (!rafId) renderThree();
    }
  }

  function onPointerMove(event) {
    if (isDragging) {
      const dx = event.clientX - dragStartX;
      const dy = event.clientY - dragStartY;
      if (Math.hypot(dx, dy) > 4) dragMoved = true;
      targetAzimuth -= dx * 0.008;
      targetPolar = MathUtils.clamp(targetPolar + dy * 0.005, 0.25, 0.85);
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      if (!rafId) {
        orbitAzimuth = targetAzimuth;
        orbitPolar = targetPolar;
        renderThree();
      }
      return;
    }

    pendingHoverEvent = event;
    if (!hoverRafId) {
      hoverRafId = requestAnimationFrame(flushHover);
    }
  }

  function onPointerUp(event) {
    if (isDragging && !dragMoved) {
      const hit = pickBarAt(event.clientX, event.clientY);
      if (hit >= 0) selectBar(hit, true);
    }
    isDragging = false;
    canvas.style.cursor = "grab";
  }

  function onTouchStart(event) {
    const t = event.touches?.[0];
    if (!t) return;
    updateRects();
    isDragging = true;
    dragMoved = false;
    dragStartX = t.clientX;
    dragStartY = t.clientY;
  }

  function onTouchMove(event) {
    const t = event.touches?.[0];
    if (!t || !isDragging) return;
    const dx = t.clientX - dragStartX;
    const dy = t.clientY - dragStartY;
    if (Math.hypot(dx, dy) > 4) dragMoved = true;
    targetAzimuth -= dx * 0.008;
    targetPolar = MathUtils.clamp(targetPolar + dy * 0.005, 0.25, 0.85);
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    if (!rafId) {
      orbitAzimuth = targetAzimuth;
      orbitPolar = targetPolar;
      renderThree();
    }
  }

  function onTouchEnd(event) {
    const t = event.changedTouches?.[0];
    if (isDragging && !dragMoved && t) {
      const hit = pickBarAt(t.clientX, t.clientY);
      if (hit >= 0) selectBar(hit, true);
    }
    isDragging = false;
  }

  function onPointerLeave() {
    pointerTilt.set(0, 0);
    hoveredIndex = -1;
    if (!isDragging) canvas.style.cursor = "grab";
    if (!rafId) renderThree();
  }

  function tick(now) {
    if (destroyed) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    elapsed += dt;
    orbitAzimuth = MathUtils.lerp(orbitAzimuth, targetAzimuth, 0.1);
    orbitPolar = MathUtils.lerp(orbitPolar, targetPolar, 0.1);
    smoothTilt.x = MathUtils.lerp(smoothTilt.x, pointerTilt.x, 0.08);
    smoothTilt.y = MathUtils.lerp(smoothTilt.y, pointerTilt.y, 0.08);
    renderThree();
    rafId = requestAnimationFrame(tick);
  }

  function syncToggleUI() {
    if (!motionToggle) return;
    motionToggle.hidden = reducedMotion.matches;
    motionToggle.setAttribute("aria-pressed", String(userPaused));
    motionToggle.textContent = userPaused ? "Resume 3D drift" : "Pause 3D drift";
  }

  function syncRunning() {
    const running = !destroyed && Boolean(renderer) && visible && !document.hidden && !reducedMotion.matches && !userPaused;
    if (running && !rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    } else if (!running && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastTime = 0;
      renderThree();
    }
    stage.dataset.chartMotion = running ? "running" : "paused";
    syncToggleUI();
  }

  function onMotionToggle() {
    userPaused = !userPaused;
    syncRunning();
  }

  if (motionToggle) {
    motionToggle.addEventListener("click", onMotionToggle);
  }

  if (renderer) {
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", updateRects, { passive: true });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);

  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      syncRunning();
    },
    { threshold: 0.18 }
  );
  intersectionObserver.observe(stage);
  document.addEventListener("visibilitychange", syncRunning);
  reducedMotion.addEventListener("change", syncRunning);

  root.querySelectorAll("[data-chart-controls]").forEach((el) => {
    el.hidden = false;
  });
  renderPills();
  updateDetailPanel(false);
  resize();
  syncRunning();

  return {
    destroy() {
      destroyed = true;
      for (const anim of activeAnims) anim.pause?.();
      activeAnims.clear();
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(hoverRafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", syncRunning);
      reducedMotion.removeEventListener("change", syncRunning);
      motionToggle?.removeEventListener("click", onMotionToggle);
      if (renderer) {
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("scroll", updateRects);
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", onTouchEnd);
        for (const d of disposables) d.dispose?.();
        renderer.dispose();
      }
    },
  };
}
