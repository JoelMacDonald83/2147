// NEW: everything the server knows about the SHELF, as plain functions over a
// books root — the twin of games.js, which does the same for the games folder.
// No HTTP in here: server.js turns these answers into files and receipts.
//
// One rule shapes the whole file: the shelf is READ-ONLY. Nothing here writes,
// renames or deletes; there is no route that could. A book is published once and
// then never edited — a change is a new edition folder — so the server's only
// jobs are to hand a book's bytes to the engine, to load the layers the merge
// needs, and to tell the Library what is on the shelf and what is wrong with it.
//
// Imports come from engine/config (the contract and the merge), never from
// server/games.js — games.js imports THIS file (its facts count the merged set),
// and two files that import each other are a knot nobody can read.
import { readdir, readFile } from "fs/promises"
import { statSync } from "fs"
import { join, sep } from "path"
import { isBookName, isEdition, BOOK_FILES } from "../engine/config/schema.js"
import { validateFile } from "../engine/config/validate.js"
import { emptyGame, orderBooks, validateBook } from "../engine/config/merge.js"

// ───────────── names ─────────────
// A book lives at books/<name>/<edition>/. The NAME obeys the shelf's grammar
// (schema.js's BOOK_NAME — the same regex as games.js's NAME, written there so
// engine/config never imports server/; oracle N2 pins the two equal). The
// EDITION is a folder and a URL SEGMENT: digits, no leading zero, so "1" names a
// book and "01" is a typo rather than a second way to spell the same shelf.
// schema.js's isEdition judges the NUMBER a pin carries; isEditionName judges the
// STRING a folder or a url carries. The two can never disagree about a folder,
// because only one spelling of each number is a legal folder name.
export const EDITION = /^[1-9][0-9]*$/
export const isEditionName = (s) => typeof s === "string" && EDITION.test(s)

export const bookDir = (booksDir, name, edition) => join(booksDir, name, String(edition))

// The absolute path for /books/<name>/<edition>/<rest>, or null when the grammar
// refuses the name or the edition, or nothing is named after them. `rest` arrives
// with its leading slash ("/types.json", "/assets/cannon.jpg"); undefined and "/"
// are the index forms and the shelf has no index — a folder listing is not a
// book. A ".." further along is NOT judged here: the caller draws that line with
// the same root + sep guard every other drawer uses, so an escape is the 403 it
// has always been rather than a quiet 404.
export const bookFile = (booksDir, name, edition, rest) =>
  isBookName(name) && isEditionName(String(edition)) && typeof rest === "string" && rest.length > 1
    ? join(bookDir(booksDir, name, edition), rest)
    : null

// ───────────── reading ─────────────
// The border, in one function. A file that is not there is null — every data file
// of a book is optional (Basic and Stats ship only book.json + types.json), and
// absent means "this book has none of that", not "something went wrong". A file
// that IS there but is not JSON THROWS: the shelf is broken, and a broken shelf
// must be said out loud (a 500 receipt, a listed error) rather than quietly read
// as an empty book that makes every id in it vanish.
const readJSON = async (path, label) => {
  let text
  try { text = await readFile(path, "utf8") }
  catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return null; throw error }
  try { return JSON.parse(text) }
  catch (error) { throw new Error(`${label} is not valid JSON (${error.message})`) }
}

// One pinned book as the merge wants it: { pin, manifest, types, things,
// proposals } with each data file null when it is not on disk. No book.json = no
// book: the whole layer is null and the MERGE names the pin (F1) — a loader that
// threw here would turn "you pin a book that is not on the shelf" into a 500.
// The grammar is the guard: a pin whose name or edition the grammar refuses never
// reaches join(), exactly as a game name never does.
export const readBook = async (booksDir, pin) => {
  if (!isBookName(pin?.name) || !isEdition(pin?.edition)) return null
  const dir  = bookDir(booksDir, pin.name, pin.edition)
  const shelfPath = (file) => `books/${pin.name}/${pin.edition}/${file}`
  const manifest = await readJSON(join(dir, "book.json"), shelfPath("book.json"))
  if (manifest === null) return null
  const [types, things, proposals] = await Promise.all(
    BOOK_FILES.map(file => readJSON(join(dir, `${file}.json`), shelfPath(`${file}.json`))))
  return { pin: { name: pin.name, edition: pin.edition }, manifest, types, things, proposals }
}

