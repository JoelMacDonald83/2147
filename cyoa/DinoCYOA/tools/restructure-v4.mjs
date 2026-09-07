// NEW: the one-off v4 restructure — NOT a migration.
//
//   node cyoa/DinoCYOA/tools/restructure-v4.mjs <dino|vampire> [--data-dir <dir>]
//
// A migration changes the SHAPE of every game the same way, forever (that is
// migrations.js). This script changes the CONTENT of two specific games, once:
// dino's types get short names and lose the abandoned "sub group" (type, bucket
// and row), and "Lair Location" climbs out of the Lair row to become a
// top-level row that only shows once a Lair is picked. Vampire's types get
// short names and nothing else moves. Run it once per game, commit, and its
// job is over — so it refuses to run twice (exit 1) and refuses to guess when
// it finds a game that is neither untouched nor finished (exit 2).
//
// Everything it does is data (PLANS) keyed by the uuids that already exist,
// with the label each id is expected to carry, so the precondition is written
// down and checked before a single byte is written. Nothing is minted: every
// uuid in the output was in the input, minus the ones the plan deletes.
//
// The oracle imports PLANS, statusOf and restructure to run the same plan
// in-process, and runs this file as a CLI to prove the exit codes. Imports
// come from engine/ only (config/ for the contract and the repairs, helpers.js
// for flattenGroups) — tools never reach into dinoEdit/.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { migrateSet } from '../engine/config/migrations.js'
import { flattenGroups } from '../engine/helpers.js'
import { forgetRow, forgetThing, forgetType, danglingReferences } from '../engine/config/references.js'

const DINO_DIR = dirname(dirname(fileURLToPath(import.meta.url)))   // tools/.. = cyoa/DinoCYOA
const FILES = ['content', 'rules', 'themes', 'types', 'things']
const OPTIONAL_FILES = ['types', 'things']                            // absent before v3 — the migration creates them
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

// the server's exact on-disk format, so a no-edit save after this is byte-identical
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n'

// ───────────────────────── the plans ─────────────────────────
// Keyed by EXISTING uuids. `from` is the label the id must carry for the plan
// to apply; `to` is the label it gets. deleteTypes takes the type AND its
// bucket; deleteRows takes the row, its subtree, and their rules/themes slots.
// hoist moves a nested row to the top level, right after `after`, and gives
// it the gate — its label is kept (only the TYPE is called Location).
export const PLANS = {
  dino: {
    relabelTypes: {
      '4043b853-f2e2-43bd-9a59-a1df426f55e7': { from: 'Choose your Dino pet uWu', to: 'Dino' },
      '126a2b60-f165-4974-b5d5-b19e1a7043ab': { from: 'Now give your Dino stuffables!', to: 'Stuffable' },
      '8f600498-8359-4ca2-aef8-c2a80a23ed5a': { from: 'Now select a Lair! Do you have a Lair? Dino needs a Lair!', to: 'Lair' },
      '9a439978-8907-4c37-a19d-fcc29faf472b': { from: 'Lair Location', to: 'Location' }
    },
    deleteTypes: { '8e74d5de-a4c3-4a11-b86a-fcdaf3e371fd': { from: 'sub group' } },    // type + bucket (21f13810…, d32f9cf5…)
    deleteRows:  { '25d4aef8-2f68-451e-a224-db747d2333b5': { from: 'sub group' } },    // row + its rules/themes slots (+ subtree)
    hoist: [{ row: 'cd9dd080-40ca-4ae9-9487-d67242cf7265', from: 'Lair Location',
              after: 'bdd3ed8d-74a8-455f-bef7-b115fe5d9f2e',
              showWhen: { kind: 'anyInRow', row: 'bdd3ed8d-74a8-455f-bef7-b115fe5d9f2e' } }]
  },
  vampire: {
    relabelTypes: {
      'c65bc3b1-2f20-4302-ad22-ae15b1b752f7': { from: 'Your Bloodline',              to: 'Bloodline' },
      '8a72f705-a0f2-4424-b161-cc4df4c8d09d': { from: 'The Century of Your Turning', to: 'Century' },
      '1a030a34-b65d-4617-b9a2-7a4bea298cb0': { from: 'Your Lair',                   to: 'Lair' },
      '05dbc8f5-0376-4264-99e9-c234065366f2': { from: 'Gifts of the Night',          to: 'Gift' },
      'aeabc3ce-16e0-4c03-a2a6-1b9597705a97': { from: 'Your Curse',                  to: 'Curse' },
      '1f42e048-cb9d-40af-9aed-102705fc0d44': { from: 'Your Companion',              to: 'Companion' },
      'b37814dc-d3a0-429c-96e6-e999107361e3': { from: 'The Hunt',                    to: 'Hunt' },
      '1d827d9a-311a-4365-9a19-18f16e698fb5': { from: 'Relics & Possessions',        to: 'Relic' }
    },
    deleteTypes: {}, deleteRows: {}, hoist: []
  }
}

