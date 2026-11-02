import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { community } from "@core/api/community";
import { communityTopicIds, type CommunityTopicId } from "@core/api/schemas/community";
import { Button } from "../../components/base/Button";
import { NewPostDialog } from "../../components/community/NewPostDialog";
import { PostCard } from "../../components/community/PostCard";
import { cn } from "../../lib/cn";

type Sort = "new" | "top";

export default function Community() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState<CommunityTopicId | "all">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [query, setQuery] = useState("");

  const posts = useQuery({
    queryKey: ["community", "posts", topic, sort, query],
    queryFn: () => community.posts({ ...(topic !== "all" ? { topic } : {}), sort, ...(query.trim() ? { query: query.trim() } : {}) }),
    retry: 1,
  });
  const topics = useQuery({ queryKey: ["community", "topics"], queryFn: () => community.topics(), retry: 1 });

  const vote = useMutation({
    mutationFn: ({ id, value }: { id: string; value: -1 | 0 | 1 }) => community.vote(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community"] }),
  });

  const chip = (selected: boolean) =>
    cn("type-small inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 font-medium", selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-ink-3");

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="type-h2">{t("community.title")}</h1>
          <p className="type-small mt-1">{t("community.intro")}</p>
        </div>
        <NewPostDialog
          initialTopic={topic === "all" ? undefined : topic}
          trigger={
            <Button size="sm" className="shrink-0">
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
              {t("community.newPost")}
            </Button>
          }
        />
      </header>

      <p className="type-small rounded-card border border-line bg-stage px-4 py-3">{t("community.guidelines")}</p>

      <div role="group" aria-label={t("community.topicsLabel")} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        <button type="button" aria-pressed={topic === "all"} onClick={() => setTopic("all")} className={chip(topic === "all")}>
          {t("community.all")}
        </button>
        {communityTopicIds.map((id) => (
          <button key={id} type="button" aria-pressed={topic === id} onClick={() => setTopic(id)} className={chip(topic === id)}>
            {t(`community.topics.${id}`)}
            <span className="ml-2 text-[12px] opacity-70">{topics.data?.find((entry) => entry.id === id)?.post_count ?? ""}</span>
          </button>
        ))}
      </div>
      {topic !== "all" ? <p className="type-small -mt-2">{t(`community.topicHints.${topic}`)}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("community.search")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("community.search")}
            className="type-body h-11 w-full rounded-pill border border-line bg-surface px-5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <div role="group" aria-label={t("community.sortLabel")} className="flex gap-2">
          <button type="button" aria-pressed={sort === "new"} onClick={() => setSort("new")} className={chip(sort === "new")}>{t("community.sortNew")}</button>
          <button type="button" aria-pressed={sort === "top"} onClick={() => setSort("top")} className={chip(sort === "top")}>{t("community.sortTop")}</button>
        </div>
      </div>

      {posts.isPending ? (
        <p role="status" className="type-body">{t("community.loading")}</p>
      ) : posts.isError ? (
        <p role="alert" className="type-body">{t("community.error")}</p>
      ) : posts.data.length === 0 ? (
        <section className="rounded-card border border-line bg-surface p-6 text-center">
          <h2 className="type-h3">{t("community.empty")}</h2>
          <p className="type-small mt-1">{t("community.emptyHint")}</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-4" aria-label={t("community.title")}>
          {posts.data.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onVote={(value) => vote.mutate({ id: post.id, value })} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
