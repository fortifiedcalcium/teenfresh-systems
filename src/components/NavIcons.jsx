import React from "react";

// Decorative navigation icons (Lucide-style outlines, ISC). They use currentColor so contrast follows the link
// (ink on cream, ivory on the active ink background) and are aria-hidden: the visible label is the accessible name.
const Icon = ({ children, size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{children}</svg>
);

export const IconHome = () => <Icon><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></Icon>;
export const IconCalendar = () => <Icon><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>;
export const IconTicket = () => <Icon><path d="M2 9a3 3 0 0 1 0 6v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a3 3 0 0 1 0-6V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1Z" /><path d="M13 6v12" strokeDasharray="2 3" /></Icon>;
export const IconDashboard = () => <Icon><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Icon>;
export const IconWallet = () => <Icon><path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></Icon>;
export const IconUsers = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
export const IconScan = () => <Icon><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></Icon>;
export const IconChecklist = () => <Icon><path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" /></Icon>;
export const IconMail = () => <Icon><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></Icon>;
export const IconShield = () => <Icon><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" /><path d="m9 12 2 2 4-4" /></Icon>;
export const IconLogIn = () => <Icon><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></Icon>;
export const IconLogOut = () => <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>;
export const IconUserPlus = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></Icon>;
export const IconArrowLeft = () => <Icon><path d="m12 19-7-7 7-7M19 12H5" /></Icon>;
export const IconMenu = () => <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
export const IconClose = () => <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const IconHistory = () => <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></Icon>;
