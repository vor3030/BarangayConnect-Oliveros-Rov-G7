import {
  AmbientLight, BoxGeometry, Color, ConeGeometry, CylinderGeometry,
  DirectionalLight, Group, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial,
  OrthographicCamera, Scene, SphereGeometry, Vector2, WebGLRenderer,
} from "three";
import { gsap } from "gsap";
import { isReducedMotion, subscribeMotionChange } from "./motion-pref.js";

function makeNeighborhood() {
  const model = new Group();
  const shades = {
    lawn: new MeshStandardMaterial({ color: 0x1c3a37, roughness: .88 }),
    street: new MeshStandardMaterial({ color: 0x2d444d, roughness: .75 }),
    walls: new MeshStandardMaterial({ color: 0xd9e1df, roughness: .72 }),
    roof: new MeshStandardMaterial({ color: 0x173832, roughness: .65 }),
    clay: new MeshStandardMaterial({ color: 0x87563a, roughness: .68 }),
    civic: new MeshStandardMaterial({ color: 0x1f524a, roughness: .58 }),
    leaves: new MeshStandardMaterial({ color: 0x244f44, roughness: .85 }),
    trunks: new MeshStandardMaterial({ color: 0x5d4332, roughness: .9 }),
    base: new MeshStandardMaterial({ color: 0x0f1c21, roughness: .8 }),
    glass: new MeshStandardMaterial({
      color: 0xffcf7d,
      emissive: 0xe59a3c,
      emissiveIntensity: .85,
      metalness: .1,
      roughness: .22,
    }),
    flag: new MeshStandardMaterial({ color: 0xe7d4b5, roughness: .45 }),
  };
  const treeTop = new SphereGeometry(.33, 9, 7);
  const treeTrunk = new CylinderGeometry(.065, .09, .55, 7);

  function place(geometry, material, x, y, z, rotation = 0) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    model.add(mesh);
    return mesh;
  }

  function box(width, height, depth, material, x, y, z) {
    return place(new BoxGeometry(width, height, depth), material, x, y, z);
  }

  box(8.85, .22, 7.55, shades.base, 0, -.46, 0);
  box(8.7, .32, 7.4, shades.lawn, 0, -.22, 0);
  box(8.7, .015, .85, shades.street, 0, -.045, .3);
  box(.66, .015, 7.4, shades.street, -.68, -.043, 0);
  for (let x = -3.8; x < 4; x += .65) {
    box(.28, .02, .045, shades.flag, x, -.025, .3);
  }
  for (const [x, z, roof] of [
    [-2.85, -1.8, shades.clay],
    [-2.65, 1.9, shades.roof],
    [.9, 2.1, shades.clay],
    [2.75, 2.15, shades.roof],
  ]) {
    box(1.15, .82, .95, shades.walls, x, .35, z);
    box(.25, .43, .05, shades.civic, x, .17, z + .49);
    for (const offset of [-.34, .34]) {
      box(.2, .25, .06, shades.glass, x + offset, .44, z + .49);
    }
    place(new ConeGeometry(.86, .48, 4), roof, x, .98, z, Math.PI / 4);
  }

  // The larger building represents the barangay hall.
  box(2.05, .9, 1.34, shades.walls, 1.75, .4, -1.72);
  box(2.22, .22, 1.49, shades.civic, 1.75, .97, -1.72);
  box(.6, .62, .06, shades.roof, 1.75, .28, -.99);
  for (const x of [1.02, 2.48]) {
    box(.2, .63, .2, shades.walls, x, .25, -.89);
  }
  box(1.86, .13, .38, shades.street, 1.75, .02, -.76);
  for (const x of [1.08, 2.42]) {
    box(.32, .28, .06, shades.glass, x, .55, -1.03);
  }
  box(.06, 1.8, .06, shades.walls, 3.15, .85, -1.15);
  box(.5, .3, .045, shades.flag, 3.4, 1.52, -1.15);
  box(1.1, .08, .3, shades.trunks, -2.7, .2, -.55);
  for (const x of [-3.12, -2.28]) box(.08, .25, .22, shades.roof, x, .05, -.55);

  for (const [x, z] of [[-3.7, -2.9], [-1.6, -2.7], [-3.45, 2.9], [3.45, -2.65], [3.65, .95], [.21, 3.1]]) {
    place(treeTrunk, shades.trunks, x, .22, z);
    place(treeTop, shades.leaves, x, .62, z);
  }
  return model;
}

