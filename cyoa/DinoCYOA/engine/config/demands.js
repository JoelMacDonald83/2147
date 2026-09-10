// NEW FILE: what an entry DEMANDS of the player, as vocabulary.
//
// This is the fifth sibling of query.js / visibility.js / sheet.js / references.js:
// one subject, its words, its checks, and ONE sentence per fault. Nothing here
// touches the DOM, fetches anything, or does work at import time, so node runs it in
// the oracles and the browser runs it in the game — one set of bytes, two runtimes.
//
// THE ONE SENTENCE THE WHOLE FILE SERVES:
//   a demand is a condition on the player's SHEET, carried by the thing that demands
//   it — and because the player's sheet IS a thing (sheet.js), the words for "a
//   condition on a thing" already exist. A demand is query.js's `where` — the same
//   three keys, `field, op, value`, in the same order — with the subject swapped.
//   An author who has built a row filter has already built a demand.
//
// Its place in the import graph, and this is the acyclic-graph rule sheet.js's header
// states, not tidiness:
//
//   schema.js ─┬─ query.js ──┐
//              ├─ sheet.js   ├── demands.js ── references.js ── validate.js ── kept.js
//              └─ visibility.js
//
// It imports schema.js and query.js, and NOTHING else. Nothing imports it back except
// references.js, gameConfig.js, state.js and view.js.
//
// WHAT IS DELIBERATELY NOT HERE: no shelf, no game, no merged world. `demandText`
// takes a `nameOf` function so this file never reaches for a shelf to turn a thing id
// into a name — the border hands in the merged world's answer, the editor hands in its
// own. The border principle: a leaf asks for what it needs and is given it.
import { fieldsOfType, listSectionsOf } from "./schema.js"
import { OPERATORS, operatorOf, readAs, WHERE_VALUE_TYPE } from "./query.js"

// NEW: a LIST section dressed as a demandable field. The one entry on a sheet whose
// value is not a value but a list of POINTERS — so it carries its `section`, which is
// what every reader below dispatches on. sheetOfType already makes exactly this shape
// for the card walkers (type: "placements"); this one carries the section's own ID too,
// because an id is what makes a slot addressable by a condition.
export const asDemandField = (section) =>
  ({ id: section.id, key: section.key, caption: section.caption, type: "placements", section })

// NEW: every slot a demand may name, in SHEET order — what the player TYPES, then what
// the player PICKED. NEVER the core three: `name` and `imageURL` are not game state, and
// `cost` on a sheet is `spent`, DERIVED FROM THE VERY PICKS BEING JUDGED. A demand on it
// would be the only circular condition in the language, and the settle loop would have to
// reason about arithmetic instead of membership. Excluding it is one line and it is why
// this file never needs a caption override table.
export const demandFields    = (type)     => [...fieldsOfType(type), ...listSectionsOf(type).map(asDemandField)]
// NEW: one demandable slot by its id, or undefined — the "does this slot still exist?"
// question every reader below starts with, exactly as query.js's fieldById does for a row.
export const demandFieldById = (type, id) => demandFields(type).find(field => field.id === id)

// NEW: the operators for a LIST section — the one kind `query.where` never had, because
// a shelf filter has no use for one. A list holds ENTRIES, so its questions are about
// MEMBERSHIP, not about a value. `valueless` is this table's twin of GATES' `names`: one
// prop the checker, the builder and the phrase-maker all read.
// It is a SEPARATE table and not a fifth row of OPERATORS on purpose: OPERATORS names the
// four fieldDef KINDS, an author picks one of those for a field they define, and an
// oracle pins that (oracles-logic.mjs:828). A section is not a field an author defines.
// Four and no more: holds/lacks are the pair every prerequisite needs, any/none are the
// two the brief's own prose names — and the kind is closed under negation, which is the
// whole reason a thing needs no second `excludes` key.
// QUANTITIES ARE INVISIBLE HERE, and it is said out loud because `quantityOf` is one
// import away: an entry is `{ thing, ...placement values }` and only `thing` is ever
// read. The day "three of these" is wanted it is a FIFTH operator taking a number, and
// nothing else moves.
export const PLACEMENT_OPERATORS = [
  { value: "holds", label: "holds",          test: (have, want) =>  have.some(entry => entry?.thing === want) },
  { value: "lacks", label: "does not hold",  test: (have, want) => !have.some(entry => entry?.thing === want) },
  { value: "any",   label: "holds anything", valueless: true, test: (have) => have.length > 0 },
  { value: "none",  label: "holds nothing",  valueless: true, test: (have) => have.length === 0 }
]
// one placement operator by its stored value, or undefined when the op does not belong
// to this table (a hand-edited file, or a slot that used to be a field)
export const placementOperatorOf = (op) => PLACEMENT_OPERATORS.find(operator => operator.value === op)

// NEW: which operators fit THIS slot — a section's four, or the field kind's own. That
// is query.js's table, BY IDENTITY, never a copy: one vocabulary, so a row filter and a
// demand can never drift apart. `field.section` is the dispatch, and it is the only one
// in this file.
export const demandOperators  = (field)     => field.section ? PLACEMENT_OPERATORS : OPERATORS[field.type]
export const demandOperatorOf = (field, op) => field.section ? placementOperatorOf(op) : operatorOf(field.type, op)

