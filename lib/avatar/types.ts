export const AVATAR_SHAPES = [
  "blob",
  "bean",
  "squircle",
  "egg",
  "pebble",
  "hex",
] as const;

export const AVATAR_SKINS = [
  "moss",
  "forest",
  "olive",
  "sage",
  "slate",
  "ash",
  "umber",
  "ember",
] as const;

export const AVATAR_EARS = ["none", "pointy", "long", "droopy", "notched"] as const;

export const AVATAR_EYES = [
  "none",
  "dots",
  "round",
  "almond",
  "angry",
  "sleepy",
  "happy",
  "glow",
  "mismatched",
] as const;

export const AVATAR_EYE_MOTIONS = [
  "still",
  "blink",
  "double-blink",
  "wink",
  "glance",
  "look-around",
  "squint",
  "startle",
  "drowsy",
] as const;

export const AVATAR_BROWS = ["none", "heavy", "angry", "worried", "unibrow"] as const;

export const AVATAR_MOUTHS = ["smile", "grin", "smirk", "grumpy", "roar"] as const;

export const AVATAR_TUSKS = [
  "none",
  "small",
  "medium",
  "large",
  "asymmetric",
  "chipped",
  "gilded",
] as const;

export const AVATAR_HAIRS = [
  "none",
  "mohawk",
  "topknot",
  "tufts",
  "mane",
  "braids",
] as const;

export const AVATAR_HAIR_COLORS = [
  "black",
  "brown",
  "ginger",
  "silver",
  "match",
] as const;

export const AVATAR_BEARDS = ["none", "goatee", "braided", "full", "chops"] as const;

export const AVATAR_HEADGEARS = [
  "none",
  "horned-helm",
  "spiked-crown",
  "bandana",
  "skull-cap",
] as const;

export const AVATAR_MARKINGS = [
  "none",
  "warpaint",
  "mask",
  "tribal",
  "scar",
  "freckles",
] as const;

export const AVATAR_TRINKETS = [
  "none",
  "nose-ring",
  "nose-bone",
  "earrings",
  "eyepatch",
] as const;

export const AVATAR_MOTIONS = ["still", "breathe", "bob", "both", "sway", "hop"] as const;

export type AvatarShape = (typeof AVATAR_SHAPES)[number];
export type AvatarSkin = (typeof AVATAR_SKINS)[number];
export type AvatarEars = (typeof AVATAR_EARS)[number];
export type AvatarEyes = (typeof AVATAR_EYES)[number];
export type AvatarEyeMotion = (typeof AVATAR_EYE_MOTIONS)[number];
export type AvatarBrows = (typeof AVATAR_BROWS)[number];
export type AvatarMouth = (typeof AVATAR_MOUTHS)[number];
export type AvatarTusks = (typeof AVATAR_TUSKS)[number];
export type AvatarHair = (typeof AVATAR_HAIRS)[number];
export type AvatarHairColor = (typeof AVATAR_HAIR_COLORS)[number];
export type AvatarBeard = (typeof AVATAR_BEARDS)[number];
export type AvatarHeadgear = (typeof AVATAR_HEADGEARS)[number];
export type AvatarMarkings = (typeof AVATAR_MARKINGS)[number];
export type AvatarTrinket = (typeof AVATAR_TRINKETS)[number];
export type AvatarMotion = (typeof AVATAR_MOTIONS)[number];

export interface AvatarConfig {
  shape: AvatarShape;
  skin: AvatarSkin;
  ears: AvatarEars;
  eyes: AvatarEyes;
  eyeMotion: AvatarEyeMotion;
  brows: AvatarBrows;
  mouth: AvatarMouth;
  tusks: AvatarTusks;
  hair: AvatarHair;
  hairColor: AvatarHairColor;
  beard: AvatarBeard;
  headgear: AvatarHeadgear;
  markings: AvatarMarkings;
  trinket: AvatarTrinket;
  motion: AvatarMotion;
}

/** Allowed values per config field; drives normalization, controls and randomize. */
export const AVATAR_OPTIONS: { [K in keyof AvatarConfig]: readonly AvatarConfig[K][] } = {
  shape: AVATAR_SHAPES,
  skin: AVATAR_SKINS,
  ears: AVATAR_EARS,
  eyes: AVATAR_EYES,
  eyeMotion: AVATAR_EYE_MOTIONS,
  brows: AVATAR_BROWS,
  mouth: AVATAR_MOUTHS,
  tusks: AVATAR_TUSKS,
  hair: AVATAR_HAIRS,
  hairColor: AVATAR_HAIR_COLORS,
  beard: AVATAR_BEARDS,
  headgear: AVATAR_HEADGEARS,
  markings: AVATAR_MARKINGS,
  trinket: AVATAR_TRINKETS,
  motion: AVATAR_MOTIONS,
};

export const DEFAULT_CONFIG: AvatarConfig = {
  shape: "blob",
  skin: "moss",
  ears: "pointy",
  eyes: "round",
  eyeMotion: "blink",
  brows: "heavy",
  mouth: "smile",
  tusks: "small",
  hair: "none",
  hairColor: "black",
  beard: "none",
  headgear: "none",
  markings: "none",
  trinket: "none",
  motion: "breathe",
};
