import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@core/api/schemas/backend";
import { languageCodes, languages } from "@core/i18n";
import { Button } from "../base/Button";
import { Switch } from "../base/Switch";
import { ConditionPicker } from "./ConditionPicker";

export interface ProfileFormValues {
  name: string;
  relation: "mother" | "father" | "spouse" | "child" | "other";
  age: number;
  sex: Profile["sex"];
  conditions: string[];
  language: string;
  elder_mode: boolean;
}

export interface ProfileFormProps {
  onElderChange?: (enabled: boolean) => void;
  initial?: Profile;
  askRelation: boolean;
  defaultLanguage: string;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  onCancel?: () => void;
  notice?: string | null;
}

const relations = ["mother", "father", "spouse", "child", "other"] as const;

const inputClass =
  "type-body min-h-12 w-full rounded-pill border border-line bg-surface px-5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function asRelation(value: Profile["relation"] | undefined): ProfileFormValues["relation"] {
  return value && value !== "self" ? value : "mother";
}

export function ProfileForm({ initial, askRelation, defaultLanguage, submitLabel, onSubmit, onCancel, notice, onElderChange }: ProfileFormProps) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [age, setAge] = useState(initial ? String(initial.age) : "");
  const [sex, setSex] = useState<Profile["sex"]>(initial?.sex ?? "female");
  const [relation, setRelation] = useState<ProfileFormValues["relation"]>(asRelation(initial?.relation));
  const [conditions, setConditions] = useState<string[]>(initial?.conditions ?? []);
  const [language, setLanguage] = useState(initial?.language ?? defaultLanguage);
  const [elder, setElder] = useState(initial?.elder_mode ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const years = Number(age);
    if (name.trim().length === 0) return setError(t("profileForm.nameMissing"));
    if (age.trim() === "" || !Number.isInteger(years) || years < 0 || years > 120) return setError(t("profileForm.ageInvalid"));
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), relation, age: years, sex, conditions, language, elder_mode: elder });
    } catch {
      setError(t("profileForm.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label className="type-label" htmlFor={`${id}-name`}>{t("profileForm.name")}</label>
        <input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} autoComplete="off" />
      </div>
      {askRelation ? (
        <div className="flex flex-col gap-2">
          <label className="type-label" htmlFor={`${id}-relation`}>{t("profileForm.relation")}</label>
          <select id={`${id}-relation`} value={relation} onChange={(event) => setRelation(event.target.value as ProfileFormValues["relation"])} className={inputClass}>
            {relations.map((option) => (
              <option key={option} value={option}>{t(`profileForm.relations.${option}`)}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className="type-label" htmlFor={`${id}-age`}>{t("profileForm.age")}</label>
          <input id={`${id}-age`} value={age} onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="type-label" htmlFor={`${id}-sex`}>{t("profileForm.sex")}</label>
          <select id={`${id}-sex`} value={sex} onChange={(event) => setSex(event.target.value as Profile["sex"])} className={inputClass}>
            {(["female", "male", "other"] as const).map((option) => (
              <option key={option} value={option}>{t(`profileForm.sexOptions.${option}`)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="type-label">{t("profileForm.conditions")}</span>
        <ConditionPicker value={conditions} onChange={setConditions} />
        <p className="type-small">{t("profileForm.conditionsHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <label className="type-label" htmlFor={`${id}-language`}>{t("profileForm.language")}</label>
        <select id={`${id}-language`} value={language} onChange={(event) => setLanguage(event.target.value)} className={inputClass}>
          {languageCodes.map((code) => (
            <option key={code} value={code} lang={languages[code].htmlLang}>{languages[code].nativeLabel}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-2">
        <p id={`${id}-elder`} className="type-body text-ink">{t("profileForm.largeText")}</p>
        <Switch
          checked={elder}
          onChange={(on) => {
            setElder(on);
            onElderChange?.(on);
          }} label={t("profileForm.largeText")}
          describedBy={`${id}-elder`}
        />
      </div>
      {error ? <p role="alert" className="type-small !text-alert-text">{error}</p> : null}
      {notice ? <p role="status" className="type-small font-medium text-accent-soft-text">{notice}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy} className="flex-1">{submitLabel}</Button>
        {onCancel ? <Button variant="secondary" onClick={onCancel} disabled={busy}>{t("profileForm.cancel")}</Button> : null}
      </div>
    </form>
  );
}
