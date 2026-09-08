import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join, sep, extname, resolve } from "path";
// NEW: the contract, read from the sheet — the same module the EDITOR loads as
// /config/validate.js for its pre-flight (the game never runs it: it trusts what it
// loads). Node ≥ 22.7 runs the typeless engine modules as ESM by syntax detection
// (tools/oracles-logic.mjs has relied on it since v4); this server rides the same rule.
import { validateFile, validateSet, problemText } from "../engine/config/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_NAME = process.argv[2] ?? "dino"

const ENGINE_DIR = join(__dirname, "..", "engine")
// CHANGED: CYOA_GAME_DIR points the server at a game folder ANYWHERE (the oracle's scratch
// copy of a game); unset, it is games/<name> exactly as before. resolve() makes the value
// absolute and drops a trailing slash — the path-escape guard below compares against
// root + sep, and "/x/dino/" + sep would never match a path join() has normalised.
const GAME_DIR = process.env.CYOA_GAME_DIR ? resolve(process.env.CYOA_GAME_DIR) : join(__dirname, "..", "games", GAME_NAME)
const EDITOR_DIR = join(__dirname, "..", "dinoEdit")
// NEW: PORT=0 means "any free port" (the oracle reads the real one from the banner); unset = 3000 as before
const PORT = Number(process.env.PORT ?? 3000)

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

// NEW: content.json carries every cross-reference, so it is checked with its four
// siblings AS THEY SIT ON DISK RIGHT NOW — read fresh each time, because a hand-edit
// since the last save must count. A sibling that cannot be read is itself a problem:
// the set is not whole, so content.json is not saved.
const checkContent = async (content) => {
  const set = { content }
  const unreadable = []
  for (const name of ["rules", "themes", "types", "things"]) {
    try {
      set[name] = JSON.parse(await readFile(join(GAME_DIR, "data", SAVABLE_FILES[name]), "utf8"))
    } catch (error) {
      set[name] = null
      unreadable.push({ path: name, message: `${SAVABLE_FILES[name]} on disk cannot be read (${error.code ?? error.message}) — save it first` })
    }
  }
  return unreadable.length > 0 ? [...validateFile("content", content), ...unreadable] : validateSet(set)
}

const server = createServer(async (req, res) => {
  let root = ENGINE_DIR
  console.log("Knock", req.method, req.url);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST" && req.url.startsWith("/api/save/")) {
    const name = req.url.slice('/api/save/'.length)
    // CHANGED: own keys only. "constructor", "toString" and friends are names every
    // plain object inherits, so SAVABLE_FILES["constructor"] is a FUNCTION, not a
    // filename — and a lookup that found one would hand that function to join().
    const filename = Object.hasOwn(SAVABLE_FILES, name) ? SAVABLE_FILES[name] : undefined
    if (!filename) {
      res.statusCode = 404
      res.setHeader("Content-Type", "application/json; charset=utf-8")
      res.end(JSON.stringify({ ok: false, error: "Unknown save target" }))
      return
    }
    // NEW: one failing save must never take the server down. Anything that throws in
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
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: "Body is not valid JSON" }));
        return;
      }
      // NEW: the border. Nothing is written unless the file fits the contract — every
      // file on its own; content.json (posted LAST by the editor, alone) also against
      // its four siblings on disk. A refusal names every problem and writes nothing.
      const problems = name === "content" ? await checkContent(parsed) : validateFile(name, parsed)
      if (problems.length > 0) {
        console.log(`Refused ${filename}: ${problems.length} problem(s)`)
        problems.forEach(problem => console.log(`  ${problemText(problem)}`))
        res.statusCode = 400
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(JSON.stringify({ ok: false, error: `${filename} does not fit the schema`, problems }))
        return
      }
      await writeFile(
        join(GAME_DIR, "data", filename),
        JSON.stringify(parsed, null, 2) + "\n"
      );

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      console.log(`Save of ${filename} failed server side:`, error.message)
      res.statusCode = 500
      res.setHeader("Content-Type", "application/json; charset=utf-8")
      res.end(JSON.stringify({ ok: false, error: `${filename} was not written (${error.code ?? error.message})` }))
    }
    return
  }

  let urlPath = req.url === "/" ? "/index.html" : req.url;
  if (urlPath === "/dinoEdit") {
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
  if (urlPath.startsWith("/data/") || urlPath.startsWith("/assets/")) {
    root = GAME_DIR
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
  console.log(`Server online at http://localhost:${server.address().port} - game: ${GAME_NAME}`);   // CHANGED: the real port (PORT=0 picks one)
});
