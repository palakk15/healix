import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, Minus, Play, Plus, UserPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { specialtyLabel } from "@core/domain/labels";
import { formatIndiaTime } from "@core/domain/format";
import { purposeLabel } from "../../lib/purpose";
import { useReturnFocus } from "../../hooks/useReturnFocus";
import { dashboardKey } from "../../hooks/useHospitalLive";
import { usePreferences } from "../../store";
import { Button } from "../base/Button";
import { Chip } from "../base/Chip";

export interface QueueDrawerProps {
  doctorId: string | null;
  onClose: () => void;
}

export function QueueDrawer({ doctorId, onClose }: QueueDrawerProps) {
  const { t } = useTranslation();
  const language = usePreferences((state) => state.language);
  const queryClient = useQueryClient();
  const returnFocus = useReturnFocus(doctorId !== null);
  const key = [...dashboardKey, "queue", doctorId] as const;

  const queue = useQuery({ queryKey: key, enabled: doctorId !== null, queryFn: () => backend.dashboard.queue(doctorId ?? ""), refetchInterval: 3000, retry: 1 });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardKey });
  };
  const act = useMutation({
    mutationFn: async (action: { kind: "call" | "complete" | "skip"; tokenId: string } | { kind: "walkIn" } | { kind: "break"; on: boolean } | { kind: "delay"; minutes: number }) => {
      const id = doctorId ?? "";
      switch (action.kind) {
        case "call":
          return backend.callToken(action.tokenId);
        case "complete":
          return backend.completeToken(action.tokenId);
        case "skip":
          return backend.dashboard.skipToken(action.tokenId);
        case "walkIn":
          return backend.dashboard.walkIn(id);
        case "break":
          return backend.dashboard.setBreak(id, action.on);
        case "delay":
          return backend.dashboard.setDelay(id, action.minutes);
      }
    },
    onSettled: refresh,
  });

  const data = queue.data;
  const serving = data?.tokens.find((token) => token.status === "called");
  const waiting = data?.tokens.filter((token) => token.status === "waiting") ?? [];
  const finished = data?.tokens.filter((token) => token.status === "completed" || token.status === "cancelled") ?? [];
  const onBreak = data?.status === "break";
  const busy = act.isPending;

  const small = "type-small inline-flex min-h-11 items-center justify-center gap-2 rounded-pill border border-line bg-surface px-4 font-medium text-ink hover:border-ink-3 disabled:opacity-50";

  return (
    <Dialog.Root open={doctorId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid="queue-drawer"
          onCloseAutoFocus={returnFocus}
          aria-describedby="queue-drawer-description"
          className="fixed inset-y-0 right-0 z-50 flex w-[min(520px,100vw)] flex-col gap-5 overflow-y-auto border-l border-line bg-bg p-6 shadow-card"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="type-h3">{data ? data.doctor_name : t("hospital.queues.loadingDoctor")}</Dialog.Title>
              <Dialog.Description id="queue-drawer-description" className="type-small mt-1">
                {data ? `${specialtyLabel(data.specialty, language).title} · ${t(`hospital.status.${data.status}`)}` : t("hospital.loading")}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label={t("hospital.queues.close")} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {queue.isError ? <p role="alert" className="type-body">{t("hospital.error")}</p> : null}

          {data ? (
            <>
              <section aria-label={t("hospital.queues.nowServing")} className="rounded-card border border-line bg-surface p-4">
                <p className="type-label">{t("hospital.queues.nowServing")}</p>
                <p data-testid="drawer-now-serving" className="type-stat mt-1">{data.now_serving ?? "—"}</p>
                {serving ? <p className="type-small mt-1">{serving.patient}{serving.age !== null ? `, ${serving.age}` : ""}</p> : null}
              </section>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || Boolean(serving) || waiting.length === 0 || onBreak} onClick={() => waiting[0] && act.mutate({ kind: "call", tokenId: waiting[0].id })}>
                  {t("hospital.queues.callNext")}
                </Button>
                <Button size="sm" variant="secondary" disabled={busy || !serving} onClick={() => serving && act.mutate({ kind: "complete", tokenId: serving.id })}>
                  {t("hospital.queues.complete")}
                </Button>
                <button type="button" className={small} disabled={busy} onClick={() => act.mutate({ kind: "walkIn" })}>
                  <UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />
                  {t("hospital.queues.walkIn")}
                </button>
                <button type="button" className={small} disabled={busy || data.status === "on_leave" || data.status === "closed"} aria-pressed={onBreak} onClick={() => act.mutate({ kind: "break", on: !onBreak })}>
                  {onBreak ? <Play size={16} strokeWidth={1.75} aria-hidden="true" /> : <Coffee size={16} strokeWidth={1.75} aria-hidden="true" />}
                  {onBreak ? t("hospital.queues.resume") : t("hospital.queues.pause")}
                </button>
              </div>

              <section aria-label={t("hospital.queues.delay")} className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
                <div>
                  <p className="type-label">{t("hospital.queues.delay")}</p>
                  <p data-testid="drawer-delay" className="type-data mt-1">{t("hospital.minutes", { minutes: data.delay_minutes })}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" aria-label={t("hospital.queues.delayLess")} className={small} disabled={busy || data.delay_minutes <= 0} onClick={() => act.mutate({ kind: "delay", minutes: Math.max(data.delay_minutes - 5, 0) })}>
                    <Minus size={16} strokeWidth={1.75} aria-hidden="true" />5
                  </button>
                  <button type="button" aria-label={t("hospital.queues.delayMore")} className={small} disabled={busy || data.delay_minutes >= 120} onClick={() => act.mutate({ kind: "delay", minutes: data.delay_minutes + 5 })}>
                    <Plus size={16} strokeWidth={1.75} aria-hidden="true" />5
                  </button>
                </div>
              </section>

              <section aria-label={t("hospital.queues.patients")}>
                <h3 className="type-h3 mb-3">{t("hospital.queues.patients")} · {waiting.length + (serving ? 1 : 0)}</h3>
                {waiting.length + (serving ? 1 : 0) === 0 ? <p className="type-small">{t("hospital.queues.nobody")}</p> : null}
                <ul className="flex flex-col gap-3">
                  {[...(serving ? [serving] : []), ...waiting].map((token) => (
                    <li key={token.id} data-testid="drawer-token" data-status={token.status} className="rounded-card border border-line bg-surface p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="type-data text-[18px] text-ink">{token.label}</p>
                        <Chip tone={token.status === "called" ? "soft" : "outline"}>{t(`hospital.queues.token.${token.status}`)}</Chip>
                      </div>
                      <p className="type-body mt-1 font-medium text-ink">
                        {token.patient}{token.age !== null ? `, ${token.age}` : ""}
                      </p>
                      <p className="type-small">
                        {token.purpose ? `${purposeLabel(t, token.purpose)} · ` : ""}
                        {t("hospital.queues.waited", { minutes: token.waited_minutes })} · {formatIndiaTime(token.issued_at)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        {token.status === "waiting" ? (
                          <button type="button" className={small} disabled={busy || Boolean(serving) || onBreak} onClick={() => act.mutate({ kind: "call", tokenId: token.id })}>
                            {t("hospital.queues.callThis")}
                          </button>
                        ) : (
                          <button type="button" className={small} disabled={busy} onClick={() => act.mutate({ kind: "complete", tokenId: token.id })}>
                            {t("hospital.queues.complete")}
                          </button>
                        )}
                        <button type="button" className={small} disabled={busy} onClick={() => act.mutate({ kind: "skip", tokenId: token.id })}>
                          {t("hospital.queues.skip")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {finished.length > 0 ? (
                <section aria-label={t("hospital.queues.recent")}>
                  <h3 className="type-label mb-2">{t("hospital.queues.recent")}</h3>
                  <ul className="flex flex-col">
                    {finished.map((token) => (
                      <li key={token.id} className="type-small flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                        <span className="type-data text-ink">{token.label}</span>
                        <span className="min-w-0 flex-1 truncate">{token.patient}</span>
                        <span>{t(`hospital.queues.token.${token.status}`)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
          {act.isError ? <p role="alert" className="type-body">{t("hospital.queues.actionFailed")}</p> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
