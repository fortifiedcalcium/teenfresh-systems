import { describe, expect, it } from "vitest";
import { planPurge } from "../scripts/purge-receipts.mjs";

const DAY = 86_400_000;
const now = new Date("2026-11-30T00:00:00Z").getTime();
const ev = (id, endedDaysAgo, retention) => ({ id, event_date: new Date(now - (endedDaysAgo + 1) * DAY).toISOString(), ends_at: new Date(now - endedDaysAgo * DAY).toISOString(), receipt_retention_days: retention });
const pay = (id, event_id, path, history = []) => ({ id, event_id, receipt_path: path, receipt_history: history });

describe("receipt retention", () => {
  it("only events past their retention date are purged; no setting means keep forever", () => {
    const events = [ev("old", 40, 30), ev("recent", 10, 30), ev("keep", 400, null), ev("exact", 30, 30), ev("zero", 1, 0)];
    const payments = [pay("p1", "old", "u/a.png"), pay("p2", "recent", "u/b.png"), pay("p3", "keep", "u/c.png"), pay("p4", "zero", "u/d.png")];
    const plan = planPurge(events, payments, now);
    expect(plan.events).toBe(2);                                    // "old" and "zero"; "exact" is on the boundary, not past it
    expect(plan.payments.sort()).toEqual(["p1", "p4"]);
    expect(plan.paths.sort()).toEqual(["u/a.png", "u/d.png"]);
  });
  it("includes receipts from earlier resubmissions, and ignores payments with nothing to delete", () => {
    const plan = planPurge([ev("old", 40, 30)], [pay("p1", "old", "u/new.png", ["u/first.png", "u/second.png"]), pay("p2", "old", null, [])], now);
    expect(plan.paths.sort()).toEqual(["u/first.png", "u/new.png", "u/second.png"]);
    expect(plan.payments).toEqual(["p1"]);
  });
  it("uses the start date when the event has no end time", () => {
    const plan = planPurge([{ id: "e", event_date: new Date(now - 40 * DAY).toISOString(), ends_at: null, receipt_retention_days: 30 }], [pay("p", "e", "u/x.png")], now);
    expect(plan.paths).toEqual(["u/x.png"]);
  });
});
