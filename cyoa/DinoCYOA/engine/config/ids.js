import { SHEETS, FILE_SHEETS, MINTS, sheetOfType, coreThingSchema } from "./schema.js"
import { QUERY_IDS } from "./query.js"
import { GATES } from "./visibility.js"
import { demandFieldById, demandOperatorOf } from "./demands.js"

// NEW FILE: EVERY PLACE AN ID SITS, as one walk over the contract.
//
// This is the sixth sibling of query.js / visibility.js / sheet.js / demands.js /
// references.js: one subject, its walk, and no second opinion. Nothing here touches the
// DOM, fetches anything, or does work at import time, so node runs it in the oracles and
// the browser runs it in the editor — one set of bytes, two runtimes.
//
// WHY IT EXISTS. Renaming a book and lifting a game's own layer into one ("save as a
// book") both have to convert an id set from one namespace to another, and an id hides in
// 30 places across four file shapes — as VALUES and as object KEYS. references.js already
// holds "who points where" for the repairs, but it covers references TO an id and never
// the id-bearing `id` keys or the KEYS themselves, and it is written as ten hand-aimed
// walks. A rewriter written the same way is a hand-written list of 30 paths, and a
// hand-written list is exactly what rots silently the day the schema grows a key. So:
// ONE walk, driven by the sheet ENTRY TYPE, the way every other reader of the contract
// dispatches (CHECKERS, FIELD_BUILDERS, DISPLAY_BUILDERS).
//
// WHAT THE CONTRACT COULD NOT SAY, and what was added so it could. Measured, not
// assumed (probe-idpositions): of 32 id positions, 20 were already findable from markers
// that existed, 12 were blind — 8 because `id` is minted and appears on no sheet, and 4
// because a query is a compound with no internal markers. Two tables fixed both, each
// following a precedent that was already there: schema.js's MINTS (the twin of GATES'
// `names` for elements) and query.js's QUERY_IDS (the twin of GATES' `names` for the
// other compound). This file reads those two and nothing else new. The remaining 2 of
// the 32 are `content.books[i].name` and `book.requires[i].name`, which name a BOOK and
// not an id: renaming a book rewrites its pins, and that is a different walk over a
// different grammar (§8's receipt says `rewritten: { ids, pins }` for exactly that
// reason). WALKERS.pins says so where a reader will look for it.
//
// ITS PLACE IN THE IMPORT GRAPH — the acyclic rule sheet.js's header states, not tidiness:
//
//   schema.js ─┬─ query.js ────┬── demands.js ──┬── references.js ── validate.js ── merge.js
//              ├─ visibility.js┘                │                                      │
//              └─ sheet.js                      └── ids.js ────────────────────────────┘
//
// It imports schema.js, query.js, visibility.js and demands.js — leaves, all of them —
// and it may NEVER import validate.js or merge.js: merge.js imports THIS file (bookRules
// reads the defining half of this walk), so the other direction would be a cycle.
//
// WHAT IS DELIBERATELY NOT HERE: no shelf, no namespace, no minter, no grammar. This file
// says WHERE an id sits and hands the caller enough to read or replace it. Whether an id
// is legal is bookRules' sentence (merge.js), what a new one is called is the minter's,
// and which ids move is the rename route's. A walker that also judged would be two
// contracts.


const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const quoteKey = (key) => `[${JSON.stringify(key)}]`                     // cabinet/bucket coordinates, validate.js's own spelling

// The key every placement already has. validate.js's RULES.section reserves it by that
// name ("thing" is the key every placement already has) and references.js's placement
// audit reads it; spelled once here so this walk NAMES it rather than knowing it.
const PLACED = "thing"

// An id that is an object KEY is renamed by REBUILDING its holder in insertion order.
// delete-then-assign would move the key to the END, and the key order on disk is pinned
// (T1's `serialize(JSON.parse(text)) === text`, and B2/B5/B6/B7 over the merged shapes) —
// a rename that reordered `things.things` would rewrite bytes nobody asked to change and
// a rename back again would not come home. Object.entries is taken FIRST, so the walk's
// own snapshot of the container is unaffected.
const renameKey = (holder, from, to) => {
  if (to === from) return
  const was = Object.entries(holder)
  was.forEach(([key]) => delete holder[key])
  was.forEach(([key, value]) => { holder[key === from ? to : key] = value })
}

