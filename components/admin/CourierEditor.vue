<script setup>
import { supabase } from "~/lib/supabaseClient.js";
import { OTHER_COURIER, courierValue, splitCourier } from "~/lib/orders.js";

// Admin: change the courier of an order that has not shipped yet (for example when the shopper's choice cannot deliver there).
// The shopper sees the new courier. Once the shipping fee is set, only an admin can change it.
const props = defineProps({ order: { type: Object, required: true } });
const emit = defineEmits(["saved"]);
const toast = useToast();
const couriers = useCouriers();
const choice = ref("");
const other = ref("");
const error = ref("");
const busy = ref(false);
const locked = computed(() => props.order.shipping_status !== "none");
// start from the courier already on the order, once the list has loaded (a name that is no longer in the list shows as "Other")
watch([couriers, () => props.order.preferred_courier], () => { if (!couriers.value) return; const s = splitCourier(props.order.preferred_courier, couriers.value); choice.value = s.choice; other.value = s.other; }, { immediate: true });

async function save() {
  error.value = "";
  const c = courierValue(choice.value, other.value);
  if (c.error) { error.value = c.error; return; }
  if (c.value === (props.order.preferred_courier || "")) { error.value = "That is already the courier on this order."; return; }
  busy.value = true;
  const { error: err } = await supabase.from("orders").update({ preferred_courier: c.value, updated_at: new Date().toISOString() }).eq("id", props.order.id);
  busy.value = false;
  if (err) { error.value = err.message; return; }
  toast(`Courier changed to ${c.value}`, "success");
  emit("saved");
}
</script>

<template>
  <section aria-labelledby="o-courier-edit" class="space-y-2 rounded-lg border border-brand-sky p-3">
    <h3 id="o-courier-edit" class="font-black">Courier</h3>
    <p class="text-ink-muted">
      <template v-if="order.preferred_courier">The shopper chose <strong>{{ order.preferred_courier }}</strong>. </template><template v-else>The shopper has not chosen a courier yet. </template>
      {{ locked ? "The shipping fee is already set, so the shopper can no longer change it. You still can." : "The shopper can still change it until you set the shipping fee." }}
    </p>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>
    <div class="grid gap-3 md:grid-cols-2">
      <Field id="edit_courier" v-slot="a" label="Courier">
        <select v-bind="a" v-model="choice" class="input">
          <option value="">Choose a courier…</option>
          <option v-for="c in couriers || []" :key="c" :value="c">{{ c }}</option>
          <option :value="OTHER_COURIER">{{ OTHER_COURIER }}…</option>
        </select>
      </Field>
      <Field v-if="choice === OTHER_COURIER" id="edit_courier_other" v-slot="a" label="Courier name"><input v-bind="a" v-model="other" class="input" maxlength="60"></Field>
    </div>
    <div><button type="button" class="btn-secondary" :disabled="busy" @click="save"><IconSave />Save courier</button></div>
  </section>
</template>
