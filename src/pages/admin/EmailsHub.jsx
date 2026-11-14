import React, { lazy, Suspense } from "react";
import { SHOP_ENABLED } from "../../lib/features.js";
import AdminTabs, { useHubTab } from "../../components/admin/AdminTabs.jsx";
import { Loading } from "../../components/Spinner.jsx";
import EmailTemplates from "./EmailTemplates.jsx";
const OrderEmails = lazy(() => import("./OrderEmails.jsx"));

const TABS = [{ key: "event", label: "Event emails" }, ...(SHOP_ENABLED ? [{ key: "shop", label: "Shop order emails" }] : [])];

/** Event emails and shop order emails on one admin page, so the menu stays short. */
export default function EmailsHub() {
  const [active, select] = useHubTab(TABS);
  if (TABS.length === 1) return <EmailTemplates />;
  return (
    <AdminTabs id="mail" label="Emails" tabs={TABS} active={active} onChange={select}>
      {active === "shop" ? <Suspense fallback={<Loading label="Loading emails…" />}><OrderEmails /></Suspense> : <EmailTemplates />}
    </AdminTabs>
  );
}
