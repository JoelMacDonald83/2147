import { listSectionsOf } from "./schema.js"
import { checkWhere } from "./query.js"
import { checkShowWhen, idsBelow } from "./visibility.js"
import { checkFills } from "./sheet.js"        // NEW: the row's fourth pointer asks its question there
import { demandFieldById, demandOperatorOf, checkDemand } from "./demands.js"   // NEW: the thing's own pointers — see the demand audit below

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
// CHANGED again: and a thing's DEMANDS point at two more — a slot on a sheet
// (demands[j].field) and, for a list section's operators, a thing on that
// section's shelf (demands[j].value). Third walk, two more repairs, same shape.
// THE ONE RULE THAT SPLITS THIS FILE FROM THE BORDER: "does it point at anything
// at all?" is a FAULT and lives here; "can THIS game judge it?" is a WARNING and
// an entry that is not offered, and lives in gameConfig.js. Conflating them would
// make a book unpinnable — the long version is on demandProblems below.

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
//   section (removed, kind flipped, `of` re-aimed)
//                         row.fills                            the key goes to ""          (forgetFills)
//   the TYPE that is the player's sheet
//                         content.sheet                        the key goes to ""          (forgetPlayerSheet)
//   NEW, the same idiom one more time — a thing's own demands:
//   field / section       thing.demands[j].field               the demand is spliced out (forgetDemandField)
//   thing                 thing.demands[j].value               the demand is spliced out (forgetDemanded)
//   content.sheet CHANGED thing.demands                        NOTHING — see forgetDemandField's last paragraph
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

// NEW: a row fills a section that is no longer fillable — the section was removed,
// turned into a fields section, or re-aimed at another shelf. Only the BINDING goes:
// the row keeps its query, its gate, its rules, its children and its place, because
// a row that lost where its picks LAND is still a perfectly good picker. Returns
// [{ row, what }] like every repair above, so the caller can name what it changed.
// Idempotent by construction: the second run finds no row still holding the id.
export const forgetFills = (rows, sectionId) => {
  const changed = []
  eachRow(rows, row => {
    if (row.fills === sectionId) { row.fills = ""; changed.push({ row, what: "fills nothing now — the section it filled changed or was removed" }) }
  })
  return changed
}

