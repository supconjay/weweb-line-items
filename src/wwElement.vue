<template>
  <div class="pp-root" :class="[themeClass, densityClass]" :style="rootStyle">
    <div class="pp-card">
      <!-- header -->
      <div v-if="content.showHeader !== false" class="pp-card__header">
        <div>
          <h2 class="pp-card__heading">{{ content.title }}</h2>
          <p v-if="content.subtitle" class="pp-card__sub">{{ content.subtitle }}</p>
        </div>
        <span class="pp-badge pp-badge--info"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('list')"></path></svg> {{ totalCount }} {{ content.itemsLabel || 'Items' }}</span>
      </div>

      <!-- search -->
      <div v-if="content.showSearch !== false" class="pp-search">
        <svg class="pp-svg pp-search__icon" v-bind="svgAttrs"><path :d="ic('search')"></path></svg>
        <input class="pp-input pp-search__input" :value="searchQuery" @input="onSearch($event.target.value)" @keydown.enter="onSearch($event.target.value, true)" :placeholder="content.searchPlaceholder || 'Search Items...'" />
        <button v-if="searchQuery" class="pp-search__clear" type="button" @click="onSearch('', true)" aria-label="Clear search"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('x')"></path></svg></button>
      </div>

      <!-- toolbar -->
      <div v-if="content.showToolbar !== false" class="pp-toolbar">
        <button v-if="content.showFilters !== false" class="pp-tool" :class="{ 'pp-tool--on': filtersOpen }" type="button" @click="toggleFilters">
          <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('filter')"></path></svg> Filter
        </button>
        <div v-if="content.showColumnChooser !== false" class="pp-chooser">
          <button class="pp-tool" type="button" @click.stop="chooserOpen = !chooserOpen">
            <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('columns')"></path></svg> Columns
          </button>
          <div v-if="chooserOpen" class="pp-chooser__menu" @click.stop>
            <label v-for="col in resolvedColumns" :key="col.key" class="pp-chooser__item">
              <input type="checkbox" :checked="!hidden[col.key]" @change="toggleColumn(col)" />
              <span>{{ col.label }}</span>
            </label>
          </div>
        </div>
        <div class="pp-toolbar__spacer"></div>
        <button v-if="anyFilterActive" class="pp-tool pp-tool--clear" type="button" @click="clearFilters">
          <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('x')"></path></svg> Clear
        </button>
      </div>

      <!-- filter panel -->
      <div v-if="filtersOpen && content.showFilters !== false" class="pp-filters">
        <label v-for="col in filterableColumns" :key="col.key" class="pp-fieldgroup">
          <span>{{ col.label }}</span>
          <input class="pp-input" :value="filters[col.key] || ''" @input="setFilter(col, $event.target.value)" :placeholder="'Filter ' + col.label" />
        </label>
      </div>

      <!-- grid -->
      <div class="pp-grid__wrap">
        <table class="pp-grid" :class="{ 'pp-grid--wrap': content.wrapText }" :style="gridStyle">
          <thead>
            <tr>
              <th v-if="canReorder" class="pp-grid__draghead"></th>
              <th v-for="col in visibleColumns" :key="col.key" :style="thStyle(col)" :class="alignClass(col)">
                <button class="pp-th" :class="{ 'pp-th--sortable': col.sortable }" type="button" @click="toggleSort(col)">
                  <span>{{ col.label }}</span>
                  <svg v-if="col.sortable" class="pp-sort" :class="{ 'pp-sort--active': sortKey === col.key }" v-bind="svgAttrs">
                    <path :d="sortKey === col.key ? (sortDir === 'asc' ? ic('chevron-up') : ic('chevron-down')) : ic('sort')"></path>
                  </svg>
                </button>
              </th>
              <th v-if="content.showRowAction" class="pp-grid__actionhead pp-al-right">{{ content.rowActionHeader || '' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in pagedRows" :key="r._i" :class="{ 'pp-tr--drag': dragFrom === r._i, 'pp-tr--over': dragOver === r._i }" @dragover.prevent="onDragOver(r)" @dragleave="onDragLeave(r)" @drop="onDrop(r)">
              <td v-if="canReorder" class="pp-grid__drag" :data-label="''" draggable="true" @dragstart="onDragStart(r, $event)" @dragend="onDragEnd" title="Drag to reorder">
                <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('grip')"></path></svg>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :data-label="col.label" :class="[alignClass(col), { 'pp-td--editable': isEditable(col), 'pp-td--editing': isEditingCell(col, r), 'pp-td--multiline': col.multiline }]" @click="startEdit(col, r)">
                <template v-if="isEditingCell(col, r)">
                  <select v-if="optionsByKey[col.key] && optionsByKey[col.key].length" class="pp-input pp-input--cell" v-model="editValue" ref="editor" @change="commitEdit" @blur="commitEdit" @keydown.enter.prevent="commitEdit" @keydown.esc="cancelEdit">
                    <option v-for="opt in optionsByKey[col.key]" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                  <textarea v-else-if="col.multiline" class="pp-input pp-input--cell pp-textarea" v-model="editValue" ref="editor" rows="1" @input="autoGrow" @blur="commitEdit" @keydown.enter="onTextareaEnter" @keydown.esc="cancelEdit"></textarea>
                  <input v-else class="pp-input pp-input--cell" :type="isNumericType(col.type) ? 'number' : 'text'" v-model="editValue" ref="editor" @blur="commitEdit" @keydown.enter.prevent="commitEdit" @keydown.esc="cancelEdit" />
                </template>
                <template v-else>
                  <span v-if="col.type === 'status'" class="pp-pill" :class="`pp-pill--${statusKey(cellValue(col, r.data))}`"><span class="pp-pill__dot"></span>{{ normVal(cellValue(col, r.data)) || '—' }}</span>
                  <span v-else-if="col.type === 'boolean'" class="pp-bool" :class="truthyBool(cellValue(col, r.data)) ? 'pp-bool--on' : 'pp-bool--off'">
                    <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic(truthyBool(cellValue(col, r.data)) ? 'check' : 'x')"></path></svg>{{ truthyBool(cellValue(col, r.data)) ? (content.boolTrue || 'Yes') : (content.boolFalse || 'No') }}
                  </span>
                  <span v-else :class="[{ 'pp-muted': isEmpty(cellValue(col, r.data)) }, col.multiline ? 'pp-cell--multiline' : '']">{{ isEmpty(cellValue(col, r.data)) ? '—' : cellDisplay(col, cellValue(col, r.data)) }}</span>
                </template>
              </td>
              <td v-if="content.showRowAction" class="pp-grid__action pp-al-right" :data-label="content.rowActionHeader || ''">
                <button class="pp-btn pp-btn--ghost" type="button" @click.stop="emitView(r)"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('eye')"></path></svg> {{ content.rowActionLabel || 'View' }}</button>
              </td>
            </tr>
            <tr v-if="!pagedRows.length"><td :colspan="footColspan" class="pp-empty">{{ content.emptyText || 'No rows' }}</td></tr>
          </tbody>
          <tfoot v-if="content.showTotals && totalColumns.length">
            <tr>
              <td v-if="canReorder"></td>
              <td v-for="(col, ci) in visibleColumns" :key="col.key" :data-label="col.label" :class="alignClass(col)">
                <strong v-if="isTotalCol(col)">{{ cellDisplay(col, totals[col.key]) }}</strong>
                <strong v-else-if="ci === 0" class="pp-foot__label">{{ content.totalsLabel || 'Total' }}</strong>
              </td>
              <td v-if="content.showRowAction"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- pagination -->
      <div v-if="content.paginate !== false" class="pp-pager">
        <label class="pp-pager__size">
          <span>Rows</span>
          <select class="pp-input pp-input--sm" :value="pageSize" @change="setPageSize($event.target.value)">
            <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
        <span class="pp-pager__range">{{ rangeStart }}–{{ rangeEnd }} of {{ filteredCount }}</span>
        <div class="pp-pager__nav">
          <button class="pp-iconbtn" type="button" :disabled="page <= 1" @click="goPage(1)"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('chevrons-left')"></path></svg></button>
          <button class="pp-iconbtn" type="button" :disabled="page <= 1" @click="goPage(page - 1)"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('chevron-left')"></path></svg></button>
          <span class="pp-pager__pageno">Page {{ pageClamped }} of {{ pageCount }}</span>
          <button class="pp-iconbtn" type="button" :disabled="page >= pageCount" @click="goPage(page + 1)"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('chevron-right')"></path></svg></button>
          <button class="pp-iconbtn" type="button" :disabled="page >= pageCount" @click="goPage(pageCount)"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('chevrons-right')"></path></svg></button>
        </div>
      </div>

      <!-- add-row form (underneath) -->
      <div v-if="content.showAddForm !== false" class="pp-addrow">
        <div class="pp-addrow__head"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('plus')"></path></svg><span>{{ content.addFormTitle || 'Add a row' }}</span></div>
        <div class="pp-addrow__grid">
          <label v-for="col in addColumns" :key="col.key" class="pp-fieldgroup">
            <span>{{ col.label }}</span>
            <div v-if="col.compute" class="pp-input pp-input--readonly">{{ addComputedDisplay(col) }}</div>
            <div v-else-if="col.picker" class="pp-picker">
              <textarea class="pp-input pp-textarea pp-picker__input" v-model="newRow[col.key]" rows="1" autocomplete="off"
                :placeholder="col.picker.placeholder || ('Search or enter ' + String(col.label).toLowerCase())"
                @focus="onPickerFocus(col, $event)" @input="onPickerInput(col, $event)" @blur="closePickerSoon" @keydown.esc="closePicker"></textarea>
              <div v-if="pickerOpenKey === col.key" class="pp-picker__menu">
                <button v-for="(item, idx) in filteredPickerItems(col)" :key="idx" type="button" class="pp-picker__item" @mousedown.prevent="choosePicker(col, item)">
                  <img v-if="pickerIcon(col, item)" class="pp-picker__icon" :src="pickerIcon(col, item)" alt="" loading="lazy" />
                  <span class="pp-picker__label">{{ pickerLabel(col, item) }}</span>
                  <span v-if="pickerHint(col, item)" class="pp-picker__hint">{{ pickerHint(col, item) }}</span>
                </button>
                <div v-if="!filteredPickerItems(col).length" class="pp-picker__empty">{{ pickerEmptyText(col) }}</div>
              </div>
            </div>
            <select v-else-if="optionsByKey[col.key] && optionsByKey[col.key].length" class="pp-input" v-model="newRow[col.key]" @change="onAddSelect(col)">
              <option value="">—</option>
              <option v-for="opt in optionsByKey[col.key]" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <label v-else-if="col.type === 'boolean'" class="pp-checkwrap"><input type="checkbox" v-model="newRow[col.key]" /> <span>{{ truthyBool(newRow[col.key]) ? (content.boolTrue || 'Yes') : (content.boolFalse || 'No') }}</span></label>
            <textarea v-else-if="col.multiline" class="pp-input pp-textarea" v-model="newRow[col.key]" rows="2" @input="autoGrow" :placeholder="col.label"></textarea>
            <input v-else class="pp-input" :type="isNumericType(col.type) ? 'number' : 'text'" v-model="newRow[col.key]" :placeholder="col.label" />
          </label>
          <div class="pp-fieldgroup pp-addrow__btnwrap">
            <button class="pp-btn pp-btn--primary pp-addrow__btn" type="button" @click="addRow"><svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('plus')"></path></svg> {{ content.addLabel || 'Add Item' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const ICONS = {
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  plus: "M12 5v14M5 12h14",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  columns: "M12 3v18M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  "chevron-up": "M18 15l-6-6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-left": "M15 18l-6-6 6-6",
  "chevron-right": "M9 18l6-6-6-6",
  "chevrons-left": "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  "chevrons-right": "M13 17l5-5-5-5M6 17l5-5-5-5",
  x: "M18 6L6 18M6 6l12 12",
  check: "M20 6L9 17l-5-5",
  sort: "M8 9l4-4 4 4M16 15l-4 4-4-4",
  grip: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
};

const MONEY_RE = /price|cost|retail|total|amount|labor|material|payout|expense|subtotal|fee|tax|pay\b/i;
const PCT_RE = /margin|percent|%|rate/i;
const DATE_RE = /date|start|end|due|created|updated/i;

export default {
  props: { content: { type: Object, required: true }, uid: { type: String, required: false } },
  emits: ["trigger-event"],
  data() {
    return {
      localRows: [],
      hidden: {},
      filters: {},
      filtersOpen: false,
      chooserOpen: false,
      sortKey: null,
      sortDir: null,
      page: 1,
      pageSize: 10,
      editing: null,
      editValue: "",
      newRow: {},
      pickerOpenKey: null,
      searchQuery: "",
      dragFrom: null,
      dragOver: null,
      _onDocClick: null,
      _searchTimer: null,
    };
  },
  created() {
    this.syncRows();
    this.initHidden();
    this.resetNewRow();
    this.filtersOpen = this.content.filtersOpen === true;
    this.pageSize = Number(this.content.pageSize) > 0 ? Number(this.content.pageSize) : 10;
  },
  mounted() {
    this._onDocClick = () => { this.chooserOpen = false; };
    document.addEventListener("click", this._onDocClick);
  },
  beforeUnmount() {
    if (this._onDocClick) document.removeEventListener("click", this._onDocClick);
    if (this._searchTimer) clearTimeout(this._searchTimer);
  },
  watch: {
    "content.items"() { this.syncRows(); },
    "content.columns"() { this.initHidden(); },
    "content.lob"() { this.initHidden(); },
    filteredCount() { if (this.page > this.pageCount) this.page = this.pageCount; },
  },
  computed: {
    totalCount() { return this.localRows.length; },
    svgAttrs() {
      return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    },
    resolvedColumns() {
      let defs = Array.isArray(this.content.columns) ? this.content.columns.filter((c) => c && c.key != null && c.key !== "") : [];
      if (!defs.length) defs = this.inferColumns();
      return defs.map((c) => this.resolveCol(c));
    },
    visibleColumns() { return this.resolvedColumns.filter((c) => !this.hidden[c.key]); },
    optionsByKey() {
      const m = {};
      this.resolvedColumns.forEach((c) => { m[c.key] = this.colOptions(c); });
      return m;
    },
    filterableColumns() { return this.visibleColumns.filter((c) => c.filterable); },
    addColumns() { return this.resolvedColumns.filter((c) => this.isAddable(c)); },
    canReorder() { return this.content.reorderable !== false; },
    footColspan() { return this.visibleColumns.length + (this.content.showRowAction ? 1 : 0) + (this.canReorder ? 1 : 0); },
    gridStyle() {
      // Give the table a comfortable min-width so columns aren't crammed; the
      // wrapper scrolls horizontally when it exceeds the container.
      let w = 0;
      this.visibleColumns.forEach((c) => { w += c.width ? Number(c.width) : this.defaultColWidth(c); });
      if (this.canReorder) w += 34;
      if (this.content.showRowAction) w += 96;
      return { minWidth: w + "px" };
    },
    anyFilterActive() { return Object.keys(this.filters).some((k) => String(this.filters[k] || "").trim() !== ""); },
    filteredRows() {
      let rows = this.localRows.map((data, _i) => ({ data, _i }));
      const fcols = this.filterableColumns;
      rows = rows.filter((r) => fcols.every((col) => {
        const f = String(this.filters[col.key] || "").trim().toLowerCase();
        if (!f) return true;
        return String(this.normVal(this.cellValue(col, r.data))).toLowerCase().indexOf(f) !== -1;
      }));
      // Optional client-side search across all columns.
      const q = this.content.searchLocal ? String(this.searchQuery || "").trim().toLowerCase() : "";
      if (q) {
        const scols = this.resolvedColumns.filter((c) => c.filterable !== false);
        rows = rows.filter((r) => scols.some((col) => String(this.normVal(this.cellValue(col, r.data))).toLowerCase().indexOf(q) !== -1));
      }
      if (this.sortKey && this.sortDir) {
        const col = this.colByKey(this.sortKey);
        const num = col && this.isNumericType(col.type);
        const dir = this.sortDir === "asc" ? 1 : -1;
        rows = rows.slice().sort((a, b) => {
          const ca = this.cellValue(col, a.data), cb = this.cellValue(col, b.data);
          if (num) return ((Number(ca) || 0) - (Number(cb) || 0)) * dir;
          return String(this.normVal(ca)).localeCompare(String(this.normVal(cb))) * dir;
        });
      }
      return rows;
    },
    filteredCount() { return this.filteredRows.length; },
    pageCount() { return Math.max(1, Math.ceil(this.filteredCount / this.pageSize)); },
    pageClamped() { return Math.min(this.page, this.pageCount); },
    pagedRows() {
      if (this.content.paginate === false) return this.filteredRows;
      const start = (this.pageClamped - 1) * this.pageSize;
      return this.filteredRows.slice(start, start + this.pageSize);
    },
    rangeStart() { return this.filteredCount === 0 ? 0 : (this.pageClamped - 1) * this.pageSize + 1; },
    rangeEnd() { return Math.min(this.filteredCount, this.pageClamped * this.pageSize); },
    pageSizeOptions() {
      const o = this.content.pageSizeOptions;
      const arr = Array.isArray(o) ? o.map((n) => Number(n)).filter((n) => n > 0) : [];
      return arr.length ? arr : [10, 25, 50, 100];
    },
    totalColumns() {
      const explicit = this.visibleColumns.filter((c) => c.total === true);
      if (explicit.length) return explicit;
      if (this.content.showTotals) return this.visibleColumns.filter((c) => c.type === "number" || c.type === "currency");
      return [];
    },
    totals() {
      const t = {};
      this.totalColumns.forEach((col) => {
        let sum = 0;
        this.filteredRows.forEach((r) => { const n = Number(this.cellValue(col, r.data)); if (isFinite(n)) sum += n; });
        t[col.key] = sum;
      });
      return t;
    },
    densityClass() { return this.content.density === "compact" ? "pp-density-compact" : ""; },
    themeClass() {
      const m = this.content.darkMode || "auto";
      return { "pp-auto": m === "auto", "pp-dark": m === "dark", "pp-light": m === "light" };
    },
    rootStyle() {
      return {
        "--pp-primary": this.content.primaryColor || "#10b981",
        "--pp-accent": this.content.accentColor || "#6366f1",
        "--pp-radius": (this.content.radius != null ? this.content.radius : 16) + "px",
      };
    },
  },
  methods: {
    ic(name) { return ICONS[name] || ""; },
    isEmpty(v) { return v == null || v === ""; },
    isNumericType(t) { return t === "number" || t === "currency" || t === "percent"; },
    syncRows() {
      const src = this.content.items;
      const arr = Array.isArray(src) ? src : (src && Array.isArray(src.data) ? src.data : []);
      this.localRows = arr.map((r) => this.applyComputed(r && typeof r === "object" ? Object.assign({}, r) : { value: r }));
    },
    applyComputed(rowData) {
      this.resolvedColumns.forEach((col) => { if (col.compute) rowData[col.key] = this.computeValue(col, rowData); });
      return rowData;
    },
    initHidden() {
      const h = {};
      this.resolvedColumns.forEach((c) => { if (this.effectiveColHidden(c)) h[c.key] = true; });
      this.hidden = h;
    },
    effectiveColHidden(col) {
      const lob = this.content.lob != null && this.content.lob !== "" ? String(this.content.lob) : null;
      // Whitelist: visible ONLY when the parent LOB is in showForLob.
      if (col.showForLob && col.showForLob.length) return !(lob && col.showForLob.indexOf(lob) !== -1);
      // Base hidden, plus blacklist by LOB.
      let hidden = col.hidden === true;
      if (col.hideForLob && col.hideForLob.length && lob && col.hideForLob.indexOf(lob) !== -1) hidden = true;
      return hidden;
    },
    humanize(key) {
      return String(key).replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (m) => m.toUpperCase());
    },
    inferColumns() {
      const keys = [];
      const seen = {};
      this.localRows.forEach((r) => Object.keys(r || {}).forEach((k) => { if (!seen[k]) { seen[k] = true; keys.push(k); } }));
      return keys.map((k) => ({ key: k, label: this.humanize(k), type: this.guessType(k) }));
    },
    guessType(key) {
      const k = String(key).toLowerCase();
      let numeric = true, has = false;
      for (const r of this.localRows) {
        const v = r[key];
        if (v == null || v === "") continue;
        has = true;
        if (typeof v === "boolean" || isNaN(Number(v))) { numeric = false; break; }
      }
      if (numeric && has) {
        if (PCT_RE.test(k)) return "percent";
        if (MONEY_RE.test(k)) return "currency";
        return "number";
      }
      if (/status/.test(k)) return "status";
      if (DATE_RE.test(k)) return "date";
      return "text";
    },
    resolveCol(c) {
      const key = String(c.key);
      return {
        key,
        label: c.label != null && c.label !== "" ? c.label : this.humanize(key),
        type: c.type || "text",
        align: c.align || "auto",
        editable: c.editable === true ? true : (c.editable === false ? false : null),
        addable: c.addable === true ? true : (c.addable === false ? false : null),
        multiline: c.multiline === true,
        filterable: c.filterable !== false,
        sortable: c.sortable !== false,
        hidden: c.hidden === true,
        total: c.total === true,
        width: c.width != null && c.width !== "" ? c.width : null,
        prefix: c.prefix || "",
        suffix: c.suffix || "",
        options: Array.isArray(c.options) && c.options.length ? c.options : null,
        optionsKey: c.optionsKey || null,
        optionLabel: c.optionLabel || null,
        optionValue: c.optionValue || null,
        emitOnSelect: c.emitOnSelect === true,
        showForLob: Array.isArray(c.showForLob) ? c.showForLob.map(String) : null,
        hideForLob: Array.isArray(c.hideForLob) ? c.hideForLob.map(String) : null,
        decimals: c.decimals != null && c.decimals !== "" ? Number(c.decimals) : null,
        scale: c.scale != null && c.scale !== "" ? Number(c.scale) : null,
        sortOptions: c.sortOptions !== false,
        compute: c.compute && typeof c.compute === "object" ? c.compute : null,
        derive: Array.isArray(c.derive) && c.derive.length ? c.derive : null,
        picker: c.picker && typeof c.picker === "object" ? c.picker : null,
        addDefault: c.addDefault,
      };
    },
    colOptions(col) {
      let src = Array.isArray(col.options) && col.options.length ? col.options : null;
      if (!src && col.optionsKey) {
        let os = this.content.optionSources;
        // Unwrap a bound collection object: { data: [...] } -> [...]
        if (os && !Array.isArray(os) && Array.isArray(os.data)) os = os.data;
        let list = null;
        if (Array.isArray(os)) {
          // Pair form: [{ key, options }]. Only treat as pairs when entries actually carry `key`+`options`.
          const isPairs = os.some((o) => o && typeof o === "object" && "key" in o && "options" in o);
          if (isPairs) { const found = os.find((o) => o && o.key === col.optionsKey); if (found) list = found.options; }
          // Bare array of option records (e.g. a collection bound directly) -> use as the single source.
          else list = os;
        } else if (os && typeof os === "object") {
          list = os[col.optionsKey];
        }
        if (list && !Array.isArray(list) && Array.isArray(list.data)) list = list.data;
        if (Array.isArray(list)) src = list;
      }
      if (!src) return [];
      const lk = col.optionLabel, vk = col.optionValue;
      const mapped = src.map((o) => {
        if (o && typeof o === "object") {
          const label = lk && o[lk] != null ? o[lk] : (o.name || o.label || o.title || o.value || "");
          const value = vk ? (o[vk] != null ? o[vk] : "") : label;
          return { label: String(label), value, raw: o };
        }
        return { label: String(o), value: o, raw: o };
      });
      // Sort options alphabetically by label unless a column opts out (sortOptions: false).
      if (col.sortOptions !== false) {
        mapped.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
      }
      return mapped;
    },
    colByKey(key) { return this.resolvedColumns.find((c) => c.key === key); },
    getPath(obj, path) {
      if (obj == null || path == null || path === "") return undefined;
      if (String(path).indexOf(".") === -1) return obj[path];
      return String(path).split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
    },
    computeValue(col, rowData) {
      const c = col.compute; if (!c) return rowData ? rowData[col.key] : "";
      const keys = Array.isArray(c.keys) ? c.keys : [];
      const nums = keys.map((k) => { const n = Number(this.getPath(rowData, k)); return isFinite(n) ? n : 0; });
      const op = c.op || "product";
      if (op === "sum") return nums.reduce((a, b) => a + b, 0);
      if (op === "difference") return nums.length ? nums.reduce((a, b) => a - b) : 0;
      return keys.length ? nums.reduce((a, b) => a * b, 1) : 0; // product
    },
    deriveValue(col, rowData) {
      for (const rule of (col.derive || [])) {
        if (rule.ifKey == null) return rule.value; // fallback (no condition)
        const t = this.truthyBool(this.getPath(rowData, rule.ifKey));
        const pass = rule.is === "falsy" ? !t : t; // default: truthy
        if (pass) return rule.value;
      }
      return "";
    },
    cellValue(col, rowData) {
      if (col.derive) return this.deriveValue(col, rowData);
      if (col.compute) return this.computeValue(col, rowData);
      return rowData ? rowData[col.key] : "";
    },
    // ---- add-form price-guide picker ----
    pickerSourceItems(col) {
      const p = col.picker || {};
      let os = this.content.pickerSources;
      if (os && !Array.isArray(os) && Array.isArray(os.data)) os = os.data;
      let list = null;
      const key = p.sourceKey;
      if (Array.isArray(os)) {
        const isPairs = os.some((o) => o && typeof o === "object" && "key" in o && "options" in o);
        if (isPairs && key) { const f = os.find((o) => o && o.key === key); if (f) list = f.options; }
        else list = os; // bare array -> single source
      } else if (os && typeof os === "object") {
        list = key ? os[key] : null;
      }
      if (list && !Array.isArray(list) && Array.isArray(list.data)) list = list.data;
      return Array.isArray(list) ? list : [];
    },
    filteredPickerItems(col) {
      const p = col.picker || {};
      let items = this.pickerSourceItems(col);
      if (p.categoryKey && p.itemCategoryField) {
        const cat = this.newRow[p.categoryKey];
        if (cat != null && cat !== "") {
          const want = String(cat);
          items = items.filter((it) => {
            let iv = this.getPath(it, p.itemCategoryField);
            if (iv == null) { const c = it.category; iv = c && typeof c === "object" ? (c.airtable_record_id || c.id) : c; }
            return String(iv) === want;
          });
        }
      }
      const q = String(this.newRow[col.key] || "").trim().toLowerCase();
      if (q) {
        const fields = Array.isArray(p.searchFields) && p.searchFields.length ? p.searchFields : [p.labelField || "description"];
        items = items.filter((it) => fields.some((f) => String(this.getPath(it, f) || "").toLowerCase().indexOf(q) !== -1));
      }
      return items.slice(0, p.limit || 50);
    },
    pickerLabel(col, item) { return String(this.getPath(item, (col.picker || {}).labelField || "description") || ""); },
    pickerIcon(col, item) { const f = (col.picker || {}).iconField; return f ? this.getPath(item, f) : null; },
    pickerHint(col, item) {
      const f = (col.picker || {}).hintField; if (!f) return "";
      const v = this.getPath(item, f);
      if (v == null || v === "") return "";
      return isFinite(Number(v)) ? this.money(Number(v), 0) : String(v);
    },
    openPicker(col) { this.pickerOpenKey = col.key; },
    onPickerFocus(col, e) { this.openPicker(col); this.autoGrow(e); },
    onPickerInput(col, e) { this.openPicker(col); this.autoGrow(e); },
    closePicker() { this.pickerOpenKey = null; },
    closePickerSoon() { setTimeout(() => { this.pickerOpenKey = null; }, 120); },
    choosePicker(col, item) {
      const p = col.picker || {};
      const map = p.map || {};
      const nr = Object.assign({}, this.newRow);
      const mapKeys = Object.keys(map);
      if (mapKeys.length) mapKeys.forEach((rowKey) => { nr[rowKey] = this.getPath(item, map[rowKey]); });
      else nr[col.key] = this.pickerLabel(col, item);
      this.newRow = nr;
      this.pickerOpenKey = null;
      // Grow the description textarea to fit the filled-in text.
      this.$nextTick(() => { const el = document.activeElement; if (el && el.tagName === "TEXTAREA") this.autoGrow(el); });
      if (p.emitOnSelect) {
        this.$emit("trigger-event", { name: "optionSelect", event: { key: col.key, value: this.getPath(item, p.valueField || "airtable_id"), label: this.pickerLabel(col, item), context: "add", rowIndex: -1, row: Object.assign({}, nr), item } });
      }
    },
    pickerEmptyText(col) {
      const total = this.pickerSourceItems(col).length;
      if (!total) return "No items — bind “Picker sources” to your price-guide collection";
      const p = col.picker || {};
      if (p.categoryKey && this.newRow[p.categoryKey]) return "No price-guide items for the selected category";
      return "No matches";
    },
    addComputedDisplay(col) { return this.cellDisplay(col, this.computeValue(col, this.newRow)); },
    resetNewRow() {
      const nr = {};
      this.resolvedColumns.forEach((c) => { if (c.addDefault !== undefined) nr[c.key] = c.addDefault; });
      this.newRow = nr;
    },
    alignFor(col) {
      if (col.align && col.align !== "auto") return col.align;
      return this.isNumericType(col.type) ? "right" : "left";
    },
    alignClass(col) { return "pp-al-" + this.alignFor(col); },
    thStyle(col) { return col.width ? { width: col.width + "px", minWidth: col.width + "px" } : {}; },
    defaultColWidth(col) {
      if (col.type === "boolean") return 96;
      if (col.type === "status") return 130;
      if (this.isNumericType(col.type)) return 100;
      if (col.multiline) return 200;
      return 140;
    },
    money(n, decimals) {
      if (n == null || n === "") return "";
      if (typeof n === "string" && isNaN(Number(n))) return n;
      const d = decimals != null ? decimals : 2;
      try { return new Intl.NumberFormat("en-US", { style: "currency", currency: this.content.currency || "USD", minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n)); }
      catch (e) { return String(n); }
    },
    fmtNumber(n, decimals) {
      const num = Number(n);
      if (!isFinite(num)) return String(n);
      const opts = {};
      if (decimals != null) { opts.minimumFractionDigits = decimals; opts.maximumFractionDigits = decimals; }
      return new Intl.NumberFormat("en-US", opts).format(num);
    },
    fmtDate(v) {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
    },
    joinArray(arr) {
      return arr
        .map((x) => (x && typeof x === "object" ? (x.name || x.label || x.title || x.value || "") : x))
        .filter((v) => v != null && v !== "")
        .join(", ");
    },
    normVal(v) {
      if (Array.isArray(v)) return this.joinArray(v);
      if (v && typeof v === "object") return v.name || v.label || v.title || v.value || "";
      return v == null ? "" : v;
    },
    truthyBool(v) {
      if (Array.isArray(v)) v = v[0];
      return v === true || v === 1 || v === "1" || /^(true|yes|y)$/i.test(String(v));
    },
    cellDisplay(col, raw) {
      if (this.isEmpty(raw)) return "";
      if (col.type === "boolean") return this.truthyBool(raw) ? (this.content.boolTrue || "Yes") : (this.content.boolFalse || "No");
      const opts = this.optionsByKey[col.key];
      if (opts && opts.length) {
        const mapOne = (v) => { const m = opts.find((o) => o.value === v || String(o.value) === String(v)); return m ? m.label : v; };
        const mapped = Array.isArray(raw) ? this.joinArray(raw.map(mapOne)) : mapOne(raw);
        if (mapped != null && mapped !== "") return (col.prefix || "") + String(mapped) + (col.suffix || "");
      }
      if (Array.isArray(raw)) raw = this.joinArray(raw);
      if (this.isEmpty(raw)) return "";
      let n = raw;
      if (this.isNumericType(col.type)) {
        let x = Number(raw);
        if (!isFinite(x)) x = 0; // guard objects / NaN / divide-by-zero (e.g. margin when retail is 0) -> 0
        n = col.scale != null ? x * col.scale : x;
      }
      let out;
      switch (col.type) {
        case "currency": out = this.money(n, col.decimals); break;
        case "number": out = this.fmtNumber(n, col.decimals); break;
        case "percent": out = this.fmtNumber(n, col.decimals != null ? col.decimals : 0) + "%"; break;
        case "date": out = this.fmtDate(raw); break;
        default: out = String(raw);
      }
      return (col.prefix || "") + out + (col.suffix || "");
    },
    statusKey(status) {
      const s = String(Array.isArray(status) ? status.join(" ") : (status == null ? "" : status)).toLowerCase();
      // Check negatives first so "unapproved"/"unpaid" don't match "approv"/"paid".
      if (/unapprov|unpaid|declin|cancel|overdue|reject|fail|void/.test(s)) return "danger";
      if (/progress|pending|review|hold|await/.test(s)) return "warning";
      if (/approv|paid|complete|finish|done|success|active/.test(s)) return "success";
      if (/schedul|draft|new|open/.test(s)) return "info";
      return "slate";
    },
    isEditable(col) { return this.content.editable !== false && col.editable !== false && !col.compute; },
    isAddable(col) {
      if (col.addable === true) return true;
      if (col.addable === false) return false;
      return col.editable !== false;
    },
    isEditingCell(col, r) { return this.editing && this.editing.key === col.key && this.editing.i === r._i; },
    autoGrow(e) {
      const el = e && e.target ? e.target : e;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 320) + "px";
    },
    onTextareaEnter(e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.commitEdit(); }
    },
    startEdit(col, r) {
      if (!this.isEditable(col) || this.isEditingCell(col, r)) return;
      if (col.type === "boolean") {
        const v = !this.truthyBool(r.data[col.key]);
        const row = this.applyComputed(Object.assign({}, this.localRows[r._i], { [col.key]: v }));
        this.localRows.splice(r._i, 1, row);
        this.$emit("trigger-event", { name: "cellChange", event: { rowIndex: r._i, key: col.key, value: v, row, rows: this.localRows.slice() } });
        return;
      }
      this.editing = { key: col.key, i: r._i };
      let v = r.data[col.key];
      const opts = this.optionsByKey[col.key];
      if (opts && opts.length && Array.isArray(v)) v = v.length ? v[0] : "";
      this.editValue = v == null ? "" : v;
      this.$nextTick(() => {
        const el = this.$refs.editor;
        const node = Array.isArray(el) ? el[0] : el;
        if (node) {
          node.focus();
          if (node.tagName === "TEXTAREA") { node.style.height = "auto"; node.style.height = Math.min(node.scrollHeight, 320) + "px"; }
          else if (node.select) node.select();
        }
      });
    },
    commitEdit() {
      if (!this.editing) return;
      const col = this.colByKey(this.editing.key);
      let v = this.editValue;
      if (col && this.isNumericType(col.type)) {
        const n = Number(v);
        if (v !== "" && !isNaN(n)) v = n;
      }
      const i = this.editing.i;
      const key = this.editing.key;
      const row = this.applyComputed(Object.assign({}, this.localRows[i], { [key]: v }));
      this.localRows.splice(i, 1, row);
      this.$emit("trigger-event", { name: "cellChange", event: { rowIndex: i, key, value: v, row, rows: this.localRows.slice() } });
      if (col && col.emitOnSelect) {
        const opt = (this.optionsByKey[key] || []).find((o) => o.value === v || String(o.value) === String(v));
        this.$emit("trigger-event", { name: "optionSelect", event: { key, value: v, label: opt ? opt.label : v, context: "edit", rowIndex: i, row } });
      }
      this.editing = null;
    },
    onAddSelect(col) {
      if (!col.emitOnSelect) return;
      const v = this.newRow[col.key];
      const opt = (this.optionsByKey[col.key] || []).find((o) => o.value === v || String(o.value) === String(v));
      this.$emit("trigger-event", { name: "optionSelect", event: { key: col.key, value: v, label: opt ? opt.label : v, context: "add", rowIndex: -1, row: Object.assign({}, this.newRow) } });
    },
    cancelEdit() { this.editing = null; },
    toggleSort(col) {
      if (!col.sortable) return;
      if (this.sortKey !== col.key) { this.sortKey = col.key; this.sortDir = "asc"; }
      else if (this.sortDir === "asc") this.sortDir = "desc";
      else { this.sortKey = null; this.sortDir = null; }
      this.$emit("trigger-event", { name: "sortChange", event: { key: this.sortKey, dir: this.sortDir } });
    },
    onSearch(v, immediate) {
      this.searchQuery = v;
      this.page = 1;
      if (this._searchTimer) { clearTimeout(this._searchTimer); this._searchTimer = null; }
      const fire = () => this.$emit("trigger-event", { name: "search", event: { query: this.searchQuery } });
      const delay = Number(this.content.searchDebounce);
      if (immediate || !(delay > 0)) fire();
      else this._searchTimer = setTimeout(fire, delay);
    },
    toggleFilters() { this.filtersOpen = !this.filtersOpen; },
    setFilter(col, val) {
      this.filters[col.key] = val;
      this.page = 1;
      this.$emit("trigger-event", { name: "filterChange", event: { filters: Object.assign({}, this.filters) } });
    },
    clearFilters() {
      this.filters = {};
      this.page = 1;
      this.$emit("trigger-event", { name: "filterChange", event: { filters: {} } });
    },
    toggleColumn(col) {
      if (this.hidden[col.key]) delete this.hidden[col.key];
      else this.hidden[col.key] = true;
      this.hidden = Object.assign({}, this.hidden);
    },
    isTotalCol(col) { return this.totalColumns.some((c) => c.key === col.key); },
    goPage(p) {
      const next = Math.max(1, Math.min(this.pageCount, p));
      if (next === this.page) return;
      this.page = next;
      this.$emit("trigger-event", { name: "pageChange", event: { page: next } });
    },
    setPageSize(v) {
      this.pageSize = Number(v) > 0 ? Number(v) : 10;
      this.page = 1;
    },
    addRow() {
      const row = {};
      this.addColumns.forEach((col) => {
        let v = this.newRow[col.key];
        if (v != null && v !== "" && this.isNumericType(col.type)) { const n = Number(v); if (!isNaN(n)) v = n; }
        row[col.key] = v == null ? "" : v;
      });
      // Fill computed columns (e.g. Retail = Qty × Unit Retail) from the assembled row.
      this.resolvedColumns.forEach((col) => { if (col.compute) row[col.key] = this.computeValue(col, row); });
      this.localRows.push(row);
      this.resetNewRow();
      this.$emit("trigger-event", { name: "addRow", event: { row } });
      if (this.content.paginate !== false) this.goPage(this.pageCount);
    },
    emitView(r) { this.$emit("trigger-event", { name: "view", event: { index: r._i, row: r.data } }); },
    onDragStart(r, e) {
      this.dragFrom = r._i;
      if (e && e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(r._i)); } catch (_) { /* noop */ } }
    },
    onDragOver(r) { if (this.dragFrom != null) this.dragOver = r._i; },
    onDragLeave(r) { if (this.dragOver === r._i) this.dragOver = null; },
    onDrop(r) {
      const from = this.dragFrom, to = r._i;
      this.dragFrom = null; this.dragOver = null;
      if (from == null || from === to) return;
      this.moveRow(from, to);
    },
    onDragEnd() { this.dragFrom = null; this.dragOver = null; },
    moveRow(from, to) {
      const arr = this.localRows.slice();
      const moved = arr.splice(from, 1)[0];
      arr.splice(to, 0, moved);
      this.localRows = arr;
      this.editing = null;
      // Manual order only makes sense unsorted — clear the active sort so it shows.
      this.sortKey = null; this.sortDir = null;
      const ids = arr.map((row) => (row && row.id != null ? row.id : null));
      this.$emit("trigger-event", { name: "reorder", event: { from, to, ids, rows: arr } });
    },
  },
};
</script>

