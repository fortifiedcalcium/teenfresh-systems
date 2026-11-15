<script lang="ts">
// Dialogs can open on top of each other (review dialog -> confirm dialog): only the top one reacts to Esc and Tab.
// Order comes from mount order (a dialog opened from inside another mounts later), not from event order.
const stack = [];
let seq = 0;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
</script>

<script setup lang="ts">
// Accessible dialog: labelled by its heading, focus moves in and is trapped, Esc closes, focus returns to the trigger.
defineProps({ title: String, wide: Boolean });
const emit = defineEmits(["close"]);
const box = ref(null);
const titleId = `modal-title-${++seq}`;
const order = seq;
let opener = null;
let prevOverflow = "";
const me = { order };

const onKey = (e) => {
  if (Math.max(...stack.map((m) => m.order)) !== order) return;
  if (e.key === "Escape") { e.stopPropagation(); emit("close"); return; }
  if (e.key !== "Tab") return;
  const els = [...box.value.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!els.length) { e.preventDefault(); return; }
  const first = els[0], last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
};

onMounted(() => {
  opener = document.activeElement; // restored on close
  stack.push(me);
  (box.value.querySelector("[data-autofocus]") || box.value.querySelector(FOCUSABLE) || box.value).focus();
  document.addEventListener("keydown", onKey);
  prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  stack.splice(stack.indexOf(me), 1);
  document.removeEventListener("keydown", onKey);
  document.body.style.overflow = prevOverflow;
  opener?.focus?.();
});
</script>

<template>
  <div role="presentation" class="overlay fixed inset-0 z-40 flex items-stretch justify-center md:items-center md:p-4" @mousedown="(e) => e.target === e.currentTarget && emit('close')">
    <div ref="box" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" :class="['modal-panel h-[100vh] h-dvh w-full overflow-y-auto border-link bg-white p-5 pb-[calc(1.25rem+var(--safe-bottom))] pt-[calc(0.75rem+var(--safe-top))] md:h-auto md:max-h-[92vh] md:rounded-2xl md:border md:pb-5 md:pt-5', wide ? 'md:max-w-3xl' : 'md:max-w-lg']">
      <div class="mx-auto mb-2 h-1.5 w-12 rounded-full bg-brand-sky md:hidden" aria-hidden="true" />
      <div class="mb-4 flex items-center justify-between gap-2">
        <h2 :id="titleId" class="text-lg font-black">{{ title }}</h2>
        <button type="button" class="btn-secondary" :aria-label="`Close dialog: ${title}`" @click="emit('close')"><IconClose /></button>
      </div>
      <slot />
    </div>
  </div>
</template>
