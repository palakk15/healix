import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import type { Doctor } from "@core/api/schemas/backend";
import { formatIndiaTime, formatRupees } from "@core/domain/format";
import type { useBooking } from "../../hooks/useBooking";
import { useReturnFocus } from "../../hooks/useReturnFocus";
import { Button } from "../base/Button";
import { BookingFeedback } from "./BookingFeedback";

export interface BookingConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor;
  slotStart: string | null;
  dayLabel: string;
  booking: ReturnType<typeof useBooking>;
  purpose?: string;
  purposeLabel?: string;
  note?: string | null;
}

export function BookingConfirmDialog({ open, onOpenChange, doctor, slotStart, dayLabel, booking, purpose, purposeLabel, note }: BookingConfirmDialogProps) {
  const { t } = useTranslation();
  const busy = booking.state.status === "booking";
  const returnFocus = useReturnFocus(open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          aria-describedby="booking-confirm-description"
          className="type-scale-mobile fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-bg p-6 shadow-card"
        >
          <Dialog.Title className="type-h3">{t("booking.confirmTitle")}</Dialog.Title>
          <Dialog.Description id="booking-confirm-description" className="type-body mt-3">
            {doctor.name} · {doctor.hospital.name}
          </Dialog.Description>
          {slotStart ? (
            <p className="type-body mt-1 font-medium text-ink">{t("booking.confirmWhen", { day: dayLabel, time: formatIndiaTime(slotStart) })}</p>
          ) : null}
          {purposeLabel ? <p className="type-small mt-1">{t("booking.confirmPurpose", { purpose: purposeLabel })}</p> : null}
          {note ? <p className="type-small mt-2 rounded-[12px] bg-watch-tint px-3 py-2 text-watch-text">{note}</p> : null}
          <p className="type-small mt-1">{t("booking.confirmFee", { fee: formatRupees(doctor.fee_inr) })}</p>

          <div className="mt-5 flex flex-col gap-3">
            <BookingFeedback state={booking.state} onRebook={(next) => void booking.attempt(next, purpose)} onRetryToken={() => void booking.retryToken()} />
            <div className="flex gap-3">
              <Button className="flex-1" disabled={busy || !slotStart || booking.state.status === "taken"} onClick={() => slotStart && void booking.attempt(slotStart, purpose)}>
                {t("booking.confirm")}
              </Button>
              <Dialog.Close asChild>
                <Button variant="secondary">{t("common.cancel")}</Button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
