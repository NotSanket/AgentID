import { Check, ChevronDown, Search } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function FormField({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="form-field">
      <div className="form-label-row"><label htmlFor={htmlFor}>{label}</label>{hint && <span>{hint}</span>}</div>
      {children}
      {error && <ValidationMessage>{error}</ValidationMessage>}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input className={cn("input", className)} ref={ref} {...props} />
));
TextInput.displayName = "TextInput";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea className={cn("input textarea", className)} ref={ref} {...props} />
));
Textarea.displayName = "Textarea";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="select-wrap"><select className={cn("input select", className)} {...props}>{children}</select><ChevronDown size={15} aria-hidden="true" /></span>;
}

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <span className={cn("search-input", className)}><Search size={16} aria-hidden="true" /><input ref={ref} type="search" {...props} /></span>
));
SearchInput.displayName = "SearchInput";

export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button className={cn("toggle", checked && "is-on")} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} disabled={disabled}>
      <span className="toggle-track"><span /></span><span>{label}</span>
    </button>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="checkbox"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true"><Check size={12} /></span>{label}</label>
  );
}

export function ValidationMessage({ children }: { children: ReactNode }) {
  return <p className="validation-message" role="alert">{children}</p>;
}
