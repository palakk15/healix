import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { Button } from "../base/Button";
import { Sheet } from "./Sheet";

export function IncomingSwapSheet() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState(false);

  const tokens = useQuery({ queryKey: ["tokens", "mine"], queryFn: () => backend.myTokens(), refetchInterval: 15_000, retry: 0 });
  const hasToken = (tokens.data ?? []).length > 0;
  const incoming = useQuery({
    queryKey: ["swap", "incoming"],
    queryFn: () => backend.incomingSwaps(),
    enabled: hasToken,
    refetchInterval: 3000,
    retry: 0,
  });

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => (accept ? backend.acceptSwap(id) : backend.declineSwap(id)),
    onSuccess: async () => {
      setError(false);
      await queryClient.invalidateQueries({ queryKey: ["swap"] });
      await queryClient.invalidateQueries({ queryKey: ["token"] });
      await queryClient.invalidateQueries({ queryKey: ["tokens"] });
    },
    onError: () => setError(true),
  });

  const request = (incoming.data ?? []).find((entry) => !dismissed.includes(entry.id));

  return (
    <Sheet
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open && request) setDismissed((current) => [...current, request.id]);
      }}
      title={t("swap.incomingTitle")}
      description={request ? t("swap.incomingBody", { from: request.from_token.label, to: request.to_token.label }) : ""}
    >
      {request ? (
        <div className="flex flex-col gap-4">
          {request.message ? <p className="type-quote text-ink">“{request.message}”</p> : null}
          {error ? (
            <p role="alert" className="type-small !text-alert-text">
              {t("swap.respondFailed")}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button className="flex-1" disabled={respond.isPending} onClick={() => respond.mutate({ id: request.id, accept: true })}>
              {t("swap.accept")}
            </Button>
            <Button className="flex-1" variant="secondary" disabled={respond.isPending} onClick={() => respond.mutate({ id: request.id, accept: false })}>
              {t("swap.decline")}
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
