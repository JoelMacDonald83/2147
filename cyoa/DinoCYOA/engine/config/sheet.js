// NEW FILE: the player's sheet, as vocabulary.
//
// This is the fourth sibling of query.js / visibility.js / references.js: one
// subject, its words, its checks, and ONE sentence per fault. Like query.js it is
// a LEAF — it imports schema.js and nothing else — and that is not a tidiness
// preference, it is what keeps the import graph acyclic. references.js needs
// checkFills; if checkFills lived in validate.js instead, references.js → validate.js
// → references.js would be a cycle, and this codebase has already been bitten once
// by import-time ordering (see the note above SHEETS at the bottom of schema.js).
//
// Nothing here touches the DOM, fetches anything, or does work at import time, so
// node runs it in the oracles and the browser runs it in the game — one set of
// bytes, two runtimes.
//
// THE ONE SENTENCE THE WHOLE FILE SERVES:
//   the player's sheet is a THING of the type the game declares — derived at every
//   paint from what the player TYPED and what the player PICKED, never stored twice.
import { fieldsOfType, listSectionsOf, placementSheet, fieldDefault, asOption } from "./schema.js"

// NEW: the one placement key the ENGINE reads by name. A placement field keyed
// `quantity` whose kind is `number` MULTIPLIES its entry's cost; nothing else moves
// the budget. Why a naming convention and not a `multiplies: true` flag on the
// field: placement fields live inside a FROZEN book edition, and a game cannot add
// a field to a list section, so a flag would cost a new edition of basic — and then
// of every book that requires basic exactly. The convention costs one constant. The
// trap is lit rather than left: validate.js refuses a `quantity` placement field
// that is not a number, so a collision is a save-time sentence, never a silent ×1.
export const QUANTITY_KEY = "quantity"

// NEW: the player's Name slot. The same key and kind coreThingSchema has, with ONE
// difference: the default is "" and not "New thing". An author's newborn wants a
// placeholder to find in a list; a player's sheet wants an empty box that invites
// typing. Two doors on one contract may differ in their DEFAULT; they may never
// differ in their KIND.
export const NAME_ENTRY = { key: "name", caption: "Name", type: "text", default: "" }

// one section of a type by its id, or undefined — the "does this section still
// exist?" question every border check starts with, the twin of schema.js's fieldById
export const sectionById = (type, id) => type.sections.find(section => section.id === id)

// NEW: every LIST section of `type` that lists things of the shelf `ofId` — the
// sections a row showing `ofId` could legally fill. It is the editor's dropdown and
// nothing more: the binding is always EXPLICIT, never inferred from this list.
// Why never inferred: over the real shelf this returns TWO sections for
// basic:character + basic:trait (advantages and disadvantages), so inference is
// ambiguous on the very first book; and inference cannot say "nothing", so a row
// would start filling a section the day a book added one — a book upgrade silently
// changing a game, which is the one thing the merge exists to prevent.
export const fillableSections = (type, ofId) => listSectionsOf(type).filter(section => section.of === ofId)

// NEW: the player's typed slots — Name, then every field of every FIELDS section, in
// sheet order. Each one is dressed with its own default (a book may author
// `default: 10` on Strength; a choice with no default is born on its first option),
// so the blank sheet and the input builders read the same number from the same place.
export const playerFields = (type) => [NAME_ENTRY, ...fieldsOfType(type).map(field => ({ ...field, default: fieldDefault(field) }))]

// NEW: a fresh, untouched typed half — every slot present, holding its default.
// structuredClone per slot because a `lines` default is an ARRAY: handing two sheets
// the same [] would tie two players' notes together.
export const blankFields = (type) => Object.fromEntries(playerFields(type).map(field => [field.key, structuredClone(fieldDefault(field))]))

// NEW: a fresh set of placement values for ONE pick in `section` — {} when the
// section has no placement fields, and {} for a row that fills nothing (section
// null). One shape for every pick: a reader that must handle two is where a bug hides.
export const blankValues = (section) => section === null || section === undefined ? {}
  : Object.fromEntries(placementSheet(section).map(field => [field.key, structuredClone(fieldDefault(field))]))

