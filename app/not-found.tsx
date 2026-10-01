import type { Metadata } from "next";
import Link from "next/link";
import { AvatarCanvas } from "@/components/avatar/AvatarCanvas";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-4 text-center">
      <AvatarCanvas
        config={{
          shape: "blob",
          skin: "moss",
          ears: "droopy",
          eyes: "sleepy",
          eyeMotion: "glance",
          brows: "worried",
          mouth: "grumpy",
          tusks: "chipped",
          hair: "none",
          hairColor: "black",
          beard: "none",
          headgear: "none",
          markings: "none",
          trinket: "none",
          motion: "breathe",
        }}
        size={180}
      />
      <h1 className="text-3xl font-semibold tracking-tight">This orc got lost</h1>
      <p className="text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2 font-heading font-medium text-primary-foreground hover:opacity-90"
      >
        Back to the studio
      </Link>
    </main>
  );
}