// what the CLI checks after a plan has run — the state the oracle asserts too
const EXPECTED = {
  dino:    { types: ['Dino', 'Stuffable', 'Lair', 'Location'], things: 17, rows: 4, ruleSlots: 3 },
  vampire: { types: ['Bloodline', 'Century', 'Lair', 'Gift', 'Curse', 'Companion', 'Hunt', 'Relic'], things: 64, rows: 8, ruleSlots: 8 }
}

// ───────────────────────── small walkers ─────────────────────────
const typeById = (set, id) => set.types.types.find(type => type.id === id)
const rowById  = (set, id) => flattenGroups(set.content.groups).find(row => row.id === id)
// the array that holds the row with this id — the top level or some row's children
const listHolding = (rows, id) => {
  if (rows.some(row => row.id === id)) return rows
  for (const row of rows) {
    const found = listHolding(row.children, id)
    if (found) return found
  }
  return undefined
}
// a row's id and every id nested inside it (the same subtree idsBelow walks)
const subtreeIds = (row) => flattenGroups([row]).map(each => each.id)
// every uuid in the five files, as a sorted string — comparable with ===
const uuidsIn = (set) => [...new Set(JSON.stringify(set).match(UUID) ?? [])].sort().join(',')
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ───────────────────────── statusOf ─────────────────────────
// Two audits, each a list of mismatches (empty = passes). Run on the MIGRATED
// set, before any write. The CLI prints the mismatches by name when a game is
// in neither state, which is what makes exit 2 diagnosable.
const freshMismatches = (set, plan) => {
  const out = []
  Object.entries(plan.relabelTypes).forEach(([id, { from }]) => {
    const type = typeById(set, id)
    if (!type) out.push(`type ${id} is missing (expected label "${from}")`)
    else if (type.label !== from) out.push(`type ${id} is labelled "${type.label}", expected "${from}"`)
  })
  Object.entries(plan.deleteTypes).forEach(([id, { from }]) => {
    const type = typeById(set, id)
    if (!type) out.push(`type to delete ${id} is missing (expected label "${from}")`)
    else if (type.label !== from) out.push(`type to delete ${id} is labelled "${type.label}", expected "${from}"`)
    if (!(id in set.things.things)) out.push(`type to delete ${id} has no bucket in things.json`)
  })
  Object.entries(plan.deleteRows).forEach(([id, { from }]) => {
    const row = rowById(set, id)
    if (!row) out.push(`row to delete ${id} is missing (expected label "${from}")`)
    else if (row.label !== from) out.push(`row to delete ${id} is labelled "${row.label}", expected "${from}"`)
  })
  plan.hoist.forEach(({ row: id, from }) => {
    const row = rowById(set, id)
    if (!row) { out.push(`row to hoist ${id} is missing (expected label "${from}")`); return }
    if (row.label !== from) out.push(`row to hoist ${id} is labelled "${row.label}", expected "${from}"`)
    if (listHolding(set.content.groups, id) === set.content.groups) out.push(`row to hoist ${id} is already top-level`)
    if (row.showWhen.kind !== 'always') out.push(`row to hoist ${id} already has a gate (${row.showWhen.kind})`)
  })
  return out
}
// "done" cannot name the deleted bucket's thing ids — they left with the
// bucket — but a bucket that survived still carries its type id as a key,
// and that id is what the serialized-text search below catches.
const doneMismatches = (set, plan) => {
  const out = []
  const text = JSON.stringify(set)
  Object.entries(plan.relabelTypes).forEach(([id, { to }]) => {
    const type = typeById(set, id)
    if (!type) out.push(`type ${id} is missing (expected label "${to}")`)
    else if (type.label !== to) out.push(`type ${id} is labelled "${type.label}", expected "${to}"`)
  })
  Object.keys(plan.deleteTypes).forEach(id => { if (text.includes(id)) out.push(`deleted type ${id} still appears in the files`) })
  Object.keys(plan.deleteRows).forEach(id  => { if (text.includes(id)) out.push(`deleted row ${id} still appears in the files`) })
  plan.hoist.forEach(({ row: id, showWhen }) => {
    const row = rowById(set, id)
    if (!row) { out.push(`hoisted row ${id} is missing`); return }
    if (listHolding(set.content.groups, id) !== set.content.groups) out.push(`hoisted row ${id} is still nested`)
    if (!sameJSON(row.showWhen, showWhen)) out.push(`hoisted row ${id} has gate ${JSON.stringify(row.showWhen)}, expected ${JSON.stringify(showWhen)}`)
  })
  return out
}

