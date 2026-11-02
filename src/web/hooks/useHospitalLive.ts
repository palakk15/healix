import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runEventStream } from "@core/api/streams";
import type { QueueEvent } from "@core/api/schemas/backend";

export const dashboardKey = ["dashboard"] as const;

export function useHospitalLive(onEvent?: (event: QueueEvent) => void): void {
  const queryClient = useQueryClient();
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const controller = new AbortController();
    void runEventStream({
      signal: controller.signal,
      onEvent: (event) => {
        void queryClient.invalidateQueries({ queryKey: dashboardKey });
        handler.current?.(event);
      },
    });
    return () => controller.abort();
  }, [queryClient]);
}
