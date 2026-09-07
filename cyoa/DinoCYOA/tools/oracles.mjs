// The v4 faithfulness oracles, runnable from the repo with plain node:
//
//   node cyoa/DinoCYOA/tools/oracles.mjs            (both games)
//   node cyoa/DinoCYOA/tools/oracles.mjs vampire    (one game)
//
// CHANGED: the v3 file had three checks (determinism, idempotence, bridge).
// This one starts by running the fast logic oracles (oracles-logic.mjs, L1–L13,
// pure, milliseconds) and then runs the slow half — the checks that need git,
// temp dirs and child processes:
//
//   A1 determinism, mint-free   v3 → v4 migrated twice is byte-identical; no uuid minted or lost
//   A2 climb                    v2 → v4 equals v3 → v4 (modulo the ids step 2 mints); v1 → v4 equals v2 → v4
//   B1 idempotence              save → reload → migrate (no-op) → render-time write → save: five files byte-identical
//   B2 canonical shapes         every key order the editor and the engine rely on
//   B3 missing files by name    a v3 OR v4 set without types/things fails at the border and NAMES them (the v3 input is what stamp exists for)
//   C1 bridge v3                the REAL v3 engine (git) and the v4 engine (working tree) hydrate v3 data alike
//   C2 bridge v2                the REAL v2 engine (git) and the v4 engine hydrate v2 data alike
//   C3 working tree             the v4 engine hydrates games/<game> with zero warnings
//   G1 border loudness          a hand-broken set warns ONCE per fault, by row, and fails closed
//   H1 restructure result       tools/restructure-v4.mjs in-process gives exactly the planned files
//   H2 CLI + refusal            exit 0 writes H1's files; a second run exits 1 and writes nothing; a partial state exits 2
//   H3 restructured hydrates    the v4 engine over H2's files warns nothing; Location offers Volcano Rim
//   H4 committed data           once restructured, the working tree byte-equals H1 (skipped until then)
//   I1 play (dino)              pick a Lair → Location appears; unpick → it hides, refunds, and says so
//
// Data for the migration and bridge checks always comes from git (the pins
// below), never from the working tree — so restructuring the committed data
// cannot make those checks drift. The engines under comparison come from git
// too (git archive), untouched. Each hydration runs in its own node process
// (--hydrate / --play modes, below) because gameConfig.js does its loading at
// import time, once per process.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const DINO_DIR = dirname(dirname(fileURLToPath(import.meta.url)))   // tools/.. = cyoa/DinoCYOA
const DINO_IN_REPO = 'cyoa/DinoCYOA'
// NEW: three pins instead of one. The engine is byte-identical at the two v3
// pins, so the v3 engine is archived from the ENGINE pin and the v3 files are
// read from the DATA pin.
const V2_COMMIT = process.env.CYOA_V2_COMMIT ?? '79b5ec4'            // v2 engine + v2 data
const V3_ENGINE_COMMIT = process.env.CYOA_V3_ENGINE_COMMIT ?? '11e46a2'
const V3_DATA_COMMIT = process.env.CYOA_V3_DATA_COMMIT ?? '2ab45f0'  // both games at v3 on disk
const GIT_ROOT = process.env.CYOA_GIT_REPO
  ?? execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: DINO_DIR, encoding: 'utf8' }).trim()
const FILES = ['content', 'rules', 'themes', 'types', 'things']
const OPTIONAL_FILES = ['types', 'things']   // absent before v3 — reading them may come back null
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

// the server's exact on-disk format
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n'

// ───────────────────────── child modes ─────────────────────────
// Both children serve <gameDir>/data/*.json to the engine through a fake
// fetch, capture console.warn, and print ONE JSON object on stdout — nothing
// else may reach stdout, because the parent JSON.parses it.
const installFakeFetch = (gameDir) => {
  globalThis.fetch = async (url) => {
    try {
      const text = readFileSync(join(gameDir, url), 'utf8')
      return { ok: true, status: 200, json: async () => JSON.parse(text) }
    } catch {
      return { ok: false, status: 404, json: async () => { throw new Error(`404 ${url}`) } }
    }
  }
}
const captureWarnings = () => {
  const warnings = []
  console.warn = (...parts) => warnings.push(parts.join(' '))
  return warnings
}

