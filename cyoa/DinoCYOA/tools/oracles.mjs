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
// NEW: the border (server-side validation) and the export, per game, then one repo check:
//   C4 relative paths           the v4 engine asks for data/… and builds assets/… — page-relative, never absolute
//   S1 committed files fit      validateSet says [] over the committed, migrated, climbed and restructured sets; crossChecks names G1's faults by path
//   S2 route refuses            the per-game route (/api/games/<name>/save/<file>): a bad body is a 400 that names every path and writes nothing; a good one is a 200 and the exact bytes; an unknown game → 404; the old /api/save/ is dead
//   S3 editor order end-to-end  four in parallel then content; a new type + thing + row + slot lands; a removal lands; content alone is refused first
//   S4 checked against disk     content is refused while a sibling ON DISK is hand-broken, unparsable or missing
//   E1 exact file set           the export is engine/ + data/ + assets/ + the manifest, nothing else; manifest keys fixed
//   E2 bytes                    every data file byte-equal to games/<game>; every size and sha256 true to the manifest
//   E3 folder hydrates          the folder plays exactly like games/<game>, page-relative, every image present
//   E4 subpath serving          the engine over real HTTP under /site/<game>/: every request under the prefix, every link and image 200
//   E5 idempotent               a second export is byte-identical, manifest included; a stray file is rebuilt away
//   E6 refuses old data         a v3 game is refused by version; nothing written
//   E7 refuses a dangle         a dangling row or a missing image is refused with its path; the previous export survives
//   E8 wipe safety              only a marked or empty folder is written; the source game and the project are never targets
//   E9 CLI                      exit 0 prints the tree; usage exits 1; refusals exit 2 and write nothing
//   E10 ignore rules            .gitignore holds .DS_Store and dist/; git ignores both; no .DS_Store is tracked
// NEW: the manager — ONE server over a root holding EVERY game, once, after the per-game loop:
//   M1 GET /api/games           every folder with title, version, counts, exported flag; a bad name and a hollow folder listed with their problem
//   M2 addresses                / → /dinoEdit/; /games/<name> → 302; /games/<name>/ serves the engine and hydrates over HTTP page-relative; /data/ dead; /config/ alive
//   M3 POST /api/games          a newborn from the sheets: seed bytes, fits, no-op migration, hydrates clean over HTTP, byte-identical no-edit save, S3's add-a-type lands
//   M4 create refusals          bad titles → 400 at title, repeat → 409, not-JSON → 400, PUT → not 201; nothing written
//   M5 two games, one server    both save in the editor's order, isolated; dino's content at vampire → 400; unknown game → 404 on every route
//   M6 export + /dist/          the route writes exportGame's bytes; /dist/<name>/ hydrates alone; a dangle → 400 and the old export survives; a newborn exports
//   M7 traversal and case       literal "..", %2e%2e, Dino, dino%2F..%2F over http.request → 403/404, never a server file; nothing written
//   M8 launch.json              one "cyoa" entry, no game argument, port 3000; "dist" kept; no dino/vampire
//   M9 scratch only             the real games/ and dist/ are byte-identical to before the run
//
// Data for the migration and bridge checks always comes from git (the pins
// below), never from the working tree — so restructuring the committed data
// cannot make those checks drift. The engines under comparison come from git
// too (git archive), untouched. Each hydration runs in its own node process
// (--hydrate / --hydrate-http / --play modes, below) because gameConfig.js
// does its loading at import time, once per process. The S checks run the
// REAL server (server/server.js) on a free port over a scratch GAMES ROOT
// (CYOA_GAMES_DIR) and a scratch dist root (CYOA_DIST_DIR); the E checks run
// the real export tool in-process and as a CLI.

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
// CHANGED: every url the engine asks for is RECORDED into `fetched` before the
// lookup — the parent checks the spelling, not just the answer. The lookup
// itself is unchanged: join(gameDir, url) accepts 'data/x.json' (the v4
// engine, page-relative) and '/data/x.json' (the v2 and v3 engines from git)
// alike, because join treats a leading slash on a later segment as nothing.
const installFakeFetch = (gameDir, fetched = []) => {
  globalThis.fetch = async (url) => {
    fetched.push(url)
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

// The hydrated groups, summarized. The summary projects ONLY the fields the
// v2, v3 and v4 engines all produce (a v4 row also carries query and showWhen;
// a v3 row carried displayType) — that is what lets C1 and C2 deepEqual across
// engines. Keep it that way: a field only one engine has would make every
// bridge fail. CHANGED: hoisted to module level so every hydrating child
// shares the one summarizer.
const summarize = (groups) => groups.map(group => ({
  id: group.id,
  label: group.label,
  min: String(group.min),               // Infinity does not survive JSON
  max: String(group.max),
  background: group.background,
  items: group.items.map(item => ({
    // CHANGED: the v4 engine builds page-relative URLs (assets/x.jpg) so a
    // published folder works from any subpath; the v2 and v3 engines from git
    // still build /assets/x.jpg. Same file, two spellings — the leading slash
    // is dropped here so the bridges compare FILES, not spellings.
    id: item.id, name: item.name, cost: item.cost, imageURL: item.imageURL.replace(/^\//, ''),
    label: item.label, traits: item.traits
  })),
  children: summarize(group.children)
}))

// node oracles.mjs --hydrate <engineDir> <gameDir>
// Imports the engine's real gameConfig.js and prints { warnings, fetched,
// heroImage, images, groups }. CHANGED: `fetched` is every url the engine asked
// for, in order, `heroImage` is the border's hero URL and `images` the item
// image URLs as the border built them — all so the parent can check the v4
// engine's spellings ('data/…', 'assets/…') unstripped. The import's
// namespace is kept whole as `mod` so groups and pageTheme are read off the
// same object; `?.` and `?? null` keep stdout valid JSON even for an engine
// that hydrates without a pageTheme export (every pinned engine has one today).
if (process.argv[2] === '--hydrate') {
  const [engineDir, gameDir] = process.argv.slice(3)
  const warnings = captureWarnings()
  const fetched = []
  installFakeFetch(gameDir, fetched)
  const mod = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const heroImage = mod.pageTheme?.heroImage ?? null
  // the item images UNSTRIPPED and distinct — summarize() drops a leading slash
  // so the bridges can compare files across engines; C4 pins the v4 spelling here
  const flat = (rows) => rows.flatMap(row => [row, ...flat(row.children)])
  const images = [...new Set(flat(mod.groups).flatMap(row => row.items.map(item => item.imageURL)).filter(Boolean))].sort()
  // writeSync, not process.stdout.write: on macOS a write to a pipe is asynchronous,
  // and process.exit right after it would drop everything past the 64 KB pipe buffer
  writeSync(process.stdout.fd, JSON.stringify({ warnings, fetched, heroImage, images, groups: summarize(mod.groups) }))
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
  writeSync(process.stdout.fd, JSON.stringify({ warnings, start: { visible, unmet }, steps }))   // sync, see --hydrate
  process.exit(0)
}

// NEW: node oracles.mjs --hydrate-http <engineDir> <baseURL>
// The same hydration over REAL HTTP. baseURL ends in index.html, and every
// url the engine asks for is resolved against it with new URL(url, baseURL)
// — the exact page-relative resolution a browser performs for a fetch from a
// page — then handed to node's real fetch. No fake fetch: E4's static server
// answers, and the parent reads which paths it was asked for.
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
// below the two child branches because those must keep stdout pure JSON.)
await import('./oracles-logic.mjs')

const { migrateSet } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'migrations.js')).href)
const { SCHEMA_VERSION } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'schema.js')).href)
const { danglingReferences, forgetType, forgetThing } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'references.js')).href)
const { flattenGroups } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'helpers.js')).href)
const RESTRUCTURE_SCRIPT = join(DINO_DIR, 'tools', 'restructure-v4.mjs')
const { PLANS, statusOf, restructure } = await import(pathToFileURL(RESTRUCTURE_SCRIPT).href)
// NEW: the border and the export — the validator the server, the editor and
// the export share, the real server script, and the export tool's exports
// (its CLI only runs when it is argv[1], so importing it runs nothing).
const SERVER_SCRIPT = join(DINO_DIR, 'server', 'server.js')
const EXPORT_SCRIPT = join(DINO_DIR, 'tools', 'export.mjs')
const { validateSet, validateFile, crossChecks } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'validate.js')).href)
const { exportGame, ExportRefusal, MANIFEST, TOOL, listFiles, sha256 } = await import(pathToFileURL(EXPORT_SCRIPT).href)
// NEW: the server's games module — the seed M3 compares bytes against, the slug
// and the name grammar N2 pins (imported here so M3 reads the SAME seed the
// route writes, never a copy that could drift)
const { seedSet, slugOf, isGameName } = await import(pathToFileURL(join(DINO_DIR, 'server', 'games.js')).href)
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
// NEW: the HTTP child must NOT be run with execFileSync: the server it fetches
// from lives in THIS process, and a synchronous wait would freeze the event
// loop that answers it — the child would wait forever. So this one is awaited.
const hydrateHTTP = (engineDir, baseURL) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--hydrate-http', engineDir, baseURL], { stdio: ['ignore', 'pipe', 'inherit'] })
  let out = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`--hydrate-http exited ${code}`)))   // close, not exit: stdout is drained by then
})
// NEW: the restructure CLI, exit code and all (execFileSync would throw on exit 1/2, and those are the point)
const runRestructureCLI = (game, dataDir) => {
  const { status, stdout } = spawnSync(process.execPath, [RESTRUCTURE_SCRIPT, game, '--data-dir', dataDir], { encoding: 'utf8' })
  return { status, stdout }
}
// NEW: the export CLI, the same way — exit 1 and 2 are the point
const runExportCLI = (args) => {
  const { status, stdout } = spawnSync(process.execPath, [EXPORT_SCRIPT, ...args], { encoding: 'utf8' })
  return { status, stdout }
}

