import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudioControls } from "@/components/studio/StudioControls";
import { DEFAULT_CONFIG } from "@/lib/avatar/types";

describe("StudioControls", () => {
  it("renders face sections by default", () => {
    render(<StudioControls value={DEFAULT_CONFIG} onChange={() => {}} />);
    for (const title of ["Shape", "Skin", "Ears", "Eyes", "Brows", "Mouth", "Tusks"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("switches to gear and motion tabs", async () => {
    const user = userEvent.setup();
    render(<StudioControls value={DEFAULT_CONFIG} onChange={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Gear" }));
    for (const title of ["Hair", "Beard", "Headgear", "War paint", "Trinkets"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    await user.click(screen.getByRole("tab", { name: "Motion" }));
    expect(screen.getByText("Body motion")).toBeInTheDocument();
    expect(screen.getByText("Eye motion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Look around" })).toBeInTheDocument();
  });

  it("calls onChange with new shape when a shape is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StudioControls value={DEFAULT_CONFIG} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /egg/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.shape).toBe("egg");
  });

  it("lets the latest pick win a conflict", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <StudioControls
        value={{ ...DEFAULT_CONFIG, hair: "mohawk" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Gear" }));
    await user.click(screen.getByRole("button", { name: "Horned helm" }));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.headgear).toBe("horned-helm");
    expect(next.hair).toBe("none");
  });

  it("renders skin options as labelled swatches", () => {
    render(<StudioControls value={DEFAULT_CONFIG} onChange={() => {}} />);
    const moss = screen.getByRole("button", { name: "Moss" });
    expect(moss).toHaveAttribute("aria-pressed", "true");
    expect(moss.style.backgroundColor).not.toBe("");
  });
});
