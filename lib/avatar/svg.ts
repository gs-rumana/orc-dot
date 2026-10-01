/** Small helpers for building SVG markup strings. */

export type Attrs = Record<string, string | number | undefined | null | false>;

/** Rounds to 2 decimals so generated markup stays short and stable. */
export function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function el(tag: string, attrs: Attrs = {}, children = ""): string {
  const attrText = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? num(v) : v}"`)
    .join("");
  return children
    ? `<${tag}${attrText}>${children}</${tag}>`
    : `<${tag}${attrText}/>`;
}

export function group(className: string, children: string): string {
  return children ? el("g", { class: className }, children) : "";
}

/**
 * Translates and/or mirrors absolute path data. Supports M L C Q S T H V Z
 * (uppercase only) — enough for every path in the catalog.
 */
export function transformPath(
  d: string,
  { dx = 0, dy = 0, mirrorX }: { dx?: number; dy?: number; mirrorX?: number },
): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const mapX = (x: number) =>
    (mirrorX === undefined ? x : 2 * mirrorX - x) + dx;
  const mapY = (y: number) => y + dy;
  const out: string[] = [];
  let cmd = "";
  let argIndex = 0;

  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      if (!/[MLCQSTHVZ]/.test(token)) {
        throw new Error(`transformPath: unsupported command "${token}"`);
      }
      cmd = token;
      argIndex = 0;
      out.push(token);
      continue;
    }
    const value = Number(token);
    let mapped: number;
    if (cmd === "H") mapped = mapX(value);
    else if (cmd === "V") mapped = mapY(value);
    else mapped = argIndex % 2 === 0 ? mapX(value) : mapY(value);
    argIndex++;
    out.push(num(mapped));
  }
  return out.join(" ").replace(/ ?([A-Z]) ?/g, "$1");
}

export function mirror(d: string, axis = 64): string {
  return transformPath(d, { mirrorX: axis });
}

/** Closed polygon path with rounded corners of radius `r`. */
export function roundedPolygon(points: [number, number][], r: number): string {
  const n = points.length;
  const toward = (from: [number, number], to: [number, number]) => {
    const [x1, y1] = from;
    const [x2, y2] = to;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const t = Math.min(r / len, 0.5);
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  };
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = toward(p, points[(i - 1 + n) % n]);
    const b = toward(p, points[(i + 1) % n]);
    parts.push(
      `${i === 0 ? "M" : "L"}${num(a[0])} ${num(a[1])}Q${num(p[0])} ${num(p[1])} ${num(b[0])} ${num(b[1])}`,
    );
  }
  return parts.join("") + "Z";
}

/** Linear mix of two #RRGGBB colors; t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const parse = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const ca = parse(a);
  const cb = parse(b);
  return (
    "#" +
    ca
      .map((v, i) =>
        Math.round(v + (cb[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}
