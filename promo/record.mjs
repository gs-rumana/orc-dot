/**
 * Renders promo/.build/promo.html frame-by-frame in Chrome and encodes the
 * silent picture (1080×1080, H.264, 30fps) to promo/.build/video.mp4, plus a
 * poster frame. promo/sound.mjs then adds the soundtrack.
 *
 * Needs ffmpeg on PATH and puppeteer-core. If puppeteer-core isn't installed
 * in this project, point PROMO_TOOLS at a folder that has it in node_modules.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  process.env.PROMO_TOOLS ? join(process.env.PROMO_TOOLS, "noop.js") : import.meta.url,
);
const puppeteer = require("puppeteer-core");

const FPS = 30;
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const build = join(here, ".build");
const frames = join(build, "frames");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--allow-file-access-from-files", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(build, "promo.html")).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

const duration = await page.evaluate(() => window.DURATION);
const total = Math.round(duration * FPS);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.renderAt(t), i / FPS);
  await page.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.png`) });
  if (i % 60 === 0) process.stdout.write(`frame ${i}/${total}\n`);
}
await browser.close();

const out = join(build, "video.mp4");
execFileSync(
  "ffmpeg",
  [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS),
    "-i", join(frames, "f%04d.png"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-pix_fmt", "yuv420p", "-profile:v", "high",
    out,
  ],
  { stdio: "inherit" },
);
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", join(frames, `f${String(Math.round(20.9 * FPS)).padStart(4, "0")}.png`),
  join(here, "orc-dot-promo-poster.png"),
]);
rmSync(frames, { recursive: true, force: true });
console.log(`Wrote ${out}`);
