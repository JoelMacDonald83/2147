// The shape edition this contract describes. Files carrying an older
// version get migrated up to this at the border.
export const SCHEMA_VERSION = 6   // CHANGED: 5 → 6 — the player has a sheet

// NEW: the shelf's grammars. BOOK_NAME is the game-name grammar (server/games.js NAME) written
// here so engine/config never imports server/ — oracle N2 pins the two regexes equal.
export const BOOK_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const isBookName = (s) => typeof s === "string" && s.length <= 40 && BOOK_NAME.test(s)
export const isEdition = (e) => Number.isInteger(e) && e > 0                         // the NUMBER in a pin or manifest
export const BOOK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[.-][a-z0-9]+)*$/         // "basic:character.identity.concept"

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
//                      CHANGED: choice is a field KIND too now (an author's
//                      field on a thing), and there the options are written
//                      as bare strings — asOption below reads both spellings.
// NEW: two STRUCTURAL types. They describe the SHAPE of the form, not one box on it:
//   "collection"     → a LIST of elements. Each element is a smaller form drawn
//                      from the sheet named by `of` (a name in SHEETS, at the
//                      bottom of this file — so a sheet may name itself).
//                      The editor draws one card per element, plus a "+ Add".
//                      NEW: `noun` names one element for that button when the
//                      sheet's own name would read wrong ("+ Add placement field").
//   "attachment"     → extra fields for THIS element that are STORED in another
//                      file, filed under the element's id:
//                        <file>.<cabinet>[element.id]   e.g. rules.groupRules[group.id]
//                      `of` names the sheet describing those fields.
//                      An attachment entry has NO key and NO default: nothing is
//                      stored in the element itself, and nothing is born in a
//                      cabinet — a cabinet slot appears on the first edit only.
//                      Every walker that reads entry.key must skip these.
// NEW: two COMPOUND types. One box on the form, but the value is an object:
//   "query"          → { type, where }: which type a row shows plus an optional
//                      one-condition filter. One builder owns the whole object.
//   "showWhen"       → { kind, ... }: when the row is on screen at all. A tagged
//                      object dispatched by kind — like builders are dispatched by type.
// Both have an OBJECT default: newborn structuredClones it like any other.
// (null default = "not written at birth" applies to sheet ENTRIES; the null
// inside query.where is a value inside a compound entry and is written.)
// NEW: five more, born with the books. Each is one more entry the three readers
// dispatch on (editor FIELD_BUILDERS, engine DISPLAY_BUILDERS, validator
// CHECKERS) — never a special case in a walker:
//   "pins"           → a list of { name, edition }: which books a game pins
//                      (content.books) or a book requires (book.requires)
//   "flag"           → a key whose only value is true; absent means "no" — the
//                      file never carries a no-op (rowOverride.hidden)
//   "placements"     → a thing's entries under a LIST section: [{ thing, …values }].
//                      Never on a sheet in this file: sheetOfType makes one per
//                      list section, carrying the section so the builders know
//                      `of` and the placement fields
//   "fieldDefault"   → a field's own default value (a string or a number of the
//                      field's kind). Read-only in the editor: books author it
//   "idLists"        → { [sheetId]: [thingId…] }: the game's arrangement of a
//                      merged shelf (things.order)
// NEW: two PROPS an entry of any type may carry:
//   optional: true   → absence is fine (the validator skips an absent key; the
//                      editor's optional builders already treat empty as absent)
//   showIf: { key, value }
//                    → the entry EXISTS only while the sibling `key` holds `value`:
//                      drawn, checked and born only then. A section's `fields`
//                      exist while kind is "fields"; its `of` and `placement`
//                      while kind is "list". One spelling, three honourers
//                      (renderField, checkSheet, newborn).
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

// The top of content.json, as a sheet. Only the row tree lives here.
// meta is drawn by the Page card (metaSchema) and version belongs to the
// border (migrations.js), so neither is listed. Anything added here renders
// on the Rows tab AFTER the Page card, not inside it. (The pins and the
// house rules are on FILE_SHEETS.content below, NOT here: the Books tab
// draws pins by hand, and an override is drawn beside the row it overrides.)
export const contentSchema = [
  { key: "groups", caption: "Rows", type: "collection", of: "group", default: [] }   // CHANGED: caption — a group is called a row on screen
]

