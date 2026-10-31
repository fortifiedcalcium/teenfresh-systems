import React, { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { imageUrl, SLOTS, uploadEventImage } from "../lib/eventImages.js";
import Modal from "./Modal.jsx";
import { useToast } from "./Toast.jsx";

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" />
  </svg>
);

/** One image slot of an event. Shows the uploaded image, or a placeholder that reserves the exact aspect ratio
 *  (no layout shift) when there is none or it fails to load. Admins get an "Upload image" button on the placeholder.
 *  `image` is the event_images row for the slot (or undefined). */
export default function EventImage({ slot, event, image, onChanged, lightbox = true, fit = "contain", className = "" }) {
  const spec = SLOTS[slot];
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const url = imageUrl(image);
  useEffect(() => setFailed(false), [url]);
  const alt = image?.alt_text || `${spec.label} for ${event?.title || "the event"}`;
  const box = { aspectRatio: spec.ratio };

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { await uploadEventImage(event, slot, file, null, image); toast(`${spec.label} uploaded`, "success"); onChanged?.(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  if (!url || failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-link bg-brand-sky p-4 text-center text-ink ${className}`} style={box} data-placeholder={slot}>
        <ImageIcon />
        <p className="font-semibold">{spec.placeholder}</p>
        {isAdmin && event && (
          <>
            <p className="text-sm">Recommended: {spec.recommended}. JPG, PNG or WebP, 5 MB at most.</p>
            <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="file-input sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            <label htmlFor={inputId} className="btn-secondary cursor-pointer" aria-disabled={busy}>{busy ? "Uploading…" : "Upload image"}{" "}<span className="sr-only">for {spec.label}</span></label>
          </>
        )}
      </div>
    );
  }

  const img = <img src={url} alt={alt} width={spec.w} height={spec.h} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />;
  return (
    <>
      <div className={`overflow-hidden rounded-lg border border-link bg-brand-sky ${className}`} style={box}>
        {lightbox ? (
          <button type="button" className="block h-full w-full" onClick={() => setOpen(true)} aria-label={`View larger: ${alt}`} aria-haspopup="dialog">{img}</button>
        ) : img}
      </div>
      {open && <Lightbox url={url} alt={alt} title={spec.label} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Accessible lightbox: focus is trapped, Esc closes, focus returns to the thumbnail (see Modal). Posters contain
 *  small text, so there is always a download link as well. */
export function Lightbox({ url, alt, title, onClose }) {
  const ref = useRef(null);
  return (
    <Modal title={title} onClose={onClose} wide>
      <img ref={ref} src={url} alt={alt} className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg" />
      <p className="mt-3 text-center"><a href={url} download target="_blank" rel="noopener noreferrer" >Download image</a></p>
    </Modal>
  );
}
