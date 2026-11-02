import { useQuery } from "@tanstack/react-query";
import { FileText, MessageCircle, Stethoscope, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { backend } from "@core/api/backend";
import { activeProfile } from "@core/store/session";
import { Card } from "../../components/base/Card";
import { ProfileSwitcher } from "../../components/signature/ProfileSwitcher";
import { selectProfile } from "../../lib/profileSwitch";
import { HoldToActivate } from "../../components/signature/HoldToActivate";
import { TokenTicket } from "../../components/signature/TokenTicket";
import { VoiceButton } from "../../components/signature/VoiceButton";
import { usePreferences, useSession } from "../../store";

function ActionCard({ to, title, hint, Icon, large }: { to: string; title: string; hint: string; Icon: typeof FileText; large?: boolean }) {
  return (
    <Link to={to} className="block rounded-card border border-line bg-surface p-5 shadow-card hover:border-ink-3">
      <Icon size={large ? 24 : 20} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
      <p className={large ? "type-h2 mt-3 !text-[28px] !leading-[32px]" : "type-h3 mt-3"}>{title}</p>
      <p className="type-small mt-1">{hint}</p>
    </Link>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSession((state) => state.user);
  const profile = useSession((state) => activeProfile(state));
  const language = usePreferences((state) => state.language);
  const elderMode = usePreferences((state) => state.elderMode);

  const tokens = useQuery({ queryKey: ["tokens", "mine"], queryFn: () => backend.myTokens(), refetchInterval: 15_000, retry: 1 });
  const todaysToken = (tokens.data ?? []).find((token) => token.profile_id === profile?.id);

  const goToTriage = (text?: string) => navigate(text ? `/app/triage?q=${encodeURIComponent(text)}` : "/app/triage");

  return (
    <main id="main" className="flex flex-col gap-6 px-5 pb-8 pt-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-h2">{t("home.greeting", { name: (profile?.name ?? user?.name ?? "").split(" ")[0] })}</h1>
        <ProfileSwitcher profiles={user?.profiles ?? []} activeId={profile?.id ?? null} onSelect={selectProfile} />
      </header>

      {todaysToken ? (
        <Link to={`/app/token/${todaysToken.id}`} aria-label={t("home.todayToken")} className="block">
          <TokenTicket
            label={todaysToken.label}
            nowServing={todaysToken.now_serving}
            ahead={todaysToken.ahead}
            doctorLine={`${todaysToken.doctor_name} · ${todaysToken.room}`}
          />
        </Link>
      ) : null}

      <Card tint="stage" className="flex flex-col items-center gap-4 text-center">
        <h2 className="type-h2">{t("home.bothering")}</h2>
        <p className="type-body">{t("home.speakOrType")}</p>
        <VoiceButton
          size="lg"
          language={language}
          purpose="symptoms"
          label={t("voice.speakSymptoms")}
          onResult={(result) => goToTriage(result.text)}
        />
        <Link to="/app/triage" className="type-button inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-6 text-ink">
          {t("home.typeInstead")}
        </Link>
      </Card>

      <div className={elderMode ? "grid gap-3" : "grid grid-cols-2 gap-3"}>
        <ActionCard to="/app/reports" title={t("home.myReports")} hint={t("home.reportsHint")} Icon={FileText} large={elderMode} />
        <ActionCard to="/app/assistant" title={t("home.askHealix")} hint={t("home.askHint")} Icon={MessageCircle} large={elderMode} />
        {elderMode ? null : <ActionCard to="/app/doctors" title={t("home.findDoctor")} hint={t("home.doctorHint")} Icon={Stethoscope} />}
        {elderMode ? null : <ActionCard to="/app/community" title={t("home.community")} hint={t("home.communityHint")} Icon={Users} />}
      </div>

      <HoldToActivate
        variant="bar"
        label={t("home.sosTitle")}
        hint={t("home.sosHint")}
        holdingLabel={t("emergency.holding")}
        onActivate={() => navigate("/app/emergency?sos=1")}
      />
    </main>
  );
}
