import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useReturnFocus } from "../../hooks/useReturnFocus";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid="sheet"
          onCloseAutoFocus={returnFocus}
          className="type-scale-mobile fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] rounded-t-panel border border-b-0 border-line bg-bg px-5 pb-8 pt-6 shadow-card"
        >
          <Dialog.Title className="type-h3">{title}</Dialog.Title>
          <Dialog.Description className="type-body mt-2">{description}</Dialog.Description>
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
