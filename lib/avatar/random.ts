import { normalizeConfig } from "@/lib/avatar/normalize";
import { AVATAR_OPTIONS, type AvatarConfig } from "@/lib/avatar/types";

/**
 * Chance that an optional slot stays empty, so random orcs aren't buried in
 * gear. Fields not listed always pick a real option.
 */
const NONE_CHANCE: Partial<Record<keyof AvatarConfig, number>> = {
  ears: 0.1,
  brows: 0.2,
  tusks: 0.15,
  hair: 0.35,
  beard: 0.55,
  headgear: 0.5,
  markings: 0.5,
  trinket: 0.55,
};

/** Values never picked at random (they look broken or static by accident). */
const NEVER: Partial<Record<keyof AvatarConfig, string[]>> = {
  eyes: ["none"],
  eyeMotion: ["still"],
  motion: ["still"],
};

export function randomConfig(rand: () => number = Math.random): AvatarConfig {
  const out: Record<string, string> = {};
  for (const field of Object.keys(AVATAR_OPTIONS) as (keyof AvatarConfig)[]) {
    const options = AVATAR_OPTIONS[field] as readonly string[];
    const never = NEVER[field] ?? [];
    const noneChance = NONE_CHANCE[field];
    if (noneChance !== undefined && rand() < noneChance) {
      out[field] = "none";
      continue;
    }
    const pool = options.filter((o) => o !== "none" && !never.includes(o));
    out[field] = pool[Math.floor(rand() * pool.length)] ?? options[0];
  }
  return normalizeConfig(out);
}