<style lang="scss" scoped>
.pp-root {
  --surface: #ffffff; --surface-2: #f7f9fc; --surface-3: #eef2f7; --border: #e4e9f0; --border-strong: #d4dbe6;
  --text: #1f2a37; --text-muted: #64748b; --text-subtle: #94a3b8;
  --shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06);
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-pop: 0 12px 32px rgba(16, 24, 40, 0.16);
  --success: #10b981; --warning: #f59e0b; --danger: #ef4444; --info: #3b82f6;
  --primary: var(--pp-primary, #10b981); --accent: var(--pp-accent, #6366f1); --radius: var(--pp-radius, 16px);
  box-sizing: border-box; width: 100%; max-width: 100%; container-type: inline-size; color: var(--text);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.45;
}
.pp-root *, .pp-root *::before, .pp-root *::after { box-sizing: border-box; }
@mixin dark {
  --surface: #161f30; --surface-2: #1b2638; --surface-3: #202c40; --border: #28344a; --border-strong: #34425c;
  --text: #e8eef7; --text-muted: #94a3b8; --text-subtle: #64748b;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 28px rgba(0, 0, 0, 0.35);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-pop: 0 12px 32px rgba(0, 0, 0, 0.5);
}
.pp-root.pp-dark { @include dark; }
@media (prefers-color-scheme: dark) { .pp-root.pp-auto { @include dark; } }

