import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Reveal } from "./Reveal";
import { RollingNumber } from "./RollingNumber";

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;

class FakeObserver {
  static instances: FakeObserver[] = [];
  disconnected = false;
  constructor(
    readonly callback: Callback,
    readonly options: { threshold: number },
  ) {
    FakeObserver.instances.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

beforeEach(() => {
  FakeObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Reveal", () => {
  it("starts hidden, then reveals once when 15% is visible, and stops watching", () => {
    render(<Reveal data-testid="block">Hello</Reveal>);
    const block = screen.getByTestId("block");
    expect(block).toHaveAttribute("data-revealed", "false");
    expect(block.className).toContain("reveal");
    const observer = FakeObserver.instances[0];
    expect(observer?.options.threshold).toBe(0.15);

    act(() => observer?.fire(false));
    expect(block).toHaveAttribute("data-revealed", "false");
    act(() => observer?.fire(true));
    expect(block).toHaveAttribute("data-revealed", "true");
    expect(observer?.disconnected).toBe(true);
  });

  it("staggers siblings by 80 ms each", () => {
    render(
      <>
        <Reveal index={0} data-testid="a">a</Reveal>
        <Reveal index={1} data-testid="b">b</Reveal>
        <Reveal index={3} data-testid="d">d</Reveal>
      </>,
    );
    expect(screen.getByTestId("a").style.getPropertyValue("--reveal-delay")).toBe("0ms");
    expect(screen.getByTestId("b").style.getPropertyValue("--reveal-delay")).toBe("80ms");
    expect(screen.getByTestId("d").style.getPropertyValue("--reveal-delay")).toBe("240ms");
  });

  it("renders the element type it was asked for and keeps its own classes and attributes", () => {
    render(
      <ul>
        <Reveal as="li" className="border-t" id="step">One</Reveal>
      </ul>,
    );
    const item = screen.getByRole("listitem");
    expect(item.tagName).toBe("LI");
    expect(item).toHaveClass("reveal", "border-t");
    expect(item).toHaveAttribute("id", "step");
  });

  it("shows everything at once where IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Reveal data-testid="block">Hello</Reveal>);
    expect(screen.getByTestId("block")).toHaveAttribute("data-revealed", "true");
  });
});

describe("RollingNumber", () => {
  it("shows the value, and keeps the old one around for 400 ms while rolling to the new one", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<RollingNumber value="A-17" />);
    expect(container.textContent).toBe("A-17");
    expect(container.querySelector(".roll-out")).toBeNull();

    rerender(<RollingNumber value="A-18" />);
    expect(container.querySelector(".roll-out")?.textContent).toBe("A-17");
    expect(container.querySelector(".roll-in")?.textContent).toBe("A-18");
    expect(container.querySelector(".roll-out")).toHaveAttribute("aria-hidden", "true");

    act(() => void vi.advanceTimersByTime(399));
    expect(container.querySelector(".roll-out")).not.toBeNull();
    act(() => void vi.advanceTimersByTime(2));
    expect(container.querySelector(".roll-out")).toBeNull();
    expect(container.textContent).toBe("A-18");
  });

  it("accepts numbers and does nothing when the value is unchanged", () => {
    const { container, rerender } = render(<RollingNumber value={32} />);
    rerender(<RollingNumber value={32} />);
    expect(container.querySelector(".roll-out")).toBeNull();
    rerender(<RollingNumber value={25} />);
    expect(container.querySelector(".roll-in")?.textContent).toBe("25");
  });

  it("handles several quick changes without leaving stale values behind", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<RollingNumber value={1} />);
    rerender(<RollingNumber value={2} />);
    act(() => void vi.advanceTimersByTime(100));
    rerender(<RollingNumber value={3} />);
    act(() => void vi.advanceTimersByTime(500));
    expect(container.textContent).toBe("3");
  });
});
