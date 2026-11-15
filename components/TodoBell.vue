<script setup lang="ts">
import type { PropType } from "vue";
import { setSoundEnabled, soundEnabled } from "~/lib/chime";

// The shopper's notification button: a bell with the number of NEW things waiting on them, and the list of everything they need to do, each linking
// to its order. Opening the list counts as seeing it, so the number goes away until something new arrives. A new one also shows as a toast with a short chime
// (see the attendee layout).
const props = defineProps({ todos: Array as PropType<any[]>, unseen: { type: Number, default: 0 }, menu: Boolean });   // `menu`: a full-width row inside the account menu
const emit = defineEmits(["open"]);
const { open, toggle, close, btn, panel, pos, id } = usePopover("right");
const sound = ref(soundEnabled("shopper"));
const list = computed(() => props.todos || []);
const flip = () => { sound.value = !sound.value; setSoundEnabled(sound.value, "shopper"); };
const onClick = () => { if (!open.value) emit("open"); toggle(); };
</script>

<template>
  <button ref="btn" type="button" :class="menu ? 'notif-item w-full' : 'nav-link relative'" :aria-expanded="open" :aria-controls="id" title="Notifications" :aria-label="unseen > 0 ? `Notifications, ${unseen} new` : 'Notifications, nothing new'" @click="onClick">
    <IconBell />
    <span v-if="menu" class="flex-1 text-left">Notifications</span>
    <span v-if="unseen > 0" aria-hidden="true" :class="menu ? 'notif-count' : 'notif-badge'">{{ unseen > 99 ? "99+" : unseen }}</span>
  </button>
  <Teleport to="body">
    <div v-if="open" :id="id" ref="panel" role="region" aria-label="Notifications" class="notif-panel" :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }">
      <h2 class="notif-title">What you need to do</h2>
      <p v-if="list.length === 0" class="p-3 text-sm text-ink-muted">You are all set. Nothing is waiting on you right now.</p>
      <ul v-else>
        <li v-for="t in list" :key="t.key">
          <NuxtLink :to="t.to" class="notif-item notif-item--todo" @click="close">
            <span class="text-xs font-semibold text-ink-muted">Order {{ t.orderNumber }}{{ t.required ? "" : " · optional" }}</span>
            <span class="font-bold">{{ t.text }}</span>
            <span v-if="t.note" class="text-xs font-normal">{{ t.note }}</span>
          </NuxtLink>
        </li>
      </ul>
      <label class="notif-sound">
        <input type="checkbox" role="switch" class="check" :checked="sound" @change="flip">
        <span>Play a sound when something new needs me</span>
      </label>
    </div>
  </Teleport>
</template>
