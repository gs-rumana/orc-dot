/**
 * Builds promo/.build/promo.html: a 1080×1080 stage whose timeline is driven
 * frame-by-frame by window.renderAt(seconds). Every avatar is the real
 * buildSvg/buildCss output, so the video shows exactly what the app exports.
 *
 * Usage: vite-node --config vitest.config.ts promo/build.ts [--url example.com]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCss } from "@/lib/avatar/buildCss";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { normalizeConfig } from "@/lib/avatar/normalize";
import { randomConfig } from "@/lib/avatar/random";
import type { AvatarConfig } from "@/lib/avatar/types";

const root = join(__dirname, "..");
const urlArg = process.argv.indexOf("--url");
const siteUrl = urlArg > -1 ? process.argv[urlArg + 1] : "";

const BRAND: Partial<AvatarConfig> = { hair: "mohawk", tusks: "medium" };

/** Deterministic PRNG so every render of the video is identical. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Avatar {
  config: AvatarConfig;
  size: number;
  /** Absolute time (s) the avatar appears; its animations start here. */
  start: number;
  /** Seconds to fast-forward its animations (phase offset). */
  shift: number;
  x: number;
  y: number;
  pop?: boolean;
  end?: number;
  label?: string;
}

interface Scene {
  id: string;
  start: number;
  end: number;
  captions: { text: string; at: number; until?: number }[];
  avatars: Avatar[];
  extra?: string;
}

const scenes: Scene[] = [];
const C = (c: Partial<AvatarConfig>) => normalizeConfig(c);

// 1 — Hook
scenes.push({
  id: "hook",
  start: 0,
  end: 2.6,
  captions: [{ text: "Make your own orc.", at: 0.15 }],
  avatars: [{ config: C({ ...BRAND, motion: "hop", eyeMotion: "blink" }), size: 640, start: 0, shift: 1.9, x: 540, y: 620 }],
});

// 2 — Randomize montage
{
  const rand = mulberry32(42);
  const start = 2.6;
  const step = 0.4;
  const avatars: Avatar[] = [];
  for (let i = 0; i < 14; i++) {
    const t0 = start + i * step;
    avatars.push({
      config: C({ ...randomConfig(rand), motion: "bob", eyeMotion: "blink" }),
      size: 600,
      start: t0,
      end: t0 + step,
      shift: 0.5,
      x: 540,
      y: 560,
      pop: true,
    });
  }
  scenes.push({
    id: "montage",
    start,
    end: start + 14 * step,
    captions: [
      { text: "Hit randomize.", at: start + 0.1, until: start + 2.8 },
      { text: "Billions of combos.", at: start + 2.8 },
    ],
    avatars,
    extra: `<div class="pill" data-pill="${start}|${step}">${SHUFFLE_ICON()} Randomize</div>`,
  });
}

// 3 — Gear
{
  const start = 8.2;
  const gear: [AvatarConfig["headgear"], string, Partial<AvatarConfig>][] = [
    ["horned-helm", "Horned helm", { beard: "full", hairColor: "ginger", hair: "none" }],
    ["spiked-crown", "Spiked crown", { skin: "ember", tusks: "gilded", trinket: "earrings" }],
    ["bandana", "Bandana", { skin: "forest", markings: "warpaint", trinket: "nose-ring" }],
    ["skull-cap", "Skull cap", { skin: "slate", eyes: "glow", markings: "mask", tusks: "large", hair: "braids" }],
  ];
  scenes.push({
    id: "gear",
    start,
    end: start + gear.length * 0.9,
    captions: [{ text: "Gear up.", at: start + 0.05 }],
    avatars: gear.map(([headgear, label, rest], i) => ({
      config: C({ ...BRAND, ...rest, headgear, motion: "breathe", eyeMotion: "blink" }),
      size: 600,
      start: start + i * 0.9,
      end: start + (i + 1) * 0.9,
      shift: 0.3,
      x: 540,
      y: 580,
      pop: true,
      label,
    })),
  });
}

