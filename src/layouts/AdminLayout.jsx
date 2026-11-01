import React, { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { Loading } from "../components/Spinner.jsx";
import { SkipLink } from "../a11y.jsx";
import logo from "../logo/teenfresh-logo.png";
import { IconDashboard, IconCalendar, IconWallet, IconUsers, IconScan, IconChecklist, IconMail, IconShield, IconHistory, IconArrowLeft, IconLogOut, IconMenu, IconClose } from "../components/NavIcons.jsx";

const NAV = [
  ["/admin", "Dashboard", IconDashboard, true],
  ["/admin/events", "Events", IconCalendar],
  ["/admin/payments", "Payments", IconWallet],
  ["/admin/attendees", "Attendees", IconUsers],
  ["/admin/scanner", "QR Scanner", IconScan],
  ["/admin/tracker", "Attendance", IconChecklist],
  ["/admin/emails", "Email", IconMail],
  ["/admin/users", "Admin users", IconShield],
  ["/admin/changelog", "Change log", IconHistory],
];

/** Sidebar layout. Loads the events once and shares the selected one with every admin page through Outlet context. */
export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(() => { try { return localStorage.getItem("admin_event") || ""; } catch { return ""; } });

  const reload = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
    setEvents(data || []);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const event = events?.find((e) => e.id === eventId) || events?.[0] || null;
  const select = (id) => { setEventId(id); try { localStorage.setItem("admin_event", id); } catch { /* ignore */ } };

  return (
    <div className="min-h-screen lg:flex">
      <SkipLink />
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b-2 border-ink bg-brand-cream px-4 py-2 lg:hidden">
        <button className="btn-secondary" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen(!open)}>{open ? <IconClose /> : <IconMenu />}{open ? "Close menu" : "Menu"}</button>
        <span className="flex items-center gap-2 font-bold"><img src={logo} alt="Teenfresh" width="94" height="20" className="h-5 w-auto" />Admin</span>
      </header>
      <aside id="admin-nav" aria-label="Admin sidebar" className={`${open ? "block" : "hidden"} fixed inset-x-0 top-[3.75rem] z-20 max-h-[calc(100vh-3.75rem)] overflow-y-auto border-b-2 border-ink bg-brand-cream p-3 lg:static lg:block lg:max-h-none lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r-2 lg:p-4`}>
        <div className="mb-3 hidden px-2 lg:block"><img src={logo} alt="Teenfresh" width="188" height="40" className="h-10 w-auto" /><p className="mt-1 text-lg font-extrabold">Admin</p></div>
        <nav aria-label="Admin" className="space-y-1">
          {NAV.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} className="nav-link flex w-full" onClick={() => setOpen(false)}><Icon />{label}</NavLink>)}
        </nav>
        <div className="mt-6 space-y-1 border-t-2 border-ink pt-4 text-sm">
          <p className="truncate px-2 text-ink-muted">{profile?.email}</p>
          <Link to="/" className="nav-link flex w-full"><IconArrowLeft />Attendee site</Link>
          <button onClick={signOut} className="nav-link flex w-full text-left"><IconLogOut />Sign out</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <section aria-label="Event selection" className="flex flex-wrap items-center gap-2 border-b border-link bg-brand-cream px-4 py-3">
          <label htmlFor="event-select" className="text-sm font-semibold">Event</label>
          <select id="event-select" className="input max-w-md" value={event?.id || ""} onChange={(e) => select(e.target.value)} disabled={!events?.length}>
            {events?.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            {events && !events.length && <option>No events yet</option>}
          </select>
        </section>
        <main id="main-content" tabIndex={-1} className="p-4 lg:p-6">
          {events === null ? <Loading label="Loading events…" /> : <Outlet context={{ events, event, reloadEvents: reload }} />}
        </main>
      </div>
    </div>
  );
}