// NEW: a house rule on a PROPOSED row — every key optional (present = this game's value).
// A book proposes a row; the game keeps it, relabels it, re-aims it, re-gates it or
// hides it — per key, like the CSS cascade: a key present here wins, an absent key
// lets the proposal show through. That is why nothing carries a default: the slot
// is born empty and a key appears on the first override only.
export const rowOverrideSchema = [
  { key: "label",    caption: "Label",     type: "text",     optional: true },
  { key: "query",    caption: "Shows",     type: "query",    optional: true },
  // NEW: the same key a row has (see groupSchema below), overridable per game.
  // This is what lets `games/dino` bind four rows that a FROZEN book proposes,
  // without cutting a new edition of the book — and it is the whole reason
  // `fills` is on this sheet as well as on the row's own.
  // No `default` here: an override slot is born EMPTY and a key appears on the
  // first override only, exactly like the four keys around it.
  { key: "fills",    caption: "Fills",     type: "choice",   optional: true, optionsFrom: "fillableSections" },
  { key: "showWhen", caption: "Show when", type: "showWhen", optional: true },
  { key: "hidden",   caption: "Hidden",    type: "flag",     optional: true }   // the only value is true
]

// CHANGED: on screen a group is a "Row" now (the tab, "+ Add row", "Remove
// row"). The IDENTIFIERS keep "group" — the JSON key `groups`, the sheet name
// `group`, this constant, the cabinets `groupRules`/`groupThemes` — because
// renaming them would be a data migration plus code churn across the engine
// and the editor with no player-visible gain. Only NEW names use "row".
export const groupSchema = [
  { key: "label",    caption: "Label",     type: "text",     default: "New row" },   // CHANGED: default
  // CHANGED: displayType is gone. A row no longer points at a type; it asks
  // the library a question: { type, where }. type is a type id from
  // types.json ("" = "shows nothing yet"); where is null (every thing of the
  // type) or one { field, op, value } condition — see query.js.
  { key: "query",    caption: "Shows",     type: "query",    default: { type: "", where: null } },
  // NEW: which SECTION of the player's sheet this row's picks land in — a section
  // id from the merged library, or "" (this row is a plain picker, which is what
  // every v5 row is). A SECTION ID and not a key: ids are what every other
  // reference in this data follows (query.where.field, showWhen.thing), and an id
  // survives a rename. It sits beside `query` because the two are one thought:
  // what this row offers, and where what you take lands.
  // `default: ""` AND `optional: true` at once, on purpose, and BOTH halves matter:
  //   default   — what a WRITER puts down. A newborn row and the migration write
  //               the key, so a GAME file always carries it in its canonical slot
  //               and the editor only ever ASSIGNS to a key that is already there
  //               (assigning never moves a key; appending one would drift the order).
  //   optional  — what a CHECKER forgives. The frozen books' proposal rows have no
  //               such key and are never rewritten; without `optional` every book on
  //               the shelf would fail validateBookFile and be skipped whole.
  // optionsFrom names the editor's OPTION_SOURCES entry, the way a section's `of`
  // does; the engine and the validator ignore it.
  { key: "fills",    caption: "Fills",     type: "choice",   default: "", optional: true, optionsFrom: "fillableSections" },
  // NEW: when the player gets to see this row. always = no gate. The other
  // kinds and what they mean live in visibility.js (GATES).
  { key: "showWhen", caption: "Show when", type: "showWhen", default: { kind: "always" } },
  // The side cabinets. They sit right after Show when ON PURPOSE — the
  // card is drawn in sheet order, and this is where the rules and the look
  // have always been drawn: own fields, then rules, then look, then the lists.
  // file = one of the data files (the same names save() and the server
  // use); cabinet = the object inside that file keyed by group id.
  { type: "attachment", file: "rules",  cabinet: "groupRules",  of: "groupRules" },
  { type: "attachment", file: "themes", cabinet: "groupThemes", of: "groupTheme" },
  // Things live in things.json; a row SHOWS what its query answers instead
  // of HOLDING items. Its only list is the rows nested inside it.
  { key: "children", caption: "Nested rows", type: "collection", of: "group", default: [] }   // CHANGED: caption
]

// (itemSchema used to live here. It is gone: what a v2 item looked like is
// frozen inside migrations.js, and today's things are drawn from their type.)


// THING SCHEMAS (types.json + things.json)
// The three fields EVERY thing has, whatever its type. Declared once,
// here: the editor puts them at the top of every type's sheet; the engine
// draws them by hand (image, name, cost) exactly as it always has. Authors
// define only the extras, in types.json.
// CHANGED: name and cost get code-only ids so a row's filter can point at
// them the way it points at an author's field — by id, so renaming a key
// never breaks a filter. imageURL has none: an id is what makes a field
// queryable, and nobody filters on a filename. These ids never reach a file
// except inside a row's where.field.
export const coreThingSchema = [
  { id: "core:name", key: "name",     caption: "Name",           type: "text",   default: "New thing" },
  { id: "core:cost", key: "cost",     caption: "Cost",           type: "number", default: 0 },
  {                  key: "imageURL", caption: "Image filename", type: "text",   default: "" }
]

