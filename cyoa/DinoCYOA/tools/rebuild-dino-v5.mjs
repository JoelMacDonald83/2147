// NEW: the one-off rebuild of the dino game ONTO THE SHELF — NOT a migration.
//
//   node cyoa/DinoCYOA/tools/rebuild-dino-v5.mjs [--data-dir <dir>] [--books-dir <dir>]
//
// A migration changes the SHAPE of every game the same way, forever
// (migrations.js). This script changes the CONTENT of ONE game, once: dino
// stops carrying its own four types, its own four rows and its own seventeen
// things, and starts PINNING three books that already carry most of them.
// After it runs, the dino game holds only its CAST — the ten things nobody
// else could have written: eight named pets and two joke lairs. Everything
// generic (the Character/Item/Place sheets, the four dinosaur rows, the gear,
// the real lairs, the location) lives on the shelf, where a second game can
// pin it tomorrow.
//
// What that means file by file:
//
//   MOVES OUT (the uuid retires)  the four v4 types and their eight field ids;
//                                 the four v4 rows; the seven things the books
//                                 now carry (4 gear, Lava Pit, Play pen,
//                                 Volcano Rim). 23 uuids retire.
//   STAYS (the uuid is kept)      the eight pets and the two joke lairs — 10
//                                 uuids, re-shaped onto Basic's sheets: a v4
//                                 `label` becomes a Character's `concept` (a
//                                 Place's `description`), `traits` become
//                                 `notes` (`features`), and each pet gains the
//                                 `size` and `origin` the shelf makes sayable.
//   BECOMES AN OVERRIDE           each v4 row's LABEL. The book proposes the
//                                 row ("Lairs"); this game renames it ("Now
//                                 select a Lair! …") through
//                                 content.rowOverrides. Nothing else is
//                                 overridden: the budget (10) and the min/max
//                                 (1/1 and 1/3) are exactly what Dinosaur Age
//                                 proposes, so they are DELETED here and show
//                                 through — statusOf asserts they matched
//                                 first, so nothing is lost silently.
//   DECLARES A SHEET (Stage 2)    content.sheet becomes "basic:character": the
//                                 type the PLAYER fills in. It is written HERE
//                                 rather than by hand because of oracle D5 —
//                                 "the dino on disk byte-equals this script's
//                                 output". The data and the script that
//                                 reproduces it move together, or D5 lies.
//   BINDS THE FOUR ROWS           each override gains `fills`: the section of
//                                 that sheet a pick from this row lands in.
//                                 Two rows (Lairs and Locations) fill the SAME
//                                 section, places — legal, and required by
//                                 this data. Binding changes what a pick
//                                 RECORDS, never what a row OFFERS, which is
//                                 why every item count in EXPECTED_ROWS below
//                                 is unmoved and every price on the page is
//                                 the price it was.
//
// Nothing is minted. Every uuid in the output was in the input, minus the 23
// the plan retires — asserted before a byte is written.
//
// Like restructure-v4.mjs, this is a one-shot: it refuses to run twice
// (exit 1), refuses to guess when it finds a game that is neither untouched
// nor finished (exit 2), and refuses when the shelf cannot answer a pin
// (exit 2). Nothing is written on 1 or 2. Everything it does is data (PLAN)
// keyed by the uuids that already exist, with the label each id must carry,
// so the precondition is written down and checked before any write.
//
// The oracle imports PLAN, statusOf and rebuildDino to run the same plan
// in-process, and runs this file as a CLI to prove the exit codes. Imports
// come from engine/ only (the contract, the migration, the merge, the row
// filter, the reference audit) plus readBookSync from the export tool —
// tools never reach into dinoEdit/ or server/.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { migrateSet } from '../engine/config/migrations.js'
import { groupRulesSchema, totalBudgetSchema } from '../engine/config/schema.js'
import { filterThings } from '../engine/config/query.js'
import { danglingReferences } from '../engine/config/references.js'
import { mergeLayers, validateGame } from '../engine/config/merge.js'
import { problemText } from '../engine/config/validate.js'
import { readBookSync } from './export.mjs'

const DINO_DIR = dirname(dirname(fileURLToPath(import.meta.url)))   // tools/.. = cyoa/DinoCYOA
const FILES = ['content', 'rules', 'themes', 'types', 'things']
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

// the server's exact on-disk format, so a no-edit save after this is byte-identical
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n'

