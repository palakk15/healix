import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { Button } from "../base/Button";

export interface ConsentNoticeProps {
  open: boolean;
  noticeKey: "voice.noticeSpeech" | "voice.noticeListen";
  onAllow: () => void;
  onCancel: () => void;
  align?: "left" | "right";
  children: ReactNode;
}

export function ConsentNotice({ open, noticeKey, onAllow, onCancel, align = "right", children }: ConsentNoticeProps) {
  const { t } = useTranslation();
  const container = useRef<HTMLSpanElement>(null);
  const allowButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    allowButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
    };
  }, [onCancel, open]);

  return (
    <span ref={container} className="relative inline-flex">
      {children}
      {open ? (
        <div
          role="dialog"
          aria-label={t(noticeKey)}
          className={cn(
            "absolute top-full z-50 mt-3 w-[min(320px,calc(100vw-40px))] rounded-card border border-line bg-surface p-5 text-left shadow-card",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <p className="type-small text-ink">{t(noticeKey)}</p>
          <div className="mt-4 flex gap-2">
            <Button ref={allowButton as React.Ref<HTMLElement>} size="sm" onClick={onAllow}>
              {t("voice.allow")}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
