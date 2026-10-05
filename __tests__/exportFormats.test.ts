import { describe, expect, it } from "vitest";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { buildAnimatedSvg } from "@/lib/avatar/export/animatedSvg";
import { createFrameRenderer, parseSvg, resolvePath } from "@/lib/avatar/export/frames";
import { animated, buildLottie, color, pathToBeziers } from "@/lib/avatar/export/lottie";
import { aroundOrigin, decompose, multiply, parseTransform, type Matrix } from "@/lib/avatar/export/matrix";
import { chooseLoop, type AnimationSample } from "@/lib/avatar/export/sample";
import { normalizeConfig } from "@/lib/avatar/normalize";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("buildAnimatedSvg", () => {
  it("embeds the CSS so the file animates on its own", () => {
    const svg = buildAnimatedSvg(normalizeConfig({ motion: "hop", eyeMotion: "wink" }));
    const doc = parseSvg(svg);
    expect(doc.querySelector("parsererror")).toBeNull();
    const style = doc.querySelector("style")!.textContent!;
    expect(style).toContain("@keyframes orc-avatar-hop");
    expect(style).toContain("prefers-reduced-motion");
    expect(doc.getAttribute("class")).toContain("orc-avatar--hop");
  });
});

describe("matrix helpers", () => {
  it("parses SVG transform lists", () => {
    close(parseTransform("translate(3 4) scale(2)"), [2, 0, 0, 2, 3, 4]);
    close(parseTransform("rotate(90 10 10)"), [0, 1, -1, 0, 20, 0]);
    close(parseTransform("none"), [1, 0, 0, 1, 0, 0]);
  });

  it("decomposes translate · rotate · scale and rebuilds it", () => {
    const m = parseTransform("translate(5 -2) rotate(-7) scale(1.04 0.96)");
    const { translate, rotate, scale } = decompose(m);
    close(translate, [5, -2]);
    expect(rotate).toBeCloseTo(-7, 6);
    close(scale, [1.04, 0.96]);
    const rebuilt = multiply(parseTransform(`translate(${translate}) rotate(${rotate})`), [scale[0], 0, 0, scale[1], 0, 0]);
    close(rebuilt, m);
  });

  it("applies a matrix around a pivot like transform-origin", () => {
    const scaleUp: Matrix = [2, 0, 0, 2, 0, 0];
    const m = aroundOrigin(scaleUp, [10, 10]);
    // The pivot stays put.
    close([m[0] * 10 + m[2] * 10 + m[4], m[1] * 10 + m[3] * 10 + m[5]], [10, 10]);
  });
});

describe("chooseLoop", () => {
  it("loops a single cycle as is", () => {
    expect(chooseLoop([4.4, 4.4])).toEqual({ loop: 4.4, rates: [1, 1] });
  });

  it("fits whole cycles of every animation into the loop", () => {
    const durations = [4.4, 7.2, 6.8, 8.6];
    const { loop, rates } = chooseLoop(durations);
    expect(loop).toBeGreaterThanOrEqual(1.5);
    expect(loop).toBeLessThanOrEqual(10);
    durations.forEach((d, i) => {
      const cycles = (loop * rates[i]) / d;
      expect(cycles).toBeCloseTo(Math.round(cycles), 6);
      expect(Math.abs(Math.log(rates[i]))).toBeLessThan(0.25);
    });
  });

  it("reports no loop when nothing moves", () => {
    expect(chooseLoop([]).loop).toBe(0);
  });
});

describe("pathToBeziers", () => {
  it("turns lines and cubics into vertices with relative tangents", () => {
    const [sub] = pathToBeziers("M0 0L10 0C10 5 5 10 0 10Z");
    expect(sub.c).toBe(true);
    expect(sub.v).toEqual([[0, 0], [10, 0], [0, 10]]);
    expect(sub.o[1]).toEqual([0, 5]);
    expect(sub.i[2]).toEqual([5, 0]);
  });

  it("merges a closing point that repeats the start", () => {
    const [sub] = pathToBeziers("M0 0C5 -5 10 -5 10 0C10 5 5 5 0 0Z");
    expect(sub.v).toHaveLength(2);
    expect(sub.i[0]).toEqual([5, 5]);
  });

  it("handles H, V, quadratics, relative commands and several subpaths", () => {
    const subs = pathToBeziers("M0 0H10V10Q5 15 0 10Z m20 0 l5 5");
    expect(subs).toHaveLength(2);
    expect(subs[0].v).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
    // Q control (5,15) → cubic controls at 2/3 of the way.
    close(subs[0].o[2], [-10 / 3, 10 / 3]);
    expect(subs[1].v).toEqual([[20, 0], [25, 5]]);
    expect(subs[1].c).toBe(false);
  });
});

