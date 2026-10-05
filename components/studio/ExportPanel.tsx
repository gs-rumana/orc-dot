"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, DocumentDownload, ExportSquare } from "iconsax-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildCss } from "@/lib/avatar/buildCss";
import { buildSvg } from "@/lib/avatar/buildSvg";
import { buildAnimatedSvg } from "@/lib/avatar/export/animatedSvg";
import type { AvatarConfig } from "@/lib/avatar/types";

type FormatId = "svg-css" | "animated-svg" | "png" | "gif" | "lottie";
type Background = "transparent" | "white";

interface FormatSpec {
  id: FormatId;
  label: string;
  tag: string;
  description: string;
  /** Pixel sizes offered for raster formats; the first is the default. */
  sizes?: number[];
}

const FORMATS: FormatSpec[] = [
  {
    id: "svg-css",
    label: "SVG + CSS",
    tag: "Web",
    description:
      "For websites. Paste the SVG inline in your HTML and add the CSS snippet to make it move. On its own the SVG is a crisp still image.",
  },
  {
    id: "animated-svg",
    label: "Animated SVG",
    tag: "One file",
    description:
      "A single SVG with the animation built in. It moves even inside an <img> tag and stays sharp at any size.",
  },
  {
    id: "png",
    label: "PNG",
    tag: "Still",
    description:
      "A still picture for profile photos, documents and anywhere SVG isn't accepted.",
    sizes: [512, 256, 1024, 2048],
  },
  {
    id: "gif",
    label: "GIF",
    tag: "Animated",
    description:
      "A looping animation that plays almost everywhere: chats, forums, email and slides. GIF transparency has hard edges, so pick White if it will sit on a dark background.",
    sizes: [256, 128, 512],
  },
  {
    id: "lottie",
    label: "Lottie",
    tag: "Vector",
    description:
      "Lottie JSON for apps and websites (lottie-web, iOS, Android, After Effects plugins). Fully vector and loops seamlessly.",
  },
];

