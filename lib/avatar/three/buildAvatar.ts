import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MATERIALS, paletteFromColors } from "@/lib/avatar/catalog";
import { normalizeConfig } from "@/lib/avatar/normalize";
import type { AvatarConfig, AvatarShape } from "@/lib/avatar/types";
import { coatColors, coatHairColor, type FurryOptions } from "./types";
import {
  earGeometry,
  earPoint,
  eyeGeometry,
  facePatch,
  sweepGeometry,
} from "./geometry";
import {
  faceDepth,
  eyeSize,
  furExposed,
  furTrim,
  hairAt,
  mouthShape,
  outlineDistance,
  paintWeight,
} from "./surfaceDetails";

type XYZ = [number, number, number];
type MotionPart = {
  object: THREE.Object3D;
  kind: "ear" | "brow" | "gear" | "pendant" | "tail" | "jaw" | "lock";
  side: number;
};

/** Store plain arrays so a cloned export can restore each articulated part. */
function rememberPose(object: THREE.Object3D) {
  object.userData.restPosition = object.position.toArray();
  object.userData.restRotation = object.rotation.toArray().slice(0, 3);
  object.userData.restScale = object.scale.toArray();
}

export function restorePose(object: THREE.Object3D) {
  if (!object.userData.restPosition) return;
  object.position.fromArray(object.userData.restPosition);
  object.rotation.set(...(object.userData.restRotation as XYZ));
  object.scale.fromArray(object.userData.restScale);
}

/** Enamel radius at height fraction t: a rounded root swelling to a soft tip. */
const toothRadius = (width: number, t: number) =>
  width * Math.pow(Math.sin((0.22 + t * 0.78) * Math.PI), 0.7);

