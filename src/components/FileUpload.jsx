import React, { useEffect, useId, useRef, useState } from "react";
import { formatBytes, RECEIPT_ACCEPT, validateReceiptFile } from "../lib/payment.js";
import { useAnnounce } from "../a11y.jsx";
import { IconTrash, IconUpload } from "./NavIcons.jsx";

/** Receipt picker. Works with the keyboard (the native file input is focusable and the label is its button);
 *  drag and drop is an extra, never the only way. Announces the chosen file and any problem. */
export default function FileUpload({ id, label = "Attach payment receipt", file, onChange, error, required = true }) {
  const announce = useAnnounce();
  const inputRef = useRef(null);
  const hintId = useId();
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const take = (f) => {
    const problem = validateReceiptFile(f);
    if (problem) { setLocalError(problem); announce(problem, "assertive"); return; }
    setLocalError("");
    onChange(f);
    announce(`Selected ${f.name}, ${formatBytes(f.size)}`);
  };
  const remove = () => { onChange(null); setLocalError(""); if (inputRef.current) inputRef.current.value = ""; announce("Receipt removed"); inputRef.current?.focus(); };
  const shownError = localError || error;

  return (
    <div>
      <p className="label" id={`${id}-label`}>{label}{required && <span className="font-normal text-ink-muted"> (required)</span>}</p>
      {/* Drag and drop is only a shortcut; the keyboard path is the real file input below (hence the lint exemption). */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={`rounded-lg border-2 border-dashed p-4 text-center ${over ? "border-ink bg-brand-sky" : "border-link bg-white"}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.[0]) take(e.dataTransfer.files[0]); }}
      >
        <input
          ref={inputRef} id={id} type="file" accept={RECEIPT_ACCEPT} className="file-input sr-only"
          aria-labelledby={`${id}-label`} aria-describedby={[hintId, shownError ? `${id}-err` : null].filter(Boolean).join(" ")}
          aria-required={required ? "true" : undefined} aria-invalid={shownError ? "true" : undefined}
          onChange={(e) => { if (e.target.files?.[0]) take(e.target.files[0]); e.target.value = ""; }}
        />
        <label htmlFor={id} className="btn-secondary cursor-pointer"><IconUpload />{file ? "Replace file" : "Choose file"}</label>
        <p id={hintId} className="hint">or drag and drop it here. JPG, PNG, WebP or PDF, one file, up to 5 MB.</p>
      </div>
      {shownError && <p id={`${id}-err`} className="mt-1 flex gap-1 text-sm font-semibold text-danger"><span aria-hidden="true">✕</span>{shownError}</p>}

      <div className="mt-3">
        <p className="text-sm font-semibold">Files submitted:</p>
        {file ? (
          <ul className="mt-1 space-y-2">
            <li className="flex flex-wrap items-center gap-3 rounded-lg border border-link bg-white p-2 text-sm">
              {preview ? <img src={preview} alt="Preview of your receipt" className="h-20 w-20 rounded object-cover" width="80" height="80" /> : <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded bg-brand-sky font-bold">PDF</span>}
              <span className="min-w-0 flex-1 break-all"><span className="font-semibold">{file.name}</span><br /><span className="text-ink-muted">{formatBytes(file.size)}</span></span>
              <button type="button" className="btn-secondary" onClick={remove}><IconTrash />Remove{" "}<span className="sr-only">{file.name}</span></button>
            </li>
          </ul>
        ) : <p className="text-sm text-ink-muted">No file yet.</p>}
      </div>
    </div>
  );
}
