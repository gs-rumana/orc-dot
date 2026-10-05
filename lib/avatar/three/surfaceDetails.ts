import type { AvatarConfig } from "@/lib/avatar/types";

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const fade = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function stroke(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax,
    dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

type Vec2 = [number, number];

/** 2D SVG units → face units, with the SVG mouth line (64, 89) at (0, -0.1). */
const MOUTH_SCALE = 0.0122;
const toFace = ([x, y]: Vec2): Vec2 => [
  (x - 64) * MOUTH_SCALE,
  -0.1 - (y - 89) * MOUTH_SCALE,
];

/** Quadratic Bézier runs in SVG units, sampled the way the 2D avatar draws them. */
function quadratics(start: Vec2, ...segments: [Vec2, Vec2][]) {
  const points: Vec2[] = [toFace(start)];
  let from = start;
  for (const [control, to] of segments) {
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      const u = 1 - t;
      points.push(
        toFace([
          u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
          u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
        ]),
      );
    }
    from = to;
  }
  return points;
}

/** The same outlines as the 2D mouth paths in buildSvg.ts. */
const MOUTHS: Record<
  AvatarConfig["mouth"],
  { outline: Vec2[]; open: boolean; tongue?: Vec2[] }
> = {
  smile: {
    outline: quadratics(
      [53, 89],
      [
        [64, 97],
        [75, 89],
      ],
    ),
    open: false,
  },
  smirk: {
    outline: quadratics(
      [53, 92],
      [
        [65, 94],
        [76, 86],
      ],
    ),
    open: false,
  },
  grumpy: {
    outline: quadratics(
      [54, 94],
      [
        [64, 87],
        [74, 94],
      ],
    ),
    open: false,
  },
  grin: {
    outline: quadratics(
      [50, 87],
      [
        [64, 91],
        [78, 87],
      ],
      [
        [75, 101],
        [64, 101],
      ],
      [
        [53, 101],
        [50, 87],
      ],
    ).slice(0, -1),
    tongue: quadratics(
      [57, 97],
      [
        [64, 93],
        [71, 97],
      ],
      [
        [68, 100.5],
        [64, 100.5],
      ],
      [
        [60, 100.5],
        [57, 97],
      ],
    ).slice(0, -1),
    open: true,
  },
  roar: {
    outline: quadratics(
      [52, 87],
      [
        [64, 83],
        [76, 87],
      ],
      [
        [77, 103],
        [64, 104],
      ],
      [
        [51, 103],
        [52, 87],
      ],
    ).slice(0, -1),
    tongue: quadratics(
      [56, 99],
      [
        [64, 94],
        [72, 99],
      ],
      [
        [69, 103.5],
        [64, 103.5],
      ],
      [
        [59, 103.5],
        [56, 99],
      ],
    ).slice(0, -1),
    open: true,
  },
};

export function mouthShape(config: AvatarConfig) {
  return MOUTHS[config.mouth];
}

/** Distance to a polyline, or signed distance (negative inside) to a closed one. */
export function outlineDistance(
  points: Vec2[],
  closed: boolean,
  x: number,
  y: number,
) {
  let best = Infinity;
  let inside = false;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    best = Math.min(best, stroke(x, y, ax, ay, bx, by));
    if (
      closed &&
      ay > y !== by > y &&
      x < ((bx - ax) * (y - ay)) / (by - ay) + ax
    )
      inside = !inside;
  }
  return inside ? -best : best;
}

export function mouthDistance(config: AvatarConfig, x: number, y: number) {
  // Cheap reject far from the mouth; the face is sampled ~100k times.
  if (Math.abs(x) > 0.3 || y > 0.05 || y < -0.38) return 1;
  const { outline, open } = MOUTHS[config.mouth];
  return outlineDistance(outline, open, x, y);
}

/** Embroidered features sit on fur that is groomed short around them. */
export function furTrim(config: AvatarConfig, x: number, y: number) {
  const mouth = mouthDistance(config, x, y);
  const eye = eyeDistance(config, x, y);
  return Math.min(
    0.3 + 0.7 * fade(0.012, 0.07, mouth),
    0.45 + 0.55 * fade(1.05, 1.6, eye),
  );
}

export function eyeSize(config: AvatarConfig) {
  if (config.eyes === "almond" || config.eyes === "angry")
    return [0.076, 0.065];
  if (config.eyes === "sleepy") return [0.064, 0.039];
  if (config.eyes === "round") return [0.072, 0.098];
  return [0.062, 0.102];
}

