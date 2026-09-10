import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join, sep, extname, resolve } from "path";
// NEW: the contract, read from the sheet — the same module the EDITOR loads as
// /config/validate.js for its pre-flight (the game never runs it: it trusts what it
// loads). Node ≥ 22.7 runs the typeless engine modules as ESM by syntax detection
// (tools/oracles-logic.mjs has relied on it since v4); this server rides the same rule.
import { validateFile, problemText } from "../engine/config/validate.js";
// CHANGED: validateSet lives in merge.js now, and this file wants its fuller
// twin anyway: a game is the last layer of a stack, so content.json is judged
// WITH the books it pins (validateGame) — the merge's faults arrive as problems
// in the same { path, message } shape every other refusal already speaks.
// CHANGED (stage 4): validateBook comes too. A book's save route needs NO new
// validator — validateBook is validateGame's twin and already judges one book's shapes,
// its namespace rules and a real merge against the books it requires.
import { validateGame, validateBook } from "../engine/config/merge.js";
// NEW: the shelf's name grammar, for the two url segments that name a book. One grammar
// for the folder and the url, exactly as isGameName is for a game.
import { isBookName } from "../engine/config/schema.js";
// NEW: the publisher, IMPORTED, not spawned. Its CLI only runs when the file is
// argv[1] (the oracles import it the same way), so this line runs nothing. A
// refusal arrives as an ExportRefusal carrying .problems — the same list the
// save route already speaks — instead of printed lines this file would parse.
import { exportGame, ExportRefusal } from "../tools/export.mjs";
// NEW: the games folder as functions — names, the list, the seed, the claim (games.js).
// CHANGED (stage 4): pinnedBy / pinnedByAnyEdition — THE FREEZE CENSUS. "Frozen once a
// game pins it" is a cross-root question (it reads every game's content.json), and it
// lives in games.js because books.js may never import games.js.
import { isGameName, gameExists, listGames, titleProblems, slugOf, createGame, pinnedBy, pinnedByAnyEdition } from "./games.js";
// NEW: the books folder as functions — the shelf's grammar, the loader the merge
// eats, the listing the Library paints, the asset search path (books.js).
// CHANGED (stage 4): and its WRITE half — the seed, the atomic edition write, the
// lifecycle, and the three sentences of the freeze. Every sentence below that refuses a
// book route is imported, never re-worded.
import {
  bookDir, bookFile, readBook, readBooks, listBooks, latestEdition, nextEdition, shelfOf, assetPath, pinProblems,
  isEditionName, ShelfRefusal, newBookName, bookNameProblems, seedBook,
  createBook, writeBook, cutEdition, deleteEdition, deleteBook, renameBook, extractBook,
  frozenEditionSentence, pinnedEditionSentence, pinnedBookSentence
} from "./books.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENGINE_DIR = join(__dirname, "..", "engine")
const EDITOR_DIR = join(__dirname, "..", "dinoEdit")
// CHANGED: no GAME_NAME and no GAME_DIR. ONE server serves EVERY game: the name
// arrives in the URL (/games/<name>/…, /api/games/<name>/…) and is looked up
// under GAMES_DIR per request — never remembered, never read from argv.
// CYOA_GAMES_DIR points the whole root elsewhere (the oracles' scratch copy);
// CYOA_DIST_DIR does the same for the exports. resolve() for the same reason as
// before: the path-escape guard compares against root + sep.
const GAMES_DIR = process.env.CYOA_GAMES_DIR ? resolve(process.env.CYOA_GAMES_DIR) : join(__dirname, "..", "games")
const DIST_DIR  = process.env.CYOA_DIST_DIR  ? resolve(process.env.CYOA_DIST_DIR)  : join(__dirname, "..", "dist")
// NEW: the third root — the SHELF every game draws its books from. One shelf for
// every game (a book is shared, that is its whole point), read-only from here:
// no route under BOOKS_DIR writes. CYOA_BOOKS_DIR points it at a scratch copy for
// the oracles and for any manual check, and resolve() for the same reason as the
// other two: the path-escape guard compares against root + sep.
const BOOKS_DIR = process.env.CYOA_BOOKS_DIR ? resolve(process.env.CYOA_BOOKS_DIR) : join(__dirname, "..", "books")
// PORT=0 means "any free port" (the oracle reads the real one from the banner); unset = 3000 as before
const PORT = Number(process.env.PORT ?? 3000)
const gameDir = (name) => join(GAMES_DIR, name)

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};
const SAVABLE_FILES = {
  content: "content.json",
  rules: "rules.json",
  themes: "themes.json",
  types: "types.json",     // NEW: two more drawers — the editor saves five files now
  things: "things.json"    // NEW
}

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

