import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "../components/layout/AppShell";
import { Sidebar } from "../components/layout/Sidebar";
import { GuidedDemo } from "../components/system/GuidedDemo";

describe("console navigation", () => {
  it("expands and collapses the floating sidebar", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/app"]}><Sidebar /></MemoryRouter>);
    const sidebar = screen.getByLabelText("Primary navigation");
    expect(sidebar).toHaveAttribute("data-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    await user.unhover(sidebar);
    expect(sidebar).toHaveAttribute("data-expanded", "false");
  });

  it("opens and closes the command palette with keyboard shortcuts", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/app"]}><Routes><Route path="/app" element={<AppShell />}><Route index element={<div>Home slot</div>} /></Route></Routes></MemoryRouter>);
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument());
  });

  it("filters commands and navigates on Enter", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const user = userEvent.setup();
    function Location() { return <span data-testid="location">{useLocation().pathname}</span>; }
    render(<MemoryRouter initialEntries={["/app"]}><Routes><Route path="/app/*" element={<><AppShell /><Location /></>}><Route index element={<div />} /></Route></Routes></MemoryRouter>);
    await user.keyboard("{Control>}k{/Control}");
    await user.type(screen.getByRole("textbox", { name: "Search commands" }), "registry");
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("location")).toHaveTextContent("/app/registry");
  });

  it("opens and dismisses responsive mobile navigation", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/app"]}><Routes><Route path="/app" element={<AppShell />}><Route index element={<div />} /></Route></Routes></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByLabelText("Mobile navigation")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    await waitFor(() => expect(screen.queryByLabelText("Mobile navigation")).not.toBeInTheDocument());
  });

  it("provides non-destructive guided demo next, previous, and exit controls", async () => {
    const user = userEvent.setup();
    function Location() { return <span data-testid="guided-location">{useLocation().pathname}</span>; }
    render(<MemoryRouter initialEntries={["/app"]}><GuidedDemo /><Location /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Guided demo" }));
    expect(screen.getByRole("link", { name: /Command Center/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByTestId("guided-location")).toHaveTextContent("/app/registry");
    await user.click(screen.getByRole("button", { name: /Previous/ }));
    expect(screen.getByTestId("guided-location")).toHaveTextContent("/app");
    await user.click(screen.getByRole("button", { name: "Exit Demo" }));
    expect(screen.queryByLabelText("Guided demo navigation")).not.toBeInTheDocument();
  });
});
