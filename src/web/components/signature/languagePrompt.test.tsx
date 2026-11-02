import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { preferencesStore } from "../../store";
import { renderWithI18n, resetStores, stubMeta } from "../../test-utils";
import { LanguageSwitchPrompt } from "./LanguageSwitchPrompt";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", stubMeta("mock"));
  resetStores();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function pass(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("LanguageSwitchPrompt", () => {
  it("gently offers Marathi when Marathi is typed in an English page, and switches on request", async () => {
    renderWithI18n(<LanguageSwitchPrompt text="मला पोटात दुखत आहे" />);
    expect(screen.queryByRole("status")).toBeNull();
    await pass(700);
    expect(screen.getByRole("status")).toHaveTextContent("You typed in मराठी. Switch Healix to मराठी?");

    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect(preferencesStore.getState().language).toBe("mr");
  });

  it("stays quiet for text in the page language, short text and Hindi on a Hinglish page", async () => {
    const { rerender, container } = renderWithI18n(<LanguageSwitchPrompt text="I have a stomach ache since morning" />);
    await pass(700);
    expect(container.textContent).toBe("");

    rerender(<LanguageSwitchPrompt text="मला" />);
    await pass(700);
    expect(container.textContent).toBe("");

    preferencesStore.setState({ language: "hinglish" });
    rerender(<LanguageSwitchPrompt text="मेरे पेट में दर्द है" />);
    await pass(700);
    expect(container.textContent).toBe("");
  });

  it("does not ask again for a language the person dismissed", async () => {
    const { rerender } = renderWithI18n(<LanguageSwitchPrompt text="मला पोटात दुखत आहे" />);
    await pass(700);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("status")).toBeNull();

    rerender(<LanguageSwitchPrompt text="मला पोटात खूप दुखत आहे आज" />);
    await pass(700);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits for the person to stop typing before judging", async () => {
    const { rerender } = renderWithI18n(<LanguageSwitchPrompt text="मला पोटात" />);
    await pass(300);
    rerender(<LanguageSwitchPrompt text="मला पोटात दुखत आहे" />);
    await pass(300);
    expect(screen.queryByRole("status")).toBeNull();
    await pass(400);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses the language Sarvam heard straight away, without waiting", () => {
    renderWithI18n(<LanguageSwitchPrompt text="" hint="mr" />);
    expect(screen.getByRole("status")).toHaveTextContent("मराठी");
  });

  it("does not prompt when the heard language already matches the page", () => {
    renderWithI18n(<LanguageSwitchPrompt text="" hint="en" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("asks Sarvam to confirm when it is available, and trusts its answer", async () => {
    vi.useRealTimers();
    const calls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (String(input) === "/api/meta") return stubMeta("live")(input);
      return Promise.resolve(new Response(JSON.stringify({ language: "hi", source: "sarvam" }), { status: 200 }));
    });
    resetStores();
    renderWithI18n(<LanguageSwitchPrompt text="मला पोटात दुखत आहे" />);
    expect(await screen.findByText(/हिन्दी/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(calls).toContain("/api/sarvam/lid");
  });
});
