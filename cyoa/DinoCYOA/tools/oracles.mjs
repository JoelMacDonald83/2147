// The v5 faithfulness oracles, runnable from the repo with plain node:
//
//   node cyoa/DinoCYOA/tools/oracles.mjs            (both games)
//   node cyoa/DinoCYOA/tools/oracles.mjs vampire    (one game)
//
// This file starts by running the fast logic oracles (oracles-logic.mjs, L/V/K/N,
// pure, milliseconds) and then runs the slow half — the checks that need git,
// temp dirs, child processes, the REAL server and the REAL shelf:
//
//   A1 determinism, mint-free   v3 → v5 migrated twice is byte-identical; no uuid minted or lost
//   A2 climb                    v2 → v5 equals v3 → v5 (modulo the ids step 2 mints); v1 → v5 equals v2 → v5
//   A3 v4 → v5 (NEW)            the COMMITTED v4 files climb the last step twice identically; every field id once, inside a section
//   B1 idempotence              save → reload → migrate (no-op) → render-time write → save: five files byte-identical
//   B2 canonical shapes         every key order the editor and the engine rely on, for a migrated set
//   B3 missing files by name    a v3 OR v5 set without types/things fails at the border and NAMES them
//   B5 canonical v5 shapes (NEW) §2.8 over the migrated set and (dino) the REBUILT files: sections, fieldDefs, thing key orders
//   C1 bridge v3                the REAL v3 engine (git) and the v5 engine hydrate v3 data alike
//   C2 bridge v2                the REAL v2 engine (git) and the v5 engine hydrate v2 data alike
//   C3 working tree             the v5 engine hydrates games/<game> with zero warnings
//   C4 relative paths           data/… and books/… page-relative, assets/… built — never absolute
//   C5 bridge v4 (NEW)          the REAL v4 engine (git) and the v5 engine hydrate the committed v4 data alike, and play alike
//   G1 border loudness          a hand-broken set warns ONCE per fault, by row, and fails closed
//   G2 border loudness, books (NEW)   the §5.3 shelf warns `Book fault — …` once per fault; a pin at edition 3 fails CLOSED
//   T1 the committed shelf (NEW)      what books/ holds, that every book validates, that every file is canonical
//   T2 editions (NEW)                 edition 2 is edition 1 plus exactly one thing
//   D1 rebuild in-process (NEW)       the rebuilt dino plays EXACTLY what the v4 dino played, row by row, item by item
//   D2 rebuild CLI (NEW)              exit 0 writes D1's bytes; a second run exits 1; a partial state or a short shelf exits 2
//   D3 play replay (NEW)              I1's four steps over the rebuilt files + the shelf
//   D4 the pin is real (NEW)          edition 2 puts Nest in the Lairs row; edition 3 fails closed
//   D5 committed data (NEW)           once games/dino is rebuilt it byte-equals D1 (skipped until then)
//   I1 play (dino)              pick a Lair → Location appears; unpick → it hides, refunds, and says so
//   I2 editor save order, books (NEW) a new pet placed INTO a book sheet, plus a things.order swap, land in the editor's order
//   S1 committed files fit      validateGame says [] over the committed, migrated and climbed sets
//   S2 route refuses            a bad body is a 400 that names every path and writes nothing
//   S3 editor order end-to-end  four in parallel then content; a new type + thing + row + slot lands
//   S4 checked against disk     content is refused while a sibling ON DISK is hand-broken, unparsable or missing
//   S5 the shelf's routes (NEW) /books/… and /games/<g>/books/…; the asset search path; traversal
//   S6 save against the pins (NEW)    content.json is judged WITH the shelf: F1, F3, F15 by path, nothing written
//   S7 the engine over HTTP (NEW)     5 data + 12 book urls, page-relative; every image whole
//   E1 exact file set           engine/ + data/ + assets/ + the manifest, nothing else; manifest keys fixed
//   E2 bytes                    a book-less game's data travels as its own bytes; sizes and sha256 true to the manifest
//   E3 folder hydrates          the folder plays exactly like the source, page-relative, every image present
//   E4 subpath serving          the engine over real HTTP under /site/<game>/
//   E5 idempotent               a second export is byte-identical; a stray file is rebuilt away
//   E6 refuses old data         a v4 game is refused by version; nothing written
//   E7 refuses a dangle         a dangling row or a missing image is refused with its path; the previous export survives
//   E8 wipe safety              only a marked or empty folder is written; the source, the shelf and the project are never targets
//   E9 CLI                      exit 0 prints the tree; usage exits 1; refusals exit 2 and write nothing
//   E10 ignore rules            .gitignore holds .DS_Store and dist/; git ignores both
//   E11 export flatten (NEW)    the published dino is the FLATTENED merge and needs no shelf
//   E12 assets (NEW)            the union of the game's and the books' assets/, one flat folder, collisions refused
//   E13 refusals, books (NEW)   a pin off the shelf, a broken shelf, --out inside books/ — all refused, nothing written
//   M1 GET /api/games           every folder with title, version, books, counts, faults, exported flag
//   M2 addresses                / → /dinoEdit/; /games/<name>/ serves the engine and hydrates over HTTP page-relative
//   M3 POST /api/games          a newborn from the sheets, over a scratch SHELF: it pins basic 1 and hydrates clean
//   M4 create refusals          bad titles → 400 at title, repeat → 409, not-JSON → 400; nothing written
//   M5 two games, one server    both save in the editor's order, isolated; unknown game → 404 on every route
//   M6 export + /dist/          the route writes exportGame's bytes; /dist/<name>/ hydrates alone
//   M7 traversal and case       literal "..", %2e%2e, Dino, dino%2F..%2F → 403/404, never a server file
//   M8 launch.json              one "cyoa" entry, no game argument, port 3000
//   M9 scratch only             the real games/, dist/ AND books/ are byte-identical to before the run
//   M10 the seed pins Basic (NEW)     POST /api/games over a scratch shelf; books given, books empty, an empty shelf
//   M11 GET /api/books (NEW)          every folder, every edition, the counts and the problems
//   M12 the shelf is read-only (NEW)  books/ is byte-identical after the whole run
//
// RETIRED, with the reason: H1–H4 (tools/restructure-v4.mjs). That script's
// PRECONDITION — a v4 set read from the working tree's border — no longer exists
// at SCHEMA_VERSION 5: migrateSet climbs straight past 4, so restructure-v4 can
// never be handed the shape it was written for. Its RESULT is pinned instead by
// the v4 data commit (V4_COMMIT) that A3 and C5 read, and the "one-off data
// script" oracle is now the D-checks over tools/rebuild-dino-v5.mjs. S1 drops
// its "restructured" set with them.
//
// Data for the migration and bridge checks always comes from git (the pins
// below), never from the working tree — so rebuilding the committed data cannot
// make those checks drift. The engines under comparison come from git too (git
// archive), untouched. Each hydration runs in its own node process
// (--hydrate / --hydrate-http / --play modes, below) because gameConfig.js does
// its loading at import time, once per process. The S checks run the REAL server
// (server/server.js) on a free port over a scratch GAMES root (CYOA_GAMES_DIR),
// a scratch dist root (CYOA_DIST_DIR) and a scratch SHELF (CYOA_BOOKS_DIR); the
// E checks run the real export tool in-process and as a CLI. Nothing here ever
// writes under the real games/, dist/ or books/ — M9 and M12 hash all three
// before the first check and after the last one.

import { execFileSync, spawnSync, spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, existsSync, statSync, rmSync, writeSync, chmodSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const DINO_DIR = dirname(dirname(fileURLToPath(import.meta.url)))   // tools/.. = cyoa/DinoCYOA
const DINO_IN_REPO = 'cyoa/DinoCYOA'
// FOUR pins now. The engine is byte-identical at the two v3 pins, so the v3
// engine is archived from the ENGINE pin and the v3 files are read from the DATA
// pin. NEW: V4_COMMIT is the v4 engine AND both games at v4 on disk — the last
// commit before the books arc, and the reference every "does v5 still play what
// v4 played?" check compares against.
const V2_COMMIT = process.env.CYOA_V2_COMMIT ?? '79b5ec4'            // v2 engine + v2 data
const V3_ENGINE_COMMIT = process.env.CYOA_V3_ENGINE_COMMIT ?? '11e46a2'
const V3_DATA_COMMIT = process.env.CYOA_V3_DATA_COMMIT ?? '2ab45f0'  // both games at v3 on disk
const V4_COMMIT = process.env.CYOA_V4_COMMIT ?? '1393b3e'            // NEW: v4 engine + both games at v4
const GIT_ROOT = process.env.CYOA_GIT_REPO
  ?? execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: DINO_DIR, encoding: 'utf8' }).trim()
const FILES = ['content', 'rules', 'themes', 'types', 'things']
const OPTIONAL_FILES = ['types', 'things']   // absent before v3 — reading them may come back null
const BOOK_FILE_NAMES = ['book', 'types', 'things', 'proposals']
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const REAL_BOOKS = join(DINO_DIR, 'books')   // READ-ONLY here, always: M12 hashes it

// the server's exact on-disk format
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n'

// ───────────────────────── child modes ─────────────────────────
// Every child serves <gameDir>/data/*.json to the engine through a fake fetch,
// captures console.warn, and prints ONE JSON object on stdout — nothing else may
// reach stdout, because the parent JSON.parses it.
// Every url the engine asks for is RECORDED into `fetched` before the lookup —
// the parent checks the spelling, not just the answer. The lookup itself:
// join(gameDir, url) accepts 'data/x.json' (the v4/v5 engines, page-relative)
// and '/data/x.json' (the v2 and v3 engines from git) alike, because join treats
// a leading slash on a later segment as nothing.
// CHANGED: a url under books/ is answered from `booksDir` — the SHELF, which is
// not in the game's folder. With no booksDir every book url is a 404, which is
// exactly what a published (flattened) folder is: no shelf on disk, and nothing
// that asks for one.
const BOOKS_PREFIX = 'books/'
const installFakeFetch = (gameDir, fetched = [], booksDir) => {
  globalThis.fetch = async (url) => {
    fetched.push(url)
    const rel = url.startsWith('/') ? url.slice(1) : url
    try {
      if (rel.startsWith(BOOKS_PREFIX) && booksDir === undefined) throw new Error('no shelf here')
      const text = readFileSync(rel.startsWith(BOOKS_PREFIX) ? join(booksDir, rel.slice(BOOKS_PREFIX.length)) : join(gameDir, url), 'utf8')
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

// The hydrated groups, summarized. The summary projects ONLY the fields the v2,
// v3, v4 and v5 engines all produce (a v5 row also carries query and fields; a
// v3 row carried displayType) — that is what lets C1, C2 and C5 deepEqual across
// engines. Keep it that way: a field only one engine has would make every bridge
// fail. `showWhen` is the one exception — the v2 and v3 engines have none, so
// noGates() strips it for those two bridges and project() reads it for the rest.
const summarize = (groups) => groups.map(group => ({
  id: group.id,
  label: group.label,
  min: String(group.min),               // Infinity does not survive JSON
  max: String(group.max),
  background: group.background,
  showWhen: group.showWhen ?? null,
  items: group.items.map(item => ({
    // the v4 and v5 engines build page-relative URLs (assets/x.jpg) so a
    // published folder works from any subpath; the v2 and v3 engines from git
    // still build /assets/x.jpg. Same file, two spellings — the leading slash is
    // dropped here so the bridges compare FILES, not spellings.
    id: item.id, name: item.name, cost: item.cost, imageURL: item.imageURL.replace(/^\//, ''),
    label: item.label, traits: item.traits
  })),
  children: summarize(group.children)
}))

// node oracles.mjs --hydrate <engineDir> <gameDir> [<booksDir>]
if (process.argv[2] === '--hydrate') {
  const [engineDir, gameDir, booksDir] = process.argv.slice(3)
  const warnings = captureWarnings()
  const fetched = []
  installFakeFetch(gameDir, fetched, booksDir)
  const mod = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const heroImage = mod.pageTheme?.heroImage ?? null
  const flat = (rows) => rows.flatMap(row => [row, ...flat(row.children)])
  // the item images UNSTRIPPED and distinct — summarize() drops a leading slash
  // so the bridges can compare files across engines; C4 pins the v5 spelling here
  const images = [...new Set(flat(mod.groups).flatMap(row => row.items.map(item => item.imageURL)).filter(Boolean))].sort()
  // one hydrated thing, whole, so D1 can pin a pet's placements and its Stats defaults
  const sample = (id) => flat(mod.groups).flatMap(row => row.items).find(item => item.id === id) ?? null
  const wanted = (process.env.CYOA_SAMPLE ?? '').split(',').filter(Boolean)
  const samples = Object.fromEntries(wanted.map(id => [id, sample(id)]))
  // writeSync, not process.stdout.write: on macOS a write to a pipe is asynchronous,
  // and process.exit right after it would drop everything past the 64 KB pipe buffer
  writeSync(process.stdout.fd, JSON.stringify({ warnings, fetched, heroImage, images, samples, totalBudget: mod.totalBudget ?? null, groups: summarize(mod.groups) }))
  process.exit(0)
}

// node oracles.mjs --play <engineDir> <gameDir> <stepsJSON> [<booksDir>]
// Imports the engine's real state.js (which imports gameConfig through the fake
// fetch) and PLAYS: every step is one toggle { row, thing }, both by id, and
// after each the child records what the player would see. console.log is
// silenced because state.js logs its refusals ("… is not shown") and stdout must
// stay pure JSON; the warnings are captured, not silenced — a warning is a finding.
if (process.argv[2] === '--play') {
  const [engineDir, gameDir, stepsJSON, booksDir] = process.argv.slice(3)
  const warnings = captureWarnings()
  console.log = () => {}
  installFakeFetch(gameDir, [], booksDir)
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
  writeSync(process.stdout.fd, JSON.stringify({ warnings, start: { visible, unmet }, steps }))   // sync, see --hydrate
  process.exit(0)
}

// node oracles.mjs --hydrate-http <engineDir> <baseURL>
// The same hydration over REAL HTTP. baseURL ends in index.html, and every url
// the engine asks for is resolved against it with new URL(url, baseURL) — the
// exact page-relative resolution a browser performs for a fetch from a page —
// then handed to node's real fetch. No fake fetch: the server answers, and the
// parent reads which paths it was asked for.
if (process.argv[2] === '--hydrate-http') {
  const [engineDir, baseURL] = process.argv.slice(3)
  const warnings = captureWarnings()
  const fetched = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (url) => { fetched.push(url); return realFetch(new URL(url, baseURL)) }
  const mod = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const heroImage = mod.pageTheme?.heroImage ?? null
  writeSync(process.stdout.fd, JSON.stringify({ warnings, fetched, heroImage, groups: summarize(mod.groups) }))   // sync, see --hydrate
  process.exit(0)
}

// ───────────────────────── parent mode ─────────────────────────
// The fast half runs first — a broken table or evaluator should fail here in
// milliseconds, before any git archive or child process is started. (It sits
// below the child branches because those must keep stdout pure JSON.)
const { blockedChecks } = await import('./oracles-logic.mjs')

const { migrateSet } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'migrations.js')).href)
const { SCHEMA_VERSION, fieldsOfType, listSectionsOf } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'schema.js')).href)
const { danglingReferences, forgetType, forgetThing } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'references.js')).href)
const { flattenGroups } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'helpers.js')).href)
const { validateFile, crossChecks, problemText } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'validate.js')).href)
// CHANGED: validateSet lives in merge.js now — judging a set means merging the
// layers under it. The whole merge API is imported: the D-checks flatten, the
// T-checks validate books, the E-checks compare against flattenGame.
const { validateSet, validateGame, validateBook, flattenGame, mergeLayers } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'merge.js')).href)
const SERVER_SCRIPT = join(DINO_DIR, 'server', 'server.js')
const EXPORT_SCRIPT = join(DINO_DIR, 'tools', 'export.mjs')
const REBUILD_SCRIPT = join(DINO_DIR, 'tools', 'rebuild-dino-v5.mjs')
const { exportGame, ExportRefusal, MANIFEST, TOOL, listFiles, sha256, readBookSync } = await import(pathToFileURL(EXPORT_SCRIPT).href)
const { PLAN, statusOf, rebuildDino } = await import(pathToFileURL(REBUILD_SCRIPT).href)
const { seedSet } = await import(pathToFileURL(join(DINO_DIR, 'server', 'games.js')).href)
const { shelfOf } = await import(pathToFileURL(join(DINO_DIR, 'server', 'books.js')).href)
assert.equal(SCHEMA_VERSION, 5, 'these oracles describe schema version 5')

const games = process.argv.length > 2 ? process.argv.slice(2) : ['dino', 'vampire']
const WORK = mkdtempSync(join(tmpdir(), 'cyoa-oracles-'))
let checks = 0
const ok = (label) => { checks += 1; console.log(`  ok  ${label}`) }
const skipped = []
const skip = (label) => { skipped.push(label); console.log(`  skip ${label}`) }

// an old engine, straight from git, untouched — under WORK/<name>/cyoa/DinoCYOA/engine
const archiveEngine = (commit, name) => {
  mkdirSync(join(WORK, name), { recursive: true })
  execFileSync('git', ['archive', '-o', join(WORK, `${name}.tar`), commit, `${DINO_IN_REPO}/engine`], { cwd: GIT_ROOT })
  execFileSync('tar', ['-xf', join(WORK, `${name}.tar`), '-C', join(WORK, name)])
  return join(WORK, name, DINO_IN_REPO, 'engine')
}
const v2EngineDir = archiveEngine(V2_COMMIT, 'v2')
const v3EngineDir = archiveEngine(V3_ENGINE_COMMIT, 'v3')
const v4EngineDir = archiveEngine(V4_COMMIT, 'v4')     // NEW: the last engine before the books arc
const v5EngineDir = join(DINO_DIR, 'engine')           // the working tree

const gitShow = (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], { cwd: GIT_ROOT, encoding: 'utf8' })
const writeGame = (gameDir, set) => {
  mkdirSync(join(gameDir, 'data'), { recursive: true })
  FILES.forEach(name => {
    if (set[name] !== null) writeFileSync(join(gameDir, 'data', `${name}.json`), serialize(set[name]))
  })
  return gameDir
}
const readGameText = (gameDir) => Object.fromEntries(FILES.map(name => [name, readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8')]))
const readGameSet = (gameDir) => Object.fromEntries(FILES.map(name => {
  try {
    return [name, JSON.parse(readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8'))]
  } catch (error) {
    if (error.code === 'ENOENT' && OPTIONAL_FILES.includes(name)) return [name, null]
    throw error
  }
}))
const runChild = (mode, args, env = {}) => {
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), mode, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(out)
}
// CHANGED: an optional booksDir — the shelf the child's fake fetch answers
// `books/…` from. Absent = a folder with no shelf (a published export).
const hydrate = (engineDir, gameDir, booksDir, env) => runChild('--hydrate', [engineDir, gameDir, ...(booksDir === undefined ? [] : [booksDir])], env)
const play = (engineDir, gameDir, steps, booksDir) => runChild('--play', [engineDir, gameDir, JSON.stringify(steps), ...(booksDir === undefined ? [] : [booksDir])])
// The HTTP child must NOT be run with execFileSync: the server it fetches from
// lives in THIS process, and a synchronous wait would freeze the event loop that
// answers it — the child would wait forever. So this one is awaited.
const hydrateHTTP = (engineDir, baseURL) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--hydrate-http', engineDir, baseURL], { stdio: ['ignore', 'pipe', 'inherit'] })
  let out = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`--hydrate-http exited ${code}`)))   // close, not exit: stdout is drained by then
})
// the two CLIs, exit code and all (execFileSync would throw on exit 1/2, and those are the point)
const runExportCLI = (args) => {
  const { status, stdout } = spawnSync(process.execPath, [EXPORT_SCRIPT, ...args], { encoding: 'utf8' })
  return { status, stdout }
}
const runRebuildCLI = (args) => {
  const { status, stdout } = spawnSync(process.execPath, [REBUILD_SCRIPT, ...args], { encoding: 'utf8' })
  return { status, stdout }
}

