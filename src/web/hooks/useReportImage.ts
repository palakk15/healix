import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reports } from "@core/api/ai";

export function useReportImage(reportId: string): { url: string | null; type: string; failed: boolean; loading: boolean } {
  const query = useQuery({ queryKey: ["report-image", reportId], queryFn: () => reports.image(reportId), retry: 1, staleTime: Infinity, gcTime: 0 });
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(query.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);

  return { url, type: query.data?.type ?? "", failed: query.isError, loading: query.isPending };
}
