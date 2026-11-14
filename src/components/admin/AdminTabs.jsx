import React, { useRef } from "react";
import { useSearchParams } from "react-router-dom";

/** Which tab of a combined admin page is open, kept in the address (?tab=shop) so a refresh or a link keeps it. The first tab is the default. */
export function useHubTab(tabs) {
  const [params, setParams] = useSearchParams();
  const active = tabs.find((t) => t.key === params.get("tab"))?.key || tabs[0].key;
  const select = (key) => setParams(key === tabs[0].key ? {} : { tab: key }, { replace: true });
  return [active, select];
}

/** A row of tabs above one panel. Arrow keys, Home and End move between tabs (the WAI-ARIA tabs pattern). */
export default function AdminTabs({ id, label, tabs, active, onChange, children }) {
  const refs = useRef({});
  const move = (e, i) => {
    const to = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    onChange(tabs[to].key);
    refs.current[tabs[to].key]?.focus();
  };
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <button key={t.key} ref={(el) => { refs.current[t.key] = el; }} type="button" role="tab" id={`${id}-tab-${t.key}`} aria-selected={active === t.key} aria-controls={`${id}-panel`}
            tabIndex={active === t.key ? 0 : -1} className={active === t.key ? "btn-primary" : "btn-secondary"} onClick={() => onChange(t.key)} onKeyDown={(e) => move(e, i)}>{t.label}</button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`}>{children}</div>
    </div>
  );
}
