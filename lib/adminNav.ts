import { SHOP_ENABLED } from "./features";
import { IconChecklist, IconDashboard, IconScanLine, IconSearch, IconUser, IconCalendar, IconWallet, IconMail, IconShield, IconUsers, IconBag } from "./icons";

/** Which pathnames highlight which bottom-bar tab. Profile also covers the pages that have no tab of their own. */
export const matchers = {
  home: (p) => p === "/admin" || p === "/admin/",
  search: (p) => p.startsWith("/admin/attendees"),
  scan: (p) => p.startsWith("/admin/scanner"),
  history: (p) => p.startsWith("/admin/tracker"),
  profile: (p) => ["/admin/profile", "/admin/events", "/admin/home", "/admin/products", "/admin/orders", "/admin/order-emails", "/admin/payments", "/admin/emails", "/admin/email", "/admin/users", "/admin/changelog"].some((x) => p === x || p.startsWith(x + "/")),
};

export const TABS: { key: string; label: string; to: string; icon: any; fab?: boolean }[] = [
  { key: "home", label: "Home", to: "/admin", icon: IconDashboard },
  { key: "search", label: "Search", to: "/admin/attendees?focus=search", icon: IconSearch },
  { key: "scan", label: "Scan QR code", to: "/admin/scanner", icon: IconScanLine, fab: true },
  { key: "history", label: "History", to: "/admin/tracker", icon: IconChecklist },
  { key: "profile", label: "Profile", to: "/admin/profile", icon: IconUser },
];

/** The sidebar groups related pages under one item; inside a group the pages are a pill switch under the page title (AdminSwitch).
 *  `to` is the group's first page. `shop` groups are left out when the shop is off. */
export const GROUPS: { key: string; label: string; icon: any; end?: boolean; badge?: string; shop?: boolean; pages: [string, string][] }[] = [
  { key: "dashboard", label: "Dashboard", icon: IconDashboard, end: true, pages: [["/admin", "Dashboard"]] },
  { key: "events", label: "Events", icon: IconCalendar, pages: [["/admin/events", "Events"], ["/admin/home", "Home page"]] },
  { key: "shop", label: "Shop", icon: IconBag, shop: true, pages: [["/admin/products", "Products"], ["/admin/orders", "Orders"]] },
  { key: "payments", label: "Payments", icon: IconWallet, badge: "pending", pages: [["/admin/payments", "Payments"]] },
  { key: "attendees", label: "Attendees", icon: IconUsers, pages: [["/admin/attendees", "Attendees"], ["/admin/tracker", "Attendance"], ["/admin/scanner", "QR Scanner"]] },
  { key: "email", label: "Email", icon: IconMail, pages: [["/admin/emails", "Email"]] },
  { key: "settings", label: "Settings", icon: IconShield, pages: [["/admin/users", "Admin users"], ["/admin/changelog", "Change log"]] },
];
const inGroup = (g, p) => g.pages.some(([to]) => (to === "/admin" ? p === "/admin" || p === "/admin/" : p === to || p.startsWith(to + "/")));
export const groupOf = (pathname) => GROUPS.find((g) => inGroup(g, pathname)) || null;
export const SIDEBAR_GROUPS = GROUPS.filter((g) => SHOP_ENABLED || !g.shop);
export const isGroupActive = (g, pathname) => inGroup(g, pathname);

/** Page titles for the mobile top bar, and where its back button goes. */
export const TITLES = [
  ["/admin/profile", "Profile"], ["/admin/events", "Events", "/admin/profile"], ["/admin/home", "Home page", "/admin/profile"], ["/admin/products", "Shop products", "/admin/profile"], ["/admin/orders", "Shop orders", "/admin/profile"], ["/admin/payments", "Payments", "/admin/profile"],
  ["/admin/emails", "Email", "/admin/profile"], ["/admin/users", "Admin users", "/admin/profile"], ["/admin/changelog", "Change log", "/admin/profile"],
  ["/admin/attendees", "Attendees"], ["/admin/scanner", "QR Scanner"], ["/admin/tracker", "Attendance"], ["/admin", "Dashboard"],
];
export function titleFor(pathname) {
  const hit = TITLES.find(([p]) => (p === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname === p || pathname.startsWith(p + "/")));
  return hit ? { title: hit[1], back: hit[2] || null } : { title: "Admin", back: null };
}
