<div align="center">

<img src="docs/orc-parade.svg" alt="Six animated orcs from Orc Dot: a hopping mohawk orc, a squinting warrior, a winking viking, a glowing-eyed shaman, a drowsy napper and a startled pirate" width="100%">

# Orc Dot

**Tiny tusked friends, hand-assembled in your browser.**

Build a cute animated orc avatar, give it a horned helm and a questionable nose ring,<br>
then take it home as a tidy SVG + CSS snippet. No sign-up, no uploads, no goblins.

### [🟢 Summon an orc → orc-dot.web.app](https://orc-dot.web.app)

</div>

---

## What is this?

Orc Dot is a little avatar studio for people who think every profile picture should have tusks.

Pick a head shape, slap on some war paint, choose how your orc wiggles, and export it. Every orc is pure vector: one SVG plus a small CSS file. It stays crisp at 16px or on a billboard, and it breathes, blinks and twitches its ears on its own.

<div align="center">
<img src="docs/studio.png" alt="The Orc Dot studio: a forest-green orc with a mohawk, red bandana, warpaint, nose ring, goatee and large tusks, with the Gear tab open showing hair, beard, headgear, war paint and trinket options" width="100%">
</div>

## The armory 🪓

Mix and match from **six head shapes** and a **pile of gear**. Every accessory lines up on every shape, because each head is drawn on the same frame.

| | |
|---|---|
| **Heads** | blob, bean, squircle, egg, pebble, hex |
| **Skins** | moss, forest, olive, sage, slate, ash, umber, ember |
| **Ears** | pointy, long, droopy, notched (battle-tested™), or none |
| **Eyes** | dots, round, almond, angry, sleepy, happy, glow, mismatched |
| **Brows** | heavy, angry, worried, unibrow |
| **Mouths** | smile, grin, smirk, grumpy, roar |
| **Tusks** | small, medium, large, asymmetric, chipped, gilded (they grow *up*, like proper tusks) |
| **Hair** | mohawk, topknot, tufts, mane, braids, in black, brown, ginger, silver or skin tone |
| **Beards** | goatee, braided, full, mutton chops |
| **Headgear** | horned helm, spiked crown, bandana, skull cap |
| **War paint** | warpaint, mask, tribal, scar, freckles |
| **Trinkets** | nose ring, nose bone, earrings, eyepatch |

Can't decide? Smash **Randomize** until an orc speaks to you.

> **Wardrobe rules:** a helmet won't fit over a mohawk, a crown squashes a topknot, and earrings need ears. When two picks clash, **your latest pick wins** and the other quietly steps aside.

## It's alive! 🫧

These orcs don't just sit there.

- **Body:** breathe, bob, breathe + bob, sway or hop, with squash & stretch and proper easing. The face and headgear lag a beat behind the head (follow-through), so it feels squishy rather than robotic.
- **Little things:** ears twitch on their own irregular clocks. Mohawks, braids, beard braids, nose rings and earrings swing. Bandana tails flutter, and roaring mouths chomp.
- **Eyes:** blink, double blink, wink, glance, look around, squint, startle or drowsy. Blinks snap shut fast and open slower, like real lids. Brows join in: they lower when squinting, lift when startled and dip on a wink. Glowing eyes pulse.
- **Kind to everyone:** there's a pause button, and the studio starts paused if your system asks for reduced motion. Exported CSS respects `prefers-reduced-motion` too.

## Taking your orc home 🏠

Hit **Export** and pick a format:

| Format | Best for | What you get |
|---|---|---|
| **SVG + CSS** | Websites | The SVG with readable class names (`orc-avatar__eyes`, `orc-avatar--hop`…) plus a CSS snippet with only the keyframes your orc uses. Copy or download either. |
| **Animated SVG** | Anywhere SVG goes | One file with the CSS built in, so it animates even inside `<img>`. |
| **PNG** | Profile photos, docs | A still image at 256–2048px, transparent or on white. |
| **GIF** | Chats, forums, email | A seamless loop at 128–512px, transparent or on white. |
| **Lottie** | Apps (lottie-web, iOS, Android) | Vector JSON: every shape stays a shape, with keyframed motion. |

