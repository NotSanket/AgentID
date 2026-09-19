import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Blocks, Bot, Braces, Check, ChevronRight, Database, Fingerprint, KeyRound, Link2, LockKeyhole, Network, RadioTower, RefreshCw, ScanSearch, ShieldCheck, Signature } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";
import { fadeUp, staggerChildren } from "../lib/motion";

const workflow = [
  { step: "01", title: "Register", text: "Bind a readable AgentID to its controlling wallet.", icon: Fingerprint },
  { step: "02", title: "Sign", text: "Authorize the complete request with EIP-712.", icon: Signature },
  { step: "03", title: "Verify", text: "Recover the signer and check current registry state.", icon: ScanSearch },
  { step: "04", title: "Communicate", text: "Route only after every identity check succeeds.", icon: RadioTower },
];

const security = [
  { title: "Wallet-bound identity", text: "The AgentID and controlling wallet are inseparable on-chain.", icon: KeyRound },
  { title: "Typed signatures", text: "EIP-712 binds sender, receiver, payload, timestamp, and nonce.", icon: Signature },
  { title: "Replay protection", text: "Accepted nonces are consumed atomically and cannot be reused.", icon: RefreshCw },
  { title: "Lifecycle enforcement", text: "Revoked identities are blocked before communication begins.", icon: LockKeyhole },
];

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="landing-page">
      <div className="landing-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <header className="landing-nav"><Logo /><nav aria-label="Landing navigation"><a href="#how-it-works">How it works</a><a href="#security">Security</a><a href="#architecture">Architecture</a></nav><Link className="button button-secondary" to="/app">Launch Console <ArrowRight size={15} /></Link></header>

      <main>
        <section className="hero-section">
          <motion.div className="hero-copy" variants={reduceMotion ? undefined : staggerChildren} initial="hidden" animate="visible">
            <motion.div variants={reduceMotion ? undefined : fadeUp} className="hero-kicker"><span><ShieldCheck size={14} /></span>IDENTITY INFRASTRUCTURE FOR AUTONOMOUS AGENTS</motion.div>
            <motion.h1 aria-label="Every AI Agent Needs an Identity." variants={reduceMotion ? undefined : fadeUp}>Every AI Agent<br />Needs an <em>Identity.</em></motion.h1>
            <motion.p variants={reduceMotion ? undefined : fadeUp}>AgentID gives autonomous AI agents cryptographically verifiable identities before they communicate.</motion.p>
            <motion.div variants={reduceMotion ? undefined : fadeUp} className="hero-actions"><Link className="button button-primary button-large" to="/app">Launch AgentID Console <ArrowRight size={17} /></Link><a className="button button-ghost button-large" href="#architecture">Explore Architecture <ChevronRight size={17} /></a></motion.div>
            <motion.div variants={reduceMotion ? undefined : fadeUp} className="hero-proof"><span><Check /> Wallet-bound</span><span><Check /> EIP-712 verified</span><span><Check /> Replay protected</span></motion.div>
          </motion.div>
          <motion.div className="identity-network" initial={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} aria-label="Conceptual AI agent identity network">
            <div className="network-label"><span>CONCEPTUAL IDENTITY NETWORK</span><small>Illustrative · not live activity</small></div>
            <div className="network-core"><span className="core-rings" /><Fingerprint /><strong>AgentID</strong><small>TRUST LAYER</small></div>
            <Connection className="line-one" /><Connection className="line-two" /><Connection className="line-three" /><Connection className="line-four" />
            <AgentNode className="node-travel" label="TravelAI" id="AGT-TRAVEL" icon="✦" />
            <AgentNode className="node-hotel" label="HotelAI" id="AGT-HOTEL" icon="H" />
            <AgentNode className="node-payment" label="PaymentAI" id="AGT-PAYMENT" icon="P" />
            <AgentNode className="node-health" label="HealthAI" id="CONCEPT NODE" icon="+" conceptual />
            <div className="verification-signal"><ShieldCheck /><span><strong>IDENTITY CHECK</strong><small>SIGNATURE VERIFIED</small></span></div>
          </motion.div>
        </section>

        <section className="trust-strip" aria-label="AgentID principles"><span>ON-CHAIN IDENTITY</span><i /><span>OFF-CHAIN AUTHENTICATION</span><i /><span>DETERMINISTIC TRUST</span><i /><span>FAIL-CLOSED SECURITY</span></section>

        <section className="landing-section split-section">
          <div><p className="section-index">01 / THE PROBLEM</p><p className="eyebrow">Why agent identity matters</p><h2>Agents are becoming actors.<br /><em>Trust cannot be assumed.</em></h2></div>
          <div className="statement-panel"><p>Any system can claim to be <code>TravelAI</code>. AgentID turns that label into a verifiable relationship between an identity, a wallet, and its current lifecycle state.</p><div className="claim-compare"><span className="claim-bad"><small>UNVERIFIED CLAIM</small>“I am TravelAI” <b>?</b></span><ArrowRight /><span className="claim-good"><small>CRYPTOGRAPHIC PROOF</small>Wallet + AgentID <ShieldCheck /></span></div></div>
        </section>

        <section className="landing-section" id="how-it-works">
          <div className="section-heading"><p className="section-index">02 / PROTOCOL FLOW</p><p className="eyebrow">How AgentID works</p><h2>Identity before <em>interaction.</em></h2><p>A compact trust pipeline that verifies who is speaking before a receiver ever runs.</p></div>
          <div className="workflow-grid">{workflow.map((item, index) => { const Icon = item.icon; return <article key={item.title} className="workflow-card"><span className="workflow-number">{item.step}</span><span className="workflow-icon"><Icon /></span><h3>{item.title}</h3><p>{item.text}</p>{index < workflow.length - 1 && <ChevronRight className="workflow-arrow" />}</article>; })}</div>
        </section>

        <section className="landing-section lifecycle-section">
          <div className="section-heading compact"><p className="section-index">03 / LIFECYCLE</p><p className="eyebrow">Identity state is explicit</p><h2>Issued once. <em>Verified continuously.</em></h2></div>
          <div className="lifecycle-track"><span className="life-step is-primary"><i>1</i><strong>ISSUE</strong><small>Wallet registered</small></span><b /><span className="life-step is-success"><i>2</i><strong>VERIFY</strong><small>Signer recovered</small></span><b /><span className="life-step"><i>3</i><strong>UPDATE</strong><small>Metadata refreshed</small></span><b /><span className="life-step is-danger"><i>4</i><strong>REVOKE</strong><small>Access blocked</small></span></div>
        </section>

        <section className="landing-section security-section" id="security">
          <div className="security-visual"><div className="security-orbit"><span /><span /><span /><ShieldCheck /></div><p>REQUEST TRUST BOUNDARY</p><small>Communication begins only after verification</small></div>
          <div><p className="section-index">04 / SECURITY MODEL</p><p className="eyebrow">Designed to fail closed</p><h2>Proof at every <em>boundary.</em></h2><div className="security-list">{security.map((item) => { const Icon = item.icon; return <article key={item.title}><span><Icon /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>; })}</div></div>
        </section>

        <section className="landing-section architecture-section" id="architecture">
          <div className="section-heading"><p className="section-index">05 / ARCHITECTURE</p><p className="eyebrow">Purpose-built layers</p><h2>On-chain authority.<br /><em>Off-chain velocity.</em></h2></div>
          <div className="architecture-map">
            <ArchitectureNode icon={Blocks} label="Ethereum" detail="Identity authority" />
            <span className="architecture-link"><Link2 /></span>
            <ArchitectureNode icon={Braces} label="AgentID API" detail="Authentication layer" primary />
            <span className="architecture-link split"><Link2 /></span>
            <ArchitectureNode icon={Database} label="Supabase" detail="Persistent events" />
            <ArchitectureNode icon={Network} label="Agent Network" detail="Verified communication" />
          </div>
        </section>

        <section className="landing-cta"><div className="cta-grid" aria-hidden="true" /><span className="cta-icon"><Bot /></span><p className="eyebrow">THE TRUST LAYER IS READY</p><h2>Give every agent an identity<br />before it gets a voice.</h2><p>Enter the AgentID console and explore the foundation for verifiable agent-to-agent communication.</p><Link className="button button-primary button-large" to="/app">Launch AgentID Console <ArrowRight /></Link></section>
      </main>
      <footer className="landing-footer"><Logo /><p>Verifiable identity infrastructure for autonomous AI agents.</p><span>STAGE 4 · VISUAL FOUNDATION</span></footer>
    </div>
  );
}

function AgentNode({ className, label, id, icon, conceptual = false }: { className: string; label: string; id: string; icon: string; conceptual?: boolean }) {
  return <div className={`agent-node ${className}`}><span className="node-avatar">{icon}</span><div><strong>{label}</strong><small>{id}</small></div><i className={conceptual ? "node-neutral" : "node-ok"}>{conceptual ? "CONCEPT" : "✓"}</i></div>;
}
function Connection({ className }: { className: string }) { return <span className={`network-line ${className}`}><i /></span>; }
function ArchitectureNode({ icon: Icon, label, detail, primary = false }: { icon: typeof Blocks; label: string; detail: string; primary?: boolean }) { return <article className={primary ? "is-primary" : ""}><span><Icon /></span><strong>{label}</strong><small>{detail}</small></article>; }
