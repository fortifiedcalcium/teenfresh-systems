import React from "react";
import { STATUS, displayStatus } from "../lib/orders.js";
import Badge from "./Badge.jsx";
import { IconTruck } from "./NavIcons.jsx";

const ICONS = { shipped: <IconTruck /> };

/** The status of a shop order as a badge. It says "Paid" only once everything is paid, shipping fee included; Shipped shows a delivery truck. */
export default function OrderStatusBadge({ order }) {
  const key = displayStatus(order);
  const st = STATUS[key] || STATUS.pending;
  return <Badge tone={st.tone} icon={ICONS[key]}>{st.label}</Badge>;
}
