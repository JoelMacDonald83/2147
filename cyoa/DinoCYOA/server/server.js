import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join, sep, extname, resolve } from "path";
// NEW: the contract, read from the sheet — the same module the EDITOR loads as
// /config/validate.js for its pre-flight (the game never runs it: it trusts what it
// loads). Node ≥ 22.7 runs the typeless engine modules as ESM by syntax detection
// (tools/oracles-logic.mjs has relied on it since v4); this server rides the same rule.
import { validateFile, validateSet, problemText } from "../engine/config/validate.js";
// NEW: the publisher, IMPORTED, not spawned. Its CLI only runs when the file is
// argv[1] (the oracles import it the same way), so this line runs nothing. A
// refusal arrives as an ExportRefusal carrying .problems — the same list the
// save route already speaks — instead of printed lines this file would parse.
import { exportGame, ExportRefusal } from "../tools/export.mjs";
// NEW: the games folder as functions — names, the list, the seed, the claim (games.js).
import { isGameName, gameExists, listGames, titleProblems, slugOf, createGame } from "./games.js";

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
const checkContent = async (dir, content) => {
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
  return unreadable.length > 0 ? [...validateFile("content", content), ...unreadable] : validateSet(set)
}

// ───────────── the API, one function per route ─────────────

// NEW: GET /api/games — the home screen's list, read fresh from disk each time
const handleList = async (res) => sendJSON(res, 200, { ok: true, games: await listGames(GAMES_DIR, DIST_DIR) })

// NEW: POST /api/games { title } — the folder name is made from the title HERE
// (slugOf: one rule, one place — the receipt says which), refused by name before
// anything is touched, claimed by mkdir (games.js).
const handleCreate = async (req, res) => {
  let parsed
  try { parsed = JSON.parse(await readBody(req)) } catch { return sendJSON(res, 400, { ok: false, error: "Body is not valid JSON" }) }
  const problems = titleProblems(parsed?.title)
  if (problems.length > 0) return sendJSON(res, 400, { ok: false, error: "title does not make a game name", problems })
  const title = parsed.title.trim()
  const name = slugOf(title)
  try {
    await createGame(GAMES_DIR, name, title)
  } catch (error) {
    if (error.code === "EEXIST") return sendJSON(res, 409, { ok: false, error: `a CYOA named "${name}" already exists` })
    throw error                                   // → the 500 receipt in the dispatcher below
  }
  console.log(`Created games/${name} ("${title}")`)
  sendJSON(res, 201, { ok: true, name, title })
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
    const { outDir, manifest } = exportGame({ game: name, sourceDir: gameDir(name), outDir: join(DIST_DIR, name) })
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

const server = createServer(async (req, res) => {
  let root = ENGINE_DIR
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
  const played = urlPath.match(PLAY), published = urlPath.match(DIST)
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
    else {
      // the root is the DRAWER (games/<name>/data or games/<name>/assets), not the
      // game folder, so the guard below draws its line at the drawer's door: a
      // "/assets/../data/…" climbs out of assets/ and is a 403, the same answer
      // as any other "..", instead of quietly finding the file next door.
      const drawer = ["data", "assets"].find(d => urlPath.startsWith(`/${d}/`))
      root = drawer ? join(gameDir(name), drawer) : ENGINE_DIR
      if (drawer) urlPath = urlPath.slice(drawer.length + 1)   // "/data/content.json" → "/content.json"
    }
  }
  const requestedPath = join(root, urlPath);
  console.log("wants:", requestedPath);

  if (!requestedPath.startsWith(root + sep)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(requestedPath);
    const type =
      MIME_TYPES[extname(requestedPath)] ?? "application/octet-stream";
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
  console.log(`Server online at http://localhost:${server.address().port} - games: ${GAMES_DIR}`);   // CHANGED: the games root — every game is served
});
