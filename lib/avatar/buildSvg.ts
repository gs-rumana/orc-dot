import {
  ANCHORS,
  EAR_PATHS,
  MATERIALS as M,
  SHAPE_PATHS,
  VIEWBOX,
  getHairColor,
  getSkinPalette,
  type SkinPalette,
} from "@/lib/avatar/catalog";
import { normalizeConfig } from "@/lib/avatar/normalize";
import { el, group, mirror, num, transformPath } from "@/lib/avatar/svg";
import type { AvatarConfig } from "@/lib/avatar/types";

type Side = "left" | "right";
const SIDES: Side[] = ["left", "right"];

interface Ctx {
  config: AvatarConfig;
  skin: SkinPalette;
  hair: string;
}

/** Outline attributes shared by most parts for the sticker look. */
function ink(ctx: Ctx, width = 2) {
  return {
    stroke: ctx.skin.ink,
    "stroke-width": width,
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
  };
}

function line(d: string, stroke: string, width: number, extra = {}) {
  return el("path", {
    d,
    fill: "none",
    stroke,
    "stroke-width": width,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    ...extra,
  });
}

/** Mirrors left-side path data for the right side. */
function sided(d: string, side: Side): string {
  return side === "left" ? d : mirror(d);
}

// ───────────────────────────── body ─────────────────────────────

function body(ctx: Ctx): string {
  const { skin } = ctx;
  return group(
    "orc-avatar__body",
    [
      el("path", { d: SHAPE_PATHS[ctx.config.shape], fill: skin.fill, ...ink(ctx, 2.6) }),
      el("ellipse", {
        cx: 47,
        cy: 41,
        rx: 9,
        ry: 4.5,
        fill: "#FFFFFF",
        opacity: 0.22,
        transform: "rotate(-25 47 41)",
      }),
      el("ellipse", { cx: 64, cy: 90, rx: 22, ry: 13, fill: skin.muzzle }),
      el("ellipse", { cx: 35, cy: 80, rx: 5.5, ry: 3.2, fill: skin.blush, opacity: 0.5 }),
      el("ellipse", { cx: 93, cy: 80, rx: 5.5, ry: 3.2, fill: skin.blush, opacity: 0.5 }),
    ].join(""),
  );
}

// ───────────────────────────── ears ─────────────────────────────

function earring(ctx: Ctx, lobe: [number, number], side: Side): string {
  const [x, y] = side === "left" ? lobe : [128 - lobe[0], lobe[1]];
  return el(
    "g",
    { class: `orc-avatar__earring orc-avatar__earring--${side}` },
    el("circle", { cx: x, cy: y + 4.5, r: 4.2, fill: "none", stroke: ctx.skin.ink, "stroke-width": 3.6 }) +
      el("circle", { cx: x, cy: y + 4.5, r: 4.2, fill: "none", stroke: M.gold, "stroke-width": 2 }),
  );
}

function ears(ctx: Ctx): string {
  const { ears: style, trinket } = ctx.config;
  if (style === "none") return "";
  const ear = EAR_PATHS[style];
  return group(
    "orc-avatar__ears",
    SIDES.map((side) =>
      el(
        "g",
        { class: `orc-avatar__ear orc-avatar__ear--${side}` },
        el("path", { d: sided(ear.outer, side), fill: ctx.skin.fill, ...ink(ctx, 2.4) }) +
          el("path", { d: sided(ear.inner, side), fill: ctx.skin.earInner }) +
          (trinket === "earrings" ? earring(ctx, ear.lobe, side) : ""),
      ),
    ).join(""),
  );
}

// ───────────────────────────── eyes ─────────────────────────────

interface EyeParts {
  /** Static white of the eye (blinks with the lid). */
  sclera?: string;
  /** Moves with gaze. */
  pupil: string;
  /** Drawn over the pupil (e.g. heavy lids). */
  over?: string;
}