.pp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(16px, 2.4vw, 24px); }
.pp-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.pp-card__heading { margin: 0; font-size: 18px; font-weight: 700; color: var(--text); }
.pp-card__sub { margin: 4px 0 0; color: var(--text-muted); font-size: 13px; }

.pp-badge { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.pp-badge .pp-svg { width: 14px; height: 14px; }
.pp-badge--info { background: color-mix(in srgb, var(--info) 14%, transparent); color: var(--info); }

/* search */
.pp-search { position: relative; margin-bottom: 14px; }
.pp-search__icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 17px; height: 17px; color: var(--text-subtle); pointer-events: none; }
.pp-search .pp-search__input { padding: 0 40px; height: 44px; font-size: 14px; }
.pp-search__clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: inline-grid; place-items: center; width: 28px; height: 28px; border: none; background: none; border-radius: 7px; color: var(--text-subtle); cursor: pointer; }
.pp-search__clear:hover { background: var(--surface-2); color: var(--text); }
.pp-search__clear .pp-svg { width: 15px; height: 15px; }

/* toolbar */
.pp-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.pp-toolbar__spacer { flex: 1 1 auto; }
.pp-tool { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-muted); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s, color .15s, border-color .15s; }
.pp-tool .pp-svg { width: 15px; height: 15px; }
.pp-tool:hover { background: var(--surface-2); color: var(--text); }
.pp-tool--on { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, transparent); }
.pp-tool--clear { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 35%, transparent); }
.pp-chooser { position: relative; }
.pp-chooser__menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; min-width: 200px; max-height: 320px; overflow-y: auto; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-pop); display: flex; flex-direction: column; gap: 2px; }
.pp-chooser__item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 8px; font-size: 13.5px; font-weight: 600; color: var(--text); cursor: pointer; }
.pp-chooser__item:hover { background: var(--surface-2); }
.pp-chooser__item input { width: 15px; height: 15px; accent-color: var(--primary); }

