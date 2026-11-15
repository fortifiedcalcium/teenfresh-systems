<script setup>
import { MEDIA } from "~/lib/breakpoints.js";

// Sortable, paginated table. columns: [{ key, label, sortValue?(row), className?, sortable? }].
// A cell shows row[key] unless the parent fills the slot `cell-<key>` ({ row }). The actions column is the one with `sortable: false` and no label.
// `caption` names the table for screen readers (required). Sort buttons use aria-sort; the pagination is a labelled nav.
const props = defineProps({
  caption: { type: String, required: true }, columns: { type: Array, required: true }, rows: { type: Array, default: () => [] }, rowKey: { type: String, default: "id" },
  loading: Boolean, cards: Boolean, empty: { type: String, default: "Nothing to show." }, pageSize: { type: Number, default: 25 }, initialSort: Object,
});
const sort = ref(props.initialSort || null); // { key, dir }
const page = ref(0);
const isMobile = useMediaQuery(MEDIA.mobile);   // below 768: one card per row (`cards` forces that layout, e.g. a narrow master list)
const mobile = computed(() => isMobile.value || props.cards);
const tablet = useMediaQuery(MEDIA.tablet);   // 768-1023: the first few columns, with a "Columns" toggle
const allCols = ref(false);

const sorted = computed(() => {
  if (!sort.value) return props.rows;
  const col = props.columns.find((c) => c.key === sort.value.key);
  const val = (r) => (col?.sortValue ? col.sortValue(r) : r[sort.value.key]);
  return [...props.rows].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
    return sort.value.dir === "asc" ? c : -c;
  });
});
const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / props.pageSize)));
const cur = computed(() => Math.min(page.value, pages.value - 1));
const slice = computed(() => sorted.value.slice(cur.value * props.pageSize, cur.value * props.pageSize + props.pageSize));
const toggle = (key) => { sort.value = sort.value?.key === key ? { key, dir: sort.value.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }; page.value = 0; };

// Tablet: the 4 most important (leftmost) columns plus the actions column; the toggle shows the rest.
const actionCol = computed(() => props.columns.find((c) => c.sortable === false && !c.label));
const dataCols = computed(() => props.columns.filter((c) => c !== actionCol.value));
const compact = computed(() => tablet.value && !allCols.value && dataCols.value.length > 5);
const viewCols = computed(() => (compact.value ? [...dataCols.value.slice(0, 4), ...(actionCol.value ? [actionCol.value] : [])] : props.columns));
const cardCols = computed(() => dataCols.value.slice(1));
const firstCol = computed(() => props.columns[0]);
const sortLabel = computed(() => (sort.value ? `, sorted by ${props.columns.find((c) => c.key === sort.value.key)?.label} ${sort.value.dir === "asc" ? "ascending" : "descending"}` : ""));
const sortId = computed(() => `sort-${props.caption}`);
const ariaSort = (c) => (c.sortable === false ? undefined : sort.value?.key === c.key ? (sort.value.dir === "asc" ? "ascending" : "descending") : "none");
const onSortSelect = (e) => { if (e.target.value) { sort.value = { key: e.target.value, dir: sort.value?.dir || "asc" }; page.value = 0; } else sort.value = null; };
const liveText = computed(() => `${sorted.value.length} ${sorted.value.length === 1 ? "row" : "rows"} shown, page ${cur.value + 1} of ${pages.value}`);
</script>