function eyeParts(ctx: Ctx, side: Side): EyeParts {
  const [cx, cy] = side === "left" ? ANCHORS.eyeLeft : ANCHORS.eyeRight;
  const m = side === "left" ? 1 : -1; // +x points toward the nose
  const local = (d: string) =>
    transformPath(d, side === "left" ? { dx: cx, dy: cy } : { mirrorX: 0, dx: cx, dy: cy });
  const inkColor = ctx.skin.ink;
  const shine = (px: number, py: number, r = 1.8) =>
    el("circle", { cx: px - r, cy: py - r * 1.2, r, fill: "#FFFFFF" }) +
    el("circle", { cx: px + r, cy: py + r * 0.9, r: r / 2, fill: "#FFFFFF", opacity: 0.85 });
  const scleraAttrs = { fill: M.sclera, stroke: inkColor, "stroke-width": 2.2, "stroke-linejoin": "round" };

  const roundEye = (r: number, pr: number): EyeParts => {
    const px = cx + m * r * 0.12;
    const py = cy + r * 0.1;
    return {
      sclera: el("circle", { cx, cy, r, ...scleraAttrs }),
      pupil: el("circle", { cx: px, cy: py, r: pr, fill: inkColor }) + shine(px, py, pr * 0.36),
    };
  };

  switch (ctx.config.eyes) {
    case "dots":
      return {
        pupil:
          el("ellipse", { cx, cy, rx: 5.2, ry: 6.2, fill: inkColor }) + shine(cx, cy, 1.8),
      };
    case "round":
      return roundEye(9.5, 5.2);
    case "almond": {
      const px = cx + m;
      return {
        sclera: el("path", { d: local("M-10 -1C-5 -9 6 -8 10 2C5 7 -6 6 -10 -1Z"), ...scleraAttrs }),
        pupil: el("circle", { cx: px, cy: cy + 0.5, r: 4.2, fill: inkColor }) + shine(px, cy + 0.5, 1.5),
      };
    }
    case "angry": {
      const px = cx + m;
      return {
        sclera: el("path", { d: local("M-10 -5L10 1C10 7 6 10 0 10C-6 10 -10 6 -10 -5Z"), ...scleraAttrs }),
        pupil: el("circle", { cx: px, cy: cy + 4, r: 4.2, fill: inkColor }) + shine(px, cy + 4, 1.5),
        over: line(local("M-11 -5.5L11 1"), inkColor, 3),
      };
    }
    case "sleepy": {
      const px = cx + m * 0.5;
      return {
        sclera: el("path", { d: local("M-10 0C-6 -2 6 -2 10 0C9 7 5 9 0 9C-5 9 -9 7 -10 0Z"), ...scleraAttrs }),
        pupil: el("circle", { cx: px, cy: cy + 4.4, r: 3.6, fill: inkColor }) + shine(px, cy + 4.4, 1.2),
        over: line(local("M-11 0C-6 -2.6 6 -2.6 11 0"), inkColor, 3),
      };
    }
    case "happy":
      return { pupil: line(local("M-8 3C-5 -5 5 -5 8 3"), inkColor, 3.4) };
    case "glow":
      return {
        sclera: el("ellipse", { cx, cy, rx: 9, ry: 8, fill: M.socket, stroke: inkColor, "stroke-width": 2 }),
        pupil:
          el("circle", { class: "orc-avatar__glow", cx, cy, r: 7.5, fill: M.glowHalo, opacity: 0.4 }) +
          el("ellipse", { cx, cy, rx: 4.4, ry: 5, fill: M.glow }) +
          el("circle", { cx: cx - 1, cy: cy - 1.2, r: 1.8, fill: "#FFF8D6" }),
      };
    case "mismatched":
      return side === "left" ? roundEye(11, 5.6) : roundEye(7, 3);
    default:
      return { pupil: "" };
  }
}

