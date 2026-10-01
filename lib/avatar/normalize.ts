import {
  AVATAR_OPTIONS,
  DEFAULT_CONFIG,
  type AvatarConfig,
} from "@/lib/avatar/types";

export { DEFAULT_CONFIG } from "@/lib/avatar/types";
export type { AvatarConfig } from "@/lib/avatar/types";

type Field = keyof AvatarConfig;

/**
 * Pairs of choices that can't be worn together. When both sides match, the
 * side that was *not* just changed falls back to its `reset` value, so the
 * user's latest pick always wins.
 */
interface Conflict {
  a: { field: Field; values: readonly string[]; reset: string };
  b: { field: Field; values: readonly string[]; reset: string };
}

export const CONFLICTS: Conflict[] = [
  // Helmets and skull caps cover the scalp, so top hair can't poke through.
  {
    a: { field: "headgear", values: ["horned-helm", "skull-cap"], reset: "none" },
    b: { field: "hair", values: ["mohawk", "topknot", "tufts"], reset: "none" },
  },
  {
    a: { field: "headgear", values: ["spiked-crown"], reset: "none" },
    b: { field: "hair", values: ["topknot"], reset: "none" },
  },
  // Earrings need ears to hang from.
  {
    a: { field: "trinket", values: ["earrings"], reset: "none" },
    b: { field: "ears", values: ["none"], reset: "pointy" },
  },
];

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function normalizeConfig(
  partial: Partial<AvatarConfig> | Record<string, unknown> | null | undefined,
  changed?: Field,
): AvatarConfig {
  const src = (partial ?? {}) as Record<string, unknown>;
  const config = { ...DEFAULT_CONFIG } as Record<Field, string>;

  for (const field of Object.keys(AVATAR_OPTIONS) as Field[]) {
    config[field] = pick(src[field], AVATAR_OPTIONS[field], DEFAULT_CONFIG[field]);
  }

  for (const { a, b } of CONFLICTS) {
    if (a.values.includes(config[a.field]) && b.values.includes(config[b.field])) {
      const loser = changed === a.field ? b : a;
      config[loser.field] = loser.reset;
    }
  }

  return config as unknown as AvatarConfig;
}