describe("Lottie helpers", () => {
  it("converts hex colours to 0–1 RGBA", () => {
    expect(color("#FF8000")).toEqual([1, 0.502, 0, 1]);
  });

  it("keeps constant values static and drops in-between linear frames", () => {
    expect(animated([[1, 2], [1, 2]], 0.01)).toEqual({ a: 0, k: [1, 2] });
    const ramp = animated([[0], [1], [2], [3], [2], [1]], 0.01, true) as { a: number; k: { t: number }[] };
    expect(ramp.a).toBe(1);
    expect(ramp.k.map((k) => k.t)).toEqual([0, 3, 6]);
  });
});

function fakeSample(): AnimationSample {
  const config = normalizeConfig({ motion: "sway", eyes: "glow", eyeMotion: "blink" });
  const svg = buildSvg(config);
  const doc = parseSvg(svg);
  const pathOf = (selector: string) => {
    const el = doc.querySelector(selector)!;
    const path: number[] = [];
    for (let node: Element = el; node !== doc; node = node.parentElement!) {
      path.unshift([...node.parentElement!.children].indexOf(node));
    }
    return path;
  };
  const frames = 4;
  return {
    svg,
    viewBox: [-4, -4, 136, 136],
    fps: 2,
    duration: 2,
    frameCount: frames,
    tracks: [
      {
        path: pathOf(".orc-avatar__rig"),
        origin: [64, 114],
        transforms: Array.from({ length: frames }, (_, i) => parseTransform(`rotate(${[-2, 0, 2, 0][i]})`)),
      },
      { path: pathOf(".orc-avatar__glow"), origin: [0, 0], opacity: [0.25, 0.4, 0.6, 0.4] },
    ],
  };
}

describe("createFrameRenderer", () => {
  it("bakes each frame's pose into plain attributes", () => {
    const sample = fakeSample();
    const render = createFrameRenderer(sample, 64);
    const frame = parseSvg(render(0));
    expect(frame.getAttribute("viewBox")).toBe("-4 -4 136 136");
    expect(frame.getAttribute("width")).toBe("64");
    const rig = resolvePath(frame, sample.tracks[0].path);
    const m = parseTransform(rig.getAttribute("transform"));
    // Rotating around the rig pivot leaves the pivot in place.
    expect(m[0] * 64 + m[2] * 114 + m[4]).toBeCloseTo(64, 2);
    expect(m[1] * 64 + m[3] * 114 + m[5]).toBeCloseTo(114, 2);
    expect(decompose(m).rotate).toBeCloseTo(-2, 3);
    expect(resolvePath(parseSvg(render(2)), sample.tracks[1].path).getAttribute("opacity")).toBe("0.6");
  });
});

describe("buildLottie", () => {
  type Item = { ty: string; nm?: string; it?: Item[]; [k: string]: unknown };
  const walk = (items: Item[], out: Item[] = []) => {
    for (const item of items) {
      out.push(item);
      if (item.it) walk(item.it, out);
    }
    return out;
  };

  it("builds one vector shape layer that mirrors the SVG", () => {
    const sample = fakeSample();
    const lottie = buildLottie(sample) as { op: number; fr: number; w: number; layers: { ty: number; shapes: Item[] }[] };
    expect(lottie).toMatchObject({ v: expect.any(String), fr: 2, ip: 0, op: 4, w: 512, h: 512 });
    expect(lottie.layers).toHaveLength(1);
    expect(lottie.layers[0].ty).toBe(4);

    const items = walk(lottie.layers[0].shapes);
    const doc = parseSvg(sample.svg);
    const ellipses = doc.querySelectorAll("circle, ellipse").length;
    expect(items.filter((i) => i.ty === "el")).toHaveLength(ellipses);
    expect(items.filter((i) => i.ty === "rc")).toHaveLength(doc.querySelectorAll("rect").length);
    // Every group ends with its transform.
    for (const group of items.filter((i) => i.ty === "gr")) expect(group.it!.at(-1)!.ty).toBe("tr");
  });

  it("animates the rig around its pivot and the glow's opacity", () => {
    const items = walk((buildLottie(fakeSample()) as { layers: { shapes: Item[] }[] }).layers[0].shapes);
    const rig = items.find((i) => i.nm === "orc-avatar__rig")!;
    const tr = rig.it!.at(-1)! as unknown as Record<string, { a: number; k: unknown }>;
    expect(tr.a).toEqual({ a: 0, k: [64, 114] });
    expect(tr.r.a).toBe(1);
    const keys = tr.r.k as { t: number; s: number[] }[];
    expect(keys[0].s[0]).toBeCloseTo(-2, 3);
    expect(keys.at(-1)!.t).toBe(4); // loops back to frame 0's value
    expect(keys.at(-1)!.s[0]).toBeCloseTo(-2, 3);

    // Only the sampled (left) glow animates; the right one keeps its static opacity.
    const glows = items
      .filter((i) => i.nm === "orc-avatar__glow")
      .map((g) => (g.it!.at(-1)! as unknown as Record<string, { a: number }>).o.a);
    expect(glows.sort()).toEqual([0, 1]);
  });
});
