import { useQuery } from "@tanstack/react-query";
import { fetchMeta } from "../api/meta";

export const metaQueryKey = ["meta"] as const;

export function useMeta() {
  return useQuery({
    queryKey: metaQueryKey,
    queryFn: ({ signal }) => fetchMeta(signal),
    staleTime: Infinity,
    retry: 1,
  });
}
