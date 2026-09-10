import { SCHEMA_VERSION, SHEETS, FILE_SHEETS, BOOK_FILE_SHEETS, coreThingSchema, asOption, isBookName, isEdition } from "./schema.js"
import { OPERATORS, WHERE_VALUE_TYPE } from "./query.js"
import { GATES } from "./visibility.js"
import { danglingReferences } from "./references.js"
// NEW: one constant, for RULES.section's quantity sentence below. sheet.js is a
// LEAF (it imports schema.js and nothing else), so this adds no cycle — see the
// import graph in sheet.js's header. Importing it the other way round WOULD be
// one: references.js already imports sheet.js, and this file imports references.js.
import { QUANTITY_KEY } from "./sheet.js"
// NEW: the operator values a DEMAND may carry, derived in demands.js from the two
// tables rather than typed out here — so the shape sentence below can never fall
// behind the vocabulary. demands.js is a LEAF too (schema.js + query.js and nothing
// else), and references.js already imports it, so this adds no cycle.
import { DEMAND_OPS } from "./demands.js"

// NEW: the border's contract, read from the sheet. The game trusts the files it
// loads and the editor trusts the files it saves; THIS is where a file is
// checked against what the sheet says — one sentence per fault, with the path.
// DOM-free, fetch-free, no work at import time: node runs it (the server, the
// oracles, the export) and the browser runs it (the editor's pre-flight).
// CHANGED: a BOOK's files are checked here too (validateBookFile), by the same
// walk over BOOK_FILE_SHEETS. What this file no longer does is judge a whole
// SET: validateSet moved to merge.js (see the note at the bottom).

export const FILE_NAMES = Object.keys(FILE_SHEETS)
export const problemText = ({ path, message }) => `${path}: ${message}`

const ALL_OPS      = [...new Set(Object.values(OPERATORS).flat().map(op => op.value))]           // every operator of every kind, ONCE: choice and text share one table (query.js)
const VALUE_TYPES  = [...new Set(Object.values(WHERE_VALUE_TYPE))]                              // ["string", "number"]
const AUTHOR_KINDS = Object.keys(GATES).filter(kind => !GATES[kind].borderOnly)                 // never is the border's own
const RESERVED_THING_KEYS = ["id", ...coreThingSchema.map(entry => entry.key)]                  // CHANGED: id, name, cost, imageURL, demands — derived, so the new core entry joined with no edit
const NOUN = { string: "a string", number: "a number", array: "an array", object: "an object" }

const isPlainObject  = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v)   // JSON never carries Infinity; the editor's memory can (Number("1e400"))
const describe = (v) =>
  v === undefined ? "absent" : v === null ? "null" : Array.isArray(v) ? "an array"
  : typeof v === "object" ? "an object" : typeof v === "string" ? JSON.stringify(v) : String(v)
// NEW: the shelf's two grammar sentences, written ONCE. isBookName and isEdition judge a
// PIN (content.books[i], book.requires[i]) and a MANIFEST (book.json's own name and
// edition) alike, so both readers below — CHECKERS.pins and RULES.book — say the same
// words from here. A second phrasing for either would be a second contract.
const notABookName = (name)    => `${JSON.stringify(name)} is not a book name (lowercase letters, digits and single dashes)`
const notAnEdition = (edition) => `must be a positive integer (found ${describe(edition)})`
const quoteKey = (key) => `[${JSON.stringify(key)}]`                                            // cabinet/bucket keys: always ["…"]
const at = (path, key) => /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : path + quoteKey(key)
const problem = (out, path, message) => { out.push({ path, message }); return false }
const expectType = (out, v, path, want) => {
  const fits = want === "string" ? typeof v === "string" : want === "number" ? isFiniteNumber(v)
             : want === "array" ? Array.isArray(v) : isPlainObject(v)
  return fits || problem(out, path, `must be ${NOUN[want]} (found ${describe(v)})`)
}

