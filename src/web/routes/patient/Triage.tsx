import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { composeSymptomText, toggleArea, type BodyArea, type PainLevel } from "@core/domain/bodyAreas";
import { specialtyLabel } from "@core/domain/labels";
import { useTriageFlow } from "@core/hooks/useTriageFlow";
import { isLanguageCode, type LanguageCode } from "@core/i18n/languages";
import { activeProfile } from "@core/store/session";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { Disclaimer } from "../../components/base/Disclaimer";
import { BodyMap } from "../../components/signature/BodyMap";
import { EmergencyScreen } from "../../components/signature/EmergencyScreen";
import { LanguageSwitchPrompt } from "../../components/signature/LanguageSwitchPrompt";
import { ListenButton } from "../../components/signature/ListenButton";
import { PainScale } from "../../components/signature/PainScale";
import { ReasoningTrail, ReasoningTrailSkeleton } from "../../components/signature/ReasoningTrail";
import { UrgencyBadge } from "../../components/signature/UrgencyBadge";
import { VoiceButton, type VoiceResult } from "../../components/signature/VoiceButton";
import { usePreferences, useSession } from "../../store";

function Bubble({ text }: { text: string }) {
  return <p className="type-body ml-auto max-w-[88%] rounded-card rounded-br-small bg-ink px-4 py-3 text-bg">{text}</p>;
}

