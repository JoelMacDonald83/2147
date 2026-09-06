// The shape edition this contract describes. Files carrying an older
// version get migrated up to this at the border.
export const SCHEMA_VERSION = 2

// The form specification sheet: everything the editor and the engine know
// about the data's fields, as data (the engine reads key + hydrateDefault;
// the editor reads the rest). type names are OUR vocabulary:
//   "text"           → one-line text input
//   "number"         → number input, Number() at the border
//   "lines"          → textarea, one entry per line, array in storage
//   "optionalNumber" → number input where EMPTY means "key absent";
//                      default null = key not written at birth
//   "optionalText"   → text input whose HOLDING OBJECT may not exist until
//                      first edit (peek/ensure target); empty writes ""
// NEW: two STRUCTURAL types. They describe the SHAPE of the form, not one box on it:
//   "collection"     → a LIST of elements. Each element is a smaller form drawn
//                      from the sheet named by `of` (a name in SHEETS, at the
//                      bottom of this file — so a sheet may name itself).
//                      The editor draws one card per element, plus a "+ Add".
//   "attachment"     → extra fields for THIS element that are STORED in another
//                      file, filed under the element's id:
//                        <file>.<cabinet>[element.id]   e.g. rules.groupRules[group.id]
//                      `of` names the sheet describing those fields.
//                      An attachment entry has NO key and NO default: nothing is
//                      stored in the element itself, and nothing is born in a
//                      cabinet — a cabinet slot appears on the first edit only.
//                      Every walker that reads entry.key must skip these.
//
// Sheet order = card order. The editor draws a card by walking its sheet top to
// bottom, so where an entry sits on the sheet is where it sits on the screen.


// CONTENT SCHEMAS
export const metaSchema = [
  { key: "pageTitle", caption: "Page title", type: "text", default: "" },
  { key: "heroTitle", caption: "Hero title", type: "text", default: "" },
]

// NEW: the top of content.json, as a sheet. Only the group tree lives here.
// meta is drawn by the Page card (metaSchema) and version belongs to the
// border (migrations.js), so neither is listed. Anything added here renders
// on the wall AFTER the Page card, not inside it.
export const contentSchema = [
  { key: "groups", caption: "Groups", type: "collection", of: "group", default: [] }
]

export const groupSchema = [
  { key: "label", caption: "Label", type: "text", default: "New group" },
  // NEW: the side cabinets. They sit right after the label ON PURPOSE — the
  // card is drawn in sheet order, and this is where the rules and the look
  // have always been drawn: own fields, then rules, then look, then the lists.
  // file = one of the three data files (the same names save() and the server
  // use); cabinet = the object inside that file keyed by group id.
  { type: "attachment", file: "rules",  cabinet: "groupRules",  of: "groupRules" },
  { type: "attachment", file: "themes", cabinet: "groupThemes", of: "groupTheme" },
  { key: "items",    caption: "Items",     type: "collection", of: "item",  default: [] },
  { key: "children", caption: "Subgroups", type: "collection", of: "group", default: [] }
]

export const itemSchema = [
  { key: "name",     caption: "Name",                  type: "text",   default: "New item" },
  { key: "label",    caption: "Label",                 type: "text",   default: "" },
  { key: "cost",     caption: "Cost",                  type: "number", default: 0 },
  { key: "imageURL", caption: "Image filename",        type: "text",   default: "" },
  { key: "traits",   caption: "Traits (one per line)", type: "lines",  default: [] }
]

// (SHEETS used to live here — it moved to the bottom of the file. See why there.)

// THEME SCHEMAS
export const pageThemeSchema = [
  { key: "bodyBackground",   caption: "Body background",   type: "text", default: "#ffffff" },
  { key: "fontFamily",       caption: "Font family",       type: "text", default: "'Segoe UI', system-ui, sans-serif" },
  { key: "heroImage",        caption: "Hero image",        type: "text", default: "" },
  { key: "statusBackground", caption: "Status background", type: "text", default: "#12101a" },
  { key: "statusColor",      caption: "Status color",      type: "text", default: "#ffd166" }
]

export const groupThemeSchema = [
  { key: "background", caption: "Background", type: "optionalText", default: "", hydrateDefault: null }
]


// RULE SCHEMAS
export const totalBudgetSchema = [
  { key: "totalBudget", caption: "Total budget", type: "number", default: 10 }
]

export const groupRulesSchema = [
  { key: "min", caption: "Min points", type: "optionalNumber", default: null, hydrateDefault: 0 },
  { key: "max", caption: "Max points", type: "optionalNumber", default: null, hydrateDefault: Infinity }
]


// CHANGED: SHEETS is the phonebook — every sheet an `of` can name. It now
// sits LAST in the file, on purpose: a `const` does not exist until its own
// line has run, and this table points at sheets defined all through the file
// (groupRulesSchema is just above). Left in its old spot it throws
// "Cannot access 'groupRulesSchema' before initialization" the moment the file
// loads — and the GAME imports this file too, so that would break the game,
// not just the editor. Entries point at sheets by NAME (of: "group"); the name
// is looked up here later, at render time, so a sheet naming itself is fine.
export const SHEETS = {
  item:       itemSchema,
  group:      groupSchema,
  groupRules: groupRulesSchema,   // NEW: reachable by name from attachment entries
  groupTheme: groupThemeSchema    // NEW
}
