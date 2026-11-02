import { useState } from "react";
import { useTranslation } from "react-i18next";
import { consentPurposes, type ConsentPurpose } from "@core/store/session";
import { grantConsents } from "../../lib/auth";
import { sessionStore } from "../../store";
import { Button } from "../base/Button";
import { Switch } from "../base/Switch";
import { StepFrame } from "./StepFrame";

export function ConsentStep({ total, onBack, onNext }: { total: number; onBack: () => void; onNext: () => void }) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<ConsentPurpose[]>(() => consentPurposes.filter((purpose) => sessionStore.getState().consents[purpose]));
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggle(purpose: ConsentPurpose, on: boolean) {
    setChosen((current) => (on ? [...current, purpose] : current.filter((entry) => entry !== purpose)));
  }

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      await grantConsents(chosen);
      onNext();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepFrame step={2} total={total} title={t("onboarding.consent.title")} body={t("onboarding.consent.body")} onBack={onBack}>
      <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
        {consentPurposes.map((purpose) => (
          <li key={purpose} className="flex items-start gap-3 p-5">
            <div className="flex-1">
              <h2 className="type-h3">{t(`onboarding.consent.${purpose}.title`)}</h2>
              {purpose === "voice" ? null : (
                <p id={`consent-${purpose}`} className="type-small mt-1">
                  {t(`onboarding.consent.${purpose}.body`)}
                </p>
              )}
            </div>
            <Switch
              checked={chosen.includes(purpose)}
              onChange={(on) => toggle(purpose, on)}
              label={t(`onboarding.consent.${purpose}.title`)}
              describedBy={purpose === "voice" ? undefined : `consent-${purpose}`}
            />
          </li>
        ))}
      </ul>
      {chosen.length === 0 ? <p className="type-small mt-4">{t("onboarding.consent.needOne")}</p> : null}
      {failed ? (
        <p role="alert" className="type-small mt-4 !text-alert-text">
          {t("errors.generic")}
        </p>
      ) : null}
      <div className="mt-auto pt-8">
        <Button className="w-full" disabled={chosen.length === 0 || busy} onClick={() => void save()}>
          {t("common.continue")}
        </Button>
      </div>
    </StepFrame>
  );
}
