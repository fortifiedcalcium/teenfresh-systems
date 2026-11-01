import React, { useState } from "react";
import Modal from "./Modal.jsx";
import { useMediaQuery } from "../hooks/useBreakpoint.js";
import { MEDIA } from "../lib/breakpoints.js";
import { IconCheck, IconFilter } from "./NavIcons.jsx";

/** The search field plus the filters. From 768px the filters sit inline next to the search; below that they collapse into a
 *  bottom sheet behind a "Filter (n)" button (n = how many filters are active), and the search stays sticky under the top bar.
 *  `search` is the search input; children are the filter controls. */
export default function FilterBar({ search, children, activeCount = 0 }) {
  const mobile = useMediaQuery(MEDIA.mobile);
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-[calc(var(--topbar-h)+var(--safe-top))] z-10 -mx-4 flex flex-wrap items-center gap-2 bg-brand-blush px-4 py-2 sm:-mx-5 sm:px-5 md:static md:mx-0 md:bg-transparent md:p-0 lg:top-0">
      <div className="min-w-0 flex-1 md:flex-none">{search}</div>
      {mobile ? (
        <>
          <button type="button" className="btn-secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            <IconFilter />Filter{activeCount > 0 && <span className="rounded-full bg-ink px-2 text-xs text-brand-ivory"><span aria-hidden="true">{activeCount}</span><span className="sr-only"> ({activeCount} active)</span></span>}
          </button>
          {open && (
            <Modal title="Filters" onClose={() => setOpen(false)}>
              <div className="flex flex-col gap-3 [&_.input]:max-w-none">{children}</div>
              <div className="mt-5 flex justify-end"><button type="button" className="btn-primary" onClick={() => setOpen(false)}><IconCheck />Show results</button></div>
            </Modal>
          )}
        </>
      ) : children}
    </div>
  );
}
