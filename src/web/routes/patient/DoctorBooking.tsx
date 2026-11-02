import { useTranslatedText } from "@web/hooks/useTranslatedText";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { isVisitPurpose } from "@core/domain/bookingForm";
import { backend } from "@core/api/backend";
import { formatIndiaTime, formatRupees } from "@core/domain/format";
import { specialtyLabel } from "@core/domain/labels";
import { activeProfile } from "@core/store/session";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { BookingFeedback } from "../../components/care/BookingFeedback";
import { SlotPicker } from "../../components/care/SlotPicker";
import { useBooking } from "../../hooks/useBooking";
import { usePreferences, useSession } from "../../store";

export default function DoctorBooking() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const language = usePreferences((state) => state.language);
  const profile = useSession((state) => activeProfile(state));
  const [selected, setSelected] = useState<string | null>(null);
  const [params] = useSearchParams();
  const date = params.get("date");
  const rawPurpose = params.get("purpose");
  const purpose = isVisitPurpose(rawPurpose) ? rawPurpose : undefined;
  const booking = useBooking(id);

  const doctor = useQuery({ queryKey: ["doctor", id], queryFn: () => backend.doctor(id), retry: 1 });
  const slots = useQuery({ queryKey: ["slots", id], queryFn: () => backend.slots(id), retry: 1 });
  const busy = booking.state.status === "booking";
  const about = useTranslatedText(doctor.data?.about ?? "", language);

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      {doctor.data ? (
        <header>
          <h1 className="type-h2">{doctor.data.name}</h1>
          <p className="type-body mt-2">
            {specialtyLabel(doctor.data.specialty, language).title} · {doctor.data.hospital.name}
          </p>
          <p className="type-small mt-1">
            {formatRupees(doctor.data.fee_inr)} {t("doctors.perVisit")} · {doctor.data.consult_minutes} min · {doctor.data.years_experience} yrs
          </p>
          {doctor.data.about ? <p className="type-small mt-2">{about}</p> : null}
        </header>
      ) : (
        <h1 className="type-h2">{t("booking.title")}</h1>
      )}

      <Card className="flex flex-col gap-5">
        {profile ? <p className="type-small">{t("booking.forWho", { name: profile.name })}</p> : null}
        {purpose ? <p className="type-small">{t("booking.confirmPurpose", { purpose: t(`doctors.form.purposes.${purpose}`) })}</p> : null}
        {slots.isPending ? (
          <p role="status" className="type-body">
            {t("booking.loadingSlots")}
          </p>
        ) : null}
        {slots.data ? (
          <>
            <SlotPicker slots={slots.data} value={selected} onChange={setSelected} initialDate={date} />
            <Button disabled={!selected || busy || booking.state.status === "taken"} onClick={() => selected && void booking.attempt(selected, purpose)}>
              {selected ? t("booking.book", { time: formatIndiaTime(selected) }) : t("booking.pick")}
            </Button>
          </>
        ) : null}
        <BookingFeedback state={booking.state} onRebook={(next) => void booking.attempt(next, purpose)} onRetryToken={() => void booking.retryToken()} />
      </Card>
    </main>
  );
}
