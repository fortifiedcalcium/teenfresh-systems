<script setup>
const { event } = useAdminContext();
const tab = ref("template");
const TABS = [["template", "Confirmation template", "IconMail"], ["bulk", "Bulk mail merge", "IconSend"], ["logs", "Email logs", "IconHistory"]];
</script>

<template>
  <Empty v-if="!event">Create an event first.</Empty>
  <div v-else class="space-y-4">
    <h1 class="flex items-center gap-2 text-2xl font-black"><IconMail />Email</h1>
    <div class="flex flex-wrap gap-2" role="tablist">
      <button v-for="[k, l, i] in TABS" :key="k" type="button" role="tab" :aria-selected="tab === k" :class="tab === k ? 'btn-primary' : 'btn-secondary'" @click="tab = k"><component :is="i" />{{ l }}</button>
    </div>
    <EmailTemplateTab v-if="tab === 'template'" :event="event" />
    <EmailBulkTab v-if="tab === 'bulk'" :event="event" />
    <EmailLogsTab v-if="tab === 'logs'" :event="event" />
  </div>
</template>