// NEW: one way to answer with JSON — every API route speaks { ok, … }.
const sendJSON = (res, status, body) => {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body))
}

// content.json carries every cross-reference, so it is checked with its four
// siblings AS THEY SIT ON DISK RIGHT NOW — read fresh each time, because a hand-edit
// since the last save must count. A sibling that cannot be read is itself a problem:
// the set is not whole, so content.json is not saved.
// CHANGED: takes the game's folder — the siblings read are THAT game's.
// CHANGED again: content.json also carries the PINS, so the books it names are
// read off the shelf and judged with it. Its own shape goes first, on its own: a
// pin that is not even shaped like one ("edition": "1") must be answered by the
// contract, before this file goes looking for a folder that number cannot name.
const checkContent = async (dir, content) => {
  const shape = validateFile("content", content)
  if (shape.length > 0) return shape
  const set = { content }
  const unreadable = []
  for (const name of ["rules", "themes", "types", "things"]) {
    try {
      set[name] = JSON.parse(await readFile(join(dir, "data", SAVABLE_FILES[name]), "utf8"))
    } catch (error) {
      set[name] = null
      unreadable.push({ path: name, message: `${SAVABLE_FILES[name]} on disk cannot be read (${error.code ?? error.message}) — save it first` })
    }
  }
  if (unreadable.length > 0) return unreadable
  // the shelf, read fresh too — a book moved or a folder renamed since the last
  // save counts, exactly as a hand-edited sibling does. A pin that finds nothing
  // is a null layer here and F1 in the merge: the refusal says which pin.
  return validateGame({ own: set, books: await readBooks(BOOKS_DIR, content.books) })
}

// ───────────── the API, one function per route ─────────────

// NEW: GET /api/games — the home screen's list, read fresh from disk each time
// CHANGED: the shelf goes with it — the facts count the MERGED game (games.js).
const handleList = async (res) => sendJSON(res, 200, { ok: true, games: await listGames(GAMES_DIR, DIST_DIR, BOOKS_DIR) })

// ───────────── the shelf's write half: one chain, one status table ─────────────
// L3 — NEW BEHAVIOUR GOES BEHIND NEW ROUTES. handleSave's game path below is untouched
// except for routing: wrapping the WORKING content.json save in new concurrency behaviour
// would put the editor's whole save at risk for a book feature.
//
// ONE IN-PROCESS CHAIN, SCOPED TO THE SHELF. Every book-mutating route runs through it,
// and so does GET /api/books — listBooks reads every edition TWICE per call with no cache
// (shelfOf, then editionFacts), so a write landing between those two passes hands the
// Library facts judged against a shelf that no longer exists. It is not a lock on the
// filesystem and does not pretend to be: two servers over one shelf is not a thing this
// project has ever had (the export route already assumes one author, one machine).
let shelfQueue = Promise.resolve()
const onShelf = (work) => {
  const done = shelfQueue.then(work, work)       // the previous caller's failure must not cancel the next
  shelfQueue = done.then(() => {}, () => {})     // …and must not surface as an unhandled rejection
  return done
}

// A ShelfRefusal's `code` → the status, said ONCE here rather than at every throw, which
// is what lets books.js refuse in the shelf's own words while knowing nothing about HTTP.
// The receipt is the shape every other refusal in this file already speaks.
const REFUSAL_STATUS = { exists: 409, pinned: 409, frozen: 409, missing: 404, refused: 400 }
const sendRefusal = (res, refusal) => {
  console.log(`Refused: ${refusal.message}`)
  refusal.problems.forEach(problem => console.log(`  ${problemText(problem)}`))
  const body = { ok: false, error: refusal.message }
  if (refusal.problems.length > 0) body.problems = refusal.problems
  sendJSON(res, Object.hasOwn(REFUSAL_STATUS, refusal.code) ? REFUSAL_STATUS[refusal.code] : 400, body)
}

