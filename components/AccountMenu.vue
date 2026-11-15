<script setup lang="ts">
import type { PropType } from "vue";

// The signed-in person's account menu: My orders, My registrations, Notifications, Admin (admins only) and Sign out, in one dropdown.
// On the desktop navbar it opens under the button; in the phone's bottom bar it opens upwards.
const props = defineProps({ isAdmin: Boolean, shop: Boolean, todos: Array as PropType<any[]>, unseen: { type: Number, default: 0 }, above: Boolean, labelled: { type: Boolean, default: true } });
const emit = defineEmits(["signOut", "openTodos"]);
const { open, toggle, close, btn, panel, pos, id } = usePopover("right", { keep: ".notif-panel", above: props.above });
const style = computed(() => ({ left: `${pos.value.left}px`, width: `${Math.min(pos.value.width, 288)}px`, ...(pos.value.bottom != null ? { bottom: `${pos.value.bottom}px` } : { top: `${pos.value.top}px` }) }));
</script>

<template>
  <button ref="btn" type="button" :class="['relative', above ? 'public-nav-item' : 'pill-link']" :aria-expanded="open" :aria-controls="id" title="Account" @click="toggle">
    <IconUser />
    <span :class="above ? 'public-nav-item__label' : 'sr-only md:not-sr-only'">Account</span>
    <span v-if="unseen > 0" aria-hidden="true" class="notif-badge">{{ unseen > 99 ? "99+" : unseen }}</span>
    <span v-if="unseen > 0" class="sr-only">, {{ unseen }} new</span>
  </button>
  <Teleport to="body">
    <div v-if="open" :id="id" ref="panel" role="region" aria-label="Account" class="notif-panel" :style="style">
      <ul class="py-1">
        <li v-if="shop"><NuxtLink to="/my-orders" class="notif-item" @click="close"><IconPackage />My orders</NuxtLink></li>
        <li><NuxtLink to="/my-registrations" class="notif-item" @click="close"><IconTicket />My registrations</NuxtLink></li>
        <li v-if="isAdmin"><NuxtLink to="/admin" class="notif-item" @click="close"><IconDashboard />Admin</NuxtLink></li>
        <li v-if="shop"><TodoBell menu :todos="todos" :unseen="unseen" @open="emit('openTodos')" /></li>
      </ul>
      <div class="border-t border-brand-sky"><button type="button" class="notif-item w-full font-bold" @click="() => { close(); emit('signOut'); }"><IconLogOut />Sign out</button></div>
    </div>
  </Teleport>
</template>
