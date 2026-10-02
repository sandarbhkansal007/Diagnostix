import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./ReportsPage";

const reportsResponse = [
  {
    id: 11,
    user_id: 9,
    booking_id: 1,
    status: "READY",
    summary: "Annual blood panel",
    findings: "No critical findings. Vitamin D is slightly low.",
    metadata: null,
    created_at: "2026-09-25T09:00:00Z",
    updated_at: "2026-09-25T09:00:00Z",
  },
  {
    id: 12,
    user_id: 9,
    booking_id: 2,
    status: "PENDING",
    summary: "Follow-up chest imaging review",
    findings: "Report is still being processed by the clinical team.",
    metadata: null,
    created_at: "2026-09-20T09:00:00Z",
    updated_at: "2026-09-20T09:00:00Z",
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReportsPage", () => {
  it("loads and renders patient reports from the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(reportsResponse), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Annual blood panel")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Ready")).length).toBeGreaterThan(0);
    expect(screen.getByText("No critical findings. Vitamin D is slightly low.")).toBeTruthy();
  });

  it("keeps the reports list visible and shows then clears a report detail error", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(reportsResponse), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Report unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(reportsResponse[0]), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /Annual blood panel/ });
    await user.click(screen.getByRole("button", { name: /Follow-up chest imaging review/ }));

    expect(await screen.findByRole("alert").then((alert) => alert.textContent)).toContain(
      "Unable to load the selected report",
    );
    expect(screen.getByRole("region", { name: "Reports list" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Annual blood panel/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Annual blood panel/ }));

    expect(await screen.findByText("No critical findings. Vitamin D is slightly low.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
