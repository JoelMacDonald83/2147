// The shape edition this contract describes. Files carrying an older
// version get migrated up to this at the border.
export const SCHEMA_VERSION = 3   // CHANGED: 2 → 3 — types.json and things.json arrive

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
// NEW: "choice"      → a <select>. The options are either written on the entry
//                      (options: [{ value, label }]) or, when they are DATA,
//                      named by optionsFrom and looked up in the editor's
//                      OPTION_SOURCES table. The stored value is the chosen
//                      option's value — always a string.
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
//
// NEW: the sheets for THINGS are not in this file. A thing's sheet depends on
// its TYPE (types.json), so the editor builds one per type at every paint —
// see buildSheets in dinoEdit/state.js. Only coreThingSchema, the part every
// thing shares, is written here.


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
  // NEW: which KIND of thing this group shows. The value is a type id from
  // types.json; "" means "shows nothing yet". The options are the loaded
  // types, which this file cannot know — optionsFrom names them instead.
  { key: "displayType", caption: "Shows", type: "choice", optionsFrom: "types", default: "" },
  // NEW: the side cabinets. They sit right after Shows ON PURPOSE — the
  // card is drawn in sheet order, and this is where the rules and the look
  // have always been drawn: own fields, then rules, then look, then the lists.
  // file = one of the data files (the same names save() and the server
  // use); cabinet = the object inside that file keyed by group id.
  { type: "attachment", file: "rules",  cabinet: "groupRules",  of: "groupRules" },
  { type: "attachment", file: "themes", cabinet: "groupThemes", of: "groupTheme" },
  // CHANGED: the items collection is gone. Things live in things.json now,
  // and a group SHOWS a type (displayType, above) instead of HOLDING items.
  { key: "children", caption: "Subgroups", type: "collection", of: "group", default: [] }
]

// (itemSchema used to live here. It is gone: what a v2 item looked like is
// frozen inside migrations.js, and today's things are drawn from their type.)


// THING SCHEMAS (types.json + things.json)
// NEW: the three fields EVERY thing has, whatever its type. Declared once,
// here: the editor puts them at the top of every type's sheet; the engine
// draws them by hand (image, name, cost) exactly as it always has. Authors
// define only the extras, in types.json.
export const coreThingSchema = [
  { key: "name",     caption: "Name",           type: "text",   default: "New thing" },
  { key: "cost",     caption: "Cost",           type: "number", default: 0 },
  { key: "imageURL", caption: "Image filename", type: "text",   default: "" }
]

// NEW: an author-defined field stores no default of its own — its KIND
// decides. Text is blank, a number is 0, lines are none.
export const FIELD_DEFAULTS = { text: "", number: 0, lines: [] }

// NEW: a type's own fields, dressed as sheet entries the walkers already
// understand: the author's field plus the default its kind implies.
// `default` is what the editor's newborn writes (newborn copies it, so no
// two things share one array); `hydrateDefault` is what the engine fills in
// when a thing lacks the field — its type gained it after the thing was born.
// (The engine only READS hydrated things, so those may share the one [].)
// A thing's whole sheet is coreThingSchema + this — see buildSheets.
export const sheetOfType = (type) =>
  type.fields.map(field => ({
    ...field,
    default: FIELD_DEFAULTS[field.type],
    hydrateDefault: FIELD_DEFAULTS[field.type]
  }))


// TYPE SCHEMAS (types.json)
// NEW: the top of types.json, as a sheet — the twin of contentSchema.
export const typesSchema = [
  { key: "types", caption: "Types", type: "collection", of: "type", default: [] }
]

export const typeSchema = [
  { key: "label",  caption: "Label",  type: "text",       default: "New type" },
  { key: "fields", caption: "Fields", type: "collection", of: "fieldDef", default: [] }
]

// NEW: one author-defined field. key = the name in the file, caption = what
// the editor and the game show, type = the kind (one of FIELD_DEFAULTS' keys).
// Name a field BEFORE adding things of its type: things store values under
// the key, so renaming it later leaves the old values behind under the old key.
export const fieldDefSchema = [
  { key: "key",     caption: "Key (name in the file)", type: "text",   default: "newField" },
  { key: "caption", caption: "Caption",                type: "text",   default: "New field" },
  { key: "type",    caption: "Kind",                   type: "choice", default: "text",
    options: [
      { value: "text",   label: "Text" },
      { value: "number", label: "Number" },
      { value: "lines",  label: "Lines (one per line)" }
    ] }
]


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
  group:      groupSchema,
  groupRules: groupRulesSchema,   // NEW: reachable by name from attachment entries
  groupTheme: groupThemeSchema,   // NEW
  type:       typeSchema,         // NEW: types.json's cards
  fieldDef:   fieldDefSchema      // NEW: a type's field definitions ("+ Add field")
  // CHANGED: no `item` row — a thing's sheet is built per TYPE and filed under
  // the type's id, see buildSheets in dinoEdit/state.js
}