// NEW: the REAL server on a free port (PORT=0) over a scratch games ROOT
// (CYOA_GAMES_DIR) and a scratch dist root (CYOA_DIST_DIR) — no game on the
// command line: the server serves every folder under the root, and every
// request names its game in the URL. It logs every request to stdout, so
// stdout is DRAINED for the life of the child — a full pipe would block it
// mid-request. The banner carries the port the OS picked. A child that dies
// or stays silent rejects (and is killed), so a broken server fails the run
// instead of hanging it.
const startServer = (gamesDir, distDir) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [SERVER_SCRIPT], { env: { ...process.env, PORT: '0', CYOA_GAMES_DIR: gamesDir, CYOA_DIST_DIR: distDir }, stdio: ['ignore', 'pipe', 'inherit'] })
  let banner = ''
  const timer = setTimeout(() => { child.kill(); reject(new Error('server did not start in 10 s')) }, 10_000)
  child.on('exit', code => { clearTimeout(timer); reject(new Error(`server exited (${code}) before its banner`)) })
  child.stdout.on('data', chunk => { banner += chunk; const m = banner.match(/Server online at (http:\/\/localhost:\d+)/); if (m) { clearTimeout(timer); resolve({ origin: m[1], stop: () => child.kill() }) } })
})
// CHANGED: one POST to the save route OF ONE GAME; a string body goes over the wire AS IS (the not-JSON case)
const post = async (origin, game, name, body) => { const res = await fetch(`${origin}/api/games/${game}/save/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }); return { status: res.status, body: await res.json() } }
// exactly main.js's order: the four in parallel, content only when all four are ok (CHANGED: for one named game)
const editorSave = async (origin, game, set) => { const receipts = await Promise.all(['types', 'things', 'rules', 'themes'].map(name => post(origin, game, name, set[name]))); if (receipts.every(r => r.body.ok)) receipts.push(await post(origin, game, 'content', set.content)); return receipts }
const SAVED = { status: 200, body: { ok: true } }
// NEW: three more ways to ask the server, for the manager's routes (M1–M7).
// api(): any method, any path, an optional body → { status, body } where body
// is the parsed JSON — or the raw TEXT when the answer is not JSON (the engine
// static's "File not found", a 302's empty body) — never a throw. A string
// body goes over the wire as-is. redirect: 'manual', so a 302 is SEEN as a 302
// (node's fetch would follow it and report the page it landed on).
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
// raw(): the LITERAL path over http.request → { status, text }. fetch() is a
// URL parser first: it folds "/games/../x" to "/x" and "%2e%2e" to ".." on the
// CLIENT, before anything is sent (probed on this machine) — so a traversal
// check through fetch would prove nothing about the server. http.request
// sends the bytes it is given.
const raw = (origin, path, method = 'GET', body = null) => new Promise((resolve, reject) => {
  const { hostname, port } = new URL(origin)
  const headers = body === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  const req = httpRequest({ hostname, port, path, method, headers }, res => {
    let text = ''
    res.setEncoding('utf8')
    res.on('data', chunk => { text += chunk })
    res.on('end', () => resolve({ status: res.statusCode, text }))
  })
  req.on('error', reject)
  req.end(body ?? undefined)
})
// a fetch that only wants the status (and drains the body so the socket is reused)
const fetchStatus = async (url) => { const res = await fetch(url); await res.arrayBuffer(); return res.status }

// NEW: a small static server for E4 — /<prefix>/<rest> → <rootDir>/<rest>,
// 404 for anything else (so an ABSOLUTE /data/… from the engine would die
// here), every req.url recorded so the parent can see which paths were asked
// for. Content-Length is set by hand: E4 compares it to the file's size.
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
// an independent walker over a problem path — `.key`, `[n]` and `["k"]`
// tokens applied from the set's top — so a path is proven to lead somewhere
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

// NEW: the real games/ and dist/ as they are BEFORE anything below runs — M9
// hashes them again at the very end. Every server this file starts is pointed
// at a scratch root, every export at a scratch folder; this is the proof.
const realGames = treeHash(join(DINO_DIR, 'games'))
const realDistDir = join(DINO_DIR, 'dist')
const realDist = existsSync(realDistDir) ? treeHash(realDistDir) : null

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

  // ── C4 the v4 engine asks for page-relative URLs — the one rule that lets a published folder play from any subpath ──
  assert.deepEqual(v4Tree.fetched, FILES.map(name => `data/${name}.json`), 'the five files, page-relative, in loader order')
  assert.equal(v4Tree.heroImage, 'assets/heroBG.jpg', 'the hero is assets/…, not /assets/…')
  // the summarizer strips a leading slash for the bridges, so the item images are checked UNSTRIPPED
  assert.ok(v4Tree.images.length > 0 && v4Tree.images.every(url => url.startsWith('assets/')), `unstripped item images: ${v4Tree.images.join(', ')}`)
  ok('C4 the v4 engine asks for data/… and builds assets/… — page-relative, never absolute')

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

  // ═════════════════════ the border: S1–S4 ═════════════════════
  // NEW: validate.js is the contract the server enforces. S1 proves the
  // committed data fits it (and that its cross half IS G1's audit, by path);
  // S2–S4 run the REAL server over a scratch copy and prove the route.

  // ── S1 the committed files fit the contract, at every stage of their history ──
  const treeSet = readGameSet(workingTreeDir)
  assert.deepEqual(validateSet(treeSet), [], `games/${game} fits`)
  FILES.forEach(name => assert.deepEqual(validateFile(name, treeSet[name]), [], `${name}.json alone fits`))
  assert.deepEqual(validateSet(first), [], 'the v3 → v4 migration fits')
  assert.deepEqual(validateSet(migrateSet(rawV2)), [], 'the v2 → v4 climb fits')
  assert.deepEqual(validateSet(restructured), [], 'the restructured set fits')
  // G1's eight faults, seen by the validator: the same eight sentences, each
  // now attached to the pointer that dangles — and every path leads to its row
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
  ok(`S1 games/${game}, the migration, the climb and the restructure all fit; crossChecks = G1's 8 faults by path; two bad kinds postpone the cross pass (D6)`)

  // ── S2 the route refuses and writes nothing ──
  // CHANGED: the server is started over a scratch games ROOT and this game is
  // one folder under it (the second game of a run joins the first one there);
  // srvDir is still this game's folder, so every line below reads as before.
  const srvRoot = join(WORK, 'srv')
  const srvDir = copyGame(workingTreeDir, join(srvRoot, game))
  const { origin, stop } = await startServer(srvRoot, join(WORK, 'srv-dist'))
  try {
    const before = readGameText(srvDir)
    const E = readGameSet(srvDir)
    const dataFile = (name) => join(srvDir, 'data', `${name}.json`)
    const unchanged = (label) => assert.deepEqual(readGameText(srvDir), before, `${label}: the disk is unchanged`)
    const old = await post(origin, game, 'content', { ...E.content, version: 3 })
    assert.equal(old.status, 400)
    assert.equal(old.body.ok, false)
    assert.equal(old.body.error, 'content.json does not fit the schema')
    assert.equal(old.body.problems.length, 1, 'an old version is ONE problem')
    assert.equal(old.body.problems[0].path, 'content.version')
    assert.match(old.body.problems[0].message, /must be 4 \(found 3\) — open the game in the editor and Save/)
    unchanged('an old version')
    assert.deepEqual(await post(origin, game, 'content', '{'), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    unchanged('a body that is not JSON')
    const brokenTypes = structuredClone(E.types)
    brokenTypes.types[0].fields.push({ ...brokenTypes.types[0].fields[0], id: 'f-dup' })   // a second field under the first one's key
    const dup = await post(origin, game, 'types', brokenTypes)
    assert.equal(dup.status, 400)
    assert.deepEqual(dup.body.problems, validateFile('types', brokenTypes), 'the wire carries the module\'s own list')
    assert.equal(dup.body.problems[0].path, 'types.types[0].fields[2].key')
    unchanged('a duplicate field key')
    assert.deepEqual(await post(origin, game, 'nope', {}), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    // a target named like an inherited property is unknown too — the whitelist reads own keys only
    assert.deepEqual(await post(origin, game, 'constructor', { version: 4 }), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    // a save that fails ON DISK is a 500 receipt, never the end of the process: the
    // committed rules land fine right after (the server is still up)
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
    // NEW: the route carries the game — a game the root does not hold is a 404 receipt, and the old game-less route is gone
    assert.deepEqual(await post(origin, 'nope', 'rules', E.rules), { status: 404, body: { ok: false, error: 'Unknown CYOA "nope"' } })
    assert.equal((await api(origin, '/api/save/rules', { method: 'POST', body: E.rules })).status, 404, 'the old route is dead')
    ok('S2 route: version 3 → 400 at content.version; not-JSON → 400; duplicate field key → 400 at types.types[0].fields[2].key; nothing written; unknown and prototype-named targets → 404; a disk refusal → 500 and the server lives; the committed rules → 200; unknown game → 404; /api/save/ dead')

    // ── S3 the editor's order end-to-end: add-type-first-save, removal, and the negative ──
    assert.deepEqual(await editorSave(origin, game, E), Array(5).fill(SAVED), 'the committed set lands: five 200s')
    assert.deepEqual(readGameText(srvDir), readGameText(workingTreeDir), `byte-identical to games/${game}/data`)
    // the editor's way to add a type: the type, its bucket with a thing, a row
    // asking for the type with a condition on its field, and a rules slot
    const E2 = structuredClone(E)
    const typeId = randomUUID(), fieldId = randomUUID(), thingId = randomUUID(), rowId = randomUUID()
    const firstThing = Object.values(E2.things.things)[0][0]
    E2.types.types.push({ id: typeId, label: 'Pet', fields: [{ id: fieldId, key: 'colour', caption: 'Colour', type: 'text' }] })
    E2.things.things[typeId] = [{ id: thingId, name: 'Rex', cost: 1, imageURL: '', colour: 'green' }]
    E2.content.groups.push({ id: rowId, label: 'Pets', query: { type: typeId, where: { field: fieldId, op: 'is', value: 'green' } }, showWhen: { kind: 'thingPicked', thing: firstThing.id }, children: [] })
    E2.rules.groupRules[rowId] = { min: 1 }
    assert.deepEqual(validateSet(E2), [], 'the pre-flight passes the new set')
    // negative first: content alone, before its type has landed, is refused against the disk
    const early = await post(origin, game, 'content', E2.content)
    assert.equal(early.status, 400)
    assert.equal(early.body.problems[0].path, `content.groups[${E2.content.groups.length - 1}].query.type`)
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
    assert.deepEqual(danglingReferences(afterRemoval), [], 'nothing dangles on disk')
    assert.deepEqual(afterRemoval.content.groups.at(-1).query, { type: '', where: null }, 'the Pets row shows nothing now')
    ok('S3 editor order: committed set → five 200s, byte-identical; content posted early → 400 (type not on disk); add type+thing+row+slot → lands; remove the type → lands, closed')

    // ── S4 content is checked against the siblings AS THEY SIT ON DISK ──
    const atS4 = readGameText(srvDir)
    const content = readGameSet(srvDir).content
    const handBroken = readGameSet(srvDir).types
    handBroken.types[0].fields[0].key = 'name'                       // a hand-edit the editor would have warned about
    writeFileSync(dataFile('types'), serialize(handBroken))
    const reserved = await post(origin, game, 'content', content)
    assert.equal(reserved.status, 400)
    assert.match(reserved.body.problems[0].path, /^types\.types\[0\]\.fields\[0\]\.key$/)
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

  // ═════════════════════ the export: E1–E9 ═════════════════════
  // NEW: tools/export.mjs publishes games/<game> as one static folder. E1–E5
  // prove what the folder holds and that it plays, from a subpath, over real
  // HTTP; E6–E9 prove every refusal writes nothing and wipes nothing it did
  // not write.

  // ── E1 exact file set ──
  const outDir = join(WORK, 'dist', game)
  const { manifest } = exportGame({ game, outDir })
  const exported = listFiles(outDir)
  const expectedFiles = [MANIFEST, ...listFiles(v4EngineDir).filter(notDot), ...FILES.map(name => `data/${name}.json`), ...listFiles(join(workingTreeDir, 'assets')).filter(notDot).map(file => `assets/${file}`)].sort()
  assert.deepEqual(exported, expectedFiles, 'the engine, data/, assets/ and the manifest — nothing else')
  exported.forEach(path => assert.doesNotMatch(path, /dinoEdit|server|tools|oracles|\.mjs$|\.DS_Store/))
  assert.deepEqual(Object.keys(manifest.files), exported.filter(path => path !== MANIFEST), 'the manifest lists every file but itself, in listFiles order')
  assert.deepEqual(Object.keys(manifest), ['tool', 'game', 'schemaVersion', 'complete', 'rows', 'items', 'files'], 'fixed keys — no timestamp, no git hash')
  assert.equal(manifest.tool, 'cyoa-export')
  assert.equal(manifest.complete, true)
  assert.equal(manifest.schemaVersion, 4)
  assert.equal(manifest.game, game)
  assert.equal(manifest.rows, countGroups(v4Tree.groups))
  assert.equal(manifest.items, countItems(v4Tree.groups))
  // the dotfile filter only bites when a dotfile is THERE: plant Finder's droppings in a
  // scratch source and prove the export leaves them behind (the marker is the one dotfile)
  const dotted = copyGame(workingTreeDir, join(WORK, 'dotted', game))
  writeFileSync(join(dotted, 'assets', '.DS_Store'), 'finder was here')
  mkdirSync(join(dotted, 'assets', '.hidden'), { recursive: true })
  writeFileSync(join(dotted, 'assets', '.hidden', 'x.txt'), 'hidden')
  const dottedOut = join(WORK, 'dist-dotted', game)
  exportGame({ game, outDir: dottedOut, sourceDir: dotted })
  assert.deepEqual(listFiles(dottedOut).filter(path => path !== MANIFEST && !notDot(path)), [], 'no dotfile or dot-folder travels — only the marker')
  ok(`E1 export = ${exported.length} files: engine/ + data/ + assets/ + ${MANIFEST}, nothing else; manifest keys fixed; ${manifest.rows} rows, ${manifest.items} things; a planted .DS_Store stays behind`)

  // ── E2 bytes ──
  FILES.forEach(name => assert.equal(readFileSync(join(outDir, 'data', `${name}.json`), 'utf8'), readFileSync(join(workingTreeDir, 'data', `${name}.json`), 'utf8'), `data/${name}.json is the committed bytes`))
  listFiles(join(workingTreeDir, 'assets')).filter(notDot).forEach(file => {
    const source = join(workingTreeDir, 'assets', file), copy = join(outDir, 'assets', file)
    assert.equal(statSync(copy).size, statSync(source).size, `${file}: size`)
    assert.equal(sha256(copy), sha256(source), `${file}: sha256`)
  })
  if (game === 'vampire') assert.equal(readFileSync(join(outDir, 'assets', 'ATTRIBUTION.txt'), 'utf8'), readFileSync(join(workingTreeDir, 'assets', 'ATTRIBUTION.txt'), 'utf8'), 'ATTRIBUTION.txt travels')
  // the committed files are canonical, so bytes == serialize(parse(bytes)) could hide a
  // re-serialization: a source with 4-space content.json and no trailing newline cannot
  const nonCanon = copyGame(workingTreeDir, join(WORK, 'noncanon', game))
  const oddText = JSON.stringify(JSON.parse(readFileSync(join(nonCanon, 'data', 'content.json'), 'utf8')), null, 4)
  writeFileSync(join(nonCanon, 'data', 'content.json'), oddText)
  const nonCanonOut = join(WORK, 'dist-noncanon', game)
  exportGame({ game, outDir: nonCanonOut, sourceDir: nonCanon })
  assert.equal(readFileSync(join(nonCanonOut, 'data', 'content.json'), 'utf8'), oddText, 'the data bytes travel untouched, never re-serialized')
  Object.entries(manifest.files).forEach(([path, { bytes, sha256: hash }]) => {
    assert.equal(sha256(join(outDir, path)), hash, `${path}: manifest sha256`)
    assert.equal(statSync(join(outDir, path)).size, bytes, `${path}: manifest bytes`)
  })
  assert.deepEqual(JSON.parse(readFileSync(join(outDir, MANIFEST), 'utf8')), manifest, 'the manifest on disk is the one returned')
  ok(`E2 bytes: five data files byte-equal; ${Object.keys(manifest.files).length} sizes and sha256s true to the manifest; the manifest on disk parses to itself`)

  // ── E3 the folder hydrates like the working tree — engine AND data from the folder ──
  const fromDist = hydrate(outDir, outDir)
  assert.deepEqual(fromDist.warnings, [])
  assert.deepEqual(fromDist.groups, v4Tree.groups, 'the folder plays exactly like games/<game>')
  assert.deepEqual(fromDist.fetched, FILES.map(name => `data/${name}.json`))
  assert.equal(fromDist.heroImage, 'assets/heroBG.jpg')
  imagesOf(fromDist.groups).forEach(rel => assert.ok(existsSync(join(outDir, rel)), `${rel} is in the folder`))
  ok(`E3 the folder hydrates like games/${game}: same summary, page-relative fetches, ${imagesOf(fromDist.groups).length} image URLs all present`)

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
      for (const [, spec] of readFileSync(join(outDir, rel), 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.equal(await status(new URL(spec, moduleURL)), 200, `${spec} from ${rel}`)
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
  exportGame({ game, outDir })
  assert.equal(treeHash(outDir), h1, 'a second export is byte-identical, manifest included')
  assert.ok(!existsSync(join(outDir, 'stray.txt')), 'the stray file is gone')
  ok('E5 a second export is byte-identical (manifest included, no timestamp); a stray file in a marked folder is rebuilt away')

  // ── E6 refuses data that is not at the current version, and writes nothing ──
  const v3Src = join(WORK, 'v3src', game)
  writeGame(v3Src, rawV3)
  cpSync(join(workingTreeDir, 'assets'), join(v3Src, 'assets'), { recursive: true })
  const outV3 = join(WORK, 'out-v3', game)
  assert.throws(() => exportGame({ game, outDir: outV3, sourceDir: v3Src }), err => err instanceof ExportRefusal && /is at version 3, not 4 — open the game in the editor and Save first/.test(err.message))
  assert.equal(existsSync(outV3), false, 'nothing written')
  // a data file that is not JSON is a refusal by name, never a stack trace
  const badJSON = copyGame(workingTreeDir, join(WORK, 'badjson', game))
  writeFileSync(join(badJSON, 'data', 'content.json'), '{')
  const outBad = join(WORK, 'out-badjson', game)
  assert.throws(() => exportGame({ game, outDir: outBad, sourceDir: badJSON }), err => err instanceof ExportRefusal && /data\/content\.json is not valid JSON \(/.test(err.message))
  assert.equal(existsSync(outBad), false, 'nothing written for bad JSON either')
  ok('E6 a v3 game is refused by version ("open the game in the editor and Save first"); a file that is not JSON is refused by name; nothing written')

  // ── E7 refuses a dangling set and a missing image, and preserves a previous export ──
  const keep = join(WORK, 'keep', game)
  exportGame({ game, outDir: keep })
  const hKeep = treeHash(keep)
  const dangling = copyGame(workingTreeDir, join(WORK, 'dangling', game))
  const danglingContent = readGameSet(dangling).content
  danglingContent.groups[0].showWhen = { kind: 'anyInRow', row: 'no-such-row' }
  writeFileSync(join(dangling, 'data', 'content.json'), serialize(danglingContent))
  assert.throws(() => exportGame({ game, outDir: keep, sourceDir: dangling }), err => {
    assert.ok(err instanceof ExportRefusal)
    assert.deepEqual(err.problems, [{ path: 'content.groups[0].showWhen', message: 'show-when names a row that does not exist (no-such-row)' }])
    assert.match(err.message, /does not fit the schema \(1 problem/)
    return true
  })
  const ghost = copyGame(workingTreeDir, join(WORK, 'ghost', game))
  const ghostSet = readGameSet(ghost)
  const [firstBucket] = Object.keys(ghostSet.things.things)
  ghostSet.things.things[firstBucket][0].imageURL = 'ghost.png'
  ghostSet.themes.page.heroImage = 'nohero.jpg'
  writeFileSync(join(ghost, 'data', 'things.json'), serialize(ghostSet.things))
  writeFileSync(join(ghost, 'data', 'themes.json'), serialize(ghostSet.themes))
  assert.throws(() => exportGame({ game, outDir: keep, sourceDir: ghost }), err => {
    assert.ok(err instanceof ExportRefusal)
    assert.deepEqual(err.problems[0], { path: `things.things[${JSON.stringify(firstBucket)}][0].imageURL`, message: 'names a file that is not in assets/ (ghost.png)' })
    assert.ok(err.problems.some(problem => problem.path === 'themes.page.heroImage' && problem.message === 'names a file that is not in assets/ (nohero.jpg)'))
    return true
  })
  assert.equal(treeHash(keep), hKeep, 'the previous export survives both refusals (validate before wipe)')
  ok('E7 a dangling gate → refused at content.groups[0].showWhen; a ghost image and a ghost hero → refused by path; the previous export is untouched')

  // ── E8 wipe safety and out-dir guards ──
  const notMine = join(WORK, 'notmine', game)
  mkdirSync(notMine, { recursive: true })
  writeFileSync(join(notMine, 'precious.txt'), 'keep me\n')
  assert.throws(() => exportGame({ game, outDir: notMine }), /refusing to wipe .*no \.cyoa-export\.json marker/)
  assert.deepEqual(listFiles(notMine), ['precious.txt'], 'precious.txt survives')
  const empty = join(WORK, 'empty', game)
  mkdirSync(empty, { recursive: true })
  exportGame({ game, outDir: empty })
  assert.equal(treeHash(empty), h1, 'an existing empty folder is accepted and filled')
  const half = join(WORK, 'half', game)
  mkdirSync(half, { recursive: true })
  writeFileSync(join(half, MANIFEST), serialize({ tool: 'cyoa-export', game, schemaVersion: 4, complete: false }))
  writeFileSync(join(half, 'stale.txt'), 'from an interrupted run\n')
  exportGame({ game, outDir: half })
  assert.ok(!existsSync(join(half, 'stale.txt')), 'an interrupted export is ours to wipe')
  assert.equal(treeHash(half), h1)
  const theirs = join(WORK, 'theirs', game)
  mkdirSync(theirs, { recursive: true })
  writeFileSync(join(theirs, MANIFEST), serialize({ tool: 'other', game }))
  writeFileSync(join(theirs, 'theirs.txt'), 'another tool wrote this\n')
  assert.throws(() => exportGame({ game, outDir: theirs }), /refusing to wipe/)
  assert.deepEqual(listFiles(theirs), [MANIFEST, 'theirs.txt'], 'another tool\'s folder is untouched')
  const asFile = join(WORK, `outfile-${game}.txt`)
  writeFileSync(asFile, 'a file, not a folder\n')
  assert.throws(() => exportGame({ game, outDir: asFile }), err => err instanceof ExportRefusal && /it exists and is not a folder/.test(err.message))
  assert.equal(readFileSync(asFile, 'utf8'), 'a file, not a folder\n', 'the file is untouched')
  // claim-first: a copy that dies half way must leave OUR marker (complete: false) behind,
  // so the next run may wipe the debris. An unreadable asset makes cpSync throw mid-copy.
  const dying = copyGame(workingTreeDir, join(WORK, 'dying', game))
  const unreadable = join(dying, 'assets', 'unreadable.bin')
  writeFileSync(unreadable, 'x')
  const dyingOut = join(WORK, 'dist-dying', game)
  try {
    chmodSync(unreadable, 0o000)
    assert.throws(() => exportGame({ game, outDir: dyingOut, sourceDir: dying }), err => !(err instanceof ExportRefusal) && /EACCES/.test(err.message))
    const marker = JSON.parse(readFileSync(join(dyingOut, MANIFEST), 'utf8'))
    assert.deepEqual([marker.tool, marker.complete], [TOOL, false], 'the claim went down before the first copied byte')
  } finally {
    chmodSync(unreadable, 0o644)
  }
  exportGame({ game, outDir: dyingOut, sourceDir: dying })   // the debris carried our marker, so it is rebuilt
  assert.equal(JSON.parse(readFileSync(join(dyingOut, MANIFEST), 'utf8')).complete, true)
  const dataHash = treeHash(join(workingTreeDir, 'data'))
  ;[workingTreeDir, join(workingTreeDir, 'assets'), dirname(DINO_DIR), DINO_DIR].forEach(target => {
    assert.throws(() => exportGame({ game, outDir: target }), /refusing to write/, `guard: ${target}`)
    assert.ok(!existsSync(join(target, MANIFEST)), `${target}: nothing claimed`)
  })
  assert.equal(treeHash(join(workingTreeDir, 'data')), dataHash, `games/${game}/data untouched`)
  ok('E8 wipe safety: an unmarked folder with files → refused, file kept; an empty folder → filled; an interrupted export → rebuilt; another tool\'s marker → refused; a file as --out → refused; a copy that dies leaves the claim marker; the game, its assets, cyoa/ and DinoCYOA → refused, untouched')

  // ── E9 the CLI: exit codes and the printed tree ──
  const cliOut = join(WORK, 'cli-export', game)
  const written = runExportCLI([game, '--out', cliOut])
  assert.equal(written.status, 0, `the CLI exits 0:\n${written.stdout}`)
  ;[/→ /, /verified/, /preview\s+python3 -m http\.server/, /publish/].forEach(pattern => assert.match(written.stdout, pattern))
  assert.equal(treeHash(cliOut), treeHash(outDir), 'the CLI writes what exportGame writes')
  const noArgs = runExportCLI([])
  assert.equal(noArgs.status, 1)
  assert.match(noArgs.stdout, /usage/)
  const wipe = runExportCLI([game, '--out', notMine])
  assert.equal(wipe.status, 2)
  assert.match(wipe.stdout, /refusing to wipe/)
  const cliV3 = join(WORK, 'cli-v3', game)
  const oldData = runExportCLI([game, '--game-dir', v3Src, '--out', cliV3])
  assert.equal(oldData.status, 2)
  assert.match(oldData.stdout, /Save first/)
  assert.equal(existsSync(cliV3), false, 'a refused CLI run writes nothing')
  const nosuch = runExportCLI(['nosuch'])
  assert.equal(nosuch.status, 2)
  assert.match(nosuch.stdout, /no such game/)
  ok('E9 CLI: exit 0 prints the tree and writes E1\'s bytes; no args → 1 (usage); unmarked folder, v3 data, unknown game → 2, nothing written')
}

// ═════════════════════ the manager: M1–M7 ═════════════════════
// NEW: ONE server over a root that holds EVERY game of this run, plus three
// folders planted to be listed loudly or skipped. Nothing here reads the real
// games/ or dist/: ROOT is a scratch copy and DIST does not even exist yet —
// the export route has to make it. Every game name travels in the URL.
{
  const ROOT = join(WORK, 'manager'), DIST = join(WORK, 'manager-dist')   // DIST does not exist yet: the route must make it
  games.forEach(g => copyGame(join(DINO_DIR, 'games', g), join(ROOT, g)))
  mkdirSync(join(ROOT, 'Bad Name', 'data'), { recursive: true })          // a folder the rule refuses
  mkdirSync(join(ROOT, 'hollow'))                                          // a folder with no data
  mkdirSync(join(ROOT, '.hidden'))                                         // a dot-folder: skipped
  writeFileSync(join(ROOT, 'README.txt'), 'not a folder\n')                // a file: skipped
  const engineIndex = readFileSync(join(v4EngineDir, 'index.html'), 'utf8')
  const { origin, stop } = await startServer(ROOT, DIST)
  try {
    const at = (path) => get(`${origin}${path}`)                            // a GET of one path on THIS server
    const call = (path, init) => api(origin, path, init)                    // one API call on THIS server
    const FACT_KEYS = ['name', 'title', 'version', 'rows', 'types', 'things', 'exported']
    // the facts the list must show for a game folder, read from that folder
    const factsOf = (name, dir) => {
      const set = readGameSet(dir)
      return { name, title: set.content.meta.pageTitle, version: SCHEMA_VERSION, rows: countGroups(set.content.groups), types: set.types.types.length, things: Object.values(set.things.things).flat().length, exported: false }
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
      assert.deepEqual(facts, factsOf(g, join(ROOT, g)), `${g}: the facts on disk`)
    })
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
    ok(`M1 GET /api/games: ${list1.body.games.length} folders listed, sorted; ${games.join(' and ')} with title, version ${SCHEMA_VERSION}, counts, exported false; "Bad Name" → rename the folder; hollow → ENOENT; a "{" content.json → cannot be read; dot-folder and file skipped`)

    // ── M2 addresses: the manager is the door, the engine plays under /games/<name>/ page-relative, the old absolute paths are dead ──
    const root = await at('/')
    assert.deepEqual([root.status, root.location], [302, '/dinoEdit/'], '/ → the editor')
    const bare = await at('/dinoEdit')
    assert.deepEqual([bare.status, bare.location], [302, '/dinoEdit/'])
    assert.equal((await at('/dinoEdit/')).text, readFileSync(join(DINO_DIR, 'dinoEdit', 'index.html'), 'utf8'), '/dinoEdit/ is the editor page')
    assert.equal((await at('/config/validate.js')).status, 200, 'the editor\'s absolute /config/*.js imports still answer')
    assert.equal((await at('/data/content.json')).status, 404, 'the old absolute /data/ is dead')
    assert.equal((await at('/assets/heroBG.jpg')).status, 404, 'the old absolute /assets/ is dead')
    assert.equal((await at('/games/')).status, 404)
    const engineModules = listFiles(v4EngineDir).filter(notDot).filter(path => path.endsWith('.js'))
    for (const g of games) {
      const noSlash = await at(`/games/${g}`)
      assert.deepEqual([noSlash.status, noSlash.location], [302, `/games/${g}/`], `/games/${g} → the slash form (page-relative paths need it)`)
      assert.equal((await at(`/games/${g}/`)).text, engineIndex, `/games/${g}/ is engine/index.html`)
      const base = `${origin}/games/${g}/index.html`
      // what a browser does next: every href/src in the page, every static import in every engine module
      for (const [, attr] of engineIndex.matchAll(/(?:href|src)="([^"]+)"/g)) assert.equal(await fetchStatus(new URL(attr, base)), 200, `${attr} from index.html under /games/${g}/`)
      for (const rel of engineModules) {
        const moduleURL = new URL(rel, base)
        for (const [, spec] of readFileSync(join(v4EngineDir, rel), 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.equal(await fetchStatus(new URL(spec, moduleURL)), 200, `${spec} from ${rel} under /games/${g}/`)
      }
      // the engine hydrates over HTTP, page-relative, exactly as it does over the folder
      const http = await hydrateHTTP(v4EngineDir, base)
      assert.deepEqual(http.warnings, [], `${g}: no warnings over HTTP`)
      assert.deepEqual(http.groups, hydrate(v4EngineDir, join(ROOT, g)).groups, `${g}: over HTTP the game plays like the folder`)
      assert.ok(http.fetched.every(url => url.startsWith('data/')), `page-relative fetches: ${http.fetched.join(' ')}`)
      assert.equal((await at(`/games/${g}/data/content.json`)).text, readFileSync(join(ROOT, g, 'data', 'content.json'), 'utf8'), `${g}: data/content.json is the bytes on disk`)
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await at(`/games/${g}/${rel}`)
        assert.equal(res.status, 200, `${g}: ${rel}`)
        assert.equal(Number(res.headers.get('content-length')), statSync(join(ROOT, g, rel)).size, `${g}: ${rel} whole file`)
      }
    }
    ok(`M2 addresses: / and /dinoEdit → /dinoEdit/; /config/ alive, /data/ and /assets/ dead; /games/<g> → 302; /games/<g>/ = engine/index.html, every link and import 200, hydrates over HTTP page-relative with every image whole (${games.join(', ')})`)

    // ── M3 create: a newborn from the sheets, byte for byte; it fits, migrates to itself, hydrates clean, saves byte-identically, and grows a type ──
    const born = await call('/api/games', { method: 'POST', body: { title: 'Space Pirates!' } })
    assert.deepEqual(born, { status: 201, body: { ok: true, name: 'space-pirates', title: 'Space Pirates!' } })
    const newborn = 'space-pirates', dir = join(ROOT, newborn)
    assert.deepEqual(listFiles(dir), FILES.map(name => `data/${name}.json`).sort(), 'five data files, nothing else')
    assert.ok(statSync(join(dir, 'assets')).isDirectory(), 'an assets/ folder')
    assert.equal(readdirSync(join(dir, 'assets')).length, 0, 'an EMPTY assets/ folder')
    assert.deepEqual(readGameText(dir), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Space Pirates!')[name])])), 'the files are games.js\'s seed in the server\'s on-disk format')
    const newSet = readGameSet(dir)
    assert.deepEqual(validateSet(newSet), [], 'the newborn fits')
    assert.equal(migrateSet(newSet), newSet, 'the newborn is already at SCHEMA_VERSION — the same object comes back')
    assert.equal(keysOf(newSet.content), 'version,meta,groups')
    assert.equal(keysOf(newSet.rules), 'version,totalBudget,groupRules')
    assert.equal(keysOf(newSet.themes), 'version,page,groupThemes')
    assert.equal(keysOf(newSet.types), 'version,types')
    assert.equal(keysOf(newSet.things), 'version,things')
    const bornLocal = hydrate(v4EngineDir, dir)
    assert.deepEqual([bornLocal.warnings, bornLocal.groups], [[], []], 'the engine hydrates the newborn over the folder: no warnings, no rows')
    const bornHTTP = await hydrateHTTP(v4EngineDir, `${origin}/games/${newborn}/index.html`)
    assert.deepEqual([bornHTTP.warnings, bornHTTP.groups], [[], []], 'and over HTTP')
    assert.deepEqual(cardOf(await listed(), newborn), { name: newborn, title: 'Space Pirates!', version: 4, rows: 0, types: 0, things: 0, exported: false }, 'the list shows the newborn')
    assert.deepEqual(await editorSave(origin, newborn, newSet), Array(5).fill(SAVED), 'a no-edit save: five 200s')
    assert.deepEqual(readGameText(dir), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Space Pirates!')[name])])), 'a no-edit save of a newborn is byte-identical')
    // S3's add-a-type recipe on a newborn: no first thing exists to gate on, so the row is always shown
    const grown = structuredClone(newSet)
    const typeId = randomUUID(), fieldId = randomUUID(), thingId = randomUUID(), rowId = randomUUID()
    grown.types.types.push({ id: typeId, label: 'Pet', fields: [{ id: fieldId, key: 'colour', caption: 'Colour', type: 'text' }] })
    grown.things.things[typeId] = [{ id: thingId, name: 'Rex', cost: 1, imageURL: '', colour: 'green' }]
    grown.content.groups.push({ id: rowId, label: 'Pets', query: { type: typeId, where: { field: fieldId, op: 'is', value: 'green' } }, showWhen: { kind: 'always' }, children: [] })
    grown.rules.groupRules[rowId] = { min: 1 }
    assert.deepEqual(validateSet(grown), [], 'the pre-flight passes the grown set')
    assert.deepEqual(await editorSave(origin, newborn, grown), Array(5).fill(SAVED), 'the first type lands: five 200s')
    const grownResult = hydrate(v4EngineDir, dir)
    assert.deepEqual(grownResult.warnings, [])
    assert.equal(countGroups(grownResult.groups), 1, 'one row')
    assert.equal(countItems(grownResult.groups), 1, 'one thing')
    ok(`M3 POST /api/games "Space Pirates!" → 201 ${newborn}: five seed files byte-equal to games.js's seed, empty assets/; fits; migrateSet is identity; canonical key orders; hydrates clean over the folder and HTTP; listed 0/0/0; no-edit save byte-identical; a type + thing + row + slot lands (1 row, 1 item)`)

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
    assert.deepEqual(await call('/api/games', { method: 'POST', body: { title: ' Ünïcode Café ' } }), { status: 201, body: { ok: true, name: 'unicode-cafe', title: 'Ünïcode Café' } })
    ok(`M4 create refusals: ${refusals.length} bad bodies → 409 (repeat, same slug, ${games[0]}) or 400 at "title"; "{" → 400 Body is not valid JSON; PUT → not 201; /api/nope → 404 Unknown route; nothing written; " Ünïcode Café " → 201 unicode-cafe`)

    // ── M5 two games, one server: each saves in the editor's order, in isolation; the border reads the NAMED game's siblings; an unknown game is 404 on every route ──
    for (const g of games) {
      assert.deepEqual(await editorSave(origin, g, readGameSet(join(ROOT, g))), Array(5).fill(SAVED), `${g}: the committed set lands`)
      assert.deepEqual(readGameText(join(ROOT, g)), readGameText(join(DINO_DIR, 'games', g)), `${g}: byte-identical to games/${g}/data`)
    }
    let crossed = ''
    if (games.length >= 2) {
      const [a, b] = games
      const bBefore = readGameText(join(ROOT, b))
      const aSet = readGameSet(join(ROOT, a))
      const A2 = structuredClone(aSet)
      A2.rules.totalBudget += 1
      assert.deepEqual(await editorSave(origin, a, A2), Array(5).fill(SAVED), `${a}: an edit lands`)
      assert.equal(readFileSync(join(ROOT, a, 'data', 'rules.json'), 'utf8'), serialize(A2.rules), `${a}: the edit is on disk`)
      assert.deepEqual(readGameText(join(ROOT, b)), bBefore, `a save to ${a} never touches ${b}`)
      assert.deepEqual(await editorSave(origin, a, aSet), Array(5).fill(SAVED), `${a}: put back`)
      assert.deepEqual(readGameText(join(ROOT, a)), readGameText(join(DINO_DIR, 'games', a)), `${a}: back to the committed bytes`)
      // the cross-post: a's content at b's route is checked against B's siblings — a's types are not there
      const wrongGame = await post(origin, b, 'content', aSet.content)
      assert.equal(wrongGame.status, 400)
      assert.match(wrongGame.body.problems[0].path, /^content\.groups\[0\]\.query\.type$/)
      assert.match(wrongGame.body.problems[0].message, /shows a type that does not exist/)
      assert.deepEqual(readGameText(join(ROOT, b)), bBefore, `${b} unchanged by the refused cross-post`)
      crossed = `; ${a}'s content at ${b} → 400 (${b}'s siblings were read); a save to ${a} leaves ${b} untouched`
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
    const [first] = games
    assert.deepEqual(await call(`/api/games/${first}/save/nope`, { method: 'POST', body: {} }), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    assert.deepEqual(await call(`/api/games/${first}/nope`, { method: 'POST', body: {} }), { status: 404, body: { ok: false, error: 'Unknown route' } })
    assert.deepEqual(await call(`/api/games/${first}/save/content`), { status: 404, body: { ok: false, error: 'Unknown route' } }, 'GET on the save route')
    assert.deepEqual(readdirSync(ROOT).sort(), foldersBefore, 'no unknown name made a folder')
    ok(`M5 two games, one server: ${games.join(' and ')} save in the editor's order, byte-identical${crossed}; ${unknown.length} unknown names → 404 on save, export, play and preview; bad target / bad route / GET → 404; nothing written`)

    // ── M6 export over HTTP + preview: the route writes exactly exportGame's bytes, /dist/<name>/ plays from the folder alone, a refusal keeps the old export ──
    assert.equal((await at(`/dist/${first}/`)).status, 404, 'nothing published yet — DIST does not exist')
    const exportedGames = [...games, newborn]
    for (const g of exportedGames) {
      const r = await call(`/api/games/${g}/export`, { method: 'POST' })
      assert.equal(r.status, 200, `${g}: ${JSON.stringify(r.body)}`)
      assert.deepEqual(Object.keys(r.body), ['ok', 'name', 'outDir', 'preview', 'files', 'rows', 'items'], 'the receipt\'s keys, in order')
      assert.equal(r.body.name, g)
      assert.equal(r.body.outDir, join(DIST, g))
      assert.equal(r.body.preview, `/dist/${g}/`)
      // the reference: the same tool, in-process, from the same source — its own folder, so nothing here leans on E1's
      const reference = exportGame({ game: g, sourceDir: join(ROOT, g), outDir: join(WORK, 'manager-ref', g) })
      assert.equal(treeHash(join(DIST, g)), treeHash(reference.outDir), `${g}: the route wrote exactly exportGame's bytes, manifest included`)
      assert.deepEqual({ rows: r.body.rows, items: r.body.items, files: r.body.files }, { rows: reference.manifest.rows, items: reference.manifest.items, files: Object.keys(reference.manifest.files).length }, `${g}: the receipt's counts`)
      const noSlash = await at(`/dist/${g}`)
      assert.deepEqual([noSlash.status, noSlash.location], [302, `/dist/${g}/`])
      assert.equal((await at(`/dist/${g}/`)).text, readFileSync(join(DIST, g, 'index.html'), 'utf8'), `${g}: /dist/${g}/ is the folder's own index.html`)
      const http = await hydrateHTTP(join(DIST, g), `${origin}/dist/${g}/index.html`)
      assert.deepEqual(http.warnings, [], `${g}: the published folder hydrates clean`)
      assert.deepEqual(http.groups, hydrate(v4EngineDir, join(ROOT, g)).groups, `${g}: and plays like the game folder`)
      assert.ok(http.fetched.every(url => url.startsWith('data/')), `page-relative fetches: ${http.fetched.join(' ')}`)
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await at(`/dist/${g}/${rel}`)
        assert.equal(res.status, 200, `${g}: ${rel} under /dist/`)
        assert.equal(Number(res.headers.get('content-length')), statSync(join(DIST, g, rel)).size, `${g}: ${rel} whole file`)
      }
      // no engine fallback under /dist/: the folder's own files answer, a file the folder lacks is 404
      assert.equal((await at(`/dist/${g}/app.js`)).status, 200, `${g}: the folder's own app.js`)
      assert.equal((await at(`/dist/${g}/nope.js`)).status, 404, `${g}: a file the folder lacks`)
      assert.equal((await at(`/dist/${g}/config/gameConfig.js`)).text, readFileSync(join(DIST, g, 'config', 'gameConfig.js'), 'utf8'), `${g}: config/gameConfig.js is the folder's copy`)
    }
    const afterExport = await listed()
    exportedGames.forEach(g => assert.equal(cardOf(afterExport, g).exported, true, `${g}: the list says exported`))
    assert.equal(cardOf(afterExport, 'unicode-cafe').exported, false, 'a game never exported still says so')
    // a refusal: the source is refused before dist/ is touched, so the previous export survives
    const h = treeHash(join(DIST, first))
    const firstContentText = readFileSync(join(ROOT, first, 'data', 'content.json'), 'utf8')
    const dangling = JSON.parse(firstContentText)
    dangling.groups[0].showWhen = { kind: 'anyInRow', row: 'no-such-row' }
    writeFileSync(join(ROOT, first, 'data', 'content.json'), serialize(dangling))
    const refused = await call(`/api/games/${first}/export`, { method: 'POST' })
    assert.equal(refused.status, 400)
    assert.equal(refused.body.ok, false)
    assert.match(refused.body.error, /does not fit the schema \(1 problem/)
    assert.deepEqual(refused.body.problems, [{ path: 'content.groups[0].showWhen', message: 'show-when names a row that does not exist (no-such-row)' }])
    assert.equal(treeHash(join(DIST, first)), h, 'the previous export survives the refusal')
    writeFileSync(join(ROOT, first, 'data', 'content.json'), firstContentText)
    // the newborn, grown in M3, publishes too
    const bornExport = await call(`/api/games/${newborn}/export`, { method: 'POST' })
    assert.deepEqual([bornExport.status, bornExport.body.rows, bornExport.body.items], [200, 1, 1], 'the newborn exports with its one row and one thing')
    ok(`M6 export + /dist/: ${exportedGames.join(', ')} → 200 with exportGame's exact bytes and counts; /dist/<g> → 302; /dist/<g>/ hydrates from the folder alone, every image whole, no engine fallback; the list says exported; a dangling gate → 400 at content.groups[0].showWhen and the old export survives; the newborn exports 1 row, 1 thing`)

    // ── M7 traversal and case: literal "..", %2e%2e, an uppercase name, an encoded slash — never a server file, never another game's data, nothing written ──
    const filesBefore = listFiles(ROOT)
    const probes = [
      `/games/../server/server.js`,
      `/games/%2e%2e/server/server.js`,
      `/games/${first}/../../server/server.js`,
      `/games/${first}/data/../../../server/server.js`,
      // climbing from one game's data into ANOTHER game's — only a probe when a second game is on the root
      // (with one game the path lands back on its own content.json, and a 200 there is the right answer)
      ...(games.length >= 2 ? [`/games/${first}/data/../../${games[1]}/data/content.json`] : []),
      `/dist/../games/${first}/data/content.json`,
      `/dist/${first}/../../server/server.js`,
      `/dinoEdit/../server/server.js`,
      `/games/Dino/`,
      `/games/dino%2F..%2F/`,
      `/games/${first}/assets/../data/content.json`
    ]
    for (const path of probes) {
      const { status, text } = await raw(origin, path)
      assert.ok([403, 404].includes(status), `${path} → ${status}`)
      assert.ok(!text.includes('createServer') && !text.includes('"version"'), `${path}: never a server file, never a game's data`)
      // a probe whose NAME segment the grammar refuses must be refused BY THE GRAMMAR
      // ("No such CYOA"), not by the scratch layout happening to hold no such file —
      // a server that skipped isGameName on /dist/ would answer "File not found" here
      if (/^\/(games|dist)\/(\.\.|%2e%2e|Dino|dino%2F\.\.%2F)\//.test(path)) assert.equal(text, 'No such CYOA', `${path}: refused by the name grammar, not by a missing file`)
    }
    // exact codes where the trace is unambiguous
    assert.equal((await raw(origin, '/games/../server/server.js')).status, 404, '".." is not a game name')
    assert.equal((await raw(origin, '/dinoEdit/../server/server.js')).status, 403, 'the editor\'s guard')
    assert.equal((await raw(origin, `/games/${first}/data/../../../server/server.js`)).status, 403, 'the game folder\'s guard')
    const posts = [
      `/api/games/../x/save/rules`,
      `/api/games/Dino/save/rules`,
      `/api/games/${first}/save/../../x`,
      `/api/games/%2e%2e/export`,
      `/api/games/${first}/export/../x`
    ]
    for (const path of posts) {
      const { status, text } = await raw(origin, path, 'POST', '{}')
      assert.ok([403, 404].includes(status), `POST ${path} → ${status}`)
      assert.ok(!text.includes('createServer'), `POST ${path}: never a server file`)
    }
    assert.deepEqual(listFiles(ROOT), filesBefore, 'no probe wrote a file')
    assert.equal(existsSync(join(DIST, 'server')), false, 'no probe made a folder under dist/')
    ok(`M7 traversal and case: ${probes.length} literal GET probes and ${posts.length} POST probes over http.request → 403/404, never a server file or another game's data; nothing written`)
  } finally {
    stop()
  }
}

// ── E10 ignore rules (once): Feature 2(c) landed in a5e5f7b; this pins it so it cannot quietly come undone ──
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

// ── M8 launch.json (once): ONE "cyoa" entry starts the server with no game on the command line ──
// NEW: the server takes no game argument any more, so a launch entry that still
// passes one would start a server that serves it wrongly; this pins the file.
{
  const launch = JSON.parse(readFileSync(join(GIT_ROOT, '.claude', 'launch.json'), 'utf8'))
  const names = launch.configurations.map(c => c.name)
  assert.ok(names.includes('cyoa'), 'a "cyoa" entry')
  assert.ok(names.includes('dist'), 'the "dist" entry is kept — it proves the folder under a foreign static server')
  assert.ok(!names.includes('dino') && !names.includes('vampire'), 'the per-game entries are gone')
  const cyoa = launch.configurations.find(c => c.name === 'cyoa')
  assert.deepEqual([cyoa.runtimeExecutable, cyoa.runtimeArgs, cyoa.port], ['node', ['cyoa/DinoCYOA/server/server.js'], 3000], 'node server.js, no game name, port 3000')
  ok('M8 launch.json: one "cyoa" entry = node cyoa/DinoCYOA/server/server.js on 3000, no game argument; "dist" kept; no dino/vampire entries')
}

// ── M9 scratch only (once, after every server has been stopped): the real tree is untouched ──
// NEW: every server above ran over a scratch root and every export went to a
// scratch folder — the hashes taken before the first check say so.
{
  assert.equal(treeHash(join(DINO_DIR, 'games')), realGames, 'games/ is byte-identical to before the run')
  assert.equal(existsSync(realDistDir) ? treeHash(realDistDir) : null, realDist, 'dist/ is byte-identical to before the run')
  ok('M9 the real games/ and dist/ are untouched — every write went to the scratch roots')
}

console.log(`\nall ${checks} checks passed (work dir: ${WORK})`)
