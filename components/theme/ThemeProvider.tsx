"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { SITE } from "@/lib/site";

/**
 * The theme-color metas follow the OS setting via media queries. When the
 * user picks a theme in the header, point both at that theme instead so the
 * mobile browser bar matches the page.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const color =
      resolvedTheme === "dark" ? SITE.themeColorDark : SITE.themeColor;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
      meta.setAttribute("content", color);
  }, [resolvedTheme]);
  return null;
}

/**
 * Light, dark or system (the default), saved in localStorage. next-themes
 * sets the `dark` class before first paint, so a saved theme never flashes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
