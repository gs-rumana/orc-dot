import { ANCHORS } from "@/lib/avatar/catalog";
import { normalizeConfig } from "@/lib/avatar/normalize";
import type { AvatarConfig, AvatarEyeMotion, AvatarMotion } from "@/lib/avatar/types";

const [PX, PY] = ANCHORS.pivot;
const [LX, LY] = ANCHORS.eyeLeft;
const [RX, RY] = ANCHORS.eyeRight;

/**
 * Every animated part pivots around a fixed point in viewBox units
 * (`transform-box: view-box`), so pivots stay put while other layers move.
 */
const BASE = `.orc-avatar {
  display: inline-block;
  overflow: visible;
}
.orc-avatar * {
  transform-box: view-box;
}
.orc-avatar__rig {
  transform-origin: ${PX}px ${PY}px;
}
.orc-avatar__eye--left,
.orc-avatar__eye--left .orc-avatar__pupil {
  transform-origin: ${LX}px ${LY}px;
}
.orc-avatar__eye--right,
.orc-avatar__eye--right .orc-avatar__pupil {
  transform-origin: ${RX}px ${RY}px;
}
`;

// ─────────────────────────── body motion ───────────────────────────
// Each motion animates the rig, then the face and headgear replay a tiny
// offset a beat later (follow-through) so features settle after the head.

interface MotionSpec {
  /** Root modifier selector. */
  selector: string;
  duration: string;
  rig: string;
  face: string;
}

const MOTIONS: Record<Exclude<AvatarMotion, "still">, MotionSpec> = {
  breathe: {
    selector: ".orc-avatar--breathe",
    duration: "4.4s",
    // Quicker inhale, a short hold, then a slow exhale.
    rig: `@keyframes orc-avatar-breathe {
  0%, 100% { transform: scale(1, 1); animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1); }
  38% { transform: scale(0.988, 1.032); }
  52% { transform: scale(0.99, 1.03); animation-timing-function: cubic-bezier(0.45, 0, 0.7, 1); }
}`,
    face: `@keyframes orc-avatar-breathe-face {
  0%, 100% { transform: translateY(0); }
  45% { transform: translateY(-0.6px); }
}`,
  },
  bob: {
    selector: ".orc-avatar--bob",
    duration: "3.4s",
    // Float with a soft squash at the low point.
    rig: `@keyframes orc-avatar-bob {
  0%, 100% { transform: translateY(0) scale(1.012, 0.988); animation-timing-function: cubic-bezier(0.33, 0, 0.67, 1); }
  50% { transform: translateY(-4px) scale(0.995, 1.008); animation-timing-function: cubic-bezier(0.33, 0, 0.67, 1); }
}`,
    face: `@keyframes orc-avatar-bob-face {
  0%, 100% { transform: translateY(-0.5px); }
  50% { transform: translateY(0.8px); }
}`,
  },
  both: {
    selector: ".orc-avatar--breathe.orc-avatar--bob",
    duration: "4s",
    rig: `@keyframes orc-avatar-breathe-bob {
  0%, 100% { transform: translateY(0) scale(1.01, 0.99); animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1); }
  42% { transform: translateY(-3.5px) scale(0.988, 1.03); }
  58% { transform: translateY(-3px) scale(0.99, 1.025); animation-timing-function: cubic-bezier(0.45, 0, 0.65, 1); }
}`,
    face: `@keyframes orc-avatar-breathe-bob-face {
  0%, 100% { transform: translateY(-0.4px); }
  50% { transform: translateY(0.8px); }
}`,
  },
  sway: {
    selector: ".orc-avatar--sway",
    duration: "5.2s",
    // Pendulum: accelerate into the centre, ease out at the extremes.
    rig: `@keyframes orc-avatar-sway {
  0%, 100% { transform: rotate(-2.5deg); animation-timing-function: cubic-bezier(0.5, 0, 1, 0.6); }
  25% { transform: rotate(0deg) translateY(0.6px); animation-timing-function: cubic-bezier(0, 0.4, 0.5, 1); }
  50% { transform: rotate(2.5deg); animation-timing-function: cubic-bezier(0.5, 0, 1, 0.6); }
  75% { transform: rotate(0deg) translateY(0.6px); animation-timing-function: cubic-bezier(0, 0.4, 0.5, 1); }
}`,
    face: `@keyframes orc-avatar-sway-face {
  0%, 100% { transform: translateX(0.6px); }
  50% { transform: translateX(-0.6px); }
}`,
  },
  hop: {
    selector: ".orc-avatar--hop",
    duration: "2.6s",
    // Anticipation → stretch on take-off → hang → stretch on fall → squash → settle.
    rig: `@keyframes orc-avatar-hop {
  0% { transform: translateY(0) scale(1, 1); animation-timing-function: ease-in-out; }
  12% { transform: translateY(0) scale(1.07, 0.92); animation-timing-function: cubic-bezier(0.2, 0.6, 0.4, 1); }
  22% { transform: translateY(-8px) scale(0.95, 1.06); animation-timing-function: ease-out; }
  31% { transform: translateY(-11px) scale(1, 1); animation-timing-function: ease-in; }
  41% { transform: translateY(-4px) scale(0.96, 1.05); animation-timing-function: cubic-bezier(0.5, 0, 1, 1); }
  47% { transform: translateY(0) scale(1.08, 0.91); animation-timing-function: ease-out; }
  57% { transform: translateY(0) scale(0.98, 1.02); animation-timing-function: ease-in-out; }
  66%, 100% { transform: translateY(0) scale(1, 1); }
}`,
    face: `@keyframes orc-avatar-hop-face {
  0%, 10%, 66%, 100% { transform: translateY(0); }
  14% { transform: translateY(1px); }
  31% { transform: translateY(-1px); }
  49% { transform: translateY(1.4px); }
  58% { transform: translateY(-0.4px); }
}`,
  },
};

