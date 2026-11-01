import { IconChecklist, IconDashboard, IconScanLine, IconSearch, IconUser, IconCalendar, IconWallet, IconMail, IconShield, IconHistory, IconUsers, IconScan } from "../NavIcons.jsx";

/** Which pathnames highlight which bottom-bar tab. Profile also covers the pages that have no tab of their own. */
export const matchers = {
  home: (p) => p === "/admin" || p === "/admin/",
  search: (p) => p.startsWith("/admin/attendees"),
  scan: (p) => p.startsWith("/admin/scanner"),
  history: (p) => p.startsWith("/admin/tracker"),
  profile: (p) => ["/admin/profile", "/admin/events", "/admin/payments", "/admin/emails", "/admin/email", "/admin/users", "/admin/changelog"].some((x) => p === x || p.startsWith(x + "/")),
};

export const TABS = [
  { key: "home", label: "Home", to: "/admin", icon: IconDashboard },
  { key: "search", label: "Search", to: "/admin/attendees?focus=search", icon: IconSearch },
  { key: "scan", label: "Scan QR code", to: "/admin/scanner", icon: IconScanLine, fab: true },
  { key: "history", label: "History", to: "/admin/tracker", icon: IconChecklist },
  { key: "profile", label: "Profile", to: "/admin/profile", icon: IconUser },
];

/** Everything, for the desktop sidebar. */
export const SIDEBAR = [
  ["/admin", "Dashboard", IconDashboard, true],
  ["/admin/events", "Events", IconCalendar],
  ["/admin/payments", "Payments", IconWallet, false, "pending"],
  ["/admin/attendees", "Attendees", IconUsers],
  ["/admin/scanner", "QR Scanner", IconScan],
  ["/admin/tracker", "Attendance", IconChecklist],
  ["/admin/emails", "Email", IconMail],
  ["/admin/users", "Admin users", IconShield],
  ["/admin/changelog", "Change log", IconHistory],
];

/** Page titles for the mobile top bar, and where its back button goes. */
export const TITLES = [
  ["/admin/profile", "Profile"], ["/admin/events", "Events", "/admin/profile"], ["/admin/payments", "Payments", "/admin/profile"],
  ["/admin/emails", "Email", "/admin/profile"], ["/admin/users", "Admin users", "/admin/profile"], ["/admin/changelog", "Change log", "/admin/profile"],
  ["/admin/attendees", "Attendees"], ["/admin/scanner", "QR Scanner"], ["/admin/tracker", "Attendance"], ["/admin", "Dashboard"],
];
export function titleFor(pathname) {
  const hit = TITLES.find(([p]) => (p === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname === p || pathname.startsWith(p + "/")));
  return hit ? { title: hit[1], back: hit[2] || null } : { title: "Admin", back: null };
}