// the border for a whole book, in one call: shapes, the namespace rules, and a real merge
// against the books it requires — validateBook, the twin of the validateGame that guards
// content.json. Nothing is written on a refusal, and the sentence is the validator's own.
const checkBook = async (name, edition, files) => {
  const layer = { pin: { name, edition }, manifest: files.book, types: files.types, things: files.things, proposals: files.proposals }
  const problems = validateBook(layer, await shelfOf(BOOKS_DIR))
  if (problems.length > 0) throw new ShelfRefusal("refused", `books/${name}/${edition} does not fit the schema`, problems)
}

// NEW: GET /api/books — the whole shelf, loudly: every folder, every edition,
// and what is wrong with the ones that are wrong (books.js).
// CHANGED (stage 4): on the chain, so it never straddles a write (see onShelf).
const handleBooks = async (res) => sendJSON(res, 200, { ok: true, books: await onShelf(() => listBooks(BOOKS_DIR)) })

// NEW: POST /api/books { title, name?, requires? } — a new book, at edition 1.
// The folder name is made from the title by the SAME rule a game's is (slugOf, reserved
// words and all), or taken as given; either way the grammar's own sentence comes from
// validate.js, so a bad name is refused once, in the words the editor already prints.
const handleBookCreate = async (req, res) => {
  let parsed
  try { parsed = JSON.parse(await readBody(req)) } catch { return sendJSON(res, 400, { ok: false, error: "Body is not valid JSON" }) }
  const { name, problems } = newBookName({ title: parsed?.title, name: parsed?.name })
  if (problems.length > 0) return sendJSON(res, 400, { ok: false, error: `${problems[0].path} does not make a book name`, problems })
  const title = parsed.title.trim()
  const files = seedBook(name, title, 1, parsed.requires ?? [])
  await checkBook(name, 1, files)                  // before the claim: a refusal makes no folder
  await createBook(BOOKS_DIR, files)               // EEXIST is books.js's "already on the shelf" refusal
  console.log(`Created books/${name}/1 ("${title}")`)
  sendJSON(res, 201, { ok: true, name, edition: 1 })
}

// NEW: POST /api/books/<n>/<e>/save — THE WHOLE BOOK, in ONE request, written atomically.
// A game posts five files with content.json LAST because content.json carries every
// cross-reference; a book has four files and no such last one, so that ordering has no
// analogue here. One route taking all four is simpler AND stronger: the half-saved book
// does not exist as a case.
const handleBookSave = async (req, res, name, edition) => {
  let parsed
  try { parsed = JSON.parse(await readBody(req)) } catch { return sendJSON(res, 400, { ok: false, error: "Body is not valid JSON" }) }
  if (await readBook(BOOKS_DIR, { name, edition }) === null) return sendJSON(res, 404, { ok: false, error: `Unknown book ${JSON.stringify(name)} ${edition}` })
  // THE FREEZE. A game pinning this edition means its world cannot change underneath it —
  // the promise the whole merge design rests on — so the answer is a cut, not a write.
  const by = await pinnedBy(GAMES_DIR, name, edition)
  if (by.length > 0) return sendJSON(res, 409, { ok: false, error: frozenEditionSentence(by, await nextEdition(BOOKS_DIR, name)) })
  const files = { book: parsed?.book, types: parsed?.types ?? null, things: parsed?.things ?? null, proposals: parsed?.proposals ?? null }
  await checkBook(name, edition, files)
  await writeBook(BOOKS_DIR, name, edition, files)
  console.log(`Saved books/${name}/${edition}`)
  sendJSON(res, 200, { ok: true })
}

// NEW: POST /api/books/<n>/<e>/cut — edition N+1 as a copy of this one. This is the
// answer the freeze refusal points at, so it is allowed while the source is pinned.
const handleBookCut = async (res, name, edition) => {
  const cut = await cutEdition(BOOKS_DIR, name, edition)
  console.log(`Cut books/${name}/${cut} from ${edition}`)
  sendJSON(res, 201, { ok: true, edition: cut })
}

// NEW: POST /api/books/<n>/<e>/delete — one edition, and the book folder with it when it
// was the last one (or the Library would show a book with no editions).
const handleBookDeleteEdition = async (res, name, edition) => {
  const by = await pinnedBy(GAMES_DIR, name, edition)
  if (by.length > 0) return sendJSON(res, 409, { ok: false, error: pinnedEditionSentence(by) })
  await deleteEdition(BOOKS_DIR, name, edition)
  console.log(`Deleted books/${name}/${edition}`)
  sendJSON(res, 200, { ok: true })
}

