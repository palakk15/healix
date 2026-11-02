import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { backend } from "@core/api/backend";
import { useDemoQueue } from "@core/hooks/useDemoQueue";
import { sampleToken } from "@core/domain/sampleToken";
import { adviseLeaveTime } from "@core/domain/leaveTime";
import { formatIndiaTime } from "@core/domain/format";
import { minutesUntil, serverOffsetMs } from "@core/domain/tokenClock";
import { activeProfile } from "@core/store/session";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { DelayBanner } from "../../components/care/DelayBanner";
import { SwapPanel } from "../../components/care/SwapPanel";
import { ListenButton } from "../../components/signature/ListenButton";
import { TokenView } from "../../components/token/TokenView";
import { useNow } from "../../hooks/useNow";
import { useQueueEvents } from "../../hooks/useQueueEvents";
import { usePreferences, useSession } from "../../store";
import { isLanguageCode } from "@core/i18n/languages";

function EmptyToken() {
  const { t } = useTranslation();
  const queue = useDemoQueue(4000);
  const now = useNow(1000);
  const token = sampleToken(queue, now);
  const advice = adviseLeaveTime(token.server_time, token.predicted_wait.wait_minutes, token.travel_minutes);
  const minutesLeft = minutesUntil(advice.leaveByIso, 0, now);
  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      <h1 className="type-h2">{t("token.noToken")}</h1>
      <Card className="flex flex-col gap-4">
        <p className="type-body">{t("token.noTokenBody")}</p>
        <Button to="/app/doctors">{t("token.findDoctor")}</Button>
      </Card>
      <div data-testid="sample-token" className="rounded-panel border border-dashed border-line p-4">
        <TokenView sample token={token} minutesLeft={minutesLeft} leaveBy={formatIndiaTime(advice.leaveByIso)} totalMinutes={token.predicted_wait.wait_minutes} />
      </div>
    </main>
  );
}

function CurrentToken() {
  const profile = useSession((state) => activeProfile(state));
  const tokens = useQuery({ queryKey: ["tokens", "mine"], queryFn: () => backend.myTokens(), retry: 1 });
  if (tokens.isPending) return <main id="main" className="px-5 pt-8" />;
  const mine = (tokens.data ?? []).find((token) => token.profile_id === profile?.id && (token.status === "waiting" || token.status === "called"));
  return mine ? <Navigate to={`/app/token/${mine.id}`} replace /> : <EmptyToken />;
}

function TokenScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = usePreferences((state) => state.language);
  const elderMode = usePreferences((state) => state.elderMode);
  const now = useNow(1000);

  const query = useQuery({ queryKey: ["token", id], queryFn: () => backend.token(id), refetchInterval: 15_000, retry: 1 });
  const token = query.data;

  useQueueEvents(token?.doctor_id, () => {
    void queryClient.invalidateQueries({ queryKey: ["token", id] });
  });

  const firstWait = useRef<number | null>(null);
  useEffect(() => {
    if (token && firstWait.current === null) firstWait.current = token.predicted_wait.wait_minutes;
  }, [token]);

  if (query.isError) return <main id="main" className="px-5 pt-8"><p role="alert" className="type-body">{t("token.error")}</p></main>;
  if (!token) return <main id="main" className="px-5 pt-8"><p role="status" className="type-body">{t("token.loading")}</p></main>;

  const advice = adviseLeaveTime(token.server_time, token.predicted_wait.wait_minutes, token.travel_minutes);
  const offset = serverOffsetMs(token.server_time, query.dataUpdatedAt);
  const minutesLeft = minutesUntil(advice.leaveByIso, offset, now);
  const leaveBy = formatIndiaTime(advice.leaveByIso);
  const active = token.status === "waiting";
  const spoken = minutesLeft === 0 ? t("token.spokenNow", { label: token.label }) : t("token.spoken", { minutes: minutesLeft, time: leaveBy, label: token.label });

  return (
    <main id="main" className="px-5 pb-8 pt-8">
      <TokenView
        token={token}
        minutesLeft={minutesLeft}
        leaveBy={leaveBy}
        totalMinutes={firstWait.current ?? token.predicted_wait.wait_minutes}
        banner={<DelayBanner initialMinutes={firstWait.current ?? token.predicted_wait.wait_minutes} currentMinutes={token.predicted_wait.wait_minutes} />}
        extras={
          <>
            <ListenButton text={spoken} language={isLanguageCode(language) ? language : "en"} autoPlay={elderMode && active} />
            <SwapPanel token={token} />
          </>
        }
      />
    </main>
  );
}

export default function Token() {
  const { id = "" } = useParams();
  return id === "current" ? <CurrentToken /> : <TokenScreen id={id} />;
}
