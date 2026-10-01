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
    "Make a cute animated orc avatar in seconds. Mix tusks, war paint, helmets and eye animations, then download it as an SVG with CSS animation. Free, no sign-up.",
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
  ],
  themeColor: "#3F7A2F",
  background: "#F8F3E6",
} as const;
