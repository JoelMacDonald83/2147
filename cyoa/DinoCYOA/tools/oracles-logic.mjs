// The v4 LOGIC oracles — the fast half, runnable from anywhere with plain node:
//
//   node cyoa/DinoCYOA/tools/oracles-logic.mjs
//
// Pure: imports engine/config/{schema,migrations,query,visibility,references,
// validate}.js straight from the working tree, builds every fixture in memory,
// touches no git, no temp dir, no child process — it runs in milliseconds.
// oracles.mjs imports this file first, so the full run always starts here.
// Every check is a node:assert; the first one that fails throws, node prints
// it, and the process exits non-zero.
//
//   L1  operator truth table        L8  one-pass fixpoint (settle needs no loop)
//   L2  readAs                      L9  monotone, deterministic, order-blind
//   L3  checkWhere messages         L10 checkShowWhen messages
//   L4  editor count = engine list  L11 deadRows
//   L5  valuesOf                    L12 migration border (stamp, canonical row)
//   L6  computeVisible basics       L13 repairs keep the files closed
//   L7  cycle and self-gate
// NEW: the validator (engine/config/validate.js — the sheet's third reader)
//   V1  tables agree                V5  per-file suppresses cross; total; pure
//   V2  the healthy set fits        V6  paths resolve
//   V3  the breakage table          V7  problem format
//   V4  leftovers are not problems

import assert from 'node:assert/strict'
import { FIELD_DEFAULTS, sheetOfType, SCHEMA_VERSION, FILE_SHEETS, SHEETS, fieldDefSchema, coreThingSchema, metaSchema, pageThemeSchema, totalBudgetSchema, contentSchema, typesSchema } from '../engine/config/schema.js'
import { migrateSet } from '../engine/config/migrations.js'
import { OPERATORS, operatorOf, WHERE_VALUE_TYPE, WHERE_VALUE_DEFAULT, readAs, checkWhere, matchesWhere, filterThings, valuesOf } from '../engine/config/query.js'
import { GATES, SHOW_WHEN_KINDS, idsBelow, computeVisible, dropHidden, checkShowWhen, deadRows } from '../engine/config/visibility.js'
import { eachRow, rowsIn, forgetType, forgetField, forgetThing, forgetRow, danglingReferences } from '../engine/config/references.js'
import { validateFile, validateSet, crossChecks, problemText, FILE_NAMES, CHECKED_TYPES } from '../engine/config/validate.js'

assert.equal(SCHEMA_VERSION, 4, 'these oracles describe schema version 4')

let checks = 0
const ok = (label) => { checks += 1; console.log(`  ok  ${label}`) }

// ───────────────────────── fixtures ─────────────────────────
// Ids are readable on purpose: a failing assertion should name "B", not a uuid.
const ids = (set) => [...set].sort().join(',')          // a Set as a comparable string

// a row with the canonical five keys; the query is "shows nothing" unless given
const row = (id, showWhen = { kind: 'always' }, children = [], query = { type: '', where: null }) =>
  ({ id, label: `row ${id}`, query, showWhen, children })
const pick = (thingId) => ({ id: thingId, name: thingId, cost: 1 })

// the L4 type: a field of every kind, `rating` added AFTER the first things
// were born (so raw things may lack it — exactly what hydration fills)
const FIELD_LABEL  = 'f-label'
const FIELD_TRAITS = 'f-traits'
const FIELD_RATING = 'f-rating'
const dinoType = {
  id: 'type-dino',
  label: 'Dino',
  fields: [
    { id: FIELD_LABEL,  key: 'label',  caption: 'Label',  type: 'text' },
    { id: FIELD_TRAITS, key: 'traits', caption: 'Traits', type: 'lines' },
    { id: FIELD_RATING, key: 'rating', caption: 'Rating', type: 'number' }
  ]
}
const rawDinos = [
  { id: 't-tali',  name: 'Tali',  cost: 1, imageURL: 'dino.jpg', label: 'A biggie dino!', traits: ['stompies', 'peanut butter'] },
  { id: 't-miku',  name: 'Miku',  cost: 2, imageURL: '',         label: '',               traits: ['rides', 'water'], rating: 5 },
  { id: 't-king',  name: 'King',  cost: 3, imageURL: 'trex.jpg', label: 'Gayer',          traits: 'not a list',       rating: 0 },
  { id: 't-egg',   name: 'Egg',   cost: 0, imageURL: '' }
]
// what gameConfig.js does to a bucket: defaults for missing fields, /assets/ prefix
const hydrate = (things, type) => {
  const sheet = sheetOfType(type)
  return things.map(thing => ({
    ...thing,
    ...Object.fromEntries(sheet.map(entry => [entry.key, thing[entry.key] ?? entry.hydrateDefault])),
    imageURL: thing.imageURL ? `/assets/${thing.imageURL}` : ''
  }))
}
const fieldOfKind = { text: FIELD_LABEL, lines: FIELD_TRAITS, number: FIELD_RATING }

// ───────────────────────── L1 operator truth table ─────────────────────────
{
  const cases = {
    text:   { is:  ['a', 'a', 'b'], isNot: ['a', 'b', 'a'] },
    number: { eq:  [2, 2, 3], ne: [2, 3, 2], lt: [1, 2, 1], lte: [2, 2, 1], gt: [3, 2, 3], gte: [2, 2, 3] },
    lines:  { has: [['x', 'y'], 'x', 'z'], lacks: [['x', 'y'], 'z', 'x'] }
  }
  Object.entries(OPERATORS).forEach(([kind, operators]) => {
    operators.forEach(({ value, test }) => {
      const [have, matching, missing] = cases[kind][value]
      assert.equal(test(have, matching), true,  `${kind}.${value}: a matching value`)
      assert.equal(test(have, missing),  false, `${kind}.${value}: a non-matching value`)
      assert.equal(operatorOf(kind, value).test, test, 'operatorOf finds the same row')
    })
    assert.equal(operators.length, Object.keys(cases[kind]).length, `every ${kind} operator is in the table`)
  })
  assert.equal(OPERATORS.text[0].value, 'is')
  assert.equal(OPERATORS.number[0].value, 'eq')
  assert.equal(OPERATORS.lines[0].value, 'has')
  assert.equal(operatorOf('text', 'eq'), undefined, 'an op of another kind is not found')
  assert.equal(operatorOf('colour', 'is'), undefined, 'an unknown kind is not found')
  ok('L1 operator truth table: every (kind, op) matches and misses; defaults are is/eq/has')
}

// ───────────────────────── L2 readAs ─────────────────────────
{
  assert.equal(readAs('text', undefined), '')
  assert.equal(readAs('number', undefined), 0)
  assert.equal(readAs('lines', undefined), FIELD_DEFAULTS.lines)
  assert.deepEqual(readAs('lines', 'not a list'), [], 'a string under a lines key reads as no lines')
  assert.equal(readAs('text', 7), '', 'a number under a text key reads as blank')
  assert.equal(readAs('number', '7'), 0, 'a string under a number key reads as 0')
  const lines = ['a']
  assert.equal(readAs('lines', lines), lines, 'the right shape comes back as the same value')
  assert.equal(readAs('text', 'hi'), 'hi')
  assert.equal(readAs('number', 3), 3)
  ok('L2 readAs: missing or wrong-shaped → the kind default; right shape → same value')
}

