import { buildCss } from "@/lib/avatar/buildCss";
import { buildSvg } from "@/lib/avatar/buildSvg";
import type { AvatarConfig } from "@/lib/avatar/types";

/**
 * One self-contained SVG file with its CSS embedded. Styles inside the file
 * apply even when it's loaded through <img>, so it animates anywhere SVG is
 * allowed. The reduced-motion guard is kept.
 */
export function buildAnimatedSvg(config: AvatarConfig, { size = 512 }: { size?: number } = {}): string {
  const svg = buildSvg(config, { size });
  const css = buildCss(config);
  const open = svg.indexOf(">") + 1;
  return `${svg.slice(0, open)}<style>${css}</style>${svg.slice(open)}`;
}