// A type whose shape the walkers below may read. sheetOfType and demandFields both map
// over `sections` and over a fields section's `fields`, so a malformed type would throw
// inside a walk that must be TOTAL — the merge and the border both meet unvalidated files
// (loadData calls the merge on whatever is on disk). A type that fails this is simply not
// a phonebook entry: the thing's own id and demands are still walked, its placements are
// not, and eachId says so in its answer rather than guessing.
const walkable = (type) => isObject(type) && Array.isArray(type.sections) &&
  type.sections.every(section => isObject(section) && (section.kind === "list" || Array.isArray(section.fields)))

// WALKERS: one per sheet-entry type — the sheet's FOURTH reader, beside the validator's
// CHECKERS (how a kind is judged), the editor's FIELD_BUILDERS (how it is edited) and the
// game's DISPLAY_BUILDERS (how it is shown). (holder, entry, path, ctx): `path` is where
// holder[entry.key] sits, in the validator's own path grammar, so a position's address is
// the address a fault about it would use.
// Every entry type CHECKERS knows is named here, INCLUDING the ones that hold no id —
// silence must be a written row, not a table miss, because a missing row is a position a
// rename would skip and nobody would hear about it. An unknown type throws, loudly, the
// way checkSheet's own missing checker does.
const WALKERS = {
  // ── these hold values, never ids ──────────────────────────────────────────────────
  text: () => {}, number: () => {}, lines: () => {}, optionalNumber: () => {}, optionalText: () => {},
  flag: () => {}, fieldDefault: () => {},
  // an attachment has NO key, so the walk skips it before dispatch; nothing is stored in
  // the element and the cabinet it names is walked from the FILE side, once
  attachment: () => {},
  // a pin names a BOOK — a folder on the shelf — and not an id. Renaming a book rewrites
  // its pins, in the games that hold them as well as in the shelf, and that is a walk over
  // pins and not over ids: two halves of one rename, said separately on purpose (§8).
  pins: () => {},

  // ── one id, straight ──────────────────────────────────────────────────────────────
  // A choice holds an id only when it names an editor OPTION SOURCE: a choice with its
  // options written ON the entry offers a fixed vocabulary (a section's kind, a field's
  // kind), while `optionsFrom` means the options are DATA — sections, sheets — and what is
  // stored is one of their ids. Four positions today: a section's `of`, a row's `fills`,
  // an override's `fills`, and `content.sheet`.
  choice: (holder, entry, path, ctx) => { if (entry.optionsFrom !== undefined) ctx.value(holder, entry.key, path) },

  // ── the two compounds, each read from its own marker table ────────────────────────
  query: (holder, entry, path, ctx) => {
    const query = holder[entry.key]
    if (!isObject(query)) return
    Object.entries(QUERY_IDS).forEach(([where, kind]) => {
      const steps = where.split(".")                                     // "where.field" is one step down through the condition
      const owner = steps.slice(0, -1).reduce((at, step) => isObject(at) ? at[step] : undefined, query)
      if (isObject(owner)) ctx.value(owner, steps[steps.length - 1], `${path}.${where}`, kind)
    })
  },
  showWhen: (holder, entry, path, ctx) => {
    const gate = holder[entry.key]
    if (!isObject(gate)) return
    // an OWN property, for visibility.js's own reason: a hand-edited kind called
    // "toString" would otherwise answer with Object.prototype's member
    const names = Object.hasOwn(GATES, gate.kind) ? GATES[gate.kind].names : undefined
    if (names !== undefined) ctx.value(gate, names, `${path}.${names}`, names)   // GATES' `names` is the key AND the kind: "thing", "row"
  },

  // ── a thing's own two pointer shapes ──────────────────────────────────────────────
  // A demand's `field` names a slot on some sheet — a field, or a LIST section dressed as
  // one (demands.js's asDemandField). Its `value` is an id only when that slot is a list
  // section and the operator takes one: `lacks` sits in BOTH operator tables, so the
  // OPERATOR alone cannot tell a thing id from a line of text — only the resolved slot can.
  // Resolved BEFORE the field position is offered, so a rewrite of the field cannot change
  // the answer about the value.
  demands: (holder, entry, path, ctx) => {
    const list = holder[entry.key]
    if (!Array.isArray(list)) return
    list.forEach((demand, j) => {
      if (!isObject(demand)) return
      const slot = ctx.slotOf(demand.field)
      ctx.value(demand, "field", `${path}[${j}].field`, slot?.section ? MINTS.section : MINTS.fieldDef)
      const operator = slot === undefined ? undefined : demandOperatorOf(slot, demand.op)
      if (slot?.section && operator !== undefined && operator.valueless !== true) ctx.value(demand, "value", `${path}[${j}].value`, MINTS.thing)
    })
  },
  placements: (holder, entry, path, ctx) => {
    const list = holder[entry.key]
    if (!Array.isArray(list)) return
    list.forEach((placement, j) => { if (isObject(placement)) ctx.value(placement, PLACED, `${path}[${j}].${PLACED}`, MINTS.thing) })
  },

  // ── the structural four ───────────────────────────────────────────────────────────
  collection: (holder, entry, path, ctx) => {
    const list = holder[entry.key]
    if (!Array.isArray(list)) return
    list.forEach((element, i) => ctx.element(entry.of, element, `${path}[${i}]`))
  },
  form: (holder, entry, path, ctx) => ctx.sheet(SHEETS[entry.of], holder[entry.key], path),
  // a cabinet's KEY is the id of the element it hangs off (a row's, for all three of
  // them); the slot itself is a sheet with no id of its own — which is why MINTS names
  // `group` and not `groupRules`
  cabinet: (holder, entry, path, ctx) => {
    const slots = holder[entry.key]
    if (!isObject(slots)) return
    Object.entries(slots).forEach(([id, slot]) => {                      // own keys only: JSON.parse makes "__proto__" an own property
      const slotPath = path + quoteKey(id)
      ctx.key(slots, id, slotPath)
      ctx.sheet(SHEETS[entry.of], slot, slotPath)
    })
  },
  // a bucket's KEY is the TARGET's id — a sheet's for things and sectionsFor, a section's
  // for fieldsFor — and the target is not this entry's `of`, which is what the bucket
  // HOLDS. Without `of` the arrays hold things, whose sheet is built per TYPE.
  buckets: (holder, entry, path, ctx) => {
    const buckets = holder[entry.key]
    if (!isObject(buckets)) return
    Object.entries(buckets).forEach(([id, list]) => {
      const bucketPath = path + quoteKey(id)
      ctx.key(buckets, id, bucketPath)
      if (!Array.isArray(list)) return
      list.forEach((element, i) => entry.of === undefined
        ? ctx.thing(id, element, `${bucketPath}[${i}]`)
        : ctx.element(entry.of, element, `${bucketPath}[${i}]`))
    })
  },
  // things.order: a sheet id per key, thing ids in the list. Both are positions, and the
  // list's are the one place an id is an ARRAY ELEMENT rather than a key or a value
  idLists: (holder, entry, path, ctx) => {
    const lists = holder[entry.key]
    if (!isObject(lists)) return
    Object.entries(lists).forEach(([id, list]) => {
      const listPath = path + quoteKey(id)
      ctx.key(lists, id, listPath)
      if (Array.isArray(list)) list.forEach((_, i) => ctx.value(list, i, `${listPath}[${i}]`, MINTS.thing))
    })
  }
}

