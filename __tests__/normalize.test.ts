import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, normalizeConfig } from "@/lib/avatar/normalize";
import { randomConfig } from "@/lib/avatar/random";
import { AVATAR_OPTIONS, type AvatarConfig } from "@/lib/avatar/types";

describe("normalizeConfig", () => {
  it("returns DEFAULT_CONFIG for null/undefined/empty", () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("keeps valid full configs unchanged", () => {
    const cfg: AvatarConfig = {
      shape: "egg",
      skin: "umber",
      ears: "long",
      eyes: "sleepy",
      eyeMotion: "drowsy",
      brows: "worried",
      mouth: "grin",
      tusks: "asymmetric",
      hair: "mane",
      hairColor: "ginger",
      beard: "braided",
      headgear: "horned-helm",
      markings: "warpaint",
      trinket: "earrings",
      motion: "both",
    };
    expect(normalizeConfig(cfg)).toEqual(cfg);
  });

  it("fills missing fields from defaults", () => {
    expect(normalizeConfig({ shape: "hex", skin: "slate" })).toEqual({
      ...DEFAULT_CONFIG,
      shape: "hex",
      skin: "slate",
    });
  });

  it("coerces unknown preset ids to defaults", () => {
    expect(
      normalizeConfig({
        shape: "triangle",
        skin: "neon",
        eyes: "laser",
        eyeMotion: "spin",
        tusks: "huge",
        hair: "afro",
        headgear: "tophat",
        motion: "spin",
      } as Record<string, unknown>),
    ).toEqual(DEFAULT_CONFIG);
  });

  describe("conflicts", () => {
    it("drops the helm when a top hairstyle is picked", () => {
      const result = normalizeConfig(
        { headgear: "horned-helm", hair: "mohawk" },
        "hair",
      );
      expect(result.hair).toBe("mohawk");
      expect(result.headgear).toBe("none");
    });

    it("drops the hairstyle when a helm is picked", () => {
      const result = normalizeConfig(
        { headgear: "skull-cap", hair: "tufts" },
        "headgear",
      );
      expect(result.headgear).toBe("skull-cap");
      expect(result.hair).toBe("none");
    });

    it("lets helms and long hair coexist", () => {
      const result = normalizeConfig({ headgear: "horned-helm", hair: "braids" });
      expect(result.headgear).toBe("horned-helm");
      expect(result.hair).toBe("braids");
    });

    it("gives earless orcs ears when earrings are picked", () => {
      const result = normalizeConfig({ ears: "none", trinket: "earrings" }, "trinket");
      expect(result.trinket).toBe("earrings");
      expect(result.ears).toBe("pointy");
    });

    it("removes earrings when ears are removed", () => {
      const result = normalizeConfig({ ears: "none", trinket: "earrings" }, "ears");
      expect(result.ears).toBe("none");
      expect(result.trinket).toBe("none");
    });
  });
});

describe("randomConfig", () => {
  it("always produces a valid, normalized config", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 200; i++) {
      const cfg = randomConfig(rand);
      expect(normalizeConfig(cfg)).toEqual(cfg);
      for (const field of Object.keys(AVATAR_OPTIONS) as (keyof AvatarConfig)[]) {
        expect(AVATAR_OPTIONS[field]).toContain(cfg[field]);
      }
      expect(cfg.eyes).not.toBe("none");
      expect(cfg.motion).not.toBe("still");
    }
  });
});
