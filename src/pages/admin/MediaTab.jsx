import React, { useCallback, useEffect, useState } from "react";
import { fetchEventImages, imageUrl, removeEventImage, saveImageAlt, SLOT_KEYS, SLOTS, uploadEventImage } from "../../lib/eventImages.js";
import { fmtDateTime } from "../../lib/availability.js";
import { useToast } from "../../components/Toast.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { ComingSoonBanner } from "../../components/EventImage.jsx";
import { IconSave, IconTrash, IconUpload } from "../../components/NavIcons.jsx";

function SlotCard({ event, slot, row, reload, onEventChanged }) {
  const spec = SLOTS[slot];
  const toast = useToast();
  const [alt, setAlt] = useState(row?.alt_text || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setAlt(row?.alt_text || ""); setBroken(false); }, [row]);
  const url = imageUrl(row);
  const inputId = `file-${slot}`;

  const isBanner = slot === "banner";
  const soon = isBanner && !!event.banner_coming_soon;
  const setSoon = (on) => run(async () => {
    const { error } = await supabase.from("events").update({ banner_coming_soon: on }).eq("id", event.id);
    if (error) throw new Error(error.message);
    onEventChanged?.();
  }, on ? "The banner now shows “Coming soon”" : "The banner shows the image again");

  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast(ok, "success"); reload(); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); } };

  return (
    <li className="card space-y-3 p-4">
      <div><h3 className="text-lg">{spec.label}</h3><p className="text-sm text-ink-muted">{spec.where}</p></div>
      <div className="mx-auto max-w-[14rem] overflow-hidden rounded-lg border border-link bg-brand-sky">
        {soon ? <ComingSoonBanner ratio="16 / 9" />
          : url && !broken
          ? <img src={url} alt={alt || `${spec.label} preview`} onError={() => setBroken(true)} className="block h-auto w-full" />
          : <div className="flex items-center justify-center p-3 text-center text-sm font-semibold" style={{ aspectRatio: spec.ratio }}>{broken ? "The image could not be loaded" : spec.placeholder}</div>}
      </div>
      {isBanner && (
        <label className="flex items-start gap-2 text-sm font-semibold">
          <input type="checkbox" className="check mt-0.5" checked={soon} disabled={busy} onChange={(e) => setSoon(e.target.checked)} />
          <span>Show “Coming soon” instead of a banner image<span className="block font-normal text-ink-muted">Attendees see a Coming soon panel on the event card. Any uploaded image is kept and returns when this is off.</span></span>
        </label>
      )}
      <p className="text-sm">Recommended: {spec.recommended}. JPG, PNG or WebP, 10 MB at most.{row && <> Last updated {fmtDateTime(row.updated_at)}.</>}</p>
      <div className="flex flex-wrap gap-2">
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="file-input sr-only" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(() => uploadEventImage(event, slot, f, alt, row), `${spec.label} ${row ? "replaced" : "uploaded"}`); }} />
        <label htmlFor={inputId} className="btn-primary cursor-pointer" aria-disabled={busy}><IconUpload />{busy ? "Working…" : row ? "Replace image" : "Upload image"}{" "}<span className="sr-only">for {spec.label}</span></label>
        {row && <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirm(true)}><IconTrash />Remove{" "}<span className="sr-only">{spec.label}</span></button>}
      </div>
      {row && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => saveImageAlt(row, alt), "Alt text saved"); }}>
          <div className="min-w-0 flex-1">
            <label htmlFor={`alt-${slot}`} className="label">Alt text</label>
            <input id={`alt-${slot}`} className="input" value={alt} onChange={(e) => setAlt(e.target.value)} aria-describedby={`alt-hint-${slot}`} />
            <p id={`alt-hint-${slot}`} className="hint">Describe the image for people who cannot see it. Posters are images of text, so the event info is also shown as real text on the page.</p>
          </div>
          <button className="btn-secondary" disabled={busy}><IconSave />Save alt text</button>
        </form>
      )}
      {confirm && <ConfirmDialog title={`Remove ${spec.label}?`} confirmLabel="Remove image" busy={busy} onCancel={() => setConfirm(false)} onConfirm={async () => { await run(() => removeEventImage(row), `${spec.label} removed`); setConfirm(false); }}>The page will show the placeholder again.</ConfirmDialog>}
    </li>
  );
}

export default function MediaTab({ event, onEventChanged }) {
  const [rows, setRows] = useState(null);
  const reload = useCallback(async () => setRows(await fetchEventImages(event.id)), [event.id]);
  useEffect(() => { reload(); }, [reload]);
  if (!rows) return <Loading label="Loading images…" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Replace any image here at any time. Changes show up straight away; no redeploy is needed. Until an image is uploaded, a placeholder is shown.</p>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{SLOT_KEYS.map((slot) => <SlotCard key={slot} event={event} slot={slot} row={rows[slot]} reload={reload} onEventChanged={onEventChanged} />)}</ul>
    </div>
  );
}
