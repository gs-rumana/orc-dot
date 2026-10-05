"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  animateAvatar,
  buildAvatar,
  disposeAvatar,
  type AvatarModel,
} from "@/lib/avatar/three/buildAvatar";
import type { Avatar3DHandle, FurryOptions } from "@/lib/avatar/three/types";
import type { AvatarConfig } from "@/lib/avatar/types";

interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  model: AvatarModel | null;
  activeTime: number;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetCamera(runtime: Runtime) {
  runtime.camera.position.set(0.35, 0.25, 5.4);
  runtime.controls.target.set(0, 0.12, 0);
  runtime.controls.update();
}

export default function Avatar3DCanvas({
  config,
  options,
  paused,
  apiRef,
  onReady,
}: {
  config: AvatarConfig;
  options: FurryOptions;
  paused: boolean;
  apiRef: Ref<Avatar3DHandle>;
  onReady: (ready: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const current = useRef({ config, paused });
  const [error, setError] = useState<string | null>(null);
  // Motion controls update the rig without rebuilding 46,000 fur fibers.
  const appearanceKey = JSON.stringify({
    ...config,
    motion: "still",
    eyeMotion: "still",
  });

  useEffect(() => {
    current.current = { config, paused };
    const rt = runtime.current;
    if (rt?.model) {
      animateAvatar(rt.model, config, rt.activeTime);
      rt.renderer.render(rt.scene, rt.camera);
    }
  }, [config, paused]);

  useImperativeHandle(
    apiRef,
    () => ({
      resetView() {
        if (runtime.current) resetCamera(runtime.current);
      },
      async downloadPng() {
        const rt = runtime.current;
        if (!rt?.model || rt.renderer.getContext().isContextLost())
          throw new Error(
            "The 3D preview is unavailable. Switch to 2D and back to retry.",
          );
        // Render a square portrait at export resolution, then restore the viewport.
        const size = rt.renderer.getSize(new THREE.Vector2());
        const ratio = rt.renderer.getPixelRatio();
        const aspect = rt.camera.aspect;
        const fov = rt.camera.fov;
        let png: Promise<Blob>;
        try {
          rt.renderer.setPixelRatio(1);
          rt.renderer.setSize(1024, 1024, false);
          rt.camera.aspect = 1;
          rt.camera.fov = 38;
          rt.camera.updateProjectionMatrix();
          rt.renderer.render(rt.scene, rt.camera);
          png = new Promise((resolve, reject) =>
            rt.renderer.domElement.toBlob(
              (blob) =>
                blob
                  ? resolve(blob)
                  : reject(new Error("PNG export failed. Please try again.")),
              "image/png",
            ),
          );
        } finally {
          rt.renderer.setPixelRatio(ratio);
          rt.renderer.setSize(size.x, size.y, false);
          rt.camera.aspect = aspect;
          rt.camera.fov = fov;
          rt.camera.updateProjectionMatrix();
          rt.renderer.render(rt.scene, rt.camera);
        }
        download(await png, "orc-plush.png");
      },
      async downloadGlb() {
        const rt = runtime.current;
        if (!rt?.model)
          throw new Error("Wait for the 3D avatar to load before exporting.");
        const source = rt.model.root;
        const { avatarToGlb } = await import("@/lib/avatar/three/exportGlb");
        const result = await avatarToGlb(source);
        download(
          new Blob([result], { type: "model/gltf-binary" }),
          "orc-plush.glb",
        );
      },
    }),
    [],
  );

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // Renderer initialization can fail only after mounting in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "3D needs WebGL. Enable hardware acceleration in your browser, or switch to 2D SVG.",
      );
      onReady(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    const scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmrem.fromScene(environment, 0.04);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = 0.2;
    environment.dispose();
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
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 3.6;
    controls.maxDistance = 8;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.8;
    const rt: Runtime = {
      renderer,
      scene,
      camera,
      controls,
      model: null,
      activeTime: 0,
    };
    runtime.current = rt;
    const renderOnChange = () => renderer.render(scene, camera);
    controls.addEventListener("change", renderOnChange);
    resetCamera(rt);
    const canvas = renderer.domElement;
    canvas.className =
      "h-full w-full touch-none outline-none focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:ring-inset";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "3D furry orc. Drag to rotate, scroll or pinch to zoom. Use arrow keys to rotate, plus or minus to zoom, and Home to reset.",
    );
    container.appendChild(canvas);
    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Keep ears and horns in frame in narrow portrait viewports.
      camera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(19)) / Math.min(1, camera.aspect),
          ),
      );
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Home") {
        event.preventDefault();
        resetCamera(rt);
        return;
      }
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "=",
          "-",
        ].includes(event.key)
      )
        return;
      event.preventDefault();
      const spherical = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target),
      );
      if (event.key === "ArrowLeft") spherical.theta -= 0.12;
      if (event.key === "ArrowRight") spherical.theta += 0.12;
      if (event.key === "ArrowUp") spherical.phi -= 0.12;
      if (event.key === "ArrowDown") spherical.phi += 0.12;
      if (event.key === "+" || event.key === "=") spherical.radius *= 0.9;
      if (event.key === "-") spherical.radius *= 1.1;
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi,
        controls.minPolarAngle,
        controls.maxPolarAngle,
      );
      spherical.radius = THREE.MathUtils.clamp(
        spherical.radius,
        controls.minDistance,
        controls.maxDistance,
      );
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      setError(
        "The 3D preview lost its graphics connection. Switch to 2D and back to reload it.",
      );
      onReady(false);
    };
    canvas.addEventListener("keydown", keydown);
    canvas.addEventListener("webglcontextlost", contextLost);
    let last = 0;
    renderer.setAnimationLoop((now) => {
      const delta = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (!current.current.paused && !document.hidden) {
        rt.activeTime += delta;
        if (rt.model)
          animateAvatar(rt.model, current.current.config, rt.activeTime);
      }
      const changed = controls.update();
      if (!document.hidden && (changed || !current.current.paused))
        renderer.render(scene, camera);
    });
    onReady(true);
    return () => {
      onReady(false);
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener("keydown", keydown);
      canvas.removeEventListener("webglcontextlost", contextLost);
      controls.removeEventListener("change", renderOnChange);
      controls.dispose();
      if (rt.model) disposeAvatar(rt.model.root);
      renderer.dispose();
      environmentMap.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      runtime.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    if (rt.model) {
      rt.scene.remove(rt.model.root);
      disposeAvatar(rt.model.root);
    }
    rt.model = buildAvatar(JSON.parse(appearanceKey) as AvatarConfig, options);
    animateAvatar(rt.model, current.current.config, rt.activeTime);
    rt.scene.add(rt.model.root);
    rt.renderer.render(rt.scene, rt.camera);
  }, [appearanceKey, options]);

  return (
    <div ref={host} className="absolute inset-0">
      {error ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex items-center justify-center bg-muted/95 p-10 text-center text-sm"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