export function eyeDistance(config: AvatarConfig, x: number, y: number) {
  if (config.eyes === "none") return 10;
  const dx = Math.abs(x) - 0.29;
  const dy = y - 0.28;
  if (config.eyes === "happy") {
    const nearestX = Math.max(-0.055, Math.min(0.055, dx));
    const lidY = 0.025 * Math.cos(((nearestX / 0.055) * Math.PI) / 2);
    return Math.hypot(dx - nearestX, dy - lidY) / 0.01;
  }
  const [rx, baseRy] = eyeSize(config);
  const ry = config.eyes === "mismatched" && x > 0 ? baseRy * 0.7 : baseRy;
  const angle = config.eyes === "angry" ? 0.19 : 0;
  return Math.hypot(
    (Math.cos(angle) * dx + Math.sin(angle) * dy) / rx,
    (Math.cos(angle) * dy - Math.sin(angle) * dx) / ry,
  );
}

function browDistance(config: AvatarConfig, x: number, y: number) {
  if (config.brows === "none") return 10;
  if (config.brows === "unibrow") {
    const nearest = Math.max(-0.4, Math.min(0.4, x));
    const arch = 0.435 + 0.015 * Math.cos(((nearest / 0.4) * Math.PI) / 2);
    return Math.hypot(x - nearest, y - arch) / 0.021;
  }
  const angle =
    config.brows === "angry" ? 0.3 : config.brows === "worried" ? -0.3 : 0.04;
  const dx = Math.abs(x) - 0.29;
  const dy = y - (config.brows === "worried" ? 0.46 : 0.43);
  const localX = Math.cos(angle) * dx + Math.sin(angle) * dy;
  const localY = Math.cos(angle) * dy - Math.sin(angle) * dx;
  const nearest = Math.max(-0.11, Math.min(0.11, localX));
  const arch = 0.009 * Math.cos(((nearest / 0.11) * Math.PI) / 2);
  return (
    Math.hypot(localX - nearest, localY - arch) /
    (config.brows === "heavy" ? 0.023 : 0.016)
  );
}

/** Small anatomical recesses, carved into the coat surface itself. */
export function faceDepth(config: AvatarConfig, x: number, y: number) {
  if (Math.abs(x) > 0.75 || Math.abs(y) > 0.62) return 0;
  const eye = eyeDistance(config, x, y);
  const mouth = mouthDistance(config, x, y);
  let depth = -0.018 * Math.exp(-Math.pow(eye / 0.95, 4));
  depth -=
    config.mouth === "grin" || config.mouth === "roar"
      ? 0.034 * (1 - fade(-0.06, 0.02, mouth))
      : 0.012 * Math.exp(-Math.pow(mouth / 0.022, 2));
  if (config.tusks !== "none")
    depth +=
      0.014 *
      Math.exp(
        -Math.pow((Math.abs(x) - 0.26) / 0.095, 2) -
          Math.pow((y + 0.18) / 0.06, 2),
      );
  if (config.trinket === "nose-ring" || config.trinket === "nose-bone")
    depth +=
      0.032 *
      Math.exp(-Math.pow(x / 0.075, 2) - Math.pow((y - 0.025) / 0.05, 2));
  return depth;
}

/** Pigment masks are sampled by both the underlying skin and every fur fiber. */
export function paintWeight(config: AvatarConfig, x: number, y: number) {
  const ax = Math.abs(x);
  let distance = 10;
  let width = 0.024;
  if (config.markings === "warpaint") {
    distance = Math.min(
      stroke(ax, y, 0.42, 0.03, 0.66, -0.045),
      stroke(ax, y, 0.43, -0.067, 0.62, -0.126),
    );
  } else if (config.markings === "tribal") {
    distance = Math.min(
      stroke(ax, y, 0.48, 0.19, 0.58, -0.03),
      stroke(ax, y, 0.58, -0.03, 0.42, -0.015),
      stroke(ax, y, 0.42, -0.015, 0.51, -0.18),
    );
    width = 0.018;
  } else if (config.markings === "mask") {
    const edge = 0.075 * Math.sqrt(Math.max(0, 1 - Math.pow(ax / 0.69, 2)));
    return (
      (1 - fade(edge - 0.01, edge + 0.01, Math.abs(y - 0.28))) *
      (1 - fade(0.62, 0.7, ax))
    );
  } else if (config.markings === "scar" && x > 0) {
    distance = Math.min(
      stroke(x, y, 0.47, 0.39, 0.44, 0.13),
      stroke(x, y, 0.415, 0.27, 0.487, 0.255),
      stroke(x, y, 0.41, 0.195, 0.48, 0.18),
    );
    width = 0.008;
  } else if (config.markings === "freckles") {
    distance = Math.min(
      Math.hypot(ax - 0.44, y - 0.04),
      Math.hypot(ax - 0.51, y - 0.065),
      Math.hypot(ax - 0.56, y + 0.01),
      Math.hypot(ax - 0.49, y + 0.045),
    );
    width = 0.009;
  }
  return 1 - fade(width * 0.72, width * 1.2, distance);
}

