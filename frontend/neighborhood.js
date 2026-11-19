import {
  AmbientLight, BoxGeometry, Color, ConeGeometry, CylinderGeometry,
  DirectionalLight, Group, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial,
  OrthographicCamera, Scene, SphereGeometry, Vector2, WebGLRenderer,
} from "three";
import { gsap } from "gsap";

function makeNeighborhood() {
  const model = new Group();
  const shades = {
    lawn: new MeshStandardMaterial({ color: 0x99bf85, roughness: .85 }),
    street: new MeshStandardMaterial({ color: 0xe3e5ca }),
    walls: new MeshStandardMaterial({ color: 0xfff3d9 }),
    roof: new MeshStandardMaterial({ color: 0x347964 }),
    clay: new MeshStandardMaterial({ color: 0xcf9c75 }),
    civic: new MeshStandardMaterial({ color: 0x328374 }),
    leaves: new MeshStandardMaterial({ color: 0x73ac73 }),
    trunks: new MeshStandardMaterial({ color: 0x8a674c }),
    base: new MeshStandardMaterial({ color: 0x315f47 }),
    glass: new MeshStandardMaterial({ color: 0x9ed5d3, metalness: .2, roughness: .25 }),
    flag: new MeshStandardMaterial({ color: 0xecc978 }),
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
    box(.28, .02, .045, shades.walls, x, -.025, .3);
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

export function mountNeighborhood(panel, reducedMotion) {
  const canvas = panel.querySelector("canvas");
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }

  const scene = new Scene();
  const camera = new OrthographicCamera(-6, 6, 4, -4, .1, 60);
  const model = makeNeighborhood();
  const sun = new DirectionalLight(0xfff5d8, 2);
  const pointer = new Vector2();
  const display = window.matchMedia("(min-width: 47rem)");
  let paused = false;
  let visible = true;
  let frame = 0;
  let elapsed = 0;
  let previousTime = 0;
  let cameraTween;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  model.rotation.y = -.18;
  sun.position.set(-3, 8, 6);
  camera.position.set(8.8, 10.4, 11);
  camera.lookAt(0, 0, 0);
  scene.add(model, sun, new AmbientLight(0xffffff, .35));
  scene.add(new HemisphereLight(new Color(0xf2fffa), new Color(0xa5bdad), 2));

  function render() {
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
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
    const running = !paused && visible && !reducedMotion.matches && display.matches && !document.hidden;
    if (running && !frame) frame = requestAnimationFrame(tick);
    if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    }
    panel.dataset.sceneMotion = running ? "running" : "paused";
  }

  function aim(event) {
    const bounds = panel.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width - .5) * 2,
      ((event.clientY - bounds.top) / bounds.height - .5) * 2,
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
  document.addEventListener("visibilitychange", syncMotion);
  reducedMotion.addEventListener("change", syncMotion);
  display.addEventListener("change", syncMotion);
  observer.observe(panel);
  sizeObserver.observe(canvas);
  panel.dataset.sceneReady = "true";
  resize();
  syncMotion();

  return {
    setPaused(value) {
      paused = value;
      if (paused) cameraTween?.progress(1);
      syncMotion();
    },
    setView(value) {
      cameraTween?.kill();
      cameraTween = gsap.to(camera.position, {
        x: value === "aerial" ? .3 : 8.8,
        y: value === "aerial" ? 19 : 10.4,
        z: value === "aerial" ? 5 : 11,
        duration: paused || reducedMotion.matches ? 0 : 1.1,
        ease: "power3.inOut", onUpdate: render,
      });
      panel.dataset.sceneView = value;
    },
    destroy() {
      cameraTween?.kill();
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver.disconnect();
      panel.removeEventListener("pointermove", aim);
      panel.removeEventListener("pointerleave", resetPointer);
      document.removeEventListener("visibilitychange", syncMotion);
      reducedMotion.removeEventListener("change", syncMotion);
      display.removeEventListener("change", syncMotion);
      const materials = new Set();
      model.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) materials.add(object.material);
      });
      for (const material of materials) material.dispose();
      renderer.dispose();
    },
  };
}
