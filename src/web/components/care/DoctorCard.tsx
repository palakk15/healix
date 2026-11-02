import { Check, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MatchItem } from "@core/api/schemas/backend";
import { formatRupees } from "@core/domain/format";
import { specialtyLabel } from "@core/domain/labels";
import { languageNativeName, sortLanguagesForPatient, speaksPatientLanguage, patientLanguageName } from "@core/domain/doctorLanguages";
import type { LanguageCode } from "@core/i18n/languages";
import { useTranslatedText } from "../../hooks/useTranslatedText";
import { cn } from "../../lib/cn";
import { Button } from "../base/Button";
import { Card } from "../base/Card";
import { Chip } from "../base/Chip";

export interface DoctorCardProps {
  item: MatchItem;
  language: LanguageCode;
  isTop: boolean;
  onBookTop?: () => void;
  bookingQuery?: string;
}

export function DoctorCard({ item, language, isTop, onBookTop, bookingQuery }: DoctorCardProps) {
  const { t } = useTranslation();
  const { doctor, predicted_wait: wait } = item;
  const why = useTranslatedText(item.why, language);
  const about = useTranslatedText(doctor.about ?? "", language);
  const speaks = speaksPatientLanguage(doctor.languages, language);
  const mine = patientLanguageName(language);
  const summary = [
    speaks ? t("doctors.speaks", { languages: languageNativeName(mine) }) : null,
    t("doctors.away", { km: doctor.distance_km ?? 0 }),
    t("doctors.about", { minutes: wait.wait_minutes }),
  ].filter(Boolean);

  return (
    <Card as="article" aria-label={doctor.name} className={cn("flex flex-col gap-4", isTop && "border-accent")}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="type-h3">{doctor.name}</h2>
          <p className="type-small mt-0.5">
            {specialtyLabel(doctor.specialty, language).title} · {doctor.hospital.name}
          </p>
        </div>
        {isTop ? <Chip tone="ink">{t("doctors.topPick")}</Chip> : null}
      </header>

      <p className="type-small font-medium text-ink">{summary.join(" · ")}</p>

      {doctor.about ? <p className="type-small line-clamp-3">{about}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {sortLanguagesForPatient(doctor.languages, language).map((spoken) => {
          const highlighted = spoken === mine;
          return (
            <Chip key={spoken} tone={highlighted ? "soft" : "outline"}>
              {highlighted ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : null}
              {languageNativeName(spoken)}
            </Chip>
          );
        })}
        <Chip tone="outline">
          {formatRupees(doctor.fee_inr)} {t("doctors.perVisit")}
        </Chip>
        {doctor.rating === null ? (
          <Chip tone="watch">{t("doctors.newDoctor")}</Chip>
        ) : (
          <Chip tone="outline" aria-label={t("doctors.ratingLabel", { rating: doctor.rating.toFixed(1) })}>
            <Star size={14} strokeWidth={1.75} aria-hidden="true" />
            {doctor.rating.toFixed(1)}
          </Chip>
        )}
      </div>

      <div className="rounded-small bg-stage px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="type-label">{t("doctors.wait")}</span>
          <Chip tone="outline">{t("doctors.estimate")}</Chip>
        </div>
        <p className="type-stat mt-1 text-ink">
          ~{wait.wait_minutes} <span className="type-small">min</span>
        </p>
        <p className="type-small">{t("doctors.between", { low: wait.range_low, high: wait.range_high })}</p>
      </div>

      <div>
        <span className="type-label">{t("doctors.whyThis")}</span>
        <p className="type-small mt-1">{why}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {isTop && onBookTop ? (
          <Button className="flex-1" onClick={onBookTop}>
            {t("doctors.bookTop")}
          </Button>
        ) : null}
        <Button to={`/app/doctors/${doctor.id}${bookingQuery ? `?${bookingQuery}` : ""}`} variant="secondary" className="flex-1">
          {t("doctors.seeTimes")}
        </Button>
      </div>
    </Card>
  );
}
