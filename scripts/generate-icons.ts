/**
 * Regenerates the site icons from the avatar renderer.
 * Run with: npm run icons
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { SITE } from "@/lib/site";
import type { AvatarConfig } from "@/lib/avatar/types";

/** The brand orc: static, so it reads well at favicon sizes. */
export const BRAND_ORC: Partial<AvatarConfig> = {
  hair: "mohawk",
  tusks: "medium",
  motion: "still",
  eyeMotion: "still",
};

const root = join(__dirname, "..");
const svg = buildSvg(BRAND_ORC, { size: 128 });

async function png(size: number, background?: string): Promise<Buffer> {
  const avatar = await sharp(Buffer.from(buildSvg(BRAND_ORC, { size: 512 })))
    .resize(Math.round(size * (background ? 0.86 : 1)))
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: avatar, gravity: "center" }])
    .png()
    .toBuffer();
}

/** Minimal ICO container holding PNG-encoded frames. */
function ico(frames: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...frames.map((f) => f.data)]);
}

async function main() {
  writeFileSync(join(root, "app/icon.svg"), svg);
  writeFileSync(join(root, "app/apple-icon.png"), await png(180, SITE.background));
  writeFileSync(join(root, "public/icon-512.png"), await png(512, SITE.background));
  const frames = await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, data: await png(size) })),
  );
  writeFileSync(join(root, "app/favicon.ico"), ico(frames));
  console.log("Icons written.");
}

main();