/** Sweep a lathed tooth's tip outward (bend) and forward, out of the jaw. */
function bendTooth(
  geometry: THREE.BufferGeometry,
  height: number,
  bend: number,
) {
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const t = positions.getY(i) / height;
    positions.setX(i, positions.getX(i) + bend * t * t);
    positions.setZ(i, positions.getZ(i) + 0.095 * t * t);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Rounded enamel with a gently swept tip. A chipped tooth snaps off at
 * `brokenAt`, leaving a tilted, jagged fracture of exposed dentin.
 */
function toothGeometry(
  height: number,
  width: number,
  bend: number,
  brokenAt = 1,
) {
  const profile = [new THREE.Vector2(0, 0)];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * brokenAt;
    profile.push(new THREE.Vector2(toothRadius(width, t), height * t));
  }
  const sideCount = profile.length;
  const broken = brokenAt < 1;
  const edge = toothRadius(width, brokenAt);
  if (broken)
    for (let i = 1; i <= 8; i++)
      profile.push(new THREE.Vector2(edge * (1 - i / 8), height * brokenAt));
  else profile.push(new THREE.Vector2(0, height));
  const geometry = new THREE.LatheGeometry(profile, 48);
  const positions = geometry.getAttribute("position");
  const colors: number[] = [];
  const enamel = new THREE.Color("#ffffff");
  const dentin = new THREE.Color("#cdb48a");
  for (let i = 0; i < positions.count; i++) {
    const j = i % profile.length;
    let shade = enamel;
    if (broken && j >= sideCount - 1) {
      // Outer rim (k = 1) through to the centre of the break (k = 0).
      const k = 1 - (j - sideCount + 1) / 8;
      const a = Math.atan2(positions.getZ(i), positions.getX(i));
      // The outer side stands tallest, as in the 2D chipped tusk.
      const jag =
        0.26 * Math.cos(a) * (Math.sign(bend) || 1) +
        0.2 * Math.abs((((a + Math.PI) / Math.PI) % 1) * 2 - 1);
      const pit = (1 - k) * 0.12;
      positions.setY(i, height * brokenAt + (jag * k - pit) * width * 1.6);
      if (k < 1) shade = dentin;
    }
    colors.push(shade.r, shade.g, shade.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return bendTooth(geometry, height, bend);
}

/** A thick gold sleeve with beaded lips, hugging the tooth along its sweep. */
function tuskBandGeometry(
  height: number,
  width: number,
  bend: number,
  from: number,
  to: number,
) {
  const loop: THREE.Vector2[] = [];
  const at = (t: number, offset: number) =>
    new THREE.Vector2(toothRadius(width, t) + offset, height * t);
  const bead = 0.0125;
  const sleeve = 0.0075;
  // Outer face, rising, with a bead at each lip and a shallow groove between.
  for (let i = 0; i <= 40; i++) {
    const s = i / 40;
    const lip = Math.max(
      Math.sqrt(Math.max(0, 1 - Math.pow(s / 0.18 - 1, 2))) *
        (s < 0.18 ? 1 : 0),
      Math.sqrt(Math.max(0, 1 - Math.pow((1 - s) / 0.18 - 1, 2))) *
        (s > 0.82 ? 1 : 0),
    );
    const beadShape =
      s < 0.18 || s > 0.82
        ? bead * lip
        : sleeve - 0.0025 * Math.exp(-Math.pow((s - 0.5) / 0.06, 2));
    loop.push(at(from + (to - from) * s, Math.max(0.0005, beadShape)));
  }
  loop.push(at(to, -0.002), at(from, -0.002), loop[0].clone());
  return bendTooth(new THREE.LatheGeometry(loop, 48), height, bend);
}

const SHAPES: Record<
  AvatarShape,
  { power: number; height: number; pear: number; offset: number }
> = {
  blob: { power: 1, height: 1.18, pear: 0.24, offset: 0 },
  bean: { power: 0.9, height: 1.12, pear: 0.3, offset: 0 },
  squircle: { power: 0.66, height: 1.05, pear: 0.04, offset: 0 },
  egg: { power: 1, height: 1.3, pear: 0.12, offset: 0 },
  pebble: { power: 1, height: 1.12, pear: 0.17, offset: 0.12 },
  hex: { power: 0.82, height: 1.1, pear: 0.09, offset: 0 },
};
const signedPower = (value: number, power: number) =>
  Math.sign(value) * Math.pow(Math.abs(value), power);

/** One rounded, plush orc. All shapes use the same surface for fur and face placement. */
export function buildAvatar(input: AvatarConfig, options: FurryOptions) {
  const config = normalizeConfig(input);
  const coatTone = coatColors(options, config.skin);
  const palette = paletteFromColors(coatTone.fill, coatTone.fur);
  const coatColor = coatTone.fill;
  const shape = SHAPES[config.shape];
  const hairColor = coatHairColor(config, options);
  const coat = new THREE.Color(coatColor);
  const hairShade = new THREE.Color(hairColor);
  const pigment = new THREE.Color(
    config.markings === "scar"
      ? palette.scar
      : config.markings === "freckles"
        ? palette.ink
        : MATERIALS.warpaint,
  );
  const root = new THREE.Group();
  root.name = "Plush orc";
  const eyes: THREE.Group[] = [];
  const pupils: THREE.Group[] = [];
  const parts: MotionPart[] = [];
  const articulate = (
    object: THREE.Object3D,
    kind: MotionPart["kind"],
    side = 0,
  ) => {
    rememberPose(object);
    parts.push({ object, kind, side });
    return object;
  };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string, metalness = 0, roughness = 0.85) => {
    const key = `${color}:${metalness}:${roughness}`;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, metalness, roughness }),
      );
    return materials.get(key)!;
  };
  const add = (
    geometry: THREE.BufferGeometry,
    color: string,
    position: XYZ,
    scale: XYZ = [1, 1, 1],
    parent: THREE.Object3D = root,
    metalness = 0,
    roughness = 0.85,
  ) => {
    const mesh = new THREE.Mesh(
      geometry,
      material(color, metalness, roughness),
    );
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  };
  const ring = (
    position: XYZ,
    radius: number,
    parent: THREE.Object3D = root,
  ) => {
    const pendant = new THREE.Group();
    pendant.name = "Pendant";
    pendant.position.set(...position);
    parent.add(pendant);
    add(
      new THREE.TorusGeometry(radius, 0.009, 12, 48),
      MATERIALS.gold,
      [0, -radius, 0],
      [1, 1, 1],
      pendant,
      0.75,
      0.25,
    );
    articulate(pendant, "pendant");
    return pendant;
  };
  const curve = (
    points: XYZ[],
    radius: number,
    color: string,
    parent: THREE.Object3D = root,
    metalness = 0,
    roughness = 0.85,
  ) =>
    add(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        20,
        radius,
        6,
        false,
      ),
      color,
      [0, 0, 0],
      [1, 1, 1],
      parent,
      metalness,
      roughness,
    );
  const surface = (x: number, y: number, z: number) => {
    const point = new THREE.Vector3(
      signedPower(x, shape.power) * (1 - shape.pear * y) + shape.offset * y,
      signedPower(y, shape.power) * shape.height - 0.06,
      signedPower(z, 0.9) * 0.78 * (1 - 0.1 * y),
    );
    if (z > 0) point.z += faceDepth(config, point.x, point.y);
    return point;
  };
  const front = (x: number, y: number) => {
    const rawY = signedPower((y + 0.06) / shape.height, 1 / shape.power);
    const rawX = signedPower(
      (x - shape.offset * rawY) / (1 - shape.pear * rawY),
      1 / shape.power,
    );
    return (
      Math.pow(Math.max(0, 1 - rawX * rawX - rawY * rawY), 0.45) *
        0.78 *
        (1 - 0.1 * rawY) +
      faceDepth(config, x, y)
    );
  };
  const pointColor = (
    unit: THREE.Vector3,
    point: THREE.Vector3,
    target: THREE.Color,
  ) => {
    const hair = hairAt(
      config,
      unit.x,
      unit.y,
      unit.z,
      point.x,
      point.y,
      point.z,
    );
    target.copy(coat).lerp(hairShade, hair.weight);
    if (unit.z > 0 && config.markings !== "none") {
      const paint = paintWeight(config, point.x, point.y);
      const grain = 0.9 + Math.sin(point.x * 517 + point.y * 373) * 0.055;
      target.lerp(pigment, paint * grain);
    }
    return hair;
  };
  const bodyGeometry = new THREE.SphereGeometry(1, 128, 96);
  const bodyPositions = bodyGeometry.getAttribute("position");
  const bodyColors: number[] = [];
  const unit = new THREE.Vector3();
  const sample = new THREE.Color();
  for (let i = 0; i < bodyPositions.count; i++) {
    unit.fromBufferAttribute(bodyPositions, i);
    const point = surface(unit.x, unit.y, unit.z);
    pointColor(unit, point, sample);
    bodyColors.push(sample.r, sample.g, sample.b);
    bodyPositions.setXYZ(i, point.x, point.y, point.z);
  }
  bodyGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(bodyColors, 3),
  );
  bodyGeometry.computeVertexNormals();
  const head = add(bodyGeometry, "#ffffff", [0, 0, 0]);
  head.name = "Head";
  head.material.vertexColors = true;
  head.userData.coatColor = coatColor;

  // Short, curved, blunt-ended fibers rather than cones. Random placement avoids
  // the visible spiral rows of the rejected model. Fur covers the entire face.
  const strand = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < 4; row++) {
    const t = row / 3;
    const radius = [0.85, 1, 0.65, 0.08][row];
    for (let side = 0; side < 4; side++) {
      const a = (side / 4) * Math.PI * 2;
      vertices.push(
        Math.cos(a) * radius,
        t,
        Math.sin(a) * radius + t * t * 1.8,
      );
      if (row < 3) {
        const next = (side + 1) % 4;
        indices.push(
          row * 4 + side,
          (row + 1) * 4 + side,
          row * 4 + next,
          row * 4 + next,
          (row + 1) * 4 + side,
          (row + 1) * 4 + next,
        );
      }
    }
  }
  strand.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  strand.setIndex(indices);
  strand.computeVertexNormals();
  // Dense velvet scatters light across adjacent fibers. Keep strand lighting
  // close to the coat surface normal so the nap reads soft rather than jagged.
  const strandNormals = strand.getAttribute("normal");
  const softNormal = new THREE.Vector3();
  for (let i = 0; i < strandNormals.count; i++) {
    softNormal
      .set(
        strandNormals.getX(i) * 0.012,
        1 + strandNormals.getY(i) * 0.012,
        strandNormals.getZ(i) * 0.012,
      )
      .normalize();
    strandNormals.setXYZ(i, softNormal.x, softNormal.y, softNormal.z);
  }
  const length = options.coat === "velvet" ? 0.021 : 0.034;
  // The crown sits high on the head, where the unit sphere reaches y = 0.68.
  const crownY = signedPower(0.68, shape.power) * shape.height - 0.06;
  const count = 46000;
  const fur = new THREE.InstancedMesh(strand, material("#ffffff", 0, 1), count);
  fur.name = `${options.coat} fur`;
  fur.userData.fiberLength = length;
  const transform = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const fiberColor = new THREE.Color();
  let seed = 163;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const y = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const point = surface(x, y, z);
    if (
      !furExposed(
        config,
        point.x,
        point.y,
        point.z,
        shape.height - 0.06,
        crownY,
      )
    ) {
      i--;
      continue;
    }
    unit.set(x, y, z);
    const hair = pointColor(unit, point, fiberColor);
    normal
      .set(
        signedPower(x, 2 - shape.power) / (1 - shape.pear * y),
        signedPower(y, 2 - shape.power) / shape.height,
        signedPower(z, 1.1) / 0.78,
      )
      .normalize();
    tangent.set(0, -1, 0).addScaledVector(normal, normal.y).normalize();
    if (tangent.lengthSq() < 0.001) tangent.set(0, 0, 1);
    // Gently vary the direction of the nap, keeping locks close to the body.
    tangent.applyAxisAngle(normal, (random() - 0.5) * 0.9);
    bitangent.crossVectors(normal, tangent).normalize();
    basis.makeBasis(bitangent, normal, tangent);
    transform.position.copy(point).addScaledVector(normal, -0.002);
    transform.quaternion.setFromRotationMatrix(basis);
    const variation = 0.65 + random() * 0.6;
    const strandLength =
      THREE.MathUtils.lerp(length, hair.length, hair.weight) *
      (point.z > 0.3 ? furTrim(config, point.x, point.y) : 1);
    transform.scale.set(
      (0.0028 + hair.weight * 0.0009) * variation,
      strandLength * variation,
      strandLength * 0.18 * variation,
    );
    transform.updateMatrix();
    fur.setMatrixAt(i, transform.matrix);
    fiberColor.multiplyScalar(0.91 + random() * 0.18);
    fur.setColorAt(i, fiberColor);
  }
  root.add(fur);

  const faceLine = (
    points: [number, number][],
    radius: number,
    color: string,
    parent: THREE.Object3D = root,
  ) =>
    add(
      sweepGeometry(
        points.map(([x, y]) => [x, y, front(x, y) + 0.001] as XYZ),
        (t) => radius * Math.pow(Math.sin(t * Math.PI), 0.25),
      ),
      color,
      [0, 0, 0],
      [1, 1, 1],
      parent,
    );

  for (const side of [-1, 1]) {
    if (config.ears !== "none") {
      const ear = new THREE.Group();
      ear.name = "Ear";
      ear.position.set(side * 0.79, 0.32, 0.18);
      ear.scale.x = side;
      root.add(ear);
      articulate(ear, "ear", side);
      const shell = add(
        earGeometry(config.ears),
        coatColor,
        [0, 0, 0],
        [1, 1, 1],
        ear,
      );
      shell.name = "Ear shell";
      shell.material = new THREE.MeshStandardMaterial({
        color: coatColor,
        vertexColors: true,
        roughness: 0.88,
      });

      // Soft nap grows along the continuous outer rim; the cup stays smooth.
      const fuzz = new THREE.InstancedMesh(
        strand,
        material(coatColor, 0, 1),
        600,
      );
      fuzz.name = "Ear nap";
      for (let i = 0; i < fuzz.count; i++) {
        const t = 0.24 + random() * 0.71;
        const u = (random() > 0.5 ? 1 : -1) * (0.78 + random() * 0.2);
        const p = earPoint(config.ears, t, u);
        const dt = earPoint(config.ears, t + 0.0001, u).sub(p);
        const du = earPoint(config.ears, t, u + 0.0001).sub(p);
        normal.crossVectors(dt, du).normalize();
        tangent.copy(dt).normalize();
        bitangent.crossVectors(normal, tangent).normalize();
        basis.makeBasis(bitangent, normal, tangent);
        transform.position.copy(p).addScaledVector(normal, -0.002);
        transform.quaternion.setFromRotationMatrix(basis);
        transform.scale.set(0.002, length * 0.38, length * 0.08);
        transform.updateMatrix();
        fuzz.setMatrixAt(i, transform.matrix);
      }
      ear.add(fuzz);
      if (config.trinket === "earrings") {
        const pierce = earPoint(config.ears, 0.27, -0.78);
        pierce.z -= 0.009;
        const hoop = ring(pierce.toArray() as XYZ, 0.052, ear);
        hoop.name = "Pierced hoop";
        hoop.rotation.y = 1.02;
        rememberPose(hoop);
      }
    }
    if (config.eyes !== "none") {
      const eye = new THREE.Group();
      eye.name = "Eye";
      eye.position.set(side * 0.29, 0.28, front(side * 0.29, 0.28) - 0.005);
      root.add(eye);
      eyes.push(eye);
      const gaze = new THREE.Group();
      gaze.name = "Gaze";
      eye.add(gaze);
      pupils.push(gaze);
      rememberPose(gaze);
      if (config.eyes === "happy") {
        const points: XYZ[] = [];
        for (let i = 0; i <= 20; i++) {
          const x = (i / 20 - 0.5) * 0.11;
          const y = Math.sin((i / 20) * Math.PI) * 0.025;
          points.push([
            x,
            y,
            front(eye.position.x + x, eye.position.y + y) -
              eye.position.z +
              0.001,
          ]);
        }
        add(
          sweepGeometry(
            points,
            (t) => 0.006 * Math.pow(Math.sin(t * Math.PI), 0.3),
          ),
          "#17201d",
          [0, 0, 0],
          [1, 1, 1],
          gaze,
        ).name = "Smiling lid";
      } else {
        const [rx, ry] = eyeSize(config);
        const black = new THREE.Mesh(
          eyeGeometry(config.eyes),
          new THREE.MeshPhysicalMaterial({
            color: config.eyes === "glow" ? MATERIALS.glow : "#101714",
            roughness: 0.23,
            clearcoat: 0.18,
            clearcoatRoughness: 0.28,
            emissive: config.eyes === "glow" ? MATERIALS.glow : "#000000",
            emissiveIntensity: config.eyes === "glow" ? 0.8 : 0,
            envMapIntensity: 0.28,
          }),
        );
        black.name = "Pupil";
        black.scale.set(
          rx,
          config.eyes === "mismatched" && side === 1 ? ry * 0.7 : ry,
          0.047,
        );
        gaze.add(black);
        if (config.eyes === "angry") eye.rotation.z = side * 0.19;
      }
      if (config.trinket === "eyepatch" && side === -1) eye.visible = false;
      rememberPose(eye);
    }
    if (config.brows !== "none" && config.brows !== "unibrow") {
      const brow = new THREE.Group();
      brow.name = "Brow";
      const y = config.brows === "worried" ? 0.46 : 0.43;
      brow.position.set(side * 0.29, y, 0);
      // Angry: the inner end drops. Worried: the inner end rises.
      brow.rotation.z =
        side *
        (config.brows === "angry"
          ? 0.3
          : config.brows === "worried"
            ? -0.3
            : 0.04);
      root.add(brow);
      const browFront = (x: number, dy: number) =>
        front(
          brow.position.x +
            Math.cos(brow.rotation.z) * x -
            Math.sin(brow.rotation.z) * dy,
          y + Math.sin(brow.rotation.z) * x + Math.cos(brow.rotation.z) * dy,
        );
      const line: XYZ[] = [];
      for (let i = 0; i <= 24; i++) {
        const x = (i / 24 - 0.5) * 0.22;
        const dy = Math.sin((i / 24) * Math.PI) * 0.009;
        line.push([x, dy, browFront(x, dy) - 0.002]);
      }
      add(
        sweepGeometry(
          line,
          (t) =>
            (config.brows === "heavy" ? 0.021 : 0.013) *
            Math.pow(Math.sin(t * Math.PI), 0.4),
        ),
        hairColor,
        [0, 0, 0],
        [1, 1, 1],
        brow,
      ).name = "Brow root";
      for (let i = 0; i < 14; i++) {
        const x = (i / 13 - 0.5) * 0.18;
        const z = browFront(x, 0) + 0.005;
        add(
          sweepGeometry(
            [
              [x - 0.008, -0.006, z],
              [x, 0.011, z + 0.008],
              [x + 0.013, 0.015, z],
            ],
            0.003,
            8,
            5,
          ),
          hairColor,
          [0, 0, 0],
          [1, 1, 1],
          brow,
        );
      }
      articulate(brow, "brow", side);
    }
  }
  if (config.brows === "unibrow") {
    const points: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -0.4 + (i / 40) * 0.8;
      points.push([x, 0.435 + Math.sin((i / 40) * Math.PI) * 0.015]);
    }
    faceLine(points, 0.018, hairColor).name = "Unibrow";
  }

  const jaw = new THREE.Group();
  jaw.name = "Jaw";
  root.add(jaw);
  articulate(jaw, "jaw");
  const mouth = mouthShape(config);
  const ink = "#2a2220";
  if (mouth.open) {
    const toShape = (points: [number, number][]) =>
      new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    // The head is a coarse mesh (very coarse on squircles), so its triangles can
    // sit above the ideal carved surface. Seat the cavity on whichever is higher.
    const triangles: THREE.Vector3[][] = [];
    const headIndex = bodyGeometry.getIndex()!;
    for (let i = 0; i < headIndex.count; i += 3) {
      const corners = [0, 1, 2].map((k) =>
        new THREE.Vector3().fromBufferAttribute(
          bodyPositions,
          headIndex.getX(i + k),
        ),
      );
      // Keep front triangles whose bounds overlap the mouth window.
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      if (
        corners.every((c) => c.z > 0.3) &&
        Math.min(...xs) < 0.25 &&
        Math.max(...xs) > -0.25 &&
        Math.min(...ys) < 0 &&
        Math.max(...ys) > -0.35
      )
        triangles.push(corners);
    }
    const headAt = (x: number, y: number) => {
      let z = -Infinity;
      for (const [a, b, c] of triangles) {
        const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        if (Math.abs(det) < 1e-12) continue;
        const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / det;
        const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / det;
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        z = Math.max(z, u * a.z + v * b.z + (1 - u - v) * c.z);
      }
      return z;
    };
    const floor = (x: number, y: number) => {
      const inside = -outlineDistance(mouth.outline, true, x, y);
      // Edges lift toward the lip; the middle stays recessed.
      const ideal =
        front(x, y) +
        0.012 +
        0.012 * (1 - THREE.MathUtils.smoothstep(inside, 0, 0.035));
      return Math.max(ideal, headAt(x, y) + 0.006);
    };
    // A dark cavity that deepens toward the middle, ringed by an embroidered lip.
    const cavity = add(
      facePatch(toShape(mouth.outline), floor, 0),
      "#ffffff",
      [0, 0, 0],
      [1, 1, 1],
      jaw,
      0,
      0.9,
    );
    cavity.name = "Mouth cavity";
    const cavityPositions = cavity.geometry.getAttribute("position");
    const cavityColors: number[] = [];
    const lip = new THREE.Color(MATERIALS.mouth);
    const throat = new THREE.Color("#1a0b0a");
    for (let i = 0; i < cavityPositions.count; i++) {
      const inside = -outlineDistance(
        mouth.outline,
        true,
        cavityPositions.getX(i),
        cavityPositions.getY(i),
      );
      sample
        .copy(lip)
        .lerp(throat, THREE.MathUtils.smoothstep(inside, 0, 0.05));
      cavityColors.push(sample.r, sample.g, sample.b);
    }
    cavity.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(cavityColors, 3),
    );
    cavity.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
    });
    if (mouth.tongue) {
      const tongueOutline = mouth.tongue;
      // A soft dome resting on the floor of the mouth, never a flat sticker.
      const tongue = add(
        facePatch(toShape(tongueOutline), floor, (x, y) => {
          const inside = -outlineDistance(tongueOutline, true, x, y);
          return (
            0.002 +
            0.016 * Math.sqrt(THREE.MathUtils.clamp(inside / 0.024, 0, 1))
          );
        }),
        MATERIALS.tongue,
        [0, 0, 0],
        [1, 1, 1],
        jaw,
      );
      tongue.name = "Tongue";
      tongue.material = new THREE.MeshPhysicalMaterial({
        color: MATERIALS.tongue,
        roughness: 0.45,
        clearcoat: 0.25,
        clearcoatRoughness: 0.35,
      });
    }
    add(
      sweepGeometry(
        mouth.outline.map(([x, y]) => [x, y, front(x, y) + 0.006] as XYZ),
        0.0115,
        160,
        10,
        true,
      ),
      ink,
      [0, 0, 0],
      [1, 1, 1],
      jaw,
    ).name = "Mouth rim";
  } else {
    // Embroidered stroke with round caps, raised above the groomed fur.
    const points = mouth.outline.map(
      ([x, y]) => [x, y, front(x, y) + 0.006] as XYZ,
    );
    const radius = 0.0135;
    const cap =
      radius /
      new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
      ).getLength();
    add(
      sweepGeometry(
        points,
        (t) => {
          const edge = Math.min(t, 1 - t);
          return edge >= cap
            ? radius
            : radius * Math.sqrt(1 - Math.pow((cap - edge) / cap, 2));
        },
        96,
        12,
      ),
      ink,
      [0, 0, 0],
      [1, 1, 1],
      jaw,
    ).name = "Smile";
  }
  if (config.tusks !== "none") {
    const size = {
      small: 0.19,
      medium: 0.25,
      large: 0.34,
      asymmetric: 0.26,
      chipped: 0.25,
      gilded: 0.25,
    }[config.tusks];
    for (const side of [-1, 1]) {
      // Like the 2D art, the viewer's left tusk is the one snapped off.
      const chipped = config.tusks === "chipped" && side === -1;
      const height =
        size * (config.tusks === "asymmetric" && side === 1 ? 0.65 : 1);
      const width = chipped ? 0.063 : 0.059;
      const bend = side * 0.015;
      const x = side * 0.26,
        y = -0.205;
      const tusk = add(
        toothGeometry(height, width, bend, chipped ? 0.56 : 1),
        MATERIALS.ivory,
        [x, y, front(x, y) - 0.03],
        [1, 1, 1],
        root,
      );
      tusk.name = chipped ? "Chipped tusk" : "Tusk";
      tusk.material = new THREE.MeshPhysicalMaterial({
        color: "#f4eddd",
        vertexColors: true,
        roughness: 0.34,
        clearcoat: 0.18,
        clearcoatRoughness: 0.3,
      });
      if (config.tusks === "gilded") {
        const band = add(
          tuskBandGeometry(height, width, bend, 0.3, 0.55),
          MATERIALS.gold,
          tusk.position.toArray() as XYZ,
          [1, 1, 1],
          root,
          0.85,
          0.3,
        );
        band.name = "Gold tusk band";
      }
    }
  }

  if (config.trinket === "nose-ring" || config.trinket === "nose-bone") {
    for (const side of [-1, 1]) {
      const outline = new THREE.Shape();
      outline.absellipse(
        side * 0.043,
        0.018,
        0.009,
        0.005,
        0,
        Math.PI * 2,
        false,
        0,
      );
      add(
        facePatch(outline, front, 0.001),
        new THREE.Color(coatColor).multiplyScalar(0.45).getStyle(),
        [0, 0, 0],
      ).name = "Nostril";
    }
    if (config.trinket === "nose-ring") {
      const hoop = ring([0, 0.008, front(0, 0.008) - 0.008], 0.043);
      hoop.name = "Septum hoop";
      hoop.rotation.y = 0.15;
      rememberPose(hoop);
    } else {
      const points: XYZ[] = [
        [-0.11, 0.027, front(-0.11, 0.027) + 0.006],
        [0, 0.024, front(0, 0.024) - 0.01],
        [0.11, 0.034, front(0.11, 0.034) + 0.006],
      ];
      add(
        sweepGeometry(
          points,
          (t) => 0.013 + 0.008 * Math.pow(Math.abs(t - 0.5) * 2, 3),
        ),
        MATERIALS.bone,
        [0, 0, 0],
        [1, 1, 1],
        root,
        0,
        0.45,
      ).name = "Nose bone";
    }
  }
  if (config.trinket === "eyepatch") {
    const outline = new THREE.Shape();
    outline.moveTo(-0.415, 0.36);
    outline.bezierCurveTo(-0.38, 0.43, -0.2, 0.43, -0.17, 0.36);
    outline.bezierCurveTo(-0.15, 0.23, -0.2, 0.16, -0.285, 0.15);
    outline.bezierCurveTo(-0.38, 0.15, -0.43, 0.24, -0.415, 0.36);
    const patch = add(
      facePatch(outline, front, 0.01),
      "#342925",
      [0, 0, 0],
      [1, 1, 1],
      root,
      0,
      0.82,
    );
    patch.name = "Fitted eyepatch";
    const edge = outline
      .getPoints(48)
      .map(
        (p) =>
          [
            p.x * 0.91 - 0.026,
            p.y * 0.91 + 0.025,
            front(p.x * 0.91 - 0.026, p.y * 0.91 + 0.025) + 0.014,
          ] as XYZ,
      );
    curve(edge, 0.0025, "#71574b");
    const vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const y = 0.34 + Math.cos(a) * 0.04 + side * 0.014;
        const rawY = signedPower((y + 0.06) / shape.height, 1 / shape.power);
        const radius = Math.sqrt(1 - rawY * rawY);
        const p = surface(Math.cos(a) * radius, rawY, Math.sin(a) * radius);
        vertices.push(p.x * 1.035, p.y, p.z * 1.045);
      }
      if (i < 96)
        indices.push(
          i * 2,
          i * 2 + 2,
          i * 2 + 1,
          i * 2 + 1,
          i * 2 + 2,
          i * 2 + 3,
        );
    }
    const strap = new THREE.BufferGeometry();
    strap.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    strap.setIndex(indices);
    strap.computeVertexNormals();
    const mesh = add(strap, "#342925", [0, 0, 0]);
    mesh.material.side = THREE.DoubleSide;
    mesh.name = "Eyepatch strap";
  }

  const braid = (worldPoints: XYZ[], width: number, parent = root) => {
    const anchor = new THREE.Vector3(...worldPoints[0]);
    const group = new THREE.Group();
    group.name = "Woven braid";
    group.position.copy(anchor);
    parent.add(group);
    const path = new THREE.CatmullRomCurve3(
      worldPoints.map((p) => new THREE.Vector3(...p).sub(anchor)),
    );
    const frames = path.computeFrenetFrames(96, false);
    const turns = Math.max(2, path.getLength() / (width * 3.3));
    const braidedPath = (strand: number, offset = 0) => {
      const points: XYZ[] = [];
      for (let i = 0; i <= 96; i++) {
        const t = i / 96;
        const p = path.getPointAt(t);
        const angle = t * Math.PI * 2 * turns + (strand * Math.PI * 2) / 3;
        const taper = 1 - t * 0.48;
        const spread = width * 0.7 * taper * Math.min(1, t * 12);
        // Flattened figure-eights make alternating over/under crossings.
        p.addScaledVector(
          frames.normals[i],
          Math.sin(angle) * (spread + offset),
        );
        p.addScaledVector(
          frames.binormals[i],
          Math.sin(angle * 2) * (spread * 0.48 + offset),
        );
        points.push(p.toArray() as XYZ);
      }
      return points;
    };
    for (let i = 0; i < 3; i++) {
      const color = new THREE.Color(hairColor)
        .multiplyScalar(0.85 + i * 0.1)
        .getStyle();
      add(
        sweepGeometry(
          braidedPath(i),
          (t) => width * 0.34 * (1 - t * 0.48),
          96,
          12,
        ),
        color,
        [0, 0, 0],
        [1, 1, 1],
        group,
        0,
        0.85,
      ).name = "Woven strand";
      add(
        sweepGeometry(braidedPath(i, width * 0.35), 0.0015, 96, 5),
        new THREE.Color(hairColor).multiplyScalar(1.25).getStyle(),
        [0, 0, 0],
        [1, 1, 1],
        group,
      );
    }
    const end = path.getPointAt(0.91);
    const tie = add(
      new THREE.CylinderGeometry(
        width * 0.65,
        width * 0.65,
        0.035,
        20,
        1,
        true,
      ),
      "#9c743f",
      end.toArray() as XYZ,
      [1, 1, 1],
      group,
      0.55,
      0.45,
    );
    tie.name = "Braid tie";
    tie.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      path.getTangentAt(0.91),
    );
    articulate(group, "lock");
  };
  if (config.hair === "braids") {
    for (const side of [-1, 1]) {
      const y = shape.height - 0.38;
      braid(
        [
          [side * 0.59, y, front(side * 0.59, y) - 0.014],
          [side * 0.76, 0.5, front(side * 0.76, 0.5) + 0.045],
          [side * 0.79, 0.07, front(side * 0.79, 0.07) + 0.055],
          [side * 0.73, -0.39, front(side * 0.73, -0.39) + 0.1],
        ],
        0.082,
      );
    }
  }
  if (config.beard === "braided") {
    braid(
      [
        [0, -0.27, front(0, -0.27) - 0.01],
        [0, -0.42, front(0, -0.42) + 0.052],
        [0, -0.67, front(0, -0.67) + 0.14],
      ],
      0.086,
    );
  }
  if (config.hair === "topknot") {
    const top = shape.height - 0.06;
    const bun = new THREE.Group();
    bun.name = "Coiled topknot";
    bun.position.set(shape.offset, top - 0.025, 0);
    root.add(bun);
    const points: XYZ[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const a = t * Math.PI * 7;
      const r = 0.1 * Math.sin(t * Math.PI) + 0.018;
      points.push([Math.cos(a) * r, t * 0.22, Math.sin(a) * r]);
    }
    add(
      sweepGeometry(points, 0.039, 120, 12),
      hairColor,
      [0, 0, 0],
      [1, 1, 1],
      bun,
    ).name = "Wound hair";
    const tie = add(
      new THREE.TorusGeometry(0.055, 0.008, 8, 32),
      MATERIALS.leather,
      [0, 0.035, 0],
      [1, 1, 1],
      bun,
    );
    tie.rotation.x = Math.PI / 2;
    articulate(bun, "lock");
  }

  if (config.headgear !== "none") {
    const gear = new THREE.Group();
    gear.name = "Headgear";
    root.add(gear);
    articulate(gear, "gear");
    const top = shape.height - 0.06;
    const brimY = top - 0.55;
    const rawBrim = signedPower((brimY + 0.06) / shape.height, 1 / shape.power);
    const helmet = config.headgear === "horned-helm";
    const crown = config.headgear === "spiked-crown";
    const bandana = config.headgear === "bandana";
    const shellPoint = (x: number, y: number, z: number) => {
      const point = surface(x, y, z);
      point.x *= 1.04;
      point.z *= 1.04;
      const dome = Math.max(0, (y - rawBrim) / (1 - rawBrim));
      point.y += 0.018 + dome * 0.065;
      if (config.headgear === "skull-cap") point.x -= dome * 0.065;
      return point;
    };
    const atBrim = (angle: number) => {
      const radius = Math.sqrt(1 - rawBrim * rawBrim);
      return shellPoint(
        Math.cos(angle) * radius,
        rawBrim,
        Math.sin(angle) * radius,
      );
    };
    /** Quads between neighbouring columns of points, closed around the head. */
    const columnMesh = (columns: THREE.Vector3[][], wrap: boolean) => {
      const vertices: number[] = [];
      const indices: number[] = [];
      const rows = columns[0].length;
      columns.forEach((column) =>
        column.forEach((p) => vertices.push(p.x, p.y, p.z)),
      );
      const last = wrap ? columns.length : columns.length - 1;
      for (let c = 0; c < last; c++) {
        const next = (c + 1) % columns.length;
        for (let j = 0; j < rows - 1; j++) {
          const a = c * rows + j;
          const b = next * rows + j;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    if (helmet || config.headgear === "skull-cap") {
      const band = new THREE.CylinderGeometry(1, 1, 0.12, 96, 6, true);
      const bandPositions = band.getAttribute("position");
      for (let i = 0; i < bandPositions.count; i++) {
        const a = Math.atan2(bandPositions.getZ(i), bandPositions.getX(i));
        const rawY = signedPower(
          (brimY + bandPositions.getY(i) + 0.06) / shape.height,
          1 / shape.power,
        );
        const radius = Math.sqrt(Math.max(0, 1 - rawY * rawY));
        const point = shellPoint(
          Math.cos(a) * radius,
          rawY,
          Math.sin(a) * radius,
        );
        bandPositions.setXYZ(i, point.x, point.y, point.z);
      }
      band.computeVertexNormals();
      add(
        band,
        helmet ? MATERIALS.ironDark : "#48494b",
        [0, 0, 0],
        [1, 1, 1],
        gear,
        0.65,
        0.45,
      ).name = "Headband";
      // Rolled edges make the band read as a solid piece of metal.
      for (const edge of [-1, 1]) {
        const points: XYZ[] = [];
        const rawY = signedPower(
          (brimY + edge * 0.05 + 0.06) / shape.height,
          1 / shape.power,
        );
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const radius = Math.sqrt(1 - rawY * rawY);
          const p = shellPoint(
            Math.cos(a) * radius,
            rawY,
            Math.sin(a) * radius,
          );
          points.push([p.x * 1.01, p.y, p.z * 1.01]);
        }
        curve(
          points,
          0.009,
          helmet ? MATERIALS.ironDark : "#3c3027",
          gear,
          helmet ? 0.7 : 0,
          0.4,
        ).name = "Rolled brim";
      }
      // Fit the cap to the selected body instead of intersecting flatter shapes.
      const cap = new THREE.SphereGeometry(
        1,
        48,
        24,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      const positions = cap.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        const rawY = rawBrim + (1 - rawBrim) * y;
        const radial = Math.sqrt(Math.max(0, 1 - rawY * rawY));
        const originalRadial = Math.sqrt(Math.max(0, 1 - y * y));
        const ratio = originalRadial > 0.00001 ? radial / originalRadial : 0;
        const point = shellPoint(
          positions.getX(i) * ratio,
          rawY,
          positions.getZ(i) * ratio,
        );
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      cap.computeVertexNormals();
      add(
        cap,
        helmet ? MATERIALS.iron : "#29282a",
        [0, 0, 0],
        [1, 1, 1],
        gear,
        helmet ? 0.6 : 0,
        helmet ? 0.4 : 0.98,
      ).name = helmet ? "Helmet dome" : "Felt cap";
      if (!helmet) {
        const nap = new THREE.InstancedMesh(
          strand,
          material("#29282a", 0, 1),
          5000,
        );
        nap.name = "Felt cap nap";
        const feltStart = rawBrim + 0.065 / shape.height;
        for (let i = 0; i < nap.count; i++) {
          const y = feltStart + random() * (1 - feltStart);
          const a = random() * Math.PI * 2;
          const r = Math.sqrt(1 - y * y);
          const p = shellPoint(Math.cos(a) * r, y, Math.sin(a) * r);
          normal
            .set(Math.cos(a) * r, y / shape.height, (Math.sin(a) * r) / 0.78)
            .normalize();
          tangent.set(0, -1, 0).addScaledVector(normal, normal.y).normalize();
          bitangent.crossVectors(normal, tangent).normalize();
          basis.makeBasis(bitangent, normal, tangent);
          transform.position.copy(p);
          transform.quaternion.setFromRotationMatrix(basis);
          transform.scale.set(0.002, 0.012, 0.002);
          transform.updateMatrix();
          nap.setMatrixAt(i, transform.matrix);
        }
        gear.add(nap);
      }
      const rivet = (p: THREE.Vector3) => {
        const n = new THREE.Vector3(
          p.x,
          p.y / (shape.height * shape.height),
          p.z / 0.6,
        ).normalize();
        const mesh = add(
          new THREE.CylinderGeometry(0.013, 0.014, 0.009, 20),
          helmet ? MATERIALS.ironLight : "#999da2",
          p.clone().addScaledVector(n, 0.002).toArray() as XYZ,
          [1, 1, 1],
          gear,
          0.8,
          0.42,
        );
        mesh.name = "Seated rivet";
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      };
      const arc = Math.acos(rawBrim);
      const strap: XYZ[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = arc * (1 - i / 8);
        const point = shellPoint(0, Math.cos(a), Math.sin(a));
        strap.push([point.x, point.y + 0.012, point.z * 1.02]);
      }
      // A broad strap with inset seams instead of a round cord over the cap.
      const strapVertices: number[] = [];
      const strapIndices: number[] = [];
      strap.forEach(([x, y, z], i) => {
        strapVertices.push(x - 0.046, y, z, x + 0.046, y, z);
        if (i < strap.length - 1)
          strapIndices.push(
            i * 2,
            i * 2 + 1,
            i * 2 + 2,
            i * 2 + 1,
            i * 2 + 3,
            i * 2 + 2,
          );
      });
      const strapGeometry = new THREE.BufferGeometry();
      strapGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(strapVertices, 3),
      );
      strapGeometry.setIndex(strapIndices);
      strapGeometry.computeVertexNormals();
      const strapMesh = add(
        strapGeometry,
        helmet ? MATERIALS.ironDark : "#62666a",
        [0, 0, 0],
        [1, 1, 1],
        gear,
        0.7,
        0.45,
      );
      strapMesh.name = "Cap strap";
      strapMesh.material.side = THREE.DoubleSide;
      for (const side of [-1, 1])
        curve(
          strap.map(
            ([x, y, z]) => [x + side * 0.035, y + 0.003, z * 1.003] as XYZ,
          ),
          0.003,
          "#343639",
          gear,
        );
      for (let i = 2; i <= 14; i += 3) {
        const [x, y, z] = strap[i];
        rivet(new THREE.Vector3(x, y, z));
      }
      for (let i = 0; i < 11; i++) rivet(atBrim((i / 10) * Math.PI));
      if (helmet)
        for (const side of [-1, 1]) {
          // Big ridged viking horns: out from the dome, then sweeping up.
          const rawY = rawBrim + (1 - rawBrim) * 0.2;
          const radius = Math.sqrt(1 - rawY * rawY);
          const horn = new THREE.Group();
          horn.name = "Helmet horn";
          horn.position.copy(shellPoint(side * radius, rawY, 0));
          horn.scale.x = side;
          gear.add(horn);
          const path = new THREE.CatmullRomCurve3(
            (
              [
                [-0.12, -0.03, 0],
                [0.07, -0.005, 0.02],
                [0.27, 0.04, 0.04],
                [0.43, 0.14, 0.04],
                [0.51, 0.31, 0.02],
                [0.5, 0.48, -0.01],
              ] as XYZ[]
            ).map((p) => new THREE.Vector3(...p)),
          );
          const segments = 72;
          const sides = 20;
          const ridges = 7;
          const geometry = sweepGeometry(
            path,
            (t) =>
              0.14 *
              Math.pow(1 - t, 0.7) *
              (1 +
                0.05 * Math.pow(Math.sin(t * Math.PI * ridges), 2) * (1 - t)),
            segments,
            sides,
          );
          const colors: number[] = [];
          const base = new THREE.Color("#d9c49a");
          const tip = new THREE.Color("#fbf6e9");
          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            sample
              .copy(base)
              .lerp(tip, THREE.MathUtils.smoothstep(t, 0.1, 0.9))
              .multiplyScalar(
                1 -
                  0.07 * Math.pow(Math.cos(t * Math.PI * ridges), 8) * (1 - t),
              );
            for (let j = 0; j <= sides; j++)
              colors.push(sample.r, sample.g, sample.b);
          }
          geometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(colors, 3),
          );
          const mesh = add(
            geometry,
            MATERIALS.bone,
            [0, 0, 0],
            [1, 1, 1],
            horn,
          );
          mesh.name = "Horn";
          mesh.material = new THREE.MeshPhysicalMaterial({
            color: "#ffffff",
            vertexColors: true,
            roughness: 0.42,
            clearcoat: 0.15,
            clearcoatRoughness: 0.4,
          });
          // An iron collar seats each horn in the dome.
          const collarAt = 0.16;
          const socket = add(
            new THREE.TorusGeometry(0.118, 0.034, 16, 40),
            MATERIALS.ironDark,
            path.getPointAt(collarAt).toArray() as XYZ,
            [1, 1, 1],
            horn,
            0.7,
            0.35,
          );
          socket.name = "Horn collar";
          socket.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            path.getTangentAt(collarAt),
          );
        }
    } else if (crown) {
      // A gold crown seated high on the head, like the 2D art: a zig-zag rim
      // whose centre point stands tallest, a darker band, a gem and studs.
      const raw = 0.68;
      const ring = Math.sqrt(1 - raw * raw);
      const middle = shape.offset * raw;
      const points = 10;
      const peaks = [0.42, 0.33, 0.24, 0.22, 0.27, 0.3];
      const valley = 0.13;
      const rimHeight = (s: number) => {
        const k = Math.floor(s);
        const f = s - k;
        const peak = (i: number) => {
          const n = ((i % points) + points) % points;
          return peaks[Math.min(n, points - n)];
        };
        return f < 0.5
          ? THREE.MathUtils.lerp(peak(k), valley, f * 2)
          : THREE.MathUtils.lerp(valley, peak(k + 1), (f - 0.5) * 2);
      };
      /** A point on the crown at angle a, height h, pushed out (+) or in (-). */
      const crownPoint = (a: number, h: number, out = 0) => {
        const p = surface(Math.cos(a) * ring, raw, Math.sin(a) * ring);
        const dx = p.x - middle;
        const length = Math.hypot(dx, p.z);
        const scale = (length * (1.02 + 0.2 * h) + 0.03 + out) / length;
        return new THREE.Vector3(middle + dx * scale, p.y + h, p.z * scale);
      };
      const ahead = Math.PI / 2;
      const steps = 8;
      const wall: THREE.Vector3[][] = [];
      for (let c = 0; c < points * 2 * steps; c++) {
        const s = c / (2 * steps);
        const a = ahead + (s / points) * Math.PI * 2;
        const height = rimHeight(s);
        const column: THREE.Vector3[] = [];
        const rows = 10;
        for (let j = 0; j <= rows; j++)
          column.push(crownPoint(a, (height * j) / rows));
        // Duplicated corners keep the rim and base crisp under smooth shading.
        column.push(column[rows].clone(), crownPoint(a, height, -0.018));
        column.push(column[rows + 2].clone());
        for (let j = rows; j >= 0; j--)
          column.push(crownPoint(a, (height * j) / rows, -0.018));
        column.push(column[column.length - 1].clone(), column[0].clone());
        wall.push(column);
      }
      const shell = add(
        columnMesh(wall, true),
        MATERIALS.gold,
        [0, 0, 0],
        [1, 1, 1],
        gear,
        0.75,
        0.3,
      );
      shell.name = "Crown";
      shell.material.side = THREE.DoubleSide;
      const bandColumns: THREE.Vector3[][] = [];
      for (let c = 0; c < 160; c++) {
        const a = ahead + (c / 160) * Math.PI * 2;
        const column: THREE.Vector3[] = [];
        for (let j = 0; j <= 6; j++) {
          const v = j / 6;
          const bulge = 0.011 * Math.sqrt(Math.sin(v * Math.PI));
          column.push(crownPoint(a, 0.012 + v * 0.07, bulge));
        }
        bandColumns.push(column);
      }
      add(
        columnMesh(bandColumns, true),
        MATERIALS.goldDark,
        [0, 0, 0],
        [1, 1, 1],
        gear,
        0.75,
        0.38,
      ).name = "Crown band";
      for (const h of [0.012, 0.082]) {
        const bead: XYZ[] = [];
        for (let i = 0; i <= 96; i++)
          bead.push(
            crownPoint(
              ahead + (i / 96) * Math.PI * 2,
              h,
              0.004,
            ).toArray() as XYZ,
          );
        curve(bead, 0.008, MATERIALS.gold, gear, 0.8, 0.3).name = "Crown bead";
      }
      const seat = (mesh: THREE.Mesh, a: number) => {
        const p = crownPoint(a, 0, 0);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(p.x - middle, 0, p.z).normalize(),
        );
      };
      const gem = add(
        new THREE.OctahedronGeometry(0.066, 0),
        MATERIALS.gem,
        crownPoint(ahead, 0.2, 0.012).toArray() as XYZ,
        [0.75, 1.05, 0.45],
        gear,
      );
      gem.name = "Crown gem";
      gem.material = new THREE.MeshPhysicalMaterial({
        color: MATERIALS.gem,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        flatShading: true,
      });
      seat(gem, ahead);
      const setting = add(
        new THREE.TorusGeometry(0.062, 0.008, 8, 4),
        MATERIALS.goldDark,
        crownPoint(ahead, 0.2, 0.004).toArray() as XYZ,
        [0.78, 1.08, 1],
        gear,
        0.8,
        0.3,
      );
      seat(setting, ahead);
      setting.rotateZ(Math.PI / 4);
      for (let k = 1; k < points; k++) {
        const a = ahead + (k / points) * Math.PI * 2;
        const stud = add(
          new THREE.SphereGeometry(0.03, 20, 12),
          k % 2 ? "#3FB6A8" : MATERIALS.gem,
          crownPoint(a, 0.047, 0.012).toArray() as XYZ,
          [1, 1, 0.55],
          gear,
          0,
          0.2,
        );
        stud.name = "Crown stud";
        seat(stud, a);
      }
    } else if (bandana) {
      // Printed cotton tied at the side: gathered creases, a hemmed edge,
      // polka dots, a bunched knot and two drooping, notched tails.
      const knotAngle = 0.25 * Math.PI;
      const half = 0.078;
      const middleAt = (rawY: number) => shape.offset * rawY;
      const gather = (a: number) => {
        const delta = Math.atan2(
          Math.sin(a - knotAngle),
          Math.cos(a - knotAngle),
        );
        return { delta, pull: Math.exp(-Math.abs(delta) * 1.7) };
      };
      /** Cloth surface at angle a and v ∈ [-1, 1] across the band. */
      const clothPoint = (a: number, v: number, lift = 0) => {
        const { delta, pull } = gather(a);
        const y =
          brimY +
          v * half * (1 - 0.3 * pull) +
          0.006 * Math.sin(a * 5 + v * 2) * v * v;
        const rawY = signedPower((y + 0.06) / shape.height, 1 / shape.power);
        const r = Math.sqrt(Math.max(0, 1 - rawY * rawY));
        const p = shellPoint(Math.cos(a) * r, rawY, Math.sin(a) * r);
        const crease =
          0.011 * pull * Math.sin(v * Math.PI * 2.2 + delta * 10) +
          0.0025 * Math.sin(a * 13 + v * 2.5) +
          0.004 * THREE.MathUtils.smoothstep(Math.abs(v), 0.82, 1);
        const mid = middleAt(rawY);
        const dx = p.x - mid;
        const length = Math.hypot(dx, p.z);
        const scale = (length + 0.008 + crease + lift) / length;
        return new THREE.Vector3(mid + dx * scale, p.y, p.z * scale);
      };
      const columns: THREE.Vector3[][] = [];
      for (let c = 0; c < 360; c++) {
        const a = (c / 360) * Math.PI * 2;
        const column: THREE.Vector3[] = [];
        for (let j = 0; j <= 24; j++)
          column.push(clothPoint(a, (j / 24) * 2 - 1));
        columns.push(column);
      }
      const cotton = new THREE.MeshPhysicalMaterial({
        // A shade deeper than the 2D fill: bright key light lifts cloth a lot.
        color: new THREE.Color(MATERIALS.cloth).multiplyScalar(0.8),
        roughness: 0.92,
        sheen: 0.6,
        sheenColor: new THREE.Color("#e3604a"),
        sheenRoughness: 0.55,
        side: THREE.DoubleSide,
      });
      const cloth = add(
        columnMesh(columns, true),
        MATERIALS.cloth,
        [0, 0, 0],
        [1, 1, 1],
        gear,
      );
      cloth.name = "Headband";
      cloth.material = cotton;
      // Soft rolled hems, the same cotton, so the band has a real thickness.
      for (const v of [-1, 1]) {
        const hem: XYZ[] = [];
        for (let i = 0; i <= 180; i++)
          hem.push(
            clothPoint((i / 180) * Math.PI * 2, v, -0.001).toArray() as XYZ,
          );
        const mesh = curve(hem, 0.0045, MATERIALS.cloth, gear);
        mesh.name = "Hem";
        mesh.material = cotton;
      }
      // Running stitches and printed polka dots follow the creased surface.
      const stitchParts: THREE.BufferGeometry[] = [];
      for (const v of [-0.8, 0.8])
        for (let i = 0; i < 150; i++) {
          const a = (i / 150) * Math.PI * 2;
          stitchParts.push(
            sweepGeometry(
              [
                clothPoint(a, v, 0.0012).toArray() as XYZ,
                clothPoint(a + 0.012, v, 0.0022).toArray() as XYZ,
                clothPoint(a + 0.024, v, 0.0012).toArray() as XYZ,
              ],
              0.0019,
              4,
              5,
            ),
          );
        }
      add(
        mergeGeometries(stitchParts),
        MATERIALS.clothDark,
        [0, 0, 0],
        [1, 1, 1],
        gear,
      ).name = "Stitching";
      stitchParts.forEach((part) => part.dispose());
      const dotVertices: number[] = [];
      const dotIndices: number[] = [];
      for (const [v, shift] of [
        [-0.32, 0],
        [0.36, 0.5],
      ]) {
        const reference = clothPoint(0, v);
        const around = Math.hypot(reference.x, reference.z);
        const count = Math.round((Math.PI * 2 * around) / 0.085);
        for (let k = 0; k < count; k++) {
          const a0 = ((k + shift) / count) * Math.PI * 2;
          if (Math.abs(gather(a0).delta) < 0.16) continue;
          const start = dotVertices.length / 3;
          const radius = 0.0125;
          dotVertices.push(...clothPoint(a0, v, 0.0012).toArray());
          for (let i = 0; i <= 16; i++) {
            const theta = (i / 16) * Math.PI * 2;
            dotVertices.push(
              ...clothPoint(
                a0 + (Math.cos(theta) * radius) / around,
                v + (Math.sin(theta) * radius) / half,
                0.0012,
              ).toArray(),
            );
            if (i < 16) dotIndices.push(start, start + i + 1, start + i + 2);
          }
        }
      }
      const dots = new THREE.BufferGeometry();
      dots.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(dotVertices, 3),
      );
      dots.setIndex(dotIndices);
      dots.computeVertexNormals();
      const print = add(dots, "#f7ece2", [0, 0, 0], [1, 1, 1], gear, 0, 0.9);
      print.name = "Polka dots";
      print.material.side = THREE.DoubleSide;

      // The knot: a bunched ball of fabric with folds radiating from its middle.
      const knotCenter = clothPoint(knotAngle, 0, 0.03);
      const outward = new THREE.Vector3(
        knotCenter.x - middleAt(rawBrim),
        0,
        knotCenter.z,
      ).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const back = new THREE.Vector3().crossVectors(outward, up).normalize();
      const frame = new THREE.Matrix4().makeBasis(back, up, outward);
      const knot = new THREE.SphereGeometry(1, 40, 24);
      const knotPositions = knot.getAttribute("position");
      for (let i = 0; i < knotPositions.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(knotPositions, i);
        const phi = Math.atan2(p.y, p.x);
        const fold = 1 + 0.09 * Math.sin(phi * 5) * Math.sqrt(1 - p.z * p.z);
        p.multiplyScalar(fold).multiply(new THREE.Vector3(0.075, 0.062, 0.05));
        knotPositions.setXYZ(i, p.x, p.y, p.z);
      }
      knot.computeVertexNormals();
      const knotMesh = add(
        knot,
        MATERIALS.cloth,
        knotCenter.toArray() as XYZ,
        [1, 1, 1],
        gear,
      );
      knotMesh.name = "Cloth knot";
      knotMesh.material = cotton;
      knotMesh.quaternion.setFromRotationMatrix(frame);
      /** A point resting on the fur at angle a and height y. */
      const drapePoint = (a: number, y: number, clearance: number) => {
        const rawY = signedPower((y + 0.06) / shape.height, 1 / shape.power);
        const r = Math.sqrt(Math.max(0, 1 - rawY * rawY));
        const p = surface(Math.cos(a) * r, rawY, Math.sin(a) * r);
        const mid = middleAt(rawY);
        const out = new THREE.Vector3(p.x - mid, 0, p.z).normalize();
        return { point: p.addScaledVector(out, clearance), out };
      };
      for (const side of [-1, 1]) {
        const tail = new THREE.Group();
        tail.name = "Bandana tail";
        tail.position.copy(knotCenter);
        gear.add(tail);
        // Tails fall from the knot and drape over the fur, fanning apart.
        const drop = side === 1 ? 0.3 : 0.37;
        const drift = side * 0.06 * Math.PI;
        const rows = 40;
        const across = 10;
        const spine = Array.from({ length: rows + 1 }, (_, i) => {
          const t = i / rows;
          return drapePoint(
            knotAngle + drift * t,
            knotCenter.y - 0.02 - drop * t,
            0.05 + 0.025 * t,
          );
        });
        const vertices: number[] = [];
        const indices: number[] = [];
        const direction = new THREE.Vector3();
        const width3 = new THREE.Vector3();
        for (let i = 0; i <= rows; i++) {
          const t = i / rows;
          const { point, out } = spine[i];
          direction
            .subVectors(
              spine[Math.min(i + 1, rows)].point,
              spine[Math.max(i - 1, 0)].point,
            )
            .normalize();
          width3.crossVectors(direction, out).normalize();
          const width = 0.03 + 0.032 * t;
          for (let j = 0; j <= across; j++) {
            const u = (j / across) * 2 - 1;
            // A swallowtail notch: the middle of the end is cut shorter.
            const notch = i === rows ? 0.045 * (1 - Math.abs(u)) : 0;
            const p = point
              .clone()
              .addScaledVector(width3, u * width)
              .addScaledVector(direction, -notch)
              .addScaledVector(
                out,
                0.008 *
                  Math.sin(u * Math.PI * 1.4 + t * 6 + side) *
                  Math.min(1, t * 3) +
                  0.012 * (1 - u * u) * Math.min(1, t * 4),
              )
              .sub(knotCenter);
            vertices.push(p.x, p.y, p.z);
            if (i < rows && j < across) {
              const a = i * (across + 1) + j;
              const b = a + across + 1;
              indices.push(a, a + 1, b, a + 1, b + 1, b);
            }
          }
        }
        const fabric = new THREE.BufferGeometry();
        fabric.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(vertices, 3),
        );
        fabric.setIndex(indices);
        fabric.computeVertexNormals();
        const mesh = add(fabric, MATERIALS.cloth, [0, 0, 0], [1, 1, 1], tail);
        mesh.name = "Draped cloth";
        mesh.material = cotton;
        articulate(tail, "tail", side);
      }
    }
  }
  // Pole vertices of lathed / deformed surfaces can have zero normals.
  // Give those vertices a unit normal so exported GLB normals remain valid.
  const checked = new Set<THREE.BufferGeometry>();
  const unitNormal = new THREE.Vector3();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || checked.has(object.geometry)) return;
    checked.add(object.geometry);
    const normals = object.geometry.getAttribute("normal");
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < normals.count; i++) {
      unitNormal.fromBufferAttribute(normals, i);
      if (unitNormal.lengthSq() < 0.000001)
        unitNormal.set(0, positions.getY(i) >= 0 ? 1 : -1, 0);
      unitNormal.normalize();
      normals.setXYZ(i, unitNormal.x, unitNormal.y, unitNormal.z);
    }
  });
  const usedMaterials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh)
      (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).forEach((m) => usedMaterials.add(m));
  });
  materials.forEach((m) => {
    if (!usedMaterials.has(m)) m.dispose();
  });
  return { root, eyes, pupils, parts, floor: -shape.height - 0.06 };
}