/* filters panel */
.pp-filters { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 14px; padding: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; }

/* fields */
.pp-fieldgroup { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pp-fieldgroup > span { font-size: 12px; font-weight: 700; color: var(--text); }
.pp-input { width: 100%; padding: 9px 11px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 13.5px; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s; }
.pp-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent); }
.pp-input--sm { width: auto; padding: 6px 9px; font-size: 12.5px; }

/* grid */
.pp-grid__wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
.pp-grid { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 12.5px; }
.pp-grid thead th { padding: 10px 12px; font-size: 11.5px; font-weight: 700; color: var(--text-muted); background: var(--surface-2); border-bottom: 1px solid var(--border); white-space: nowrap; vertical-align: middle; }
.pp-th { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; padding: 0; margin: 0; font: inherit; font-size: 12px; font-weight: 700; color: inherit; cursor: default; }
.pp-th--sortable { cursor: pointer; }
.pp-th--sortable:hover { color: var(--text); }
.pp-al-right .pp-th { flex-direction: row-reverse; }
.pp-sort { width: 13px; height: 13px; color: var(--text-subtle); opacity: .55; flex: none; }
.pp-sort--active { color: var(--primary); opacity: 1; }
.pp-grid tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; max-width: 460px; }
.pp-grid:not(.pp-grid--wrap) tbody td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-grid--wrap tbody td { white-space: normal; word-break: break-word; }
.pp-grid tbody tr:last-child td { border-bottom: none; }
.pp-grid tbody tr:hover { background: var(--surface-2); }
.pp-grid tfoot td { padding: 12px 14px; border-top: 2px solid var(--border-strong); background: var(--surface-2); color: var(--text); font-size: 13.5px; }
.pp-foot__label { color: var(--text-muted); text-transform: uppercase; font-size: 11.5px; letter-spacing: .04em; }
.pp-al-left { text-align: left; }
.pp-al-right { text-align: right; }
.pp-al-center { text-align: center; }
.pp-muted { color: var(--text-subtle); }
.pp-td--editable { cursor: text; }
.pp-td--editable:hover { background: color-mix(in srgb, var(--primary) 7%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 25%, transparent); }
.pp-td--editing { padding: 4px 6px; background: color-mix(in srgb, var(--primary) 6%, transparent); }
.pp-input--cell { padding: 6px 8px; font-size: 13px; }
.pp-textarea { resize: none; overflow-y: auto; min-height: 34px; max-height: 320px; line-height: 1.5; white-space: pre-wrap; }
.pp-cell--multiline { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line; }
.pp-td--multiline { white-space: normal; vertical-align: top; }

