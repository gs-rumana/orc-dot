import { describe, expect, it } from "vitest";
import { buildCss } from "@/lib/avatar/buildCss";
import { normalizeConfig } from "@/lib/avatar/normalize";
import { AVATAR_EYE_MOTIONS } from "@/lib/avatar/types";

describe("buildCss", () => {
  it("always includes base rules with view-box pivots", () => {
    const css = buildCss(normalizeConfig({}));
    expect(css).toContain(".orc-avatar {");
    expect(css).toContain("transform-box: view-box");
    expect(css).toContain(".orc-avatar__rig");
    expect(css).toContain("transform-origin: 64px 114px");
  });

  it("emits breathe keyframes and rule when motion is breathe", () => {
    const css = buildCss(normalizeConfig({ motion: "breathe" }));
    expect(css).toContain("@keyframes orc-avatar-breathe");
    expect(css).toContain(".orc-avatar--breathe .orc-avatar__rig");
    expect(css).not.toContain(".orc-avatar--bob");
  });

  it("emits bob keyframes and rule when motion is bob", () => {
    const css = buildCss(normalizeConfig({ motion: "bob" }));
    expect(css).toContain("@keyframes orc-avatar-bob");
    expect(css).toContain(".orc-avatar--bob .orc-avatar__rig");
    expect(css).not.toContain(".orc-avatar--breathe");
  });

  it("emits combined breathe+bob when motion is both", () => {
    const css = buildCss(normalizeConfig({ motion: "both" }));
    expect(css).toContain("@keyframes orc-avatar-breathe-bob");
    expect(css).toContain(".orc-avatar--breathe.orc-avatar--bob");
  });

  it("adds follow-through on the face and headgear", () => {
    const css = buildCss(normalizeConfig({ motion: "hop" }));
    expect(css).toMatch(/\.orc-avatar--hop \.orc-avatar__face \{\s*animation: orc-avatar-hop-face/);
    expect(css).toMatch(/\.orc-avatar--hop \.orc-avatar__headgear \{\s*animation: orc-avatar-hop-face/);
  });

  it("emits no body or secondary animation when motion is still", () => {
    const css = buildCss(normalizeConfig({ motion: "still", ears: "pointy" }));
    expect(css).not.toContain(".orc-avatar__rig {\n  animation");
    expect(css).not.toContain("orc-avatar-ear-left");
  });

  it("twitches ears only when the orc has ears", () => {
    expect(buildCss({ ears: "pointy" })).toContain("@keyframes orc-avatar-ear-left");
    expect(buildCss({ ears: "none" })).not.toContain("orc-avatar-ear-left");
  });

  it("swings dangling accessories", () => {
    expect(buildCss({ trinket: "nose-ring" })).toContain(".orc-avatar__trinket--nose-ring");
    expect(buildCss({ headgear: "bandana" })).toContain("@keyframes orc-avatar-flutter");
    expect(buildCss({ hair: "braids" })).toContain(".orc-avatar__braid--left");
  });

  it.each(AVATAR_EYE_MOTIONS.filter((m) => m !== "still"))(
    "emits rules for eye motion %s",
    (eyeMotion) => {
      const css = buildCss(normalizeConfig({ eyeMotion }));
      expect(css).toContain(`.orc-avatar--eyes-${eyeMotion}`);
      expect(css).toMatch(/@keyframes orc-avatar-[\w-]+/);
    },
  );

  it("omits eye animation when eyes are none or still", () => {
    expect(buildCss({ eyes: "none" })).not.toContain("orc-avatar--eyes-");
    expect(buildCss({ eyeMotion: "still" })).not.toContain("orc-avatar--eyes-");
  });

  it("pulses glowing eyes", () => {
    expect(buildCss({ eyes: "glow" })).toContain("@keyframes orc-avatar-glow");
    expect(buildCss({ eyes: "round" })).not.toContain("orc-avatar-glow");
  });

  it("respects prefers-reduced-motion by default, but can opt out for previews", () => {
    expect(buildCss({})).toContain("prefers-reduced-motion");
    expect(buildCss({}, { reducedMotion: false })).not.toContain("prefers-reduced-motion");
  });

  it("uses multi-second periods for idle motion", () => {
    const css = buildCss(normalizeConfig({ motion: "both" }));
    expect(css).toMatch(/animation:\s*orc-avatar-breathe-bob\s+[\d.]+s/);
  });
});
