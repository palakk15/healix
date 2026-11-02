import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { clearMemoryCacheForTests } from "../../audio/audioCache";
import type { PlaybackHandle } from "../../audio/player";
import { preferencesStore, sessionStore } from "../../store";
import { renderWithI18n, resetStores, settle, stubMeta } from "../../test-utils";
import { ListenButton } from "./ListenButton";

const noticeText = "This text is sent to Sarvam AI to be read aloud.";

function fakePlayback() {
  let finish: () => void = () => undefined;
  const handle: PlaybackHandle = {
    stop: vi.fn(() => finish()),
    finished: new Promise<void>((resolve) => {
      finish = resolve;
    }),
  };
  return { handle, end: () => finish() };
}

function setup(text = "तुमची रिपोर्ट सामान्य आहे.", language: "mr" | "en" = "mr") {
  const playback = fakePlayback();
  const speak = vi.fn(async () => ["AAAA"]);
  const play = vi.fn(() => playback.handle);
  const view = renderWithI18n(<ListenButton text={text} language={language} deps={{ speak, play }} />);
  return { playback, speak, play, view };
}

beforeEach(() => {
  vi.stubGlobal("fetch", stubMeta("live"));
  resetStores();
  clearMemoryCacheForTests();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const listenButton = () => screen.getByRole("button", { name: "Listen" });

describe("ListenButton", () => {
  it("is hidden unless real Sarvam voice is available", async () => {
    for (const mode of ["mock", "off"] as const) {
      vi.stubGlobal("fetch", stubMeta(mode));
      setup();
      await settle();
      expect(screen.queryByRole("button")).toBeNull();
      cleanup();
    }
  });

  it("asks for consent first, then reads the text aloud in the page language", async () => {
    const { speak, play } = setup();
    await settle();
    fireEvent.click(listenButton());
    expect(screen.getByRole("dialog")).toHaveTextContent(noticeText);
    expect(speak).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
    await waitFor(() => expect(play).toHaveBeenCalledWith(["AAAA"]));
    expect(speak).toHaveBeenCalledWith("तुमची रिपोर्ट सामान्य आहे.", "mr", 1);
    expect(sessionStore.getState().consents.voice).toBe(true);
    expect(await screen.findByRole("button", { name: "Stop listening" })).toHaveAttribute("aria-pressed", "true");
  });

  it("goes back to Listen when the audio ends", async () => {
    sessionStore.getState().setConsent("voice", true);
    const { playback } = setup();
    await settle();
    fireEvent.click(listenButton());
    await screen.findByRole("button", { name: "Stop listening" });
    await act(async () => playback.end());
    await waitFor(() => expect(listenButton()).toBeInTheDocument());
  });

  it("stops playback when pressed again", async () => {
    sessionStore.getState().setConsent("voice", true);
    const { playback } = setup();
    await settle();
    fireEvent.click(listenButton());
    fireEvent.click(await screen.findByRole("button", { name: "Stop listening" }));
    expect(playback.handle.stop).toHaveBeenCalled();
    await waitFor(() => expect(listenButton()).toBeInTheDocument());
  });

  it("reuses cached audio instead of asking Sarvam again", async () => {
    sessionStore.getState().setConsent("voice", true);
    const first = setup();
    await settle();
    fireEvent.click(listenButton());
    await waitFor(() => expect(first.play).toHaveBeenCalledTimes(1));
    await act(async () => first.playback.end());
    await waitFor(() => expect(listenButton()).toBeInTheDocument());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    fireEvent.click(listenButton());
    await waitFor(() => expect(first.play).toHaveBeenCalledTimes(2));
    expect(first.speak).toHaveBeenCalledTimes(1);
  });

  it("reads more slowly in elder mode", async () => {
    sessionStore.getState().setConsent("voice", true);
    preferencesStore.setState({ elderMode: true });
    const { speak } = setup("Take rest and drink water.", "en");
    await settle();
    fireEvent.click(listenButton());
    await waitFor(() => expect(speak).toHaveBeenCalledWith("Take rest and drink water.", "en", 0.85));
  });

  it("shows a calm message and recovers when reading aloud fails", async () => {
    sessionStore.getState().setConsent("voice", true);
    const speak = vi.fn(async () => Promise.reject(new Error("down")));
    renderWithI18n(<ListenButton text="Hello there." language="en" deps={{ speak }} />);
    await settle();
    fireEvent.click(listenButton());
    expect(await screen.findByText("Could not read this aloud right now.")).toBeInTheDocument();
    expect(listenButton()).toBeEnabled();
  });

  it("stops the voice when the page leaves", async () => {
    sessionStore.getState().setConsent("voice", true);
    const { playback, view } = setup();
    await settle();
    fireEvent.click(listenButton());
    await screen.findByRole("button", { name: "Stop listening" });
    view.unmount();
    expect(playback.handle.stop).toHaveBeenCalled();
  });
});