// 4 — Expressions: each window is shifted so its key moment lands on screen.
{
  const start = 11.8;
  const exp: [AvatarConfig["eyeMotion"], string, number][] = [
    ["wink", "Wink", 2.25],
    ["startle", "Startle", 3.25],
    ["drowsy", "Drowsy", 4.05],
    ["look-around", "Look around", 2.1],
  ];
  const dur = 1.35;
  scenes.push({
    id: "eyes",
    start,
    end: start + exp.length * dur,
    captions: [{ text: "Eyes with attitude.", at: start + 0.05 }],
    avatars: exp.map(([eyeMotion, label, shift], i) => ({
      config: C({ ...BRAND, brows: "heavy", eyeMotion, motion: "breathe" }),
      size: 640,
      start: start + i * dur,
      end: start + (i + 1) * dur,
      shift,
      x: 540,
      y: 590,
      label,
    })),
  });
}

// 5 — Crowd
{
  const start = 17.2;
  const rand = mulberry32(7);
  const avatars: Avatar[] = [];
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    avatars.push({
      config: C({ ...randomConfig(rand) }),
      size: 270,
      start: start + i * 0.06,
      shift: rand() * 4,
      x: 220 + col * 320,
      y: 330 + row * 285,
      pop: true,
    });
  }
  scenes.push({
    id: "crowd",
    start,
    end: 20.2,
    captions: [{ text: "Every orc moves on its own.", at: start + 0.4 }],
    avatars,
  });
}

// 6 — End card
scenes.push({
  id: "end",
  start: 20.2,
  end: 23.5,
  captions: [],
  avatars: [
    { config: C({ shape: "bean", skin: "forest", ears: "long", eyes: "angry", brows: "angry", tusks: "large", hair: "mohawk", markings: "warpaint", motion: "bob" }), size: 240, start: 20.2, shift: 0.4, x: 250, y: 340, pop: true },
    { config: C({ ...BRAND, motion: "breathe", eyeMotion: "wink" }), size: 300, start: 20.3, shift: 1.4, x: 540, y: 310, pop: true },
    { config: C({ shape: "egg", skin: "ember", tusks: "gilded", headgear: "horned-helm", beard: "goatee", mouth: "grin", motion: "sway" }), size: 240, start: 20.4, shift: 0.8, x: 830, y: 340, pop: true },
  ],
  extra: `<div class="endcard">
    <div class="logo">Orc <span>Dot</span></div>
    <div class="tag">Cute animated orc avatars</div>
    <div class="facts">Free · No sign-up · Export SVG + CSS</div>
    ${siteUrl ? `<div class="url">${siteUrl}</div>` : ""}
  </div>`,
});

function SHUFFLE_ICON() {
  return `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3c4 0 6 10 10 10h5M18 14l3 3-3 3M3 17h3c1.6 0 2.8-1.6 3.9-3.6M14 9.6C15 8 16 7 18 7h3M18 4l3 3-3 3"/></svg>`;
}

const DURATION = 23.5;

// ───────────── sound cues (consumed by promo/sound.mjs) ─────────────
// Times come from the same scene data and CSS keyframe percentages that
// drive the picture, so audio stays in sync when scenes are retimed.

export interface Cue {
  t: number;
  sound: string;
  /** Optional variation index (pitch step, item number). */
  n?: number;
}

/** Video times inside an avatar's window where its animation hits `frac` of a cycle. */
function cycleHits(av: Avatar, sceneEnd: number, period: number, frac: number): number[] {
  const end = av.end ?? sceneEnd;
  const hits: number[] = [];
  // Animation clock c = t - start + shift; find t where c ≡ frac·period.
  const first = av.start - av.shift + frac * period;
  for (let t = first - period * 10; t < end; t += period) {
    if (t >= av.start) hits.push(+t.toFixed(3));
  }
  return hits;
}

