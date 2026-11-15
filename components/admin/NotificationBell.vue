<script setup>
import { pendingNotes, totalUnread } from "~/lib/notifications.js";
import { setSoundEnabled, soundEnabled } from "~/lib/chime.js";

// The notification button: a bell with the number of NEW things, and a list that links to where each is handled.
// Opening an item (or the page it leads to) marks it read, and its counter goes away until something new arrives.
// Things already seen but still waiting stay listed below, without a counter. New arrivals also show as a toast and play a short chime.
const props = defineProps({ counts: Object, unread: Object, align: { type: String, default: "left" }, iconOnly: { type: Boolean, default: true } });
const emit = defineEmits(["read", "readAll"]);
const { open, toggle, close, btn, panel, pos, id } = usePopover(props.align);
const sound = ref(soundEnabled());
const waiting = computed(() => pendingNotes(props.counts));
const fresh = computed(() => waiting.value.filter((n) => (props.unread?.[n.key] || 0) > 0));
const seen = computed(() => waiting.value.filter((n) => !((props.unread?.[n.key] || 0) > 0)));
const total = computed(() => totalUnread(props.unread));
const flip = () => { sound.value = !sound.value; setSoundEnabled(sound.value); };
const go = (n) => { emit("read", [n.key]); close(); };
</script>

<template>
  <button ref="btn" type="button" class="btn-secondary relative min-w-target px-2" :aria-expanded="open" :aria-controls="id" :aria-label="iconOnly ? (total > 0 ? `Notifications, ${total} new` : 'Notifications, nothing new') : undefined" @click="toggle">
    <IconBell />
    <span v-if="!iconOnly">Notifications</span>
    <span v-if="total > 0" aria-hidden="true" class="notif-badge">{{ total > 99 ? "99+" : total }}</span>
    <span v-if="!iconOnly" class="sr-only">{{ total > 0 ? `, ${total} new` : ", nothing new" }}</span>
  </button>
  <Teleport to="body">
    <div v-if="open" :id="id" ref="panel" role="region" aria-label="Notifications" class="notif-panel" :style="{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }">
      <h2 class="notif-title">{{ total > 0 ? "New" : "No new notifications" }}</h2>
      <ul v-if="fresh.length > 0">
        <li v-for="n in fresh" :key="n.key">
          <NuxtLink :to="n.to" class="notif-item" @click="go(n)">
            <span class="notif-count" aria-hidden="true">{{ unread[n.key] }}</span>
            <span><span class="sr-only">{{ unread[n.key] }} new: </span>{{ n.label }}</span>
          </NuxtLink>
        </li>
      </ul>
      <div v-if="fresh.length > 0" class="px-4 pb-2"><button type="button" class="btn-secondary w-full" @click="emit('readAll')">Mark all as read</button></div>
      <p v-if="fresh.length === 0 && waiting.length === 0" class="p-3 text-sm text-ink-muted">Nothing needs your attention right now.</p>
      <template v-if="seen.length > 0">
        <h3 class="notif-sub">Still waiting (already seen)</h3>
        <ul>
          <li v-for="n in seen" :key="n.key"><NuxtLink :to="n.to" class="notif-item notif-item--seen" @click="go(n)">{{ n.label }}</NuxtLink></li>
        </ul>
      </template>
      <label class="notif-sound">
        <input type="checkbox" role="switch" class="check" :checked="sound" @change="flip">
        <span>Play a sound for new notifications</span>
      </label>
    </div>
  </Teleport>
</template>