// the layers of a whole pin list, in pin order (the merge computes the LAYER
// order itself, from `requires`), with a null wherever a pin found nothing
export const readBooks = (booksDir, pins) => Promise.all((pins ?? []).map(pin => readBook(booksDir, pin)))

// every folder under a root, dotfiles skipped, sorted — the shelf's own listing
const folders = async (dir) => {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) }
  catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return []; throw error }   // no shelf yet = no books yet
  return entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".")).map(entry => entry.name).sort()
}
// the edition folders of one book: the ones that ARE editions first, in number
// order (2 after 1, and 10 after 2 — a string sort would not), then whatever else
// is in there by name, so the Library can show the author their misnamed folder.
const editionFolders = async (booksDir, name) => (await folders(join(booksDir, name))).sort((a, b) =>
  isEditionName(a) && isEditionName(b) ? Number(a) - Number(b)
    : isEditionName(a) ? -1 : isEditionName(b) ? 1 : a.localeCompare(b))

// { [name]: { [edition]: layer } } — what validateBook needs to find a book's
// requires. An edition that cannot be read is simply not on the shelf: it is
// unusable as a requirement, and listBooks reports it as its own problem below.
export const shelfOf = async (booksDir) => {
  const shelf = {}
  for (const name of await folders(booksDir)) {
    if (!isBookName(name)) continue
    for (const folder of await editionFolders(booksDir, name)) {
      if (!isEditionName(folder)) continue
      const layer = await readBook(booksDir, { name, edition: Number(folder) }).catch(() => null)
      if (layer !== null) (shelf[name] ??= {})[folder] = layer
    }
  }
  return shelf
}

// the largest edition folder whose book.json reads, or null — "the current one",
// which is what a new game pins and what the Books tab offers as an upgrade
export const latestEdition = async (booksDir, name) => {
  const editions = (await editionFolders(booksDir, name)).filter(isEditionName)
  for (const folder of editions.reverse()) {
    const layer = await readBook(booksDir, { name, edition: Number(folder) }).catch(() => null)
    if (layer !== null) return Number(folder)
  }
  return null
}

// ───────────── the listing ─────────────
const countRows = (rows) => (rows ?? []).reduce((n, row) => n + 1 + countRows(row.children ?? []), 0)
const countIn   = (buckets) => Object.values(buckets ?? {}).reduce((n, bucket) => n + (Array.isArray(bucket) ? bucket.length : 0), 0)

// The facts of ONE edition folder — what it holds, and what is wrong with it.
// `problems` is validateBook's own list ({ path, message }, the merge faults
// carried under books["<name>"].), so the Library prints the same sentence the
// editor's banner and the server's refusal print. Counts are the book's OWN
// contributions, not the merged world: "Stats adds 5 fields" is the fact an
// author picking books off a shelf wants.
const editionFacts = async (booksDir, shelf, name, folder) => {
  if (!isEditionName(folder)) return { edition: folder, error: "edition folders are positive integers — rename the folder" }
  const edition = Number(folder)
  let layer
  try { layer = await readBook(booksDir, { name, edition }) }
  catch (error) { return { edition, error: error.message } }                      // a file that is not JSON says so, by name
  if (layer === null) return { edition, error: "book.json cannot be read (ENOENT)" }
  const manifest = layer.manifest ?? {}
  return {
    edition,
    title:         typeof manifest.title === "string" ? manifest.title : "",
    requires:      Array.isArray(manifest.requires) ? manifest.requires : [],
    sheets:        layer.types?.types?.length ?? 0,
    sectionsAdded: countIn(layer.types?.sectionsFor),
    fieldsAdded:   countIn(layer.types?.fieldsFor),
    things:        countIn(layer.things?.things),
    rows:          countRows(layer.proposals?.groups),
    budget:        layer.proposals?.totalBudget ?? null,
    problems:      validateBook(layer, shelf)
  }
}

