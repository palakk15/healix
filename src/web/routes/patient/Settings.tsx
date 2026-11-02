import { useState } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { consentPurposes, type ConsentPurpose } from "@core/store/session";
import { ProfileDialog } from "../../components/profile/ProfileDialog";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { Chip } from "../../components/base/Chip";
import { LanguagePills } from "../../components/base/LanguagePills";
import { Switch } from "../../components/base/Switch";
import { preferencesStore, sessionStore, usePreferences, useSession } from "../../store";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="type-h3">{title}</h2>
      {children}
    </section>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const elderMode = usePreferences((state) => state.elderMode);
  const user = useSession((state) => state.user);
  const consents = useSession((state) => state.consents);
  const [failed, setFailed] = useState(false);

  const records = useQuery({ queryKey: ["consents"], queryFn: () => backend.consents(), retry: 1 });

  const toggle = useMutation({
    mutationFn: async ({ purpose, granted }: { purpose: ConsentPurpose; granted: boolean }) => {
      if (granted) {
        await backend.setConsent(purpose, true);
        return;
      }
      const list = await backend.consents();
      const record = list.find((entry) => entry.purpose === purpose && entry.granted);
      if (record) await backend.revokeConsent(record.id);
    },
    onMutate: () => setFailed(false),
    onSuccess: (_result, { purpose, granted }) => {
      sessionStore.getState().setConsent(purpose, granted);
      void queryClient.invalidateQueries({ queryKey: ["consents"] });
    },
    onError: () => setFailed(true),
  });

  async function changeElder(on: boolean) {
    preferencesStore.getState().setElderMode(on);
    const { user: current, activeProfileId } = sessionStore.getState();
    const active = current?.profiles.find((entry) => entry.id === activeProfileId);
    if (!active) return;
    try {
      const saved = await backend.updateProfile(active.id, { name: active.name, age: active.age, sex: active.sex, conditions: active.conditions, language: active.language, elder_mode: on });
      sessionStore.getState().replaceProfile(saved);
    } catch {
      return;
    }
  }

  function signOut() {
    sessionStore.getState().signOut();
    queryClient.clear();
    window.location.assign("/");
  }

  return (
    <main id="main" className="flex flex-col gap-8 px-5 pb-10 pt-8">
      <h1 className="type-h2">{t("settings.title")}</h1>

      <Section id="settings-language" title={t("settings.language")}>
        <LanguagePills label={t("settings.language")} className="!justify-start" />
      </Section>

      <Section id="settings-elder" title={t("settings.elderTitle")}>
        <Card padding="none" className="flex items-center justify-between gap-4 px-5 py-3">
          <p id="settings-elder-hint" className="type-body text-ink">{t("settings.elderHint")}</p>
          <Switch checked={elderMode} onChange={(on) => void changeElder(on)} label={t("settings.elderTitle")} describedBy="settings-elder-hint" />
        </Card>
      </Section>

      <Section id="settings-consent" title={t("settings.consentTitle")}>
        <p className="type-small">{t("settings.consentHint")}</p>
        <ul className="flex flex-col gap-3">
          {consentPurposes.map((purpose) => (
            <li key={purpose}>
              <Card padding="none" className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <p id={`consent-${purpose}`} className="type-h3 !text-[18px] !leading-[24px]">{t(`onboarding.consent.${purpose}.title`)}</p>
                  <p className="type-small mt-1">{t(`onboarding.consent.${purpose}.body`)}</p>
                </div>
                <Switch
                  checked={consents[purpose]}
                  onChange={(granted) => toggle.mutate({ purpose, granted })}
                  label={t(`onboarding.consent.${purpose}.title`)}
                  describedBy={`consent-${purpose}`}
                />
              </Card>
            </li>
          ))}
        </ul>
        <p role="status" aria-live="polite" className="type-small">
          {failed ? t("settings.consentFailed") : records.isSuccess ? t("settings.consentCount", { count: records.data.filter((entry) => entry.granted).length }) : ""}
        </p>
      </Section>

      <Section id="settings-family" title={t("settings.familyTitle")}>
        <ul className="flex flex-col gap-3">
          {(user?.profiles ?? []).map((profile) => (
            <li key={profile.id}>
              <Card padding="none" className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="type-h3 !text-[18px] !leading-[24px]">{profile.name}</p>
                  <p className="type-small">
                    {t("settings.years", { age: profile.age })}
                    {profile.conditions.length > 0 ? ` · ${profile.conditions.join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone={profile.relation === "self" ? "ink" : "soft"}>
                    {profile.relation === "self" ? t("settings.you") : t(`profileForm.relations.${profile.relation}`)}
                  </Chip>
                  <ProfileDialog
                    profile={profile}
                    trigger={
                      <button type="button" aria-label={`${t("profileForm.edit")} ${profile.name}`} className="type-small inline-flex min-h-11 items-center rounded-pill border border-line px-4 font-medium hover:border-ink-3">
                        {t("profileForm.edit")}
                      </button>
                    }
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
        <ProfileDialog
          trigger={
            <Button variant="secondary">
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
              {t("profileForm.addMember")}
            </Button>
          }
        />
      </Section>

      <Section id="settings-privacy" title={t("settings.privacyTitle")}>
        <p className="type-body">{t("settings.privacyBody")}</p>
      </Section>

      <Button variant="secondary" onClick={signOut}>{t("settings.signOut")}</Button>
    </main>
  );
}
