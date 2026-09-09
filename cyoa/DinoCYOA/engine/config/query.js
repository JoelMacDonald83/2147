import { fieldDefault, fieldById } from "./schema.js"

// NEW: the row's question, answered. A row's query is { type, where }; this
// file is everything about `where` — the one optional condition — that both
// sides need: the engine to filter the bucket, the editor to build the
// condition from dropdowns and count what it matches. DOM-free, fetch-free,
// no work at import time, so node runs it too (tools/oracles-logic.mjs).

// NEW: the operator vocabulary per field kind. value = what where.op stores,
// label = what the editor's dropdown says, test = what the engine runs.
// One table, two readers — the FIELD_BUILDERS / DISPLAY_BUILDERS split again.
// The first operator of each list is the editor's default for that kind.
// CHANGED: a choice compares like text — it IS a string, one of a list — so
// choice shares text's two operator objects (the same array, not a copy: the
// oracle pins OPERATORS.choice === OPERATORS.text). Key order = the fieldDef
// kinds' order (text, number, lines, choice); V1 pins the four tables as one list.
const TEXT_OPERATORS = [
  { value: "is",    label: "is",     test: (have, want) => have === want },
  { value: "isNot", label: "is not", test: (have, want) => have !== want }
]
export const OPERATORS = {
  text: TEXT_OPERATORS,
  number: [
    { value: "eq",  label: "=", test: (have, want) => have === want },
    { value: "ne",  label: "≠", test: (have, want) => have !== want },
    { value: "lt",  label: "<", test: (have, want) => have <  want },
    { value: "lte", label: "≤", test: (have, want) => have <= want },
    { value: "gt",  label: ">", test: (have, want) => have >  want },
    { value: "gte", label: "≥", test: (have, want) => have >= want }
  ],
  lines: [
    { value: "has",   label: "has the line",   test: (have, want) => have.includes(want) },
    { value: "lacks", label: "lacks the line", test: (have, want) => !have.includes(want) }
  ],
  choice: TEXT_OPERATORS   // CHANGED: + choice
}
// one operator row by kind and stored value, or undefined when the op does
// not belong to that kind (a hand-edited file, or a field whose kind changed)
export const operatorOf = (kind, op) => OPERATORS[kind]?.find(operator => operator.value === op)

// NEW: the JSON type where.value must have for each kind (the border checks it).
// A lines condition names ONE line, so its value is a string, not an array.
export const WHERE_VALUE_TYPE = { text: "string", number: "number", lines: "string", choice: "string" }   // CHANGED: + choice

// NEW: the value a newborn condition gets when the bucket offers none to pick
// from. NOT FIELD_DEFAULTS: that table says what a THING holds (lines → []),
// this one says what a CONDITION compares against (lines → one line, "").
// Every entry passes checkWhere for its kind — the oracle proves it.
export const WHERE_VALUE_DEFAULT = { text: "", number: 0, lines: "", choice: "" }   // CHANGED: + choice

// NEW: a thing's value AS ITS KIND. A thing older than the field has none, and
// a field whose kind was changed may hold the old kind's shape (a string
// under a lines key). Either reads as the FIELD's default — the same rule the
// editor's lines builder and the game's lines display already use. The
// shared [] is only ever read, never pushed to.
// CHANGED: readAs takes the FIELD, not the kind. A default lives on the field
// now (Stats' Strength is 10 when a pet says nothing), so "what does a missing
// value read as?" needs the field: fieldDefault(field) — the very function the
// engine hydrates with. The engine shows a missing Strength as 10 and the
// editor's raw filter counts it as 10, by construction (oracle L4). A choice's
// shape is a string; which string is the author's business, not the border's.
const SHAPE_OK = { text: v => typeof v === "string", number: v => typeof v === "number", lines: v => Array.isArray(v), choice: v => typeof v === "string" }
export const readAs = (field, value) => SHAPE_OK[field.type](value) ? value : fieldDefault(field)

// NEW: why can this condition not be run? null when it can. ONE message per
// fault, used by the engine (warn + show nothing) and by the editor (a badge).
export const checkWhere = (where, type) => {
  if (where === null) return null
  const field = fieldById(type, where.field)
  if (!field) return `names a field that does not exist (${where.field})`
  if (!operatorOf(field.type, where.op)) return `operator "${where.op}" does not fit a ${field.type} field (${field.key})`
  if (typeof where.value !== WHERE_VALUE_TYPE[field.type]) return `value ${JSON.stringify(where.value)} is not a ${WHERE_VALUE_TYPE[field.type]} (${field.key})`
  return null
}

// trusts a where that passed checkWhere; total — always a boolean
export const matchesWhere = (where, type, thing) => {
  if (where === null) return true
  const field = fieldById(type, where.field)
  return operatorOf(field.type, where.op).test(readAs(field, thing[field.key]), where.value)
}

// the row's answer: the SAME array object back when there is no condition (a
// no-op is visibly a no-op), a filtered copy otherwise, bucket order kept.
// Works on raw things (editor) and hydrated things (engine) alike, because
// readAs fills the same default hydration fills — so the editor's count is
// the game's count, by construction (oracle L4).
export const filterThings = (things, type, where) =>
  where === null ? things : things.filter(thing => matchesWhere(where, type, thing))

// NEW: the distinct values a field takes across a bucket — the editor's value
// dropdown. lines are flattened to individual lines. Numbers ascend, strings
// sort by localeCompare. (A choice's dropdown is its OPTIONS, not the bucket —
// the editor's valuesFor picks; this stays the bucket's truth for every kind.)
export const valuesOf = (things, field) => {
  const read = things.map(thing => readAs(field, thing[field.key]))
  const distinct = [...new Set(field.type === "lines" ? read.flat() : read)]
  return field.type === "number" ? distinct.sort((a, b) => a - b) : distinct.sort((a, b) => a.localeCompare(b))
}
