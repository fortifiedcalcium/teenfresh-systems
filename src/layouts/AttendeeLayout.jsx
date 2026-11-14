import React, { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SkipLink } from "../a11y.jsx";
import logo from "../logo/teenfresh-logo.png";
import { useCart } from "../lib/cart.jsx";
import { SHOP_ENABLED } from "../lib/features.js";
import { useShopperTodos } from "../hooks/useShopperTodos.js";
import TodoBell from "../components/TodoBell.jsx";
import { useToast } from "../components/Toast.jsx";
import { playChime, unlockChime } from "../lib/chime.js";
import { IconBag, IconCart, IconPackage, IconCalendar, IconTicket, IconDashboard, IconLogIn, IconLogOut, IconUserPlus } from "../components/NavIcons.jsx";
import { FacebookIcon, InstagramIcon, TikTokIcon, XIcon } from "../components/SocialIcons.jsx";

const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL;
// One handle on every network. The "@teenfreshph" text next to the icons is plain text, not a link.
const SOCIALS = [
  { name: "Facebook", href: "https://www.facebook.com/TeenfreshPH", Icon: FacebookIcon },
  { name: "X", href: "https://x.com/TeenfreshPH", Icon: XIcon },
  { name: "Instagram", href: "https://www.instagram.com/teenfreshph", Icon: InstagramIcon },
  { name: "TikTok", href: "https://www.tiktok.com/@teenfreshph", Icon: TikTokIcon },
];

export default function AttendeeLayout() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const toast = useToast();
  // something is waiting on the shopper (a payment, a receipt): a badge on My orders, and a toast when a new one appears
  const { todos } = useShopperTodos(user?.id, SHOP_ENABLED && Boolean(user), (fresh) => { fresh.forEach((t) => toast(`Order ${t.orderNumber}: ${t.text}`, "info")); playChime("shopper"); });
  useEffect(() => unlockChime(), []);                                        // the browser allows sound after the first click or key press
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-brand-cream">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2" aria-label="Main">
          <Link to="/" className="nav-link -ml-3" aria-label="Teenfresh Events, home"><img src={logo} alt="" width="188" height="40" className="h-10 w-auto" /></Link>
          <div className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className="nav-link" title="Events"><IconCalendar /><span className="sr-only">Events</span></NavLink>
            {SHOP_ENABLED && <NavLink to="/shop" className="nav-link" title="Shop"><IconBag /><span className="sr-only">Shop</span></NavLink>}
            {SHOP_ENABLED && <NavLink to="/cart" className="nav-link" title="Cart"><IconCart /><span className="sr-only">Cart</span>{count > 0 && <span aria-hidden="true">({count})</span>}{count > 0 && <span className="sr-only">, {count} items</span>}</NavLink>}
            {SHOP_ENABLED && user && <TodoBell todos={todos} />}
            {SHOP_ENABLED && user && <NavLink to="/my-orders" className="nav-link" title="My orders"><IconPackage /><span className="sr-only">My orders</span></NavLink>}
            {user && <NavLink to="/my-registrations" className="nav-link" title="My registrations"><IconTicket /><span className="sr-only">My registrations</span></NavLink>}
            {isAdmin && <NavLink to="/admin" className="nav-link" title="Admin"><IconDashboard /><span className="sr-only">Admin</span></NavLink>}
            {user ? (
              <button className="btn-secondary ml-2" onClick={signOut} title="Sign out"><IconLogOut /><span className="sr-only">Sign out</span></button>
            ) : (
              <>
                <NavLink to="/login" className="nav-link" title="Sign in"><IconLogIn /><span className="sr-only">Sign in</span></NavLink>
                <Link to="/register" className="btn-primary ml-1" title="Sign up"><IconUserPlus /><span className="sr-only">Sign up</span></Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6"><Outlet /></main>
      <footer className="border-t-2 border-ink bg-brand-cream py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap px-4 items-center justify-center gap-x-6 gap-y-2 sm:justify-start">
          <nav aria-label="Social media" className="social-row">
            <ul className="social-icons">
              {SOCIALS.map(({ name, href, Icon }) => (
                <li key={name}><a href={href} className="social-link" aria-label={name} title={name} target="_blank" rel="noopener noreferrer"><Icon size={40} /></a></li>
              ))}
            </ul>
            <p className="social-handle">@teenfreshph</p>
          </nav>
          <a href={SUPPORT ? `mailto:${SUPPORT}?subject=Accessibility%20issue` : "https://x.com/TeenfreshPH"} className="text-sm sm:ml-auto">Report an accessibility issue</a>
        </div>
      </footer>
    </div>
  );
}
