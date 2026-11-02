import { loadGroups, i18n } from "../../i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { MatchItem, SlotsResponse } from "@core/api/schemas/backend";
import type { BookingState } from "../../hooks/useBooking";
import { preferencesStore } from "../../store";
import { renderWithI18n, renderWithProviders, resetStores } from "../../test-utils";
import { BookingFeedback } from "./BookingFeedback";
import { DelayBanner } from "./DelayBanner";
import { DoctorCard } from "./DoctorCard";
import { DoctorFilters } from "./DoctorFilters";
import { SlotPicker } from "./SlotPicker";
import { WaitReasons } from "./WaitReasons";

beforeEach(() => resetStores());
afterEach(async () => {
  preferencesStore.setState({ language: "en" });
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

const hospital = { id: "hosp_karve", name: "Karve Road Care Clinic", locality: "Kothrud", lat: 18.5189, lng: 73.8077, has_emergency: true };

function item(overrides: Partial<MatchItem["doctor"]> = {}, wait: Partial<MatchItem["predicted_wait"]> = {}): MatchItem {
  return {
    doctor: {
      id: "doc_meera",
      name: "Dr. Meera Kulkarni",
      specialty: "Gastroenterology",
      qualifications: "MBBS, MD",
      years_experience: 16,
      hospital,
      languages: ["Hindi", "English", "Marathi"],
      fee_inr: 1100,
      rating: 4.8,
      review_count: 412,
      consult_minutes: 10,
      distance_km: 2.1,
      ...overrides,
    },
    score: 0.8,
    why: "Speaks Marathi, 2.1 km away, shortest wait at about 25 min, rated 4.8.",
    predicted_wait: {
      wait_minutes: 25,
      range_low: 22,
      range_high: 28,
      reasons: [],
      suggested_arrival: "2026-11-02T04:55:00.000Z",
      source: "mock-model",
      ...wait,
    },
  };
}

describe("DoctorCard", () => {
  it("shows the fee with Indian grouping, the rating, the estimate with its range, and the why", () => {
    renderWithProviders(<DoctorCard item={item()} language="en" isTop={false} />);
    const card = screen.getByRole("article", { name: "Dr. Meera Kulkarni" });
    expect(within(card).getByText("₹1,100 per visit")).toBeInTheDocument();
    expect(within(card).getByLabelText("Rated 4.8")).toBeInTheDocument();
    expect(within(card).getByText("Estimate")).toBeInTheDocument();
    expect(within(card).getByText("~25")).toBeInTheDocument();
    expect(within(card).getByText("Between 22 and 28 min")).toBeInTheDocument();
    expect(within(card).getByText(/2\.1 km away/)).toBeInTheDocument();
    expect(within(card).getByText("Gastroenterologist · Karve Road Care Clinic")).toBeInTheDocument();
  });

  it("labels a doctor without a rating as new", () => {
    renderWithProviders(<DoctorCard item={item({ rating: null, review_count: 0 })} language="en" isTop={false} />);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Rated/)).toBeNull();
  });

  it("highlights the patient's language first, in its own script, and builds the summary line", async () => {
    preferencesStore.setState({ language: "mr" });
    await loadGroups(["common", "app"]);
    await i18n.changeLanguage("mr");
    renderWithProviders(<DoctorCard item={item()} language="mr" isTop={false} />);
    const card = screen.getByRole("article");
    expect(within(card).getByText(/मराठी बोलतात/)).toBeInTheDocument();
    const chips = [...card.querySelectorAll("span.rounded-pill")].map((node) => node.textContent);
    expect(chips.slice(0, 3)).toEqual(["मराठी", "हिन्दी", "English"]);
    expect(card.querySelector("span.bg-accent-soft")?.textContent).toBe("मराठी");
  });

  it("leaves the language out of the summary when the doctor does not speak it", () => {
    renderWithProviders(<DoctorCard item={item({ languages: ["Gujarati", "English"] })} language="mr" isTop={false} />);
    expect(screen.queryByText(/मराठी बोलतात/)).toBeNull();
    expect(screen.getByText("ગુજરાતી")).toBeInTheDocument();
  });

  it("marks only the top pick, and only the top pick offers one-tap booking", () => {
    const onBookTop = vi.fn();
    const { rerender } = renderWithProviders(<DoctorCard item={item()} language="en" isTop={true} onBookTop={onBookTop} />);
    expect(screen.getByText("Top pick")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Book top pick" }));
    expect(onBookTop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "See times" })).toHaveAttribute("href", "/app/doctors/doc_meera");
    rerender(<DoctorCard item={item()} language="en" isTop={false} onBookTop={onBookTop} />);
    expect(screen.queryByText("Top pick")).toBeNull();
    expect(screen.queryByRole("button", { name: "Book top pick" })).toBeNull();
  });
});

