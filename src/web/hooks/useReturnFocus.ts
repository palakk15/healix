import { useCallback, useLayoutEffect, useRef } from "react";

export function useReturnFocus(open: boolean): (event: Event) => void {
  const origin = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  return useCallback((event: Event) => {
    const target = origin.current;
    origin.current = null;
    if (target && target.isConnected) {
      event.preventDefault();
      target.focus();
    }
  }, []);
}
