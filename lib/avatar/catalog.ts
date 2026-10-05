import { mix, roundedPolygon } from "@/lib/avatar/svg";
import type {
  AvatarEars,
  AvatarHairColor,
  AvatarShape,
  AvatarSkin,
} from "@/lib/avatar/types";

export const VIEWBOX = "0 0 128 128";

/**
 * Layout anchors shared by every shape so features and accessories line up
 * no matter which silhouette is picked. Every head fits x 22–106, y 24–112.
 */
export const ANCHORS = {
  eyeLeft: [47, 64],
  eyeRight: [81, 64],
  nose: [64, 78],
  mouthY: 89,
  tuskBaseY: 95,
  tuskLeftX: 52,
  tuskRightX: 76,
  /** Rig pivot: bottom-centre of the head, so squash & stretch stays grounded. */
  pivot: [64, 114],
} as const;

/** Base fill + darker companion per skin token. */
export const SKIN_COLORS: Record<AvatarSkin, { fill: string; fur: string }> = {
  moss: { fill: "#6FA05A", fur: "#3F6B3E" },
  forest: { fill: "#3E7A37", fur: "#1F3F1B" },
  olive: { fill: "#8BA03A", fur: "#556B2F" },
  sage: { fill: "#A6BA8C", fur: "#6F8560" },
  slate: { fill: "#7C8C99", fur: "#4F5D6A" },
  ash: { fill: "#B9C4B5", fur: "#7E8A80" },
  umber: { fill: "#7D6352", fur: "#4A3B34" },
  ember: { fill: "#C0644A", fur: "#7F3726" },
};

export interface SkinPalette {
  fill: string;
  fur: string;
  /** Outline / line-work colour, a deep tint of the skin. */
  ink: string;
  shade: string;
  muzzle: string;
  earInner: string;
  blush: string;
  scar: string;
}

export function getSkinPalette(skin: AvatarSkin): SkinPalette {
  const { fill, fur } = SKIN_COLORS[skin];
  return paletteFromColors(fill, fur);
}

/** Line-work, shading and scar tints derived from any base fill. */
export function paletteFromColors(fill: string, fur: string): SkinPalette {
  return {
    fill,
    fur,
    ink: mix(fill, "#12160E", 0.78),
    shade: mix(fill, "#1D2416", 0.28),
    muzzle: mix(fill, "#FFF4D6", 0.22),
    earInner: mix(fill, "#8A3E30", 0.38),
    blush: "#F0867A",
    scar: mix(fill, "#F7CDBB", 0.55),
  };
}

export const HAIR_COLORS: Record<Exclude<AvatarHairColor, "match">, string> = {
  black: "#2E2A26",
  brown: "#6B4428",
  ginger: "#C4622D",
  silver: "#D6D3CA",
};

export function getHairColor(color: AvatarHairColor, skin: AvatarSkin): string {
  return color === "match" ? SKIN_COLORS[skin].fur : HAIR_COLORS[color];
}

/** Shared accessory materials. */
export const MATERIALS = {
  ivory: "#F7EFDC",
  bone: "#EFE5CC",
  gold: "#E8B53E",
  goldDark: "#A9771B",
  iron: "#8E949B",
  ironDark: "#5E646C",
  ironLight: "#C3C8CD",
  leather: "#7A4A2A",
  cloth: "#C9432F",
  clothDark: "#8F2A1D",
  warpaint: "#B8302A",
  socket: "#2A211C",
  mouth: "#3E1D1A",
  tongue: "#E37B74",
  sclera: "#FFFCF2",
  eyepatch: "#2B2420",
  glow: "#FFD447",
  glowHalo: "#FF9F1C",
  gem: "#D94848",
} as const;

/** Head silhouettes. All share the anchor frame above. */
export const SHAPE_PATHS: Record<AvatarShape, string> = {
  blob: "M64 26C92 26 106 44 106 68C106 94 88 112 64 112C40 112 22 94 22 68C22 44 36 26 64 26Z",
  bean: "M64 28C86 28 100 40 103 56C107 76 106 98 90 108C78 114 50 114 38 108C22 98 21 76 25 56C28 40 42 28 64 28Z",
  squircle:
    "M44 28H84C100 28 106 34 106 50V90C106 106 100 112 84 112H44C28 112 22 106 22 90V50C22 34 28 28 44 28Z",
  egg: "M64 24C88 24 104 46 106 70C108 96 90 112 64 112C38 112 20 96 22 70C24 46 40 24 64 24Z",
  pebble:
    "M54 29C76 22 102 34 105 58C108 84 96 110 66 112C38 114 21 98 22 70C23 48 34 34 54 29Z",
  hex: roundedPolygon(
    [
      [64, 25],
      [106, 45],
      [106, 92],
      [64, 113],
      [22, 92],
      [22, 45],
    ],
    9,
  ),
};

/**
 * Left-ear geometry (the right ear is mirrored). Ears sit behind the head,
 * so their base is buried inside every silhouette.
 */
export const EAR_PATHS: Record<
  Exclude<AvatarEars, "none">,
  { outer: string; inner: string; lobe: [number, number] }
> = {
  pointy: {
    outer: "M31 54C21 52 11 47 4 40C7 53 15 67 31 74Z",
    inner: "M27 58C20 56 14 52 10 48C13 56 18 63 27 68Z",
    lobe: [18, 67],
  },
  long: {
    outer: "M31 53C19 49 8 40 1 29C4 46 14 65 31 74Z",
    inner: "M27 57C19 53 12 46 7 39C11 50 17 60 27 68Z",
    lobe: [17, 67],
  },
  droopy: {
    outer: "M31 52C18 53 9 62 6 77C15 78 24 75 31 70Z",
    inner: "M27 56C19 58 13 64 11 72C18 72 23 69 27 66Z",
    lobe: [9, 77],
  },
  notched: {
    outer: "M31 54C26 53 22 51 19 49L17 55L14 46C10 44 7 42 4 40C7 53 15 67 31 74Z",
    inner: "M27 59C23 58 20 57 18 56C17 60 20 64 27 68Z",
    lobe: [18, 67],
  },
};

/** Human-readable labels for option ids, e.g. "double-blink" → "Double blink". */
export function optionLabel(id: string): string {
  const special: Record<string, string> = {
    both: "Breathe + bob",
    match: "Skin tone",
    "look-around": "Look around",
  };
  if (special[id]) return special[id];
  const text = id.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