/** Shared resources are disposed once; instancing buffers are freed too. */
export function disposeAvatar(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export type AvatarModel = ReturnType<typeof buildAvatar>;

const smooth = (t: number) => {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Fast close, a tiny hold, and a softer open; no frame-dependent state. */
function blinkAt(time: number, start: number) {
  const t = time - start;
  if (t < 0 || t > 0.223) return 1;
  if (t < 0.055) return 1 - smooth(t / 0.055) * 0.94;
  if (t < 0.073) return 0.06;
  return 0.06 + smooth((t - 0.073) / 0.15) * 0.94;
}

/** Driven by elapsed active time, so pausing freezes the exact pose. */
export function animateAvatar(
  model: AvatarModel,
  config: AvatarConfig,
  time: number,
) {
  const { root, eyes, pupils, parts, floor } = model;
  const wave = Math.sin(time * 2.2);
  const moving = config.motion !== "still";
  let lift = 0;
  let stretch = 0;
  if (["breathe", "both"].includes(config.motion))
    stretch = Math.sin(time * 1.8) * 0.014;
  if (["bob", "both"].includes(config.motion)) lift = wave * 0.045;
  if (config.motion === "hop") {
    const phase = time % 2.8;
    if (phase < 0.18) stretch = -0.08 * Math.sin((phase / 0.18) * Math.PI);
    else if (phase < 0.8) {
      const flight = (phase - 0.18) / 0.62;
      lift = 0.3 * 4 * flight * (1 - flight);
      stretch = 0.055 * Math.sin(flight * Math.PI);
    } else if (phase < 1.15) {
      const landing = (phase - 0.8) / 0.35;
      stretch = -0.075 * Math.sin(landing * Math.PI * 2) * (1 - landing);
    }
  }
  root.scale.set(
    1 / Math.sqrt(1 + stretch),
    1 + stretch,
    1 / Math.sqrt(1 + stretch),
  );
  // Stretch around the base of the plush, so crouches don't push it below ground.
  root.position.set(0, floor * (1 - root.scale.y) + lift, 0);
  root.rotation.set(
    0,
    config.motion === "sway" ? wave * 0.025 : 0,
    config.motion === "sway" ? wave * 0.065 : 0,
  );

  const cycle = time % 4.7;
  const lidScales = eyes.map((eye, i) => {
    let scale = 1;
    const blink = blinkAt(cycle, 3.5 + i * 0.025);
    if (["blink", "double-blink", "drowsy"].includes(config.eyeMotion))
      scale = blink;
    if (config.eyeMotion === "double-blink")
      scale = Math.min(scale, blinkAt(cycle, 3.83 + i * 0.018));
    if (config.eyeMotion === "wink" && i === 0) scale = blinkAt(cycle, 3.5);
    if (config.eyeMotion === "squint")
      scale = 0.5 + Math.sin(time * 1.5) * 0.04;
    if (config.eyeMotion === "drowsy")
      scale *= 0.48 + Math.sin(time * 0.7) * 0.04;
    if (config.eyeMotion === "startle")
      scale = 1 + Math.max(0, Math.sin(time * 1.6)) * 0.24;
    eye.scale.y = scale;
    return scale;
  });

  const looking = ["glance", "look-around"].includes(config.eyeMotion);
  const targets =
    config.eyeMotion === "glance"
      ? [
          [-0.025, 0],
          [0, 0],
          [0.025, 0],
          [0, 0],
        ]
      : [
          [-0.023, 0.012],
          [0.018, 0.015],
          [0.025, -0.009],
          [0, 0],
        ];
  const gazePhase = time / 1.9;
  const targetIndex = Math.floor(gazePhase) % targets.length;
  const previous = targets[(targetIndex + targets.length - 1) % targets.length];
  const target = targets[targetIndex];
  const shift = smooth((gazePhase % 1) / 0.085);
  pupils.forEach((pupil) => {
    pupil.position.x = looking
      ? THREE.MathUtils.lerp(previous[0], target[0], shift)
      : 0;
    pupil.position.y = looking
      ? THREE.MathUtils.lerp(previous[1], target[1], shift)
      : 0;
    const black = pupil.getObjectByName("Pupil");
    if (black instanceof THREE.Mesh && config.eyes === "glow")
      (black.material as THREE.MeshStandardMaterial).emissiveIntensity = moving
        ? 0.8 + Math.sin(time * 1.8) * 0.15
        : 0.8;
  });

  parts.forEach(({ object, kind, side }) => {
    restorePose(object);
    const lag = moving ? Math.sin(time * 2.2 - 0.45) : 0;
    if (kind === "ear" && moving) {
      const earCycle = (time + (side === 1 ? 1.4 : 0)) % 6.8;
      const twitch =
        earCycle > 5.4 && earCycle < 5.75
          ? Math.sin(((earCycle - 5.4) / 0.35) * Math.PI * 2) * 0.075
          : 0;
      object.rotation.z += side * (lag * 0.035 + twitch);
      object.rotation.y += side * lag * 0.025;
    }
    if (kind === "gear" && moving) {
      object.position.y += lag * 0.007;
      object.rotation.z +=
        config.motion === "sway" ? -lag * 0.013 : lag * 0.005;
    }
    if (kind === "pendant" && moving) {
      object.rotation.x += Math.sin(time * 2.2 - 0.8) * 0.15;
      object.rotation.z += lag * 0.09;
    }
    if (kind === "tail" && moving) {
      object.rotation.x += Math.sin(time * 2.2 - 0.7 + side * 0.35) * 0.045;
      object.rotation.z += lag * 0.07;
    }
    if (kind === "lock" && moving) {
      object.rotation.z += lag * 0.014;
      object.rotation.x += Math.sin(time * 2.2 - 0.6) * 0.018;
    }
    if (kind === "brow") {
      const lid = lidScales[side === -1 ? 0 : 1] ?? 1;
      if (["squint", "drowsy"].includes(config.eyeMotion))
        object.position.y -= (1 - lid) * 0.035;
      if (config.eyeMotion === "startle") object.position.y += (lid - 1) * 0.17;
      if (config.eyeMotion === "wink" && side === -1)
        object.rotation.z -= (1 - lid) * 0.12;
      if (looking)
        object.rotation.z += side * (pupils[0]?.position.x ?? 0) * 0.65;
    }
  });
}
