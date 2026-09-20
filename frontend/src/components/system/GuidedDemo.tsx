import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const steps = [
  ["Command Center", "/app", "Confirm system health and local demo readiness."],
  ["Registry", "/app/registry", "Inspect identities read from the real AgentRegistry."],
  ["Agent Passport", "/app/registry/AGT-TRAVEL-001", "Review TravelAI ownership, lifecycle, and evidence."],
  ["Communication", "/app/communication", "Send an explicitly authenticated demo request."],
  ["Security Lab", "/app/security", "Run one controlled scenario only when you choose."],
  ["Trust Graph", "/app/trust-graph", "See observed verified and blocked relationships."],
  ["Explorer", "/app/explorer", "Inspect real blocks, events, receipts, and gas."],
  ["Analytics", "/app/analytics", "Review metrics calculated from persisted records."],
] as const;

function locationStep(pathname: string) {
  const exact = steps.findIndex(([, path]) => pathname === path);
  if (exact >= 0) return exact;
  return Math.max(0, steps.findIndex(([, path]) => path !== "/app" && pathname.startsWith(path)));
}

export function GuidedDemo() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(() => locationStep(location.pathname));
  useEffect(() => setCurrent(locationStep(location.pathname)), [location.pathname]);

  const go = (index: number) => {
    const bounded = Math.max(0, Math.min(steps.length - 1, index));
    setCurrent(bounded);
    navigate(steps[bounded][1]);
  };

  return <div className={`guided-demo ${open ? "is-open" : ""}`}>
    <button type="button" className="guided-demo-trigger" onClick={() => setOpen(!open)} aria-expanded={open}><Compass /> Guided demo</button>
    {open && <aside aria-label="Guided demo navigation"><header><div><small>PRESENTATION ASSISTANT</small><strong>AgentID trust flow</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Exit guided demo"><X /></button></header><ol>{steps.map(([label, path, detail], index) => <li className={index === current ? "is-current" : ""} key={label}><span>{index + 1}</span><Link to={path} aria-current={index === current ? "step" : undefined} onClick={() => setCurrent(index)}><strong>{label}</strong><small>{detail}</small></Link><ArrowRight /></li>)}</ol><p>Navigation and explanation only. No transaction or security scenario runs automatically.</p><footer className="guided-demo-actions"><button type="button" onClick={() => go(current - 1)} disabled={current === 0}><ArrowLeft /> Previous</button><button type="button" onClick={() => go(current + 1)} disabled={current === steps.length - 1}>Next <ArrowRight /></button><button type="button" onClick={() => setOpen(false)}>Exit Demo</button></footer></aside>}
  </div>;
}
