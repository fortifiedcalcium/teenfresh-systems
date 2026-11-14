// @vitest-environment jsdom
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import TodoBell from "../src/components/TodoBell.jsx";
import { allTodos } from "../src/lib/orderTodos.js";
import { check } from "./helpers/a11y.js";

const base = { id: "o1", order_number: "TF-000001", status: "pending", shipping_status: "none", balance_status: "none", preferred_courier: "LBC" };
const show = (orders) => render(<MemoryRouter initialEntries={["/"]}><Routes><Route path="*" element={<><TodoBell todos={allTodos(orders)} /><p>page</p></>} /></Routes></MemoryRouter>);

describe("TodoBell (the shopper's notification button)", () => {
  beforeEach(() => localStorage.clear());

  it("says in its name how many things wait on the shopper, and has no violations", async () => {
    const { container } = show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }, { ...base, id: "o2", balance_status: "awaiting_payment", balance_for: "items", balance_due_php: 50 }]);
    expect(screen.getByRole("button", { name: "Notifications, 2 for you to do" })).toHaveAttribute("aria-expanded", "false");
    expect(await check(container)).toHaveNoViolations();
  });
  it("opens the list of what to do, each item linking to its order, and the optional ones are marked and not counted", async () => {
    const user = userEvent.setup();
    show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150, shipping_note: "Blurry receipt" }, { ...base, id: "o3", order_number: "TF-000003", preferred_courier: null }]);
    await user.click(screen.getByRole("button", { name: "Notifications, 1 for you to do" }));            // the courier choice is optional: not counted
    const panel = screen.getByRole("region", { name: "Notifications" });
    expect(await check(panel)).toHaveNoViolations();
    expect(within(panel).getByRole("heading", { name: "What you need to do" })).toBeInTheDocument();
    const links = within(panel).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Order TF-000001");
    expect(links[0]).toHaveTextContent("Pay your shipping fee of ₱150.00.");
    expect(links[0]).toHaveTextContent("Your last receipt was sent back: Blurry receipt");
    expect(links[0]).toHaveAttribute("href", "/orders/o1");
    expect(links[1]).toHaveTextContent("Order TF-000003 · optional");
  });
  it("closes when a link is followed, on Escape (focus back on the button), or on a click elsewhere", async () => {
    const user = userEvent.setup();
    show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }]);
    const button = screen.getByRole("button", { name: /^Notifications/ });
    await user.click(button);
    await user.click(within(screen.getByRole("region", { name: "Notifications" })).getByRole("link"));
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
    await user.click(button); await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
    expect(button).toHaveFocus();
    await user.click(button); await user.click(screen.getByText("page"));
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
  });
  it("says so when nothing is waiting, and shows no badge", async () => {
    const user = userEvent.setup();
    const { container } = show([{ ...base }]);
    expect(container.querySelector(".notif-badge")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Notifications, nothing for you to do" }));
    expect(screen.getByText("You are all set. Nothing is waiting on you right now.")).toBeInTheDocument();
  });
  it("has the shopper's own sound switch, on by default, remembered when switched off", async () => {
    const user = userEvent.setup();
    show([]);
    await user.click(screen.getByRole("button", { name: /^Notifications/ }));
    const sw = screen.getByRole("switch", { name: "Play a sound when something new needs me" });
    expect(sw).toBeChecked();
    await user.click(sw);
    expect(sw).not.toBeChecked();
    expect(localStorage.getItem("shopper_notify_sound")).toBe("off");
    expect(localStorage.getItem("admin_notify_sound")).toBeNull();
  });
});
