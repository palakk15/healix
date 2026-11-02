import { useEffect, useState } from "react";
import { advanceDemoQueue, initialDemoQueue, type DemoQueueState } from "../domain/demoQueue";

export function useDemoQueue(intervalMs = 5000): DemoQueueState {
  const [state, setState] = useState<DemoQueueState>(initialDemoQueue);

  useEffect(() => {
    const timer = setInterval(() => setState((current) => advanceDemoQueue(current)), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return state;
}
