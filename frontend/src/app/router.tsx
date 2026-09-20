import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { CardSkeleton } from "../components/ui/Feedback";

const AppShell = lazy(() => import("../components/layout/AppShell").then((module) => ({ default: module.AppShell })));
const CommandCenterPage = lazy(() => import("../pages/CommandCenterPage").then((module) => ({ default: module.CommandCenterPage })));
const RegisterAgentPage = lazy(() => import("../pages/RegisterAgentPage").then((module) => ({ default: module.RegisterAgentPage })));
const RegistryPage = lazy(() => import("../pages/RegistryPage").then((module) => ({ default: module.RegistryPage })));
const AgentPassportPage = lazy(() => import("../pages/AgentPassportPage").then((module) => ({ default: module.AgentPassportPage })));
const VerificationPage = lazy(() => import("../pages/VerificationPage").then((module) => ({ default: module.VerificationPage })));
const CommunicationPage = lazy(() => import("../pages/CommunicationPage").then((module) => ({ default: module.CommunicationPage })));
const TrustGraphPage = lazy(() => import("../pages/TrustGraphPage").then((module) => ({ default: module.TrustGraphPage })));
const SecurityLabPage = lazy(() => import("../pages/SecurityLabPage").then((module) => ({ default: module.SecurityLabPage })));
const ExplorerPage = lazy(() => import("../pages/ExplorerPage").then((module) => ({ default: module.ExplorerPage })));
const AnalyticsPage = lazy(() => import("../pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ModulePlaceholderPage = lazy(() => import("../pages/ModulePlaceholderPage").then((module) => ({ default: module.ModulePlaceholderPage })));
const deferred = (Page: ComponentType) => <Suspense fallback={<div className="page-stack"><CardSkeleton /></div>}><Page /></Suspense>;

export const routes: RouteObject[] = [
  { path: "/", element: <LandingPage /> },
  {
    path: "/app",
    element: deferred(AppShell),
    children: [
      { index: true, element: deferred(CommandCenterPage) },
      { path: "registry", element: deferred(RegistryPage) },
      { path: "registry/:agentId", element: deferred(AgentPassportPage) },
      { path: "register", element: deferred(RegisterAgentPage) },
      { path: "verification", element: deferred(VerificationPage) },
      { path: "communication", element: deferred(CommunicationPage) },
      { path: "security", element: deferred(SecurityLabPage) },
      { path: "trust-graph", element: deferred(TrustGraphPage) },
      { path: "explorer", element: deferred(ExplorerPage) },
      { path: "analytics", element: deferred(AnalyticsPage) },
      { path: "documentation", element: <Suspense fallback={<div className="page-stack"><CardSkeleton /></div>}><ModulePlaceholderPage module="Documentation" stage="Stage 9" /></Suspense> },
      { path: "settings", element: deferred(SettingsPage) },
      { path: "home", element: <Navigate to="/app" replace /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
