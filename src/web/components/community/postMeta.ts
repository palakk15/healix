import type { TFunction } from "i18next";
import { timeAgoParts } from "@core/domain/communityRules";

export function timeAgoLabel(t: TFunction, iso: string, nowMs = Date.now()): string {
  const { unit, value } = timeAgoParts(new Date(iso).getTime(), nowMs);
  return t(`community.ago.${unit}`, { value });
}