function buildCues(): Cue[] {
  const cues: Cue[] = [];
  const scene = (id: string) => scenes.find((s) => s.id === id)!;

  // Hook: boing as the hop leaves the ground (12% → 22% of a 2.6s hop), thud on landing (47%).
  const hook = scene("hook");
  for (const t of cycleHits(hook.avatars[0], hook.end, 2.6, 0.12)) cues.push({ t, sound: "boing" });
  for (const t of cycleHits(hook.avatars[0], hook.end, 2.6, 0.47)) cues.push({ t, sound: "thud" });

  // Montage: button click + pop for every new orc.
  scene("montage").avatars.forEach((av, i) => {
    cues.push({ t: av.start, sound: "click" });
    cues.push({ t: av.start + 0.02, sound: "pop", n: i });
  });

  // Gear: a material-specific hit as each piece of headgear pops in.
  for (const av of scene("gear").avatars) {
    // Conflicts (e.g. skull cap + mohawk) silently drop headgear; fail loudly instead.
    if (av.config.headgear === "none") throw new Error("Gear shot lost its headgear to a conflict");
    cues.push({ t: av.start, sound: `gear-${av.config.headgear}` });
  }

  // Eyes: cue the key moment of each expression (keyframe % × cycle length).
  const eyeKeys: Record<string, { period: number; frac: number; sound: string }[]> = {
    wink: [{ period: 6, frac: 0.4, sound: "wink" }],
    startle: [{ period: 5.6, frac: 0.62, sound: "startle" }],
    drowsy: [{ period: 7.6, frac: 0.665, sound: "wake" }],
    "look-around": [{ period: 9, frac: 0.26, sound: "dart" }],
  };
  const eyes = scene("eyes");
  for (const av of eyes.avatars) {
    // The drowsy shot opens with the lids already sinking: yawn right away.
    if (av.config.eyeMotion === "drowsy") cues.push({ t: av.start + 0.08, sound: "yawn" });
    for (const key of eyeKeys[av.config.eyeMotion] ?? []) {
      for (const t of cycleHits(av, eyes.end, key.period, key.frac)) cues.push({ t, sound: key.sound });
    }
  }

  // Crowd: a rising ripple of small pops.
  scene("crowd").avatars.forEach((av, i) => cues.push({ t: av.start, sound: "pop-small", n: i }));

  // End card: three orcs pop in, then the chime as the logo fades up.
  const end = scene("end");
  end.avatars.forEach((av, i) => cues.push({ t: av.start, sound: "pop", n: 4 + i * 2 }));
  cues.push({ t: end.start + 0.3, sound: "chime" });

  return cues.sort((a, b) => a.t - b.t);
}

const css = [
  ...new Set(
    scenes.flatMap((s) => s.avatars.map((a) => buildCss(a.config, { reducedMotion: false }))),
  ),
].join("\n");

const fontUrl = "file://" + join(root, "assets/fonts/Fredoka-SemiBold.ttf");

