// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminTabs, { useHubTab } from "../src/components/admin/AdminTabs.jsx";

const TABS = [{ key: "event", label: "Event payments" }, { key: "shop", label: "Shop orders" }];
function Hub() {
  const [active, select] = useHubTab(TABS);
  return <AdminTabs id="t" label="Payments" tabs={TABS} active={active} onChange={select}>{active === "shop" ? <p>Orders panel</p> : <p>Payments panel</p>}</AdminTabs>;
}
const show = (url = "/admin/payments") => render(<MemoryRouter initialEntries={[url]}><Hub /></MemoryRouter>);

describe("AdminTabs", () => {
  it("opens the first tab by default and switches when a tab is clicked", async () => {
    const user = userEvent.setup();
    show();
    expect(screen.getByRole("tab", { name: "Event payments" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Payments panel")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Shop orders" }));
    expect(screen.getByText("Orders panel")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Shop orders");
  });
  it("opens the tab named in the address", () => {
    show("/admin/payments?tab=shop");
    expect(screen.getByRole("tab", { name: "Shop orders" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Orders panel")).toBeInTheDocument();
  });
  it("falls back to the first tab for an unknown name", () => {
    show("/admin/payments?tab=nope");
    expect(screen.getByText("Payments panel")).toBeInTheDocument();
  });
  it("moves between tabs with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    show();
    screen.getByRole("tab", { name: "Event payments" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Shop orders" })).toHaveFocus();
    expect(screen.getByText("Orders panel")).toBeInTheDocument();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Event payments" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Shop orders" })).toHaveFocus();
  });
});
