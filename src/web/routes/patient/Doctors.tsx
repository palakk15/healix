import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { backend } from "@core/api/backend";
import { isTimeWindow, isVisitPurpose, pickSlot, timeWindows, visitPurposes, type TimeWindow, type VisitPurpose } from "@core/domain/bookingForm";
import { languageOptions } from "@core/domain/doctorLanguages";
import { formatIndiaDate } from "@core/domain/format";
import { specialtyLabel } from "@core/domain/labels";
import { isSpecialty, specialties, urgencies, type Urgency } from "@core/domain/specialty";
import { istDateKey } from "@core/domain/time";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { BestTimeCard } from "../../components/care/BestTimeCard";
import { BookingConfirmDialog } from "../../components/care/BookingConfirmDialog";
import { DoctorCard } from "../../components/care/DoctorCard";
import { DoctorFilters, type DoctorFilterValues } from "../../components/care/DoctorFilters";
import { useBooking } from "../../hooks/useBooking";
import { usePatientPosition } from "../../hooks/usePatientPosition";
import { cn } from "../../lib/cn";
import { usePreferences } from "../../store";

function parseUrgency(value: string | null): Urgency {
  return urgencies.find((entry) => entry === value) ?? "soon";
}

const dayMs = 86_400_000;
const fieldClass =
  "type-body min-h-12 w-full rounded-pill border border-line bg-surface px-5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function Doctors() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const language = usePreferences((state) => state.language);
  const position = usePatientPosition();

  const today = istDateKey(new Date());
  const lastDay = istDateKey(new Date(Date.now() + 6 * dayMs));
  const rawSpecialty = params.get("specialty");
  const specialty = isSpecialty(rawSpecialty) ? rawSpecialty : null;
  const urgency = parseUrgency(params.get("urgency"));
  const rawDate = params.get("date");
  const date = rawDate && rawDate >= today && rawDate <= lastDay ? rawDate : today;
  const rawTime = params.get("time");
  const window: TimeWindow = isTimeWindow(rawTime) ? rawTime : "any";
  const rawPurpose = params.get("purpose");
  const purpose: VisitPurpose = isVisitPurpose(rawPurpose) ? rawPurpose : "new";

  const [formSpecialty, setFormSpecialty] = useState<string>(specialty ?? "");
  const [formDate, setFormDate] = useState(date);
  const [formWindow, setFormWindow] = useState<TimeWindow>(window);
  const [formPurpose, setFormPurpose] = useState<VisitPurpose>(purpose);
  const [formError, setFormError] = useState(false);
  const [filters, setFilters] = useState<DoctorFilterValues>({ maxFee: null, maxKm: null, language: null });
  const [dialogOpen, setDialogOpen] = useState(false);

  function search(event: FormEvent) {
    event.preventDefault();
    if (!isSpecialty(formSpecialty)) {
      setFormError(true);
      return;
    }
    setFormError(false);
    setParams({ specialty: formSpecialty, urgency, date: formDate, time: formWindow, purpose: formPurpose });
  }

  const match = useQuery({
    queryKey: ["match", specialty, urgency, language, position?.lat, position?.lng, filters.maxFee, filters.maxKm],
    enabled: Boolean(specialty && position),
    queryFn: () =>
      backend.match({
        specialty: specialty ?? "General Physician",
        urgency,
        language,
        lat: position?.lat ?? 0,
        lng: position?.lng ?? 0,
        ...(filters.maxFee !== null ? { max_fee: filters.maxFee } : {}),
        ...(filters.maxKm !== null ? { max_km: filters.maxKm } : {}),
      }),
    retry: 1,
  });

  const allItems = useMemo(() => match.data?.items ?? [], [match.data]);
  const items = useMemo(
    () => (filters.language ? allItems.filter((item) => item.doctor.languages.includes(filters.language ?? "")) : allItems),
    [allItems, filters.language],
  );
  const languages = useMemo(() => languageOptions(allItems.map((item) => item.doctor.languages)), [allItems]);
  const top = items[0];

  const booking = useBooking(top?.doctor.id ?? "");
  const slots = useQuery({
    queryKey: ["slots", top?.doctor.id],
    enabled: dialogOpen && Boolean(top),
    queryFn: () => backend.slots(top?.doctor.id ?? ""),
  });
  const picked = slots.data ? pickSlot(slots.data.days, date, window) : null;
  const dayLabel = picked ? (picked.label === "later" ? formatIndiaDate(picked.start) : t(`booking.${picked.label}`)) : "";
  const note = picked && !picked.exactDate ? t("booking.notExactDate") : picked && !picked.exactWindow ? t("booking.notExactWindow") : null;
  const bookingQuery = `date=${date}&time=${window}&purpose=${purpose}`;

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      <header>
        <h1 className="type-h2">{t("doctors.title")}</h1>
        <p className="type-small mt-1">{t("doctors.form.intro")}</p>
      </header>

      <Card as="section" aria-label={t("doctors.form.title")} className="!p-5">
        <form onSubmit={search} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="form-specialty" className="type-label">{t("doctors.form.specialty")}</label>
            <select
              id="form-specialty"
              value={formSpecialty}
              onChange={(event) => setFormSpecialty(event.target.value)}
              aria-invalid={formError}
              aria-describedby={formError ? "form-specialty-error" : undefined}
              className={fieldClass}
            >
              <option value="">{t("doctors.form.choose")}</option>
              {specialties.map((entry) => (
                <option key={entry} value={entry}>{specialtyLabel(entry, language).title}</option>
              ))}
            </select>
            {formError ? <p id="form-specialty-error" role="alert" className="type-small !text-alert-text">{t("doctors.form.chooseError")}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="form-date" className="type-label">{t("doctors.form.date")}</label>
              <input id="form-date" type="date" min={today} max={lastDay} value={formDate} onChange={(event) => setFormDate(event.target.value || today)} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="form-time" className="type-label">{t("doctors.form.time")}</label>
              <select id="form-time" value={formWindow} onChange={(event) => setFormWindow(event.target.value as TimeWindow)} className={fieldClass}>
                {timeWindows.map((entry) => (
                  <option key={entry} value={entry}>{t(`doctors.form.windows.${entry}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="form-purpose" className="type-label">{t("doctors.form.purpose")}</label>
            <select id="form-purpose" value={formPurpose} onChange={(event) => setFormPurpose(event.target.value as VisitPurpose)} className={fieldClass}>
              {visitPurposes.map((entry) => (
                <option key={entry} value={entry}>{t(`doctors.form.purposes.${entry}`)}</option>
              ))}
            </select>
          </div>
          <Button type="submit">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            {t("doctors.form.submit")}
          </Button>
        </form>
      </Card>

      {specialty ? (
        <>
          <section aria-label={t("doctors.form.results")} className="flex flex-col gap-5">
            <div>
              <h2 className="type-h3">{t("doctors.forSpecialty", { specialty: specialtyLabel(specialty, language).title })}</h2>
              <p className="type-small mt-1" data-testid="search-summary">
                {t("doctors.form.summary", { date: formatIndiaDate(`${date}T06:30:00Z`), window: t(`doctors.form.windows.${window}`), purpose: t(`doctors.form.purposes.${purpose}`) })}
              </p>
            </div>

            <details className="rounded-card border border-line bg-surface p-4">
              <summary className="type-h3 cursor-pointer">{t("doctors.filters")}</summary>
              <div className="mt-4">
                <DoctorFilters value={filters} onChange={setFilters} languages={languages} />
              </div>
            </details>

            {match.isPending && position ? <p role="status" className="type-body">{t("doctors.loading")}</p> : null}

            {match.isError ? (
              <Card role="alert">
                <p className="type-h3">{t("doctors.errorTitle")}</p>
              </Card>
            ) : null}

            {match.data && items.length === 0 ? (
              <Card className="flex flex-col gap-1">
                <p className="type-h3">{t("doctors.empty")}</p>
                <p className="type-small">{t("doctors.emptyHint")}</p>
              </Card>
            ) : null}

            {top ? <BestTimeCard doctorId={top.doctor.id} /> : null}

            <ul className={cn("flex flex-col gap-4", items.length === 0 && "hidden")}>
              {items.map((item, index) => (
                <li key={item.doctor.id}>
                  <DoctorCard item={item} language={language} isTop={index === 0} onBookTop={() => setDialogOpen(true)} bookingQuery={bookingQuery} />
                </li>
              ))}
            </ul>
          </section>

          {top ? (
            <BookingConfirmDialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) booking.reset();
              }}
              doctor={top.doctor}
              slotStart={booking.state.status === "taken" ? booking.state.nextFreeSlot : (picked?.start ?? null)}
              dayLabel={dayLabel}
              booking={booking}
              purpose={purpose}
              purposeLabel={t(`doctors.form.purposes.${purpose}`)}
              note={note}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