// ───────────────────────── L3 checkWhere ─────────────────────────
{
  assert.equal(checkWhere(null, dinoType), null)
  assert.match(checkWhere({ field: 'nope', op: 'is', value: '' }, dinoType), /does not exist \(nope\)/)
  assert.match(checkWhere({ field: FIELD_LABEL, op: 'eq', value: '' }, dinoType), /operator "eq" does not fit a text field \(label\)/)
  assert.match(checkWhere({ field: FIELD_RATING, op: 'eq', value: '2' }, dinoType), /value "2" is not a number \(rating\)/)
  assert.match(checkWhere({ field: FIELD_TRAITS, op: 'has', value: [] }, dinoType), /value \[\] is not a string \(traits\)/)
  assert.equal(checkWhere({ field: 'core:cost', op: 'lte', value: 2 }, dinoType), null, 'core fields are queryable')
  assert.equal(checkWhere({ field: 'core:name', op: 'is', value: 'Tali' }, dinoType), null)
  // E1: a newborn condition's fallback value must pass the check for every kind
  Object.keys(OPERATORS).forEach(kind => {
    assert.equal(typeof WHERE_VALUE_DEFAULT[kind], WHERE_VALUE_TYPE[kind], `WHERE_VALUE_DEFAULT.${kind} has the kind's JSON type`)
    assert.equal(checkWhere({ field: fieldOfKind[kind], op: OPERATORS[kind][0].value, value: WHERE_VALUE_DEFAULT[kind] }, dinoType), null, `a newborn ${kind} condition is valid`)
  })
  ok('L3 checkWhere: null passes; dangling field, wrong-kind op, wrong-typed value each get their message; newborn defaults pass')
}

// ───────────────────────── L4 editor count = engine list ─────────────────────────
{
  const hydrated = hydrate(rawDinos, dinoType)
  const namesOf = (things) => things.map(thing => thing.id)
  const both = (where) => {
    assert.equal(checkWhere(where, dinoType), null)
    const raw = filterThings(rawDinos, dinoType, where)
    const hyd = filterThings(hydrated, dinoType, where)
    assert.deepEqual(namesOf(raw), namesOf(hyd), `raw and hydrated agree on ${JSON.stringify(where)}`)
    return namesOf(raw)
  }
  assert.deepEqual(both({ field: FIELD_LABEL, op: 'is', value: '' }), ['t-miku', 't-egg'], 'blank label: written blank + missing label')
  assert.deepEqual(both({ field: FIELD_TRAITS, op: 'lacks', value: 'rides' }), ['t-tali', 't-king', 't-egg'], 'lacks: a string-valued lines field lacks everything')
  assert.deepEqual(both({ field: FIELD_TRAITS, op: 'has', value: 'water' }), ['t-miku'])
  assert.deepEqual(both({ field: FIELD_RATING, op: 'eq', value: 0 }), ['t-tali', 't-king', 't-egg'], 'eq 0: missing rating reads as 0')
  assert.deepEqual(both({ field: 'core:cost', op: 'lte', value: 2 }), ['t-tali', 't-miku', 't-egg'], 'core:cost lte 2')
  assert.deepEqual(both({ field: 'core:name', op: 'isNot', value: 'Egg' }), ['t-tali', 't-miku', 't-king'])
  assert.equal(filterThings(rawDinos, dinoType, null), rawDinos, 'no condition → the same array object')
  assert.equal(filterThings(hydrated, dinoType, null), hydrated)
  assert.equal(matchesWhere(null, dinoType, rawDinos[0]), true)
  ok('L4 editor count = engine list: raw and hydrated filter to the same ids, bucket order kept, core:cost works')
}

// ───────────────────────── L5 valuesOf ─────────────────────────
{
  assert.deepEqual(valuesOf(rawDinos, dinoType.fields[2]), [0, 5], 'numbers: distinct, ascending, missing → 0')
  assert.deepEqual(valuesOf(rawDinos, dinoType.fields[0]), ['', 'A biggie dino!', 'Gayer'], 'strings: distinct, localeCompare')
  assert.deepEqual(valuesOf(rawDinos, dinoType.fields[1]), ['peanut butter', 'rides', 'stompies', 'water'], 'lines: flattened, a string-valued field contributes nothing')
  assert.deepEqual(valuesOf([{ rating: 10 }, { rating: 9 }, { rating: 10 }], dinoType.fields[2]), [9, 10])
  assert.deepEqual(valuesOf([], dinoType.fields[0]), [])
  ok('L5 valuesOf: distinct; numbers ascend; strings localeCompare; lines flattened')
}

// ───────────────────────── L6 computeVisible basics ─────────────────────────
{
  const rows = [
    row('A'),
    row('B', { kind: 'thingPicked', thing: 'x' }),
    row('C', { kind: 'anyInRow', row: 'A' }),
    row('H', { kind: 'thingPicked', thing: 'never-offered' }, [row('K')]),
    row('G', { kind: 'anyInRow', row: 'H' }),
    row('U', { kind: 'someday' }),
    row('T', { kind: 'toString' })                       // a kind named like an Object.prototype member
  ]
  assert.equal(ids(computeVisible(rows, {})), 'A', 'only always is visible with no picks (and no throw on a missing key)')
  assert.equal(ids(computeVisible(rows, { A: [pick('x')] })), 'A,B,C', 'one pick in A flips both thingPicked x and anyInRow A')
  assert.equal(ids(computeVisible(rows, { A: [pick('y')] })), 'A,C', 'a different thing flips only anyInRow')
  assert.equal(ids(computeVisible(rows, { H: [pick('x')] })), 'A', 'a pick in a hidden row counts for nothing: not B, not G, not K')
  assert.equal(ids(computeVisible(rows, { U: [pick('x')] })), 'A', 'an unknown kind is never — and its pick does not count either')
  assert.equal(ids(computeVisible(rows, { T: [pick('x')] })), 'A', 'a kind named "toString" is unknown too: never, no throw')
  assert.equal(ids(computeVisible([row('K', { kind: 'constructor' })], {})), '', 'and so is "constructor"')
  assert.equal(GATES.never.borderOnly, true)
  assert.deepEqual(SHOW_WHEN_KINDS.map(kind => kind.value), ['always', 'thingPicked', 'anyInRow'], 'the dropdown skips never')
  assert.deepEqual(idsBelow(rows[3]), ['H', 'K'])
  ok('L6 computeVisible: always / thingPicked / anyInRow; hidden parent hides always-children; hidden picks and unknown kinds (even "toString") count for nothing')
}

