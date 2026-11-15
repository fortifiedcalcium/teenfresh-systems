<script setup lang="ts">
// Copies text and says so out loud: the live region announces "copied", and the label changes for everyone else.
const props = defineProps({ text: String, label: { type: String, default: "Copy number" }, what: { type: String, default: "GCash number" }, iconOnly: Boolean });
const announce = useAnnounce();
const state = ref("idle"); // idle | copied | failed
let timer = null;
onBeforeUnmount(() => clearTimeout(timer));

async function copy() {
  let ok = false;
  try { await navigator.clipboard.writeText(props.text); ok = true; } catch {
    try { // older browsers / insecure origins
      const ta = Object.assign(document.createElement("textarea"), { value: props.text });
      ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove();
    } catch { ok = false; }
  }
  state.value = ok ? "copied" : "failed";
  announce(ok ? `${props.what} copied to the clipboard` : `Could not copy the ${props.what}. Select it and copy it by hand.`, ok ? "polite" : "assertive");
  clearTimeout(timer);
  timer = setTimeout(() => { state.value = "idle"; }, 4000);
}
</script>

<template>
  <button type="button" :class="iconOnly ? 'btn-secondary min-w-target shrink-0 px-2' : 'btn-secondary'" @click="copy">
    <template v-if="iconOnly">
      <IconCheck v-if="state === 'copied'" /><IconAlert v-else-if="state === 'failed'" /><IconCopy v-else />
      <span class="sr-only">{{ state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label }}</span>
    </template>
    <template v-else-if="state === 'copied'"><IconCheck />Copied</template>
    <template v-else-if="state === 'failed'"><IconAlert />Copy failed</template>
    <template v-else><IconCopy />{{ label }}</template>
  </button>
</template>