export default function Triage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const language = usePreferences((state) => state.language);
  const elderMode = usePreferences((state) => state.elderMode);
  const profile = useSession((state) => activeProfile(state));
  const flow = useTriageFlow(language);

  const [text, setText] = useState(params.get("q") ?? "");
  const [areas, setAreas] = useState<BodyArea[]>([]);
  const [pain, setPain] = useState<PainLevel | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [spokenLanguage, setSpokenLanguage] = useState<LanguageCode | null>(null);

  const areaLabel = (area: BodyArea) => t(`triage.bodyMap.areas.${area}`);
  const composed = composeSymptomText({
    text,
    areaLabels: areas.map(areaLabel),
    painLevel: pain,
    areaTemplate: (list) => t("triage.compose.area", { areas: list }),
    painTemplate: (level) => t("triage.compose.pain", { level }),
  });

  function receive(result: VoiceResult) {
    setText(result.text);
    setHeard(result.text);
    setSpokenLanguage(result.language);
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    if (composed.length === 0) return;
    void flow.submit({
      text: composed,
      age: profile?.age ?? 40,
      sex: profile?.sex ?? "other",
      conditions: profile?.conditions,
      language,
    });
  }

  const { state } = flow;

  if (state.stage === "emergency" && state.result) {
    const reasons = state.result.red_flags.length > 0 ? state.result.red_flags : [state.result.reasoning[1] ?? ""];
    const who = profile ? `${profile.name}, ${profile.age}` : "";
    return <EmergencyScreen reasons={reasons} summary={`${who}. ${state.submittedText}. ${reasons.join(", ")}`} disclaimer={state.result.disclaimer} />;
  }

  const inputClass =
    "type-body w-full resize-none rounded-card border border-line bg-surface px-5 py-4 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      <h1 className="type-h2">{t("triage.title")}</h1>

      {state.stage === "compose" ? (
        <form onSubmit={send} className="flex flex-col gap-5">
          <div className="relative">
            <label htmlFor="symptoms" className="sr-only">
              {t("triage.inputLabel")}
            </label>
            <textarea
              id="symptoms"
              rows={4}
              value={text}
              placeholder={t("triage.placeholder")}
              onChange={(event) => {
                setText(event.target.value);
                setHeard(null);
                setSpokenLanguage(null);
              }}
              className={`${inputClass} pr-16`}
            />
            <div className="absolute right-2 top-2">
              <VoiceButton language={language} purpose="symptoms" label={t("voice.speakSymptoms")} onResult={receive} onMessage={setVoiceMessage} />
            </div>
          </div>
          <div aria-live="polite" className="type-small empty:hidden">
            {voiceMessage ?? (heard ? t("voice.heardAs", { text: heard }) : null)}
          </div>
          <LanguageSwitchPrompt text={text} hint={spokenLanguage} />

          <details className="rounded-card border border-line bg-surface p-4">
            <summary className="type-h3 cursor-pointer">{t("triage.bodyMap.title")}</summary>
            <div className="mt-4">
              <BodyMap selected={areas} onToggle={(area) => setAreas((current) => toggleArea(current, area))} />
            </div>
          </details>
          {areas.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label={t("triage.bodyMap.selected")}>
              {areas.map((area) => (
                <li key={area}>
                  <button
                    type="button"
                    onClick={() => setAreas((current) => toggleArea(current, area))}
                    aria-label={t("triage.bodyMap.remove", { area: areaLabel(area) })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-accent-soft px-4 text-[13px] font-medium text-accent-soft-text"
                  >
                    {areaLabel(area)}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <section aria-label={t("triage.pain.title")} className="flex flex-col gap-3">
            <h2 className="type-h3">{t("triage.pain.title")}</h2>
            <PainScale value={pain} onChange={setPain} />
          </section>

          <Button type="submit" className="w-full" disabled={composed.length === 0}>
            {t("triage.send")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-5" aria-live="polite">
          <Bubble text={state.submittedText} />

          {state.stage === "loading" ? (
            <Card>
              <p className="type-small mb-4">{t("triage.checking")}</p>
              <ReasoningTrailSkeleton label={t("triage.thinking")} />
            </Card>
          ) : null}

          {state.stage === "followup" ? (
            <Card className="flex flex-col gap-4">
              <span className="type-label">{t("triage.followUpTitle")}</span>
              {state.followUps.map((followUp) => (
                <div key={followUp.question} className="flex flex-col gap-3">
                  <p className="type-h3">{followUp.question}</p>
                  <div className="flex flex-wrap gap-2">
                    {followUp.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => void flow.answer(followUp.question, option)}
                        className="type-button inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-5 text-ink hover:border-ink"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          ) : null}

          {state.stage === "result" && state.result ? (
            <Card className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <UrgencyBadge urgency={state.result.urgency} />
              </div>
              <div>
                <span className="type-label">{t("triage.specialist")}</span>
                <p className="type-h3 mt-1 text-ink">
                  {specialtyLabel(state.result.specialty, language).title}: {specialtyLabel(state.result.specialty, language).plain}
                </p>
              </div>
              <div>
                <span className="type-label mb-3 block">{t("triage.whyTrail")}</span>
                <ReasoningTrail steps={state.result.reasoning} />
              </div>
              <ListenButton
                autoPlay={elderMode}
                language={isLanguageCode(state.result.language) ? state.result.language : language}
                text={`${specialtyLabel(state.result.specialty, language).title}: ${specialtyLabel(state.result.specialty, language).plain}. ${state.result.reasoning.join(". ")}`}
              />
              <Disclaimer text={state.result.disclaimer} className="mt-0" />
              <div className="flex flex-col gap-3">
                <Button to={`/app/doctors?specialty=${encodeURIComponent(state.result.specialty)}&urgency=${state.result.urgency}`} className="w-full">
                  {t("triage.showDoctors")}
                </Button>
                <Button variant="ghost" className="w-full" onClick={flow.reset}>
                  {t("triage.startOver")}
                </Button>
              </div>
            </Card>
          ) : null}

          {state.stage === "error" ? (
            <Card className="flex flex-col gap-4" role="alert">
              <p className="type-h3">{t("triage.errorTitle")}</p>
              <p className="type-small">{t("errors.generic")}</p>
              <div className="flex gap-3">
                {state.canRetry ? <Button onClick={() => void flow.retry()}>{t("common.tryAgain")}</Button> : null}
                <Button variant="secondary" onClick={flow.reset}>
                  {t("triage.startOver")}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </main>
  );
}