function motionCss(motion: Exclude<AvatarMotion, "still">): string {
  const spec = MOTIONS[motion];
  const rigName = /@keyframes ([\w-]+)/.exec(spec.rig)![1];
  const faceName = /@keyframes ([\w-]+)/.exec(spec.face)![1];
  return `${spec.rig}
${spec.face}
${spec.selector} {
  --orc-cycle: ${spec.duration};
}
${spec.selector} .orc-avatar__rig {
  animation: ${rigName} ${spec.duration} infinite;
}
${spec.selector} .orc-avatar__face {
  animation: ${faceName} ${spec.duration} ease-in-out 0.14s infinite;
}
${spec.selector} .orc-avatar__headgear {
  animation: ${faceName} ${spec.duration} ease-in-out 0.26s infinite;
}
`;
}

// ───────────────────── secondary (always-alive) motion ─────────────────────

/** Ears twitch on their own irregular clocks; dangly bits swing with the body. */
const EAR_TWITCH = `@keyframes orc-avatar-ear-left {
  0%, 76%, 100% { transform: rotate(0deg); }
  78% { transform: rotate(-9deg); }
  80.5% { transform: rotate(3deg); }
  83% { transform: rotate(-4deg); }
  86% { transform: rotate(0.5deg); }
  89% { transform: rotate(0deg); }
}
@keyframes orc-avatar-ear-right {
  0%, 40%, 100% { transform: rotate(0deg); }
  42% { transform: rotate(8deg); }
  44.5% { transform: rotate(-3deg); }
  47% { transform: rotate(0deg); }
}
.orc-avatar__ear--left {
  transform-origin: 28px 63px;
  animation: orc-avatar-ear-left 6.8s ease-in-out infinite;
}
.orc-avatar__ear--right {
  transform-origin: 100px 63px;
  animation: orc-avatar-ear-right 8.6s ease-in-out 1.3s infinite;
}
`;

