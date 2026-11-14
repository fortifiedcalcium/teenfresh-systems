import React from "react";
import { STATUS } from "../lib/orders.js";
import Badge from "./Badge.jsx";
import { IconTruck } from "./NavIcons.jsx";

const ICONS = { shipped: <IconTruck /> };

/** The status of a shop order as a badge. Shipped shows a delivery truck; the others use the usual symbol for their colour. */
export default function OrderStatusBadge({ status }) {
  const st = STATUS[status] || STATUS.pending;
  return <Badge tone={st.tone} icon={ICONS[status]}>{st.label}</Badge>;
}
