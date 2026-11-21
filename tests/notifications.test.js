import { describe, expect, it } from "vitest";
import { NOTE_TYPES, arrivals, pendingNotes, reconcileSeen, totalNeeding, totalUnread, typesForLocation, unreadOf } from "../lib/notifications";

describe("notifications", () => {
  it("lists only what is waiting, in a fixed order, with its count", () => {
    const list = pendingNotes({ ready_to_ship: 1, event_payments: 3, order_payments: 0 });
    expect(list.map((n) => [n.key, n.count])).toEqual([["event_payments", 3], ["ready_to_ship", 1]]);
    expect(pendingNotes({})).toEqual([]);
    expect(pendingNotes(null)).toEqual([]);
  });
  it("the bell counts everything that is waiting", () => {
    expect(totalNeeding({ event_payments: 3, order_payments: 2, set_fee: 1 })).toBe(6);
    expect(totalNeeding(null)).toBe(0);
  });
  it("toasts only for what shoppers and attendees send, never for the first reading or an admin's own work", () => {
    expect(arrivals(null, { event_payments: 5 })).toEqual([]);                                   // first reading: no toast
    expect(arrivals({ event_payments: 1 }, { event_payments: 2 }).map((t) => t.key)).toEqual(["event_payments"]);
    expect(arrivals({ order_payments: 0, extra_payments: 0, shipping_payments: 0 }, { order_payments: 1, extra_payments: 1, shipping_payments: 2 }).map((t) => t.key))
      .toEqual(["order_payments", "extra_payments", "shipping_payments"]);
    expect(arrivals({ set_fee: 0, ready_to_ship: 0 }, { set_fee: 4, ready_to_ship: 2 })).toEqual([]);   // those appear when the admin confirms a payment
    expect(arrivals({ event_payments: 3 }, { event_payments: 2 })).toEqual([]);                  // fewer is not news
  });
  it("every kind has a label and a place to go", () => {
    for (const t of NOTE_TYPES) { expect(t.label).toBeTruthy(); expect(t.to).toMatch(/^\/admin\/(payments|orders)/); }
  });

  it("unread is what came since the admin last looked, and only for what people send", () => {
    expect(unreadOf({ event_payments: 5, order_payments: 2 }, { event_payments: 3 })).toMatchObject({ event_payments: 2, order_payments: 2, extra_payments: 0 });
    expect(unreadOf({ set_fee: 9, ready_to_ship: 9 }, {})).not.toHaveProperty("set_fee");       // the admin's own work is never "new"
    expect(totalUnread(unreadOf({ event_payments: 5 }, { event_payments: 5 }))).toBe(0);
    expect(totalUnread(unreadOf({ event_payments: 5, shipping_payments: 1 }, {}))).toBe(6);
    expect(unreadOf(null, null).event_payments).toBe(0);
  });
  it("what was seen can never be above what is waiting, so the next arrival is not missed", () => {
    expect(reconcileSeen({ event_payments: 5 }, { event_payments: 2 }).event_payments).toBe(2);   // 3 were dealt with
    expect(unreadOf({ event_payments: 3 }, reconcileSeen({ event_payments: 5 }, { event_payments: 2 })).event_payments).toBe(1);   // one new one after that
    expect(reconcileSeen({ event_payments: 1 }, { event_payments: 4 }).event_payments).toBe(1);
  });
  it("viewing the page a notification leads to counts as reading it", () => {
    expect(typesForLocation("/admin/payments", "")).toEqual(["event_payments"]);
    expect(typesForLocation("/admin/orders", "").sort()).toEqual(["extra_payments", "order_payments", "shipping_payments"]);
    expect(typesForLocation("/admin/payments", "?tab=event")).toEqual([]);
    expect(typesForLocation("/admin/users", "")).toEqual([]);
  });
});
