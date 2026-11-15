<script setup lang="ts">
import type { PropType } from "vue";
// One tab: a real link (so long-press, open in new tab and keyboard behave), icon above label.
// Active state comes from the router's location (aria-current="page"), never from local state.
defineProps({ to: String, label: String, icon: Object as PropType<Record<string, any>>, active: Boolean, badge: { type: Number, default: 0 }, badgeLabel: String });
const emit = defineEmits(["activeClick"]);
</script>

<template>
  <li>
    <NuxtLink :to="to" class="bottom-nav-item h-full w-full" :aria-current="active ? 'page' : undefined" @click="(e) => { if (active) { e.preventDefault(); emit('activeClick'); } }">
      <component :is="icon" />
      <span class="bottom-nav-item__label">{{ label }}</span>
      <template v-if="badge > 0">
        <span class="nav-badge" aria-hidden="true">{{ badge > 99 ? "99+" : badge }}</span>
        <span class="sr-only">{{ badgeLabel || `${badge} pending` }}</span>
      </template>
    </NuxtLink>
  </li>
</template>
