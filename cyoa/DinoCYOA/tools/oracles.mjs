// The v3 faithfulness oracles, runnable from the repo with plain node:
//
//   node cyoa/DinoCYOA/tools/oracles.mjs            (both games)
//   node cyoa/DinoCYOA/tools/oracles.mjs vampire    (one game)
//
// (a) DETERMINISM  — migrating the same v2 set twice differs ONLY in minted uuids
// (b) IDEMPOTENCE  — save → reload → migrate → render-time write → save is byte-identical, five files
// (c) BRIDGE       — the REAL v2 engine (from git) and the REAL v3 engine (working tree)
//                    hydrate the same game to the same groups and items
//
// The v2 side always comes from git (commit CYOA_V2_COMMIT, default 79b5ec4), so
// the comparison stays v2-vs-v3 even after the migrated data has been committed.
// The v3 side runs twice: over the working-tree data (v2 files migrated in
// memory, or v3 files after the commit) and over a fresh save of the migration.
// Each hydration runs in its own node process (--hydrate mode, below) because
// gameConfig.js does its loading at import time, once per process.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const DINO_DIR = dirname(dirname(fileURLToPath(import.meta.url)))   // tools/.. = cyoa/DinoCYOA
const DINO_IN_REPO = 'cyoa/DinoCYOA'
const V2_COMMIT = process.env.CYOA_V2_COMMIT ?? '79b5ec4'
const GIT_ROOT = process.env.CYOA_GIT_REPO
  ?? execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: DINO_DIR, encoding: 'utf8' }).trim()
const FILES = ['content', 'rules', 'themes', 'types', 'things']
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

// the server's exact on-disk format
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n'

// ───────────────────────── --hydrate: child mode ─────────────────────────
// node oracles.mjs --hydrate <engineDir> <gameDir>
// Serves <gameDir>/data/*.json to the engine through a fake fetch, imports the
// engine's real gameConfig.js, prints the hydrated groups (summarized) as JSON.
if (process.argv[2] === '--hydrate') {
  const [engineDir, gameDir] = process.argv.slice(3)
  const warnings = []
  console.warn = (...parts) => warnings.push(parts.join(' '))
  globalThis.fetch = async (url) => {
    try {
      const text = readFileSync(join(gameDir, url), 'utf8')
      return { ok: true, status: 200, json: async () => JSON.parse(text) }
    } catch {
      return { ok: false, status: 404, json: async () => { throw new Error(`404 ${url}`) } }
    }
  }
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

// ───────────────────────── parent mode ─────────────────────────
const { migrateSet } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'migrations.js')).href)
const { SCHEMA_VERSION } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'schema.js')).href)
assert.equal(SCHEMA_VERSION, 3, 'these oracles describe schema version 3')

const games = process.argv.length > 2 ? process.argv.slice(2) : ['dino', 'vampire']
const WORK = mkdtempSync(join(tmpdir(), 'cyoa-oracles-'))
let checks = 0
const ok = (label) => { checks += 1; console.log(`  ok  ${label}`) }

// the v2 engine, straight from git, untouched
const v2EngineDir = join(WORK, 'v2', DINO_IN_REPO, 'engine')
mkdirSync(join(WORK, 'v2'), { recursive: true })
execFileSync('git', ['archive', '-o', join(WORK, 'v2engine.tar'), V2_COMMIT, `${DINO_IN_REPO}/engine`], { cwd: GIT_ROOT })
execFileSync('tar', ['-xf', join(WORK, 'v2engine.tar'), '-C', join(WORK, 'v2')])

