<script setup>
defineProps({ label: String, value: [String, Number], sub: String, icon: Object, tone: { type: String, default: "text-ink" } });
</script>

<template>
  <div class="card stat-card p-4"><dt class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><component :is="icon" v-if="icon" />{{ label }}</dt><dd :class="`mt-1 text-3xl font-extrabold ${tone}`">{{ value }}</dd><dd v-if="sub" class="text-xs text-ink-muted">{{ sub }}</dd></div>
</template>
