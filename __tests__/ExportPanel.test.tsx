import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { DEFAULT_CONFIG } from "@/lib/avatar/types";

const raster = vi.hoisted(() => ({
  exportPng: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
  exportGif: vi.fn(async (_config: unknown, { onProgress }: { onProgress?: (p: number) => void }) => {
    onProgress?.(0.5);
    return new Blob(["gif"], { type: "image/gif" });
  }),
}));
vi.mock("@/lib/avatar/export/raster", () => raster);

// jsdom's Blob has no .text().
const readText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

/** Captures downloads triggered through a temporary <a download>. */
function captureDownloads() {
  const files: { name: string; blob: Blob }[] = [];
  const blobs = new Map<string, Blob>();
  let n = 0;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:test/${n++}`;
    blobs.set(url, blob);
    return url;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, blob: blobs.get(this.href)! });
  });
  return files;
}

describe("ExportPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens dialog with SVG, CSS, and inline-SVG note", async () => {
    const user = userEvent.setup();
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByText(/inline svg/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy svg/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy css/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download svg/i }),
    ).toBeInTheDocument();
    // SVG + CSS previews both contain the class name
    expect(screen.getAllByText(/orc-avatar/).length).toBeGreaterThan(0);
  });

  it("copies SVG via clipboard API", async () => {
    const user = userEvent.setup();
    // userEvent.setup() attaches its own clipboard stub — spy after setup
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("button", { name: /copy svg/i }));
    expect(writeText).toHaveBeenCalled();
    const arg = writeText.mock.calls[0][0];
    expect(arg).toContain("<svg");
  });

  it("shows textarea fallback when clipboard throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("denied"),
    );
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("button", { name: /copy svg/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("lists every export format", async () => {
    const user = userEvent.setup();
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    for (const name of [/svg \+ css/i, /animated svg/i, /^png/i, /^gif/i, /lottie/i]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("downloads the CSS snippet and a self-contained animated SVG", async () => {
    const user = userEvent.setup();
    const files = captureDownloads();
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("button", { name: /download css/i }));
    expect(files[0].name).toBe("orc-avatar.css");
    expect(await readText(files[0].blob)).toContain("@keyframes");

    await user.click(screen.getByRole("button", { name: /animated svg/i }));
    await user.click(screen.getByRole("button", { name: /download animated svg/i }));
    expect(files[1].name).toBe("orc-avatar-animated.svg");
    const svg = await readText(files[1].blob);
    expect(svg).toMatch(/^<svg[^>]*><style>/);
  });

  it("exports a PNG at the chosen size and background", async () => {
    const user = userEvent.setup();
    const files = captureDownloads();
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("button", { name: /^png/i }));
    await user.click(screen.getByRole("button", { name: "1024px" }));
    await user.click(screen.getByRole("button", { name: "White" }));
    await user.click(screen.getByRole("button", { name: /download png/i }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(raster.exportPng).toHaveBeenCalledWith(DEFAULT_CONFIG, { size: 1024, background: "white" });
    expect(files[0].name).toBe("orc-avatar-1024.png");
    expect(screen.getByRole("status")).toHaveTextContent(/png downloaded/i);
  });

  it("exports a GIF with progress and keeps per-format sizes", async () => {
    const user = userEvent.setup();
    const files = captureDownloads();
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("button", { name: /^gif/i }));
    // GIF defaults to 256px and offers no huge sizes.
    expect(screen.getByRole("button", { name: "256px" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "2048px" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /download gif/i }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(raster.exportGif).toHaveBeenCalledWith(
      DEFAULT_CONFIG,
      expect.objectContaining({ size: 256, background: "transparent" }),
    );
    expect(files[0].name).toBe("orc-avatar-256.gif");
  });

  it("reports a failed export", async () => {
    const user = userEvent.setup();
    captureDownloads();
    raster.exportPng.mockRejectedValueOnce(new Error("Canvas is not available"));
    render(<ExportPanel config={DEFAULT_CONFIG} />);
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("button", { name: /^png/i }));
    await user.click(screen.getByRole("button", { name: /download png/i }));
    expect(await screen.findByText(/couldn't create the png: canvas is not available/i)).toBeInTheDocument();
  });
});