const SWING = `@keyframes orc-avatar-swing {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg); }
}
@keyframes orc-avatar-jiggle {
  0%, 100% { transform: rotate(-1.6deg); }
  50% { transform: rotate(1.6deg); }
}
`;

function swing(selector: string, origin: string, delay: string, name = "orc-avatar-swing") {
  return `${selector} {
  transform-origin: ${origin};
  animation: ${name} var(--orc-cycle, 4s) ease-in-out ${delay} infinite;
}
`;
}

const TAIL_FLUTTER = `@keyframes orc-avatar-flutter {
  0%, 100% { transform: rotate(0deg) scale(1, 1); }
  25% { transform: rotate(-7deg) scale(0.96, 1.04); }
  50% { transform: rotate(3deg) scale(1.03, 0.97); }
  75% { transform: rotate(-4deg) scale(1, 1); }
}
.orc-avatar__tails {
  transform-origin: 104px 49px;
  animation: orc-avatar-flutter 1.9s ease-in-out infinite;
}
`;

const ROAR_CHOMP = `@keyframes orc-avatar-chomp {
  0%, 58%, 100% { transform: scaleY(1); }
  66% { transform: scaleY(0.72); }
  74% { transform: scaleY(1.06); }
  80% { transform: scaleY(1); }
}
.orc-avatar__mouth--roar {
  transform-origin: 64px 87px;
  animation: orc-avatar-chomp 3.2s ease-in-out infinite;
}
`;

function secondaryCss(config: AvatarConfig): string {
  const out: string[] = [];
  if (config.ears !== "none") out.push(EAR_TWITCH);

  const swings: string[] = [];
  if (config.hair === "mohawk" || config.hair === "topknot" || config.hair === "tufts") {
    swings.push(swing(".orc-avatar__hair--front", "64px 38px", "0.22s", "orc-avatar-jiggle"));
  }
  if (config.hair === "braids") {
    swings.push(swing(".orc-avatar__braid--left", "20px 60px", "0.3s", "orc-avatar-jiggle"));
    swings.push(swing(".orc-avatar__braid--right", "108px 60px", "0.4s", "orc-avatar-jiggle"));
  }
  if (config.beard === "goatee" || config.beard === "braided") {
    swings.push(swing(".orc-avatar__beard", "64px 100px", "0.3s", "orc-avatar-jiggle"));
  }
  if (config.trinket === "nose-ring") {
    swings.push(swing(".orc-avatar__trinket--nose-ring", "64px 79.5px", "0.2s"));
  }
  if (config.trinket === "earrings" && config.ears !== "none") {
    // Lobe position varies by ear style, so pivot on the ring's own top edge.
    // Extra specificity keeps it ahead of `.orc-avatar *` when several
    // avatars' snippets share a page.
    swings.push(
      `.orc-avatar .orc-avatar__earring { transform-box: fill-box; }\n` +
        swing(".orc-avatar__earring", "50% 0", "0.25s"),
    );
  }
  if (swings.length) out.push(SWING, ...swings);

  if (config.headgear === "bandana") out.push(TAIL_FLUTTER);
  if (config.mouth === "roar") out.push(ROAR_CHOMP);
  return out.join("\n");
}

// ─────────────────────────── eye motion ───────────────────────────
// Blinks close fast (~80ms) and open a touch slower (~130ms), like real lids.

interface EyeMotionSpec {
  duration: string;
  keyframes: string;
  /** Rules appended under the eye-motion root modifier. */
  rules: (sel: string) => string;
}

