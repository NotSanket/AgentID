import { Bell, Command, Menu, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { allNavigation } from "../../app/navigation";
import { NetworkStatus } from "../system/NetworkStatus";

export function TopNavbar({ onOpenPalette, onOpenNotifications, onOpenMobile }: { onOpenPalette: () => void; onOpenNotifications: () => void; onOpenMobile: () => void }) {
  const location = useLocation();
  const current = allNavigation.find((item) => item.path === location.pathname)?.label ?? "Command Center";
  return (
    <header className="top-navbar">
      <button className="mobile-menu-trigger" type="button" onClick={onOpenMobile} aria-label="Open navigation"><Menu /></button>
      <div className="page-context"><p>AgentID Console <span>/</span></p><h1>{current}</h1></div>
      <div className="navbar-actions">
        <button className="command-trigger" type="button" onClick={onOpenPalette} aria-label="Open command palette"><Search size={16} /><span>Search console</span><kbd><Command size={11} /> K</kbd></button>
        <NetworkStatus />
        <button className="icon-button" type="button" onClick={onOpenNotifications} aria-label="Open notifications"><Bell /><span className="notification-dot" /></button>
        <button className="profile-button" type="button" aria-label="Demo operator profile"><span>DO</span><span className="profile-copy"><strong>Demo Operator</strong><small>Local workspace</small></span></button>
      </div>
    </header>
  );
}