// NEW: POST /api/books/<n>/delete — the whole book, every edition. Refused while any game
// pins ANY edition of it, and the refusal names every game and every edition.
const handleBookDelete = async (res, name) => {
  const by = await pinnedByAnyEdition(GAMES_DIR, name)
  if (by.length > 0) return sendJSON(res, 409, { ok: false, error: pinnedBookSentence(by) })
  await deleteBook(BOOKS_DIR, name)
  console.log(`Deleted books/${name}`)
  sendJSON(res, 200, { ok: true })
}

// NEW: POST /api/books/<n>/rename { to } — the name is the id NAMESPACE, so this rewrites
// every id in every edition, every reference to one in every game that pins it, and every
// pin that names it (books.js: `rewritten: { ids, pins }`). The grammar is asked of `to`
// HERE, before any path is built from it.
const handleBookRename = async (req, res, name) => {
  let parsed
  try { parsed = JSON.parse(await readBody(req)) } catch { return sendJSON(res, 400, { ok: false, error: "Body is not valid JSON" }) }
  const problems = bookNameProblems(parsed?.to, "to")
  if (problems.length > 0) return sendJSON(res, 400, { ok: false, error: "to does not make a book name", problems })
  if (parsed.to === name) return sendJSON(res, 400, { ok: false, error: `books/${name} is already called that` })
  const pinners = (await pinnedByAnyEdition(GAMES_DIR, name)).map(pin => pin.game)
  const rewritten = await renameBook(BOOKS_DIR, GAMES_DIR, name, parsed.to, pinners)
  console.log(`Renamed books/${name} → books/${parsed.to} (${rewritten.ids} ids, ${rewritten.pins} pins)`)
  sendJSON(res, 200, { ok: true, name: parsed.to, rewritten })
}

// NEW: POST /api/games/<g>/extract { name, title } — "SAVE AS A BOOK". The game's own
// layer is lifted into books/<name>/1/, every id re-minted into the new namespace, and the
// game left pinning it (books.js). It is a BOOK-mutating route, so it runs on the shelf's
// chain with the rest; it lives under /api/games because the subject is the GAME — the
// book does not exist yet to be addressed.
// The name/title step is POST /api/books's, verbatim: one rule, one place, and the
// receipt's `left` is the honest half — every sentence naming something that could not
// travel, because a feature that silently drops four of games/dino's four row facts has
// lied to its author.
const handleGameExtract = async (req, res, game) => {
  let parsed
  try { parsed = JSON.parse(await readBody(req)) } catch { return sendJSON(res, 400, { ok: false, error: "Body is not valid JSON" }) }
  const { name, problems } = newBookName({ title: parsed?.title, name: parsed?.name })
  if (problems.length > 0) return sendJSON(res, 400, { ok: false, error: `${problems[0].path} does not make a book name`, problems })
  const { moved, left } = await extractBook(BOOKS_DIR, GAMES_DIR, game, name, parsed.title.trim())
  console.log(`Extracted games/${game} → books/${name}/1 (${moved.types} types, ${moved.things} things, ${moved.rows} rows; ${left.length} stayed)`)
  left.forEach(sentence => console.log(`  left: ${sentence}`))
  sendJSON(res, 201, { ok: true, name, edition: 1, moved, left })
}

