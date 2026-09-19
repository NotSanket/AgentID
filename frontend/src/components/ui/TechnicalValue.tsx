import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn, truncateMiddle } from "../../lib/utils";

export function CopyButton({ value, label = "Copy value" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <button className="copy-button" type="button" onClick={copy} aria-label={copied ? "Copied" : label} title={copied ? "Copied" : label}>
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}

export function TechnicalValue({ value, label, className, truncate = true }: { value: string; label: string; className?: string; truncate?: boolean }) {
  return (
    <span className={cn("technical-value", className)} title={value} aria-label={`${label}: ${value}`}>
      <code>{truncate ? truncateMiddle(value) : value}</code>
      <CopyButton value={value} label={`Copy ${label}`} />
    </span>
  );
}

export const WalletAddress = ({ value }: { value: string }) => <TechnicalValue value={value} label="wallet address" />;
export const TransactionHash = ({ value }: { value: string }) => <TechnicalValue value={value} label="transaction hash" />;
export const AgentIdText = ({ value }: { value: string }) => <TechnicalValue value={value} label="Agent ID" truncate={false} />;
export const BlockNumber = ({ value }: { value: string | number }) => <TechnicalValue value={String(value)} label="block number" truncate={false} />;
