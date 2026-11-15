import { supabase } from "~/lib/supabaseClient.js";

/** Keeps a page up to date without the browser's refresh button: when a row of `table` changes (Supabase Realtime), `reload()` runs,
 *  at most once a second however many changes arrive at once, and a slow poll catches anything Realtime misses.
 *  `filter` narrows what is listened to, for example "user_id=eq.<id>". Realtime only sends rows the person is allowed to read.
 *  `enabled` and `filter` may be refs or plain values. */
let channels = 0;
export function useLiveReload(table, reload, { enabled = true, filter, throttleMs = 1000, pollMs = 60000 } = {}) {
  const id = ++channels;
  let stop = () => {};
  const start = (on, flt) => {
    stop();
    if (!on) return;
    let timer = null; let last = 0; let stopped = false;                      // a late event after the page closed must do nothing
    const run = () => { last = Date.now(); reload(); };
    const schedule = () => {
      if (timer || stopped) return;                                          // one reload is already queued
      timer = setTimeout(() => { timer = null; run(); }, Math.max(0, throttleMs - (Date.now() - last)));
    };
    const ch = supabase.channel(`live-${table}-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(flt ? { filter: flt } : {}) }, schedule)
      .subscribe();
    const poll = setInterval(schedule, pollMs);
    stop = () => { stopped = true; clearTimeout(timer); clearInterval(poll); supabase.removeChannel(ch); stop = () => {}; };
  };
  watch(() => [unref(enabled), unref(filter)], ([on, flt]) => start(on, flt), { immediate: true });
  onScopeDispose(() => stop());
}