// NEW: the types this walk knows, for the sweep that keeps it level with the others —
// validate.js's CHECKED_TYPES is the same export for the same reason. A sheet that grows a
// type nobody added a row for throws at the FIRST file that holds one, which is late; the
// sweep says so at oracle time instead. The table itself stays private: one thin door is
// all anyone outside needs, and a private table cannot drift into a second contract.
export const ID_WALKED_TYPES = Object.keys(WALKERS)

// NEW: every id position in a set of files, in file order and then sheet order.
//
//   files       { <file name>: <the file's top>, … } — a game's five, or a book's four
//               ({ book: manifest, types, things, proposals }). A file that is null or
//               absent is skipped: a book's three data files are optional on disk.
//   types       the MERGED types — the phonebook. Two questions need it and no others:
//               which of a thing's keys hold PLACEMENTS, and whether a demand's value is
//               a thing id. Pass the merged library, not one layer's: a book's things sit
//               on sheets its requirements define.
//   visit       called once per position with
//                 { path, id, kind, defining, holder, key, isKey, set }
//               path      where it sits, in the validator's path grammar
//               id        the string that is there now (every string, "" included — see below)
//               kind      the CONTRACT'S OWN WORD for what this id names, where it has one:
//                         MINTS' for an element's id (and for a thing, a placement and an
//                         arrangement's entries), QUERY_IDS' for a query's two, GATES' `names`
//                         for a gate's, and the resolved slot's own nature for a demand's.
//                         `undefined` where nothing declares it — a container's KEY, and a
//                         choice's option source. Nothing here dispatches on it: the contract
//                         pins the POSITION, and a payload that guessed the kind for the rest
//                         would be read as authoritative for all of them
//               defining  true for an element's OWN `id` — the half that says what this
//                         layer DEFINES, which is the half bookRules judges. Every other
//                         position is a REFERENCE, and a layer may reference anything
//               isKey     the id IS the key of `holder` (a cabinet slot, a bucket, an
//                         arrangement) rather than the value at `holder[key]`
//               set(next) replace it — order-preserving for a key, plain for a value
//   fileSheets  the table that says what shape each file has: FILE_SHEETS for a game,
//               BOOK_FILE_SHEETS for a book. A file the table does not name THROWS: a
//               walk that silently skipped a file would be a rename that silently lost
//               half a book. The default is the game's table, and it cannot swallow a
//               book set by accident — `book` and `proposals` are not on it, so a book
//               passed without its table throws on the first file.
//
// EVERY STRING IS A POSITION, "" included. `fills` and `content.sheet` spell "nothing"
// as "", and an id that is empty is a fault bookRules must still be able to say out loud;
// skipping it here would quietly change what a book is refused for. A value that is not a
// string is not a position at all — the border already has a sentence for it, and a walker
// that must be TOTAL has nothing to add.
//
// Returns { ids, unknownSheets } — how many positions were visited, and the bucket keys
// whose sheet was not in `types` (so their things' placements were not reachable). A
// READER may ignore it; a WRITER must not: a rename with a non-empty unknownSheets has not
// seen everything and should refuse rather than write half an answer.
export const eachId = (files, types, visit, fileSheets = FILE_SHEETS) => {
  const phonebook = new Map((types ?? []).filter(walkable).map(type => [type.id, type]))
  const unknown   = new Set()
  let ids = 0

  const value = (holder, key, path, kind, defining = false) => {
    const id = holder?.[key]
    if (typeof id !== "string") return
    ids += 1
    visit({ path, id, kind, defining, holder, key, isKey: false, set: (next) => { holder[key] = next } })
  }
  const key = (holder, id, path, kind) => {
    ids += 1
    visit({ path, id, kind, defining: false, holder, key: id, isKey: true, set: (next) => renameKey(holder, id, next) })
  }
  const sheet = (entries, holder, path) => {
    if (!Array.isArray(entries) || !isObject(holder)) return
    entries.forEach(entry => {
      const held = holder[entry.key]                                     // an attachment has no key, so this is undefined and the walk moves on
      if (held === undefined || held === null) return                    // absent, or a `default: null` that was never written
      const walker = WALKERS[entry.type]
      if (!walker) throw new Error(`No id walker for sheet type "${entry.type}" (key: ${entry.key})`)   // loud: the sheet grew a type this table does not know
      walker(holder, entry, `${path}.${entry.key}`, ctx)
    })
  }
  // an element of a named sheet: its own id first (canonical key order is id, then the
  // sheet's — newborn's order), then the sheet. A sheet MINTS names is a sheet whose
  // elements carry one; the rest are addressed by their key or by their holder's id.
  const element = (sheetName, holder, path) => {
    if (!isObject(holder)) return
    if (Object.hasOwn(MINTS, sheetName)) value(holder, "id", `${path}.id`, MINTS[sheetName], true)
    sheet(SHEETS[sheetName], holder, path)
  }
  // a thing: its id, then its WHOLE sheet — the core entries every thing shares plus the
  // ones its TYPE gives it (buildSheets' own two halves). That is what puts `demands` and
  // the list sections' `placements` in one walk instead of two hand-aimed ones. With no
  // type in the phonebook only the core half is reachable, and the bucket is named in the
  // answer rather than guessed at from the thing's shape.
  const thing = (sheetId, holder, path) => {
    if (!isObject(holder)) return
    value(holder, "id", `${path}.id`, MINTS.thing, true)
    const type = phonebook.get(sheetId)
    if (type === undefined) unknown.add(sheetId)
    sheet(type === undefined ? coreThingSchema : [...coreThingSchema, ...sheetOfType(type)], holder, path)
  }
  // which slot a demand names, resolved against the whole phonebook — the audit's own
  // rule (references.js): a demand is asked "does it point at ANYTHING?", never "can this
  // game answer it?", so the slot is looked for on every merged type and not on one sheet.
  const slotOf = (fieldId) => {
    if (typeof fieldId !== "string") return undefined
    for (const type of phonebook.values()) { const slot = demandFieldById(type, fieldId); if (slot !== undefined) return slot }
    return undefined
  }
  const ctx = { value, key, sheet, element, thing, slotOf }

  Object.entries(files ?? {}).forEach(([name, file]) => {
    if (file === null || file === undefined) return                      // a book's data files are optional on disk
    if (!Object.hasOwn(fileSheets, name)) throw new Error(`No file sheet for "${name}" — eachId was given a file its table does not name`)
    sheet(fileSheets[name], file, name)
  })
  return { ids, unknownSheets: [...unknown] }
}

