import { ApiError } from "@core/api/error";

export type CommunityErrorKind = "content" | "slow" | "session" | "offline" | "other";

export function communityErrorKind(cause: unknown): CommunityErrorKind {
  if (!(cause instanceof ApiError)) return "other";
  if (cause.code === "content_not_allowed") return "content";
  if (cause.code === "slow_down") return "slow";
  if (cause.status === 401) return "session";
  if (cause.code === "network_error") return "offline";
  return "other";
}
