// The Edge Functions (supabase/functions) run on Deno. A few of their files are shared with the browser (the mail merge, the QR code), so the
// type checker reads them too: these lines teach it the Deno-only names.
declare const Deno: any;
declare module "https://esm.sh/*";
declare module "https://deno.land/*";