export const statusOf = (set, plan) => {
  if (freshMismatches(set, plan).length === 0) return 'fresh'
  if (doneMismatches(set, plan).length === 0) return 'done'
  return 'partial'
}

// ───────────────────────── restructure ─────────────────────────
// Pure: the input is never touched (structuredClone first), and the same
// input always gives the same output — nothing is minted. The steps run in
// an order that lets each one assert something true: rows leave BEFORE their
// types, so when a type goes, forgetType must find NO surviving row showing
// it — if it does, the plan forgot a row, and that is a bug in the plan, not
// in the data. The repairs are the editor's own (references.js), so a saved
// file stays closed the same way a Remove click keeps it closed.
export const restructure = (set, plan) => {
  const out = structuredClone(set)
  const rows = out.content.groups
  const deletedIds = []

  // 1. relabel types by id — labels only; field captions, row labels and every id stay
  Object.entries(plan.relabelTypes).forEach(([id, { to }]) => {
    const type = typeById(out, id)
    if (!type) throw new Error(`relabel: type ${id} is not in types.json`)
    type.label = to
  })

  // 2. delete rows: the row and its whole subtree leave the tree, their
  //    cabinet slots leave rules/themes, and every gate that waited on one of
  //    them falls back to always
  Object.keys(plan.deleteRows).forEach(id => {
    const list = listHolding(rows, id)
    if (!list) throw new Error(`deleteRows: row ${id} is not in content.json`)
    const [row] = list.splice(list.findIndex(each => each.id === id), 1)
    subtreeIds(row).forEach(rowId => {
      delete out.rules.groupRules[rowId]
      delete out.themes.groupThemes[rowId]
      forgetRow(rows, rowId)
      deletedIds.push(rowId)
    })
  })

  // 3. delete types: the type (with its field ids) and its bucket leave; gates
  //    on its things fall back to always FIRST, while the thing ids are still
  //    known; then forgetType must have nothing left to repair (see above)
  Object.keys(plan.deleteTypes).forEach(id => {
    const at = out.types.types.findIndex(type => type.id === id)
    if (at === -1) throw new Error(`deleteTypes: type ${id} is not in types.json`)
    const [type] = out.types.types.splice(at, 1)
    const bucket = out.things.things[id] ?? []
    delete out.things.things[id]
    bucket.forEach(thing => { forgetThing(rows, thing.id); deletedIds.push(thing.id) })
    const survivors = forgetType(rows, id)
    if (survivors.length > 0) {
      throw new Error(`deleteTypes: ${survivors.map(({ row }) => `row "${row.label}"`).join(', ')} still showed type ${id} — the plan must delete or retarget that row`)
    }
    deletedIds.push(id, ...type.fields.map(field => field.id))
  })

  // 4. hoist: out of the parent's children, into the top level right after
  //    `after`, with the plan's gate; the label is untouched
  plan.hoist.forEach(({ row: id, after, showWhen }) => {
    const list = listHolding(rows, id)
    if (!list) throw new Error(`hoist: row ${id} is not in content.json`)
    const [row] = list.splice(list.findIndex(each => each.id === id), 1)
    const anchor = rows.findIndex(each => each.id === after)
    if (anchor === -1) throw new Error(`hoist: row ${after} is not top-level, so nothing can go after it`)
    row.showWhen = structuredClone(showWhen)
    rows.splice(anchor + 1, 0, row)
  })

  // 5. every row in canonical key order, whatever order the edits above left
  const canonical = (row) => ({ id: row.id, label: row.label, query: row.query, showWhen: row.showWhen, children: row.children.map(canonical) })
  out.content.groups = rows.map(canonical)

  // 6. the files are closed, and every uuid is accounted for: nothing minted,
  //    nothing lost beyond what the plan deleted
  const dangling = danglingReferences(out)
  assert.equal(dangling.length, 0, `dangling references after restructure: ${dangling.map(({ row, what }) => `row "${row.label}" ${what}`).join('; ')}`)
  const deleted = new Set(deletedIds)
  const kept = uuidsIn(set).split(',').filter(id => !deleted.has(id)).join(',')
  assert.equal(uuidsIn(out), kept, 'the output must hold exactly the input uuids minus the deleted ids')
  return out
}

