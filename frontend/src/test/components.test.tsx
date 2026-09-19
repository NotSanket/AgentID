import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AgentCard } from "../components/identity/AgentCard";
import { AgentPassport } from "../components/identity/AgentPassport";
import { Button } from "../components/ui/Button";
import { TextInput, Toggle } from "../components/ui/FormControls";
import { ActiveBadge, BlockedBadge, PendingBadge, RevokedBadge, VerifiedBadge } from "../components/ui/StatusBadge";
import { CopyButton } from "../components/ui/TechnicalValue";

const agent = { name: "InterfaceAgent", agentId: "AGT-DEMO-001", organization: "Component Preview", capabilities: ["routing", "verification"], wallet: "0x0000000000000000000000000000000000000001", status: "active" as const };

describe("core reusable components", () => {
  it("renders buttons, form controls, and status badges", () => {
    render(<><Button loading>Working</Button><TextInput aria-label="Agent name" /><Toggle checked={false} onChange={() => undefined} label="Demo toggle" /><VerifiedBadge /><ActiveBadge /><RevokedBadge /><BlockedBadge /><PendingBadge /></>);
    expect(screen.getByRole("button", { name: "Working" })).toBeDisabled();
    expect(screen.getByLabelText("Agent name")).toBeInTheDocument();
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
    expect(screen.getByText("REVOKED")).toBeInTheDocument();
  });

  it("copies technical values and confirms completion", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<CopyButton value="0xabc123" label="Copy wallet" />);
    await user.click(screen.getByRole("button", { name: "Copy wallet" }));
    expect(writeText).toHaveBeenCalledWith("0xabc123");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("renders the AgentCard and digital AgentPassport foundations", () => {
    render(<><AgentCard agent={agent} /><AgentPassport agent={{ ...agent, blockchainStatus: "verified", registrationBlock: 42, transactionHash: "0x1234567890abcdef" }} /></>);
    expect(screen.getAllByText("InterfaceAgent")).toHaveLength(2);
    expect(screen.getAllByText("AGT-DEMO-001")).toHaveLength(2);
    expect(screen.getByText("DIGITAL CREDENTIAL")).toBeInTheDocument();
  });
});