// ───────────────────────── the plan ─────────────────────────
// Keyed by EXISTING uuids. `from` is the label (or name) the id must carry for
// the plan to apply — the precondition, written down — and `to` is where that
// thing goes. Read it as five sentences:
//
//   types      each v4 type retires; its things move to the Basic sheet named
//   rows       each v4 row retires; the book's proposed row takes its place,
//              and the v4 label becomes that row's override
//   pets       kept uuids, re-shaped onto basic:character. `size` and `origin`
//              are the OWNER's call — the v4 files never said which dinosaur
//              Tali is, so these two lines per pet are the one place in this
//              script where new information enters. Edit them freely.
//   keepPlaces kept uuids, re-shaped onto basic:place, kind "lair"
//   moved      retired uuids whose data the BOOK now carries. Step 4 proves
//              the book's copy is byte-equal to the v4 thing BEFORE the uuid
//              goes — so "the book has it" is a measurement, not a hope.
//   order      the v4 Lair-row order, written down as things.order. The book's
//              places merge in before the game's own, so without this line the
//              Lair row would read Lava Pit, Play pen, Scritches, King of
//              Burger. With it, it reads exactly as v4 did.
export const PLAN = {
  pins: [{ name: 'basic', edition: 1 }, { name: 'stats', edition: 1 }, { name: 'dinosaur-age', edition: 1 }],
  sheet: 'basic:character',                                  // the TYPE the player builds. Beside the pins because the pins are what define it: Basic proposes Character, Stats and Dinosaur Age add to it
  types: {                                                   // the four v4 types → the Basic sheet their things move to; the type and its two field ids retire
    '4043b853-f2e2-43bd-9a59-a1df426f55e7': { from: 'Dino',      to: 'basic:character' },
    '126a2b60-f165-4974-b5d5-b19e1a7043ab': { from: 'Stuffable', to: 'basic:item' },
    '8f600498-8359-4ca2-aef8-c2a80a23ed5a': { from: 'Lair',      to: 'basic:place' },
    '9a439978-8907-4c37-a19d-fcc29faf472b': { from: 'Location',  to: 'basic:place' }
  },
  rows: {                                                    // the four v4 rows → the proposed rows that replace them; the label AND the binding become the override
    // `fills` is a SECTION id of plan.sheet: where a pick from this row lands on
    // the player's sheet. Written down, never inferred — basic:trait fits TWO
    // sections of Character (advantages and disadvantages), so "the obvious
    // one" does not exist, and this codebase never guesses.
    'dc59d633-7a9d-441b-a8c5-e9224d16eec8': { from: 'Choose your Dino pet uWu',                                  to: 'dinosaur-age:row-companions', fills: 'basic:character.companions' },
    '2f388c57-809e-49c0-b03d-216b9bd894f7': { from: 'Now give your Dino stuffables!',                            to: 'dinosaur-age:row-gear',       fills: 'basic:character.gear' },
    'bdd3ed8d-74a8-455f-bef7-b115fe5d9f2e': { from: 'Now select a Lair! Do you have a Lair? Dino needs a Lair!', to: 'dinosaur-age:row-lairs',      fills: 'basic:character.places' },
    'cd9dd080-40ca-4ae9-9487-d67242cf7265': { from: 'Lair Location',                                             to: 'dinosaur-age:row-locations',  fills: 'basic:character.places' }
  },
  pets: {                                                    // kept uuids; label → concept, traits → notes; size and origin are the owner's call (one line each, edit freely)
    'a8d09a0f-f269-4a04-a173-d694dc36b105': { from: 'Tali',                size: 'biggie', origin: 'dinosaur-age:tyrannosaurus' },
    '0c63d4ce-f909-4682-b27f-c77929d1f40c': { from: 'Miku',                size: 'big',    origin: 'dinosaur-age:pterosaur' },
    'cc02b3ab-0e90-4f7f-81ec-30a2df4f12d8': { from: 'Speedy Gonzales',     size: 'small',  origin: 'dinosaur-age:velociraptor' },
    '0d41c512-0fc3-447f-ad34-9144677fda68': { from: 'The King',            size: 'biggie', origin: 'dinosaur-age:tyrannosaurus' },
    '921404f5-64b3-47cc-b707-27b6da612a6a': { from: 'Dino Jesus',          size: 'big',    origin: 'dinosaur-age:tyrannosaurus' },
    '71ed5f9a-929a-46b6-aa8c-026327eea828': { from: 'Jeff',                size: 'big',    origin: 'dinosaur-age:ankylosaurus' },
    '975c1877-b228-4ee7-99ba-48a5bbaabcee': { from: 'Dino Sandra Bullock', size: 'big',    origin: 'dinosaur-age:stegosaurus' },
    '2caf350f-9251-4af8-9dde-ea0e49d2901f': { from: 'Cery',                size: 'big',    origin: 'dinosaur-age:triceratops' }
  },
  keepPlaces: {                                              // kept uuids; label → description, traits → features, kind lair
    '6ff555af-d3b4-404f-99f6-d84e66ed54c0': { from: 'The Scritches Dimension' },
    'b0e6c387-5297-4cd6-9a4a-a61fb51990c7': { from: 'King of Burger!!' }
  },
  moved: {                                                   // uuid → the book's copy; the data must be EQUAL before the uuid retires
    '0a18ac24-52b5-4403-8b12-cda899a86c7b': { from: 'Water Gun',   to: 'dinosaur-age:water-gun' },
    '275d5a26-03b1-49af-9a4f-a359418269bd': { from: 'Dino Skates', to: 'dinosaur-age:dino-skates' },
    'b9655bf4-9665-477e-bcac-77059cc21d93': { from: 'THE BANANA',  to: 'dinosaur-age:the-banana' },
    '4d836958-7630-4c5a-a130-08b44101820f': { from: 'Cute rock',   to: 'dinosaur-age:cute-rock' },
    '6df9e5c4-c5c9-4bb1-898b-4982df7e4722': { from: 'Lava Pit',    to: 'dinosaur-age:lava-pit' },
    'c31ea05e-63d5-4ddc-89f8-e8fcf7f482bf': { from: 'Play pen',    to: 'dinosaur-age:play-pen' },
    '0568ef76-cce6-4fa6-be85-0c4f56592e72': { from: 'Volcano Rim', to: 'dinosaur-age:volcano-rim' }
  },
  order: { 'basic:place': ['6ff555af-d3b4-404f-99f6-d84e66ed54c0', 'dinosaur-age:lava-pit', 'dinosaur-age:play-pen', 'b0e6c387-5297-4cd6-9a4a-a61fb51990c7'] }   // the v4 Lair order: Scritches, Lava Pit, Play pen, King of Burger; Volcano Rim unlisted
}

