// NEW: everything the server knows about the games FOLDER, as plain functions
// over a root directory: names, the list, the seed, the claim. No HTTP in here —
// server.js turns these answers into receipts. The oracles import this file
// directly for the pure parts (N2, N3) and then prove the same answers over
// HTTP (M1–M9). Imports come from engine/config (the contract) and the export
// tool's two constants (the marker it writes), never from dinoEdit/.
import { readdir, readFile, mkdir, writeFile, rm } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { FILE_SHEETS } from "../engine/config/schema.js"
import { FILE_NAMES, problemText } from "../engine/config/validate.js"
// CHANGED: validateSet moved to merge.js (judging a set needs the merge, and
// merge.js already imports validate.js — the other direction would be a cycle).
// NEW: mergeLayers/validateGame, because a game is the LAST LAYER of a stack now:
// the facts count what PLAYS, and the seed is checked against the books it pins.
import { mergeLayers, validateGame } from "../engine/config/merge.js"
// NEW: the shelf as functions (books.js). It never imports this file back.
// CHANGED (stage 4): pinsOf comes with it — the freeze census below reads a game's
// pins, and books.js already had the one reader of them (the asset search path).
import { readBooks, pinsOf } from "./books.js"
// CHANGED (stage 4): the name/title grammar and the seed walk moved to two neutral
// modules, because a BOOK author needs both and books.js may never import this file.
// Nothing about either changed — see names.js's and seed.js's headers.
import { isGameName, slugOf } from "./names.js"
import { serialize, seedFrom } from "./seed.js"
// export.mjs runs its CLI only when it is argv[1] and its --verify child only when
// argv[2] says so — importing it runs nothing (the oracles have imported it since v4)
import { MANIFEST, TOOL } from "../tools/export.mjs"

// ───────────── names ─────────────
// CHANGED (stage 4): MOVED to ./names.js, unchanged, and re-exported from here so
// every importer that already reads them from this path — oracle N2 pins
// BOOK_NAME.source === NAME.source from here — keeps reading the same objects. The
// move is the whole point: these are the SHELF's rules too, and the shelf may not
// import this file.
export { NAME, NAME_MAX, RESERVED, isGameName, slugOf, titleProblems } from "./names.js"

// a game exists when its folder holds data/content.json — the same test the
// export tool makes (readTexts). A name the grammar refuses never reaches join().
export const gameExists = (gamesDir, name) => isGameName(name) && existsSync(join(gamesDir, name, "data", "content.json"))

// ───────────── the seed: a newborn set, read from the sheets ─────────────
// CHANGED (stage 4): bornFrom and the walk itself MOVED to ./seed.js so a book can be
// seeded by the same walk (books.js may not import this file). Nothing about the walk
// changed; `seedFile` is now the one line that says WHICH table a GAME is born from.
const seedFile = (name) => seedFrom(FILE_SHEETS, name)
// CHANGED: a newborn may be born ON BOOKS. `pins` lands in content.books (whose
// own default is [], so a book-less newborn is exactly what v4's was), and the
// key keeps the place seedFile gave it — assigning to a key that is already there
// never moves it, so the canonical order survives.
export const seedSet = (title, pins = []) => {
  const set = Object.fromEntries(FILE_NAMES.map(name => [name, seedFile(name)]))
  set.content.meta.pageTitle = title   // the ONE value the author gave —
  set.content.meta.heroTitle = title   // and the banner too, so the first Play is not blank
  set.content.books = structuredClone(pins)
  return set
}

// ───────────── listing ─────────────
const countRows = (rows) => rows.reduce((n, row) => n + 1 + countRows(row.children ?? []), 0)   // ?? []: a v1 row has no children
const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"))

