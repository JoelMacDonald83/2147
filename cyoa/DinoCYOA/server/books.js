// NEW: everything the server knows about the SHELF, as plain functions over a
// books root — the twin of games.js, which does the same for the games folder.
// No HTTP in here: server.js turns these answers into files and receipts.
//
// CHANGED (stage 4): THIS FILE WRITES NOW, and the paragraph that used to stand here
// said it never would. It said the shelf was read-only because a book was published
// once and never edited — which was true of the SHELF and false of the AUTHOR: a
// stranger could make games all day and could not contribute a single book, and the
// shelf is the whole sharing surface. So the rule is narrower and sharper now, and it
// is a CHECK rather than an absence:
//
//   AN EDITION IS FROZEN ONCE A GAME PINS IT. Nothing else is.
//
// The census that answers "does any game pin it?" is games.js's (pinnedBy) — it reads
// every game's content.json, and this file may never import games.js (games.js imports
// THIS file; two files that import each other are a knot nobody can read). So every
// writer below takes the census's ANSWER as an argument and writes the sentence itself:
// the facts come from over there, the words are the shelf's own.
//
// L2 — A WRITE TO THE SHELF IS ATOMIC OR IT DID NOT HAPPEN. Every edition is built
// whole in books/<name>/<edition>.tmp/ and renamed into place; rename(2) within one
// filesystem is atomic, so a crash leaves a .tmp folder and never a mixed edition.
// `folders()` skips that suffix, or the Library would list the staging as a broken
// book.
import { readdir, readFile, writeFile, mkdir, rm, rmdir, rename, cp } from "fs/promises"
import { statSync, existsSync } from "fs"
import { join, sep } from "path"
import { isBookName, isEdition, BOOK_FILES, BOOK_FILE_SHEETS, FILE_SHEETS } from "../engine/config/schema.js"
import { FILE_NAMES, validateFile, validateBookFile } from "../engine/config/validate.js"
import { emptyGame, orderBooks, mergeLayers, validateBook, validateGame } from "../engine/config/merge.js"
// NEW: the one walk that knows where an id sits — a rename is that walk with REWRITE
// where bookRules says JUDGE. There is no second rewriter and there must never be one.
import { eachId, rewriteIds } from "../engine/config/ids.js"
// NEW: the seed walk and the server's on-disk format, shared with games.js through a
// neutral module because this file may not import games.js (see seed.js's header).
import { serialize, seedFrom, BOOK_UNWRITTEN } from "./seed.js"
// NEW: the title→folder step and the three questions a name grammar cannot answer.
import { blankTitle, nameProblems, slugOf, titleProblems } from "./names.js"

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

// NEW (L2): the staging suffix. An edition is written whole into
// books/<name>/<edition>.tmp and renamed into place, and a whole BOOK is staged the
// same way while it is being renamed — so the suffix is skipped by the listing at BOTH
// levels, which is why the skip is here and not in editionFolders.
const TMP = ".tmp"

// every folder under a root, dotfiles skipped, sorted — the shelf's own listing
// CHANGED (stage 4): and staging folders skipped. A half-written edition must not be
// offered to the Library as a broken book, nor counted as an edition number in use by
// anything but the writer that made it.
const folders = async (dir) => {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) }
  catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return []; throw error }   // no shelf yet = no books yet
  return entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.endsWith(TMP)).map(entry => entry.name).sort()
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

