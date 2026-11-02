import { useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { community } from "@core/api/community";
import { ApiError } from "@core/api/error";
import { communityTopicIds, type CommunityTopicId } from "@core/api/schemas/community";
import { Button } from "../base/Button";
import { communityErrorKind } from "../../lib/communityError";
import { sessionStore } from "../../store";
import { useReturnFocus } from "../../hooks/useReturnFocus";

const inputClass = "type-body w-full rounded-card border border-line bg-surface px-4 py-3 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function NewPostDialog({ trigger, initialTopic }: { trigger: ReactNode; initialTopic?: CommunityTopicId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const returnFocus = useReturnFocus(open);
  const [topic, setTopic] = useState<CommunityTopicId>(initialTopic ?? "diabetes");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => community.create({ topic_id: topic, title: title.trim(), body: body.trim() }),
    onSuccess: async (post) => {
      await queryClient.invalidateQueries({ queryKey: ["community"] });
      setOpen(false);
      setTitle("");
      setBody("");
      navigate(`/app/community/${post.id}`);
    },
    onError: (cause) => {
      const kind = communityErrorKind(cause);
      if (kind === "content" && cause instanceof ApiError) {
        const reason = (cause.details as { error?: { reason?: string }; reason?: string } | null)?.reason;
        setError(reason && ["phone", "email", "link", "dose"].includes(reason) ? t(`community.problem.${reason}`) : t("community.failed"));
      } else if (kind === "slow") {
        setError(t("community.slowDown"));
      } else if (kind === "session") {
        setError(t("community.sessionExpired"));
        sessionStore.getState().signOut();
        setOpen(false);
        navigate("/app/welcome");
      } else if (kind === "offline") {
        setError(t("community.offline"));
      } else {
        setError(t("community.failed"));
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < 4) return setError(t("community.titleShort"));
    if (body.trim().length < 10) return setError(t("community.bodyShort"));
    setError(null);
    create.mutate();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          onCloseAutoFocus={returnFocus}
          aria-describedby="new-post-description"
          className="type-scale-mobile fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line bg-bg p-6 shadow-card"
        >
          <Dialog.Title className="type-h3">{t("community.createTitle")}</Dialog.Title>
          <Dialog.Description id="new-post-description" className="type-small mb-4 mt-1">{t("community.guidelines")}</Dialog.Description>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="post-topic" className="type-label">{t("community.topic")}</label>
              <select id="post-topic" value={topic} onChange={(event) => setTopic(event.target.value as CommunityTopicId)} className="type-body min-h-12 w-full rounded-pill border border-line bg-surface px-5 text-ink">
                {communityTopicIds.map((id) => (
                  <option key={id} value={id}>{t(`community.topics.${id}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="post-title" className="type-label">{t("community.postTitle")}</label>
              <input id="post-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={t("community.postTitlePlaceholder")} className={`${inputClass} !rounded-pill`} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="post-body" className="type-label">{t("community.postBody")}</label>
              <textarea id="post-body" value={body} rows={5} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder={t("community.postBodyPlaceholder")} className={inputClass} />
            </div>
            {error ? <p role="alert" className="type-small !text-alert-text">{error}</p> : null}
            <div className="flex gap-3">
              <Button type="submit" disabled={create.isPending} className="flex-1">{create.isPending ? t("community.posting") : t("community.publish")}</Button>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={create.isPending}>{t("community.cancel")}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
