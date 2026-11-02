import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "@core/api/error";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { loginWithPhone } from "../../lib/auth";
import { sessionStore } from "../../store";

const inputClass =
  "type-body min-h-14 w-full rounded-pill border border-line bg-surface px-6 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function StaffLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone) && !/^\d{10}$/.test(phone)) return setError(t("hospital.login.badPhone"));
    if (code.length < 4) return setError(t("hospital.login.badCode"));
    setBusy(true);
    setError(null);
    try {
      await loginWithPhone(phone, code);
      if (sessionStore.getState().role !== "staff") {
        sessionStore.getState().signOut();
        setError(t("hospital.login.notStaff"));
        return;
      }
      navigate("/hospital", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError && cause.code === "invalid_otp" ? t("hospital.login.badCode") : t("hospital.login.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-6 px-5 py-12">
      <h1 className="type-h2">{t("hospital.login.title")}</h1>
      <p className="type-body">{t("hospital.login.body")}</p>
      <Card className="!p-6">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
          <label className="type-label" htmlFor="staff-phone">{t("hospital.login.phone")}</label>
          <input id="staff-phone" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" className={inputClass} />
          <label className="type-label" htmlFor="staff-code">{t("hospital.login.code")}</label>
          <input id="staff-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" className={`${inputClass} font-mono tracking-[0.3em]`} />
          {error ? <p role="alert" className="type-small !text-alert-text">{error}</p> : null}
          <Button type="submit" disabled={busy}>{t("hospital.login.signIn")}</Button>
        </form>
      </Card>
      <Link to="/" className="type-small underline">{t("hospital.login.back")}</Link>
    </main>
  );
}