// What the v4 game must say about budget and min/max for this rebuild to be a
// no-op for the player. These are NOT new decisions: they are the numbers
// Dinosaur Age already proposes (proposals.json: totalBudget 10, companions
// 1/1, lairs 1/3). The rebuild DELETES the game's own copies so the book's
// proposal shows through — which is only safe if the two agreed, so `fresh`
// checks it here and says which slot disagrees when it does not. `null` means
// "this row must have no slot at all"; `{}` and absent are both fine for gear,
// because an empty slot and no slot hydrate to the same 0/∞.
const FRESH_BUDGET = 10
const FRESH_RULES = {
  'dc59d633-7a9d-441b-a8c5-e9224d16eec8': { min: 1, max: 1 },   // companions — Dinosaur Age proposes 1/1
  '2f388c57-809e-49c0-b03d-216b9bd894f7': {},                   // gear — nothing proposed, nothing written
  'bdd3ed8d-74a8-455f-bef7-b115fe5d9f2e': { min: 1, max: 3 },   // lairs — Dinosaur Age proposes 1/3
  'cd9dd080-40ca-4ae9-9487-d67242cf7265': null                  // locations — no slot at all
}

// What the rebuilt game must produce, checked before the write (step 7). Rows
// in v4 order, each with the label the override restores, the min/max it must
// end up with after the cascade, the item count its query must answer, and
// (Stage 2) the sheet section its picks must land in after that same cascade.
const EXPECTED_ROWS = [
  { id: 'dinosaur-age:row-companions', label: 'Choose your Dino pet uWu',                                  min: 1, max: 1,        items: 8, fills: 'basic:character.companions' },
  { id: 'dinosaur-age:row-gear',       label: 'Now give your Dino stuffables!',                            min: 0, max: Infinity, items: 4, fills: 'basic:character.gear' },
  { id: 'dinosaur-age:row-lairs',      label: 'Now select a Lair! Do you have a Lair? Dino needs a Lair!', min: 1, max: 3,        items: 4, fills: 'basic:character.places' },
  { id: 'dinosaur-age:row-locations',  label: 'Lair Location',                                             min: 0, max: Infinity, items: 1, fills: 'basic:character.places' }
]
const EXPECTED_GATE = { kind: 'anyInRow', row: 'dinosaur-age:row-lairs' }
const EXPECTED_BUDGET = 10

