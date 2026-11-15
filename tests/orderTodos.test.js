import { describe, expect, it } from "vitest";
import { allTodos, requiredCount, todosFor } from "../lib/orderTodos";

const base = { id: "o1", order_number: "TF-000001", status: "pending", shipping_status: "none", balance_status: "none", preferred_courier: "LBC" };

describe("what a shopper has to do", () => {
  it("nothing, while we are the ones checking", () => {
    expect(todosFor(base)).toEqual([]);                                                              // payment sent, we are checking it
    expect(todosFor({ ...base, status: "paid", shipping_status: "pending_review", shipping_fee_php: 150 })).toEqual([]);   // shipping receipt sent
    expect(todosFor({ ...base, balance_status: "pending_review" })).toEqual([]);                      // extra payment sent
    expect(todosFor({ ...base, status: "shipped", shipping_status: "paid" })).toEqual([]);
    expect(todosFor({ ...base, status: "cancelled" })).toEqual([]);
  });
  it("pay the shipping fee, and say so when the last receipt was sent back", () => {
    const t = todosFor({ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 });
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ type: "shipping_fee", required: true, text: "Pay your shipping fee of ₱150.00.", to: "/orders/o1", orderNumber: "TF-000001" });
    const back = todosFor({ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150, shipping_note: "Blurry receipt" });
    expect(back[0].note).toBe("Your last receipt was sent back: Blurry receipt");
  });
  it("send the remaining amount of an underpaid payment, for the items or for the shipping fee", () => {
    expect(todosFor({ ...base, balance_status: "awaiting_payment", balance_for: "items", balance_due_php: 250, balance_note: "Receipt shows 1,232" })[0])
      .toMatchObject({ type: "balance", required: true, text: "Send the remaining ₱250.00 of your payment.", note: "Receipt shows 1,232" });
    const ship = todosFor({ ...base, status: "paid", shipping_status: "pending_review", shipping_fee_php: 150, balance_status: "awaiting_payment", balance_for: "shipping", balance_due_php: 40 });
    expect(ship.map((t) => t.type)).toEqual(["balance"]);
    expect(ship[0].text).toBe("Send the remaining ₱40.00 of your shipping fee.");
  });
  it("an open underpayment comes before the shipping fee, never both for one order", () => {
    const t = todosFor({ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150, balance_status: "awaiting_payment", balance_for: "shipping", balance_due_php: 40 });
    expect(t.map((x) => x.type)).toEqual(["balance"]);
  });
  it("choosing a courier is offered, but optional, and only before the shipping fee is set", () => {
    const t = todosFor({ ...base, preferred_courier: null });
    expect(t).toEqual([expect.objectContaining({ type: "courier", required: false })]);
    expect(todosFor({ ...base, preferred_courier: null, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 10 }).map((x) => x.type)).toEqual(["shipping_fee"]);
  });
  it("lists required work first and counts only the required, and a changed amount is a new to-do", () => {
    const orders = [{ ...base, id: "a", preferred_courier: null }, { ...base, id: "b", status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 }];
    const all = allTodos(orders);
    expect(all.map((t) => t.type)).toEqual(["shipping_fee", "courier"]);
    expect(requiredCount(all)).toBe(1);
    expect(todosFor({ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 150 })[0].key)
      .not.toBe(todosFor({ ...base, status: "paid", shipping_status: "awaiting_payment", shipping_fee_php: 200 })[0].key);
    expect(allTodos(null)).toEqual([]);
  });
});
