<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { callFunction } from "~/lib/api.js";

definePageMeta({ middleware: ["auth"] });
const route = useRoute();
const { user } = useAuth();
const toast = useToast();
const reg = ref(undefined);
const event = ref(null);
const sending = ref(false);

watch(() => route.params.id, async (id) => {
  // RLS only returns the row if it belongs to the signed-in user
  const { data } = await supabase.from("registrations").select("*").eq("id", id).eq("user_id", user.value.id).maybeSingle();   // my own ticket (admins can read all rows, so ask for mine explicitly)
  reg.value = data ?? null;
  if (data) event.value = (await supabase.from("events").select("*").eq("id", data.event_id).maybeSingle()).data;
}, { immediate: true });

async function resend() {
  sending.value = true;
  try { await callFunction("send-confirmation-email", { registration_id: route.params.id }); toast("Confirmation email sent.", "success"); }
  catch (e) { toast(e.message, "error"); }
  finally { sending.value = false; }
}
</script>

<template>
  <Loading v-if="reg === undefined" />
  <p v-else-if="!reg" class="text-center text-ink-muted">Ticket not found. <NuxtLink class="text-link underline" to="/my-registrations">My registrations</NuxtLink></p>
  <div v-else class="mx-auto max-w-xl space-y-4">
    <h1 class="flex items-center gap-2 text-2xl"><IconTicket />My ticket</h1>
    <TicketCard :registration="reg" :event="event" />
    <div v-if="reg.status === 'confirmed' && reg.ticket_number" class="card space-y-3 p-4 text-sm">
      <h2 class="text-lg font-black">Can't attend? Transfer your slot</h2>
      <p class="text-ink">Your confirmation email is your ticket. To transfer your slot, forward that email to the new owner. We are not responsible for unauthorized leaks of your ticket. Keep it confidential.</p>
      <button type="button" class="btn-secondary" :disabled="sending" @click="resend"><IconSend />{{ sending ? "Sending…" : "Email me my confirmation again" }}</button>
    </div>
    <TermsBox :event="event" />
    <p class="text-center"><NuxtLink class="text-link underline" to="/my-registrations">← My registrations</NuxtLink></p>
  </div>
</template>
