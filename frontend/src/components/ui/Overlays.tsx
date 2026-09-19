import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

function FocusedOverlay({ open, onClose, titleId, className, children }: { open: boolean; onClose: () => void; titleId: string; className: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((item) => !item.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("overlay-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("overlay-open");
      previous?.focus();
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <motion.div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={className} initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.99 }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const id = "modal-title";
  return <FocusedOverlay open={open} onClose={onClose} titleId={id} className="modal"><header><h2 id={id}>{title}</h2><button type="button" onClick={onClose} aria-label="Close modal"><X size={18} /></button></header><div className="modal-body">{children}</div></FocusedOverlay>;
}

export function ConfirmationDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm" }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string }) {
  return <Modal open={open} onClose={onClose} title={title}><p className="dialog-description">{description}</p><div className="dialog-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></div></Modal>;
}

export function SideDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const id = "drawer-title";
  return <FocusedOverlay open={open} onClose={onClose} titleId={id} className="side-drawer"><header><h2 id={id}>{title}</h2><button type="button" onClick={onClose} aria-label="Close drawer"><X size={18} /></button></header><div className="drawer-body">{children}</div></FocusedOverlay>;
}