/* drag-to-reorder */
.pp-grid__draghead { width: 34px; }
.pp-grid__drag { width: 34px; text-align: center; color: var(--text-subtle); cursor: grab; }
.pp-grid__drag:active { cursor: grabbing; }
.pp-grid__drag .pp-svg { width: 16px; height: 16px; margin: 0 auto; }
.pp-grid__drag:hover { color: var(--text); }
.pp-tr--drag { opacity: .45; }
.pp-tr--over td { box-shadow: inset 0 2px 0 var(--primary); }

.pp-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; background: var(--surface-3); color: var(--text-muted); white-space: nowrap; }
.pp-pill__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.pp-pill--warning { background: color-mix(in srgb, var(--warning) 14%, transparent); color: var(--warning); }
.pp-pill--success { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); }
.pp-pill--danger  { background: color-mix(in srgb, var(--danger) 14%, transparent);  color: var(--danger); }
.pp-pill--info    { background: color-mix(in srgb, var(--info) 14%, transparent);    color: var(--info); }
.pp-pill--slate   { background: var(--surface-3); color: var(--text-muted); }

.pp-bool { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; }
.pp-bool .pp-svg { width: 14px; height: 14px; }
.pp-bool--on { color: var(--success); }
.pp-bool--off { color: var(--text-subtle); }
.pp-td--editable .pp-bool { cursor: pointer; }
.pp-checkwrap { display: inline-flex; align-items: center; gap: 8px; height: 38px; font-size: 13.5px; font-weight: 600; color: var(--text); }
.pp-checkwrap input { width: 17px; height: 17px; accent-color: var(--primary); }

