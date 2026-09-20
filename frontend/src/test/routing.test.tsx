import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routes } from "../app/router";

describe("application routing", () => {
  it("renders the command center route and handles an offline backend", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const router = createMemoryRouter(routes, { initialEntries: ["/app"] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { name: "Command Center", level: 2 })).toBeInTheDocument();
    expect(await screen.findByText("SYSTEM OFFLINE")).toBeInTheDocument();
  });

  it("opens the implemented Stage 6 communication workspace", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, { initialEntries: ["/app"] });
    render(<RouterProvider router={router} />);
    await user.click(screen.getByRole("link", { name: "Communication" }));
    expect(await screen.findByRole("heading", { name: "Agent Communication", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trust pipeline" })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/app/communication"));
  });

  it("renders a polished not-found route", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/not-registered"] });
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("heading", { name: /no registered destination/i })).toBeInTheDocument();
  });
});
