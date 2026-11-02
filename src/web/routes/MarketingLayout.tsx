import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { PageFallback } from "../components/layout/PageFallback";
import { SkipLink } from "../components/layout/SkipLink";

export function MarketingLayout() {
  return (
    <>
      <SkipLink />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  );
}
