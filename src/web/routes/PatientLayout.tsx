import { Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasAnyConsent } from "@core/store/session";
import { DataProviders } from "../components/layout/DataProviders";
import { IncomingSwapSheet } from "../components/care/IncomingSwapSheet";
import { ActiveProfileBar } from "../components/profile/ActiveProfileBar";
import { PageFallback } from "../components/layout/PageFallback";
import { SkipLink } from "../components/layout/SkipLink";
import { TabBar } from "../components/layout/TabBar";
import { useSession } from "../store";

const welcomePath = "/app/welcome";

export default function PatientLayout() {
  const location = useLocation();
  const role = useSession((state) => state.role);
  const consents = useSession((state) => state.consents);

  const onWelcome = location.pathname.startsWith(welcomePath);
  const canEnter = role === "patient" && hasAnyConsent(consents);

  if (!onWelcome && !canEnter) {
    return <Navigate to={welcomePath} replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <DataProviders>
      <div data-app-shell className="type-scale-mobile min-h-screen bg-bg">
        <SkipLink />
        <div className="mx-auto min-h-screen w-full max-w-[480px] border-x border-line bg-bg pb-[88px] md:shadow-card">
          {onWelcome ? null : <ActiveProfileBar />}
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
          {onWelcome ? null : <TabBar />}
          {onWelcome ? null : <IncomingSwapSheet />}
        </div>
      </div>
    </DataProviders>
  );
}
