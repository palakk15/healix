import { communityErrorKind } from "../../lib/communityError";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { community } from "@core/api/community";
import { ApiError } from "@core/api/error";
import { Button } from "../../components/base/Button";
import { Chip } from "../../components/base/Chip";
import { timeAgoLabel } from "../../components/community/postMeta";
import { VoteButtons } from "../../components/community/VoteButtons";

export default function CommunityPost() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  const post = useQuery({ queryKey: ["community", "post", id], queryFn: () => community.post(id), retry: 1 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["community"] });

  const vote = useMutation({ mutationFn: (value: -1 | 0 | 1) => community.vote(id, value), onSuccess: refresh });
  const send = useMutation({
    mutationFn: () => community.comment(id, reply.trim()),
    onSuccess: async () => {
      setReply("");
      await refresh();
    },
    onError: (cause) => {
      const reason = (cause instanceof ApiError ? (cause.details as { reason?: string } | null)?.reason : undefined) ?? "";
      const kind = communityErrorKind(cause);
      if (kind === "session") return setError(t("community.sessionExpired"));
      if (kind === "offline") return setError(t("community.offline"));
      setError(["phone", "email", "link", "dose"].includes(reason) ? t(`community.problem.${reason}`) : kind === "slow" ? t("community.slowDown") : t("community.failed"));
    },
  });
  const remove = useMutation({
    mutationFn: () => community.remove(id),
    onSuccess: async () => {
      await refresh();
      navigate("/app/community", { replace: true });
    },
  });
  const report = useMutation({ mutationFn: () => community.report(id), onSuccess: () => setReported(true) });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reply.trim().length < 2) return setError(t("community.bodyShort"));
    setError(null);
    send.mutate();
  }

  if (post.isPending) return <main id="main" className="px-5 py-8"><p role="status" className="type-body">{t("community.loading")}</p></main>;
  if (post.isError) {
    return (
      <main id="main" className="flex flex-col gap-4 px-5 py-8">
        <p role="alert" className="type-body">{t("community.error")}</p>
        <Button to="/app/community" variant="secondary">{t("community.back")}</Button>
      </main>
    );
  }

  const data = post.data;
  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-6">
      <Link to="/app/community" className="type-small inline-flex min-h-11 items-center gap-2 font-medium text-ink-2 hover:text-ink">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        {t("community.back")}
      </Link>

      <article aria-label={data.title} className="flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <VoteButtons score={data.score} myVote={data.my_vote} onVote={(value) => vote.mutate(value)} disabled={vote.isPending} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="soft">{t(`community.topics.${data.topic_id}`)}</Chip>
            <span className="type-small">{t("community.by", { alias: data.mine ? `${data.author_alias} (${t("community.you")})` : data.author_alias })} · {timeAgoLabel(t, data.created_at)}</span>
          </div>
          <h1 className="type-h2 mt-3 !text-[26px] !leading-[32px]">{data.title}</h1>
          <p className="type-body mt-3 whitespace-pre-wrap">{data.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.mine ? (
              <button type="button" onClick={() => remove.mutate()} className="type-small inline-flex min-h-11 items-center gap-2 rounded-pill border border-line px-4 font-medium hover:border-ink-3">
                <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                {t("community.delete")}
              </button>
            ) : (
              <button type="button" onClick={() => report.mutate()} disabled={reported} className="type-small inline-flex min-h-11 items-center gap-2 rounded-pill border border-line px-4 font-medium hover:border-ink-3 disabled:opacity-60">
                <Flag size={16} strokeWidth={1.75} aria-hidden="true" />
                {t("community.report")}
              </button>
            )}
          </div>
          {reported ? <p role="status" className="type-small mt-2">{t("community.reported")}</p> : null}
        </div>
      </article>

      <section aria-labelledby="replies-title" className="flex flex-col gap-3">
        <h2 id="replies-title" className="type-h3">{t("community.replies")} · {data.comments.length}</h2>
        {data.comments.length === 0 ? <p className="type-small">{t("community.noReplies")}</p> : null}
        <ul className="flex flex-col gap-3">
          {data.comments.map((comment) => (
            <li key={comment.id} data-testid="comment" className="rounded-card border border-line bg-surface p-4">
              <p className="type-small">
                <span className="font-medium text-ink">{comment.mine ? `${comment.author_alias} (${t("community.you")})` : comment.author_alias}</span> · {timeAgoLabel(t, comment.created_at)}
              </p>
              <p className="type-body mt-1 whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <label htmlFor="reply" className="type-label">{t("community.writeReply")}</label>
        <textarea
          id="reply"
          value={reply}
          rows={3}
          maxLength={800}
          onChange={(event) => setReply(event.target.value)}
          placeholder={t("community.replyPlaceholder")}
          className="type-body w-full rounded-card border border-line bg-surface px-4 py-3 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <p className="type-small">{t("community.guidelines")}</p>
        {error ? <p role="alert" className="type-small !text-alert-text">{error}</p> : null}
        <Button type="submit" disabled={send.isPending}>{t("community.sendReply")}</Button>
      </form>
    </main>
  );
}