// NEW: a choice option is written as a bare string in DATA (value = label) and as { value, label }
// on a sheet entry. One reader for both — the choice builder and checker map through this.
export const asOption = (option) => typeof option === "string" ? { value: option, label: option } : option

// An author-defined field's KIND decides what a thing holds when the field
// says nothing: text is blank, a number is 0, lines are none, a choice is "".
export const FIELD_DEFAULTS = { text: "", number: 0, lines: [], choice: "" }         // CHANGED: + choice
// NEW: one field's default — its own, else (choice) its first option, else its kind's.
// A book may write `default: 10` on Strength; a choice with no `default` is born
// on its first option; everything else falls back to the kind. This ONE function
// is what the engine hydrates with, what the editor's newborn writes, and what
// query.js reads a missing value as — so the editor's count is the game's count.
export const fieldDefault = (field) =>
  field.default ?? (field.type === "choice" ? (asOption(field.options?.[0])?.value ?? "") : FIELD_DEFAULTS[field.type])
// a field dressed as a sheet entry the walkers already understand: the author's
// field plus its default twice over. `default` is what the editor's newborn
// writes (newborn copies it, so no two things share one array); `hydrateDefault`
// is what the engine fills in when a thing lacks the field — its type gained it
// after the thing was born. (The engine only READS hydrated things, so those may
// share the one [].)
const dressed = (field) => ({ ...field, default: fieldDefault(field), hydrateDefault: fieldDefault(field) })

// CHANGED: a type's sheet is its SECTIONS flattened, in section order: a fields section contributes
// its fields (dressed with their defaults); a list section contributes ONE "placements" entry under
// the section's key, carrying the section so the builders know `of` and the placement fields.
// A thing's whole sheet is coreThingSchema + this — see buildSheets.
export const sheetOfType = (type) => type.sections.flatMap(section =>
  section.kind === "list"
    ? [{ key: section.key, caption: section.caption, type: "placements", section, default: [], hydrateDefault: [] }]
    : section.fields.map(dressed))
export const placementSheet = (section) => section.placement.map(dressed)             // NEW: the per-placement form
export const fieldsOfType   = (type) => type.sections.flatMap(section => section.kind === "fields" ? section.fields : [])   // NEW
export const listSectionsOf = (type) => type.sections.filter(section => section.kind === "list")                            // NEW
// The fields a row's filter may name, in the order the thing's card shows
// them: the two core fields that carry an id, then the type's own.
// CHANGED: walks sections; list sections are not queryable (Stage 2)
export const queryableFields = (type) => [...coreThingSchema.filter(entry => entry.id !== undefined), ...fieldsOfType(type)]
// NEW: one queryable field by its id, or undefined — the "does this field
// still exist?" question every border check starts with.
export const fieldById = (type, id) => queryableFields(type).find(field => field.id === id)   // unchanged text, new reach
// NEW: every key a thing of this type may hold — the namespace RULES.type keeps unique.
// A fields section's KEY is addressing only (nothing is stored under "identity"), so
// only its fields' keys count; a LIST section's key is where the placements live.
export const thingKeys = (type) => [...coreThingSchema.map(entry => entry.key), ...fieldsOfType(type).map(field => field.key), ...listSectionsOf(type).map(section => section.key)]


// TYPE SCHEMAS (types.json)
// NEW: the top of types.json, as a sheet — the twin of contentSchema.
export const typesSchema = [
  { key: "types", caption: "Types", type: "collection", of: "type", default: [] }
]

export const typeSchema = [
  { key: "label",    caption: "Label",    type: "text",       default: "New type" },
  { key: "sections", caption: "Sections", type: "collection", of: "section", default: [] }   // CHANGED: was fields
]

