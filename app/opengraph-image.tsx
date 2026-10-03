import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { buildSvg } from "@/lib/avatar/buildSvg";
import type { AvatarConfig } from "@/lib/avatar/types";
import { SITE } from "@/lib/site";

// Prerendered to a file for the static export.
export const dynamic = "force-static";

export const alt = `${SITE.name}: cute animated orc avatars with tusks, helmets and war paint`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SHOWCASE: Partial<AvatarConfig>[] = [
  { shape: "bean", skin: "forest", ears: "long", eyes: "angry", brows: "angry", tusks: "large", hair: "mohawk", markings: "warpaint", trinket: "nose-ring" },
  { shape: "blob", hair: "mohawk", tusks: "medium" },
  { shape: "egg", skin: "ember", eyes: "round", tusks: "gilded", headgear: "horned-helm", beard: "goatee", mouth: "grin" },
];

function dataUri(config: Partial<AvatarConfig>, px: number): string {
  const svg = buildSvg({ ...config, motion: "still", eyeMotion: "still" }, { size: px });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export default async function Image() {
  const fredoka = await readFile(join(process.cwd(), "assets/fonts/Fredoka-SemiBold.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 38%, #E3EDCF, #F8F3E6 65%)",
          fontFamily: "Fredoka",
          color: "#23301C",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <img src={dataUri(SHOWCASE[0], 230)} width={230} height={230} alt="" />
          <img src={dataUri(SHOWCASE[1], 290)} width={290} height={290} alt="" />
          <img src={dataUri(SHOWCASE[2], 230)} width={230} height={230} alt="" />
        </div>
        <div style={{ display: "flex", fontSize: 92, lineHeight: 1, marginTop: 18 }}>
          Orc<span style={{ color: "#3F7A2F", marginLeft: 22 }}>Dot</span>
        </div>
        <div style={{ display: "flex", fontSize: 36, marginTop: 14, color: "#55644A" }}>
          Cute animated orc avatar maker · SVG, GIF, Lottie
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Fredoka", data: fredoka, style: "normal", weight: 600 }],
    },
  );
}
