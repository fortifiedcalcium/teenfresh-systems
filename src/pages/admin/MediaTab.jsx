import React, { useCallback, useEffect, useState } from "react";
import { fetchEventImages, imageUrl, removeEventImage, saveImageAlt, SLOT_KEYS, SLOTS, uploadEventImage } from "../../lib/eventImages.js";
import { fmtDateTime } from "../../lib/availability.js";
import { useToast } from "../../components/Toast.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { Loading } from "../../components/Spinner.jsx";
import { IconSave, IconTrash, IconUpload } from "../../components/NavIcons.jsx";

function SlotCard({ event, slot, row, reload }) {
  const spec = SLOTS[slot];
  const toast = useToast();
  const [alt, setAlt] = useState(row?.alt_text || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setAlt(row?.alt_text || ""); setBroken(false); }, [row]);
  const url = imageUrl(row);
  const inputId = `file-${slot}`;

  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast(ok, "success"); reload(); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); } };

  return (
    <li className="card space-y-3 p-4">
      <div><h3 className="text-lg">{spec.label}</h3><p className="text-sm text-ink-muted">{spec.where}</p></div>
      <div className="mx-auto max-w-[14rem] overflow-hidden rounded-lg border border-link bg-brand-sky" style={{ aspectRatio: spec.ratio }}>
        {url && !broken
          ? <img src={url} alt={alt || `${spec.label} preview`} onError={() => setBroken(true)} className="h-full w-full object-contain" />
          : <div className="flex h-full items-center justify-center p-3 text-center text-sm font-semibold">{broken ? "The image could not be loaded" : spec.placeholder}</div>}
      </div>
      <p className="text-sm">Recommended: {spec.recommended}. JPG, PNG or WebP, 5 MB at most.{row && <> Last updated {fmtDateTime(row.updated_at)}.</>}</p>
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

export default function MediaTab({ event }) {
  const [rows, setRows] = useState(null);
  const reload = useCallback(async () => setRows(await fetchEventImages(event.id)), [event.id]);
  useEffect(() => { reload(); }, [reload]);
  if (!rows) return <Loading label="Loading images…" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Replace any image here at any time. Changes show up straight away; no redeploy is needed. Until an image is uploaded, a placeholder is shown.</p>
      <ul className="grid gap-4 sm:grid-cols-2">{SLOT_KEYS.map((slot) => <SlotCard key={slot} event={event} slot={slot} row={rows[slot]} reload={reload} />)}</ul>
    </div>
  );
}