function eyes(ctx: Ctx): string {
  if (ctx.config.eyes === "none") return "";
  return group(
    "orc-avatar__eyes",
    SIDES.filter((side) => !(side === "right" && ctx.config.trinket === "eyepatch"))
      .map((side) => {
        const parts = eyeParts(ctx, side);
        return el(
          "g",
          { class: `orc-avatar__eye orc-avatar__eye--${side}` },
          (parts.sclera ?? "") +
            el("g", { class: "orc-avatar__pupil" }, parts.pupil) +
            (parts.over ?? ""),
        );
      })
      .join(""),
  );
}

// ───────────────────────────── brows ────────────────────────────

const BROW_PATHS = {
  heavy: "M37 51C42 45 52 45 58 49",
  angry: "M36 46C44 47 52 50 58 55",
  worried: "M36 52C44 51 52 48 58 44",
} as const;

function brows(ctx: Ctx): string {
  const style = ctx.config.brows;
  if (style === "none") return "";
  const color = ctx.hair;
  if (style === "unibrow") {
    return group(
      "orc-avatar__brows",
      line("M36 51C42 44 54 45 64 50C74 45 86 44 92 51", color, 5.5),
    );
  }
  return group(
    "orc-avatar__brows",
    SIDES.map((side) =>
      el(
        "g",
        { class: `orc-avatar__brow orc-avatar__brow--${side}` },
        line(sided(BROW_PATHS[style], side), color, 5),
      ),
    ).join(""),
  );
}

// ───────────────────────────── nose & mouth ─────────────────────

function nose(ctx: Ctx): string {
  return group(
    "orc-avatar__nose",
    el("path", { d: "M57 78C57 73.5 71 73.5 71 78C71 82 57 82 57 78Z", fill: ctx.skin.shade }) +
      el("ellipse", { cx: 61, cy: 78.4, rx: 1.3, ry: 1.8, fill: ctx.skin.ink }) +
      el("ellipse", { cx: 67, cy: 78.4, rx: 1.3, ry: 1.8, fill: ctx.skin.ink }),
  );
}

function mouth(ctx: Ctx): string {
  const style = ctx.config.mouth;
  const inkColor = ctx.skin.ink;
  const cls = `orc-avatar__mouth orc-avatar__mouth--${style}`;
  switch (style) {
    case "smile":
      return group(cls, line("M53 89Q64 97 75 89", inkColor, 2.8));
    case "smirk":
      return group(cls, line("M53 92Q65 94 76 86", inkColor, 2.8));
    case "grumpy":
      return group(cls, line("M54 94Q64 87 74 94", inkColor, 2.8));
    case "grin":
      return group(
        cls,
        el("path", { d: "M50 87Q64 91 78 87Q75 101 64 101Q53 101 50 87Z", fill: M.mouth, ...ink(ctx, 2.2) }) +
          el("path", { d: "M57 97Q64 93 71 97Q68 100.5 64 100.5Q60 100.5 57 97Z", fill: M.tongue }),
      );
    case "roar":
      return group(
        cls,
        el("path", { d: "M52 87Q64 83 76 87Q77 103 64 104Q51 103 52 87Z", fill: M.mouth, ...ink(ctx, 2.2) }) +
          el("path", { d: "M56 99Q64 94 72 99Q69 103.5 64 103.5Q59 103.5 56 99Z", fill: M.tongue }),
      );
  }
}

// ───────────────────────────── tusks ────────────────────────────

/** One tusk rising from the lower jaw. `dir` is -1 for left, +1 for right. */
function tuskPath(cx: number, baseY: number, w: number, h: number, curve: number, dir: number): string {
  const outer = cx + dir * (w / 2);
  const inner = cx - dir * (w / 2);
  const tipX = cx + dir * curve;
  const tipY = baseY - h;
  return (
    `M${num(outer)} ${num(baseY)}` +
    `C${num(outer)} ${num(baseY - h * 0.45)} ${num(tipX + dir * w * 0.15)} ${num(tipY + h * 0.22)} ${num(tipX)} ${num(tipY)}` +
    `C${num(tipX - dir * w * 0.3)} ${num(tipY + h * 0.3)} ${num(inner)} ${num(baseY - h * 0.5)} ${num(inner)} ${num(baseY)}Z`
  );
}

