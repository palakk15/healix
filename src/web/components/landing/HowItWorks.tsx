import type { ReactNode } from "react";
import { BookOpenCheck, CalendarCheck, MessagesSquare, Mic, ShieldCheck, Ticket } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Card } from "../base/Card";
import { Chip } from "../base/Chip";
import { Eyebrow } from "../base/Eyebrow";
import { Container } from "../layout/Container";
import { Reveal } from "../motion/Reveal";
import { RangeBar } from "../signature/RangeBar";

const steps = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;
const icons = [Mic, ShieldCheck, CalendarCheck, Ticket, BookOpenCheck, MessagesSquare];

function Dot({ tone }: { tone: "ink" | "ok" | "accent" }) {
  const color = tone === "ink" ? "bg-ink" : tone === "ok" ? "bg-ok" : "bg-accent";
  return <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${color}`} />;
}

function Visual({ step }: { step: (typeof steps)[number] }) {
  const { t } = useTranslation();
  const v = (key: string) => t(`landing.how.visual.${key}`);
  const frame = "w-full max-w-[420px] !p-5";
  const small = "type-small";

  const visuals: Record<(typeof steps)[number], ReactNode> = {
    s1: (
      <Card padding="none" className={frame}>
        <div className="flex h-11 items-center rounded-pill border border-line bg-bg px-4 text-[15px] text-ink-3-text">{t("landing.hero.placeholder")}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone="soft">{v("stomach")}</Chip>
          <Chip tone="outline">{v("threeDays")}</Chip>
          <Chip tone="outline">{v("afterMeals")}</Chip>
        </div>
      </Card>
    ),
    s2: (
      <Card padding="none" className={frame}>
        <ul className="flex flex-col gap-3">
          <li className="flex gap-3"><Dot tone="ink" /><span className={small}>{v("noDanger")}</span></li>
          <li className="flex gap-3"><Dot tone="ok" /><span className={small}>{v("points")}</span></li>
          <li className="flex gap-3"><Dot tone="accent" /><span className={`${small} font-medium text-ink`}>{v("specialist")}</span></li>
        </ul>
        <div className="mt-4"><Chip tone="watch">{v("soon")}</Chip></div>
      </Card>
    ),
    s3: (
      <Card padding="none" className={frame}>
        <dl className="grid grid-cols-2 gap-3">
          {(["specialty", "date", "time"] as const).map((key) => (
            <div key={key} className={key === "specialty" ? "col-span-2 min-w-0" : "min-w-0"}>
              <dt className="type-label">{v(key)}</dt>
              <dd className="mt-1 break-words rounded-[12px] border border-line bg-bg px-3 py-2 text-[14px] text-ink">{v(key === "specialty" ? "gastro" : key === "date" ? "tomorrow" : "morning")}</dd>
            </div>
          ))}
        </dl>
      </Card>
    ),
    s4: (
      <Card padding="none" className={`${frame} text-center`}>
        <p className="type-label">{v("ticket")}</p>
        <p className="type-stat mt-1">A-23</p>
        <p className="type-h3 mt-2 !text-[18px]">{v("leaveIn")}</p>
        <p className="type-small mt-1">{v("aheadOfYou")}</p>
      </Card>
    ),
    s5: (
      <Card padding="none" className={frame}>
        <div className="flex items-baseline justify-between">
          <span className="type-label">{v("hba1c")}</span>
          <span className="type-data">{v("value")}</span>
        </div>
        <RangeBar className="my-4" min={4} max={10} value={7.1} label="HbA1c 7.1%" segments={[{ to: 5.7, tone: "ok" }, { to: 6.5, tone: "watch" }, { to: 10, tone: "out" }]} />
        <Chip tone="watch">{v("above")}</Chip>
        <p className="type-label mt-4">{v("askDoctor")}</p>
        <p className="type-quote !text-[18px] !leading-[24px] mt-1 text-ink">{v("doctorQuestion")}</p>
      </Card>
    ),
    s6: (
      <Card padding="none" className={frame}>
        <p className="ml-auto w-fit max-w-[85%] rounded-card bg-ink px-4 py-2 text-[14px] text-bg">{v("chatQuestion")}</p>
        <p className="mt-3 max-w-[90%] rounded-card border border-line bg-bg px-4 py-2 text-[14px] text-ink">{v("chatAnswer")}</p>
        <div className="mt-4 flex gap-2">
          <Chip tone="soft">{v("diabetes")}</Chip>
          <Chip tone="outline">{v("heart")}</Chip>
        </div>
      </Card>
    ),
  };
  return visuals[step];
}

export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 md:py-32">
      <Container>
        <Reveal>
          <Eyebrow>{t("landing.how.eyebrow")}</Eyebrow>
          <h2 className="type-h2 mt-4 max-w-[760px]">
            <Trans i18nKey="landing.how.title" components={{ i: <i /> }} />
          </h2>
          <p className="type-lead mt-5 max-w-[560px] text-ink-2">{t("landing.how.lead")}</p>
        </Reveal>
        <ol className="mt-16 flex flex-col gap-10 md:gap-16">
          {steps.map((step, index) => {
            const Icon = icons[index] ?? Mic;
            const flip = index % 2 === 1;
            return (
              <Reveal as="li" key={step} className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
                <div className={flip ? "md:order-2" : undefined}>
                  <div className="flex items-center gap-4">
                    <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-text">
                      <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[14px] text-accent">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="type-h3 mb-3 mt-5 !text-[26px] !leading-[32px]">{t(`landing.how.steps.${step}.title`)}</h3>
                  <p className="type-body max-w-[460px]">{t(`landing.how.steps.${step}.body`)}</p>
                </div>
                <div className={`flex ${flip ? "md:order-1 md:justify-start" : "md:justify-end"}`}>
                  <div className="flex w-full justify-center rounded-panel border border-line bg-stage p-6 md:p-10">
                    <Visual step={step} />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