// The REAL server on a free port (PORT=0) over a scratch games ROOT, a scratch
// dist root and a scratch SHELF — no game on the command line: the server serves
// every folder under the root, and every request names its game in the URL. It
// logs every request to stdout, so stdout is DRAINED for the life of the child —
// a full pipe would block it mid-request. The banner carries the port the OS
// picked. A child that dies or stays silent rejects (and is killed), so a broken
// server fails the run instead of hanging it.
// PORT=0 ALWAYS: port 3000 is the owner's live server and nothing here may bind it.
const startServer = (gamesDir, distDir, booksDir) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [SERVER_SCRIPT], { env: { ...process.env, PORT: '0', CYOA_GAMES_DIR: gamesDir, CYOA_DIST_DIR: distDir, CYOA_BOOKS_DIR: booksDir }, stdio: ['ignore', 'pipe', 'inherit'] })
  let banner = ''
  const timer = setTimeout(() => { child.kill(); reject(new Error('server did not start in 10 s')) }, 10_000)
  child.on('exit', code => { clearTimeout(timer); reject(new Error(`server exited (${code}) before its banner`)) })
  child.stdout.on('data', chunk => { banner += chunk; const m = banner.match(/Server online at (http:\/\/localhost:\d+)/); if (m) { clearTimeout(timer); resolve({ origin: m[1], stop: () => child.kill() }) } })
})
// one POST to the save route OF ONE GAME; a string body goes over the wire AS IS (the not-JSON case)
const post = async (origin, game, name, body) => { const res = await fetch(`${origin}/api/games/${game}/save/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }); return { status: res.status, body: await res.json() } }
// exactly main.js's order: the four in parallel, content only when all four are ok
const editorSave = async (origin, game, set) => { const receipts = await Promise.all(['types', 'things', 'rules', 'themes'].map(name => post(origin, game, name, set[name]))); if (receipts.every(r => r.body.ok)) receipts.push(await post(origin, game, 'content', set.content)); return receipts }
const SAVED = { status: 200, body: { ok: true } }
// api(): any method, any path, an optional body → { status, body } where body is
// the parsed JSON — or the raw TEXT when the answer is not JSON — never a throw.
// redirect: 'manual', so a 302 is SEEN as a 302.
const api = async (origin, path, { method = 'GET', body } = {}) => {
  const init = { method, redirect: 'manual' }
  if (body !== undefined) { init.headers = { 'Content-Type': 'application/json' }; init.body = typeof body === 'string' ? body : JSON.stringify(body) }
  const res = await fetch(`${origin}${path}`, init)
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: res.status, body: parsed }
}
// get(): one GET of a full url → { status, location, text, headers }, redirects NOT followed
const get = async (url) => { const res = await fetch(url, { redirect: 'manual' }); return { status: res.status, location: res.headers.get('location'), text: await res.text(), headers: res.headers } }
// raw(): the LITERAL path over http.request → { status, text }. fetch() is a URL
// parser first: it folds "/games/../x" to "/x" and "%2e%2e" to ".." on the
// CLIENT, before anything is sent — so a traversal check through fetch would
// prove nothing about the server. http.request sends the bytes it is given.
const raw = (origin, path, method = 'GET', body = null) => new Promise((resolve, reject) => {
  const { hostname, port } = new URL(origin)
  const headers = body === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  const req = httpRequest({ hostname, port, path, method, headers }, res => {
    let text = ''
    res.setEncoding('utf8')
    res.on('data', chunk => { text += chunk })
    res.on('end', () => resolve({ status: res.statusCode, text, length: Number(res.headers['content-length'] ?? -1) }))
  })
  req.on('error', reject)
  req.end(body ?? undefined)
})
// a fetch that only wants the status (and drains the body so the socket is reused)
const fetchStatus = async (url) => { const res = await fetch(url); await res.arrayBuffer(); return res.status }

// a small static server for E4 — /<prefix>/<rest> → <rootDir>/<rest>, 404 for
// anything else (so an ABSOLUTE /data/… from the engine would die here), every
// req.url recorded. Content-Length is set by hand: E4 compares it to the size.
const serveUnder = (prefix, rootDir) => new Promise(resolve => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push(req.url)
    const { pathname } = new URL(req.url, 'http://localhost')          // the path only: a query string is not a file
    const inside = pathname.startsWith(`/${prefix}/`)
    const file = inside ? join(rootDir, decodeURIComponent(pathname.slice(prefix.length + 2))) : null
    if (file === null || !file.startsWith(rootDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404
      res.end('not found')
      return
    }
    const bytes = readFileSync(file)
    res.setHeader('Content-Length', bytes.length)
    res.end(bytes)
  })
  server.listen(0, () => resolve({ origin: `http://localhost:${server.address().port}`, requests, stop: () => server.close() }))
})

// every file's path and sha256, one line each — two folders with equal treeHash hold the same bytes
const treeHash = (dir) => listFiles(dir).map(rel => `${rel}:${sha256(join(dir, rel))}`).join('\n')
const copyGame = (from, to) => { cpSync(from, to, { recursive: true }); return to }
// NEW: the real shelf, copied into a scratch root. EVERY server and every test
// that could conceivably write reads this copy, never books/ itself.
const copyShelf = (dest) => { mkdirSync(dirname(dest), { recursive: true }); cpSync(REAL_BOOKS, dest, { recursive: true }); return dest }
// NEW: a fixture book on a scratch shelf. `files` is { book, types, things,
// proposals } — anything absent is simply not written, which is how Basic and
// Stats ship (book.json + types.json only).
const writeBook = (root, name, edition, files) => {
  const dir = join(root, name, String(edition))
  mkdirSync(dir, { recursive: true })
  BOOK_FILE_NAMES.forEach(file => { if (files[file] !== undefined) writeFileSync(join(dir, `${file}.json`), serialize(files[file])) })
  return dir
}
// NEW: what a PLAYER sees, from a summarized tree — label, min/max, background,
// the gate and the items in order. A gate naming a row is resolved to that row's
// LABEL, so two games whose row ids differ (v4 uuids vs v5 book ids) can still be
// compared position by position. This is D1's whole equality test.
const project = (groups) => {
  const labelOf = new Map()
  const walk = (rows) => rows.forEach(row => { labelOf.set(row.id, row.label); walk(row.children) })
  walk(groups)
  const gate = (showWhen) => showWhen === null || showWhen === undefined ? null
    : showWhen.kind === 'anyInRow' ? { kind: 'anyInRow', row: labelOf.get(showWhen.row) ?? showWhen.row }
    : { ...showWhen }
  const project1 = (rows) => rows.map(row => ({
    label: row.label, min: row.min, max: row.max, background: row.background, showWhen: gate(row.showWhen),
    items: row.items.map(item => ({ name: item.name, cost: item.cost, imageURL: item.imageURL })),
    children: project1(row.children)
  }))
  return project1(groups)
}
// the v2 and v3 engines have no showWhen at all, so the two old bridges compare without it
const noGates = (groups) => groups.map(({ showWhen, children, ...rest }) => ({ ...rest, children: noGates(children) }))

// an independent walker over a problem path — `.key`, `[n]` and `["k"]` tokens
// applied from the set's top — so a path is proven to lead somewhere
const resolvePath = (root, path) => {
  let at = root
  for (const [, key, index, quoted] of path.matchAll(/\.?([A-Za-z_$][\w$]*)|\[(\d+)\]|\["([^"]*)"\]/g)) at = at[key ?? quoted ?? Number(index)]
  return at
}
// the file path of the row with this id, numbered the way the file is
const pathOfRow = (rows, id, base = 'content.groups') => {
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].id === id) return `${base}[${i}]`
    const below = pathOfRow(rows[i].children, id, `${base}[${i}].children`)
    if (below) return below
  }
  return null
}
const notDot = (path) => !path.split('/').some(part => part.startsWith('.'))
const flatSummary = (groups) => groups.flatMap(group => [group, ...flatSummary(group.children)])
const imagesOf = (groups) => flatSummary(groups).flatMap(row => row.items.map(item => item.imageURL)).filter(Boolean)
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

// the four uuids the dino's v4 rows and things are addressed by, and the book
// ids that replace them once the game is rebuilt (§11.1)
const DINO = {
  rows: {
    dino:     'dc59d633-7a9d-441b-a8c5-e9224d16eec8',
    gear:     '2f388c57-809e-49c0-b03d-216b9bd894f7',
    lair:     'bdd3ed8d-74a8-455f-bef7-b115fe5d9f2e',
    location: 'cd9dd080-40ca-4ae9-9487-d67242cf7265'
  },
  things: {
    lavaPit:    '6df9e5c4-c5c9-4bb1-898b-4982df7e4722',   // Lair, 3 points
    volcanoRim: '0568ef76-cce6-4fa6-be85-0c4f56592e72'    // Location, 1 point
  }
}
const REBUILT = {
  rows: { dino: 'dinosaur-age:row-companions', gear: 'dinosaur-age:row-gear', lair: 'dinosaur-age:row-lairs', location: 'dinosaur-age:row-locations' },
  things: { lavaPit: 'dinosaur-age:lava-pit', volcanoRim: 'dinosaur-age:volcano-rim', nest: 'dinosaur-age:nest' }
}

// The real games/, dist/ and books/ as they are BEFORE anything below runs — M9
// and M12 hash them again at the very end. Every server this file starts is
// pointed at a scratch root, every export at a scratch folder, and the shelf is
// only ever READ; this is the proof.
const realGames = treeHash(join(DINO_DIR, 'games'))
const realDistDir = join(DINO_DIR, 'dist')
const realDist = existsSync(realDistDir) ? treeHash(realDistDir) : null
const realBooks = treeHash(REAL_BOOKS)

// the v5 source folder each game is served from below, filled as the loop runs
// (games/** is still at v4 on disk) — the manager block reads them back
const v5Sources = {}

