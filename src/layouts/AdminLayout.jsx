import React, { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { Loading } from "../components/Spinner.jsx";
import { SkipLink } from "../a11y.jsx";
import AdminSidebar from "../components/admin/AdminSidebar.jsx";
import AdminBottomNav from "../components/admin/AdminBottomNav.jsx";
import AdminTopBar from "../components/admin/AdminTopBar.jsx";
import { usePendingPayments } from "../hooks/usePendingPayments.js";
import { useKeyboardOpen } from "../hooks/useKeyboardOpen.js";

/** Admin frame. Below 1024px: sticky top bar + bottom navigation (raised scan button). From 1024px: the sidebar.
 *  The switch is pure CSS (lg:), so there is no user-agent sniffing and the hidden navigation is display:none.
 *  Loads the events once and shares the selected one with every admin page through Outlet context. */
export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(() => { try { return localStorage.getItem("admin_event") || ""; } catch { return ""; } });
  const pending = usePendingPayments(true);
  const keyboardOpen = useKeyboardOpen();

  const reload = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
    setEvents(data || []);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Keep each tab's scroll position: remember it when leaving a page, restore it when coming back.
  const scrolls = useRef({});
  const prev = useRef(pathname);
  useEffect(() => {
    scrolls.current[prev.current] = window.scrollY;
    prev.current = pathname;
    const y = scrolls.current[pathname] || 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [pathname]);

  const event = events?.find((e) => e.id === eventId) || events?.[0] || null;
  const select = (id) => { setEventId(id); try { localStorage.setItem("admin_event", id); } catch { /* ignore */ } };

  return (
    <div className="min-h-[100vh] min-h-dvh lg:flex">
      <SkipLink />
      <AdminSidebar email={profile?.email} onSignOut={signOut} pending={pending} />
      <div className="min-w-0 flex-1">
        <AdminTopBar />
        <section aria-label="Event selection" className="flex flex-wrap items-center gap-2 border-b border-link bg-brand-cream px-4 py-3">
          <label htmlFor="event-select" className="text-sm font-semibold">Event</label>
          <select id="event-select" className="input max-w-md" value={event?.id || ""} onChange={(e) => select(e.target.value)} disabled={!events?.length}>
            {events?.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            {events && !events.length && <option>No events yet</option>}
          </select>
        </section>
        <main id="main-content" tabIndex={-1} className="admin-main" data-nav-hidden={keyboardOpen}>
          <div className="admin-page">
            {events === null ? <Loading label="Loading events…" /> : <Outlet context={{ events, event, reloadEvents: reload, pending }} />}
          </div>
        </main>
      </div>
      <AdminBottomNav pending={pending} hidden={keyboardOpen} />
    </div>
  );
}
