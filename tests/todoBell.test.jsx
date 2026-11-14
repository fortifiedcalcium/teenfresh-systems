// @vitest-environment jsdom
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TodoBell from "../src/components/TodoBell.jsx";
import { allTodos } from "../src/lib/orderTodos.js";
import { check } from "./helpers/a11y.js";

const base = { id: "o1", order_number: "TF-000001", status: "pending", shipping_status: "none", balance_status: "none", preferred_courier: "LBC" };
const show = (orders, props = {}) => render(<MemoryRouter initialEntries={["/"]}><Routes><Route path="*" element={<><TodoBell todos={allTodos(orders)} {...props} /><p>page</p></>} /></Routes></MemoryRouter>);

describe("TodoBell (the shopper's notification button)", () => {
  beforeEach(() => localStorage.clear());

  it("says in its name how many NEW things wait on the shopper, and has no violations", async () => {
    const { container } = show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }, { ...base, id: "o2", balance_status: "awaiting_payment", balance_for: "items", balance_due_php: 50 }], { unseen: 2 });
    expect(screen.getByRole("button", { name: "Notifications, 2 new" })).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".notif-badge")).toHaveTextContent("2");
    expect(await check(container)).toHaveNoViolations();
  });
  it("shows no number once everything has been seen, but still lists what is to do", async () => {
    const user = userEvent.setup();
    const { container } = show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }], { unseen: 0 });
    expect(container.querySelector(".notif-badge")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Notifications, nothing new" }));
    expect(within(screen.getByRole("region", { name: "Notifications" })).getByRole("link")).toHaveTextContent("Pay your shipping fee of ₱150.00.");
  });
  it("opening the list tells the page it was seen, so the number can go away", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }], { unseen: 1, onOpen });
    const button = screen.getByRole("button", { name: "Notifications, 1 new" });
    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(2);                      // each time it is opened
  });
  it("lists what to do, each item linking to its order; optional ones are marked", async () => {
    const user = userEvent.setup();
    show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150, shipping_note: "Blurry receipt" }, { ...base, id: "o3", order_number: "TF-000003", preferred_courier: null }], { unseen: 1 });
    await user.click(screen.getByRole("button", { name: "Notifications, 1 new" }));
    const panel = screen.getByRole("region", { name: "Notifications" });
    expect(await check(panel)).toHaveNoViolations();
    expect(within(panel).getByRole("heading", { name: "What you need to do" })).toBeInTheDocument();
    const links = within(panel).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Order TF-000001");
    expect(links[0]).toHaveTextContent("Your last receipt was sent back: Blurry receipt");
    expect(links[0]).toHaveAttribute("href", "/orders/o1");
    expect(links[1]).toHaveTextContent("Order TF-000003 · optional");
  });
  it("closes when a link is followed, on Escape (focus back on the button), or on a click elsewhere", async () => {
    const user = userEvent.setup();
    show([{ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }], { unseen: 1 });
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
  it("says so when nothing is waiting", async () => {
    const user = userEvent.setup();
    show([{ ...base }]);
    await user.click(screen.getByRole("button", { name: "Notifications, nothing new" }));
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