// ───────────────────────── L7 cycle and self ─────────────────────────
{
  const cycle = [row('A', { kind: 'anyInRow', row: 'B' }), row('B', { kind: 'anyInRow', row: 'A' })]
  assert.equal(ids(computeVisible(cycle, {})), '', 'a cycle is hidden from empty picks')
  assert.equal(ids(computeVisible(cycle, { A: [pick('x')], B: [pick('y')] })), '', 'a cycle stays hidden even with picks planted in both')
  const self = [row('S', { kind: 'anyInRow', row: 'S' })]
  assert.equal(ids(computeVisible(self, { S: [pick('x')] })), '', 'a self-gate is hidden')
  const nested = [row('P', { kind: 'anyInRow', row: 'Q' }, [row('Q')])]
  assert.equal(ids(computeVisible(nested, { Q: [pick('x')] })), '', 'a gate on a descendant can never open')
  ok('L7 cycle and self-gate: hidden with and without picks, and the call returns')
}

// ───────────────────────── L8 one-pass fixpoint ─────────────────────────
{
  const chain = [row('A'), row('B', { kind: 'anyInRow', row: 'A' }), row('C', { kind: 'anyInRow', row: 'B' })]
  const full = { A: [pick('a')], B: [pick('b')], C: [pick('c')] }
  assert.equal(ids(computeVisible(chain, full)), 'A,B,C')
  const unpicked = { ...full, A: [] }
  const visible = computeVisible(chain, unpicked)
  assert.equal(ids(visible), 'A', 'unpick A: B and C go together in ONE compute')
  const dropped = dropHidden(unpicked, visible)
  assert.deepEqual(Object.keys(dropped), ['A', 'B', 'C'], 'same keys, same order')
  assert.equal(dropped.A, unpicked.A, 'a visible row keeps its array identity')
  assert.deepEqual(dropped.B, [])
  assert.deepEqual(dropped.C, [])
  assert.notEqual(dropped, unpicked, 'a new object')

  // the settle() claim: one compute + one drop IS the fixpoint, on every fixture
  const fixtures = [
    [chain, full], [chain, unpicked],
    [[row('A', { kind: 'anyInRow', row: 'B' }), row('B', { kind: 'anyInRow', row: 'A' })], { A: [pick('x')], B: [pick('y')] }],
    [[row('P', { kind: 'thingPicked', thing: 'k' }, [row('Q', { kind: 'anyInRow', row: 'P' })]), row('R')], { P: [pick('z')], Q: [pick('q')], R: [pick('k')] }],
    [[row('P', { kind: 'thingPicked', thing: 'k' }, [row('Q', { kind: 'anyInRow', row: 'P' })]), row('R')], { P: [pick('z')], Q: [pick('q')], R: [] }]
  ]
  fixtures.forEach(([rows, selections], index) => {
    const vis = computeVisible(rows, selections)
    assert.equal(ids(computeVisible(rows, dropHidden(selections, vis))), ids(vis), `fixture ${index}: dropping hidden picks changes nothing`)
  })
  ok('L8 one-pass fixpoint: a chain closes in one compute; dropHidden keeps keys, order and identity; compute∘drop = compute')
}

// ───────────────────────── L9 monotone, deterministic, order-blind ─────────────────────────
{
  // a small deterministic PRNG so a failure here replays exactly
  let seed = 20260907
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const choose = (list) => list[Math.floor(random() * list.length)]

  const tree = () => [
    row('A'),
    row('B', { kind: 'thingPicked', thing: 'lava' }, [
      row('B1', { kind: 'anyInRow', row: 'B' }),
      row('B2', { kind: 'thingPicked', thing: 'rim' }, [row('B2a')])
    ]),
    row('C', { kind: 'anyInRow', row: 'B1' }),
    row('D', { kind: 'thingPicked', thing: 'ghost' }),
    row('E', { kind: 'anyInRow', row: 'F' }),
    row('F', { kind: 'anyInRow', row: 'E' }, [row('F1')])
  ]
  const rows = tree()
  const rowIds = rowsIn(rows).map(r => r.id)
  const things = ['lava', 'rim', 'pebble', 'moss']
  const selections = Object.fromEntries(rowIds.map(id => [id, []]))
  let before = computeVisible(rows, selections)
  for (let step = 0; step < 200; step += 1) {
    const target = choose(rowIds)
    selections[target] = [...selections[target], pick(choose(things))]   // an ADDITION, somewhere (hidden rows included)
    const after = computeVisible(rows, selections)
    before.forEach(id => assert.ok(after.has(id), `step ${step}: ${id} stayed visible`))
    assert.equal(ids(computeVisible(rows, structuredClone(selections))), ids(after), `step ${step}: equal input, equal output`)
    before = after
  }
  assert.equal(ids(before), 'A,B,B1,B2,B2a,C', 'after 200 additions everything reachable is open; the cycle and the ghost are not')
  const shuffled = [...tree()].reverse()
  assert.equal(ids(computeVisible(shuffled, selections)), ids(before), 'top-level order does not change the answer')
  ok('L9 monotone over 200 pick additions; deterministic; top-level order does not matter')
}

// ───────────────────────── L10 checkShowWhen ─────────────────────────
{
  const rowIds = new Set(['A', 'P', 'Q', 'Q1'])
  const thingIds = new Set(['x'])
  const parent = row('P', { kind: 'always' }, [row('Q', { kind: 'anyInRow', row: 'P' }, [row('Q1')])])
  assert.match(checkShowWhen(row('A', { kind: 'thingPicked', thing: 'gone' }), rowIds, thingIds), /names a thing that does not exist \(gone\)/)
  assert.match(checkShowWhen(row('A', { kind: 'anyInRow', row: 'gone' }), rowIds, thingIds), /names a row that does not exist \(gone\)/)
  assert.match(checkShowWhen(row('A', { kind: 'anyInRow', row: 'A' }), rowIds, thingIds), /waits for itself/)
  assert.match(checkShowWhen(row('P', { kind: 'anyInRow', row: 'Q1' }, parent.children), rowIds, thingIds), /waits for itself \(or a row nested inside it\)/)
  assert.match(checkShowWhen(row('A', { kind: 'someday' }), rowIds, thingIds), /unknown kind "someday"/)
  assert.match(checkShowWhen(row('A', { kind: 'never' }), rowIds, thingIds), /unknown kind "never"/, 'never is border-only: a file may not hold it')
  assert.match(checkShowWhen(row('A', { kind: 'toString' }), rowIds, thingIds), /unknown kind "toString"/, 'an inherited Object.prototype name is not a kind')
  assert.match(checkShowWhen(row('A', { kind: 'constructor' }), rowIds, thingIds), /unknown kind "constructor"/)
  assert.equal(checkShowWhen(parent.children[0], rowIds, thingIds), null, 'a gate on an ancestor is fine')
  assert.equal(checkShowWhen(row('A', { kind: 'thingPicked', thing: 'x' }), rowIds, thingIds), null)
  assert.equal(checkShowWhen(row('A'), rowIds, thingIds), null)
  ok('L10 checkShowWhen: dangling thing/row, self, descendant, unknown kind (even "toString") → messages; ancestor gate → null')
}

