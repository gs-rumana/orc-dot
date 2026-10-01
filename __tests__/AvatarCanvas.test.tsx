import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvatarCanvas } from "@/components/avatar/AvatarCanvas";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { normalizeConfig } from "@/lib/avatar/normalize";

describe("AvatarCanvas", () => {
  it("renders an svg with orc-avatar class and aria-label", () => {
    render(<AvatarCanvas config={normalizeConfig({})} />);
    const svg = screen.getByRole("img", { name: /orc avatar/i });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveClass("orc-avatar");
    expect(svg).toHaveClass("orc-avatar--breathe");
  });

  it("applies both motion classes when motion is both", () => {
    render(<AvatarCanvas config={normalizeConfig({ motion: "both" })} />);
    const svg = screen.getByRole("img", { name: /orc avatar/i });
    expect(svg).toHaveClass("orc-avatar--breathe");
    expect(svg).toHaveClass("orc-avatar--bob");
  });

  it("renders exactly the exported markup at the requested size", () => {
    const config = normalizeConfig({ hair: "mohawk", beard: "goatee" });
    const { container } = render(<AvatarCanvas config={config} size={200} />);
    const expected = new DOMParser().parseFromString(
      buildSvg(config, { size: 200 }),
      "image/svg+xml",
    ).documentElement;
    expect(container.querySelector("svg")!.isEqualNode(expected)).toBe(true);
  });

  it("injects animation CSS for the preview", () => {
    const { container } = render(
      <AvatarCanvas config={normalizeConfig({ eyeMotion: "wink" })} />,
    );
    expect(container.querySelector("style")!.textContent).toContain(
      "orc-avatar--eyes-wink",
    );
  });
});
