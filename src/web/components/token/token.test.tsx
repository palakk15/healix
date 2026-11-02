import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { advanceDemoQueue, initialDemoQueue } from "@core/domain/demoQueue";
import { sampleToken } from "@core/domain/sampleToken";
import { renderWithProviders, resetStores } from "../../test-utils";
import { QueueDots } from "./QueueDots";
import { TokenPass } from "./TokenPass";
import { TokenView } from "./TokenView";
import { VisitTimeline, currentStep } from "./VisitTimeline";

beforeEach(() => resetStores());
afterEach(cleanup);

describe("visit timeline", () => {
  it("maps the token status to the step you are on", () => {
    expect(currentStep("waiting")).toBe(1);
    expect(currentStep("called")).toBe(2);
    expect(currentStep("completed")).toBe(3);
  });

  it("marks only the current step and ticks the finished ones", () => {
    renderWithProviders(<VisitTimeline status="called" />);
    const list = screen.getByRole("list", { name: "Your visit" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[2]).toHaveTextContent("Called in");
  });
});

describe("queue dots", () => {
  it("draws one dot for each person ahead, then you", () => {
    renderWithProviders(<QueueDots ahead={4} />);
    expect(screen.getByTestId("queue-dots").querySelectorAll("div.flex span.rounded-full")).toHaveLength(4);
    expect(screen.getByText("4 ahead of you")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("caps the dots and counts the rest, and says so when it is your turn", () => {
    const { rerender } = renderWithProviders(<QueueDots ahead={20} />);
    expect(screen.getByText("+8")).toBeInTheDocument();
    rerender(<QueueDots ahead={0} />);
    expect(screen.getAllByText("Your turn").length).toBeGreaterThan(0);
  });
});

describe("token pass", () => {
  it("shows the number, the doctor, the place and who is being served", () => {
    renderWithProviders(<TokenPass label="A-23" doctorName="Dr. Meera Kulkarni" hospitalName="Karve Road Care Clinic" room="Room 4" nowServing="A-18" ahead={5} status="waiting" />);
    expect(screen.getByTestId("ticket-number")).toHaveTextContent("A-23");
    expect(screen.getByText("Dr. Meera Kulkarni")).toBeInTheDocument();
    expect(screen.getByText("Room 4")).toBeInTheDocument();
    expect(screen.getByText("A-18")).toBeInTheDocument();
    expect(screen.getByText("In the queue")).toBeInTheDocument();
  });

  it("says you are next when nobody is ahead", () => {
    renderWithProviders(<TokenPass label="A-23" doctorName="Dr. X" hospitalName="H" room="R" nowServing={null} ahead={0} status="waiting" />);
    expect(screen.getByText("You are next")).toBeInTheDocument();
  });
});

describe("token view", () => {
  const now = Date.UTC(2026, 10, 1, 4, 40);

  it("builds a full screen from a sample token and labels it as a sample", () => {
    const token = sampleToken(initialDemoQueue, now);
    renderWithProviders(<TokenView sample token={token} minutesLeft={25} leaveBy="10:35 AM" totalMinutes={40} />);
    expect(screen.getByText("Sample preview")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Leave home in 25 minutes" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Visit details" })).toHaveTextContent(token.doctor_name);
    expect(screen.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", expect.stringContaining("google.com/maps"));
    expect(screen.getByText("Why this estimate")).toBeInTheDocument();
  });

  it("drops the leave-home countdown once the patient has been called", () => {
    const token = { ...sampleToken(advanceDemoQueue(initialDemoQueue), now), status: "called" as const };
    renderWithProviders(<TokenView token={token} minutesLeft={0} leaveBy="10:35 AM" totalMinutes={40} />);
    expect(screen.queryByRole("img", { name: /Leave home in/ })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("It is your turn");
  });

  it("shows the reason for the visit when there is one", () => {
    const token = { ...sampleToken(initialDemoQueue, now), purpose: "Follow-up visit" };
    renderWithProviders(<TokenView token={token} minutesLeft={10} leaveBy="10:00 AM" totalMinutes={40} />);
    expect(screen.getByText("Follow-up visit")).toBeInTheDocument();
  });
});
