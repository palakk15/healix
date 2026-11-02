import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMeta } from "@core/hooks/useMeta";
import { demoOtp, demoPatientPhone, signInOrRegister } from "../../lib/auth";
import { Button } from "../base/Button";
import { StepFrame } from "./StepFrame";

const validPhone = /^[6-9]\d{9}$/;

export function PhoneStep({ total, onBack, onNext }: { total: number; onBack: () => void; onNext: () => void }) {
  const { t } = useTranslation();
  const meta = useMeta();
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isMock = meta.data?.data_mode === "mock";
  const isLocal = meta.data?.data_mode === "local";

  function sendCode(event: FormEvent) {
    event.preventDefault();
    if (!validPhone.test(phone)) {
      setError(t("onboarding.phone.badPhone"));
      return;
    }
    setError(null);
    setStage("otp");
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError(t("onboarding.phone.badCode"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInOrRegister(phone, code);
      onNext();
    } catch (cause) {
      const { ApiError } = await import("@core/api/error");
      setError(cause instanceof ApiError && cause.code === "invalid_otp" ? t("onboarding.phone.badCode") : t("onboarding.phone.failed"));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "type-body min-h-14 w-full rounded-pill border border-line bg-surface px-6 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  if (stage === "phone") {
    return (
      <StepFrame step={1} total={total} title={t("onboarding.phone.title")} body={t("onboarding.phone.body")} onBack={onBack}>
        <form onSubmit={sendCode} className="flex flex-1 flex-col gap-4" noValidate>
          <label className="type-label" htmlFor="phone">
            {t("onboarding.phone.label")}
          </label>
          <div className="flex items-center gap-3">
            <span className="type-body flex min-h-14 items-center rounded-pill border border-line bg-surface px-5 text-ink">+91</span>
            <input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="tel-national"
              className={inputClass}
              aria-invalid={error !== null}
              aria-describedby={error ? "phone-error" : undefined}
            />
          </div>
          {error ? (
            <p id="phone-error" role="alert" className="type-small !text-alert-text">
              {error}
            </p>
          ) : null}
          <div className="mt-auto flex flex-col gap-3 pt-8">
            <Button type="submit" className="w-full">
              {t("onboarding.phone.send")}
            </Button>
            {isMock ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setPhone(demoPatientPhone);
                  setCode(demoOtp);
                  setError(null);
                  setStage("otp");
                }}
              >
                {t("onboarding.phone.demoAccount")}
              </Button>
            ) : null}
          </div>
        </form>
      </StepFrame>
    );
  }

  return (
    <StepFrame step={1} total={total} title={t("onboarding.phone.otpTitle")} body={isLocal ? t("onboarding.phone.localCode") : t("onboarding.phone.otpSent", { phone })} onBack={() => setStage("phone")}>
      <form onSubmit={(event) => void verify(event)} className="flex flex-1 flex-col gap-4" noValidate>
        <label className="type-label" htmlFor="otp">
          {t("onboarding.phone.otpLabel")}
        </label>
        <input
          id="otp"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${inputClass} font-mono text-[22px] tracking-[0.4em]`}
          aria-invalid={error !== null}
          aria-describedby={error ? "otp-error" : undefined}
        />
        {isMock ? <p className="type-small">{t("onboarding.phone.demoHint")}</p> : null}
        {error ? (
          <p id="otp-error" role="alert" className="type-small !text-alert-text">
            {error}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-3 pt-8">
          <Button type="submit" className="w-full" disabled={busy}>
            {t("onboarding.phone.verify")}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setStage("phone")}>
            {t("onboarding.phone.changeNumber")}
          </Button>
        </div>
      </form>
    </StepFrame>
  );
}