// ───────────────────────── small helpers ─────────────────────────
const typeById  = (set, id) => set.types.types.find(type => type.id === id)
const bucketOf  = (set, typeId) => set.things.things[typeId] ?? []
const thingIn   = (set, typeId, id) => bucketOf(set, typeId).find(thing => thing.id === id)
// the bucket key that holds this thing id, or undefined — how a moved uuid
// tells us which v4 type it belonged to (item, lair or location)
const bucketKeyOf = (set, thingId) => Object.keys(set.things.things).find(key => set.things.things[key].some(thing => thing.id === thingId))
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]))
// A v4 type's uuid, addressed by the readable label the plan wrote down. Two of
// the four types map to the SAME sheet (Lair and Location both become
// basic:place), so "the type whose things go to basic:place" is ambiguous and
// the label is the handle. Safe because `fresh` has already proved that every
// uuid on disk carries exactly this label — the plan's label is the data's.
const v4TypeNamed = (plan, label) => Object.keys(plan.types).find(id => plan.types[id].from === label)
// every uuid in the five files, as a sorted string — comparable with ===
const uuidsIn = (set) => [...new Set(JSON.stringify(set).match(UUID) ?? [])].sort().join(',')
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b)
// the sheet defaults for a rule slot the file does not carry: 0 and Infinity
const ruleDefault = (key) => groupRulesSchema.find(entry => entry.key === key).hydrateDefault
const budgetDefault = () => totalBudgetSchema[0].hydrateDefault
// what a row OFFERS, as the three things a player sees on a card. Costs and
// image filenames are compared RAW here (as they sit in things.json) on both
// sides of the comparison, so this is the same projection for a v4 set and a
// merged v5 one — which is what makes "the rows are identical" a deepEqual.
const offerOf = (set, row) => {
  const type = typeById(set, row.query.type)
  if (!type) return null                                     // named by the caller's assert, never silently empty
  return filterThings(bucketOf(set, row.query.type), type, row.query.where).map(thing => pick(thing, ['name', 'cost', 'imageURL']))
}

// ───────────────────────── statusOf ─────────────────────────
// Two audits, each a list of mismatches (empty = passes). Run on the MIGRATED
// (v5) set, before any write. The CLI prints the mismatches by name when a
// game is in neither state, which is what makes exit 2 diagnosable.
//
// `fresh` is the whole precondition of the rebuild: every id the plan names is
// where the plan says, carrying the label the plan says, and the two numbers
// that are about to be DELETED (budget, min/max) agree with the proposals that
// will show through in their place.
const freshMismatches = (set, plan) => {
  const out = []
  // the four types, by id and label — a renamed type means the plan is stale
  Object.entries(plan.types).forEach(([id, { from }]) => {
    const type = typeById(set, id)
    if (!type) out.push(`type ${id} is missing (expected label "${from}")`)
    else if (type.label !== from) out.push(`type ${id} is labelled "${type.label}", expected "${from}"`)
    if (!(id in set.things.things)) out.push(`type ${id} has no bucket in things.json`)
  })
  // the four rows, top-level, by label — the label is what becomes the override
  Object.entries(plan.rows).forEach(([id, { from }]) => {
    const row = set.content.groups.find(each => each.id === id)
    if (!row) out.push(`row ${id} is not a top-level row (expected label "${from}")`)
    else if (row.label !== from) out.push(`row ${id} is labelled "${row.label}", expected "${from}"`)
  })
  // every thing the plan touches, in the bucket of the v4 type it must sit in,
  // under the name the plan wrote down
  const expectThing = (id, from, typeId, what) => {
    const thing = thingIn(set, typeId, id)
    if (!thing) out.push(`${what} ${id} is not in the ${typeById(set, typeId)?.label ?? typeId} bucket (expected name "${from}")`)
    else if (thing.name !== from) out.push(`${what} ${id} is named "${thing.name}", expected "${from}"`)
  }
  const dinoType     = v4TypeNamed(plan, 'Dino')
  const lairType     = v4TypeNamed(plan, 'Lair')
  const locationType = v4TypeNamed(plan, 'Location')
  const itemType     = v4TypeNamed(plan, 'Stuffable')
  Object.entries(plan.pets).forEach(([id, { from }]) => expectThing(id, from, dinoType, 'pet'))
  Object.entries(plan.keepPlaces).forEach(([id, { from }]) => expectThing(id, from, lairType, 'kept place'))
  Object.entries(plan.moved).forEach(([id, { from }]) => {
    // a moved thing may sit in any of the three buckets it could have come from
    const holder = [itemType, lairType, locationType].find(typeId => thingIn(set, typeId, id))
    if (!holder) out.push(`moved thing ${id} is in no v4 bucket (expected name "${from}")`)
    else expectThing(id, from, holder, 'moved thing')
  })
  // the game must not already pin anything
  if (set.content.books.length > 0) out.push(`content.books already pins ${set.content.books.length} book(s)`)
  // and the two numbers about to be deleted must equal what will replace them
  if (set.rules.totalBudget !== FRESH_BUDGET) out.push(`rules.totalBudget is ${JSON.stringify(set.rules.totalBudget)}, expected ${FRESH_BUDGET} (the budget Dinosaur Age proposes)`)
  Object.entries(FRESH_RULES).forEach(([id, want]) => {
    const have = set.rules.groupRules[id]
    if (want === null) { if (have !== undefined) out.push(`rules.groupRules["${id}"] exists (${JSON.stringify(have)}), expected no slot`); return }
    if (have === undefined) { if (Object.keys(want).length > 0) out.push(`rules.groupRules["${id}"] is missing, expected ${JSON.stringify(want)}`); return }
    if (!sameJSON(have, want)) out.push(`rules.groupRules["${id}"] is ${JSON.stringify(have)}, expected ${JSON.stringify(want)} (what Dinosaur Age proposes)`)
  })
  return out
}

