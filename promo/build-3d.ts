/**
 * Builds promo/.build/promo-3d.html: the 3D cut of the promo. The stage
 * (promo/stage-3d.ts) is bundled with the real 3D avatar builder and drives a
 * shared WebGL canvas frame-by-frame through window.renderAt(seconds); the
 * captions, labels and end card are HTML laid over it.
 *
 * Also writes promo/.build/cues-3d.json for `node promo/sound.mjs 3d`.
 *
 * Usage: vite-node --config vitest.config.ts promo/build-3d.ts [--url example.com]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { normalizeConfig } from "@/lib/avatar/normalize";
import { randomConfig } from "@/lib/avatar/random";
import { FUR_COATS, FUR_COLORS, type FurryOptions } from "@/lib/avatar/three/types";
import { SKIN_COLORS } from "@/lib/avatar/catalog";
import { AVATAR_SKINS, type AvatarConfig } from "@/lib/avatar/types";
import type { Actor } from "./stage-3d";

const root = join(__dirname, "..");
const urlArg = process.argv.indexOf("--url");
const siteUrl = urlArg > -1 ? process.argv[urlArg + 1] : "";

const DURATION = 23.5;
/** The music cadences onto this beat (beat 50 at 150 bpm). */
const END_CARD = 20.2;

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

const C = (c: Partial<AvatarConfig>) => normalizeConfig(c);
const plush = (color: FurryOptions["color"], coat: FurryOptions["coat"] = "plush"): FurryOptions => ({ color, coat });
const BRAND: Partial<AvatarConfig> = { hair: "mohawk", tusks: "medium", motion: "breathe", eyeMotion: "blink" };

interface Caption {
  text: string;
  at: number;
  until: number;
}
interface Label {
  text: string;
  at: number;
  until: number;
}
interface Cue {
  t: number;
  sound: string;
  n?: number;
}

const actors: Actor[] = [];
const captions: Caption[] = [];
const labels: Label[] = [];
const cues: Cue[] = [];
/** The color picker row shown during the color montage. */
const swatches: { hex: string; at: number; until: number }[] = [];

// 1 — Hook: the brand orc hops while the camera eases round a little.
// The hop cycle is 2.8s and leaves the ground at 0.18s, landing at 0.8s.
{
  const liftoff = 0.9;
  const shift = 2.8 + 0.18 - liftoff;
  actors.push({
    config: C({ ...BRAND, hair: "none", motion: "hop" }),
    furry: plush("lime"),
    x: 540, y: 620, size: 860, start: 0, end: 2.6, shift,
    yaw: -0.35, turn: 0.6,
  });
  captions.push({ text: "Now in fluffy 3D.", at: 0.15, until: 2.6 });
  cues.push({ t: liftoff, sound: "boing" }, { t: liftoff + 0.62, sound: "thud" });
}

// 2 — Turntable: one full turn, so it's obviously a real 3D model.
{
  const start = 2.6;
  actors.push({
    config: C({ hair: "none", headgear: "bandana", tusks: "large", markings: "warpaint", trinket: "earrings", mouth: "grin", motion: "breathe", eyeMotion: "blink" }),
    furry: plush("blue"),
    x: 540, y: 600, size: 860, start, end: 5.4, shift: 0.4,
    yaw: 0.065, turn: Math.PI * 2, easeTurn: true,
  });
  captions.push({ text: "Fuzzy from every side.", at: start + 0.05, until: 5.4 });
  cues.push({ t: start + 0.55, sound: "spin" });
}

