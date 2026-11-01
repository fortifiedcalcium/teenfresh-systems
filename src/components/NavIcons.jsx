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

// ---- Button icons (same outline style, size and stroke as the navigation icons; `.btn svg` fixes the size) ----
export const IconPlus = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;
export const IconMinus = () => <Icon><path d="M5 12h14" /></Icon>;
export const IconCheck = () => <Icon><path d="M20 6 9 17l-5-5" /></Icon>;
export const IconCheckCircle = () => <Icon><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Icon>;
export const IconXCircle = () => <Icon><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></Icon>;
export const IconAlert = () => <Icon><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></Icon>;
export const IconSave = () => <Icon><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></Icon>;
export const IconSend = () => <Icon><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Icon>;
export const IconPencil = () => <Icon><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></Icon>;
export const IconTrash = () => <Icon><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6M14 11v6" /></Icon>;
export const IconEye = () => <Icon><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon>;
export const IconEyeOff = () => <Icon><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" /></Icon>;
export const IconUpload = () => <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Icon>;
export const IconDownload = () => <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>;
export const IconRefresh = () => <Icon><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" /></Icon>;
export const IconSearch = () => <Icon><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>;
export const IconUserCheck = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></Icon>;
export const IconUserX = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m17 8 5 5M22 8l-5 5" /></Icon>;
export const IconCamera = () => <Icon><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" /><circle cx="12" cy="13" r="3" /></Icon>;
export const IconCameraOff = () => <Icon><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" /><circle cx="12" cy="13" r="3" /><path d="M2 2l20 20" /></Icon>;
export const IconZap = () => <Icon><path d="M13 2 3 14h9l-1 8 10-12h-9Z" /></Icon>;
export const IconVolume = () => <Icon><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" /></Icon>;
export const IconVolumeOff = () => <Icon><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="m22 9-6 6M16 9l6 6" /></Icon>;
export const IconLock = () => <Icon><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>;
export const IconUnlock = () => <Icon><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></Icon>;
export const IconUndo = () => <Icon><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></Icon>;
export const IconChevronLeft = () => <Icon><path d="m15 18-6-6 6-6" /></Icon>;
export const IconChevronRight = () => <Icon><path d="m9 18 6-6-6-6" /></Icon>;
export const IconChevronDown = () => <Icon><path d="m6 9 6 6 6-6" /></Icon>;
export const IconChevronUp = () => <Icon><path d="m18 15-6-6-6 6" /></Icon>;
export const IconArrowRight = () => <Icon><path d="M5 12h14M12 5l7 7-7 7" /></Icon>;
export const IconArrowDown = () => <Icon><path d="M12 5v14M19 12l-7 7-7-7" /></Icon>;
export const IconKey = () => <Icon><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" /></Icon>;
export const IconCopy = () => <Icon><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>;
export const IconImage = () => <Icon><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></Icon>;
