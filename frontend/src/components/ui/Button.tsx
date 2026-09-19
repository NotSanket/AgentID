import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "technical";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
}

export function Button({ variant = "primary", loading = false, icon: Icon, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn("button", `button-${variant}`, className)} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