// CHECKERS: one per sheet-entry type — the sheet's THIRD reader, beside the
// editor's FIELD_BUILDERS (how a kind is edited) and the game's DISPLAY_BUILDERS
// (how it is shown). (entry, value, path, out, ctx): value is holder[entry.key],
// undefined when the key is absent, so "absent" is reported by the same line as
// a wrong type. ctx.ids holds one Map per id space for duplicate detection.
const CHECKERS = {
  text:           (entry, v, path, out) => { expectType(out, v, path, "string") },
  number:         (entry, v, path, out) => { expectType(out, v, path, "number") },
  lines:          (entry, v, path, out) => { if (expectType(out, v, path, "array")) v.forEach((line, i) => expectType(out, line, `${path}[${i}]`, "string")) },
  optionalNumber: (entry, v, path, out) => { if (v !== undefined && !isFiniteNumber(v)) problem(out, path, `must be a number or absent (found ${describe(v)})`) },
  optionalText:   (entry, v, path, out) => { if (v !== undefined && typeof v !== "string") problem(out, path, `must be a string or absent (found ${describe(v)})`) },
  choice:         (entry, v, path, out) => {
    if (!expectType(out, v, path, "string")) return
    const options = entry.options?.map(asOption)                                              // CHANGED: sheet options are { value, label }; a field's are bare strings
    if (options && !options.some(option => option.value === v))                               // optionsFrom = editor data, not checkable here
      problem(out, path, `${JSON.stringify(v)} is not one of ${options.map(option => option.value).join(", ")}`)
  },
  query:          (entry, v, path, out) => checkQuery(v, path, out),
  showWhen:       (entry, v, path, out) => checkGate(v, path, out),
  attachment:     () => {},                                                                  // no key: nothing lives in the element; the cabinet is checked from the file side
  collection:     (entry, v, path, out, ctx) => { if (expectType(out, v, path, "array")) v.forEach((element, i) => checkElement(entry.of, element, `${path}[${i}]`, out, ctx)) },
  form:           (entry, v, path, out, ctx) => checkSheet(SHEETS[entry.of], v, path, out, ctx, []),
  cabinet:        (entry, v, path, out, ctx) => {
    if (!expectType(out, v, path, "object")) return
    Object.entries(v).forEach(([id, slot]) => checkSheet(SHEETS[entry.of], slot, path + quoteKey(id), out, ctx, []))   // own keys only: JSON.parse makes "__proto__" an own property
  },
  // CHANGED: with `of`, each slot holds ELEMENTS of that sheet (the addition
  // cabinets of types.json — their ids join that sheet's id space, so a field
  // added twice in one file is a duplicate like any other); without, things.
  buckets:        (entry, v, path, out, ctx) => {
    if (!expectType(out, v, path, "object")) return
    Object.entries(v).forEach(([id, bucket]) => {
      const bucketPath = path + quoteKey(id)
      if (!expectType(out, bucket, bucketPath, "array")) return
      bucket.forEach((element, i) => entry.of === undefined
        ? checkThing(element, `${bucketPath}[${i}]`, out, ctx)
        : checkElement(entry.of, element, `${bucketPath}[${i}]`, out, ctx))
    })
  },
  // NEW: the pins of a game (content.books) and the requires of a book (book.requires):
  // an array of exactly { name, edition }, names by the shelf's grammar and distinct —
  // one book is pinned once; which EDITION is the pin's whole point.
  pins:           (entry, v, path, out) => {
    if (!expectType(out, v, path, "array")) return
    const seen = new Map()
    v.forEach((pin, i) => {
      const pinPath = `${path}[${i}]`
      if (!expectType(out, pin, pinPath, "object")) return
      if (expectType(out, pin.name, `${pinPath}.name`, "string")) {
        if (!isBookName(pin.name)) problem(out, `${pinPath}.name`, notABookName(pin.name))                   // CHANGED: the sentence moved up top — RULES.book says it too
        else if (seen.has(pin.name)) problem(out, pinPath, `${JSON.stringify(pin.name)} appears twice — also at ${seen.get(pin.name)}`)
        else seen.set(pin.name, pinPath)
      }
      if (!isEdition(pin.edition)) problem(out, `${pinPath}.edition`, notAnEdition(pin.edition))             // CHANGED: ditto
      Object.keys(pin).forEach(key => { if (key !== "name" && key !== "edition") problem(out, at(pinPath, key), `unexpected key ${JSON.stringify(key)}`) })
    })
  },
  // NEW: a key whose only value is true. `false` is never written — absence
  // says it — so a false here is a hand-edit that means the opposite of what it looks like.
  flag:           (entry, v, path, out) => { if (v !== undefined && v !== true) problem(out, path, `must be true or absent (found ${describe(v)})`) },
  // NEW: a field's own default: a string or a number. Whether it FITS the field's
  // kind is RULES.fieldDef's sentence — that needs the sibling `type`, which a
  // checker never sees. null is refused on purpose: "no default" is the key's absence.
  fieldDefault:   (entry, v, path, out) => { if (!(typeof v === "string" || isFiniteNumber(v))) problem(out, path, `must be a string or a number (found ${describe(v)})`) },
  // NEW: things.order — per sheet id, the ids that come first. Each id once:
  // "first, then first again" has no meaning. Whether an id is on that shelf is
  // the merge's question (F15: the shelf is only known once the books are in).
  idLists:        (entry, v, path, out) => {
    if (!expectType(out, v, path, "object")) return
    Object.entries(v).forEach(([sheetId, list]) => {
      const listPath = path + quoteKey(sheetId)
      if (!expectType(out, list, listPath, "array")) return
      const seen = new Map()
      list.forEach((id, i) => {
        const idPath = `${listPath}[${i}]`
        if (typeof id !== "string" || id === "") { problem(out, idPath, `must be a non-empty string (found ${describe(id)})`); return }
        if (seen.has(id)) problem(out, idPath, `${JSON.stringify(id)} is listed twice — also at ${seen.get(id)}`)
        else seen.set(id, idPath)
      })
    })
  },
  // NEW: a thing's entries under a list section. Never reached through a sheet
  // walk — things are not sheet-walked (checkThing reads the core fields only),
  // and whether a placed thing EXISTS needs the whole set, so the shape sentences
  // and the existence sentence both live in references.js's placement audit,
  // reached through crossChecks. Listed here so CHECKED_TYPES names every kind a
  // sheet can produce (sheetOfType makes one of these per list section; oracle V1).
  placements:     () => {},
  // NEW: what a thing DEMANDS of the player's sheet — a list of conditions, ALL of
  // which must hold. Each one is `field, op, value`: the SAME three keys, in the same
  // order, that a row's `where` has carried since v4, so the SAME function judges both
  // (checkCondition below) and the two are refused by identical sentences.
  // WHICH ops fit WHICH slot, and whether the slot exists at all, is a reference
  // question — the demand audit in references.js, reached through crossChecks — for
  // exactly the reason checkQuery gives about `where`: the field lives in another file.
  // An EMPTY array is refused with its own sentence because "this entry demands
  // nothing" already has a spelling and it is the key's ABSENCE. The file never
  // carries a no-op: the editor deletes the key with the last demand, and so do the
  // two repairs in references.js.
  demands:        (entry, v, path, out) => {
    if (!expectType(out, v, path, "array")) return
    if (v.length === 0) { problem(out, path, `must not be empty — a thing that demands nothing carries no "demands" key`); return }
    v.forEach((demand, i) => {
      const demandPath = `${path}[${i}]`
      if (!expectType(out, demand, demandPath, "object")) return
      checkCondition(demand, demandPath, out, DEMAND_OPS)
    })
  }
}
export const CHECKED_TYPES = Object.keys(CHECKERS)

