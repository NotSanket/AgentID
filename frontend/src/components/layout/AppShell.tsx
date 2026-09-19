import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { pageTransition } from "../../lib/motion";
import { EmptyState } from "../ui/Feedback";
import { SideDrawer } from "../ui/Overlays";
import { CommandPalette } from "../system/CommandPalette";
import { HealthProvider } from "../system/HealthProvider";
import { GlobalStatusBar } from "./GlobalStatusBar";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";
import { TopNavbar } from "./TopNavbar";
import { IdentitySessionProvider } from "../identity/IdentitySessionProvider";

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <HealthProvider>
      <IdentitySessionProvider>
      <div className="app-shell">
        <div className="ambient-grid" aria-hidden="true" />
        <Sidebar />
        <TopNavbar onOpenPalette={() => setPaletteOpen(true)} onOpenNotifications={() => setNotificationsOpen(true)} onOpenMobile={() => setMobileOpen(true)} />
        <main className="app-main" id="main-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} variants={reduceMotion ? undefined : pageTransition} initial="hidden" animate="visible" exit="exit"><Outlet /></motion.div>
          </AnimatePresence>
        </main>
        <GlobalStatusBar />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <SideDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications"><EmptyState title="No notifications yet" description="Identity, verification, and network events will appear here when their modules are connected." kind="activity" /></SideDrawer>
        <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </div>
      </IdentitySessionProvider>
    </HealthProvider>
  );
}