// NEW: a section. showIf: the entry exists only while `kind` matches (drawn, checked, born only then).
// A "fields" section holds fixed slots (one value each); a "list" section holds
// ENTRIES placed from another sheet's shelf (`of`), each carrying the placement
// fields' values. `kind` comes BEFORE the three it governs on purpose: newborn
// walks top to bottom, so a section is born fields-shaped with `fields: []` and
// neither `of` nor `placement` (their default is null = not written at birth);
// the editor's sectionKindChanged hook writes the other shape on demand.
export const sectionSchema = [
  { key: "key",       caption: "Key (name in the file)", type: "text",   default: "newSection" },
  { key: "caption",   caption: "Caption",                type: "text",   default: "New section" },
  { key: "kind",      caption: "Kind",                   type: "choice", default: "fields", afterChange: "sectionKindChanged",
    options: [ { value: "fields", label: "Fields (fixed slots, one value each)" }, { value: "list", label: "List (entries placed from a shelf)" } ] },
  { key: "fields",    caption: "Fields",           type: "collection", of: "fieldDef", default: [],   showIf: { key: "kind", value: "fields" } },
  { key: "of",        caption: "Entries from",     type: "choice",     default: null, optionsFrom: "sheets", afterChange: "sectionTargetChanged", showIf: { key: "kind", value: "list" } },
  { key: "placement", caption: "Placement fields", type: "collection", of: "fieldDef", default: null, noun: "placement field", showIf: { key: "kind", value: "list" } }
]

