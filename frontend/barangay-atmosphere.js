import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RingGeometry,
  Mesh,
  MeshBasicMaterial,
  Scene,
  WebGLRenderer,
} from "three";

const MOODS = {
  twilight: {
    primary: new Color(0xf5c06b),
    secondary: new Color(0x88d4c3),
    accent: new Color(0xe7d4b5),
    opacity: 0.78,
    speed: 1,
  },
  golden: {
    primary: new Color(0xffb84d),
    secondary: new Color(0xf7dba7),
    accent: new Color(0xf28f3b),
    opacity: 0.88,
    speed: 1.15,
  },
  night: {
    primary: new Color(0xffd782),
    secondary: new Color(0x6bb8cc),
    accent: new Color(0x9be2cf),
    opacity: 0.92,
    speed: 0.82,
  },
};

function makeLanternSprite() {
  const size = 64;
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = size;
  spriteCanvas.height = size;
  const ctx = spriteCanvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 252, 240, 1)");
  grad.addColorStop(0.28, "rgba(255, 224, 158, 0.85)");
  grad.addColorStop(0.62, "rgba(229, 154, 60, 0.24)");
  grad.addColorStop(1, "rgba(229, 154, 60, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(spriteCanvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Interactive Three.js WebGL barangay twilight lantern & firefly particle field.
 * Reacts magnetically to pointer movement, emits expanding golden lantern ripples
 * on click/tap, switches live lighting moods, and respects prefers-reduced-motion.
 */
export function mountBarangayAtmosphere(host, { density = 48 } = {}) {
  const canvas = host.querySelector("[data-barangay-atmosphere]");
  if (!canvas) return null;

  let renderer = null;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
  } catch {
    return null;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 40);
  camera.position.z = 8.5;

  const sprite = makeLanternSprite();
  const count = density;
  const positions = new Float32Array(count * 3);
  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const colorRoles = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 16;
    const y = (Math.random() - 0.5) * 8.5;
    const z = (Math.random() - 0.5) * 4.5;
    baseX[i] = x;
    baseY[i] = y;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.25 + Math.random() * 0.55;
    colorRoles[i] = i % 5 === 0 ? 1 : i % 3 === 0 ? 2 : 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = new PointsMaterial({
    size: 0.34,
    map: sprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new Points(geometry, material);
  scene.add(points);

  // Expanding lantern click ripples
  const activeRipples = [];
  const rippleGeo = new RingGeometry(0.18, 0.26, 36);

  let currentMood = "twilight";
  let userPaused = false;
  let visible = true;
  let destroyed = false;
  let rafId = 0;
  let elapsed = 0;
  let lastTime = 0;
  let bounds = host.getBoundingClientRect();
  let pointerX = 0;
  let pointerY = 0;
  let smoothPointerX = 0;
  let smoothPointerY = 0;

  function applyMoodColors() {
    const palette = MOODS[currentMood] || MOODS.twilight;
    const attr = geometry.getAttribute("color");
    for (let i = 0; i < count; i++) {
      const c = colorRoles[i] === 1 ? palette.secondary : colorRoles[i] === 2 ? palette.accent : palette.primary;
      attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
    material.opacity = palette.opacity;
  }

  function updateBounds() {
    bounds = host.getBoundingClientRect();
  }

  function render() {
    if (destroyed) return;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    updateBounds();
    render();
  }

  function spawnRipple(clientX, clientY) {
    if (reducedMotion.matches || userPaused || !bounds.width || !bounds.height) return;
    const ndcX = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    const ndcY = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    const worldX = ndcX * 6.5 * (camera.aspect / 1.6);
    const worldY = ndcY * 3.8;
    const palette = MOODS[currentMood] || MOODS.twilight;
    const ringMat = new MeshBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: 0.65,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new Mesh(rippleGeo, ringMat);
    mesh.position.set(worldX, worldY, 0.5);
    scene.add(mesh);
    activeRipples.push({ mesh, mat: ringMat, age: 0, worldX, worldY });
  }

  function tick(now) {
    if (destroyed) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    const palette = MOODS[currentMood] || MOODS.twilight;
    elapsed += dt * palette.speed;

    smoothPointerX += (pointerX - smoothPointerX) * 0.06;
    smoothPointerY += (pointerY - smoothPointerY) * 0.06;

    const pos = geometry.getAttribute("position");
    const cursorWorldX = smoothPointerX * 6.5;
    const cursorWorldY = smoothPointerY * 3.6;

    for (let i = 0; i < count; i++) {
      const phase = phases[i];
      const sp = speeds[i];
      let x = baseX[i] + Math.sin(elapsed * sp + phase) * 0.45 + smoothPointerX * 0.45;
      let y = ((baseY[i] + elapsed * sp * 0.35 + 4.5) % 9) - 4.5 + Math.cos(elapsed * 0.6 + phase) * 0.16;

      // Gentle magnetic aura around cursor
      const dx = x - cursorWorldX;
      const dy = y - cursorWorldY;
      const distSq = dx * dx + dy * dy;
      if (distSq < 4.5 && distSq > 0.001) {
        const push = (1 - distSq / 4.5) * 0.38;
        x += (dx / Math.sqrt(distSq)) * push;
        y += (dy / Math.sqrt(distSq)) * push;
      }

      pos.setXY(i, x, y);
    }
    pos.needsUpdate = true;

    for (let i = activeRipples.length - 1; i >= 0; i--) {
      const r = activeRipples[i];
      r.age += dt;
      const t = r.age / 0.9;
      if (t >= 1) {
        scene.remove(r.mesh);
        r.mat.dispose();
        activeRipples.splice(i, 1);
      } else {
        const scale = 1 + t * 6.5;
        r.mesh.scale.set(scale, scale, 1);
        r.mat.opacity = 0.6 * (1 - t) * (1 - t);
      }
    }

    render();
    rafId = requestAnimationFrame(tick);
  }

  function syncRunning() {
    const running = !destroyed && visible && !document.hidden && !reducedMotion.matches && !userPaused;
    if (running && !rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    } else if (!running && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastTime = 0;
      render();
    }
    host.dataset.atmosphereMotion = running ? "running" : "paused";
  }

  function onPointerMove(event) {
    if (!bounds.width || !bounds.height) return;
    pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerY = -((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  }

  function onPointerLeave() {
    pointerX = 0;
    pointerY = 0;
  }

  function onPointerDown(event) {
    if (event.target?.closest("a, button, input, select, textarea, form")) return;
    updateBounds();
    spawnRipple(event.clientX, event.clientY);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      syncRunning();
    },
    { threshold: 0.05 }
  );
  intersectionObserver.observe(host);

  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);
  host.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("scroll", updateBounds, { passive: true });
  document.addEventListener("visibilitychange", syncRunning);
  reducedMotion.addEventListener("change", syncRunning);

  applyMoodColors();
  resize();
  host.dataset.atmosphereReady = "true";
  syncRunning();

  return {
    setMood(mood) {
      if (!MOODS[mood]) return;
      currentMood = mood;
      applyMoodColors();
      render();
    },
    setPaused(paused) {
      userPaused = Boolean(paused);
      syncRunning();
    },
    pulseCenter() {
      updateBounds();
      spawnRipple(bounds.left + bounds.width * 0.58, bounds.top + bounds.height * 0.52);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", updateBounds);
      document.removeEventListener("visibilitychange", syncRunning);
      reducedMotion.removeEventListener("change", syncRunning);
      for (const r of activeRipples) {
        scene.remove(r.mesh);
        r.mat.dispose();
      }
      rippleGeo.dispose();
      geometry.dispose();
      material.dispose();
      sprite?.dispose();
      renderer.dispose();
    },
  };
}
