import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { CommunityPostSummary } from "@core/api/schemas/community";
import { Chip } from "../base/Chip";
import { timeAgoLabel } from "./postMeta";
import { VoteButtons } from "./VoteButtons";

export interface PostCardProps {
  post: CommunityPostSummary;
  onVote: (value: -1 | 0 | 1) => void;
}

export function PostCard({ post, onVote }: PostCardProps) {
  const { t } = useTranslation();
  return (
    <article aria-label={post.title} className="flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <VoteButtons score={post.score} myVote={post.my_vote} onVote={onVote} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="soft">{t(`community.topics.${post.topic_id}`)}</Chip>
          <span className="type-small">
            {t("community.by", { alias: post.mine ? `${post.author_alias} (${t("community.you")})` : post.author_alias })} · {timeAgoLabel(t, post.created_at)}
          </span>
        </div>
        <h2 className="type-h3 mt-2 !text-[18px] !leading-[24px]">
          <Link to={`/app/community/${post.id}`} className="hover:underline">{post.title}</Link>
        </h2>
        <p className="type-small mt-1 line-clamp-2">{post.snippet}</p>
        <Link to={`/app/community/${post.id}`} className="type-small mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-ink-2 hover:text-ink">
          <MessageSquare size={16} strokeWidth={1.75} aria-hidden="true" />
          {t("community.comments", { count: post.comment_count })}
        </Link>
      </div>
    </article>
  );
}
