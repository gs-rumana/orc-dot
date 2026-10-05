import * as THREE from "three";
import type { AvatarConfig } from "@/lib/avatar/types";

export type Point = [number, number, number];

/**
 * Closed, tapered volume along a curve. End caps have no visible flat foot.
 * A `loop` sweep joins back onto itself, like a rim around an opening.
 */
export function sweepGeometry(
  path: THREE.Curve<THREE.Vector3> | Point[],
  radius: number | ((t: number) => number),
  segments = 48,
  sides = 12,
  loop = false,
) {
  const curve = Array.isArray(path)
    ? new THREE.CatmullRomCurve3(
        path.map((p) => new THREE.Vector3(...p)),
        loop,
      )
    : path;
  const frames = curve.computeFrenetFrames(segments, loop);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r =
      (typeof radius === "number" ? radius : radius(t)) *
      (!loop && (i === 0 || i === segments) ? 0 : 1);
    const center = curve.getPointAt(t);
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const p = center
        .clone()
        .addScaledVector(frames.normals[i], Math.cos(angle) * r)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * r);
      positions.push(p.x, p.y, p.z);
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j;
        const b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Project an outline onto the same curved face as the fur. */
export function facePatch(
  outline: THREE.Shape,
  front: (x: number, y: number) => number,
  depth: number | ((x: number, y: number) => number),
) {
  const lift = typeof depth === "number" ? () => depth : depth;
  // Boundary-only triangles bridge over the curved face. Subdivide their
  // interiors before projection so patches also follow recesses and bulges.
  const flat = new THREE.ShapeGeometry(outline, 48);
  const p = flat.getAttribute("position");
  const index = flat.getIndex()!;
  const positions: number[] = [];
  const project = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) => {
    if (Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) > 0.025) {
      const ab = a.clone().add(b).multiplyScalar(0.5);
      const bc = b.clone().add(c).multiplyScalar(0.5);
      const ca = c.clone().add(a).multiplyScalar(0.5);
      project(a, ab, ca);
      project(ab, b, bc);
      project(ca, bc, c);
      project(ab, bc, ca);
    } else {
      for (const v of [a, b, c])
        positions.push(v.x, v.y, front(v.x, v.y) + lift(v.x, v.y));
    }
  };
  for (let i = 0; i < index.count; i += 3) {
    const vertices = [0, 1, 2].map((j) => {
      const n = index.getX(i + j);
      return new THREE.Vector2(p.getX(n), p.getY(n));
    });
    project(vertices[0], vertices[1], vertices[2]);
  }
  flat.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** One continuous concave ear, with a fleshy back and a folded rim. */
export function earPoint(
  style: AvatarConfig["ears"],
  t: number,
  u: number,
  back = false,
) {
  const long = style === "long";
  const envelope = Math.max(0, Math.sin(t * Math.PI));
  const width =
    (long ? 0.19 : 0.17) * Math.pow(envelope, 0.65) * (1 - 0.35 * t);
  const notch =
    style === "notched" && u > 0.6
      ? Math.exp(-Math.pow((t - 0.72) / 0.07, 2)) * 0.035 * ((u - 0.6) / 0.4)
      : 0;
  const droopy = style === "droopy";
  const reach = droopy ? 0.37 : long ? 0.22 : 0.15;
  const y = droopy
    ? 0.14 * Math.sin(t * Math.PI) - 0.17 * t * t
    : t * (long ? 0.51 : 0.4);
  const dy = droopy
    ? 0.14 * Math.PI * Math.cos(t * Math.PI) - 0.34 * t
    : long
      ? 0.51
      : 0.4;
  const tangentLength = Math.hypot(reach, dy);
  const cross = Math.max(0, 1 - u * u);
  // A rounded fleshy rim rolls inward into the cup; both sides meet at the edge.
  const z =
    0.15 +
    envelope *
      (back
        ? -0.105 * Math.sqrt(cross)
        : 0.075 * Math.sqrt(cross) - 0.115 * Math.pow(cross, 3));
  const across = u * width - notch;
  return new THREE.Vector3(
    t * reach - (across * dy) / tangentLength,
    y + (across * reach) / tangentLength,
    z,
  );
}

export function earGeometry(style: AvatarConfig["ears"]) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const rows = 36;
  const columns = 20;
  const stride = columns + 1;
  const layer = (rows + 1) * stride;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      for (let j = 0; j <= columns; j++) {
        const u = (j / columns) * 2 - 1;
        const p = earPoint(style, t, u, side === 1);
        positions.push(p.x, p.y, p.z);
        const shade =
          side === 1
            ? 0.96
            : 1 - Math.pow(1 - u * u, 3) * Math.sin(t * Math.PI) * 0.48;
        colors.push(shade, shade, shade);
        if (i < rows && j < columns) {
          const a = side * layer + i * stride + j;
          const b = a + stride;
          if (side === 0) indices.push(a, b, a + 1, a + 1, b, b + 1);
          else indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A shaped dark lens: the almond comes from its outline, without a lid stroke. */
export function eyeGeometry(style: AvatarConfig["eyes"]) {
  const geometry = new THREE.SphereGeometry(1, 40, 28);
  if (style === "almond" || style === "angry") {
    const p = geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setY(i, p.getY(i) * Math.pow(Math.max(0, 1 - x * x), 0.35));
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}