// ───────────────────────── the CLI ─────────────────────────
// Only runs when this file IS the script (node …/restructure-v4.mjs), never
// when the oracle imports it.
const readSet = (dataDir) => Object.fromEntries(FILES.map(name => {
  const path = join(dataDir, `${name}.json`)
  try {
    return [name, JSON.parse(readFileSync(path, 'utf8'))]
  } catch (error) {
    if (error.code === 'ENOENT' && OPTIONAL_FILES.includes(name)) return [name, null]
    throw error
  }
}))

// content.json last: its version is the set's, and it carries every
// cross-reference, so a crash mid-write leaves a set the loader can still
// migrate rather than one that claims v4 with v3 rows
const writeSet = (dataDir, set) => {
  const order = [...FILES.filter(name => name !== 'content'), 'content']
  order.forEach(name => writeFileSync(join(dataDir, `${name}.json`), serialize(set[name])))
}

const assertExpected = (set, out, plan, expected) => {
  assert.deepEqual(out.types.types.map(type => type.label), expected.types, 'type labels')
  assert.equal(Object.values(out.things.things).flat().length, expected.things, 'thing count')
  assert.equal(out.content.groups.length, expected.rows, 'top-level row count')
  assert.ok(out.content.groups.every(row => row.children.length === 0), 'no row has children')
  plan.hoist.forEach(({ row: id, after, showWhen }) => {
    const at = out.content.groups.findIndex(row => row.id === id)
    assert.equal(at, out.content.groups.findIndex(row => row.id === after) + 1, `hoisted row ${id} sits right after ${after}`)
    assert.ok(sameJSON(out.content.groups[at].showWhen, showWhen), `hoisted row ${id} carries the plan's gate`)
  })
  assert.equal(Object.keys(out.rules.groupRules).length, expected.ruleSlots, 'rules slots')
  assert.ok(sameJSON(out.themes, set.themes), 'themes.json is untouched — no deleted row ever had a theme slot')
}

const usage = () => {
  console.log('usage: node restructure-v4.mjs <dino|vampire> [--data-dir <dir>]')
  process.exit(1)
}

const main = (argv) => {
  const [game, ...rest] = argv
  const plan = PLANS[game]
  if (!plan) usage()
  const flagAt = rest.indexOf('--data-dir')
  if (rest.length > 0 && (flagAt !== 0 || rest.length !== 2)) usage()
  const dataDir = flagAt === 0 ? resolve(rest[1]) : join(DINO_DIR, 'games', game, 'data')

  const set = migrateSet(readSet(dataDir))
  const status = statusOf(set, plan)
  if (status === 'done') {
    console.log('already restructured — nothing written')
    process.exit(1)
  }
  if (status === 'partial') {
    freshMismatches(set, plan).forEach(line => console.log(`not fresh: ${line}`))
    doneMismatches(set, plan).forEach(line  => console.log(`not done:  ${line}`))
    console.log('partially restructured — restore data from git')
    process.exit(2)
  }

  const out = restructure(set, plan)
  assertExpected(set, out, plan, EXPECTED[game])
  writeSet(dataDir, out)
  const typeCounts = out.types.types.map(type => `${type.label} (${(out.things.things[type.id] ?? []).length})`).join(', ')
  console.log(`${game} restructured — ${out.types.types.length} types: ${typeCounts}; ${EXPECTED[game].things} things; ${out.content.groups.length} rows`)
  console.log(`wrote ${FILES.length} files to ${dataDir}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
