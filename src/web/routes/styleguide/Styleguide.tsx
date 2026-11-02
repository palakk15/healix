import { Trans, useTranslation } from "react-i18next";
import { useMeta } from "@core/hooks/useMeta";
import { contrastRatio } from "@core/domain/contrast";
import { colors, radii, spacing, typeScale, type TypeToken } from "@core/tokens";
import { DataProviders } from "../../components/layout/DataProviders";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { Chip } from "../../components/base/Chip";
import { Disclaimer } from "../../components/base/Disclaimer";
import { Eyebrow } from "../../components/base/Eyebrow";
import { LanguagePills } from "../../components/base/LanguagePills";
import { cn } from "../../lib/cn";
import { preferencesStore, sessionStore, usePreferences } from "../../store";
import { demoOtp, demoPatientPhone, demoStaffPhone, grantConsents, loginWithPhone } from "../../lib/auth";

const swatchGroups: Array<{ name: string; keys: Array<keyof typeof colors> }> = [
  { name: "Ground", keys: ["bg", "surface", "stage", "line"] },
  { name: "Ink", keys: ["ink", "ink2", "ink3", "ink3Text"] },
  { name: "Accent", keys: ["accent", "accentSoft", "accentSoftText", "mist", "lilac", "peach"] },
  { name: "Status", keys: ["ok", "watch", "watchTint", "watchText", "out", "alertText"] },
  { name: "Emergency", keys: ["emergencyBorder", "emergencyFill", "emergencyText"] },
  { name: "Dark section", keys: ["darkHeading", "darkAccent", "darkBody", "bannerText"] },
];

const typeSamples: Record<TypeToken, string> = {
  "display-xl": "Calm.",
  "display-l": "Start here.",
  h2: "Three calm steps",
  stat: "7.1 · 25 min",
  quote: "“Should my medicine change?”",
  h3: "Say how you feel",
  lead: "styleguide.sampleType",
  body: "Speak or type in Hindi, Marathi or English.",
  small: "Down from 7.9 in June.",
  button: "styleguide.samplePrimary",
  label: "styleguide.sampleLabel",
  data: "A-17 · 132 mg/dL",
};

const contrastPairs: Array<{ name: string; foreground: keyof typeof colors; background: keyof typeof colors }> = [
  { name: "ink-2 on bg", foreground: "ink2", background: "bg" },
  { name: "ink-3 on bg", foreground: "ink3", background: "bg" },
  { name: "ink-3-text on bg", foreground: "ink3Text", background: "bg" },
  { name: "ink-3-text on surface", foreground: "ink3Text", background: "surface" },
  { name: "ink-3-text on stage", foreground: "ink3Text", background: "stage" },
  { name: "accent on bg", foreground: "accent", background: "bg" },
  { name: "chip text on accent-soft", foreground: "accentSoftText", background: "accentSoft" },
  { name: "watch text on tint", foreground: "watchText", background: "watchTint" },
  { name: "alert text on surface", foreground: "alertText", background: "surface" },
  { name: "dark body on ink", foreground: "darkBody", background: "ink" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink py-12 md:py-16">
      <h2 className="type-h3 mb-8">{title}</h2>
      {children}
    </section>
  );
}

