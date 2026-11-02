import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { Parchi } from "../signature/Parchi";
import { ReferenceText } from "./ReferenceText";
import { Sparkline } from "./Sparkline";
import { renderWithProviders, resetStores } from "../../test-utils";

beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Sparkline", () => {
  it("draws nothing for a single reading", () => {
    renderWithProviders(<Sparkline label="trend" points={[{ date: "2026-01-01T00:00:00Z", value: 7 }]} />);
    expect(screen.queryByTestId("sparkline")).toBeNull();
  });

  it("draws a labelled line for two or more readings", () => {
    renderWithProviders(
      <Sparkline label="HbA1c trend" points={[{ date: "2026-01-01T00:00:00Z", value: 7.9 }, { date: "2026-05-01T00:00:00Z", value: 7.1 }]} />,
    );
    expect(screen.getByRole("img", { name: "HbA1c trend" })).toBeInTheDocument();
  });
});

describe("ReferenceText", () => {
  it("writes a two-sided range, an upper limit and a lower limit", () => {
    const { container, rerender } = renderWithProviders(<ReferenceText observation={{ reference: { low: 4, high: 5.6 }, unit: "%" }} />);
    expect(container).toHaveTextContent("Usual range 4 to 5.6 %");
    rerender(<ReferenceText observation={{ reference: { low: 0, high: 200 }, unit: "mg/dL" }} />);
    expect(container).toHaveTextContent("Usual range up to 200 mg/dL");
    rerender(<ReferenceText observation={{ reference: { low: 30, high: null }, unit: "ng/mL" }} />);
    expect(container).toHaveTextContent("Usual range from 30 ng/mL");
  });
});

describe("Parchi", () => {
  it("lists every question and copies them when sharing is not available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    renderWithProviders(<Parchi questions={["First?", "Second?"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Questions to ask your doctor\n\n1. First?\n2. Second?"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("uses the native share sheet when the device has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    renderWithProviders(<Parchi questions={["Only?"]} title="My list" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "My list", text: "My list\n\n1. Only?" }));
  });
});