// ───────────────────────── L11 deadRows ─────────────────────────
{
  const rows = [
    row('A'),
    row('B', { kind: 'anyInRow', row: 'A' }),
    row('C', { kind: 'thingPicked', thing: 'lava' }),
    row('X', { kind: 'anyInRow', row: 'Y' }),
    row('Y', { kind: 'anyInRow', row: 'X' }),
    row('S', { kind: 'anyInRow', row: 'S' }),
    row('G', { kind: 'thingPicked', thing: 'ghost' }),
    row('E'),                                          // offers nothing
    row('N', { kind: 'anyInRow', row: 'E' }),
    row('D', { kind: 'thingPicked', thing: 'ghost' }, [row('D1')]),
    row('U', { kind: 'someday' }),
    row('V', { kind: 'constructor' })                    // an Object.prototype name is not a kind either
  ]
  const offered = { A: ['lava', 'rim'], B: ['moss'], C: ['moss'], X: ['moss'], Y: ['moss'], S: ['moss'], E: [], D1: ['lava'] }
  assert.equal(ids(deadRows(rows, offered)), 'D,D1,G,N,S,U,V,X,Y')
  assert.equal(ids(deadRows([row('Z', { kind: 'thingPicked', thing: 'lava' }, [row('Z1')]), ...rows.slice(0, 1)], offered)), '', 'a thing offered by an always row opens its gate')
  ok('L11 deadRows: cycle, self, ghost thing, empty row, child of dead, unknown kind → dead; ordinary rows live')
}

// ───────────────────────── L12 migration border ─────────────────────────
{
  const v3 = {
    content: { version: 3, meta: { pageTitle: 'T', heroTitle: 'H' }, groups: [
      { children: [{ displayType: 'type-2', label: 'inner', id: 'r2', children: [] }], displayType: 'type-1', label: 'outer', id: 'r1' },
      { id: 'r3', label: 'none', displayType: '', children: [] }
    ] },
    rules:  { version: 3, totalBudget: 10, groupRules: { r1: { min: 1 } } },
    themes: { version: 3, page: {}, groupThemes: {} },
    types:  { version: 3, types: [{ id: 'type-1', label: 'One', fields: [] }, { id: 'type-2', label: 'Two', fields: [] }] },
    things: { version: 3, things: { 'type-1': [], 'type-2': [] } }
  }
  assert.throws(() => migrateSet({ ...v3, types: null, things: null }), /Missing data files for version 4: types, things/, 'stamp keeps a null a null')
  const frozen = structuredClone(v3)
  const freeze = (value) => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) } return value }
  freeze(frozen)
  const out = migrateSet(frozen)
  ;['content', 'rules', 'themes', 'types', 'things'].forEach(name => assert.equal(out[name].version, 4, `${name} stamped 4`))
  assert.deepEqual(Object.keys(out.content), ['version', 'meta', 'groups'])
  const checkRow = (migrated, original) => {
    assert.deepEqual(Object.keys(migrated), ['id', 'label', 'query', 'showWhen', 'children'], `row ${migrated.id} has the five keys in order`)
    assert.deepEqual(migrated.query, { type: original.displayType, where: null })
    assert.deepEqual(Object.keys(migrated.query), ['type', 'where'])
    assert.equal(migrated.query.where, null)
    assert.deepEqual(migrated.showWhen, { kind: 'always' })
    migrated.children.forEach((child, index) => checkRow(child, original.children[index]))
  }
  out.content.groups.forEach((group, index) => checkRow(group, v3.content.groups[index]))
  assert.equal(JSON.stringify(migrateSet(frozen)), JSON.stringify(out), 'migrating twice is byte-identical: nothing minted')
  assert.equal(migrateSet(out), out, 'a v4 set passes the border as the same object')
  assert.deepEqual(danglingReferences(out), [], 'a migrated set is closed')
  ok('L12 migration border: missing files named; canonical row shape; where null; showWhen always; byte-identical twice')
}

// ───────────────────────── L13 repairs ─────────────────────────
{
  const build = () => {
    const rows = [
      row('R1', { kind: 'always' }, [
        row('R1a', { kind: 'anyInRow', row: 'R1' }, [], { type: 'type-dino', where: { field: FIELD_LABEL, op: 'is', value: 'Gayer' } })
      ], { type: 'type-dino', where: null }),
      row('R2', { kind: 'thingPicked', thing: 't-tali' }, [], { type: 'type-lair', where: { field: 'core:cost', op: 'gte', value: 1 } }),
      row('R3', { kind: 'anyInRow', row: 'R1a' }, [], { type: 'type-lair', where: null }),
      row('R4', { kind: 'thingPicked', thing: 't-lava' }, [], { type: '', where: null })
    ]
    return {
      content: { version: 4, meta: {}, groups: rows },
      // fresh copies: a removal below splices a type's fields and a bucket, and the next build must not see it
      types:   { version: 4, types: [structuredClone(dinoType), { id: 'type-lair', label: 'Lair', fields: [] }] },
      things:  { version: 4, things: { 'type-dino': structuredClone(rawDinos), 'type-lair': [{ id: 't-lava', name: 'Lava Pit', cost: 3, imageURL: '' }] } }
    }
  }
  const touched = (changed) => changed.map(({ row }) => row.id).join(',')
  // every array a collection builder could be holding: the top list and each children list
  const arraysOf = (rows) => [rows, ...rowsIn(rows).map(r => r.children)]
  // one repair, run the way the editor runs it: the fixture starts closed, the
  // repair names exactly the rows it touched, edits only in place, is a no-op
  // the second time, and once the element itself is gone nothing dangles
  const repair = (label, run, remove, expectTouched, expectWhat) => {
    const set = build()
    assert.deepEqual(danglingReferences(set), [], `${label}: the fixture starts closed`)
    const before = arraysOf(set.content.groups)
    const changed = run(set)
    assert.equal(touched(changed), expectTouched, `${label}: exactly the affected rows`)
    changed.forEach(({ what }) => assert.match(what, expectWhat))
    arraysOf(set.content.groups).forEach((list, index) => assert.equal(list, before[index], `${label}: arrays edited in place`))
    assert.deepEqual(run(set), [], `${label}: a second run finds nothing`)
    remove(set)
    assert.deepEqual(danglingReferences(set), [], `${label}: closed after the removal`)
    return set
  }

  const afterType = repair('forgetType',
    (set) => forgetType(set.content.groups, 'type-dino'),
    (set) => {                                                       // REMOVE_HOOKS.type, in its order
      set.things.things['type-dino'].forEach(thing => forgetThing(set.content.groups, thing.id))
      delete set.things.things['type-dino']
      set.types.types.splice(0, 1)
    },
    'R1,R1a', /shows nothing now/)
  rowsIn(afterType.content.groups).slice(0, 2).forEach(r => assert.deepEqual(r.query, { type: '', where: null }))
  assert.deepEqual(rowsIn(afterType.content.groups)[2].showWhen, { kind: 'always' }, 'R2 waited for a dino; the hook forgot it before the bucket went')

  repair('forgetField',
    (set) => forgetField(set.content.groups, FIELD_LABEL),
    (set) => set.types.types[0].fields.splice(0, 1),
    'R1a', /lost its condition/)

  repair('forgetThing',
    (set) => forgetThing(set.content.groups, 't-lava'),
    (set) => set.things.things['type-lair'].splice(0, 1),
    'R4', /always shown now — the thing/)

  const afterRow = repair('forgetRow (a subtree)',
    (set) => idsBelow(set.content.groups[0]).flatMap(id => forgetRow(set.content.groups, id)),   // REMOVE_HOOKS.group
    (set) => set.content.groups.splice(0, 1),
    'R1a,R3', /always shown now — the row/)
  assert.equal(touched(rowsIn(afterRow.content.groups).map(row => ({ row }))), 'R2,R3,R4')

  // the audit on a hand-broken set: every fault named once, by row
  const broken = build()
  broken.content.groups.push(
    row('X1', { kind: 'always' }, [], { type: 'type-gone', where: null }),
    row('X2', { kind: 'always' }, [], { type: 'type-dino', where: { field: 'f-gone', op: 'is', value: '' } }),
    row('X3', { kind: 'always' }, [], { type: 'type-dino', where: { field: FIELD_LABEL, op: 'eq', value: '' } }),
    row('X4', { kind: 'always' }, [], { type: 'type-dino', where: { field: FIELD_RATING, op: 'eq', value: '2' } }),
    row('X5', { kind: 'thingPicked', thing: 't-gone' }),
    row('X6', { kind: 'anyInRow', row: 'r-gone' }),
    row('X7', { kind: 'anyInRow', row: 'X7' }),
    row('X8', { kind: 'someday' }),
    row('X9', { kind: 'anyInRow', row: 'r-gone' }, [], { type: 'type-gone', where: null })   // two faults on one row
  )
  const found = danglingReferences(broken)
  const expected = [
    ['X1', /^shows a type that does not exist \(type-gone\)$/],
    ['X2', /^filter names a field that does not exist \(f-gone\)$/],
    ['X3', /^filter operator "eq" does not fit a text field \(label\)$/],
    ['X4', /^filter value "2" is not a number \(rating\)$/],
    ['X5', /^show-when names a thing that does not exist \(t-gone\)$/],
    ['X6', /^show-when names a row that does not exist \(r-gone\)$/],
    ['X7', /^show-when waits for itself/],
    ['X8', /^show-when has an unknown kind "someday"$/],
    ['X9', /^shows a type that does not exist/],
    ['X9', /^show-when names a row that does not exist/]
  ]
  assert.equal(found.length, expected.length, 'one entry per fault, none for the healthy rows')
  expected.forEach(([id, pattern], index) => {
    assert.equal(found[index].row.id, id, `fault ${index} is on ${id}`)
    assert.match(found[index].what, pattern)
  })
  let visits = 0
  eachRow(broken.content.groups, () => { visits += 1 })
  assert.equal(visits, rowsIn(broken.content.groups).length)
  ok('L13 repairs: forgetType/Field/Thing/Row edit in place, name exactly the affected rows, and leave nothing dangling; the audit names every fault once')
}