// NEW: every operator value a demand may carry — the validator's shape sentence lists
// these, so it is derived rather than typed out and can never fall behind a table.
// `lacks` is in BOTH tables and appears ONCE: the same meaning ("this is not in there"),
// a different subject. The Set is what makes that a fact instead of a duplicate, and an
// oracle asserts the overlap is deliberate so nobody "fixes" it. 13 values.
export const DEMAND_OPS = [...new Set([...Object.values(OPERATORS).flat().map(operator => operator.value),
                                       ...PLACEMENT_OPERATORS.map(operator => operator.value)])]

// READER ONE — THE ENGINE

// TOTAL, and every branch is a fail-closed one. A list section's value that is not an
// array reads as [] (a hand-edited file); a field's missing value reads as the FIELD's
// own default, through query.js's own border — so the engine, the editor's count and the
// player's blank sheet all read a missing Strength as the book's 10 (oracle L4's promise,
// one storey up).
const heldValue = (field, subject) => field.section
  ? (Array.isArray(subject[field.key]) ? subject[field.key] : [])
  : readAs(field, subject[field.key])

// NEW: does this ONE demand hold against this subject? Trusts a demand that passed
// checkDemand; TOTAL — always a boolean, never a throw, because the engine reads data a
// person may have hand-edited and a thrown error would take the whole page down.
// The `field` is handed IN, already resolved, because the callers below resolve it once
// and ask several questions with it.
export const meetsDemand = (demand, field, subject) => {
  if (field === undefined) return false                        // the slot is gone: fail closed
  const operator = demandOperatorOf(field, demand.op)
  if (operator === undefined) return false                     // the kind changed: fail closed
  return operator.test(heldValue(field, subject), demand.value)
}

// NEW: the FIRST failing demand, or null. First and not all, because ONE sentence is what
// a refusal, a button title and a status clause each want — and the card prints them all
// anyway, from the list itself. Author order is the order the author wrote them in, so the
// sentence a player sees is stable.
export const firstUnmet = (demands, type, subject) =>
  (demands ?? []).find(demand => !meetsDemand(demand, demandFieldById(type, demand.field), subject)) ?? null

// NEW: every condition on a thing, or [] — TOTAL, so no caller ever tests the key. A thing
// that demands nothing carries NO `demands` key (the file never holds a no-op), and this
// is the one function that knows it.
export const demandsOf = (thing) => Array.isArray(thing.demands) ? thing.demands : []

// READER TWO — THE CHECKS

// NEW: why can this demand not be JUDGED? null when it can. ONE sentence, three readers:
// the border warns with it, the validator reports it by path, the editor badges the card.
// checkWhere's exact discipline, and — where the question is the same — checkWhere's exact
// WORDS, so an author who has seen a broken row filter recognises a broken demand.
//   field      the RESOLVED slot (demandFieldById), or undefined
//   shelfIds   a Set of the ids on `field.section.of`'s shelf, or null to skip that question
// `field === undefined` is answered here as a floor so the function is TOTAL; both real
// callers answer it FIRST, in their own words, because they are asking two different
// questions — "does it point at anything?" (the audit) and "can THIS game judge it?"
// (the border).
export const checkDemand = (demand, field, shelfIds) => {
  if (field === undefined) return `names a field that does not exist (${demand.field})`
  const operator = demandOperatorOf(field, demand.op)
  if (!operator) return `operator "${demand.op}" does not fit a ${field.section ? "list" : field.type} field (${field.key})`
  if (operator.valueless)
    return demand.value === "" ? null : `operator "${operator.label}" takes no value (found ${JSON.stringify(demand.value)})`
  const want = field.section ? "string" : WHERE_VALUE_TYPE[field.type]
  if (typeof demand.value !== want) return `value ${JSON.stringify(demand.value)} is not a ${want} (${field.key})`
  if (field.section && shelfIds !== null && !shelfIds.has(demand.value))
    return `names a thing that is not on the ${field.caption} shelf (${demand.value})`
  return null
}

// READER THREE — THE WORDS

// NEW: the demand in words. ONE phrase-maker, FOUR frames — the player's card, place()'s
// refusal, the status clause and the kept sheet's note — so the shop's words and the
// sheet's words can never drift. `nameOf` is (thingId) => a name, handed IN so this file
// never reaches for a shelf: the border passes the merged world's answer, the editor its
// own. TOTAL: a slot that is gone reads as one sentence instead of throwing.
export const demandText = (demand, field, nameOf) => {
  if (field === undefined) return `an unknown demand (${demand.field})`
  const operator = demandOperatorOf(field, demand.op)
  if (operator === undefined) return `an unknown demand (${demand.field})`
  if (operator.valueless) return `${field.caption} ${operator.label}`
  return `${field.caption} ${operator.label} ${field.section ? nameOf(demand.value) : demand.value}`
}
