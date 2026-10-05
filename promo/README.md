# Promo videos

There are two cuts, both 23.5s square clips made for posting on X, with the same specs and soundtrack engine:

- **2D:** `orc-dot-promo.mp4` (poster `orc-dot-promo-poster.png`), described below.
- **3D:** `orc-dot-3d-promo.mp4` (poster `orc-dot-3d-promo-poster.png`). See [3D cut](#3d-cut).

`orc-dot-promo.mp4` is the 2D cut:

- **Video:** 1080×1080 H.264 (High), 30fps, yuv420p
- **Audio:** AAC-LC stereo, 48 kHz, 192 kbps, normalized to -14 LUFS integrated, true peak ≈ -2 dBTP

`orc-dot-promo-poster.png` is the end-card frame. Use it as a thumbnail or a static post image.

Every avatar is real `buildSvg`/`buildCss` output, rendered frame by frame in Chrome.

## Sound

All audio is synthesized from scratch by `promo/sound.mjs`, using oscillators and seeded noise in plain Node with no dependencies. **No samples, recordings or third-party audio are used, so there is nothing to license or attribute.**

Cue times aren't typed in by hand. `build.ts` writes them to `promo/.build/cues.json` from the same scene timings and CSS keyframe percentages that drive the picture, so the sounds stay in sync if a scene is retimed.

| Time | Sound | What it is |
| --- | --- | --- |
| 1.01s | boing | Spring "boing" (pitch glides up with a decaying wobble) as the brand orc leaves the ground |
| 1.92s | thud | Soft low thump on landing |
| 2.6–7.8s | click + pop ×14 | Button click, then a bubble pop for each randomized orc; pops are tuned to C-major pentatonic and land on the music's beat |
| 8.2s | horned helm | Whoosh, then a heavy metal clank (inharmonic partials) as it lands |
| 9.1s | spiked crown | Sparkly rising bell run with a light metal tap |
| 10.0s | bandana | Cloth whoosh with a flutter in its tail |
| 10.9s | skull cap | Three hollow, bony clacks (chattering teeth) |
| 11.95s | wink | Bright little "ting" |
| 13.37s | startle | Slide whistle zipping up, with a nervous wobble |
| 14.58s | drowsy | Slow, sleepy downward slide (yawn) |
| 15.50s | wake | Quick bloop up plus a ting as the eyes snap open |
| 16.09s | look around | Tiny swish and a tick-tock woodblock as the eyes dart |
| 17.2s | pop ×9 | Rising ripple of small pops across the stereo field as the grid fills |
| 20.2–20.4s | pop ×3 | The end-card orcs pop in |
| 20.5s | chime | Warm C-major bell arpeggio with a shimmer tail as the logo appears |

**Music bed:** 150 bpm in C major, playing I–V–vi–IV with a marimba arpeggio, bass, a soft pad and a light kit (kick, finger snap, shaker). One beat is 0.4s and the first downbeat is at 0.2s, so the randomize pops land on the beat. On the end card (20.2s) it resolves G→C, and the final chord rings out under the chime.

**Mix (all in ffmpeg):**
1. The bed sits 4 dB down and is sidechain-ducked by the effects. Every effect stays at least 17 dB above the ducked bed.
2. Fade-in over 0.8s, fade-out over the last 1.6s.
3. A look-ahead limiter shaves the hottest transients so loudness normalization can stay linear.
4. Two-pass `loudnorm` to -14 LUFS / -1.5 dBTP.
5. The video stream is copied unchanged (`-c:v copy`).

## 3D cut

Every orc is real `buildAvatar` / `animateAvatar` output from the 3D studio, lit with the studio's rig and drawn frame by frame with WebGL. `promo/stage-3d.ts` is the browser half: it gives each orc its own viewport on one transparent canvas. `promo/build-3d.ts` lays out the shots, bundles the stage with esbuild into `promo/.build/promo-3d.html`, and writes `cues-3d.json`.

| Time | Shot | Sound |
| --- | --- | --- |
| 0–2.6s | "Now in fluffy 3D." A bald brand orc hops while the camera eases round | boing on take-off (0.9s), thud on landing (1.52s) |
| 2.6–5.4s | "Fuzzy from every side." A full turntable spin of a bandana orc | spin: a long whoosh that rises and falls |
| 5.4–9.4s | "Pick a color." Ten colors on the beat, from plush lime to ember skin, with the color row lighting up | click + pentatonic pop on each |
| 9.4–13.0s | "Gear up." Horned helm, spiked crown, bandana, skull cap, each turning a little | the 2D cut's per-headgear sounds |
| 13.0–17.0s | "Faces with attitude." Wink, roar, look around, drowsy | ting, slide whistle, eye dart, yawn |
| 17.0–20.2s | "Every orc moves on its own." Nine random plush orcs | pop ripple |
| 20.2–23.5s | End card: three orcs, the logo, "Free · No sign-up · Export PNG + GLB" | pops, chime |

The music bed and mix are the same as the 2D cut. `cues-3d.json` carries `endCard: 20.2`, and the music cadences onto that beat.

## Re-rendering

```bash
npm i --no-save puppeteer-core          # or set PROMO_TOOLS to a folder that has it
npx vite-node --config vitest.config.ts promo/build.ts --url orc-dot.web.app   # page + cues.json
node promo/record.mjs                   # silent picture → promo/.build/video.mp4 (~2 min)
node promo/sound.mjs                    # synth + mix + mux → promo/orc-dot-promo.mp4 (seconds)
```

For the 3D cut:

```bash
npx vite-node --config vitest.config.ts promo/build-3d.ts --url orc-dot.web.app   # page + cues-3d.json
node promo/record.mjs 3d                # silent picture → promo/.build/video-3d.mp4
node promo/sound.mjs 3d                 # → promo/orc-dot-3d-promo.mp4
```

The 3D recording uses Chrome's GPU (`--use-angle=metal` on macOS); software WebGL is far too slow for the fur.

`ffmpeg` must be on PATH. To retune the audio (levels in `SFX_MIX`, voices in `SFX`, or the music), you only need to re-run `sound.mjs`. If you change scene timing, run `build.ts` first so the cues update.

Intermediate files (`promo.html`, `cues.json`, `video.mp4`, the `sfx.wav` / `music.wav` stems, and their `-3d` counterparts) live in `promo/.build/`, which is git-ignored.