function chippedTuskPath(cx: number, baseY: number, w: number, h: number, dir: number): string {
  const outer = cx + dir * (w / 2);
  const inner = cx - dir * (w / 2);
  const top = baseY - h;
  return (
    `M${num(outer)} ${num(baseY)}` +
    `C${num(outer)} ${num(baseY - h * 0.5)} ${num(outer + dir * 0.2)} ${num(top + 3)} ${num(outer - dir * 0.8)} ${num(top)}` +
    `L${num(cx + dir * 0.5)} ${num(top + 2.2)}L${num(cx - dir * 1.5)} ${num(top - 0.8)}L${num(inner + dir * 0.6)} ${num(top + 2)}` +
    `C${num(inner)} ${num(top + 5)} ${num(inner)} ${num(baseY - h * 0.4)} ${num(inner)} ${num(baseY)}Z`
  );
}

interface TuskSpec {
  w: number;
  h: number;
  curve: number;
  chipped?: boolean;
  gilded?: boolean;
}

const TUSK_SPECS: Record<
  Exclude<AvatarConfig["tusks"], "none">,
  { left: TuskSpec; right: TuskSpec }
> = {
  small: { left: { w: 7, h: 9, curve: 1 }, right: { w: 7, h: 9, curve: 1 } },
  medium: { left: { w: 8, h: 14, curve: 2.5 }, right: { w: 8, h: 14, curve: 2.5 } },
  large: { left: { w: 9.5, h: 20, curve: 5 }, right: { w: 9.5, h: 20, curve: 5 } },
  asymmetric: { left: { w: 9.5, h: 19, curve: 5 }, right: { w: 7, h: 9, curve: 1 } },
  chipped: {
    left: { w: 8.5, h: 9, curve: 0, chipped: true },
    right: { w: 8, h: 14, curve: 2.5 },
  },
  gilded: {
    left: { w: 8.5, h: 15, curve: 3, gilded: true },
    right: { w: 8.5, h: 15, curve: 3, gilded: true },
  },
};

function tusks(ctx: Ctx): string {
  if (ctx.config.tusks === "none") return "";
  const specs = TUSK_SPECS[ctx.config.tusks];
  const baseY = ANCHORS.tuskBaseY;
  return group(
    "orc-avatar__tusks",
    SIDES.map((side) => {
      const spec = specs[side];
      const dir = side === "left" ? -1 : 1;
      const cx = side === "left" ? ANCHORS.tuskLeftX : ANCHORS.tuskRightX;
      const d = spec.chipped
        ? chippedTuskPath(cx, baseY, spec.w, spec.h, dir)
        : tuskPath(cx, baseY, spec.w, spec.h, spec.curve, dir);
      let out = el("path", { d, fill: M.ivory, ...ink(ctx, 2) });
      if (spec.gilded) {
        // Gold band around the tusk, roughly a third of the way up.
        const t = 0.38;
        const bx = cx + dir * spec.curve * t * t;
        const by = baseY - spec.h * t;
        const bw = spec.w * (1 - t * 0.55) + 2;
        out += el("rect", {
          x: bx - bw / 2,
          y: by - 1.9,
          width: bw,
          height: 3.8,
          rx: 1.6,
          fill: M.gold,
          ...ink(ctx, 1.4),
        });
      }
      return out;
    }).join(""),
  );
}

// ───────────────────────────── hair ─────────────────────────────

