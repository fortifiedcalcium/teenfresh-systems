import React from "react";
import Modal from "./Modal.jsx";
import { IconCheck, IconClose, IconTrash } from "./NavIcons.jsx";

/** "Are you sure?" dialog for destructive or irreversible actions. Focus lands on Cancel first. */
export default function ConfirmDialog({ title, children, confirmLabel = "Confirm", tone = "danger", busy, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <div className="text-sm">{children}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}><IconClose />Cancel</button>
          <button type="button" className={tone === "danger" ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>{tone === "danger" ? <IconTrash /> : <IconCheck />}{busy ? "Working…" : confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
