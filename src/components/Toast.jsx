import React, { createContext, useCallback, useContext, useState } from "react";
import { IconClose } from "./NavIcons.jsx";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

const TONE = {
  info: { bar: "border-l-link", icon: "i", label: "Info" },
  success: { bar: "border-l-success", icon: "✓", label: "Success" },
  error: { bar: "border-l-danger", icon: "✕", label: "Error" },
};

/** White card, ink text, 4px status bar + icon. Errors stay until dismissed (2.2.1). Each toast is its own live region. */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, type }]);
    if (type !== "error") setTimeout(() => dismiss(id), 8000);
  }, [dismiss]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} role={t.type === "error" ? "alert" : "status"} className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-link border-l-4 bg-white p-3 text-sm text-ink shadow-lg ${TONE[t.type].bar}`}>
            <span aria-hidden="true" className="font-extrabold">{TONE[t.type].icon}</span>
            <p className="flex-1"><span className="sr-only">{TONE[t.type].label}:</span>{" "}{t.message}</p>
            <button className="inline-flex min-h-target min-w-target items-center justify-center rounded font-bold hover:bg-brand-sky" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><IconClose /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
