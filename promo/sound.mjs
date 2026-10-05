/**
 * Synthesizes the promo soundtrack from scratch and muxes it into the video.
 *
 * Every sound is generated here from oscillators and seeded noise: no
 * samples, no external assets, so there is nothing to license.
 *
 * Inputs:  promo/.build/cues.json  (from build.ts — when each SFX fires)
 *          promo/.build/video.mp4  (from record.mjs — silent picture)
 * Outputs: promo/.build/{sfx,music}.wav stems, promo/orc-dot-promo.mp4
 *
 * `node promo/sound.mjs 3d` scores the 3D cut: cues-3d.json + video-3d.mp4 →
 * promo/orc-dot-3d-promo.mp4.
 *
 * Mix: music is sidechain-ducked under the SFX, faded in/out, then the whole
 * mix is loudness-normalized to -14 LUFS / -1.5 dBTP and encoded as AAC.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, ".build");
const variant = process.argv[2] ? `-${process.argv[2]}` : "";
const SR = 48000;
const TAU = Math.PI * 2;

const { duration, cues, endCard = 20.2 } = JSON.parse(
  readFileSync(join(build, `cues${variant}.json`), "utf8"),
);
const LENGTH = Math.round(duration * SR);

// ─────────────────────────── DSP helpers ───────────────────────────

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noiseRand = mulberry32(1234);
const noise = () => noiseRand() * 2 - 1;

/** Renders `seconds` of audio where fn(t, i) returns one mono sample. */
function render(seconds, fn) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}

/** Oscillator with a time-varying frequency (phase-accumulating). */
function osc(seconds, freqAt, wave = Math.sin) {
  let phase = 0;
  return render(seconds, (t) => {
    phase += (TAU * freqAt(t)) / SR;
    return wave(phase);
  });
}

const env = {
  /** Attack then exponential decay. */
  perc: (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) * decay)),
};

