import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../base/Button";
import { LanguageSelect } from "../base/LanguageSelect";
import { Logo } from "../base/Logo";

export interface MobileMenuLink {
  href: string;
  labelKey: string;
}

export function MobileMenu({ links }: { links: readonly MobileMenuLink[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={t("nav.openMenu")}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink lg:hidden"
        >
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-0 z-50 rounded-b-panel border-b border-line bg-bg px-5 pb-8 pt-4 shadow-card"
        >
          <Dialog.Title className="sr-only">{t("nav.menu")}</Dialog.Title>
          <div className="flex h-12 items-center justify-between">
            <Logo name={t("brand.name")} />
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t("nav.closeMenu")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
              >
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <nav aria-label={t("nav.primary")} className="mt-4">
            <ul className="divide-y divide-line border-y border-line">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="type-h3 flex min-h-14 items-center text-ink"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <LanguageSelect className="w-full [&_select]:w-full" />
            <Button to="/app/welcome" onClick={() => setOpen(false)}>
              {t("nav.tryDemo")}
            </Button>
            <Button to="/app/welcome" variant="secondary" onClick={() => setOpen(false)}>
              {t("nav.signIn")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
