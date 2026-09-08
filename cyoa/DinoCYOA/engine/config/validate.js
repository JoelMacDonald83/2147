import { SCHEMA_VERSION, SHEETS, FILE_SHEETS, coreThingSchema } from "./schema.js"
import { OPERATORS, WHERE_VALUE_TYPE } from "./query.js"
import { GATES } from "./visibility.js"
import { danglingReferences } from "./references.js"

// NEW: the border's contract, read from the sheet. The game trusts the files it
// loads and the editor trusts the files it saves; THIS is where a file is
// checked against what the sheet says — one sentence per fault, with the path.
// DOM-free, fetch-free, no work at import time: node runs it (the server, the
// oracles, the export) and the browser runs it (the editor's pre-flight).

export const FILE_NAMES = Object.keys(FILE_SHEETS)
export const problemText = ({ path, message }) => `${path}: ${message}`

const ALL_OPS      = Object.values(OPERATORS).flat().map(op => op.value)                       // every operator of every kind
const VALUE_TYPES  = [...new Set(Object.values(WHERE_VALUE_TYPE))]                              // ["string", "number"]
const AUTHOR_KINDS = Object.keys(GATES).filter(kind => !GATES[kind].borderOnly)                 // never is the border's own
const RESERVED_THING_KEYS = ["id", ...coreThingSchema.map(entry => entry.key)]                  // id, name, cost, imageURL
const NOUN = { string: "a string", number: "a number", array: "an array", object: "an object" }

const isPlainObject  = (v) => v !== null && typeof v === "object" && !Array.isArray(v)
const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v)   // JSON never carries Infinity; the editor's memory can (Number("1e400"))
const describe = (v) =>
  v === undefined ? "absent" : v === null ? "null" : Array.isArray(v) ? "an array"
  : typeof v === "object" ? "an object" : typeof v === "string" ? JSON.stringify(v) : String(v)
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
    if (entry.options && !entry.options.some(option => option.value === v))              // optionsFrom = editor data, not checkable here
      problem(out, path, `${JSON.stringify(v)} is not one of ${entry.options.map(option => option.value).join(", ")}`)
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
  buckets:        (entry, v, path, out, ctx) => {
    if (!expectType(out, v, path, "object")) return
    Object.entries(v).forEach(([typeId, bucket]) => {
      const bucketPath = path + quoteKey(typeId)
      if (expectType(out, bucket, bucketPath, "array")) bucket.forEach((thing, i) => checkThing(thing, `${bucketPath}[${i}]`, out, ctx))
    })
  }
}
export const CHECKED_TYPES = Object.keys(CHECKERS)

// one sheet-shaped object: every entry through its checker, then every own key
// the sheet (or extraKeys: "version" on a file top, "id" on an element) does not name
const checkSheet = (sheet, holder, path, out, ctx, extraKeys) => {
  if (!expectType(out, holder, path, "object")) return
  const known = new Set(extraKeys)
  sheet.forEach(entry => {
    if (entry.key === undefined) return                                                      // attachment
    known.add(entry.key)
    const checker = CHECKERS[entry.type]
    if (!checker) throw new Error(`No checker for sheet type "${entry.type}" (key: ${entry.key})`)   // loud: the sheet grew a type this table does not know
    checker(entry, holder[entry.key], `${path}.${entry.key}`, out, ctx)
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
const checkThing = (thing, path, out, ctx) => {
  if (!expectType(out, thing, path, "object")) return
  coreThingSchema.forEach(entry => CHECKERS[entry.type](entry, thing[entry.key], `${path}.${entry.key}`, out, ctx))
  checkId("thing", thing, path, out, ctx)
}

// { type, where }: type a string; where null, or { field, op, value } with op
// any kind's operator and value a string or a number. WHICH kind fits is a
// reference question (crossChecks): the type lives in another file.
const checkQuery = (query, path, out) => {
  if (!expectType(out, query, path, "object")) return
  expectType(out, query.type, `${path}.type`, "string")
  const where = query.where
  if (where === null) { /* no condition */ }
  else if (!isPlainObject(where)) problem(out, `${path}.where`, `must be null or an object (found ${describe(where)})`)
  else {
    expectType(out, where.field, `${path}.where.field`, "string")
    if (expectType(out, where.op, `${path}.where.op`, "string") && !ALL_OPS.includes(where.op))
      problem(out, `${path}.where.op`, `${JSON.stringify(where.op)} is not an operator (${ALL_OPS.join(", ")})`)
    if (!(VALUE_TYPES.includes(typeof where.value) && (typeof where.value === "string" || isFiniteNumber(where.value))))
      problem(out, `${path}.where.value`, `must be ${VALUE_TYPES.map(type => `a ${type}`).join(" or ")} (found ${describe(where.value)})`)
    Object.keys(where).forEach(key => { if (!["field", "op", "value"].includes(key)) problem(out, at(`${path}.where`, key), `unexpected key ${JSON.stringify(key)}`) })
  }
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

// RULES: the few sentences a sheet cannot say, per element sheet, run after the walk.
const RULES = {
  type: (type, path, out) => {                                                               // dinoEdit/state.js warnDuplicateKeys, made binding
    if (!Array.isArray(type.fields)) return                                                  // already reported by the walk
    const seen = new Map()
    type.fields.forEach((field, i) => {
      if (!isPlainObject(field) || typeof field.key !== "string") return                     // already reported
      const keyPath = `${path}.fields[${i}].key`
      if (RESERVED_THING_KEYS.includes(field.key)) problem(out, keyPath, `${JSON.stringify(field.key)} is a key every thing already has (${RESERVED_THING_KEYS.join(", ")})`)
      else if (seen.has(field.key)) problem(out, keyPath, `duplicate key ${JSON.stringify(field.key)} — also at ${seen.get(field.key)}`)
      else seen.set(field.key, `${path}.fields[${i}]`)
    })
  },
  fieldDef: (field, path, out) => { if (field.key === "") problem(out, `${path}.key`, `must be a non-empty string (found "")`) }
}

export const validateFile = (name, file) => {
  const sheet = FILE_SHEETS[name]
  if (!sheet) throw new Error(`No such data file: ${name}`)
  const out = []
  if (!expectType(out, file, name, "object")) return out
  // an old file has dozens of consequent shape problems; the version line is the one that matters
  if (file.version !== SCHEMA_VERSION) return [{ path: `${name}.version`, message: `must be ${SCHEMA_VERSION} (found ${describe(file.version)}) — open the game in the editor and Save to migrate it` }]
  checkSheet(sheet, file, name, out, { ids: {} }, ["version"])
  return out
}

// the reference half: exactly references.js's audit, attached to the pointer that dangles
export const crossChecks = (set) =>
  danglingReferences(set).map(({ path, pointer, what }) => ({ path: `${path}.${pointer}`, message: what }))

export const validateSet = (set) => {
  const out = FILE_NAMES.flatMap(name => set[name] === null || set[name] === undefined
    ? [{ path: name, message: "missing" }]
    : validateFile(name, set[name]))
  return out.length > 0 ? out : crossChecks(set)                                             // cross checks assume shapes
}
