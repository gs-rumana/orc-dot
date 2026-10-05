/**
 * Site-wide SEO settings. NEXT_PUBLIC_SITE_URL (set in .env.production,
 * currently https://orc-dot.web.app) is the production origin used for
 * canonical URLs, Open Graph images and the sitemap. When it is unset,
 * a Vercel production URL is used if present, else localhost.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[site] NEXT_PUBLIC_SITE_URL is not set: canonical URLs, sitemap and social images will point at localhost.",
    );
  }
  return "http://localhost:3000";
}

export const SITE = {
  name: "Orc Dot",
  url: resolveSiteUrl(),
  title: "Orc Dot – Cute Animated Orc Avatar Maker",
  description:
    "Make cute animated orcs in 2D or soft, furry avatars in 3D. Mix tusks, war paint and gear, then export as SVG, PNG, GIF, Lottie or GLB. Free, no sign-up.",
  keywords: [
    "orc avatar",
    "orc avatar maker",
    "animated avatar",
    "avatar generator",
    "SVG avatar",
    "cute orc",
    "profile picture maker",
    "fantasy avatar",
    "CSS animation",
    "animated GIF avatar",
    "Lottie animation",
    "3D furry avatar",
    "Three.js avatar",
  ],
  themeColor: "#3F7A2F",
  /** Browser bar in dark mode: the dark theme's page background. */
  themeColorDark: "#131313",
  background: "#F8F3E6",
} as const;
