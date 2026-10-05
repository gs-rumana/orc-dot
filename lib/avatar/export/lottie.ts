import { decompose, parseTransform, type Matrix } from "@/lib/avatar/export/matrix";
import { parseSvg, resolvePath } from "@/lib/avatar/export/frames";
import type { AnimationSample, Track } from "@/lib/avatar/export/sample";

/**
 * Converts a sampled avatar into a Lottie (Bodymovin) animation: one shape
 * layer whose groups mirror the SVG's <g> tree. Every shape stays vector;
 * animated parts carry baked per-frame keyframes for position, rotation,
 * scale and opacity, so the loop matches the CSS animation exactly.
 */

type Point = [number, number];
type Json = Record<string, unknown>;

const COMP_SIZE = 512;

// ───────────────────────────── paths ─────────────────────────────

export interface Bezier {
  v: Point[];
  i: Point[];
  o: Point[];
  c: boolean;
}

/** Converts SVG path data (absolute or relative, no arcs) into Lottie beziers. */
export function pathToBeziers(d: string): Bezier[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
  const subs: Bezier[] = [];
  let sub: Bezier | null = null;
  let cur: Point = [0, 0];
  let start: Point = [0, 0];
  let lastCubic: Point | null = null;
  let lastQuad: Point | null = null;
  let cmd = "";
  let k = 0;
  const take = () => Number(tokens[k++]);
  const point = (rel: boolean): Point => {
    const x = take();
    const y = take();
    return rel ? [cur[0] + x, cur[1] + y] : [x, y];
  };
  const lineTo = (p: Point) => {
    sub!.v.push(p);
    sub!.i.push([0, 0]);
    sub!.o.push([0, 0]);
    cur = p;
  };
  const cubicTo = (c1: Point, c2: Point, p: Point) => {
    const last = sub!.o.length - 1;
    sub!.o[last] = [c1[0] - cur[0], c1[1] - cur[1]];
    sub!.v.push(p);
    sub!.i.push([c2[0] - p[0], c2[1] - p[1]]);
    sub!.o.push([0, 0]);
    cur = p;
  };

  while (k < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[k])) cmd = tokens[k++];
    const rel = cmd === cmd.toLowerCase();
    const op = cmd.toUpperCase();
    let cubicCtrl: Point | null = null;
    let quadCtrl: Point | null = null;

    switch (op) {
      case "M": {
        const p = point(rel);
        sub = { v: [p], i: [[0, 0]], o: [[0, 0]], c: false };
        subs.push(sub);
        cur = start = p;
        cmd = rel ? "l" : "L"; // further pairs are implicit line-tos
        break;
      }
      case "L":
        lineTo(point(rel));
        break;
      case "H":
        lineTo([take() + (rel ? cur[0] : 0), cur[1]]);
        break;
      case "V":
        lineTo([cur[0], take() + (rel ? cur[1] : 0)]);
        break;
      case "C": {
        const c1 = point(rel);
        const c2 = point(rel);
        const p = point(rel);
        cubicTo(c1, c2, p);
        cubicCtrl = c2;
        break;
      }
      case "S": {
        const c1: Point = lastCubic ? [2 * cur[0] - lastCubic[0], 2 * cur[1] - lastCubic[1]] : cur;
        const c2 = point(rel);
        const p = point(rel);
        cubicTo(c1, c2, p);
        cubicCtrl = c2;
        break;
      }
      case "Q":
      case "T": {
        const q: Point =
          op === "Q"
            ? point(rel)
            : lastQuad
              ? [2 * cur[0] - lastQuad[0], 2 * cur[1] - lastQuad[1]]
              : cur;
        const from = cur;
        const p = point(rel);
        cubicTo(
          [from[0] + ((q[0] - from[0]) * 2) / 3, from[1] + ((q[1] - from[1]) * 2) / 3],
          [p[0] + ((q[0] - p[0]) * 2) / 3, p[1] + ((q[1] - p[1]) * 2) / 3],
          p,
        );
        quadCtrl = q;
        break;
      }
      case "Z": {
        const s = sub!;
        s.c = true;
        const n = s.v.length - 1;
        // A closing point that repeats the start becomes the start's in-tangent.
        if (n > 0 && Math.hypot(s.v[n][0] - s.v[0][0], s.v[n][1] - s.v[0][1]) < 1e-6) {
          s.i[0] = s.i[n];
          s.v.pop();
          s.i.pop();
          s.o.pop();
        }
        cur = start;
        break;
      }
      default:
        throw new Error(`pathToBeziers: unsupported command "${cmd}"`);
    }
    lastCubic = cubicCtrl;
    lastQuad = quadCtrl;
  }
  return subs;
}

