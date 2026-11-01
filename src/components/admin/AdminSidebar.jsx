import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { SIDEBAR } from "./adminNav.js";
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconLogOut } from "../NavIcons.jsx";
import logo from "../../logo/teenfresh-logo.png";

const KEY = "admin_sidebar_collapsed";
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** Desktop navigation (1024px and up): 240px (260px at 1536+), collapsible to an icon rail. Hidden below 1024px
 *  with display:none, so it is not in the accessibility tree while the bottom bar is. */
export default function AdminSidebar({ email, onSignOut, pending = 0 }) {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(KEY, c ? "0" : "1"); } catch { /* ignore */ } return !c; });
  const label = (t) => <span className={collapsed ? "sr-only" : ""}>{t}</span>;
  return (
    <aside id="admin-nav" aria-label="Admin sidebar" data-collapsed={collapsed}
      className={`on-ink-off hidden shrink-0 border-r-2 border-ink bg-brand-cream p-4 lg:block ${collapsed ? "lg:w-[84px]" : "lg:w-60 2xl:w-[260px]"}`}>
      <div className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto">
        <div className="mb-3 flex items-center justify-between gap-1 px-1">
          {collapsed ? <span className="sr-only">Admin</span> : <div><img src={logo} alt="Teenfresh" width="188" height="40" className="h-10 w-auto" /><p className="mt-1 text-lg font-extrabold">Admin</p></div>}
          <button type="button" className="btn-secondary min-w-target px-2" aria-expanded={!collapsed} aria-controls="admin-nav-list" onClick={toggle}>
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}<span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
        </div>
        <nav aria-label="Admin">
          <ul id="admin-nav-list" className="space-y-1">
            {SIDEBAR.map(([to, text, Icon, end, badge]) => (
              <li key={to}>
                <NavLink to={to} end={end} className={`nav-link flex w-full ${collapsed ? "justify-center px-0" : ""}`} title={collapsed ? text : undefined}>
                  <Icon />{label(text)}
                  {badge === "pending" && pending > 0 && <span className="ml-auto rounded-full bg-brand-coral px-2 text-xs font-extrabold text-ink"><span aria-hidden="true">{pending > 99 ? "99+" : pending}</span><span className="sr-only"> {pending} payments pending verification</span></span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-6 space-y-1 border-t-2 border-ink pt-4 text-sm">
          {!collapsed && <p className="truncate px-2 text-ink-muted">{email}</p>}
          <Link to="/" className={`nav-link flex w-full ${collapsed ? "justify-center px-0" : ""}`}><IconArrowLeft />{label("Attendee site")}</Link>
          <button onClick={onSignOut} className={`nav-link flex w-full text-left ${collapsed ? "justify-center px-0" : ""}`}><IconLogOut />{label("Sign out")}</button>
        </div>
      </div>
    </aside>
  );
}