const EYE_MOTIONS: Record<Exclude<AvatarEyeMotion, "still">, EyeMotionSpec> = {
  blink: {
    duration: "7.2s",
    keyframes: `@keyframes orc-avatar-blink {
  0%, 30%, 33.4%, 82%, 85.4%, 100% { transform: scaleY(1); }
  31.2%, 31.6%, 83.2%, 83.6% { transform: scaleY(0.08); }
}`,
    rules: (sel) => `${sel} .orc-avatar__eye { animation: orc-avatar-blink 7.2s infinite; }`,
  },
  "double-blink": {
    duration: "6.4s",
    keyframes: `@keyframes orc-avatar-double-blink {
  0%, 58%, 60.8%, 62.4%, 65.2%, 100% { transform: scaleY(1); }
  59.3%, 59.6%, 63.7%, 64% { transform: scaleY(0.08); }
}`,
    rules: (sel) => `${sel} .orc-avatar__eye { animation: orc-avatar-double-blink 6.4s infinite; }`,
  },
  wink: {
    duration: "6s",
    keyframes: `@keyframes orc-avatar-wink {
  0%, 40%, 58%, 100% { transform: scaleY(1); }
  42.5%, 54% { transform: scaleY(0.08); }
}
@keyframes orc-avatar-wink-other {
  0%, 84%, 87.4%, 100% { transform: scaleY(1); }
  85.2%, 85.6% { transform: scaleY(0.08); }
}
@keyframes orc-avatar-wink-brow {
  0%, 40%, 58%, 100% { transform: translateY(0); }
  42.5%, 54% { transform: translateY(2px); }
}`,
    rules: (sel) => `${sel} .orc-avatar__eye--left { animation: orc-avatar-wink 6s ease-in-out infinite; }
${sel} .orc-avatar__eye--right { animation: orc-avatar-wink-other 6s infinite; }
${sel} .orc-avatar__brow--left { animation: orc-avatar-wink-brow 6s ease-in-out infinite; }`,
  },
  glance: {
    duration: "7s",
    keyframes: `@keyframes orc-avatar-glance {
  0%, 16% { transform: translate(0, 0); }
  19%, 40% { transform: translate(-3px, 0.5px); }
  43%, 64% { transform: translate(3px, 0.5px); }
  67%, 100% { transform: translate(0, 0); }
}
@keyframes orc-avatar-glance-blink {
  0%, 40.5%, 43.2%, 100% { transform: scaleY(1); }
  41.6%, 41.9% { transform: scaleY(0.1); }
}`,
    rules: (sel) => `${sel} .orc-avatar__pupil { animation: orc-avatar-glance 7s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
${sel} .orc-avatar__eye { animation: orc-avatar-glance-blink 7s infinite; }`,
  },
  "look-around": {
    duration: "9s",
    keyframes: `@keyframes orc-avatar-look-around {
  0%, 8% { transform: translate(0, 0); }
  12%, 26% { transform: translate(-3px, -2px); }
  30%, 44% { transform: translate(3px, -1.5px); }
  48%, 60% { transform: translate(2.5px, 2px); }
  64%, 76% { transform: translate(-2.5px, 1.5px); }
  80%, 100% { transform: translate(0, 0); }
}
@keyframes orc-avatar-look-around-blink {
  0%, 28%, 30.4%, 77%, 79.4%, 100% { transform: scaleY(1); }
  29%, 29.3%, 78%, 78.3% { transform: scaleY(0.08); }
}`,
    rules: (sel) => `${sel} .orc-avatar__pupil { animation: orc-avatar-look-around 9s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
${sel} .orc-avatar__eye { animation: orc-avatar-look-around-blink 9s infinite; }`,
  },
  squint: {
    duration: "6.4s",
    keyframes: `@keyframes orc-avatar-squint {
  0%, 18%, 74%, 100% { transform: scaleY(1); }
  26%, 66% { transform: scaleY(0.45); }
}
@keyframes orc-avatar-squint-pupil {
  0%, 26%, 68%, 100% { transform: translate(0, 0); }
  34%, 44% { transform: translate(-2.5px, 0); }
  50%, 60% { transform: translate(2.5px, 0); }
}
@keyframes orc-avatar-squint-brows {
  0%, 18%, 74%, 100% { transform: translateY(0); }
  26%, 66% { transform: translateY(2.5px); }
}`,
    rules: (sel) => `${sel} .orc-avatar__eye { animation: orc-avatar-squint 6.4s ease-in-out infinite; }
${sel} .orc-avatar__pupil { animation: orc-avatar-squint-pupil 6.4s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
${sel} .orc-avatar__brows { animation: orc-avatar-squint-brows 6.4s ease-in-out infinite; }`,
  },
  startle: {
    duration: "5.6s",
    keyframes: `@keyframes orc-avatar-startle {
  0%, 62%, 92%, 100% { transform: scale(1); }
  64.5% { transform: scale(1.2); }
  80% { transform: scale(1.15); }
}
@keyframes orc-avatar-startle-pupil {
  0%, 62%, 88%, 100% { transform: scale(1); }
  64.5%, 80% { transform: scale(0.7); }
}
@keyframes orc-avatar-startle-brows {
  0%, 62%, 92%, 100% { transform: translateY(0); }
  64.5%, 80% { transform: translateY(-4px); }
}`,
    rules: (sel) => `${sel} .orc-avatar__eye { animation: orc-avatar-startle 5.6s ease-out infinite; }
${sel} .orc-avatar__pupil { animation: orc-avatar-startle-pupil 5.6s ease-out infinite; }
${sel} .orc-avatar__brows { animation: orc-avatar-startle-brows 5.6s ease-out infinite; }`,
  },
  drowsy: {
    duration: "7.6s",
    // Lids sink slowly, nearly close, then snap open with a jolt.
    keyframes: `@keyframes orc-avatar-drowsy {
  0%, 100% { transform: scaleY(1); animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1); }
  45% { transform: scaleY(0.45); }
  58% { transform: scaleY(0.3); }
  66% { transform: scaleY(0.1); animation-timing-function: cubic-bezier(0.1, 0.8, 0.2, 1); }
  68% { transform: scaleY(1.08); }
  71% { transform: scaleY(1); }
}
@keyframes orc-avatar-drowsy-pupil {
  0%, 100% { transform: translate(0, 0); }
  62% { transform: translate(0, 1.5px); }
  68% { transform: translate(0, 0); }
}
@keyframes orc-avatar-drowsy-brows {
  0%, 64%, 80%, 100% { transform: translateY(0); }
  68% { transform: translateY(-3px); }
}`,
    rules: (sel) => `${sel} .orc-avatar__eye { animation: orc-avatar-drowsy 7.6s infinite; }
${sel} .orc-avatar__pupil { animation: orc-avatar-drowsy-pupil 7.6s ease-in-out infinite; }
${sel} .orc-avatar__brows { animation: orc-avatar-drowsy-brows 7.6s ease-out infinite; }`,
  },
};

