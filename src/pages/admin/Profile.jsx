import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { IconArrowLeft, IconCalendar, IconChevronRight, IconHistory, IconLogOut, IconMail, IconShield, IconUser, IconWallet } from "../../components/NavIcons.jsx";

const MANAGE = [
  ["/admin/events", "Events", "Create events, kits and images", IconCalendar],
  ["/admin/payments", "Payments", "Verify receipts", IconWallet, "pending"],
  ["/admin/emails", "Email templates and logs", "Edit emails, send bulk mail, see logs", IconMail],
  ["/admin/users", "Admin users", "Promote or demote people", IconShield],
  ["/admin/changelog", "Change log", "Who changed what", IconHistory],
];

/** The Profile tab: who is signed in, the pages that have no tab of their own, and sign out. */
export default function Profile() {
  const { profile, signOut } = useAuth();
  const { pending = 0 } = useOutletContext() || {};
  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <h1 className="flex items-center gap-2 md:col-span-2"><IconUser />Profile</h1>
      <section aria-labelledby="acct-h" className="card space-y-2 p-4">
        <h2 id="acct-h">Account</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2"><dt className="font-semibold">Name</dt><dd>{profile?.full_name || "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="font-semibold">Email</dt><dd className="break-all text-right">{profile?.email}</dd></div>
          <div className="flex justify-between gap-2"><dt className="font-semibold">Role</dt><dd><span className="badge badge-info">{profile?.role || "admin"}</span></dd></div>
        </dl>
        <div className="flex flex-col gap-2 pt-2">
          <Link to="/" className="btn-secondary"><IconArrowLeft />Switch to attendee view</Link>
          <button type="button" className="btn-danger" onClick={signOut}><IconLogOut />Sign out</button>
        </div>
      </section>
      <section aria-labelledby="manage-h" className="card p-2">
        <h2 id="manage-h" className="px-2 pb-1 pt-2">Manage</h2>
        <ul className="divide-y divide-brand-sky">
          {MANAGE.map(([to, label, hint, Icon, badge]) => (
            <li key={to}>
              <Link to={to} className="flex min-h-[3.5rem] items-center gap-3 rounded-lg px-3 py-2 text-ink no-underline hover:bg-brand-sky">
                <Icon />
                <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block text-sm text-ink-muted">{hint}</span></span>
                {badge === "pending" && pending > 0 && <span className="rounded-full bg-brand-coral px-2 text-xs font-extrabold text-ink"><span aria-hidden="true">{pending > 99 ? "99+" : pending}</span><span className="sr-only">{pending} payments pending verification</span></span>}
                <IconChevronRight />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
