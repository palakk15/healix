import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { activeProfile } from "@core/store/session";
import { Link } from "react-router-dom";
import { Button } from "../base/Button";
import { Disclaimer } from "../base/Disclaimer";
import { resolvePosition } from "../../lib/geolocation";
import { sessionStore, useSession } from "../../store";
import { HoldToActivate } from "./HoldToActivate";

export type ShareState =
  | { status: "idle" }
  | { status: "sharing" }
  | { status: "sent"; hospital: string; etaMinutes: number; usedSaved: boolean }
  | { status: "failed" };

export interface EmergencyScreenProps {
  reasons: readonly string[];
  summary: string;
  disclaimer?: string;
  autoShare?: boolean;
  publicMode?: boolean;
}

export function EmergencyScreen({ reasons, summary, disclaimer, autoShare = false, publicMode = false }: EmergencyScreenProps) {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const profile = useSession((state) => activeProfile(state));
  const sharedName = profile?.name ?? "";
  const sharedAge = profile?.age ?? "";
  const [share, setShare] = useState<ShareState>({ status: "idle" });
  const autoStarted = useRef(false);

  const savedHome = user?.home;
  const nearest = useQuery({
    queryKey: ["nearest-emergency", publicMode, savedHome?.lat, savedHome?.lng],
    enabled: publicMode || Boolean(savedHome),
    queryFn: async () => {
      const position = await resolvePosition(savedHome);
      return backend.nearestEmergency(position.lat, position.lng);
    },
    retry: false,
  });

  const shareNow = useCallback(async () => {
    setShare({ status: "sharing" });
    try {
      const state = sessionStore.getState();
      const profile = activeProfile(state);
      const position = await resolvePosition(state.user?.home);
      const sent = await backend.emergency({
        lat: position.lat,
        lng: position.lng,
        profile_id: profile?.id ?? "",
        summary,
      });
      setShare({ status: "sent", hospital: sent.hospital.name, etaMinutes: sent.eta_minutes, usedSaved: position.source === "saved" });
    } catch {
      setShare({ status: "failed" });
    }
  }, [summary]);

  useEffect(() => {
    if (!autoShare || autoStarted.current) return;
    autoStarted.current = true;
    void shareNow();
  }, [autoShare, shareNow]);

  const hospital = nearest.data;

  useEffect(() => {
    const shells = [...document.querySelectorAll<HTMLElement>("[data-app-shell]")];
    for (const shell of shells) shell.setAttribute("inert", "");
    return () => {
      for (const shell of shells) shell.removeAttribute("inert");
    };
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="emergency-title" className="type-scale-mobile fixed inset-0 z-50 overflow-y-auto bg-bg" data-testid="emergency-screen">
      <main id="main" className="mx-auto flex min-h-full w-full max-w-[480px] flex-col gap-6 px-5 pb-10 pt-10">
        <h1 id="emergency-title" className="type-h2 !text-emergency-text">{t("emergency.title")}</h1>

        {reasons.length > 0 ? <p className="type-body text-ink">{t("emergency.why", { reason: reasons.join(", ") })}</p> : null}

        <div className="flex flex-col gap-3">
          <a
            href="tel:102"
            className="type-h3 flex min-h-[72px] items-center justify-center gap-3 rounded-pill bg-emergency-text px-6 text-white"
          >
            <Phone size={24} strokeWidth={1.75} aria-hidden="true" />
            {t("emergency.call102")}
          </a>
          <Button href="tel:112" variant="secondary" className="min-h-14">
            {t("emergency.call112")}
          </Button>
        </div>

        {hospital ? (
          <section className="rounded-card border border-line bg-surface p-5">
            <span className="type-label">{t("emergency.nearest")}</span>
            <p className="type-h3 mt-1 text-ink">{hospital.hospital.name}</p>
            <p className="type-small mt-1">
              {hospital.hospital.locality} · {t("emergency.away", { km: hospital.distance_km, minutes: hospital.eta_minutes })}
            </p>
          </section>
        ) : null}

        {publicMode && !hospital ? (
          <p role="status" className="type-small">{nearest.isError ? t("emergency.noLocation") : t("emergency.locating")}</p>
        ) : null}

        {publicMode ? (
          <section className="flex flex-col gap-3 rounded-card border border-emergency-border bg-surface p-5">
            <p className="type-small !text-ink">{t("emergency.publicNote")}</p>
            <Button to="/app/welcome" variant="secondary">{t("emergency.signIn")}</Button>
            <Link to="/" className="type-small underline">{t("emergency.back")}</Link>
          </section>
        ) : share.status === "sent" ? (
          <section role="status" className="rounded-card border border-emergency-border bg-emergency-fill p-5 text-emergency-text">
            <p className="type-h3 !text-emergency-text">{t("emergency.sent", { hospital: share.hospital })}</p>
            <p className="type-small mt-1 !text-emergency-text">{t("emergency.sentBody", { minutes: share.etaMinutes })}</p>
            {share.usedSaved ? <p className="type-small mt-2 !text-emergency-text">{t("emergency.usingSaved")}</p> : null}
          </section>
        ) : (
          <div>
            <section aria-labelledby="share-list-title" className="mb-4 rounded-card border border-emergency-border bg-surface px-5 py-4">
              <h2 id="share-list-title" className="type-label !text-emergency-text">{t("emergency.shareTitle")}</h2>
              <ul data-testid="share-list" className="type-small mt-2 flex list-disc flex-col gap-1 pl-5 !text-ink">
                <li>{t("emergency.shareName", { name: sharedName })}</li>
                <li>{t("emergency.shareAge", { age: sharedAge })}</li>
                <li>{t("emergency.shareReason", { reason: summary })}</li>
                <li>{t("emergency.shareLocation")}</li>
              </ul>
              <p className="type-small mt-2">{t("emergency.shareNothingElse")}</p>
            </section>
            <HoldToActivate
              variant="bar"
              label={share.status === "sharing" ? t("emergency.sharing") : t("emergency.holdToShare")}
              hint={t("emergency.holdHint")}
              holdingLabel={t("emergency.holding")}
              disabled={share.status === "sharing"}
              onActivate={() => void shareNow()}
            />
            {share.status === "failed" ? (
              <p role="alert" className="type-small mt-3 !text-emergency-text">
                {t("emergency.failed")}
              </p>
            ) : null}
          </div>
        )}

        <Disclaimer text={disclaimer} />
      </main>
    </div>,
    document.body,
  );
}