// NEW: POST /api/games { title } — the folder name is made from the title HERE
// (slugOf: one rule, one place — the receipt says which), refused by name before
// anything is touched, claimed by mkdir (games.js).
// CHANGED: { title, books? }. Books given are used as given — checked by
// content.json's own pins grammar, then read off the shelf, because a pin that
// names nothing is a game that cannot be played. Books NOT given means "build on
// Basic": the shelf's latest Basic if there is one, and nothing at all when the
// shelf is empty — so a newborn over an empty shelf is exactly the newborn v4 made.
const handleCreate = async (req, res) => {
  let parsed
  try { parsed = JSON.parse(await readBody(req)) } catch { return sendJSON(res, 400, { ok: false, error: "Body is not valid JSON" }) }
  const problems = titleProblems(parsed?.title)
  if (problems.length > 0) return sendJSON(res, 400, { ok: false, error: "title does not make a game name", problems })
  const title = parsed.title.trim()
  const name = slugOf(title)
  let pins
  if (parsed.books === undefined) {
    const edition = await latestEdition(BOOKS_DIR, "basic")
    pins = edition === null ? [] : [{ name: "basic", edition }]
  } else {
    const shapeProblems = pinProblems(parsed.books)
    if (shapeProblems.length > 0) return sendJSON(res, 400, { ok: false, error: "books is not a list of pins", problems: shapeProblems })
    pins = parsed.books
  }
  const books = await readBooks(BOOKS_DIR, pins)
  const missing = books.flatMap((layer, i) => layer === null
    ? [{ path: `books[${i}]`, message: `${JSON.stringify(pins[i].name)} ${pins[i].edition} is not on the shelf` }] : [])
  if (missing.length > 0) return sendJSON(res, 400, { ok: false, error: "books names a book that is not on the shelf", problems: missing })
  try {
    await createGame(GAMES_DIR, name, title, pins, books)
  } catch (error) {
    if (error.code === "EEXIST") return sendJSON(res, 409, { ok: false, error: `a CYOA named "${name}" already exists` })
    throw error                                   // → the 500 receipt in the dispatcher below
  }
  console.log(`Created games/${name} ("${title}")${pins.length > 0 ? ` on ${pins.map(pin => `${pin.name} ${pin.edition}`).join(", ")}` : ""}`)
  sendJSON(res, 201, { ok: true, name, title, books: pins })
}

// CHANGED: was the /api/save/<name> block, verbatim but for the game's folder.
// Own keys only. "constructor", "toString" and friends are names every plain
// object inherits, so SAVABLE_FILES["constructor"] is a FUNCTION, not a
// filename — and a lookup that found one would hand that function to join().
const handleSave = async (req, res, dir, name) => {
  const filename = Object.hasOwn(SAVABLE_FILES, name) ? SAVABLE_FILES[name] : undefined
  if (!filename) return sendJSON(res, 404, { ok: false, error: "Unknown save target" })
  // one failing save must never take the server down. Anything that throws in
  // here — a body cut off by a tab reload mid-Save, a read-only data file — becomes a
  // 500 receipt the editor can show, and a log line, instead of an unhandled
  // rejection that ends the whole process.
  try {
    const body = await readBody(req);
    console.log("Package contents:", body);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return sendJSON(res, 400, { ok: false, error: "Body is not valid JSON" })
    }
    // the border. Nothing is written unless the file fits the contract — every
    // file on its own; content.json (posted LAST by the editor, alone) also against
    // its four siblings on disk. A refusal names every problem and writes nothing.
    const problems = name === "content" ? await checkContent(dir, parsed) : validateFile(name, parsed)
    if (problems.length > 0) {
      console.log(`Refused ${filename}: ${problems.length} problem(s)`)
      problems.forEach(problem => console.log(`  ${problemText(problem)}`))
      return sendJSON(res, 400, { ok: false, error: `${filename} does not fit the schema`, problems })
    }
    await writeFile(
      join(dir, "data", filename),
      JSON.stringify(parsed, null, 2) + "\n"
    );
    sendJSON(res, 200, { ok: true })
  } catch (error) {
    console.log(`Save of ${filename} failed server side:`, error.message)
    sendJSON(res, 500, { ok: false, error: `${filename} was not written (${error.code ?? error.message})` })
  }
}

// NEW: POST /api/games/<name>/export — the publish script, run right here. It is
// synchronous and verifies in two child processes, so this server answers nothing
// else for the second or so it takes; one author, one machine — accepted (and two
// clicks cannot race the same dist/<name>). It exports what is ON DISK: an unsaved
// edit in the editor is not in it — which is why the editor's button saves first.
// export.mjs refuses the SOURCE before it touches dist/, so a refusal leaves the
// previous export intact.
const handleExport = (res, name) => {
  try {
    // CHANGED: the shelf goes too — the publisher flattens the pinned books into
    // the folder, so a player never needs the shelf the author built on.
    const { outDir, manifest } = exportGame({ game: name, sourceDir: gameDir(name), outDir: join(DIST_DIR, name), booksDir: BOOKS_DIR })
    console.log(`Exported ${name} → ${outDir}`)
    sendJSON(res, 200, { ok: true, name, outDir, preview: `/dist/${name}/`, files: Object.keys(manifest.files).length, rows: manifest.rows, items: manifest.items })
  } catch (error) {
    if (!(error instanceof ExportRefusal)) throw error
    console.log(`Export of ${name} refused: ${error.message}`)
    error.problems.forEach(problem => console.log(`  ${problemText(problem)}`))
    sendJSON(res, 400, { ok: false, error: error.message, problems: error.problems })
  }
}

