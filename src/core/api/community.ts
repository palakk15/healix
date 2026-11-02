import { z } from "zod";
import { requestJson } from "./http";
import {
  communityPostSchema,
  communityPostSummarySchema,
  communityPostsResponseSchema,
  communityTopicsResponseSchema,
  type CommunityTopicId,
} from "./schemas/community";

const okSchema = z.object({ ok: z.boolean() });

export const community = {
  topics: () => requestJson("/community/topics", { schema: communityTopicsResponseSchema }).then((result) => result.topics),
  posts: (options: { topic?: CommunityTopicId; sort: "new" | "top"; query?: string }) => {
    const params = new URLSearchParams({ sort: options.sort });
    if (options.topic) params.set("topic", options.topic);
    if (options.query) params.set("q", options.query);
    return requestJson(`/community/posts?${params.toString()}`, { schema: communityPostsResponseSchema }).then((result) => result.posts);
  },
  post: (id: string) => requestJson(`/community/posts/${id}`, { schema: communityPostSchema }),
  create: (request: { topic_id: CommunityTopicId; title: string; body: string }) => requestJson("/community/posts", { schema: communityPostSchema, body: request }),
  comment: (id: string, body: string) => requestJson(`/community/posts/${id}/comments`, { schema: communityPostSchema, body: { body } }),
  vote: (id: string, value: -1 | 0 | 1) => requestJson(`/community/posts/${id}/vote`, { schema: communityPostSummarySchema, body: { value } }),
  report: (id: string) => requestJson(`/community/posts/${id}/report`, { schema: okSchema, body: {} }),
  remove: (id: string) => requestJson(`/community/posts/${id}`, { schema: okSchema, method: "DELETE" }),
};
