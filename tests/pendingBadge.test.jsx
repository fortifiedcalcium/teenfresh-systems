// @vitest-environment jsdom
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase whose payments count we control, and whose Realtime channel we can fire by hand.
const state = { count: 2, handlers: [], queries: 0 };
vi.mock("../src/lib/supabaseClient.js", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: async () => { state.queries += 1; return { count: state.count, error: null }; } }) }),
    channel: () => { const ch = { on: (_t, _f, cb) => { state.handlers.push(cb); return ch; }, subscribe: () => ch }; return ch; },
    removeChannel: () => {},
  },
}));
const { usePendingPayments } = await import("../src/hooks/usePendingPayments.js");
const { default: AdminBottomNav } = await import("../src/components/admin/AdminBottomNav.jsx");

function Harness() { const n = usePendingPayments(true, 1000); return <MemoryRouter initialEntries={["/admin"]}><AdminBottomNav pending={n} /></MemoryRouter>; }
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe("pending-payments badge on the Profile tab", () => {
  beforeEach(() => { state.count = 2; state.handlers = []; state.queries = 0; vi.useFakeTimers({ shouldAdvanceTime: false }); });

  it("shows the count with a text alternative, caps at 99+, and updates when a payment arrives (throttled)", async () => {
    render(<Harness />); await flush(0);
    const profile = screen.getByRole("link", { name: /Profile/ });
    expect(profile).toHaveTextContent("2 payments pending verification");
    expect(profile.querySelector(".nav-badge")).toHaveTextContent("2");

    // a burst of 5 inserts causes ONE re-count, and the polite live region announces the new total
    state.count = 12;
    await act(async () => { for (let i = 0; i < 5; i++) state.handlers.forEach((h) => h({})); });
    expect(state.queries).toBe(1);                       // not yet: throttled
    await flush(1100);
    expect(state.queries).toBe(2);
    expect(screen.getByRole("link", { name: /Profile/ })).toHaveTextContent("12 payments pending verification");
    expect(screen.getByRole("status")).toHaveTextContent("12 payments pending verification");

    state.count = 150;
    await act(async () => { state.handlers.forEach((h) => h({})); }); await flush(1100);
    expect(screen.getByRole("link", { name: /Profile/ }).querySelector(".nav-badge")).toHaveTextContent("99+");
  });

  it("shows no badge when nothing is pending, and says 1 payment (singular)", async () => {
    state.count = 0;
    render(<Harness />); await flush(0);
    expect(document.querySelector(".nav-badge")).toBeNull();
    state.count = 1;
    await act(async () => { state.handlers.forEach((h) => h({})); }); await flush(1100);
    expect(screen.getByRole("link", { name: /Profile/ })).toHaveTextContent("1 payment pending verification");
  });
});