// NEW: why can this row not fill what it names? null when it can, one sentence when
// it cannot. THREE readers, one set of bytes: the engine warns with it, the validator
// reports it by path, the editor badges the row header with it — exactly what
// checkWhere and checkShowWhen already do.
// It takes the RAW row (fills is an ID here). The border calls it BEFORE it replaces
// row.fills with the resolved section object — get that order wrong and every message
// reads "[object Object]".
// `sheetType` is the declared player sheet, or null/undefined when the game declares
// none (or names one that is gone).
export const checkFills = (row, sheetType) => {
  const id = row.fills ?? ""
  if (id === "") return null                                                   // this row fills nothing: today's row, exactly
  // NEW: `@sheet` is RESERVED — and it is reserved BY BEING REFUSED. The day a row may
  // hand the player a whole starting sheet ("start from this template"), that row will
  // say so by filling `@sheet`: `@` can begin no book id (BOOK_ID is `^[a-z0-9]…`) and
  // no uuid, so the sentinel collides with nothing and costs no new key and no
  // migration. That day is not today, and a value nothing implements must not be
  // squattable by a hand-edit in the meantime — so it gets the same treatment every
  // other binding this engine cannot honour gets: named, refused, failed closed, in one
  // sentence three readers share. Before the sheet question on purpose: this answer does
  // not depend on what the game declares, so it must not depend on it being declared.
  if (id === "@sheet") return `gives a whole sheet, which this version cannot do yet (${id})`
  if (!sheetType) return `fills a section but this game builds no sheet (${id})`
  const section = sectionById(sheetType, id)
  if (!section) return `fills a section that is not on the player's sheet (${id})`
  if (section.kind !== "list") return `fills "${section.caption}", which holds fields, not entries (${id})`
  if (section.of !== row.query.type)
    return `shows ${row.query.type || "nothing"} but fills "${section.caption}", which lists ${section.of} (${id})`
  return null
}

// NEW: the placement field that multiplies, or null. A number field keyed
// `quantity`, and nothing else. Written as a FUNCTION rather than read as a key at
// each call site, so the day this becomes a real `multiplies: true` flag on the
// field, THIS BODY changes and no caller and no oracle assertion does.
export const quantityFieldOf = (section) =>
  section === null || section === undefined || section.kind !== "list" ? null
    : (placementSheet(section).find(field => field.key === QUANTITY_KEY && field.type === "number") ?? null)

// NEW: how many, as a whole number of at least 1. TOTAL — it answers for every
// input there is: an absent value reads as the field's own default (a book may write
// `default: 3`), and 0, −2, NaN, "x", a missing values object and a section with no
// quantity field all read as 1. The floor is 1 because below 1 an entry means
// nothing, and the honest way to have none of something is to unpick it.
export const quantityOf = (section, values) => {
  const field = quantityFieldOf(section)
  if (field === null) return 1
  const n = Math.trunc(Number(values?.[field.key] ?? fieldDefault(field)))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

// NEW: THE cost rule, in ONE place — four callers (spent, canAfford, the sheet's
// per-entry line, and the stepper's guard) and no second opinion. Note it multiplies
// honestly in both directions: a free rock stays free at any quantity (0 × 3 = 0),
// and a NEGATIVE cost (the shelf ships Tiny Arms at −1) still refunds ×2 at two.
export const entryCost = (item, section, values) => item.cost * quantityOf(section, values)

// NEW: one raw <input> value, as its field's KIND. This is the PLAYER's half of "the
// same contract, two doors": the editor's FIELD_BUILDERS turn an AUTHOR's keystrokes
// into these same shapes (number → Number(input.value), lines → one entry per line),
// and validate.js's CHECKERS judge both. Fail closed on a choice: never store a value
// the author never offered — fall back to the field's own default instead.
export const readValue = (field, raw) => {
  if (field.type === "number") { const n = Number(raw); return Number.isFinite(n) ? n : fieldDefault(field) }
  if (field.type === "lines")  return String(raw).split("\n").map(line => line.trim()).filter(line => line !== "")
  if (field.type === "choice") {
    const options = (field.options ?? []).map(asOption)
    return options.some(option => String(option.value) === String(raw)) ? String(raw) : fieldDefault(field)
  }
  return String(raw)
}

// NEW: the player's sheet as a VALUE — a thing of the declared type, minus its id.
// Core three first, then every FIELDS-section field in sheet order, then every LIST
// section in sheet order: that is thingKeys(type), BY CONSTRUCTION, which is what
// makes "the player's sheet is a thing" a fact the oracles check rather than a claim
// this comment makes. (Read the resulting key order carefully — it is not section
// order. `notes` is a fields section and the LAST section on Character, yet it lands
// before `origin`, the third. Do not "fix" it.)
//   type       the declared sheet type
//   rows       every row at every depth, hydrated (row.fills is a SECTION or null)
//   typed      gameState.typed
//   picksOf    (row) => the items picked in it, in pick order
//   valuesFor  (row, item) => that pick's placement values
//   spent      gameState.spent — a sheet is a thing that costs what it cost to build
// No id, because the sheet is on no shelf and nothing points at it — and minting a
// uuid would break "the player's sheet mints nothing". No image, because a player has
// no assets folder to put one in.
// Two rows may fill ONE section (dino's Lairs and Locations both land in `places`),
// so a section's entries are collected in ROW order and then pick order within a row.
// Nothing else orders them and nothing may.
export const buildSheet = ({ type, rows, typed, picksOf, valuesFor, spent }) => {
  const out = { name: typed.name ?? "", cost: spent, imageURL: "" }
  fieldsOfType(type).forEach(field => { out[field.key] = typed[field.key] ?? fieldDefault(field) })
  listSectionsOf(type).forEach(section => {
    out[section.key] = rows.filter(row => row.fills?.id === section.id)
      .flatMap(row => picksOf(row).map(item => ({ thing: item.id, ...valuesFor(row, item) })))
  })
  return out
}
