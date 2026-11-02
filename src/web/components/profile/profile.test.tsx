import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Profile, User } from "@core/api/schemas/backend";
import { sessionStore, preferencesStore } from "../../store";
import { renderWithProviders, resetStores } from "../../test-utils";
import { ActiveProfileBar } from "./ActiveProfileBar";
import { ConditionPicker } from "./ConditionPicker";
import { ProfileForm } from "./ProfileForm";
import { selectProfile } from "../../lib/profileSwitch";

beforeEach(() => resetStores());
afterEach(cleanup);

const self: Profile = { id: "p1", name: "Sunita Patil", relation: "self", age: 58, sex: "female", conditions: ["Type 2 diabetes"], language: "mr", elder_mode: false };
const aai: Profile = { id: "p2", name: "Shanta Joshi", relation: "mother", age: 82, sex: "female", conditions: ["Hypertension"], language: "mr", elder_mode: true };

function signIn(profiles: Profile[]) {
  const user: User = { id: "u1", role: "patient", name: "Sunita Patil", language: "mr", profiles };
  sessionStore.getState().startSession({ access_token: "t", user });
}

describe("ConditionPicker", () => {
  it("toggles known conditions and keeps unknown ones that came from the server", () => {
    const onChange = vi.fn();
    renderWithProviders(<ConditionPicker value={["Type 2 diabetes", "Something rare"]} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Diabetes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Asthma" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Something rare" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Asthma" }));
    expect(onChange).toHaveBeenCalledWith(["Type 2 diabetes", "Something rare", "Asthma"]);
    fireEvent.click(screen.getByRole("button", { name: "Diabetes" }));
    expect(onChange).toHaveBeenLastCalledWith(["Something rare"]);
  });
});

describe("ProfileForm", () => {
  it("fills in what it knows, and asks for the relation only for family members", () => {
    const { rerender } = renderWithProviders(<ProfileForm initial={self} askRelation={false} defaultLanguage="en" submitLabel="Save" onSubmit={async () => undefined} />);
    expect(screen.getByLabelText("Full name")).toHaveValue("Sunita Patil");
    expect(screen.getByLabelText("Age")).toHaveValue("58");
    expect(screen.queryByLabelText("Relation")).toBeNull();
    rerender(<ProfileForm initial={aai} askRelation defaultLanguage="en" submitLabel="Save" onSubmit={async () => undefined} />);
    expect(screen.getByLabelText("Relation")).toHaveValue("mother");
  });

  it("explains a missing name or an impossible age and does not submit", async () => {
    const onSubmit = vi.fn(async () => undefined);
    renderWithProviders(<ProfileForm askRelation defaultLanguage="en" submitLabel="Add member" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please enter a name.");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ramesh" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an age between 0 and 120.");
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "130" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an age between 0 and 120.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends every field to the caller", async () => {
    const onSubmit = vi.fn(async () => undefined);
    renderWithProviders(<ProfileForm askRelation defaultLanguage="hi" submitLabel="Add member" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " Ramesh Patil " } });
    fireEvent.change(screen.getByLabelText("Relation"), { target: { value: "father" } });
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "74" } });
    fireEvent.change(screen.getByLabelText("Sex"), { target: { value: "male" } });
    fireEvent.click(screen.getByRole("button", { name: "High blood pressure" }));
    fireEvent.click(screen.getByRole("switch", { name: "Larger text and simpler screens" }));
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({ name: "Ramesh Patil", relation: "father", age: 74, sex: "male", conditions: ["Hypertension"], language: "hi", elder_mode: true });
  });

  it("shows a calm message when saving fails", async () => {
    renderWithProviders(<ProfileForm initial={self} askRelation={false} defaultLanguage="en" submitLabel="Save" onSubmit={async () => Promise.reject(new Error("offline"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not save this. Please try again.");
  });
});

describe("ActiveProfileBar", () => {
  it("shows nothing when nobody is signed in", () => {
    renderWithProviders(<ActiveProfileBar />);
    expect(screen.queryByTestId("profile-bar")).toBeNull();
  });

  it("names the person being cared for and offers no switch when there is only one", () => {
    signIn([self]);
    renderWithProviders(<ActiveProfileBar />);
    expect(screen.getByTestId("profile-bar-name")).toHaveTextContent("Sunita");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is only a label, and follows the person selected elsewhere with their large-text setting", () => {
    signIn([self, aai]);
    renderWithProviders(<ActiveProfileBar />);
    const bar = screen.getByTestId("profile-bar");
    expect(within(bar).queryByRole("button")).toBeNull();
    act(() => selectProfile(aai));
    expect(sessionStore.getState().activeProfileId).toBe("p2");
    expect(preferencesStore.getState().elderMode).toBe(true);
    expect(screen.getByTestId("profile-bar-name")).toHaveTextContent("Shanta");
    expect(bar).toHaveTextContent("82 years");
    act(() => selectProfile(self));
    expect(preferencesStore.getState().elderMode).toBe(false);
  });
});
