"use client";

import { useMemo } from "react";
import { buildCss } from "@/lib/avatar/buildCss";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { normalizeConfig } from "@/lib/avatar/normalize";
import type { AvatarConfig } from "@/lib/avatar/types";
import { cn } from "@/lib/utils";

/**
 * Renders the exact markup that Export produces, so the preview can never
 * drift from the downloaded SVG. The markup is generated from a normalized
 * config of known preset ids only — no user strings reach the HTML.
 */
export function AvatarCanvas({
  config,
  className,
  size = 256,
}: {
  config: AvatarConfig;
  className?: string;
  size?: number;
}) {
  const { svg, css } = useMemo(() => {
    const cfg = normalizeConfig(config);
    // Preview always animates; the exported CSS keeps the reduced-motion guard.
    return { svg: buildSvg(cfg, { size }), css: buildCss(cfg, { reducedMotion: false }) };
  }, [config, size]);

  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      <style>{css}</style>
      <div className="contents" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
