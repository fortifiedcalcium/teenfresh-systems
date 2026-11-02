import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import EventCard from "../../components/EventCard.jsx";
import Alert from "../../components/Alert.jsx";
import { Empty, Loading } from "../../components/Spinner.jsx";
import { useAnnounce } from "../../a11y.jsx";
import { IconCalendar } from "../../components/NavIcons.jsx";

export default function Home() {
  const [events, setEvents] = useState(null);
  const [counts, setCounts] = useState({}); // event_id -> registered
  const [banners, setBanners] = useState({}); // event_id -> banner image row
  const [kits, setKits] = useState({}); // event_id -> its active kits
  const [error, setError] = useState("");
  const announce = useAnnounce();
  const eventsRef = useRef([]);
  const lastAnnounce = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ev, av, im, kt] = await Promise.all([
        supabase.from("events").select("*").order("event_date"),
        supabase.from("event_availability").select("event_id,registered"),
        supabase.from("event_images").select("*").eq("slot", "banner"),
        supabase.from("event_kits").select("event_id,unit_price").eq("active", true),
      ]);
      if (alive) setKits((kt.data || []).reduce((m, k) => ({ ...m, [k.event_id]: [...(m[k.event_id] || []), k] }), {}));
      if (alive) setBanners(Object.fromEntries((im.data || []).map((r) => [r.event_id, r])));
      if (!alive) return;
      if (ev.error || av.error) { setError("We could not load the events. Check your connection and refresh the page."); setEvents([]); return; }
      setCounts(Object.fromEntries(av.data.map((r) => [r.event_id, r.registered])));
      eventsRef.current = ev.data;
      setEvents(ev.data);
    })();

    // Live availability: event_counts is a public counter table (no attendee data) streamed by Realtime.
    // Screen-reader announcements are throttled to one per 10 s so a busy event does not flood the user.
    const ch = supabase.channel("event-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_counts" }, (p) => {
        if (!p.new?.event_id) return;
        setCounts((c) => ({ ...c, [p.new.event_id]: p.new.registered }));
        const ev = eventsRef.current.find((e) => e.id === p.new.event_id);
        if (ev && Date.now() - lastAnnounce.current > 10000) {
          lastAnnounce.current = Date.now();
          announce(`${ev.title}: ${Math.max(ev.capacity - p.new.registered, 0)} of ${ev.capacity} slots left`);
        }
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [announce]);

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-3xl"><IconCalendar />Upcoming events</h1>
      <p className="mb-6 text-ink-muted">Pick an event and reserve your slot.</p>
      {error && <Alert tone="bad" className="mb-4">{error}</Alert>}
      {events === null ? (
        <Loading label="Loading events…" className="p-12" logo />
      ) : events.length === 0 ? (
        <Empty>No events yet. Check back soon!</Empty>
      ) : (
        <ul className="grid auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => <li key={e.id} className="flex"><div className="flex w-full flex-col"><EventCard event={e} registered={counts[e.id] ?? 0} bannerImage={banners[e.id]} kits={kits[e.id] || []} /></div></li>)}
        </ul>
      )}
    </div>
  );
}
