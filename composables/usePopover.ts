/** A list that opens under a button, for the notification bells: it closes on Escape (focus goes back to the button) or when someone clicks
 *  elsewhere, and is placed with `position: fixed` from the button's position so no scrolling box clips it. `align` is the edge of the button it lines up with.
 *  Put `ref="btn"` / `ref="panel"` on the elements using the returned refs. */
let seq = 0;
export function usePopover(align = "left", opts: { keep?: string; above?: boolean } = {}) {
  const open = ref(false);
  const pos = ref<{ top: number; bottom: number | null; left: number; width: number }>({ top: 0, bottom: null, left: 0, width: 320 });
  const btn = ref(null);
  const panel = ref(null);
  const id = `popover-${++seq}`;

  // `above`: for buttons at the bottom of the screen the panel opens upwards (use `pos.bottom` instead of `pos.top`); `keep`: clicks inside this selector (a panel opened from within this one) do not close it
  const toggle = () => {
    if (!open.value && btn.value) {
      const r = btn.value.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const left = align === "right" ? r.right - width : r.left;
      pos.value = { top: r.bottom + 8, bottom: opts.above ? window.innerHeight - r.top + 8 : null, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), width };
    }
    open.value = !open.value;
  };
  const close = () => { open.value = false; };

  const onKey = (e) => { if (e.key === "Escape") { open.value = false; btn.value?.focus(); } };
  const onDown = (e) => { if (!panel.value?.contains(e.target) && !btn.value?.contains(e.target) && !(opts.keep && (e.target as Element).closest?.(opts.keep))) open.value = false; };
  watch(open, (o) => {
    if (o) { document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onDown); }
    else { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); }
  });
  onScopeDispose(() => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); });

  return { open, toggle, close, btn, panel, pos, id };
}
