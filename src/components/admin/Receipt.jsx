import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { Loading } from "../Spinner.jsx";

/** A receipt from the private bucket through a short-lived signed URL. */
export default function Receipt({ path, label = "Payment receipt" }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    supabase.storage.from("payment-receipts").createSignedUrl(path, 300).then(({ data, error }) => { if (!alive) return; if (error) setErr("Could not open this receipt."); else setUrl(data.signedUrl); });
    return () => { alive = false; };
  }, [path]);
  if (err) return <p className="text-sm font-semibold text-danger">{err}</p>;
  if (!url) return <Loading label="Loading receipt…" className="p-4" />;
  return (
    <figure className="space-y-2">
      {/\.pdf$/i.test(path) ? <p className="rounded-lg bg-brand-sky p-3 text-sm font-semibold">PDF receipt: open it in a new tab to read it.</p>
        : <img src={url} alt={label} className="mx-auto max-h-96 rounded-lg border border-link object-contain" />}
      <figcaption className="text-sm"><a href={url} target="_blank" rel="noopener noreferrer">Open the receipt in a new tab{" "}<span className="sr-only">(link expires in 5 minutes)</span></a></figcaption>
    </figure>
  );
}