// NEW: the three URL shapes that carry a game name. The name is [^/]+ here and
// isGameName (games.js) decides what it may be — one grammar for the folder and the URL.
// CHANGED (WP-6): + extract, the third thing a game can be asked to do.
const API  = /^\/api\/games\/([^/]+)\/(save\/([^/]+)|export|extract)$/
// NEW (§8): the shelf's write routes, ALL under /api/books — so every existing assertion
// about the static /books/… path survives verbatim and that drawer stays GET-only. Two
// shapes, because two of them are about a BOOK and three are about one EDITION of it.
// Name and edition are [^/]+ here; books.js's grammar decides what they may be, BEFORE
// either becomes a path component.
const BOOK_EDITION_API = /^\/api\/books\/([^/]+)\/([^/]+)\/(save|cut|delete)$/
const BOOK_API         = /^\/api\/books\/([^/]+)\/(rename|delete)$/
// one row per route, never a branch: own keys only, for the reason SAVABLE_FILES has it —
// "constructor" is a name every plain object inherits and a lookup that found one would
// call it.
const EDITION_ROUTES = {
  save:   (req, res, name, edition) => handleBookSave(req, res, name, edition),
  cut:    (req, res, name, edition) => handleBookCut(res, name, edition),
  delete: (req, res, name, edition) => handleBookDeleteEdition(res, name, edition)
}
const BOOK_ROUTES = {
  rename: (req, res, name) => handleBookRename(req, res, name),
  delete: (req, res, name) => handleBookDelete(res, name)
}
// NEW (WP-6): and the GAME's two non-save actions, as the same kind of table. `save` is
// not a row because it is the only one carrying a TARGET (the file name), so it stays the
// default — L3: handleSave's path is touched for routing and for nothing else. Extract
// writes the shelf, so it goes on the shelf's chain; export writes dist/ and does not.
const GAME_ROUTES = {
  export:  (req, res, name) => handleExport(res, name),
  extract: (req, res, name) => onShelf(() => handleGameExtract(req, res, name))
}
const PLAY = /^\/games\/([^/]+)(\/.*)?$/
const DIST = /^\/dist\/([^/]+)(\/.*)?$/
// NEW: the shelf, in a url. Two paths lead to the same file: /books/… (the
// editor, which lives at a fixed place and asks absolutely) and
// /games/<g>/books/… (the ENGINE, which asks page-relative for "books/basic/1/…"
// beside its "data/…" and must not learn that the shelf is somewhere else).
// Name and edition are [^/]+ here; books.js's grammar decides what they may be.
const BOOKS = /^\/books\/([^/]+)\/([^/]+)(\/.*)?$/

// The shelf as a DRAWER, the way data/ and assets/ are drawers of a game: the
// folder to serve from and the path inside it, or null when this is not a book.
// Only GET — the shelf is read-only, so a POST or a PUT under /books/ is not a
// route at all. bookFile answers the grammar question (and would answer the path
// question too); the root + sep guard below still draws the line at the drawer's
// door, so a ".." inside is the 403 it is everywhere else.
const shelfDrawer = (path, method) => {
  const shelved = method === "GET" ? path.match(BOOKS) : null
  if (shelved === null) return null
  const [, name, edition, rest] = shelved
  return bookFile(BOOKS_DIR, name, edition, rest) === null ? null : { root: bookDir(BOOKS_DIR, name, edition), rest }
}