const gitShow = (path) => execFileSync('git', ['show', `${V2_COMMIT}:${path}`], { cwd: GIT_ROOT, encoding: 'utf8' })
const writeGame = (gameDir, set) => {
  mkdirSync(join(gameDir, 'data'), { recursive: true })
  FILES.forEach(name => {
    if (set[name] !== null) writeFileSync(join(gameDir, 'data', `${name}.json`), serialize(set[name]))
  })
}
const hydrate = (engineDir, gameDir) => {
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--hydrate', engineDir, gameDir], { encoding: 'utf8' })
  return JSON.parse(out)
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
// every uuid that was not in the v2 files becomes MINTED#n, numbered by first appearance
const normalize = (text, knownIds) => {
  const seen = new Map()
  return text.replace(UUID, (id) => {
    if (knownIds.has(id)) return id
    if (!seen.has(id)) seen.set(id, `MINTED#${seen.size + 1}`)
    return seen.get(id)
  })
}

for (const game of games) {
  console.log(`\n${game}`)
  const gamePath = `${DINO_IN_REPO}/games/${game}/data`

  // the v2 set, as it was: three files from git, the two new ones absent
  const raw = deepFreeze({
    content: JSON.parse(gitShow(`${gamePath}/content.json`)),
    rules:   JSON.parse(gitShow(`${gamePath}/rules.json`)),
    themes:  JSON.parse(gitShow(`${gamePath}/themes.json`)),
    types:   null,
    things:  null
  })
  assert.equal(raw.content.version, 2, `${game} at ${V2_COMMIT} is a v2 game`)
  const v2Ids = uuidsIn(JSON.stringify(raw))
  const groupCount = countGroups(raw.content.groups)

  // ── (a) determinism ──
  const first = migrateSet(raw)                    // raw is frozen: a mutating step would throw
  const second = migrateSet(raw)
  const firstText = serialize(first)
  const secondText = serialize(second)
  assert.notEqual(firstText, secondText, 'ids really were minted')
  assert.equal(normalize(firstText, v2Ids), normalize(secondText, v2Ids), 'two migrations differ only in minted uuids')
  ok('(a) migrating twice differs only in minted uuids (input untouched)')
  const v3Ids = uuidsIn(firstText)
  v2Ids.forEach(id => assert.ok(v3Ids.has(id), `v2 id ${id} survives`))
  const minted = [...v3Ids].filter(id => !v2Ids.has(id))
  assert.equal(minted.length, 3 * groupCount, 'one type id + two field ids per group, at every depth')
  ok(`(a) every v2 id survives; ${minted.length} minted = 3 × ${groupCount} groups`)

  // ── (b) idempotence: save 1 → reload → migrate (no-op) → the one render-time write → save 2 ──
  FILES.forEach(name => assert.equal(first[name].version, 3, `${name}.json stamped 3`))
  const reloaded = Object.fromEntries(FILES.map(name => [name, JSON.parse(serialize(first[name]))]))
  const again = migrateSet(reloaded)
  assert.equal(again, reloaded, 'a v3 set passes the border untouched — the same object')
  again.types.types.forEach(type => { again.things.things[type.id] ??= [] })   // renderThingsLibrary's one write
  FILES.forEach(name => assert.equal(serialize(again[name]), serialize(first[name]), `${name}.json byte-identical on save 2`))
  ok('(b) save → reload → migrate → render → save: all five files byte-identical')

  // ── (b) canonical shapes and key orders ──
  const keysOf = (obj) => Object.keys(obj).join(',')
  assert.equal(keysOf(first.content), 'version,meta,groups')
  assert.equal(keysOf(first.types), 'version,types')
  assert.equal(keysOf(first.things), 'version,things')
  assert.equal(keysOf(first.rules), keysOf(raw.rules))
  assert.equal(keysOf(first.themes), keysOf(raw.themes))
  const typeIds = new Set(first.types.types.map(type => type.id))
  const checkGroup = (group) => {
    assert.equal(keysOf(group), 'id,label,displayType,children')
    assert.ok(typeIds.has(group.displayType), 'displayType points at a real type')
    assert.ok(Array.isArray(first.things.things[group.displayType]), 'that type has a bucket')
    group.children.forEach(checkGroup)
  }
  first.content.groups.forEach(checkGroup)
  first.types.types.forEach(type => {
    assert.equal(keysOf(type), 'id,label,fields')
    assert.equal(type.fields.map(field => `${field.key}:${field.type}`).join(','), 'label:text,traits:lines')
    type.fields.forEach(field => assert.equal(keysOf(field), 'id,key,caption,type'))
    first.things.things[type.id].forEach(thing => assert.equal(keysOf(thing), 'id,name,cost,imageURL,label,traits'))
  })
  assert.equal(Object.keys(first.things.things).length, first.types.types.length, 'one bucket per type, no extras')
  ok('(b) canonical key orders; one type + one bucket per group; no items left in content.json')

  // ── (a) again: a v1 game climbs 1 → 2 → 3 in one call ──
  const v1 = {
    content: { ...raw.content, version: 1, groups: raw.content.groups.map(({ id, label, items }) => ({ id, label, items })) },
    rules: { ...raw.rules, version: 1 },
    themes: { ...raw.themes, version: 1 },
    types: null,
    things: null
  }
  const v2Flat = { ...v1, content: { ...v1.content, version: 2, groups: v1.content.groups.map(group => ({ ...group, children: [] })) },
                   rules: { ...v1.rules, version: 2 }, themes: { ...v1.themes, version: 2 } }
  assert.equal(normalize(serialize(migrateSet(v1)), v2Ids), normalize(serialize(migrateSet(v2Flat)), v2Ids))
  ok('(a) v1 → v3 in one call equals v2 → v3')

  // ── the border's promise: a v3 set missing a file names it ──
  assert.throws(() => migrateSet({ ...reloaded, types: null, things: null }), /Missing data files for version 3: types, things/)
  ok('(b) a v3 game without types.json/things.json fails at the border, by name')

  // ── (c) bridge: real v2 engine vs real v3 engine ──
  const v2GameDir = join(WORK, 'v2data', game)
  writeGame(v2GameDir, raw)
  const v3SavedDir = join(WORK, 'v3data', game)
  writeGame(v3SavedDir, first)
  const v2Result = hydrate(v2EngineDir, v2GameDir)
  const v3Tree = hydrate(join(DINO_DIR, 'engine'), join(DINO_DIR, 'games', game))
  const v3Saved = hydrate(join(DINO_DIR, 'engine'), v3SavedDir)
  assert.deepEqual(v3Tree.warnings, [], 'v3 engine warned over the working-tree data')
  assert.deepEqual(v3Saved.warnings, [], 'v3 engine warned over the saved migration')
  assert.deepEqual(v3Tree.groups, v2Result.groups, 'v3 over working-tree data ≠ v2')
  assert.deepEqual(v3Saved.groups, v2Result.groups, 'v3 over the saved migration ≠ v2')
  ok(`(c) v2 engine (git ${V2_COMMIT}) and v3 engine agree: ${countGroups(v2Result.groups)} groups, ${countItems(v2Result.groups)} items, no warnings`)
}

console.log(`\nall ${checks} checks passed (work dir: ${WORK})`)
