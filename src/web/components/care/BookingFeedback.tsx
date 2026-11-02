import { useTranslation } from "react-i18next";
import { formatIndiaTime } from "@core/domain/format";
import type { BookingState } from "../../hooks/useBooking";
import { Button } from "../base/Button";

export interface BookingFeedbackProps {
  state: BookingState;
  onRebook: (slotStart: string) => void;
  onRetryToken: () => void;
}

export function BookingFeedback({ state, onRebook, onRetryToken }: BookingFeedbackProps) {
  const { t } = useTranslation();

  if (state.status === "booking") {
    return (
      <p role="status" className="type-small">
        {t("booking.booking")}
      </p>
    );
  }

  if (state.status === "taken") {
    const time = formatIndiaTime(state.nextFreeSlot);
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-small border border-line bg-watch-tint p-4">
        <p className="type-body font-medium !text-watch-text">{t("booking.taken", { time })}</p>
        <Button onClick={() => onRebook(state.nextFreeSlot)}>{t("booking.rebook", { time })}</Button>
      </div>
    );
  }

  if (state.status === "tokenFailed") {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-small border border-line bg-surface p-4">
        <p className="type-body">{t("booking.tokenFailed")}</p>
        <Button onClick={onRetryToken}>{t("booking.getToken")}</Button>
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <p role="alert" className="type-body !text-alert-text">
        {t("booking.failed")}
      </p>
    );
  }

  return null;
}