function StyleguidePage() {
  const { t } = useTranslation();
  const meta = useMeta();
  const elderMode = usePreferences((state) => state.elderMode);

  return (
    <main id="main" className="mx-auto w-full max-w-[1200px] px-5 py-16 md:px-8 md:py-24">
      <Eyebrow>{t("styleguide.eyebrow")}</Eyebrow>
      <h1 className="type-display-l mt-6 max-w-[900px]">
        <Trans i18nKey="styleguide.title" components={{ i: <i /> }} />
      </h1>
      <p className="type-lead mt-6 max-w-[640px] text-ink-2">{t("styleguide.intro")}</p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Card>
          <span className="type-label text-ink-3-text">{t("styleguide.languageSwitch")}</span>
          <LanguagePills className="mt-4 justify-start" label={t("styleguide.languageSwitch")} />
        </Card>
        <Card>
          <span className="type-label text-ink-3-text">{t("styleguide.elderMode")}</span>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="type-small">{t("styleguide.elderModeHint")}</p>
            <button
              type="button"
              role="switch"
              aria-checked={elderMode}
              aria-label={t("styleguide.elderMode")}
              onClick={() => preferencesStore.getState().setElderMode(!elderMode)}
              className={cn(
                "touch-target relative h-7 w-12 shrink-0 rounded-pill border border-line",
                elderMode ? "bg-accent" : "bg-surface",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-ink transition-all",
                  elderMode ? "left-[26px] bg-surface" : "left-0.5",
                )}
              />
            </button>
          </div>
        </Card>
        <Card>
          <span className="type-label text-ink-3-text">{t("styleguide.dataMode")}</span>
          <p className="type-data mt-4 text-ink">{meta.data?.data_mode ?? "…"}</p>
          <p className="type-small mt-1">
            {t("styleguide.sarvam")}: {meta.data?.sarvam_enabled ? t("styleguide.enabled") : t("styleguide.disabled")}
          </p>
        </Card>
      </div>

      <Section title={t("styleguide.colour")}>
        <div className="grid gap-8 md:grid-cols-2">
          {swatchGroups.map((group) => (
            <div key={group.name}>
              <p className="type-label mb-3 text-ink-3-text">{group.name}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.keys.map((key) => (
                  <div key={key} className="overflow-hidden rounded-small border border-line bg-surface">
                    <div className="h-14" style={{ background: colors[key] }} />
                    <div className="px-3 py-2">
                      <p className="type-small text-ink">{key}</p>
                      <p className="type-data text-[12px] text-ink-3-text">{colors[key]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("styleguide.contrast")}>
        <p className="type-small mb-6 max-w-[640px]">{t("styleguide.contrastNote")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {contrastPairs.map((pair) => {
            const ratio = contrastRatio(colors[pair.foreground], colors[pair.background]);
            const passes = ratio >= 4.5;
            return (
              <div
                key={pair.name}
                className="flex items-center justify-between gap-4 rounded-small border border-line px-4 py-3"
                style={{ background: colors[pair.background], color: colors[pair.foreground] }}
              >
                <span className="type-small" style={{ color: "inherit" }}>{pair.name}</span>
                <span className="type-data" style={{ color: "inherit" }}>
                  {ratio.toFixed(2)} · {passes ? t("styleguide.pass") : t("styleguide.fail")}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={t("styleguide.type")}>
        <div className="divide-y divide-line">
          {(Object.keys(typeScale) as TypeToken[]).map((token) => {
            const style = typeScale[token];
            const sample = typeSamples[token];
            return (
              <div key={token} className="grid items-baseline gap-2 py-5 md:grid-cols-[1fr_220px]">
                <p
                  className={cn(`type-${token}`, token === "label" ? "text-ink-3-text" : "text-ink", "overflow-hidden text-ellipsis")}
                >
                  {sample.startsWith("styleguide.") ? t(sample) : sample}
                </p>
                <p className="type-data text-[12px] text-ink-3-text">
                  {token} · {style.size}/{style.line} · {style.family} {style.weight}
                </p>
              </div>
            );
          })}
          <div className="grid items-baseline gap-2 py-5 md:grid-cols-[1fr_220px]">
            <p lang="mr" className="type-h2 text-ink">{t("styleguide.sampleDevanagari")}</p>
            <p className="type-data text-[12px] text-ink-3-text">devanagari · Mukta · line +4</p>
          </div>
        </div>
        <h2 className="type-display-xl mt-12 max-md:mt-8">
          <Trans i18nKey="styleguide.sampleHeadline" components={{ i: <i /> }} />
        </h2>
      </Section>

      <Section title={t("styleguide.spacing")}>
        <div className="flex items-end gap-4 overflow-x-auto pb-2">
          {spacing.map((value) => (
            <div key={value} className="flex flex-col items-center gap-2">
              <div className="rounded-small bg-accent" style={{ width: value, height: value }} />
              <span className="type-data text-[12px] text-ink-3-text">{value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("styleguide.shape")}>
        <div className="grid gap-4 md:grid-cols-4">
          {(Object.keys(radii) as Array<keyof typeof radii>).map((key) => (
            <div
              key={key}
              className="flex h-28 items-end border border-line bg-surface p-4 shadow-card"
              style={{ borderRadius: radii[key] }}
            >
              <span className="type-data text-[12px] text-ink-3-text">{key} · {radii[key]}</span>
            </div>
          ))}
        </div>
        <p className="type-small mt-4">{t("styleguide.radiiNote")}. {t("styleguide.shadowNote")}.</p>
      </Section>

      <Section title={t("styleguide.motion")}>
        <div className="relative flex h-[320px] items-center justify-center overflow-hidden rounded-panel border border-line bg-stage">
          <div className="glow left-[-80px] top-[80px] h-[260px] w-[320px] bg-mist" />
          <div className="glow right-[-60px] top-[-60px] h-[240px] w-[300px] bg-lilac" />
          <div className="glow bottom-[-100px] right-[120px] h-[200px] w-[280px] bg-peach" />
          <div
            className="orb-breathe relative flex size-[200px] flex-col items-center justify-center rounded-full text-center shadow-orb"
            style={{ background: "var(--gradient-orb)" }}
          >
            <span className="type-label text-ink-3-text">{t("styleguide.sampleLabel")}</span>
            <span className="type-stat text-ink">25 min</span>
          </div>
        </div>
        <p className="type-small mt-4">{t("styleguide.motionNote")}</p>
      </Section>

      <Section title={t("styleguide.components")}>
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <p className="type-label mb-4 text-ink-3-text">{t("styleguide.buttons")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button>{t("styleguide.samplePrimary")}</Button>
              <Button variant="secondary">{t("styleguide.sampleSecondary")}</Button>
              <Button variant="accent">{t("common.continue")}</Button>
              <Button size="sm">{t("nav.tryDemo")}</Button>
              <Button size="sm" variant="secondary">{t("nav.signIn")}</Button>
              <Button disabled>{t("common.continue")}</Button>
            </div>
          </div>
          <div>
            <p className="type-label mb-4 text-ink-3-text">{t("styleguide.chips")}</p>
            <div className="flex flex-wrap gap-2">
              <Chip>{t("styleguide.sampleChipOk")}</Chip>
              <Chip tone="watch">{t("styleguide.sampleChipWatch")}</Chip>
              <Chip tone="ink">{t("styleguide.sampleChipInk")}</Chip>
              <Chip tone="outline">{t("styleguide.sampleChipSoft")}</Chip>
              <Chip tone="emergency">SOS</Chip>
            </div>
          </div>
          <div>
            <p className="type-label mb-4 text-ink-3-text">{t("styleguide.eyebrows")}</p>
            <div className="flex flex-col items-start gap-4">
              <Eyebrow>{t("styleguide.eyebrow")}</Eyebrow>
              <div className="rounded-small bg-ink p-4">
                <Eyebrow onDark>{t("styleguide.eyebrow")}</Eyebrow>
              </div>
            </div>
          </div>
          <div>
            <p className="type-label mb-4 text-ink-3-text">{t("styleguide.disclaimers")}</p>
            <Disclaimer className="mt-0" />
          </div>
          <div className="md:col-span-2">
            <p className="type-label mb-4 text-ink-3-text">{t("styleguide.cards")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <span className="type-label text-ink-3-text">{t("tabs.symptoms")}</span>
                <h3 className="type-h3 mt-2">{t("styleguide.sampleCardTitle")}</h3>
                <p className="type-small mt-1">{t("styleguide.sampleCardBody")}</p>
                <div className="mt-4 flex gap-2">
                  <Chip>{t("styleguide.sampleChipOk")}</Chip>
                  <Chip tone="watch">{t("styleguide.sampleChipWatch")}</Chip>
                </div>
              </Card>
              <Card tint="stage">
                <span className="type-label text-ink-3-text">{t("tabs.token")}</span>
                <p className="type-stat mt-2 text-ink">25 min</p>
                <p className="type-small mt-1">{t("styleguide.sampleLabel")}</p>
              </Card>
            </div>
          </div>
        </div>
      </Section>

      {import.meta.env.DEV ? (
        <Section title={t("styleguide.devSession")}>
          <p className="type-small mb-4 max-w-[640px]">{t("styleguide.devSessionNote")}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                void loginWithPhone(demoPatientPhone, demoOtp).then(() => grantConsents(["triage", "reports", "location", "voice"]));
              }}
            >
              {t("styleguide.signInPatient")}
            </Button>
            <Button variant="secondary" onClick={() => void loginWithPhone(demoStaffPhone, demoOtp)}>
              {t("styleguide.signInStaff")}
            </Button>
            <Button variant="ghost" onClick={() => sessionStore.getState().signOut()}>
              {t("styleguide.signOut")}
            </Button>
          </div>
        </Section>
      ) : null}
    </main>
  );
}

export default function Styleguide() {
  return (
    <DataProviders>
      <StyleguidePage />
    </DataProviders>
  );
}
