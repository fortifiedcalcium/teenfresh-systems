<script setup lang="ts">
import type { PropType } from "vue";
import { MEDIA } from "~/lib/breakpoints";

// A page action (e.g. Export CSV). On desktop it is the normal labelled button in the page. Below 1024px it moves into the
// top bar as an icon button with a visible short label and a tooltip. `icon` is an icon component.
defineProps({ label: String, icon: Object as PropType<Record<string, any>>, disabled: Boolean, btnClass: { type: String, default: "btn-secondary" }, short: String });
const emit = defineEmits(["click"]);
const small = useMediaQuery(MEDIA.bottomNav);
const slot = ref(null);
watch(small, (s) => { slot.value = s ? document.getElementById("admin-topbar-actions") : null; }, { immediate: true, flush: "post" });
onMounted(() => { slot.value = small.value ? document.getElementById("admin-topbar-actions") : null; });
</script>

<template>
  <Teleport v-if="small && slot" :to="slot">
    <button type="button" class="btn-secondary min-w-target flex-col gap-0 px-2 py-1 text-xs leading-tight" :disabled="disabled" :title="label" @click="emit('click')">
      <component :is="icon" /><span>{{ short || label }}</span>
    </button>
  </Teleport>
  <button v-else type="button" :class="btnClass" :disabled="disabled" @click="emit('click')"><component :is="icon" />{{ label }}</button>
</template>
