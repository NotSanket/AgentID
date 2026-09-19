import { ArrowLeft, ScanSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";

export function NotFoundPage() {
  return <main className="not-found-page"><Logo /><div><span className="error-code">404</span><ScanSearch /><p className="eyebrow">Identity route not found</p><h1>This path has no registered destination.</h1><p>Return to the AgentID console and continue from a verified route.</p><Link className="button button-primary" to="/app"><ArrowLeft /> Open Command Center</Link></div></main>;
}
