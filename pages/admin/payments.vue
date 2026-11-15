<script setup>
import { SHOP_ENABLED } from "~/lib/features.js";

// Event payments and shop orders on one admin page, so the menu stays short.
const TABS = [{ key: "event", label: "Event payments" }, ...(SHOP_ENABLED ? [{ key: "shop", label: "Shop orders" }] : [])];
const [active, select] = useHubTab(TABS);
</script>

<template>
  <EventPayments v-if="TABS.length === 1" />
  <AdminTabs v-else id="pay" label="Payments" :tabs="TABS" :active="active" @change="select">
    <ShopOrders v-if="active === 'shop'" />
    <EventPayments v-else />
  </AdminTabs>
</template>
