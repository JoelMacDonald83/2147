// NEW: publish a game as one static folder that plays from any subpath.
//
//   node cyoa/DinoCYOA/tools/export.mjs <game> [--out <dir>] [--game-dir <dir>]
//     <game>       a folder under games/ (dino, vampire) — also the name in the manifest
//     --out        default: <DinoCYOA>/dist/<game>
//     --game-dir   default: <DinoCYOA>/games/<game>   (the oracle points it at scratch copies)
//   node cyoa/DinoCYOA/tools/export.mjs --verify <engineDir> <gameDir>   child mode, prints ONE JSON object
//   exit 0 written · exit 1 usage · exit 2 refused (message, one "  path: message" line per problem, nothing written)
//
// The folder is engine/ verbatim (page-relative paths mean nothing is
// rewritten), the five data files' committed BYTES, and assets/. What makes
// this a tool rather than a cp is the ORDER it works in — the safety rule:
//
//   read → version gate → contract gate → out-dir guards → wipe (marker or empty only)
//     → claim → copy → verify in child processes → manifest last
//
// Every refusal that concerns the SOURCE comes before anything under --out
// is touched, so a refusal leaves a previous export intact. Nothing is ever
// removed without the .cyoa-export.json marker this tool itself writes: the
// marker is written FIRST (complete: false), so a run that dies mid-copy leaves
// a folder the next run may wipe, and the manifest overwrites it LAST
// (complete: true, sha256 of every file). No timestamp and no git hash go in
// the manifest — a second run on the same tree is byte-identical, and the
// content hashes are the provenance.
//
// The oracle imports exportGame and the helpers and runs this file as a CLI
// to prove the exit codes. Imports come from engine/ only (the border's
// migrateSet and validateSet) — tools never reach into dinoEdit/ or server/.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, cpSync, statSync, writeSync } from 'node:fs'
import { join, resolve, relative, dirname, basename, isAbsolute, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { migrateSet } from '../engine/config/migrations.js'
import { SCHEMA_VERSION } from '../engine/config/schema.js'
import { validateSet, problemText, FILE_NAMES } from '../engine/config/validate.js'

// ───────────────────────── the --verify child ─────────────────────────
// Hydrates <gameDir>/data through <engineDir>'s real gameConfig.js and prints
// ONE JSON object on stdout — nothing else may reach stdout, because the parent
// JSON.parses it. A child process, because gameConfig.js does its loading at
// import time, once per process (and the oracle exports several times in one process).
// console.warn is captured: a warning is the engine failing closed on a dangle,
// and a published folder must have none. The fake fetch is the oracle's trick:
// the url is data/x.json (or /data/x.json — join accepts both), read from disk.
if (process.argv[2] === '--verify') {
  const [engineDir, gameDir] = process.argv.slice(3)
  const warnings = []
  console.warn = (...parts) => warnings.push(parts.join(' '))
  const fetched = []
  globalThis.fetch = async (url) => {
    fetched.push(url)
    try { const text = readFileSync(join(gameDir, url), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(text) } }
    catch { return { ok: false, status: 404, json: async () => { throw new Error(`404 ${url}`) } } }
  }
  const { groups, pageTheme } = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const skeleton = (rows) => rows.map(row => ({ id: row.id, items: row.items.map(item => item.id), children: skeleton(row.children) }))
  const flat = (rows) => rows.flatMap(row => [row, ...flat(row.children)])
  const countGroups = (rows) => rows.reduce((n, row) => n + 1 + countGroups(row.children), 0)
  const countItems = (rows) => rows.reduce((n, row) => n + row.items.length + countItems(row.children), 0)
  const images = [...new Set(flat(groups).flatMap(row => row.items.map(item => item.imageURL)).filter(Boolean))].sort()
  // writeSync, not process.stdout.write: on macOS a write to a pipe is asynchronous,
  // and process.exit right after it would drop everything past the 64 KB pipe buffer
  writeSync(process.stdout.fd, JSON.stringify({ warnings, fetched, heroImage: pageTheme.heroImage, skeleton: skeleton(groups), rows: countGroups(groups), items: countItems(groups), images }))
  process.exit(0)
}

// ───────────────────────── names and helpers ─────────────────────────
const DINO_DIR = dirname(dirname(fileURLToPath(import.meta.url)))   // tools/.. = cyoa/DinoCYOA
const THIS_FILE = fileURLToPath(import.meta.url)                    // re-run as the --verify child
const ENGINE_DIR = join(DINO_DIR, 'engine')

export const MANIFEST = '.cyoa-export.json'   // the marker AND the manifest: a dotfile, so GitHub Pages (Jekyll) skips it; a plain file server may serve it — tooling metadata, harmless either way
export const TOOL = 'cyoa-export'             // the marker's tool name — the only folders this tool ever wipes carry it

// the server's exact on-disk format
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n'

// a refusal names the reason and, for the contract gate, every problem by path
export class ExportRefusal extends Error {
  constructor(message, problems = []) { super(message); this.name = 'ExportRefusal'; this.problems = problems }
}

// every regular file under dir, recursive, posix-relative, sorted — DOTFILES
// INCLUDED, so a stray .DS_Store in an export is visible to the oracle
export const listFiles = (dir) => {
  const out = []
  const walk = (rel) => readdirSync(join(dir, rel), { withFileTypes: true }).forEach(entry => {
    const path = posix.join(rel, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.isFile()) out.push(path)
  })
  walk('')
  return out.sort()
}

export const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

// child is strictly inside parent: the relative path exists, does not climb out, and is not absolute
const isInside = (child, parent) => {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}
const notDotfile = (src) => !basename(src).startsWith('.')   // the cpSync filter: Finder's .DS_Store stays home
const defaultSource = (game) => join(DINO_DIR, 'games', game)
const labelOf = (game, sourceDir) => sourceDir === defaultSource(game) ? `games/${game}` : sourceDir

// ───────────────────────── the gates, in order ─────────────────────────
// 1. read: the five files as TEXT — the published data is the committed bytes,
//    never a re-serialization. types/things may be absent (a pre-v3 game): null.
const readTexts = (sourceDir) => {
  if (!existsSync(join(sourceDir, 'data', 'content.json'))) throw new ExportRefusal(`no such game: ${sourceDir} has no data/content.json`)
  return Object.fromEntries(FILE_NAMES.map(name => {
    const path = join(sourceDir, 'data', `${name}.json`)
    return [name, existsSync(path) ? readFileSync(path, 'utf8') : null]
  }))
}
// a file that is not JSON is a refusal with the file's name, not a stack trace:
// the publisher never guesses at bytes it cannot read
const parseTexts = (texts, sourceDir) => Object.fromEntries(FILE_NAMES.map(name => {
  if (texts[name] === null) return [name, null]
  try { return [name, JSON.parse(texts[name])] }
  catch (error) { throw new ExportRefusal(`${sourceDir}/data/${name}.json is not valid JSON (${error.message})`) }
}))

// 2. version gate: migrateSet returns the SAME object when no step ran (the
//    oracles' B1/L12 pin that identity), so identity is the exact "already at
//    SCHEMA_VERSION" test — and the reason the copied bytes are the committed bytes.
const requireCurrentVersion = (set, label) => {
  let migrated
  try { migrated = migrateSet(set) }
  catch (error) {
    if (error.message.startsWith('Missing data files')) throw new ExportRefusal(`${error.message} — open the game in the editor and Save first`)
    throw error
  }
  if (migrated !== set) throw new ExportRefusal(`${label}/data is at version ${set.content.version}, not ${SCHEMA_VERSION} — open the game in the editor and Save first; the published data must be exactly what is committed`)
}

// 3. contract gate: the border's validator, then the one check only a tool
//    with a filesystem can make — every image the data names must be a file
//    in assets/. A browser would only ever report that as a broken picture.
const missingAssets = (set, sourceDir) => {
  const problems = []
  const assetsDir = join(sourceDir, 'assets')
  // the EXACT names on disk, case and all: macOS would find Dino.JPG for dino.jpg,
  // a Linux host would not — and a name a browser cannot even ask for ("#", "?",
  // "..", a leading slash) is refused before existence is a question
  const present = new Set(existsSync(assetsDir) ? listFiles(assetsDir) : [])
  const unrequestable = (name) => name.startsWith('/') || name.includes('#') || name.includes('?') || name.split('/').includes('..')
  const check = (path, name) => {
    if (name === '') return
    if (unrequestable(name)) problems.push({ path, message: `names a file that a browser cannot request (${name})` })
    else if (!present.has(name)) problems.push({ path, message: `names a file that is not in assets/ (${name})` })
  }
  Object.entries(set.things.things).forEach(([typeId, bucket]) =>
    bucket.forEach((thing, i) => check(`things.things[${JSON.stringify(typeId)}][${i}].imageURL`, thing.imageURL)))
  check('themes.page.heroImage', set.themes.page.heroImage)
  return problems
}
const requireContract = (set, sourceDir, label) => {
  const problems = validateSet(set)
  if (problems.length === 0) problems.push(...missingAssets(set, sourceDir))
  if (problems.length > 0) throw new ExportRefusal(`${label} does not fit the schema (${problems.length} problem${problems.length === 1 ? '' : 's'})`, problems)
}

// 4. out-dir guards: never the source game, never the project. dist/<game> is
//    inside DinoCYOA — allowed; DinoCYOA inside --out is not.
const guardOutDir = (outDir, sourceDir) => {
  const clash = outDir === sourceDir || isInside(outDir, sourceDir) || isInside(sourceDir, outDir)
             || outDir === DINO_DIR || isInside(DINO_DIR, outDir)
  if (clash) throw new ExportRefusal(`refusing to write ${outDir}: it is, contains, or is inside the source game folder / the DinoCYOA project folder`)
}

// 5. prepare: wipe only a folder that carries OUR marker (complete or not —
//    an interrupted export is ours), keep an empty one, refuse anything else.
const isOurs = (outDir) => {
  try { return JSON.parse(readFileSync(join(outDir, MANIFEST), 'utf8')).tool === TOOL }
  catch { return false }
}
const prepareOutDir = (outDir) => {
  if (existsSync(outDir)) {
    if (!statSync(outDir).isDirectory()) throw new ExportRefusal(`refusing to write ${outDir}: it exists and is not a folder`)
    if (isOurs(outDir)) rmSync(outDir, { recursive: true, force: true })
    else if (readdirSync(outDir).length > 0) throw new ExportRefusal(`refusing to wipe ${outDir}: it holds files and no ${MANIFEST} marker, so this tool did not write it — pick another --out or empty it yourself`)
  }
  mkdirSync(outDir, { recursive: true })
}

// 6 + 7. claim, then copy: the marker goes down before the first copied byte
const claim = (outDir, game) => writeFileSync(join(outDir, MANIFEST), serialize({ tool: TOOL, game, schemaVersion: SCHEMA_VERSION, complete: false }))
const copyGame = (outDir, sourceDir, texts) => {
  cpSync(ENGINE_DIR, outDir, { recursive: true, filter: notDotfile })   // the whole engine, validate.js included: harmless, verbatim
  mkdirSync(join(outDir, 'data'))
  FILE_NAMES.forEach(name => writeFileSync(join(outDir, 'data', `${name}.json`), texts[name]))
  const assets = join(sourceDir, 'assets')
  // dereference: a symlink travels as the FILE it points at — a copied link would
  // point back into the source folder (or nowhere) on the host
  if (existsSync(assets)) cpSync(assets, join(outDir, 'assets'), { recursive: true, dereference: true, filter: notDotfile })   // everything travels, ATTRIBUTION.txt too
}

// 8. verify: hydrate the working tree and the folder in two children and
//    compare. A failed verification removes the folder — it is this run's
//    (it was empty, new, or carried the marker) — and says so.
const runVerify = (engineDir, gameDir) =>
  JSON.parse(execFileSync(process.execPath, [THIS_FILE, '--verify', engineDir, gameDir], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))   // a big game's skeleton is big
const verifyExport = (outDir, sourceDir, label) => {
  try {
    const src = runVerify(ENGINE_DIR, sourceDir)
    const dist = runVerify(outDir, outDir)   // engine AND data from the folder itself
    assert.deepEqual(src.warnings, [], `${label} hydrates with warnings: ${src.warnings.join('; ')}`)
    assert.deepEqual(dist.warnings, [], `the folder hydrates with warnings: ${dist.warnings.join('; ')}`)
    assert.deepEqual(dist.skeleton, src.skeleton, 'the folder does not play like the working tree (rows or items differ)')
    dist.fetched.forEach(url => assert.ok(url.startsWith('data/'), `the engine asked for ${url} — not page-relative`))
    const files = new Set(listFiles(outDir))   // exact names, as a host would match them
    ;[...dist.images, dist.heroImage].filter(Boolean).forEach(rel => assert.ok(files.has(rel), `image file missing from the folder: ${rel}`))
    return dist
  } catch (error) {
    rmSync(outDir, { recursive: true, force: true })
    throw new ExportRefusal(`export verification failed — nothing left in ${outDir}; ${label} is untouched: ${error.message}`)
  }
}

// 9. manifest last: every file's size and sha256, in listFiles order. No
//    timestamp, no git hash — two identical exports must be identical.
const writeManifest = (outDir, game, dist) => {
  const files = Object.fromEntries(listFiles(outDir).filter(path => path !== MANIFEST)
    .map(path => [path, { bytes: statSync(join(outDir, path)).size, sha256: sha256(join(outDir, path)) }]))
  const manifest = { tool: TOOL, game, schemaVersion: SCHEMA_VERSION, complete: true, rows: dist.rows, items: dist.items, files }
  writeFileSync(join(outDir, MANIFEST), serialize(manifest))
  return manifest
}

// ───────────────────────── exportGame ─────────────────────────
// Synchronous; touches only outDir; throws ExportRefusal. The gates run in
// the order the header explains — the SOURCE is refused before outDir is read.
export const exportGame = ({ game, outDir = join(DINO_DIR, 'dist', game), sourceDir = defaultSource(game) }) => {
  outDir = resolve(outDir)
  sourceDir = resolve(sourceDir)
  const label = labelOf(game, sourceDir)
  const texts = readTexts(sourceDir)
  const set = parseTexts(texts, sourceDir)
  requireCurrentVersion(set, label)
  requireContract(set, sourceDir, label)
  guardOutDir(outDir, sourceDir)
  prepareOutDir(outDir)
  claim(outDir, game)
  copyGame(outDir, sourceDir, texts)
  const dist = verifyExport(outDir, sourceDir, label)
  const manifest = writeManifest(outDir, game, dist)
  return { outDir, manifest }
}

// ───────────────────────── the CLI ─────────────────────────
const formatSize = (bytes) => bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes >= 1e3 ? `${Math.round(bytes / 1e3)} kB` : `${bytes} B`
const line = (name, text) => `  ${name.padEnd(10)}${text}`
const countLine = (name, n, tail = '') => line(name, `${String(n).padStart(2)} files${tail}`)

// counts by prefix: data/, assets/, everything else is the engine
const report = (game, label, outDir, manifest) => {
  const entries = Object.entries(manifest.files)
  const data = entries.filter(([path]) => path.startsWith('data/'))
  const assets = entries.filter(([path]) => path.startsWith('assets/'))
  const engine = entries.length - data.length - assets.length
  const assetBytes = assets.reduce((sum, [, file]) => sum + file.bytes, 0)
  console.log(`${game} → ${outDir}`)
  console.log(countLine('engine', engine))
  console.log(countLine('data', data.length, `   schema version ${manifest.schemaVersion} · ${manifest.rows} rows · ${manifest.items} things`))
  console.log(countLine('assets', assets.length, `   ${formatSize(assetBytes)}`))
  console.log(line('manifest', `${MANIFEST} — sha256 of every file, no timestamp: a re-run is byte-identical`))
  console.log(`${'verified'.padEnd(12)}the folder hydrates like ${label} — 0 warnings, every image file present`)
  console.log(`${'preview'.padEnd(12)}python3 -m http.server 8000 --directory ${dirname(outDir)}   →   http://localhost:8000/${basename(outDir)}/   (a subpath on purpose: it proves the relative paths)`)
  console.log(`${'publish'.padEnd(12)}upload the folder as-is to any static host; it works from a subfolder too`)
}

const usage = () => {
  console.log('usage: node export.mjs <game> [--out <dir>] [--game-dir <dir>]')
  console.log('       node export.mjs --verify <engineDir> <gameDir>')
  process.exit(1)
}

// <game>, then --out and --game-dir in any order, each with exactly one value
const parseArgs = (argv) => {
  const [game, ...rest] = argv
  if (!game || game.startsWith('--')) usage()
  const options = {}
  for (let i = 0; i < rest.length; i += 2) {
    const key = { '--out': 'outDir', '--game-dir': 'sourceDir' }[rest[i]]
    if (!key || rest[i + 1] === undefined || key in options) usage()
    options[key] = rest[i + 1]
  }
  return { game, ...options }
}

const main = (argv) => {
  const options = parseArgs(argv)
  try {
    const { outDir, manifest } = exportGame(options)
    report(options.game, labelOf(options.game, resolve(options.sourceDir ?? defaultSource(options.game))), outDir, manifest)
  } catch (error) {
    if (!(error instanceof ExportRefusal)) throw error
    console.log(error.message)
    error.problems.forEach(problem => console.log(`  ${problemText(problem)}`))
    process.exit(2)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
