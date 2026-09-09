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
import { validateGame } from "../engine/config/merge.js";
// NEW: the publisher, IMPORTED, not spawned. Its CLI only runs when the file is
// argv[1] (the oracles import it the same way), so this line runs nothing. A
// refusal arrives as an ExportRefusal carrying .problems — the same list the
// save route already speaks — instead of printed lines this file would parse.
import { exportGame, ExportRefusal } from "../tools/export.mjs";
// NEW: the games folder as functions — names, the list, the seed, the claim (games.js).
import { isGameName, gameExists, listGames, titleProblems, slugOf, createGame } from "./games.js";
// NEW: the books folder as functions — the shelf's grammar, the loader the merge
// eats, the listing the Library paints, the asset search path (books.js).
import { bookDir, bookFile, readBooks, listBooks, latestEdition, assetPath, pinProblems } from "./books.js";

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

// NEW: GET /api/books — the whole shelf, loudly: every folder, every edition,
// and what is wrong with the ones that are wrong (books.js).
const handleBooks = async (res) => sendJSON(res, 200, { ok: true, books: await listBooks(BOOKS_DIR) })

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
const API  = /^\/api\/games\/([^/]+)\/(save\/([^/]+)|export)$/
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
      const api = req.method === "POST" ? req.url.match(API) : null
      if (!api) return sendJSON(res, 404, { ok: false, error: "Unknown route" })
      const [, name, action, target] = api
      if (!gameExists(GAMES_DIR, name)) return sendJSON(res, 404, { ok: false, error: `Unknown CYOA ${JSON.stringify(name)}` })
      return action === "export" ? handleExport(res, name) : await handleSave(req, res, gameDir(name), target)
    } catch (error) {
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