Every moving part in the CSS pivots on fixed viewBox coordinates (`transform-box: view-box`), so ears twitch from the base and earrings swing from the lobe. Exported CSS respects `prefers-reduced-motion`.

> **Heads up:** your page's CSS can't reach inside an SVG loaded with `<img src="orc.svg">`. To animate the plain SVG, paste it **inline** in your HTML next to the CSS snippet, or grab the **Animated SVG** instead.

**How GIF and Lottie are made:** the studio plays your orc's real CSS animation in a hidden, style-isolated copy, steps it frame by frame with the Web Animations API and records every moving part's pose. Parts that cycle at different speeds (a 7.2s blink, a 4.4s breath, ears on their own clocks) are gently retimed so that they all loop seamlessly. GIF frames are drawn from those poses. Lottie keeps the vector shapes and turns the poses into keyframes. Everything runs in your browser.

What you see in the studio is exactly what you export: the preview renders the same SVG string as the download.

## Run it locally

Needs **Node.js 20.9+** and npm.

```bash
npm install
npm run dev        # → http://localhost:3000
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server |
| `npm run build` | Static export to `out/` |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run icons` | Regenerate the favicon and app icons from the brand orc |
| `npm run readme-art` | Regenerate the animated orc parade at the top of this README |
| `npm run deploy` | Build and ship to Firebase Hosting |

**Built with** Next.js (App Router, static export), React, TypeScript, Tailwind, shadcn/ui + Base UI, iconsax-react, Fredoka + Nunito, and Vitest.

<details>
<summary><b>How the orc is put together</b></summary>

<br>

Layers, back to front: hair (back) → ears → head → face (markings, beard, eyes, brows, nose, mouth, tusks, trinket) → hair (front) → headgear.

- `lib/avatar/buildSvg.ts` is the single source of truth for the artwork, used by both the preview and the export.
- `lib/avatar/buildCss.ts` emits only the animation rules a given orc needs.
- `lib/avatar/catalog.ts` holds the palette, shared layout anchors and head shapes.
- `lib/avatar/normalize.ts` validates configs and resolves wardrobe clashes.
- `lib/avatar/export/` builds the extra formats: the animated SVG, frame sampling (`sample.ts`), baked frames, PNG/GIF (`raster.ts`, via [gifenc](https://github.com/mattdesl/gifenc)) and Lottie (`lottie.ts`). The browser-only parts load on demand when you export.

</details>

## Deploying 🚀

Live at **https://orc-dot.web.app** on Firebase Hosting (project `orc-dot`). The site is a fully static export, so it needs no server and runs on the free plan.

```bash
npx firebase-tools login   # once
npm run deploy             # next build + firebase deploy --only hosting
```

- **Site URL:** `NEXT_PUBLIC_SITE_URL` in `.env.production` (committed, not secret) drives canonical URLs, social images, `robots.txt` and `sitemap.xml`. If you hook up a custom domain, change it there and redeploy.
- **Headers & caching** live in `firebase.json`, because static exports can't use `headers()` in `next.config.ts`. That covers security headers, `no-cache` HTML so deploys land instantly, year-long caching for hashed assets, and an explicit `image/png` type for the extensionless `/opengraph-image` and `/twitter-image`.
- **Metadata routes** (`robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`) must keep `export const dynamic = "force-static"`, or the export fails.
- **Preview exactly as Firebase serves it:** `npx next build && npx firebase-tools serve --only hosting`.

SEO comes built in: metadata, Open Graph and Twitter cards, icons, web manifest, sitemap, `WebApplication` JSON-LD and a 404 page starring a very lost orc.

## Credits

Fredoka (used for the social share image, in `assets/fonts/`) is licensed under the SIL Open Font License; see `assets/fonts/OFL.txt`.

<div align="center">
<sub>No orcs were harmed in the making of this README. One got a little lost, but we found them.</sub>
</div>
