import { z } from "zod";

export const communityTopicIds = ["diabetes", "heart", "women", "seniors", "mind", "food"] as const;
export const communityTopicSchema = z.enum(communityTopicIds);

export const communityTopicSummarySchema = z.object({
  id: communityTopicSchema,
  post_count: z.number().int(),
});

export const communityPostSummarySchema = z.object({
  id: z.string(),
  topic_id: communityTopicSchema,
  title: z.string(),
  snippet: z.string(),
  author_alias: z.string(),
  created_at: z.iso.datetime(),
  score: z.number().int(),
  comment_count: z.number().int(),
  my_vote: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  mine: z.boolean(),
});

export const communityCommentSchema = z.object({
  id: z.string(),
  author_alias: z.string(),
  body: z.string(),
  created_at: z.iso.datetime(),
  mine: z.boolean(),
});

export const communityPostSchema = communityPostSummarySchema.extend({
  body: z.string(),
  comments: z.array(communityCommentSchema),
});

export const communityTopicsResponseSchema = z.object({ topics: z.array(communityTopicSummarySchema) });
export const communityPostsResponseSchema = z.object({ posts: z.array(communityPostSummarySchema) });

export const createPostRequestSchema = z.object({
  topic_id: communityTopicSchema,
  title: z.string().trim().min(4).max(120),
  body: z.string().trim().min(10).max(2000),
});

export const createCommentRequestSchema = z.object({ body: z.string().trim().min(2).max(800) });
export const voteRequestSchema = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });

export type CommunityTopicId = z.infer<typeof communityTopicSchema>;
export type CommunityPostSummary = z.infer<typeof communityPostSummarySchema>;
export type CommunityPost = z.infer<typeof communityPostSchema>;
export type CommunityComment = z.infer<typeof communityCommentSchema>;
