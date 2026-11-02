import { CalendarCheck, FileText, Globe, HeartPulse, MessagesSquare, Siren, Stethoscope, Ticket, Type, Users } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Card } from "../base/Card";
import { Eyebrow } from "../base/Eyebrow";
import { Container } from "../layout/Container";
import { Reveal } from "../motion/Reveal";

const items = [
  { key: "symptoms", Icon: Stethoscope },
  { key: "doctors", Icon: CalendarCheck },
  { key: "token", Icon: Ticket },
  { key: "reports", Icon: FileText },
  { key: "community", Icon: Users },
  { key: "language", Icon: Globe },
  { key: "family", Icon: HeartPulse },
  { key: "elder", Icon: Type },
  { key: "emergency", Icon: Siren },
] as const;

export function FeatureGrid() {
  const { t } = useTranslation();
  return (
    <section id="features" className="scroll-mt-24 pb-20 md:pb-32">
      <Container>
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>{t("landing.features.eyebrow")}</Eyebrow>
            <h2 className="type-h2 mt-4 max-w-[680px]">
              <Trans i18nKey="landing.features.title" components={{ i: <i /> }} />
            </h2>
          </div>
          <p className="type-body md:w-[360px]">{t("landing.features.aside")}</p>
        </Reveal>

        <Reveal className="mt-14">
          <Card padding="none" className="grid gap-8 overflow-hidden p-6 md:grid-cols-2 md:items-center md:gap-14 md:p-12">
            <div>
              <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-text">
                <MessagesSquare size={22} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="type-label mt-6 block text-accent">{t("landing.features.assistant.label")}</span>
              <h3 className="type-h2 mt-3 !text-[34px] !leading-[40px]">{t("landing.features.assistant.title")}</h3>
              <p className="type-body mt-4 max-w-[480px]">{t("landing.features.assistant.body")}</p>
            </div>
            <div className="rounded-panel border border-line bg-stage p-5 md:p-8" role="img" aria-label={`${t("landing.features.assistant.q")} ${t("landing.features.assistant.a")}`}>
              <p className="ml-auto w-fit max-w-[88%] rounded-card bg-ink px-5 py-3 text-[16px] leading-[1.5] text-bg">{t("landing.features.assistant.q")}</p>
              <p className="mt-4 max-w-[92%] rounded-card border border-line bg-surface px-5 py-4 text-[16px] leading-[1.55] text-ink">{t("landing.features.assistant.a")}</p>
              <p className="ml-auto mt-6 w-fit max-w-[88%] rounded-card bg-ink px-5 py-3 text-[16px] leading-[1.5] text-bg">{t("landing.features.assistant.q2")}</p>
              <p className="mt-4 max-w-[92%] rounded-card border border-line bg-surface px-5 py-4 text-[16px] leading-[1.55] text-ink">{t("landing.features.assistant.a2")}</p>
              <p className="type-small mt-6 text-center">{t("landing.features.assistant.note")}</p>
            </div>
          </Card>
        </Reveal>

        <ul className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ key, Icon }, index) => (
            <Reveal as="li" index={index % 3} key={key}>
              <Card as="article" padding="none" className="h-full p-6 md:p-8">
                <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent-soft-text">
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="type-h3 mb-2 mt-5">{t(`landing.features.items.${key}.title`)}</h3>
                <p className="type-body">{t(`landing.features.items.${key}.body`)}</p>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