.pp-empty { text-align: center; padding: 30px 16px; color: var(--text-subtle); }

.pp-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 10px; border: 1px solid transparent; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; transition: filter .15s, background .15s; }
.pp-btn .pp-svg { width: 16px; height: 16px; }
.pp-btn--primary { background: var(--primary); color: #fff; box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 35%, transparent); }
.pp-btn--primary:hover { filter: brightness(1.06); }
.pp-btn--ghost { background: color-mix(in srgb, var(--info) 10%, transparent); color: var(--info); padding: 6px 12px; }
.pp-btn--ghost:hover { background: color-mix(in srgb, var(--info) 18%, transparent); }

/* pagination */
.pp-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.pp-pager__size { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
.pp-pager__range { font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
.pp-pager__nav { display: inline-flex; align-items: center; gap: 4px; }
.pp-pager__pageno { font-size: 12.5px; color: var(--text); font-weight: 600; padding: 0 8px; white-space: nowrap; }
.pp-iconbtn { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-muted); cursor: pointer; transition: background .15s, color .15s; }
.pp-iconbtn:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
.pp-iconbtn:disabled { opacity: .4; cursor: not-allowed; }
.pp-iconbtn .pp-svg { width: 16px; height: 16px; }

/* add-row form */
.pp-addrow { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border); }
.pp-addrow__head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 13.5px; font-weight: 700; color: var(--text); }
.pp-addrow__head .pp-svg { width: 16px; height: 16px; color: var(--primary); }
.pp-addrow__grid { display: grid; grid-template-columns: 1fr; gap: 14px 16px; align-items: end; }
.pp-addrow__btnwrap { justify-content: flex-end; }
.pp-addrow__btn { height: 40px; justify-content: center; width: 100%; }
.pp-svg { display: block; }