// node oracles.mjs --hydrate <engineDir> <gameDir>
// Imports the engine's real gameConfig.js and prints the hydrated groups,
// summarized. The summary projects ONLY the fields the v2, v3 and v4 engines
// all produce (a v4 row also carries query and showWhen; a v3 row carried
// displayType) — that is what lets C1 and C2 deepEqual across engines. Keep
// it that way: a field only one engine has would make every bridge fail.
if (process.argv[2] === '--hydrate') {
  const [engineDir, gameDir] = process.argv.slice(3)
  const warnings = captureWarnings()
  installFakeFetch(gameDir)
  const { groups } = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const summarize = (groups) => groups.map(group => ({
    id: group.id,
    label: group.label,
    min: String(group.min),               // Infinity does not survive JSON
    max: String(group.max),
    background: group.background,
    items: group.items.map(item => ({
      id: item.id, name: item.name, cost: item.cost, imageURL: item.imageURL,
      label: item.label, traits: item.traits
    })),
    children: summarize(group.children)
  }))
  process.stdout.write(JSON.stringify({ warnings, groups: summarize(groups) }))
  process.exit(0)
}

// NEW: node oracles.mjs --play <engineDir> <gameDir> <stepsJSON>
// Imports the engine's real state.js (which imports gameConfig through the
// fake fetch) and PLAYS: every step is one toggle { row, thing }, both by id,
// and after each the child records what the player would see. console.log is
// silenced because state.js logs its refusals ("… is not shown") and stdout
// must stay pure JSON; the warnings are captured, not silenced, because a
// warning is a finding.
if (process.argv[2] === '--play') {
  const [engineDir, gameDir, stepsJSON] = process.argv.slice(3)
  const warnings = captureWarnings()
  console.log = () => {}
  installFakeFetch(gameDir)
  const { gameState } = await import(pathToFileURL(join(engineDir, 'state.js')).href)
  const { groups } = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const { flattenGroups } = await import(pathToFileURL(join(engineDir, 'helpers.js')).href)
  const allGroups = flattenGroups(groups)
  const snapshot = () => ({
    visible: [...gameState.visible],
    dropped: gameState.dropped.map(item => item.name),
    spent: gameState.spent,
    remaining: gameState.remaining,
    unmet: gameState.unmetGroups.map(group => group.id)
  })
  const { visible, unmet } = snapshot()
  const steps = JSON.parse(stepsJSON).map(({ row, thing }) => {
    const group = allGroups.find(group => group.id === row)
    const item = group.items.find(item => item.id === thing)
    gameState.toggleSelection(group, item)
    return snapshot()
  })
  process.stdout.write(JSON.stringify({ warnings, start: { visible, unmet }, steps }))
  process.exit(0)
}

// ───────────────────────── parent mode ─────────────────────────
// The fast half runs first — a broken table or evaluator should fail here in
// milliseconds, before any git archive or child process is started. (It sits
// below the two child branches because those must keep stdout pure JSON.)
await import('./oracles-logic.mjs')

const { migrateSet } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'migrations.js')).href)
const { SCHEMA_VERSION } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'schema.js')).href)
const { danglingReferences } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'references.js')).href)
const { flattenGroups } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'helpers.js')).href)
const RESTRUCTURE_SCRIPT = join(DINO_DIR, 'tools', 'restructure-v4.mjs')
const { PLANS, statusOf, restructure } = await import(pathToFileURL(RESTRUCTURE_SCRIPT).href)
assert.equal(SCHEMA_VERSION, 4, 'these oracles describe schema version 4')

const games = process.argv.length > 2 ? process.argv.slice(2) : ['dino', 'vampire']
const WORK = mkdtempSync(join(tmpdir(), 'cyoa-oracles-'))
let checks = 0
const ok = (label) => { checks += 1; console.log(`  ok  ${label}`) }

