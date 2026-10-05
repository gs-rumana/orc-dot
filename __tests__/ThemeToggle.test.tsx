import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { DEFAULT_CONFIG } from "@/lib/avatar/types";
import { SITE } from "@/lib/site";

const raster = vi.hoisted(() => ({
  exportPng: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
  exportGif: vi.fn(),
}));
vi.mock("@/lib/avatar/export/raster", () => raster);

/** jsdom has no matchMedia; next-themes reads it for the "system" theme. */
function stubSystemTheme(scheme: "light" | "dark") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && scheme === "dark",
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
}

function renderWithTheme(ui: ReactNode = null) {
  return render(
    <ThemeProvider>
      <ThemeToggle />
      {ui}
    </ThemeProvider>,
  );
}

const html = document.documentElement;

describe("Theme toggle", () => {
  beforeEach(() => {
    stubSystemTheme("light");
    for (const media of ["light", "dark"]) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.media = `(prefers-color-scheme: ${media})`;
      meta.content = media === "dark" ? SITE.themeColorDark : SITE.themeColor;
      document.head.append(meta);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    html.className = "";
    html.removeAttribute("style");
    document.head
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.remove());
  });

  it("follows the system setting until the user picks a theme", async () => {
    stubSystemTheme("dark");
    renderWithTheme();
    await waitFor(() => expect(html).toHaveClass("dark"));
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches theme, saves the choice and recolors the browser bar", async () => {
    const user = userEvent.setup();
    renderWithTheme();
    const metas = () =>
      [...document.querySelectorAll('meta[name="theme-color"]')].map(
        (meta) => meta.getAttribute("content"),
      );

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(html).toHaveClass("dark");
    expect(html.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(metas()).toEqual([SITE.themeColorDark, SITE.themeColorDark]);

    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(html).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(metas()).toEqual([SITE.themeColor, SITE.themeColor]);
  });

  it("crossfades into the new theme when the browser supports it", async () => {
    const user = userEvent.setup();
    let darkAfterUpdate = false;
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      darkAfterUpdate = html.classList.contains("dark");
    });
    document.startViewTransition =
      startViewTransition as unknown as typeof document.startViewTransition;
    try {
      renderWithTheme();
      await user.click(screen.getByRole("button", { name: "Dark" }));
      expect(startViewTransition).toHaveBeenCalledOnce();
      // The browser snapshots the page right after the update callback.
      expect(darkAfterUpdate).toBe(true);
    } finally {
      // @ts-expect-error jsdom has no view transitions; restore that.
      delete document.startViewTransition;
    }
  });

  it("restores a saved theme on the next visit", async () => {
    localStorage.setItem("theme", "dark");
    renderWithTheme();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(html).toHaveClass("dark");
  });

  it("exports the same files in light and dark", async () => {
    const user = userEvent.setup();
    const downloads: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      downloads.push(blob);
      return `blob:test/${downloads.length}`;
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWithTheme(<ExportPanel config={DEFAULT_CONFIG} />);

    const exportAll = async () => {
      await user.click(screen.getByRole("button", { name: /^export$/i }));
      await user.click(screen.getByRole("button", { name: /^svg \+ css/i }));
      await user.click(screen.getByRole("button", { name: /download svg/i }));
      await user.click(screen.getByRole("button", { name: /download css/i }));
      await user.click(screen.getByRole("button", { name: /^png/i }));
      await user.click(screen.getByRole("button", { name: /download png/i }));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(/png downloaded/i),
      );
      await user.keyboard("{Escape}");
    };

    await user.click(screen.getByRole("button", { name: "Light" }));
    await exportAll();
    await user.click(screen.getByRole("button", { name: "Dark" }));
    await exportAll();

    const text = (blob: Blob) =>
      new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
      });
    const files = await Promise.all(downloads.map(text));
    expect(files).toHaveLength(6);
    expect(files.slice(3)).toEqual(files.slice(0, 3));
    // The transparent PNG takes nothing from the page, so dark can't leak in.
    expect(raster.exportPng.mock.calls).toEqual([
      [DEFAULT_CONFIG, { size: 512, background: "transparent" }],
      [DEFAULT_CONFIG, { size: 512, background: "transparent" }],
    ]);
  });
});
