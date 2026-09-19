import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { primaryNavigation } from "../../app/navigation";

const commands = primaryNavigation.map((item) => ({ ...item, command: item.label === "Command Center" ? "Go to Command Center" : item.label === "Registry" ? "Open Registry" : item.label === "Register Agent" ? "Register Agent" : `Open ${item.label}` }));

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const filtered = useMemo(() => commands.filter((item) => `${item.command} ${item.label}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);

  const run = (path: string) => { navigate(path); onClose(); };

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery(""); setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => previousFocusRef.current?.focus();
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  return (
    <AnimatePresence>
      {open && <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <motion.div ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" initial={{ opacity: 0, y: -10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.99 }} onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab" && dialogRef.current) {
            const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute("disabled"));
            const first = focusable[0];
            const last = focusable.at(-1);
            if (first && last && event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            if (first && last && !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
          if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); run(filtered[activeIndex].path); }
        }}>
          <div className="command-search"><Search aria-hidden="true" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search routes and actions…" aria-label="Search commands" /><button type="button" onClick={onClose} aria-label="Close command palette"><X /></button></div>
          <div className="command-results" role="listbox" aria-label="Commands">
            {filtered.length ? filtered.map((item, index) => { const Icon = item.icon; return <button key={item.path} className={index === activeIndex ? "is-active" : ""} type="button" role="option" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => run(item.path)}><span><Icon /><span><strong>{item.command}</strong><small>{item.path}</small></span></span>{index === activeIndex && <CornerDownLeft size={15} />}</button>; }) : <div className="command-empty">No matching console command.</div>}
          </div>
          <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></footer>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  );
}
