import { aroundOrigin, type Matrix } from "@/lib/avatar/export/matrix";
import { num } from "@/lib/avatar/svg";
import type { AnimationSample, Track } from "@/lib/avatar/export/sample";

export function parseSvg(markup: string): SVGSVGElement {
  return new DOMParser().parseFromString(markup, "image/svg+xml").documentElement as unknown as SVGSVGElement;
}

export function resolvePath(root: Element, path: number[]): Element {
  return path.reduce<Element>((node, i) => node.children[i], root);
}

/** Matrix coefficients need more precision than path data (scales like 0.988). */
const fine = (v: number) => String(Math.round(v * 1e4) / 1e4);

/** Track transform for frame `i`, with its pivot folded in. */
export function frameMatrix(track: Track, i: number): Matrix | undefined {
  const m = track.transforms?.[i];
  return m && aroundOrigin(m, track.origin);
}

/**
 * Returns a function that writes frame `i` as a static SVG string: each
 * animated part gets its sampled pose as a plain `transform`/`opacity`
 * attribute, so no CSS is needed to draw it (e.g. onto a canvas).
 */
export function createFrameRenderer(sample: AnimationSample, size: number) {
  const svg = parseSvg(sample.svg);
  svg.setAttribute("viewBox", sample.viewBox.map(num).join(" "));
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  const parts = sample.tracks.map((track) => ({ track, el: resolvePath(svg, track.path) }));
  const serializer = new XMLSerializer();

  return (i: number): string => {
    for (const { track, el } of parts) {
      const m = frameMatrix(track, i);
      if (m) el.setAttribute("transform", `matrix(${m.map(fine).join(" ")})`);
      const opacity = track.opacity?.[i];
      if (opacity !== undefined) el.setAttribute("opacity", fine(opacity));
    }
    return serializer.serializeToString(svg);
  };
}
