import { MonitorCog, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { ComponentSlot } from "../components/ui/Feedback";
import { Toggle } from "../components/ui/FormControls";

export function SettingsPage() {
  const [compact, setCompact] = useState(false);
  const [notifications, setNotifications] = useState(true);
  return <div className="page-stack settings-page"><header className="page-heading"><p className="eyebrow"><SlidersHorizontal size={13} /> Local interface preferences</p><h2>Settings</h2><p>Stage 4 preferences are device-local and do not modify blockchain or backend state.</p></header><div className="settings-grid"><ComponentSlot eyebrow="Display" title="Console behavior"><div className="setting-row"><span><MonitorCog /><span><strong>Compact information density</strong><small>Prepare denser layouts for future data modules.</small></span></span><Toggle checked={compact} onChange={setCompact} label="Compact mode" /></div><div className="setting-row"><span><MonitorCog /><span><strong>Interface notifications</strong><small>Allow reusable in-app status messages.</small></span></span><Toggle checked={notifications} onChange={setNotifications} label="Notifications" /></div></ComponentSlot></div></div>;
}
