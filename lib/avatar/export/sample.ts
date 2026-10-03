import { buildCss } from "@/lib/avatar/buildCss";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { normalizeConfig } from "@/lib/avatar/normalize";
import { parseTransform, type Matrix } from "@/lib/avatar/export/matrix";
import type { AvatarConfig } from "@/lib/avatar/types";

/** One animated element, sampled once per frame. */
export interface Track {
  /** Child-element indices from the <svg> root down to the element. */
  path: number[];
  /** Pivot in viewBox units (resolved transform-origin). */
  origin: [number, number];
  /** Raw CSS transform per frame, applied around `origin`. */
  transforms?: Matrix[];
  opacity?: number[];
}

/** A seamless loop of the avatar's animation, baked into per-frame values. */
export interface AnimationSample {
  /** Rest-pose markup the tracks refer to (viewBox 0 0 128 128). */
  svg: string;
  /** Square framing [x, y, size, size] that fits every frame. */
  viewBox: [number, number, number, number];
  fps: number;
  /** Seconds per loop. */
  duration: number;
  frameCount: number;
  tracks: Track[];
}

const MIN_LOOP = 1.5;
const MAX_LOOP = 10;

/**
 * Picks a loop length for animations with different cycle times. Each
 * animation is then retimed to fit a whole number of cycles into the loop;
 * the length chosen is the one that stretches them the least.
 */
export function chooseLoop(durations: number[]): { loop: number; rates: number[] } {
  const unique = [...new Set(durations.filter((d) => d > 0))];
  if (!unique.length) return { loop: 0, rates: durations.map(() => 1) };
  const fit = (loop: number, d: number) => Math.max(1, Math.round(loop / d));
  const cost = (loop: number) => unique.reduce((sum, d) => sum + Math.abs(Math.log((fit(loop, d) * d) / loop)), 0);

  let best = 0;
  let bestCost = Infinity;
  for (const d of unique) {
    for (let m = 1; m === 1 || m * d <= MAX_LOOP; m++) {
      const loop = m * d;
      if (loop < MIN_LOOP) continue;
      const c = cost(loop);
      // Prefer the shorter loop unless the longer one is clearly smoother.
      if (c < bestCost - 1e-3 || (Math.abs(c - bestCost) <= 1e-3 && loop < best)) {
        best = loop;
        bestCost = c;
      }
    }
  }
  return { loop: best, rates: durations.map((d) => (d > 0 ? (fit(best, d) * d) / best : 1)) };
}

function pathTo(el: Element, root: Element): number[] {
  const path: number[] = [];
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    path.unshift(Array.prototype.indexOf.call(node.parentElement!.children, node));
  }
  return path;
}

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Plays the avatar's real CSS animations in a hidden, style-isolated DOM and
 * steps them with the Web Animations API, recording every animated part's
 * transform and opacity per frame. Browser only.
 */
export async function sampleAnimation(
  input: AvatarConfig,
  { fps }: { fps: number },
): Promise<AnimationSample> {
  const config = normalizeConfig(input);
  const svgMarkup = buildSvg(config, { size: 128 });
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:128px;height:128px;opacity:0;pointer-events:none;contain:strict";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${buildCss(config, { reducedMotion: false })}</style>${svgMarkup}`;
  document.body.append(host);

  try {
    await nextFrame();
    const svg = shadow.querySelector("svg")!;
    const rig = svg.querySelector(".orc-avatar__rig");
    const animations = svg.getAnimations({ subtree: true });
    const timings = animations.map((a) => a.effect!.getComputedTiming());
    const { loop, rates } = chooseLoop(timings.map((t) => Number(t.duration) / 1000));
    const frameCount = loop ? Math.max(1, Math.round(loop * fps)) : 1;
    // Start past every delay so all parts are mid-cycle on frame 0.
    const start = Math.max(0, ...timings.map((t) => Number(t.delay))) + 1000;

    const tracks = new Map<Element, Track>();
    for (const anim of animations) {
      anim.pause();
      const target = (anim.effect as KeyframeEffect).target as SVGGraphicsElement;
      const props = new Set(
        (anim.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)),
      );
      let track = tracks.get(target);
      if (!track) {
        const style = getComputedStyle(target);
        const [ox, oy] = style.transformOrigin.split(" ").map(parseFloat);
        const box = style.transformBox === "fill-box" ? target.getBBox() : { x: 0, y: 0 };
        track = { path: pathTo(target, svg), origin: [box.x + ox, box.y + oy] };
        tracks.set(target, track);
      }
      if (props.has("transform")) track.transforms = [];
      if (props.has("opacity")) track.opacity = [];
    }

    // Union of the rig's extent over the loop, in viewBox units.
    const svgBox = svg.getBoundingClientRect();
    const scale = 128 / svgBox.width;
    let [minX, minY, maxX, maxY] = [0, 0, 128, 128];

    for (let i = 0; i < frameCount; i++) {
      const t = (i / frameCount) * loop * 1000;
      animations.forEach((anim, k) => {
        anim.currentTime = start + t * rates[k];
      });
      for (const [el, track] of tracks) {
        const style = getComputedStyle(el);
        track.transforms?.push(parseTransform(style.transform));
        track.opacity?.push(parseFloat(style.opacity));
      }
      if (rig) {
        const r = rig.getBoundingClientRect();
        // Outlines aren't part of the geometry box, so leave room for them.
        const pad = 4;
        minX = Math.min(minX, (r.left - svgBox.left) * scale - pad);
        minY = Math.min(minY, (r.top - svgBox.top) * scale - pad);
        maxX = Math.max(maxX, (r.right - svgBox.left) * scale + pad);
        maxY = Math.max(maxY, (r.bottom - svgBox.top) * scale + pad);
      }
      if (i % 20 === 19) await nextFrame();
    }

    // Square framing, kept centred on the head horizontally.
    const half = Math.max(64 - minX, maxX - 64);
    const size = Math.ceil(Math.max(half * 2, maxY - minY));
    const top = (minY + maxY) / 2 - size / 2;
    const viewBox: AnimationSample["viewBox"] = [64 - size / 2, Math.round(top * 2) / 2, size, size];

    return {
      svg: svgMarkup,
      viewBox,
      fps,
      duration: loop || 1 / fps,
      frameCount,
      tracks: [...tracks.values()],
    };
  } finally {
    host.remove();
  }
}
