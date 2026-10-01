import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { DEFAULT_CONFIG } from "@/lib/avatar/types";

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
});