export function mountNeighborhood(panel) {
  const canvas = panel.querySelector(".neighborhood-canvas");
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }

  const scene = new Scene();
  const camera = new OrthographicCamera(-6, 6, 4, -4, .1, 60);
  const model = makeNeighborhood();
  const sun = new DirectionalLight(0xf6dfba, 1.5);
  const pointer = new Vector2();
  const display = window.matchMedia("(min-width: 47rem)");
  let paused = false;
  let visible = true;
  let frame = 0;
  let elapsed = 0;
  let previousTime = 0;
  let cameraTween;
  let panelBounds = panel.getBoundingClientRect();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  model.rotation.y = -.18;
  sun.position.set(-3, 8, 6);
  camera.position.set(8.8, 10.4, 11);
  camera.lookAt(0, 0, 0);
  scene.add(model, sun, new AmbientLight(0x9bc0cc, .38));
  scene.add(new HemisphereLight(new Color(0x96c0cf), new Color(0x0d1518), 1.45));

  function render() {
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function updateBounds() {
    panelBounds = panel.getBoundingClientRect();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(4.3, 5.9 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    updateBounds();
    render();
  }

  function tick(time) {
    const delta = previousTime ? Math.min(time - previousTime, 40) : 16;
    previousTime = time;
    elapsed += delta;
    model.rotation.y = MathUtils.lerp(model.rotation.y, -.18 + pointer.x * .32, .055);
    model.rotation.x = MathUtils.lerp(model.rotation.x, pointer.y * .12, .055);
    model.position.y = Math.sin(elapsed * .0013) * .11;
    render();
    frame = requestAnimationFrame(tick);
  }

  function syncMotion() {
    const running = !paused && visible && !isReducedMotion() && display.matches && !document.hidden;
    if (running && !frame) frame = requestAnimationFrame(tick);
    if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    }
    panel.dataset.sceneMotion = running ? "running" : "paused";
  }

  function aim(event) {
    if (!panelBounds.width || !panelBounds.height) return;
    pointer.set(
      ((event.clientX - panelBounds.left) / panelBounds.width - .5) * 2,
      ((event.clientY - panelBounds.top) / panelBounds.height - .5) * 2,
    );
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncMotion();
  });
  const sizeObserver = new ResizeObserver(resize);
  const resetPointer = () => pointer.set(0, 0);

  panel.addEventListener("pointermove", aim);
  panel.addEventListener("pointerleave", resetPointer);
  window.addEventListener("scroll", updateBounds, { passive: true });
  document.addEventListener("visibilitychange", syncMotion);
  display.addEventListener("change", syncMotion);
  const unsubMotion = subscribeMotionChange(syncMotion);
  observer.observe(panel);
  sizeObserver.observe(panel);
  resize();
  panel.dataset.sceneReady = "true";
  syncMotion();

  return {
    setPaused(value) {
      paused = value;
      syncMotion();
    },
    setView(name) {
      const target = name === "aerial" ? { x: 1.4, y: 14.5, z: 7.2 } : { x: 8.8, y: 10.4, z: 11 };
      panel.dataset.sceneView = name;
      cameraTween?.kill();
      if (isReducedMotion() || paused) {
        camera.position.set(target.x, target.y, target.z);
        render();
        return;
      }
      cameraTween = gsap.to(camera.position, { ...target, duration: .9, ease: "power2.out", onUpdate: render });
    },
    destroy() {
      cancelAnimationFrame(frame);
      cameraTween?.kill();
      observer.disconnect();
      sizeObserver.disconnect();
      unsubMotion();
      panel.removeEventListener("pointermove", aim);
      panel.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("scroll", updateBounds);
      document.removeEventListener("visibilitychange", syncMotion);
      display.removeEventListener("change", syncMotion);
      renderer.dispose();
    },
  };
}