const GLOW = `@keyframes orc-avatar-glow {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 0.6; }
}
.orc-avatar__glow {
  animation: orc-avatar-glow 2.6s ease-in-out infinite;
}
`;

const REDUCED_MOTION = `@media (prefers-reduced-motion: reduce) {
  .orc-avatar,
  .orc-avatar * {
    animation: none !important;
  }
}
`;

/**
 * Standalone CSS snippet for export. Paste beside an inline SVG that uses
 * the orc-avatar class names. Does not depend on Tailwind or the studio.
 * Only the rules the given config needs are emitted.
 */
export function buildCss(
  input: AvatarConfig | Parameters<typeof normalizeConfig>[0],
  { reducedMotion = true }: { reducedMotion?: boolean } = {},
): string {
  const config = normalizeConfig(input);
  const chunks: string[] = [BASE];

  if (config.motion !== "still") {
    chunks.push(motionCss(config.motion));
    chunks.push(secondaryCss(config));
  }

  if (config.eyes !== "none" && config.eyeMotion !== "still") {
    const spec = EYE_MOTIONS[config.eyeMotion];
    chunks.push(`${spec.keyframes}\n${spec.rules(`.orc-avatar--eyes-${config.eyeMotion}`)}\n`);
    if (config.eyes === "glow") chunks.push(GLOW);
  }

  if (reducedMotion) chunks.push(REDUCED_MOTION);

  return chunks.filter(Boolean).join("\n");
}
