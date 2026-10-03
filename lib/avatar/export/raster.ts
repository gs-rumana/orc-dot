import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { createFrameRenderer } from "@/lib/avatar/export/frames";
import { sampleAnimation } from "@/lib/avatar/export/sample";
import type { AvatarConfig } from "@/lib/avatar/types";

/** Browser-only raster exports: still PNG and looping GIF. */

export type Background = "transparent" | "white";

function loadSvg(markup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not render the SVG"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function createCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  return { canvas, ctx };
}

async function draw(ctx: CanvasRenderingContext2D, markup: string, size: number, background: Background) {
  const img = await loadSvg(markup);
  ctx.clearRect(0, 0, size, size);
  if (background === "white") {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(img, 0, 0, size, size);
}

export async function exportPng(
  config: AvatarConfig,
  { size, background }: { size: number; background: Background },
): Promise<Blob> {
  const { canvas, ctx } = createCanvas(size);
  await draw(ctx, buildSvg(config, { size }), size, background);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png"),
  );
}

const GIF_FPS = 20; // GIF delays are whole centiseconds: 5cs per frame.

export async function exportGif(
  config: AvatarConfig,
  {
    size,
    background,
    onProgress,
  }: { size: number; background: Background; onProgress?: (fraction: number) => void },
): Promise<Blob> {
  const sample = await sampleAnimation(config, { fps: GIF_FPS });
  const render = createFrameRenderer(sample, size);
  const { ctx } = createCanvas(size);
  const transparent = background === "transparent";
  const format = transparent ? "rgba4444" : "rgb565";

  const pixels = async (i: number) => {
    await draw(ctx, render(i), size, background);
    return ctx.getImageData(0, 0, size, size).data;
  };

  // One shared palette, built from a spread of frames, avoids colour flicker.
  const total = sample.frameCount;
  const picks = [...new Set(Array.from({ length: 12 }, (_, k) => Math.floor((k * total) / 12)))];
  const pool = new Uint8ClampedArray(picks.length * size * size * 4);
  for (const [n, i] of picks.entries()) pool.set(await pixels(i), n * size * size * 4);
  const palette = quantize(pool, transparent ? 256 : 255, { format, oneBitAlpha: transparent });
  onProgress?.(0.1);

  // Opaque GIFs reserve one extra index for "unchanged since the last frame"
  // and keep each frame on screen (dispose 1), so only changed pixels cost
  // bytes. Transparent GIFs can't express opaque → clear that way, so they
  // send full frames and clear between them (dispose 2).
  const clearIndex = transparent ? palette.findIndex((c) => c[3] === 0) : palette.length;
  const framePalette = transparent ? palette : [...palette, [255, 0, 255]];

  const gif = GIFEncoder();
  const delay = Math.round((sample.duration * 1000) / total / 10) * 10;
  let previous: Uint8Array | null = null;
  for (let i = 0; i < total; i++) {
    const index = applyPalette(await pixels(i), palette, format);
    let out = index;
    if (!transparent && previous) {
      out = index.slice();
      for (let p = 0; p < out.length; p++) if (out[p] === previous[p]) out[p] = clearIndex;
    }
    gif.writeFrame(out, size, size, {
      palette: i === 0 ? framePalette : undefined,
      delay,
      repeat: 0,
      transparent: clearIndex >= 0 && (transparent || i > 0),
      transparentIndex: Math.max(0, clearIndex),
      dispose: transparent ? 2 : 1,
    });
    previous = index;
    onProgress?.(0.1 + (0.9 * (i + 1)) / total);
  }
  gif.finish();
  return new Blob([gif.bytesView()], { type: "image/gif" });
}