/** Hair and beards grow out of colored roots on the same coat, never blobs. */
export function hairAt(
  config: AvatarConfig,
  ux: number,
  uy: number,
  uz: number,
  x: number,
  y: number,
  z: number,
) {
  if (config.hair === "none" && config.beard === "none") return NO_HAIR;
  let weight = 0;
  let length = 0.03;
  if (config.hair === "mohawk") {
    weight = Math.exp(-Math.pow(ux / 0.14, 4)) * fade(0.56, 0.72, uy);
    length = 0.1 + 0.13 * Math.max(0, uy);
  } else if (config.hair === "tufts") {
    weight =
      Math.max(
        ...[-0.24, 0, 0.24].map((cx) =>
          Math.exp(
            -Math.pow((ux - cx) / 0.115, 4) - Math.pow((uz - 0.12) / 0.26, 4),
          ),
        ),
      ) * fade(0.66, 0.78, uy);
    length = 0.14 + 0.05 * Math.cos(ux * 13);
  } else if (config.hair === "braids") {
    const hairline =
      0.49 + Math.exp(-Math.pow(ux / 0.3, 2)) * Math.max(0, uz) * 0.2;
    weight = fade(hairline, hairline + 0.12, uy);
    if (uz > -0.15) weight *= fade(0.014, 0.04, Math.abs(ux));
    length = 0.046;
  } else if (config.hair === "topknot") {
    weight = fade(0.68, 0.82, uy);
    length = 0.035;
  } else if (config.hair === "mane") {
    weight = fade(-0.12, 0.07, uy) * (1 - fade(0.3, 0.52, uz));
    length = 0.12 + Math.max(0, 0.15 * uy);
  }
  let beard = 0;
  if (z > 0.25) {
    if (config.beard === "goatee" || config.beard === "braided")
      beard = 1 - fade(0.75, 1.05, Math.hypot(x / 0.15, (y + 0.4) / 0.23));
    if (config.beard === "full") {
      const ax = Math.abs(x);
      const depth = clamp((-y - 0.1) / 0.75);
      const width = 0.59 * (1 - 0.62 * depth * depth);
      const upper = -0.23 + 0.2 * Math.pow(ax / 0.59, 1.6);
      const lower = -0.84 + 0.34 * Math.pow(ax / 0.59, 2);
      beard =
        (1 - fade(width - 0.08, width, ax)) *
        fade(upper + 0.02, upper - 0.07, y) *
        fade(lower - 0.035, lower + 0.07, y);
      length = 0.075 + depth * 0.06;
    }
    if (config.beard === "chops")
      beard =
        1 -
        fade(
          0.72,
          1.05,
          Math.hypot((Math.abs(x) - 0.67) / 0.13, (y + 0.13) / 0.3),
        );
  }
  if (beard > weight)
    return {
      weight: beard,
      length:
        config.beard === "braided"
          ? 0.035
          : config.beard === "full"
            ? length
            : 0.095,
    };
  return { weight, length };
}

const NO_HAIR = { weight: 0, length: 0.03 };

export function furExposed(
  config: AvatarConfig,
  x: number,
  y: number,
  z: number,
  top: number,
  crownY = top,
) {
  if (
    ["skull-cap", "horned-helm"].includes(config.headgear) &&
    y > top - 0.55 - 0.045
  )
    return false;
  if (
    config.headgear === "bandana" &&
    Math.abs(y - (top - 0.55 + 0.018)) < 0.08
  )
    return false;
  if (
    config.headgear === "spiked-crown" &&
    y > crownY - 0.015 &&
    y < crownY + 0.05
  )
    return false;
  if (z < 0.2) return true;
  if (
    config.trinket === "eyepatch" &&
    Math.hypot((x + 0.29) / 0.145, (y - 0.29) / 0.145) < 1
  )
    return false;
  if (eyeDistance(config, x, y) < 1) return false;
  if (browDistance(config, x, y) < 1) return false;
  if (
    ["nose-ring", "nose-bone"].includes(config.trinket) &&
    Math.hypot((Math.abs(x) - 0.043) / 0.014, (y - 0.018) / 0.009) < 1
  )
    return false;
  const mouth = mouthDistance(config, x, y);
  if (
    mouth < (config.mouth === "grin" || config.mouth === "roar" ? 0.024 : 0.018)
  )
    return false;
  return true;
}
