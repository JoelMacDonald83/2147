// The v5 LOGIC oracles — the fast half, runnable from anywhere with plain node:
//
//   node cyoa/DinoCYOA/tools/oracles-logic.mjs
//
// Pure: imports engine/config/{schema,migrations,query,visibility,references,
// validate,merge}.js straight from the working tree, builds every fixture in
// memory, touches no git, no temp dir, no child process, and NEVER READS THE
// SHELF (books/**) — it runs in milliseconds. oracles.mjs imports this file
// first, so the full run always starts here. Every check is a node:assert; the
// first one that fails throws, node prints it, and the process exits non-zero.
//
//   L1  operator truth table        L10 checkShowWhen messages
//   L2  readAs (v5: the FIELD)      L11 deadRows
//   L3  checkWhere messages         L12 migration border (stamp, canonical row)
//   L4  editor count = engine list  L13 repairs keep the files closed
//   L5  valuesOf                    L14 kinds — choice, the fourth kind (NEW)
//   L6  computeVisible basics       L15 section walkers (NEW)
//   L7  cycle and self-gate         L16 migration v4 → v5 (NEW)
//   L8  one-pass fixpoint           L17 placements: audit and repairs (NEW)
//   L9  monotone, deterministic, order-blind
// the validator (engine/config/validate.js — the sheet's third reader):
//   V1  tables agree                V5  per-file suppresses cross; total; pure
//   V2  the healthy set fits        V6  paths resolve
//   V3  the breakage table          V7  problem format
//   V4  leftovers are not problems  V8  the breakage table, books (NEW)
// NEW: the MERGE (engine/config/merge.js) — a game is the last layer of a stack:
//   K1  order-independence, purity  K6  conflicts (F13/F14)
//   K2  add-only union              K7  the cascade and the arrangement
//   K3  duplicates (F6)             K8  flatten fixed point
//   K4  bad additions (F7–F12)      K9  validators (set / game / book)
//   K5  pins and requires (F1–F5)
// the manager's pure parts — the editor's hash grammar and the server's games
// module, both import-time pure (no DOM, no HTTP, no disk touched):
//   N1  hash grammar                N2  names            N3  the seed
//
// CHANGED (v5): validateSet is imported from merge.js — judging a set means
// merging the layers under it, so it moved out of validate.js.

import assert from 'node:assert/strict'
import { FIELD_DEFAULTS, fieldDefault, asOption, sheetOfType, placementSheet, fieldsOfType, listSectionsOf, queryableFields, fieldById, thingKeys, SCHEMA_VERSION, BOOK_NAME, isBookName, isEdition, BOOK_ID, FILE_SHEETS, BOOK_FILE_SHEETS, SHEETS, fieldDefSchema, coreThingSchema, metaSchema, pageThemeSchema, totalBudgetSchema, contentSchema, typesSchema } from '../engine/config/schema.js'
import { migrateSet } from '../engine/config/migrations.js'
import { OPERATORS, operatorOf, WHERE_VALUE_TYPE, WHERE_VALUE_DEFAULT, readAs, checkWhere, matchesWhere, filterThings, valuesOf } from '../engine/config/query.js'
import { GATES, SHOW_WHEN_KINDS, idsBelow, computeVisible, dropHidden, checkShowWhen, deadRows } from '../engine/config/visibility.js'
import { eachRow, rowsIn, forgetType, forgetField, forgetThing, forgetRow, forgetPlaced, forgetSectionPlacements, danglingReferences } from '../engine/config/references.js'
import { validateFile, validateBookFile, crossChecks, problemText, FILE_NAMES, CHECKED_TYPES } from '../engine/config/validate.js'
import { GAME_LAYER, bookLabel, emptyGame, orderBooks, mergeLayers, flattenGame, validateGame, validateSet, validateBook } from '../engine/config/merge.js'
import { parseHash, hashFor, uiState, TABS } from '../dinoEdit/uiState.js'
import { NAME, NAME_MAX, RESERVED, isGameName, slugOf, titleProblems, seedSet } from '../server/games.js'
import { EDITION, isEditionName } from '../server/books.js'

assert.equal(SCHEMA_VERSION, 5, 'these oracles describe schema version 5')

let checks = 0
const ok = (label) => { checks += 1; console.log(`  ok  ${label}`) }

// A claim that fails because ANOTHER package's file has a bug must stay red —
// the oracle never weakens an assertion to make a run green. But one such claim
// must not HIDE the thirty-odd checks below it, so `upstream` runs the assertion,
// records the failure, and lets the file finish; the last lines print every one
// of them and exit non-zero. The assertion still says what the code MUST do.
const blocked = []
const upstream = (what, run) => { try { run() } catch (error) { blocked.push(`${what}\n       ${String(error.message).split('\n')[0]}`) } }

// ───────────────────────── fixtures ─────────────────────────
// Ids are readable on purpose: a failing assertion should name "B", not a uuid.
const ids = (set) => [...set].sort().join(',')          // a Set as a comparable string
const deepFreeze = (value) => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze) }
  return value
}

// a row with the canonical five keys; the query is "shows nothing" unless given
const row = (id, showWhen = { kind: 'always' }, children = [], query = { type: '', where: null }) =>
  ({ id, label: `row ${id}`, query, showWhen, children })
const pick = (thingId) => ({ id: thingId, name: thingId, cost: 1 })

// CHANGED (v5): a type is SECTIONS now. The L4 type keeps its four author
// fields — one of every kind, `rating` added AFTER the first things were born
// (so raw things may lack it — exactly what hydration fills) — inside the one
// "Identity" section a migrated v4 type has.
const FIELD_LABEL  = 'f-label'
const FIELD_TRAITS = 'f-traits'
const FIELD_RATING = 'f-rating'
const FIELD_SIZE   = 'f-size'
const dinoFields = [
  { id: FIELD_LABEL,  key: 'label',  caption: 'Label',  type: 'text' },
  { id: FIELD_TRAITS, key: 'traits', caption: 'Traits', type: 'lines' },
  { id: FIELD_RATING, key: 'rating', caption: 'Rating', type: 'number' },
  { id: FIELD_SIZE,   key: 'size',   caption: 'Size',   type: 'choice', options: ['small', 'big'] }   // NEW: the fourth kind
]
const identityOf = (typeId, fields) => ({ id: `${typeId}.identity`, key: 'identity', caption: 'Identity', kind: 'fields', fields })
const dinoType = { id: 'type-dino', label: 'Dino', sections: [identityOf('type-dino', dinoFields)] }
const lairType = { id: 'type-lair', label: 'Lair', sections: [identityOf('type-lair', [])] }
const fieldOf = (key) => dinoFields.find(field => field.key === key)
const rawDinos = [
  { id: 't-tali',  name: 'Tali',  cost: 1, imageURL: 'dino.jpg', label: 'A biggie dino!', traits: ['stompies', 'peanut butter'], size: 'big' },
  { id: 't-miku',  name: 'Miku',  cost: 2, imageURL: '',         label: '',               traits: ['rides', 'water'], rating: 5, size: 'small' },
  { id: 't-king',  name: 'King',  cost: 3, imageURL: 'trex.jpg', label: 'Gayer',          traits: 'not a list',       rating: 0 },
  { id: 't-egg',   name: 'Egg',   cost: 0, imageURL: '' }
]
// what gameConfig.js does to a bucket: defaults for missing fields, assets/ prefix
const hydrate = (things, type) => {
  const sheet = sheetOfType(type)
  return things.map(thing => ({
    ...thing,
    ...Object.fromEntries(sheet.map(entry => [entry.key, thing[entry.key] ?? entry.hydrateDefault])),
    imageURL: thing.imageURL ? `assets/${thing.imageURL}` : ''
  }))
}
const fieldOfKind = { text: FIELD_LABEL, lines: FIELD_TRAITS, number: FIELD_RATING, choice: FIELD_SIZE }