// EVERY folder under the shelf is listed — a folder the author made is a folder
// the author should see, with its problem instead of its facts if that is all it
// has. The book's own `title` is the latest readable edition's: the shelf shows
// the current name of a thing whose earlier editions may have been called
// something else.
const bookFacts = async (booksDir, shelf, name) => {
  if (!isBookName(name)) return { name, error: "folder name must be lowercase letters, digits and single dashes — rename the folder" }
  const editions = []
  for (const folder of await editionFolders(booksDir, name)) editions.push(await editionFacts(booksDir, shelf, name, folder))
  const newest = [...editions].reverse().find(edition => edition.title !== undefined)
  return { name, title: newest?.title ?? "", editions }
}

export const listBooks = async (booksDir) => {
  const shelf = await shelfOf(booksDir)                                            // read once: every book is judged against the same shelf
  const names = await folders(booksDir)
  const listed = []
  for (const name of names) listed.push(await bookFacts(booksDir, shelf, name))
  return listed
}

// ───────────── the asset search path ─────────────
// The engine asks for "assets/cannon.jpg" page-relative and has no idea whether
// that picture belongs to the game or to a book it pins. The published folder
// answers that by holding one flat assets/ (the export copies the union); the dev
// server answers it here, live: the game's own assets/ first, then each pinned
// book's in LAYER order, first hit wins. So an author can override a book's
// picture by dropping a file of the same name into their own assets/ — the same
// "the game decides" rule the cascade follows for rules and labels.
const isFile = (path) => { try { return statSync(path).isFile() } catch { return false } }

const pinsOf = async (gamesDir, game) => {
  try {
    const content = JSON.parse(await readFile(join(gamesDir, game, "data", "content.json"), "utf8"))
    return Array.isArray(content.books) ? content.books : []                       // a hand-edit that is not a list pins nothing
  } catch { return [] }                                                            // no game, no content, no pins — the game's own assets/ still answers
}

export const assetPath = async (gamesDir, booksDir, game, rest) => {
  const pins    = await pinsOf(gamesDir, game)
  const layers  = await readBooks(booksDir, pins).catch(() => [])                   // a broken shelf must not take the game's own pictures down
  const ordered = orderBooks(layers).ordered                                        // the merge's order, so overriding matches what the merge does
  const roots   = [join(gamesDir, game, "assets"), ...ordered.map(layer => join(bookDir(booksDir, layer.pin.name, layer.pin.edition), "assets"))]
  for (const root of roots) {
    const candidate = join(root, rest)
    if (candidate.startsWith(root + sep) && isFile(candidate)) return candidate     // the guard again, at every door on the path
  }
  return null                                                                       // nobody has it → the caller's 404
}

// ───────────── pins from the outside world ─────────────
// POST /api/games may name its own books. Their SHAPE is content.json's own pins
// checker — one grammar, one place — reached by asking the validator about an
// empty game whose books are the ones we were handed. The paths come back rooted
// at content.books[i]; the caller asked about `books`, so that is what it hears.
// The sentence goes with the path: the duplicate checker names the OTHER pin
// inside its message ("also at content.books[0]"), and a receipt that spoke two
// coordinate systems at once would send the reader looking for a file the request
// never had.
export const pinProblems = (books) => validateFile("content", { ...emptyGame().content, books })
  .filter(problem => problem.path.startsWith("content.books"))
  .map(({ path, message }) => ({ path: path.slice("content.".length), message: message.replaceAll("content.books[", "books[") }))
