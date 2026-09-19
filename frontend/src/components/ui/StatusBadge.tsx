import { CircleDotDashed, ShieldCheck, ShieldX, Signal, SignalZero, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type StatusTone = "verified" | "active" | "revoked" | "blocked" | "pending" | "offline";
const icons: Record<StatusTone, LucideIcon> = {
  verified: ShieldCheck,
  active: Signal,
  revoked: ShieldX,
  blocked: ShieldX,
  pending: CircleDotDashed,
  offline: SignalZero,
};

export function StatusBadge({ tone, label, className }: { tone: StatusTone; label?: string; className?: string }) {
  const Icon = icons[tone];
  return (
    <span className={cn("status-badge", `status-${tone}`, className)}>
      <Icon className={tone === "pending" ? "spin-slow" : undefined} size={13} aria-hidden="true" />
      {label ?? tone.toUpperCase()}
    </span>
  );
}

export const VerifiedBadge = () => <StatusBadge tone="verified" />;
export const ActiveBadge = () => <StatusBadge tone="active" />;
export const RevokedBadge = () => <StatusBadge tone="revoked" />;
export const BlockedBadge = () => <StatusBadge tone="blocked" />;
export const PendingBadge = () => <StatusBadge tone="pending" />;
export const OfflineBadge = () => <StatusBadge tone="offline" />;
