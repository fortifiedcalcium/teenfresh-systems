import { AUTH_DECOR_ENABLED } from "~/lib/features";
import { supabase } from "~/lib/supabaseClient";
import { imageUrl } from "~/lib/eventImages";

/** The nearest upcoming event's title and poster, for the decorative photocard beside the sign-in/sign-up form. Best-effort: stays null
 *  while loading, and if there is no upcoming event or it has no poster yet, so the panel only appears once there is something to show. */
export function useAuthDecor() {
  const decor = ref<{ title: string; poster: string } | null>(null);
  onMounted(async () => {
    if (!AUTH_DECOR_ENABLED) return;   // switched off: the form stays a single centred card
    const { data: ev } = await supabase.from("events").select("id,title").gte("event_date", new Date().toISOString()).order("event_date").limit(1).maybeSingle();
    if (!ev) return;
    const { data: img } = await supabase.from("event_images").select("*").eq("event_id", ev.id).eq("slot", "poster").maybeSingle();
    const url = imageUrl(img);
    if (url) decor.value = { title: ev.title, poster: url };
  });
  return decor;
}
