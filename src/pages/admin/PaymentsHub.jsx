import React, { lazy, Suspense } from "react";
import { SHOP_ENABLED } from "../../lib/features.js";
import AdminTabs, { useHubTab } from "../../components/admin/AdminTabs.jsx";
import { Loading } from "../../components/Spinner.jsx";
import Payments from "./Payments.jsx";
const Orders = lazy(() => import("./Orders.jsx"));

const TABS = [{ key: "event", label: "Event payments" }, ...(SHOP_ENABLED ? [{ key: "shop", label: "Shop orders" }] : [])];

/** Event payments and shop orders on one admin page, so the menu stays short. */
export default function PaymentsHub() {
  const [active, select] = useHubTab(TABS);
  if (TABS.length === 1) return <Payments />;
  return (
    <AdminTabs id="pay" label="Payments" tabs={TABS} active={active} onChange={select}>
      {active === "shop" ? <Suspense fallback={<Loading label="Loading orders…" />}><Orders /></Suspense> : <Payments />}
    </AdminTabs>
  );
}