/** RBJ band-pass biquad with a time-varying centre frequency. */
function bandpass(input, centreAt, q) {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const w = (TAU * centreAt(i / SR)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
    const x = input[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** One-pole high-pass. */
function highpass(input, cutoff) {
  const rc = 1 / (TAU * cutoff);
  const a = rc / (rc + 1 / SR);
  const out = new Float32Array(input.length);
  let prevX = 0, prevY = 0;
  for (let i = 0; i < input.length; i++) {
    prevY = a * (prevY + input[i] - prevX);
    prevX = input[i];
    out[i] = prevY;
  }
  return out;
}

function mixInto(dest, src, offsetSec = 0, gain = 1) {
  const off = Math.round(offsetSec * SR);
  for (let i = 0; i < src.length && off + i < dest.length; i++) {
    if (off + i >= 0) dest[off + i] += src[i] * gain;
  }
  return dest;
}

/** Sum of partials [freq, amp, decay/s] — bells, metal, marimba. */
function partials(seconds, list, attack = 0.002) {
  return render(seconds, (t) => {
    let s = 0;
    for (const [f, a, d] of list) s += Math.sin(TAU * f * t) * a * env.perc(t, attack, d);
    return s;
  });
}

class Stereo {
  constructor(n) {
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
  /** Equal-power pan: -1 left … +1 right. */
  add(mono, atSec, gain = 1, pan = 0) {
    const a = ((pan + 1) * Math.PI) / 4;
    mixInto(this.L, mono, atSec, gain * Math.cos(a));
    mixInto(this.R, mono, atSec, gain * Math.sin(a));
  }
}

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** C major pentatonic from C5 upward (fits the C-major music bed). */
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96].map(midi);

// ─────────────────────────── sound effects ───────────────────────────

const SFX = {
  /** Spring "boing": pitch glides up with a decaying wobble. */
  boing() {
    const s = osc(0.65, (t) => (150 + 330 * (1 - Math.exp(-t * 14))) * (1 + 0.13 * Math.exp(-t * 4.5) * Math.sin(TAU * 15 * t)));
    return render(0.65, (t, i) => s[i] * env.perc(t, 0.006, 5) * 0.9);
  },

  /** Soft landing thump. */
  thud() {
    const body = osc(0.25, (t) => 55 + 70 * Math.exp(-t * 30));
    return render(0.25, (t, i) => (body[i] * 0.9 + noise() * 0.25 * Math.exp(-t * 90)) * env.perc(t, 0.002, 20));
  },

  /** Button click: tiny noise transient + high tick. */
  click() {
    const n = highpass(render(0.04, () => noise()), 2000);
    return render(0.04, (t, i) => n[i] * Math.exp(-t * 700) * 0.6 + Math.sin(TAU * 3100 * t) * Math.exp(-t * 260) * 0.35);
  },

  /** Bubble pop: quick upward pitch flick, pitched to the pentatonic scale. */
  pop(n = 0, base = PENTA[[0, 2, 4, 1, 3, 5, 2, 4, 6, 3, 5, 7, 4, 6][n % 14]]) {
    const s = osc(0.11, (t) => base * (0.55 + 1.05 * (1 - Math.exp(-t * 110))));
    return render(0.11, (t, i) => s[i] * env.perc(t, 0.002, 38));
  },

  "pop-small"(n = 0) {
    return SFX.pop(0, PENTA[Math.min(n + 2, PENTA.length - 1)]).map((v) => v * 0.7);
  },

  /** Turntable spin: a long whoosh that rises and falls as the orc turns. */
  spin() {
    const seconds = 1.1;
    const n = render(seconds, () => noise());
    const swept = bandpass(n, (t) => 260 + 2100 * Math.sin((Math.PI * t) / seconds), 1.3);
    return render(seconds, (t, i) => swept[i] * Math.sin((Math.PI * t) / seconds) ** 2 * 1.6);
  },

  /** Short airy whoosh: band-passed noise sweeping upward. */
  whoosh(seconds = 0.32, from = 350, to = 2600) {
    const n = render(seconds, () => noise());
    const swept = bandpass(n, (t) => from * Math.pow(to / from, t / seconds), 1.1);
    return render(seconds, (t, i) => swept[i] * Math.sin((Math.PI * t) / seconds) ** 1.5 * 1.8);
  },

  /** Horned helm: heavy metal clank (inharmonic partials) after a whoosh. */
  "gear-horned-helm"() {
    const out = new Float32Array(Math.round(1.0 * SR));
    mixInto(out, SFX.whoosh(0.2, 300, 1800), 0, 0.35);
    const clank = partials(0.8, [[196, 1, 6], [471, 0.7, 8], [797, 0.5, 11], [1163, 0.35, 14], [1618, 0.25, 18], [2177, 0.15, 24]]);
    const hit = highpass(render(0.03, () => noise()), 1500);
    mixInto(out, clank, 0.12, 0.55);
    mixInto(out, hit.map((v, i) => v * Math.exp(-i / SR / 0.006)), 0.12, 0.5);
    return out;
  },

  /** Spiked crown: sparkly ascending bell run with a light metal tap. */
  "gear-spiked-crown"() {
    const out = new Float32Array(Math.round(1.2 * SR));
    [84, 88, 91, 96].forEach((m, i) => {
      const f = midi(m);
      mixInto(out, partials(0.9, [[f, 1, 5], [f * 2.76, 0.35, 11], [f * 5.4, 0.12, 20]]), i * 0.05, 0.3);
    });
    mixInto(out, partials(0.4, [[880, 0.6, 14], [2113, 0.4, 20], [3270, 0.25, 26]]), 0, 0.3);
    return out;
  },

  /** Bandana: cloth whoosh with a flutter in its tail. */
  "gear-bandana"() {
    const w = SFX.whoosh(0.42, 280, 3000);
    return w.map((v, i) => {
      const t = i / SR;
      return v * (t > 0.2 ? 0.75 + 0.25 * Math.sin(TAU * 28 * t) : 1);
    });
  },

  /** Skull cap: hollow bony clacks, like chattering teeth. */
  "gear-skull-cap"() {
    const out = new Float32Array(Math.round(0.5 * SR));
    const clack = partials(0.12, [[760, 1, 55], [1530, 0.55, 70], [2650, 0.25, 90]], 0.001);
    [0, 0.075, 0.15].forEach((at, i) => mixInto(out, clack, at, 0.6 * (1 - i * 0.25)));
    return out;
  },

  /** Wink: a bright little "ting". */
  wink() {
    const out = new Float32Array(Math.round(0.8 * SR));
    mixInto(out, partials(0.05, [[2637, 0.5, 60]]), 0, 0.4);
    mixInto(out, partials(0.75, [[1568, 1, 6], [3136, 0.3, 12], [4704, 0.1, 20]]), 0.04, 0.5);
    return out;
  },

  /** Startle: slide-whistle zip upward with a nervous wobble. */
  startle() {
    const s = osc(0.34, (t) => (t < 0.15 ? 420 * Math.pow(1500 / 420, t / 0.15) : 1500) * (1 + 0.025 * Math.sin(TAU * 22 * t)), (p) => Math.sin(p) + 0.15 * Math.sin(3 * p));
    return render(0.34, (t, i) => s[i] * Math.min(1, t / 0.01) * Math.min(1, (0.34 - t) / 0.07) * 0.5);
  },

  /** Drowsy: a slow, sleepy downward slide. */
  yawn() {
    const s = osc(0.9, (t) => 820 * Math.pow(330 / 820, t / 0.9) * (1 + 0.012 * Math.sin(TAU * 5 * t)), (p) => Math.sin(p) + 0.1 * Math.sin(2 * p));
    return render(0.9, (t, i) => s[i] * Math.sin((Math.PI * t) / 0.9) * 0.35);
  },

  /** Jolting awake: quick bloop up, then a ting. */
  wake() {
    const out = new Float32Array(Math.round(0.7 * SR));
    const bloop = osc(0.08, (t) => 300 * Math.pow(3, t / 0.08));
    mixInto(out, bloop.map((v, i) => v * env.perc(i / SR, 0.003, 25)), 0, 0.5);
    mixInto(out, partials(0.6, [[1318.5, 1, 7], [2637, 0.3, 14]]), 0.06, 0.4);
    return out;
  },

  /** Eye dart: woodblock tick plus a tiny swish. */
  dart() {
    const out = new Float32Array(Math.round(0.3 * SR));
    mixInto(out, SFX.whoosh(0.12, 1200, 4000), 0, 0.25);
    mixInto(out, partials(0.08, [[1650, 1, 70], [3300, 0.3, 110]], 0.001), 0.03, 0.55);
    mixInto(out, partials(0.08, [[1250, 1, 70], [2500, 0.3, 110]], 0.001), 0.15, 0.45);
    return out;
  },

  /** End card: warm bell arpeggio (C major) with a shimmer tail. */
  chime() {
    const out = new Float32Array(Math.round(2.8 * SR));
    [72, 76, 79, 84].forEach((m, i) => {
      const f = midi(m);
      mixInto(out, partials(2.4, [[f, 1, 1.6], [f * 2, 0.3, 3], [f * 3, 0.14, 5], [f * 4.16, 0.08, 7]]), i * 0.075, 0.3);
    });
    const shimmer = render(2.2, (t) => (Math.sin(TAU * 2093 * t) + 0.5 * Math.sin(TAU * 4186 * t)) * (0.5 + 0.5 * Math.sin(TAU * 7 * t)) * env.perc(t, 0.25, 1.8));
    mixInto(out, shimmer, 0.3, 0.05);
    return out;
  },
};

/** Per-sound mix gain and pan, so nothing pokes out or gets buried. */
const SFX_MIX = {
  boing: [0.9, 0], thud: [0.8, 0], click: [0.35, 0.1], pop: [0.55, 0], "pop-small": [0.45, 0],
  "gear-horned-helm": [0.95, 0], "gear-spiked-crown": [0.9, 0], "gear-bandana": [1.4, 0.2],
  "gear-skull-cap": [0.9, 0], wink: [0.7, -0.1], startle: [0.7, 0], yawn: [1.9, 0],
  wake: [0.8, 0], dart: [1.25, 0.15], chime: [0.9, 0], spin: [1.1, 0],
};

function renderSfx() {
  const out = new Stereo(LENGTH);
  for (const cue of cues) {
    const make = SFX[cue.sound];
    if (!make) throw new Error(`No synth for cue "${cue.sound}"`);
    const [gain, pan] = SFX_MIX[cue.sound] ?? [0.7, 0];
    // Crowd pops spread across the stereo field like the grid on screen.
    const spread = cue.sound === "pop-small" ? ((cue.n % 3) - 1) * 0.5 : pan;
    out.add(make(cue.n ?? 0), cue.t, gain, spread);
  }
  return out;
}

// ─────────────────────────── music bed ───────────────────────────
// 150 bpm in C major; one beat = 0.4s with the first downbeat at 0.2s, so
// the 0.4s randomize pops land on the beat. I–V–vi–IV, cadencing G→C on the
// end card (cues.json endCard, default beat 50 = 20.2s), then the final chord
// rings out.

const BEAT = 0.4;
const FIRST = 0.2;
const CHORDS = {
  C: [60, 64, 67],
  G: [55, 59, 62],
  Am: [57, 60, 64],
  F: [53, 57, 60],
};
const LOOP = ["C", "G", "Am", "F"];
const END_BEAT = Math.round((endCard - FIRST) / BEAT);

function chordAt(beat) {
  if (beat >= END_BEAT) return "C";
  if (beat >= END_BEAT - 2) return "G";
  return LOOP[Math.floor(beat / 4) % 4];
}

const voices = {
  marimba(f) {
    return render(0.6, (t) => (Math.sin(TAU * f * t) * env.perc(t, 0.002, 8) + 0.22 * Math.sin(TAU * f * 3.93 * t) * env.perc(t, 0.001, 32)));
  },
  bass(f) {
    return render(0.42, (t) => (Math.sin(TAU * f * t) + Math.sin(TAU * 3 * f * t) / 9 + Math.sin(TAU * 5 * f * t) / 25 + 0.6 * Math.sin(TAU * f * 0.5 * t)) * env.perc(t, 0.005, 5) * Math.min(1, (0.42 - t) / 0.03));
  },
  pad(f, seconds) {
    return render(seconds, (t) => {
      const a = Math.min(1, t / 0.3) * Math.min(1, (seconds - t) / 0.35);
      return (Math.sin(TAU * f * 1.0017 * t) + Math.sin(TAU * f * 0.9983 * t)) * 0.5 * a;
    });
  },
  kick() {
    const s = osc(0.22, (t) => 48 + 80 * Math.exp(-t * 35));
    return render(0.22, (t, i) => s[i] * env.perc(t, 0.002, 16));
  },
  snap() {
    const n = bandpass(render(0.08, () => noise()), () => 1900, 1.4);
    return render(0.08, (t, i) => n[i] * env.perc(t, 0.001, 45) * 2.2);
  },
  shaker() {
    const n = highpass(render(0.06, () => noise()), 5500);
    return render(0.06, (t, i) => n[i] * env.perc(t, 0.004, 55));
  },
};

function renderMusic() {
  const out = new Stereo(LENGTH);
  const totalBeats = Math.floor((duration - FIRST) / BEAT);
  const kick = voices.kick();
  const snap = voices.snap();
  const shaker = voices.shaker();

  for (let beat = 0; beat < totalBeats; beat++) {
    const t = FIRST + beat * BEAT;
    const chord = CHORDS[chordAt(beat)];
    const inBar = beat % 4;

    if (beat < END_BEAT) {
      // Marimba arpeggio on eighths: root, fifth, third, fifth / octave pattern.
      const [r, third, fifth] = chord;
      const pattern = inBar % 2 === 0 ? [r + 12, fifth + 12] : [third + 12, fifth + 12];
      pattern.forEach((m, k) => out.add(voices.marimba(midi(m)), t + k * (BEAT / 2), k === 0 ? 0.16 : 0.11, 0.3));

      // Bass on 1, the "and" of 2, and 3.
      if (inBar === 0 || inBar === 2) out.add(voices.bass(midi(chord[0] - 12)), t, 0.3);
      if (inBar === 1) out.add(voices.bass(midi(chord[0] - 12)), t + BEAT / 2, 0.2);

      // Light kit: soft kick on 1 & 3, finger snap on 2 & 4, shaker on eighths.
      if (inBar === 0 || inBar === 2) out.add(kick, t, 0.32);
      if (inBar === 1 || inBar === 3) out.add(snap, t, 0.1, 0.15);
      out.add(shaker, t, 0.035, -0.35);
      out.add(shaker, t + BEAT / 2, 0.055, -0.35);
    }

    // Soft pad: one chord per bar (and one long chord for the ending).
    if (inBar === 0 && beat < END_BEAT - 2) {
      chord.forEach((m, k) => out.add(voices.pad(midi(m), 4 * BEAT + 0.3), t, 0.045, (k - 1) * 0.4));
    }
    if (beat === END_BEAT - 2) {
      CHORDS.G.forEach((m, k) => out.add(voices.pad(midi(m), 2 * BEAT + 0.3), t, 0.045, (k - 1) * 0.4));
    }
    if (beat === END_BEAT) {
      const ring = duration - t;
      [...CHORDS.C, 72].forEach((m, k) => out.add(voices.pad(midi(m), ring), t, 0.05, (k - 1.5) * 0.3));
      out.add(voices.bass(midi(48)), t, 0.3);
      out.add(kick, t, 0.32);
    }
  }
  return out;
}

// ─────────────────────────── output ───────────────────────────

function writeWav(path, { L, R }) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(L[i], 44 + i * 8);
    buf.writeFloatLE(R[i], 48 + i * 8);
  }
  writeFileSync(path, buf);
}

const sfxPath = join(build, `sfx${variant}.wav`);
const musicPath = join(build, `music${variant}.wav`);
writeWav(sfxPath, renderSfx());
writeWav(musicPath, renderMusic());
console.log("Synthesized sfx.wav and music.wav");

const LUFS = -14;
const TRUE_PEAK = -1.5;

// Music sits 4 dB down, ducks further whenever an effect plays, fades in over 0.8s and out over the last 1.6s.
const mixGraph = (sfx, music) =>
  `[${sfx}:a]asplit=2[sfx][key];` +
  `[${music}:a]volume=-4dB,afade=t=in:st=0:d=0.8,afade=t=out:st=${duration - 1.6}:d=1.6[bed];` +
  `[bed][key]sidechaincompress=threshold=0.015:ratio=5:attack=8:release=280:makeup=1[ducked];` +
  `[sfx][ducked]amix=inputs=2:normalize=0:duration=longest,` +
  // Shave the few hottest transients (~-7 dBFS ceiling) so loudnorm can reach
  // -14 LUFS with one linear gain instead of riding the gain dynamically.
  `alimiter=limit=0.45:attack=2:release=60:level=0`;
const loudnorm = `loudnorm=I=${LUFS}:TP=${TRUE_PEAK}:LRA=11`;

// Pass 1: measure the mix (loudnorm prints its stats as JSON on stderr).
const pass1 = spawnSync(
  "ffmpeg",
  ["-hide_banner", "-nostats", "-i", sfxPath, "-i", musicPath,
    "-filter_complex", `${mixGraph(0, 1)},${loudnorm}:print_format=json`, "-f", "null", "-"],
  { encoding: "utf8" },
).stderr;
const m = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/.exec(pass1)[0]);

// Pass 2: normalize linearly to the target, encode AAC, copy the video stream untouched.
const out = join(here, `orc-dot${variant}-promo.mp4`);
execFileSync(
  "ffmpeg",
  ["-y", "-hide_banner", "-loglevel", "error",
    "-i", join(build, `video${variant}.mp4`), "-i", sfxPath, "-i", musicPath,
    "-filter_complex",
    `${mixGraph(1, 2)},${loudnorm}:linear=true` +
      `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
      `:measured_thresh=${m.input_thresh}:offset=${m.target_offset},aresample=48000[a]`,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
    "-t", String(duration),
    "-movflags", "+faststart",
    out],
  { stdio: "inherit" },
);
// loudnorm only stays linear if the gain needed won't push peaks past the ceiling.
const gain = LUFS - Number(m.input_i);
const mode = Number(m.input_tp) + gain <= TRUE_PEAK ? "linear" : "dynamic (peaks too hot)";
console.log(`Wrote ${out} (${m.input_i} LUFS → ${LUFS}, +${gain.toFixed(1)} dB, ${mode})`);
