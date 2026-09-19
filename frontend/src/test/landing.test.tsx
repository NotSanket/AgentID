import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "../pages/LandingPage";

describe("LandingPage", () => {
  it("renders the AgentID product story and console call to action", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /Every AI Agent Needs an Identity/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Launch AgentID Console/i })[0]).toHaveAttribute("href", "/app");
    expect(screen.getByLabelText(/Conceptual AI agent identity network/i)).toBeInTheDocument();
    expect(screen.getByText(/Illustrative · not live activity/i)).toBeInTheDocument();
  });

  it("describes the four-stage trust pipeline without fake statistics", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    for (const label of ["Register", "Sign", "Verify", "Communicate"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByText(/147 verifications/i)).not.toBeInTheDocument();
  });
});
