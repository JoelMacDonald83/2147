import { listSectionsOf } from "./schema.js"
import { checkWhere } from "./query.js"
import { checkShowWhen, idsBelow } from "./visibility.js"

// NEW: who points where, and the repairs. Every reference in the data runs
// ONE way: presentation → content. Rows point at type ids, field ids, thing
// ids and row ids; nothing points back at a row. So every dangling reference
// is found by one walk over content.groups, and every removal is repaired by
// one walk too. The editor runs the repairs on Remove; the restructure script
// runs them in a plan; the oracle proves they leave nothing dangling.
// CHANGED: things point too now. A thing's PLACEMENTS (its entries under a
// list section's key) name things on another sheet's shelf — the one pointer
// that runs content → content. So the audit has a second walk, over the
// things, and two more repairs — same shape, same promise.

// NEW: visit every row at every depth, this level first, then its children.
// CHANGED: the visitor also receives the row's PATH (content.groups[2].children[0]).
// The validator reports problems by path; every caller that wants only the row
// ignores the second argument.
export const eachRow = (rows, visit, path = "content.groups") =>
  rows.forEach((row, i) => { visit(row, `${path}[${i}]`); eachRow(row.children, visit, `${path}[${i}].children`) })
export const rowsIn  = (rows) => { const out = []; eachRow(rows, row => out.push(row)); return out }

// NEW: the four repairs. Each edits rows IN PLACE (the editor's collection
// builder holds the real arrays; a row's query/showWhen objects may be
// replaced — nobody holds those across a paint) and RETURNS what it changed
// as [{ row, what }] so the caller can say so by name. This is what keeps a
// saved file closed: an engine warning always means "hand-edited", never
// "the editor did this".
//
//   removed / changed     pointer                              repair
//   type                  row.query.type                       { type: "", where: null }   (forgetType)
//   type                  things in its bucket ← showWhen.thing forgetThing per thing, THEN the bucket goes
//   field (removed)       row.query.where.field                where = null                (forgetField)
//   field (kind changed)  row.query.where.field                where = null                (forgetField, via CHANGE_HOOKS)
//   field (key renamed)   —                                    nothing: the filter follows the id
//   thing                 row.showWhen.thing                   { kind: "always" }          (forgetThing)
//   row (+ subtree)       row.showWhen.row                     { kind: "always" }          (forgetRow per id in idsBelow)
//   NEW:
//   thing                 thing[<list key>][j].thing           the placement is spliced out (forgetPlaced)
//   list section's `of`   thing[<list key>]                    emptied — the old shelf's ids mean nothing on the new one (forgetSectionPlacements)
export const forgetType = (rows, typeId) => {        // rows showing the type → show nothing, no condition
  const changed = []
  eachRow(rows, row => {
    if (row.query.type === typeId) { row.query = { type: "", where: null }; changed.push({ row, what: "shows nothing now — its type was removed" }) }
  })
  return changed
}
export const forgetField = (rows, fieldId) => {      // conditions on the field → none
  const changed = []
  eachRow(rows, row => {
    if (row.query.where?.field === fieldId) { row.query.where = null; changed.push({ row, what: "lost its condition — the field it filtered on changed or was removed" }) }
  })
  return changed
}
export const forgetThing = (rows, thingId) => {      // gates on the thing → always
  const changed = []
  eachRow(rows, row => {
    if (row.showWhen.kind === "thingPicked" && row.showWhen.thing === thingId) { row.showWhen = { kind: "always" }; changed.push({ row, what: "is always shown now — the thing it waited for was removed" }) }
  })
  return changed
}
export const forgetRow = (rows, rowId) => {          // gates on the row → always
  const changed = []
  eachRow(rows, row => {
    if (row.showWhen.kind === "anyInRow" && row.showWhen.row === rowId) { row.showWhen = { kind: "always" }; changed.push({ row, what: "is always shown now — the row it waited for was removed" }) }
  })
  return changed
}

// NEW: every (list section, thing of its sheet) pair — the one walk the
// placement audit and both placement repairs share. `types` are the SHEETS
// (in the editor: the MERGED types, so a book's list section is seen too);
// `things` hold the buckets to walk (in the editor: the game's OWN things —
// a book's things are never edited). visit(section, thing, i, path) with the
// validator's path for the thing: things.things["basic:character"][0].
const eachPlacementHolder = (things, types, visit) =>
  types.forEach(type => listSectionsOf(type).forEach(section =>
    (things.things[type.id] ?? []).forEach((thing, i) => visit(section, thing, i, `things.things[${JSON.stringify(type.id)}][${i}]`))))
const nameOf = (things, thingId) => Object.values(things.things).flat().find(thing => thing.id === thingId)?.name ?? thingId