// NEW: the number a CUT would give the next edition — one past the highest folder, and
// 1 when there are none. Read from the FOLDERS and not from the readable ones
// (latestEdition above): a broken edition still owns its number, and handing its number
// to a new edition would bury the author's mistake under a working book. The freeze
// sentence names this number too, so "Cut edition 3 to change it" and the folder the
// cut actually makes can never disagree.
export const nextEdition = async (booksDir, name) => {
  const numbers = (await editionFolders(booksDir, name)).filter(isEditionName).map(Number)
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
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

// CHANGED (stage 4): exported. The freeze census in games.js asks the same question of
// the same file, and one reader of `content.books` is one place for "what does this game
// pin" to be wrong. A hand-edit that is not a list pins nothing, here and there alike.
export const pinsOf = async (gamesDir, game) => {
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

// ───────────── refusing ─────────────
// NEW: a refusal a ROUTE has to turn into a receipt, carrying the word that says which
// one it is. tools/export.mjs's ExportRefusal is the same idea for the same reason: the
// sentence is written where the fault is understood, and the HTTP STATUS is chosen by
// one table in server.js — so "pinned is a 409" is said once instead of at every throw.
// `problems` is the validator's own [{ path, message }] when a border had something to
// say, and [] when the refusal is about the shelf rather than about a file.
export class ShelfRefusal extends Error {
  constructor(code, message, problems = []) {
    super(message)
    this.name = "ShelfRefusal"
    this.code = code
    this.problems = problems
  }
}
const refuse = (code, message, problems) => { throw new ShelfRefusal(code, message, problems) }

const quoted = (value) => JSON.stringify(value)                                    // the validator's own way of showing a name
// merge.js writes these same three lines privately (andList) and does not export them;
// engine/config is not this package's to change, so the joiner lives here too and one of
// the two goes the day merge.js opens its door. It is a list FORMATTER, not a sentence —
// every sentence below is written exactly once, in one place, and read by every route.
const andList = (list) => list.length < 2 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`

// ───────────── the three sentences of the freeze ─────────────
// Freezing is "frozen once a game pins it", and these are the only three ways that can
// be said out loud. The FACTS come from games.js's census ([{ game, name, edition }], the
// pins exactly as the games wrote them); the WORDS are here, because "frozen", "edition",
// "cut" and "un-pin" are the shelf's vocabulary and this is the shelf's file.
// Chrome speaks titles, fault paths speak folders (§6) — so the subject of all three is
// a game's FOLDER, which is the thing the author has to go and open.
// NEW (WP-6): the name a create CLAIMS, a rename asks for and an extract asks for — one
// sentence in one place, because three routes refuse on it and an author who reads it
// twice in two wordings learns there are two rules.
export const takenName = (name) => `a book named ${quoted(name)} is already on the shelf`

const gamesThat = (by) => andList(by.map(pin => `games/${pin.game}`))
const pinVerb   = (by) => by.length === 1 ? "pins" : "pin"
export const frozenEditionSentence = (by, next) => `${gamesThat(by)} ${pinVerb(by)} this edition — it is frozen. Cut edition ${next} to change it.`
export const pinnedEditionSentence = (by)       => `${gamesThat(by)} ${pinVerb(by)} this edition. Un-pin it first, or delete the whole book.`
export const pinnedBookSentence    = (by)       => `${andList(by.map(pin => `games/${pin.game} pins edition ${pin.edition}`))} — un-pin ${by.length === 1 ? "it" : "them"} first.`

// ───────────── a new book's name ─────────────
// The folder a create request asks for, and what is wrong with the request that asked.
// ONE grammar throughout: the title→folder step is names.js's — the same one a new GAME
// goes through, reserved words included — and the NAME's own regex is never asked here.
// validateBook asks it of the manifest a moment later, at `book.name`, with the one
// sentence validate.js's RULES.book writes. So a bad name is refused once, by the border,
// in the words the editor's banner already prints.
// A title is required even when a name is given: the title is what the Library's card is
// called, and a book whose card has no name is a book nobody picks off the shelf.
export const newBookName = ({ title, name }) => {
  if (name === undefined) {
    const problems = titleProblems(title)
    return { name: problems.length > 0 ? null : slugOf(title.trim()), problems }
  }
  const problems = [...blankTitle(title), ...bookNameProblems(name, "name")]
  return { name: problems.length > 0 ? null : name, problems }
}

// NEW: is this a legal book FOLDER name, as [{ path, message }] — never more than one
// sentence. The same technique pinProblems uses at the bottom of this file, for the same
// reason: ask the REAL table about a synthetic object and re-root the answer, rather than
// spelling a grammar that is already written. The three questions a regex cannot answer
// come from names.js; the regex's own sentence comes from validate.js's RULES.book, which
// is where isBookName's words live.
// IT MUST BE ASKED BEFORE join(). A create's `name` and a rename's `to` arrive in a
// REQUEST BODY and become a path component, and ".." is answered by the GRAMMAR — the
// root + sep guard at the drawer's door is the second line, never the first.
export const bookNameProblems = (name, path = "name") => {
  const problems = nameProblems(name, path)
  if (problems.length > 0) return problems
  return validateBookFile("book", { name, title: "", edition: 1, requires: [] })
    .filter(problem => problem.path === "book.name")
    .map(problem => ({ path, message: problem.message }))
}

// ───────────── the seed ─────────────
// A newborn book: the manifest the author's answers make, plus the three data files read
// from the contract by seed.js's walk — the same walk a game's five files come out of.
//
// THE MANIFEST IS THE ONE FILE IN THIS PROJECT THAT CANNOT BE SEEDED FROM ITS SHEET, and
// that is not a gap in bookSchema. None of its four entries carries a `default` because
// none of them HAS one: a name and an edition come from the FOLDER (the folder is the
// truth), a title comes from the author, and `requires` is the author's list. So the walk
// runs the other way round here — the KEY ORDER is read from the sheet, so book.json's
// keys sit exactly where every hand-written manifest on the shelf has them, and the
// VALUES are the caller's. An entry nobody handed a value for is a loud throw, never a
// quiet `undefined` that JSON.stringify drops and the validator reports as missing.
//
// AND NO `version` KEY. book.json is not a data file: validateBookFile passes gate=null
// for it, so "version" is not even in its known-keys set and a stamp would come back as
// `unexpected key "version"`. The three data files each carry one. That asymmetry is the
// whole reason this is two statements and not one loop.
export const seedBook = (name, title, edition, requires = []) => {
  const given = { name, title, edition, requires }
  const book = {}
  BOOK_FILE_SHEETS.book.forEach(entry => {
    if (!Object.hasOwn(given, entry.key)) throw new Error(`No seed for book.${entry.key}: the manifest's sheet grew an entry seedBook has no value for`)
    book[entry.key] = structuredClone(given[entry.key])
  })
  return { book, ...Object.fromEntries(BOOK_FILES.map(file => [file, seedFrom(BOOK_FILE_SHEETS, file, BOOK_UNWRITTEN[file] ?? [])])) }
}

// ───────────── writing: L2, atomic or it did not happen ─────────────
const BOOK_FILE_NAMES = Object.keys(BOOK_FILE_SHEETS)   // ["book", "types", "things", "proposals"] — derived, never typed out

// One edition, written WHOLE. The bytes go into <edition>.tmp and that folder is RENAMED
// over the edition: rename(2) inside one filesystem is atomic, so there is no instant at
// which the folder holds some of the new files beside some of the old ones.
//
// `carryFrom` names the folder whose OTHER contents come along — assets/, and anything
// the author dropped in by hand. It is the TARGET ITSELF for a save (a save replaces four
// files; it does not empty a folder) and the PREVIOUS EDITION for a cut, which is the
// shelf's own definition of an edition: a copy plus more. The four json files are removed
// from the staging after the copy and written back from `files`, so a file the caller
// does NOT carry is a file the edition does not have — which is how Basic and Stats ship,
// and the only way "the whole book in one request" can mean what it says.
//
// THE ONE WINDOW, named rather than hidden: between the rm and the rename the edition
// folder is absent while its complete new bytes sit in <edition>.tmp. A crash there loses
// nothing and MIXES nothing, which is the promise; the repair is to rename that folder by
// hand. Closing the window needs a second scratch suffix (swap the old out, swap the new
// in, delete the old), and two suffixes one keystroke apart — with every listing owing
// both a skip — is a worse trade than saying plainly where the window is.
const writeEdition = async (booksDir, name, edition, files, carryFrom) => {
  const dir     = bookDir(booksDir, name, edition)
  const staging = dir + TMP
  const source  = carryFrom ?? dir
  await rm(staging, { recursive: true, force: true })                              // a crashed earlier attempt
  if (existsSync(source)) await cp(source, staging, { recursive: true })
  else await mkdir(staging, { recursive: true })
  for (const file of BOOK_FILE_NAMES) await rm(join(staging, `${file}.json`), { force: true })
  for (const file of BOOK_FILE_NAMES) if (files[file] !== null && files[file] !== undefined)
    await writeFile(join(staging, `${file}.json`), serialize(files[file]))
  await rm(dir, { recursive: true, force: true })
  await rename(staging, dir)
}

