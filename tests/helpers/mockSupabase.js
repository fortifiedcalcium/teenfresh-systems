// A chainable stand-in for the Supabase client: every query method returns the same builder, and awaiting it
// resolves with the fixture rows for that table. Good enough to render pages for accessibility checks.
export const fixtures = { current: {} };

function builder(table) {
  const st = { single: false };
  const p = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") {
        const rows = fixtures.current[table] ?? [];
        const data = st.single ? rows[0] ?? null : rows;
        return (res, rej) => Promise.resolve({ data, error: null, count: rows.length }).then(res, rej);
      }
      if (prop === "maybeSingle" || prop === "single") return () => { st.single = true; return p; };
      if (prop === "eq") return (col, val) => { (fixtures.current.eqs ||= []).push({ table, col, val }); return p; };   // so tests can see which rows were asked for
      if (["insert", "update", "delete", "upsert"].includes(prop)) return (...args) => { (fixtures.current.writes ||= []).push({ table, op: prop, args }); return p; };   // so tests can see what was saved
      return () => p;
    },
    apply: () => p,
  });
  return p;
}

const chan = { on() { return chan; }, subscribe() { return chan; } };

export const storageLog = { uploads: [], removed: [] };
const bucket = (name) => ({
  getPublicUrl: (p) => ({ data: { publicUrl: "https://storage.test/" + name + "/" + p } }),
  upload: async (path, file) => { storageLog.uploads.push({ bucket: name, path, type: file?.type }); return { error: fixtures.current.uploadError || null }; },
  remove: async (paths) => { storageLog.removed.push(...paths); return { error: null }; },
  createSignedUrl: async (p) => ({ data: { signedUrl: "https://signed.test/" + p }, error: null }),
});

export const supabase = {
  from: (t) => builder(t),
  rpc: async (name, args) => { (fixtures.current.rpcCalls ||= []).push({ name, args }); const r = fixtures.current.rpc?.[name]; return r?.error ? { data: null, error: r.error } : { data: r ?? null, error: null }; },
  storage: { from: (name) => bucket(name) },
  channel: () => chan,
  removeChannel() {},
  functions: { invoke: async (name, opts) => { (fixtures.current.fnCalls ||= []).push({ name, body: opts?.body }); return { data: { results: [{ id: "r1", status: "sent" }] }, error: null }; } },
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
};
export const isConfigured = true;

export const authState = { current: { user: null, session: null, profile: null, isAdmin: false, loading: false, sessionEnded: false } };
export const asGuest = () => { authState.current = { user: null, session: null, profile: null, isAdmin: false, loading: false, sessionEnded: false }; };
export const asUser = (admin = false) => {
  const user = { id: "u1", email: "juan@example.com" };
  authState.current = { user, session: { user }, profile: { id: "u1", email: user.email, full_name: "Juan Dela Cruz", role: admin ? "admin" : "attendee" }, isAdmin: admin, loading: false, sessionEnded: false };
};
