<script setup lang="ts">
import type { PropType } from "vue";
import { supabase } from "~/lib/supabaseClient";
import { friendlyError } from "~/lib/api";
import { OTHER_COURIER, courierValue, splitCourier } from "~/lib/orders";

// The shopper picks the courier they would like for delivery. It can be changed until the order ships.
const props = defineProps({ order: { type: Object as PropType<Record<string, any>> as PropType<Record<string, any>>, required: true } });
const emit = defineEmits(["saved"]);
const toast = useToast();
const couriers = useCouriers();
const choice = ref("");
const other = ref("");
const error = ref("");
const busy = ref(false);
// start from the courier already on the order, once the list has loaded (a name that is no longer in the list shows as "Other")
watch([couriers, () => props.order.preferred_courier], () => { if (!couriers.value) return; const s = splitCourier(props.order.preferred_courier, couriers.value); choice.value = s.choice; other.value = s.other; }, { immediate: true });

async function save() {
  error.value = "";
  const c = courierValue(choice.value, other.value);
  if (c.error) { error.value = c.error; return; }
  busy.value = true;
  const { error: err } = await supabase.rpc("set_preferred_courier", { p_order: props.order.id, p_courier: c.value });
  busy.value = false;
  if (err) { error.value = friendlyError(err); return; }
  toast(`Preferred courier saved: ${c.value}`, "success");
  emit("saved");
}
</script>

<template>
  <form class="space-y-3 border-t border-brand-sky pt-3" novalidate aria-labelledby="courier-pref-h" @submit.prevent="save">
    <h3 id="courier-pref-h" class="font-black">Preferred courier</h3>
    <p class="text-ink-muted">Pick the courier you would like us to use. We will try to ship with it. You can change it until your order ships.</p>
    <Alert v-if="error" tone="bad">{{ error }}</Alert>
    <Field id="pref_courier" v-slot="a" label="Courier" required>
      <select v-bind="a" v-model="choice" class="input">
        <option value="">Choose a courier…</option>
        <option v-for="c in couriers || []" :key="c" :value="c">{{ c }}</option>
        <option :value="OTHER_COURIER">{{ OTHER_COURIER }}…</option>
      </select>
    </Field>
    <Field v-if="choice === OTHER_COURIER" id="pref_courier_other" v-slot="a" label="Courier name" required><input v-bind="a" v-model="other" class="input" maxlength="60"></Field>
    <button class="btn-secondary" :disabled="busy"><IconSave />{{ busy ? "Saving…" : order.preferred_courier ? "Update courier" : "Save courier" }}</button>
  </form>
</template>
