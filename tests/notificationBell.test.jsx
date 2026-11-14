// @vitest-environment jsdom
import React, { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "../src/components/admin/NotificationBell.jsx";
import { unreadOf } from "../src/lib/notifications.js";
import { check } from "./helpers/a11y.js";

// The bell with the read tracking the layout gives it: the counts, what was already seen, and what to do when something is opened.
function Harness({ counts, seen: start = {}, ...props }) {
  const [seen, setSeen] = useState(start);
  const unread = unreadOf(counts, seen);
  const onRead = (kinds) => { props.onRead?.(kinds); setSeen((s) => ({ ...s, ...Object.fromEntries(kinds.map((k) => [k, counts[k] || 0])) })); };
  const onReadAll = () => { props.onReadAll?.(); setSeen({ ...counts }); };
  return <><NotificationBell counts={counts} unread={unread} onRead={onRead} onReadAll={onReadAll} /><p>page</p></>;
}
const show = (counts, props = {}) => render(<MemoryRouter initialEntries={["/admin"]}><Routes><Route path="/admin/*" element={<Harness counts={counts} {...props} />} /></Routes></MemoryRouter>);

describe("NotificationBell", () => {
  beforeEach(() => { localStorage.clear(); });

  it("counts only what is NEW, in its name, and has no violations", async () => {
    const { container } = show({ event_payments: 2, order_payments: 1, ready_to_ship: 5 });
    expect(screen.getByRole("button", { name: "Notifications, 3 new" })).toHaveAttribute("aria-expanded", "false");   // ready to ship is the admin's own work: not new
    expect(await check(container)).toHaveNoViolations();
  });
  it("lists the new ones with their counters, and opening one reads it: its counter is gone", async () => {
    const user = userEvent.setup();
    const read = vi.fn();
    show({ event_payments: 2, shipping_payments: 1 }, { onRead: read });
    await user.click(screen.getByRole("button", { name: "Notifications, 3 new" }));
    const panel = screen.getByRole("region", { name: "Notifications" });
    expect(await check(panel)).toHaveNoViolations();
    expect(within(panel).getAllByRole("link").map((l) => l.textContent.replace(/\s+/g, " ").trim())).toEqual(["22 new: Event payments to review", "11 new: Shipping fee payments to check"]);
    expect(within(panel).getByRole("link", { name: /Shipping fee payments/ })).toHaveAttribute("href", "/admin/payments?tab=shop");
    await user.click(within(panel).getByRole("link", { name: /Event payments/ }));
    expect(read).toHaveBeenCalledWith(["event_payments"]);
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();              // the list closes
    const bell = screen.getByRole("button", { name: "Notifications, 1 new" });                // the bell's number dropped by what was read
    await user.click(bell);
    const again = screen.getByRole("region", { name: "Notifications" });
    expect(within(again).getByRole("link", { name: /Shipping fee payments/ })).toBeInTheDocument();                       // still new
    expect(within(again).getByText("Still waiting (already seen)")).toBeInTheDocument();
    const seen = within(again).getByRole("link", { name: "Event payments to review" });        // seen: still listed, but no counter and not "new"
    expect(seen).toHaveAttribute("href", "/admin/payments");
    expect(seen.querySelector(".notif-count")).toBeNull();
  });
  it("Mark all as read clears every counter, and the list says nothing is new", async () => {
    const user = userEvent.setup();
    const all = vi.fn();
    show({ event_payments: 2, order_payments: 4 }, { onReadAll: all });
    await user.click(screen.getByRole("button", { name: "Notifications, 6 new" }));
    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(all).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Notifications, nothing new" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No new notifications" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all as read" })).toBeNull();
  });
  it("a new arrival after reading is new again, and only the newcomers count", async () => {
    show({ event_payments: 5 }, { seen: { event_payments: 3 } });                           // 3 were seen, 2 came since
    expect(screen.getByRole("button", { name: "Notifications, 2 new" })).toBeInTheDocument();
  });
  it("closes on Escape (focus back on the button) and when someone clicks elsewhere, and says so when nothing is waiting", async () => {
    const user = userEvent.setup();
    show({});
    const bell = screen.getByRole("button", { name: "Notifications, nothing new" });
    await user.click(bell);
    expect(screen.getByText("Nothing needs your attention right now.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
    expect(bell).toHaveFocus();
    await user.click(bell);
    await user.click(screen.getByText("page"));
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });
  it("caps a big number at 99+ on the badge", () => {
    show({ event_payments: 150 });
    expect(screen.getByRole("button", { name: /150 new/ })).toHaveTextContent("99+");
  });
  it("has a sound switch that is on by default and remembers being switched off", async () => {
    const user = userEvent.setup();
    show({ event_payments: 1 });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    const sw = screen.getByRole("switch", { name: "Play a sound for new notifications" });
    expect(sw).toBeChecked();
    await user.click(sw);
    expect(sw).not.toBeChecked();
    expect(localStorage.getItem("admin_notify_sound")).toBe("off");
  });
});
