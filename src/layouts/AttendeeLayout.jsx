import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SkipLink } from "../a11y.jsx";
import logo from "../logo/teenfresh-logo.png";
import { IconCalendar, IconTicket, IconDashboard, IconLogIn, IconLogOut, IconUserPlus } from "../components/NavIcons.jsx";
import { FacebookIcon, MailIcon, XIcon } from "../components/SocialIcons.jsx";

const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL;

export default function AttendeeLayout() {
  const { user, isAdmin, signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-brand-cream">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2" aria-label="Main">
          <Link to="/" className="nav-link" aria-label="Teenfresh Events, home"><img src={logo} alt="" width="188" height="40" className="h-10 w-auto" /></Link>
          <div className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className="nav-link"><IconCalendar />Events</NavLink>
            {user && <NavLink to="/my-registrations" className="nav-link"><IconTicket />My registrations</NavLink>}
            {isAdmin && <NavLink to="/admin" className="nav-link"><IconDashboard />Admin</NavLink>}
            {user ? (
              <button className="btn-secondary ml-2" onClick={signOut}><IconLogOut />Sign out</button>
            ) : (
              <>
                <NavLink to="/login" className="nav-link"><IconLogIn />Sign in</NavLink>
                <Link to="/register" className="btn-primary ml-1"><IconUserPlus />Sign up</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6"><Outlet /></main>
      <footer className="border-t-2 border-ink bg-brand-cream px-4 py-4 text-center text-sm">
        <img src={logo} alt="Teenfresh" width="141" height="30" className="mx-auto mb-2 h-[30px] w-auto" loading="lazy" />
        <ul aria-label="Teenfresh on social media and support" className="flex flex-wrap items-center justify-center gap-x-6">
          <li><a href="https://www.facebook.com/TeenfreshPH" className="inline-flex min-h-target items-center gap-2"><FacebookIcon />Facebook /TeenfreshPH</a></li>
          <li><a href="https://x.com/TeenfreshPH" className="inline-flex min-h-target items-center gap-2"><XIcon />X @TeenfreshPH</a></li>
          <li><a href={SUPPORT ? `mailto:${SUPPORT}?subject=Accessibility%20issue` : "https://x.com/TeenfreshPH"} className="inline-flex min-h-target items-center gap-2"><MailIcon />Report an accessibility issue</a></li>
        </ul>
      </footer>
    </div>
  );
}
