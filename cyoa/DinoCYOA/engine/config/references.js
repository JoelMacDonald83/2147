import { checkWhere } from "./query.js"
import { checkShowWhen, idsBelow } from "./visibility.js"

// NEW: who points where, and the repairs. Every reference in the data runs
// ONE way: presentation → content. Rows point at type ids, field ids, thing
// ids and row ids; nothing points back at a row. So every dangling reference
// is found by one walk over content.groups, and every removal is repaired by
// one walk too. The editor runs the repairs on Remove; the restructure script
// runs them in a plan; the oracle proves they leave nothing dangling.

// NEW: visit every row at every depth, this level first, then its children.
export const eachRow = (rows, visit) => rows.forEach(row => { visit(row); eachRow(row.children, visit) })
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

// NEW: the audit. Every reference in content that points nowhere, as
// [{ row, what }]. Empty means the files are closed. The oracle proves the
// four repairs above keep it empty; the restructure script asserts it.
export const danglingReferences = ({ content, types, things }) => {
  const rowIds   = new Set(rowsIn(content.groups).map(row => row.id))
  const thingIds = new Set(Object.values(things.things).flat().map(thing => thing.id))
  const found = []
  eachRow(content.groups, row => {
    const type = types.types.find(type => type.id === row.query.type)
    if (row.query.type !== "" && !type) found.push({ row, what: `shows a type that does not exist (${row.query.type})` })
    if (type) { const problem = checkWhere(row.query.where, type); if (problem) found.push({ row, what: `filter ${problem}` }) }
    const gate = checkShowWhen(row, rowIds, thingIds)
    if (gate) found.push({ row, what: `show-when ${gate}` })
  })
  return found
}
