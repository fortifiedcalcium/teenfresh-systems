import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SkipLink } from "../a11y.jsx";
import logo from "../logo/teenfresh-logo.png";
import { IconCalendar, IconTicket, IconDashboard, IconLogIn, IconLogOut, IconUserPlus } from "../components/NavIcons.jsx";
import { FacebookIcon, InstagramIcon, TikTokIcon, XIcon } from "../components/SocialIcons.jsx";

const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL;
// One handle on every network. The first link is also the "main" profile the @teenfreshph text points to.
const SOCIALS = [
  { name: "Facebook", href: "https://www.facebook.com/TeenfreshPH", Icon: FacebookIcon },
  { name: "X", href: "https://x.com/TeenfreshPH", Icon: XIcon },
  { name: "Instagram", href: "https://www.instagram.com/teenfreshph", Icon: InstagramIcon },
  { name: "TikTok", href: "https://www.tiktok.com/@teenfreshph", Icon: TikTokIcon },
];

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
      <footer className="border-t-2 border-ink bg-brand-cream px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-start">
          <nav aria-label="Social media" className="social-row">
            <ul className="social-icons">
              {SOCIALS.map(({ name, href, Icon }) => (
                <li key={name}><a href={href} className="social-link" aria-label={name} title={name} target="_blank" rel="noopener noreferrer"><Icon size={40} /></a></li>
              ))}
            </ul>
            <a href={SOCIALS[0].href} className="social-handle" target="_blank" rel="noopener noreferrer">@teenfreshph</a>
          </nav>
          <a href={SUPPORT ? `mailto:${SUPPORT}?subject=Accessibility%20issue` : "https://x.com/TeenfreshPH"} className="text-sm sm:ml-auto">Report an accessibility issue</a>
        </div>
      </footer>
    </div>
  );
}
