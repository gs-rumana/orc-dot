import { HAIR_COLORS, SKIN_COLORS } from "@/lib/avatar/catalog";
import { mix } from "@/lib/avatar/svg";
import type { AvatarConfig } from "@/lib/avatar/types";

export const FUR_COATS = ["velvet", "plush"] as const;
export const FUR_COLORS = {
  lime: "#afd756",
  blue: "#27bce7",
  yellow: "#ffdb69",
  pink: "#ee83c2",
  skin: null,
} as const;

export interface FurryOptions {
  coat: (typeof FUR_COATS)[number];
  /** A plush color, or "skin" to wear the avatar's skin tone as fur. */
  color: keyof typeof FUR_COLORS;
}

/**
 * The single coat color a 3D orc wears, plus its darker companion (used when
 * hair is set to "match"). Skin tones come with their own dark shade.
 */
export function coatColors(options: FurryOptions, skin: AvatarConfig["skin"]) {
  const plush = FUR_COLORS[options.color];
  if (!plush) return SKIN_COLORS[skin];
  return { fill: plush, fur: mix(plush, "#1D2416", 0.45) };
}

export function coatHairColor(
  config: AvatarConfig,
  options: FurryOptions,
): string {
  return config.hairColor === "match"
    ? coatColors(options, config.skin).fur
    : HAIR_COLORS[config.hairColor];
}

export const DEFAULT_FURRY: FurryOptions = { coat: "plush", color: "lime" };

export interface Avatar3DHandle {
  resetView(): void;
  downloadPng(): Promise<void>;
  downloadGlb(): Promise<void>;
}
