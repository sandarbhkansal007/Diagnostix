import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ReportsPage } from "./ReportsPage";

describe("ReportsPage", () => {
  it("renders the future backend empty state", () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Reports" })).toBeTruthy();
    expect(screen.getByText("No reports yet")).toBeTruthy();
  });
});
