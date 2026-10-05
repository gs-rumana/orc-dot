"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Pause, Play, RefreshCircle, Shuffle } from "iconsax-react";
import { AvatarCanvas } from "@/components/avatar/AvatarCanvas";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { Export3DPanel } from "@/components/studio/Export3DPanel";
import { FurryControls } from "@/components/studio/FurryControls";
import { StudioControls } from "@/components/studio/StudioControls";
import { Button } from "@/components/ui/button";
import { randomConfig } from "@/lib/avatar/random";
import { DEFAULT_CONFIG, type AvatarConfig } from "@/lib/avatar/types";
import { cn } from "@/lib/utils";
import {
  coatColors,
  DEFAULT_FURRY,
  FUR_COATS,
  FUR_COLORS,
  type Avatar3DHandle,
  type FurryOptions,
} from "@/lib/avatar/three/types";

const Avatar3DCanvas = dynamic(
  () => import("@/components/avatar/Avatar3DCanvas"),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="text-sm text-muted-foreground">
        Summoning your furry orc…
      </p>
    ),
  },
);

const DEFAULT_3D_CONFIG: AvatarConfig = {
  ...DEFAULT_CONFIG,
  eyes: "dots",
  brows: "none",
  tusks: "small",
};

const THUMB_SIZES = [96, 64, 40];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia?.(REDUCED_MOTION).matches ?? false,
    () => false,
  );
}

export function Studio() {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [svgConfig, setSvgConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
  const [threeConfig, setThreeConfig] =
    useState<AvatarConfig>(DEFAULT_3D_CONFIG);
  const [furry, setFurry] = useState<FurryOptions>(DEFAULT_FURRY);
  const [threeReady, setThreeReady] = useState(false);
  const avatarRef = useRef<Avatar3DHandle | null>(null);
  const config = mode === "3d" ? threeConfig : svgConfig;
  const setConfig = mode === "3d" ? setThreeConfig : setSvgConfig;
  // Endless motion needs a pause control (WCAG 2.2.2). Until the user picks,
  // follow their OS reduced-motion setting.
  const prefersReducedMotion = usePrefersReducedMotion();
  const [pausedOverride, setPausedOverride] = useState<boolean | null>(null);
  const paused = pausedOverride ?? prefersReducedMotion;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:py-8">
      <section
        aria-label="Preview"
        className={cn(
          "flex flex-col gap-5 rounded-3xl border bg-card p-5 shadow-sm md:sticky md:top-6",
          paused && "orc-paused",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Avatar format"
            className="flex gap-1 rounded-full bg-muted p-1"
          >
            {(["2d", "3d"] as const).map((format) => (
              <Button
                key={format}
                variant={mode === format ? "default" : "ghost"}
                size="sm"
                aria-pressed={mode === format}
                onClick={() => setMode(format)}
                className="rounded-full px-5"
              >
                {format === "2d" ? "2D SVG" : "3D furry"}
              </Button>
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {mode === "3d"
              ? "A tiny, fluffy tusked friend."
              : "Your tiny tusked friend"}
          </span>
        </div>
        <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_42%,var(--stage-glow),var(--stage)_62%)] md:min-h-[420px]">
          {mode === "3d" ? (
            <Avatar3DCanvas
              config={config}
              options={furry}
              paused={paused}
              apiRef={avatarRef}
              onReady={setThreeReady}
            />
          ) : (
            <AvatarCanvas
              config={config}
              size={300}
              className="w-[min(300px,78%)] [&_svg]:h-auto [&_svg]:w-full"
            />
          )}
          {mode === "3d" ? (
            <p className="pointer-events-none absolute bottom-4 left-0 w-full text-center text-xs font-medium text-muted-foreground">
              Drag to rotate · Scroll or pinch to zoom
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-3 right-3 gap-1.5 rounded-full"
            onClick={() => setPausedOverride(!paused)}
          >
            {paused ? (
              <Play size={16} variant="Bold" color="currentColor" />
            ) : (
              <Pause size={16} variant="Bold" color="currentColor" />
            )}
            {paused ? "Play" : "Pause"}
          </Button>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* Decorative: same avatar at small sizes. */}
          {mode === "3d" ? (
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-medium">Plush orc</h2>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start px-0 text-xs text-muted-foreground"
                disabled={!threeReady}
                onClick={() => avatarRef.current?.resetView()}
              >
                Reset view
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-4" aria-hidden="true">
              {THUMB_SIZES.map((size) => (
                <figure
                  key={size}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="rounded-full bg-muted p-1">
                    <AvatarCanvas config={config} size={size} />
                  </div>
                  <figcaption className="text-[0.7rem] font-semibold text-muted-foreground">
                    {size}px
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2 rounded-full"
              onClick={() => {
                setConfig(mode === "3d" ? DEFAULT_3D_CONFIG : DEFAULT_CONFIG);
                if (mode === "3d") {
                  setFurry(DEFAULT_FURRY);
                  avatarRef.current?.resetView();
                }
              }}
            >
              <RefreshCircle size={18} variant="Bold" color="currentColor" />
              Reset
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2 rounded-full"
              onClick={() => {
                setConfig(randomConfig());
                if (mode === "3d")
                  setFurry({
                    color: (Object.keys(FUR_COLORS) as FurryOptions["color"][])[
                      Math.floor(Math.random() * Object.keys(FUR_COLORS).length)
                    ],
                    coat: FUR_COATS[
                      Math.floor(Math.random() * FUR_COATS.length)
                    ],
                  });
              }}
            >
              <Shuffle size={18} variant="Bold" color="currentColor" />
              Randomize
            </Button>
          </div>
        </div>

        {mode === "3d" ? (
          <Export3DPanel avatarRef={avatarRef} ready={threeReady} />
        ) : (
          <ExportPanel config={config} />
        )}
      </section>

      <aside
        aria-labelledby="customize-heading"
        className="rounded-3xl border bg-card p-5 shadow-sm"
      >
        <h2 id="customize-heading" className="sr-only">
          Customize your orc
        </h2>
        {mode === "3d" ? (
          <FurryControls
            value={furry}
            skin={config.skin}
            onChange={setFurry}
            onSkinChange={(skin) => setConfig({ ...config, skin })}
          />
        ) : null}
        <StudioControls
          key={mode}
          value={config}
          onChange={setConfig}
          hidden={mode === "3d" ? ["skin"] : []}
          matchHairColor={
            mode === "3d" ? coatColors(furry, config.skin).fur : undefined
          }
        />
      </aside>
    </div>
  );
}