// A NEW BOOK. THE CLAIM IS books/<name> ITSELF, made with a non-recursive mkdir — the
// existence check and the claim in one step, so two creates in the same instant cannot
// both pass and both write, and EEXIST is the caller's 409.
// THE VERIFIED DEFECT THIS AVOIDS: mkdir(books/<name>, { recursive: true }) followed by a
// non-recursive mkdir of the edition leaves books/<name> behind whenever anything later
// fails, and a later create of a DIFFERENT book can land inside that ghost. Claiming the
// level that is NEW means the rollback removes exactly what this call made, and nothing
// that was already there.
export const createBook = async (booksDir, files) => {
  const { name, edition } = files.book
  await mkdir(booksDir, { recursive: true })                                       // the shelf root itself may be new (a scratch shelf)
  const folder = join(booksDir, name)
  try { await mkdir(folder) }                                                      // THE CLAIM
  catch (error) {
    if (error.code === "EEXIST") refuse("exists", takenName(name))
    throw error
  }
  try {
    await mkdir(bookDir(booksDir, name, edition))
    await writeEdition(booksDir, name, edition, files)
  } catch (error) {
    await rm(folder, { recursive: true, force: true })                              // exactly what this call claimed
    throw error
  }
}

// An EXISTING edition, replaced. The freeze is the CALLER's question (the census lives in
// games.js) and the shape is validateBook's; what is left here is the bytes. The folder
// must already be there — a save is not a create, and writing an edition nobody claimed
// would be the create route with no claim, no 409 and no rollback.
export const writeBook = async (booksDir, name, edition, files) => {
  if (!existsSync(join(bookDir(booksDir, name, edition), "book.json")))
    refuse("missing", `books/${name}/${edition} is not on the shelf`)
  await writeEdition(booksDir, name, edition, files)
}

// EDITION N+1 IS EDITION N'S BYTES PLUS MORE — the shelf's own rule, and how the real
// Dinosaur Age 2 was made (by a one-off script, which this is the surviving form of). The
// source edition is read, its manifest re-stamped with the new number (assigning a key
// that is already there never moves it, so book.json's key order survives), and
// everything else — assets included — carried forward by the copy.
// A cut is the answer to the freeze, so it is allowed while the source is pinned: that is
// the whole point of "cut edition N+1 to change it".
export const cutEdition = async (booksDir, name, from) => {
  const layer = await readBook(booksDir, { name, edition: from })
  if (layer === null) refuse("missing", `books/${name}/${from} is not on the shelf`)
  const edition = await nextEdition(booksDir, name)
  const files = { book: { ...layer.manifest, edition }, types: layer.types, things: layer.things, proposals: layer.proposals }
  try { await mkdir(bookDir(booksDir, name, edition)) }                            // THE CLAIM
  catch (error) {
    if (error.code === "EEXIST") refuse("exists", `books/${name}/${edition} already exists`)
    throw error
  }
  try { await writeEdition(booksDir, name, edition, files, bookDir(booksDir, name, from)) }
  catch (error) {
    await rm(bookDir(booksDir, name, edition) + TMP, { recursive: true, force: true })
    await rm(bookDir(booksDir, name, edition), { recursive: true, force: true })    // only the level this call claimed
    throw error
  }
  return edition
}

// ONE EDITION. The freeze is the caller's question again; what is here is the rule the
// listing needs: THE LAST EDITION TAKES THE BOOK FOLDER WITH IT, or the Library shows a
// book with no editions — a ghost that cannot be opened, cannot be pinned and cannot be
// explained. rmdir WITHOUT recursive is the whole rule: it succeeds only when nothing at
// all is left, so an edition we did not delete, or a folder the author made by hand,
// keeps the book exactly as it is.
export const deleteEdition = async (booksDir, name, edition) => {
  const dir = bookDir(booksDir, name, edition)
  if (!existsSync(dir)) refuse("missing", `books/${name}/${edition} is not on the shelf`)
  await rm(dir, { recursive: true, force: true })
  await rm(dir + TMP, { recursive: true, force: true })                             // and any staging it left behind
  await rmdir(join(booksDir, name)).catch(() => {})                                 // ENOTEMPTY = something is still there, which is the answer
}

// THE WHOLE BOOK, every edition. Refused while any game pins any edition — the caller's
// question, with pinnedBookSentence as its answer.
export const deleteBook = async (booksDir, name) => {
  const folder = join(booksDir, name)
  if (!existsSync(folder)) refuse("missing", `books/${name} is not on the shelf`)
  await rm(folder, { recursive: true, force: true })
}

// ───────────── renaming: the id rewrite ─────────────
// A BOOK'S NAME IS ITS ID NAMESPACE. merge.js says it in capitals — "NAMESPACE =
// OWNERSHIP" — and adds that the FOLDER is the namespace, not the manifest. So renaming
// a book rewrites two different kinds of thing, and the receipt (§8) says
// `rewritten: { ids, pins }` because they really are two walks over two grammars:
//
//   ids   every id this book DEFINES, inside every edition of it;
//         every REFERENCE to one of those ids — inside its own editions, AND inside
//         every local game that pins it (a game's rowOverrides are keyed by a book's row
//         ids and a game's things sit in buckets keyed by a book's SHEET ids, so a rename
//         that only touched the book would orphan all of them silently);
//   pins  `content.books[i].name` in each of those games. A pin names a FOLDER on the
//         shelf and is not an id at all — ids.js's WALKERS.pins says so where a reader
//         will look for it — so it gets its own line below.
//
// The map is built by PREFIX over the id positions that are actually there: every string
// at an id position starting "<name>:" becomes "<to>:" plus the rest. Not from the
// defining half alone, for the reference reason above; and by position rather than by
// regex over the bytes, because a LABEL that happens to read "basic:character" is prose
// and must not move.