// NEW: the TYPE the player's sheet named is gone. The declaration goes. Note what
// this repair does NOT do: it does not walk the rows. Every row's binding names a
// SECTION of that type, and every one of those sections went with it, so the editor's
// remove hook runs forgetFills per section — one cause, one repair each, no repair
// reaching into another's rows. Returns [{ what }] with no `row` and no `thing`,
// because a game-wide declaration belongs to no row: the editor's `say` reads the
// noun it can find.
export const forgetPlayerSheet = (content, typeId) => {
  if ((content.sheet ?? "") !== typeId) return []
  content.sheet = ""
  return [{ what: `builds no sheet now — the type it named was removed` }]
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

// NEW: every thing that carries demands — the one walk both repairs below share.
// It reads NO types: a demand lives on the thing itself, not under a section's key,
// so unlike a placement it needs no section walker to find. A `demands` that is not
// an array is left alone: the CHECKER already said so, and a repair that guessed at
// a hand-edit's meaning would be inventing content.
const eachDemander = (things, visit) =>
  Object.values(things.things).flat().forEach(thing => { if (Array.isArray(thing.demands)) visit(thing, thing.demands) })

// NEW: the shared body of both repairs. SPLICE in place, and DELETE the key outright
// when the list empties, so "no empty demands array is ever written" is kept by the
// repair as well as by the editor. Reported ONCE per thing that lost something, so a
// second run — which finds nothing left to match — returns [] and changes nothing.
const forgetDemandsWhere = (things, doomed, what) => {
  const changed = []
  eachDemander(things, (thing, list) => {
    const before = list.length
    for (let j = list.length - 1; j >= 0; j--) if (doomed(list[j])) list.splice(j, 1)
    if (list.length === before) return
    if (list.length === 0) delete thing.demands
    changed.push({ thing, what })
  })
  return changed
}

// NEW: a FIELD or a SECTION left the merged world — removed, its kind changed, or a
// list section re-aimed at another shelf — so every demand asking about it goes.
// `fieldId` is a field's id OR a list section's id, because a demand may name either
// (demands.js's asDemandField gives a section the same shape a field has).
// SPLICE, never neutralise, and this is the difference from forgetField: a row's gate
// on a removed thing becomes `always` because a row with NO gate is a sensible row,
// but a demand on a removed slot has no sensible neutral value at all — "always true"
// would silently drop the author's rule and "always false" would kill the entry — so
// the honest repair is that the condition ceases to exist and the author is told.
// WHAT HAS NO REPAIR, deliberately: changing `content.sheet`. A demand is a fact about
// the ENTRY, true in every game that ships it, so a new sheet makes some entries
// unofferable (the border says so, once, by name) and repairs nothing. This is the one
// place `fills` and `demands` differ, and it is what "it travels in the book" means.
export const forgetDemandField = (things, fieldId) =>
  forgetDemandsWhere(things, demand => demand?.field === fieldId,
    `lost a demand — the slot it asked about changed or was removed`)

// NEW: a THING was removed, so every demand naming it goes. Only a list section's
// operators name a thing, and their value is that thing's id — which is why matching
// on the value alone is enough here, exactly as forgetPlaced matches on `.thing`.
// The name is read BEFORE the walk, because the caller removes the thing itself next.
export const forgetDemanded = (things, thingId) =>
  forgetDemandsWhere(things, demand => demand?.value === thingId,
    `lost a demand — ${nameOf(things, thingId)} was removed`)

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

// NEW: the demand audit. A third walk beside the row walk and the placement walk,
// producing the same { thing, path, pointer, what } shape, so crossChecks turns it
// into { path, message } with no change at all.
//
// IT ASKS ONE QUESTION, AND IT IS NOT THE BORDER'S:
//   does this demand POINT AT ANYTHING AT ALL, anywhere in the merged library?
// What is NOT a fault here: a demand THIS GAME'S SHEET cannot answer. A prerequisite
// travels in the book — "Fireball requires the Mage origin" is true wherever Fireball
// is — so a game that pins the book without the sheet that answers it has an entry it
// cannot sell, which the border says out loud once by name, and a file that is
// perfectly well-formed. Making that a fault would make the book UNPINNABLE: a game
// could never be saved while it pinned it, and the book could never be pinned without
// the other one. That is why the field is resolved against ANY merged type, not
// against content.sheet — and it is also what lets validateBook, which merges a book
// against no game at all, still judge every demand a book ships.
const demandProblems = ({ types, things }) => {
  const found = []
  const owners = types.types.filter(type => Array.isArray(type.sections))    // a shapeless type is the walk's problem, already reported
  Object.entries(things.things).forEach(([sheetId, bucket]) => bucket.forEach((thing, i) => {
    const path = `things.things[${JSON.stringify(sheetId)}][${i}]`
    const list = thing.demands
    if (list === undefined) return                                           // the honest spelling of "demands nothing"
    if (!Array.isArray(list)) return                                         // the CHECKER already said so
    list.forEach((demand, j) => {
      const pointer = `demands[${j}]`
      if (!isPlainObject(demand) || typeof demand.field !== "string") return  // the CHECKER already said so
      const owner = owners.find(type => demandFieldById(type, demand.field))
      if (!owner) { found.push({ thing, path, pointer: `${pointer}.field`, what: `demand names a field that does not exist (${demand.field})` }); return }
      const field = demandFieldById(owner, demand.field)
      const shelf = field.section ? new Set((things.things[field.section.of] ?? []).map(target => target.id)) : null
      const problem = checkDemand(demand, field, shelf)
      // WHICH KEY the sentence is about, so validate.js attaches it to the exact line.
      // Asked of the DEMAND, never of the message: the sentence is written once, in
      // demands.js, and reading it back would be a second contract to keep in step.
      // Once the slot resolves there are exactly two answers left — either the op does
      // not belong to this slot's table (`op`), or the op is fine and the value is the
      // intruder: wrong type, off-shelf, or present at all under `any` / `none`.
      if (problem) found.push({ thing, path, pointer: `${pointer}.${demandOperatorOf(field, demand.op) === undefined ? "op" : "value"}`, what: `demand ${problem}` })
    })
  }))
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
// CHANGED again: and ONE entry that has neither — { path: "content", pointer: "sheet" },
// the game's own declaration, which belongs to no row and no thing. crossChecks turns
// all three into { path, message } the same way; only the editor needs the third noun.
// CHANGED once more: `mode` — "game" (a real game on top) or "book" (validateBook, judging
// one book against the books it requires). ONE question turns on it and it is the row's
// fourth pointer: `fills` names a section of the sheet THE GAME declares, and a book
// declares none — it proposes rows and the game decides where their picks land. Asking it
// in book mode meant every bound proposal came back "fills a section but this game builds
// no sheet" with no game in sight, so a book could not propose a binding at all, which is
// exactly what `games/dino`'s four rowOverrides exist to work around. Now the question is
// asked only where it can be answered: in validateGame, against the game's own sheet,
// which already happens and does not change. The mode is PASSED, never inferred — a
// bookless game legitimately carries no `sheet` key (default:"" AND optional:true), so
// "has it a sheet?" would judge a game to be a book and fail OPEN.
export const danglingReferences = ({ content, types, things }, mode = "game") => {
  const rowIds   = new Set(rowsIn(content.groups).map(row => row.id))
  const thingIds = new Set(Object.values(things.things).flat().map(thing => thing.id))
  // NEW: the game's declared sheet — the one reference that is not a row's. "" is the
  // honest "this game builds no sheet"; anything else must name a type in the merged
  // library. When it DANGLES, every bound row would otherwise report too — one cause,
  // five sentences — so the row walk skips its `fills` question and this single
  // sentence stands alone. That is checkFile's own rule ("an old file has dozens of
  // consequent problems; the version line is the one that matters"), applied here.
  const sheetId      = content.sheet ?? ""
  const sheetType    = types.types.find(type => type.id === sheetId)
  const sheetDangles = sheetId !== "" && sheetType === undefined
  const found = []
  eachRow(content.groups, (row, path) => {
    const type = types.types.find(type => type.id === row.query.type)
    if (row.query.type !== "" && !type) found.push({ row, path, pointer: "query.type", what: `shows a type that does not exist (${row.query.type})` })
    if (type) { const problem = checkWhere(row.query.where, type); if (problem) found.push({ row, path, pointer: "query.where", what: `filter ${problem}` }) }
    const gate = checkShowWhen(row, rowIds, thingIds)
    if (gate) found.push({ row, path, pointer: "showWhen", what: `show-when ${gate}` })
    // NEW: the row's fourth pointer. checkFills is asked about the RAW row — `fills`
    // is still an ID here, which is the only shape it ever has on disk — and it says
    // the same bytes the engine warns with and the editor badges. `sheetType` is
    // undefined when the game declares no sheet, which is exactly the argument
    // checkFills wants for "fills a section but this game builds no sheet".
    // CHANGED: …and only when somebody has DECLARED a sheet to fill — see the mode note
    // on this function. In book mode there is no declaration to judge against and the
    // binding travels to whatever game pins the book.
    if (mode === "game" && !sheetDangles) {
      const fills = checkFills(row, sheetType)
      if (fills) found.push({ row, path, pointer: "fills", what: fills })
    }
  })
  // the one cause, said first: the sheet line comes before the rows it invalidates
  if (sheetDangles) found.unshift({ path: "content", pointer: "sheet", what: `builds a sheet that does not exist (${sheetId})` })
  // CHANGED: and the third walk — a thing's own demands. Last, because a row's
  // faults are the coarser ones and the report reads top-down.
  return [...found, ...placementProblems({ types, things }), ...demandProblems({ types, things })]
}
