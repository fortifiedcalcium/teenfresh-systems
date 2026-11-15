<script setup lang="ts">
// "Are you sure?" dialog for destructive or irreversible actions. Focus lands on Cancel first.
defineProps({ title: String, confirmLabel: { type: String, default: "Confirm" }, tone: { type: String, default: "danger" }, busy: Boolean });
const emit = defineEmits(["confirm", "cancel"]);
</script>

<template>
  <Modal :title="title" @close="emit('cancel')">
    <div class="space-y-4">
      <div class="text-sm"><slot /></div>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="emit('cancel')"><IconClose />Cancel</button>
        <button type="button" :class="tone === 'danger' ? 'btn-danger' : 'btn-primary'" :disabled="busy" @click="emit('confirm')"><IconTrash v-if="tone === 'danger'" /><IconCheck v-else />{{ busy ? "Working…" : confirmLabel }}</button>
      </div>
    </div>
  </Modal>
</template>
