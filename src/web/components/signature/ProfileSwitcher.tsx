import { useTranslation } from "react-i18next";
import type { Profile } from "@core/api/schemas/backend";
import { cn } from "../../lib/cn";

export interface ProfileSwitcherProps {
  profiles: readonly Profile[];
  activeId: string | null;
  onSelect: (profile: Profile) => void;
}

export function ProfileSwitcher({ profiles, activeId, onSelect }: ProfileSwitcherProps) {
  const { t } = useTranslation();
  if (profiles.length < 2) return null;
  return (
    <div role="group" aria-label={t("home.profiles")} className="flex flex-wrap gap-2">
      {profiles.map((profile) => {
        const active = profile.id === activeId;
        return (
          <button
            key={profile.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(profile)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pill border px-4 text-[14px] font-medium",
              active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-ink-3",
            )}
          >
            {profile.name.split(" ")[0]} · {profile.age}
          </button>
        );
      })}
    </div>
  );
}
