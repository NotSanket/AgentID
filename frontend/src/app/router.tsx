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
      { path: "security", element: <ModulePlaceholderPage module="Security Lab" stage="Stage 7" /> },
      { path: "trust-graph", element: <ModulePlaceholderPage module="Trust Graph" stage="Stage 7" /> },
      { path: "explorer", element: <ModulePlaceholderPage module="Explorer" stage="Stage 7" /> },
      { path: "analytics", element: <ModulePlaceholderPage module="Analytics" stage="Stage 7" /> },
      { path: "documentation", element: <ModulePlaceholderPage module="Documentation" stage="Stage 5" /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "home", element: <Navigate to="/app" replace /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
