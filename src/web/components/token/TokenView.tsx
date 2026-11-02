import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { Token } from "@core/api/schemas/backend";
import { formatIndiaTime } from "@core/domain/format";
import { purposeLabel } from "../../lib/purpose";
import { Card } from "../base/Card";
import { Chip } from "../base/Chip";
import { Disclaimer } from "../base/Disclaimer";
import { WaitReasons } from "../care/WaitReasons";
import { LeaveRing } from "./LeaveRing";
import { QueueDots } from "./QueueDots";
import { TokenPass } from "./TokenPass";
import { VisitTimeline } from "./VisitTimeline";

export interface TokenViewProps {
  token: Token;
  minutesLeft: number;
  leaveBy: string;
  totalMinutes: number;
  banner?: ReactNode;
  extras?: ReactNode;
  sample?: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="type-small">{label}</dt>
      <dd className="type-body text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

export function TokenView({ token, minutesLeft, leaveBy, totalMinutes, banner, extras, sample = false }: TokenViewProps) {
  const { t } = useTranslation();
  const active = token.status === "waiting";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${token.hospital_name} Pune`)}`;
  const Heading = sample ? "h2" : "h1";

  return (
    <div className="flex flex-col gap-5">
      {sample ? (
        <div className="flex items-center gap-3">
          <Chip tone="watch">{t("tokenView.sampleBadge")}</Chip>
          <p className="type-small">{t("tokenView.sampleNote")}</p>
        </div>
      ) : null}

      {active ? (
        <header>
          <Heading className="type-display-l">
            {minutesLeft === 0 ? (
              <Trans i18nKey="token.leaveNow" components={{ i: <i /> }} />
            ) : (
              <Trans i18nKey="token.leaveInTitle" values={{ minutes: minutesLeft }} components={{ i: <i /> }} />
            )}
          </Heading>
          <p className="type-body mt-3">{t("token.leaveBy", { time: leaveBy, minutes: token.travel_minutes })}</p>
        </header>
      ) : (
        <Heading className="type-h2">{token.status === "called" ? t("token.called", { room: token.room }) : t("token.completed")}</Heading>
      )}

      {banner}

      <TokenPass
        label={token.label}
        doctorName={token.doctor_name}
        hospitalName={token.hospital_name}
        room={token.room}
        nowServing={token.now_serving}
        ahead={token.ahead}
        status={token.status}
      />

      {active ? (
        <Card as="section" aria-label={t("tokenView.leaveCard")} className="flex items-center gap-5 !p-5">
          <LeaveRing minutesLeft={minutesLeft} totalMinutes={totalMinutes} />
          <div className="min-w-0">
            <p className="type-label">{t("tokenView.leaveBy")}</p>
            <p className="type-h3">{leaveBy}</p>
            <p className="type-small mt-2">{t("tokenView.travel", { minutes: token.travel_minutes })}</p>
            <p className="type-small mt-1">{t("token.between", { low: token.predicted_wait.range_low, high: token.predicted_wait.range_high })}</p>
          </div>
        </Card>
      ) : null}

      <Card as="section" aria-label={t("tokenView.queueTitle")} className="!p-5">
        <h2 className="type-h3 mb-3">{t("tokenView.queueTitle")}</h2>
        <QueueDots ahead={token.ahead} />
      </Card>

      <WaitReasons prediction={token.predicted_wait} />

      <Card as="section" aria-label={t("tokenView.timeline")} className="!p-5">
        <h2 className="type-h3 mb-4">{t("tokenView.timeline")}</h2>
        <VisitTimeline status={token.status} />
      </Card>

      <Card as="section" aria-label={t("tokenView.details")} className="!p-5">
        <h2 className="type-h3">{t("tokenView.details")}</h2>
        <dl className="mt-2">
          <Row label={t("tokenView.doctor")}>{token.doctor_name}</Row>
          <Row label={t("tokenView.hospital")}>{token.hospital_name}</Row>
          <Row label={t("tokenView.room")}>{token.room}</Row>
          {token.purpose ? <Row label={t("tokenView.reason")}>{purposeLabel(t, token.purpose)}</Row> : null}
          <Row label={t("tokenView.issued")}>{formatIndiaTime(token.issued_at)}</Row>
        </dl>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="type-button mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface text-ink hover:border-ink-3">
          {t("tokenView.directions")}
          <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
        </a>
      </Card>

      {extras}

      <Disclaimer />
    </div>
  );
}
