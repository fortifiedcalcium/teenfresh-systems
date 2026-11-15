// A tiny stand-in for Supabase's REST API, for the one test that reads the HTML the SERVER renders (the browser tests mock the network inside
// the browser instead, which the server never sees). Public tables only, filters like ?col=eq.value, ?select, ?order are honoured loosely.
import http from "node:http";
import { TABLES } from "./data.js";

const PUBLIC = new Set(["events", "event_images", "event_kits", "event_availability", "products", "product_variations", "product_categories"]);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (!m || !PUBLIC.has(m[1])) { res.writeHead(m ? 401 : 404, headers); return res.end("{}"); }
  let rows = TABLES[m[1]] ?? [];
  for (const [k, v] of url.searchParams) if (v.startsWith("eq.") && !["select", "order", "limit"].includes(k)) rows = rows.filter((r) => String(r[k]) === v.slice(3));
  const single = String(req.headers.accept || "").includes("vnd.pgrst.object");
  if (single) { res.writeHead(rows[0] ? 200 : 406, headers); return res.end(JSON.stringify(rows[0] ?? {})); }
  res.writeHead(200, { ...headers, "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
  res.end(JSON.stringify(rows));
});
server.listen(Number(process.env.PORT || 54321), () => console.log("fake supabase on", server.address().port));
