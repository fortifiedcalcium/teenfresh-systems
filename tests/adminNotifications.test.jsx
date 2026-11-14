// @vitest-environment jsdom
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase: each count is looked up by table and filters, and the Realtime channel can be fired by hand.
const state = { counts: {}, handlers: [], removed: 0, fail: new Set() };
const keyOf = (table, f) => `${table}|${f.map(([c, v]) => `${c}=${v}`).join("&")}`;
vi.mock("../src/lib/supabaseClient.js", () => ({
  supabase: {
    from: (table) => ({ select: () => { const f = []; const q = { eq(c, v) { f.push([c, v]); return q; }, then: (res, rej) => { const k = keyOf(table, f); return Promise.resolve(state.fail.has(k) ? { count: null, error: { message: "x" } } : { count: state.counts[k] ?? 0, error: null }).then(res, rej); } }; return q; } }),
    channel: () => { const ch = { on: (_t, _f, cb) => { state.handlers.push(cb); return ch; }, subscribe: () => ch }; return ch; },
    removeChannel: () => { state.removed += 1; },
  },
}));
const { useAdminNotifications } = await import("../src/hooks/useAdminNotifications.js");

const K = { event: "payments|status=pending", order: "orders|status=pending&balance_status=none", setFee: "orders|status=paid&shipping_status=none", ship: "orders|shipping_status=pending_review" };
let seen = []; const toasts = [];
let api = null;
function Harness({ userId = "u2" }) { const r = useAdminNotifications(true, (types) => toasts.push(...types.map((t) => t.key)), { throttleMs: 1000, pollMs: 60000, userId }); api = r; seen.push(r.counts); return <p>{r.counts ? JSON.stringify(r.counts) : "loading"}</p>; }
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const last = () => seen.at(-1);
const cleanupAll = () => { document.body.innerHTML = ""; };

describe("useAdminNotifications", () => {
  beforeEach(() => { state.counts = { [K.event]: 2, [K.order]: 1 }; state.handlers = []; state.removed = 0; state.fail = new Set(); seen = []; toasts.length = 0; localStorage.clear(); vi.useFakeTimers({ shouldAdvanceTime: false }); });

  it("reads the counts once, with no toast for what was already waiting", async () => {
    render(<Harness />); await flush(0);
    expect(last()).toMatchObject({ event_payments: 2, order_payments: 1, extra_payments: 0, set_fee: 0 });
    expect(toasts).toEqual([]);
  });
  it("toasts when something new arrives, once, even after a burst of changes", async () => {
    render(<Harness />); await flush(0);
    state.counts[K.order] = 2; state.counts[K.ship] = 1;
    await act(async () => { for (let i = 0; i < 5; i++) state.handlers.forEach((h) => h({})); });
    await flush(1100);
    expect(last()).toMatchObject({ order_payments: 2, shipping_payments: 1 });
    expect(toasts.sort()).toEqual(["order_payments", "shipping_payments"]);
    await flush(1100);                                                  // nothing changed: no second toast
    expect(toasts).toHaveLength(2);
  });
  it("does not toast for work the admin caused themselves, but still counts it", async () => {
    render(<Harness />); await flush(0);
    state.counts[K.setFee] = 3;
    state.handlers.forEach((h) => h({})); await flush(1100);
    expect(last().set_fee).toBe(3);
    expect(toasts).toEqual([]);
  });
  it("keeps the last count when one query fails, and catches changes by polling too", async () => {
    render(<Harness />); await flush(0);
    state.fail.add(K.event); state.counts[K.order] = 4;
    await flush(61000);                                                 // the minute poll: no Realtime event needed
    expect(last().event_payments).toBe(2);                              // the failed one is not zeroed
    expect(last().order_payments).toBe(4);
    expect(toasts).toEqual(["order_payments"]);
  });
  it("stops listening when the admin area closes", async () => {
    const { unmount } = render(<Harness />); await flush(0);
    unmount();
    expect(state.removed).toBe(1);
  });

  it("counts what is new, and reading it makes its counter go away until something newer arrives", async () => {
    render(<Harness />); await flush(0);
    expect(api.unread).toMatchObject({ event_payments: 2, order_payments: 1 });                 // nothing was seen yet
    act(() => api.markRead(["event_payments"]));
    expect(api.unread).toMatchObject({ event_payments: 0, order_payments: 1 });
    state.counts[K.event] = 3;                                                                   // one more arrives
    state.handlers.forEach((h) => h({})); await flush(1100);
    expect(api.unread.event_payments).toBe(1);                                                   // only the newcomer
    act(() => api.markAllRead());
    expect(Object.values(api.unread).every((n) => n === 0)).toBe(true);
  });
  it("remembers what was read after a reload, for each admin separately", async () => {
    const first = render(<Harness userId="u2" />); await flush(0);
    act(() => api.markRead(["event_payments", "order_payments"]));
    first.unmount();
    render(<Harness userId="u2" />); await flush(0);
    expect(api.unread).toMatchObject({ event_payments: 0, order_payments: 0 });                  // still read
    cleanupAll();
    render(<Harness userId="u7" />); await flush(0);
    expect(api.unread).toMatchObject({ event_payments: 2, order_payments: 1 });                  // another admin has not seen them
  });
  it("what the admin dealt with does not hide the next arrival", async () => {
    render(<Harness />); await flush(0);
    act(() => api.markRead(["event_payments"]));                                                 // saw 2
    state.counts[K.event] = 0;                                                                   // all handled
    state.handlers.forEach((h) => h({})); await flush(1100);
    state.counts[K.event] = 1;                                                                   // a new one
    state.handlers.forEach((h) => h({})); await flush(1100);
    expect(api.unread.event_payments).toBe(1);
  });
  it("ignores reading before the first count has loaded", async () => {
    render(<Harness />);
    act(() => api.markRead(["event_payments"]));                                                 // too early: nothing to mark
    await flush(0);
    expect(api.unread.event_payments).toBe(2);
  });
});