<template>
  <Loading v-if="loading" :label="`Loading ${caption.toLowerCase()}…`" />
  <Empty v-else-if="!rows.length">{{ empty }}</Empty>
  <div v-else>
    <template v-if="mobile">
      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <label :for="sortId" class="font-semibold">Sort by</label>
        <select :id="sortId" class="input max-w-[14rem]" :value="sort?.key || ''" @change="onSortSelect">
          <option value="">Default order</option>
          <option v-for="c in columns.filter((c) => c.sortable !== false)" :key="c.key" :value="c.key">{{ c.label }}</option>
        </select>
        <button v-if="sort" type="button" class="btn-secondary" @click="toggle(sort.key)"><IconChevronUp v-if="sort.dir === 'asc'" /><IconChevronDown v-else />{{ sort.dir === "asc" ? "Ascending" : "Descending" }}</button>
      </div>
      <ul :aria-label="`${caption}${sortLabel}`" class="space-y-3">
        <li v-for="r in slice" :key="r[rowKey]" class="card p-4">
          <div class="font-bold"><slot :name="`cell-${firstCol.key}`" :row="r">{{ r[firstCol.key] }}</slot></div>
          <dl class="mt-2 space-y-1.5 text-sm">
            <div v-for="c in cardCols" :key="c.key" class="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt class="text-xs font-bold uppercase tracking-wide text-ink-muted">{{ c.label }}</dt>
              <dd :class="['min-w-0 text-right', c.className || '']"><slot :name="`cell-${c.key}`" :row="r">{{ r[c.key] }}</slot></dd>
            </div>
          </dl>
          <div v-if="actionCol" class="mt-3 flex flex-wrap justify-end gap-2 border-t border-brand-sky pt-3"><slot :name="`cell-${actionCol.key}`" :row="r" /></div>
        </li>
      </ul>
    </template>
    <template v-else>
      <div v-if="compact || (tablet && allCols)" class="mb-2 flex justify-end"><button type="button" class="btn-secondary" :aria-pressed="allCols" @click="allCols = !allCols">{{ allCols ? "Fewer columns" : "Columns: show all" }}</button></div>
      <!-- 1.4.10: the table scrolls inside a labelled, keyboard-focusable region instead of the whole page scrolling -->
      <div role="region" :aria-label="`${caption} (scrollable)`" tabindex="0" class="relative overflow-x-auto rounded-2xl border border-brand-sky bg-white shadow-[0_2px_10px_color-mix(in_srgb,var(--ink)_8%,transparent)]">
        <table class="min-w-full divide-y divide-brand-sky">
          <caption class="sr-only">{{ caption }}{{ sortLabel }}</caption>
          <thead class="bg-brand-ivory">
            <tr>
              <th v-for="c in viewCols" :key="c.key" scope="col" class="th" :aria-sort="ariaSort(c)">
                <template v-if="c.sortable === false"><template v-if="c.label">{{ c.label }}</template><span v-else class="sr-only">Actions</span></template>
                <button v-else type="button" class="inline-flex min-h-target min-w-target items-center justify-center gap-1 font-bold uppercase" @click="toggle(c.key)">
                  {{ c.label }}<span aria-hidden="true">{{ sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕" }}</span>
                  <span class="sr-only">: activate to sort</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-brand-sky">
            <tr v-for="r in slice" :key="r[rowKey]" class="hover:bg-brand-ivory">
              <template v-for="(c, i) in viewCols" :key="c.key">
                <th v-if="i === 0" scope="row" :class="['td text-left font-semibold', c.className || '']"><slot :name="`cell-${c.key}`" :row="r">{{ r[c.key] }}</slot></th>
                <td v-else :class="['td', c.className || '']"><slot :name="`cell-${c.key}`" :row="r">{{ r[c.key] }}</slot></td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <LiveRegion>{{ liveText }}</LiveRegion>
    <nav v-if="pages > 1" :aria-label="`${caption} pagination`" class="mt-3 flex items-center justify-between gap-2 text-sm text-ink">
      <span>{{ sorted.length }} rows · page {{ cur + 1 }} of {{ pages }}</span>
      <div class="flex gap-2">
        <button type="button" class="btn-secondary" :disabled="cur === 0" @click="page = cur - 1"><IconChevronLeft />Previous <span class="sr-only">page</span></button>
        <button type="button" class="btn-secondary" :disabled="cur >= pages - 1" @click="page = cur + 1"><IconChevronRight />Next <span class="sr-only">page</span></button>
      </div>
    </nav>
  </div>
</template>
