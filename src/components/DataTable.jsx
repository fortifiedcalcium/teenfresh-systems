import React, { useMemo, useState } from "react";
import { Empty, Loading } from "./Spinner.jsx";
import { LiveRegion } from "../a11y.jsx";
import { IconChevronLeft, IconChevronRight } from "./NavIcons.jsx";

/** Sortable, paginated table. columns: [{ key, label, sortValue?(row), render?(row), className?, sortable? }].
 *  `caption` names the table for screen readers (required). Sort buttons use aria-sort; the pagination is a labelled nav. */
export default function DataTable({ caption, columns, rows, rowKey = "id", loading, empty = "Nothing to show.", pageSize = 25, initialSort }) {
  const [sort, setSort] = useState(initialSort || null); // { key, dir }
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => (col?.sortValue ? col.sortValue(r) : r[sort.key]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = sorted.slice(cur * pageSize, cur * pageSize + pageSize);
  const toggle = (key) => { setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })); setPage(0); };

  if (loading) return <Loading label={`Loading ${caption.toLowerCase()}…`} />;
  if (!rows.length) return <Empty>{empty}</Empty>;

  const sortLabel = sort ? `, sorted by ${columns.find((c) => c.key === sort.key)?.label} ${sort.dir === "asc" ? "ascending" : "descending"}` : "";
  return (
    <div>
      {/* 1.4.10: the table scrolls inside a labelled, keyboard-focusable region instead of the whole page scrolling */}
      {/* A scrollable region must be keyboard-focusable (axe: scrollable-region-focusable), so tabIndex is intentional */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div role="region" aria-label={`${caption} (scrollable)`} tabIndex={0} className="relative overflow-x-auto rounded-lg border border-link bg-white">
        <table className="min-w-full divide-y divide-brand-sky">
          <caption className="sr-only">{caption}{sortLabel}</caption>
          <thead className="bg-brand-ivory">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="th" aria-sort={c.sortable === false ? undefined : sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {c.sortable === false ? (c.label || <span className="sr-only">Actions</span>) : (
                    <button type="button" className="inline-flex min-h-target min-w-target items-center justify-center gap-1 font-bold uppercase" onClick={() => toggle(c.key)}>
                      {c.label}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                      <span className="sr-only">: activate to sort</span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-sky">
            {slice.map((r) => (
              <tr key={r[rowKey]} className="hover:bg-brand-ivory">
                {columns.map((c, i) => (i === 0 ? <th key={c.key} scope="row" className={`td text-left font-semibold ${c.className || ""}`}>{c.render ? c.render(r) : r[c.key]}</th> : <td key={c.key} className={`td ${c.className || ""}`}>{c.render ? c.render(r) : r[c.key]}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LiveRegion>{`${sorted.length} ${sorted.length === 1 ? "row" : "rows"} shown, page ${cur + 1} of ${pages}`}</LiveRegion>
      {pages > 1 && (
        <nav aria-label={`${caption} pagination`} className="mt-3 flex items-center justify-between gap-2 text-sm text-ink">
          <span>{sorted.length} rows · page {cur + 1} of {pages}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={cur === 0} onClick={() => setPage(cur - 1)}><IconChevronLeft />Previous{" "}<span className="sr-only">page</span></button>
            <button className="btn-secondary" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><IconChevronRight />Next{" "}<span className="sr-only">page</span></button>
          </div>
        </nav>
      )}
    </div>
  );
}
