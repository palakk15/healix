import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import type { DashboardDoctor } from "@core/api/schemas/backend";
import { specialtyLabel } from "@core/domain/labels";
import { Button } from "../../components/base/Button";
import { Chip } from "../../components/base/Chip";
import { QueueDrawer } from "../../components/hospital/QueueDrawer";
import { dashboardKey, useHospitalLive } from "../../hooks/useHospitalLive";
import { cn } from "../../lib/cn";
import { usePreferences } from "../../store";

type StatusFilter = "all" | DashboardDoctor["status"];
type SortKey = "waiting" | "wait" | "name";

const statusFilters: StatusFilter[] = ["all", "running", "delayed", "break", "closed", "on_leave"];
const sortKeys: SortKey[] = ["waiting", "wait", "name"];

function QueueRow({ doctor, busy, onOpen, onCall, onComplete }: { doctor: DashboardDoctor; busy: boolean; onOpen: () => void; onCall: () => void; onComplete: () => void }) {
  const { t } = useTranslation();
  const language = usePreferences((state) => state.language);
  const delayed = doctor.status === "delayed";
  return (
    <tr data-testid={`queue-${doctor.doctor_id}`} className="border-t border-line align-middle">
      <th scope="row" className="py-3 pr-4 text-left">
        <button type="button" onClick={onOpen} aria-label={t("hospital.queues.openQueue", { name: doctor.name })} className="group flex min-h-11 items-center gap-2 text-left">
          <span>
            <span className="type-h3 block !text-[18px] !leading-[24px] group-hover:underline">{doctor.name}</span>
            <span className="type-small">{specialtyLabel(doctor.specialty, language).title}</span>
          </span>
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" className="text-ink-3-text" />
        </button>
      </th>
      <td className="type-data py-3 pr-4">{doctor.now_serving ?? "—"}</td>
      <td className="type-data py-3 pr-4">{doctor.waiting}</td>
      <td className="type-data py-3 pr-4">{t("hospital.minutes", { minutes: Math.round(doctor.predicted_wait_minutes) })}</td>
      <td className="py-3 pr-4">
        <Chip tone={delayed ? "watch" : doctor.status === "running" ? "soft" : "outline"}>{t(`hospital.status.${doctor.status}`)}</Chip>
      </td>
      <td className="py-3">
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy || !doctor.next_token_id || Boolean(doctor.serving_token_id)} onClick={onCall} aria-label={t("hospital.queues.callFor", { name: doctor.name })}>
            {t("hospital.queues.callNext")}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy || !doctor.serving_token_id} onClick={onComplete} aria-label={t("hospital.queues.completeFor", { name: doctor.name })}>
            {t("hospital.queues.complete")}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function LiveQueues() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("waiting");
  const [openId, setOpenId] = useState<string | null>(null);
  useHospitalLive();
  const doctors = useQuery({ queryKey: [...dashboardKey, "doctors"], queryFn: () => backend.dashboard.doctors(), refetchInterval: 5000, retry: 1 });

  const act = useMutation({
    mutationFn: ({ kind, tokenId }: { kind: "call" | "complete"; tokenId: string }) => (kind === "call" ? backend.callToken(tokenId) : backend.completeToken(tokenId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: dashboardKey }),
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (doctors.data?.doctors ?? []).filter((doctor) => (status === "all" || doctor.status === status) && (query === "" || doctor.name.toLowerCase().includes(query) || doctor.specialty.toLowerCase().includes(query)));
    return filtered.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "wait" ? b.predicted_wait_minutes - a.predicted_wait_minutes : b.waiting - a.waiting || a.name.localeCompare(b.name)));
  }, [doctors.data, search, sort, status]);

  const chip = (selected: boolean) => cn("type-small inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 font-medium", selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-ink-3");

  return (
    <main id="main" className="flex flex-col gap-5">
      <header>
        <h1 className="type-h2">{t("hospital.queues.title")}</h1>
        <p className="type-small mt-1">{t("hospital.queues.live")} {t("hospital.queues.tip")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">{t("hospital.queues.search")}</span>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3-text" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("hospital.queues.search")}
            className="type-body h-11 w-full rounded-pill border border-line bg-surface pl-10 pr-4 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <div role="group" aria-label={t("hospital.queues.sortBy")} className="flex flex-wrap gap-2">
          {sortKeys.map((key) => (
            <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(key)} className={chip(sort === key)}>
              {t(`hospital.queues.sort.${key}`)}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label={t("hospital.queues.filterStatus")} className="flex flex-wrap gap-2">
        {statusFilters.map((key) => (
          <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)} className={chip(status === key)}>
            {key === "all" ? t("hospital.queues.all") : t(`hospital.status.${key}`)}
          </button>
        ))}
      </div>

      {doctors.isPending ? (
        <p role="status" className="type-body">{t("hospital.loading")}</p>
      ) : doctors.isError ? (
        <p role="alert" className="type-body">{t("hospital.error")}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface p-5 shadow-card">
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">{t("hospital.queues.title")}</caption>
            <thead>
              <tr className="type-label text-left">
                <th scope="col" className="pb-3 pr-4 font-medium">{t("hospital.queues.doctor")}</th>
                <th scope="col" className="pb-3 pr-4 font-medium">{t("hospital.queues.nowServing")}</th>
                <th scope="col" className="pb-3 pr-4 font-medium">{t("hospital.queues.waiting")}</th>
                <th scope="col" className="pb-3 pr-4 font-medium">{t("hospital.queues.predicted")}</th>
                <th scope="col" className="pb-3 pr-4 font-medium">{t("hospital.queues.status")}</th>
                <th scope="col" className="pb-3 font-medium">{t("hospital.queues.actions")}</th>
              </tr>
            </thead>
            <tbody aria-live="polite">
              {rows.map((doctor) => (
                <QueueRow
                  key={doctor.doctor_id}
                  doctor={doctor}
                  busy={act.isPending}
                  onOpen={() => setOpenId(doctor.doctor_id)}
                  onCall={() => doctor.next_token_id && act.mutate({ kind: "call", tokenId: doctor.next_token_id })}
                  onComplete={() => doctor.serving_token_id && act.mutate({ kind: "complete", tokenId: doctor.serving_token_id })}
                />
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p data-testid="no-rows" className="type-body p-6 text-center">{t("hospital.queues.noMatch")}</p> : null}
        </div>
      )}
      {act.isError ? <p role="alert" className="type-body">{t("hospital.queues.actionFailed")}</p> : null}
      <p className="type-small">{t("hospital.estimateNote")}</p>

      <QueueDrawer doctorId={openId} onClose={() => setOpenId(null)} />
    </main>
  );
}
