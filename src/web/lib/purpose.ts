import type { TFunction } from "i18next";

export function purposeLabel(t: TFunction, purpose: string): string {
  return t(`doctors.form.purposes.${purpose}`, { defaultValue: purpose });
}