// NEW: the same files with every id the map names replaced by what it names it. TOTAL and
// PURE — a NEW set comes back and the caller's own is never touched, which is the same
// promise mergeLayers makes with its structuredClone on the way in (oracle K1 deep-freezes
// on the strength of it).
//
// Built ON eachId and not beside it, which is the whole point: "where the ids are" is
// written once, so the rewriter cannot fall behind the reader that proves it complete.
// It walks the CLONE and lets each position replace itself, which is why an object KEY is
// rewritten in place by renameKey rather than by rebuilding a file — key order survives,
// and A→B→A comes home byte-identical.
//
// `map` is a Map or a plain object, and a plain object is read with Object.hasOwn for the
// reason ids always are: a map built from a file could carry "__proto__" or "toString",
// and a bare lookup would answer with Object.prototype's member instead of the caller's.
// A value that is not a string leaves the position alone.
//
// WHAT IT DOES NOT DO, said out loud: it does not check that the map is one-to-one. Two
// ids renamed onto one leaves one of them, and an id renamed onto one that is already
// there overwrites it. That check belongs where the map is BUILT — the mint that makes it
// is the one place that can say which name is free, and §3's rule is that a server-side
// bulk mint checks the whole shelf and refuses with a sentence rather than colliding.
export const rewriteIds = (files, types, map, fileSheets = FILE_SHEETS) => {
  const named = (id) => map instanceof Map ? map.get(id)
    : isObject(map) && Object.hasOwn(map, id) ? map[id] : undefined
  const next = structuredClone(files)
  eachId(next, types, ({ id, set }) => {
    const to = named(id)
    if (typeof to === "string" && to !== id) set(to)
  }, fileSheets)
  return next
}
