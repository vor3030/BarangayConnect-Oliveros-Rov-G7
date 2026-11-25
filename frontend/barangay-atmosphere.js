import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  WebGLRenderer,
} from "three";
import { isReducedMotion, subscribeMotionChange } from "./motion-pref.js";

const MOODS = {
  twilight: {
    primary: new Color(0xf6c26b),
    secondary: new Color(0x7cd8c4),
    accent: new Color(0xebd8b7),
    line: new Color(0x88d4c3),
    opacity: 0.9,
    lineOpacity: 0.24,
    speed: 1,
  },
  golden: {
    primary: new Color(0xffbd52),
    secondary: new Color(0xffe2a8),
    accent: new Color(0xf4943e),
    line: new Color(0xf5c06b),
    opacity: 0.95,
    lineOpacity: 0.3,
    speed: 1.18,
  },
  night: {
    primary: new Color(0xffdf8e),
    secondary: new Color(0x69bfd6),
    accent: new Color(0x9ee8d4),
    line: new Color(0x6cc2d9),
    opacity: 0.96,
    lineOpacity: 0.28,
    speed: 0.88,
  },
};

function makeLanternSprite() {
  const size = 96;
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = size;
  spriteCanvas.height = size;
  const ctx = spriteCanvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 253, 244, 1)");
  grad.addColorStop(0.24, "rgba(255, 224, 152, 0.92)");
  grad.addColorStop(0.58, "rgba(229, 154, 60, 0.32)");
  grad.addColorStop(1, "rgba(229, 154, 60, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(spriteCanvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Interactive Three.js WebGL Philippine Barangay Lantern & Constellation Field.
 * - Floating golden-amber barangay lanterns & twilight stars
 * - Dynamic luminous constellation lines linking nearby community nodes & cursor
 * - Magnetic cursor aura + CSS cursor spotlight (--spot-x, --spot-y)
 * - Click-anywhere expanding golden shockwave ripple
 * - Live Twilight / Golden Dusk / Night Watch mood switching
 */
export function mountBarangayAtmosphere(host, { density = 64, constellations = true } = {}) {
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

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 40);
  camera.position.z = 8.6;

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
    const x = (Math.random() - 0.5) * 16.5;
    const y = (Math.random() - 0.5) * 9.0;
    const z = (Math.random() - 0.5) * 3.8;
    baseX[i] = x;
    baseY[i] = y;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.28 + Math.random() * 0.58;
    colorRoles[i] = i % 5 === 0 ? 1 : i % 3 === 0 ? 2 : 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const material = new PointsMaterial({
    size: 0.44,
    map: sprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new Points(geometry, material);
  scene.add(points);

  // Dynamic constellation links near cursor and between neighboring community lanterns
  const maxLinks = constellations ? 140 : 0;
  let lineGeo = null;
  let lineMat = null;
  let linePositions = null;
  if (maxLinks > 0) {
    linePositions = new Float32Array(maxLinks * 6);
    lineGeo = new BufferGeometry();
    lineGeo.setAttribute("position", new BufferAttribute(linePositions, 3));
    lineGeo.setDrawRange(0, 0);
    lineMat = new LineBasicMaterial({
      color: MOODS.twilight.line,
      transparent: true,
      opacity: MOODS.twilight.lineOpacity,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new LineSegments(lineGeo, lineMat));
  }

  const activeRipples = [];
  const rippleGeo = new RingGeometry(0.18, 0.28, 40);

  let currentMood = host.dataset.mood || "twilight";
  let userPaused = false;
  let visible = true;
  let destroyed = false;
  let rafId = 0;
  let elapsed = 0;
  let lastTime = 0;
  let bounds = host.getBoundingClientRect();
  let pointerActive = false;
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
    if (lineMat) {
      lineMat.color.copy(palette.line);
      lineMat.opacity = palette.lineOpacity;
    }
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
    if (isReducedMotion() || userPaused || !bounds.width || !bounds.height) return;
    const ndcX = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    const ndcY = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    const worldX = ndcX * 6.5 * (camera.aspect / 1.6);
    const worldY = ndcY * 3.8;
    const palette = MOODS[currentMood] || MOODS.twilight;
    const ringMat = new MeshBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: 0.78,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new Mesh(rippleGeo, ringMat);
    mesh.position.set(worldX, worldY, 0.6);
    scene.add(mesh);
    activeRipples.push({ mesh, mat: ringMat, age: 0, worldX, worldY });
  }

  function tick(now) {
    if (destroyed) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    const palette = MOODS[currentMood] || MOODS.twilight;
    elapsed += dt * palette.speed;

    smoothPointerX += (pointerX - smoothPointerX) * 0.08;
    smoothPointerY += (pointerY - smoothPointerY) * 0.08;

    const pos = geometry.getAttribute("position");
    const cursorWorldX = smoothPointerX * 6.6 * Math.min(1.3, camera.aspect / 1.5);
    const cursorWorldY = smoothPointerY * 3.8;

    for (let i = 0; i < count; i++) {
      const phase = phases[i];
      const sp = speeds[i];
      let x = baseX[i] + Math.sin(elapsed * sp + phase) * 0.55 + smoothPointerX * 0.55;
      let y = ((baseY[i] + elapsed * sp * 0.4 + 4.8) % 9.6) - 4.8 + Math.cos(elapsed * 0.65 + phase) * 0.2;

      if (pointerActive) {
        const dx = x - cursorWorldX;
        const dy = y - cursorWorldY;
        const distSq = dx * dx + dy * dy;
        if (distSq < 6.5 && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const force = (1 - distSq / 6.5) * 0.52;
          // Gentle orbital swirl + subtle push around pointer
          x += (dx / dist) * force - (dy / dist) * force * 0.35;
          y += (dy / dist) * force + (dx / dist) * force * 0.35;
        }
      }

      for (const r of activeRipples) {
        const rdx = x - r.worldX;
        const rdy = y - r.worldY;
        const rDist = Math.hypot(rdx, rdy);
        const waveRadius = r.age * 7.5;
        if (Math.abs(rDist - waveRadius) < 1.1 && rDist > 0.01) {
          const kick = (1 - r.age / 0.95) * 0.45;
          x += (rdx / rDist) * kick;
          y += (rdy / rDist) * kick;
        }
      }

      pos.setXY(i, x, y);
    }
    pos.needsUpdate = true;

    // Update constellation links (connect nodes close to each other and to cursor)
    if (lineGeo && linePositions) {
      let seg = 0;
      const maxDistSq = 4.6;
      for (let i = 0; i < count && seg < maxLinks; i++) {
        const ix = pos.getX(i);
        const iy = pos.getY(i);
        const iz = pos.getZ(i);
        if (pointerActive) {
          const cdx = ix - cursorWorldX;
          const cdy = iy - cursorWorldY;
          if (cdx * cdx + cdy * cdy < 7.2 && seg < maxLinks) {
            const o = seg * 6;
            linePositions[o] = ix;
            linePositions[o + 1] = iy;
            linePositions[o + 2] = iz;
            linePositions[o + 3] = cursorWorldX;
            linePositions[o + 4] = cursorWorldY;
            linePositions[o + 5] = 0.2;
            seg += 1;
          }
        }
        for (let j = i + 1; j < count && seg < maxLinks; j++) {
          const dx = ix - pos.getX(j);
          const dy = iy - pos.getY(j);
          if (dx * dx + dy * dy < maxDistSq) {
            const o = seg * 6;
            linePositions[o] = ix;
            linePositions[o + 1] = iy;
            linePositions[o + 2] = iz;
            linePositions[o + 3] = pos.getX(j);
            linePositions[o + 4] = pos.getY(j);
            linePositions[o + 5] = pos.getZ(j);
            seg += 1;
          }
        }
      }
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.setDrawRange(0, seg * 2);
    }

    for (let i = activeRipples.length - 1; i >= 0; i--) {
      const r = activeRipples[i];
      r.age += dt;
      const t = r.age / 0.95;
      if (t >= 1) {
        scene.remove(r.mesh);
        r.mat.dispose();
        activeRipples.splice(i, 1);
      } else {
        const scale = 1 + t * 8.2;
        r.mesh.scale.set(scale, scale, 1);
        r.mat.opacity = 0.72 * (1 - t) * (1 - t);
      }
    }

    render();
    rafId = requestAnimationFrame(tick);
  }

  function syncRunning() {
    const running = !destroyed && visible && !document.hidden && !isReducedMotion() && !userPaused;
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
    pointerActive = true;
    const rx = (event.clientX - bounds.left) / bounds.width;
    const ry = (event.clientY - bounds.top) / bounds.height;
    pointerX = rx * 2 - 1;
    pointerY = -(ry * 2 - 1);
    // Live warm lantern cursor spotlight directly on the background surface
    host.style.setProperty("--spot-x", `${(rx * 100).toFixed(1)}%`);
    host.style.setProperty("--spot-y", `${(ry * 100).toFixed(1)}%`);
    host.style.setProperty("--spot-opacity", "1");
  }

  function onPointerLeave() {
    pointerActive = false;
    pointerX = 0;
    pointerY = 0;
    host.style.setProperty("--spot-opacity", "0");
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
  const unsubMotion = subscribeMotionChange(syncRunning);

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
      spawnRipple(bounds.left + bounds.width * 0.56, bounds.top + bounds.height * 0.5);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      unsubMotion();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", updateBounds);
      document.removeEventListener("visibilitychange", syncRunning);
      for (const r of activeRipples) {
        scene.remove(r.mesh);
        r.mat.dispose();
      }
      rippleGeo.dispose();
      lineGeo?.dispose();
      lineMat?.dispose();
      geometry.dispose();
      material.dispose();
      sprite?.dispose();
      renderer.dispose();
    },
  };
}