// an old engine, straight from git, untouched — under WORK/<name>/cyoa/DinoCYOA/engine
const archiveEngine = (commit, name) => {
  mkdirSync(join(WORK, name), { recursive: true })
  execFileSync('git', ['archive', '-o', join(WORK, `${name}.tar`), commit, `${DINO_IN_REPO}/engine`], { cwd: GIT_ROOT })
  execFileSync('tar', ['-xf', join(WORK, `${name}.tar`), '-C', join(WORK, name)])
  return join(WORK, name, DINO_IN_REPO, 'engine')
}
const v2EngineDir = archiveEngine(V2_COMMIT, 'v2')
const v3EngineDir = archiveEngine(V3_ENGINE_COMMIT, 'v3')
const v4EngineDir = join(DINO_DIR, 'engine')   // the working tree

// CHANGED: takes the commit — three pins are read now, not one
const gitShow = (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], { cwd: GIT_ROOT, encoding: 'utf8' })
const writeGame = (gameDir, set) => {
  mkdirSync(join(gameDir, 'data'), { recursive: true })
  FILES.forEach(name => {
    if (set[name] !== null) writeFileSync(join(gameDir, 'data', `${name}.json`), serialize(set[name]))
  })
}
// NEW: the five files of a game dir as text (the bytes the server would serve)
const readGameText = (gameDir) => Object.fromEntries(FILES.map(name => [name, readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8')]))
// NEW: the five files of a game dir as a set, the way the loaders see it (a
// missing types/things is null — the border decides what that means)
const readGameSet = (gameDir) => Object.fromEntries(FILES.map(name => {
  try {
    return [name, JSON.parse(readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8'))]
  } catch (error) {
    if (error.code === 'ENOENT' && OPTIONAL_FILES.includes(name)) return [name, null]
    throw error
  }
}))
const runChild = (mode, args) => {
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), mode, ...args], { encoding: 'utf8' })
  return JSON.parse(out)
}
const hydrate = (engineDir, gameDir) => runChild('--hydrate', [engineDir, gameDir])
const play = (engineDir, gameDir, steps) => runChild('--play', [engineDir, gameDir, JSON.stringify(steps)])
// NEW: the restructure CLI, exit code and all (execFileSync would throw on exit 1/2, and those are the point)
const runRestructureCLI = (game, dataDir) => {
  const { status, stdout } = spawnSync(process.execPath, [RESTRUCTURE_SCRIPT, game, '--data-dir', dataDir], { encoding: 'utf8' })
  return { status, stdout }
}

const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}
const countGroups = (groups) => groups.reduce((n, group) => n + 1 + countGroups(group.children), 0)
const countItems = (groups) => groups.reduce((n, group) => n + group.items.length + countItems(group.children), 0)
const uuidsIn = (text) => new Set(text.match(UUID) ?? [])
const sameSet = (a, b) => a.size === b.size && [...a].every(id => b.has(id))
// every uuid that was not in the known files becomes MINTED#n, numbered by first appearance
const normalize = (text, knownIds) => {
  const seen = new Map()
  return text.replace(UUID, (id) => {
    if (knownIds.has(id)) return id
    if (!seen.has(id)) seen.set(id, `MINTED#${seen.size + 1}`)
    return seen.get(id)
  })
}
const keysOf = (obj) => Object.keys(obj).join(',')
// a summarized (hydrated) tree, flat, so a row can be found by id at any depth
const flatSummary = (groups) => groups.flatMap(group => [group, ...flatSummary(group.children)])

// NEW: what the restructure must leave behind (§8), and the ids it must remove
const EXPECTED_RESTRUCTURE = {
  dino:    { types: ['Dino', 'Stuffable', 'Lair', 'Location'], things: 17, rows: 4 },
  vampire: { types: ['Bloodline', 'Century', 'Lair', 'Gift', 'Curse', 'Companion', 'Hunt', 'Relic'], things: 64, rows: 8 }
}
const DINO = {
  rows: {
    dino:     'dc59d633-7a9d-441b-a8c5-e9224d16eec8',
    lair:     'bdd3ed8d-74a8-455f-bef7-b115fe5d9f2e',
    location: 'cd9dd080-40ca-4ae9-9487-d67242cf7265',
    subGroup: '25d4aef8-2f68-451e-a224-db747d2333b5'   // deleted by the plan
  },
  types:  { subGroup: '8e74d5de-a4c3-4a11-b86a-fcdaf3e371fd' },   // deleted, with its bucket
  things: {
    lavaPit:    '6df9e5c4-c5c9-4bb1-898b-4982df7e4722',   // Lair, 3 points
    volcanoRim: '0568ef76-cce6-4fa6-be85-0c4f56592e72',   // Location, 1 point
    subGroupA:  '21f13810-7e5a-49e2-827f-b0d089a783bb',   // the deleted bucket
    subGroupB:  'd32f9cf5-9743-4cc2-afee-791adf824d14'
  }
}
DINO.deleted = [DINO.rows.subGroup, DINO.types.subGroup, DINO.things.subGroupA, DINO.things.subGroupB]

for (const game of games) {
  console.log(`\n${game}`)
  const gamePath = `${DINO_IN_REPO}/games/${game}/data`
  const plan = PLANS[game]

  // the v2 set, as it was: three files from git, the two new ones absent
  const rawV2 = deepFreeze({
    content: JSON.parse(gitShow(V2_COMMIT, `${gamePath}/content.json`)),
    rules:   JSON.parse(gitShow(V2_COMMIT, `${gamePath}/rules.json`)),
    themes:  JSON.parse(gitShow(V2_COMMIT, `${gamePath}/themes.json`)),
    types:   null,
    things:  null
  })
  assert.equal(rawV2.content.version, 2, `${game} at ${V2_COMMIT} is a v2 game`)
  const v2Ids = uuidsIn(JSON.stringify(rawV2))
  // the v3 set, as committed: five files from git
  const rawV3 = deepFreeze(Object.fromEntries(FILES.map(name => [name, JSON.parse(gitShow(V3_DATA_COMMIT, `${gamePath}/${name}.json`))])))
  assert.equal(rawV3.content.version, 3, `${game} at ${V3_DATA_COMMIT} is a v3 game`)
  const v3Text = serialize(rawV3)

  // ── A1 determinism, mint-free ──
  const first = migrateSet(rawV3)                  // rawV3 is frozen: a mutating step would throw
  const second = migrateSet(rawV3)
  const firstText = serialize(first)
  assert.equal(firstText, serialize(second), 'two v3 → v4 migrations are byte-identical')
  assert.ok(sameSet(uuidsIn(firstText), uuidsIn(v3Text)), 'v3 → v4 neither mints nor loses a uuid')
  ok(`A1 v3 → v4 twice is byte-identical; ${uuidsIn(v3Text).size} uuids in, the same ${uuidsIn(firstText).size} out (input untouched)`)

  // ── A2 climb ──
  // v2 → v4 mints type and field ids in step 2 only, so the two routes agree
  // once every id unknown to v2 is renamed by first appearance
  assert.equal(normalize(serialize(migrateSet(rawV2)), v2Ids), normalize(firstText, v2Ids), 'v2 → v4 equals v3 → v4 modulo minted ids')
  const v1 = {
    content: { ...rawV2.content, version: 1, groups: rawV2.content.groups.map(({ id, label, items }) => ({ id, label, items })) },
    rules: { ...rawV2.rules, version: 1 },
    themes: { ...rawV2.themes, version: 1 },
    types: null,
    things: null
  }
  const v2Flat = { ...v1, content: { ...v1.content, version: 2, groups: v1.content.groups.map(group => ({ ...group, children: [] })) },
                   rules: { ...v1.rules, version: 2 }, themes: { ...v1.themes, version: 2 } }
  assert.equal(normalize(serialize(migrateSet(v1)), v2Ids), normalize(serialize(migrateSet(v2Flat)), v2Ids), 'v1 → v4 equals v2 → v4')
  ok(`A2 v2 (git ${V2_COMMIT}) → v4 equals v3 (git ${V3_DATA_COMMIT}) → v4 modulo minted ids; v1 → v4 equals v2 → v4`)

  // ── B1 idempotence: save 1 → reload → migrate (no-op) → the one render-time write → save 2 ──
  const reloaded = Object.fromEntries(FILES.map(name => [name, JSON.parse(serialize(first[name]))]))
  const again = migrateSet(reloaded)
  assert.equal(again, reloaded, 'a v4 set passes the border untouched — the same object')
  again.types.types.forEach(type => { again.things.things[type.id] ??= [] })   // repairBuckets' one write
  FILES.forEach(name => assert.equal(serialize(again[name]), serialize(first[name]), `${name}.json byte-identical on save 2`))
  ok('B1 save → reload → migrate → render → save: all five files byte-identical')

  // ── B2 canonical shapes and key orders ──
  FILES.forEach(name => assert.equal(first[name].version, 4, `${name}.json stamped 4`))
  assert.equal(keysOf(first.content), 'version,meta,groups')
  assert.equal(keysOf(first.types), 'version,types')
  assert.equal(keysOf(first.things), 'version,things')
  assert.equal(keysOf(first.rules), keysOf(rawV3.rules))
  assert.equal(keysOf(first.themes), keysOf(rawV3.themes))
  const typeIds = new Set(first.types.types.map(type => type.id))
  const checkRow = (row) => {
    assert.equal(keysOf(row), 'id,label,query,showWhen,children')
    assert.equal(keysOf(row.query), 'type,where')
    assert.equal(row.query.where, null, 'a migrated row has no condition')
    assert.equal(keysOf(row.showWhen), 'kind')
    assert.equal(row.showWhen.kind, 'always', 'a migrated row has the empty gate')
    assert.ok(typeIds.has(row.query.type), 'query.type points at a real type')
    assert.ok(Array.isArray(first.things.things[row.query.type]), 'that type has a bucket')
    row.children.forEach(checkRow)
  }
  first.content.groups.forEach(checkRow)
  first.types.types.forEach(type => {
    assert.equal(keysOf(type), 'id,label,fields')
    assert.equal(type.fields.map(field => `${field.key}:${field.type}`).join(','), 'label:text,traits:lines')
    type.fields.forEach(field => assert.equal(keysOf(field), 'id,key,caption,type'))
    first.things.things[type.id].forEach(thing => assert.equal(keysOf(thing), 'id,name,cost,imageURL,label,traits'))
  })
  assert.equal(Object.keys(first.things.things).length, first.types.types.length, 'one bucket per type, no extras')
  ok(`B2 canonical key orders; ${countGroups(first.content.groups)} rows each id,label,query,showWhen,children; where null; gate always; all five stamped 4`)

  // ── B3 the border's promise: a set missing a file names it. The v3 input is
  // the line `stamp` exists for: step 3 has to carry a null THROUGH, and a
  // { ...null, version: 4 } would turn it into a stray object that slips past
  // the check. The v4 input never runs step 3 — it only proves the check itself. ──
  assert.throws(() => migrateSet({ ...rawV3, types: null, things: null }), /Missing data files for version 4: types, things/)
  assert.throws(() => migrateSet({ ...reloaded, types: null, things: null }), /Missing data files for version 4: types, things/)
  ok('B3 a v3 or v4 game without types.json/things.json fails at the border, by name')

  // ── C1 bridge v3: real v3 engine vs the v4 engine, over v3 data ──
  const v3GitDir = join(WORK, 'v3data', game)      // the committed v3 files — the lazy path for the v4 engine
  writeGame(v3GitDir, rawV3)
  const v4SavedDir = join(WORK, 'v4data', game)    // the migration, saved
  writeGame(v4SavedDir, first)
  const v3Result = hydrate(v3EngineDir, v3GitDir)
  const v4Lazy = hydrate(v4EngineDir, v3GitDir)
  const v4Saved = hydrate(v4EngineDir, v4SavedDir)
  assert.deepEqual(v3Result.warnings, [], 'v3 engine warned over the v3 data')
  assert.deepEqual(v4Lazy.warnings, [], 'v4 engine warned over the v3 data (lazy migration)')
  assert.deepEqual(v4Saved.warnings, [], 'v4 engine warned over the saved migration')
  assert.deepEqual(v4Lazy.groups, v3Result.groups, 'v4 over v3 data ≠ v3 engine')
  assert.deepEqual(v4Saved.groups, v3Result.groups, 'v4 over the saved migration ≠ v3 engine')
  ok(`C1 v3 engine (git ${V3_ENGINE_COMMIT}) and v4 engine agree: ${countGroups(v3Result.groups)} rows, ${countItems(v3Result.groups)} items, no warnings`)

  // ── C2 bridge v2: real v2 engine vs the v4 engine, over v2 data ──
  const v2GameDir = join(WORK, 'v2data', game)
  writeGame(v2GameDir, rawV2)
  const v2Result = hydrate(v2EngineDir, v2GameDir)
  const v4OverV2 = hydrate(v4EngineDir, v2GameDir)
  assert.deepEqual(v4OverV2.warnings, [], 'v4 engine warned over the v2 data')
  assert.deepEqual(v4OverV2.groups, v2Result.groups, 'v4 over v2 data ≠ v2 engine')
  ok(`C2 v2 engine (git ${V2_COMMIT}) and v4 engine agree: ${countGroups(v2Result.groups)} rows, ${countItems(v2Result.groups)} items, no warnings`)

  // ── C3 the working tree hydrates clean (true before and after the restructure) ──
  const workingTreeDir = join(DINO_DIR, 'games', game)
  const v4Tree = hydrate(v4EngineDir, workingTreeDir)
  assert.deepEqual(v4Tree.warnings, [], 'v4 engine warned over the working-tree data')
  ok(`C3 v4 engine over games/${game}: ${countGroups(v4Tree.groups)} rows, ${countItems(v4Tree.groups)} items, no warnings`)

  // ── G1 border loudness: one warning per fault, by row, and nothing widens ──
  // Eight faults over five rows (a filter fault and a gate fault can share a
  // row — each is its own warning). The expected strings are the engine's
  // §6.1 messages verbatim, so a reworded warning fails here on purpose.
  // Row E's kind is spelled like an Object.prototype member: a plain-object
  // lookup would find the inherited function and let it through.
  const broken = structuredClone(first)
  const [rowA, rowB, rowC, rowD, rowE] = flattenGroups(broken.content.groups)
  const labelFieldOf = (row) => broken.types.types.find(type => type.id === row.query.type).fields.find(field => field.key === 'label')
  rowA.query.where = { field: 'nope-field', op: 'is', value: '' }
  rowA.showWhen = { kind: 'thingPicked', thing: 'no-such-thing' }
  rowB.query.where = { field: labelFieldOf(rowB).id, op: 'eq', value: '' }
  rowB.showWhen = { kind: 'anyInRow', row: 'no-such-row' }
  rowC.query.where = { field: 'core:cost', op: 'lte', value: '2' }
  rowC.showWhen = { kind: 'anyInRow', row: rowC.id }
  rowD.showWhen = { kind: 'sometimes' }
  rowE.showWhen = { kind: 'toString' }
  const expectedWarnings = [
    `Row "${rowA.label}" cannot run its filter — names a field that does not exist (nope-field); it shows nothing`,
    `Row "${rowA.label}" cannot evaluate its show-when — it names a thing that does not exist (no-such-thing); it is never shown`,
    `Row "${rowB.label}" cannot run its filter — operator "eq" does not fit a text field (label); it shows nothing`,
    `Row "${rowB.label}" cannot evaluate its show-when — it names a row that does not exist (no-such-row); it is never shown`,
    `Row "${rowC.label}" cannot run its filter — value "2" is not a number (cost); it shows nothing`,
    `Row "${rowC.label}" cannot evaluate its show-when — it waits for itself (or a row nested inside it); it is never shown`,
    `Row "${rowD.label}" cannot evaluate its show-when — it has an unknown kind "sometimes"; it is never shown`,
    `Row "${rowE.label}" cannot evaluate its show-when — it has an unknown kind "toString"; it is never shown`
  ]
  const brokenDir = join(WORK, 'broken', game)
  writeGame(brokenDir, broken)
  const brokenResult = hydrate(v4EngineDir, brokenDir)
  assert.deepEqual([...brokenResult.warnings].sort(), [...expectedWarnings].sort(), 'exactly one warning per fault, each naming its row')
  const brokenRows = flatSummary(brokenResult.groups)
  ;[rowA, rowB, rowC].forEach(row => assert.deepEqual(brokenRows.find(each => each.id === row.id).items, [], `"${row.label}" fails closed: no items`))
  const brokenPlay = play(v4EngineDir, brokenDir, [])
  assert.deepEqual([...brokenPlay.warnings].sort(), [...expectedWarnings].sort(), 'the play child sees the same warnings')
  ;[rowA, rowB, rowC, rowD, rowE].forEach(row => assert.ok(!brokenPlay.start.visible.includes(row.id), `"${row.label}" starts hidden — its gate became never`))
  ok(`G1 ${expectedWarnings.length} faults → ${brokenResult.warnings.length} warnings, one each by row; broken filters show nothing; broken gates start hidden`)

  // ── H1 restructure result, in-process ──
  const restructured = restructure(first, plan)
  const restructuredText = Object.fromEntries(FILES.map(name => [name, serialize(restructured[name])]))
  const expected = EXPECTED_RESTRUCTURE[game]
  assert.deepEqual(restructured.types.types.map(type => type.label), expected.types, 'type labels')
  assert.equal(Object.values(restructured.things.things).flat().length, expected.things, 'thing count')
  assert.equal(restructured.content.groups.length, expected.rows, 'top-level row count')
  assert.ok(restructured.content.groups.every(row => row.children.length === 0), 'no row has children')
  assert.deepEqual(danglingReferences(restructured), [], 'the restructured files are closed')
  const beforeIds = uuidsIn(firstText)
  const afterIds = uuidsIn(Object.values(restructuredText).join(''))
  assert.ok([...afterIds].every(id => beforeIds.has(id)), 'nothing minted')
  const lostIds = [...beforeIds].filter(id => !afterIds.has(id))
  if (game === 'dino') {
    const location = restructured.content.groups[3]
    assert.equal(location.id, DINO.rows.location, 'Lair Location sits at index 3, right after the Lair row')
    assert.deepEqual(location.showWhen, { kind: 'anyInRow', row: DINO.rows.lair }, 'Location shows once anything in the Lair row is picked')
    DINO.deleted.forEach(id => assert.ok(!Object.values(restructuredText).some(text => text.includes(id)), `${id} is gone from all five files`))
    assert.equal(Object.keys(restructured.rules.groupRules).length, 3, 'groupRules keeps the three surviving slots')
    // what may leave: the four deleted ids and the deleted type's own field ids — nothing else
    const deletedFieldIds = first.types.types.find(type => type.id === DINO.types.subGroup).fields.map(field => field.id)
    assert.deepEqual([...lostIds].sort(), [...DINO.deleted, ...deletedFieldIds].sort(), 'uuids(after) = uuids(before) − the deleted ids')
  } else {
    assert.deepEqual(lostIds, [], 'nothing lost')
    ;['content', 'rules', 'themes', 'things'].forEach(name => assert.equal(restructuredText[name], serialize(first[name]), `${name}.json byte-equal to the migrated input`))
    const relabelled = { ...first.types, types: first.types.types.map(type => ({ ...type, label: plan.relabelTypes[type.id].to })) }
    assert.equal(restructuredText.types, serialize(relabelled), 'types.json differs from the migrated input in labels only')
  }
  ok(`H1 restructure(v3 → v4, PLANS.${game}): ${expected.types.join('/')}; ${expected.things} things; ${expected.rows} rows; ${lostIds.length} ids removed, none minted; no dangling references`)

  // ── H2 the CLI: exit 0 writes H1's files; exit 1 refuses a second run; exit 2 refuses a partial state ──
  const cliDir = join(WORK, 'cli', game)
  writeGame(cliDir, rawV3)
  const run1 = runRestructureCLI(game, join(cliDir, 'data'))
  assert.equal(run1.status, 0, `first run exits 0:\n${run1.stdout}`)
  assert.deepEqual(readGameText(cliDir), restructuredText, 'the CLI wrote exactly H1\'s files')
  const run2 = runRestructureCLI(game, join(cliDir, 'data'))
  assert.equal(run2.status, 1, 'second run exits 1')
  assert.match(run2.stdout, /already restructured/)
  assert.deepEqual(readGameText(cliDir), restructuredText, 'the second run wrote nothing')
  const partialDir = join(WORK, 'partial', game)
  writeGame(partialDir, rawV3)
  const partialTypes = readGameSet(partialDir).types
  partialTypes.types[0].label = 'Oops'                 // the hand-edit: one label the plan does not expect
  writeFileSync(join(partialDir, 'data', 'types.json'), serialize(partialTypes))
  const partialBefore = readGameText(partialDir)
  const run3 = runRestructureCLI(game, join(partialDir, 'data'))
  assert.equal(run3.status, 2, 'a partial state exits 2')
  assert.match(run3.stdout, /partially restructured/)
  assert.deepEqual(readGameText(partialDir), partialBefore, 'a partial state is left untouched')
  ok('H2 CLI: exit 0 = H1\'s files; second run exit 1, nothing written; hand-edited copy exit 2, nothing written')

  // ── H3 the restructured data hydrates clean ──
  const restructuredResult = hydrate(v4EngineDir, cliDir)
  assert.deepEqual(restructuredResult.warnings, [], 'v4 engine warned over the restructured data')
  if (game === 'dino') {
    const location = flatSummary(restructuredResult.groups).find(row => row.id === DINO.rows.location)
    assert.deepEqual(location.items.map(item => item.name), ['Volcano Rim'], 'Location offers its one thing')
  }
  ok(`H3 v4 engine over the restructured data: ${countGroups(restructuredResult.groups)} rows, ${countItems(restructuredResult.groups)} items, no warnings`)

  // ── H4 the committed data is the script's output (binds after WP7) ──
  if (statusOf(migrateSet(readGameSet(workingTreeDir)), plan) === 'done') {
    assert.deepEqual(readGameText(workingTreeDir), restructuredText, 'the working tree byte-equals H1')
    ok('H4 games/' + game + ' byte-equals the restructure script\'s output')
  } else {
    console.log('  skip H4 — working tree not restructured yet')
  }

  // ── I1 play: the gate opens, closes, refunds, and says so ──
  if (game === 'dino') {
    const { rows, things } = DINO
    const played = play(v4EngineDir, cliDir, [
      { row: rows.lair,     thing: things.lavaPit },      // 1. pick a Lair (3 pts) → Location opens
      { row: rows.location, thing: things.volcanoRim },   // 2. pick the Location (1 pt)
      { row: rows.lair,     thing: things.lavaPit },      // 3. unpick the Lair → Location closes, refund
      { row: rows.location, thing: things.volcanoRim }    // 4. a pick in a hidden row is refused
    ])
    const [pickedLair, pickedLocation, unpickedLair, refused] = played.steps
    assert.deepEqual(played.warnings, [], 'no warnings while playing')
    assert.ok(!played.start.visible.includes(rows.location), 'Location starts hidden')
    assert.deepEqual(played.start.unmet, [rows.dino, rows.lair], 'only the Dino and Lair rows are required at the start')
    assert.ok(pickedLair.visible.includes(rows.location), 'picking a Lair shows Location')
    assert.equal(pickedLocation.spent, 4, 'Lava Pit (3) + Volcano Rim (1)')
    assert.ok(!unpickedLair.visible.includes(rows.location), 'unpicking the last Lair hides Location')
    assert.deepEqual(unpickedLair.dropped, ['Volcano Rim'], 'the refund is named')
    assert.equal(unpickedLair.spent, 0, 'the refund came back')
    assert.deepEqual(refused.dropped, [], 'nothing to refund — the pick never went in')
    assert.equal(refused.spent, 0, 'a pick in a hidden row is refused')
    assert.ok(!refused.visible.includes(rows.location), 'and the row stays hidden')
    played.steps.forEach(step => assert.ok(!step.unmet.includes(rows.location), 'a hidden required row never nags'))
    ok('I1 play: Lair → Location appears; Location picked (spent 4); Lair unpicked → hidden, "Volcano Rim" refunded (spent 0); hidden pick refused')
  }
}

console.log(`\nall ${checks} checks passed (work dir: ${WORK})`)