// 3 — One color picker: plush colors and skin tones, a new one every beat.
{
  const start = 5.4;
  const step = 0.4;
  const colors: FurryOptions["color"][] = ["lime", "blue", "yellow", "pink"];
  const tones = ["moss", "forest", "sage", "slate", "umber", "ember"] as const;
  const picks = [
    ...colors.map((color) => ({ furry: plush(color, color === "pink" ? "velvet" : "plush"), skin: "moss" as const, hex: FUR_COLORS[color]! })),
    ...tones.map((skin) => ({ furry: plush("skin"), skin, hex: SKIN_COLORS[skin].fill })),
  ];
  picks.forEach((pick, i) => {
    const t0 = start + i * step;
    actors.push({
      config: C({ ...BRAND, hair: "none", skin: pick.skin, motion: "bob" }),
      furry: pick.furry,
      x: 540, y: 560, size: 760, start: t0, end: t0 + step, shift: 0.5 + i * 0.2,
      yaw: 0.3 - i * 0.06, turn: -0.06, pop: true,
    });
    swatches.push({ hex: pick.hex, at: t0, until: t0 + step });
    cues.push({ t: t0, sound: "click" }, { t: t0 + 0.02, sound: "pop", n: i });
  });
  captions.push(
    { text: "Pick a color.", at: start + 0.1, until: start + 2.0 },
    { text: "Plush or skin tone.", at: start + 2.0, until: start + picks.length * step },
  );
}

// 4 — Gear, each piece turning a little so the 3D build shows.
{
  const start = 9.4;
  const step = 0.9;
  const gear: [AvatarConfig["headgear"], string, Partial<AvatarConfig>, FurryOptions][] = [
    ["horned-helm", "Horned helm", { beard: "full", hairColor: "ginger", hair: "none" }, plush("lime")],
    ["spiked-crown", "Spiked crown", { skin: "ember", tusks: "gilded", trinket: "earrings", hair: "none" }, plush("skin")],
    ["bandana", "Bandana", { markings: "warpaint", trinket: "nose-ring", hair: "none" }, plush("pink")],
    ["skull-cap", "Skull cap", { eyes: "glow", tusks: "chipped", hair: "braids" }, plush("yellow")],
  ];
  gear.forEach(([headgear, text, rest, furry], i) => {
    const t0 = start + i * step;
    const config = C({ ...BRAND, ...rest, headgear });
    // Conflicts (e.g. skull cap + mohawk) silently drop headgear; fail loudly instead.
    if (config.headgear === "none") throw new Error("Gear shot lost its headgear to a conflict");
    actors.push({
      config, furry,
      x: 540, y: 600, size: 800, start: t0, end: t0 + step, shift: 0.3,
      yaw: i % 2 ? -0.45 : 0.45, turn: i % 2 ? 0.5 : -0.5, pop: true,
    });
    labels.push({ text, at: t0, until: t0 + step });
    cues.push({ t: t0, sound: `gear-${headgear}` });
  });
  captions.push({ text: "Gear up.", at: start + 0.05, until: start + gear.length * step });
}

// 5 — Faces: each shot is phased so its key moment lands early in the window.
{
  const start = 13.0;
  const dur = 1.0;
  // [label, config, phase shift, cue time within the shot, cue]
  const faces: [string, Partial<AvatarConfig>, number, number, string][] = [
    // Wink: the left lid closes at 3.5s of a 4.7s cycle.
    ["Wink", { eyeMotion: "wink", mouth: "grin", brows: "heavy" }, 3.1, 0.42, "wink"],
    // Startle: the eyes widen to a peak at ~0.98s.
    ["Roar", { eyeMotion: "startle", mouth: "roar", brows: "angry", tusks: "large" }, 0.6, 0.12, "startle"],
    // Look around: the gaze jumps every 1.9s.
    ["Look around", { eyeMotion: "look-around", mouth: "smirk", brows: "heavy" }, 1.55, 0.35, "dart"],
    ["Drowsy", { eyeMotion: "drowsy", mouth: "grumpy", brows: "worried" }, 0, 0.08, "yawn"],
  ];
  faces.forEach(([text, rest, shift, at, sound], i) => {
    const t0 = start + i * dur;
    actors.push({
      config: C({ ...BRAND, ...rest, motion: "breathe" }),
      furry: plush(i % 2 ? "skin" : "lime"),
      x: 540, y: 610, size: 900, start: t0, end: t0 + dur, shift,
      yaw: 0.12, turn: -0.08, zoom: 1.35, lookY: 0.08,
    });
    labels.push({ text, at: t0, until: t0 + dur });
    cues.push({ t: t0 + at, sound });
  });
  captions.push({ text: "Faces with attitude.", at: start + 0.05, until: start + faces.length * dur });
}

