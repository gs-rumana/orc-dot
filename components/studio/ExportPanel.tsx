"use client";

import { useMemo, useState } from "react";
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
import { buildCss } from "@/lib/avatar/buildCss";
import { buildSvg } from "@/lib/avatar/buildSvg";
import type { AvatarConfig } from "@/lib/avatar/types";

async function copyText(text: string): Promise<"ok" | "fallback"> {
  try {
    if (!navigator.clipboard?.writeText) return "fallback";
    await navigator.clipboard.writeText(text);
    return "ok";
  } catch {
    return "fallback";
  }
}

function downloadSvgFile(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
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

export function ExportPanel({ config }: { config: AvatarConfig }) {
  const svg = useMemo(() => buildSvg(config), [config]);
  const css = useMemo(() => buildCss(config), [config]);
  const [fallback, setFallback] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onCopySvg = async () => {
    const result = await copyText(svg);
    if (result === "ok") {
      setFallback(null);
      setStatus("SVG copied");
    } else {
      setFallback(svg);
      setStatus("Clipboard blocked — select and copy from the box below");
    }
  };

  const onCopyCss = async () => {
    const result = await copyText(css);
    if (result === "ok") {
      setFallback(null);
      setStatus("CSS copied");
    } else {
      setFallback(css);
      setStatus("Clipboard blocked — select and copy from the box below");
    }
  };

  return (
    <Dialog
      onOpenChange={() => {
        setFallback(null);
        setStatus(null);
      }}
    >
      <DialogTrigger render={<Button className="w-full gap-2" />}>
        <ExportSquare size={18} variant="Bold" color="currentColor" />
        Export
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export avatar</DialogTitle>
          <DialogDescription>
            Motion requires an <strong>inline SVG</strong> (or{" "}
            <code className="text-xs">&lt;object&gt;</code>). CSS animations do
            not run on external <code className="text-xs">&lt;img&gt;</code>{" "}
            SVGs. Paste the CSS snippet into your stylesheet, then embed the SVG
            markup inline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={onCopySvg}
          >
            <Copy size={16} variant="Bold" color="currentColor" />
            Copy SVG
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={onCopyCss}
          >
            <Copy size={16} variant="Bold" color="currentColor" />
            Copy CSS
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => downloadSvgFile(svg, "orc-avatar.svg")}
          >
            <DocumentDownload size={16} variant="Bold" color="currentColor" />
            Download SVG
          </Button>
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

        <div className="space-y-2">
          <h3 className="text-sm font-medium">SVG</h3>
          <pre className="max-h-40 overflow-auto rounded-md border bg-muted p-2 text-xs whitespace-pre-wrap break-all">
            {svg}
          </pre>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">CSS snippet</h3>
          <pre className="max-h-40 overflow-auto rounded-md border bg-muted p-2 text-xs whitespace-pre-wrap">
            {css}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
