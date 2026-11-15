// Where to go after signing in (kept across the Google / email-verification redirect).
export const rememberDestination = (path) => { try { sessionStorage.setItem("post_auth_path", path); } catch { /* ignore */ } };
export const takeDestination = () => { try { const p = sessionStorage.getItem("post_auth_path"); sessionStorage.removeItem("post_auth_path"); return p; } catch { return null; } };