// ═════════════════════════ the validator: V1–V7 ═════════════════════════
// NEW: validate.js is the sheet's THIRD reader — the editor's builders say how
// a kind is edited, the game's displays say how it is shown, CHECKERS say how
// it is checked. These seven checks pin the reader to the other two (its
// tables must name every type the sheets use), pin every message and path in
// the catalogue by regex (the server, the editor and the export all show
// them), and pin what it must NOT refuse (the editor's own leftovers, D1/D2).

// Fixture H: a COMPLETE healthy set. L13's build() has meta: {} and no
// rules/themes — closed for the audit, but not a clean set for the validator.
// rawDinos is deliberately untidy (t-king's traits is a string, t-egg lacks
// every author field): H is clean UNDER D2, by design.
const H = () => ({
  content: { version: 4, meta: { pageTitle: 'T', heroTitle: 'H' }, groups: [
    row('R1', { kind: 'always' }, [ row('R1a', { kind: 'anyInRow', row: 'R1' }, [], { type: 'type-dino', where: { field: FIELD_LABEL, op: 'is', value: 'Gayer' } }) ], { type: 'type-dino', where: null }),
    row('R2', { kind: 'thingPicked', thing: 't-tali' }, [], { type: 'type-lair', where: { field: 'core:cost', op: 'gte', value: 1 } }),
    row('R3', { kind: 'anyInRow', row: 'R1a' }, [], { type: 'type-lair', where: null }),
    row('R4', { kind: 'thingPicked', thing: 't-lava' }, [], { type: '', where: null })
  ] },
  rules:  { version: 4, totalBudget: 10, groupRules: { R1: { min: 1, max: 1 }, R2: {}, R3: { max: 2 } } },
  themes: { version: 4, page: { bodyBackground: '#fff', fontFamily: 'serif', heroImage: '', statusBackground: '#000', statusColor: '#fff' }, groupThemes: { R1: { background: 'red' }, R2: {} } },
  types:  { version: 4, types: [structuredClone(dinoType), { id: 'type-lair', label: 'Lair', fields: [] }] },
  things: { version: 4, things: { 'type-dino': structuredClone(rawDinos), 'type-lair': [{ id: 't-lava', name: 'Lava Pit', cost: 3, imageURL: '' }] } }
})
const deepFreeze = (value) => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze) }
  return value
}
// every problem V3 produces, kept for V7's format check
const everyProblem = []

