// NEW: publish a game as one static folder that plays from any subpath.
//
//   node cyoa/DinoCYOA/tools/export.mjs <game> [--out <dir>] [--game-dir <dir>] [--books-dir <dir>]
//     <game>       a folder under games/ (dino, vampire) — also the name in the manifest
//     --out        default: <DinoCYOA>/dist/<game>
//     --game-dir   default: <DinoCYOA>/games/<game>   (the oracle points it at scratch copies)
//     --books-dir  default: <DinoCYOA>/books          (CHANGED: the shelf the game's pins are read from)
//   node cyoa/DinoCYOA/tools/export.mjs --verify <engineDir> <gameDir> [<booksDir>]   child mode, prints ONE JSON object
//   exit 0 written · exit 1 usage · exit 2 refused (message, one "  path: message" line per problem, nothing written)
//
// The folder is engine/ verbatim (page-relative paths mean nothing is
// rewritten), the game's five data files, and assets/. What makes this a tool
// rather than a cp is the ORDER it works in — the safety rule:
//
//   read → version gate → the shelf → contract gate → out-dir guards
//     → wipe (marker or empty only) → claim → copy → verify in child processes → manifest last
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
// CHANGED: a game may now PIN BOOKS, and a published folder must never need the
// shelf — a player downloads one folder, not a library. So:
//
//   · the data written is the FLATTENED set (merge.js's flattenGame: every
//     pinned book's sheets, things and proposals folded into the game's own five
//     files, `books: []`, no `order` left to apply). The published engine then
//     takes exactly the path it took in v4 — five fetches and no shelf.
//   · a game that pins NOTHING still travels as its committed BYTES. Flattening
//     it would be a re-serialization of files that are already exactly right,
//     and "the published data is what is committed" is worth keeping for every
//     game with no shelf to fold in (oracle E2 — vampire).
//   · assets are the UNION of the game's folder and every pinned book's, in
//     layer order, copied into ONE assets/. The dev server resolves a bare
//     filename through that same search path; the folder has no search path, so
//     the union IS the search path, flattened once.
//
// The oracle imports exportGame, readBookSync and the helpers, and runs this
// file as a CLI to prove the exit codes. Imports come from engine/ only (the
// border's migrateSet, and merge.js's validateGame / flattenGame / orderBooks)
// — tools never reach into dinoEdit/ or server/.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, cpSync, copyFileSync, statSync, writeSync } from 'node:fs'
import { join, resolve, relative, dirname, basename, isAbsolute, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { migrateSet } from '../engine/config/migrations.js'
import { SCHEMA_VERSION, BOOK_FILES, isBookName, isEdition } from '../engine/config/schema.js'
import { problemText, FILE_NAMES } from '../engine/config/validate.js'
// CHANGED: the whole-set validator moved out of validate.js — judging a set means
// merging the layers under it, so it lives beside the merge now. validateGame is
// the general form (`books: []` is the old validateSet, exactly).
import { validateGame, flattenGame, orderBooks } from '../engine/config/merge.js'

// ───────────────────────── the --verify child ─────────────────────────
// Hydrates <gameDir>/data through <engineDir>'s real gameConfig.js and prints
// ONE JSON object on stdout — nothing else may reach stdout, because the parent
// JSON.parses it. A child process, because gameConfig.js does its loading at
// import time, once per process (and the oracle exports several times in one process).
// console.warn is captured: a warning is the engine failing closed on a dangle,
// and a published folder must have none. The fake fetch is the oracle's trick:
// the url is data/x.json (or /data/x.json — join accepts both), read from disk.
//
// CHANGED: the child may be handed a SHELF. The engine asks for a pinned book
// page-relative too — "books/<name>/<edition>/<file>.json", beside data/ — so a
// url under books/ is answered from <booksDir> and everything else from
// <gameDir>. With NO booksDir every book url is a 404, which is precisely what a
// published folder is: no shelf on disk, and (because its data is flattened)
// nothing that asks for one. Parent and child agree on that by construction —
// the source child is given the shelf, the dist child never is.
//
// CHANGED: the snapshot now also reports what the hydrated game BINDS, not only
// what it OFFERS — `playerSheet` (the type the player fills in) and, per row,
// `fills` (the section that row's picks land in). Both are ids, both `null` when
// there is none. Nothing new is asserted here: the parent already deep-equals the
// dist snapshot against the source one, so widening the snapshot widens that ONE
// existing check from "the folder shows the same items" to "the folder shows the
// same items AND records them in the same places". That matters because the two
// children read different data — the source child merges the shelf live, the dist
// child reads the flattened files — and `sheet`/`fills` are exactly the keys the
// flattening has to carry through (merge.js steps 10 and 11). If flattening ever
// dropped them, the folder would still LOOK right and every published sheet would
// come out empty; now the export refuses instead.
// `?.id ?? null`, not `.id`: a row that fills nothing has `fills: null` (every v5
// row, every vampire row), and an engine older than v6 has no `playerSheet` export
// at all, so undefined must land on the same `null` the new engine prints.
if (process.argv[2] === '--verify') {
  const [engineDir, gameDir, booksDir] = process.argv.slice(3)
  const warnings = []
  console.warn = (...parts) => warnings.push(parts.join(' '))
  const fetched = []
  const BOOKS = 'books/'
  globalThis.fetch = async (url) => {
    fetched.push(url)
    const rel = url.startsWith('/') ? url.slice(1) : url
    try {
      if (rel.startsWith(BOOKS) && booksDir === undefined) throw new Error('no shelf in this folder')
      const text = readFileSync(rel.startsWith(BOOKS) ? join(booksDir, rel.slice(BOOKS.length)) : join(gameDir, rel), 'utf8')
      return { ok: true, status: 200, json: async () => JSON.parse(text) }
    }
    catch { return { ok: false, status: 404, json: async () => { throw new Error(`404 ${url}`) } } }
  }
  const { groups, pageTheme, playerSheet } = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const skeleton = (rows) => rows.map(row => ({ id: row.id, fills: row.fills?.id ?? null, items: row.items.map(item => item.id), children: skeleton(row.children) }))
  const flat = (rows) => rows.flatMap(row => [row, ...flat(row.children)])
  const countGroups = (rows) => rows.reduce((n, row) => n + 1 + countGroups(row.children), 0)
  const countItems = (rows) => rows.reduce((n, row) => n + row.items.length + countItems(row.children), 0)
  const images = [...new Set(flat(groups).flatMap(row => row.items.map(item => item.imageURL)).filter(Boolean))].sort()
  // writeSync, not process.stdout.write: on macOS a write to a pipe is asynchronous,
  // and process.exit right after it would drop everything past the 64 KB pipe buffer
  writeSync(process.stdout.fd, JSON.stringify({ warnings, fetched, heroImage: pageTheme.heroImage, playerSheet: playerSheet?.id ?? null, skeleton: skeleton(groups), rows: countGroups(groups), items: countItems(groups), images }))
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
const defaultBooks = () => join(DINO_DIR, 'books')
const labelOf = (game, sourceDir) => sourceDir === defaultSource(game) ? `games/${game}` : sourceDir
// NEW: how a BOOK's folder is NAMED in a message — the repo-relative path when
// the shelf is the repo's own, the full path when it is a scratch one. The same
// rule labelOf keeps for the game: a refusal must name a path the reader can go
// and look at.
const bookLabelOf = (booksDir, pin, ...rest) => booksDir === defaultBooks()
  ? posix.join('books', String(pin.name), String(pin.edition), ...rest)
  : join(booksDir, String(pin.name), String(pin.edition), ...rest)
// one book's assets/ as the union below wants it: where to read, and what to
// call it in a message
const bookAssets = (booksDir, pin) => ({ dir: join(booksDir, pin.name, String(pin.edition), 'assets'), label: bookLabelOf(booksDir, pin, 'assets') })

// ───────────────────────── the shelf ─────────────────────────
// NEW: one pinned book, read from the shelf — the SYNCHRONOUS twin of the
// server's readBook (which is async because it is behind an HTTP route) and of
// the engine's loadBook (which is async because it is behind fetch). A tool has
// a filesystem and nothing to wait for, so it reads straight through; the
// rebuild script and the oracles import THIS one, so the shelf's layout is
// spelled out in exactly two places, not five.
//
// The layer is { pin, manifest, types, things, proposals } — the shape merge.js
// eats — and it keeps loadBook's three rules:
//   1. a pin whose name or edition fails the grammar never touches the disk.
//      The grammar is the guard (as it is for game names): "../../etc" is not a
//      book name, so it is not a path either.
//   2. no folder, or no book.json → the WHOLE layer is null. A loader never
//      throws for a missing book and never invents half of one; naming the pin
//      is the caller's job (the merge calls it fault F1, this tool refuses).
//   3. the three data files are OPTIONAL (absent → null: "this book has none of
//      that" — Basic and Stats ship only book.json + types.json). A file that IS
//      there and is not JSON is a broken shelf: a refusal by name, never a
//      stack trace. Book files are never migrated — a book is born at the
//      current version and an edition is never edited.
export const readBookSync = (booksDir, pin) => {
  if (!isBookName(pin?.name) || !isEdition(pin?.edition)) return null
  const dir = join(booksDir, pin.name, String(pin.edition))
  const read = (file) => {
    const path = join(dir, `${file}.json`)
    if (!existsSync(path)) return null
    try { return JSON.parse(readFileSync(path, 'utf8')) }
    catch (error) { throw new ExportRefusal(`${bookLabelOf(booksDir, pin, `${file}.json`)} is not valid JSON (${error.message})`) }
  }
  const manifest = read('book')
  if (manifest === null) return null
  return { pin: { name: pin.name, edition: pin.edition }, manifest, ...Object.fromEntries(BOOK_FILES.map(file => [file, read(file)])) }
}

// The pins a game writes, rebuilt key by key (§2.8: name, edition) — the manifest
// prints these, and a hand-edited content.json that is not an array of pins is
// simply no pins here: the contract gate below says so properly.
const pinsOf = (set) => (Array.isArray(set.content?.books) ? set.content.books : []).map(pin => ({ name: pin?.name, edition: pin?.edition }))

// Every pinned book, loaded. A pin the shelf cannot answer is a REFUSAL, not a
// fault: the merge would skip that book and flatten a smaller game, and
// publishing a game that quietly lost a row is the one thing this tool exists to
// prevent. (The engine and the editor do skip it — they are showing you a
// broken game so you can fix it. The export is the last gate before strangers.)
const readShelf = (booksDir, pins, label) => {
  const books = pins.map(pin => readBookSync(booksDir, pin))
  const missing = pins.filter((pin, i) => books[i] === null).map(pin => `${pin.name} ${pin.edition}`)
  if (missing.length > 0) throw new ExportRefusal(`${label} pins a book that is not on the shelf: ${missing.join(', ')}`)
  return books
}

// ───────────────────────── the gates, in order ─────────────────────────
// 1. read: the five files as TEXT — a book-less game's published data is the
//    committed bytes, never a re-serialization. types/things may be absent (a
//    pre-v3 game): null.
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
//    SCHEMA_VERSION" test — and the reason a book-less game's copied bytes are
//    the committed bytes. It also runs BEFORE the pins are read: `content.books`
//    is a v5 key, so an old game is refused by version, not by a missing key.
const requireCurrentVersion = (set, label) => {
  let migrated
  try { migrated = migrateSet(set) }
  catch (error) {
    if (error.message.startsWith('Missing data files')) throw new ExportRefusal(`${error.message} — open the game in the editor and Save first`)
    throw error
  }
  if (migrated !== set) throw new ExportRefusal(`${label}/data is at version ${set.content.version}, not ${SCHEMA_VERSION} — open the game in the editor and Save first; the published data must be exactly what is committed`)
}

// 3a. the asset search path, flattened. NEW: the engine asks for a bare
//     "assets/<name>" and the dev server looks for that name in the game's own
//     assets/ first, then each pinned book's in LAYER order. The published
//     folder holds one assets/, so the union is built here, first layer wins —
//     and the two ways a union can lie are both refused rather than guessed:
//       · the same name in two layers with the SAME bytes is one file, copied
//         once (the four gear images live in Dinosaur Age AND in the dino
//         game's own folder — WP-D copied them, deliberately, byte for byte)
//       · the same name with DIFFERENT bytes is a question only the author can
//         answer. Picking one silently would publish a folder in which a book's
//         picture is not the book's picture.
const assetFiles = (dir) => {
  const out = []
  const walk = (rel) => readdirSync(join(dir, rel), { withFileTypes: true }).forEach(entry => {
    if (entry.name.startsWith('.')) return                                        // Finder's .DS_Store (and any dot-folder) stays home
    const path = posix.join(rel, entry.name)
    // statSync FOLLOWS a symlink, which is the dereference rule this replaces: a
    // link travels as the file it points at, because a copied link would point
    // back into the source folder (or nowhere) on somebody else's host. A
    // dangling link is neither file nor folder, so it is nothing.
    const stat = statSync(join(dir, path), { throwIfNoEntry: false })
    if (stat?.isDirectory()) walk(path)
    else if (stat?.isFile()) out.push(path)
  })
  if (existsSync(dir)) walk('')
  return out.sort()
}
const assetUnion = (sources) => {
  const present = new Map()   // name → { from, label } — insertion order IS layer order, so the copy is deterministic
  const problems = []
  sources.forEach(({ dir, label }) => assetFiles(dir).forEach(name => {
    const from = join(dir, name)
    const first = present.get(name)
    if (first === undefined) present.set(name, { from, label })
    else if (sha256(first.from) !== sha256(from)) problems.push({ path: posix.join('assets', name), message: `is in ${first.label} and in ${label} with different bytes — rename one` })
  }))
  return { present, problems }
}

// 3b. contract gate: the border's validator over the game AND the layers under
//     it (a merge fault — a pin whose book disagrees with its folder, a
//     duplicate id, two books proposing different budgets — is a problem here
//     like any other, with its own path), then the one check only a tool with a
//     filesystem can make: every image the MERGED data names must be a file
//     somewhere on the search path. A browser would only ever report that as a
//     broken picture.
const missingAssets = (set, present) => {
  const problems = []
  // the EXACT names on disk, case and all: macOS would find Dino.JPG for dino.jpg,
  // a Linux host would not — and a name a browser cannot even ask for ("#", "?",
  // "..", a leading slash) is refused before existence is a question
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
const refuseProblems = (label, problems) => {
  if (problems.length > 0) throw new ExportRefusal(`${label} does not fit the schema (${problems.length} problem${problems.length === 1 ? '' : 's'})`, problems)
}

// 4. out-dir guards: never the source game, never the shelf, never the project.
//    dist/<game> is inside DinoCYOA — allowed; DinoCYOA inside --out is not.
//    CHANGED: the shelf joins the list. `books/` is inside DinoCYOA and so was
//    already covered there, but a SCRATCH shelf is not — and the rule "no tool
//    ever writes under a books folder" should be enforced by the rule, not by
//    where the folder happens to sit.
const guardOutDir = (outDir, sourceDir, booksDir) => {
  const clash = outDir === sourceDir || isInside(outDir, sourceDir) || isInside(sourceDir, outDir)
             || outDir === booksDir || isInside(outDir, booksDir) || isInside(booksDir, outDir)
             || outDir === DINO_DIR || isInside(DINO_DIR, outDir)
  if (clash) throw new ExportRefusal(`refusing to write ${outDir}: it is, contains, or is inside the source game folder / the books folder / the DinoCYOA project folder`)
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
const claim = (outDir, game, books) => writeFileSync(join(outDir, MANIFEST), serialize({ tool: TOOL, game, schemaVersion: SCHEMA_VERSION, books, complete: false }))
// `merged` is the flattened set for a game with pins, and null for a book-less
// one — the one place the two kinds of game differ on disk. Everything else (the
// engine, the folder shape, the assets) is identical, which is the point: a
// player cannot tell whether the game they downloaded was built on books.
const copyGame = (outDir, texts, merged, assets) => {
  cpSync(ENGINE_DIR, outDir, { recursive: true, filter: notDotfile })   // the whole engine, merge.js and validate.js included: harmless, verbatim
  mkdirSync(join(outDir, 'data'))
  FILE_NAMES.forEach(name => writeFileSync(join(outDir, 'data', `${name}.json`), merged === null ? texts[name] : serialize(merged[name])))
  assets.forEach(({ from }, name) => {
    const to = join(outDir, 'assets', name)
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)   // reads through a symlink: the BYTES travel, never the link — and ATTRIBUTION.txt travels like any other file
  })
}

// 8. verify: hydrate the working tree and the folder in two children and
//    compare. A failed verification removes the folder — it is this run's
//    (it was empty, new, or carried the marker) — and says so.
//    CHANGED: the SOURCE child is given the shelf (it is playing the live,
//    merged game); the DIST child is given none. So the skeletons matching is
//    the claim this whole file makes, checked rather than asserted: the
//    flattened folder plays exactly what the merge plays.
//    CHANGED: "plays" now includes "records". The skeleton carries each row's
//    `fills`, so the existing comparison covers the bindings too; the sheet the
//    game declares gets its own line, because it is one value for the whole game
//    rather than one per row and deserves its own sentence when it goes wrong.
const runVerify = (engineDir, gameDir, booksDir) =>
  JSON.parse(execFileSync(process.execPath, [THIS_FILE, '--verify', engineDir, gameDir, ...(booksDir === undefined ? [] : [booksDir])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))   // a big game's skeleton is big
const verifyExport = (outDir, sourceDir, booksDir, label) => {
  try {
    const src = runVerify(ENGINE_DIR, sourceDir, booksDir)
    const dist = runVerify(outDir, outDir)   // engine AND data from the folder itself, and no shelf anywhere
    assert.deepEqual(src.warnings, [], `${label} hydrates with warnings: ${src.warnings.join('; ')}`)
    assert.deepEqual(dist.warnings, [], `the folder hydrates with warnings: ${dist.warnings.join('; ')}`)
    assert.equal(dist.playerSheet, src.playerSheet, `the folder builds a different sheet: ${dist.playerSheet} rather than ${src.playerSheet}`)
    assert.deepEqual(dist.skeleton, src.skeleton, 'the folder does not play like the working tree (rows, items or bindings differ)')
    dist.fetched.forEach(url => assert.ok(url.startsWith('data/'), `the engine asked for ${url} — not page-relative, or the folder still wants the shelf`))
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
//    CHANGED: `books` after `schemaVersion` — the folder no longer needs the
//    shelf, so this list is the only record of what was folded into it.
const writeManifest = (outDir, game, books, dist) => {
  const files = Object.fromEntries(listFiles(outDir).filter(path => path !== MANIFEST)
    .map(path => [path, { bytes: statSync(join(outDir, path)).size, sha256: sha256(join(outDir, path)) }]))
  const manifest = { tool: TOOL, game, schemaVersion: SCHEMA_VERSION, books, complete: true, rows: dist.rows, items: dist.items, files }
  writeFileSync(join(outDir, MANIFEST), serialize(manifest))
  return manifest
}

// ───────────────────────── exportGame ─────────────────────────
// Synchronous; touches only outDir; throws ExportRefusal. The gates run in
// the order the header explains — the SOURCE and the SHELF are refused before
// outDir is read.
export const exportGame = ({ game, outDir = join(DINO_DIR, 'dist', game), sourceDir = defaultSource(game), booksDir = defaultBooks() }) => {
  outDir = resolve(outDir)
  sourceDir = resolve(sourceDir)
  booksDir = resolve(booksDir)
  const label = labelOf(game, sourceDir)
  const texts = readTexts(sourceDir)
  const set = parseTexts(texts, sourceDir)
  requireCurrentVersion(set, label)

  const pins = pinsOf(set)
  const books = readShelf(booksDir, pins, label)
  refuseProblems(label, validateGame({ own: set, books }))
  // The set the folder will hold. Nothing merged badly — validateGame just said
  // so — so `ordered` here is the layer order with nobody skipped, which is the
  // order the asset search path uses.
  const merged = flattenGame({ books, game: set })
  const assets = assetUnion([
    { dir: join(sourceDir, 'assets'), label: `${label}/assets` },
    ...orderBooks(books).ordered.map(book => bookAssets(booksDir, book.pin))
  ])
  refuseProblems(label, [...assets.problems, ...missingAssets(merged, assets.present)])

  guardOutDir(outDir, sourceDir, booksDir)
  prepareOutDir(outDir)
  claim(outDir, game, pins)
  copyGame(outDir, texts, pins.length === 0 ? null : merged, assets.present)
  const dist = verifyExport(outDir, sourceDir, booksDir, label)   // the source child always gets the shelf; a book-less game simply never asks
  const manifest = writeManifest(outDir, game, pins, dist)
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
  if (manifest.books.length > 0) console.log(line('books', `${manifest.books.map(pin => `${pin.name} ${pin.edition}`).join(', ')} — folded in; the folder needs no shelf`))
  console.log(line('manifest', `${MANIFEST} — sha256 of every file, no timestamp: a re-run is byte-identical`))
  console.log(`${'verified'.padEnd(12)}the folder hydrates like ${label} — 0 warnings, every image file present`)
  console.log(`${'preview'.padEnd(12)}python3 -m http.server 8000 --directory ${dirname(outDir)}   →   http://localhost:8000/${basename(outDir)}/   (a subpath on purpose: it proves the relative paths)`)
  console.log(`${'publish'.padEnd(12)}upload the folder as-is to any static host; it works from a subfolder too`)
}

const usage = () => {
  console.log('usage: node export.mjs <game> [--out <dir>] [--game-dir <dir>] [--books-dir <dir>]')
  console.log('       node export.mjs --verify <engineDir> <gameDir> [<booksDir>]')
  process.exit(1)
}

// <game>, then --out, --game-dir and --books-dir in any order, each with exactly one value
const parseArgs = (argv) => {
  const [game, ...rest] = argv
  if (!game || game.startsWith('--')) usage()
  const options = {}
  for (let i = 0; i < rest.length; i += 2) {
    const key = { '--out': 'outDir', '--game-dir': 'sourceDir', '--books-dir': 'booksDir' }[rest[i]]
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
