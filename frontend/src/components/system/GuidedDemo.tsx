import { ArrowRight, Compass, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const steps = [
  ["Registry", "/app/registry", "Inspect real on-chain identities"],
  ["Communication", "/app/communication", "Send an authenticated demo request"],
  ["Security Lab", "/app/security", "Run one controlled security scenario"],
  ["Trust Graph", "/app/trust-graph", "See the resulting verified or blocked edge"],
  ["Explorer", "/app/explorer", "Inspect lifecycle transactions and gas"],
  ["Analytics", "/app/analytics", "Review persistent aggregate outcomes"],
] as const;

export function GuidedDemo() {
  const [open, setOpen] = useState(false); const location = useLocation();
  const active = Math.max(0, steps.findIndex(([, path]) => location.pathname.startsWith(path)));
  return <div className={`guided-demo ${open ? "is-open" : ""}`}>
    <button type="button" className="guided-demo-trigger" onClick={() => setOpen(!open)} aria-expanded={open}><Compass /> Guided demo</button>
    {open && <aside aria-label="Guided demo navigation"><header><div><small>PRESENTATION ASSISTANT</small><strong>AgentID trust flow</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Close guided demo"><X /></button></header><ol>{steps.map(([label, path, detail], index) => <li className={index === active ? "is-current" : ""} key={path}><span>{index + 1}</span><Link to={path} onClick={() => setOpen(false)}><strong>{label}</strong><small>{detail}</small></Link><ArrowRight /></li>)}</ol><p>Navigation only. Security scenarios run only after an explicit click.</p></aside>}
  </div>;
}