// ───────────────────────── V1 tables agree ─────────────────────────
{
  // (a) every sheet-entry type anywhere has a checker — the sheet cannot grow a type the border does not know
  const everySheet = [...Object.values(SHEETS), ...Object.values(FILE_SHEETS), coreThingSchema]
  const usedTypes = new Set([...everySheet.flatMap(sheet => sheet.map(entry => entry.type)), ...Object.keys(FIELD_DEFAULTS)])
  usedTypes.forEach(type => assert.ok(CHECKED_TYPES.includes(type), `CHECKERS has no checker for sheet type "${type}"`))
  // (b) the four kind tables are one list
  const kinds = fieldDefSchema.find(entry => entry.key === 'type').options.map(option => option.value)
  assert.deepEqual(Object.keys(FIELD_DEFAULTS), kinds, 'FIELD_DEFAULTS names the fieldDef kinds')
  assert.deepEqual(Object.keys(OPERATORS), kinds, 'OPERATORS names the fieldDef kinds')
  assert.deepEqual(Object.keys(WHERE_VALUE_TYPE), kinds, 'WHERE_VALUE_TYPE names the fieldDef kinds')
  // (c) the five files, in report order — and each file top is built from the
  // NAMED sheets, not from copies that could drift away from what the editor draws
  assert.deepEqual(Object.keys(FILE_SHEETS), FILE_NAMES)
  assert.deepEqual(FILE_NAMES, ['content', 'rules', 'themes', 'types', 'things'])
  assert.equal(SHEETS.meta, metaSchema); assert.equal(SHEETS.pageTheme, pageThemeSchema)
  assert.deepEqual(FILE_SHEETS.content.slice(1), contentSchema); assert.deepEqual(FILE_SHEETS.rules.slice(0, totalBudgetSchema.length), totalBudgetSchema)
  assert.equal(FILE_SHEETS.types, typesSchema)
  // (d) every `of` resolves
  everySheet.flat().filter(entry => entry.of !== undefined).forEach(entry => assert.ok(Object.hasOwn(SHEETS, entry.of), `SHEETS has no sheet named "${entry.of}"`))
  // (e) attachments and cabinets are the two sides of one drawer, one to one
  const attachments = Object.values(SHEETS).flat().filter(entry => entry.type === 'attachment')
  const cabinets = Object.entries(FILE_SHEETS).flatMap(([file, sheet]) => sheet.filter(entry => entry.type === 'cabinet').map(entry => ({ file, ...entry })))
  assert.ok(attachments.length > 0 && cabinets.length > 0)
  attachments.forEach(a => assert.equal(cabinets.filter(c => c.file === a.file && c.key === a.cabinet && c.of === a.of).length, 1, `attachment ${a.file}.${a.cabinet} has one cabinet`))
  cabinets.forEach(c => assert.equal(attachments.filter(a => a.file === c.file && a.cabinet === c.key && a.of === c.of).length, 1, `cabinet ${c.file}.${c.key} has one attachment`))
  // (f) every author gate but always names its id key; always and never name nothing
  Object.entries(GATES).forEach(([kind, gate]) => {
    if (kind === 'always' || gate.borderOnly) assert.equal(gate.names, undefined, `${kind} names nothing`)
    else assert.equal(typeof gate.names, 'string', `${kind} names its id key`)
  })
  // (g) a newborn condition of every kind passes the file-level value check
  Object.keys(OPERATORS).forEach(kind => {
    const set = H()
    set.content.groups[0].children[0].query.where = { field: fieldOfKind[kind], op: OPERATORS[kind][0].value, value: WHERE_VALUE_DEFAULT[kind] }
    assert.deepEqual(validateFile('content', set.content), [], `a newborn ${kind} condition fits the file`)
  })
  ok(`V1 tables agree: ${usedTypes.size} sheet types all checked; kinds = ${kinds.join('/')} in four tables; ${cabinets.length} cabinets ↔ attachments; gates name their key; newborn conditions fit`)
}

// ───────────────────────── V2 the healthy set fits ─────────────────────────
{
  assert.deepEqual(validateSet(H()), [])
  FILE_NAMES.forEach(name => assert.deepEqual(validateFile(name, H()[name]), [], `${name} alone is clean`))
  assert.deepEqual(crossChecks(H()), [])
  ok('V2 the healthy set fits: validateSet, every validateFile and crossChecks all say []')
}