// NEW: ONE field value, checked through the SAME table a data file crosses.
// An AUTHOR's values arrive in a file and are judged by validateFile; a PLAYER's
// arrive from an <input> or from a kept sheet, and are judged HERE — so a number
// field holds a number whichever door it came through, and a choice can never hold
// an option the author never wrote.
// The CHECKERS table itself stays private on purpose: one thin door is all anyone
// outside needs, and a private table cannot drift into a second contract.
// Why not query.js's SHAPE_OK, which asks a similar-looking question: SHAPE_OK is
// deliberately LOOSE (it accepts NaN for a number, any array for lines, any string
// for a choice) because a filter that cannot decide simply shows nothing. A kept
// sheet a player hand-edited needs the strict answer, and `1e999` — which JSON.parse
// turns into Infinity — is exactly the case the loose door lets through.
// `path` is only what the sentences are ADDRESSED to ("strength", "notes[1]"), so a
// caller can say where in ITS world the value sits.
export const checkFieldValue = (field, value, path = "value") => {
  const out = []
  const checker = CHECKERS[field.type]
  if (!checker) return [{ path, message: `no checker for kind ${JSON.stringify(field.type)}` }]
  checker(field, value, path, out, { ids: {} })
  return out
}

// one sheet-shaped object: every entry through its checker, then every own key
// the sheet (or extraKeys: "version" on a file top, "id" on an element) does not name.
// NEW: two props of an entry are honoured before its checker runs —
//   showIf: the entry exists only while its sibling matches. Not matching, the key
//           must be ABSENT (a `fields` list on a list section is a leftover with
//           nothing to hold it) — and it is still a KNOWN key, so the walk below
//           does not report it a second time as merely unexpected. When the
//           sibling itself holds a value its choice does not offer (kind: "table"),
//           it decides nothing: that wrong value is the one problem, and the keys
//           it governs are left alone — checkGate's rule, applied here.
//   optional: absence is fine; a present value is checked as usual.
const decides = (sheet, key, holder) => {                                                    // does the sibling hold a value its own entry offers?
  const options = sheet.find(entry => entry.key === key)?.options?.map(asOption)
  return !options || options.some(option => option.value === holder[key])
}
const checkSheet = (sheet, holder, path, out, ctx, extraKeys) => {
  if (!expectType(out, holder, path, "object")) return
  const known = new Set(extraKeys)
  sheet.forEach(entry => {
    if (entry.key === undefined) return                                                      // attachment
    known.add(entry.key)
    const checker = CHECKERS[entry.type]
    if (!checker) throw new Error(`No checker for sheet type "${entry.type}" (key: ${entry.key})`)   // loud: the sheet grew a type this table does not know
    const v = holder[entry.key]
    const entryPath = `${path}.${entry.key}`
    if (entry.showIf) {
      const shown = holder[entry.showIf.key] === entry.showIf.value
      if (!shown) {
        if (v !== undefined && decides(sheet, entry.showIf.key, holder)) problem(out, entryPath, `unexpected key ${JSON.stringify(entry.key)} (only when ${entry.showIf.key} is ${JSON.stringify(entry.showIf.value)})`)
        return                                                                               // still marked known
      }
    }
    if (entry.optional && v === undefined) return
    checker(entry, v, entryPath, out, ctx)
  })
  Object.keys(holder).forEach(key => { if (!known.has(key)) problem(out, at(path, key), `unexpected key ${JSON.stringify(key)}`) })
}

