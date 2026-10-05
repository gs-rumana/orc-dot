"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun1 } from "iconsax-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const THEMES = [
  { value: "light", label: "Light", icon: Sun1 },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribeNothing = () => () => {};

/** False while hydrating: the saved theme is unknown when the page is prerendered. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/**
 * Crossfades the whole page into the new theme. A view transition also covers
 * what CSS transitions can't, like the stage gradient and the 3D canvas.
 */
function withCrossfade(change: () => void) {
  if (
    !document.startViewTransition ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
    return change();
  // flushSync so the new theme is on the page when the browser snapshots it.
  document.startViewTransition(() => flushSync(change));
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  return (
    <ToggleGroup
      aria-label="Theme"
      value={hydrated && theme ? [theme] : []}
      onValueChange={(v) => {
        const next = v[0];
        if (next) withCrossfade(() => setTheme(next));
      }}
      spacing={1}
      className="shrink-0 rounded-full bg-muted p-1"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          title={label}
          className="size-8 rounded-full p-0 text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          <Icon size={16} variant="Bold" color="currentColor" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