describe("DoctorFilters", () => {
  it("offers fee, distance and language as chips and reports each choice", () => {
    const onChange = vi.fn();
    renderWithI18n(<DoctorFilters value={{ maxFee: null, maxKm: null, language: null }} onChange={onChange} languages={["English", "Hindi", "Marathi"]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Up to ₹800" }));
    fireEvent.click(screen.getByRole("radio", { name: "Within 5 km" }));
    fireEvent.click(screen.getByRole("radio", { name: "मराठी" }));
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      { maxFee: 800, maxKm: null, language: null },
      { maxFee: null, maxKm: 5, language: null },
      { maxFee: null, maxKm: null, language: "Marathi" },
    ]);
  });

  it("marks the current choice and always offers an 'any' option in each group", () => {
    renderWithI18n(<DoctorFilters value={{ maxFee: 500, maxKm: 3, language: "Hindi" }} onChange={vi.fn()} languages={["Hindi"]} />);
    expect(screen.getByRole("radio", { name: "Up to ₹500" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Within 3 km" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "हिन्दी" })).toHaveAttribute("aria-checked", "true");
    for (const name of ["Any fee", "Any distance", "Any language"]) expect(screen.getByRole("radio", { name })).toHaveAttribute("aria-checked", "false");
  });
});

describe("SlotPicker", () => {
  const slot = (iso: string, available = true) => ({ start: iso, end: iso, available });
  const slots: SlotsResponse = {
    doctor_id: "doc_meera",
    days: [
      { date: "2026-11-02", label: "today", slots: [slot("2026-11-02T05:00:00.000Z", false), slot("2026-11-02T05:20:00.000Z")] },
      { date: "2026-11-03", label: "tomorrow", slots: [slot("2026-11-03T03:30:00.000Z"), slot("2026-11-03T03:50:00.000Z")] },
    ],
  };

  it("shows only free times in India time, and switches between today and tomorrow", () => {
    const onChange = vi.fn();
    renderWithI18n(<SlotPicker slots={slots} value={null} onChange={onChange} />);
    expect(screen.getAllByRole("radio").map((node) => node.textContent)).toEqual(["10:50 AM"]);
    fireEvent.click(screen.getByRole("tab", { name: "Tomorrow" }));
    expect(screen.getAllByRole("radio").map((node) => node.textContent)).toEqual(["9:00 AM", "9:20 AM"]);
    fireEvent.click(screen.getByRole("radio", { name: "9:20 AM" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-03T03:50:00.000Z");
  });

  it("starts on the first day that has a free time, and says so when a day is full", () => {
    const fullToday: SlotsResponse = { ...slots, days: [{ date: "2026-11-02", label: "today", slots: [slot("2026-11-02T05:00:00.000Z", false)] }, slots.days[1] as SlotsResponse["days"][number]] };
    renderWithI18n(<SlotPicker slots={fullToday} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Tomorrow" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Today" }));
    expect(screen.getByText("No free times left for this day.")).toBeInTheDocument();
  });

  it("marks the chosen time", () => {
    renderWithI18n(<SlotPicker slots={slots} value="2026-11-02T05:20:00.000Z" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "10:50 AM" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("BookingFeedback", () => {
  const show = (state: BookingState, onRebook = vi.fn(), onRetryToken = vi.fn()) => {
    renderWithI18n(<BookingFeedback state={state} onRebook={onRebook} onRetryToken={onRetryToken} />);
    return { onRebook, onRetryToken };
  };

  it("says 'Just taken' with the next free time and a one-tap rebook, never a raw error", () => {
    const { onRebook } = show({ status: "taken", nextFreeSlot: "2026-11-02T05:50:00.000Z" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Just taken. Next free time: 11:20 AM");
    expect(alert).not.toHaveTextContent(/409|error|slot_taken/i);
    fireEvent.click(screen.getByRole("button", { name: "Book 11:20 AM" }));
    expect(onRebook).toHaveBeenCalledWith("2026-11-02T05:50:00.000Z");
  });

  it("offers to fetch the token when the booking worked but the token did not", () => {
    const { onRetryToken } = show({ status: "tokenFailed", bookingId: "bk_1" });
    expect(screen.getByRole("alert")).toHaveTextContent("Your time is booked, but we could not get your token yet.");
    fireEvent.click(screen.getByRole("button", { name: "Get my token" }));
    expect(onRetryToken).toHaveBeenCalled();
  });

  it("shows a calm message on failure, progress while booking, and nothing when idle", () => {
    show({ status: "failed" });
    expect(screen.getByRole("alert")).toHaveTextContent("We could not book this right now. Please try again.");
    cleanup();
    show({ status: "booking" });
    expect(screen.getByRole("status")).toHaveTextContent("Booking…");
    cleanup();
    const { container } = renderWithI18n(<BookingFeedback state={{ status: "idle" }} onRebook={vi.fn()} onRetryToken={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});

describe("WaitReasons", () => {
  it("lists each reason with a signed minute figure, coloured by direction, plus the estimate and range", () => {
    renderWithI18n(
      <WaitReasons
        prediction={{
          wait_minutes: 53,
          range_low: 47,
          range_high: 59,
          suggested_arrival: "2026-11-02T05:23:00.000Z",
          source: "mock-model",
          reasons: [
            { code: "morning_rush", label: "Monday morning rush", minutes: 12 },
            { code: "doctor_late", label: "Doctor started late", minutes: 8 },
            { code: "quick_followups", label: "Quick follow-ups ahead", minutes: -6 },
            { code: "something_new", label: "Server wording", minutes: 3 },
          ],
        }}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Morning rush+12m",
      "Doctor started late+8m",
      "Quick follow-ups ahead−6m",
      "Server wording+3m",
    ]);
    expect(within(rows[0] as HTMLElement).getByText("+12m").className).toContain("text-alert-text");
    expect(within(rows[2] as HTMLElement).getByText("−6m").className).toContain("text-accent");
    expect(screen.getByText("Between 47 and 59 min")).toBeInTheDocument();
    expect(screen.getByText("Estimate")).toBeInTheDocument();
  });
});

describe("DelayBanner", () => {
  it("stays hidden for a change of 15 minutes or less", () => {
    const { container } = renderWithI18n(<DelayBanner initialMinutes={53} currentMinutes={68} />);
    expect(container.textContent).toBe("");
  });

  it("warns when the wait grows or shrinks by more than 15 minutes", () => {
    const { rerender } = renderWithI18n(<DelayBanner initialMinutes={53} currentMinutes={70} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your wait has changed");
    expect(screen.getByRole("alert")).toHaveTextContent("It is now about 17 min longer than before.");
    rerender(<DelayBanner initialMinutes={53} currentMinutes={30} />);
    expect(screen.getByRole("alert")).toHaveTextContent("It is now about 23 min shorter than before.");
  });
});