// a collection element: its sheet, then its id (a non-empty string, unique in
// its id space for this file), then the sentences a sheet cannot say (RULES)
const checkElement = (sheetName, element, path, out, ctx) => {
  checkSheet(SHEETS[sheetName], element, path, out, ctx, ["id"])
  if (!isPlainObject(element)) return
  checkId(sheetName, element, path, out, ctx)
  RULES[sheetName]?.(element, path, out)
}
const checkId = (space, element, path, out, ctx) => {
  if (typeof element.id !== "string" || element.id === "") { problem(out, `${path}.id`, `must be a non-empty string (found ${describe(element.id)})`); return }
  // an id becomes a KEY of a plain object in the interior (selections[row.id],
  // things.things[type.id]) — a name every object already inherits ("__proto__",
  // "constructor", "toString") would read the prototype's member, not the file's
  if (element.id === "__proto__" || Object.hasOwn(Object.prototype, element.id)) { problem(out, `${path}.id`, `${JSON.stringify(element.id)} cannot be an id (it is a name every object already has)`); return }
  const seen = (ctx.ids[space] ??= new Map())
  if (seen.has(element.id)) problem(out, `${path}.id`, `duplicate id ${JSON.stringify(element.id)} — also at ${seen.get(element.id)}`)
  else seen.set(element.id, path)
}

// a thing: the core fields strictly by coreThingSchema (the game reads name,
// cost and imageURL directly — a string cost would concatenate in totalCost),
// its id, and NOTHING about the author's fields: a field whose kind changed or
// whose key was renamed legitimately leaves the old shape / the old key behind
// (schema.js, fieldDefSchema's comment; query.js readAs is the border for those).
// Its placements are the audit's (crossChecks): they point at other things.
const checkThing = (thing, path, out, ctx) => {
  if (!expectType(out, thing, path, "object")) return
  coreThingSchema.forEach(entry => {
    // NEW: honour `optional`, exactly as checkSheet already does — this line removes
    // an inconsistency rather than adding one. `demands` is born ABSENT, and absent
    // means "this entry demands nothing", which is what every thing on the shelf and
    // in both games means today. Without it a new optional core entry would report
    // `…[i].demands: must be an array (found absent)` on every one of them, every
    // book would fail validateBookFile, and both games would fall closed.
    if (entry.optional && thing[entry.key] === undefined) return
    CHECKERS[entry.type](entry, thing[entry.key], `${path}.${entry.key}`, out, ctx)
  })
  checkId("thing", thing, path, out, ctx)
}

