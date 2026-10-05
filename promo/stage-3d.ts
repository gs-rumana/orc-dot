/**
 * Browser half of the 3D promo: bundled into promo/.build/promo-3d.html by
 * build-3d.ts. Every orc is the real buildAvatar/animateAvatar output, lit like
 * the studio, so the video shows exactly what the 3D studio renders.
 *
 * window.renderAt(seconds) draws one deterministic frame: each visible actor
 * gets its own viewport on a shared transparent canvas, over the HTML overlay
 * background, with captions and labels positioned in HTML on top.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  animateAvatar,
  buildAvatar,
  type AvatarModel,
} from "@/lib/avatar/three/buildAvatar";
import type { FurryOptions } from "@/lib/avatar/three/types";
import type { AvatarConfig } from "@/lib/avatar/types";

export interface Actor {
  config: AvatarConfig;
  furry: FurryOptions;
  /** Viewport centre and size, in 1080×1080 stage pixels. */
  x: number;
  y: number;
  size: number;
  start: number;
  end: number;
  /** Seconds added to the animation clock (phase offset). */
  shift: number;
  pop?: boolean;
  /** Camera yaw at the start of the window, and how far it turns across it. */
  yaw?: number;
  turn?: number;
  /** Ease the turn in and out (turntable) instead of a steady drift. */
  easeTurn?: boolean;
  zoom?: number;
  lookY?: number;
}

declare global {
  interface Window {
    ACTORS: Actor[];
    READY: boolean;
    renderAt: (t: number) => void;
    overlayAt: (t: number) => void;
  }
}

const SIZE = 1080;
const inOut = (x: number) => {
  x = THREE.MathUtils.clamp(x, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const back = (x: number) => {
  x = THREE.MathUtils.clamp(x, 0, 1);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

window.READY = false;
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0);

// The studio's lighting rig (components/avatar/Avatar3DCanvas.tsx).
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.2;
pmrem.dispose();
scene.add(new THREE.AmbientLight("#ffffff", 1.2));
scene.add(new THREE.HemisphereLight("#fff8eb", "#746958", 1.7));
const key = new THREE.DirectionalLight("#fff8ef", 3);
key.position.set(-3, 4, 5);
scene.add(key);
const rim = new THREE.DirectionalLight("#ddecff", 2);
rim.position.set(3, 2, -3);
scene.add(rim);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);

const actors = window.ACTORS;
const models: AvatarModel[] = actors.map((actor) => {
  const model = buildAvatar(actor.config, actor.furry);
  model.root.visible = false;
  scene.add(model.root);
  return model;
});

window.renderAt = (t: number) => {
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  actors.forEach((actor, i) => {
    const age = t - actor.start;
    if (age < 0 || t >= actor.end) return;
    const model = models[i];
    animateAvatar(model, actor.config, age + actor.shift);
    const span = actor.end - actor.start;
    const progress = actor.easeTurn ? inOut(age / span) : age / span;
    const yaw = (actor.yaw ?? 0.065) + (actor.turn ?? 0) * progress;
    const distance = 5.42 / (actor.zoom ?? 1);
    const lookY = actor.lookY ?? 0.12;
    camera.position.set(
      Math.sin(yaw) * distance,
      lookY + 0.13,
      Math.cos(yaw) * distance,
    );
    camera.lookAt(0, lookY, 0);
    const scale = actor.pop ? 0.6 + 0.4 * back(age / 0.28) : 1;
    const size = actor.size * scale;
    // WebGL viewports are measured from the bottom-left corner.
    const left = actor.x - size / 2;
    const bottom = SIZE - (actor.y + size / 2);
    renderer.setViewport(left, bottom, size, size);
    renderer.setScissor(left, bottom, size, size);
    model.root.visible = true;
    renderer.render(scene, camera);
    model.root.visible = false;
  });
  window.overlayAt(t);
};

// Upload every model once so recording never stalls on a first draw.
renderer.compile(scene, camera);
models.forEach((model) => {
  model.root.visible = true;
  renderer.render(scene, camera);
  model.root.visible = false;
});
window.renderAt(Number(location.hash.slice(1) || 0));
window.READY = true;