// NEW: two repairs, in place, returning [{ thing, what }] like the row repairs return [{ row, what }].
// A removed thing may be placed by others (a pet's Origin names a species): every
// placement naming it is spliced out of the real array. Reported once per
// holder-and-section that lost something, so the second run is a no-op.
export const forgetPlaced = (things, types, thingId) => {
  const name = nameOf(things, thingId)
  const changed = []
  eachPlacementHolder(things, types, (section, thing) => {
    const placed = thing[section.key]
    if (!Array.isArray(placed)) return
    const before = placed.length
    for (let j = placed.length - 1; j >= 0; j--) if (placed[j]?.thing === thingId) placed.splice(j, 1)
    if (placed.length < before) changed.push({ thing, what: `lost a placement — ${name} was removed` })
  })
  return changed
}
// A list section re-aimed at another shelf (`of` changed): every entry placed
// under it named a thing on the OLD shelf, so the arrays are emptied in place —
// nothing on the new shelf has those ids. Only a non-empty array is reported.
export const forgetSectionPlacements = (things, types, sectionId) => {
  const changed = []
  eachPlacementHolder(things, types, (section, thing) => {
    if (section.id !== sectionId) return
    const placed = thing[section.key]
    if (!Array.isArray(placed) || placed.length === 0) return
    placed.splice(0)
    changed.push({ thing, what: `lost its ${section.caption} placements — the section's shelf changed` })
  })
  return changed
}

// the same words validate.js uses for "found …" (kept in step by the oracles;
// references.js cannot import them — validate.js imports THIS file)
const describe = (v) =>
  v === undefined ? "absent" : v === null ? "null" : Array.isArray(v) ? "an array"
  : typeof v === "object" ? "an object" : typeof v === "string" ? JSON.stringify(v) : String(v)
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v)

// NEW: the placement audit. For every type, every list section, every thing of that type: the value
// under the section's key is absent, or an array of objects whose `thing` names a thing on the shelf
// of section.of. Entries are { thing, path, pointer, what } — pointer is the key path below the thing,
// so validate.js attaches the message to the exact key: things.things["basic:character"][0].origin[0].thing
// The SHAPE sentences live here too (not in a CHECKER): a thing is never sheet-walked
// by the validator, and whether the placed thing EXISTS needs the whole set anyway —
// one walk says everything there is to say about a placement. A thing on ANOTHER
// shelf counts as not existing: the section's `of` names the only shelf it may draw from.
const placementProblems = ({ types, things }) => {
  const found = []
  eachPlacementHolder(things, types.types, (section, thing, i, path) => {
    const placed = thing[section.key]
    if (placed === undefined) return                                                            // like a v4 thing older than a field: hydrates to []
    if (!Array.isArray(placed)) { found.push({ thing, path, pointer: section.key, what: `must be an array (found ${describe(placed)})` }); return }
    const shelf = new Set((things.things[section.of] ?? []).map(target => target.id))
    placed.forEach((placement, j) => {
      const pointer = `${section.key}[${j}]`
      if (!isPlainObject(placement)) { found.push({ thing, path, pointer, what: `must be an object (found ${describe(placement)})` }); return }
      if (typeof placement.thing !== "string" || placement.thing === "") { found.push({ thing, path, pointer: `${pointer}.thing`, what: `must be a non-empty string (found ${describe(placement.thing)})` }); return }
      if (!shelf.has(placement.thing)) found.push({ thing, path, pointer: `${pointer}.thing`, what: `places a thing that does not exist (${placement.thing})` })
    })
  })
  return found
}

// NEW: the audit. Every reference in content that points nowhere. Empty means
// the files are closed. The oracle proves the repairs above keep it empty;
// the rebuild script asserts it.
// Each entry is { row, path, pointer, what } — pointer is which of the row's
// three pointers dangles ("query.type" | "query.where" | "showWhen"), so
// validate.js can attach the message to the exact key. The editor's `say` and
// the rebuild script keep reading row and what.
// CHANGED: the audit returns row entries { row, path, pointer, what } as today AND thing entries
// { thing, path, pointer, what } from the placement walk. The editor's `say`
// reads entry.row?.label ?? entry.thing?.name.
export const danglingReferences = ({ content, types, things }) => {
  const rowIds   = new Set(rowsIn(content.groups).map(row => row.id))
  const thingIds = new Set(Object.values(things.things).flat().map(thing => thing.id))
  const found = []
  eachRow(content.groups, (row, path) => {
    const type = types.types.find(type => type.id === row.query.type)
    if (row.query.type !== "" && !type) found.push({ row, path, pointer: "query.type", what: `shows a type that does not exist (${row.query.type})` })
    if (type) { const problem = checkWhere(row.query.where, type); if (problem) found.push({ row, path, pointer: "query.where", what: `filter ${problem}` }) }
    const gate = checkShowWhen(row, rowIds, thingIds)
    if (gate) found.push({ row, path, pointer: "showWhen", what: `show-when ${gate}` })
  })
  return [...found, ...placementProblems({ types, things })]
}
