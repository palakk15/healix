import { useQuery } from "@tanstack/react-query";
import { FileText, MessageCircle, Stethoscope, Users, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { backend } from "@core/api/backend";
import { ApiError } from "@core/api/error";
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
  const appointments = (tokens.data ?? []).filter((token) => token.profile_id === profile?.id && (token.status === "waiting" || token.status === "called"));
  const todaysToken = appointments[0];
  const swaps = useQuery({
    queryKey: ["swap", "home", appointments.map((appointment) => appointment.id)],
    enabled: appointments.length > 0,
    queryFn: async () => Promise.all(appointments.map(async (appointment) => {
      try {
        return [appointment.id, await backend.latestSwap(appointment.id)] as const;
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) return [appointment.id, null] as const;
        throw cause;
      }
    })),
    refetchInterval: 3000,
    retry: 0,
  });
  const swapByToken = new Map(swaps.data ?? []);

  const goToTriage = (text?: string) => navigate(text ? `/app/triage?q=${encodeURIComponent(text)}` : "/app/triage");

  return (
    <main id="main" className="flex flex-col gap-6 px-5 pb-8 pt-8">
      <header className="flex flex-col gap-3">
        <h1 className="type-h2">{t("home.greeting", { name: (profile?.name ?? user?.name ?? "").split(" ")[0] })}</h1>
        <ProfileSwitcher profiles={user?.profiles ?? []} activeId={profile?.id ?? null} onSelect={selectProfile} />
        <Link to="/app/profile" className="type-button inline-flex min-h-11 w-fit items-center gap-2 rounded-pill border border-line bg-surface px-4 text-ink hover:border-ink-3">
          <UserRound size={18} aria-hidden="true" />{t("home.profile")}
        </Link>
      </header>

      {todaysToken ? (
        <Link to={`/app/token/${todaysToken.id}`} aria-label={t("home.todayToken")} className="block">
          <TokenTicket
            label={todaysToken.label}
            nowServing={todaysToken.now_serving}
            ahead={todaysToken.ahead}
            doctorLine={`${todaysToken.doctor_name} · ${todaysToken.room}`}
          />
          <p className="type-small mt-1">{t("home.appointmentStatus", { status: t(`tokenView.status.${todaysToken.status}`) })}</p>
        </Link>
      ) : null}

      {todaysToken && swapByToken.get(todaysToken.id) ? (
        <p role="status" className="type-small rounded-small bg-stage p-3">
          {t("home.swapStatus", { status: t(`swap.${swapByToken.get(todaysToken.id)?.state}`) })}
        </p>
      ) : null}

      {appointments.length > 1 ? (
        <section aria-labelledby="home-appointments" className="flex flex-col gap-3">
          <h2 id="home-appointments" className="type-h3">{t("home.appointments")}</h2>
          {appointments.filter((appointment) => appointment.id !== todaysToken?.id).map((appointment) => (
            <Link key={appointment.id} to={`/app/token/${appointment.id}`} className="block rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="type-h3">{appointment.label} · {appointment.doctor_name}</p>
              <p className="type-small mt-1">{t("home.appointmentStatus", { status: t(`tokenView.status.${appointment.status}`) })}</p>
              {swapByToken.get(appointment.id) ? <p className="type-small mt-1">{t("home.swapStatus", { status: t(`swap.${swapByToken.get(appointment.id)?.state}`) })}</p> : <p className="type-small mt-1">{t("home.appointmentSwapHint")}</p>}
            </Link>
          ))}
        </section>
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