// 6 — Crowd: nine random 3D orcs, each on its own clock.
{
  const start = 17.0;
  const rand = mulberry32(11);
  const colors = Object.keys(FUR_COLORS) as FurryOptions["color"][];
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const config = C({ ...randomConfig(rand), skin: AVATAR_SKINS[Math.floor(rand() * AVATAR_SKINS.length)] });
    actors.push({
      config: C({ ...config, motion: config.motion === "still" ? "bob" : config.motion }),
      furry: plush(colors[Math.floor(rand() * colors.length)], FUR_COATS[Math.floor(rand() * FUR_COATS.length)]),
      x: 220 + col * 320, y: 345 + row * 280, size: 330,
      start: start + i * 0.06, end: END_CARD, shift: rand() * 4,
      yaw: (rand() - 0.5) * 0.9, turn: (rand() - 0.5) * 0.5, pop: true,
    });
    cues.push({ t: start + i * 0.06, sound: "pop-small", n: i });
  }
  captions.push({ text: "Every orc moves on its own.", at: start + 0.4, until: END_CARD });
}

// 7 — End card.
{
  const trio: [Partial<AvatarConfig>, FurryOptions, number, number, number][] = [
    [{ shape: "bean", ears: "long", eyes: "angry", brows: "angry", tusks: "large", hair: "mohawk", markings: "warpaint", motion: "bob" }, plush("blue"), 250, 300, 0],
    [{ ...BRAND, eyeMotion: "wink" }, plush("lime"), 540, 360, 1.4],
    [{ shape: "egg", skin: "ember", tusks: "gilded", headgear: "horned-helm", beard: "goatee", mouth: "grin", motion: "sway" }, plush("skin"), 830, 300, 0.8],
  ];
  trio.forEach(([config, furry, x, size, shift], i) => {
    actors.push({
      config: C(config), furry, x, y: 300, size, start: END_CARD + i * 0.1, end: DURATION, shift,
      yaw: (i - 1) * -0.35, turn: (i - 1) * 0.2, pop: true,
    });
    cues.push({ t: END_CARD + i * 0.1, sound: "pop", n: 4 + i * 2 });
  });
  cues.push({ t: END_CARD + 0.3, sound: "chime" });
}

const bundle = await build({
  entryPoints: [join(__dirname, "stage-3d.ts")],
  bundle: true,
  format: "iife",
  write: false,
  minify: true,
  alias: { "@": root },
  logLevel: "warning",
});

