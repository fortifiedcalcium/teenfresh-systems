<script setup>
import { SHOP_ENABLED } from "~/lib/features.js";

// Event emails and shop order emails on one admin page, so the menu stays short.
const TABS = [{ key: "event", label: "Event emails" }, ...(SHOP_ENABLED ? [{ key: "shop", label: "Shop order emails" }] : [])];
const [active, select] = useHubTab(TABS);
</script>

<template>
  <EmailTemplates v-if="TABS.length === 1" />
  <AdminTabs v-else id="mail" label="Emails" :tabs="TABS" :active="active" @change="select">
    <OrderEmails v-if="active === 'shop'" />
    <EmailTemplates v-else />
  </AdminTabs>
</template>
