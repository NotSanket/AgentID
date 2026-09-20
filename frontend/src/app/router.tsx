import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { CommandCenterPage } from "../pages/CommandCenterPage";
import { LandingPage } from "../pages/LandingPage";
import { ModulePlaceholderPage } from "../pages/ModulePlaceholderPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { SettingsPage } from "../pages/SettingsPage";
import { RegisterAgentPage } from "../pages/RegisterAgentPage";
import { RegistryPage } from "../pages/RegistryPage";
import { AgentPassportPage } from "../pages/AgentPassportPage";
import { VerificationPage } from "../pages/VerificationPage";
import { CommunicationPage } from "../pages/CommunicationPage";
import { CardSkeleton } from "../components/ui/Feedback";

const TrustGraphPage = lazy(() => import("../pages/TrustGraphPage").then((module) => ({ default: module.TrustGraphPage })));
const SecurityLabPage = lazy(() => import("../pages/SecurityLabPage").then((module) => ({ default: module.SecurityLabPage })));
const ExplorerPage = lazy(() => import("../pages/ExplorerPage").then((module) => ({ default: module.ExplorerPage })));
const AnalyticsPage = lazy(() => import("../pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const deferred = (Page: ComponentType) => <Suspense fallback={<div className="page-stack"><CardSkeleton /></div>}><Page /></Suspense>;

export const routes: RouteObject[] = [
  { path: "/", element: <LandingPage /> },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, element: <CommandCenterPage /> },
      { path: "registry", element: <RegistryPage /> },
      { path: "registry/:agentId", element: <AgentPassportPage /> },
      { path: "register", element: <RegisterAgentPage /> },
      { path: "verification", element: <VerificationPage /> },
      { path: "communication", element: <CommunicationPage /> },
      { path: "security", element: deferred(SecurityLabPage) },
      { path: "trust-graph", element: deferred(TrustGraphPage) },
      { path: "explorer", element: deferred(ExplorerPage) },
      { path: "analytics", element: deferred(AnalyticsPage) },
      { path: "documentation", element: <ModulePlaceholderPage module="Documentation" stage="Stage 5" /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "home", element: <Navigate to="/app" replace /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