// "done" is the state the rebuild leaves: the pins are written, not one retired
// uuid survives anywhere in the five files (the serialized-text search catches a
// bucket key, a rules slot and a gate alike), and the pets are on Basic's
// Character sheet.
const doneMismatches = (set, plan) => {
  const out = []
  const text = JSON.stringify(set)
  if (!sameJSON(set.content.books, plan.pins)) out.push(`content.books is ${JSON.stringify(set.content.books)}, expected ${JSON.stringify(plan.pins)}`)
  retiredIds(plan).forEach(id => { if (text.includes(id)) out.push(`retired id ${id} still appears in the files`) })
  const cast = set.things.things['basic:character'] ?? []
  Object.entries(plan.pets).forEach(([id, { from }]) => {
    const pet = cast.find(thing => thing.id === id)
    if (!pet) out.push(`pet ${id} ("${from}") is not on basic:character`)
    else if (pet.name !== from) out.push(`pet ${id} is named "${pet.name}", expected "${from}"`)
  })
  return out
}

// the 23 ids the rebuild retires: 4 types + their 8 field ids are not listed by
// the plan (the plan names the TYPE; the fields belong to it), so they are read
// off the set when there is one, and off the plan's type ids otherwise. Called
// with a set by rebuildDino (which can name the fields) and without one by
// doneMismatches (where the types are already gone, so the type ids alone are
// what the text search needs).
const retiredIds = (plan, set = null) => {
  const fieldIds = set === null ? [] : Object.keys(plan.types).flatMap(id => {
    const type = typeById(set, id)
    return type ? type.sections.flatMap(section => section.kind === 'fields' ? section.fields.map(field => field.id) : []) : []
  })
  return [...Object.keys(plan.types), ...fieldIds, ...Object.keys(plan.rows), ...Object.keys(plan.moved)]
}

export const statusOf = (set, plan) => {
  if (freshMismatches(set, plan).length === 0) return 'fresh'
  if (doneMismatches(set, plan).length === 0) return 'done'
  return 'partial'
}

