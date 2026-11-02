import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { useMeta } from "@core/hooks/useMeta";
import { formatIndiaTime } from "@core/domain/format";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { Chip } from "../../components/base/Chip";
import { dashboardKey } from "../../hooks/useHospitalLive";

const speeds = [1, 2, 4] as const;

export default function Simulator() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const meta = useMeta();
  const demoOnly = meta.data !== undefined && meta.data.data_mode !== "mock";
  const status = useQuery({
    enabled: !demoOnly,
    queryKey: ["simulator"],
    queryFn: () => backend.simulator.status(),
    refetchInterval: (query) => (query.state.data?.running ? 1000 : 4000),
    retry: 1,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["simulator"] });
    void queryClient.invalidateQueries({ queryKey: dashboardKey });
  };
  const replay = useMutation({ mutationFn: () => backend.simulator.replay(), onSuccess: refresh });
  const stop = useMutation({ mutationFn: () => backend.simulator.stop(), onSuccess: refresh });
  const reset = useMutation({ mutationFn: () => backend.simulator.reset(), onSuccess: refresh });
  const speed = useMutation({ mutationFn: (value: number) => backend.simulator.setSpeed(value), onSuccess: refresh });

  if (demoOnly) {
    return (
      <main id="main" className="flex flex-col gap-5">
        <h1 className="type-h2">{t("hospital.sim.title")}</h1>
        <p className="type-body rounded-card border border-line bg-surface p-6">{t("hospital.sim.demoOnly")}</p>
      </main>
    );
  }

  const data = status.data;
  const percent = Math.round((data?.progress ?? 0) * 100);
  const replaying = Boolean(data?.running && data.mode === "replay");

  return (
    <main id="main" className="flex flex-col gap-5">
      <header>
        <h1 className="type-h2">{t("hospital.sim.title")}</h1>
        <p className="type-small mt-1">{t("hospital.sim.hint")}</p>
      </header>

      <Card className="flex flex-col gap-5 !p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => replay.mutate()} disabled={replaying || replay.isPending}>
            {t("hospital.sim.replay")}
          </Button>
          <Button variant="secondary" onClick={() => stop.mutate()} disabled={!data?.running}>
            {t("hospital.sim.stop")}
          </Button>
          <Button variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}>
            {t("hospital.sim.reset")}
          </Button>
          {data ? <Chip tone={replaying ? "watch" : "outline"}>{replaying ? t("hospital.sim.replaying") : t("hospital.sim.live")}</Chip> : null}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="type-label">{t("hospital.sim.progress")}</span>
            <span data-testid="sim-time" className="type-data">{data ? formatIndiaTime(data.simulated_time) : "—"}</span>
          </div>
          <div role="progressbar" aria-label={t("hospital.sim.progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-pill bg-stage">
            <div className="h-full rounded-pill bg-accent transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          </div>
          <p data-testid="sim-percent" className="type-small mt-2">{t("hospital.sim.percent", { percent })}</p>
        </div>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="type-label mb-2">{t("hospital.sim.speed")}</legend>
          {speeds.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={data?.speed === value}
              onClick={() => speed.mutate(value)}
              className={`type-small min-h-11 min-w-14 rounded-pill border px-4 font-medium ${data?.speed === value ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-ink-3"}`}
            >
              {value}×
            </button>
          ))}
        </fieldset>
      </Card>
      {replay.isError || stop.isError || reset.isError ? <p role="alert" className="type-body">{t("hospital.sim.failed")}</p> : null}
      <p className="type-small">{t("hospital.sim.note")}</p>
    </main>
  );
}