// ───────────────────────── V3 the breakage table ─────────────────────────
{
  // [label, mutate, expectedPaths, regexes] — the catalogue of §1.3, one row
  // per situation. G = content.groups; a path is asserted EXACTLY and in order.
  const G = 'content.groups'
  const kindRow = (kind) => [`13 showWhen kind ${JSON.stringify(kind)}`, s => { s.content.groups[0].showWhen = { kind } }, [`${G}[0].showWhen.kind`], [new RegExp(`${JSON.stringify(kind)} is not a show-when kind \\(always, thingPicked, anyInRow\\)`)]]
  const fieldKindRow = (type) => [`40 field kind ${JSON.stringify(type)}`, s => { s.types.types[0].fields[0].type = type }, ['types.types[0].fields[0].type'], [new RegExp(`${JSON.stringify(type)} is not one of text, number, lines`)]]
  const table = [
    ['1 old version, no walk',     s => { s.content.version = 3; delete s.content.meta },                    ['content.version'],                 [/must be 4 \(found 3\) — open the game in the editor and Save/]],
    ['2 version as a string',      s => { s.rules.version = '4' },                                          ['rules.version'],                   [/found "4"/]],
    ['3 showWhen absent',          s => { delete s.content.groups[1].showWhen },                            [`${G}[1].showWhen`],                [/must be an object \(found absent\)/]],
    ['4 totalBudget a string',     s => { s.rules.totalBudget = '10' },                                     ['rules.totalBudget'],               [/must be a number \(found "10"\)/]],
    ['5 totalBudget Infinity',     s => { s.rules.totalBudget = Infinity },                                 ['rules.totalBudget'],               [/found Infinity/]],
    ['6 unknown operator',         s => { s.content.groups[1].query.where.op = 'equals' },                  [`${G}[1].query.where.op`],          [/"equals" is not an operator \(is, isNot, eq, ne, lt, lte, gt, gte, has, lacks\)/]],
    ['7 boolean value',            s => { s.content.groups[1].query.where.value = true },                   [`${G}[1].query.where.value`],       [/must be a string or a number \(found true\)/]],
    ['8 Infinity value',           s => { s.content.groups[1].query.where.value = Infinity },               [`${G}[1].query.where.value`],       [/found Infinity/]],
    ['9 where a string',           s => { s.content.groups[1].query.where = 'x' },                          [`${G}[1].query.where`],             [/must be null or an object \(found "x"\)/]],
    ['10 stray key in where',      s => { s.content.groups[1].query.where.extra = 1 },                      [`${G}[1].query.where.extra`],       [/unexpected key "extra"/]],
    ['11 query.type a number',     s => { s.content.groups[0].query.type = 5 },                             [`${G}[0].query.type`],              [/must be a string \(found 5\)/]],
    ['12 stray key in query',      s => { s.content.groups[0].query.extra = 1 },                            [`${G}[0].query.extra`],             [/unexpected key "extra"/]],
    kindRow('toString'), kindRow('constructor'), kindRow('never'), kindRow('sometimes'),
    ['14 kind a number',           s => { s.content.groups[0].showWhen = { kind: 7 } },                     [`${G}[0].showWhen.kind`],           [/must be a string \(found 7\)/]],
    ['15 thingPicked without thing', s => { s.content.groups[1].showWhen = { kind: 'thingPicked' } },       [`${G}[1].showWhen.thing`],          [/must be a string \(found absent\)/]],
    ['16 always with a thing',     s => { s.content.groups[0].showWhen = { kind: 'always', thing: 'x' } },  [`${G}[0].showWhen.thing`],          [/unexpected key "thing"/]],
    ['17 cross: thing gone',       s => { s.content.groups[1].showWhen.thing = 't-gone' },                  [`${G}[1].showWhen`],                [/^show-when names a thing that does not exist \(t-gone\)$/]],
    ['18 cross: type gone',        s => { s.content.groups[0].query.type = 'type-gone' },                   [`${G}[0].query.type`],              [/^shows a type that does not exist \(type-gone\)$/]],
    ['19 cross: field gone',       s => { s.content.groups[0].children[0].query.where.field = 'f-gone' },   [`${G}[0].children[0].query.where`], [/^filter names a field that does not exist \(f-gone\)$/]],
    ['20 cross: op of another kind', s => { s.content.groups[0].children[0].query.where.op = 'eq' },        [`${G}[0].children[0].query.where`], [/^filter operator "eq" does not fit a text field \(label\)$/]],
    ['21 cross: row gone',         s => { s.content.groups[2].showWhen.row = 'r-gone' },                    [`${G}[2].showWhen`],                [/^show-when names a row that does not exist \(r-gone\)$/]],
    ['22 cross: waits for itself', s => { s.content.groups[2].showWhen.row = 'R3' },                        [`${G}[2].showWhen`],                [/^show-when waits for itself/]],
    ['23 cross: two on one row',   s => { s.content.groups[3].query.type = 'type-gone'; s.content.groups[3].showWhen = { kind: 'anyInRow', row: 'r-gone' } },
                                                                                                            [`${G}[3].query.type`, `${G}[3].showWhen`], [/^shows a type that does not exist/, /^show-when names a row that does not exist/]],
    ['24 duplicate row id (D6)',   s => { s.content.groups[0].children[0].id = 'R2' },                      [`${G}[1].id`],                      [/duplicate id "R2" — also at content\.groups\[0\]\.children\[0\]/]],
    ['25 v3 leftover key',         s => { s.content.groups[0].displayType = 'x' },                          [`${G}[0].displayType`],             [/unexpected key "displayType"/]],
    ['26 children null',           s => { s.content.groups[0].children = null },                            [`${G}[0].children`],                [/must be an array \(found null\)/]],
    ['27 groups an object',        s => { s.content.groups = {} },                                          ['content.groups'],                  [/must be an array \(found an object\)/]],
    ['28 meta an array',           s => { s.content.meta = [] },                                            ['content.meta'],                    [/must be an object \(found an array\)/]],
    ['29 meta key absent',         s => { delete s.content.meta.heroTitle },                                ['content.meta.heroTitle'],          [/found absent/]],
    ['30 the typo hand-edit',      s => { s.rules.totalbudget = 12 },                                       ['rules.totalbudget'],               [/unexpected key "totalbudget"/]],
    ['31 min empty string',        s => { s.rules.groupRules.R1.min = '' },                                 ['rules.groupRules["R1"].min'],      [/must be a number or absent \(found ""\)/]],
    ['32 min null',                s => { s.rules.groupRules.R1.min = null },                               ['rules.groupRules["R1"].min'],      [/found null/]],
    ['33 typo in a slot',          s => { s.rules.groupRules.R1.mni = 1 },                                  ['rules.groupRules["R1"].mni'],      [/unexpected key "mni"/]],
    ['34 slot a number',           s => { s.rules.groupRules.R1 = 3 },                                      ['rules.groupRules["R1"]'],          [/must be an object \(found 3\)/]],
    ['35 cabinet an array',        s => { s.rules.groupRules = [] },                                        ['rules.groupRules'],                [/must be an object \(found an array\)/]],
    ['36 page: absent + typo',     s => { delete s.themes.page.statusColor; s.themes.page.fontFamly = 'x' }, ['themes.page.statusColor', 'themes.page.fontFamly'], [/found absent/, /unexpected key "fontFamly"/]],
    ['37 background null',         s => { s.themes.groupThemes.R1.background = null },                      ['themes.groupThemes["R1"].background'], [/must be a string or absent \(found null\)/]],
    ['38 duplicate field key',     s => { s.types.types[0].fields.push({ id: 'f-dup', key: 'label', caption: 'D', type: 'text' }) }, ['types.types[0].fields[3].key'], [/duplicate key "label" — also at types\.types\[0\]\.fields\[0\]/]],
    ['39 reserved field key',      s => { s.types.types[0].fields.push({ id: 'f-n', key: 'name', caption: 'N', type: 'text' }) },    ['types.types[0].fields[3].key'], [/"name" is a key every thing already has \(id, name, cost, imageURL\)/]],
    fieldKindRow('date'), fieldKindRow('constructor'),
    ['41 empty field key',         s => { s.types.types[0].fields[0].key = '' },                            ['types.types[0].fields[0].key'],    [/must be a non-empty string \(found ""\)/]],
    ['42 duplicate type id',       s => { s.types.types[1].id = 'type-dino' },                              ['types.types[1].id'],               [/duplicate id "type-dino" — also at types\.types\[0\]/]],
    // an id is a KEY in the interior (things.things[type.id], selections[row.id]): a name every object inherits is refused
    ['42b prototype-named type id', s => { s.types.types[1].id = 'constructor' },                            ['types.types[1].id'],               [/"constructor" cannot be an id \(it is a name every object already has\)/]],
    ['42c __proto__ as a thing id', s => { s.things.things['type-lair'][0].id = '__proto__' },              ['things.things["type-lair"][0].id'], [/"__proto__" cannot be an id/]],
    ['43 fields a string',         s => { s.types.types[0].fields = 'x' },                                  ['types.types[0].fields'],           [/must be an array \(found "x"\)/]],
    ['44 bucket an object',        s => { s.things.things['type-dino'] = {} },                              ['things.things["type-dino"]'],      [/must be an array \(found an object\)/]],
    ['45 things an array',         s => { s.things.things = [] },                                           ['things.things'],                   [/must be an object \(found an array\)/]],
    ['46 cost a string',           s => { s.things.things['type-dino'][0].cost = '1' },                     ['things.things["type-dino"][0].cost'], [/must be a number \(found "1"\)/]],
    ['47 name absent',             s => { delete s.things.things['type-dino'][1].name },                    ['things.things["type-dino"][1].name'], [/must be a string \(found absent\)/]],
    ['48 empty thing id',          s => { s.things.things['type-dino'][2].id = '' },                        ['things.things["type-dino"][2].id'], [/must be a non-empty string/]],
    ['49 duplicate thing id across buckets', s => { s.things.things['type-lair'][0].id = 't-tali' },        ['things.things["type-lair"][0].id'], [/duplicate id "t-tali" — also at things\.things\["type-dino"\]\[0\]/]],
    ['50 thing a string',          s => { s.things.things['type-dino'][0] = 'x' },                          ['things.things["type-dino"][0]'],   [/must be an object \(found "x"\)/]],
    ['51 file missing',            s => { s.types = null },                                                 ['types'],                           [/^missing$/]],
    ['52 file a string',           s => { s.themes = 'x' },                                                 ['themes'],                          [/must be an object \(found "x"\)/]]
  ]
  const crossOnly = /^(17|18|19|20|21|22|23) /                            // a file alone never reports a cross fault
  table.forEach(([label, mutate, expectedPaths, regexes]) => {
    const set = H()
    mutate(set)
    const problems = validateSet(set)
    assert.deepEqual(problems.map(problem => problem.path), expectedPaths, `${label}: exactly these paths, in order`)
    regexes.forEach((regex, i) => assert.match(problems[i].message, regex, `${label}: message ${i}`))
    if (crossOnly.test(label)) assert.deepEqual(validateFile('content', set.content), [], `${label}: the file alone is clean`)
    everyProblem.push(...problems)
  })
  ok(`V3 the breakage table: ${table.length} mutations, each refused at exactly the catalogue's path with the catalogue's message; cross faults are invisible to validateFile`)
}