const sceneHtml = scenes
  .map(
    (s) => `<section class="scene" data-start="${s.start}" data-end="${s.end}">
  ${s.captions
    .map(
      (c) =>
        `<h2 class="caption" data-at="${c.at}" data-until="${c.until ?? s.end}">${c.text}</h2>`,
    )
    .join("")}
  ${s.avatars
    .map(
      (a) =>
        `<div class="av" data-av data-start="${a.start}" data-end="${a.end ?? s.end}" data-shift="${a.shift}" data-pop="${a.pop ? 1 : 0}" style="left:${a.x - a.size / 2}px;top:${a.y - a.size / 2}px;width:${a.size}px;height:${a.size}px">${buildSvg(a.config, { size: a.size })}${a.label ? `<div class="chip">${a.label}</div>` : ""}</div>`,
    )
    .join("")}
  ${s.extra ?? ""}
</section>`,
  )
  .join("\n");

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
@font-face { font-family: Fredoka; src: url("${fontUrl}"); font-weight: 600; }
* { box-sizing: border-box; }
html, body { margin: 0; width: 1080px; height: 1080px; overflow: hidden; }
body {
  font-family: Fredoka, sans-serif; color: #23301C;
  background: radial-gradient(circle at 50% 45%, #E3EDCF, #F8F3E6 68%);
}
.scene { position: absolute; inset: 0; display: none; }
.caption {
  position: absolute; left: 0; right: 0; top: 70px; margin: 0;
  text-align: center; font-size: 84px; font-weight: 600; letter-spacing: -1px;
}
.av { position: absolute; transform-origin: 50% 70%; }
.av svg { width: 100%; height: 100%; overflow: visible; }
.chip {
  position: absolute; left: 50%; bottom: -36px; transform: translateX(-50%);
  background: #3F7A2F; color: #FBF8EE; font-size: 40px; padding: 10px 30px;
  border-radius: 999px; white-space: nowrap;
}
.pill {
  position: absolute; left: 50%; top: 930px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 14px;
  background: #3F7A2F; color: #FBF8EE; font-size: 44px; padding: 16px 40px;
  border-radius: 999px; box-shadow: 0 6px 0 #2B5A20;
}
.watermark {
  position: absolute; left: 44px; bottom: 34px; font-size: 38px; opacity: 0.9;
}
.watermark span, .logo span { color: #3F7A2F; }
.endcard { position: absolute; left: 0; right: 0; top: 560px; text-align: center; }
.logo { font-size: 170px; line-height: 1; letter-spacing: -3px; }
.tag { font-size: 52px; margin-top: 18px; }
.facts { font-size: 40px; margin-top: 22px; color: #55644A; }
.url { font-size: 44px; margin-top: 26px; color: #3F7A2F; }
${css}
</style></head>
<body>
${sceneHtml}
<div class="watermark" id="wm">Orc <span>Dot</span></div>
<script>
const DURATION = ${DURATION};
const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
const back = (x) => { x = Math.min(Math.max(x, 0), 1); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
window.DURATION = DURATION;
window.renderAt = (t) => {
  for (const scene of document.querySelectorAll(".scene")) {
    const on = t >= +scene.dataset.start && t < +scene.dataset.end;
    scene.style.display = on ? "block" : "none";
    if (!on) continue;
    for (const cap of scene.querySelectorAll(".caption")) {
      const age = t - +cap.dataset.at;
      const visible = age >= 0 && t < +cap.dataset.until;
      cap.style.display = visible ? "block" : "none";
      cap.style.opacity = ease(age / 0.25);
      cap.style.transform = "translateY(" + (1 - ease(age / 0.3)) * 30 + "px)";
    }
    for (const av of scene.querySelectorAll("[data-av]")) {
      const age = t - +av.dataset.start;
      const visible = age >= 0 && t < +av.dataset.end;
      av.style.display = visible ? "block" : "none";
      av.style.transform = av.dataset.pop === "1" ? "scale(" + (0.6 + 0.4 * back(age / 0.28)) + ")" : "";
    }
    const pill = scene.querySelector("[data-pill]");
    if (pill) {
      const [s0, step] = pill.dataset.pill.split("|").map(Number);
      const phase = ((t - s0) % step) / step;
      pill.style.transform = "translateX(-50%) scale(" + (phase < 0.18 ? 0.92 : 1) + ")";
    }
    const end = scene.querySelector(".endcard");
    if (end) {
      const age = t - +scene.dataset.start - 0.3;
      end.style.opacity = ease(age / 0.35);
      end.style.transform = "translateY(" + (1 - ease(age / 0.45)) * 40 + "px)";
    }
  }
  document.getElementById("wm").style.display = t >= 2.6 && t < 20.2 ? "block" : "none";
  for (const anim of document.getAnimations()) {
    const av = anim.effect && anim.effect.target && anim.effect.target.closest("[data-av]");
    if (!av) continue;
    anim.pause();
    anim.currentTime = Math.max(0, (t - +av.dataset.start + +av.dataset.shift) * 1000);
  }
};
window.renderAt(Number(location.hash.slice(1) || 0));
</script>
</body></html>`;

const outDir = join(root, "promo/.build");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "promo.html"), html);
writeFileSync(join(outDir, "cues.json"), JSON.stringify({ duration: DURATION, cues: buildCues() }, null, 2));
console.log(`Wrote promo/.build/promo.html and cues.json (${DURATION}s)`);
