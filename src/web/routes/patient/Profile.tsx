import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { backend } from "@core/api/backend";
import { formatIndiaTime } from "@core/domain/format";
import { activeProfile } from "@core/store/session";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { Chip } from "../../components/base/Chip";
import { ProfileForm, type ProfileFormValues } from "../../components/profile/ProfileForm";
import { preferencesStore, sessionStore, usePreferences, useSession } from "../../store";

export default function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useSession((state) => activeProfile(state));
  const language = usePreferences((state) => state.language);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const visits = useQuery({ queryKey: ["tokens", "mine"], queryFn: () => backend.myTokens(), refetchInterval: 15_000, retry: 1 });

  if (!profile) return <main id="main" className="px-5 pt-8"><p role="status" className="type-body">{t("profilePage.noProfile")}</p></main>;

  const currentProfile = profile;
  const history = (visits.data ?? []).filter((visit) => visit.profile_id === currentProfile.id).sort((a, b) => b.issued_at.localeCompare(a.issued_at));
  const conditions = currentProfile.conditions.length ? currentProfile.conditions.join(", ") : t("profilePage.none");
  const sexLabel = t(`profileForm.sexOptions.${currentProfile.sex}`);

  async function save(values: ProfileFormValues) {
    const update = { name: values.name, age: values.age, sex: values.sex, conditions: values.conditions, language: values.language, elder_mode: values.elder_mode };
    const updated = await backend.updateProfile(currentProfile.id, update);
    sessionStore.getState().replaceProfile(updated);
    if (sessionStore.getState().activeProfileId === updated.id) preferencesStore.getState().setElderMode(updated.elder_mode);
    setEditing(false);
    setSaved(true);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <main id="main" className="flex flex-col gap-6 px-5 pb-8 pt-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="type-h2">{t("profilePage.title")}</h1>
          <p className="type-small mt-1">{t("profilePage.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setEditing((value) => !value); setSaved(false); }}>
          {editing ? t("profileForm.cancel") : t("profileForm.edit")}
        </Button>
      </header>

      {editing ? (
        <Card>
          <ProfileForm key={currentProfile.id} initial={currentProfile} askRelation={false} defaultLanguage={language} submitLabel={t("profileForm.saveDetails")} onSubmit={save} onCancel={() => setEditing(false)} />
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <h2 className="type-h3">{currentProfile.name}</h2>
          <p className="type-body">{t("profilePage.ageAndSex", { age: currentProfile.age, sex: sexLabel })}</p>
          <p className="type-small">{t("profilePage.conditions", { conditions })}</p>
          <p className="type-small">{t("profilePage.language", { language: currentProfile.language.toUpperCase() })}</p>
        </Card>
      )}
      {saved ? <p role="status" className="type-small font-medium text-accent-soft-text">{t("profileForm.saved")}</p> : null}

      <section aria-labelledby="profile-history" className="flex flex-col gap-3">
        <h2 id="profile-history" className="type-h3">{t("profilePage.history")}</h2>
        {visits.isPending ? <p role="status" className="type-small">{t("profilePage.loading")}</p> : null}
        {visits.isError ? <p role="alert" className="type-small !text-alert-text">{t("profilePage.loadFailed")}</p> : null}
        {visits.isSuccess && history.length === 0 ? <Card><p className="type-small">{t("profilePage.empty")}</p></Card> : null}
        <ul className="flex flex-col gap-3">
          {history.map((visit) => (
            <li key={visit.id}>
              <Link to={`/app/token/${visit.id}`} className="block">
                <Card className="flex items-start justify-between gap-3">
                  <div>
                    <p className="type-h3">{visit.doctor_name}</p>
                    <p className="type-small mt-1">{visit.hospital_name}</p>
                    <p className="type-small mt-1">{formatIndiaTime(visit.issued_at)}</p>
                  </div>
                  <Chip tone={visit.status === "waiting" ? "watch" : "soft"}>{t(`tokenView.status.${visit.status}`)}</Chip>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
