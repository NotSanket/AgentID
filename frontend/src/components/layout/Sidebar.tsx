import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { primaryNavigation, secondaryNavigation } from "../../app/navigation";
import { cn } from "../../lib/utils";
import { Logo } from "../brand/Logo";

export function Sidebar() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  return (
    <aside
      className={cn("sidebar", expanded && "is-expanded")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-expanded={expanded}
      aria-label="Primary navigation"
    >
      <div className="sidebar-head"><Logo compact={!expanded} to="/app" /><button className="sidebar-toggle" type="button" onClick={() => setPinned((value) => !value)} aria-label={pinned ? "Collapse sidebar" : "Expand sidebar"}>{pinned ? <ChevronsLeft /> : <ChevronsRight />}</button></div>
      <nav className="sidebar-nav">
        <NavGroup items={primaryNavigation} expanded={expanded} />
        <div className="sidebar-divider" />
        <NavGroup items={secondaryNavigation} expanded={expanded} />
      </nav>
      <div className="sidebar-foot"><span className="security-seal"><span>01</span>{expanded && <small>IDENTITY FIRST<br />TRUST VERIFIED</small>}</span></div>
    </aside>
  );
}

function NavGroup({ items, expanded }: { items: typeof primaryNavigation | typeof secondaryNavigation; expanded: boolean }) {
  return items.map((item) => {
    const Icon = item.icon;
    return (
      <NavLink key={item.path} to={item.path} end={"end" in item && item.end} className={({ isActive }) => cn("sidebar-link", isActive && "is-active")} title={expanded ? undefined : item.label}>
        {({ isActive }) => <>{isActive && <motion.span className="active-rail" layoutId="sidebar-active" />}<Icon aria-hidden="true" /><span>{item.label}</span></>}
      </NavLink>
    );
  });
}
