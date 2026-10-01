import { describe, expect, it } from "vitest";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { normalizeConfig } from "@/lib/avatar/normalize";
import { SKIN_COLORS } from "@/lib/avatar/catalog";
import { AVATAR_OPTIONS, type AvatarConfig } from "@/lib/avatar/types";

function parse(svg: string) {
  return new DOMParser().parseFromString(svg, "image/svg+xml");
}

describe("buildSvg", () => {
  it("emits svg with shared viewBox and root class", () => {
    const svg = buildSvg(normalizeConfig({}));
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 128 128"');
    expect(svg).toContain('class="orc-avatar');
    expect(svg).toContain("orc-avatar__body");
    expect(svg).toContain('width="128"');
  });

  it("honours a custom size", () => {
    expect(buildSvg({}, { size: 48 })).toContain('width="48" height="48"');
  });

  it.each([
    ["breathe", ["orc-avatar--breathe"], ["orc-avatar--bob"]],
    ["bob", ["orc-avatar--bob"], ["orc-avatar--breathe"]],
    ["both", ["orc-avatar--breathe", "orc-avatar--bob"], []],
    ["sway", ["orc-avatar--sway"], ["orc-avatar--breathe"]],
    ["hop", ["orc-avatar--hop"], ["orc-avatar--bob"]],
    ["still", [], ["orc-avatar--breathe", "orc-avatar--bob"]],
  ] as const)("applies motion modifiers for motion=%s", (motion, present, absent) => {
    const svg = buildSvg(normalizeConfig({ motion }));
    for (const cls of present) expect(svg).toContain(cls);
    for (const cls of absent) expect(svg).not.toContain(cls);
  });

  it("adds an eye-motion modifier unless eyes are still or absent", () => {
    expect(buildSvg({ eyeMotion: "look-around" })).toContain("orc-avatar--eyes-look-around");
    expect(buildSvg({ eyeMotion: "still" })).not.toContain("orc-avatar--eyes-");
    expect(buildSvg({ eyes: "none", eyeMotion: "wink" })).not.toContain("orc-avatar--eyes-");
  });

  it("renders separate pupils inside each eye so gaze can move independently", () => {
    const doc = parse(buildSvg({ eyes: "round" }));
    expect(doc.querySelectorAll(".orc-avatar__eye")).toHaveLength(2);
    expect(doc.querySelectorAll(".orc-avatar__eye .orc-avatar__pupil")).toHaveLength(2);
  });

  it("hides the covered eye under an eyepatch", () => {
    const doc = parse(buildSvg({ trinket: "eyepatch" }));
    expect(doc.querySelector(".orc-avatar__eye--left")).not.toBeNull();
    expect(doc.querySelector(".orc-avatar__eye--right")).toBeNull();
  });

  it("omits optional groups when set to none", () => {
    const svg = buildSvg({
      ears: "none",
      eyes: "none",
      brows: "none",
      tusks: "none",
      hair: "none",
      beard: "none",
      headgear: "none",
      markings: "none",
      trinket: "none",
    });
    for (const cls of [
      "__ears",
      "__eyes",
      "__brows",
      "__tusks",
      "__hair",
      "__beard",
      "__headgear",
      "__markings",
      "__trinket",
    ]) {
      expect(svg).not.toContain(`orc-avatar${cls}`);
    }
  });

  it("puts earrings on the ears", () => {
    const doc = parse(buildSvg({ ears: "long", trinket: "earrings" }));
    expect(doc.querySelectorAll(".orc-avatar__ear .orc-avatar__earring")).toHaveLength(2);
  });

  it("fills body with skin color", () => {
    const svg = buildSvg(normalizeConfig({ skin: "forest" }));
    expect(svg).toContain(SKIN_COLORS.forest.fill);
  });

  it("does not put CSS-animated groups under a transform attribute", () => {
    // CSS transforms replace the SVG transform attribute, so animated groups
    // must not rely on one for positioning.
    const doc = parse(
      buildSvg({ ears: "pointy", trinket: "nose-ring", headgear: "bandana", hair: "braids" }),
    );
    for (const g of doc.querySelectorAll("g")) {
      expect(g.hasAttribute("transform")).toBe(false);
    }
  });

  it("layers back-to-front: hair-back, ears, body, face, hair-front, headgear", () => {
    const svg = buildSvg({
      hair: "braids",
      ears: "pointy",
      headgear: "bandana",
      beard: "full",
      tusks: "medium",
    });
    const order = [
      "orc-avatar__hair--back",
      "orc-avatar__ears",
      "orc-avatar__body",
      "orc-avatar__face",
      "orc-avatar__beard",
      "orc-avatar__eyes",
      "orc-avatar__tusks",
      "orc-avatar__headgear",
    ].map((cls) => svg.indexOf(cls));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("produces well-formed XML for every single option", () => {
    for (const field of Object.keys(AVATAR_OPTIONS) as (keyof AvatarConfig)[]) {
      for (const value of AVATAR_OPTIONS[field]) {
        const doc = parse(buildSvg({ [field]: value }));
        expect(doc.querySelector("parsererror"), `${field}=${value}`).toBeNull();
        expect(doc.documentElement.getAttribute("class")).toContain("orc-avatar");
      }
    }
  });
});
