// @vitest-environment jsdom
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../src/components/Toast.jsx";
import { LiveRegionProvider } from "../src/a11y.jsx";
import { asGuest, asUser, fixtures, realtime } from "./helpers/mockSupabase.js";

vi.mock("../src/lib/supabaseClient.js", async () => import("./helpers/mockSupabase.js"));
vi.mock("../src/context/AuthContext.jsx", async () => { const m = await import("./helpers/mockSupabase.js"); return { useAuth: () => m.authState.current }; });
const { default: AttendeeLayout } = await import("../src/layouts/AttendeeLayout.jsx");

const order = (o = {}) => ({ id: "o1", order_number: "TF-000001", user_id: "u1", status: "pending", shipping_status: "none", balance_status: "none", preferred_courier: "LBC", ...o });
const show = () => render(<MemoryRouter initialEntries={["/"]}><LiveRegionProvider><ToastProvider><Routes><Route element={<AttendeeLayout />}><Route index element={<h1>Home</h1>} /></Route></Routes></ToastProvider></LiveRegionProvider></MemoryRouter>);
const bell = () => screen.getByRole("button", { name: /^Notifications/ });

describe("the shopper's to-do badge and toast", () => {
  const notes = [];
function FakeAudio() {
  this.state = "running"; this.currentTime = 0; this.destination = {}; this.resume = () => Promise.resolve();
  this.createOscillator = () => ({ frequency: { value: 0 }, connect() {}, stop() {}, start() { notes.push(this.frequency.value); } });
  this.createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} });
}
beforeEach(() => { asGuest(); fixtures.current = { orders: [] }; notes.length = 0; localStorage.clear(); window.AudioContext = FakeAudio; });

  it("shows how many things are waiting on the shopper, on the notification bell", async () => {
    asUser();
    fixtures.current.orders = [order({ status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }), order({ id: "o2", balance_status: "awaiting_payment", balance_for: "items", balance_due_php: 50 }), order({ id: "o3", preferred_courier: null })];
    show();
    await waitFor(() => expect(bell()).toHaveAccessibleName("Notifications, 2 for you to do"));                  // the optional courier choice is not counted
    expect(bell().querySelector(".notif-badge")).toHaveTextContent("2");
  });
  it("has no badge when nothing is waiting, and none for a guest", async () => {
    asUser();
    show();
    await new Promise((r) => setTimeout(r, 100));
    expect(bell().querySelector(".notif-badge")).toBeNull();
    expect(bell()).toHaveAccessibleName("Notifications, nothing for you to do");
  });
  it("no toast for what was already waiting, and a toast when something new needs the shopper", async () => {
    asUser();
    fixtures.current.orders = [order({ status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 })];
    show();
    await waitFor(() => expect(bell()).toHaveAccessibleName("Notifications, 1 for you to do"));
    expect(screen.queryByText(/Order TF-000001: Pay your shipping fee/)).toBeNull();      // it was already there when the page opened
    fixtures.current.orders = [order({ status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }), order({ id: "o2", order_number: "TF-000002", balance_status: "awaiting_payment", balance_for: "items", balance_due_php: 250 })];
    await act(async () => { realtime.fire("orders"); });
    expect(await screen.findByText("Order TF-000002: Send the remaining ₱250.00 of your payment.", {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(bell()).toHaveAccessibleName("Notifications, 2 for you to do"));
  });
  it("the badge goes away by itself once the shopper has dealt with it", async () => {
    asUser();
    fixtures.current.orders = [order({ status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 })];
    show();
    await waitFor(() => expect(bell()).toHaveAccessibleName("Notifications, 1 for you to do"));
    fixtures.current.orders = [order({ status: "paid", shipping_status: "pending_review", shipping_fee_php: 150 })];       // the receipt was sent
    await act(async () => { realtime.fire("orders"); });
    await waitFor(() => expect(bell().querySelector(".notif-badge")).toBeNull(), { timeout: 4000 });
  });

  it("plays a chime with the toast for a new to-do, but not for what was already waiting", async () => {
    asUser();
    fixtures.current.orders = [order({ status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 })];
    show();
    await waitFor(() => expect(bell()).toHaveAccessibleName("Notifications, 1 for you to do"));
    expect(notes).toEqual([]);                                                                       // opening the page is silent
    fixtures.current.orders = [...fixtures.current.orders, order({ id: "o2", order_number: "TF-000002", balance_status: "awaiting_payment", balance_for: "items", balance_due_php: 250 })];
    await act(async () => { realtime.fire("orders"); });
    await screen.findByText(/Order TF-000002/, {}, { timeout: 4000 });
    expect(notes).toHaveLength(2);                                                                   // the two-note chime, once
  });
  it("stays silent when the shopper has switched the sound off", async () => {
    asUser();
    localStorage.setItem("shopper_notify_sound", "off");
    fixtures.current.orders = [];
    show();
    await new Promise((r) => setTimeout(r, 50));
    fixtures.current.orders = [order({ status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 })];
    await act(async () => { realtime.fire("orders"); });
    await screen.findByText(/Pay your shipping fee/, {}, { timeout: 4000 });                         // the toast still appears
    expect(notes).toEqual([]);
  });
});
