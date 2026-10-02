"use client";

import { useState, type RefObject } from "react";
import { DocumentDownload, ExportSquare } from "iconsax-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Avatar3DHandle } from "@/lib/avatar/three/types";

export function Export3DPanel({
  avatarRef,
  ready,
}: {
  avatarRef: RefObject<Avatar3DHandle | null>;
  ready: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function exportFile(format: "png" | "glb") {
    if (!avatarRef.current || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      if (format === "png") await avatarRef.current.downloadPng();
      else await avatarRef.current.downloadGlb();
      setStatus(`${format.toUpperCase()} download started`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Export failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog onOpenChange={() => setStatus(null)}>
      <DialogTrigger
        render={<Button disabled={!ready} className="w-full gap-2" />}
      >
        <ExportSquare size={18} variant="Bold" color="currentColor" />
        Export 3D avatar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export your furry orc</DialogTitle>
          <DialogDescription>
            Take a portrait from the current angle or download the 3D model for
            your own scenes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border p-4">
            <h3 className="font-medium">PNG portrait</h3>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              A 1024 × 1024 image with a transparent background. Rotate your orc
              before exporting to choose its pose.
            </p>
            <Button
              variant="secondary"
              disabled={busy || !ready}
              onClick={() => exportFile("png")}
              className="gap-2"
            >
              <DocumentDownload size={16} color="currentColor" />
              Download PNG
            </Button>
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-medium">GLB model</h3>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Geometry, fur, colors, and gear in a neutral pose, ready for
              Blender or a 3D viewer. Preview animations and studio lighting are
              not included.
            </p>
            <Button
              variant="secondary"
              disabled={busy || !ready}
              onClick={() => exportFile("glb")}
              className="gap-2"
            >
              <DocumentDownload size={16} color="currentColor" />
              Download GLB
            </Button>
          </div>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {busy ? "Preparing your avatar…" : status}
        </p>
      </DialogContent>
    </Dialog>
  );
}
