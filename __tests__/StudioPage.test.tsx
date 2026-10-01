import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "@/app/page";

describe("Studio page", () => {
  it("renders product name, preview, and controls", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { level: 1, name: /orc dot/i }),
    ).toBeInTheDocument();
    // Thumbnails are decorative, so only the main preview is announced.
    expect(screen.getAllByRole("img", { name: /orc avatar/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /randomize/i })).toBeInTheDocument();
    expect(screen.getByText("Shape")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("server-renders crawlable copy and structured data", () => {
    const { container } = render(<Page />);
    expect(screen.getByRole("heading", { level: 2, name: /three steps/i })).toBeInTheDocument();
    expect(screen.getByText(/do i need an account/i)).toBeInTheDocument();
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(ld!.textContent!)).toMatchObject({
      "@type": "WebApplication",
      name: "Orc Dot",
    });
  });

  it("pauses and resumes the preview animation", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(preview).not.toHaveClass("orc-paused");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(preview).toHaveClass("orc-paused");
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(preview).not.toHaveClass("orc-paused");
  });
});
