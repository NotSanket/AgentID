import { ArrowLeft, Construction, Layers3, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export function ModulePlaceholderPage({ module, stage }: { module: string; stage: string }) {
  return (
    <div className="module-placeholder page-stack">
      <div className="placeholder-grid" aria-hidden="true" />
      <span className="placeholder-icon"><Construction /></span>
      <p className="eyebrow"><Layers3 size={13} /> Intentional empty stage</p>
      <h2>{module}</h2>
      <p>The {module} module will be connected in {stage}. This foundation route is ready for real AgentID data and workflows—no sample blockchain records have been invented.</p>
      <div className="placeholder-seal"><ShieldCheck /><span><strong>Foundation ready</strong><small>Visual system · navigation · responsive shell</small></span></div>
      <Link className="button button-secondary" to="/app"><ArrowLeft size={16} /> Back to Command Center</Link>
    </div>
  );
}
