import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
} from "three";

/**
 * Interactive ambient Three.js background for the Barangay Connect landing page.
 * Uses only the brand palette: warm paper (#f6f3ec), forest green (#244c3c),
 * sand beige (#e7dcc8), terracotta (#9e5037), and muted clay (#b77758).
 * Responds smoothly to pointer movement, click/tap ripples, and page scroll.
 */
export function mountShowcaseBackground(container) {
  const canvas = container.querySelector("[data-showcase-bg-canvas]");
  if (!canvas) return null;

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 16 / 9, 0.1, 120);
  camera.position.set(0, 5.2, 18.5);

  const world = new Group();
  scene.add(world);

  // Warm sunlit lighting
  const hemi = new HemisphereLight(new Color(0xfffdf8), new Color(0xe7dcc8), 1.35);
  const sun = new DirectionalLight(0xfff6e5, 1.15);
  sun.position.set(8, 14, 10);
  const bounce = new DirectionalLight(0xd5decb, 0.55);
  bounce.position.set(-10, -4, 6);
  scene.add(hemi, sun, bounce, new AmbientLight(0xffffff, 0.25));

  // 1. Gentle undulating topographic terrain mesh (warm sand & soft sage lines)
  const segX = 42;
  const segZ = 28;
  const terrainGeo = new PlaneGeometry(36, 24, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const baseHeights = new Float32Array(posAttr.count);
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const h =
      Math.sin(x * 0.24) * Math.cos(z * 0.28) * 0.85 +
      Math.sin((x + z) * 0.14) * 0.45;
    baseHeights[i] = h;
    posAttr.setY(i, h);
  }
  terrainGeo.computeVertexNormals();

  const terrainSurfaceMat = new MeshStandardMaterial({
    color: 0xe7dcc8,
    roughness: 0.92,
    metalness: 0.02,
    transparent: true,
    opacity: 0.22,
    flatShading: true,
  });
  const terrainWireMat = new MeshBasicMaterial({
    color: 0x244c3c,
    wireframe: true,
    transparent: true,
    opacity: 0.065,
  });

  const terrainMesh = new Mesh(terrainGeo, terrainSurfaceMat);
  terrainMesh.position.set(0, -3.4, -2);
  const terrainWire = new Mesh(terrainGeo, terrainWireMat);
  terrainWire.position.set(0, -3.38, -2);
  world.add(terrainMesh, terrainWire);

  // 2. Floating community constellation nodes (purok markers in forest, terracotta, sand)
  const nodeGroup = new Group();
  world.add(nodeGroup);

  const forestMat = new MeshStandardMaterial({
    color: 0x244c3c,
    roughness: 0.45,
    metalness: 0.08,
    transparent: true,
    opacity: 0.48,
  });
  const terracottaMat = new MeshStandardMaterial({
    color: 0x9e5037,
    roughness: 0.48,
    metalness: 0.06,
    transparent: true,
    opacity: 0.46,
  });
  const clayMat = new MeshStandardMaterial({
    color: 0xb77758,
    roughness: 0.55,
    metalness: 0.04,
    transparent: true,
    opacity: 0.42,
  });
  const sandMat = new MeshStandardMaterial({
    color: 0xded4bf,
    roughness: 0.7,
    metalness: 0.02,
    transparent: true,
    opacity: 0.52,
  });

  const sphereGeo = new SphereGeometry(0.18, 16, 12);
  const octGeo = new OctahedronGeometry(0.24, 0);
  const icoGeo = new IcosahedronGeometry(0.21, 0);

  const nodeSpecs = [
    [-10.2, 2.4, -3.5, "forest", "ico", 1.15],
    [-8.4, -0.6, 1.2, "terracotta", "sphere", 1.05],
    [-6.6, 3.6, -5.2, "sand", "oct", 1.25],
    [-5.1, 0.8, -1.6, "forest", "sphere", 0.9],
    [-3.4, 4.1, -6.4, "clay", "ico", 0.95],
    [-2.0, -1.1, 2.4, "forest", "oct", 0.85],
    [0.6, 3.5, -5.8, "terracotta", "sphere", 1.1],
    [2.8, 1.2, -2.5, "sand", "ico", 1.05],
    [4.6, 3.9, -4.6, "forest", "oct", 1.15],
    [6.4, -0.4, 0.9, "terracotta", "ico", 1.2],
    [8.2, 2.7, -2.4, "clay", "sphere", 1.05],
    [10.5, 0.4, -4.2, "forest", "oct", 1.25],
    [-9.5, -1.9, -6.2, "clay", "sphere", 0.95],
    [-4.2, -2.0, -4.8, "terracotta", "sphere", 0.85],
    [1.8, -1.9, -4.5, "forest", "sphere", 0.95],
    [7.5, -1.8, -5.4, "sand", "oct", 1.0],
    [11.2, 3.4, -6.8, "terracotta", "sphere", 1.0],
    [-11.4, 0.6, -1.8, "sand", "ico", 1.1],
  ];

  const matMap = { forest: forestMat, terracotta: terracottaMat, clay: clayMat, sand: sandMat };
  const geoMap = { sphere: sphereGeo, oct: octGeo, ico: icoGeo };

  const nodes = nodeSpecs.map(([x, y, z, matKey, geoKey, scale], index) => {
    const mesh = new Mesh(geoMap[geoKey], matMap[matKey]);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale);
    nodeGroup.add(mesh);
    return {
      mesh,
      baseX: x,
      baseY: y,
      baseZ: z,
      baseScale: scale,
      phase: index * 0.72,
      speed: 0.65 + (index % 4) * 0.14,
      boost: 0,
    };
  });

  // 3. Soft community connection filaments between nearby nodes
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].baseX - nodes[j].baseX;
      const dy = nodes[i].baseY - nodes[j].baseY;
      const dz = nodes[i].baseZ - nodes[j].baseZ;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 6.4) {
        pairs.push([i, j]);
      }
    }
  }
  const linePositions = new Float32Array(pairs.length * 6);
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new BufferAttribute(linePositions, 3));
  const lineMat = new LineBasicMaterial({
    color: 0x244c3c,
    transparent: true,
    opacity: 0.14,
  });
  const links = new LineSegments(lineGeo, lineMat);
  nodeGroup.add(links);

  // 4. Interactive click/tap ripples on the terrain plane
  const ripples = [];
  const rippleGeo = new RingGeometry(0.18, 0.3, 40);
  rippleGeo.rotateX(-Math.PI / 2);

  function spawnRipple(normX, normY) {
    const worldX = normX * 11;
    const worldZ = normY * 7 - 2;
    const mat = new MeshBasicMaterial({
      color: ripples.length % 2 === 0 ? 0x9e5037 : 0x244c3c,
      transparent: true,
      opacity: 0.42,
      side: 2,
    });
    const ring = new Mesh(rippleGeo, mat);
    ring.position.set(worldX, -2.55, worldZ);
    world.add(ring);
    ripples.push({
      mesh: ring,
      mat,
      x: worldX,
      z: worldZ,
      age: 0,
      duration: 1.55,
    });
    if (ripples.length > 6) {
      const old = ripples.shift();
      world.remove(old.mesh);
      old.mat.dispose();
    }
    // Give nearby community nodes a gentle friendly lift
    for (const node of nodes) {
      const d = Math.hypot(node.baseX - worldX, node.baseZ - worldZ);
      if (d < 7.5) {
        node.boost = Math.min(1.1, node.boost + (1 - d / 7.5) * 0.9);
      }
    }
  }

  // State
  const pointer = new Vector2(0, 0);
  const smoothPointer = new Vector2(0, 0);
  let targetScroll = 0;
  let smoothScroll = 0;
  let elapsed = 0;
  let lastTime = 0;
  let rafId = 0;
  let destroyed = false;

  function updateScroll() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    targetScroll = MathUtils.clamp(window.scrollY / maxScroll, 0, 1);
  }

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderFrame(0);
  }

  function updateScene(dt) {
    elapsed += dt;
    smoothPointer.x = MathUtils.lerp(smoothPointer.x, pointer.x, 0.06);
    smoothPointer.y = MathUtils.lerp(smoothPointer.y, pointer.y, 0.06);
    smoothScroll = MathUtils.lerp(smoothScroll, targetScroll, 0.07);

    // Dynamic scroll-driven camera path + gentle pointer parallax
    const scrollAngle = smoothScroll * 0.55;
    const camX = Math.sin(scrollAngle) * 4.2 + smoothPointer.x * 2.1;
    const camY = 5.4 - smoothScroll * 2.1 + smoothPointer.y * -1.1;
    const camZ = 18.2 - Math.sin(smoothScroll * Math.PI) * 2.4;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(smoothPointer.x * 0.7, -0.5 - smoothScroll * 1.15, -2.2);

    // Subtle undulating terrain + ripple wave displacement
    const attr = terrainGeo.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i);
      const z = attr.getZ(i);
      let y =
        baseHeights[i] +
        Math.sin(elapsed * 0.85 + x * 0.32 + smoothScroll * 3.2) * 0.18 +
        Math.cos(elapsed * 0.68 + z * 0.35) * 0.14;

      // Pointer wave near cursor projection
      const px = smoothPointer.x * 10;
      const pz = smoothPointer.y * 6;
      const pd = Math.hypot(x - px, z - pz);
      if (pd < 5.5) {
        y += Math.cos((pd / 5.5) * (Math.PI * 0.5)) * 0.42;
      }

      // Click/tap ripples
      for (const r of ripples) {
        const radius = r.age * 7.5;
        const rd = Math.abs(Math.hypot(x - r.x, z - r.z) - radius);
        if (rd < 1.8) {
          const strength = (1 - r.age / r.duration) * (1 - rd / 1.8);
          y += Math.sin(strength * Math.PI) * 0.55;
        }
      }
      attr.setY(i, y);
    }
    attr.needsUpdate = true;

    // Animate community nodes & connection filaments
    for (const node of nodes) {
      node.boost = Math.max(0, node.boost - dt * 1.15);
      const px = smoothPointer.x * 11;
      const py = -smoothPointer.y * 4.2;
      const dist = Math.hypot(node.baseX - px, node.baseY - py);
      const proximity = Math.max(0, 1 - dist / 6.5);

      const floatY = Math.sin(elapsed * node.speed + node.phase) * 0.32;
      const scrollDriftY = (smoothScroll - 0.5) * (node.baseZ * 0.22);
      node.mesh.position.set(
        node.baseX + Math.cos(elapsed * 0.45 + node.phase) * 0.14,
        node.baseY + floatY + scrollDriftY + proximity * 0.5 + node.boost * 0.85,
        node.baseZ
      );
      node.mesh.rotation.y = elapsed * 0.38 + node.phase;
      node.mesh.rotation.x = elapsed * 0.22 + node.phase * 0.5;
      const s = node.baseScale * (1 + proximity * 0.28 + node.boost * 0.32);
      node.mesh.scale.setScalar(s);
    }

    const lp = lineGeo.attributes.position.array;
    for (let k = 0; k < pairs.length; k++) {
      const a = nodes[pairs[k][0]].mesh.position;
      const b = nodes[pairs[k][1]].mesh.position;
      const offset = k * 6;
      lp[offset] = a.x;
      lp[offset + 1] = a.y;
      lp[offset + 2] = a.z;
      lp[offset + 3] = b.x;
      lp[offset + 4] = b.y;
      lp[offset + 5] = b.z;
    }
    lineGeo.attributes.position.needsUpdate = true;

    // Advance ripple rings
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += dt;
      if (r.age >= r.duration) {
        world.remove(r.mesh);
        r.mat.dispose();
        ripples.splice(i, 1);
      } else {
        const t = r.age / r.duration;
        const scale = 1 + t * 18;
        r.mesh.scale.setScalar(scale);
        r.mat.opacity = 0.42 * (1 - t) * (1 - t);
      }
    }
  }

  function renderFrame(dt) {
    if (destroyed) return;
    if (dt > 0) updateScene(dt);
    renderer.render(scene, camera);
  }

  function tick(now) {
    if (destroyed) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    renderFrame(dt);
    rafId = requestAnimationFrame(tick);
  }

  function syncRunning() {
    const running = !destroyed && !document.hidden;
    if (running && !rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    } else if (!running && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastTime = 0;
      renderFrame(0);
    }
    container.dataset.bgMotion = running ? "running" : "paused";
  }

  function onPointerMove(event) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    pointer.set((event.clientX / w) * 2 - 1, (event.clientY / h) * 2 - 1);
  }

  function onTouchMove(event) {
    const touch = event.touches?.[0];
    if (!touch) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    pointer.set((touch.clientX / w) * 2 - 1, (touch.clientY / h) * 2 - 1);
  }

  function onPointerDown(event) {
    // Only trigger gentle background ripple on primary click/tap
    if (event.button && event.button !== 0) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const nx = (event.clientX / w) * 2 - 1;
    const ny = (event.clientY / h) * 2 - 1;
    spawnRipple(nx, ny);
  }

  function onPointerLeave() {
    pointer.set(0, 0);
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", syncRunning);

  updateScroll();
  smoothScroll = targetScroll;
  updateScene(0.016);
  resize();
  container.dataset.bgReady = "true";
  syncRunning();

  return {
    syncMotion: syncRunning,
    pulse(nx = 0, ny = 0) {
      spawnRipple(nx, ny);
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", syncRunning);
      terrainGeo.dispose();
      terrainSurfaceMat.dispose();
      terrainWireMat.dispose();
      sphereGeo.dispose();
      octGeo.dispose();
      icoGeo.dispose();
      forestMat.dispose();
      terracottaMat.dispose();
      clayMat.dispose();
      sandMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      rippleGeo.dispose();
      for (const r of ripples) {
        world.remove(r.mesh);
        r.mat.dispose();
      }
      renderer.dispose();
    },
  };
}
