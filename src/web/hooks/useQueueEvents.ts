import { useEffect, useRef } from "react";
import { runEventStream } from "@core/api/streams";
import type { QueueEvent } from "@core/api/schemas/backend";

export function useQueueEvents(doctorId: string | undefined, onEvent: (event: QueueEvent) => void): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!doctorId) return undefined;
    const controller = new AbortController();
    void runEventStream({
      signal: controller.signal,
      onEvent: (event) => {
        if (!event.doctor_id || event.doctor_id === doctorId) handler.current(event);
      },
    });
    return () => controller.abort();
  }, [doctorId]);
}
