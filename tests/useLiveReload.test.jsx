// @vitest-environment jsdom
import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { handlers: [], filters: [], removed: 0, names: [] };
vi.mock("../src/lib/supabaseClient.js", () => ({
  supabase: {
    channel: (name) => { state.names.push(name); const ch = { on: (_t, f, cb) => { state.handlers.push(cb); state.filters.push(f); return ch; }, subscribe: () => ch }; return ch; },
    removeChannel: () => { state.removed += 1; },
  },
}));
const { useLiveReload } = await import("../src/hooks/useLiveReload.js");

let reloads = 0;
function Page({ table = "orders", filter, enabled = true }) { useLiveReload(table, () => { reloads += 1; }, { filter, enabled, throttleMs: 1000, pollMs: 60000 }); return <p>page</p>; }
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe("useLiveReload", () => {
  beforeEach(() => { state.handlers = []; state.filters = []; state.removed = 0; state.names = []; reloads = 0; vi.useFakeTimers({ shouldAdvanceTime: false }); });

  it("reloads when the table changes, once for a burst of changes", async () => {
    render(<Page />); await flush(0);
    expect(reloads).toBe(0);                                          // it does not reload just by mounting (the page loads itself)
    await act(async () => { for (let i = 0; i < 6; i++) state.handlers.forEach((h) => h({})); });
    await flush(1100);
    expect(reloads).toBe(1);
    await act(async () => { state.handlers.forEach((h) => h({})); });
    await flush(1100);
    expect(reloads).toBe(2);
  });
  it("listens to the right table, narrowed by the filter when there is one", async () => {
    render(<Page table="orders" filter="user_id=eq.u1" />); await flush(0);
    expect(state.filters[0]).toEqual({ event: "*", schema: "public", table: "orders", filter: "user_id=eq.u1" });
    render(<Page table="orders" />); await flush(0);
    expect(state.filters[1]).toEqual({ event: "*", schema: "public", table: "orders" });          // no filter key at all
  });
  it("catches a missed change with the one-minute poll", async () => {
    render(<Page />); await flush(0);
    await flush(61000);
    expect(reloads).toBe(1);
    await flush(60000);
    expect(reloads).toBe(2);
  });
  it("gives every page its own channel, and stops listening when the page closes or is turned off", async () => {
    const a = render(<Page />); const b = render(<Page />); await flush(0);
    expect(new Set(state.names).size).toBe(2);
    a.unmount(); b.unmount();
    expect(state.removed).toBe(2);
    await act(async () => { state.handlers.forEach((h) => h({})); });
    await flush(2000); await flush(61000);
    expect(reloads).toBe(0);                                          // nothing reloads after it closed
    const off = render(<Page enabled={false} />); await flush(0);
    expect(state.names).toHaveLength(2);                              // no new channel
    off.unmount();
  });
});