// NEW: ONE condition — `field, op, value` and nothing else — checked at whatever
// path it sits at. EXTRACTED, not copied: a row's `where` and a thing's `demands[i]`
// are the same three keys in the same order, so they get the same four sentences,
// and the day one of them gains a key the other gains it too. `ops` is the only
// difference between the two callers: a row's filter may carry any FIELD KIND's
// operator (ALL_OPS, 10 of them), a demand may also carry a LIST section's four
// (DEMAND_OPS, 13) — and both lists are derived from the tables, never typed out.
// WHICH op fits THIS field is a reference question either way (crossChecks): the
// field lives in another file.
const CONDITION_KEYS = ["field", "op", "value"]
export const checkCondition = (condition, path, out, ops) => {
  expectType(out, condition.field, `${path}.field`, "string")
  if (expectType(out, condition.op, `${path}.op`, "string") && !ops.includes(condition.op))
    problem(out, `${path}.op`, `${JSON.stringify(condition.op)} is not an operator (${ops.join(", ")})`)
  if (!(VALUE_TYPES.includes(typeof condition.value) && (typeof condition.value === "string" || isFiniteNumber(condition.value))))
    problem(out, `${path}.value`, `must be ${VALUE_TYPES.map(type => `a ${type}`).join(" or ")} (found ${describe(condition.value)})`)
  Object.keys(condition).forEach(key => { if (!CONDITION_KEYS.includes(key)) problem(out, at(path, key), `unexpected key ${JSON.stringify(key)}`) })
}

// { type, where }: type a string; where null, or ONE condition (above) whose op is
// any field kind's. CHANGED: the condition's own four sentences moved into
// checkCondition, which CHECKERS.demands calls too — same keys, same words.
const checkQuery = (query, path, out) => {
  if (!expectType(out, query, path, "object")) return
  expectType(out, query.type, `${path}.type`, "string")
  const where = query.where
  if (where === null) { /* no condition */ }
  else if (!isPlainObject(where)) problem(out, `${path}.where`, `must be null or an object (found ${describe(where)})`)
  else checkCondition(where, `${path}.where`, out, ALL_OPS)
  Object.keys(query).forEach(key => { if (!["type", "where"].includes(key)) problem(out, at(path, key), `unexpected key ${JSON.stringify(key)}`) })
}

// { kind, ...one named id }: kind an OWN key of GATES that is not border-only
// (Object.hasOwn — "toString" is not a gate), the key GATES[kind].names a
// string, nothing else. Whether the id exists is a reference question.
const checkGate = (gate, path, out) => {
  if (!expectType(out, gate, path, "object")) return
  if (!expectType(out, gate.kind, `${path}.kind`, "string")) return
  if (!Object.hasOwn(GATES, gate.kind) || GATES[gate.kind].borderOnly) {
    problem(out, `${path}.kind`, `${JSON.stringify(gate.kind)} is not a show-when kind (${AUTHOR_KINDS.join(", ")})`)
    return                                                                                   // the kind decides which keys the gate may hold
  }
  const names = GATES[gate.kind].names                                                       // "thing" | "row" | undefined (always)
  if (names) expectType(out, gate[names], `${path}.${names}`, "string")
  Object.keys(gate).forEach(key => { if (key !== "kind" && key !== names) problem(out, at(path, key), `unexpected key ${JSON.stringify(key)}`) })
}

// the keys a list of field-like things claims, each once and none reserved —
// shared by RULES.type (a sheet's storage keys) and RULES.section (a placement's)
const claimKeys = (out, seen, key, keyPath, holderPath, reserved, reservedWhat) => {
  if (reserved.includes(key)) problem(out, keyPath, reservedWhat(key))
  else if (seen.has(key)) problem(out, keyPath, `duplicate key ${JSON.stringify(key)} — also at ${seen.get(key)}`)
  else seen.set(key, holderPath)
}

