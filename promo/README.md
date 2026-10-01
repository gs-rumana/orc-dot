# Promo video

`orc-dot-promo.mp4` is a 23.5s, 1080×1080 H.264 clip (30fps, no audio) made for posting on X.
`orc-dot-promo-poster.png` is the end-card frame, which works as a thumbnail or static post image.

Every avatar is real `buildSvg`/`buildCss` output, rendered frame-by-frame in Chrome.

To re-render (e.g. to add your domain to the end card):

```bash
npm i --no-save puppeteer-core          # or set PROMO_TOOLS to a folder that has it
npx vite-node --config vitest.config.ts promo/build.ts --url orcdot.com
node promo/record.mjs                   # needs ffmpeg on PATH
```