// ───────────────────────── L1 operator truth table ─────────────────────────
{
  const cases = {
    text:   { is:  ['a', 'a', 'b'], isNot: ['a', 'b', 'a'] },
    number: { eq:  [2, 2, 3], ne: [2, 3, 2], lt: [1, 2, 1], lte: [2, 2, 1], gt: [3, 2, 3], gte: [2, 2, 3] },
    lines:  { has: [['x', 'y'], 'x', 'z'], lacks: [['x', 'y'], 'z', 'x'] },
    choice: { is:  ['a', 'a', 'b'], isNot: ['a', 'b', 'a'] }
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
  assert.equal(OPERATORS.choice[0].value, 'is')
  assert.equal(operatorOf('text', 'eq'), undefined, 'an op of another kind is not found')
  assert.equal(operatorOf('colour', 'is'), undefined, 'an unknown kind is not found')
  ok('L1 operator truth table: every (kind, op) matches and misses; defaults are is/eq/has/is')
}

// ───────────────────────── L2 readAs (v5: the FIELD) ─────────────────────────
{
  // CHANGED (v5): readAs takes the FIELD, because a default lives on the field now.
  const text   = { id: 'x', key: 'x', caption: 'X', type: 'text' }
  const number = { id: 'n', key: 'n', caption: 'N', type: 'number' }
  const lines  = { id: 'l', key: 'l', caption: 'L', type: 'lines' }
  const choice = { id: 'c', key: 'c', caption: 'C', type: 'choice', options: ['lair', 'location'] }
  const scored = { id: 's', key: 's', caption: 'S', type: 'number', default: 10 }
  const named  = { id: 'd', key: 'd', caption: 'D', type: 'text', default: 'anon' }
  // missing → fieldDefault(field): the kinds without a default fall back to the kind's
  assert.equal(readAs(text, undefined), '')
  assert.equal(readAs(number, undefined), 0)
  assert.equal(readAs(lines, undefined), FIELD_DEFAULTS.lines)
  assert.equal(readAs(choice, undefined), 'lair', 'a choice with no default reads as its FIRST option')
  assert.equal(readAs(scored, undefined), 10, 'a number field with default 10 reads 10')
  assert.equal(readAs(named, undefined), 'anon')
  // wrong shape → the same default
  assert.deepEqual(readAs(lines, 'not a list'), [], 'a string under a lines key reads as no lines')
  assert.equal(readAs(text, 7), '', 'a number under a text key reads as blank')
  assert.equal(readAs(number, '7'), 0, 'a string under a number key reads as 0')
  assert.equal(readAs(scored, '7'), 10, 'and a defaulted number field reads its default')
  assert.equal(readAs(choice, 3), 'lair', 'a number under a choice key reads as the first option')
  // right shape → the same value, whatever it is
  const list = ['a']
  assert.equal(readAs(lines, list), list, 'the right shape comes back as the same value')
  assert.equal(readAs(text, 'hi'), 'hi')
  assert.equal(readAs(number, 3), 3)
  assert.equal(readAs(choice, 'whatever'), 'whatever', 'which string a choice holds is the author\'s business, not the border\'s')
  // fieldDefault is the ONE function: the engine hydrates with it, newborn writes it, readAs reads it
  assert.equal(fieldDefault(scored), 10)
  assert.equal(fieldDefault(choice), 'lair')
  assert.equal(fieldDefault({ type: 'choice' }), '', 'a choice with no options at all still reads as ""')
  Object.entries(FIELD_DEFAULTS).forEach(([kind, value]) => assert.deepEqual(fieldDefault({ type: kind }), value, `${kind} falls back to its kind`))
  ok('L2 readAs(field, value): missing or wrong-shaped → fieldDefault(field) (default 10, a choice\'s first option, else the kind\'s); right shape → same value')
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
  ok('L3 checkWhere: null passes; dangling field, wrong-kind op, wrong-typed value each get their message; newborn defaults pass for all four kinds')
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
  assert.deepEqual(both({ field: FIELD_SIZE, op: 'is', value: 'small' }), ['t-miku', 't-king', 't-egg'], 'a missing choice reads as its first option, both sides')
  assert.deepEqual(both({ field: 'core:cost', op: 'lte', value: 2 }), ['t-tali', 't-miku', 't-egg'], 'core:cost lte 2')
  assert.deepEqual(both({ field: 'core:name', op: 'isNot', value: 'Egg' }), ['t-tali', 't-miku', 't-king'])
  // the same claim with a field that carries a DEFAULT: the editor's raw count is the game's count
  const scoredFields = [{ id: 'f-str', key: 'strength', caption: 'Strength', type: 'number', default: 10 }]
  const scoredType = { id: 'type-scored', label: 'Scored', sections: [identityOf('type-scored', scoredFields)] }
  const scoredThings = [{ id: 's1', name: 'A', cost: 0, imageURL: '' }, { id: 's2', name: 'B', cost: 0, imageURL: '', strength: 3 }]
  const scoredWhere = { field: 'f-str', op: 'eq', value: 10 }
  assert.deepEqual(filterThings(scoredThings, scoredType, scoredWhere).map(t => t.id), ['s1'], 'a thing older than Strength counts as 10')
  assert.deepEqual(filterThings(hydrate(scoredThings, scoredType), scoredType, scoredWhere).map(t => t.id), ['s1'], 'and hydrated it still counts as 10')
  assert.equal(filterThings(rawDinos, dinoType, null), rawDinos, 'no condition → the same array object')
  assert.equal(filterThings(hydrated, dinoType, null), hydrated)
  assert.equal(matchesWhere(null, dinoType, rawDinos[0]), true)
  ok('L4 editor count = engine list: raw and hydrated filter to the same ids, bucket order kept, core:cost works, a per-field default counts the same on both sides')
}

// ───────────────────────── L5 valuesOf ─────────────────────────
{
  assert.deepEqual(valuesOf(rawDinos, fieldOf('rating')), [0, 5], 'numbers: distinct, ascending, missing → 0')
  assert.deepEqual(valuesOf(rawDinos, fieldOf('label')), ['', 'A biggie dino!', 'Gayer'], 'strings: distinct, localeCompare')
  assert.deepEqual(valuesOf(rawDinos, fieldOf('traits')), ['peanut butter', 'rides', 'stompies', 'water'], 'lines: flattened, a string-valued field contributes nothing')
  assert.deepEqual(valuesOf(rawDinos, fieldOf('size')), ['big', 'small'], 'a choice: the bucket\'s truth, missing → the first option')
  assert.deepEqual(valuesOf([{ rating: 10 }, { rating: 9 }, { rating: 10 }], fieldOf('rating')), [9, 10])
  assert.deepEqual(valuesOf([], fieldOf('label')), [])
  ok('L5 valuesOf: distinct; numbers ascend; strings localeCompare; lines flattened; a choice reads its default')
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
  assert.throws(() => migrateSet({ ...v3, types: null, things: null }), /Missing data files for version 5: types, things/, 'stamp keeps a null a null')
  const frozen = deepFreeze(structuredClone(v3))
  const out = migrateSet(frozen)
  FILE_NAMES.forEach(name => assert.equal(out[name].version, 5, `${name} stamped 5`))
  assert.deepEqual(Object.keys(out.content), ['version', 'meta', 'books', 'groups', 'rowOverrides'])
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
  assert.equal(migrateSet(out), out, 'a v5 set passes the border as the same object')
  assert.deepEqual(danglingReferences(out), [], 'a migrated set is closed')
  ok('L12 migration border (v3 → 5): missing files named; canonical row shape; where null; showWhen always; byte-identical twice')
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
      content: { version: 5, meta: {}, books: [], groups: rows, rowOverrides: {} },
      // fresh copies: a removal below splices a section's fields and a bucket, and the next build must not see it
      types:   { version: 5, types: [structuredClone(dinoType), structuredClone(lairType)], sectionsFor: {}, fieldsFor: {} },
      things:  { version: 5, things: { 'type-dino': structuredClone(rawDinos), 'type-lair': [{ id: 't-lava', name: 'Lava Pit', cost: 3, imageURL: '' }] } }
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
    (set) => set.types.types[0].sections[0].fields.splice(0, 1),
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

// ───────────────────────── L14 kinds — choice, the fourth kind ─────────────────────────
// NEW: `choice` is a field kind now (an author's field whose value is one of a
// written list). It compares like text — it IS a string — so it shares text's
// operator objects rather than a copy that could drift.
{
  assert.equal(OPERATORS.choice, OPERATORS.text, 'OPERATORS.choice IS OPERATORS.text — the same array, not a copy')
  const [is, isNot] = OPERATORS.choice
  assert.equal(is.test('lair', 'lair'), true);      assert.equal(is.test('lair', 'location'), false)
  assert.equal(isNot.test('lair', 'location'), true); assert.equal(isNot.test('lair', 'lair'), false)
  assert.equal(WHERE_VALUE_TYPE.choice, 'string')
  const kindField = { id: 'a:kind', key: 'kind', caption: 'Kind', type: 'choice', options: ['lair', 'location'] }
  const place = { id: 'a:place', label: 'Place', sections: [identityOf('a:place', [kindField])] }
  assert.equal(checkWhere({ field: 'a:kind', op: 'is', value: WHERE_VALUE_DEFAULT.choice }, place), null, 'the newborn choice value passes checkWhere')
  assert.equal(checkWhere({ field: 'a:kind', op: 'lt', value: 'lair' }, place), 'operator "lt" does not fit a choice field (kind)')
  assert.equal(checkWhere({ field: 'a:kind', op: 'is', value: 3 }, place), 'value 3 is not a string (kind)')
  const bucket = [
    { id: 'p1', name: 'Lava Pit', cost: 3, imageURL: '', kind: 'lair' },
    { id: 'p2', name: 'Volcano Rim', cost: 1, imageURL: '', kind: 'location' },
    { id: 'p3', name: 'Play pen', cost: 2, imageURL: '', kind: 'lair' }
  ]
  assert.deepEqual(valuesOf(bucket, kindField), ['lair', 'location'], 'the distinct values on the shelf, localeCompare')
  assert.deepEqual(filterThings(bucket, place, { field: 'a:kind', op: 'is', value: 'lair' }).map(t => t.id), ['p1', 'p3'])
  assert.deepEqual(asOption('x'), { value: 'x', label: 'x' }, 'a bare string is value = label')
  const written = { value: 'fields', label: 'Fields (fixed slots)' }
  assert.equal(asOption(written), written, 'an object passes through as itself')
  ok('L14 kinds: OPERATORS.choice IS OPERATORS.text; is/isNot over strings; the newborn value fits; a number operator does not; valuesOf and filterThings over a choice; asOption reads both spellings')
}

// ───────────────────────── L15 section walkers ─────────────────────────
// NEW: a type is an ordered list of SECTIONS. Six walkers read them, and the
// editor, the engine and the validator all reach a type's fields through these
// — never through `type.fields`, which no longer exists.
{
  const numberField = { id: 'w:a.n', key: 'n', caption: 'N', type: 'number', default: 10 }
  const choiceField = { id: 'w:b.c', key: 'c', caption: 'C', type: 'choice', options: ['x', 'y'] }
  const levelField  = { id: 'w:list.level', key: 'level', caption: 'Level', type: 'number', default: 1 }
  const walkType = {
    id: 'w:sheet', label: 'W',
    sections: [
      { id: 'w:sheet.a',    key: 'a',       caption: 'A',       kind: 'fields', fields: [numberField] },
      { id: 'w:sheet.list', key: 'friends', caption: 'Friends', kind: 'list', of: 'w:other', placement: [levelField] },
      { id: 'w:sheet.b',    key: 'b',       caption: 'B',       kind: 'fields', fields: [choiceField] }
    ]
  }
  const sheet = sheetOfType(walkType)
  assert.deepEqual(sheet.map(entry => entry.key), ['n', 'friends', 'c'], 'entries come out in SECTION order, flattened')
  const placements = sheet[1]
  assert.deepEqual(Object.keys(placements), ['key', 'caption', 'type', 'section', 'default', 'hydrateDefault'])
  assert.equal(placements.type, 'placements', 'a list section is ONE entry, not one per placement')
  assert.equal(placements.section, walkType.sections[1], 'and it carries the section, so a builder knows `of` and the placement fields')
  assert.deepEqual([placements.default, placements.hydrateDefault], [[], []])
  assert.deepEqual(fieldsOfType(walkType), [numberField, choiceField], 'fieldsOfType skips the list section')
  assert.deepEqual(listSectionsOf(walkType), [walkType.sections[1]], 'listSectionsOf is exactly it')
  assert.deepEqual(queryableFields(walkType).map(field => field.id), ['core:name', 'core:cost', 'w:a.n', 'w:b.c'], 'the two core fields that carry an id, then the type\'s own')
  assert.equal(fieldById(walkType, 'w:b.c'), choiceField, 'a field in the THIRD section is found')
  assert.equal(fieldById(walkType, 'w:list.level'), undefined, 'a placement field is not queryable (Stage 2)')
  assert.deepEqual(thingKeys(walkType), ['name', 'cost', 'imageURL', 'n', 'c', 'friends'], 'the keys a thing may hold: core, the fields, the LIST sections\' keys')
  // dressing: `default` (what newborn writes) and `hydrateDefault` (what the engine fills) are fieldDefault(field)
  assert.deepEqual([sheet[0].default, sheet[0].hydrateDefault], [10, 10], 'a field with default 10 dresses to 10')
  assert.deepEqual([sheet[2].default, sheet[2].hydrateDefault], ['x', 'x'], 'a choice dresses to its first option')
  const dressedPlacement = placementSheet(walkType.sections[1])
  assert.equal(dressedPlacement.length, 1)
  assert.deepEqual([dressedPlacement[0].key, dressedPlacement[0].default, dressedPlacement[0].hydrateDefault], ['level', 1, 1], 'a placement field is dressed with its own default')
  // a fields section's own key is ADDRESSING only — nothing is stored under it
  assert.ok(!thingKeys(walkType).includes('a') && !thingKeys(walkType).includes('b'))
  ok('L15 section walkers: sheetOfType in section order with ONE placements entry carrying its section; fieldsOfType / listSectionsOf / queryableFields / fieldById / thingKeys; defaults dressed from the field')
}

// ───────────────────────── L16 migration v4 → v5 ─────────────────────────
{
  const v4Fields = [
    { id: 'f1', key: 'label',  caption: 'Label',  type: 'text' },
    { id: 'f2', key: 'traits', caption: 'Traits', type: 'lines' }
  ]
  const v4 = () => ({
    content: { version: 4, meta: { pageTitle: 'T', heroTitle: 'H' }, groups: [
      { id: 'r1', label: 'Row', query: { type: 'type-1', where: null }, showWhen: { kind: 'always' }, children: [] }
    ] },
    rules:  { version: 4, totalBudget: 10, groupRules: { r1: { min: 1 } } },
    themes: { version: 4, page: Object.fromEntries(pageThemeSchema.map(entry => [entry.key, entry.default])), groupThemes: {} },
    types:  { version: 4, types: [{ id: 'type-1', label: 'One', fields: v4Fields }, { id: 'type-2', label: 'Two', fields: [] }] },
    things: { version: 4, things: { 'type-1': [{ id: 't1', name: 'A', cost: 0, imageURL: '' }], 'type-2': [] } }
  })
  const input = v4()
  const out = migrateSet(input)
  FILE_NAMES.forEach(name => assert.equal(out[name].version, 5, `${name} stamped 5`))
  // every type gains EXACTLY ONE section, its id derived (never minted)
  out.types.types.forEach((type, i) => {
    assert.deepEqual(Object.keys(type), ['id', 'label', 'sections'])
    assert.equal(type.sections.length, 1, 'exactly one section')
    const section = type.sections[0]
    assert.deepEqual(Object.keys(section), ['id', 'key', 'caption', 'kind', 'fields'])
    assert.deepEqual([section.id, section.key, section.caption, section.kind], [`${type.id}.identity`, 'identity', 'Identity', 'fields'])
    assert.equal(section.fields, input.types.types[i].fields, 'the old field list, the same objects — nothing rewritten')
  })
  assert.deepEqual(Object.keys(out.content), ['version', 'meta', 'books', 'groups', 'rowOverrides'])
  assert.deepEqual(out.content.books, [], 'a v4 game knew no books')
  assert.deepEqual(out.content.rowOverrides, {}, 'and had nothing to override')
  assert.equal(out.content.groups, input.content.groups, 'the rows ride through untouched')
  assert.deepEqual(Object.keys(out.types), ['version', 'types', 'sectionsFor', 'fieldsFor'])
  assert.deepEqual([out.types.sectionsFor, out.types.fieldsFor], [{}, {}])
  // rules, themes and things are STAMPED and otherwise byte-equal
  ;['rules', 'themes', 'things'].forEach(name => {
    assert.deepEqual({ ...out[name], version: 4 }, input[name], `${name} differs from the v4 file in `.concat('its version only'))
  })
  assert.equal(out.rules.totalBudget, 10, 'a written budget is the game\'s own and stays written')
  // deterministic, mint-free, closed, and a fixed point
  assert.equal(JSON.stringify(migrateSet(v4())), JSON.stringify(out), 'migrating twice is byte-identical')
  assert.equal(migrateSet(out), out, 'a v5 set comes back as the same object')
  assert.deepEqual(danglingReferences(out), [], 'the migrated set is closed')
  assert.deepEqual(validateSet(out), [], 'and it fits the contract')
  assert.throws(() => migrateSet({ ...v4(), types: null, things: null }), /Missing data files for version 5: types, things/)
  ok('L16 migration v4 → v5: one derived "identity" section per type, the same field objects; content gains books: [] and rowOverrides: {}; types gains the two addition cabinets; twice is byte-identical; missing files named')
}

// ───────────────────────── L17 placements: the audit and the two repairs ─────────────────────────
// NEW: a thing points too. Its entries under a LIST section's key name things on
// another sheet's shelf — the one pointer that runs content → content.
{
  const listSection = { id: 'a:s.friends', key: 'friends', caption: 'Friends', kind: 'list', of: 'a:s', placement: [] }
  const build = (friends) => ({
    content: { version: 5, meta: { pageTitle: 'T', heroTitle: 'T' }, books: [], groups: [], rowOverrides: {} },
    types: { version: 5, sectionsFor: {}, fieldsFor: {}, types: [
      { id: 'a:s', label: 'S', sections: [identityOf('a:s', []), listSection] },
      { id: 'b:t', label: 'T', sections: [identityOf('b:t', [])] }
    ] },
    things: { version: 5, things: {
      'a:s': [{ id: 'a:one', name: 'One', cost: 0, imageURL: '', friends }, { id: 'a:two', name: 'Two', cost: 0, imageURL: '' }],
      'b:t': [{ id: 'b:elsewhere', name: 'Elsewhere', cost: 0, imageURL: '' }]
    } }
  })
  const auditOf = (friends) => danglingReferences(build(friends)).map(entry => ({ thing: entry.thing.id, path: entry.path, pointer: entry.pointer, what: entry.what }))
  const PATH = 'things.things["a:s"][0]'
  assert.deepEqual(auditOf(undefined), [], 'an absent placements key is a thing older than the section — like a missing field')
  assert.deepEqual(auditOf([]), [], 'and an empty list is closed')
  assert.deepEqual(auditOf([{ thing: 'a:two' }]), [], 'a thing on the section\'s own shelf is fine')
  assert.deepEqual(auditOf([{ thing: 'a:nope' }]), [{ thing: 'a:one', path: PATH, pointer: 'friends[0].thing', what: 'places a thing that does not exist (a:nope)' }])
  assert.deepEqual(auditOf([{ thing: 'b:elsewhere' }]), [{ thing: 'a:one', path: PATH, pointer: 'friends[0].thing', what: 'places a thing that does not exist (b:elsewhere)' }], 'a thing on ANOTHER shelf counts as not existing')
  assert.deepEqual(auditOf('x'), [{ thing: 'a:one', path: PATH, pointer: 'friends', what: 'must be an array (found "x")' }])
  assert.deepEqual(auditOf([3]), [{ thing: 'a:one', path: PATH, pointer: 'friends[0]', what: 'must be an object (found 3)' }])
  assert.deepEqual(auditOf([{}]), [{ thing: 'a:one', path: PATH, pointer: 'friends[0].thing', what: 'must be a non-empty string (found absent)' }])
  // crossChecks attaches the sentence to the exact key
  assert.deepEqual(crossChecks(build([{ thing: 'a:nope' }])), [{ path: `${PATH}.friends[0].thing`, message: 'places a thing that does not exist (a:nope)' }])
  // forgetPlaced: in place, named, and a no-op the second time
  const set = build([{ thing: 'a:two' }, { thing: 'a:two' }])
  set.things.things['a:s'][1].friends = [{ thing: 'a:two' }]
  const array = set.things.things['a:s'][0].friends
  const changed = forgetPlaced(set.things, set.types.types, 'a:two')
  assert.deepEqual(changed.map(({ thing, what }) => `${thing.id}: ${what}`), ['a:one: lost a placement — Two was removed', 'a:two: lost a placement — Two was removed'], 'one entry per holder that lost something, the thing named while it is still there')
  assert.equal(set.things.things['a:s'][0].friends, array, 'spliced in place — the editor holds that array')
  assert.deepEqual(array, [])
  assert.deepEqual(forgetPlaced(set.things, set.types.types, 'a:two'), [], 'a second run finds nothing')
  set.things.things['a:s'].splice(1, 1)
  assert.deepEqual(danglingReferences(set), [], 'closed once the thing itself is gone')
  // and when the thing is ALREADY gone the id is the name
  const gone = build([{ thing: 'a:two' }])
  gone.things.things['a:s'].splice(1, 1)
  assert.deepEqual(forgetPlaced(gone.things, gone.types.types, 'a:two').map(({ what }) => what), ['lost a placement — a:two was removed'])
  // forgetSectionPlacements: the shelf changed, so every entry under that key is meaningless
  const reaimed = build([{ thing: 'a:two' }])
  const emptied = forgetSectionPlacements(reaimed.things, reaimed.types.types, 'a:s.friends')
  assert.deepEqual(emptied.map(({ thing, what }) => `${thing.id}: ${what}`), ['a:one: lost its Friends placements — the section\'s shelf changed'])
  assert.deepEqual(reaimed.things.things['a:s'][0].friends, [], 'emptied in place')
  assert.deepEqual(forgetSectionPlacements(reaimed.things, reaimed.types.types, 'a:s.friends'), [], 'only a non-empty array is reported')
  assert.deepEqual(danglingReferences(reaimed), [], 'closed afterwards')
  ok('L17 placements: the audit\'s four shape sentences and "places a thing that does not exist" (another shelf counts as gone); crossChecks attaches them by key; forgetPlaced and forgetSectionPlacements edit in place, name what they touched, and are no-ops twice')
}

// ═════════════════════════ the validator: V1–V8 ═════════════════════════
// validate.js is the sheet's THIRD reader — the editor's builders say how a kind
// is edited, the game's displays say how it is shown, CHECKERS say how it is
// checked. These eight checks pin the reader to the other two (its tables must
// name every type the sheets use), pin every message and path in the catalogue by
// regex (the server, the editor and the export all show them), and pin what it
// must NOT refuse (the editor's own leftovers, D1/D2).

// Fixture H: a COMPLETE healthy v5 set. rawDinos is deliberately untidy
// (t-king's traits is a string, t-egg lacks every author field): H is clean
// UNDER D2, by design.
const H = () => ({
  content: { version: 5, meta: { pageTitle: 'T', heroTitle: 'H' }, books: [], groups: [
    row('R1', { kind: 'always' }, [ row('R1a', { kind: 'anyInRow', row: 'R1' }, [], { type: 'type-dino', where: { field: FIELD_LABEL, op: 'is', value: 'Gayer' } }) ], { type: 'type-dino', where: null }),
    row('R2', { kind: 'thingPicked', thing: 't-tali' }, [], { type: 'type-lair', where: { field: 'core:cost', op: 'gte', value: 1 } }),
    row('R3', { kind: 'anyInRow', row: 'R1a' }, [], { type: 'type-lair', where: null }),
    row('R4', { kind: 'thingPicked', thing: 't-lava' }, [], { type: '', where: null })
  ], rowOverrides: {} },
  rules:  { version: 5, totalBudget: 10, groupRules: { R1: { min: 1, max: 1 }, R2: {}, R3: { max: 2 } } },
  themes: { version: 5, page: { bodyBackground: '#fff', fontFamily: 'serif', heroImage: '', statusBackground: '#000', statusColor: '#fff' }, groupThemes: { R1: { background: 'red' }, R2: {} } },
  types:  { version: 5, types: [structuredClone(dinoType), structuredClone(lairType)], sectionsFor: {}, fieldsFor: {} },
  things: { version: 5, things: { 'type-dino': structuredClone(rawDinos), 'type-lair': [{ id: 't-lava', name: 'Lava Pit', cost: 3, imageURL: '' }] } }
})
// every problem V3 and V8 produce, kept for V7's format check
const everyProblem = []

// ───────────────────────── V1 tables agree ─────────────────────────
{
  // (a) every sheet-entry type anywhere has a checker — the sheet cannot grow a
  // type the border does not know. CHANGED (v5): the BOOK sheets join the sweep,
  // and `placements` (which sheetOfType makes, never a written sheet) with them.
  const everySheet = [...Object.values(SHEETS), ...Object.values(FILE_SHEETS), ...Object.values(BOOK_FILE_SHEETS), coreThingSchema]
  const usedTypes = new Set([...everySheet.flatMap(sheet => sheet.map(entry => entry.type)), ...Object.keys(FIELD_DEFAULTS), 'placements'])
  usedTypes.forEach(type => assert.ok(CHECKED_TYPES.includes(type), `CHECKERS has no checker for sheet type "${type}"`))
  ;['pins', 'flag', 'fieldDefault', 'idLists', 'placements'].forEach(type => assert.ok(CHECKED_TYPES.includes(type), `the v5 checker "${type}"`))
  assert.ok(['section', 'rowOverride', 'book'].every(name => Object.hasOwn(SHEETS, name)), 'the three new sheets are in the phonebook')
  // (b) the four kind tables are one list
  const kinds = fieldDefSchema.find(entry => entry.key === 'type').options.map(option => option.value)
  assert.deepEqual(kinds, ['text', 'number', 'lines', 'choice'])
  assert.deepEqual(Object.keys(FIELD_DEFAULTS), kinds, 'FIELD_DEFAULTS names the fieldDef kinds')
  assert.deepEqual(Object.keys(OPERATORS), kinds, 'OPERATORS names the fieldDef kinds')
  assert.deepEqual(Object.keys(WHERE_VALUE_TYPE), kinds, 'WHERE_VALUE_TYPE names the fieldDef kinds')
  assert.deepEqual(Object.keys(WHERE_VALUE_DEFAULT), kinds, 'WHERE_VALUE_DEFAULT names them too')
  // (c) the five files, in report order — and each file top is built from the
  // NAMED sheets, not from copies that could drift away from what the editor draws
  assert.deepEqual(Object.keys(FILE_SHEETS), FILE_NAMES)
  assert.deepEqual(FILE_NAMES, ['content', 'rules', 'themes', 'types', 'things'])
  assert.equal(SHEETS.meta, metaSchema); assert.equal(SHEETS.pageTheme, pageThemeSchema)
  const holds = (sheet, part, where) => assert.deepEqual(sheet.slice(where, where + part.length), part)
  holds(FILE_SHEETS.content, contentSchema, 2)                 // meta, books, THEN groups, then rowOverrides
  holds(FILE_SHEETS.rules, totalBudgetSchema, 0)
  holds(FILE_SHEETS.types, typesSchema, 0)
  assert.deepEqual(FILE_SHEETS.content.map(entry => entry.key), ['meta', 'books', 'groups', 'rowOverrides'])
  assert.deepEqual(FILE_SHEETS.types.map(entry => entry.key), ['types', 'sectionsFor', 'fieldsFor'])
  assert.deepEqual(FILE_SHEETS.things.map(entry => entry.key), ['things', 'order'])
  // the BOOK files: the game's own types/things sheets, and proposals — the rows
  // half of content.json and the whole of rules.json in one file
  assert.deepEqual(Object.keys(BOOK_FILE_SHEETS), ['book', 'types', 'things', 'proposals'])
  assert.equal(BOOK_FILE_SHEETS.types, FILE_SHEETS.types, 'a book writes the same shapes a game does')
  assert.equal(BOOK_FILE_SHEETS.things, FILE_SHEETS.things)
  assert.deepEqual(BOOK_FILE_SHEETS.proposals.map(entry => entry.key), ['totalBudget', 'groups', 'groupRules'])
  // (d) every `of` resolves
  everySheet.flat().filter(entry => entry.type !== 'choice' && entry.of !== undefined).forEach(entry => assert.ok(Object.hasOwn(SHEETS, entry.of), `SHEETS has no sheet named "${entry.of}"`))
  // (e) attachments and cabinets are the two sides of one drawer. CHANGED (v5):
  // one to one in ONE direction only — content.rowOverrides is a cabinet with no
  // attachment, because an override is drawn beside the row it overrides (§7.7),
  // never as a card on the row's own sheet.
  const attachments = Object.values(SHEETS).flat().filter(entry => entry.type === 'attachment')
  const cabinets = Object.entries(FILE_SHEETS).flatMap(([file, sheet]) => sheet.filter(entry => entry.type === 'cabinet').map(entry => ({ file, ...entry })))
  assert.ok(attachments.length > 0 && cabinets.length > 0)
  attachments.forEach(a => assert.equal(cabinets.filter(c => c.file === a.file && c.key === a.cabinet && c.of === a.of).length, 1, `attachment ${a.file}.${a.cabinet} has one cabinet`))
  const lonely = cabinets.filter(c => !attachments.some(a => a.file === c.file && a.cabinet === c.key && a.of === c.of))
  assert.deepEqual(lonely.map(c => `${c.file}.${c.key}`), ['content.rowOverrides'], 'exactly one cabinet is drawn by hand')
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
  ok(`V1 tables agree: ${usedTypes.size} sheet types all checked (pins, flag, fieldDefault, idLists, placements included); kinds = ${kinds.join('/')} in four tables; ${cabinets.length} cabinets, ${attachments.length} attachments, rowOverrides drawn by hand; gates name their key; newborn conditions fit`)
}

// ───────────────────────── V2 the healthy set fits ─────────────────────────
{
  assert.deepEqual(validateSet(H()), [])
  FILE_NAMES.forEach(name => assert.deepEqual(validateFile(name, H()[name]), [], `${name} alone is clean`))
  assert.deepEqual(crossChecks(H()), [])
  ok('V2 the healthy v5 set fits: validateSet, every validateFile and crossChecks all say []')
}

// ───────────────────────── V3 the breakage table ─────────────────────────
{
  // [label, mutate, expectedPaths, regexes] — one row per situation.
  // G = content.groups, S = the dino type's one section; a path is asserted
  // EXACTLY and in order.
  const G = 'content.groups'
  const S = 'types.types[0].sections[0]'
  const kindRow = (kind) => [`13 showWhen kind ${JSON.stringify(kind)}`, s => { s.content.groups[0].showWhen = { kind } }, [`${G}[0].showWhen.kind`], [new RegExp(`${JSON.stringify(kind)} is not a show-when kind \\(always, thingPicked, anyInRow\\)`)]]
  const fieldKindRow = (type) => [`40 field kind ${JSON.stringify(type)}`, s => { s.types.types[0].sections[0].fields[0].type = type }, [`${S}.fields[0].type`], [new RegExp(`${JSON.stringify(type)} is not one of text, number, lines, choice`)]]
  const table = [
    ['1 old version, no walk',     s => { s.content.version = 4; delete s.content.meta },                    ['content.version'],                 [/must be 5 \(found 4\) — open the game in the editor and Save/]],
    ['2 version as a string',      s => { s.rules.version = '5' },                                          ['rules.version'],                   [/found "5"/]],
    ['3 showWhen absent',          s => { delete s.content.groups[1].showWhen },                            [`${G}[1].showWhen`],                [/must be an object \(found absent\)/]],
    ['4 totalBudget a string',     s => { s.rules.totalBudget = '10' },                                     ['rules.totalBudget'],               [/must be a number or absent \(found "10"\)/]],
    ['5 totalBudget Infinity',     s => { s.rules.totalBudget = Infinity },                                 ['rules.totalBudget'],               [/found Infinity/]],
    // the vocabulary is printed from ALL_OPS. `choice` shares text's two operator
    // OBJECTS (query.js), so a flat map over OPERATORS lists is/isNot twice —
    // validate.js:18 needs the distinct list. The claim stays as the author must read it.
    ['6 unknown operator',         s => { s.content.groups[1].query.where.op = 'equals' },                  [`${G}[1].query.where.op`],          [/"equals" is not an operator \(is, isNot, eq, ne, lt, lte, gt, gte, has, lacks\)$/], 'validate.js:18 ALL_OPS'],
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
    ['38 duplicate field key',     s => { s.types.types[0].sections[0].fields.push({ id: 'f-dup', key: 'label', caption: 'D', type: 'text' }) }, [`${S}.fields[4].key`], [new RegExp(`duplicate key "label" — also at ${S.replace(/[[\]]/g, m => '\\' + m)}\\.fields\\[0\\]`)]],
    ['39 reserved field key',      s => { s.types.types[0].sections[0].fields.push({ id: 'f-n', key: 'name', caption: 'N', type: 'text' }) },    [`${S}.fields[4].key`], [/"name" is a key every thing already has \(id, name, cost, imageURL\)/]],
    fieldKindRow('date'), fieldKindRow('constructor'),
    ['41 empty field key',         s => { s.types.types[0].sections[0].fields[0].key = '' },                [`${S}.fields[0].key`],              [/must be a non-empty string \(found ""\)/]],
    ['42 duplicate type id',       s => { s.types.types[1].id = 'type-dino' },                              ['types.types[1].id'],               [/duplicate id "type-dino" — also at types\.types\[0\]/]],
    // an id is a KEY in the interior (things.things[type.id], selections[row.id]): a name every object inherits is refused
    ['42b prototype-named type id', s => { s.types.types[1].id = 'constructor' },                           ['types.types[1].id'],               [/"constructor" cannot be an id \(it is a name every object already has\)/]],
    ['42c __proto__ as a thing id', s => { s.things.things['type-lair'][0].id = '__proto__' },              ['things.things["type-lair"][0].id'], [/"__proto__" cannot be an id/]],
    ['43 fields a string',         s => { s.types.types[0].sections[0].fields = 'x' },                      [`${S}.fields`],                     [/must be an array \(found "x"\)/]],
    ['43b sections a string',      s => { s.types.types[0].sections = 'x' },                                ['types.types[0].sections'],         [/must be an array \(found "x"\)/]],
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
  table.forEach(([label, mutate, expectedPaths, regexes, blockedBy]) => {
    const set = H()
    mutate(set)
    const problems = validateSet(set)
    assert.deepEqual(problems.map(problem => problem.path), expectedPaths, `${label}: exactly these paths, in order`)
    const messages = () => regexes.forEach((regex, i) => assert.match(problems[i].message, regex, `${label}: message ${i}`))
    if (blockedBy) upstream(`V3 ${label} (${blockedBy})`, messages); else messages()
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
    ['a type without a bucket (D1)',                 s => { s.types.types.push({ id: 'type-new', label: 'New', sections: [] }) }],
    ['an orphan bucket (D1)',                        s => { s.things.things['type-orphan'] = [] }],
    ['a rules slot for no row (D1)',                 s => { s.rules.groupRules['r-gone'] = { min: 1 } }],
    ['a themes slot for no row (D1)',                s => { s.themes.groupThemes['r-gone'] = { background: 'x' } }],
    ['an empty slot',                                s => { s.rules.groupRules.R4 = {} }],
    ['min without max',                              s => { s.rules.groupRules.R2 = { min: 2 } }],
    ['a condition under type "" (§1.1: not a fault)', s => { s.content.groups[3].query.where = { field: 'x', op: 'is', value: '' } }],
    ['type "" with where null (R4)',                 s => { assert.deepEqual(s.content.groups[3].query, { type: '', where: null }) }],
    // NEW (v5), §5.4: what a game legitimately carries once books are in the picture
    ['a rowOverrides key for a row no book proposes', s => { s.content.rowOverrides['dinosaur-age:row-lairs'] = { label: 'Lairs!' } }],
    ['a game bucket keyed by a sheet no layer defines', s => { s.things.things['basic:place'] = [] }],
    ['a stale placement array under a removed list section\'s key', s => { s.things.things['type-dino'][0].friends = [{ thing: 't-gone' }] }],
    ['things.order absent',                          s => { assert.equal(s.things.order, undefined) }],
    ['rules.totalBudget absent (a book proposes it)', s => { delete s.rules.totalBudget }]
  ]
  harmless.forEach(([label, mutate]) => {
    const set = H()
    mutate(set)
    assert.deepEqual(validateSet(set), [], `${label} is not a problem`)
  })
  ok(`V4 leftovers are not problems: ${harmless.length} editor-legitimate states (D1, D2, §1.1, §5.4) all validate to []`)
}

// ───────────────────────── V5 per-file suppresses cross; total; pure ─────────────────────────
{
  // (a) a shape fault anywhere postpones the cross checks (D6)
  const both = H()
  both.types.types[0].sections[0].fields = 'x'
  both.content.groups[0].query.type = 'type-gone'
  assert.deepEqual(validateSet(both).map(problem => problem.path), ['types.types[0].sections[0].fields'], 'the dangle waits for the shape')
  // (b) total: junk in, an array out, never a throw; a missing file is validateSet's word
  const junk = [[], 'x', 42, {}, { version: 5 }, { version: 5, extra: 1 }]
  FILE_NAMES.forEach(name => junk.forEach(value => {
    const problems = validateFile(name, value)
    assert.ok(Array.isArray(problems) && problems.length > 0, `${name} over ${JSON.stringify(value)} is refused, quietly`)
  }))
  Object.keys(BOOK_FILE_SHEETS).forEach(name => junk.forEach(value => {
    const problems = validateBookFile(name, value)
    assert.ok(Array.isArray(problems) && problems.length > 0, `book ${name} over ${JSON.stringify(value)} is refused, quietly`)
  }))
  assert.deepEqual(validateSet({}), FILE_NAMES.map(name => ({ path: name, message: 'missing' })))
  assert.throws(() => validateFile('nope', {}), /No such data file: nope/)
  assert.throws(() => validateBookFile('nope', {}), /No such book file: nope/)
  // (c) pure: a frozen set is read, never written
  assert.deepEqual(validateSet(deepFreeze(H())), [])
  const frozenBroken = H()
  frozenBroken.content.groups[3].query.type = 'type-gone'
  frozenBroken.content.groups[3].showWhen = { kind: 'anyInRow', row: 'r-gone' }
  assert.equal(validateSet(deepFreeze(frozenBroken)).length, 2, 'a frozen broken set yields its two problems without a throw')
  ok('V5 a shape fault suppresses the cross pass; junk of every shape is refused (game files and book files) without a throw; {} = five missing; frozen sets validate untouched')
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

// ───────────────────────── V8 the breakage table, books ─────────────────────────
// NEW: everything v5 added to the contract — the pins a game writes, the house
// rules it keeps, a type's sections, a field's options and default, the
// arrangement — and the BOOK files, which are checked by the same walk over
// BOOK_FILE_SHEETS.
{
  const listSection = (patch = {}) => ({ id: 'type-dino.friends', key: 'friends', caption: 'Friends', kind: 'list', of: 'type-lair', placement: [], ...patch })
  const addList = (s, patch) => { s.types.types[0].sections.push(listSection(patch)); return s }
  const field = (patch) => ({ id: 'f-new', key: 'newField', caption: 'New', type: 'text', ...patch })
  const S = 'types.types[0].sections[0]'
  const L = 'types.types[0].sections[1]'
  const gameTable = [
    // the pins (content.books) — the same checker serves book.requires
    ['books an object',        s => { s.content.books = {} },                                      'content.books',          /must be an array \(found an object\)/],
    ['a pin that is not one',  s => { s.content.books = [3] },                                     'content.books[0]',       /must be an object \(found 3\)/],
    ['an upper-case name',     s => { s.content.books = [{ name: 'Basic', edition: 1 }] },         'content.books[0].name',  /"Basic" is not a book name \(lowercase letters, digits and single dashes\)/],
    ['a name that is absent',  s => { s.content.books = [{ edition: 1 }] },                        'content.books[0].name',  /must be a string \(found absent\)/],
    ['edition 0',              s => { s.content.books = [{ name: 'basic', edition: 0 }] },         'content.books[0].edition', /must be a positive integer \(found 0\)/],
    ['edition as a string',    s => { s.content.books = [{ name: 'basic', edition: '1' }] },       'content.books[0].edition', /must be a positive integer \(found "1"\)/],
    ['edition 1.5',            s => { s.content.books = [{ name: 'basic', edition: 1.5 }] },       'content.books[0].edition', /must be a positive integer \(found 1.5\)/],
    ['the same name twice',    s => { s.content.books = [{ name: 'basic', edition: 1 }, { name: 'basic', edition: 2 }] }, 'content.books[1]', /"basic" appears twice — also at content\.books\[0\]/],
    ['a stray key on a pin',   s => { s.content.books = [{ name: 'basic', edition: 1, extra: 1 }] }, 'content.books[0].extra', /unexpected key "extra"/],
    // the house rules (content.rowOverrides) — every key optional, `hidden` a flag
    ['hidden false',           s => { s.content.rowOverrides.x = { hidden: false } },              'content.rowOverrides["x"].hidden', /must be true or absent \(found false\)/],
    ['an override that is not a slot', s => { s.content.rowOverrides.x = 3 },                      'content.rowOverrides["x"]', /must be an object \(found 3\)/],
    ['min in an override',     s => { s.content.rowOverrides.x = { min: 1 } },                     'content.rowOverrides["x"].min', /unexpected key "min"/],
    ['query a number',         s => { s.content.rowOverrides.x = { query: 5 } },                   'content.rowOverrides["x"].query', /must be an object \(found 5\)/],
    ['a null budget',          s => { s.rules.totalBudget = null },                                'rules.totalBudget',      /must be a number or absent \(found null\)/],
    // sections
    ['an unknown section kind', s => { s.types.types[0].sections[0].kind = 'table' },              `${S}.kind`,              /"table" is not one of fields, list/],
    ['a section without a key', s => { s.types.types[0].sections[0].key = '' },                    `${S}.key`,               /must be a non-empty string \(found ""\)/],
    ['a section without an id', s => { delete s.types.types[0].sections[0].id },                   `${S}.id`,                /must be a non-empty string \(found absent\)/],
    ['a fields section with of', s => { s.types.types[0].sections[0].of = 'type-lair' },           `${S}.of`,                /unexpected key "of" \(only when kind is "list"\)/],
    ['a list section without of', s => addList(s, { of: undefined }),                              `${L}.of`,                /must be a string \(found absent\)/],
    ['a list section with an empty of', s => addList(s, { of: '' }),                               `${L}.of`,                /must be a non-empty string \(found ""\)/],
    ['a list section with fields', s => addList(s, { fields: [] }),                                `${L}.fields`,            /unexpected key "fields" \(only when kind is "list"\)|unexpected key "fields"/],
    ['a fields section without fields', s => { delete s.types.types[0].sections[0].fields },       `${S}.fields`,            /must be an array \(found absent\)/],
    ['a placement keyed thing', s => addList(s, { placement: [field({ key: 'thing' })] }),         `${L}.placement[0].key`,  /"thing" is the key every placement already has/],
    ['two placements under one key', s => addList(s, { placement: [field({ id: 'p1' }), field({ id: 'p2' })] }), `${L}.placement[1].key`, /duplicate key "newField" — also at/],
    ['a list section key a thing already has', s => addList(s, { key: 'label' }),                  `${L}.key`,               /duplicate key "label" — also at/],
    // fieldDef: options and default
    ['a choice without options', s => { s.types.types[0].sections[0].fields[3].options = undefined }, `${S}.fields[3].options`, /must be an array \(found absent\)/],
    ['a choice with no option', s => { s.types.types[0].sections[0].fields[3].options = [] },      `${S}.fields[3].options`, /a choice needs at least one option/],
    ['the same option twice',  s => { s.types.types[0].sections[0].fields[3].options = ['a', 'a'] }, `${S}.fields[3].options[1]`, /duplicate option "a"/],
    ['options on a text field', s => { s.types.types[0].sections[0].fields[0].options = ['a'] },   `${S}.fields[0].options`, /unexpected key "options" \(only when type is "choice"\)/],
    ['a default that is null', s => { s.types.types[0].sections[0].fields[2].default = null },     `${S}.fields[2].default`, /must be a string or a number \(found null\)/],
    ['a string default on a number', s => { s.types.types[0].sections[0].fields[2].default = '10' }, `${S}.fields[2].default`, /default must be a number \(found "10"\)/],
    ['a number default on text', s => { s.types.types[0].sections[0].fields[0].default = 10 },     `${S}.fields[0].default`, /default must be a string \(found 10\)/],
    ['a default on lines',     s => { s.types.types[0].sections[0].fields[1].default = 'x' },      `${S}.fields[1].default`, /a lines field cannot carry a default/],
    ['a default off the list', s => { s.types.types[0].sections[0].fields[3].default = 'huge' },   `${S}.fields[3].default`, /default "huge" is not one of small, big/],
    // the two addition cabinets of types.json
    ['sectionsFor an array',   s => { s.types.sectionsFor = [] },                                  'types.sectionsFor',      /must be an object \(found an array\)/],
    ['a sectionsFor slot that is not a list', s => { s.types.sectionsFor['type-lair'] = {} },      'types.sectionsFor["type-lair"]', /must be an array \(found an object\)/],
    ['a fieldsFor slot that is not a list', s => { s.types.fieldsFor['x'] = {} },                  'types.fieldsFor["x"]',   /must be an array \(found an object\)/],
    ['a fieldsFor element without a key', s => { s.types.fieldsFor['x'] = [{ id: 'f-a', caption: 'A', type: 'text' }] }, 'types.fieldsFor["x"][0].key', /must be a string \(found absent\)/],
    ['an addition that reuses an id', s => { s.types.fieldsFor['x'] = [field({ id: FIELD_LABEL })] }, 'types.fieldsFor["x"][0].id', /duplicate id "f-label" — also at/],
    // the arrangement (things.order)
    ['order an array',         s => { s.things.order = [] },                                      'things.order',           /must be an object \(found an array\)/],
    ['an order list that is not a list', s => { s.things.order = { 'type-dino': 'x' } },           'things.order["type-dino"]', /must be an array \(found "x"\)/],
    ['an empty id in an order', s => { s.things.order = { 'type-dino': [''] } },                   'things.order["type-dino"][0]', /must be a non-empty string \(found ""\)/],
    ['an id listed twice',     s => { s.things.order = { 'type-dino': ['t-tali', 't-miku', 't-tali'] } }, 'things.order["type-dino"][2]', /"t-tali" is listed twice — also at things\.order\["type-dino"\]\[0\]/]
  ]
  gameTable.forEach(([label, mutate, path, regex]) => {
    const set = H()
    mutate(set)
    const problems = validateSet(set)
    const found = problems.find(problem => problem.path === path)
    assert.ok(found, `${label}: a problem at ${path} (got ${JSON.stringify(problems)})`)
    assert.match(found.message, regex, `${label}: the message at ${path}`)
    everyProblem.push(...problems)
  })
  // exactly ONE problem where the catalogue says so — a governing key holding a
  // value its own choice does not offer decides nothing, so the keys it governs
  // are left alone rather than reported a second time
  const oneProblem = (label, mutate) => {
    const set = H()
    mutate(set)
    assert.equal(validateSet(set).length, 1, `${label}: exactly one problem`)
  }
  oneProblem('an unknown section kind', s => { s.types.types[0].sections[0].kind = 'table' })
  oneProblem('a null budget', s => { s.rules.totalBudget = null })
  assert.deepEqual(validateSet((() => { const s = H(); delete s.rules.totalBudget; return s })()), [], 'an ABSENT budget is fine — a book may propose one')

  // the BOOK files, by the same walk over BOOK_FILE_SHEETS
  const manifest = (patch) => ({ name: 'basic', title: 'Basic', edition: 1, requires: [], ...patch })
  const bookTable = [
    ['the manifest fits',        'book',      manifest(),                                                        null,             null],
    ['an edition that is text',  'book',      manifest({ edition: '1' }),                                        'book.edition',   /must be a number \(found "1"\)/],
    ['a manifest with a version', 'book',     { ...manifest(), version: 5 },                                     'book.version',   /unexpected key "version"/],
    ['requires that is not a list', 'book',   manifest({ requires: {} }),                                        'book.requires',  /must be an array \(found an object\)/],
    ['a requirement with no edition', 'book', manifest({ requires: [{ name: 'basic' }] }),                       'book.requires[0].edition', /must be a positive integer \(found absent\)/],
    ['a book file at version 4', 'types',     { version: 4, types: [], sectionsFor: {}, fieldsFor: {} },         'types.version',  /must be 5 \(found 4\) — this book was written for another version/],
    ['proposals without groups', 'proposals', { version: 5, groupRules: {} },                                    'proposals.groups', /must be an array \(found absent\)/],
    ['proposals fit',            'proposals', { version: 5, totalBudget: 10, groups: [], groupRules: {} },       null,             null],
    ['a book may write order',   'things',    { version: 5, things: {}, order: { 'basic:place': ['x'] } },       null,             null],
    ['things at version 4',      'things',    { version: 5, things: { 'basic:place': [{ id: 'x', name: 'X', cost: 0, imageURL: '' }] } }, null, null]
  ]
  bookTable.forEach(([label, file, value, path, regex]) => {
    const problems = validateBookFile(file, value)
    if (path === null) { assert.deepEqual(problems, [], `${label}: no problem`); return }
    const found = problems.find(problem => problem.path === path)
    assert.ok(found, `${label}: a problem at ${path} (got ${JSON.stringify(problems)})`)
    assert.match(found.message, regex, `${label}: the message at ${path}`)
    everyProblem.push(...problems)
  })
  assert.equal(validateBookFile('types', { version: 4, types: 'x' }).length, 1, 'an old book file is refused by version and NOT walked')
  ok(`V8 the breakage table, books: ${gameTable.length} game mutations (pins, house rules, sections, options and defaults, the two addition cabinets, the arrangement) and ${bookTable.length} book files, each at its exact path with its sentence`)
}

// ───────────────────────── V7 problem format ─────────────────────────
// Runs last: it inspects every problem V3 and V8 produced.
{
  // CHANGED (v5): the grammar admits the BOOK roots too — a book's own files
  // (`book`, `types`, `things`, `proposals`) and the coordinates a game's merge
  // gives them (`books["stats"].types…`).
  const PATH = /^(content|rules|themes|types|things|book|proposals|books\["[a-z0-9-]+"\]\.(book|types|things|proposals))(\.[A-Za-z_$][\w$]*|\[\d+\]|\["[^"]*"\])*$/
  assert.ok(everyProblem.length > 100, 'V3 and V8 produced problems to inspect')
  everyProblem.forEach(problem => {
    assert.deepEqual(Object.keys(problem), ['path', 'message'])
    assert.match(problem.path, PATH)
    assert.ok(problem.message.length > 0 && !problem.message.includes('\n'), `one line: ${problem.message}`)
    assert.equal(problemText(problem), `${problem.path}: ${problem.message}`)
  })
  ok(`V7 problem format: ${everyProblem.length} problems, each { path, message } with a grammatical path (books included) and a one-line message; problemText joins them`)
}

// ═════════════════════════ the merge: K1–K9 ═════════════════════════
// NEW: a game is the LAST LAYER of a stack. merge.js flattens that stack back
// into one plain, bookless v5 set — the shape hydrate has always eaten — plus
// origins (the editor's badges), proposed (the "X proposes …" lines), order and
// faults. These nine checks are hand-built layers in §2's shapes: the fast half
// never reads the shelf, so a book that changes on disk cannot change an answer
// here. (The SHELF itself is oracles.mjs's job — T1/T2/G2/D1.)

const fieldsSection = (sheetId, key, caption, fields) => ({ id: `${sheetId}.${key}`, key, caption, kind: 'fields', fields })
const listSectionOf = (sheetId, key, caption, of, placement = []) => ({ id: `${sheetId}.${key}`, key, caption, kind: 'list', of, placement })
const bookField = (sectionId, key, caption, type, extra = {}) => ({ id: `${sectionId}.${key}`, key, caption, type, ...extra })
const layerOf = (name, edition, requires, files = {}) => ({
  pin: { name, edition },
  manifest: { name, title: name, edition, requires },
  types: files.types ?? null, things: files.things ?? null, proposals: files.proposals ?? null
})
const typesFile     = (types = [], sectionsFor = {}, fieldsFor = {}) => ({ version: 5, types, sectionsFor, fieldsFor })
const thingsFile    = (things) => ({ version: 5, things })
const proposalsFile = (totalBudget, groups, groupRules = {}) => ({ version: 5, totalBudget, groups, groupRules })
const thingOf = (id, name, cost = 0, rest = {}) => ({ id, name, cost, imageURL: '', ...rest })

// ── Basic 1: the seven sheets, structure only (§10.1) ──
const basicFx = () => layerOf('basic', 1, [], { types: typesFile([
  { id: 'basic:character', label: 'Character', sections: [
    fieldsSection('basic:character', 'identity', 'Identity', [bookField('basic:character.identity', 'concept', 'Concept', 'text')]),
    fieldsSection('basic:character', 'attributes', 'Attributes', []),                       // reserved — Stats fills it
    listSectionOf('basic:character', 'origin', 'Origin', 'basic:origin'),
    listSectionOf('basic:character', 'advantages', 'Advantages', 'basic:trait'),
    listSectionOf('basic:character', 'disadvantages', 'Disadvantages', 'basic:trait'),
    listSectionOf('basic:character', 'skills', 'Skills', 'basic:skill', [bookField('basic:character.skills', 'level', 'Level', 'number', { default: 1 })]),
    listSectionOf('basic:character', 'gear', 'Gear', 'basic:item', [bookField('basic:character.gear', 'quantity', 'Quantity', 'number', { default: 1 })]),
    listSectionOf('basic:character', 'companions', 'Companions', 'basic:character'),         // recursion
    listSectionOf('basic:character', 'places', 'Places', 'basic:place'),
    listSectionOf('basic:character', 'ties', 'Ties', 'basic:faction'),
    fieldsSection('basic:character', 'notes', 'Notes', [bookField('basic:character.notes', 'notes', 'Notes (one per line)', 'lines')])
  ] },
  { id: 'basic:item', label: 'Item', sections: [
    fieldsSection('basic:item', 'identity', 'Identity', [bookField('basic:item.identity', 'description', 'Description', 'text')]),
    fieldsSection('basic:item', 'tags', 'Tags', [bookField('basic:item.tags', 'tags', 'Tags (one per line)', 'lines')])
  ] },
  { id: 'basic:place', label: 'Place', sections: [
    fieldsSection('basic:place', 'identity', 'Identity', [bookField('basic:place.identity', 'description', 'Description', 'text')]),
    fieldsSection('basic:place', 'features', 'Features', [bookField('basic:place.features', 'features', 'Features (one per line)', 'lines')]),
    listSectionOf('basic:place', 'within', 'Within', 'basic:place')
  ] },
  { id: 'basic:faction', label: 'Faction', sections: [
    fieldsSection('basic:faction', 'identity', 'Identity', [bookField('basic:faction.identity', 'description', 'Description', 'text')]),
    fieldsSection('basic:faction', 'structure', 'Structure', [bookField('basic:faction.structure', 'structure', 'Structure (one per line)', 'lines')]),
    listSectionOf('basic:faction', 'members', 'Notable members', 'basic:character'),
    listSectionOf('basic:faction', 'holdings', 'Holdings', 'basic:place')
  ] },
  { id: 'basic:origin', label: 'Origin', sections: [fieldsSection('basic:origin', 'identity', 'Identity', [bookField('basic:origin.identity', 'description', 'Description', 'text')])] },
  { id: 'basic:trait', label: 'Trait', sections: [fieldsSection('basic:trait', 'identity', 'Identity', [bookField('basic:trait.identity', 'description', 'Description', 'text')])] },
  { id: 'basic:skill', label: 'Skill', sections: [fieldsSection('basic:skill', 'identity', 'Identity', [bookField('basic:skill.identity', 'description', 'Description', 'text')])] }
]) })

// ── Stats 1: nothing of its own; four attributes into Basic's empty section (§10.2) ──
const ATTRIBUTES = ['strength', 'dexterity', 'intelligence', 'health']
const statsFx = (edition = 1) => layerOf('stats', edition, [{ name: 'basic', edition: 1 }], { types: typesFile([], {}, {
  'basic:character.attributes': ATTRIBUTES.map(key => ({ id: `stats:${key}`, key, caption: key, type: 'number', default: 10 })),
  'basic:skill.identity': [{ id: 'stats:based-on', key: 'basedOn', caption: 'Based on', type: 'choice', options: ['Strength', 'Dexterity', 'Intelligence', 'Health'] }]
}) })

// ── Dinosaur Age: four field additions, a shelf, four proposed rows (§10.3/§10.4) ──
const dinoAgeRows = () => [
  { id: 'dinosaur-age:row-companions', label: 'Companions', query: { type: 'basic:character', where: null }, showWhen: { kind: 'always' }, children: [] },
  { id: 'dinosaur-age:row-gear',       label: 'Gear',       query: { type: 'basic:item', where: null },      showWhen: { kind: 'always' }, children: [] },
  { id: 'dinosaur-age:row-lairs',      label: 'Lairs',      query: { type: 'basic:place', where: { field: 'dinosaur-age:kind', op: 'is', value: 'lair' } },     showWhen: { kind: 'always' }, children: [] },
  { id: 'dinosaur-age:row-locations',  label: 'Locations',  query: { type: 'basic:place', where: { field: 'dinosaur-age:kind', op: 'is', value: 'location' } }, showWhen: { kind: 'anyInRow', row: 'dinosaur-age:row-lairs' }, children: [] }
]
const dinoAgeFx = (edition = 1) => layerOf('dinosaur-age', edition, [{ name: 'basic', edition: 1 }, { name: 'stats', edition: 1 }], {
  types: typesFile([], {}, {
    'basic:origin.identity': [
      { id: 'dinosaur-age:diet', key: 'diet', caption: 'Diet', type: 'choice', options: ['herbivore', 'carnivore', 'omnivore'] },
      { id: 'dinosaur-age:era',  key: 'era',  caption: 'Era',  type: 'choice', options: ['Triassic', 'Jurassic', 'Cretaceous'] }
    ],
    'basic:character.identity': [{ id: 'dinosaur-age:size', key: 'size', caption: 'Size', type: 'choice', options: ['tiny', 'small', 'big', 'biggie'] }],
    'basic:place.identity':     [{ id: 'dinosaur-age:kind', key: 'kind', caption: 'Kind', type: 'choice', options: ['lair', 'location'] }]
  }),
  things: thingsFile({
    'basic:origin': [
      thingOf('dinosaur-age:tyrannosaurus', 'Tyrannosaurus', 0, { description: 'The biggest bite in the Cretaceous.', diet: 'carnivore', era: 'Cretaceous' }),
      thingOf('dinosaur-age:pterosaur', 'Pterosaur', 0, { description: 'Not a dinosaur, technically.', diet: 'carnivore', era: 'Jurassic' })
    ],
    'basic:item': [
      thingOf('dinosaur-age:water-gun', 'Water Gun', 1, { description: 'Strong enough to hit outer space', tags: ['its really fun'] }),
      thingOf('dinosaur-age:dino-skates', 'Dino Skates', 1, { description: 'A dinosaur on roller skates??', tags: ['Goes wheeeeeeee'] }),
      thingOf('dinosaur-age:the-banana', 'THE BANANA', 2, { description: 'Ohhhhh banana!', tags: ['Grind for banana'] }),
      thingOf('dinosaur-age:cute-rock', 'Cute rock', 0, { description: 'It means no harm, I prommy~', tags: ['Super fast'] })
    ],
    'basic:place': [
      thingOf('dinosaur-age:lava-pit', 'Lava Pit', 3, { description: 'So warm! Too warm!!!', kind: 'lair', features: ['Like dino nuggies?'] }),
      thingOf('dinosaur-age:play-pen', 'Play pen', 2, { description: 'Baby dino safe place', kind: 'lair', features: ['Wheeeeeee!'] }),
      ...(edition >= 2 ? [thingOf('dinosaur-age:nest', 'Nest', 1, { description: 'Twigs, warmth, one proud parent.', kind: 'lair', features: ['Cosy'] })] : []),
      thingOf('dinosaur-age:volcano-rim', 'Volcano Rim', 1, { description: 'Toasty!', kind: 'location', features: ['Great views'] })
    ]
  }),
  proposals: proposalsFile(10, dinoAgeRows(), {
    'dinosaur-age:row-companions': { min: 1, max: 1 },
    'dinosaur-age:row-lairs': { min: 1, max: 3 }
  })
})

// ── the §5.3 fault fixture: "dup 1" requires ONLY basic 1 (so Kahn's name
// tie-break puts it before stats and dinosaur-age — the measured lines below
// depend on that), adds fields to a section that does not exist, redefines one
// of Dinosaur Age's things, and proposes a second budget and a second max. ──
const dupFx = () => layerOf('dup', 1, [{ name: 'basic', edition: 1 }], {
  types: typesFile([], {}, { 'basic:nope': [{ id: 'dup:ghost', key: 'ghost', caption: 'Ghost', type: 'text' }] }),
  things: thingsFile({ 'basic:item': [thingOf('dinosaur-age:water-gun', 'Not the water gun', 9)] }),
  proposals: proposalsFile(12, [], { 'dinosaur-age:row-lairs': { max: 2 } })
})

// ── the game: pins the three books, one own sheet, one own thing on a BOOK
// sheet with a placement, one own row, one label override, one arrangement ──
const gameFx = () => ({
  content: { version: 5, meta: { pageTitle: 'Dino', heroTitle: 'Dino' }, books: [{ name: 'basic', edition: 1 }, { name: 'stats', edition: 1 }, { name: 'dinosaur-age', edition: 1 }],
    groups: [{ id: 'own-row', label: 'Own row', query: { type: 'own-sheet', where: null }, showWhen: { kind: 'always' }, children: [] }],
    rowOverrides: { 'dinosaur-age:row-lairs': { label: 'Now select a Lair!' } } },
  rules:  { version: 5, groupRules: {} },
  themes: { version: 5, page: { bodyBackground: '#fff', fontFamily: 'serif', heroImage: '', statusBackground: '#000', statusColor: '#fff' }, groupThemes: {} },
  types:  typesFile([{ id: 'own-sheet', label: 'Own', sections: [fieldsSection('own-sheet', 'identity', 'Identity', [{ id: 'own-sheet.identity.note', key: 'note', caption: 'Note', type: 'text' }])] }]),
  things: { version: 5, things: {
    'basic:character': [thingOf('own-tali', 'Tali', 1, { concept: 'A biggie dino!', size: 'biggie', origin: [{ thing: 'dinosaur-age:tyrannosaurus' }], notes: ['stompies'] })],
    'basic:item': [thingOf('own-hat', 'Party hat', 1, { description: 'Squeak', tags: [] })],
    'own-sheet': [thingOf('own-thing', 'Own thing', 0, { note: '' })]
  }, order: { 'basic:place': ['dinosaur-age:play-pen', 'dinosaur-age:lava-pit'] } }
})
const THREE = () => [basicFx(), statsFx(), dinoAgeFx(1)]
const faultLines = (result) => result.faults.map(problemText)

// ───────────────────────── K1 order-independence and purity ─────────────────────────
{
  const permutations = (list) => list.length <= 1 ? [list] : list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(rest => [item, ...rest]))
  const base = mergeLayers({ books: deepFreeze(THREE()), game: deepFreeze(gameFx()) })
  const perms = permutations([0, 1, 2])
  assert.equal(perms.length, 6)
  perms.forEach(indexes => {
    const books = THREE()
    const game = gameFx()
    const shuffledBooks = indexes.map(i => books[i])
    game.content.books = indexes.map(i => structuredClone(books[i].pin))          // the pins in the same order
    const result = mergeLayers({ books: deepFreeze(shuffledBooks), game: deepFreeze(game) })
    assert.deepEqual(result.set, base.set, `pin order ${indexes}: the same set`)
    assert.deepEqual(result.origins, base.origins, `pin order ${indexes}: the same origins`)
    assert.deepEqual(result.proposed, base.proposed, `pin order ${indexes}: the same proposals`)
    assert.deepEqual(result.order, base.order, `pin order ${indexes}: the same layer order`)
    assert.deepEqual(result.faults, base.faults, `pin order ${indexes}: the same faults`)
  })
  assert.deepEqual(base.faults, [], 'the three books and the game merge with nothing to say')
  assert.deepEqual(base.order, ['basic 1', 'stats 1', 'dinosaur-age 1'])
  ok('K1 order-independence and purity: all 6 permutations of three deep-frozen layers give deep-equal set / origins / proposed / order / faults, and nothing throws')
}

// ───────────────────────── K2 add-only union ─────────────────────────
{
  const { set, origins, order } = mergeLayers({ books: THREE(), game: gameFx() })
  const sheetOf = (id) => set.types.types.find(type => type.id === id)
  const character = sheetOf('basic:character')
  assert.equal(character.sections.length, 11, 'Basic\'s Character sheet keeps its eleven sections')
  const sectionOf = (sheet, id) => sheet.sections.find(section => section.id === id)
  assert.deepEqual(sectionOf(character, 'basic:character.attributes').fields.map(field => field.key), ATTRIBUTES, 'Stats filled Basic\'s empty Attributes section')
  sectionOf(character, 'basic:character.attributes').fields.forEach(field => assert.equal(origins.get(field.id), 'stats 1', `${field.id} came from Stats`))
  assert.deepEqual(sectionOf(character, 'basic:character.identity').fields.map(field => field.key), ['concept', 'size'], 'Dinosaur Age appended size to Basic\'s Identity')
  assert.deepEqual(sectionOf(sheetOf('basic:origin'), 'basic:origin.identity').fields.map(field => field.key), ['description', 'diet', 'era'])
  assert.deepEqual(set.types.types.map(type => type.id), ['basic:character', 'basic:item', 'basic:place', 'basic:faction', 'basic:origin', 'basic:trait', 'basic:skill', 'own-sheet'], 'the books\' sheets in layer order, the game\'s last')
  // things: the book's shelf first, the game's own after
  assert.deepEqual(set.things.things['basic:item'].map(thing => thing.id), ['dinosaur-age:water-gun', 'dinosaur-age:dino-skates', 'dinosaur-age:the-banana', 'dinosaur-age:cute-rock', 'own-hat'])
  set.types.types.forEach(type => assert.ok(Array.isArray(set.things.things[type.id]), `${type.id} has a bucket, even empty`))
  assert.deepEqual(set.things.things['basic:trait'], [], 'a sheet nothing fills still gets one')
  // origins is a TOTAL function over every id of every layer
  assert.equal(origins.get('basic:character'), 'basic 1')
  assert.equal(origins.get('dinosaur-age:size'), 'dinosaur-age 1')
  assert.equal(origins.get('dinosaur-age:water-gun'), 'dinosaur-age 1')
  assert.equal(origins.get('own-tali'), GAME_LAYER, 'the game\'s own things are the game\'s')
  assert.equal(origins.get('own-sheet'), GAME_LAYER)
  assert.equal(GAME_LAYER, 'game')
  assert.equal(bookLabel({ name: 'basic', edition: 1 }), 'basic 1')
  assert.deepEqual(order, ['basic 1', 'stats 1', 'dinosaur-age 1'])
  // ADD-ONLY: every element a book defined is in the merged set unchanged
  const book = dinoAgeFx(1)
  Object.entries(book.things.things).forEach(([sheetId, bucket]) => bucket.forEach(thing =>
    assert.deepEqual(set.things.things[sheetId].find(each => each.id === thing.id), thing, `${thing.id} travelled untouched`)))
  Object.values(book.types.fieldsFor).flat().forEach(field => {
    const merged = set.types.types.flatMap(type => type.sections).flatMap(section => section.fields ?? []).find(each => each.id === field.id)
    assert.deepEqual(merged, field, `${field.id} travelled untouched`)
  })
  basicFx().types.types.forEach(type => type.sections.forEach(section => {
    const mergedSection = sectionOf(sheetOf(type.id), section.id)
    assert.deepEqual(Object.keys(mergedSection), section.kind === 'list' ? ['id', 'key', 'caption', 'kind', 'of', 'placement'] : ['id', 'key', 'caption', 'kind', 'fields'], `${section.id}: canonical key order`)
    if (section.kind === 'list') assert.deepEqual(mergedSection.placement, section.placement, `${section.id}: its placement fields, untouched`)
  }))
  // the output is a plain, BOOKLESS v5 set
  assert.deepEqual(set.content.books, [])
  assert.deepEqual(set.content.rowOverrides, {})
  assert.deepEqual([set.types.sectionsFor, set.types.fieldsFor], [{}, {}])
  assert.equal(set.things.order, undefined, 'the arrangement has been applied, not carried')
  FILE_NAMES.forEach(name => assert.equal(set[name].version, 5))
  assert.deepEqual(validateSet(set), [], 'and the flattened world fits the contract on its own')
  ok(`K2 add-only union: ${set.types.types.length} sheets, Character's 11 sections with Stats' 4 attributes and Dinosaur Age's size; every merged sheet gets a bucket; origins is total (${origins.size} ids); every book element deep-equals its own copy; the output is bookless and canonical`)
}

// a bare game that pins exactly these layers, in this order — emptyGame() plus
// the pins, so nothing of the game's own can be mistaken for a book's
const pinning = (layers, pins = null) => {
  const game = emptyGame()
  game.content.books = pins ?? layers.map(layer => structuredClone(layer.pin))
  return game
}
// the ONE fault a case is about, as "<path>: <message>"
const oneFault = (layers, game, label) => {
  const { faults } = mergeLayers({ books: layers, game })
  assert.equal(faults.length, 1, `${label}: exactly one fault (got ${JSON.stringify(faults)})`)
  return problemText(faults[0])
}
// "zz" sorts after every other fixture book, so Kahn places it LAST: whatever it
// repeats, the OTHER definition is the first one and the survivor
const zzFx = (files) => layerOf('zz', 1, [{ name: 'basic', edition: 1 }], files)
const withZZ = (files) => [basicFx(), statsFx(), dinoAgeFx(1), zzFx(files)]

// ───────────────────────── K3 duplicates (F6) ─────────────────────────
// An id may be defined ONCE, by one layer. That is what makes `origins` a total
// function and the editor's badge honest — so a repeat is never a silent winner.
{
  const dup = (id, by) => `duplicate id ${JSON.stringify(id)} — already defined by ${by}; this one is skipped`
  const cases = [
    ['a sheet',           { types: typesFile([{ id: 'basic:item', label: 'Not the item', sections: [] }]) },
                          'books["zz"].types.types[0].id', dup('basic:item', 'basic 1')],
    ['a section',         { types: typesFile([], { 'basic:item': [fieldsSection('basic:item', 'tags', 'Tags again', [])] }) },
                          'books["zz"].types.sectionsFor["basic:item"][0].id', dup('basic:item.tags', 'basic 1')],
    ['a field',           { types: typesFile([], {}, { 'basic:item.tags': [bookField('basic:item.identity', 'description', 'Again', 'text')] }) },
                          'books["zz"].types.fieldsFor["basic:item.tags"][0].id', dup('basic:item.identity.description', 'basic 1')],
    ['a placement field', { types: typesFile([{ id: 'zz:sheet', label: 'ZZ', sections: [listSectionOf('zz:sheet', 'crew', 'Crew', 'basic:character', [bookField('basic:character.skills', 'level', 'Level', 'number')])] }]) },
                          'books["zz"].types.types[0].sections[0].placement[0].id', dup('basic:character.skills.level', 'basic 1')],
    ['a thing',           { things: thingsFile({ 'basic:item': [thingOf('dinosaur-age:water-gun', 'Not the water gun', 9)] }) },
                          'books["zz"].things.things["basic:item"][0].id', dup('dinosaur-age:water-gun', 'dinosaur-age 1')],
    ['a proposed row',    { proposals: proposalsFile(undefined, [{ id: 'dinosaur-age:row-gear', label: 'Gear again', query: { type: 'basic:item', where: null }, showWhen: { kind: 'always' }, children: [] }]) },
                          'books["zz"].proposals.groups[0].id', dup('dinosaur-age:row-gear', 'dinosaur-age 1')]
  ]
  cases.forEach(([label, files, path, message]) => {
    const layers = withZZ(files)
    assert.equal(oneFault(layers, pinning(layers), label), `${path}: ${message}`, label)
  })
  // the FIRST definition survives, untouched
  const layers = withZZ({ types: typesFile([{ id: 'basic:item', label: 'Not the item', sections: [] }]), things: thingsFile({ 'basic:item': [thingOf('dinosaur-age:water-gun', 'Not the water gun', 9)] }) })
  const { set, origins } = mergeLayers({ books: layers, game: pinning(layers) })
  assert.equal(set.types.types.find(type => type.id === 'basic:item').label, 'Item', 'Basic\'s sheet is the one that survives')
  assert.deepEqual(set.things.things['basic:item'].map(thing => `${thing.name} ${thing.cost}`)[0], 'Water Gun 1', 'and Dinosaur Age\'s thing, at its own cost')
  assert.equal(origins.get('basic:item'), 'basic 1')
  assert.equal(origins.get('dinosaur-age:water-gun'), 'dinosaur-age 1')
  // and a GAME row may not reuse a proposed row's id either — the same id space
  const game = pinning(THREE())
  game.content.groups = [{ id: 'dinosaur-age:row-gear', label: 'Mine', query: { type: '', where: null }, showWhen: { kind: 'always' }, children: [] }]
  assert.equal(oneFault(THREE(), game, 'a game row'), `content.groups[0].id: ${dup('dinosaur-age:row-gear', 'dinosaur-age 1')}`)
  ok(`K3 duplicates (F6): ${cases.length + 1} repeats — a sheet, a section, a field, a placement field, a thing, a proposed row and a game row reusing one — each ONE fault at the catalogue's path; the first definition survives`)
}

// ───────────────────────── K4 bad additions (F7–F12) ─────────────────────────
{
  const cases = [
    ['F7 sections to no sheet',  { types: typesFile([], { 'basic:nope': [fieldsSection('zz:sheet', 'extra', 'Extra', [])] }) },
      'books["zz"].types.sectionsFor["basic:nope"]', 'adds sections to a sheet that does not exist (basic:nope); they are skipped'],
    ['F8 fields to no section',  { types: typesFile([], {}, { 'basic:nope': [bookField('zz:x', 'x', 'X', 'text')] }) },
      'books["zz"].types.fieldsFor["basic:nope"]', 'adds fields to a section that does not exist (basic:nope); they are skipped'],
    ['F9 fields to a LIST section', { types: typesFile([], {}, { 'basic:character.origin': [bookField('zz:x', 'x', 'X', 'text')] }) },
      'books["zz"].types.fieldsFor["basic:character.origin"]', 'adds fields to a list section (basic:character.origin) — only a field section holds fields; they are skipped'],
    ['F10 a key already used',   { types: typesFile([], {}, { 'basic:character.identity': [bookField('zz:c', 'concept', 'Concept again', 'text')] }) },
      'books["zz"].types.fieldsFor["basic:character.identity"][0].key', 'key "concept" is already used on sheet basic:character; the field is skipped'],
    ['F11 a list of no shelf',   { types: typesFile([{ id: 'zz:sheet', label: 'ZZ', sections: [listSectionOf('zz:sheet', 'crew', 'Crew', 'basic:nope')] }]) },
      'books["zz"].types.types[0].sections[0].of', 'lists entries of a sheet that does not exist (basic:nope); the section offers nothing'],
    ['F12 a book bucket of no sheet', { things: thingsFile({ 'basic:nope': [thingOf('zz:lost', 'Lost')] }) },
      'books["zz"].things.things["basic:nope"]', 'holds things of a sheet that does not exist (basic:nope); they are skipped']
  ]
  cases.forEach(([label, files, path, message]) => {
    const layers = withZZ(files)
    assert.equal(oneFault(layers, pinning(layers), label), `${path}: ${message}`, label)
    // the REST still merges: Basic's sheets are all there and Dinosaur Age's shelf is full
    const { set } = mergeLayers({ books: layers, game: pinning(layers) })
    assert.equal(set.types.types.filter(type => type.id.startsWith('basic:')).length, 7, `${label}: the other seven sheets merged`)
    assert.equal(set.things.things['basic:item'].length, 4, `${label}: and the shelf is untouched`)
  })
  // F11: the section STAYS (it holds the values things already store under its key) and offers nothing
  const f11 = withZZ({ types: typesFile([{ id: 'zz:sheet', label: 'ZZ', sections: [listSectionOf('zz:sheet', 'crew', 'Crew', 'basic:nope')] }]) })
  const { set: f11set } = mergeLayers({ books: f11, game: pinning(f11) })
  const zzSheet = f11set.types.types.find(type => type.id === 'zz:sheet')
  assert.equal(listSectionsOf(zzSheet).length, 1, 'the list section stays')
  assert.equal(f11set.things.things['basic:nope'], undefined, 'and its shelf is simply not there — hydrate reads that as empty')
  // F12's twin that is NOT a fault: the GAME's orphan bucket is a leftover, carried through
  const orphanGame = pinning(THREE())
  orphanGame.things.things['x-nope'] = [thingOf('x-one', 'One')]
  const orphan = mergeLayers({ books: THREE(), game: orphanGame })
  assert.deepEqual(orphan.faults, [], 'un-pinning a book leaves an orphan bucket — never a fault (§5.4)')
  assert.deepEqual(orphan.set.things.things['x-nope'].map(thing => thing.id), ['x-one'], 'and it is carried through untouched')
  // F2b: a book file written for another version takes the WHOLE book with it
  const stale = withZZ({ types: { version: 4, types: [], sectionsFor: {}, fieldsFor: {} } })
  const staleResult = mergeLayers({ books: stale, game: pinning(stale) })
  assert.deepEqual(faultLines(staleResult), ['books["zz"].types.version: must be 5 (found 4) — this book was written for another version; the book is skipped'])
  assert.equal([...staleResult.origins.values()].includes('zz 1'), false, 'nothing of a skipped book reaches origins')
  assert.equal(staleResult.order.includes('zz 1'), false, 'nor the layer order')
  ok(`K4 bad additions: F7–F12 each ONE fault at the catalogue's path with the rest still merged; F11 keeps the section and offers nothing; a GAME orphan bucket is a leftover, not a fault; a book file at version 4 is F2b and the whole book is skipped`)
}

// ───────────────────────── K5 pins and requires (F1–F5) ─────────────────────────
{
  // F1: a pin the shelf could not answer — the loader hands the merge a null
  const missingPins = [...THREE().map(layer => layer.pin), { name: 'nope', edition: 3 }]
  const missing = mergeLayers({ books: [...THREE(), null], game: pinning([], missingPins) })
  assert.deepEqual(faultLines(missing), ['content.books[3]: "nope" 3 is not on the shelf; the book is skipped'])
  // F2: the folder and the manifest disagree
  const wrong = dinoAgeFx(1)
  wrong.pin = { name: 'dinosaur-age', edition: 2 }
  const wrongLayers = [basicFx(), statsFx(), wrong]
  assert.deepEqual(faultLines(mergeLayers({ books: wrongLayers, game: pinning(wrongLayers) })),
    ['content.books[2]: "dinosaur-age" 2 has a book.json that says "dinosaur-age" 1; the book is skipped'])
  // F3: a requirement that is not pinned at all — and NOTHING of the book arrives
  const noStats = [basicFx(), dinoAgeFx(1)]
  const withoutStats = mergeLayers({ books: noStats, game: pinning(noStats) })
  assert.deepEqual(faultLines(withoutStats), ['content.books[1]: "dinosaur-age" 1 requires "stats" 1 — not pinned; the book is skipped'])
  assert.deepEqual(withoutStats.order, ['basic 1'])
  assert.equal([...withoutStats.origins.values()].includes('dinosaur-age 1'), false)
  assert.deepEqual(withoutStats.set.content.groups, [], 'no proposed rows')
  assert.deepEqual(withoutStats.set.things.things['basic:item'], [], 'no things')
  assert.equal(withoutStats.set.types.types.find(type => type.id === 'basic:place').sections[0].fields.length, 1, 'and no field additions')
  // F4: pinned, but at another edition
  const wrongEdition = [basicFx(), statsFx(2), dinoAgeFx(1)]
  assert.deepEqual(faultLines(mergeLayers({ books: wrongEdition, game: pinning(wrongEdition) })),
    ['content.books[2]: "dinosaur-age" 1 requires "stats" 1 — this game pins edition 2; the book is skipped'])
  // F5: a cycle
  const cycA = layerOf('cyc-a', 1, [{ name: 'cyc-b', edition: 1 }])
  const cycB = layerOf('cyc-b', 1, [{ name: 'cyc-a', edition: 1 }])
  const cycle = [cycA, cycB]
  assert.deepEqual(faultLines(mergeLayers({ books: cycle, game: pinning(cycle) })),
    ['content.books: books require each other in a cycle: cyc-a 1, cyc-b 1; they are skipped'])
  // the ORDER is computed from `requires`, ties by name — never the pin order
  const labelsOf = (layers) => orderBooks(layers).ordered.map(layer => bookLabel(layer.manifest))
  assert.deepEqual(labelsOf(THREE()), ['basic 1', 'stats 1', 'dinosaur-age 1'])
  assert.deepEqual(labelsOf([...THREE()].reverse()), ['basic 1', 'stats 1', 'dinosaur-age 1'], 'the reversed input orders the same')
  assert.deepEqual(labelsOf([dinoAgeFx(1), basicFx(), statsFx()]), ['basic 1', 'stats 1', 'dinosaur-age 1'])
  const zebra = layerOf('zebra', 1, []), apple = layerOf('apple', 1, [])
  assert.deepEqual(labelsOf([zebra, apple]), ['apple 1', 'zebra 1'], 'unrelated books sort by name')
  assert.deepEqual(labelsOf([...THREE(), zebra, apple]), ['apple 1', 'basic 1', 'stats 1', 'dinosaur-age 1', 'zebra 1'], 'the ready set is re-taken smallest-name-first after every placement')
  assert.deepEqual(orderBooks([]).ordered, [])
  ok('K5 pins and requires: F1 a pin the shelf cannot answer, F2 a manifest that disagrees with its folder, F3 a requirement not pinned (nothing of the book arrives), F4 the wrong edition, F5 a cycle; orderBooks is computed from requires, ties by name, whatever the pin order')
}

// ───────────────────────── K6 conflicts (F13/F14) ─────────────────────────
// Two books proposing DIFFERENT values for one key is the one thing the merge
// cannot settle. It never picks quietly: it uses the first in layer order AND
// says so — unless the game has already written its own value at that key.
{
  const proposer = (budget, max) => zzFx({ proposals: proposalsFile(budget, [], max === undefined ? {} : { 'dinosaur-age:row-lairs': { max } }) })
  const runWith = (zz, gameEdit = () => {}) => {
    const layers = [...THREE(), zz]
    const game = pinning(layers)
    gameEdit(game)
    return mergeLayers({ books: layers, game })
  }
  // F14 — the budget
  const budgets = runWith(proposer(12))
  assert.deepEqual(faultLines(budgets), ['rules.totalBudget: dinosaur-age 1 proposes 10, zz 1 proposes 12 — this game must set its own budget (using 10, the first)'])
  assert.equal(budgets.set.rules.totalBudget, 10, 'the FIRST proposal in layer order is used')
  assert.deepEqual(budgets.proposed.totalBudget, { value: 10, from: 'dinosaur-age 1', conflict: ['dinosaur-age 1', 'zz 1'] })
  const decidedBudget = runWith(proposer(12), game => { game.rules.totalBudget = 11 })
  assert.deepEqual(faultLines(decidedBudget), [], 'the game decided: there is nothing left to say')
  assert.equal(decidedBudget.set.rules.totalBudget, 11)
  assert.deepEqual(decidedBudget.proposed.totalBudget.conflict, ['dinosaur-age 1', 'zz 1'], 'but the editor still shows who proposed what')
  assert.deepEqual(faultLines(runWith(proposer(10))), [], 'the same budget twice is agreement, not conflict')
  assert.equal(runWith(proposer(undefined)).set.rules.totalBudget, 10, 'a book that proposes none says nothing')
  // F13 — a rule on a row
  const maxes = runWith(proposer(undefined, 2))
  assert.deepEqual(faultLines(maxes), ['rules.groupRules["dinosaur-age:row-lairs"].max: dinosaur-age 1 and zz 1 propose different values for max of row dinosaur-age:row-lairs — this game must set its own (using 3, the first)'])
  assert.deepEqual(maxes.set.rules.groupRules['dinosaur-age:row-lairs'], { min: 1, max: 3 }, 'the first proposal wins, and the un-conflicted min still cascades')
  assert.deepEqual(maxes.proposed.rules['dinosaur-age:row-lairs'].max, { value: 3, from: 'dinosaur-age 1', conflict: ['dinosaur-age 1', 'zz 1'] }, 'proposed names the winner')
  assert.deepEqual(maxes.proposed.rules['dinosaur-age:row-lairs'].min, { value: 1, from: 'dinosaur-age 1' }, 'and a key nobody disputes carries no conflict')
  assert.deepEqual(faultLines(runWith(proposer(undefined, 3))), [], 'the same max twice is agreement')
  const decidedMax = runWith(proposer(undefined, 2), game => { game.rules.groupRules['dinosaur-age:row-lairs'] = { max: 4 } })
  assert.deepEqual(faultLines(decidedMax), [])
  assert.deepEqual(decidedMax.set.rules.groupRules['dinosaur-age:row-lairs'], { min: 1, max: 4 }, 'the game decided max; min still shows through')
  // §5.3's fault fixture, verbatim: "dup 1" requires ONLY basic 1, so Kahn's name
  // tie-break places it before stats and dinosaur-age — which is what makes it
  // the FIRST proposer and the first definer of the water gun.
  const dupLayers = [basicFx(), statsFx(), dinoAgeFx(1), dupFx()]
  const dupGame = pinning(dupLayers)
  const dupResult = mergeLayers({ books: dupLayers, game: dupGame })
  assert.deepEqual(dupResult.order, ['basic 1', 'dup 1', 'stats 1', 'dinosaur-age 1'], '"dup" < "stats": the tie-break decides the whole fixture')
  assert.deepEqual(faultLines(dupResult), [
    'books["dup"].types.fieldsFor["basic:nope"]: adds fields to a section that does not exist (basic:nope); they are skipped',
    'books["dinosaur-age"].things.things["basic:item"][0].id: duplicate id "dinosaur-age:water-gun" — already defined by dup 1; this one is skipped',
    'rules.groupRules["dinosaur-age:row-lairs"].max: dup 1 and dinosaur-age 1 propose different values for max of row dinosaur-age:row-lairs — this game must set its own (using 2, the first)',
    'rules.totalBudget: dup 1 proposes 12, dinosaur-age 1 proposes 10 — this game must set its own budget (using 12, the first)'
  ], 'the four measured lines of §5.3, in order')
  const dupDecided = pinning(dupLayers)
  dupDecided.rules.totalBudget = 11
  dupDecided.rules.groupRules['dinosaur-age:row-lairs'] = { max: 3 }
  assert.equal(mergeLayers({ books: dupLayers, game: dupDecided }).faults.length, 2, 'once the game decides both, only the two add-only faults remain')
  ok('K6 conflicts: F14 (budget) and F13 (a row\'s max) verbatim, the first in layer order used and said so; the same value twice is agreement; a game value removes the fault but not the "X proposes …" line; §5.3\'s four measured lines, in order')
}

// ───────────────────────── K7 the cascade and the arrangement ─────────────────────────
{
  const treeRow = () => ({ id: 'tree:parent', label: 'Parent', query: { type: 'tree:s', where: null }, showWhen: { kind: 'always' },
    children: [{ id: 'tree:child', label: 'Child', query: { type: 'tree:s', where: null }, showWhen: { kind: 'anyInRow', row: 'tree:parent' }, children: [] }] })
  const treeBook = () => layerOf('tree', 1, [], {
    types: typesFile([{ id: 'tree:s', label: 'S', sections: [fieldsSection('tree:s', 'identity', 'Identity', [])] }]),
    things: thingsFile({ 'tree:s': [thingOf('tree:one', 'One'), thingOf('tree:two', 'Two'), thingOf('tree:three', 'Three')] }),
    proposals: proposalsFile(undefined, [treeRow()], { 'tree:parent': { min: 1, max: 3 } })
  })
  const run = (edit = () => {}) => {
    const layers = [treeBook()]
    const game = pinning(layers)
    edit(game)
    return mergeLayers({ books: layers, game })
  }
  const parentOf = (result) => result.set.content.groups.find(each => each.id === 'tree:parent')
  const proposal = treeRow()
  // per KEY: what the game wrote wins, what it did not lets the proposal through
  ;[['label', 'Now select a Lair!'], ['query', { type: 'tree:s', where: { field: 'core:cost', op: 'gte', value: 1 } }], ['showWhen', { kind: 'never-mind' }]].forEach(([key, value]) => {
    const result = run(game => { game.content.rowOverrides['tree:parent'] = { [key]: value } })
    const row = parentOf(result)
    assert.deepEqual(row[key], value, `the game's ${key} wins`)
    assert.deepEqual(Object.keys(row), ['id', 'label', 'query', 'showWhen', 'children'], 'the merged row is canonical')
    ;['id', 'label', 'query', 'children'].filter(other => other !== key).forEach(other =>
      assert.deepEqual(row[other], other === 'children' ? [{ ...proposal.children[0] }] : proposal[other], `${key} replaces ${key} and nothing else (${other} is still the book's)`))
  })
  // hidden: the row AND everything nested in it leave content.groups — but the
  // editor still sees the proposal, so [Show] has something to put back
  const hidden = run(game => { game.content.rowOverrides['tree:parent'] = { hidden: true } })
  assert.deepEqual(hidden.set.content.groups, [])
  assert.deepEqual(hidden.proposed.rows.map(entry => entry.row.id), ['tree:parent'])
  assert.deepEqual(hidden.proposed.rows[0], { row: proposal, from: 'tree 1' }, 'proposed carries the RAW, un-overridden row')
  assert.deepEqual(faultLines(hidden), [])
  // the rules cascade, per key
  assert.deepEqual(run().set.rules.groupRules['tree:parent'], { min: 1, max: 3 }, 'absent → the proposal, whole')
  assert.deepEqual(run(game => { game.rules.groupRules['tree:parent'] = { min: 2 } }).set.rules.groupRules['tree:parent'], { min: 2, max: 3 }, 'one key over the proposal, not instead of it')
  // an override for a row nobody proposes is a leftover, never a fault (§5.4)
  assert.deepEqual(faultLines(run(game => { game.content.rowOverrides['gone'] = { label: 'x' } })), [])
  // themes ride through untouched; own rows come after the proposed ones
  const full = mergeLayers({ books: THREE(), game: gameFx() })
  assert.deepEqual(full.set.themes, gameFx().themes, 'themes are the game\'s, untouched')
  assert.deepEqual(full.set.content.groups.map(row => row.id), ['dinosaur-age:row-companions', 'dinosaur-age:row-gear', 'dinosaur-age:row-lairs', 'dinosaur-age:row-locations', 'own-row'])
  assert.equal(full.set.content.groups[2].label, 'Now select a Lair!', 'the game\'s one label override landed')
  // the ARRANGEMENT: the ids the game lists come first, in that order; the rest follows in merge order
  const arranged = run(game => { game.things.order = { 'tree:s': ['tree:three', 'tree:one'] } })
  assert.deepEqual(arranged.set.things.things['tree:s'].map(thing => thing.id), ['tree:three', 'tree:one', 'tree:two'])
  assert.deepEqual(faultLines(arranged), [])
  assert.equal(arranged.set.things.order, undefined, 'and no `order` key survives — it has been applied')
  const strays = run(game => { game.things.order = { 'tree:s': ['tree:three', 'tree:gone'], 'nope': ['x'] } })
  assert.deepEqual(faultLines(strays), [
    'things.order["tree:s"][1]: arranges a thing that is not on shelf tree:s (tree:gone); it is ignored',
    'things.order["nope"]: arranges a shelf that does not exist (nope); it is ignored'
  ])
  assert.deepEqual(strays.set.things.things['tree:s'].map(thing => thing.id), ['tree:three', 'tree:one', 'tree:two'], 'and the rest is arranged anyway')
  // with NO books and NO arrangement the merge is the identity, file by file
  const alone = mergeLayers({ books: [], game: H() })
  assert.deepEqual(faultLines(alone), [])
  FILE_NAMES.forEach(name => assert.deepEqual(alone.set[name], H()[name], `${name}: a book-less game merges to itself`))
  assert.deepEqual(alone.order, [])
  assert.deepEqual(alone.proposed, { rows: [], rules: {}, totalBudget: null })
  ok('K7 the cascade and the arrangement: label / query / showWhen replaced per key and nothing else; hidden drops the subtree but `proposed` keeps it; { min: 2 } over a proposed { min: 1, max: 3 }; an orphan override is no fault; own rows follow proposed ones; things.order arranges and F15 names what it could not; a book-less game merges to itself')
}

// ───────────────────────── K8 flatten fixed point ─────────────────────────
// What makes a published folder honest: merging a flattened game with no books
// gives the same five files back — so the dist engine and the live engine are
// running the same code over the same shapes.
{
  const flat = flattenGame({ books: THREE(), game: gameFx() })
  const again = mergeLayers({ books: [], game: flat })
  assert.deepEqual(again.set, flat, 'flatten is a fixed point')
  assert.deepEqual(again.faults, [])
  assert.deepEqual(validateSet(flat), [], 'and the flattened set fits the contract on its own')
  assert.deepEqual(flat.content.books, [])
  assert.deepEqual(flat.content.rowOverrides, {})
  assert.deepEqual([flat.types.sectionsFor, flat.types.fieldsFor], [{}, {}])
  assert.equal(flat.things.order, undefined, 'no `order` key — the folder needs no shelf and no arrangement')
  assert.deepEqual(flat.things.things['basic:place'].map(thing => thing.id), ['dinosaur-age:play-pen', 'dinosaur-age:lava-pit', 'dinosaur-age:volcano-rim'], 'the arranged order is baked into the bucket')
  assert.deepEqual(Object.keys(flat.content), ['version', 'meta', 'books', 'groups', 'rowOverrides'])
  assert.deepEqual(Object.keys(flat.rules), ['version', 'totalBudget', 'groupRules'])
  assert.deepEqual(Object.keys(flat.types), ['version', 'types', 'sectionsFor', 'fieldsFor'])
  assert.deepEqual(Object.keys(flat.things), ['version', 'things'])
  assert.equal(flat.rules.totalBudget, 10, 'Dinosaur Age\'s proposed budget is baked in')
  ok('K8 flatten fixed point: mergeLayers({ books: [], game: flattenGame(x) }).set deep-equals flattenGame(x); it validates alone; the arrangement is baked into the buckets and no `order` key is left')
}

// ───────────────────────── K9 the three validators ─────────────────────────
{
  // validateSet IS validateGame with no books — written as the special case it
  // is, so "a game with no books" can never drift from "a game"
  const mutations = [
    ['healthy',                s => s],
    ['an old version',         s => { s.content.version = 4 }],
    ['a dangling type',        s => { s.content.groups[0].query.type = 'type-gone' }],
    ['a dangling gate',        s => { s.content.groups[2].showWhen.row = 'r-gone' }],
    ['a duplicate row id',     s => { s.content.groups[0].children[0].id = 'R2' }],
    ['a reserved field key',   s => { s.types.types[0].sections[0].fields.push({ id: 'f-n', key: 'name', caption: 'N', type: 'text' }) }],
    ['a missing file',         s => { s.types = null }],
    ['two faults on one row',  s => { s.content.groups[3].query.type = 'type-gone'; s.content.groups[3].showWhen = { kind: 'anyInRow', row: 'r-gone' } }]
  ]
  mutations.forEach(([label, mutate]) => {
    const a = H(); mutate(a)
    const b = H(); mutate(b)
    assert.deepEqual(validateSet(a), validateGame({ own: b, books: [] }), `${label}: validateSet is validateGame with no books`)
  })
  assert.deepEqual(validateSet(H()), [])
  // a game judged WITH its books: a row may legitimately show a book's sheet
  const bookRow = pinning(THREE())
  bookRow.content.groups = [{ id: 'own-row', label: 'Pets', query: { type: 'basic:character', where: { field: 'dinosaur-age:size', op: 'is', value: 'biggie' } }, showWhen: { kind: 'always' }, children: [] }]
  assert.deepEqual(validateGame({ own: bookRow, books: THREE() }), [], 'a row showing basic:character with a filter on dinosaur-age:size fits — the merge knows both')
  assert.deepEqual(validateSet(bookRow).map(problem => problem.path), ['content.groups[0].query.type'], 'and the very same game WITHOUT its books does not')
  assert.deepEqual(validateGame({ own: gameFx(), books: THREE() }), [], 'the whole fixture game fits')
  const brokenPin = gameFx()
  brokenPin.content.books.push({ name: 'nope', edition: 3 })
  assert.deepEqual(validateGame({ own: brokenPin, books: [...THREE(), null] }), [{ path: 'content.books[3]', message: '"nope" 3 is not on the shelf; the book is skipped' }], 'a merge fault is a problem like any other')

  // validateBook — the three fixtures, and the sentences no sheet can say
  const shelf = { basic: { 1: basicFx() }, stats: { 1: statsFx() } }
  assert.deepEqual(validateBook(basicFx(), {}), [], 'Basic 1 fits')
  assert.deepEqual(validateBook(statsFx(), shelf), [], 'Stats 1 fits, against Basic')
  assert.deepEqual(validateBook(dinoAgeFx(1), shelf), [], 'Dinosaur Age 1 fits, against Basic and Stats')
  assert.deepEqual(validateBook(dinoAgeFx(2), shelf), [], 'and so does edition 2')
  const bookCase = (label, edit, expected) => {
    const book = statsFx()
    edit(book)
    assert.deepEqual(validateBook(book, shelf).map(problemText), expected, label)
  }
  bookCase('an id outside the namespace', book => { book.types.fieldsFor['basic:character.attributes'][0].id = 'basic:strength' },
    ['types.fieldsFor["basic:character.attributes"][0].id: "basic:strength" is not in this book\'s namespace (stats:)'])
  bookCase('an id that is not the grammar', book => { book.types.fieldsFor['basic:character.attributes'][0].id = 'stats:Strength' },
    ['types.fieldsFor["basic:character.attributes"][0].id: "stats:Strength" does not fit the id grammar (<book>:<slug>, lowercase, dots and dashes)'])
  bookCase('a manifest that is not its folder', book => { book.manifest.name = 'statz' },
    ['book.name: must be "stats" — the folder\'s name (found "statz")'])
  bookCase('a manifest at another edition', book => { book.manifest.edition = 2 },
    ['book.edition: must be 1 — the folder\'s edition (found 2)'])
  bookCase('a book that requires itself', book => { book.manifest.requires = [{ name: 'stats', edition: 1 }] },
    ['book.requires[0]: a book cannot require itself'])
  bookCase('a book that arranges a shelf', book => { book.things = { version: 5, things: {}, order: { 'basic:place': ['x'] } } },
    ['things.order: a book may not arrange a shelf (order is the game\'s)'])
  // a requirement the shelf cannot answer: the merge names it at book.requires[i]
  assert.deepEqual(validateBook(statsFx(), {}).map(problemText), ['book.requires[0]: "basic" 1 is not on the shelf'])
  // a reference no required book defines — the merge's own cross pass, over the book
  const solo = layerOf('solo', 1, [{ name: 'basic', edition: 1 }], { proposals: proposalsFile(undefined, [
    { id: 'solo:row', label: 'Row', query: { type: 'basic:place', where: { field: 'nope:kind', op: 'is', value: 'lair' } }, showWhen: { kind: 'always' }, children: [] }
  ]) })
  assert.deepEqual(validateBook(solo, shelf).map(problemText), ['content.groups[0].query.where: filter names a field that does not exist (nope:kind)'])
  // and a SHAPE problem carries the book's coordinates, and stops the walk
  const badShape = statsFx()
  badShape.types.fieldsFor['basic:character.attributes'][0].type = 'date'
  assert.deepEqual(validateBook(badShape, shelf).map(problem => problem.path), ['books["stats"].types.fieldsFor["basic:character.attributes"][0].type'])
  ok('K9 validators: validateSet IS validateGame({ books: [] }) over 8 mutations; a game judged WITH its books accepts a row showing a book sheet and WITHOUT them does not; the three fixtures pass validateBook; namespace, grammar, folder name, edition, self-requirement, a book arranging a shelf, an unmet requirement and a dangling filter each get their sentence')
}

// ═════════════════════════ the manager: N1–N3 ═════════════════════════
// The editor's address grammar and the server's games/books modules are pure
// functions, so they are pinned here, in milliseconds, before the slow half
// proves the same answers over HTTP (oracles.mjs, M1–M12).

// ───────────────────────── N1 hash grammar ─────────────────────────
{
  // the table of §7: every shape of hash → { game, tab, selectedType }
  const home = { game: '', tab: 'rows', selectedType: '' }
  const table = [
    ['',                 home],
    ['#',                home],
    ['#home',            home],
    ['#home/rows',       home],
    ['#dino',            { game: 'dino', tab: 'rows',   selectedType: '' }],
    ['#dino/books',      { game: 'dino', tab: 'books',  selectedType: '' }],     // NEW: the fourth tab
    ['#dino/types',      { game: 'dino', tab: 'types',  selectedType: '' }],
    ['#dino/things/abc', { game: 'dino', tab: 'things', selectedType: 'abc' }],
    ['#dino/rows/abc',   { game: 'dino', tab: 'rows',   selectedType: '' }],     // a type id only means something on Things
    ['#dino/books/abc',  { game: 'dino', tab: 'books',  selectedType: '' }],
    ['#dino/nope',       { game: 'dino', tab: 'rows',   selectedType: '' }],     // an unknown tab is Rows
    ['#dino/things',     { game: 'dino', tab: 'things', selectedType: '' }]
  ]
  table.forEach(([hash, expected]) => assert.deepEqual(parseHash(hash), expected, `parseHash(${JSON.stringify(hash)})`))
  assert.deepEqual(TABS.map(([id]) => id), ['books', 'types', 'things', 'rows'], 'four tabs, Books FIRST — the question before every other one')
  // round trip: what hashFor writes, parseHash reads back — for every tab
  uiState.game = 'dino'
  assert.equal(hashFor('things', 'abc'), '#dino/things/abc')
  assert.equal(hashFor('types'), '#dino/types')
  assert.equal(hashFor('books'), '#dino/books')
  TABS.forEach(([id]) => {
    const typeId = id === 'things' ? 'abc' : ''
    assert.deepEqual(parseHash(hashFor(id, typeId)), { game: 'dino', tab: id, selectedType: typeId }, `hashFor(${id}) round-trips`)
  })
  ok(`N1 hash grammar: ${table.length} hashes parse as tabled (home, bare game → Rows, unknown tab → Rows, type id only on Things); TABS = books, types, things, rows; hashFor round-trips for ${TABS.length} tabs`)
}

// ───────────────────────── N2 names ─────────────────────────
{
  const slugs = [
    ['Space Pirates!',     'space-pirates'],
    [' Ünïcode Café ',     'unicode-cafe'],
    ['--a--b--',           'a-b'],
    ['A1',                 'a1'],
    ['!!!',                ''],
    ['..',                 ''],
    ['Adopt a Dino! CYOA', 'adopt-a-dino-cyoa']
  ]
  slugs.forEach(([title, slug]) => assert.equal(slugOf(title), slug, `slugOf(${JSON.stringify(title)})`))
  // titleProblems: [] for a fine title; exactly ONE problem, at "title", for every refusal
  const fine = ['Dino', 'x'.repeat(40)]
  fine.forEach(title => assert.deepEqual(titleProblems(title), [], `${JSON.stringify(title)} is a fine title`))
  const refused = ['', '   ', 42, null, undefined, '!!!', 'x'.repeat(41), ...RESERVED, ...RESERVED.map(word => word.toUpperCase())]
  refused.forEach(title => {
    const problems = titleProblems(title)
    assert.equal(problems.length, 1, `${JSON.stringify(title)}: one problem`)
    assert.equal(problems[0].path, 'title')
    assert.ok(problems[0].message.length > 0)
  })
  // isGameName: the folder-and-URL grammar, both sides of the line
  const yes = ['dino', 'my-cyoa-2', 'a'.repeat(40), 'types', 'api']
  const no  = ['Dino', '..', '.', 'a b', '-a', 'a-', 'a--b', '', 'a/b', '%2e%2e', 'a.b', 'a'.repeat(41), 42, null]
  yes.forEach(name => assert.equal(isGameName(name), true,  `${JSON.stringify(name)} is a game name`))
  no.forEach(name  => assert.equal(isGameName(name), false, `${JSON.stringify(name)} is not a game name`))
  assert.equal(NAME_MAX, 40)
  assert.ok(NAME instanceof RegExp)
  // the two grammars agree, by test: every title the server would accept slugs to a name the URL accepts
  const accepted = [...slugs.map(([title]) => title), ...fine].filter(title => titleProblems(title).length === 0)
  assert.ok(accepted.length >= 5, 'the table holds accepted titles')
  accepted.forEach(title => assert.ok(isGameName(slugOf(title)), `slugOf(${JSON.stringify(title)}) = ${JSON.stringify(slugOf(title))} passes isGameName`))
  // NEW: the SHELF's grammars. BOOK_NAME is the game-name grammar, written in
  // schema.js so engine/config never imports server/ — so the two must be equal.
  assert.equal(BOOK_NAME.source, NAME.source, 'a book name is a game name')
  yes.forEach(name => assert.equal(isBookName(name), true, `${JSON.stringify(name)} is a book name`))
  no.forEach(name  => assert.equal(isBookName(name), false, `${JSON.stringify(name)} is not a book name`))
  assert.ok(isBookName('dinosaur-age'))
  // isEdition judges the NUMBER a pin carries; isEditionName the STRING a folder or a url carries
  ;[1, 2, 10].forEach(edition => assert.equal(isEdition(edition), true, `${edition} is an edition`))
  ;[0, -1, 1.5, '1', null, undefined, NaN, Infinity].forEach(edition => assert.equal(isEdition(edition), false, `${JSON.stringify(edition)} is not an edition`))
  ;['1', '12'].forEach(folder => assert.equal(isEditionName(folder), true, `"${folder}" is an edition folder`))
  ;['01', '0', '1.0', '', 'one', '1x', 1].forEach(folder => assert.equal(isEditionName(folder), false, `${JSON.stringify(folder)} is not an edition folder`))
  assert.ok(EDITION instanceof RegExp)
  // BOOK_ID: <book>:<slug>, lowercase, dots and dashes
  ;['basic:character', 'basic:character.identity.concept', 'dinosaur-age:row-lairs', 'stats:based-on'].forEach(id => assert.equal(BOOK_ID.test(id), true, `${id} is a book id`))
  ;['Basic:x', 'basic:', 'basic', 'basic:.x', 'basic:X', 'a8d09a0f-f269-4a04-a173-d694dc36b105', ''].forEach(id => assert.equal(BOOK_ID.test(id), false, `${JSON.stringify(id)} is not a book id`))
  ok(`N2 names: ${slugs.length} slugs; ${fine.length} fine titles, ${refused.length} refused at "title"; isGameName ${yes.length} yes / ${no.length} no; BOOK_NAME.source === NAME.source; isEdition and isEditionName both sides; BOOK_ID 4 yes / 7 no`)
}

// ───────────────────────── N3 the seed ─────────────────────────
{
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
  const seed = seedSet('T')
  assert.deepEqual(validateSet(seed), [], 'the seed fits the contract')
  assert.equal(migrateSet(seed), seed, 'the seed is already at SCHEMA_VERSION — the same object comes back')
  assert.deepEqual(crossChecks(seed), [], 'nothing dangles in an empty game')
  FILE_NAMES.forEach(name => assert.deepEqual(validateFile(name, seed[name]), [], `${name} alone fits`))
  // the key orders migrations.js writes and B2/B5 pin
  assert.deepEqual(Object.keys(seed.content), ['version', 'meta', 'books', 'groups', 'rowOverrides'])
  assert.deepEqual(Object.keys(seed.rules),   ['version', 'totalBudget', 'groupRules'])
  assert.deepEqual(Object.keys(seed.themes),  ['version', 'page', 'groupThemes'])
  assert.deepEqual(Object.keys(seed.types),   ['version', 'types', 'sectionsFor', 'fieldsFor'])
  assert.deepEqual(Object.keys(seed.things),  ['version', 'things'], 'no `order`: an entry whose default is null is NOT written at birth')
  // read FROM the sheets: the page theme is every entry's default, the budget is the sheet's
  assert.deepEqual(seed.content.meta, { pageTitle: 'T', heroTitle: 'T' })
  assert.deepEqual(seed.themes.page, Object.fromEntries(pageThemeSchema.map(entry => [entry.key, entry.default])))
  assert.equal(seed.rules.totalBudget, totalBudgetSchema[0].default)
  assert.equal(seed.rules.totalBudget, 10)
  assert.deepEqual(seed.content.groups, [])
  assert.deepEqual(seed.content.books, [], 'a newborn pins nothing until the server says otherwise')
  assert.deepEqual(seed.content.rowOverrides, {})
  assert.deepEqual(seed.types.types, [])
  assert.deepEqual([seed.types.sectionsFor, seed.types.fieldsFor], [{}, {}])
  assert.deepEqual(seed.things.things, {})
  assert.deepEqual(seed.rules.groupRules, {})
  FILE_NAMES.forEach(name => assert.equal(seed[name].version, SCHEMA_VERSION, `${name} stamped ${SCHEMA_VERSION}`))
  assert.doesNotMatch(JSON.stringify(seed), UUID, 'a newborn mints no ids')
  // NEW: a newborn may be born ON BOOKS — the pin lands, and the key keeps its place
  const pinned = seedSet('T', [{ name: 'basic', edition: 1 }])
  assert.deepEqual(pinned.content.books, [{ name: 'basic', edition: 1 }])
  assert.deepEqual(Object.keys(pinned.content), ['version', 'meta', 'books', 'groups', 'rowOverrides'], 'assigning a key that is already there never moves it')
  assert.deepEqual(validateGame({ own: pinned, books: [basicFx()] }), [], 'and the newborn fits, judged against the book it stands on')
  assert.deepEqual(validateGame({ own: pinned, books: [null] }).map(problemText), ['content.books[0]: "basic" 1 is not on the shelf; the book is skipped'])
  // two seeds are equal but share nothing — a default that leaked its object would tie every new game together
  const twin = seedSet('T')
  assert.deepEqual(twin, seed)
  assert.notEqual(twin.content.groups, seed.content.groups, 'groups is a fresh array per seed')
  assert.notEqual(twin.content.books, seed.content.books, 'books is a fresh array per seed')
  assert.notEqual(twin.themes.page, seed.themes.page, 'page is a fresh object per seed')
  assert.notEqual(seedSet('T', [{ name: 'basic', edition: 1 }]).content.books[0], pinned.content.books[0], 'and the pins are cloned, not held')
  ok(`N3 the seed: fits, migrates to itself, no cross problems; key orders canonical with no \`order\`; meta/page/budget read from the sheets; every file stamped ${SCHEMA_VERSION}; no uuid; a pinned newborn validates against its book; two seeds share no object`)
}

// oracles.mjs imports this file, so a BLOCKED check must not end the process
// here — it sets the exit code and lets the slow half run, and the last line of
// each file prints the same list. `blockedChecks` is what oracles.mjs reads.
export const blockedChecks = blocked
if (blocked.length > 0) {
  console.log(`\n${blocked.length} of ${checks} logic checks BLOCKED by a bug in another package's file — the assertion says what the code must do:`)
  blocked.forEach(line => console.log(`  FAIL ${line}`))
  process.exitCode = 1
} else {
  console.log(`all ${checks} logic checks passed`)
}
