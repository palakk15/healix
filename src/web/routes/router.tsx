import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import type { MessageGroup } from "@core/i18n";
import { NotFound, RouteError } from "../components/layout/NotFound";
import { loadGroups } from "../i18n";
import { MarketingLayout } from "./MarketingLayout";
import { PageFallback } from "../components/layout/PageFallback";

function lazyWithMessages(groups: readonly MessageGroup[], load: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    const [module] = await Promise.all([load(), loadGroups(groups)]);
    return module;
  });
}

const PatientLayout = lazyWithMessages(["app"], () => import("./PatientLayout"));
const HospitalLayout = lazyWithMessages(["hospital", "app"], () => import("./HospitalLayout"));
const Landing = lazyWithMessages(["landing"], () => import("./marketing/Landing"));
const PublicEmergency = lazyWithMessages(["app"], () => import("./PublicEmergency"));
const Styleguide = lazyWithMessages(["styleguide", "landing"], () => import("./styleguide/Styleguide"));

const Welcome = lazy(() => import("./patient/Welcome"));
const Home = lazy(() => import("./patient/Home"));
const Triage = lazy(() => import("./patient/Triage"));
const Doctors = lazy(() => import("./patient/Doctors"));
const DoctorBooking = lazy(() => import("./patient/DoctorBooking"));
const Token = lazy(() => import("./patient/Token"));
const Reports = lazy(() => import("./patient/Reports"));
const ReportUpload = lazy(() => import("./patient/ReportUpload"));
const ReportReview = lazy(() => import("./patient/ReportReview"));
const ReportExplain = lazy(() => import("./patient/ReportExplain"));
const Assistant = lazy(() => import("./patient/Assistant"));
const Community = lazy(() => import("./patient/Community"));
const CommunityPost = lazy(() => import("./patient/CommunityPost"));
const Emergency = lazy(() => import("./patient/Emergency"));
const Settings = lazy(() => import("./patient/Settings"));

const StaffLogin = lazyWithMessages(["hospital", "app"], () => import("./hospital/StaffLogin"));
const Overview = lazy(() => import("./hospital/Overview"));
const LiveQueues = lazy(() => import("./hospital/LiveQueues"));
const Analytics = lazy(() => import("./hospital/Analytics"));
const BookingModes = lazy(() => import("./hospital/BookingModes"));
const Simulator = lazy(() => import("./hospital/Simulator"));
const PreAlerts = lazy(() => import("./hospital/PreAlerts"));

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Landing /> },
      { path: "styleguide", element: <Styleguide /> },
    ],
  },
  {
    path: "app",
    element: (
      <Suspense fallback={<PageFallback />}>
        <PatientLayout />
      </Suspense>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: "welcome", element: <Welcome /> },
      { path: "triage", element: <Triage /> },
      { path: "doctors", element: <Doctors /> },
      { path: "doctors/:id", element: <DoctorBooking /> },
      { path: "token/:id", element: <Token /> },
      { path: "reports", element: <Reports /> },
      { path: "reports/upload", element: <ReportUpload /> },
      { path: "reports/:id/review", element: <ReportReview /> },
      { path: "reports/:id", element: <ReportExplain /> },
      { path: "assistant", element: <Assistant /> },
      { path: "community", element: <Community /> },
      { path: "community/:id", element: <CommunityPost /> },
      { path: "emergency", element: <Emergency /> },
      { path: "settings", element: <Settings /> },
      { path: "*", element: <Navigate to="/app" replace /> },
    ],
  },
  {
    path: "emergency",
    element: (
      <Suspense fallback={<PageFallback />}>
        <PublicEmergency />
      </Suspense>
    ),
    errorElement: <RouteError />,
  },
  {
    path: "hospital/login",
    element: (
      <Suspense fallback={<PageFallback />}>
        <StaffLogin />
      </Suspense>
    ),
    errorElement: <RouteError />,
  },
  {
    path: "hospital",
    element: (
      <Suspense fallback={<PageFallback />}>
        <HospitalLayout />
      </Suspense>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Overview /> },
      { path: "queues", element: <LiveQueues /> },
      { path: "analytics", element: <Analytics /> },
      { path: "booking-modes", element: <BookingModes /> },
      { path: "simulator", element: <Simulator /> },
      { path: "alerts", element: <PreAlerts /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