const server = createServer(async (req, res) => {
  let root = ENGINE_DIR
  let assetGame = null                        // NEW: set for /games/<name>/assets/… — the search path runs after the guard
  console.log("Knock", req.method, req.url);
  res.setHeader("Cache-Control", "no-store");

  // ───────── the API ─────────
  // NEW: anything that throws in a route becomes a 500 receipt and a log line,
  // never the end of the process (the save route keeps its own net, so its
  // message stays "<file>.json was not written"). Every API path is answered
  // here; an unknown one is a 404 receipt, never an engine file.
  if (req.url.startsWith("/api/")) {
    try {
      if (req.url === "/api/games" && req.method === "GET") return await handleList(res)
      if (req.url === "/api/games" && req.method === "POST") return await handleCreate(req, res)
      if (req.url === "/api/books" && req.method === "GET") return await handleBooks(res)   // NEW: the shelf
      if (req.url === "/api/books" && req.method === "POST") return await onShelf(() => handleBookCreate(req, res))   // NEW
      // NEW: the shelf's five write routes. The grammar is the guard and it runs FIRST: a
      // name or an edition it refuses is a 404 and never reaches the disk, exactly as a
      // game name never does. Every one of them runs on the shelf's chain.
      const shelved = req.method === "POST" ? req.url.match(BOOK_EDITION_API) : null
      if (shelved) {
        const [, name, edition, action] = shelved
        if (!isBookName(name) || !isEditionName(edition)) return sendJSON(res, 404, { ok: false, error: `Unknown book ${JSON.stringify(name)} ${edition}` })
        if (!Object.hasOwn(EDITION_ROUTES, action)) return sendJSON(res, 404, { ok: false, error: "Unknown route" })
        return await onShelf(() => EDITION_ROUTES[action](req, res, name, Number(edition)))
      }
      const booked = req.method === "POST" ? req.url.match(BOOK_API) : null
      if (booked) {
        const [, name, action] = booked
        if (!isBookName(name)) return sendJSON(res, 404, { ok: false, error: `Unknown book ${JSON.stringify(name)}` })
        if (!Object.hasOwn(BOOK_ROUTES, action)) return sendJSON(res, 404, { ok: false, error: "Unknown route" })
        return await onShelf(() => BOOK_ROUTES[action](req, res, name))
      }
      const api = req.method === "POST" ? req.url.match(API) : null
      if (!api) return sendJSON(res, 404, { ok: false, error: "Unknown route" })
      const [, name, action, target] = api
      if (!gameExists(GAMES_DIR, name)) return sendJSON(res, 404, { ok: false, error: `Unknown CYOA ${JSON.stringify(name)}` })
      // CHANGED (WP-6): a row per named action, own keys only (see SAVABLE_FILES), with
      // save — the only one with a target — as the default.
      return Object.hasOwn(GAME_ROUTES, action) ? await GAME_ROUTES[action](req, res, name)
                                                : await handleSave(req, res, gameDir(name), target)
    } catch (error) {
      // NEW: a ShelfRefusal is a REFUSAL, not a failure — one sentence, the problems the
      // border found, and nothing written. One place turns it into a receipt so books.js
      // can refuse in the shelf's own words without knowing what a status code is.
      if (error instanceof ShelfRefusal) return sendRefusal(res, error)
      console.log(`${req.method} ${req.url} failed server side:`, error.message)
      return sendJSON(res, 500, { ok: false, error: `${req.method} ${req.url} failed (${error.code ?? error.message})` })
    }
  }

  // ───────── static files ─────────
  let urlPath = req.url;
  // CHANGED: "/" is the manager now. The engine at "/" had one game to load;
  // with the game in the URL there is nothing for it to load there.
  if (urlPath === "/" || urlPath === "/dinoEdit") {
    res.statusCode = 302;
    res.setHeader("Location", "/dinoEdit/");
    res.end();
    return;
  }
  if (urlPath.startsWith("/dinoEdit/")) {
    root = EDITOR_DIR;
    urlPath = urlPath.slice("/dinoEdit".length); // '/dinoEdit/main.js' → '/main.js'
    if (urlPath === "/") urlPath = "/index.html";
  }
  // NEW: the shelf at the root. ONE shelf for every game (that is what a book is
  // for), so it hangs off "/" rather than off a game — the editor asks here.
  // A name or an edition the grammar refuses is 404, never a look at the disk;
  // /books/basic/1 and /books/basic/1/ are 404 too (a folder is not a book).
  // CHANGED: only when the path still points at the root. The editor's prefix has
  // been stripped by now, so /dinoEdit/books.js arrives here as "/books.js" — and
  // the editor's own file must not be mistaken for a shelf url.
  const atRoot = root === ENGINE_DIR
  const shelved = atRoot && urlPath.startsWith("/books") ? shelfDrawer(urlPath, req.method) : null
  if (shelved !== null) {
    root = shelved.root;
    urlPath = shelved.rest;
  } else if (atRoot && urlPath.startsWith("/books")) {
    res.statusCode = 404;
    res.end("No such book");
    return;
  }
  // NEW: two prefixes carry a game name. Under /games/<name>/ the engine's own
  // files come from engine/ and data/ + assets/ from THAT game's folder: the
  // engine asks for "data/content.json" relative to its page, the page is
  // /games/<name>/index.html, so the browser asks /games/<name>/data/content.json
  // — no engine change. Under /dist/<name>/ everything comes from the exported
  // folder: it is self-contained, and serving it from here proves it. A bare
  // /games/<name> is redirected to the slash form for the same reason the
  // editor is: page-relative means "beside index.html", and at /games/<name>
  // "beside" would be /games/. A name the grammar refuses, or a game that is
  // not on disk, is 404 — the guard below still catches a ".." further along.
  // CHANGED: a path already answered by the shelf is not looked at again — the
  // rewrite above leaves the path INSIDE the book ("/assets/cannon.jpg"), and a
  // book that happened to hold a folder called games/ must not be read as one.
  const played = shelved === null ? urlPath.match(PLAY) : null, published = shelved === null ? urlPath.match(DIST) : null
  if (played || published) {
    const [, name, rest] = played ?? published
    if (!isGameName(name) || (played && !gameExists(GAMES_DIR, name))) {
      res.statusCode = 404;
      res.end("No such CYOA");
      return;
    }
    if (rest === undefined) {
      res.statusCode = 302;
      res.setHeader("Location", `${urlPath}/`);
      res.end();
      return;
    }
    urlPath = rest === "/" ? "/index.html" : rest
    if (published) root = join(DIST_DIR, name)
    // NEW: a THIRD drawer, and the only one that is not in the game's folder.
    // The engine asks for "books/basic/1/types.json" page-relative, beside its
    // "data/content.json"; under this server that is /games/<name>/books/… and it
    // lands on the same shelf /books/… serves. So the engine needs no url of its
    // own, and a published folder (which is flattened) never asks at all.
    else if (urlPath.startsWith("/books/")) {
      const shelf = shelfDrawer(urlPath, req.method)
      if (shelf === null) {
        res.statusCode = 404;
        res.end("No such book");
        return;
      }
      root = shelf.root;
      urlPath = shelf.rest;
    }
    else {
      // the root is the DRAWER (games/<name>/data or games/<name>/assets), not the
      // game folder, so the guard below draws its line at the drawer's door: a
      // "/assets/../data/…" climbs out of assets/ and is a 403, the same answer
      // as any other "..", instead of quietly finding the file next door.
      const drawer = ["data", "assets"].find(d => urlPath.startsWith(`/${d}/`))
      root = drawer ? join(gameDir(name), drawer) : ENGINE_DIR
      if (drawer) urlPath = urlPath.slice(drawer.length + 1)   // "/data/content.json" → "/content.json"
      if (drawer === "assets") assetGame = name                // NEW: this picture may belong to a book — the search path, below
    }
  }
  const requestedPath = join(root, urlPath);
  console.log("wants:", requestedPath);

  if (!requestedPath.startsWith(root + sep)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  // NEW: a picture is looked up along a SEARCH PATH — the game's own assets/
  // first, then each pinned book's, in layer order (books.js). The engine asks
  // for "assets/cannon.jpg" and does not know or care which layer put it there;
  // the published folder answers the same question with one flat assets/ that
  // the export copies. The guard above has already drawn the line at the game's
  // own door and assetPath draws it again at every book's. null = nobody has it.
  const filePath = assetGame === null ? requestedPath : await assetPath(GAMES_DIR, BOOKS_DIR, assetGame, urlPath)
  if (filePath === null) {
    res.statusCode = 404;
    res.end("File not found");
    return;
  }

  try {
    const content = await readFile(filePath);
    const type =
      MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.end(content);
  } catch (err) {
    if (err.code === "ENOENT") {
      res.statusCode = 404;
      res.end("File not found");
    } else {
      res.statusCode = 500;
      res.end("Something went wrong server side");
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server online at http://localhost:${server.address().port} - games: ${GAMES_DIR} - books: ${BOOKS_DIR}`);   // CHANGED: the games root — every game is served — and the shelf they all draw from
});
