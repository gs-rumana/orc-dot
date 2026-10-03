/** 2D affine matrix in SVG/CSS order: [a, b, c, d, e, f]. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Applies `m` around `origin`, like CSS transform-origin: T(o)·m·T(−o). */
export function aroundOrigin(m: Matrix, [ox, oy]: [number, number]): Matrix {
  return [m[0], m[1], m[2], m[3], ox + m[4] - (m[0] * ox + m[2] * oy), oy + m[5] - (m[1] * ox + m[3] * oy)];
}

/**
 * Parses a computed CSS transform ("none" or "matrix(a, b, c, d, e, f)") or
 * an SVG transform attribute (matrix / translate / scale / rotate lists).
 */
export function parseTransform(value: string | null | undefined): Matrix {
  let out: Matrix = IDENTITY;
  if (!value || value === "none") return out;
  for (const [, fn, rawArgs] of value.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = rawArgs.split(/[\s,]+/).filter(Boolean).map(parseFloat);
    let m: Matrix;
    switch (fn) {
      case "matrix":
        m = [a[0], a[1], a[2], a[3], a[4], a[5]];
        break;
      case "translate":
        m = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
        break;
      case "scale":
        m = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
        break;
      case "rotate": {
        const r = ((a[0] ?? 0) * Math.PI) / 180;
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        m = aroundOrigin([cos, sin, -sin, cos, 0, 0], [a[1] ?? 0, a[2] ?? 0]);
        break;
      }
      default:
        throw new Error(`parseTransform: unsupported function "${fn}"`);
    }
    out = multiply(out, m);
  }
  return out;
}

/**
 * Splits a matrix into translate · rotate · scale (no skew), the form every
 * avatar keyframe takes: translate/scale/rotate in any order compose to it.
 */
export function decompose(m: Matrix): {
  translate: [number, number];
  rotate: number;
  scale: [number, number];
} {
  const [a, b, c, d, e, f] = m;
  const sx = Math.hypot(a, b);
  const sy = sx === 0 ? Math.hypot(c, d) : (a * d - b * c) / sx;
  return {
    translate: [e, f],
    rotate: (Math.atan2(b, a) * 180) / Math.PI,
    scale: [sx, sy],
  };
}