// ───────────────────────────── values ────────────────────────────

const round = (v: number, p = 1e3) => Math.round(v * p) / p;

/** Hex colour → Lottie RGBA in 0–1. */
export function color(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => round(parseInt(full.slice(i, i + 2), 16) / 255, 1e4)).concat(1) as [
    number,
    number,
    number,
    number,
  ];
}

const fixed = (k: unknown) => ({ a: 0, k });

/**
 * Animated property from per-frame values (one per frame, looping). Frames
 * that sit on a straight line between their neighbours are dropped.
 */
export function animated(frames: number[][], eps: number, scalar = false): Json {
  const values = [...frames, frames[0]].map((v) => v.map((x) => round(x)));
  const same = (a: number[], b: number[]) => a.every((x, j) => Math.abs(x - b[j]) <= eps);
  if (values.every((v) => same(v, values[0]))) return fixed(scalar ? values[0][0] : values[0]);

  const keep = [0];
  let anchor = 0;
  for (let b = 2; b < values.length; b++) {
    for (let j = anchor + 1; j < b; j++) {
      const t = (j - anchor) / (b - anchor);
      const lerp = values[anchor].map((x, d) => x + (values[b][d] - x) * t);
      if (!same(values[j], lerp)) {
        keep.push(b - 1);
        anchor = b - 1;
        break;
      }
    }
  }
  keep.push(values.length - 1);

  const linear = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };
  return {
    a: 1,
    k: keep.map((t, n) => (n < keep.length - 1 ? { t, s: values[t], ...linear } : { t, s: values[t] })),
  };
}

// ───────────────────────────── shapes ────────────────────────────

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineCap: string;
  lineJoin: string;
  fillOpacity: number;
  strokeOpacity: number;
}

const DEFAULT_PAINT: Paint = {
  fill: "#000000",
  stroke: "none",
  strokeWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  fillOpacity: 1,
  strokeOpacity: 1,
};

function paintOf(el: Element, inherited: Paint): Paint {
  const attr = (name: string) => el.getAttribute(name);
  return {
    fill: attr("fill") ?? inherited.fill,
    stroke: attr("stroke") ?? inherited.stroke,
    strokeWidth: Number(attr("stroke-width") ?? inherited.strokeWidth),
    lineCap: attr("stroke-linecap") ?? inherited.lineCap,
    lineJoin: attr("stroke-linejoin") ?? inherited.lineJoin,
    fillOpacity: Number(attr("fill-opacity") ?? inherited.fillOpacity),
    strokeOpacity: Number(attr("stroke-opacity") ?? inherited.strokeOpacity),
  };
}

const LINE_CAP: Record<string, number> = { butt: 1, round: 2, square: 3 };
const LINE_JOIN: Record<string, number> = { miter: 1, round: 2, bevel: 3 };

function geometry(el: Element): Json[] {
  const n = (name: string) => Number(el.getAttribute(name) ?? 0);
  switch (el.tagName) {
    case "path":
      return pathToBeziers(el.getAttribute("d") ?? "").map((b) => ({
        ty: "sh",
        d: 1,
        ks: fixed({ c: b.c, v: b.v.map(pt), i: b.i.map(pt), o: b.o.map(pt) }),
      }));
    case "circle":
      return [{ ty: "el", d: 1, p: fixed([n("cx"), n("cy")]), s: fixed([2 * n("r"), 2 * n("r")]) }];
    case "ellipse":
      return [{ ty: "el", d: 1, p: fixed([n("cx"), n("cy")]), s: fixed([2 * n("rx"), 2 * n("ry")]) }];
    case "rect":
      return [
        {
          ty: "rc",
          d: 1,
          p: fixed([n("x") + n("width") / 2, n("y") + n("height") / 2]),
          s: fixed([n("width"), n("height")]),
          r: fixed(n("rx") || n("ry")),
        },
      ];
    default:
      return [];
  }
}