// the cheap facts the home screen shows for one FOLDER under games/ — what is
// on disk, read fresh. A folder that is not a game is still listed, with its
// problem instead of facts: the author should see the folder they made.
// CHANGED: the counts are the MERGED ones. A game is the last layer of a stack
// now, so "17 things" means seventeen things a player can see — the game's own
// plus every pinned book's — and `books`/`faults` say which shelves that came
// from and whether anything on the way is broken. Counting content.json alone
// would tell the home screen a story no player would recognise.
export const gameFacts = async (gamesDir, distDir, booksDir, name) => {
  if (!isGameName(name)) return { name, error: "folder name must be lowercase letters, digits and single dashes — rename the folder" }
  const data = join(gamesDir, name, "data")
  let content
  try { content = await readJSON(join(data, "content.json")) }
  catch (error) { return { name, error: `data/content.json cannot be read (${error.code ?? error.message})` } }
  const optional = async (file) => { try { return await readJSON(join(data, `${file}.json`)) } catch (error) { if (error.code === "ENOENT") return null; throw error } }
  const own = { content, rules: await optional("rules"), themes: await optional("themes"), types: await optional("types"), things: await optional("things") }   // types/things absent before v3
  // NEW: the pinned books, read fresh like everything else here. A pin that
  // loads nothing stays a null LAYER on purpose — the merge turns it into F1, so
  // "this game pins a book that is not on the shelf" reaches the home screen as
  // faults > 0 instead of as a crash or a silent zero.
  const pins  = Array.isArray(content.books) ? content.books : []
  const books = await readBooks(booksDir, pins).catch(() => pins.map(() => null))   // a book file that is not JSON: same answer, loudly counted
  let merged = null
  try { merged = mergeLayers({ books, game: own }) } catch { /* a set too old or too broken to merge: null counts below, as before v3 */ }
  let exported = false
  try { const manifest = await readJSON(join(distDir, name, MANIFEST)); exported = manifest.tool === TOOL && manifest.complete === true }
  catch { /* never exported, or not by our tool: false */ }
  return {
    name,
    title:    content.meta?.pageTitle ?? "",
    version:  content.version ?? null,
    books:    merged ? merged.order : null,                              // ["basic 1", …] — the layer order, the books that SURVIVED
    rows:     merged ? countRows(merged.set.content.groups) : null,
    types:    merged ? merged.set.types.types.length : null,
    things:   merged ? Object.values(merged.set.things.things).reduce((n, bucket) => n + bucket.length, 0) : null,
    faults:   merged ? merged.faults.length : null,
    exported
  }
}
// every folder under games/, dotfiles skipped, sorted — the listing AND the census
// walk the same folders, so a game the home screen shows is a game the freeze counts
const gameFolders = async (gamesDir) => {
  let entries
  try { entries = await readdir(gamesDir, { withFileTypes: true }) }
  catch (error) { if (error.code === "ENOENT") return []; throw error }   // no games folder yet = no games yet
  return entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".")).map(entry => entry.name).sort()
}
export const listGames = async (gamesDir, distDir, booksDir) =>
  Promise.all((await gameFolders(gamesDir)).map(name => gameFacts(gamesDir, distDir, booksDir, name)))

// ───────────── the freeze census ─────────────
// NEW (stage 4): WHO PINS THIS BOOK. Freezing is "frozen once a game pins it", so
// every book-mutating route asks this before it writes, and the answer is the subject
// of the sentence it refuses with.
//
// IT LIVES HERE, and not in books.js, for one hard reason and one soft one. The hard
// one: books.js may never import this file (this file imports books.js — see the
// header), and the question reads every game's content.json. The soft one: this file
// already reads every game's pins to draw the home cards, so the census is the walk
// listGames does, asked a different question. The shelf half of every refusal is the
// caller's — books.js writes the sentences, because "frozen", "edition" and "cut" are
// the shelf's words; what comes back from here is only the FACTS.
//
// A pin is reported EXACTLY as the game wrote it, junk included. Judging it here would
// be a second opinion on a shape validateFile already has a sentence for, and it would
// fail OPEN: a game pinning `{ name: "basic", edition: "1" }` is a broken game, but it
// is still a game that names this book, and delete must still refuse.
const everyPin = async (gamesDir) => {
  const rows = []
  for (const game of await gameFolders(gamesDir))
    for (const pin of await pinsOf(gamesDir, game))
      if (pin !== null && typeof pin === "object") rows.push({ game, name: pin.name, edition: pin.edition })
  return rows
}

// the games pinning ONE edition — [{ game, name, edition }], empty means it is free to
// edit. The edition is compared exactly: a pin whose edition is not the number this
// folder is named for does not name this edition at all.
export const pinnedBy = async (gamesDir, name, edition) =>
  (await everyPin(gamesDir)).filter(pin => pin.name === name && pin.edition === edition)

// the games pinning ANY edition of one book, each with the edition it names — what
// "delete the whole book" must refuse on, and what its sentence lists. Matched on the
// NAME alone, so a pin with a mangled edition still counts as a claim on this book.
export const pinnedByAnyEdition = async (gamesDir, name) =>
  (await everyPin(gamesDir)).filter(pin => pin.name === name)

// ───────────── creating ─────────────
// The seed is built and CHECKED before anything is touched (a seed that does not
// fit is a bug in the sheets: a loud throw, never a quiet write). mkdir WITHOUT
// recursive is the existence check and the claim in one step: two "Create"
// clicks in the same instant cannot both pass an existsSync and both write —
// EEXIST is the caller's 409. Anything that fails AFTER the claim (a full disk)
// takes the half-made folder with it: a refusal or a failure leaves nothing behind.
// CHANGED: `pins` are what the newborn pins; `books` are those pins ALREADY READ
// off the shelf by the caller (server.js reads them to refuse a pin that is not
// there, and hands the layers on rather than reading the same folders twice).
// The seed is judged with them, so a newborn is checked exactly the way every
// later save is: against the books it stands on.
export const createGame = async (gamesDir, name, title, pins = [], books = []) => {
  const set = seedSet(title, pins)
  const problems = validateGame({ own: set, books })
  if (problems.length > 0) throw new Error(`the newborn set does not fit the schema: ${problems.map(problemText).join("; ")}`)
  await mkdir(gamesDir, { recursive: true })   // the root itself may be new (a scratch root)
  const dir = join(gamesDir, name)
  await mkdir(dir)                             // EEXIST → 409 in server.js
  try {
    await mkdir(join(dir, "data"))
    await mkdir(join(dir, "assets"))
    for (const file of FILE_NAMES) await writeFile(join(dir, "data", `${file}.json`), serialize(set[file]))
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
}
