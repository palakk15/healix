import { useTranslation } from "react-i18next";
import { activeProfile } from "@core/store/session";
import { useSession } from "../../store";

export function ActiveProfileBar() {
  const { t } = useTranslation();
  const active = useSession((state) => activeProfile(state));
  if (!active) return null;

  return (
    <section aria-label={t("profileForm.barLabel")} data-testid="profile-bar" className="border-b border-line bg-bg px-5 py-3">
      <p className="type-small">
        <span data-testid="profile-bar-name" className="font-medium text-ink">{active.name.split(" ")[0]}</span>
        <span className="text-ink-3-text"> · {t("profileForm.years", { age: active.age })}</span>
      </p>
    </section>
  );
}
