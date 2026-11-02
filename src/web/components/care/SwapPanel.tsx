import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { ApiError } from "@core/api/error";
import type { SwapRequest, Token } from "@core/api/schemas/backend";
import { maxSwapRequests, swapBlockReason } from "@core/domain/swapRules";
import { formatCountdown, secondsUntil, serverOffsetMs } from "@core/domain/tokenClock";
import { useNow } from "../../hooks/useNow";
import { cn } from "../../lib/cn";
import { Button } from "../base/Button";
import { Card } from "../base/Card";

export function SwapPanel({ token }: { token: Token }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [message, setMessage] = useState(() => t("swap.defaultMessage"));
  const [myRequestId, setMyRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latest = useQuery({
    queryKey: ["swap", "latest", token.id],
    queryFn: async () => {
      try {
        return await backend.latestSwap(token.id);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) return null;
        throw cause;
      }
    },
    refetchInterval: 3000,
    retry: 0,
  });
  const candidates = useQuery({ queryKey: ["swap", "candidates", token.id], queryFn: () => backend.swapCandidates(token.id), refetchInterval: 6000, retry: 1 });

  const pending: SwapRequest | null = latest.data && latest.data.state === "pending" ? latest.data : null;
  const settled = latest.data && latest.data.id === myRequestId && latest.data.state !== "pending" ? latest.data : null;

  const lastState = settled?.state;
  useEffect(() => {
    if (lastState === "accepted") void queryClient.invalidateQueries({ queryKey: ["token", token.id] });
  }, [lastState, queryClient, token.id]);

  const create = useMutation({
    mutationFn: () => backend.createSwap(token.id, target ?? "", message),
    onSuccess: (created) => {
      setMyRequestId(created.id);
      setOpen(false);
      setTarget(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["swap"] });
      void queryClient.invalidateQueries({ queryKey: ["token", token.id] });
    },
    onError: () => setError(t("swap.failed")),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => backend.cancelSwap(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["swap"] }),
  });

  const info = candidates.data;
  const used = info?.requests_used ?? token.swap_requests_used;
  const block = swapBlockReason({
    tokenStatus: token.status,
    requestsUsed: used,
    hasPending: Boolean(pending) || Boolean(info?.has_pending),
    candidatesAhead: info?.candidates.length ?? 0,
  });
  const blockText: Record<NonNullable<typeof block>, string> = {
    called: t("swap.calledBlock"),
    limit: t("swap.limit", { max: maxSwapRequests }),
    pending: t("swap.waitFirst"),
    nobody_ahead: t("swap.nobody"),
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Repeat size={20} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
        <h2 className="type-h3">{t("swap.title")}</h2>
      </div>

      {pending ? (
        <div role="status" className="flex flex-col gap-3 rounded-small bg-stage p-4">
          <p className="type-body font-medium text-ink">{t("swap.pending", { label: pending.to_token.label })}</p>
          <p className="type-data">
            {t("swap.expiresIn", {
              time: formatCountdown(secondsUntil(pending.expires_at, serverOffsetMs(pending.server_time, latest.dataUpdatedAt), now)),
            })}
          </p>
          <Button variant="secondary" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(pending.id)}>
            {t("swap.cancelRequest")}
          </Button>
        </div>
      ) : null}

      {settled ? (
        <p role="status" className="type-body rounded-small bg-stage p-4 text-ink">
          {settled.state === "accepted" ? t("swap.accepted", { label: settled.to_token.label }) : null}
          {settled.state === "declined" ? t("swap.declined", { label: settled.to_token.label }) : null}
          {settled.state === "expired" ? t("swap.expired") : null}
          {settled.state === "cancelled" ? t("swap.cancelled") : null}
        </p>
      ) : null}

      {!open ? (
        <>
          <Button variant="secondary" disabled={block !== null} onClick={() => setOpen(true)} aria-describedby={block ? "swap-block" : undefined}>
            {t("swap.ask")}
          </Button>
          {block ? (
            <p id="swap-block" className="type-small">
              {blockText[block]}
            </p>
          ) : null}
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (target) create.mutate();
          }}
        >
          <p className="type-small">{t("swap.body")}</p>
          <div role="radiogroup" aria-label={t("swap.choose")} className="flex flex-wrap gap-2">
            {(info?.candidates ?? []).map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="radio"
                aria-checked={candidate.id === target}
                onClick={() => setTarget(candidate.id)}
                className={cn(
                  "type-data min-h-11 rounded-pill border px-5",
                  candidate.id === target ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-ink-3",
                )}
              >
                {candidate.label}
              </button>
            ))}
          </div>
          <label className="type-label" htmlFor="swap-message">
            {t("swap.messageLabel")}
          </label>
          <textarea
            id="swap-message"
            rows={2}
            maxLength={200}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="type-body w-full resize-none rounded-card border border-line bg-surface px-4 py-3 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {error ? (
            <p role="alert" className="type-small !text-alert-text">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={!target || create.isPending}>
              {create.isPending ? t("swap.sending") : t("swap.send")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <p className="type-small">{t("swap.used", { used, max: maxSwapRequests })}</p>
    </Card>
  );
}