/** Spiky wild-hair halo behind the head. */
function manePath(): string {
  const [cx, cy] = [64, 68];
  const spikes = 13;
  const from = (200 * Math.PI) / 180;
  const to = (-20 * Math.PI) / 180;
  const pts: string[] = [];
  for (let i = 0; i <= spikes * 2; i++) {
    const a = from + ((to - from) * i) / (spikes * 2);
    const r = i % 2 === 0 ? 45 : 56 + (i % 4 === 1 ? 2 : -1);
    pts.push(`${num(cx + r * Math.cos(a))} ${num(cy - r * Math.sin(a))}`);
  }
  return `M${pts.join("L")}L84 100L44 100Z`;
}

function braid(ctx: Ctx, side: Side): string {
  const segs: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const y = 66 + i * 8;
    segs.push(
      el("ellipse", {
        cx: side === "left" ? 20 + (i % 2 ? 0.8 : -0.8) : 108 - (i % 2 ? 0.8 : -0.8),
        cy: y,
        rx: 6,
        ry: 5.2,
        fill: ctx.hair,
        ...ink(ctx, 1.8),
      }),
    );
  }
  const tassel = sided("M16 112L14 122L18 119L20 124L22 119L26 122L24 112Z", side);
  const band = side === "left" ? 15 : 103;
  return el(
    "g",
    { class: `orc-avatar__braid orc-avatar__braid--${side}` },
    el("path", { d: tassel, fill: ctx.hair, ...ink(ctx, 1.6) }) +
      segs.join("") +
      el("rect", { x: band, y: 108, width: 10, height: 5, rx: 2, fill: M.gold, ...ink(ctx, 1.4) }),
  );
}

function hairBack(ctx: Ctx): string {
  switch (ctx.config.hair) {
    case "mane":
      return group(
        "orc-avatar__hair orc-avatar__hair--back",
        el("path", { d: manePath(), fill: ctx.hair, ...ink(ctx, 2.4) }),
      );
    case "braids":
      return group(
        "orc-avatar__hair orc-avatar__hair--back",
        braid(ctx, "left") + braid(ctx, "right"),
      );
    default:
      return "";
  }
}

function hairFront(ctx: Ctx): string {
  const fill = { fill: ctx.hair, ...ink(ctx, 2.2) };
  switch (ctx.config.hair) {
    case "mohawk":
      return group(
        "orc-avatar__hair orc-avatar__hair--front",
        el("path", {
          d: "M55 40C52 33 51 26 52 17L58 24L59 10L64 20L67 6L70 19L75 10L75 23L78 16C79 26 77 33 74 40C68 37.5 61 37.5 55 40Z",
          ...fill,
        }),
      );
    case "topknot":
      return group(
        "orc-avatar__hair orc-avatar__hair--front",
        el("path", { d: "M49 34C52 24 76 24 79 34C71 30 57 30 49 34Z", ...fill }) +
          el("circle", { cx: 64, cy: 15, r: 9, ...fill }) +
          line("M58 12C61 9 67 9.5 70 14", ctx.skin.ink, 1.2, { opacity: 0.45 }) +
          el("rect", { x: 58, y: 21, width: 12, height: 5, rx: 2, fill: M.leather, ...ink(ctx, 1.4) }),
      );
    case "tufts":
      return group(
        "orc-avatar__hair orc-avatar__hair--front",
        el("path", {
          d: "M52 34C52 27 49 21 44 17C53 18 58 22 60 28C59 20 61 13 66 8C66 16 68 22 68 28C71 22 76 19 83 19C78 23 76 29 76 34C68 31 60 31 52 34Z",
          ...fill,
        }),
      );
    default:
      return "";
  }
}

// ───────────────────────────── beard ────────────────────────────

