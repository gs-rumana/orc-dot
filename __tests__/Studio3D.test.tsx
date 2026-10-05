import { useEffect, useImperativeHandle, type Ref } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Studio } from "@/components/studio/Studio";
import type { Avatar3DHandle } from "@/lib/avatar/three/types";

// jsdom has no GPU; real geometry and GLB export are checked separately.
vi.mock("next/dynamic", () => ({ default: () => Preview }));
function Preview({
  onReady,
  apiRef,
}: {
  onReady: (ready: boolean) => void;
  apiRef: Ref<Avatar3DHandle>;
}) {
  useEffect(() => {
    onReady(true);
    return () => onReady(false);
  }, [onReady]);
  useImperativeHandle(apiRef, () => ({
    resetView() {},
    async downloadPng() {},
    async downloadGlb() {},
  }));
  return <div role="img" aria-label="3D furry orc" />;
}

describe("3D studio integration", () => {
  it("switches formats and preserves each avatar's customization", async () => {
    const user = userEvent.setup();
    render(<Studio />);
    await user.click(screen.getByRole("button", { name: "Egg" }));
    await user.click(screen.getByRole("button", { name: "3D furry" }));
    expect(
      screen.getByRole("img", { name: "3D furry orc" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Shape")).toBeInTheDocument();
    // 3D has a single Color row: plush colors and skin tones together.
    expect(screen.queryByText("Skin")).not.toBeInTheDocument();
    expect(screen.queryByText("Fur color")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Blue" }));
    await user.click(screen.getByRole("button", { name: "Velvet" }));
    await user.click(screen.getByRole("button", { name: "Ember" }));
    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(screen.getByRole("tab", { name: "Gear" }));
    expect(
      screen.getByRole("button", { name: "Match color" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Face" }));
    await user.click(screen.getByRole("button", { name: "2D SVG" }));
    expect(screen.getByRole("button", { name: "Egg" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Moss" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "3D furry" }));
    expect(
      screen.getByRole("heading", { name: "Plush orc" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Velvet" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Ember" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("resets the plush orc and keeps the existing gear choices", async () => {
    const user = userEvent.setup();
    render(<Studio />);
    await user.click(screen.getByRole("button", { name: "3D furry" }));
    await user.click(screen.getByRole("button", { name: "Pink" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(
      screen.getByRole("heading", { name: "Plush orc" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Gear" }));
    expect(screen.getByText("Headgear")).toBeInTheDocument();
    expect(screen.getByText("Trinkets")).toBeInTheDocument();
    expect(screen.getByText("Hair")).toBeInTheDocument();
    expect(screen.getByText("Beard")).toBeInTheDocument();
  });

  it("offers PNG and GLB downloads in 3D mode", async () => {
    const user = userEvent.setup();
    render(<Studio />);
    await user.click(screen.getByRole("button", { name: "3D furry" }));
    await user.click(screen.getByRole("button", { name: "Export 3D avatar" }));
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Download GLB" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "GLB download started",
    );
    expect(
      screen.queryByRole("button", { name: "Copy SVG" }),
    ).not.toBeInTheDocument();
  });
});