// One author-defined field. key = the name in the file, caption = what
// the editor and the game show, type = the kind (one of FIELD_DEFAULTS' keys).
// Name a field BEFORE adding things of its type: things store values under
// the key, so renaming it later leaves the old values behind under the old
// key — a row filtering on the renamed field keeps following its id, finds
// no thing holding the new key, and shows nothing until the values are moved.
export const fieldDefSchema = [
  { key: "key",     caption: "Key (name in the file)", type: "text",   default: "newField" },
  { key: "caption", caption: "Caption",                type: "text",   default: "New field" },
  // NEW: afterChange names a hook in the editor's CHANGE_HOOKS table, the way
  // optionsFrom names an OPTION_SOURCES entry. A field's kind decides which
  // operators and values fit, so changing it must clear every row condition
  // built on this field. The engine ignores this prop.
  { key: "type",    caption: "Kind",                   type: "choice", default: "text", afterChange: "fieldKindChanged",
    options: [ { value: "text", label: "Text" }, { value: "number", label: "Number" }, { value: "lines", label: "Lines (one per line)" }, { value: "choice", label: "Choice (one of a list)" } ] },   // CHANGED: + choice
  // NEW: required while the kind is choice (the validator wants at least one),
  // absent for every other kind — a choice with no options is unsaveable, loudly,
  // rather than silently blank. Written as bare strings: value = label.
  { key: "options", caption: "Options (one per line)", type: "lines",        default: null, showIf: { key: "type", value: "choice" } },   // NEW: required while the kind is choice
  // NEW: read-only in the editor — books author it. A value of the field's own
  // kind (never for lines); whether it FITS is RULES.fieldDef's question.
  { key: "default", caption: "Default",                type: "fieldDefault", default: null, optional: true }                              // NEW: read-only in the editor — books author it
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
// CHANGED: optional — absent = a book's proposal shows through, or the sheet's
// 10 when nothing proposes one (the engine reads hydrateDefault; the seed and a
// migrated v4 game still write a number, which is then the game's own).
export const totalBudgetSchema = [
  { key: "totalBudget", caption: "Total budget", type: "optionalNumber", default: 10, hydrateDefault: 10 }   // CHANGED: optional — absent = a book's proposal shows through
]

// NEW, said here because this is where a reader asks: min and max count PICKS,
// never quantities. Three Cute Rocks are ONE entry on the sheet and ONE pick in
// the row; a quantity multiplies the price, never the count.
export const groupRulesSchema = [
  { key: "min", caption: "Min points", type: "optionalNumber", default: null, hydrateDefault: 0 },
  { key: "max", caption: "Max points", type: "optionalNumber", default: null, hydrateDefault: Infinity }
]


// BOOK SCHEMAS (book.json)
// NEW: the manifest of a book on the shelf: books/<name>/<edition>/book.json.
// No `version` key — it is not a data file (the three data files beside it
// carry one). `requires` is FLAT (every transitive requirement written out)
// and EXACT (editions, not ranges); the pins checker keeps the names distinct.
export const bookSchema = [                                                            // NEW: book.json — no version key
  { key: "name",     caption: "Name",     type: "text" },
  { key: "title",    caption: "Title",    type: "text" },
  { key: "edition",  caption: "Edition",  type: "number" },
  { key: "requires", caption: "Requires", type: "pins" }
]


// CHANGED: SHEETS is the phonebook — every sheet an `of` can name. It now
// sits at the END of the file, on purpose (only the FILE tables, which point
// at the same sheets, come after it): a `const` does not exist until its own
// line has run, and this table points at sheets defined all through the file
// (bookSchema is just above). Left in its old spot it throws
// "Cannot access 'groupRulesSchema' before initialization" the moment the file
// loads — and the GAME imports this file too, so that would break the game,
// not just the editor. Entries point at sheets by NAME (of: "group"); the name
// is looked up here later, at render time, so a sheet naming itself is fine.
// (queryableFields and friends above are safe: they read coreThingSchema,
// which is defined before them, and only when called.)
export const SHEETS = {
  group: groupSchema, groupRules: groupRulesSchema, groupTheme: groupThemeSchema,
  type: typeSchema, section: sectionSchema, fieldDef: fieldDefSchema,               // NEW: section
  rowOverride: rowOverrideSchema, book: bookSchema,                                 // NEW: both
  meta: metaSchema, pageTheme: pageThemeSchema
  // CHANGED: no `item` row — a thing's sheet is built per TYPE and filed under
  // the type's id, see buildSheets in dinoEdit/state.js
}

// The TOP of each data file, as a sheet — the map validate.js walks. The
// sheet is the contract, and this is the part of it that was only ever implied
// by the loaders. Four structural types appear here and nowhere else:
//   "form"    → one object drawn from a sheet, at a fixed key (content.meta, themes.page)
//   "cabinet" → an object keyed by element id, each slot drawn from a sheet — the
//               storage side of an attachment entry (rules.groupRules, themes.groupThemes)
//               NEW: content.rowOverrides is a cabinet too, keyed by a PROPOSED row's id
//   "buckets" → an object keyed by a sheet id, each an ARRAY. Without `of` the
//               arrays hold things (things.json); NEW: with `of`, elements of that
//               sheet — the two addition cabinets of types.json, keyed by the
//               TARGET's id (sectionsFor: a sheet's, fieldsFor: a fields section's)
//   "idLists" → things.order, the game's arrangement (see the header)
// The EDITOR never walks this table: the Page card draws meta and page by hand,
// the Books tab draws the pins by hand, and cabinets are reached through
// attachment entries — putting meta on contentSchema would paint it twice.
// `version` is not an entry: it belongs to the border (migrations.js) and
// validate.js checks it by hand. The seed reads defaults from here: `books`
// is born [] (a new game pins nothing until the server says otherwise); `order`
// has default null and is optional — written only once the author arranges.
export const FILE_SHEETS = {
  // NEW: `sheet` — the sheet the PLAYER builds, a type id from the MERGED library
  // ("basic:character"), or "" (this game builds no sheet: a menu, which is what
  // every v5 game is). It sits after `books` because the books are what DEFINE it:
  // you pin the books, then you say which of their sheets the player fills in.
  // Same default/optional pairing as a row's `fills`, for the same two reasons;
  // `seedFile` walks this table, so a newborn game gets `"sheet": ""` in its
  // canonical slot for free — the server needs no change.
  content: [{ key: "meta", type: "form", of: "meta" }, { key: "books", type: "pins", default: [] },
            { key: "sheet", caption: "The player builds", type: "choice", default: "", optional: true, optionsFrom: "playerSheets" },
            ...contentSchema, { key: "rowOverrides", type: "cabinet", of: "rowOverride" }],   // NEW: books, sheet, rowOverrides
  rules:   [...totalBudgetSchema, { key: "groupRules", type: "cabinet", of: "groupRules" }],
  themes:  [{ key: "page", type: "form", of: "pageTheme" }, { key: "groupThemes", type: "cabinet", of: "groupTheme" }],
  types:   [...typesSchema, { key: "sectionsFor", type: "buckets", of: "section" }, { key: "fieldsFor", type: "buckets", of: "fieldDef" }],   // NEW: the two addition cabinets
  things:  [{ key: "things", type: "buckets" }, { key: "order", type: "idLists", default: null, optional: true }]                             // NEW: the game's arrangement
}
// NEW: the files of a BOOK, the same way — validateBookFile walks these. Each data file is optional on disk.
// types and things are the GAME'S sheets, unchanged: a book writes the same shapes a
// game does ("the game's own stuff is its own book loaded last"). proposals is the
// rows half of content.json and the whole of rules.json, in one file: what the book
// PROPOSES and the game may override. Books propose no themes and no rowOverrides.
export const BOOK_FILE_SHEETS = {
  book:      bookSchema,
  types:     FILE_SHEETS.types,
  things:    FILE_SHEETS.things,
  proposals: [...totalBudgetSchema, { key: "groups", type: "collection", of: "group", default: [] }, { key: "groupRules", type: "cabinet", of: "groupRules" }]
}
export const BOOK_FILES = ["types", "things", "proposals"]