function beard(ctx: Ctx): string {
  const fill = { fill: ctx.hair, ...ink(ctx, 2.2) };
  const cls = "orc-avatar__beard";
  switch (ctx.config.beard) {
    case "goatee":
      return group(cls, el("path", { d: "M55 99C56 107 59 115 64 124C69 115 72 107 73 99C68 101.5 60 101.5 55 99Z", ...fill }));
    case "braided": {
      const segs = [116, 111, 106]
        .map((y) => el("ellipse", { cx: 64, cy: y, rx: 4.6, ry: 3.6, ...fill }))
        .join("");
      return group(
        cls,
        el("path", { d: "M51 99C55 106 73 106 77 99C71 102.5 57 102.5 51 99Z", ...fill }) +
          el("path", { d: "M60 121L58 127L62 125L64 128L66 125L70 127L68 121Z", ...fill }) +
          segs +
          el("rect", { x: 59, y: 118, width: 10, height: 4.5, rx: 2, fill: M.gold, ...ink(ctx, 1.4) }),
      );
    }
    case "full":
      return group(
        cls,
        el("path", {
          d: "M27 74C28 90 36 104 46 112L49 106L53 117L58 110L64 123L70 110L75 117L79 106L82 112C92 104 100 90 101 74C96 88 84 98 64 99C44 98 32 88 27 74Z",
          ...fill,
        }),
      );
    case "chops": {
      const chop = "M25 54C18 66 19 84 30 98L34 104L36 97L40 101L39 92L44 94C39 86 37 80 37 72L33 74L33 66L29 67Z";
      return group(cls, el("path", { d: chop, ...fill }) + el("path", { d: mirror(chop), ...fill }));
    }
    default:
      return "";
  }
}

// ───────────────────────────── markings ─────────────────────────

function markings(ctx: Ctx): string {
  const cls = "orc-avatar__markings";
  switch (ctx.config.markings) {
    case "warpaint": {
      const stripes = ["M29 73L41 76", "M28 79L40 82", "M30 85L39 87"];
      return group(
        cls,
        stripes
          .flatMap((d) => [d, mirror(d)])
          .map((d) => line(d, M.warpaint, 3, { opacity: 0.9 }))
          .join("") + line("M64 38L64 54", M.warpaint, 4, { opacity: 0.9 }),
      );
    }
    case "mask":
      return group(
        cls,
        el("path", { d: "M27 57C40 52 88 52 101 57L101 70C88 74 40 74 27 70Z", fill: "#1E1A16", opacity: 0.45 }),
      );
    case "tribal":
      return group(
        cls,
        ["M58 100L58 107", "M64 101L64 109", "M70 100L70 107", "M57 38L64 43L71 38"]
          .map((d) => line(d, ctx.skin.ink, 2.4, { opacity: 0.55 }))
          .join(""),
      );
    case "scar": {
      const stitches = ["M39.4 51.1L45.1 49", "M48.9 76.3L54.5 74.2", "M50.6 81.1L56.2 79"];
      return group(
        cls,
        line("M40 44L55 84", ctx.skin.scar, 3.2) +
          stitches.map((d) => line(d, ctx.skin.ink, 1.4, { opacity: 0.6 })).join(""),
      );
    }
    case "freckles":
      return group(
        cls,
        [
          [31, 76],
          [36, 78.5],
          [30, 81],
          [39, 75.5],
        ]
          .flatMap(([x, y]) => [
            [x, y],
            [128 - x, y],
          ])
          .map(([x, y]) => el("circle", { cx: x, cy: y, r: 1.15, fill: ctx.skin.ink, opacity: 0.4 }))
          .join(""),
      );
    default:
      return "";
  }
}

// ───────────────────────────── trinkets ─────────────────────────

