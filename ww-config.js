export default {
  editor: { label: { en: "Data Grid" } },
  triggerEvents: [
    { name: "cellChange", label: { en: "On cell value changed" }, event: { rowIndex: 0, key: "", value: "", row: {}, rows: [] } },
    { name: "addRow", label: { en: "On add row" }, event: { row: {} } },
    { name: "view", label: { en: "On row action (view)" }, event: { index: 0, row: {} } },
    { name: "sortChange", label: { en: "On sort changed" }, event: { key: "", dir: "" } },
    { name: "filterChange", label: { en: "On filter changed" }, event: { filters: {} } },
    { name: "pageChange", label: { en: "On page changed" }, event: { page: 1 } },
    { name: "reorder", label: { en: "On rows reordered" }, event: { from: 0, to: 0, ids: [], rows: [] } },
    { name: "optionSelect", label: { en: "On dropdown select (e.g. category → price guide)" }, event: { key: "", value: "", label: "", context: "", rowIndex: -1, row: {} } },
  ],
  properties: {
    title: { label: { en: "Title" }, type: "Text", defaultValue: "Line Items", bindable: true },
    subtitle: { label: { en: "Subtitle" }, type: "Text", defaultValue: "Manage project line items, quantities, and pricing", bindable: true },
    itemsLabel: { label: { en: "Count label" }, type: "Text", defaultValue: "Items", bindable: true },
    currency: { label: { en: "Currency code" }, type: "Text", defaultValue: "USD", bindable: true },

    // ---- data ----
    items: {
      label: { en: "Rows (collection)" }, type: "Array", bindable: true,
      // Accepts a plain array OR a WeWeb collection { data: [...] }.
      // Sample below mirrors the Airtable "Line Items" collection field names.
      defaultValue: [
        { "Task Number": 0, Category: ["recMdPX9UQl8RW9mo"], Description: "ADJUSTMENT — invoice reduced to match work completed (Amt -$434.33)", "Name (from Locations)": ["Kitchen"], assignee_from_tracker: ["Sarat Painting and Renovation LLC"], note: "Reviewed with client", Quantity: 1, "Unit Retail": -434.33, Retail: -434.33, "Labor Cost": 55, "Material Cost": 1, margin: 1.128934, "Client Approved": true, "QC Passed": true, Complete: true, id: "recTJgd3ok46iyioC" },
        { "Task Number": 1, Category: ["recMdPX9UQl8RW9mo"], Description: "Kitchen & Bathroom Repairs — remove and replace old grout and caulking from kitchen cabinets and both bathrooms.", "Name (from Locations)": ["Master Bath"], assignee_from_tracker: ["Jay Helvey"], note: "", Quantity: 1, "Unit Retail": 809.33, Retail: 809.33, "Labor Cost": 1, "Material Cost": 1, margin: 0.42, "Client Approved": true, "QC Passed": false, Complete: false, id: "recXq8pLExample2" },
      ],
    },

    // ---- columns ----
    // This is the "grid view" config: add an item, set `key` to the EXACT field
    // name from your collection, then pick a `type`. Leave the whole array empty
    // to auto-generate columns from the data. Per-column options:
    //   key (required)     field name, e.g. "Unit Retail" or "Category"
    //   label              header text (defaults to a humanized key)
    //   type               text | number | currency | percent | date | status | boolean
    //   options (array)    static DROPDOWN values (strings, or {label,value} objects)
    //   optionsKey         name of a list in "Option sources" (bind a collection)
    //   optionLabel        field shown in the dropdown   (e.g. "name")
    //   optionValue        field stored / emitted        (e.g. "airtable_record_id")
    //   scale (number)     multiply before display — margin stored as 1.13 → scale 100 → "113%"
    //   multiline (bool)   edit in an auto-growing textarea (new lines with Enter)
    //   editable / addable false to lock a column from inline edit / the add form
    //   filterable / sortable / hidden / total   booleans
    //   width (px) · align (auto|left|center|right) · prefix · suffix · decimals
    columns: {
      label: { en: "Columns (blank = auto)" }, type: "Array", bindable: true, section: "settings",
      defaultValue: [
        { key: "Task Number", label: "Task #", type: "number", width: 70, editable: false, showForLob: ["36ac5de5-45df-4134-8e4c-14c5055099e5"] },
        { key: "Category", label: "Category", type: "text", optionsKey: "categories", optionLabel: "name", optionValue: "airtable_record_id", addable: true, emitOnSelect: true },
        {
          key: "Description", label: "Description", type: "text", multiline: true, width: 280,
          // In the ADD form, this field becomes a searchable price-guide picker.
          // Selecting an item fills the row via `map` (rowField: priceGuideField).
          picker: {
            sourceKey: "priceGuide",         // list in "Picker sources"
            labelField: "description",        // text shown in the dropdown
            iconField: "category.icon",       // little image shown (dot path OK)
            hintField: "retail",              // right-aligned price hint
            searchFields: ["description"],    // fields matched against typed text
            categoryKey: "Category",          // filter items by the row's selected category…
            itemCategoryField: "category.airtable_record_id", // …matched against this on each item
            map: { "Description": "description", "Unit Retail": "retail", "Labor Cost": "labor", "Material Cost": "material" },
          },
        },
        { key: "Name (from Locations)", label: "Location", type: "text", editable: false, showForLob: ["36ac5de5-45df-4134-8e4c-14c5055099e5"] },
        // Vendor comes from the tracker — always visible, not entered manually.
        { key: "assignee_from_tracker", label: "Vendor", type: "text", editable: false, addable: false },
        { key: "Quantity", label: "Qty", type: "number", width: 70, addDefault: 1 },
        { key: "Unit Retail", label: "Unit Retail", type: "currency", hideForLob: ["36ac5de5-45df-4134-8e4c-14c5055099e5"] },
        // Retail is COMPUTED (Qty × Unit Retail) — read-only in the grid and on the form.
        { key: "Retail", label: "Retail", type: "currency", total: true, editable: false, addable: true, compute: { op: "product", keys: ["Quantity", "Unit Retail"] } },
        { key: "Labor Cost", label: "Labor", type: "currency", total: true },
        { key: "Material Cost", label: "Material", type: "currency", total: true },
        { key: "margin", label: "Margin", type: "percent", scale: 100, editable: false },
        { key: "note", label: "Note", type: "text", multiline: true, showForLob: ["36ac5de5-45df-4134-8e4c-14c5055099e5"] },
        { key: "Client Approved", label: "Approved", type: "boolean", addable: false },
        { key: "QC Passed", label: "QC", type: "boolean", addable: false, showForLob: ["36ac5de5-45df-4134-8e4c-14c5055099e5"] },
        { key: "Complete", label: "Complete", type: "boolean", addable: false },
      ],
    },

    // ---- dynamic dropdown sources ----
    // Each entry is { key, options } where `key` is referenced by a column's
    // `optionsKey` and `options` is an array (or collection) of option objects.
    // Bind the options to your Supabase collection, e.g. one entry:
    //   { key: "categories", options: collections['8ab54c0b-d993-430d-ba2e-58828b940f60']?.['data'] }
    // Then a column uses: optionsKey:"categories", optionLabel:"name", optionValue:"airtable_record_id".
    optionSources: {
      label: { en: "Option sources (bind)" }, type: "Array", bindable: true, section: "settings",
      defaultValue: [
        {
          key: "categories",
          options: [
            { name: "General", airtable_record_id: "recMdPX9UQl8RW9mo" },
            { name: "Appliances", airtable_record_id: "recGDc38vE0tY4gL5" },
            { name: "Plumbing", airtable_record_id: "recPlumbing0001" },
            { name: "Electrical", airtable_record_id: "recElectrical01" },
          ],
        },
      ],
    },

    // ---- price-guide (or any) picker sources for the add form ----
    // Bind to your price-guide collection so the Description field becomes a
    // searchable list. Accepts a bare array (single source), a { key: [...] } map,
    // or [{ key, options }] pairs. A column's picker.sourceKey selects which list.
    //   e.g. bind to: collections['<price-guide-id>']?.['data']
    // Each column.picker maps item fields into the new row on select.
    pickerSources: {
      label: { en: "Picker sources (bind)" }, type: "Array", bindable: true, section: "settings",
      defaultValue: [
        { id: 620, description: "0300 - Install/Replace [white] 18cuft top freezer refrigerator (WITHOUT icemaker)", labor: 0, material: 800, retail: 950, airtable_id: "rec22ZO0MFCBpF6Hq", category: { name: "Appliances", airtable_record_id: "recGDc38vE0tY4gL5", icon: "https://iepfgtjizwzbdgxyzaab.supabase.co/storage/v1/object/public/avatars/category_icons/59248849-f07c-4080-96cd-9dcad6d2d63e.png" } },
        { id: 618, description: "0301 - Install/Replace [white] refrigerator with icemaker incl. new water line", labor: 0, material: 915, retail: 1090, airtable_id: "rec0QsaSFHHhA7xQ4", category: { name: "Appliances", airtable_record_id: "recGDc38vE0tY4gL5", icon: "https://iepfgtjizwzbdgxyzaab.supabase.co/storage/v1/object/public/avatars/category_icons/59248849-f07c-4080-96cd-9dcad6d2d63e.png" } },
        { id: 622, description: "0303 - Install/Replace [white] electric range incl. new power cord", labor: 0, material: 600, retail: 699, airtable_id: "recDDvPfEYEQOVlS8", category: { name: "Appliances", airtable_record_id: "recGDc38vE0tY4gL5", icon: "https://iepfgtjizwzbdgxyzaab.supabase.co/storage/v1/object/public/avatars/category_icons/59248849-f07c-4080-96cd-9dcad6d2d63e.png" } },
      ],
    },

    // ---- parent record line-of-business (drives conditional column visibility) ----
    // Bind to the global variable / parent record field holding the LOB id.
    // A column with `showForLob: ["<id>"]` is visible ONLY for those LOBs;
    // a column with `hideForLob: ["<id>"]` is hidden for those LOBs.
    lob: { label: { en: "Parent LOB id (bind)" }, type: "Text", defaultValue: "36ac5de5-45df-4134-8e4c-14c5055099e5", bindable: true, section: "settings" },

    // ---- features ----
    editable: { label: { en: "Inline editing" }, type: "OnOff", defaultValue: true, bindable: true },
    reorderable: { label: { en: "Drag to reorder rows" }, type: "OnOff", defaultValue: true, bindable: true },
    showFilters: { label: { en: "Enable filters" }, type: "OnOff", defaultValue: true, bindable: true },
    filtersOpen: { label: { en: "Filters open by default" }, type: "OnOff", defaultValue: false, bindable: true },
    showColumnChooser: { label: { en: "Show column chooser" }, type: "OnOff", defaultValue: true, bindable: true },
    showToolbar: { label: { en: "Show toolbar" }, type: "OnOff", defaultValue: true, bindable: true },
    showHeader: { label: { en: "Show header" }, type: "OnOff", defaultValue: true, bindable: true },

    // ---- totals ----
    showTotals: { label: { en: "Show totals row" }, type: "OnOff", defaultValue: true, bindable: true },
    totalsLabel: { label: { en: "Totals label" }, type: "Text", defaultValue: "Total", bindable: true },

    // ---- pagination ----
    paginate: { label: { en: "Paginate" }, type: "OnOff", defaultValue: true, bindable: true },
    pageSize: { label: { en: "Rows per page" }, type: "Number", options: { min: 1, max: 500, step: 1 }, defaultValue: 10, bindable: true },
    pageSizeOptions: { label: { en: "Rows-per-page options" }, type: "Array", defaultValue: [10, 25, 50, 100], bindable: true, section: "settings" },

    // ---- row action ----
    showRowAction: { label: { en: "Show row action button" }, type: "OnOff", defaultValue: false, bindable: true },
    rowActionLabel: { label: { en: "Row action label" }, type: "Text", defaultValue: "View", bindable: true },
    rowActionHeader: { label: { en: "Row action column header" }, type: "Text", defaultValue: "", bindable: true },

    // ---- add-row form (underneath) ----
    showAddForm: { label: { en: "Show add-row form" }, type: "OnOff", defaultValue: true, bindable: true },
    addFormTitle: { label: { en: "Add-form title" }, type: "Text", defaultValue: "Add a row", bindable: true },
    addLabel: { label: { en: "Add button label" }, type: "Text", defaultValue: "Add Item", bindable: true },

    // ---- misc ----
    emptyText: { label: { en: "Empty text" }, type: "Text", defaultValue: "No rows", bindable: true },
    boolTrue: { label: { en: "Boolean true label" }, type: "Text", defaultValue: "Yes", bindable: true },
    boolFalse: { label: { en: "Boolean false label" }, type: "Text", defaultValue: "No", bindable: true },
    wrapText: { label: { en: "Wrap cell text" }, type: "OnOff", defaultValue: true, bindable: true },
    density: {
      label: { en: "Density" }, type: "TextSelect",
      options: { options: [
        { value: "comfortable", label: { en: "Comfortable" } },
        { value: "compact", label: { en: "Compact" } },
      ] }, defaultValue: "comfortable", bindable: true,
    },

    // ---- theme ----
    primaryColor: { label: { en: "Primary color" }, type: "Color", defaultValue: "#10b981", bindable: true },
    accentColor: { label: { en: "Accent color" }, type: "Color", defaultValue: "#6366f1", bindable: true },
    darkMode: {
      label: { en: "Theme mode" }, type: "TextSelect",
      options: { options: [
        { value: "auto", label: { en: "Auto (system)" } },
        { value: "light", label: { en: "Light" } },
        { value: "dark", label: { en: "Dark" } },
      ] }, defaultValue: "auto", bindable: true,
    },
    radius: { label: { en: "Corner radius (px)" }, type: "Number", options: { min: 0, max: 32, step: 1 }, defaultValue: 16, bindable: true },
  },
};