const pt = ([x, y]: Point): Point => [round(x), round(y)];

function styles(paint: Paint): Json[] {
  const out: Json[] = [];
  // Earlier items draw on top in Lottie, so the stroke goes before the fill.
  if (paint.stroke !== "none") {
    out.push({
      ty: "st",
      c: fixed(color(paint.stroke)),
      o: fixed(paint.strokeOpacity * 100),
      w: fixed(paint.strokeWidth),
      lc: LINE_CAP[paint.lineCap] ?? 1,
      lj: LINE_JOIN[paint.lineJoin] ?? 1,
      ml: 4,
    });
  }
  if (paint.fill !== "none") {
    out.push({ ty: "fl", c: fixed(color(paint.fill)), o: fixed(paint.fillOpacity * 100), r: 1 });
  }
  return out;
}

function groupTransform(el: Element, track: Track | undefined, frameCount: number): Json {
  let anchor: Json = fixed([0, 0]);
  let position: Json;
  let rotation: Json;
  let scale: Json;

  if (track?.transforms) {
    const parts = track.transforms.slice(0, frameCount).map(decompose);
    const [ox, oy] = track.origin;
    anchor = fixed([ox, oy]);
    position = animated(parts.map((p) => [ox + p.translate[0], oy + p.translate[1]]), 0.005);
    rotation = animated(parts.map((p) => [p.rotate]), 0.02, true);
    scale = animated(parts.map((p) => [p.scale[0] * 100, p.scale[1] * 100]), 0.02);
  } else {
    const m: Matrix = parseTransform(el.getAttribute("transform"));
    const p = decompose(m);
    position = fixed([round(p.translate[0]), round(p.translate[1])]);
    rotation = fixed(round(p.rotate));
    scale = fixed([round(p.scale[0] * 100), round(p.scale[1] * 100)]);
  }

  const opacity = track?.opacity
    ? animated(track.opacity.slice(0, frameCount).map((o) => [o * 100]), 0.1, true)
    : fixed(Number(el.getAttribute("opacity") ?? 1) * 100);

  return { ty: "tr", a: anchor, p: position, r: rotation, s: scale, o: opacity, sk: fixed(0), sa: fixed(0) };
}

function convert(
  el: Element,
  inherited: Paint,
  tracks: Map<Element, Track>,
  frameCount: number,
): Json | null {
  const paint = paintOf(el, inherited);
  let items: Json[];
  if (el.tagName === "g" || el.tagName === "svg") {
    // SVG paints later children on top; Lottie paints earlier items on top.
    items = [...el.children]
      .map((child) => convert(child, paint, tracks, frameCount))
      .filter((item): item is Json => item !== null)
      .reverse();
  } else {
    const shapes = geometry(el);
    items = shapes.length ? [...shapes, ...styles(paint)] : [];
  }
  if (!items.length) return null;
  return {
    ty: "gr",
    nm: el.getAttribute("class") ?? el.tagName,
    it: [...items, groupTransform(el, tracks.get(el), frameCount)],
  };
}

export function buildLottie(sample: AnimationSample, { name = "Orc Dot avatar" } = {}): Json {
  const svg = parseSvg(sample.svg);
  const tracks = new Map(sample.tracks.map((t) => [resolvePath(svg, t.path), t]));
  const root = convert(svg, DEFAULT_PAINT, tracks, sample.frameCount);
  const [vx, vy, size] = sample.viewBox;
  const zoom = (COMP_SIZE / size) * 100;
  const frames = Math.max(1, sample.frameCount);

  return {
    v: "5.7.4",
    nm: name,
    fr: sample.fps,
    ip: 0,
    op: frames,
    w: COMP_SIZE,
    h: COMP_SIZE,
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "orc",
        sr: 1,
        ks: {
          o: fixed(100),
          r: fixed(0),
          p: fixed([0, 0, 0]),
          a: fixed([vx, vy, 0]),
          s: fixed([zoom, zoom, 100]),
        },
        ao: 0,
        shapes: root ? [root] : [],
        ip: 0,
        op: frames,
        st: 0,
        bm: 0,
      },
    ],
  };
}
