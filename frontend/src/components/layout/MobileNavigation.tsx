import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { primaryNavigation, secondaryNavigation } from "../../app/navigation";
import { Logo } from "../brand/Logo";

export function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && <motion.div className="mobile-nav-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <motion.aside className="mobile-nav" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.24 }} aria-label="Mobile navigation">
          <header><Logo to="/app" /><button type="button" onClick={onClose} aria-label="Close navigation"><X /></button></header>
          <nav>{[...primaryNavigation, ...secondaryNavigation].map((item) => { const Icon = item.icon; return <NavLink key={item.path} to={item.path} end={"end" in item && item.end} onClick={onClose}><Icon />{item.label}</NavLink>; })}</nav>
        </motion.aside>
      </motion.div>}
    </AnimatePresence>
  );
}