// RULES: the few sentences a sheet cannot say, per element sheet, run after the walk.
const RULES = {
  // CHANGED: walks sections. The keys a thing of this type may hold — thingKeys in
  // schema.js — are the FIELD keys of its fields sections and the KEY of each list
  // section (that is where the placements live); a fields section's own key is
  // addressing only and claims nothing. Unique, and never one of the core four.
  type: (type, path, out) => {                                                               // dinoEdit/state.js warnDuplicateKeys, made binding
    if (!Array.isArray(type.sections)) return                                                // already reported by the walk
    const seen = new Map()
    const reservedWhat = (key) => `${JSON.stringify(key)} is a key every thing already has (${RESERVED_THING_KEYS.join(", ")})`
    type.sections.forEach((section, j) => {
      if (!isPlainObject(section)) return                                                    // already reported
      const sectionPath = `${path}.sections[${j}]`
      if (section.kind === "list") {
        if (typeof section.key === "string") claimKeys(out, seen, section.key, `${sectionPath}.key`, sectionPath, RESERVED_THING_KEYS, reservedWhat)
      } else if (section.kind === "fields" && Array.isArray(section.fields)) {
        section.fields.forEach((field, i) => {
          if (!isPlainObject(field) || typeof field.key !== "string") return                 // already reported
          claimKeys(out, seen, field.key, `${sectionPath}.fields[${i}].key`, `${sectionPath}.fields[${i}]`, RESERVED_THING_KEYS, reservedWhat)
        })
      }
    })
  },
  // NEW: a section's key names its slot in every thing (a list section) or its
  // card (a fields section) — never blank. A list section must say which shelf
  // it draws from, and its placement fields claim keys the way a type's do:
  // unique, and never `thing` — the key every placement already holds.
  section: (section, path, out) => {
    if (section.key === "") problem(out, `${path}.key`, `must be a non-empty string (found "")`)
    if (section.kind !== "list") return
    if (section.of === "") problem(out, `${path}.of`, `must be a non-empty string (found "")`)
    if (!Array.isArray(section.placement)) return                                            // already reported by the walk
    const seen = new Map()
    section.placement.forEach((field, i) => {
      if (!isPlainObject(field) || typeof field.key !== "string") return                     // already reported
      claimKeys(out, seen, field.key, `${path}.placement[${i}].key`, `${path}.placement[${i}]`, ["thing"], () => `"thing" is the key every placement already has`)
      // NEW: the quantity convention, made binding. A placement field keyed
      // "quantity" MULTIPLIES its entry's cost (sheet.js: QUANTITY_KEY, entryCost),
      // so a book that names one must MEAN a number — a `quantity` holding text
      // would read as 1 for ever and quietly charge the player once. Refusing it
      // here turns that silent surprise into a save-time sentence with a path.
      // Measured: no file under books/ trips this.
      if (field.key === QUANTITY_KEY && field.type !== "number")
        problem(out, `${path}.placement[${i}].type`, `a placement field keyed "quantity" multiplies the entry's cost, so it must be a number field`)
    })
  },
  // CHANGED: a choice needs options (at least one, all distinct — value = label, so
  // two alike would be one option twice); a `default` must fit the field's kind.
  fieldDef: (field, path, out) => {
    if (field.key === "") problem(out, `${path}.key`, `must be a non-empty string (found "")`)
    if (field.type === "choice" && Array.isArray(field.options)) {
      if (field.options.length === 0) problem(out, `${path}.options`, `a choice needs at least one option`)
      const seen = new Set()
      field.options.forEach((option, i) => {
        if (typeof option !== "string") return                                               // already reported by the lines checker
        if (seen.has(option)) problem(out, `${path}.options[${i}]`, `duplicate option ${JSON.stringify(option)}`)
        else seen.add(option)
      })
    }
    const value = field.default
    if (value === undefined || !(typeof value === "string" || isFiniteNumber(value))) return   // absent, or already refused by the fieldDefault checker
    const defaultPath = `${path}.default`
    if (field.type === "number") { if (typeof value !== "number") problem(out, defaultPath, `default must be a number (found ${describe(value)})`) }
    else if (field.type === "text") { if (typeof value !== "string") problem(out, defaultPath, `default must be a string (found ${describe(value)})`) }
    else if (field.type === "lines") problem(out, defaultPath, `a lines field cannot carry a default`)
    else if (field.type === "choice" && Array.isArray(field.options) && field.options.length > 0 && !field.options.includes(value))
      problem(out, defaultPath, `default ${JSON.stringify(value)} is not one of ${field.options.join(", ")}`)
  },
  // NEW: book.json's own name and edition, by the shelf's own two grammars. bookSchema
  // can only say "a string" and "a number", so WITHOUT this entry `{ name: "Basic ",
  // edition: 1.5 }` is a manifest validateBookFile accepts. That was harmless only while
  // every book arrived as a FOLDER somebody had already made: merge.js's bookRules
  // answers `must be "basic" — the folder's name` and server/books.js refuses a folder
  // that fails isBookName, so the folder was the truth and the manifest merely had to
  // agree with it. A book written by a MACHINE is judged BEFORE its folder exists, so the
  // grammar has to be askable of the manifest alone — and asking it here means the editor,
  // the create route and a hand-written book are all judged by one sentence in one place.
  // Both halves wait for the shape walk to be satisfied, so a name that is not a string is
  // ONE sentence ("must be a string"), never two.
  book: (manifest, path, out) => {
    if (typeof manifest.name === "string" && !isBookName(manifest.name)) problem(out, `${path}.name`, notABookName(manifest.name))
    if (isFiniteNumber(manifest.edition) && !isEdition(manifest.edition)) problem(out, `${path}.edition`, notAnEdition(manifest.edition))
  }
}

