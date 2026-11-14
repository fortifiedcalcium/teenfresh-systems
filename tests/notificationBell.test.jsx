// @vitest-environment jsdom
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NotificationBell from "../src/components/admin/NotificationBell.jsx";
import { check } from "./helpers/a11y.js";

const show = (counts, props = {}) => render(<MemoryRouter initialEntries={["/admin"]}><Routes><Route path="/admin/*" element={<><NotificationBell counts={counts} {...props} /><p>page</p></>} /></Routes></MemoryRouter>);

describe("NotificationBell", () => {
  it("says how many things are waiting, in its name, and has no violations", async () => {
    const { container } = show({ event_payments: 2, order_payments: 1 });
    expect(screen.getByRole("button", { name: "Notifications, 3 waiting for you" })).toHaveAttribute("aria-expanded", "false");
    expect(await check(container)).toHaveNoViolations();
  });
  it("opens a list that says what is waiting and links to it, and closes on Escape or after a click", async () => {
    const user = userEvent.setup();
    show({ event_payments: 2, shipping_payments: 1, ready_to_ship: 4 });
    const bell = screen.getByRole("button", { name: /Notifications, 7 waiting/ });
    await user.click(bell);
    const panel = screen.getByRole("region", { name: "Notifications" });
    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(await check(panel)).toHaveNoViolations();
    const links = within(panel).getAllByRole("link");
    expect(links.map((l) => l.textContent.replace(/\s+/g, " ").trim())).toEqual(["22 Event payments to review", "11 Shipping fee payments to check", "44 Orders ready to ship"]);   // the number is read out once, and shown once
    expect(within(panel).getByRole("link", { name: /Shipping fee payments to check/ })).toHaveAttribute("href", "/admin/payments?tab=shop");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
    expect(bell).toHaveFocus();                                          // focus goes back to the button
    await user.click(bell);
    await user.click(within(screen.getByRole("region", { name: "Notifications" })).getByRole("link", { name: /Event payments/ }));
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });
  it("closes when someone clicks elsewhere, and says so when nothing is waiting", async () => {
    const user = userEvent.setup();
    show({});
    const bell = screen.getByRole("button", { name: "Notifications, nothing waiting" });
    await user.click(bell);
    expect(screen.getByText("Nothing needs your attention right now.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All caught up" })).toBeInTheDocument();
    await user.click(screen.getByText("page"));
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });
  it("caps a big number at 99+ on the badge", () => {
    show({ event_payments: 150 });
    expect(screen.getByRole("button", { name: /150 waiting/ })).toHaveTextContent("99+");
  });
});
