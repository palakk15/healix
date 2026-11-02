import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type { Profile } from "@core/api/schemas/backend";
import { preferencesStore } from "../../store";
import { renderWithI18n, resetStores } from "../../test-utils";
import { BodyMap } from "./BodyMap";
import { HoldToActivate } from "./HoldToActivate";
import { PainScale } from "./PainScale";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ReasoningTrail } from "./ReasoningTrail";
import { TokenTicket } from "./TokenTicket";
import { UrgencyBadge } from "./UrgencyBadge";

beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HoldToActivate", () => {
  function setup(props: Partial<React.ComponentProps<typeof HoldToActivate>> = {}) {
    vi.useFakeTimers();
    const onActivate = vi.fn();
    renderWithI18n(<HoldToActivate label="Hold for emergency help" hint="Press and hold for 2 seconds" holdingLabel="Keep holding…" onActivate={onActivate} {...props} />);
    return { onActivate, button: screen.getByTestId("hold-button") };
  }
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("fires only after a full two-second press", () => {
    const { onActivate, button } = setup();
    fireEvent.pointerDown(button);
    advance(1900);
    expect(onActivate).not.toHaveBeenCalled();
    advance(200);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("cancels and resets when released early", () => {
    const { onActivate, button } = setup();
    fireEvent.pointerDown(button);
    advance(1000);
    expect(screen.getByTestId("hold-fill").style.width).toMatch(/^(4\d|5\d)(\.\d+)?%$/);
    fireEvent.pointerUp(button);
    expect(screen.getByTestId("hold-fill").style.width).toBe("0%");
    advance(3000);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("cancels when the pointer is interrupted or focus moves away", () => {
    const { onActivate, button } = setup();
    fireEvent.pointerDown(button);
    advance(1500);
    fireEvent.pointerCancel(button);
    advance(1000);
    fireEvent.pointerDown(button);
    advance(1500);
    fireEvent.blur(button);
    advance(1000);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("works from the keyboard with Space, and ignores key repeat", () => {
    const { onActivate, button } = setup();
    fireEvent.keyDown(button, { key: " " });
    advance(1000);
    fireEvent.keyDown(button, { key: " ", repeat: true });
    advance(1100);
    expect(onActivate).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(button, { key: " " });
  });

  it("releasing the key early cancels", () => {
    const { onActivate, button } = setup();
    fireEvent.keyDown(button, { key: "Enter" });
    advance(1200);
    fireEvent.keyUp(button, { key: "Enter" });
    advance(2000);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("can be held again after it fired, and fires once per hold", () => {
    const { onActivate, button } = setup();
    fireEvent.pointerDown(button);
    advance(2500);
    fireEvent.pointerUp(button);
    advance(500);
    fireEvent.pointerDown(button);
    advance(2100);
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("announces holding, and does nothing when disabled", () => {
    const { button } = setup();
    fireEvent.pointerDown(button);
    advance(300);
    expect(screen.getByRole("status")).toHaveTextContent("Keep holding…");
    cleanup();
    const disabled = setup({ disabled: true });
    fireEvent.pointerDown(disabled.button);
    advance(3000);
    expect(disabled.onActivate).not.toHaveBeenCalled();
  });

  it("describes the hold for assistive technology and fills the ring in the round variant", () => {
    const { button } = setup({ variant: "round" });
    expect(button).toHaveAccessibleName("Hold for emergency help. Press and hold for 2 seconds");
    const ring = screen.getByTestId("hold-ring");
    const full = Number(ring.getAttribute("stroke-dasharray"));
    expect(Number(ring.getAttribute("stroke-dashoffset"))).toBe(full);
    fireEvent.pointerDown(button);
    advance(1000);
    expect(Number(ring.getAttribute("stroke-dashoffset"))).toBeCloseTo(full / 2, -1);
  });
});

describe("UrgencyBadge", () => {
  it.each([
    ["emergency", "Emergency"],
    ["urgent", "Urgent · today"],
    ["soon", "Within 2 days"],
    ["routine", "Routine"],
  ] as const)("shows an icon, the word and a colour for %s", (urgency, word) => {
    const { container } = renderWithI18n(<UrgencyBadge urgency={urgency} />);
    const badge = container.querySelector(`[data-urgency="${urgency}"]`);
    expect(badge).toHaveTextContent(word);
    expect(badge?.querySelector("svg")).not.toBeNull();
    expect(badge?.className).toMatch(/bg-|border-/);
  });

  it("only uses the emergency colours for an emergency", () => {
    const { container } = renderWithI18n(
      <>
        <UrgencyBadge urgency="emergency" />
        <UrgencyBadge urgency="urgent" />
        <UrgencyBadge urgency="soon" />
        <UrgencyBadge urgency="routine" />
      </>,
    );
    const withEmergencyColours = [...container.querySelectorAll("[data-urgency]")].filter((node) => /emergency/.test(node.className));
    expect(withEmergencyColours.map((node) => node.getAttribute("data-urgency"))).toEqual(["emergency"]);
  });

  it("speaks the patient's language", () => {
    preferencesStore.setState({ language: "mr" });
    renderWithI18n(<UrgencyBadge urgency="soon" />);
    expect(screen.getByText("2 दिवसांत")).toBeInTheDocument();
  });
});

describe("ReasoningTrail", () => {
  const steps = ["You described it", "No danger signs", "See a specialist"];

  it("reveals one step at a time, 250 ms apart", () => {
    vi.useFakeTimers();
    renderWithI18n(<ReasoningTrail steps={steps} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(240));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(20));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    act(() => void vi.advanceTimersByTime(250));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("colours the dots: input ink, safety check green, conclusion accent", () => {
    const { container } = renderWithI18n(<ReasoningTrail steps={steps} animate={false} />);
    const items = [...container.querySelectorAll("li")];
    expect(items.map((item) => item.getAttribute("data-kind"))).toEqual(["input", "safety", "conclusion"]);
    const dots = items.map((item) => item.querySelector("span[aria-hidden]:last-of-type")?.className ?? "");
    expect(dots[0]).toContain("bg-ink");
    expect(dots[1]).toContain("bg-ok");
    expect(dots[2]).toContain("bg-accent");
  });

  it("shows everything at once when animation is off", () => {
    renderWithI18n(<ReasoningTrail steps={steps} animate={false} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("TokenTicket", () => {
  it("shows the token, who it is for, what is being served and how many are ahead", () => {
    renderWithI18n(<TokenTicket label="A-23" nowServing="A-18" ahead={5} doctorLine="Dr. Meera Kulkarni · Room 4" />);
    expect(screen.getByTestId("ticket-number")).toHaveTextContent("A-23");
    expect(screen.getByText("Dr. Meera Kulkarni · Room 4")).toBeInTheDocument();
    expect(screen.getByText("Now serving")).toBeInTheDocument();
    expect(screen.getByText("A-18")).toBeInTheDocument();
    expect(screen.getByText("5 ahead of you")).toBeInTheDocument();
  });

  it("says it is your turn when nobody is ahead, and handles nobody being served yet", () => {
    renderWithI18n(<TokenTicket label="A-1" nowServing={null} ahead={0} doctorLine="Dr. X" />);
    expect(screen.getByText("Your turn")).toBeInTheDocument();
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("has a dashed perforation with two side notches", () => {
    const { container } = renderWithI18n(<TokenTicket label="A-1" nowServing="A-1" ahead={1} doctorLine="x" />);
    expect(container.querySelector(".border-dashed")).not.toBeNull();
    expect(container.querySelectorAll(".rounded-full.size-5")).toHaveLength(2);
  });
});

describe("BodyMap", () => {
  it("toggles regions by tap and by keyboard, and marks them selected", () => {
    const onToggle = vi.fn();
    renderWithI18n(<BodyMap selected={["stomach"]} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Stomach" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Chest" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Chest" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Head" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Neck and throat" }), { key: " " });
    expect(onToggle.mock.calls.map(([area]) => area)).toEqual(["chest", "head", "neck"]);
  });

  it("swaps chest and stomach for upper and lower back on the back view", () => {
    renderWithI18n(<BodyMap selected={[]} onToggle={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Upper back" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
    expect(screen.getByRole("button", { name: "Upper back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lower back" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chest" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Back$/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("puts the person's right arm on the viewer's left in front view and the reverse from behind", () => {
    const { container } = renderWithI18n(<BodyMap selected={[]} onToggle={vi.fn()} />);
    const armX = (label: string) => Number(container.querySelector(`[aria-label="${label}"] rect`)?.getAttribute("x"));
    expect(armX("Right arm")).toBeLessThan(armX("Left arm"));
    fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
    expect(armX("Right arm")).toBeGreaterThan(armX("Left arm"));
  });

  it("has every one of the 13 areas available across the two views", () => {
    renderWithI18n(<BodyMap selected={[]} onToggle={vi.fn()} />);
    const names = new Set(screen.getAllByRole("button", { pressed: false }).map((node) => node.getAttribute("aria-label")).filter(Boolean));
    fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
    for (const node of screen.getAllByRole("button", { pressed: false })) names.add(node.getAttribute("aria-label"));
    for (const area of ["Head", "Neck and throat", "Chest", "Stomach", "Upper back", "Lower back", "Left arm", "Right arm", "Hips", "Left leg", "Right leg", "Left knee", "Right knee"]) {
      expect(names.has(area)).toBe(true);
    }
  });
});

describe("PainScale", () => {
  it("offers five faces as one radio group, and lets a second tap clear the choice", () => {
    const onChange = vi.fn();
    renderWithI18n(<PainScale value={3} onChange={onChange} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "3: Moderate" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "5: Very strong" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: "5: Very strong" }));
    fireEvent.click(screen.getByRole("radio", { name: "3: Moderate" }));
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([5, null]);
  });
});

describe("ProfileSwitcher", () => {
  const profile = (id: string, name: string, age: number): Profile => ({ id, name, relation: "self", age, sex: "female", conditions: [], language: "mr", elder_mode: false });

  it("is hidden for a single profile and lets you pick among several", () => {
    const onSelect = vi.fn();
    const { container, rerender } = renderWithI18n(<ProfileSwitcher profiles={[profile("a", "Sunita Patil", 58)]} activeId="a" onSelect={onSelect} />);
    expect(container.textContent).toBe("");
    rerender(<ProfileSwitcher profiles={[profile("a", "Sunita Patil", 58), profile("b", "Shanta Joshi", 82)]} activeId="a" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Sunita · 58" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Shanta · 82" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
  });
});
