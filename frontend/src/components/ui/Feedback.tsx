import { Database, RadioTower, SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function CardSkeleton() {
  return <div className="panel skeleton-card" aria-label="Loading"><Skeleton className="skeleton-icon" /><div><Skeleton className="skeleton-line wide" /><Skeleton className="skeleton-line" /></div></div>;
}

const emptyIcons: Record<string, LucideIcon> = { agents: SearchX, activity: Database, network: RadioTower };
export function EmptyState({ title, description, kind = "activity", action, onAction }: { title: string; description: string; kind?: "agents" | "activity" | "network"; action?: string; onAction?: () => void }) {
  const Icon = emptyIcons[kind];
  return <div className="empty-state"><span className="empty-icon"><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p>{action && onAction && <Button variant="secondary" onClick={onAction}>{action}</Button>}</div>;
}

export function ComponentSlot({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return <section className="panel component-slot"><header><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></header>{children}</section>;
}