// ───────────────────────── V4 leftovers are not problems ─────────────────────────
{
  const harmless = [
    ['a stale key on a thing (renamed field, D2)',   s => { s.things.things['type-dino'][0].oldKey = 'x' }],
    ['an author text value that is a number (D2)',   s => { s.things.things['type-dino'][0].label = 7 }],
    ['an author lines value that is a string (D2)',  s => { s.things.things['type-dino'][0].traits = 'x' }],
    ['an author number value that is null (D2)',     s => { s.things.things['type-dino'][0].rating = null }],
    ['a thing lacking every author field (t-egg)',   s => { assert.equal(s.things.things['type-dino'][3].label, undefined) }],
    ['a type without a bucket (D1)',                 s => { s.types.types.push({ id: 'type-new', label: 'New', fields: [] }) }],
    ['an orphan bucket (D1)',                        s => { s.things.things['type-orphan'] = [] }],
    ['a rules slot for no row (D1)',                 s => { s.rules.groupRules['r-gone'] = { min: 1 } }],
    ['a themes slot for no row (D1)',                s => { s.themes.groupThemes['r-gone'] = { background: 'x' } }],
    ['an empty slot',                                s => { s.rules.groupRules.R4 = {} }],
    ['min without max',                              s => { s.rules.groupRules.R2 = { min: 2 } }],
    ['a condition under type "" (§1.1: not a fault)', s => { s.content.groups[3].query.where = { field: 'x', op: 'is', value: '' } }],
    ['type "" with where null (R4)',                 s => { assert.deepEqual(s.content.groups[3].query, { type: '', where: null }) }]
  ]
  harmless.forEach(([label, mutate]) => {
    const set = H()
    mutate(set)
    assert.deepEqual(validateSet(set), [], `${label} is not a problem`)
  })
  ok(`V4 leftovers are not problems: ${harmless.length} editor-legitimate states (D1, D2, §1.1) all validate to []`)
}

// ───────────────────────── V5 per-file suppresses cross; total; pure ─────────────────────────
{
  // (a) a shape fault anywhere postpones the cross checks (D6)
  const both = H()
  both.types.types[0].fields = 'x'
  both.content.groups[0].query.type = 'type-gone'
  assert.deepEqual(validateSet(both).map(problem => problem.path), ['types.types[0].fields'], 'the dangle waits for the shape')
  // (b) total: junk in, an array out, never a throw; a missing file is validateSet's word
  const junk = [[], 'x', 42, {}, { version: 4 }, { version: 4, extra: 1 }]
  FILE_NAMES.forEach(name => junk.forEach(value => {
    const problems = validateFile(name, value)
    assert.ok(Array.isArray(problems) && problems.length > 0, `${name} over ${JSON.stringify(value)} is refused, quietly`)
  }))
  assert.deepEqual(validateSet({}), FILE_NAMES.map(name => ({ path: name, message: 'missing' })))
  // (c) pure: a frozen set is read, never written
  assert.deepEqual(validateSet(deepFreeze(H())), [])
  const frozenBroken = H()
  frozenBroken.content.groups[3].query.type = 'type-gone'
  frozenBroken.content.groups[3].showWhen = { kind: 'anyInRow', row: 'r-gone' }
  assert.equal(validateSet(deepFreeze(frozenBroken)).length, 2, 'a frozen broken set yields its two problems without a throw')
  ok('V5 a shape fault suppresses the cross pass; junk of every shape is refused without a throw; {} = five missing; frozen sets validate untouched')
}

// ───────────────────────── V6 paths resolve ─────────────────────────
{
  // the same nine hand-broken rows L13 audits — a cross problem's path must
  // lead back to the very row the audit found
  const set = H()
  set.content.groups.push(
    row('X1', { kind: 'always' }, [], { type: 'type-gone', where: null }),
    row('X2', { kind: 'always' }, [], { type: 'type-dino', where: { field: 'f-gone', op: 'is', value: '' } }),
    row('X3', { kind: 'always' }, [], { type: 'type-dino', where: { field: FIELD_LABEL, op: 'eq', value: '' } }),
    row('X4', { kind: 'always' }, [], { type: 'type-dino', where: { field: FIELD_RATING, op: 'eq', value: '2' } }),
    row('X5', { kind: 'thingPicked', thing: 't-gone' }),
    row('X6', { kind: 'anyInRow', row: 'r-gone' }),
    row('X7', { kind: 'anyInRow', row: 'X7' }),
    row('X8', { kind: 'someday' }),
    row('X9', { kind: 'anyInRow', row: 'r-gone' }, [], { type: 'type-gone', where: null })
  )
  // an independent walker: `.key`, `[n]` and `["k"]` tokens, applied from the set's top
  const resolve = (root, path) => {
    let at = root
    for (const [, key, index, quoted] of path.matchAll(/\.?([A-Za-z_$][\w$]*)|\[(\d+)\]|\["([^"]*)"\]/g)) at = at[key ?? quoted ?? Number(index)]
    return at
  }
  const found = danglingReferences(set)
  const problems = crossChecks(set)
  assert.equal(found.length, 10)
  assert.equal(problems.length, found.length)
  found.forEach((entry, i) => {
    assert.equal(problems[i].message, entry.what)
    assert.equal(problems[i].path, `${entry.path}.${entry.pointer}`)
    assert.equal(resolve(set, entry.path), entry.row, `${entry.path} leads to row ${entry.row.id} — the same object`)
  })
  // eachRow's path arithmetic, and rowsIn still the one-argument walk
  const paths = []
  eachRow(set.content.groups, (each, path) => paths.push(path))
  const expectedPaths = (rows, base) => rows.flatMap((each, i) => [`${base}[${i}]`, ...expectedPaths(each.children, `${base}[${i}].children`)])
  assert.deepEqual(paths, expectedPaths(set.content.groups, 'content.groups'))
  assert.deepEqual(paths.slice(0, 3), ['content.groups[0]', 'content.groups[0].children[0]', 'content.groups[1]'])
  assert.deepEqual(rowsIn(set.content.groups), paths.map(path => resolve(set, path)), 'rowsIn visits the same rows in the same order')
  ok('V6 paths resolve: 10 cross problems = the audit, each path + pointer, each path leading to its row; eachRow numbers rows the way the file does')
}

// ───────────────────────── V7 problem format ─────────────────────────
{
  const PATH = /^(content|rules|themes|types|things)(\.[A-Za-z_$][\w$]*|\[\d+\]|\["[^"]*"\])*$/
  assert.ok(everyProblem.length > 50, 'V3 produced problems to inspect')
  everyProblem.forEach(problem => {
    assert.deepEqual(Object.keys(problem), ['path', 'message'])
    assert.match(problem.path, PATH)
    assert.ok(problem.message.length > 0 && !problem.message.includes('\n'), `one line: ${problem.message}`)
    assert.equal(problemText(problem), `${problem.path}: ${problem.message}`)
  })
  ok(`V7 problem format: ${everyProblem.length} problems, each { path, message } with a grammatical path and a one-line message; problemText joins them`)
}

console.log(`all ${checks} logic checks passed`)