// the merged phonebook a walk needs — which of a thing's keys hold placements, and
// whether a demand's value is a thing id. The MERGED types, never one layer's: a book's
// things sit on sheets its requirements define, and a bucket whose sheet is not in the
// phonebook has its placements unreachable (eachId says so in `unknownSheets`, and a
// WRITER must refuse rather than rename half a book). null = this stack will not merge,
// which is itself a refusal: ids that cannot be found cannot be rewritten.
const mergedTypes = (books, game) => {
  try { return mergeLayers({ books, game }).set.types.types }
  catch { return null }
}

// one file set's id positions in this namespace: how many there are, and what each
// becomes. `into` is the shared map, so every subject contributes to one answer and the
// collision check below sees all of it at once.
const collectRename = (files, types, space, to, fileSheets, into) => {
  let found = 0
  const { unknownSheets } = eachId(files, types, ({ id }) => {
    if (!id.startsWith(space)) return
    found += 1
    into.set(id, to + ":" + id.slice(space.length))
  }, fileSheets)
  return { found, unknownSheets }
}

// a game's five own files, nulls for the ones a pre-v3 game never had
const gameSet = async (gamesDir, game) => {
  const data = join(gamesDir, game, "data")
  const read = async (file) => {
    try { return JSON.parse(await readFile(join(data, `${file}.json`), "utf8")) }
    catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return null; throw error }
  }
  const set = {}
  for (const file of FILE_NAMES) set[file] = await read(file)
  return set
}

// NEW (WP-6): EVERY ID THE SHELF ALREADY DEFINES — §3's bulk-mint rule, asked once for
// the two routes that mint in bulk. A rename and an extract both produce a whole
// namespace at a stroke, on the server, where the editor's `origins` map is not in hand;
// merge F6 is FIRST-DEFINITION-WINS, so an id that lands on one another book already
// defines is not a fault anybody reports — it is the author's own work silently skipped.
// Only the DEFINING half counts: a book may reference anything, and a reference to an id
// nobody defines is the merge's own sentence, not a name in use.
// `except` is the book whose own ids are about to be replaced (a rename), which must not
// be counted as competition with itself.
const definedOnShelf = (shelf, except) => {
  const taken = new Set()
  Object.entries(shelf).forEach(([name, editions]) => {
    if (name === except) return
    Object.values(editions).forEach(layer =>
      eachId({ book: layer.manifest, types: layer.types, things: layer.things, proposals: layer.proposals }, [],
        ({ id, defining }) => { if (defining) taken.add(id) }, BOOK_FILE_SHEETS))
  })
  return taken
}