function trinket(ctx: Ctx): string {
  switch (ctx.config.trinket) {
    case "nose-ring":
      return group(
        "orc-avatar__trinket orc-avatar__trinket--nose-ring",
        el("circle", { cx: 64, cy: 83.5, r: 4.2, fill: "none", stroke: ctx.skin.ink, "stroke-width": 3.6 }) +
          el("circle", { cx: 64, cy: 83.5, r: 4.2, fill: "none", stroke: M.gold, "stroke-width": 2 }),
      );
    case "nose-bone": {
      const knobs = [
        [49.5, 78.3],
        [49.5, 81.7],
        [78.5, 78.3],
        [78.5, 81.7],
      ]
        .map(([x, y]) => el("circle", { cx: x, cy: y, r: 2.4, fill: M.bone, ...ink(ctx, 1.3) }))
        .join("");
      return group(
        "orc-avatar__trinket orc-avatar__trinket--nose-bone",
        knobs + line("M50 80L78 80", ctx.skin.ink, 5.2) + line("M50 80L78 80", M.bone, 3),
      );
    }
    case "eyepatch":
      return group(
        "orc-avatar__trinket orc-avatar__trinket--eyepatch",
        line("M24 47L70 57", M.eyepatch, 2.6) +
          line("M92 67L106 71", M.eyepatch, 2.6) +
          el("path", {
            d: "M69 59C71 52 90 51 93 60C95 70 87 76 80 75.5C72 75 67 67 69 59Z",
            fill: M.eyepatch,
            ...ink(ctx, 1.6),
          }) +
          line("M74 58C78 56 84 56 88 58", "#FFFFFF", 1.2, { opacity: 0.18 }),
      );
    default:
      return "";
  }
}

// ───────────────────────────── headgear ─────────────────────────

function headgear(ctx: Ctx): string {
  const cls = `orc-avatar__headgear orc-avatar__headgear--${ctx.config.headgear}`;
  const o = (w = 2) => ink(ctx, w);
  switch (ctx.config.headgear) {
    case "horned-helm": {
      const horn = "M33 31C20 31 9 23 6 6C13 15 22 19 35 20Z";
      const ridges = ["M15 21L19 17", "M22 25L25 20"].flatMap((d) => [d, mirror(d)]);
      const rivets = [26, 40, 54, 74, 88, 102]
        .map((x) => el("circle", { cx: x, cy: 38.5, r: 1.6, fill: M.ironLight }))
        .join("");
      return group(
        cls,
        el("path", { d: horn, fill: M.bone, ...o() }) +
          el("path", { d: mirror(horn), fill: M.bone, ...o() }) +
          ridges.map((d) => line(d, ctx.skin.ink, 1.2, { opacity: 0.4 })).join("") +
          el("path", { d: "M24 38C24 20 42 10 64 10C86 10 104 20 104 38Z", fill: M.iron, ...o(2.2) }) +
          el("path", { d: "M61 11H67V36H61Z", fill: M.ironDark }) +
          line("M34 27C37 19 45 15 53 13.5", "#FFFFFF", 2, { opacity: 0.35 }) +
          el("rect", { x: 18, y: 34, width: 92, height: 9, rx: 4.5, fill: M.ironDark, ...o(2.2) }) +
          rivets,
      );
    }
    case "spiked-crown":
      return group(
        cls,
        el("path", {
          d: "M32 44L30 25L38 32L44 16L52 30L64 9L76 30L84 16L90 32L98 25L96 44Z",
          fill: M.gold,
          ...o(2.2),
        }) +
          el("path", { d: "M31 36H97L96 44H32Z", fill: M.goldDark, ...o(2) }) +
          el("path", { d: "M64 25L68 30L64 35L60 30Z", fill: M.gem, ...o(1.4) }) +
          el("circle", { cx: 44, cy: 40, r: 1.8, fill: "#3FB6A8" }) +
          el("circle", { cx: 84, cy: 40, r: 1.8, fill: "#3FB6A8" }),
      );
    case "bandana": {
      const dots = [
        [36, 41],
        [50, 36.5],
        [64, 35],
        [78, 36.5],
        [92, 41],
      ]
        .map(([x, y]) => el("circle", { cx: x, cy: y, r: 1.4, fill: "#FFFFFF", opacity: 0.75 }))
        .join("");
      return group(
        cls,
        el(
          "g",
          { class: "orc-avatar__tails" },
          el("path", { d: "M104 46C112 43 119 45 126 40C123 48 117 52 106 51Z", fill: M.clothDark, ...o(1.8) }) +
            el("path", { d: "M104 50C111 54 115 60 121 63C115 65 109 59 103 54Z", fill: M.clothDark, ...o(1.8) }),
        ) +
          el("path", { d: "M20 46C30 28 98 28 108 46L107 53C96 37 32 37 21 53Z", fill: M.cloth, ...o(2.2) }) +
          dots +
          el("circle", { cx: 104, cy: 48.5, r: 4.5, fill: M.cloth, ...o(1.8) }),
      );
    }
    case "skull-cap": {
      const horn = "M44 22C36 20 31 14 30 5C36 10 41 13 47 14Z";
      return group(
        cls,
        el("path", { d: horn, fill: M.bone, ...o(1.8) }) +
          el("path", { d: mirror(horn), fill: M.bone, ...o(1.8) }) +
          el("path", {
            d: "M42 37L45 42L48 37L51 42L54 37L57 42L60 37L63 42L66 37L69 42L72 37L75 42L78 37L81 42L84 37Z",
            fill: M.bone,
            ...o(1.4),
          }) +
          el("path", { d: "M40 38C37 20 49 8 64 8C79 8 91 20 88 38Z", fill: M.bone, ...o(2.2) }) +
          el("ellipse", { cx: 55, cy: 25, rx: 5, ry: 5.5, fill: M.socket }) +
          el("ellipse", { cx: 73, cy: 25, rx: 5, ry: 5.5, fill: M.socket }) +
          el("path", { d: "M62 31L64 35L66 31Z", fill: M.socket }) +
          line("M74 12L77 16L75 19", ctx.skin.ink, 1.1, { opacity: 0.45 }),
      );
    }
    default:
      return "";
  }
}