async function copyText(text: string): Promise<"ok" | "fallback"> {
  try {
    if (!navigator.clipboard?.writeText) return "fallback";
    await navigator.clipboard.writeText(text);
    return "ok";
  } catch {
    return "fallback";
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const downloadText = (text: string, filename: string, type: string) =>
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);

const CHIP =
  "h-8 rounded-full border border-border bg-card px-3 text-[0.8rem] font-semibold text-foreground/80 hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

function Choice<T extends string | number>({
  label,
  value,
  options,
  format = String,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  format?: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-sm font-medium">{label}</span>
      <ToggleGroup
        aria-label={label}
        value={[String(value)]}
        onValueChange={(v) => {
          const next = options.find((o) => String(o) === v[0]);
          if (next !== undefined) onChange(next);
        }}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((o) => (
          <ToggleGroupItem key={String(o)} value={String(o)} className={CHIP}>
            {format(o)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function ExportPanel({ config }: { config: AvatarConfig }) {
  const svg = useMemo(() => buildSvg(config), [config]);
  const css = useMemo(() => buildCss(config), [config]);
  const [formatId, setFormatId] = useState<FormatId>("svg-css");
  const [sizes, setSizes] = useState<Partial<Record<FormatId, number>>>({});
  const [background, setBackground] = useState<Background>("transparent");
  const [fallback, setFallback] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped on close so a slow export finishing later doesn't download.
  const run = useRef(0);

  const format = FORMATS.find((f) => f.id === formatId)!;
  const size = format.sizes ? (sizes[formatId] ?? format.sizes[0]) : undefined;

  const copy = async (text: string, what: string) => {
    if ((await copyText(text)) === "ok") {
      setFallback(null);
      setStatus(`${what} copied`);
    } else {
      setFallback(text);
      setStatus("Clipboard blocked — select and copy from the box below");
    }
  };

  const generate = async (
    label: string,
    make: (id: number) => Promise<void>,
  ) => {
    const id = ++run.current;
    setBusy(true);
    setFallback(null);
    setStatus(`Creating ${label}…`);
    try {
      await make(id);
      if (run.current === id) setStatus(`${label} downloaded`);
    } catch (error) {
      if (run.current === id) {
        setStatus(
          `Couldn't create the ${label}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    } finally {
      if (run.current === id) setBusy(false);
    }
  };

  const onDownload = () => {
    switch (formatId) {
      case "svg-css":
        downloadText(svg, "orc-avatar.svg", "image/svg+xml");
        setStatus("SVG downloaded");
        return;
      case "animated-svg":
        downloadText(
          buildAnimatedSvg(config),
          "orc-avatar-animated.svg",
          "image/svg+xml",
        );
        setStatus("Animated SVG downloaded");
        return;
      case "png":
        return generate("PNG", async (id) => {
          const { exportPng } = await import("@/lib/avatar/export/raster");
          const blob = await exportPng(config, { size: size!, background });
          if (run.current === id) downloadBlob(blob, `orc-avatar-${size}.png`);
        });
      case "gif":
        return generate("GIF", async (id) => {
          const { exportGif } = await import("@/lib/avatar/export/raster");
          const blob = await exportGif(config, {
            size: size!,
            background,
            onProgress: (p) => {
              if (run.current === id)
                setStatus(`Creating GIF… ${Math.round(p * 100)}%`);
            },
          });
          if (run.current === id) downloadBlob(blob, `orc-avatar-${size}.gif`);
        });
      case "lottie":
        return generate("Lottie file", async (id) => {
          const [{ sampleAnimation }, { buildLottie }] = await Promise.all([
            import("@/lib/avatar/export/sample"),
            import("@/lib/avatar/export/lottie"),
          ]);
          const lottie = buildLottie(
            await sampleAnimation(config, { fps: 30 }),
          );
          if (run.current === id)
            downloadText(
              JSON.stringify(lottie),
              "orc-avatar-lottie.json",
              "application/json",
            );
        });
    }
  };

  return (
    <Dialog
      onOpenChange={() => {
        run.current++;
        setBusy(false);
        setFallback(null);
        setStatus(null);
      }}
    >
      <DialogTrigger render={<Button className="h-auto w-full gap-2 py-2" />}>
        <ExportSquare size={18} variant="Bold" color="currentColor" />
        Export
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export avatar</DialogTitle>
          <DialogDescription>
            Pick a format. Everything is made right here in your browser.
          </DialogDescription>
        </DialogHeader>

        <ToggleGroup
          aria-label="Format"
          value={[formatId]}
          onValueChange={(v) => {
            if (!v[0]) return;
            setFormatId(v[0] as FormatId);
            setFallback(null);
            setStatus(null);
          }}
          className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5"
        >
          {FORMATS.map((f) => (
            <ToggleGroupItem
              key={f.id}
              value={f.id}
              className="flex h-auto flex-col items-start gap-0.5 rounded-xl border border-border bg-card px-3 py-2 text-left hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              <span className="text-sm font-semibold">{f.label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {f.tag}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <p className="text-sm text-muted-foreground">{format.description}</p>

        {format.sizes ? (
          <div className="space-y-2">
            <Choice
              label="Size"
              value={size!}
              options={[...format.sizes].sort((a, b) => a - b)}
              format={(s) => `${s}px`}
              onChange={(s) => setSizes((prev) => ({ ...prev, [formatId]: s }))}
            />
            <Choice
              label="Background"
              value={background}
              options={["transparent", "white"] as const}
              format={(b) => (b === "transparent" ? "Transparent" : "White")}
              onChange={setBackground}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            onClick={onDownload}
            disabled={busy}
          >
            <DocumentDownload size={16} variant="Bold" color="currentColor" />
            Download {format.label === "SVG + CSS" ? "SVG" : format.label}
          </Button>
          {formatId === "svg-css" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => {
                  downloadText(css, "orc-avatar.css", "text/css");
                  setStatus("CSS downloaded");
                }}
              >
                <DocumentDownload
                  size={16}
                  variant="Bold"
                  color="currentColor"
                />
                Download CSS
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => copy(svg, "SVG")}
              >
                <Copy size={16} variant="Bold" color="currentColor" />
                Copy SVG
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => copy(css, "CSS")}
              >
                <Copy size={16} variant="Bold" color="currentColor" />
                Copy CSS
              </Button>
            </>
          ) : null}
          {formatId === "animated-svg" ? (
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() => copy(buildAnimatedSvg(config), "Animated SVG")}
            >
              <Copy size={16} variant="Bold" color="currentColor" />
              Copy code
            </Button>
          ) : null}
        </div>

        {status ? (
          <p className="text-sm text-muted-foreground" role="status">
            {status}
          </p>
        ) : null}

        {fallback ? (
          <textarea
            className="h-32 w-full rounded-md border bg-muted p-2 font-mono text-xs"
            readOnly
            value={fallback}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Clipboard fallback"
          />
        ) : null}

        {formatId === "svg-css" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Motion requires an <strong>inline SVG</strong> (or{" "}
              <code className="text-xs">&lt;object&gt;</code>). CSS animations
              from your stylesheet don&apos;t reach SVGs loaded through{" "}
              <code className="text-xs">&lt;img&gt;</code>. Need that? Use{" "}
              <strong>Animated SVG</strong>.
            </p>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">SVG</h3>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted p-2 text-xs break-all whitespace-pre-wrap">
                {svg}
              </pre>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">CSS snippet</h3>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted p-2 text-xs whitespace-pre-wrap">
                {css}
              </pre>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