// ───────────────────────── rebuildDino ─────────────────────────
// Pure: the input is never touched (structuredClone first), and the same input
// and shelf always give the same output — nothing is minted, nothing is read
// from the clock or the filesystem. `books` is the loaded shelf, in pin order:
// plan.pins.map(pin => readBookSync(booksDir, pin)). A null in that list is a
// throw, not a fault: the merge would happily skip the missing book and hand
// back a smaller game, and writing THAT over the real files is the one mistake
// this script must never make.
//
// The steps run in an order that lets each assert something true, and the whole
// output is checked (step 7) before the caller is allowed to write it.
export const rebuildDino = (set, plan, books) => {
  plan.pins.forEach((pin, index) => {
    if (books[index] == null) throw new Error(`book "${pin.name}" ${pin.edition} is not on the shelf`)
  })
  const out = structuredClone(set)

  // 1. the pins. The game's own five files are now the LAST layer of a stack;
  //    these three lines are the rest of the stack.
  out.content.books = structuredClone(plan.pins)

  // 2. the pets → basic:character. Key order is the SHEET's order, which is
  //    why it reads concept, size, origin, notes: Basic's Identity section
  //    holds concept, Dinosaur Age appends size to it, then Basic's Origin list
  //    section, then Basic's Notes section. `origin` is a LIST section's value,
  //    so it is a list of placements — { thing: <id> } with no placement values,
  //    because basic:character.origin declares `placement: []`.
  //    A thing writes only the keys it HAS: the four Stats attributes are
  //    absent and hydrate to their default 10, exactly like a v4 thing older
  //    than a field.
  const petsBucket = []
  const dinoTypeId = v4TypeNamed(plan, 'Dino')
  bucketOf(out, dinoTypeId).forEach(thing => {
    const planned = plan.pets[thing.id]
    if (!planned) throw new Error(`pets: the Dino bucket holds ${thing.id} ("${thing.name}"), which the plan does not name`)
    assert.equal(thing.name, planned.from, `pets: ${thing.id} is named "${thing.name}", the plan says "${planned.from}"`)
    petsBucket.push({
      id: thing.id, name: thing.name, cost: thing.cost, imageURL: thing.imageURL,
      concept: thing.label,
      size: planned.size,
      origin: [{ thing: planned.origin }],
      notes: thing.traits
    })
  })

  // 3. the two joke lairs → basic:place, in bucket order. Same re-shaping, the
  //    Place sheet's words: label → description, traits → features. `kind` is
  //    "lair" because that is the v4 row they were in, and kind is exactly what
  //    the two proposed rows filter on.
  const placesBucket = []
  const lairTypeId = v4TypeNamed(plan, 'Lair')
  bucketOf(out, lairTypeId).forEach(thing => {
    if (!plan.keepPlaces[thing.id]) return                    // the real lairs are the book's now — step 4 proves it
    assert.equal(thing.name, plan.keepPlaces[thing.id].from, `keepPlaces: ${thing.id} is named "${thing.name}", the plan says "${plan.keepPlaces[thing.id].from}"`)
    placesBucket.push({
      id: thing.id, name: thing.name, cost: thing.cost, imageURL: thing.imageURL,
      description: thing.label,
      kind: 'lair',
      features: thing.traits
    })
  })

  // 4. the moved things are PROVEN EQUAL, then dropped. This is the heart of
  //    the rebuild: a uuid may only retire once the book's copy has been shown
  //    to carry the same data, field for field, in this process, on this shelf.
  //    Not "I copied it carefully in WP-D" — measured, here, every run.
  const bookThings = {}
  books.forEach(book => Object.entries(book.things?.things ?? {}).forEach(([sheet, list]) => list.forEach(thing => { bookThings[thing.id] = { sheet, thing } })))
  Object.entries(plan.moved).forEach(([id, { from, to }]) => {
    const holder = bucketKeyOf(out, id)
    if (!holder) throw new Error(`moved: ${id} ("${from}") is in no bucket`)
    const was = thingIn(out, holder, id)
    assert.equal(was.name, from, `moved: ${id} is named "${was.name}", the plan says "${from}"`)
    const onShelf = bookThings[to]
    if (!onShelf) throw new Error(`moved: no book on this shelf carries ${to} (the copy of "${from}")`)
    const sheet = plan.types[holder].to
    assert.equal(onShelf.sheet, sheet, `moved: ${to} sits on ${onShelf.sheet}, expected ${sheet}`)
    // the projection is the sheet's own words for the v4 keys: an Item says
    // description/tags, a Place says description/kind/features
    const asV4 = sheet === 'basic:item'
      ? { name: was.name, cost: was.cost, imageURL: was.imageURL, description: was.label, tags: was.traits }
      : { name: was.name, cost: was.cost, imageURL: was.imageURL, description: was.label, kind: plan.types[holder].from === 'Lair' ? 'lair' : 'location', features: was.traits }
    assert.deepEqual(asV4, pick(onShelf.thing, Object.keys(asV4)), `moved: the book's ${to} is not equal to the v4 "${from}"`)
  })

  // 5. the rows are ADOPTED. The game stops owning rows (content.groups = [])
  //    and starts overriding the ones Dinosaur Age proposes — one key each, the
  //    label. Everything else about those rows (the query, the gate, the
  //    min/max, the budget) is the book's, so it is deleted here and shows
  //    through: rules keeps an empty cabinet, and themes' two backgrounds are
  //    simply RE-KEYED from the retired row uuid to the proposed row's id (the
  //    page theme is untouched — it was never about a row).
  //    types goes empty: all four sheets are Basic's now. The two addition
  //    cabinets stay (empty) because every layer has them.
  //    CHANGED (Stage 2): the game also DECLARES the sheet the player builds,
  //    and each override carries a second key — the section that row's picks
  //    fill. Two keys now, in the schema's order: label, then fills.
  out.content.groups = []
  out.content.sheet = plan.sheet
  out.content.rowOverrides = {}
  Object.values(plan.rows).forEach(({ from, to, fills }) => { out.content.rowOverrides[to] = { label: from, fills } })
  out.rules = { version: out.rules.version, groupRules: {} }
  out.themes = {
    version: out.themes.version,
    page: out.themes.page,
    groupThemes: Object.fromEntries(Object.entries(out.themes.groupThemes).map(([rowId, theme]) => [plan.rows[rowId]?.to ?? rowId, theme]))
  }
  out.types = { version: out.types.version, types: [], sectionsFor: {}, fieldsFor: {} }

  // 6. the arrangement. Only the two buckets this game still owns are written;
  //    a bucket per merged sheet is not required (the editor makes one on the
  //    first "+ Add"), and writing empty ones would be five lies about who owns
  //    the shelf. `order` is the game's house rule over the MERGED shelf — the
  //    one place a game may say something about things it does not own.
  out.things = {
    version: out.things.version,
    things: { 'basic:character': petsBucket, 'basic:place': placesBucket },
    order: structuredClone(plan.order)
  }

  // every file rebuilt key by key, canonical order (§2.8), so the bytes are the
  // same whatever order the steps above happened to leave
  const result = {
    content: { version: out.content.version, meta: out.content.meta, books: out.content.books, sheet: out.content.sheet, groups: out.content.groups, rowOverrides: out.content.rowOverrides },
    rules:   out.rules,
    themes:  out.themes,
    types:   out.types,
    things:  out.things
  }

  // 7. the checks. Nothing above is trusted: the output is merged against the
  //    real shelf and every promise this rebuild makes to the player is
  //    measured on the merged result before the caller writes a byte.
  const problems = validateGame({ own: result, books })
  assert.deepEqual(problems, [], `the rebuilt game does not validate:\n  ${problems.map(problemText).join('\n  ')}`)
  const merged = mergeLayers({ books, game: result }).set

  //   the four rows, in v4 order, with the v4 labels — the overrides landed
  assert.deepEqual(merged.content.groups.map(row => row.label), EXPECTED_ROWS.map(row => row.label), 'the merged rows are not the four v4 labels in order')
  assert.deepEqual(merged.content.groups.map(row => row.id), EXPECTED_ROWS.map(row => row.id), 'the merged rows are not the four proposed rows in order')
  assert.ok(merged.content.groups.every(row => row.children.length === 0), 'no merged row has children')

  //   min/max after the cascade, and the budget SHOWING THROUGH (absent here,
  //   10 there) — the two numbers this rebuild deleted
  merged.content.groups.forEach((row, index) => {
    const slot = merged.rules.groupRules[row.id] ?? {}
    assert.equal(slot.min ?? ruleDefault('min'), EXPECTED_ROWS[index].min, `row ${row.id} min`)
    assert.equal(slot.max ?? ruleDefault('max'), EXPECTED_ROWS[index].max, `row ${row.id} max`)
  })
  assert.ok(!('totalBudget' in result.rules), 'the game must not write a budget — Dinosaur Age proposes it')
  assert.equal(merged.rules.totalBudget ?? budgetDefault(), EXPECTED_BUDGET, 'the merged budget')

  //   the declaration and the four bindings, read back off the MERGED rows. A
  //   file that SAYS `fills` is not the same claim as a cascade that DELIVERS
  //   it, and it is the cascade the player plays.
  assert.equal(merged.content.sheet, plan.sheet, `the merged game builds ${JSON.stringify(merged.content.sheet)}, expected ${JSON.stringify(plan.sheet)}`)
  assert.deepEqual(merged.content.groups.map(row => row.fills), EXPECTED_ROWS.map(row => row.fills), 'the four merged rows are not bound to the planned sections, in order')

  //   what every row OFFERS, in order, against what the v4 game offered. Four
  //   deepEquals, one per row: names, costs and images, position by position.
  const v4Rows = set.content.groups
  assert.equal(v4Rows.length, EXPECTED_ROWS.length, 'the v4 game must still have its four rows')
  merged.content.groups.forEach((row, index) => {
    const now = offerOf(merged, row)
    assert.ok(now !== null, `row ${row.id} shows a sheet that does not exist (${row.query.type})`)
    const before = offerOf(set, v4Rows[index])
    assert.ok(before !== null, `v4 row ${v4Rows[index].id} shows a type that does not exist`)
    assert.equal(now.length, EXPECTED_ROWS[index].items, `row ${row.id} offers ${now.length} items, expected ${EXPECTED_ROWS[index].items}`)
    assert.deepEqual(now, before, `row ${row.id} does not offer exactly what "${v4Rows[index].label}" offered, in order`)
  })

  //   the gate the Location row waits on — the one row that is not always shown
  assert.deepEqual(merged.content.groups[3].showWhen, EXPECTED_GATE, 'the Location row must wait on the Lair row')

  //   the files are closed, and every uuid is accounted for: nothing minted,
  //   nothing lost beyond the 23 the plan retires
  const dangling = danglingReferences(merged)
  assert.deepEqual(dangling.map(entry => `${entry.path} ${entry.what}`), [], 'dangling references in the merged game')
  const retired = new Set(retiredIds(plan, set))
  assert.equal(retired.size, 23, `the plan must retire 23 ids, it names ${retired.size}`)
  const kept = uuidsIn(set).split(',').filter(id => !retired.has(id)).join(',')
  assert.equal(uuidsIn(result), kept, 'the output must hold exactly the input uuids minus the retired ids')
  return result
}

