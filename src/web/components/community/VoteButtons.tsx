import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";

export interface VoteButtonsProps {
  score: number;
  myVote: -1 | 0 | 1;
  onVote: (value: -1 | 0 | 1) => void;
  disabled?: boolean;
}

export function VoteButtons({ score, myVote, onVote, disabled }: VoteButtonsProps) {
  const { t } = useTranslation();
  const base = "flex size-11 items-center justify-center rounded-full hover:bg-stage disabled:opacity-50";
  return (
    <div className="flex flex-col items-center" role="group" aria-label={t("community.score", { count: score })}>
      <button type="button" aria-label={t("community.upvote")} aria-pressed={myVote === 1} disabled={disabled} onClick={() => onVote(myVote === 1 ? 0 : 1)} className={cn(base, myVote === 1 ? "text-accent" : "text-ink-2")}>
        <ArrowBigUp size={24} strokeWidth={1.75} fill={myVote === 1 ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      <span data-testid="score" aria-live="polite" className="type-data -my-1 min-w-8 text-center text-ink">{score}</span>
      <button type="button" aria-label={t("community.downvote")} aria-pressed={myVote === -1} disabled={disabled} onClick={() => onVote(myVote === -1 ? 0 : -1)} className={cn(base, myVote === -1 ? "text-watch-text" : "text-ink-2")}>
        <ArrowBigDown size={24} strokeWidth={1.75} fill={myVote === -1 ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </div>
  );
}