// ───────────────────────────── assembly ─────────────────────────

export function rootClassNames(config: AvatarConfig): string {
  const classes = ["orc-avatar"];
  if (config.motion === "breathe" || config.motion === "both") {
    classes.push("orc-avatar--breathe");
  }
  if (config.motion === "bob" || config.motion === "both") {
    classes.push("orc-avatar--bob");
  }
  if (config.motion === "sway" || config.motion === "hop") {
    classes.push(`orc-avatar--${config.motion}`);
  }
  if (config.eyes !== "none" && config.eyeMotion !== "still") {
    classes.push(`orc-avatar--eyes-${config.eyeMotion}`);
  }
  return classes.join(" ");
}

/**
 * Standalone SVG string — the single source of truth for both the studio
 * preview and export. Layer order (back → front):
 * hair-back, ears, body, face (markings, beard, eyes, brows, nose, mouth,
 * tusks, trinket), hair-front, headgear.
 */
export function buildSvg(
  input: AvatarConfig | Parameters<typeof normalizeConfig>[0],
  { size = 128 }: { size?: number } = {},
): string {
  const config = normalizeConfig(input);
  const ctx: Ctx = {
    config,
    skin: getSkinPalette(config.skin),
    hair: getHairColor(config.hairColor, config.skin),
  };

  const face = group(
    "orc-avatar__face",
    [
      markings(ctx),
      beard(ctx),
      eyes(ctx),
      brows(ctx),
      nose(ctx),
      mouth(ctx),
      tusks(ctx),
      trinket(ctx),
    ].join(""),
  );

  const rig = group(
    "orc-avatar__rig",
    [hairBack(ctx), ears(ctx), body(ctx), face, hairFront(ctx), headgear(ctx)].join(""),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="${size}" height="${size}" class="${rootClassNames(config)}" role="img" aria-label="Orc avatar">${rig}</svg>`;
}
