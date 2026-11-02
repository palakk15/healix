import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import type { Profile } from "@core/api/schemas/backend";
import { useReturnFocus } from "../../hooks/useReturnFocus";
import { preferencesStore, sessionStore, usePreferences } from "../../store";
import { ProfileForm, type ProfileFormValues } from "./ProfileForm";

export interface ProfileDialogProps {
  profile?: Profile;
  trigger: ReactNode;
}

export function ProfileDialog({ profile, trigger }: ProfileDialogProps) {
  const { t } = useTranslation();
  const language = usePreferences((state) => state.language);
  const [open, setOpen] = useState(false);
  const returnFocus = useReturnFocus(open);
  const editing = profile !== undefined;
  const isSelf = profile?.relation === "self";

  async function submit(values: ProfileFormValues) {
    if (profile) {
      const saved = await backend.updateProfile(profile.id, values);
      sessionStore.getState().replaceProfile(saved);
      if (sessionStore.getState().activeProfileId === saved.id) preferencesStore.getState().setElderMode(saved.elder_mode);
    } else {
      const created = await backend.addProfile({ ...values, relation: values.relation });
      sessionStore.getState().addProfile(created);
    }
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          aria-describedby="profile-dialog-description"
          className="type-scale-mobile fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line bg-bg p-6 shadow-card"
        >
          <Dialog.Title className="type-h3">{editing ? t("profileForm.editTitle") : t("profileForm.addTitle")}</Dialog.Title>
          <Dialog.Description id="profile-dialog-description" className="type-small mt-1 mb-4">
            {t("profileForm.familyHint")}
          </Dialog.Description>
          <ProfileForm
            initial={profile}
            askRelation={!isSelf}
            defaultLanguage={language}
            submitLabel={editing ? t("profileForm.save") : t("profileForm.add")}
            onSubmit={submit}
            onCancel={() => setOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
