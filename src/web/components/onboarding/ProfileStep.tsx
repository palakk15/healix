import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { activeProfile } from "@core/store/session";
import { preferencesStore, sessionStore, usePreferences, useSession } from "../../store";
import { Button } from "../base/Button";
import { Card } from "../base/Card";
import { Chip } from "../base/Chip";
import { ProfileDialog } from "../profile/ProfileDialog";
import { ProfileForm, type ProfileFormValues } from "../profile/ProfileForm";
import { StepFrame } from "./StepFrame";

export function ProfileStep({ total, onBack, onFinish }: { total: number; onBack: () => void; onFinish: () => void }) {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const language = usePreferences((state) => state.language);
  const self = useSession((state) => state.user?.profiles.find((profile) => profile.relation === "self") ?? activeProfile(state));
  const [saved, setSaved] = useState(false);
  const family = (user?.profiles ?? []).filter((profile) => profile.id !== self?.id);

  async function saveSelf(values: ProfileFormValues) {
    if (!self) return;
    const updated = await backend.updateProfile(self.id, values);
    sessionStore.getState().replaceProfile(updated);
    if (sessionStore.getState().activeProfileId === updated.id) preferencesStore.getState().setElderMode(updated.elder_mode);
    setSaved(true);
  }

  return (
    <StepFrame step={3} total={total} title={t("onboarding.profile.title")} body={t("profileForm.myDetailsHint")} onBack={onBack}>
      <section aria-labelledby="my-details" className="flex flex-col gap-4">
        <h2 id="my-details" className="type-h3">{t("profileForm.myDetails")}</h2>
        {self ? (
          <ProfileForm
            key={self.id}
            initial={self}
            askRelation={false}
            defaultLanguage={language}
            submitLabel={t("profileForm.saveDetails")}
            onSubmit={saveSelf}
            onElderChange={(on) => preferencesStore.getState().setElderMode(on)}
            notice={saved ? t("profileForm.saved") : null}
          />
        ) : null}
      </section>

      <section aria-labelledby="family-members" className="mt-8 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="family-members" className="type-h3">{t("profileForm.family")}</h2>
          <ProfileDialog
            trigger={
              <button
                type="button"
                aria-label={t("profileForm.addMember")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink hover:border-ink-3"
              >
                <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            }
          />
        </div>
        {family.length === 0 ? <p className="type-small">{t("profileForm.familyHint")}</p> : null}
        <ul className="flex flex-col gap-3">
          {family.map((profile) => (
            <li key={profile.id}>
              <Card padding="none" className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="type-h3">{profile.name}</p>
                  <p className="type-small">{t("profileForm.years", { age: profile.age })}</p>
                </div>
                <Chip tone="soft">{t(`profileForm.relations.${profile.relation === "self" ? "other" : profile.relation}`)}</Chip>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto pt-8">
        <Button className="w-full" onClick={onFinish}>
          {t("onboarding.profile.finish")}
        </Button>
      </div>
    </StepFrame>
  );
}
