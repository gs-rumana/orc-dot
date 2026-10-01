import { describe, expect, it } from "vitest";
import {
  EAR_PATHS,
  HAIR_COLORS,
  SHAPE_PATHS,
  SKIN_COLORS,
  VIEWBOX,
  getHairColor,
  getSkinPalette,
  optionLabel,
} from "@/lib/avatar/catalog";
import { mirror, mix, roundedPolygon, transformPath } from "@/lib/avatar/svg";
import { AVATAR_EARS, AVATAR_SHAPES, AVATAR_SKINS } from "@/lib/avatar/types";

describe("PresetCatalog", () => {
  it("exposes the shared viewBox", () => {
    expect(VIEWBOX).toBe("0 0 128 128");
  });

  it("derives a full palette for every skin id", () => {
    for (const skin of AVATAR_SKINS) {
      const palette = getSkinPalette(skin);
      expect(palette.fill).toBe(SKIN_COLORS[skin].fill);
      for (const color of Object.values(palette)) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("resolves hair colors, with 'match' following the skin", () => {
    expect(getHairColor("black", "moss")).toBe(HAIR_COLORS.black);
    expect(getHairColor("match", "ember")).toBe(SKIN_COLORS.ember.fur);
  });

  it("has non-empty path data for every shape", () => {
    for (const shape of AVATAR_SHAPES) {
      expect(SHAPE_PATHS[shape].length).toBeGreaterThan(10);
    }
  });

  it("has ear geometry for every non-none ear id", () => {
    for (const ears of AVATAR_EARS) {
      if (ears === "none") continue;
      expect(EAR_PATHS[ears].outer.length).toBeGreaterThan(10);
      expect(EAR_PATHS[ears].inner.length).toBeGreaterThan(10);
    }
  });

  it("formats option labels for the UI", () => {
    expect(optionLabel("double-blink")).toBe("Double blink");
    expect(optionLabel("both")).toBe("Breathe + bob");
    expect(optionLabel("mohawk")).toBe("Mohawk");
  });
});

describe("svg helpers", () => {
  it("mirrors paths around the centre line", () => {
    expect(mirror("M10 20L30 40Z")).toBe("M118 20L98 40Z");
    expect(mirror("M10 20H30V5Z")).toBe("M118 20H98V5Z");
  });

  it("translates and mirrors around a local axis", () => {
    expect(transformPath("M-2 1L3 4", { mirrorX: 0, dx: 10, dy: 5 })).toBe("M12 6L7 9");
  });

  it("rejects relative or arc commands", () => {
    expect(() => transformPath("m1 1", {})).toThrow();
    expect(() => transformPath("M0 0A5 5 0 1 1 1 1", {})).toThrow();
  });

  it("builds a closed rounded polygon", () => {
    const d = roundedPolygon(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      2,
    );
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(3);
  });

  it("mixes hex colors", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#123456", "#000000", 0)).toBe("#123456");
  });
});
