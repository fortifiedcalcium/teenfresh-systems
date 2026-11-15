/* Document titles (2.4.2) */
const TITLES = [
  [/^\/$/, "Events"], [/^\/events\/[^/]+\/register$/, "Register for an event"], [/^\/my-registrations$/, "My registrations"],
  [/^\/my-ticket\/[^/]+$/, "My ticket"], [/^\/login$/, "Sign in"], [/^\/register$/, "Create an account"],
  [/^\/forgot-password$/, "Forgot password"], [/^\/reset-password$/, "Reset password"], [/^\/auth\/callback$/, "Signing in"],
  [/^\/admin$/, "Admin dashboard"], [/^\/admin\/events$/, "Admin: events"], [/^\/admin\/payments$/, "Admin: payments"], [/^\/admin\/attendees$/, "Admin: attendees"],
  [/^\/admin\/scanner$/, "Admin: QR scanner"], [/^\/admin\/tracker$/, "Admin: attendance"], [/^\/admin\/emails$/, "Admin: email"],
  [/^\/admin\/users$/, "Admin: users"],
];
export const titleFor = (pathname) => (TITLES.find(([re]) => re.test(pathname)) || [null, "Page not found"])[1];