// RENAME A BOOK. `games` is the freeze census's answer — every local game that pins any
// edition of it (games.js's pinnedByAnyEdition). Nothing is written until every check has
// passed and every byte has been built, so a refusal leaves the shelf and the games
// exactly as they were.
//
// WHY IT IS ALLOWED WHILE PINNED (§8's footnote): because every pinning game is rewritten
// in the same step. That is the only reading of the freeze that holds — the freeze says a
// game's world cannot change under it, and a rename that carries the game's own
// references and pins with it changes no world at all, only a spelling.
export const renameBook = async (booksDir, gamesDir, name, to, games = []) => {
  const space = `${name}:`

  // 1. THE TARGET FOLDER MUST BE FREE. rename(2) would merge into an existing one and the
  //    two books would share a namespace — which merge F6 resolves by SILENTLY SKIPPING
  //    the second definition. Work lost, no sentence.
  if (existsSync(join(booksDir, to))) refuse("exists", takenName(to))

  const shelf = await shelfOf(booksDir)
  // 2. NO OTHER BOOK MAY REQUIRE THIS ONE. Following the rename into their `requires`
  //    means writing an edition some other author's game may already pin, and an edition
  //    on the shelf is FROZEN. This refusal is not in §8's table and the freeze demands
  //    it: the alternative is a rename that quietly breaks books it never mentioned.
  const dependants = []
  Object.entries(shelf).forEach(([other, editions]) => {
    if (other === name) return
    Object.entries(editions).forEach(([edition, layer]) => {
      if ((layer.manifest?.requires ?? []).some(req => req?.name === name)) dependants.push(`books/${other}/${edition}`)
    })
  })
  if (dependants.length > 0) refuse("pinned",
    `${andList(dependants)} require${dependants.length === 1 ? "s" : ""} this book — a required book cannot be renamed, because rewriting a frozen edition to follow it is exactly what "editions are frozen" forbids.`)

  // 3. EVERY EDITION, AND EVERY GAME — read first, scanned second, written last.
  const editions = (await editionFolders(booksDir, name)).filter(isEditionName).map(Number)
  if (editions.length === 0) refuse("missing", `books/${name} has no edition to rename`)
  const map = new Map()
  let ids = 0, pins = 0
  const subjects = []                                                              // [{ what, files, types, fileSheets }]

  for (const edition of editions) {
    const layer = shelf[name]?.[String(edition)] ?? null
    if (layer === null) refuse("missing", `books/${name}/${edition} cannot be read — a rename rewrites every edition or none of them`)
    const required = (layer.manifest.requires ?? []).map(pin => shelf?.[pin.name]?.[pin.edition] ?? null)
    const types = mergedTypes([...required, layer], null)
    if (types === null) refuse("refused", `books/${name}/${edition} will not merge with the books it requires, so its ids cannot all be found`)
    const files = { book: layer.manifest, types: layer.types, things: layer.things, proposals: layer.proposals }
    const { found, unknownSheets } = collectRename(files, types, space, to, BOOK_FILE_SHEETS, map)
    if (unknownSheets.length > 0) refuse("refused",
      `books/${name}/${edition} holds things on ${andList(unknownSheets.map(quoted))}, which no book it requires defines — the rename cannot see what is inside them`)
    ids += found
    subjects.push({ what: "book", edition, files, types, fileSheets: BOOK_FILE_SHEETS, layer })
  }

  for (const game of [...new Set(games)]) {
    const own = await gameSet(gamesDir, game)
    if (own.content === null) refuse("refused", `games/${game}/data/content.json cannot be read, so its pins cannot follow the rename`)
    const books = await readBooks(booksDir, own.content.books).catch(() => null)
    if (books === null) refuse("refused", `games/${game} pins a book that cannot be read, so its ids cannot all be found`)
    const types = mergedTypes(books, own)
    if (types === null) refuse("refused", `games/${game} will not merge with the books it pins, so its ids cannot all be found`)
    const { found, unknownSheets } = collectRename(own, types, space, to, FILE_SHEETS, map)
    if (unknownSheets.length > 0) refuse("refused",
      `games/${game} holds things on ${andList(unknownSheets.map(quoted))}, which nothing it pins defines — the rename cannot see what is inside them`)
    ids += found
    subjects.push({ what: "game", game, files: own, types, fileSheets: FILE_SHEETS })
  }

  // 4. THE BULK-MINT RULE (§3), applied to a bulk REWRITE: every id this produces is
  //    checked against the WHOLE shelf before anything is written. merge F6 is
  //    first-definition-wins, so an id landing on one another book already defines is not
  //    a fault the merge reports — it is the author's own definition silently skipped.
  // CHANGED (WP-6): the census is definedOnShelf above, shared with the extract route —
  // two bulk mints asking one question in one place.
  const taken = definedOnShelf(shelf, name)
  const collisions = [...new Set(map.values())].filter(id => taken.has(id))
  if (collisions.length > 0) refuse("exists",
    `${andList(collisions.map(quoted))} ${collisions.length === 1 ? "is" : "are"} already defined by another book on the shelf — the rename would lose ${collisions.length === 1 ? "it" : "them"} to the merge's first-definition-wins rule.`)

  // 5. THE REWRITE, and then THE BORDER. rewriteIds is pure and hands back a new set, so
  //    every subject is built whole in memory and judged before one byte lands. The
  //    manifest's own `name` is NOT an id position (it is plain text), so it is set here
  //    by hand — and `pin.name` with it, because the folder is the truth and validateBook
  //    compares the two.
  const newShelf = {}
  Object.entries(shelf).forEach(([other, editions]) => { if (other !== name) newShelf[other] = editions })
  newShelf[to] = {}
  const built = subjects.map(subject => {
    const next = rewriteIds(subject.files, subject.types, map, subject.fileSheets)
    if (subject.what === "book") {
      next.book.name = to
      newShelf[to][String(subject.edition)] = { pin: { name: to, edition: subject.edition }, manifest: next.book, types: next.types, things: next.things, proposals: next.proposals }
    } else {
      // the PINS — the other half of the rename, over a different grammar. Assigning a
      // key that is already there never moves it, so a pin's { name, edition } order
      // survives and the game's content.json changes in exactly one place.
      next.content.books = (next.content.books ?? []).map(pin => {
        if (pin === null || typeof pin !== "object" || pin.name !== name) return pin
        pins += 1
        return { ...pin, name: to }
      })
    }
    return { ...subject, next }
  })
  const problems = []
  for (const subject of built) {
    if (subject.what === "book") problems.push(...validateBook(newShelf[to][String(subject.edition)], newShelf))
    else {
      const books = (subject.next.content.books ?? []).map(pin => newShelf?.[pin?.name]?.[pin?.edition] ?? null)
      problems.push(...validateGame({ own: subject.next, books }).map(({ path, message }) => ({ path: `games/${subject.game}.${path}`, message })))
    }
  }
  if (problems.length > 0) refuse("refused", `renaming ${quoted(name)} to ${quoted(to)} does not fit the schema`, problems)

  // 6. THE WRITE ORDER, and what a crash at each step leaves behind. At no instant does
  //    any game pin a book that is not on the shelf, which is the property worth having:
  //      a. the whole new book is staged at books/<to>.tmp (a cp, so assets and any
  //         folder the author made come along) and RENAMED into place. Until that rename
  //         nothing has changed; after it BOTH names are there, each whole and each in
  //         its own namespace.
  //      b. each pinning game is rewritten, its content.json LAST — the editor's own
  //         ordering rule, because content.json is the file that carries the pins. A file
  //         whose bytes would not change is not written at all.
  //      c. the old folder goes. A crash before this leaves a duplicate book the author
  //         can see and delete, never a game pointing at nothing.
  const staging = join(booksDir, to) + TMP
  try {
    await rm(staging, { recursive: true, force: true })
    await cp(join(booksDir, name), staging, { recursive: true })
    for (const subject of built) {
      if (subject.what !== "book") continue
      const dir = join(staging, String(subject.edition))
      for (const file of BOOK_FILE_NAMES) await rm(join(dir, `${file}.json`), { force: true })
      for (const file of BOOK_FILE_NAMES) if (subject.next[file] !== null && subject.next[file] !== undefined)
        await writeFile(join(dir, `${file}.json`), serialize(subject.next[file]))
    }
    await rename(staging, join(booksDir, to))
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
  for (const subject of built) {
    if (subject.what !== "game") continue
    const data = join(gamesDir, subject.game, "data")
    const changed = FILE_NAMES.filter(file => subject.next[file] !== null && serialize(subject.next[file]) !== serialize(subject.files[file]))
    for (const file of changed) if (file !== "content") await writeFile(join(data, `${file}.json`), serialize(subject.next[file]))
    if (changed.includes("content")) await writeFile(join(data, "content.json"), serialize(subject.next.content))
  }
  await rm(join(booksDir, name), { recursive: true, force: true })
  return { ids, pins }
}

// ───────────── "save as a book": a game's own layer, lifted onto the shelf ─────────────
// NEW (WP-6). The third fork Joelle decided: a stranger can make games all day and
// cannot contribute a single book, so the shortest road from a game to the shelf is to
// take the layer the author already wrote and make it a book.
//
// WHAT THIS IS, mechanically: a game is the LAST LAYER of a stack, and a book is a layer
// too — "a game's own stuff is its own book, loaded last" is the sentence the whole merge
// design is built on. So the lift is almost an identity: the game's own types, things and
// rows become the book's three data files, the book REQUIRES exactly what the game pinned
// (so it orders last among the books, where the game's own layer used to sit), and the
// game pins it. The merged world the player sees is then the same world, element for
// element and in the same order — which is the one property this route owes and the one
// the verification measures.
//
// WHAT IT IS NOT: a move of the game's DECISIONS. A book PROPOSES and a game DECIDES, per
// key, and the cascade is the only reason a frozen book can be improved without breaking
// anybody. Four of a game's files are decisions about somebody else's proposals —
// rowOverrides, themes, the player's sheet, the budget — and an arrangement is a decision
// about a MERGED shelf no book can see. None of them travels, and the honest half of this
// route is saying so: `left` is one sentence per thing that stayed, because a feature that
// silently drops four of games/dino's four row facts has lied to its author.
//
// THE IDS. A game's ids are crypto.randomUUID(); every id a book DEFINES must be
// `<folder>:<slug>` and fit BOOK_ID (merge.js's bookRules, which the result is judged by
// unchanged). So every defining id is re-minted as `<name>:<noun>-<n>` — the NOUN from
// schema.js's MINTS, carried here as each position's `kind` by the one walk that knows
// where an id sits, and never derived from a caption (an id must not follow a rename, or
// every reference to it breaks). References follow through the same map, in the book AND
// in the game: the game keeps an arrangement, a theme and maybe a player sheet that name
// things which have just been re-christened, and a rename that stopped at the book's own
// folder would orphan every one of them silently.

// a count with its noun, so every sentence below says "1 row override" and "4 row
// overrides" from one rule instead of from six hand-written ternaries
const counted = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// THE HONEST HALF, AS A TABLE. One row per thing a book may not carry; each row is handed
// the same facts and answers with the sentences it has to say, or nothing. A table and not
// a sequence of pushes for the usual reason: the day a sixth thing cannot travel it is a
// row here, and a reader looking for "what stays behind" finds the whole list in one place
// rather than scattered through a procedure.
// Every sentence names a FOLDER (fault paths speak folders, §6) and says WHY in the
// shelf's own vocabulary — propose/decide, frozen, arrange — because "why" is the half
// that tells the author whether they need to do anything about it.
const EXTRACT_LEFT = [
  // content.rowOverrides. THE COMMON CASE, not the corner: for games/dino this is four of
  // its four row facts. An override answers a book's proposal, and book-over-book override
  // is the decision stage 4 deferred — so a book carrying these would be refused, and a
  // book SILENTLY carrying them would be a different game.
  ({ game, own }) => {
    const n = Object.keys(own.content.rowOverrides ?? {}).length
    return n === 0 ? [] : [`${counted(n, "row override")} stay${n === 1 ? "s" : ""} with games/${game} — an override answers a BOOK's proposal, and a book may not override another book.`]
  },
  // things.order. An arrangement is the game's taste over the MERGED shelf — the book's
  // things beside every other book's — and a book that shipped one would overrule every
  // game that pins it (merge.js refuses it outright). It stays, and the ids in it that
  // moved have followed the move, so the shelf the player sees is in the same order.
  ({ game, own, movedIds }) => {
    if (own.things.order === undefined) return []
    const ids = Object.values(own.things.order).flat().filter(id => movedIds.has(id)).length
    return [`things.order stays with games/${game} — arranging a shelf is the game's taste over the MERGED shelf and a book may not carry one; ${counted(ids, "id")} in it named a thing that moved and ${ids === 1 ? "has" : "have"} been rewritten, so the order still holds.`]
  },
  // themes. A book proposes no look at all (there is no themes.json in BOOK_FILE_SHEETS),
  // and a row theme is keyed by a row id — so the keys of the rows that moved follow them.
  ({ game, own }) => {
    const n = Object.keys(own.themes.groupThemes ?? {}).length
    return [`themes stay with games/${game} — a book proposes no look, so the page's own look${n === 0 ? "" : ` and ${counted(n, "row theme")}`} ${n === 0 ? "is" : "are"} the game's (the keys that moved have been rewritten).`]
  },
  // content.sheet. A book PROPOSES sheets; which one the player fills in is the game's
  // single declaration, and the whole demand/binding vocabulary is drawn from it.
  ({ game, own, next }) => own.content.sheet === undefined || own.content.sheet === "" ? []
    : [`content.sheet stays with games/${game} — a book proposes sheets and never says which one the player builds; games/${game} still builds ${quoted(next.content.sheet)}.`],
  // rules.totalBudget. A DECISION, not a proposal — and the one thing here that would
  // actually have changed the game if it travelled: two books proposing different budgets
  // is F14 ("this game must set its own"), resolved to the first in layer order, so a
  // budget moved into a book beside a requirement that proposes one can change the number
  // the player spends. The author can still propose one on the book afterwards.
  ({ game, own }) => own.rules.totalBudget === undefined ? []
    : [`rules.totalBudget stays with games/${game} — ${own.rules.totalBudget} is the game's DECISION and a book only proposes a budget; propose one on the book if you want it to travel.`],
  // a things bucket whose sheet nothing on the shelf defines. For a GAME that is a kept
  // leftover (the state right after un-pinning a book, listed under "Not on any sheet" so
  // the author can rescue it); for a BOOK it is F12 and the things are skipped. So it
  // stays — and its insides are unreachable to the walk for the same reason, which is
  // said out loud rather than discovered later.
  ({ game, staying }) => Object.entries(staying).map(([sheetId, list]) =>
    `things.things[${quoted(sheetId)}] stays with games/${game} — nothing on the shelf defines that sheet, so a book holding its ${counted((list ?? []).length, "thing")} would have them skipped; the rewrite cannot see inside them either.`),
  // a picture in the GAME's assets. The asset search path looks in the game's own assets/
  // first, so games/<g> itself keeps showing these — but a book naming a file it cannot
  // ship shows nothing to anybody else who pins it, and there is no upload door in this
  // project for a book or for a game (§9.15: out of scope, SAID OUT LOUD).
  ({ game, pictures }) => pictures.map(({ name, url }) =>
    `${quoted(name)} names the picture ${quoted(url)}, which lives in games/${game}/assets — a book cannot ship a picture (assets are out of scope this stage), so it travels as a filename only.`)
]

// the game's five files, written WHOLE: staged in data.tmp/ and renamed over data/, the
// same discipline writeEdition uses on an edition, for the same reason — half a rewritten
// game (its types emptied while its content still holds the rows) is a game that will not
// open. A cp first, so anything else in data/ comes along; a file whose bytes would not
// change is not written at all.
// THE SAME ONE WINDOW, named rather than hidden: between the rm and the rename data/ is
// absent while its complete new bytes sit in data.tmp. A crash there loses nothing and
// MIXES nothing; the repair is to rename that folder by hand. Nothing lists it (the static
// half serves "/data/…" and "/assets/…" and nothing else, and no listing reads inside a
// game's folder), so a stray staging is invisible rather than a ghost game.
const writeGameSet = async (gamesDir, game, set, was) => {
  const dir     = join(gamesDir, game, "data")
  const staging = dir + TMP
  await rm(staging, { recursive: true, force: true })                              // a crashed earlier attempt
  await cp(dir, staging, { recursive: true })
  const changed = FILE_NAMES.filter(file => serialize(set[file]) !== serialize(was[file]))
  for (const file of changed) await writeFile(join(staging, `${file}.json`), serialize(set[file]))
  await rm(dir, { recursive: true, force: true })
  await rename(staging, dir)
  return changed
}

// EXTRACT. The game is read, what can travel is separated from what cannot, every id is
// re-minted into the new book's namespace, BOTH sides are judged by their own border, and
// only then does anything land. Returns { moved, left } — the counts for the receipt and
// the sentences for the author.
//
// THE WRITE ORDER IS THE BOOK FIRST, and the rollback is the book's own folder: at no
// instant does a game pin a book that is not on the shelf. The other order would leave
// exactly that — a game pointing at nothing — and a crash between the two leaves an
// orphan book the author can see and delete, which is the harmless direction.
export const extractBook = async (booksDir, gamesDir, game, name, title) => {
  // the folder must be free BEFORE the work, and createBook's mkdir claims it again at the
  // end — the claim is the race-proof answer and this is the early, cheap one. One
  // sentence either way (takenName), so the author cannot tell which asked.
  if (existsSync(join(booksDir, name))) refuse("exists", takenName(name))

  // 1. THE GAME AS IT IS — and it must already FIT, judged by the very border its own
  //    Save is judged by (validateGame: shapes, the merge's faults, the references). Three
  //    things ride on that one call.
  //    · THE VERSION GATE. A game at an older schema is refused in validate.js's own words
  //      ("open the game in the editor and Save to migrate it"), because a book is NEVER
  //      migrated: one born from stale shapes would be stale for ever, in an edition that
  //      freezes the moment a game pins it.
  //    · A PIN THAT FINDS NOTHING is F1 here instead of a book that requires a book which
  //      is not on the shelf.
  //    · AN ID THE GAME DEFINES THAT A BOOK ALREADY DEFINES is F6, and F6 is the one fault
  //      that would make this route change what the game plays: the merge skips the second
  //      definition, so lifting that id into a fresh namespace would un-skip it.
  //    It is the right strictness because the editor cannot SAVE a game in this state
  //    either (the save route runs the same call) — so "fix it, then lift it out" is the
  //    road the author is already on, and the sentences are the ones already on screen.
  const own    = await gameSet(gamesDir, game)
  const atGame = (problems) => problems.map(({ path, message }) => ({ path: `games/${game}.${path}`, message }))
  // the pins as they are, junk included: their SHAPE is validateGame's question, and
  // readBooks answers a pin it cannot use with a null layer rather than a throw.
  const pins  = Array.isArray(own.content?.books) ? own.content.books : []
  const books = await readBooks(booksDir, pins).catch(() => null)
  if (books === null) refuse("refused", `games/${game} pins a book that cannot be read, so what it owns cannot all be found`)
  const faults = validateGame({ own, books })
  if (faults.length > 0) refuse("refused", `games/${game} does not fit the schema, so there is nothing safe to lift out of it`, atGame(faults))

  // 2. THE SHELF IT STANDS ON. The book REQUIRES exactly what the game PINS: the game's
  //    own layer references those books' ids (its things sit in buckets keyed by their
  //    sheets, its rows query their types), and a book may reference only what it requires
  //    — F12 skips a bucket whose sheet nothing defines. Requiring the same editions is
  //    also what keeps the layer ORDER: a book that requires all of them sorts after all
  //    of them, which is exactly where the game's own layer was.
  const shelf = await shelfOf(booksDir)
  // the MERGED types — the phonebook, needed twice: which of a thing's keys hold
  // placements, and whether a demand's value is a thing id. It is the same phonebook the
  // BOOK will have (its requirements' types plus the ones moving), which is why one answer
  // serves both walks.
  const types = mergedTypes(books, own)
  if (types === null) refuse("refused", `games/${game} will not merge with the books it pins, so what it owns cannot all be found`)
  const defined = new Set(types.map(type => type?.id))

  // 3. WHAT TRAVELS. The types file whole (sheets, and the sections and fields it adds to
  //    other books' sheets — all of them definitions in the game's own layer), the rows
  //    whole, and every things bucket whose sheet the merged library knows. A bucket it
  //    does not know is the leftover case above: it stays.
  const moving = {}, staying = {}
  Object.entries(own.things.things ?? {}).forEach(([sheetId, list]) => {
    if (defined.has(sheetId)) moving[sheetId] = list
    else staying[sheetId] = list
  })
  const moved = {
    types:  (own.types.types ?? []).length + countIn(own.types.sectionsFor) + countIn(own.types.fieldsFor),
    things: countIn(moving),
    rows:   countRows(own.content.groups)
  }
  if (moved.types === 0 && moved.things === 0 && moved.rows === 0)
    refuse("refused", `games/${game} has nothing of its own that a book could carry — no sheets, no rows, and no things on a sheet the shelf defines.`)

  // 4. THE BOOK, built from the seed so that its three data files have the key order and
  //    the version stamp every hand-written book on the shelf has — and so that a book
  //    made by extracting is the same shape as a book made by POST /api/books. Assigning a
  //    key that is already there never moves it, so the seed's order survives.
  const files = seedBook(name, title, 1, pins)
  Object.assign(files.types, { types: own.types.types, sectionsFor: own.types.sectionsFor, fieldsFor: own.types.fieldsFor })
  files.things.things   = moving
  files.proposals.groups = own.content.groups

  // 5. THE MINT (§3). One walk over the book as built, asking for the DEFINING half — an
  //    element's own `id`, which is exactly the half bookRules judges and exactly the half
  //    that must change namespace. The noun is the position's own `kind`, the contract's
  //    word for what this id names (MINTS), so a sheet becomes <name>:sheet-1 and a thing
  //    <name>:thing-1 without anybody typing the five nouns out again.
  //    The ordinal is the smallest FREE one, checked against every id the whole shelf
  //    already defines — §3's bulk-mint rule, because merge F6 is first-definition-wins
  //    and a collision is the author's own work skipped in silence.
  const taken    = definedOnShelf(shelf)
  const ordinals = new Map()
  const mint = (kind) => {
    for (let n = (ordinals.get(kind) ?? 0) + 1; ; n += 1) {
      const id = `${name}:${kind}-${n}`
      if (!taken.has(id)) { ordinals.set(kind, n); taken.add(id); return id }      // monotone per noun: an id already minted is never offered twice
    }
  }
  const map = new Map()
  const scan = eachId(files, types, ({ id, kind, defining, path }) => {
    if (!defining || map.has(id)) return                                           // a duplicate id stays one id, and the border reports it as F6
    if (typeof kind !== "string") throw new Error(`No id noun for the position at ${path} — MINTS has no row for the sheet that defines it`)
    map.set(id, mint(kind))
  }, BOOK_FILE_SHEETS)
  // the walk said it could not see inside a bucket. It cannot happen — every bucket here
  // was filtered against the merged phonebook two steps up — so if it does, something
  // about the phonebook is not what this route believes and half a book is the worst
  // possible answer. Fail closed, by name.
  if (scan.unknownSheets.length > 0) refuse("refused",
    `books/${name} would hold things on ${andList(scan.unknownSheets.map(quoted))}, which the merged library does not define — the rewrite cannot see what is inside them`)

  // 6. THE REWRITE, both sides, from the one map. rewriteIds is pure and hands back a new
  //    set, so every byte is built and judged before anything lands.
  //    The GAME's half is the half that is easy to forget: its own layer is emptied of
  //    what moved, it pins the new book last, and its arrangement, its row themes and its
  //    player sheet all follow the rename — they name things that have just been
  //    re-christened, and a rewrite that stopped at the book's folder would orphan every
  //    one of them with no sentence anywhere.
  const nextBook = rewriteIds(files, types, map, BOOK_FILE_SHEETS)
  nextBook.proposals.groupRules = {}
  const rest = structuredClone(own)
  rest.content.groups = []
  rest.content.books  = [...(rest.content.books ?? []), { name, edition: 1 }]
  Object.assign(rest.types, { types: [], sectionsFor: {}, fieldsFor: {} })
  rest.things.things = staying
  rest.rules.groupRules = {}
  // the per-row rules split by WHOSE row it is: a rule on a row that moved is that row's
  // own proposal and goes with it; a rule on a BOOK's row is the game's DECISION over
  // somebody else's proposal and must not become a second proposal (two proposals
  // disagreeing is F13, resolved to the first in layer order — a decision that travelled
  // could change the row's min and max). A key naming neither is an orphan and stays
  // exactly where the author left it.
  Object.entries(own.rules.groupRules ?? {}).forEach(([rowId, slot]) => {
    if (map.has(rowId)) nextBook.proposals.groupRules[map.get(rowId)] = structuredClone(slot)
    else rest.rules.groupRules[rowId] = slot
  })
  const nextGame = rewriteIds(rest, types, map, FILE_SHEETS)

  // 7. BOTH BORDERS, before one byte lands. validateBook judges the book exactly as the
  //    save route's would — shapes, the namespace rules, and a real merge against what it
  //    requires — and validateGame judges the game against its new pin list. Nothing here
  //    re-words a fault: the sentences are the validator's own.
  const layer    = { pin: { name, edition: 1 }, manifest: nextBook.book, types: nextBook.types, things: nextBook.things, proposals: nextBook.proposals }
  const newShelf = { ...shelf, [name]: { 1: layer } }
  const problems = [
    ...validateBook(layer, newShelf),
    ...atGame(validateGame({ own: nextGame, books: [...books, layer] }))
  ]
  if (problems.length > 0) refuse("refused", `lifting games/${game} into books/${name} does not fit the schema`, problems)

  // 8. THE HONEST HALF, said from the facts both halves are now built from.
  const assets = join(gamesDir, game, "assets")
  const ours   = (url) => typeof url === "string" && url !== "" && join(assets, url).startsWith(assets + sep) && isFile(join(assets, url))
  const pictures = Object.values(moving).flatMap(list => (list ?? [])
    .filter(thing => ours(thing?.imageURL)).map(thing => ({ name: thing.name, url: thing.imageURL })))
  const left = EXTRACT_LEFT.flatMap(say => say({ game, own, next: nextGame, staying, pictures, movedIds: new Set(map.keys()) }))

  // 9. THE WRITE. Two folders, one operation: the book is claimed and written whole
  //    (createBook's own non-recursive mkdir and its own rollback), then the game's data/
  //    is replaced whole. If the game's half fails the book's folder goes with it — the
  //    claim this call made and nothing that was already there — so neither half lands.
  await createBook(booksDir, nextBook)
  try { await writeGameSet(gamesDir, game, nextGame, own) }
  catch (error) {
    await rm(join(booksDir, name), { recursive: true, force: true })
    throw error
  }
  return { moved, left }
}