/* read-only computed field (e.g. Retail) */
.pp-input--readonly { display: flex; align-items: center; justify-content: flex-end; min-height: 38px; background: var(--surface-2); color: var(--text); font-weight: 700; cursor: default; }

/* add-form searchable picker (price guide) */
.pp-picker { position: relative; }
.pp-picker__menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; max-height: 300px; overflow-y: auto; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-pop); display: flex; flex-direction: column; gap: 2px; }
.pp-picker__item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 10px; border: none; background: none; border-radius: 8px; cursor: pointer; font: inherit; color: var(--text); }
.pp-picker__item:hover { background: var(--surface-2); }
.pp-picker__icon { width: 28px; height: 28px; border-radius: 6px; object-fit: cover; flex: none; background: var(--surface-3); }
.pp-picker__label { flex: 1 1 auto; font-size: 13px; font-weight: 600; line-height: 1.35; }
.pp-picker__hint { flex: none; font-size: 12.5px; font-weight: 700; color: var(--primary); white-space: nowrap; }
.pp-picker__empty { padding: 12px 12px; font-size: 12.5px; color: var(--text-subtle); text-align: center; }

/* density */
.pp-density-compact .pp-grid thead th { padding: 7px 10px; }
.pp-density-compact .pp-grid tbody td { padding: 7px 10px; }
.pp-density-compact .pp-grid tfoot td { padding: 8px 10px; }

