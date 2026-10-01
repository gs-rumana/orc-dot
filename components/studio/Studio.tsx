"use client";

import { useState, useSyncExternalStore } from "react";
import { Pause, Play, RefreshCircle, Shuffle } from "iconsax-react";
import { AvatarCanvas } from "@/components/avatar/AvatarCanvas";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { StudioControls } from "@/components/studio/StudioControls";
import { Button } from "@/components/ui/button";
import { randomConfig } from "@/lib/avatar/random";
import { DEFAULT_CONFIG, type AvatarConfig } from "@/lib/avatar/types";
import { cn } from "@/lib/utils";

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
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
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
        <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_42%,oklch(0.93_0.05_125),oklch(0.955_0.02_95)_62%)] md:min-h-[420px]">
          <AvatarCanvas
            config={config}
            size={300}
            className="w-[min(300px,78%)] [&_svg]:h-auto [&_svg]:w-full"
          />
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
          <div className="flex items-end gap-4" aria-hidden="true">
            {THUMB_SIZES.map((size) => (
              <figure key={size} className="flex flex-col items-center gap-1.5">
                <div className="rounded-full bg-muted p-1">
                  <AvatarCanvas config={config} size={size} />
                </div>
                <figcaption className="text-[0.7rem] font-semibold text-muted-foreground">
                  {size}px
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2 rounded-full"
              onClick={() => setConfig(DEFAULT_CONFIG)}
            >
              <RefreshCircle size={18} variant="Bold" color="currentColor" />
              Reset
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2 rounded-full"
              onClick={() => setConfig(randomConfig())}
            >
              <Shuffle size={18} variant="Bold" color="currentColor" />
              Randomize
            </Button>
          </div>
        </div>

        <ExportPanel config={config} />
      </section>

      <aside aria-labelledby="customize-heading" className="rounded-3xl border bg-card p-5 shadow-sm">
        <h2 id="customize-heading" className="sr-only">
          Customize your orc
        </h2>
        <StudioControls value={config} onChange={setConfig} />
      </aside>
    </div>
  );
}