// ───────────────────────── the CLI ─────────────────────────
// Only runs when this file IS the script (node …/rebuild-dino-v5.mjs), never
// when the oracle imports it.
const readSet = (dataDir) => Object.fromEntries(FILES.map(name => [name, JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8'))]))

// content.json last: its version is the set's, and it carries the pins and
// every cross-reference, so a crash mid-write leaves a set the loader can still
// migrate rather than one that claims to pin books its siblings know nothing of
const writeSet = (dataDir, set) => {
  const order = [...FILES.filter(name => name !== 'content'), 'content']
  order.forEach(name => writeFileSync(join(dataDir, `${name}.json`), serialize(set[name])))
}

const usage = () => {
  console.log('usage: node rebuild-dino-v5.mjs [--data-dir <dir>] [--books-dir <dir>]')
  process.exit(1)
}

// two optional flags, each with a value, in either order and neither twice —
// anything else is usage. There is no game argument: this script rebuilds the
// one game whose uuids the plan names.
const parseArgs = (argv) => {
  const flags = { '--data-dir': undefined, '--books-dir': undefined }
  for (let at = 0; at < argv.length; at += 2) {
    const flag = argv[at]
    if (!(flag in flags) || flags[flag] !== undefined || argv[at + 1] === undefined) usage()
    flags[flag] = resolve(argv[at + 1])
  }
  return {
    dataDir: flags['--data-dir'] ?? join(DINO_DIR, 'games', 'dino', 'data'),
    booksDir: flags['--books-dir'] ?? join(DINO_DIR, 'books')
  }
}

const main = (argv) => {
  const { dataDir, booksDir } = parseArgs(argv)

  const set = migrateSet(readSet(dataDir))
  const status = statusOf(set, PLAN)
  if (status === 'done') {
    console.log('already rebuilt — nothing written')
    process.exit(1)
  }
  if (status === 'partial') {
    freshMismatches(set, PLAN).forEach(line => console.log(`not fresh: ${line}`))
    doneMismatches(set, PLAN).forEach(line  => console.log(`not done:  ${line}`))
    console.log('partially rebuilt — restore data from git')
    process.exit(2)
  }

  // A shelf that cannot answer a pin, a book whose copy is not the v4 data, or
  // any promise in step 7 that does not hold: say it and stop. Exit 2 means
  // NOTHING WAS WRITTEN — the game on disk is exactly as it was.
  let out, books
  try {
    books = PLAN.pins.map(pin => readBookSync(booksDir, pin))   // inside the try: an unreadable book.json throws here
    out = rebuildDino(set, PLAN, books)
  } catch (error) {
    console.log(error.message)
    console.log('nothing written')
    process.exit(2)
  }

  writeSet(dataDir, out)
  const merged = mergeLayers({ books, game: out })
  const own = Object.entries(out.things.things).map(([sheet, list]) => `${list.length} ${merged.set.types.types.find(type => type.id === sheet)?.label ?? sheet}s`)
  const items = merged.set.content.groups.reduce((total, row) => total + offerOf(merged.set, row).length, 0)
  console.log(`dino rebuilt on ${merged.order.join(', ')} — ${Object.values(out.things.things).flat().length} own things (${own.join(', ')}); ${merged.proposed.rows.length} rows proposed, ${Object.keys(out.content.rowOverrides).length} labels overridden; ${items} items in v4 order`)
  console.log(`wrote ${FILES.length} files to ${dataDir}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
