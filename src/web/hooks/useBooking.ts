import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { backend } from "@core/api/backend";
import { activeProfile } from "@core/store/session";
import { sessionStore } from "../store";

export type BookingState =
  | { status: "idle" }
  | { status: "booking" }
  | { status: "taken"; nextFreeSlot: string }
  | { status: "failed" }
  | { status: "tokenFailed"; bookingId: string };

export function useBooking(doctorId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<BookingState>({ status: "idle" });

  const openToken = useCallback(
    async (bookingId: string) => {
      try {
        const token = await backend.issueToken(bookingId);
        await queryClient.invalidateQueries({ queryKey: ["tokens"] });
        navigate(`/app/token/${token.id}`);
      } catch {
        setState({ status: "tokenFailed", bookingId });
      }
    },
    [navigate, queryClient],
  );

  const attempt = useCallback(
    async (slotStart: string, purpose?: string) => {
      const profile = activeProfile(sessionStore.getState());
      if (!profile) {
        setState({ status: "failed" });
        return;
      }
      setState({ status: "booking" });
      try {
        const result = await backend.book({ doctor_id: doctorId, profile_id: profile.id, slot_start: slotStart, ...(purpose ? { purpose } : {}) });
        if (result.kind === "slot_taken") {
          await queryClient.invalidateQueries({ queryKey: ["slots", doctorId] });
          setState({ status: "taken", nextFreeSlot: result.nextFreeSlot });
          return;
        }
        await openToken(result.booking.booking_id);
      } catch {
        setState({ status: "failed" });
      }
    },
    [doctorId, openToken, queryClient],
  );

  const retryToken = useCallback(async () => {
    if (state.status === "tokenFailed") await openToken(state.bookingId);
  }, [openToken, state]);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, attempt, retryToken, reset };
}
