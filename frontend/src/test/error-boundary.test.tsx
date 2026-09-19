import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorBoundary } from "../components/system/ErrorBoundary";

function BrokenComponent(): never { throw new Error("test failure"); }

describe("ErrorBoundary", () => {
  it("shows a safe recovery screen without a raw stack trace", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ErrorBoundary><BrokenComponent /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("The console hit an unexpected fault.");
    expect(screen.getByRole("button", { name: "Reload console" })).toBeInTheDocument();
    expect(screen.queryByText("test failure")).not.toBeInTheDocument();
  });
});