// NEW: which sheet IS this file top? A file top that is a registered sheet gets that
// sheet's RULES too — the same line checkElement runs, for the same reason: the few
// sentences a sheet cannot say about itself. book.json is the only file like that, and it
// is the only object in the system that is both a file TOP and a SHEET
// (BOOK_FILE_SHEETS.book IS SHEETS.book — one object, asserted by identity).
// Asked by IDENTITY and not by the file's NAME: a file name is a filename and the RULES
// table is keyed by sheet name, and conflating the two would be a second contract living
// on a coincidence — `types` the file and `type` the sheet are one letter apart.
const sheetNameOf = (sheet) => Object.keys(SHEETS).find(name => SHEETS[name] === sheet)

// one file top: the version gate first (an old file has dozens of consequent
// shape problems; the version line is the one that matters), then the walk.
// `gate` is what the version line says to do about it; a manifest has no
// version at all (book.json is not a data file), so no gate and no "version" key.
const checkFile = (sheet, name, file, gate) => {
  const out = []
  if (!expectType(out, file, name, "object")) return out
  if (gate && file.version !== SCHEMA_VERSION) return [{ path: `${name}.version`, message: `must be ${SCHEMA_VERSION} (found ${describe(file.version)}) — ${gate}` }]
  checkSheet(sheet, file, name, out, { ids: {} }, gate ? ["version"] : [])
  RULES[sheetNameOf(sheet)]?.(file, name, out)                                   // NEW: a file top that is a sheet is judged by its RULES too (book.json)
  return out
}

export const validateFile = (name, file) => {
  const sheet = FILE_SHEETS[name]
  if (!sheet) throw new Error(`No such data file: ${name}`)
  return checkFile(sheet, name, file, "open the game in the editor and Save to migrate it")
}

// NEW: a book's file, by the same walk over BOOK_FILE_SHEETS. Books are born at
// SCHEMA_VERSION and never migrated (the shelf ships new editions instead), so
// the version line's advice is different: this file was written for another version.
export const validateBookFile = (name, file) => {
  const sheet = BOOK_FILE_SHEETS[name]
  if (!sheet) throw new Error(`No such book file: ${name}`)
  return checkFile(sheet, name, file, name === "book" ? null : "this book was written for another version")
}

// the reference half: exactly references.js's audit, attached to the pointer that dangles
// (a row's three pointers, and now a thing's placements — the same walk carries both)
// CHANGED: `mode` is carried straight through to the audit — "game" or "book", the same
// two words mergeLayers already has. The audit's own note says what turns on it (a row's
// `fills`); this line only refuses to invent a second name for it.
export const crossChecks = (set, mode = "game") =>
  danglingReferences(set, mode).map(({ path, pointer, what }) => ({ path: `${path}.${pointer}`, message: what }))

// CHANGED: validateSet used to live here — the five shapes, then crossChecks. It
// MOVED to merge.js: a set is only whole once its pinned books are merged in (a
// row may show basic:character), so judging one is the merge's job — and merge.js
// imports this file, so this file cannot import it back. There:
//   validateSet(set) = validateGame({ own: set, books: [] })   — the bookless case
