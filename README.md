# Orc Dot

Browser studio for cute animated orc avatars. Mix face parts, orcish gear and motion presets (or hit **Randomize**), preview at several sizes, then export an SVG and a standalone CSS snippet.

## Requirements

- Node.js 20.9+
- npm 10+

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Scripts

| Script | Purpose |
|--------|---------|
| npm run dev | Next.js dev server |
| npm run build | Production build |
| npm start | Serve production build |
| npm run lint | ESLint |
| npm test | Vitest unit tests |
| npm run test:watch | Vitest watch mode |
| npm run icons | Regenerate favicon / app icons from the brand orc |

## Presets

**Face**
- **Shapes:** blob, bean, squircle, egg, pebble, hex (all share one anchor frame, so every accessory fits every shape)
- **Skins:** moss, forest, olive, sage, slate, ash, umber, ember
- **Ears:** none, pointy, long, droopy, notched
- **Eyes:** none, dots, round, almond, angry, sleepy, happy, glow, mismatched
- **Brows:** none, heavy, angry, worried, unibrow
- **Mouth:** smile, grin, smirk, grumpy, roar
- **Tusks:** none, small, medium, large, asymmetric, chipped, gilded (rising from the lower jaw)

**Gear**
- **Hair:** none, mohawk, topknot, tufts, mane, braids — colors: black, brown, ginger, silver, skin tone
- **Beard:** none, goatee, braided, full, chops
- **Headgear:** none, horned helm, spiked crown, bandana, skull cap
- **War paint:** none, warpaint, mask, tribal, scar, freckles
- **Trinkets:** none, nose ring, nose bone, earrings, eyepatch

Some combos conflict (a helm or skull cap can't sit over a mohawk/topknot/tufts, a crown over a topknot, earrings need ears). The **most recent pick wins** and the other choice resets.

**Motion**
- **Body:** still, breathe, bob, breathe + bob, sway, hop — with squash & stretch, per-keyframe easing and a pivot at the base of the head. The face and headgear follow a beat later (follow-through).
- **Secondary motion** (whenever the body moves): ears twitch on independent irregular clocks; mohawks, braids, beard braids, nose rings and earrings swing; bandana tails flutter; a roaring mouth chomps.
- **Eyes:** still, blink, double blink, wink, glance, look around, squint, startle, drowsy. Blinks close fast and open slower, gaze shifts carry a blink, and brows react (lower on squint, lift on startle, dip on wink). Glowing eyes pulse.

Layer order: hair (back) → ears → body → face (markings, beard, eyes, brows, nose, mouth, tusks, trinket) → hair (front) → headgear.

## Export

The Export dialog provides:

1. **SVG** — standalone markup. Key classes: `orc-avatar`, `orc-avatar__rig`, `orc-avatar__body`, `orc-avatar__face`, `orc-avatar__eyes` / `__eye--left|right` / `__pupil`, `orc-avatar__brows`, `orc-avatar__tusks`, `orc-avatar__hair--back|front`, `orc-avatar__beard`, `orc-avatar__headgear`, plus modifiers `orc-avatar--breathe`, `--bob`, `--sway`, `--hop` and `orc-avatar--eyes-<motion>`.
2. **CSS snippet** — only the keyframes and rules that avatar needs (no Tailwind). Every animated part pivots on fixed viewBox coordinates via `transform-box: view-box`. Includes a `prefers-reduced-motion` guard.

The studio preview renders the exact same SVG string as the export, so they can't drift apart.

(no Tailwind).

### Inline SVG required for motion

CSS animations on SVG **do not run** when the file is referenced as an external img. For motion to work, paste the SVG **inline** into your HTML (or embed via object). The studio Export panel and this README both call that out.

Download still saves a .svg file useful as a static asset; pair it with the CSS snippet only when you inline the markup.

## Stack

Next.js App Router, React, TypeScript, Tailwind, shadcn/ui + Base UI, iconsax-react (UI icons only), Fredoka + Nunito via `next/font`, Vitest.

## Deploying

Live at **https://orc-dot.web.app** (Firebase Hosting, project `orc-dot`).

The site is a static export (`output: "export"` in `next.config.ts`): `next build` writes plain files to `out/`, which Firebase Hosting serves. No server or paid plan is needed.

```bash
npx firebase-tools login   # once
npm run deploy             # next build + firebase deploy --only hosting
```

- **Site URL:** `NEXT_PUBLIC_SITE_URL` in `.env.production` (committed, not secret) sets canonical URLs, Open Graph/Twitter images, `robots.txt` and `sitemap.xml`. If you connect a custom domain in the Firebase console, update it there and redeploy.
- **Headers & caching** live in `firebase.json` (static exports can't use `headers()` in `next.config.ts`): security headers on every response, `no-cache` on HTML so deploys show up immediately, one-year immutable caching for hashed `/_next/static` assets, and an explicit `image/png` type for the extensionless `/opengraph-image` and `/twitter-image`.
- **Metadata routes** (`robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`) must keep `export const dynamic = "force-static"` or the export fails.
- **Preview locally exactly as Firebase serves it:** `npx next build && npx firebase-tools serve --only hosting`.

SEO and sharing are built in: page metadata (`app/layout.tsx`, `lib/site.ts`), `robots.txt`, `sitemap.xml`, a web manifest, generated Open Graph/Twitter images, favicon/app icons, `WebApplication` JSON-LD and a branded 404.

After going live, submit `https://orc-dot.web.app/sitemap.xml` in Google Search Console and check a share preview (e.g. opengraph.xyz).

## Credits

Fredoka (OG image font, `assets/fonts/`) is licensed under the SIL Open Font License; see `assets/fonts/OFL.txt`.