const fontUrl = "file://" + join(root, "assets/fonts/Fredoka-SemiBold.ttf");
const timed = (attrs: { at: number; until: number }) => `data-at="${attrs.at}" data-until="${attrs.until}"`;

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
#stage { position: absolute; inset: 0; width: 1080px; height: 1080px; }
[data-at] { position: absolute; display: none; }
.caption {
  left: 0; right: 0; top: 70px; margin: 0;
  text-align: center; font-size: 84px; font-weight: 600; letter-spacing: -1px;
}
.chip {
  left: 50%; top: 950px;
  background: #3F7A2F; color: #FBF8EE; font-size: 44px; padding: 10px 34px;
  border-radius: 999px; white-space: nowrap;
}
.swatches {
  left: 50%; top: 960px; transform: translateX(-50%); display: flex; gap: 18px;
  padding: 16px 26px; background: #FBF8EE; border-radius: 999px;
  box-shadow: 0 6px 24px rgba(35, 48, 28, 0.12);
}
.swatches i { width: 52px; height: 52px; border-radius: 50%; border: 3px solid rgba(0,0,0,0.1); display: block; }
.swatches i.on { outline: 5px solid #3F7A2F; outline-offset: 4px; }
.watermark { position: absolute; left: 44px; bottom: 34px; font-size: 38px; opacity: 0.9; }
.watermark span, .logo span { color: #3F7A2F; }
.endcard { position: absolute; left: 0; right: 0; top: 560px; text-align: center; opacity: 0; }
.logo { font-size: 170px; line-height: 1; letter-spacing: -3px; }
.tag { font-size: 52px; margin-top: 18px; }
.facts { font-size: 40px; margin-top: 22px; color: #55644A; }
.url { font-size: 44px; margin-top: 26px; color: #3F7A2F; }
</style></head>
<body>
<canvas id="stage" width="1080" height="1080"></canvas>
${captions.map((c) => `<h2 class="caption" ${timed(c)}>${c.text}</h2>`).join("\n")}
${labels.map((l) => `<div class="chip" ${timed(l)}>${l.text}</div>`).join("\n")}
<div class="swatches" ${timed({ at: swatches[0].at, until: swatches[swatches.length - 1].until })}>${swatches
  .map((s) => `<i style="background:${s.hex}" ${`data-on="${s.at}|${s.until}"`}></i>`)
  .join("")}</div>
<div class="endcard" id="end">
  <div class="logo">Orc <span>Dot</span></div>
  <div class="tag">Cute orcs in 2D and fluffy 3D</div>
  <div class="facts">Free · No sign-up · Export PNG + GLB</div>
  ${siteUrl ? `<div class="url">${siteUrl}</div>` : ""}
</div>
<div class="watermark" id="wm">Orc <span>Dot</span></div>
<script>
window.DURATION = ${DURATION};
window.POSTER = ${END_CARD + 0.7};
window.ACTORS = ${JSON.stringify(actors)};
const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
window.overlayAt = (t) => {
  for (const el of document.querySelectorAll("[data-at]")) {
    const age = t - +el.dataset.at;
    const on = age >= 0 && t < +el.dataset.until;
    el.style.display = on ? (el.classList.contains("swatches") ? "flex" : "block") : "none";
    if (el.classList.contains("caption")) {
      el.style.opacity = ease(age / 0.25);
      el.style.transform = "translateY(" + (1 - ease(age / 0.3)) * 30 + "px)";
    }
    if (el.classList.contains("chip")) el.style.transform = "translateX(-50%) scale(" + (0.8 + 0.2 * ease(age / 0.2)) + ")";
  }
  for (const dot of document.querySelectorAll("[data-on]")) {
    const [a, b] = dot.dataset.on.split("|").map(Number);
    dot.classList.toggle("on", t >= a && t < b);
  }
  const end = document.getElementById("end");
  const age = t - ${END_CARD} - 0.3;
  end.style.opacity = age < 0 ? 0 : ease(age / 0.35);
  end.style.transform = "translateY(" + (1 - ease(age / 0.45)) * 40 + "px)";
  document.getElementById("wm").style.display = t >= 2.6 && t < ${END_CARD} ? "block" : "none";
};
</script>
<script>${bundle.outputFiles[0].text.replace(/<\/script/g, "<\\/script")}</script>
</body></html>`;

const outDir = join(root, "promo/.build");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "promo-3d.html"), html);
writeFileSync(
  join(outDir, "cues-3d.json"),
  JSON.stringify({ duration: DURATION, endCard: END_CARD, cues: cues.map((c) => ({ ...c, t: +c.t.toFixed(3) })).sort((a, b) => a.t - b.t) }, null, 2),
);
console.log(`Wrote promo/.build/promo-3d.html (${actors.length} orcs) and cues-3d.json (${DURATION}s)`);
