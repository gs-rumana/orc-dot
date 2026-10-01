/**
 * Builds docs/orc-parade.svg: an animated line-up of orcs for the README.
 * Each orc is the real renderer's output, nested in one SVG with the CSS it
 * needs inlined, so it animates even when shown as an <img> (e.g. on GitHub).
 * Run with: npm run readme-art
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCss } from "@/lib/avatar/buildCss";
import { buildSvg } from "@/lib/avatar/buildSvg";
import type { AvatarConfig } from "@/lib/avatar/types";

const PARADE: Partial<AvatarConfig>[] = [
  // The brand orc
  { hair: "mohawk", tusks: "medium", motion: "hop", eyeMotion: "blink" },
  // The warrior
  { shape: "bean", skin: "forest", ears: "long", eyes: "angry", brows: "angry", tusks: "large", markings: "warpaint", trinket: "nose-ring", motion: "bob", eyeMotion: "squint" },
  // The viking
  { shape: "egg", skin: "ember", tusks: "gilded", headgear: "horned-helm", beard: "goatee", mouth: "grin", motion: "sway", eyeMotion: "wink" },
  // The shaman
  { shape: "hex", skin: "slate", ears: "notched", eyes: "glow", brows: "unibrow", mouth: "roar", tusks: "large", hair: "braids", hairColor: "silver", headgear: "skull-cap", markings: "mask", motion: "breathe", eyeMotion: "look-around" },
  // The napper
  { shape: "squircle", skin: "sage", ears: "droopy", eyes: "sleepy", brows: "worried", mouth: "smirk", tusks: "chipped", hair: "topknot", hairColor: "brown", markings: "freckles", motion: "breathe", eyeMotion: "drowsy" },
  // The pirate
  { shape: "pebble", skin: "umber", eyes: "mismatched", tusks: "asymmetric", headgear: "bandana", beard: "full", hairColor: "ginger", trinket: "eyepatch", markings: "scar", motion: "both", eyeMotion: "startle" },
];

const CELL = 150;
const GAP = 6;
const PAD_X = 24;
const TOP = 18;
const WIDTH = PAD_X * 2 + PARADE.length * CELL + (PARADE.length - 1) * GAP;
const HEIGHT = TOP + CELL + 26;

const avatars = PARADE.map((config, i) => {
  const x = PAD_X + i * (CELL + GAP);
  const shadow = `<ellipse cx="${x + CELL / 2}" cy="${TOP + CELL + 4}" rx="${CELL * 0.27}" ry="5" fill="#2E3A24" opacity="0.12"/>`;
  const svg = buildSvg(config, { size: CELL }).replace(
    '<svg xmlns="http://www.w3.org/2000/svg" ',
    `<svg x="${x}" y="${TOP}" `,
  );
  return shadow + svg;
}).join("");

const css = PARADE.map((config) => buildCss(config)).join("\n");

const parade = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="Six animated orcs from Orc Dot: a hopping mohawk orc, a squinting warrior, a winking viking, a glowing-eyed shaman, a drowsy napper and a startled pirate">
<style>${css}</style>
<rect width="${WIDTH}" height="${HEIGHT}" rx="28" fill="#F8F3E6"/>
${avatars}
</svg>
`;

const outDir = join(__dirname, "..", "docs");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "orc-parade.svg"), parade);
console.log(`docs/orc-parade.svg written (${(parade.length / 1024).toFixed(1)} KB)`);