/* responsive */
@container (min-width: 540px) {
  .pp-filters { grid-template-columns: repeat(2, 1fr); }
  .pp-addrow__grid { grid-template-columns: repeat(2, 1fr); }
}
@container (min-width: 880px) {
  .pp-filters { grid-template-columns: repeat(3, 1fr); }
  .pp-addrow__grid { grid-template-columns: repeat(4, 1fr); }
}

/* mobile card layout for the grid */
@container (max-width: 600px) {
  .pp-grid__wrap { border: none; overflow: visible; }
  .pp-grid { table-layout: fixed; }
  .pp-grid thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .pp-grid tbody tr { display: block; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 10px; padding: 4px 6px; background: var(--surface); }
  .pp-grid tbody tr:hover { background: var(--surface); }
  .pp-grid tbody td { display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid var(--border); padding: 9px 6px; white-space: normal; max-width: none; text-align: right; }
  .pp-grid tbody tr td:last-child { border-bottom: none; }
  .pp-grid tbody td::before { content: attr(data-label); font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .03em; text-align: left; flex: none; }
  .pp-grid tbody td.pp-td--editing { display: flex; }
  .pp-grid__drag, .pp-grid__draghead { display: none; }
  .pp-grid tbody td.pp-td--multiline { display: block; }
  .pp-grid tbody td.pp-td--multiline::before { display: block; margin-bottom: 4px; }
  .pp-cell--multiline { -webkit-line-clamp: 6; text-align: left; }
  .pp-grid tfoot { display: block; }
  .pp-grid tfoot tr { display: block; border: 1px solid var(--border-strong); border-radius: 12px; }
  .pp-grid tfoot td { display: flex; align-items: center; justify-content: space-between; border-top: none; border-bottom: 1px solid var(--border); }
  .pp-grid tfoot td::before { content: attr(data-label); font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
  .pp-grid tfoot td:last-child { border-bottom: none; }
  .pp-pager { justify-content: center; }
}
@supports not (container-type: inline-size) {
  @media (min-width: 880px) {
    .pp-filters { grid-template-columns: repeat(3, 1fr); }
    .pp-addrow__grid { grid-template-columns: repeat(4, 1fr); }
  }
}
</style>
