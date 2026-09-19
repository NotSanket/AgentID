import { Activity, BarChart3, BookOpen, Bot, CircleGauge, GitBranch, KeyRound, MessagesSquare, SearchCode, Settings, ShieldAlert } from "lucide-react";

export const primaryNavigation = [
  { label: "Command Center", path: "/app", icon: CircleGauge, end: true },
  { label: "Registry", path: "/app/registry", icon: Bot },
  { label: "Register Agent", path: "/app/register", icon: KeyRound },
  { label: "Verification", path: "/app/verification", icon: Activity },
  { label: "Communication", path: "/app/communication", icon: MessagesSquare },
  { label: "Security Lab", path: "/app/security", icon: ShieldAlert },
  { label: "Trust Graph", path: "/app/trust-graph", icon: GitBranch },
  { label: "Explorer", path: "/app/explorer", icon: SearchCode },
  { label: "Analytics", path: "/app/analytics", icon: BarChart3 },
] as const;

export const secondaryNavigation = [
  { label: "Documentation", path: "/app/documentation", icon: BookOpen },
  { label: "Settings", path: "/app/settings", icon: Settings },
] as const;

export const allNavigation = [...primaryNavigation, ...secondaryNavigation];