for (const game of games) {
  console.log(`\n${game}`)
  const gamePath = `${DINO_IN_REPO}/games/${game}/data`
  const workingTreeDir = join(DINO_DIR, 'games', game)

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
  // NEW: the v4 set, as committed — the last shape before the books arc, and the
  // reference for "does v5 still play what v4 played?" (A3, B5, C5, D1)
  const rawV4 = deepFreeze(Object.fromEntries(FILES.map(name => [name, JSON.parse(gitShow(V4_COMMIT, `${gamePath}/${name}.json`))])))
  assert.equal(rawV4.content.version, 4, `${game} at ${V4_COMMIT} is a v4 game`)
  const v4Dir = writeGame(join(WORK, 'v4data', game), rawV4)

  // NEW (dino): the REBUILT game, in memory and on a scratch disk. games/dino is
  // still at v4 — the owner runs tools/rebuild-dino-v5.mjs once, at the end — so
  // every check below that needs the rebuilt files builds them here, from the
  // committed v4 data and the REAL shelf (read only), exactly as D1 does.
  let rebuilt = null, rebuiltDir = null, shelfLayers = null
  if (game === 'dino') {
    shelfLayers = PLAN.pins.map(pin => readBookSync(REAL_BOOKS, pin))
    rebuilt = rebuildDino(migrateSet(structuredClone(rawV4)), PLAN, shelfLayers)
    rebuiltDir = writeGame(join(WORK, 'rebuilt', game), rebuilt)
    cpSync(join(workingTreeDir, 'assets'), join(rebuiltDir, 'assets'), { recursive: true })
  }

  // ── A1 determinism, mint-free ──
  const first = migrateSet(rawV3)                  // rawV3 is frozen: a mutating step would throw
  const second = migrateSet(rawV3)
  const firstText = serialize(first)
  assert.equal(firstText, serialize(second), 'two v3 → v5 migrations are byte-identical')
  assert.ok(sameSet(uuidsIn(firstText), uuidsIn(v3Text)), 'v3 → v5 neither mints nor loses a uuid')
  ok(`A1 v3 → v5 twice is byte-identical; ${uuidsIn(v3Text).size} uuids in, the same ${uuidsIn(firstText).size} out (input untouched)`)

  // ── A2 climb ──
  // v2 → v5 mints type and field ids in step 2 only, so the two routes agree
  // once every id unknown to v2 is renamed by first appearance
  assert.equal(normalize(serialize(migrateSet(rawV2)), v2Ids), normalize(firstText, v2Ids), 'v2 → v5 equals v3 → v5 modulo minted ids')
  const v1 = {
    content: { ...rawV2.content, version: 1, groups: rawV2.content.groups.map(({ id, label, items }) => ({ id, label, items })) },
    rules: { ...rawV2.rules, version: 1 },
    themes: { ...rawV2.themes, version: 1 },
    types: null,
    things: null
  }
  const v2Flat = { ...v1, content: { ...v1.content, version: 2, groups: v1.content.groups.map(group => ({ ...group, children: [] })) },
                   rules: { ...v1.rules, version: 2 }, themes: { ...v1.themes, version: 2 } }
  assert.equal(normalize(serialize(migrateSet(v1)), v2Ids), normalize(serialize(migrateSet(v2Flat)), v2Ids), 'v1 → v5 equals v2 → v5')
  FILES.forEach(name => assert.equal(migrateSet(rawV2)[name].version, 5, `the v2 climb ends at 5 (${name})`))
  ok(`A2 v2 (git ${V2_COMMIT}) → v5 equals v3 (git ${V3_DATA_COMMIT}) → v5 modulo minted ids; v1 → v5 equals v2 → v5; every climb ends at 5`)

  // ── A3 the last step, over the COMMITTED v4 files: deterministic and mint-free ──
  const v4Text = serialize(rawV4)
  const fromV4 = migrateSet(rawV4)
  assert.equal(serialize(fromV4), serialize(migrateSet(rawV4)), 'two v4 → v5 migrations are byte-identical: the section id is DERIVED, never minted')
  assert.ok(sameSet(uuidsIn(serialize(fromV4)), uuidsIn(v4Text)), 'the same set of uuids comes out (a regex COUNT grows — <uuid>.identity holds it twice)')
  // every v4 field id survives exactly once, and now lives INSIDE a section
  const v4FieldIds = rawV4.types.types.flatMap(type => type.fields.map(field => field.id))
  const v5FieldIds = fromV4.types.types.flatMap(type => fieldsOfType(type).map(field => field.id))
  assert.deepEqual(v5FieldIds, v4FieldIds, 'every v4 field id, once, in order')
  fromV4.types.types.forEach(type => {
    assert.equal(type.sections.length, 1, 'one section per migrated type')
    assert.equal(type.sections[0].id, `${type.id}.identity`)
    assert.equal(listSectionsOf(type).length, 0, 'a migrated type has no list section')
  })
  assert.deepEqual(fromV4.content.books, [], 'a v4 game knew no books')
  assert.deepEqual(fromV4.content.rowOverrides, {})
  assert.deepEqual(validateSet(fromV4), [], 'and the result fits the v5 contract')
  ok(`A3 v4 (git ${V4_COMMIT}) → v5: twice byte-identical, ${uuidsIn(v4Text).size} uuids in and the same out, ${v4FieldIds.length} field ids each once inside a section, books: []`)

  // ── B1 idempotence: save 1 → reload → migrate (no-op) → the one render-time write → save 2 ──
  const roundTrip = (set, label) => {
    const reloaded = Object.fromEntries(FILES.map(name => [name, JSON.parse(serialize(set[name]))]))
    const again = migrateSet(reloaded)
    assert.equal(again, reloaded, `${label}: a v5 set passes the border untouched — the same object`)
    again.types.types.forEach(type => { again.things.things[type.id] ??= [] })   // repairBuckets' one write
    FILES.forEach(name => assert.equal(serialize(again[name]), serialize(set[name]), `${label}: ${name}.json byte-identical on save 2`))
  }
  roundTrip(first, 'the migrated set')
  if (rebuilt) roundTrip(rebuilt, 'the rebuilt files')
  ok(`B1 save → reload → migrate → render → save: all five files byte-identical${rebuilt ? ' (the migrated set and the rebuilt files)' : ''}`)

  // ── B2 canonical shapes and key orders ──
  FILES.forEach(name => assert.equal(first[name].version, 5, `${name}.json stamped 5`))
  assert.equal(keysOf(first.content), 'version,meta,books,groups,rowOverrides')
  assert.equal(keysOf(first.types), 'version,types,sectionsFor,fieldsFor')
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
    assert.equal(keysOf(type), 'id,label,sections')
    assert.equal(keysOf(type.sections[0]), 'id,key,caption,kind,fields')
    assert.equal(fieldsOfType(type).map(field => `${field.key}:${field.type}`).join(','), 'label:text,traits:lines')
    fieldsOfType(type).forEach(field => assert.equal(keysOf(field), 'id,key,caption,type'))
    first.things.things[type.id].forEach(thing => assert.equal(keysOf(thing), 'id,name,cost,imageURL,label,traits'))
  })
  assert.equal(Object.keys(first.things.things).length, first.types.types.length, 'one bucket per type, no extras')
  ok(`B2 canonical key orders; ${countGroups(first.content.groups)} rows each id,label,query,showWhen,children; one "identity" section per type; where null; gate always; all five stamped 5`)

  // ── B3 the border's promise: a set missing a file names it. The v3 input is
  // the line `stamp` exists for: steps 3 and 4 have to carry a null THROUGH, and
  // a { ...null, version: 5 } would turn it into a stray object that slips past
  // the check. The v5 input never runs a step — it only proves the check itself. ──
  assert.throws(() => migrateSet({ ...rawV3, types: null, things: null }), /Missing data files for version 5: types, things/)
  assert.throws(() => migrateSet({ ...rawV4, types: null, things: null }), /Missing data files for version 5: types, things/)
  assert.throws(() => migrateSet({ ...first, types: null, things: null }), /Missing data files for version 5: types, things/)
  ok('B3 a v3, v4 or v5 game without types.json/things.json fails at the border, by name')

  // ── B5 the canonical v5 shapes of §2.8, over the migrated set and (dino) the rebuilt files ──
  const checkSection = (section, where) => {
    assert.equal(keysOf(section), section.kind === 'list' ? 'id,key,caption,kind,of,placement' : 'id,key,caption,kind,fields', `${where}: section key order`)
    const fields = section.kind === 'list' ? section.placement : section.fields
    fields.forEach(field => {
      const wanted = ['id', 'key', 'caption', 'type', ...(field.options === undefined ? [] : ['options']), ...(field.default === undefined ? [] : ['default'])]
      assert.deepEqual(Object.keys(field), wanted, `${where}: fieldDef ${field.id} key order`)
    })
  }
  first.types.types.forEach(type => type.sections.forEach(section => checkSection(section, `${game} migrated`)))
  if (rebuilt) {
    assert.equal(keysOf(rebuilt.content), 'version,meta,books,groups,rowOverrides')
    assert.equal(keysOf(rebuilt.rules), 'version,groupRules', 'no totalBudget: the book proposes it')
    assert.equal(keysOf(rebuilt.themes), 'version,page,groupThemes')
    assert.equal(keysOf(rebuilt.types), 'version,types,sectionsFor,fieldsFor')
    assert.equal(keysOf(rebuilt.things), 'version,things,order', '`order` last — the game arranges the merged shelf')
    rebuilt.content.books.forEach(pin => assert.equal(keysOf(pin), 'name,edition'))
    rebuilt.things.things['basic:character'].forEach(pet => assert.equal(keysOf(pet), 'id,name,cost,imageURL,concept,size,origin,notes', `${pet.name}: the SHEET's key order`))
    rebuilt.things.things['basic:place'].forEach(place => assert.equal(keysOf(place), 'id,name,cost,imageURL,description,kind,features', `${place.name}: the SHEET's key order`))
    // the sections a rebuilt pet is drawn from are the BOOKS' — so they are checked over the MERGED set
    const merged = mergeLayers({ books: shelfLayers, game: rebuilt }).set
    merged.types.types.forEach(type => {
      assert.equal(keysOf(type), 'id,label,sections')
      type.sections.forEach(section => checkSection(section, `${game} merged`))
    })
    assert.deepEqual(Object.keys(rebuilt.things.order), ['basic:place'])
  } else {
    assert.equal(first.things.order, undefined, 'a game that arranges nothing writes no `order` key')
  }
  ok(`B5 canonical v5 shapes: file key orders of §2.8; every section id,key,caption,kind,(fields|of,placement); every fieldDef id,key,caption,type[,options][,default]${rebuilt ? '; the rebuilt pets and places in SHEET key order; things.order last' : '; no things.order'}`)

  // ── C1 bridge v3: real v3 engine vs the v5 engine, over v3 data ──
  const v3GitDir = writeGame(join(WORK, 'v3data', game), rawV3)     // the committed v3 files — the lazy path for the v5 engine
  const v5SavedDir = writeGame(join(WORK, 'v5data', game), first)   // the migration, saved
  const v3Result = hydrate(v3EngineDir, v3GitDir)
  const v5Lazy = hydrate(v5EngineDir, v3GitDir)
  const v5Saved = hydrate(v5EngineDir, v5SavedDir)
  assert.deepEqual(v3Result.warnings, [], 'v3 engine warned over the v3 data')
  assert.deepEqual(v5Lazy.warnings, [], 'v5 engine warned over the v3 data (lazy migration)')
  assert.deepEqual(v5Saved.warnings, [], 'v5 engine warned over the saved migration')
  assert.deepEqual(noGates(v5Lazy.groups), noGates(v3Result.groups), 'v5 over v3 data ≠ v3 engine')
  assert.deepEqual(noGates(v5Saved.groups), noGates(v3Result.groups), 'v5 over the saved migration ≠ v3 engine')
  assert.deepEqual(v5Lazy.fetched, FILES.map(name => `data/${name}.json`), 'a book-less game asks for the five data files and NOTHING else')
  ok(`C1 v3 engine (git ${V3_ENGINE_COMMIT}) and v5 engine agree: ${countGroups(v3Result.groups)} rows, ${countItems(v3Result.groups)} items, no warnings, zero book fetches`)

  // ── C2 bridge v2: real v2 engine vs the v5 engine, over v2 data ──
  const v2GameDir = writeGame(join(WORK, 'v2data', game), rawV2)
  const v2Result = hydrate(v2EngineDir, v2GameDir)
  const v5OverV2 = hydrate(v5EngineDir, v2GameDir)
  assert.deepEqual(v5OverV2.warnings, [], 'v5 engine warned over the v2 data')
  assert.deepEqual(noGates(v5OverV2.groups), noGates(v2Result.groups), 'v5 over v2 data ≠ v2 engine')
  assert.deepEqual(v5OverV2.fetched, FILES.map(name => `data/${name}.json`))
  ok(`C2 v2 engine (git ${V2_COMMIT}) and v5 engine agree: ${countGroups(v2Result.groups)} rows, ${countItems(v2Result.groups)} items, no warnings, zero book fetches`)

  // ── C3 the working tree hydrates clean (true before and after the rebuild) ──
  // For dino the child is given the REAL shelf: games/dino is still at v4 here,
  // so it pins nothing and asks for nothing — but the day it is rebuilt this same
  // line keeps working, because the shelf is there to answer.
  const treeBooksDir = game === 'dino' ? REAL_BOOKS : undefined
  const v5Tree = hydrate(v5EngineDir, workingTreeDir, treeBooksDir)
  assert.deepEqual(v5Tree.warnings, [], 'v5 engine warned over the working-tree data')
  ok(`C3 v5 engine over games/${game}: ${countGroups(v5Tree.groups)} rows, ${countItems(v5Tree.groups)} items, no warnings`)

  // ── C4 the v5 engine asks for page-relative URLs — the one rule that lets a published folder play from any subpath ──
  // CHANGED: the working tree's game may PIN books (dino does, since the rebuild), so
  // what it asks for is the five data files and then four files per pin, in pin order —
  // computed from the game on disk rather than assumed, so this line stays true either way.
  const treePins = migrateSet(readGameSet(workingTreeDir)).content.books
  assert.deepEqual(
    v5Tree.fetched,
    [...FILES.map(name => `data/${name}.json`), ...treePins.flatMap(pin => BOOK_FILE_NAMES.map(file => `books/${pin.name}/${pin.edition}/${file}.json`))],
    'the five data files, then four files per pinned book, page-relative, in loader order')
  assert.equal(v5Tree.heroImage, 'assets/heroBG.jpg', 'the hero is assets/…, not /assets/…')
  // the summarizer strips a leading slash for the bridges, so the item images are checked UNSTRIPPED
  assert.ok(v5Tree.images.length > 0 && v5Tree.images.every(url => url.startsWith('assets/')), `unstripped item images: ${v5Tree.images.join(', ')}`)
  let bookURLs = []
  if (rebuilt) {
    // NEW: a game WITH pins asks for the shelf too — page-relative, beside data/,
    // four files per book in PIN order, and nothing else.
    const rebuiltHydration = hydrate(v5EngineDir, rebuiltDir, REAL_BOOKS)
    assert.deepEqual(rebuiltHydration.warnings, [], 'the rebuilt game hydrates clean')
    bookURLs = PLAN.pins.flatMap(pin => BOOK_FILE_NAMES.map(file => `books/${pin.name}/${pin.edition}/${file}.json`))
    assert.deepEqual(rebuiltHydration.fetched, [...FILES.map(name => `data/${name}.json`), ...bookURLs], 'the five data files, then twelve book files in pin order')
    assert.ok(rebuiltHydration.fetched.every(url => url.startsWith('data/') || url.startsWith('books/')), 'every url is page-relative')
    assert.ok(rebuiltHydration.images.every(url => url.startsWith('assets/')), 'a BOOK\'s picture is still assets/<name> — the layer it came from is not in the url')
    assert.equal(rebuiltHydration.heroImage, 'assets/heroBG.jpg')
  }
  ok(`C4 the v5 engine asks for data/… ${rebuilt ? `then ${bookURLs.length} books/… in pin order ` : ''}and builds assets/… — page-relative, never absolute`)

  // ── C5 bridge v4: the REAL v4 engine and the v5 engine over the committed v4 data ──
  const v4Result = hydrate(v4EngineDir, v4Dir)
  const v5OverV4 = hydrate(v5EngineDir, v4Dir)
  const v5SavedV5 = hydrate(v5EngineDir, writeGame(join(WORK, 'v4toV5', game), migrateSet(structuredClone(rawV4))))
  assert.deepEqual(v4Result.warnings, [], 'the v4 engine warned over its own data')
  assert.deepEqual(v5OverV4.warnings, [], 'the v5 engine warned over the v4 data (lazy migration)')
  assert.deepEqual(v5SavedV5.warnings, [], 'the v5 engine warned over the SAVED migration')
  assert.deepEqual(v5OverV4.groups, v4Result.groups, 'v5 over v4 data ≠ v4 engine')
  assert.deepEqual(v5SavedV5.groups, v4Result.groups, 'v5 over the saved migration ≠ v4 engine')
  assert.deepEqual(v5OverV4.fetched, FILES.map(name => `data/${name}.json`), 'a book-less v4 game asks for no shelf')
  assert.equal(v5OverV4.totalBudget, v4Result.totalBudget, 'and the budget is the same number')
  ok(`C5 v4 engine (git ${V4_COMMIT}) and v5 engine agree over the committed v4 data and over its saved migration: ${countGroups(v4Result.groups)} rows, ${countItems(v4Result.groups)} items, no warnings, no book fetch`)

  // ── G1 border loudness: one warning per fault, by row, and nothing widens ──
  // Eight faults over five rows (a filter fault and a gate fault can share a row
  // — each is its own warning). The expected strings are the engine's §3.5
  // messages verbatim, so a reworded warning fails here on purpose. Row E's kind
  // is spelled like an Object.prototype member: a plain-object lookup would find
  // the inherited function and let it through.
  const broken = structuredClone(first)
  const [rowA, rowB, rowC, rowD, rowE] = flattenGroups(broken.content.groups)
  const labelFieldOf = (row) => fieldsOfType(broken.types.types.find(type => type.id === row.query.type)).find(field => field.key === 'label')
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
  const brokenDir = writeGame(join(WORK, 'broken', game), broken)
  const brokenResult = hydrate(v5EngineDir, brokenDir)
  assert.deepEqual([...brokenResult.warnings].sort(), [...expectedWarnings].sort(), 'exactly one warning per fault, each naming its row')
  const brokenRows = flatSummary(brokenResult.groups)
  ;[rowA, rowB, rowC].forEach(row => assert.deepEqual(brokenRows.find(each => each.id === row.id).items, [], `"${row.label}" fails closed: no items`))
  const brokenPlay = play(v5EngineDir, brokenDir, [])
  assert.deepEqual([...brokenPlay.warnings].sort(), [...expectedWarnings].sort(), 'the play child sees the same warnings')
  ;[rowA, rowB, rowC, rowD, rowE].forEach(row => assert.ok(!brokenPlay.start.visible.includes(row.id), `"${row.label}" starts hidden — its gate became never`))
  ok(`G1 ${expectedWarnings.length} faults → ${brokenResult.warnings.length} warnings, one each by row; broken filters show nothing; broken gates start hidden`)

  // ═════════════════════ the shelf and the rebuild (dino) ═════════════════════
  if (game === 'dino') {
    // ── I1 play, over the COMMITTED v4 data: the gate opens, closes, refunds, and says so ──
    const I1_STEPS = [
      { row: DINO.rows.lair,     thing: DINO.things.lavaPit },      // 1. pick a Lair (3 pts) → Location opens
      { row: DINO.rows.location, thing: DINO.things.volcanoRim },   // 2. pick the Location (1 pt)
      { row: DINO.rows.lair,     thing: DINO.things.lavaPit },      // 3. unpick the Lair → Location closes, refund
      { row: DINO.rows.location, thing: DINO.things.volcanoRim }    // 4. a pick in a hidden row is refused
    ]
    const checkPlay = (played, rows, things, label) => {
      const [pickedLair, pickedLocation, unpickedLair, refused] = played.steps
      assert.deepEqual(played.warnings, [], `${label}: no warnings while playing`)
      assert.ok(!played.start.visible.includes(rows.location), `${label}: Location starts hidden`)
      assert.deepEqual(played.start.unmet, [rows.dino, rows.lair], `${label}: only the Dino and Lair rows are required at the start`)
      assert.ok(pickedLair.visible.includes(rows.location), `${label}: picking a Lair shows Location`)
      assert.equal(pickedLocation.spent, 4, `${label}: Lava Pit (3) + Volcano Rim (1)`)
      assert.ok(!unpickedLair.visible.includes(rows.location), `${label}: unpicking the last Lair hides Location`)
      assert.deepEqual(unpickedLair.dropped, ['Volcano Rim'], `${label}: the refund is named`)
      assert.equal(unpickedLair.spent, 0, `${label}: the refund came back`)
      assert.deepEqual(refused.dropped, [], `${label}: nothing to refund — the pick never went in`)
      assert.equal(refused.spent, 0, `${label}: a pick in a hidden row is refused`)
      assert.ok(!refused.visible.includes(rows.location), `${label}: and the row stays hidden`)
      played.steps.forEach(step => assert.ok(!step.unmet.includes(rows.location), `${label}: a hidden required row never nags`))
    }
    checkPlay(play(v5EngineDir, v4Dir, I1_STEPS), DINO.rows, DINO.things, 'v5 over v4')
    // the same four steps under the REAL v4 engine give the same snapshots — C5's play half
    const v4Play = play(v4EngineDir, v4Dir, I1_STEPS)
    assert.deepEqual(play(v5EngineDir, v4Dir, I1_STEPS), v4Play, 'the v4 and v5 engines play the committed v4 data identically')
    ok('I1 play: Lair → Location appears; Location picked (spent 4); Lair unpicked → hidden, "Volcano Rim" refunded (spent 0); hidden pick refused — identical under the v4 and v5 engines')

    // ── T1 the committed shelf ──
    const shelf = await shelfOf(REAL_BOOKS)
    const folders = readdirSync(REAL_BOOKS, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    assert.deepEqual(folders, ['basic', 'dinosaur-age', 'stats'], 'three book folders')
    const editionsOf = (name) => readdirSync(join(REAL_BOOKS, name)).filter(entry => !entry.startsWith('.')).sort()
    assert.deepEqual(editionsOf('basic'), ['1'])
    assert.deepEqual(editionsOf('stats'), ['1'])
    assert.deepEqual(editionsOf('dinosaur-age'), ['1', '2'])
    const editions = [['basic', 1], ['stats', 1], ['dinosaur-age', 1], ['dinosaur-age', 2]]
    editions.forEach(([name, edition]) => {
      const layer = readBookSync(REAL_BOOKS, { name, edition })
      assert.ok(layer !== null, `books/${name}/${edition} loads`)
      assert.deepEqual(validateBook(layer, shelf).map(problemText), [], `books/${name}/${edition} validates`)
      assert.equal(layer.manifest.version, undefined, 'book.json is not a data file: no version key')
      assert.deepEqual(Object.keys(layer.manifest), ['name', 'title', 'edition', 'requires'], 'the manifest\'s canonical key order')
      // every file on the shelf is canonical bytes: serialize(parse(text)) === text
      BOOK_FILE_NAMES.forEach(file => {
        const path = join(REAL_BOOKS, name, String(edition), `${file}.json`)
        if (!existsSync(path)) return
        const text = readFileSync(path, 'utf8')
        assert.equal(serialize(JSON.parse(text)), text, `books/${name}/${edition}/${file}.json is canonical`)
      })
      // every id the book DEFINES is in its own namespace (validateBook says so too; this is the census)
      const defined = [
        ...(layer.types?.types ?? []).flatMap(type => [type.id, ...type.sections.flatMap(section => [section.id, ...(section.fields ?? section.placement ?? []).map(field => field.id)])]),
        ...Object.values(layer.types?.sectionsFor ?? {}).flat().map(section => section.id),
        ...Object.values(layer.types?.fieldsFor ?? {}).flat().map(field => field.id),
        ...Object.values(layer.things?.things ?? {}).flat().map(thing => thing.id),
        ...(layer.proposals?.groups ?? []).map(row => row.id)
      ]
      assert.ok(defined.length > 0, `books/${name}/${edition} defines something`)
      defined.forEach(id => {
        assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id), `${id} fits the book-id grammar`)
        assert.ok(id.startsWith(`${name}:`), `${id} is in ${name}'s namespace`)
      })
    })
    // structure only: Basic and Stats ship a manifest and a types.json, nothing else
    ;['basic', 'stats'].forEach(name => {
      assert.deepEqual(readdirSync(join(REAL_BOOKS, name, '1')).sort(), ['book.json', 'types.json'], `books/${name}/1 holds exactly two files`)
    })
    const basic = readBookSync(REAL_BOOKS, { name: 'basic', edition: 1 })
    assert.equal(basic.types.types.length, 7, 'Basic: seven sheets')
    assert.equal(basic.types.types.reduce((n, type) => n + type.sections.length, 0), 23, 'Basic: twenty-three sections')
    assert.deepEqual(basic.types.types.map(type => type.id), ['basic:character', 'basic:item', 'basic:place', 'basic:faction', 'basic:origin', 'basic:trait', 'basic:skill'])
    const stats = readBookSync(REAL_BOOKS, { name: 'stats', edition: 1 })
    assert.equal(Object.values(stats.types.fieldsFor).flat().length, 5, 'Stats: five field additions')
    const da1 = readBookSync(REAL_BOOKS, { name: 'dinosaur-age', edition: 1 })
    assert.equal(Object.values(da1.things.things).flat().length, 23, 'Dinosaur Age 1: twenty-three shelf entries')
    assert.deepEqual(Object.keys(da1.things.things), ['basic:origin', 'basic:trait', 'basic:skill', 'basic:item', 'basic:place'], 'in the §10.3 bucket order')
    assert.deepEqual(Object.values(da1.things.things).map(bucket => bucket.length), [6, 6, 4, 4, 3])
    assert.equal(Object.values(da1.types.fieldsFor).flat().length, 4, 'Dinosaur Age 1: four field additions')
    assert.equal(da1.proposals.groups.length, 4, 'and four proposed rows')
    // the four gear images are byte copies of the game's own
    const GEAR = ['banana.png', 'cannon.jpg', 'rock.jpeg', 'skates.jpg']
    ;[1, 2].forEach(edition => {
      const dir = join(REAL_BOOKS, 'dinosaur-age', String(edition), 'assets')
      assert.deepEqual(readdirSync(dir).filter(notDot).sort(), GEAR, `dinosaur-age/${edition}/assets holds exactly the four gear images`)
      GEAR.forEach(file => assert.equal(sha256(join(dir, file)), sha256(join(workingTreeDir, 'assets', file)), `${file}: the same bytes as games/dino/assets`))
    })
    ;['basic', 'stats'].forEach(name => assert.equal(existsSync(join(REAL_BOOKS, name, '1', 'assets')), false, `books/${name}/1 has no assets/`))
    ok(`T1 the committed shelf: basic/1, stats/1, dinosaur-age/1 and /2; validateBook = [] for all four; every defined id in its own namespace and grammar; every file canonical; Basic 7 sheets / 23 sections, Stats 5 additions, Dinosaur Age 23 things / 4 additions / 4 rows; the four gear images byte-equal to games/dino/assets`)

    // ── T2 editions: edition 2 is edition 1 plus exactly one thing ──
    const da2 = readBookSync(REAL_BOOKS, { name: 'dinosaur-age', edition: 2 })
    const at = (edition, file) => readFileSync(join(REAL_BOOKS, 'dinosaur-age', String(edition), `${file}.json`), 'utf8')
    assert.equal(at(2, 'types'), at(1, 'types'), 'types.json byte-identical')
    assert.equal(at(2, 'proposals'), at(1, 'proposals'), 'proposals.json byte-identical')
    assert.deepEqual(da2.manifest, { ...da1.manifest, edition: 2 }, 'book.json differs only in `edition`')
    assert.deepEqual(da2.manifest.requires, da1.manifest.requires)
    const thingsOf = (layer) => Object.entries(layer.things.things).flatMap(([sheet, bucket]) => bucket.map(thing => [thing.id, sheet]))
    const ids1 = new Map(thingsOf(da1)), ids2 = new Map(thingsOf(da2))
    ids1.forEach((sheet, id) => {
      assert.equal(ids2.get(id), sheet, `${id} is still on ${sheet} in edition 2`)
      const before = Object.values(da1.things.things).flat().find(thing => thing.id === id)
      const after = Object.values(da2.things.things).flat().find(thing => thing.id === id)
      assert.deepEqual(after, before, `${id} is unchanged in edition 2`)
    })
    const added = [...ids2.keys()].filter(id => !ids1.has(id))
    assert.deepEqual(added, ['dinosaur-age:nest'], 'edition 2 adds exactly one thing')
    const nest = da2.things.things['basic:place'].find(thing => thing.id === 'dinosaur-age:nest')
    assert.deepEqual([nest.name, nest.cost, nest.kind], ['Nest', 1, 'lair'])
    assert.equal(da2.things.things['basic:place'].indexOf(nest), 2, 'at index 2 of the Place bucket — between Play pen and Volcano Rim')
    ok('T2 editions: every id of Dinosaur Age 1 is in edition 2 on the same sheet, unchanged; edition 2 adds exactly dinosaur-age:nest (a lair, cost 1, index 2); types.json and proposals.json byte-identical; book.json differs only in `edition`')

    // ── D1 rebuild in-process — the exact-order equality test ──
    // The whole books arc's promise to the player, measured: the rebuilt dino,
    // merged against the real shelf and hydrated by the real engine, shows the
    // same four rows with the same labels, gates, min/max, backgrounds and the
    // same seventeen items IN ORDER as the committed v4 game under the v4 engine.
    const migratedV4 = migrateSet(structuredClone(rawV4))
    assert.deepEqual(validateGame({ own: rebuilt, books: shelfLayers }).map(problemText), [], 'the rebuilt game validates against its shelf')
    assert.deepEqual(rebuilt.content.books, PLAN.pins, 'the three pins')
    assert.deepEqual(rebuilt.content.groups, [], 'the game owns no rows any more')
    assert.deepEqual(rebuilt.content.rowOverrides, Object.fromEntries(Object.values(PLAN.rows).map(({ from, to }) => [to, { label: from }])), 'four labels, and nothing else, overridden')
    assert.deepEqual(rebuilt.rules, { version: 5, groupRules: {} }, 'rules keeps an empty cabinet — the book proposes the numbers')
    assert.deepEqual(rebuilt.types, { version: 5, types: [], sectionsFor: {}, fieldsFor: {} }, 'all four sheets are Basic\'s now')
    assert.deepEqual(rebuilt.themes.page, migratedV4.themes.page, 'the page theme is untouched — it was never about a row')
    assert.deepEqual(Object.keys(rebuilt.themes.groupThemes), Object.keys(migratedV4.themes.groupThemes).map(id => PLAN.rows[id].to), 'the two backgrounds are RE-KEYED to the proposed rows')
    assert.deepEqual(Object.values(rebuilt.themes.groupThemes), Object.values(migratedV4.themes.groupThemes), 'with the same values')
    assert.deepEqual(Object.keys(rebuilt.things.things), ['basic:character', 'basic:place'], 'only the two buckets this game still owns')
    assert.equal(Object.values(rebuilt.things.things).flat().length, 10, 'ten own things: eight pets and two joke lairs')
    assert.deepEqual(rebuilt.things.order, PLAN.order, 'and the v4 Lair order, written down')
    // the uuid census: nothing minted, nothing lost beyond the 23 the plan retires
    const beforeIds = uuidsIn(serialize(migratedV4))
    const afterIds = uuidsIn(serialize(rebuilt))
    assert.ok([...afterIds].every(id => beforeIds.has(id)), 'no uuid was minted')
    assert.equal(beforeIds.size - afterIds.size, 23, 'exactly 23 uuids retire')
    assert.equal(afterIds.size, 10, 'ten survive — the cast')
    assert.equal(statusOf(rebuilt, PLAN), 'done', 'and the result reads as `done`')
    assert.equal(statusOf(migratedV4, PLAN), 'fresh', 'while the committed v4 game reads as `fresh`')
    // the REAL engine over the rebuilt files + the REAL shelf
    const TALI = 'a8d09a0f-f269-4a04-a173-d694dc36b105'
    const rebuiltPlay = hydrate(v5EngineDir, rebuiltDir, REAL_BOOKS, { CYOA_SAMPLE: TALI })
    assert.deepEqual(rebuiltPlay.warnings, [], 'zero warnings')
    assert.equal(countGroups(rebuiltPlay.groups), 4, 'four rows')
    assert.equal(countItems(rebuiltPlay.groups), 17, 'seventeen items')
    assert.equal(rebuiltPlay.totalBudget, 10, 'the budget SHOWS THROUGH from Dinosaur Age')
    assert.equal(rebuilt.rules.totalBudget, undefined, 'because the game writes none')
    // THE equality: what a player sees, row by row, item by item, in order
    assert.deepEqual(project(rebuiltPlay.groups), project(v4Result.groups), 'the rebuilt dino projects EXACTLY what the v4 dino projected')
    // spelled out, so a failure above says which row
    const [companions, gear, lairs, locations] = rebuiltPlay.groups
    assert.deepEqual(rebuiltPlay.groups.map(row => row.id), [REBUILT.rows.dino, REBUILT.rows.gear, REBUILT.rows.lair, REBUILT.rows.location])
    assert.deepEqual(rebuiltPlay.groups.map(row => row.label), Object.values(PLAN.rows).map(each => each.from), 'the four v4 labels, in order')
    assert.deepEqual(rebuiltPlay.groups.map(row => `${row.min}/${row.max}`), ['1/1', '0/Infinity', '1/3', '0/Infinity'])
    const shown = (row) => row.items.map(item => `${item.name} ${item.cost} ${item.imageURL}`)
    assert.deepEqual(shown(companions), ['Tali 1 assets/dino.jpg', 'Miku 2 assets/flyer.jpg', 'Speedy Gonzales 2 assets/velo.png', 'The King 3 assets/trex.jpg', 'Dino Jesus 1 assets/trex.jpg', 'Jeff 2 assets/anky.jpg', 'Dino Sandra Bullock 4 assets/stag.jpg', 'Cery 4 assets/tri.png'])
    assert.deepEqual(shown(gear), ['Water Gun 1 assets/cannon.jpg', 'Dino Skates 1 assets/skates.jpg', 'THE BANANA 2 assets/banana.png', 'Cute rock 0 assets/rock.jpeg'])
    assert.deepEqual(shown(lairs), ['The Scritches Dimension 0 ', 'Lava Pit 3 ', 'Play pen 2 ', 'King of Burger!! 2 '])
    assert.deepEqual(shown(locations), ['Volcano Rim 1 '])
    assert.deepEqual(locations.showWhen, { kind: 'anyInRow', row: REBUILT.rows.lair }, 'the Location row waits on the Lair row')
    // B7, the one accepted visible change: a pet now carries the shelf's fields
    const tali = rebuiltPlay.samples[TALI]
    assert.equal(tali.concept, 'A biggie dino!', 'the v4 `label` became Basic\'s `concept`')
    assert.equal(tali.size, 'biggie')
    assert.deepEqual(tali.origin, [{ thing: 'dinosaur-age:tyrannosaurus', name: 'Tyrannosaurus' }], 'a placement resolves to its pointer AND the placed thing\'s name')
    ;['strength', 'dexterity', 'intelligence', 'health'].forEach(key => assert.equal(tali[key], 10, `${key} hydrates to Stats' default 10 — Tali says nothing`))
    ok('D1 rebuild in-process: the rebuilt files are the planned ones (three pins, four label overrides, empty rules/types, re-keyed themes, ten own things, the v4 Lair order); 23 uuids retire and none is minted; the real engine over the real shelf gives 4 rows, 17 items, budget 10, zero warnings, and a projection deep-equal to the v4 engine\'s over the committed v4 data')

    // ── D2 the rebuild CLI: exit 0 writes D1's bytes; 1 refuses a second run; 2 refuses a guess ──
    const rebuiltText = Object.fromEntries(FILES.map(name => [name, serialize(rebuilt[name])]))
    const scratchShelf = copyShelf(join(WORK, 'shelf-cli', 'books'))
    const cliDir = writeGame(join(WORK, 'rebuild-cli', game), rawV4)
    const run1 = runRebuildCLI(['--data-dir', join(cliDir, 'data'), '--books-dir', scratchShelf])
    assert.equal(run1.status, 0, `first run exits 0:\n${run1.stdout}`)
    assert.deepEqual(readGameText(cliDir), rebuiltText, 'the CLI wrote exactly D1\'s bytes')
    assert.match(run1.stdout, /dino rebuilt on basic 1, stats 1, dinosaur-age 1/)
    assert.match(run1.stdout, /17 items in v4 order/)
    assert.match(run1.stdout, /wrote 5 files to /)
    const run2 = runRebuildCLI(['--data-dir', join(cliDir, 'data'), '--books-dir', scratchShelf])
    assert.equal(run2.status, 1, 'a second run exits 1')
    assert.match(run2.stdout, /already rebuilt — nothing written/)
    assert.deepEqual(readGameText(cliDir), rebuiltText, 'and wrote nothing')
    const partialDir = writeGame(join(WORK, 'rebuild-partial', game), rawV4)
    const partialThings = readGameSet(partialDir).things
    partialThings.things[Object.keys(partialThings.things)[0]][0].name = 'Oops'   // one hand-edit the plan does not expect
    writeFileSync(join(partialDir, 'data', 'things.json'), serialize(partialThings))
    const partialBefore = readGameText(partialDir)
    const run3 = runRebuildCLI(['--data-dir', join(partialDir, 'data'), '--books-dir', scratchShelf])
    assert.equal(run3.status, 2, 'a hand-edited copy exits 2')
    assert.match(run3.stdout, /partially rebuilt — restore data from git/)
    assert.match(run3.stdout, /^not fresh: /m, 'and BOTH audits are printed, so the state is diagnosable')
    assert.match(run3.stdout, /^not done: /m)
    assert.deepEqual(readGameText(partialDir), partialBefore, 'nothing written')
    // a shelf that cannot answer a pin: exit 2, and the pin is named
    const shortShelf = copyShelf(join(WORK, 'shelf-short', 'books'))
    rmSync(join(shortShelf, 'stats'), { recursive: true })
    const freshDir = writeGame(join(WORK, 'rebuild-short', game), rawV4)
    const freshBefore = readGameText(freshDir)
    const run4 = runRebuildCLI(['--data-dir', join(freshDir, 'data'), '--books-dir', shortShelf])
    assert.equal(run4.status, 2, 'a shelf missing Stats exits 2')
    assert.match(run4.stdout, /"stats" 1 is not on the shelf/)
    assert.match(run4.stdout, /nothing written/)
    assert.deepEqual(readGameText(freshDir), freshBefore, 'and really wrote nothing')
    const usage = runRebuildCLI(['--nope'])
    assert.equal(usage.status, 1)
    assert.match(usage.stdout, /usage: node rebuild-dino-v5\.mjs/)
    ok('D2 rebuild CLI: exit 0 writes D1\'s bytes and prints the summary; a second run exits 1 (already rebuilt); a hand-edited copy exits 2 printing both audits; a shelf without Stats exits 2 naming the pin; usage exits 1 — nothing written on 1 or 2')

    // ── D3 play replay: I1's four steps over the REBUILT files + the shelf ──
    const rebuiltSteps = [
      { row: REBUILT.rows.lair,     thing: REBUILT.things.lavaPit },
      { row: REBUILT.rows.location, thing: REBUILT.things.volcanoRim },
      { row: REBUILT.rows.lair,     thing: REBUILT.things.lavaPit },
      { row: REBUILT.rows.location, thing: REBUILT.things.volcanoRim }
    ]
    checkPlay(play(v5EngineDir, rebuiltDir, rebuiltSteps, REAL_BOOKS), REBUILT.rows, REBUILT.things, 'the rebuilt game')
    ok('D3 play replay: the rebuilt dino plays I1 exactly — Location starts hidden, a Lair opens it, Volcano Rim costs 4, unpicking refunds "Volcano Rim" to 0 and hides it, a pick in a hidden row is refused, zero warnings')

    // ── D4 the pin is real: edition 2 puts Nest in the Lairs row; edition 3 fails closed ──
    const atEdition = (edition) => {
      const set = structuredClone(rebuilt)
      set.content.books = PLAN.pins.map(pin => pin.name === 'dinosaur-age' ? { name: pin.name, edition } : pin)
      const dir = writeGame(join(WORK, `pinned-${edition}`, game), set)
      cpSync(join(workingTreeDir, 'assets'), join(dir, 'assets'), { recursive: true })
      return hydrate(v5EngineDir, dir, scratchShelf)
    }
    const one = atEdition(1)
    const two = atEdition(2)
    assert.deepEqual(two.warnings, [], 'edition 2 hydrates clean')
    assert.deepEqual(one.groups[2].items.map(item => item.name), ['The Scritches Dimension', 'Lava Pit', 'Play pen', 'King of Burger!!'])
    assert.deepEqual(two.groups[2].items.map(item => item.name), ['The Scritches Dimension', 'Lava Pit', 'Play pen', 'King of Burger!!', 'Nest'], 'Nest lands at index 4 — after the game\'s arrangement')
    assert.equal(countItems(two.groups), 18)
    const withoutNest = structuredClone(two.groups)
    withoutNest[2].items = withoutNest[2].items.filter(item => item.name !== 'Nest')
    assert.deepEqual(project(withoutNest), project(one.groups), 'the two hydrations differ ONLY there')
    // edition 3 is not on the shelf: ONE fault, and the rows that showed the book's shelves offer nothing
    const three = atEdition(3)
    assert.deepEqual(three.warnings.filter(line => line.includes('is not on the shelf')),
      ['Book fault — content.books[2]: "dinosaur-age" 3 is not on the shelf; the book is skipped'])
    assert.equal(countGroups(three.groups), 0, 'every row this game shows is PROPOSED by Dinosaur Age — skipping it leaves no rows at all (fail closed)')
    assert.equal(countItems(three.groups), 0)
    ok('D4 the pin is real: at edition 1 the Lair row offers 4, at edition 2 it offers 5 with Nest at index 4 and nothing else differs; at edition 3 the book is skipped, F1 is warned, and the game falls closed to zero rows')

    // ── D5 the committed data (binds once the owner runs the rebuild) ──
    if (statusOf(migrateSet(readGameSet(workingTreeDir)), PLAN) === 'done') {
      assert.deepEqual(readGameText(workingTreeDir), rebuiltText, 'games/dino byte-equals D1\'s output')
      assert.equal(treeHash(REAL_BOOKS), realBooks, 'and the shelf D1 merged against is the shelf on disk')
      ok('D5 games/dino byte-equals the rebuild script\'s output, over the committed shelf')
    } else {
      skip('D5 — games/dino is still at v4; the owner runs tools/rebuild-dino-v5.mjs once, at the end')
    }

    // ── G2 border loudness for books: the §5.3 shelf, warned once per fault ──
    // A scratch shelf carrying the "dup 1" book of §5.3 — it requires ONLY basic 1,
    // so Kahn's name tie-break puts it before stats and dinosaur-age, which is
    // what makes it the first definer of the water gun and the first proposer.
    const dupShelf = copyShelf(join(WORK, 'shelf-dup', 'books'))
    writeBook(dupShelf, 'dup', 1, {
      book: { name: 'dup', title: 'Dup', edition: 1, requires: [{ name: 'basic', edition: 1 }] },
      types: { version: 5, types: [], sectionsFor: {}, fieldsFor: { 'basic:nope': [{ id: 'dup:ghost', key: 'ghost', caption: 'Ghost', type: 'text' }] } },
      things: { version: 5, things: { 'basic:item': [{ id: 'dinosaur-age:water-gun', name: 'Not the water gun', cost: 9, imageURL: '' }] } },
      proposals: { version: 5, totalBudget: 12, groups: [], groupRules: { 'dinosaur-age:row-lairs': { max: 2 } } }
    })
    const dupSet = structuredClone(rebuilt)
    dupSet.content.books = [...PLAN.pins, { name: 'dup', edition: 1 }]
    const dupDir = writeGame(join(WORK, 'dup-game', game), dupSet)
    cpSync(join(workingTreeDir, 'assets'), join(dupDir, 'assets'), { recursive: true })
    const dupResult = hydrate(v5EngineDir, dupDir, dupShelf)
    assert.deepEqual(dupResult.warnings, [
      'Book fault — books["dup"].types.fieldsFor["basic:nope"]: adds fields to a section that does not exist (basic:nope); they are skipped',
      'Book fault — books["dinosaur-age"].things.things["basic:item"][0].id: duplicate id "dinosaur-age:water-gun" — already defined by dup 1; this one is skipped',
      'Book fault — rules.groupRules["dinosaur-age:row-lairs"].max: dup 1 and dinosaur-age 1 propose different values for max of row dinosaur-age:row-lairs — this game must set its own (using 2, the first)',
      'Book fault — rules.totalBudget: dup 1 proposes 12, dinosaur-age 1 proposes 10 — this game must set its own budget (using 12, the first)'
    ], 'the four §5.3 lines, verbatim, in order — and nothing else')
    assert.equal(countGroups(dupResult.groups), 4, 'and the game still plays its four rows')
    assert.equal(dupResult.groups[1].items[0].name, 'Not the water gun', 'with dup\'s water gun, because dup defined it first')
    ok('G2 border loudness for books: the §5.3 shelf gives exactly four `Book fault — <path>: <message>` warnings, verbatim and in order, and the game still hydrates its four rows')
  }

  // ═════════════════════ the border: S1–S4 ═════════════════════
  // The validator is the contract the server enforces. S1 proves the committed
  // data fits it (and that its cross half IS G1's audit, by path); S2–S4 run the
  // REAL server over a scratch copy, a scratch dist root and a scratch SHELF.

  // The v5 source this game is served from. games/** is still at v4 on disk (the
  // owner migrates by opening each game in the editor, and rebuilds dino once),
  // so the scratch copy carries the v5 set: the REBUILT files for dino, the
  // migration for a book-less game.
  const v5Source = rebuiltDir ?? (() => {
    const dir = writeGame(join(WORK, 'v5source', game), migrateSet(structuredClone(rawV4)))
    cpSync(join(workingTreeDir, 'assets'), join(dir, 'assets'), { recursive: true })
    return dir
  })()
  v5Sources[game] = v5Source

  // ── S1 the committed files fit the contract, at every stage of their history ──
  const treeSet = migrateSet(readGameSet(workingTreeDir))
  // CHANGED: judged WITH the books it pins. A pinned game's rows show the books' sheets
  // and its arrangement names the books' things, so validateSet (which is "no books")
  // would call every one of those a dangling reference. A book-less game is unaffected:
  // there validateGame with an empty shelf IS validateSet (K9).
  assert.deepEqual(validateGame({ own: treeSet, books: treeSet.content.books.length > 0 ? shelfLayers : [] }), [], `games/${game}, migrated, fits — judged with its books`)
  FILES.forEach(name => assert.deepEqual(validateFile(name, treeSet[name]), [], `${name}.json alone fits`))
  assert.deepEqual(validateSet(first), [], 'the v3 → v5 migration fits')
  assert.deepEqual(validateSet(migrateSet(rawV2)), [], 'the v2 → v5 climb fits')
  assert.deepEqual(validateGame({ own: readGameSet(v5Source), books: rebuilt ? shelfLayers : [] }), [], 'and the v5 source this run serves fits, judged with its books')
  // G1's eight faults, seen by the validator: the same eight sentences, each now
  // attached to the pointer that dangles — and every path leads to its row
  const cross = crossChecks(broken)
  const expectedCrossPaths = [[rowA, ['query.where', 'showWhen']], [rowB, ['query.where', 'showWhen']], [rowC, ['query.where', 'showWhen']], [rowD, ['showWhen']], [rowE, ['showWhen']]]
    .flatMap(([row, pointers]) => pointers.map(pointer => `${pathOfRow(broken.content.groups, row.id)}.${pointer}`))
  assert.equal(cross.length, 8, 'one cross problem per fault')
  assert.deepEqual(cross.map(problem => problem.path).sort(), [...expectedCrossPaths].sort())
  cross.forEach(problem => {
    const row = resolvePath(broken, problem.path.replace(/\.(query\.where|showWhen)$/, ''))
    const fault = problem.message.replace(/^(filter|show-when) /, '')
    assert.ok(expectedWarnings.some(warning => warning.startsWith(`Row "${row.label}"`) && warning.includes(fault)), `G1 warns "${fault}" on "${row.label}"`)
  })
  // D6 in action: rowD's and rowE's kinds are FILE-level faults, so the whole cross pass waits for the next round trip
  assert.deepEqual(validateSet(broken).map(problem => problem.path), [rowD, rowE].map(row => `${pathOfRow(broken.content.groups, row.id)}.showWhen.kind`))
  ok(`S1 games/${game} (migrated), the v3 migration, the v2 climb and the v5 source all fit; crossChecks = G1's 8 faults by path; two bad kinds postpone the cross pass (D6)`)

  // ── S2 the route refuses and writes nothing ──
  const srvRoot = join(WORK, 'srv')
  const srvShelf = copyShelf(join(WORK, 'srv-shelf', 'books'))
  const srvDir = copyGame(v5Source, join(srvRoot, game))
  const booksOf = (set) => (set.content.books ?? []).map(pin => readBookSync(srvShelf, pin))
  const { origin, stop } = await startServer(srvRoot, join(WORK, 'srv-dist'), srvShelf)
  try {
    const before = readGameText(srvDir)
    const E = readGameSet(srvDir)
    const dataFile = (name) => join(srvDir, 'data', `${name}.json`)
    const unchanged = (label) => assert.deepEqual(readGameText(srvDir), before, `${label}: the disk is unchanged`)
    const old = await post(origin, game, 'content', { ...E.content, version: 4 })
    assert.equal(old.status, 400)
    assert.equal(old.body.ok, false)
    assert.equal(old.body.error, 'content.json does not fit the schema')
    assert.equal(old.body.problems.length, 1, 'an old version is ONE problem')
    assert.equal(old.body.problems[0].path, 'content.version')
    assert.match(old.body.problems[0].message, /must be 5 \(found 4\) — open the game in the editor and Save/)
    unchanged('an old version')
    assert.deepEqual(await post(origin, game, 'content', '{'), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    unchanged('a body that is not JSON')
    const brokenTypes = structuredClone(E.types)
    brokenTypes.types.push({ id: 'srv-dup', label: 'Dup', sections: [{ id: 'srv-dup.identity', key: 'identity', caption: 'Identity', kind: 'fields', fields: [
      { id: 'srv-dup.a', key: 'colour', caption: 'Colour', type: 'text' }, { id: 'srv-dup.b', key: 'colour', caption: 'Colour again', type: 'text' }] }] })
    const dup = await post(origin, game, 'types', brokenTypes)
    assert.equal(dup.status, 400)
    assert.deepEqual(dup.body.problems, validateFile('types', brokenTypes), 'the wire carries the module\'s own list')
    assert.match(dup.body.problems[0].path, /^types\.types\[\d+\]\.sections\[0\]\.fields\[1\]\.key$/)
    assert.match(dup.body.problems[0].message, /duplicate key "colour"/)
    unchanged('a duplicate field key')
    assert.deepEqual(await post(origin, game, 'nope', {}), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    // a target named like an inherited property is unknown too — the whitelist reads own keys only
    assert.deepEqual(await post(origin, game, 'constructor', { version: 5 }), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    // a save that fails ON DISK is a 500 receipt, never the end of the process
    chmodSync(dataFile('rules'), 0o444)
    try {
      const denied = await post(origin, game, 'rules', E.rules)
      assert.equal(denied.status, 500)
      assert.match(denied.body.error, /^rules\.json was not written \(EACCES\)$/)
      unchanged('a write the disk refused')
    } finally {
      chmodSync(dataFile('rules'), 0o644)
    }
    assert.deepEqual(await post(origin, game, 'rules', E.rules), SAVED)
    assert.equal(readFileSync(dataFile('rules'), 'utf8'), serialize(E.rules), 'the server writes the exact on-disk format')
    assert.deepEqual(await post(origin, 'nope', 'rules', E.rules), { status: 404, body: { ok: false, error: 'Unknown CYOA "nope"' } })
    assert.equal((await api(origin, '/api/save/rules', { method: 'POST', body: E.rules })).status, 404, 'the old route is dead')
    ok('S2 route: version 4 → 400 at content.version; not-JSON → 400; a duplicate field key → 400 at its path; nothing written; unknown and prototype-named targets → 404; a disk refusal → 500 and the server lives; the v5 rules → 200; unknown game → 404; /api/save/ dead')

    // ── S3 the editor's order end-to-end: add-type-first-save, removal, and the negative ──
    assert.deepEqual(await editorSave(origin, game, E), Array(5).fill(SAVED), 'the v5 set lands: five 200s')
    assert.deepEqual(readGameText(srvDir), readGameText(v5Source), 'byte-identical to the source')
    // the editor's way to add a type: the type, its bucket with a thing, a row
    // asking for the type with a condition on its field, and a rules slot
    const E2 = structuredClone(E)
    const typeId = randomUUID(), sectionId = randomUUID(), fieldId = randomUUID(), thingId = randomUUID(), rowId = randomUUID()
    const firstThing = Object.values(E2.things.things)[0][0]
    E2.types.types.push({ id: typeId, label: 'Pet', sections: [{ id: sectionId, key: 'identity', caption: 'Identity', kind: 'fields', fields: [{ id: fieldId, key: 'colour', caption: 'Colour', type: 'text' }] }] })
    E2.things.things[typeId] = [{ id: thingId, name: 'Rex', cost: 1, imageURL: '', colour: 'green' }]
    E2.content.groups.push({ id: rowId, label: 'Pets', query: { type: typeId, where: { field: fieldId, op: 'is', value: 'green' } }, showWhen: { kind: 'thingPicked', thing: firstThing.id }, children: [] })
    E2.rules.groupRules[rowId] = { min: 1 }
    assert.deepEqual(validateGame({ own: E2, books: booksOf(E2) }), [], 'the pre-flight passes the new set')
    // negative first: content alone, before its type has landed, is refused against the disk
    const early = await post(origin, game, 'content', E2.content)
    assert.equal(early.status, 400)
    // the path locates the row at its MERGED index (§5.5, R5): a game whose rows
    // are PROPOSED by a book has the book's rows before its own
    const mergedRows = mergeLayers({ books: booksOf(E2), game: E2 }).set.content.groups
    assert.equal(early.body.problems[0].path, `content.groups[${mergedRows.findIndex(row => row.id === rowId)}].query.type`)
    assert.match(early.body.problems[0].message, /shows a type that does not exist/)
    assert.equal(readFileSync(dataFile('content'), 'utf8'), serialize(E.content), 'content.json unchanged')
    assert.deepEqual(await editorSave(origin, game, E2), Array(5).fill(SAVED), 'in the editor\'s order the same set lands: five 200s')
    assert.deepEqual(readGameSet(srvDir), JSON.parse(JSON.stringify(E2)), 'the disk holds E2 exactly')
    // removal the editor's way (REMOVE_HOOKS.type): forget each thing, drop the bucket, forget the type, splice it
    const E3 = structuredClone(E2)
    E3.things.things[typeId].forEach(thing => forgetThing(E3.content.groups, thing.id))
    delete E3.things.things[typeId]
    forgetType(E3.content.groups, typeId)
    E3.types.types.splice(E3.types.types.findIndex(type => type.id === typeId), 1)
    assert.deepEqual(await editorSave(origin, game, E3), Array(5).fill(SAVED), 'the removal lands: five 200s')
    const afterRemoval = readGameSet(srvDir)
    assert.deepEqual(danglingReferences(mergeLayers({ books: booksOf(afterRemoval), game: afterRemoval }).set), [], 'nothing dangles on disk')
    assert.deepEqual(afterRemoval.content.groups.at(-1).query, { type: '', where: null }, 'the Pets row shows nothing now')
    ok('S3 editor order: the v5 set → five 200s, byte-identical; content posted early → 400 (type not on disk); add type+thing+row+slot → lands; remove the type → lands, closed')

    // ── S4 content is checked against the siblings AS THEY SIT ON DISK ──
    const atS4 = readGameText(srvDir)
    const content = readGameSet(srvDir).content
    const handBroken = readGameSet(srvDir).types
    handBroken.types.push({ id: 'hand-broken', label: 'Oops', sections: [{ id: 'hand-broken.identity', key: 'identity', caption: 'Identity', kind: 'fields', fields: [{ id: 'hand-broken.name', key: 'name', caption: 'N', type: 'text' }] }] })
    writeFileSync(dataFile('types'), serialize(handBroken))
    const reserved = await post(origin, game, 'content', content)
    assert.equal(reserved.status, 400)
    assert.match(reserved.body.problems[0].path, /^types\.types\[\d+\]\.sections\[0\]\.fields\[0\]\.key$/)
    assert.match(reserved.body.problems[0].message, /is a key every thing already has/)
    assert.equal(readFileSync(dataFile('content'), 'utf8'), atS4.content, 'content.json unchanged')
    writeFileSync(dataFile('types'), atS4.types)
    writeFileSync(dataFile('types'), '{')
    const unparsable = await post(origin, game, 'content', content)
    assert.equal(unparsable.status, 400)
    assert.match(unparsable.body.problems.find(problem => problem.path === 'types').message, /types\.json on disk cannot be read \(/)
    writeFileSync(dataFile('types'), atS4.types)
    rmSync(dataFile('things'))
    const missing = await post(origin, game, 'content', content)
    assert.equal(missing.status, 400)
    assert.match(missing.body.problems.find(problem => problem.path === 'things').message, /cannot be read \(ENOENT\)/)
    assert.equal(readFileSync(dataFile('content'), 'utf8'), atS4.content, 'content.json unchanged')
    FILES.forEach(name => writeFileSync(dataFile(name), before[name]))
    ok('S4 against the disk: a reserved key in types.json → 400 at its path; an unparsable types.json → 400 "cannot be read"; a missing things.json → 400 (ENOENT); content never written')
  } finally {
    stop()
  }

  // ═════════════════════ the shelf over HTTP: S5–S7, I2 (dino) ═════════════════════
  // Its own scratch root, holding the REBUILT dino and a BOOK-LESS game beside
  // it (the migrated vampire, read from git so this block runs even for
  // `oracles.mjs dino`) — the asset search path needs both to be interesting.
  if (game === 'dino') {
    const shelfRoot = join(WORK, 'shelf-srv')
    const shelfGames = join(shelfRoot, 'games')
    const shelfBooks = copyShelf(join(shelfRoot, 'books'))
    const dinoDir = copyGame(rebuiltDir, join(shelfGames, 'dino'))
    const vampireV4 = Object.fromEntries(FILES.map(name => [name, JSON.parse(gitShow(V4_COMMIT, `${DINO_IN_REPO}/games/vampire/data/${name}.json`))]))
    const vampDir = writeGame(join(shelfGames, 'vampire'), migrateSet(vampireV4))
    cpSync(join(DINO_DIR, 'games', 'vampire', 'assets'), join(vampDir, 'assets'), { recursive: true })
    const rebuiltText = Object.fromEntries(FILES.map(name => [name, serialize(rebuilt[name])]))
    const { origin, stop } = await startServer(shelfGames, join(shelfRoot, 'dist'), shelfBooks)
    try {
      const at = (path) => get(`${origin}${path}`)
      const bookBytes = (...parts) => readFileSync(join(shelfBooks, ...parts), 'utf8')

      // ── S5 the shelf's routes ──
      assert.equal((await at('/books/basic/1/book.json')).text, bookBytes('basic', '1', 'book.json'), '/books/<n>/<e>/book.json is the shelf\'s bytes')
      assert.equal((await at('/books/basic/1/types.json')).status, 200)
      assert.equal((await at('/books/dinosaur-age/2/things.json')).text, bookBytes('dinosaur-age', '2', 'things.json'))
      // a folder is not a book: there is no index on the shelf
      for (const path of ['/books/basic/1/', '/books/basic/1', '/books/basic/', '/books/']) {
        const res = await at(path)
        assert.equal(res.status, 404, `${path} → 404`)
      }
      // the grammar is the guard — a name or an edition it refuses never touches the disk
      const refusedShelf = ['/books/Basic/1/book.json', '/books/basic/0/book.json', '/books/basic/01/book.json', '/books/basic/1.0/book.json', '/books/../server/server.js', '/books/basic/1/../../../server/server.js', '/books/basic/1/../../stats/1/book.json']
      for (const path of refusedShelf) {
        const { status, text } = await raw(origin, path)
        assert.ok([403, 404].includes(status), `${path} → ${status}`)
        assert.ok(!text.includes('createServer'), `${path}: never a server file`)
      }
      // read-only: there is no route under /books/ that is not a GET
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const { status } = await raw(origin, '/books/basic/1/book.json', method, '{}')
        assert.equal(status, 404, `${method} /books/… is not a route`)
      }
      // the ENGINE asks page-relative, so the same file answers under the game too
      assert.equal((await at('/games/dino/books/basic/1/types.json')).text, bookBytes('basic', '1', 'types.json'), 'the engine\'s page-relative books/… lands on the same shelf')
      assert.equal((await at('/games/dino/books/nope/1/book.json')).status, 404)
      // the asset SEARCH PATH: the game's own assets/ first, then each pinned book's
      const gunInGame = join(dinoDir, 'assets', 'cannon.jpg')
      const gunInBook = join(shelfBooks, 'dinosaur-age', '1', 'assets', 'cannon.jpg')
      const own = await raw(origin, '/games/dino/assets/cannon.jpg')
      assert.equal(own.status, 200)
      assert.equal(own.length, statSync(gunInGame).size, 'the game\'s own copy answers first')
      rmSync(gunInGame)
      const fromBook = await raw(origin, '/games/dino/assets/cannon.jpg')
      assert.equal(fromBook.status, 200, 'and with the game\'s copy gone the BOOK\'s answers')
      assert.equal(fromBook.length, statSync(gunInBook).size, 'whole, from books/dinosaur-age/1/assets')
      cpSync(gunInBook, gunInGame)
      assert.equal((await raw(origin, '/games/dino/assets/dino.jpg')).status, 200, 'a picture only the game has')
      assert.equal((await at('/games/dino/assets/nope.jpg')).status, 404, 'a picture nobody has')
      assert.equal((await at('/games/vampire/assets/cannon.jpg')).status, 404, 'a game that pins nothing has no fallback')
      assert.equal((await raw(origin, '/games/dino/assets/../data/content.json')).status, 403, 'and the drawer\'s door is still guarded')
      ok(`S5 the shelf's routes: /books/<n>/<e>/<file> is the shelf's bytes, ${refusedShelf.length} refused spellings and 3 write methods → 403/404 and never a server file, no folder index; /games/<g>/books/… is the same file; the asset search path answers the game's copy, then the book's, then 404 — and a game with no pins has no fallback`)

      // ── S6 save against the pins ──
      const shortShelfRoot = join(WORK, 'srv-short')
      const shortBooks = copyShelf(join(shortShelfRoot, 'books'))
      rmSync(join(shortBooks, 'stats'), { recursive: true })
      const shortGames = join(shortShelfRoot, 'games')
      const shortDir = copyGame(rebuiltDir, join(shortGames, 'dino'))
      const shortServer = await startServer(shortGames, join(shortShelfRoot, 'dist'), shortBooks)
      try {
        const receipts = await editorSave(shortServer.origin, 'dino', rebuilt)
        assert.deepEqual(receipts.slice(0, 4), Array(4).fill(SAVED), 'the four files that carry no pins land')
        assert.equal(receipts[4].status, 400, 'content.json does not')
        // the two PIN faults come first, verbatim — F1 for the book that is not
        // there and F3 for the one that needed it. Everything after them is the
        // honest cascade: with Dinosaur Age skipped, the game's own arrangement
        // and its pets' placements point at a shelf nobody filled.
        assert.deepEqual(receipts[4].body.problems.slice(0, 2), [
          { path: 'content.books[1]', message: '"stats" 1 is not on the shelf; the book is skipped' },
          { path: 'content.books[2]', message: '"dinosaur-age" 1 requires "stats" 1 — not pinned; the book is skipped' }
        ], 'F1 then F3, verbatim, at their pins')
        assert.ok(receipts[4].body.problems.slice(2).every(problem => problem.path.startsWith('things.')), 'and the rest is the cascade, in the game\'s own files')
        assert.equal(readFileSync(join(shortDir, 'data', 'content.json'), 'utf8'), rebuiltText.content, 'and nothing was written')
      } finally { shortServer.stop() }
      // with the whole shelf the same five files land, byte for byte
      const dinoHash = treeHash(dinoDir)
      assert.deepEqual(await editorSave(origin, 'dino', rebuilt), Array(5).fill(SAVED), 'over the full shelf: five 200s')
      assert.deepEqual(readGameText(dinoDir), rebuiltText, 'byte-identical to the rebuilt data')
      // the fault this case is ABOUT comes first; anything after it is the
      // cascade a skipped book leaves behind in the game's own files (an
      // arrangement and some placements pointing at a shelf nobody filled)
      const refuse = async (label, content, expected) => {
        const receipt = await post(origin, 'dino', 'content', content)
        assert.equal(receipt.status, 400, `${label}: 400`)
        assert.deepEqual(receipt.body.problems[0], expected, label)
        assert.ok(receipt.body.problems.slice(1).every(problem => problem.path.startsWith('things.')), `${label}: and the rest is the cascade`)
        assert.deepEqual(readGameText(dinoDir), rebuiltText, `${label}: nothing written`)
      }
      const withContent = (edit) => { const set = structuredClone(rebuilt); edit(set); return set.content }
      await refuse('a rowOverride hidden: false', withContent(set => { set.content.rowOverrides['dinosaur-age:row-gear'].hidden = false }),
        { path: 'content.rowOverrides["dinosaur-age:row-gear"].hidden', message: 'must be true or absent (found false)' })
      await refuse('a pin at an edition the shelf has not', withContent(set => { set.content.books[2] = { name: 'dinosaur-age', edition: 3 } }),
        { path: 'content.books[2]', message: '"dinosaur-age" 3 is not on the shelf; the book is skipped' })
      // things.json alone lands (a per-file check knows nothing of the shelf), and
      // then content.json is refused because the SET does not hold together
      const strayOrder = structuredClone(rebuilt.things)
      strayOrder.order['basic:place'].push('dinosaur-age:nest')            // edition 2's thing, under a pin at edition 1
      assert.deepEqual(await post(origin, 'dino', 'things', strayOrder), SAVED, 'things.json alone is a per-file check')
      const orderReceipt = await post(origin, 'dino', 'content', rebuilt.content)
      assert.equal(orderReceipt.status, 400)
      assert.deepEqual(orderReceipt.body.problems, [{ path: 'things.order["basic:place"][4]', message: 'arranges a thing that is not on shelf basic:place (dinosaur-age:nest); it is ignored' }], 'F15, at the id')
      assert.deepEqual(await post(origin, 'dino', 'things', rebuilt.things), SAVED, 'put the arrangement back')
      const strayPlacement = structuredClone(rebuilt.things)
      strayPlacement.things['basic:character'][0].origin = [{ thing: 'dinosaur-age:nope' }]
      assert.deepEqual(await post(origin, 'dino', 'things', strayPlacement), SAVED, 'a dangling placement lands per-file too')
      const placementReceipt = await post(origin, 'dino', 'content', rebuilt.content)
      assert.equal(placementReceipt.status, 400)
      assert.deepEqual(placementReceipt.body.problems, [{ path: 'things.things["basic:character"][0].origin[0].thing', message: 'places a thing that does not exist (dinosaur-age:nope)' }])
      assert.deepEqual(await post(origin, 'dino', 'things', rebuilt.things), SAVED, 'put back')
      assert.deepEqual(readGameText(dinoDir), rebuiltText)
      assert.equal(treeHash(dinoDir), dinoHash, 'the folder is exactly where it started')
      ok('S6 save against the pins: without Stats on the shelf the four land and content → 400 with F3 verbatim; with it, five 200s byte-identical; hidden: false, a pin at edition 3, an arrangement naming edition 2\'s Nest (F15) and a dangling placement each → 400 at their path, nothing written')

      // ── S7 the engine over HTTP: the shelf answers page-relative ──
      const http = await hydrateHTTP(v5EngineDir, `${origin}/games/dino/index.html`)
      assert.deepEqual(http.warnings, [], 'no warnings over HTTP')
      const bookURLsHTTP = PLAN.pins.flatMap(pin => BOOK_FILE_NAMES.map(file => `books/${pin.name}/${pin.edition}/${file}.json`))
      assert.deepEqual(http.fetched, [...FILES.map(name => `data/${name}.json`), ...bookURLsHTTP], '5 data urls then 12 book urls, page-relative, in pin order')
      // Basic and Stats ship no things.json or proposals.json: four honest 404s, tolerated
      const absent = ['basic/1/things.json', 'basic/1/proposals.json', 'stats/1/things.json', 'stats/1/proposals.json']
      for (const rest of absent) assert.equal((await at(`/games/dino/books/${rest}`)).status, 404, `${rest} is answered 404`)
      const folder = hydrate(v5EngineDir, dinoDir, shelfBooks)
      assert.deepEqual(project(http.groups), project(folder.groups), 'over HTTP the game plays exactly as it does over the folder')
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await raw(origin, `/games/dino/${rel}`)
        assert.equal(res.status, 200, rel)
        assert.ok(res.length > 0, `${rel}: whole file`)
      }
      ok(`S7 the engine over HTTP: ${http.fetched.length} page-relative urls (5 data, 12 book), the four absent book files answered 404 and tolerated, the hydration project-equal to the folder's, every image (the books' four included) served whole`)

      // ── I2 the editor's save order, with books ──
      const grown = structuredClone(rebuilt)
      const petId = randomUUID()
      grown.things.things['basic:character'].push({ id: petId, name: 'Nibbles', cost: 1, imageURL: '', concept: 'A tiny one', size: 'tiny', origin: [{ thing: 'dinosaur-age:velociraptor' }], notes: [] })
      grown.things.order['basic:place'] = [...grown.things.order['basic:place']].reverse()
      assert.deepEqual(validateGame({ own: grown, books: PLAN.pins.map(pin => readBookSync(shelfBooks, pin)) }), [], 'the pre-flight passes')
      assert.deepEqual(await editorSave(origin, 'dino', grown), Array(5).fill(SAVED), 'four then content: five 200s')
      const afterGrow = hydrate(v5EngineDir, dinoDir, shelfBooks)
      assert.deepEqual(afterGrow.warnings, [])
      assert.equal(countItems(afterGrow.groups), 18, 'nine pets now')
      assert.deepEqual(afterGrow.groups[2].items.map(item => item.name), ['King of Burger!!', 'Play pen', 'Lava Pit', 'The Scritches Dimension'], 'the ▲/▼ swap landed')
      // content posted ALONE, before things carries the new pet, is still fine —
      // a placement points INTO a book, and the books are on the shelf
      assert.deepEqual(await post(origin, 'dino', 'content', grown.content), SAVED, 'content alone is fine: its references live in the books')
      // but a new PRIVATE type referenced by a row is refused early, exactly as S3 shows
      const withPrivate = structuredClone(grown)
      const privateId = randomUUID(), privateRow = randomUUID()
      withPrivate.content.groups.push({ id: privateRow, label: 'Mine', query: { type: privateId, where: null }, showWhen: { kind: 'always' }, children: [] })
      const refusedEarly = await post(origin, 'dino', 'content', withPrivate.content)
      assert.equal(refusedEarly.status, 400)
      assert.match(refusedEarly.body.problems[0].message, /shows a type that does not exist/)
      assert.deepEqual(await editorSave(origin, 'dino', rebuilt), Array(5).fill(SAVED), 'put back')
      assert.deepEqual(readGameText(dinoDir), rebuiltText)
      ok('I2 editor save order with books: a new pet placing a book\'s origin plus a things.order swap land in the editor\'s order (four then content, five 200s) and show through the engine; content alone is fine because placements point INTO books; a new private type named by a row is still refused early')
    } finally {
      stop()
    }
  }

  // ═════════════════════ the export: E1–E9 ═════════════════════
  // tools/export.mjs publishes a game as ONE static folder. E1–E5 prove what the
  // folder holds and that it plays, from a subpath, over real HTTP; E6–E9 prove
  // every refusal writes nothing and wipes nothing it did not write. The source
  // is the v5 scratch copy and the shelf is a scratch copy: the real books/ is
  // only ever read (T1/D1), never handed to a tool that writes.
  const expShelf = copyShelf(join(WORK, 'exp-shelf', 'books'))
  const exportOf = (options) => exportGame({ game, sourceDir: v5Source, booksDir: expShelf, ...options })
  const sourceSet = readGameSet(v5Source)
  const sourceBooks = (sourceSet.content.books ?? []).map(pin => readBookSync(expShelf, pin))
  const hasPins = sourceSet.content.books.length > 0

  // ── E1 exact file set ──
  const outDir = join(WORK, 'dist', game)
  const { manifest } = exportOf({ outDir })
  const exported = listFiles(outDir)
  const expectedFiles = [MANIFEST, ...listFiles(v5EngineDir).filter(notDot), ...FILES.map(name => `data/${name}.json`), ...listFiles(join(v5Source, 'assets')).filter(notDot).map(file => `assets/${file}`)].sort()
  assert.deepEqual(exported, expectedFiles, 'the engine, data/, assets/ and the manifest — nothing else')
  exported.forEach(path => assert.doesNotMatch(path, /dinoEdit|server|tools|oracles|books\/|\.mjs$|\.DS_Store/))
  assert.deepEqual(Object.keys(manifest.files), exported.filter(path => path !== MANIFEST), 'the manifest lists every file but itself, in listFiles order')
  assert.deepEqual(Object.keys(manifest), ['tool', 'game', 'schemaVersion', 'books', 'complete', 'rows', 'items', 'files'], 'fixed keys — no timestamp, no git hash')
  assert.equal(manifest.tool, 'cyoa-export')
  assert.equal(manifest.complete, true)
  assert.equal(manifest.schemaVersion, 5)
  assert.equal(manifest.game, game)
  assert.deepEqual(manifest.books, sourceSet.content.books, 'the books folded in — the folder\'s only record of the shelf it was built on')
  assert.equal(manifest.rows, countGroups(v5Tree.groups))
  assert.equal(manifest.items, countItems(v5Tree.groups))
  // the dotfile filter only bites when a dotfile is THERE: plant Finder's droppings in a
  // scratch source and prove the export leaves them behind (the marker is the one dotfile)
  const dotted = copyGame(v5Source, join(WORK, 'dotted', game))
  writeFileSync(join(dotted, 'assets', '.DS_Store'), 'finder was here')
  mkdirSync(join(dotted, 'assets', '.hidden'), { recursive: true })
  writeFileSync(join(dotted, 'assets', '.hidden', 'x.txt'), 'hidden')
  const dottedOut = join(WORK, 'dist-dotted', game)
  exportOf({ outDir: dottedOut, sourceDir: dotted })
  assert.deepEqual(listFiles(dottedOut).filter(path => path !== MANIFEST && !notDot(path)), [], 'no dotfile or dot-folder travels — only the marker')
  ok(`E1 export = ${exported.length} files: engine/ + data/ + assets/ + ${MANIFEST}, nothing else; manifest keys tool, game, schemaVersion, books, complete, rows, items, files; ${manifest.rows} rows, ${manifest.items} things, books ${JSON.stringify(manifest.books)}; a planted .DS_Store stays behind`)

  // ── E2 bytes ──
  // A game that pins NOTHING travels as its own bytes — flattening it would be a
  // re-serialization of files that are already exactly right. A game WITH pins
  // travels as the flattened merge, because the folder must need no shelf.
  const flattened = hasPins ? flattenGame({ books: sourceBooks, game: sourceSet }) : null
  FILES.forEach(name => {
    const written = readFileSync(join(outDir, 'data', `${name}.json`), 'utf8')
    assert.equal(written, hasPins ? serialize(flattened[name]) : readFileSync(join(v5Source, 'data', `${name}.json`), 'utf8'),
      hasPins ? `data/${name}.json is the FLATTENED merge` : `data/${name}.json is the source's own bytes`)
  })
  listFiles(join(v5Source, 'assets')).filter(notDot).forEach(file => {
    const source = join(v5Source, 'assets', file), copy = join(outDir, 'assets', file)
    assert.equal(statSync(copy).size, statSync(source).size, `${file}: size`)
    assert.equal(sha256(copy), sha256(source), `${file}: sha256`)
  })
  if (game === 'vampire') assert.equal(readFileSync(join(outDir, 'assets', 'ATTRIBUTION.txt'), 'utf8'), readFileSync(join(v5Source, 'assets', 'ATTRIBUTION.txt'), 'utf8'), 'ATTRIBUTION.txt travels')
  if (!hasPins) {
    // the source's files are canonical, so bytes == serialize(parse(bytes)) could hide a
    // re-serialization: a source with 4-space content.json and no trailing newline cannot
    const nonCanon = copyGame(v5Source, join(WORK, 'noncanon', game))
    const oddText = JSON.stringify(JSON.parse(readFileSync(join(nonCanon, 'data', 'content.json'), 'utf8')), null, 4)
    writeFileSync(join(nonCanon, 'data', 'content.json'), oddText)
    exportOf({ outDir: join(WORK, 'dist-noncanon', game), sourceDir: nonCanon })
    assert.equal(readFileSync(join(WORK, 'dist-noncanon', game, 'data', 'content.json'), 'utf8'), oddText, 'a book-less game\'s data travels untouched, never re-serialized')
  }
  Object.entries(manifest.files).forEach(([path, { bytes, sha256: hash }]) => {
    assert.equal(sha256(join(outDir, path)), hash, `${path}: manifest sha256`)
    assert.equal(statSync(join(outDir, path)).size, bytes, `${path}: manifest bytes`)
  })
  assert.deepEqual(JSON.parse(readFileSync(join(outDir, MANIFEST), 'utf8')), manifest, 'the manifest on disk is the one returned')
  ok(`E2 bytes: the five data files ${hasPins ? 'are serialize(flattenGame(…))' : 'travel verbatim, never re-serialized'}; ${Object.keys(manifest.files).length} sizes and sha256s true to the manifest; the manifest on disk parses to itself`)

  // ── E3 the folder hydrates like the source — engine AND data from the folder, NO shelf ──
  const fromDist = hydrate(outDir, outDir)
  assert.deepEqual(fromDist.warnings, [])
  assert.deepEqual(fromDist.fetched, FILES.map(name => `data/${name}.json`), 'the published folder never asks for a shelf')
  const fromSource = hydrate(v5EngineDir, v5Source, hasPins ? expShelf : undefined)
  assert.deepEqual(project(fromDist.groups), project(fromSource.groups), 'the folder plays exactly like the source')
  assert.equal(fromDist.heroImage, 'assets/heroBG.jpg')
  imagesOf(fromDist.groups).forEach(rel => assert.ok(existsSync(join(outDir, rel)), `${rel} is in the folder`))
  ok(`E3 the folder hydrates like the source: same projection, five page-relative fetches and no book url, ${imagesOf(fromDist.groups).length} image URLs all present`)

  // ── E4 subpath serving: the engine over real HTTP under /site/<game>/ ──
  const srv = await serveUnder('site', join(WORK, 'dist'))
  try {
    const base = `${srv.origin}/site/${game}/index.html`
    const http = await hydrateHTTP(outDir, base)
    assert.deepEqual(http.warnings, [])
    assert.deepEqual(http.groups, fromDist.groups, 'over HTTP the folder plays the same')
    assert.ok(http.fetched.every(url => url.startsWith('data/')), `page-relative fetches: ${http.fetched.join(' ')}`)
    assert.ok(srv.requests.length === FILES.length && srv.requests.every(url => url.startsWith(`/site/${game}/`)), `every request under the prefix: ${srv.requests.join(' ')}`)
    assert.equal((await fetch(`${srv.origin}/data/content.json`)).status, 404, 'the absolute path is dead — the engine really used relative ones')
    // what a browser would do next: the page, every href/src in it, every static import, every image
    const status = async (url) => { const res = await fetch(url); await res.arrayBuffer(); return res.status }
    const page = await fetch(base)
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.equal(html, readFileSync(join(outDir, 'index.html'), 'utf8'))
    for (const [, attr] of html.matchAll(/(?:href|src)="([^"]+)"/g)) assert.equal(await status(new URL(attr, base)), 200, `${attr} from index.html`)
    for (const rel of exported.filter(path => path.endsWith('.js'))) {
      const moduleURL = new URL(rel, base)
      for (const [, spec] of readFileSync(join(outDir, rel), 'utf8').matchAll(/^\s*(?:import|export)[^'"\n]*from\s+['"]([^'"]+)['"]/gm)) assert.equal(await status(new URL(spec, moduleURL)), 200, `${spec} from ${rel}`)
    }
    for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage]) {
      const res = await fetch(new URL(rel, base))
      await res.arrayBuffer()
      assert.equal(res.status, 200, rel)
      assert.equal(Number(res.headers.get('content-length')), statSync(join(outDir, rel)).size, `${rel}: whole file`)
    }
    ok(`E4 under /site/${game}/: the engine's ${FILES.length} requests all under the prefix, /data/… is 404; the page, its links, every import and every image answer 200`)
  } finally {
    srv.stop()
  }

  // ── E5 idempotent, and a marked folder is rebuilt from scratch ──
  const h1 = treeHash(outDir)
  writeFileSync(join(outDir, 'stray.txt'), 'not ours\n')
  exportOf({ outDir })
  assert.equal(treeHash(outDir), h1, 'a second export is byte-identical, manifest included')
  assert.ok(!existsSync(join(outDir, 'stray.txt')), 'the stray file is gone')
  ok('E5 a second export is byte-identical (manifest included, no timestamp); a stray file in a marked folder is rebuilt away')

  // ── E6 refuses data that is not at the current version, and writes nothing ──
  const v4Src = writeGame(join(WORK, 'v4src', game), rawV4)
  cpSync(join(v5Source, 'assets'), join(v4Src, 'assets'), { recursive: true })
  const outV4 = join(WORK, 'out-v4', game)
  assert.throws(() => exportOf({ outDir: outV4, sourceDir: v4Src }), err => err instanceof ExportRefusal && /is at version 4, not 5 — open the game in the editor and Save first/.test(err.message))
  assert.equal(existsSync(outV4), false, 'nothing written')
  // a data file that is not JSON is a refusal by name, never a stack trace
  const badJSON = copyGame(v5Source, join(WORK, 'badjson', game))
  writeFileSync(join(badJSON, 'data', 'content.json'), '{')
  const outBad = join(WORK, 'out-badjson', game)
  assert.throws(() => exportOf({ outDir: outBad, sourceDir: badJSON }), err => err instanceof ExportRefusal && /data\/content\.json is not valid JSON \(/.test(err.message))
  assert.equal(existsSync(outBad), false, 'nothing written for bad JSON either')
  ok('E6 a v4 game is refused by version ("open the game in the editor and Save first"); a file that is not JSON is refused by name; nothing written')

  // ── E7 refuses a dangling set and a missing image, and preserves a previous export ──
  const keep = join(WORK, 'keep', game)
  exportOf({ outDir: keep })
  const hKeep = treeHash(keep)
  const dangling = copyGame(v5Source, join(WORK, 'dangling', game))
  const danglingSet = readGameSet(dangling)
  danglingSet.content.groups.push({ id: 'e7-row', label: 'E7', query: { type: '', where: null }, showWhen: { kind: 'anyInRow', row: 'no-such-row' }, children: [] })
  writeFileSync(join(dangling, 'data', 'content.json'), serialize(danglingSet.content))
  const danglingIndex = mergeLayers({ books: sourceBooks, game: danglingSet }).set.content.groups.findIndex(row => row.id === 'e7-row')
  assert.throws(() => exportOf({ outDir: keep, sourceDir: dangling }), err => {
    assert.ok(err instanceof ExportRefusal)
    assert.deepEqual(err.problems, [{ path: `content.groups[${danglingIndex}].showWhen`, message: 'show-when names a row that does not exist (no-such-row)' }])
    assert.match(err.message, /does not fit the schema \(1 problem/)
    return true
  })
  const ghost = copyGame(v5Source, join(WORK, 'ghost', game))
  const ghostSet = readGameSet(ghost)
  const [firstBucket] = Object.keys(ghostSet.things.things)
  ghostSet.things.things[firstBucket][0].imageURL = 'ghost.png'
  ghostSet.themes.page.heroImage = 'nohero.jpg'
  writeFileSync(join(ghost, 'data', 'things.json'), serialize(ghostSet.things))
  writeFileSync(join(ghost, 'data', 'themes.json'), serialize(ghostSet.themes))
  assert.throws(() => exportOf({ outDir: keep, sourceDir: ghost }), err => {
    assert.ok(err instanceof ExportRefusal)
    assert.ok(err.problems.some(problem => problem.path === `things.things[${JSON.stringify(firstBucket)}][0].imageURL` && problem.message === 'names a file that is not in assets/ (ghost.png)'), JSON.stringify(err.problems))
    assert.ok(err.problems.some(problem => problem.path === 'themes.page.heroImage' && problem.message === 'names a file that is not in assets/ (nohero.jpg)'))
    return true
  })
  assert.equal(treeHash(keep), hKeep, 'the previous export survives both refusals (validate before wipe)')
  ok('E7 a dangling gate → refused at its merged path; a ghost image and a ghost hero → refused by path; the previous export is untouched')

  // ── E8 wipe safety and out-dir guards ──
  const notMine = join(WORK, 'notmine', game)
  mkdirSync(notMine, { recursive: true })
  writeFileSync(join(notMine, 'precious.txt'), 'keep me\n')
  assert.throws(() => exportOf({ outDir: notMine }), /refusing to wipe .*no \.cyoa-export\.json marker/)
  assert.deepEqual(listFiles(notMine), ['precious.txt'], 'precious.txt survives')
  const empty = join(WORK, 'empty', game)
  mkdirSync(empty, { recursive: true })
  exportOf({ outDir: empty })
  assert.equal(treeHash(empty), h1, 'an existing empty folder is accepted and filled')
  const half = join(WORK, 'half', game)
  mkdirSync(half, { recursive: true })
  writeFileSync(join(half, MANIFEST), serialize({ tool: 'cyoa-export', game, schemaVersion: 5, complete: false }))
  writeFileSync(join(half, 'stale.txt'), 'from an interrupted run\n')
  exportOf({ outDir: half })
  assert.ok(!existsSync(join(half, 'stale.txt')), 'an interrupted export is ours to wipe')
  assert.equal(treeHash(half), h1)
  const theirs = join(WORK, 'theirs', game)
  mkdirSync(theirs, { recursive: true })
  writeFileSync(join(theirs, MANIFEST), serialize({ tool: 'other', game }))
  writeFileSync(join(theirs, 'theirs.txt'), 'another tool wrote this\n')
  assert.throws(() => exportOf({ outDir: theirs }), /refusing to wipe/)
  assert.deepEqual(listFiles(theirs), [MANIFEST, 'theirs.txt'], 'another tool\'s folder is untouched')
  const asFile = join(WORK, `outfile-${game}.txt`)
  writeFileSync(asFile, 'a file, not a folder\n')
  assert.throws(() => exportOf({ outDir: asFile }), err => err instanceof ExportRefusal && /it exists and is not a folder/.test(err.message))
  assert.equal(readFileSync(asFile, 'utf8'), 'a file, not a folder\n', 'the file is untouched')
  // claim-first: a copy that dies half way must leave OUR marker (complete: false)
  // behind, so the next run may wipe the debris.
  const dying = copyGame(v5Source, join(WORK, 'dying', game))
  const unreadable = join(dying, 'assets', 'unreadable.bin')
  writeFileSync(unreadable, 'x')
  const dyingOut = join(WORK, 'dist-dying', game)
  try {
    chmodSync(unreadable, 0o000)
    assert.throws(() => exportOf({ outDir: dyingOut, sourceDir: dying }), err => !(err instanceof ExportRefusal) && /EACCES/.test(err.message))
    const marker = JSON.parse(readFileSync(join(dyingOut, MANIFEST), 'utf8'))
    assert.deepEqual([marker.tool, marker.complete], [TOOL, false], 'the claim went down before the first copied byte')
  } finally {
    chmodSync(unreadable, 0o644)
  }
  exportOf({ outDir: dyingOut, sourceDir: dying })   // the debris carried our marker, so it is rebuilt
  assert.equal(JSON.parse(readFileSync(join(dyingOut, MANIFEST), 'utf8')).complete, true)
  const dataHash = treeHash(join(v5Source, 'data'))
  const shelfHash = treeHash(expShelf)
  ;[v5Source, join(v5Source, 'assets'), expShelf, join(expShelf, 'basic'), dirname(DINO_DIR), DINO_DIR].forEach(target => {
    assert.throws(() => exportOf({ outDir: target }), /refusing to write/, `guard: ${target}`)
    assert.ok(!existsSync(join(target, MANIFEST)), `${target}: nothing claimed`)
  })
  assert.equal(treeHash(join(v5Source, 'data')), dataHash, 'the source game\'s data is untouched')
  assert.equal(treeHash(expShelf), shelfHash, 'and so is the shelf')
  ok('E8 wipe safety: an unmarked folder with files → refused, file kept; an empty folder → filled; an interrupted export → rebuilt; another tool\'s marker → refused; a file as --out → refused; a copy that dies leaves the claim marker; the source game, its assets, the SHELF, cyoa/ and DinoCYOA → refused, untouched')

  // ── E9 the CLI: exit codes and the printed tree ──
  const cliOut = join(WORK, 'cli-export', game)
  const cliArgs = ['--game-dir', v5Source, '--books-dir', expShelf]
  const written = runExportCLI([game, '--out', cliOut, ...cliArgs])
  assert.equal(written.status, 0, `the CLI exits 0:\n${written.stdout}`)
  ;[/→ /, /verified/, /preview\s+python3 -m http\.server/, /publish/].forEach(pattern => assert.match(written.stdout, pattern))
  if (hasPins) assert.match(written.stdout, /books\s+basic 1, stats 1, dinosaur-age 1 — folded in; the folder needs no shelf/)
  assert.equal(treeHash(cliOut), treeHash(outDir), 'the CLI writes what exportGame writes')
  const noArgs = runExportCLI([])
  assert.equal(noArgs.status, 1)
  assert.match(noArgs.stdout, /usage/)
  const wipe = runExportCLI([game, '--out', notMine, ...cliArgs])
  assert.equal(wipe.status, 2)
  assert.match(wipe.stdout, /refusing to wipe/)
  const cliV4 = join(WORK, 'cli-v4', game)
  const oldData = runExportCLI([game, '--game-dir', v4Src, '--books-dir', expShelf, '--out', cliV4])
  assert.equal(oldData.status, 2)
  assert.match(oldData.stdout, /Save first/)
  assert.equal(existsSync(cliV4), false, 'a refused CLI run writes nothing')
  const nosuch = runExportCLI(['nosuch'])
  assert.equal(nosuch.status, 2)
  assert.match(nosuch.stdout, /no such game/)
  ok('E9 CLI: exit 0 prints the tree (and the books folded in) and writes E1\'s bytes; no args → 1 (usage); unmarked folder, v4 data, unknown game → 2, nothing written')

  // ═════════════════════ the export, with books: E11–E13 (dino) ═════════════════════
  if (game === 'dino') {
    // ── E11 flatten equality: the published folder IS the merge, and needs no shelf ──
    const dist = readGameSet(outDir)
    assert.deepEqual(dist.content.books, [], 'the folder pins nothing — there is nothing left to pin')
    assert.deepEqual(dist.content.rowOverrides, {}, 'and nothing left to override')
    assert.deepEqual([dist.types.sectionsFor, dist.types.fieldsFor], [{}, {}])
    assert.equal(dist.things.order, undefined, 'the arrangement is baked into the buckets')
    assert.equal(dist.content.groups.length, 4, 'the four proposed rows are the folder\'s own rows now')
    assert.deepEqual(dist.things.things['basic:place'].map(thing => thing.name), ['The Scritches Dimension', 'Lava Pit', 'Play pen', 'King of Burger!!', 'Volcano Rim'])
    assert.deepEqual(validateSet(dist), [], 'and the folder\'s five files fit the contract with no books at all')
    // it PLAYS the same three ways: from the folder, from the live merge, and as v4 did
    assert.deepEqual(project(fromDist.groups), project(fromSource.groups), 'the folder plays the live merge')
    assert.deepEqual(project(fromDist.groups), project(v4Result.groups), 'and both play what v4 played')
    assert.deepEqual(fromDist.fetched, FILES.map(name => `data/${name}.json`))
    assert.deepEqual(manifest.books, PLAN.pins)
    assert.equal(treeHash(cliOut), h1, 'a second export, through the CLI, is byte-identical')
    ok('E11 export flatten: the published dino holds the FLATTENED merge (books [], no overrides, no order, the arranged buckets), fits the contract alone, asks for five data files and no shelf, and projects exactly what the live merge and the v4 game project')

    // ── E12 assets: one flat folder, the union of the game's and the books' ──
    const GEAR = ['banana.png', 'cannon.jpg', 'rock.jpeg', 'skates.jpg']
    GEAR.forEach(file => {
      assert.equal(listFiles(outDir).filter(path => path === `assets/${file}`).length, 1, `${file} is in the folder once`)
      assert.equal(sha256(join(outDir, 'assets', file)), sha256(join(expShelf, 'dinosaur-age', '1', 'assets', file)), `${file} has the book's bytes`)
    })
    // a source whose own assets/ lacks the four gets them from the book
    const bare = copyGame(v5Source, join(WORK, 'bare-assets', game))
    GEAR.forEach(file => rmSync(join(bare, 'assets', file)))
    const bareOut = join(WORK, 'dist-bare', game)
    exportOf({ outDir: bareOut, sourceDir: bare })
    GEAR.forEach(file => assert.equal(sha256(join(bareOut, 'assets', file)), sha256(join(expShelf, 'dinosaur-age', '1', 'assets', file)), `${file} came from the book`))
    assert.equal(treeHash(bareOut), h1, 'and the folder is byte-identical to the one built from the game\'s own copies')
    // the same name with DIFFERENT bytes is a question only the author can answer
    const clash = copyGame(v5Source, join(WORK, 'clash-assets', game))
    writeFileSync(join(clash, 'assets', 'cannon.jpg'), 'not the same picture at all\n')
    const clashOut = join(WORK, 'dist-clash', game)
    assert.throws(() => exportOf({ outDir: clashOut, sourceDir: clash }), err => {
      assert.ok(err instanceof ExportRefusal)
      const problem = err.problems.find(each => each.path === 'assets/cannon.jpg')
      assert.ok(problem, JSON.stringify(err.problems))
      assert.match(problem.message, /is in .*assets and in .*dinosaur-age.1.assets with different bytes — rename one/)
      return true
    })
    assert.equal(existsSync(clashOut), false, 'nothing written')
    // a name on no path at all
    const noPath = copyGame(v5Source, join(WORK, 'nopath-assets', game))
    const noPathSet = readGameSet(noPath)
    noPathSet.things.things['basic:item'] = [{ id: 'own-ghost', name: 'Ghost', cost: 0, imageURL: 'nowhere.png', description: '', tags: [] }]
    writeFileSync(join(noPath, 'data', 'things.json'), serialize(noPathSet.things))
    const ghostIndex = mergeLayers({ books: sourceBooks, game: noPathSet }).set.things.things['basic:item'].findIndex(thing => thing.id === 'own-ghost')
    assert.throws(() => exportOf({ outDir: join(WORK, 'dist-nopath', game), sourceDir: noPath }), err => {
      assert.deepEqual(err.problems, [{ path: `things.things["basic:item"][${ghostIndex}].imageURL`, message: 'names a file that is not in assets/ (nowhere.png)' }])
      return true
    })
    ok('E12 assets: the four gear images are in the folder once, with the book\'s bytes; a source whose own assets/ lacks them gets them from the book (byte-identical folder); the same name with different bytes → refused at assets/cannon.jpg, nothing written; a name on no path → refused at the thing\'s imageURL')

    // ── E13 refusals that only a shelf can cause ──
    const hKept = treeHash(outDir)
    const offShelf = copyGame(v5Source, join(WORK, 'offshelf', game))
    const offSet = readGameSet(offShelf)
    offSet.content.books[2] = { name: 'dinosaur-age', edition: 3 }
    writeFileSync(join(offShelf, 'data', 'content.json'), serialize(offSet.content))
    assert.throws(() => exportOf({ outDir, sourceDir: offShelf }), err => err instanceof ExportRefusal && /pins a book that is not on the shelf: dinosaur-age 3/.test(err.message))
    // the §5.3 shelf: the export refuses a game whose merge has faults, naming every one
    const dupExportShelf = copyShelf(join(WORK, 'exp-dup', 'books'))
    writeBook(dupExportShelf, 'dup', 1, {
      book: { name: 'dup', title: 'Dup', edition: 1, requires: [{ name: 'basic', edition: 1 }] },
      types: { version: 5, types: [], sectionsFor: {}, fieldsFor: { 'basic:nope': [{ id: 'dup:ghost', key: 'ghost', caption: 'Ghost', type: 'text' }] } },
      things: { version: 5, things: { 'basic:item': [{ id: 'dinosaur-age:water-gun', name: 'Not the water gun', cost: 9, imageURL: '' }] } },
      proposals: { version: 5, totalBudget: 12, groups: [], groupRules: { 'dinosaur-age:row-lairs': { max: 2 } } }
    })
    const dupSource = copyGame(v5Source, join(WORK, 'dupsource', game))
    const dupSet = readGameSet(dupSource)
    dupSet.content.books = [...PLAN.pins, { name: 'dup', edition: 1 }]
    writeFileSync(join(dupSource, 'data', 'content.json'), serialize(dupSet.content))
    assert.throws(() => exportGame({ game, sourceDir: dupSource, booksDir: dupExportShelf, outDir }), err => {
      assert.ok(err instanceof ExportRefusal)
      assert.deepEqual(err.problems.map(problem => problem.path), [
        'books["dup"].types.fieldsFor["basic:nope"]',
        'books["dinosaur-age"].things.things["basic:item"][0].id',
        'rules.groupRules["dinosaur-age:row-lairs"].max',
        'rules.totalBudget'
      ], 'the four §5.3 faults, by path')
      return true
    })
    // no tool ever writes under a books folder — the rule, not the location
    assert.throws(() => exportOf({ outDir: join(expShelf, 'dinosaur-age', '9') }), /refusing to write .*the books folder/)
    assert.equal(treeHash(outDir), hKept, 'the previous export survives every one of them')
    assert.equal(treeHash(expShelf), shelfHash, 'and the shelf is untouched')
    ok('E13 refusals with a shelf: a pin the shelf cannot answer → "pins a book that is not on the shelf: dinosaur-age 3"; the §5.3 shelf → refused with the four fault paths; --out inside the books folder → the guard sentence; the previous export and the shelf survive all three')
  }
}

// ═════════════════════ the manager: M1–M7 ═════════════════════
// ONE server over a root holding EVERY game of this run, plus three folders
// planted to be listed loudly or skipped, and a scratch SHELF. Nothing here
// reads the real games/ or dist/, and the real books/ is only ever COPIED: ROOT
// is a scratch copy and DIST does not even exist yet — the export route has to
// make it. Every game name travels in the URL.
{
  const ROOT = join(WORK, 'manager'), DIST = join(WORK, 'manager-dist')   // DIST does not exist yet: the route must make it
  const SHELF = copyShelf(join(WORK, 'manager-shelf', 'books'))
  games.forEach(g => copyGame(v5Sources[g], join(ROOT, g)))
  mkdirSync(join(ROOT, 'Bad Name', 'data'), { recursive: true })          // a folder the rule refuses
  mkdirSync(join(ROOT, 'hollow'))                                          // a folder with no data
  mkdirSync(join(ROOT, '.hidden'))                                         // a dot-folder: skipped
  writeFileSync(join(ROOT, 'README.txt'), 'not a folder\n')                // a file: skipped
  const engineIndex = readFileSync(join(v5EngineDir, 'index.html'), 'utf8')
  const { origin, stop } = await startServer(ROOT, DIST, SHELF)
  try {
    const at = (path) => get(`${origin}${path}`)                            // a GET of one path on THIS server
    const call = (path, init) => api(origin, path, init)                    // one API call on THIS server
    const FACT_KEYS = ['name', 'title', 'version', 'books', 'rows', 'types', 'things', 'faults', 'exported']
    // the facts the list must show for a game folder, read from that folder AND
    // its shelf: the counts are the MERGED ones — what a player can actually see
    const factsOf = (name, dir) => {
      const own = readGameSet(dir)
      const merged = mergeLayers({ books: (own.content.books ?? []).map(pin => readBookSync(SHELF, pin)), game: own })
      return {
        name, title: own.content.meta.pageTitle, version: SCHEMA_VERSION, books: merged.order,
        rows: countGroups(merged.set.content.groups), types: merged.set.types.types.length,
        things: Object.values(merged.set.things.things).flat().length, faults: merged.faults.length, exported: false
      }
    }
    const listed = async () => { const r = await call('/api/games'); assert.equal(r.status, 200); return r.body.games }
    const cardOf = (list, name) => list.find(g => g.name === name)

    // ── M1 the list: every folder, read fresh; a bad name and a hollow folder are listed with their problem ──
    const list1 = await call('/api/games')
    assert.equal(list1.status, 200)
    assert.deepEqual(Object.keys(list1.body), ['ok', 'games'])
    assert.equal(list1.body.ok, true)
    assert.deepEqual(list1.body.games.map(g => g.name), ['Bad Name', ...games, 'hollow'].sort(), 'every folder, sorted; the dot-folder and the file absent')
    games.forEach(g => {
      const facts = cardOf(list1.body.games, g)
      assert.deepEqual(Object.keys(facts), FACT_KEYS, `${g}: the Facts keys, in order`)
      assert.deepEqual(facts, factsOf(g, join(ROOT, g)), `${g}: the MERGED facts`)
      assert.equal(facts.faults, 0, `${g}: nothing on the way is broken`)
    })
    if (games.includes('dino')) {
      assert.deepEqual(cardOf(list1.body.games, 'dino').books, ['basic 1', 'stats 1', 'dinosaur-age 1'], 'dino lists its three books in LAYER order')
      assert.deepEqual([cardOf(list1.body.games, 'dino').rows, cardOf(list1.body.games, 'dino').things], [4, 33], 'and counts what plays: the four proposed rows, the merged shelf')
    }
    const badName = cardOf(list1.body.games, 'Bad Name')
    assert.deepEqual(Object.keys(badName), ['name', 'error'])
    assert.match(badName.error, /rename the folder/)
    assert.match(cardOf(list1.body.games, 'hollow').error, /data\/content\.json cannot be read \(ENOENT\)/)
    // a content.json that is not JSON is listed with its problem too — and the list is read fresh, so it shows at once
    mkdirSync(join(ROOT, 'broken', 'data'), { recursive: true })
    writeFileSync(join(ROOT, 'broken', 'data', 'content.json'), '{')
    assert.match(cardOf(await listed(), 'broken').error, /cannot be read \(/)
    rmSync(join(ROOT, 'broken'), { recursive: true })
    assert.equal(cardOf(await listed(), 'broken'), undefined, 'gone from the list once the folder is gone')
    // a game that pins a book the shelf cannot answer still LISTS — loudly
    const lost = copyGame(v5Sources[games[0]], join(ROOT, 'lost-pin'))
    const lostSet = readGameSet(lost)
    lostSet.content.books = [...lostSet.content.books, { name: 'nope', edition: 3 }]
    writeFileSync(join(lost, 'data', 'content.json'), serialize(lostSet.content))
    assert.equal(cardOf(await listed(), 'lost-pin').faults, 1, 'a pin the shelf cannot answer reaches the home screen as faults > 0')
    rmSync(lost, { recursive: true })
    ok(`M1 GET /api/games: ${list1.body.games.length} folders listed, sorted; ${games.join(' and ')} with title, version ${SCHEMA_VERSION}, the books that survived, MERGED counts and faults 0; "Bad Name" → rename the folder; hollow → ENOENT; a "{" content.json → cannot be read; a pin off the shelf → faults 1; dot-folder and file skipped`)

    // ── M2 addresses: the manager is the door, the engine plays under /games/<name>/ page-relative ──
    const root = await at('/')
    assert.deepEqual([root.status, root.location], [302, '/dinoEdit/'], '/ → the editor')
    const bare = await at('/dinoEdit')
    assert.deepEqual([bare.status, bare.location], [302, '/dinoEdit/'])
    assert.equal((await at('/dinoEdit/')).text, readFileSync(join(DINO_DIR, 'dinoEdit', 'index.html'), 'utf8'), '/dinoEdit/ is the editor page')
    assert.equal((await at('/config/validate.js')).status, 200, 'the editor\'s absolute /config/*.js imports still answer')
    assert.equal((await at('/config/merge.js')).status, 200, 'merge.js among them')
    assert.equal((await at('/dinoEdit/books.js')).status, 200, 'and the editor\'s OWN books.js is not mistaken for a shelf url')
    assert.equal((await at('/data/content.json')).status, 404, 'the old absolute /data/ is dead')
    assert.equal((await at('/assets/heroBG.jpg')).status, 404, 'the old absolute /assets/ is dead')
    assert.equal((await at('/games/')).status, 404)
    const engineModules = listFiles(v5EngineDir).filter(notDot).filter(path => path.endsWith('.js'))
    for (const g of games) {
      const noSlash = await at(`/games/${g}`)
      assert.deepEqual([noSlash.status, noSlash.location], [302, `/games/${g}/`], `/games/${g} → the slash form (page-relative paths need it)`)
      assert.equal((await at(`/games/${g}/`)).text, engineIndex, `/games/${g}/ is engine/index.html`)
      const base = `${origin}/games/${g}/index.html`
      for (const [, attr] of engineIndex.matchAll(/(?:href|src)="([^"]+)"/g)) assert.equal(await fetchStatus(new URL(attr, base)), 200, `${attr} from index.html under /games/${g}/`)
      for (const rel of engineModules) {
        const moduleURL = new URL(rel, base)
        for (const [, spec] of readFileSync(join(v5EngineDir, rel), 'utf8').matchAll(/^\s*(?:import|export)[^'"\n]*from\s+['"]([^'"]+)['"]/gm)) assert.equal(await fetchStatus(new URL(spec, moduleURL)), 200, `${spec} from ${rel} under /games/${g}/`)
      }
      const http = await hydrateHTTP(v5EngineDir, base)
      assert.deepEqual(http.warnings, [], `${g}: no warnings over HTTP`)
      assert.deepEqual(project(http.groups), project(hydrate(v5EngineDir, join(ROOT, g), SHELF).groups), `${g}: over HTTP the game plays like the folder`)
      assert.ok(http.fetched.every(url => url.startsWith('data/') || url.startsWith('books/')), `page-relative fetches: ${http.fetched.join(' ')}`)
      assert.equal((await at(`/games/${g}/data/content.json`)).text, readFileSync(join(ROOT, g, 'data', 'content.json'), 'utf8'), `${g}: data/content.json is the bytes on disk`)
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await raw(origin, `/games/${g}/${rel}`)
        assert.equal(res.status, 200, `${g}: ${rel}`)
        assert.ok(res.length > 0, `${g}: ${rel} whole file`)
      }
    }
    ok(`M2 addresses: / and /dinoEdit → /dinoEdit/; /config/ alive (merge.js included), /dinoEdit/books.js is the editor's own, /data/ and /assets/ dead; /games/<g> → 302; /games/<g>/ = engine/index.html, every link and import 200, hydrates over HTTP page-relative with every image whole (${games.join(', ')})`)

    // ── M3 create: a newborn from the sheets, byte for byte, ON THE SHELF ──
    const born = await call('/api/games', { method: 'POST', body: { title: 'Space Pirates!' } })
    assert.deepEqual(born, { status: 201, body: { ok: true, name: 'space-pirates', title: 'Space Pirates!', books: [{ name: 'basic', edition: 1 }] } })
    const newborn = 'space-pirates', dir = join(ROOT, newborn)
    const seedPins = [{ name: 'basic', edition: 1 }]
    assert.deepEqual(listFiles(dir), FILES.map(name => `data/${name}.json`).sort(), 'five data files, nothing else')
    assert.ok(statSync(join(dir, 'assets')).isDirectory(), 'an assets/ folder')
    assert.equal(readdirSync(join(dir, 'assets')).length, 0, 'an EMPTY assets/ folder')
    assert.deepEqual(readGameText(dir), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Space Pirates!', seedPins)[name])])), 'the files are games.js\'s seed, pinned, in the server\'s on-disk format')
    const newSet = readGameSet(dir)
    assert.deepEqual(validateGame({ own: newSet, books: seedPins.map(pin => readBookSync(SHELF, pin)) }), [], 'the newborn fits, judged against the book it stands on')
    assert.equal(migrateSet(newSet), newSet, 'the newborn is already at SCHEMA_VERSION — the same object comes back')
    assert.equal(keysOf(newSet.content), 'version,meta,books,groups,rowOverrides')
    assert.equal(keysOf(newSet.rules), 'version,totalBudget,groupRules')
    assert.equal(keysOf(newSet.themes), 'version,page,groupThemes')
    assert.equal(keysOf(newSet.types), 'version,types,sectionsFor,fieldsFor')
    assert.equal(keysOf(newSet.things), 'version,things')
    const bornLocal = hydrate(v5EngineDir, dir, SHELF)
    assert.deepEqual([bornLocal.warnings, bornLocal.groups], [[], []], 'the engine hydrates the newborn: no warnings, no rows')
    const bornHTTP = await hydrateHTTP(v5EngineDir, `${origin}/games/${newborn}/index.html`)
    assert.deepEqual([bornHTTP.warnings, bornHTTP.groups], [[], []], 'and over HTTP')
    assert.deepEqual(cardOf(await listed(), newborn), { name: newborn, title: 'Space Pirates!', version: 5, books: ['basic 1'], rows: 0, types: 7, things: 0, faults: 0, exported: false }, 'the list shows the newborn on Basic: seven merged sheets, no rows')
    assert.deepEqual(await editorSave(origin, newborn, newSet), Array(5).fill(SAVED), 'a no-edit save: five 200s')
    assert.deepEqual(readGameText(dir), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Space Pirates!', seedPins)[name])])), 'a no-edit save of a newborn is byte-identical')
    // S3's add-a-type recipe on a newborn, BESIDE the books it already stands on
    const grown = structuredClone(newSet)
    const typeId = randomUUID(), sectionId = randomUUID(), fieldId = randomUUID(), thingId = randomUUID(), rowId = randomUUID()
    grown.types.types.push({ id: typeId, label: 'Pet', sections: [{ id: sectionId, key: 'identity', caption: 'Identity', kind: 'fields', fields: [{ id: fieldId, key: 'colour', caption: 'Colour', type: 'text' }] }] })
    grown.things.things[typeId] = [{ id: thingId, name: 'Rex', cost: 1, imageURL: '', colour: 'green' }]
    grown.content.groups.push({ id: rowId, label: 'Pets', query: { type: typeId, where: { field: fieldId, op: 'is', value: 'green' } }, showWhen: { kind: 'always' }, children: [] })
    grown.rules.groupRules[rowId] = { min: 1 }
    assert.deepEqual(validateGame({ own: grown, books: seedPins.map(pin => readBookSync(SHELF, pin)) }), [], 'the pre-flight passes the grown set')
    assert.deepEqual(await editorSave(origin, newborn, grown), Array(5).fill(SAVED), 'the first private type lands: five 200s')
    const grownResult = hydrate(v5EngineDir, dir, SHELF)
    assert.deepEqual(grownResult.warnings, [])
    assert.equal(countGroups(grownResult.groups), 1, 'one row')
    assert.equal(countItems(grownResult.groups), 1, 'one thing')
    assert.equal(hydrate(v5EngineDir, dir, SHELF).groups.length, 1)
    ok(`M3 POST /api/games "Space Pirates!" → 201 ${newborn} pinning basic 1: five seed files byte-equal to seedSet(title, pins), empty assets/; fits against its book; canonical key orders; hydrates clean over the folder and HTTP; listed 7 sheets / 0 rows / faults 0; no-edit save byte-identical; a private type + thing + row + slot lands beside the books`)

    // ── M4 create refusals: every bad title is a 400 at "title", a repeat is a 409, and nothing is written ──
    const before = listFiles(ROOT)
    const newbornHash = treeHash(dir)
    const refusals = [
      [{ title: 'Space Pirates!' },  409, /already exists/],
      [{ title: 'space   pirates' }, 409, /already exists/],           // the same slug
      [{ title: games[0] },          409, /already exists/],
      [{ title: '' },                400, null],
      [{ title: '   ' },             400, null],
      [{ title: '!!!' },             400, /needs a letter/],
      [{ title: '..' },              400, null],
      [{ title: 'home' },            400, /keeps for itself/],
      [{ title: 'HOME' },            400, /keeps for itself/],
      [{ title: 'x'.repeat(41) },    400, /longer than 40/],
      [{},                           400, null],
      [{ title: 42 },                400, null],
      [{ title: null },              400, null]
    ]
    for (const [body, status, pattern] of refusals) {
      const r = await call('/api/games', { method: 'POST', body })
      assert.equal(r.status, status, `${JSON.stringify(body)} → ${status}`)
      assert.equal(r.body.ok, false)
      if (status === 400) {
        assert.equal(r.body.error, 'title does not make a game name', JSON.stringify(body))
        assert.equal(r.body.problems[0].path, 'title', JSON.stringify(body))
        if (pattern) assert.match(r.body.problems[0].message, pattern, JSON.stringify(body))
      } else {
        assert.match(r.body.error, pattern, JSON.stringify(body))
      }
    }
    assert.deepEqual(await call('/api/games', { method: 'POST', body: '{' }), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    assert.notEqual((await call('/api/games', { method: 'PUT', body: { title: 'Nope' } })).status, 201, 'PUT does not create')
    assert.deepEqual(await call('/api/nope'), { status: 404, body: { ok: false, error: 'Unknown route' } })
    assert.deepEqual(listFiles(ROOT), before, 'no refusal wrote a file')
    assert.equal(treeHash(dir), newbornHash, 'the 409s left the existing newborn untouched')
    // and the slug rule over the wire (N2 pins it in memory): accents stripped, the title trimmed
    assert.deepEqual(await call('/api/games', { method: 'POST', body: { title: ' Ünïcode Café ' } }), { status: 201, body: { ok: true, name: 'unicode-cafe', title: 'Ünïcode Café', books: [{ name: 'basic', edition: 1 }] } })
    ok(`M4 create refusals: ${refusals.length} bad bodies → 409 (repeat, same slug, ${games[0]}) or 400 at "title"; "{" → 400 Body is not valid JSON; PUT → not 201; /api/nope → 404 Unknown route; nothing written; " Ünïcode Café " → 201 unicode-cafe`)

    // ── M5 two games, one server: each saves in the editor's order, in isolation ──
    for (const g of games) {
      assert.deepEqual(await editorSave(origin, g, readGameSet(join(ROOT, g))), Array(5).fill(SAVED), `${g}: its own set lands`)
      assert.deepEqual(readGameText(join(ROOT, g)), readGameText(v5Sources[g]), `${g}: byte-identical to the source`)
    }
    let crossed = ''
    if (games.length >= 2) {
      const [a, b] = games
      const bBefore = readGameText(join(ROOT, b))
      const aSet = readGameSet(join(ROOT, a))
      const A2 = structuredClone(aSet)
      A2.themes.page.bodyBackground = '#123456'
      assert.deepEqual(await editorSave(origin, a, A2), Array(5).fill(SAVED), `${a}: an edit lands`)
      assert.equal(readFileSync(join(ROOT, a, 'data', 'themes.json'), 'utf8'), serialize(A2.themes), `${a}: the edit is on disk`)
      assert.deepEqual(readGameText(join(ROOT, b)), bBefore, `a save to ${a} never touches ${b}`)
      assert.deepEqual(await editorSave(origin, a, aSet), Array(5).fill(SAVED), `${a}: put back`)
      assert.deepEqual(readGameText(join(ROOT, a)), readGameText(v5Sources[a]), `${a}: back to the source bytes`)
      // the cross-post: b's content at a's route is checked against A's siblings — b's private types are not there
      const wrongGame = await post(origin, a, 'content', readGameSet(join(ROOT, b)).content)
      assert.equal(wrongGame.status, 400)
      // b's rows name b's private types, which a's types.json does not hold — and
      // b's content pins b's books, so a's own arrangement loses its shelf too
      assert.ok(wrongGame.body.problems.some(problem => /^content\.groups\[\d+\]\.query\.type$/.test(problem.path) && /shows a type that does not exist/.test(problem.message)), JSON.stringify(wrongGame.body.problems))
      assert.deepEqual(readGameText(join(ROOT, a)), readGameText(v5Sources[a]), `${a} unchanged by the refused cross-post`)
      crossed = `; ${b}'s content at ${a} → 400 (${a}'s siblings and shelf were read); a save to ${a} leaves ${b} untouched`
    }
    const foldersBefore = readdirSync(ROOT).sort()
    const unknown = ['nope', 'Dino', 'hollow', 'Bad%20Name', 'home', 'space-pirates-']
    for (const name of unknown) {
      const receipt = { status: 404, body: { ok: false, error: `Unknown CYOA "${name}"` } }
      assert.deepEqual(await call(`/api/games/${name}/save/content`, { method: 'POST', body: {} }), receipt, `${name}: save`)
      assert.deepEqual(await call(`/api/games/${name}/export`, { method: 'POST' }), receipt, `${name}: export`)
      assert.equal((await at(`/games/${name}/`)).status, 404, `${name}: play`)
      assert.equal((await at(`/dist/${name}/`)).status, 404, `${name}: preview`)
    }
    const [firstGame] = games
    assert.deepEqual(await call(`/api/games/${firstGame}/save/nope`, { method: 'POST', body: {} }), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    assert.deepEqual(await call(`/api/games/${firstGame}/nope`, { method: 'POST', body: {} }), { status: 404, body: { ok: false, error: 'Unknown route' } })
    assert.deepEqual(await call(`/api/games/${firstGame}/save/content`), { status: 404, body: { ok: false, error: 'Unknown route' } }, 'GET on the save route')
    assert.deepEqual(readdirSync(ROOT).sort(), foldersBefore, 'no unknown name made a folder')
    ok(`M5 two games, one server: ${games.join(' and ')} save in the editor's order, byte-identical${crossed}; ${unknown.length} unknown names → 404 on save, export, play and preview; bad target / bad route / GET → 404; nothing written`)

    // ── M6 export over HTTP + preview ──
    assert.equal((await at(`/dist/${firstGame}/`)).status, 404, 'nothing published yet — DIST does not exist')
    const exportedGames = [...games, newborn]
    for (const g of exportedGames) {
      const r = await call(`/api/games/${g}/export`, { method: 'POST' })
      assert.equal(r.status, 200, `${g}: ${JSON.stringify(r.body)}`)
      assert.deepEqual(Object.keys(r.body), ['ok', 'name', 'outDir', 'preview', 'files', 'rows', 'items'], 'the receipt\'s keys, in order')
      assert.equal(r.body.name, g)
      assert.equal(r.body.outDir, join(DIST, g))
      assert.equal(r.body.preview, `/dist/${g}/`)
      // the reference: the same tool, in-process, from the same source and the same shelf
      const reference = exportGame({ game: g, sourceDir: join(ROOT, g), outDir: join(WORK, 'manager-ref', g), booksDir: SHELF })
      assert.equal(treeHash(join(DIST, g)), treeHash(reference.outDir), `${g}: the route wrote exactly exportGame's bytes, manifest included`)
      assert.deepEqual({ rows: r.body.rows, items: r.body.items, files: r.body.files }, { rows: reference.manifest.rows, items: reference.manifest.items, files: Object.keys(reference.manifest.files).length }, `${g}: the receipt's counts`)
      const noSlash = await at(`/dist/${g}`)
      assert.deepEqual([noSlash.status, noSlash.location], [302, `/dist/${g}/`])
      assert.equal((await at(`/dist/${g}/`)).text, readFileSync(join(DIST, g, 'index.html'), 'utf8'), `${g}: /dist/${g}/ is the folder's own index.html`)
      const http = await hydrateHTTP(join(DIST, g), `${origin}/dist/${g}/index.html`)
      assert.deepEqual(http.warnings, [], `${g}: the published folder hydrates clean`)
      assert.deepEqual(project(http.groups), project(hydrate(v5EngineDir, join(ROOT, g), SHELF).groups), `${g}: and plays like the game folder`)
      assert.ok(http.fetched.every(url => url.startsWith('data/')), `${g}: the published folder never asks for a shelf: ${http.fetched.join(' ')}`)
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await raw(origin, `/dist/${g}/${rel}`)
        assert.equal(res.status, 200, `${g}: ${rel} under /dist/`)
        assert.ok(res.length > 0, `${g}: ${rel} whole file`)
      }
      assert.equal((await at(`/dist/${g}/app.js`)).status, 200, `${g}: the folder's own app.js`)
      assert.equal((await at(`/dist/${g}/nope.js`)).status, 404, `${g}: a file the folder lacks`)
      assert.equal((await at(`/dist/${g}/config/gameConfig.js`)).text, readFileSync(join(DIST, g, 'config', 'gameConfig.js'), 'utf8'), `${g}: config/gameConfig.js is the folder's copy`)
    }
    const afterExport = await listed()
    exportedGames.forEach(g => assert.equal(cardOf(afterExport, g).exported, true, `${g}: the list says exported`))
    assert.equal(cardOf(afterExport, 'unicode-cafe').exported, false, 'a game never exported still says so')
    // a refusal: the source is refused before dist/ is touched, so the previous export survives
    const h = treeHash(join(DIST, firstGame))
    const firstContentText = readFileSync(join(ROOT, firstGame, 'data', 'content.json'), 'utf8')
    const danglingContent = JSON.parse(firstContentText)
    danglingContent.groups.push({ id: 'm6-row', label: 'M6', query: { type: '', where: null }, showWhen: { kind: 'anyInRow', row: 'no-such-row' }, children: [] })
    writeFileSync(join(ROOT, firstGame, 'data', 'content.json'), serialize(danglingContent))
    const refused = await call(`/api/games/${firstGame}/export`, { method: 'POST' })
    assert.equal(refused.status, 400)
    assert.equal(refused.body.ok, false)
    assert.match(refused.body.error, /does not fit the schema \(1 problem/)
    assert.match(refused.body.problems[0].path, /^content\.groups\[\d+\]\.showWhen$/)
    assert.equal(refused.body.problems[0].message, 'show-when names a row that does not exist (no-such-row)')
    assert.equal(treeHash(join(DIST, firstGame)), h, 'the previous export survives the refusal')
    writeFileSync(join(ROOT, firstGame, 'data', 'content.json'), firstContentText)
    // the newborn, grown in M3, publishes too
    const bornExport = await call(`/api/games/${newborn}/export`, { method: 'POST' })
    assert.deepEqual([bornExport.status, bornExport.body.rows, bornExport.body.items], [200, 1, 1], 'the newborn exports with its one row and one thing')
    ok(`M6 export + /dist/: ${exportedGames.join(', ')} → 200 with exportGame's exact bytes and counts; /dist/<g> → 302; /dist/<g>/ hydrates from the folder alone (no book url), every image whole, no engine fallback; the list says exported; a dangling gate → 400 at its merged path and the old export survives; the newborn exports 1 row, 1 thing`)

    // ── M7 traversal and case ──
    const filesBefore = listFiles(ROOT)
    const probes = [
      `/games/../server/server.js`,
      `/games/%2e%2e/server/server.js`,
      `/games/${firstGame}/../../server/server.js`,
      `/games/${firstGame}/data/../../../server/server.js`,
      ...(games.length >= 2 ? [`/games/${firstGame}/data/../../${games[1]}/data/content.json`] : []),
      `/dist/../games/${firstGame}/data/content.json`,
      `/dist/${firstGame}/../../server/server.js`,
      `/dinoEdit/../server/server.js`,
      `/games/Dino/`,
      `/games/dino%2F..%2F/`,
      `/games/${firstGame}/assets/../data/content.json`,
      `/games/${firstGame}/books/../../../server/server.js`,
      `/books/basic/1/assets/../../../../server/server.js`
    ]
    for (const path of probes) {
      const { status, text } = await raw(origin, path)
      assert.ok([403, 404].includes(status), `${path} → ${status}`)
      assert.ok(!text.includes('createServer') && !text.includes('"version"'), `${path}: never a server file, never a game's data`)
      if (/^\/(games|dist)\/(\.\.|%2e%2e|Dino|dino%2F\.\.%2F)\//.test(path)) assert.equal(text, 'No such CYOA', `${path}: refused by the name grammar, not by a missing file`)
    }
    assert.equal((await raw(origin, '/games/../server/server.js')).status, 404, '".." is not a game name')
    assert.equal((await raw(origin, '/dinoEdit/../server/server.js')).status, 403, 'the editor\'s guard')
    assert.equal((await raw(origin, `/games/${firstGame}/data/../../../server/server.js`)).status, 403, 'the game folder\'s guard')
    const posts = [
      `/api/games/../x/save/rules`,
      `/api/games/Dino/save/rules`,
      `/api/games/${firstGame}/save/../../x`,
      `/api/games/%2e%2e/export`,
      `/api/games/${firstGame}/export/../x`,
      `/books/basic/1/book.json`
    ]
    for (const path of posts) {
      const { status, text } = await raw(origin, path, 'POST', '{}')
      assert.ok([403, 404].includes(status), `POST ${path} → ${status}`)
      assert.ok(!text.includes('createServer'), `POST ${path}: never a server file`)
    }
    assert.deepEqual(listFiles(ROOT), filesBefore, 'no probe wrote a file')
    assert.equal(existsSync(join(DIST, 'server')), false, 'no probe made a folder under dist/')
    assert.equal(treeHash(SHELF), treeHash(copyShelf(join(WORK, 'shelf-witness', 'books'))), 'and the scratch shelf is byte-identical to a fresh copy of the real one')
    ok(`M7 traversal and case: ${probes.length} literal GET probes and ${posts.length} POST probes over http.request → 403/404, never a server file or another game's data; nothing written, on the games root, under dist/ or on the shelf`)
  } finally {
    stop()
  }
}

// ═════════════════════ the newborn on a shelf: M10 (once) ═════════════════════
// "Books not given" means BUILD ON BASIC: the shelf's latest Basic if there is
// one, and nothing at all when the shelf is empty — so a newborn over an empty
// shelf is byte-for-byte the newborn v4 made.
{
  const ROOT = join(WORK, 'm10'), DIST = join(WORK, 'm10-dist')
  const SHELF = copyShelf(join(WORK, 'm10-shelf', 'books'))
  // a second edition of Basic: the same book, one number different
  cpSync(join(SHELF, 'basic', '1'), join(SHELF, 'basic', '2'), { recursive: true })
  writeFileSync(join(SHELF, 'basic', '2', 'book.json'), serialize({ ...JSON.parse(readFileSync(join(SHELF, 'basic', '1', 'book.json'), 'utf8')), edition: 2 }))
  mkdirSync(ROOT, { recursive: true })
  const { origin, stop } = await startServer(ROOT, DIST, SHELF)
  try {
    const born = await api(origin, '/api/games', { method: 'POST', body: { title: 'On Basic' } })
    assert.deepEqual(born, { status: 201, body: { ok: true, name: 'on-basic', title: 'On Basic', books: [{ name: 'basic', edition: 2 }] } }, 'the LATEST Basic is what a newborn stands on')
    assert.deepEqual(readGameSet(join(ROOT, 'on-basic')).content.books, [{ name: 'basic', edition: 2 }])
    assert.deepEqual(readGameText(join(ROOT, 'on-basic')), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('On Basic', [{ name: 'basic', edition: 2 }])[name])])), 'the seed, pinned, byte for byte')
    const http = await hydrateHTTP(v5EngineDir, `${origin}/games/on-basic/index.html`)
    assert.deepEqual([http.warnings, http.groups], [[], []], 'it hydrates clean over HTTP with no rows')
    const listed = (await api(origin, '/api/games')).body.games.find(g => g.name === 'on-basic')
    assert.deepEqual([listed.books, listed.types, listed.rows, listed.faults], [['basic 2'], 7, 0, 0], 'and the list says seven merged sheets, no rows, no faults')
    // books GIVEN are used as given
    assert.deepEqual(await api(origin, '/api/games', { method: 'POST', body: { title: 'No Books', books: [] } }), { status: 201, body: { ok: true, name: 'no-books', title: 'No Books', books: [] } })
    assert.deepEqual(readGameSet(join(ROOT, 'no-books')).content.books, [])
    assert.deepEqual(await api(origin, '/api/games', { method: 'POST', body: { title: 'Old Basic', books: [{ name: 'basic', edition: 1 }] } }), { status: 201, body: { ok: true, name: 'old-basic', title: 'Old Basic', books: [{ name: 'basic', edition: 1 }] } })
    // a pin the shelf cannot answer, and one that is not even shaped like a pin
    const missing = await api(origin, '/api/games', { method: 'POST', body: { title: 'Ghost', books: [{ name: 'basic', edition: 9 }] } })
    assert.equal(missing.status, 400)
    assert.deepEqual(missing.body.problems, [{ path: 'books[0]', message: '"basic" 9 is not on the shelf' }])
    const misshapen = await api(origin, '/api/games', { method: 'POST', body: { title: 'Ghost', books: [{ name: 'Basic', edition: 1 }] } })
    assert.equal(misshapen.status, 400)
    assert.equal(misshapen.body.problems[0].path, 'books[0].name')
    assert.match(misshapen.body.problems[0].message, /is not a book name/)
    assert.equal(existsSync(join(ROOT, 'ghost')), false, 'a refused create writes nothing')
  } finally { stop() }
  // over an EMPTY shelf the newborn is exactly the one v4 made
  const EMPTY = join(WORK, 'm10-empty', 'books')
  mkdirSync(EMPTY, { recursive: true })
  const bare = await startServer(join(WORK, 'm10b'), join(WORK, 'm10b-dist'), EMPTY)
  try {
    assert.deepEqual(await api(bare.origin, '/api/games', { method: 'POST', body: { title: 'Alone' } }), { status: 201, body: { ok: true, name: 'alone', title: 'Alone', books: [] } })
    assert.deepEqual(readGameText(join(WORK, 'm10b', 'alone')), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Alone')[name])])), 'the bytes are seedSet(title) — no shelf, no pins')
    ok('M10 the seed pins Basic: with basic 1 and 2 on the shelf a newborn pins basic 2 and the receipt says so; it hydrates clean with 7 merged sheets and 0 rows; books: [] is honoured; a pin off the shelf → 400 at books[0] and a mis-spelled name → 400 at books[0].name, nothing written; over an EMPTY shelf a newborn pins nothing and its five files are seedSet(title) exactly')
  } finally { bare.stop() }
}

// ═════════════════════ the shelf's listing: M11 (once) ═════════════════════
{
  const SHELF = copyShelf(join(WORK, 'm11-shelf', 'books'))
  mkdirSync(join(SHELF, 'Bad Name', '1'), { recursive: true })              // a folder the grammar refuses
  mkdirSync(join(SHELF, 'hollow', '1'), { recursive: true })                 // an edition with no book.json
  mkdirSync(join(SHELF, 'basic', 'one'), { recursive: true })                // an edition folder that is not an edition
  writeBook(SHELF, 'broken', 1, {                                            // a Stats-like book writing outside its namespace
    book: { name: 'broken', title: 'Broken', edition: 1, requires: [{ name: 'basic', edition: 1 }] },
    types: { version: 5, types: [], sectionsFor: {}, fieldsFor: { 'basic:character.attributes': [{ id: 'basic:strength', key: 'strength', caption: 'Strength', type: 'number', default: 10 }] } }
  })
  const { origin, stop } = await startServer(join(WORK, 'm11'), join(WORK, 'm11-dist'), SHELF)
  try {
    const answer = await api(origin, '/api/books')
    assert.equal(answer.status, 200)
    assert.deepEqual(Object.keys(answer.body), ['ok', 'books'], 'the response keys, in order')
    assert.equal(answer.body.ok, true)
    const books = answer.body.books
    assert.deepEqual(books.map(book => book.name), ['Bad Name', 'basic', 'broken', 'dinosaur-age', 'hollow', 'stats'], 'every folder, sorted by name')
    const bookOf = (name) => books.find(book => book.name === name)
    assert.deepEqual(Object.keys(bookOf('Bad Name')), ['name', 'error'])
    assert.match(bookOf('Bad Name').error, /lowercase letters, digits and single dashes — rename the folder/)
    assert.deepEqual(Object.keys(bookOf('basic')), ['name', 'title', 'editions'], 'a book entry: name, title, editions')
    assert.deepEqual(bookOf('basic').editions.map(edition => edition.edition), [1, 'one'], 'editions ascending, a mis-named folder last')
    assert.match(bookOf('basic').editions[1].error, /edition folders are positive integers — rename the folder/)
    const basicOne = bookOf('basic').editions[0]
    assert.deepEqual(Object.keys(basicOne), ['edition', 'title', 'requires', 'sheets', 'sectionsAdded', 'fieldsAdded', 'things', 'rows', 'budget', 'problems'], 'an edition entry, in order')
    assert.deepEqual([basicOne.title, basicOne.requires, basicOne.sheets, basicOne.fieldsAdded, basicOne.things, basicOne.rows, basicOne.budget, basicOne.problems], ['Basic', [], 7, 0, 0, 0, null, []])
    const statsOne = bookOf('stats').editions[0]
    assert.deepEqual([statsOne.sheets, statsOne.fieldsAdded, statsOne.problems], [0, 5, []], 'Stats adds five fields and defines no sheet')
    assert.deepEqual(statsOne.requires, [{ name: 'basic', edition: 1 }])
    const [da1, da2] = bookOf('dinosaur-age').editions
    assert.deepEqual([da1.edition, da1.fieldsAdded, da1.things, da1.rows, da1.budget, da1.problems], [1, 4, 23, 4, 10, []])
    assert.deepEqual([da2.edition, da2.things], [2, 24], 'edition 2 holds one more thing')
    assert.equal(bookOf('dinosaur-age').title, 'Dinosaur Age', 'the book\'s title is the latest readable edition\'s')
    assert.deepEqual(bookOf('hollow').editions[0], { edition: 1, error: 'book.json cannot be read (ENOENT)' })
    assert.deepEqual(bookOf('broken').editions[0].problems, [{ path: 'types.fieldsFor["basic:character.attributes"][0].id', message: '"basic:strength" is not in this book\'s namespace (broken:)' }], 'the broken edition carries its namespace problem, by path')
    assert.equal(bookOf('broken').editions[0].fieldsAdded, 1, 'and its facts are still counted')
    ok(`M11 GET /api/books: ${books.length} folders listed sorted by name, editions ascending with a mis-named folder last; the response keys ok, books; a book entry name, title, editions; an edition entry edition, title, requires, sheets, sectionsAdded, fieldsAdded, things, rows, budget, problems; Basic 7 sheets, Stats 5 additions, Dinosaur Age 23/24 things, 4 rows, budget 10; "Bad Name", hollow and a namespace violation each carry their own sentence`)
  } finally { stop() }
}

// ── E10 ignore rules (once) ──
{
  const lines = readFileSync(join(GIT_ROOT, '.gitignore'), 'utf8').split('\n').map(line => line.trim())
  assert.ok(lines.includes('.DS_Store'), '.gitignore lists .DS_Store')
  assert.ok(lines.includes('dist/'), '.gitignore lists dist/')
  const ignored = (path) => spawnSync('git', ['check-ignore', '-q', path], { cwd: GIT_ROOT }).status === 0
  assert.ok(ignored(`${DINO_IN_REPO}/dist/dino/index.html`), 'an export under dist/ is ignored')
  assert.ok(ignored(`${DINO_IN_REPO}/games/dino/assets/.DS_Store`), 'a Finder file under assets/ is ignored')
  assert.ok(!execFileSync('git', ['ls-files'], { cwd: GIT_ROOT, encoding: 'utf8' }).includes('.DS_Store'), 'no .DS_Store is tracked')
  ok('E10 .gitignore: .DS_Store and dist/ listed; git ignores dist/dino/index.html and assets/.DS_Store; no .DS_Store tracked')
}

// ── M8 launch.json (once): ONE "cyoa" entry starts the server with no game and no shelf on the command line ──
{
  const launch = JSON.parse(readFileSync(join(GIT_ROOT, '.claude', 'launch.json'), 'utf8'))
  const names = launch.configurations.map(c => c.name)
  assert.ok(names.includes('cyoa'), 'a "cyoa" entry')
  assert.ok(names.includes('dist'), 'the "dist" entry is kept — it proves the folder under a foreign static server')
  assert.ok(!names.includes('dino') && !names.includes('vampire'), 'the per-game entries are gone')
  const cyoa = launch.configurations.find(c => c.name === 'cyoa')
  assert.deepEqual([cyoa.runtimeExecutable, cyoa.runtimeArgs, cyoa.port], ['node', ['cyoa/DinoCYOA/server/server.js'], 3000], 'node server.js, no game name and no shelf argument, port 3000')
  ok('M8 launch.json: one "cyoa" entry = node cyoa/DinoCYOA/server/server.js on 3000, no game or shelf argument; "dist" kept; no dino/vampire entries')
}

// ── M9 / M12 scratch only (once, after every server has been stopped) ──
// Every server above ran over a scratch root, every export went to a scratch
// folder, and every shelf a tool could write to was a COPY — the hashes taken
// before the first check say so. M12 is the shelf's half: books/** is authored
// once and then immutable, so no route, no tool and no test may change a byte.
{
  assert.equal(treeHash(join(DINO_DIR, 'games')), realGames, 'games/ is byte-identical to before the run')
  assert.equal(existsSync(realDistDir) ? treeHash(realDistDir) : null, realDist, 'dist/ is byte-identical to before the run')
  ok('M9 the real games/ and dist/ are untouched — every write went to the scratch roots')
  assert.equal(treeHash(REAL_BOOKS), realBooks, 'books/ is byte-identical to before the run')
  ok(`M12 the real books/ is untouched: ${listFiles(REAL_BOOKS).length} files, the same sha256s as before the first check — the shelf is read-only`)
}

const tail = `${skipped.length > 0 ? ` (${skipped.length} skipped: ${skipped.join('; ')})` : ''} (work dir: ${WORK})`
if (blockedChecks.length > 0) {
  console.log(`\n${checks} checks ran${tail}`)
  console.log(`${blockedChecks.length} check(s) BLOCKED by a bug in another package's file — the assertion says what the code must do:`)
  blockedChecks.forEach(line => console.log(`  FAIL ${line}`))
  process.exitCode = 1
} else {
  console.log(`\nall ${checks} checks passed${tail}`)
}
