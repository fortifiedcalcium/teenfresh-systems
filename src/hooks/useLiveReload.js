import { useEffect, useId, useRef } from "react";
import { supabase } from "../lib/supabaseClient.js";

/** Keeps a page up to date without the browser's refresh button: when a row of `table` changes (Supabase Realtime), `reload()` runs,
 *  at most once a second however many changes arrive at once, and a slow poll catches anything Realtime misses.
 *  `filter` narrows what is listened to, for example "user_id=eq.<id>". Realtime only sends rows the person is allowed to read. */
export function useLiveReload(table, reload, { enabled = true, filter, throttleMs = 1000, pollMs = 60000 } = {}) {
  const fn = useRef(reload);
  fn.current = reload;
  const uid = useId();
  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let last = 0;
    let stopped = false;                                                    // a late event after the page closed must do nothing
    const run = () => { last = Date.now(); fn.current(); };
    const schedule = () => {
      if (timer || stopped) return;                                         // one reload is already queued
      timer = setTimeout(() => { timer = null; run(); }, Math.max(0, throttleMs - (Date.now() - last)));
    };
    const ch = supabase.channel(`live-${table}-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, schedule)
      .subscribe();
    const poll = setInterval(schedule, pollMs);
    return () => { stopped = true; clearTimeout(timer); clearInterval(poll); supabase.removeChannel(ch); };
  }, [table, enabled, filter, throttleMs, pollMs, uid]);
}
