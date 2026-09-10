// The v5 faithfulness oracles, runnable from the repo with plain node:
//
//   node cyoa/DinoCYOA/tools/oracles.mjs            (both games)
//   node cyoa/DinoCYOA/tools/oracles.mjs vampire    (one game)
//
// This file starts by running the fast logic oracles (oracles-logic.mjs, L/V/K/N,
// pure, milliseconds) and then runs the slow half — the checks that need git,
// temp dirs, child processes, the REAL server and the REAL shelf:
//
//   A1 determinism, mint-free   v3 → v5 migrated twice is byte-identical; no uuid minted or lost
//   A2 climb                    v2 → v5 equals v3 → v5 (modulo the ids step 2 mints); v1 → v5 equals v2 → v5
//   A3 v4 → v5 (NEW)            the COMMITTED v4 files climb the last step twice identically; every field id once, inside a section
//   A4 v5 → v6 (NEW, with A3)   the COMMITTED files climb to 6: byte-equal to a literal that is those bytes plus the stamps, `sheet: ""` and one `fills` per row
//   A5 v6 → v7 (NEW, v7)        the COMMITTED files climb to 7: their own bytes plus FIVE version lines, and no `demands` key invented
//   B1 idempotence              save → reload → migrate (no-op) → render-time write → save: five files byte-identical
//   B2 canonical shapes         every key order the editor and the engine rely on, for a migrated set
//   B3 missing files by name    a v3 OR v5 set without types/things fails at the border and NAMES them
//   B5 canonical v5 shapes (NEW) §2.8 over the migrated set and (dino) the REBUILT files: sections, fieldDefs, thing key orders
//   B6 canonical v6 shapes (NEW, with B5) games/dino ON DISK: sheet after books, label,fills override slots, merged rows id,label,query,fills,showWhen,children
//   B7 canonical v7 shapes (NEW, v7) `demands` is a thing's FIFTH key and its own three are field,op,value; no file in the project spells `"demands": []`
//   C1 bridge v3                the REAL v3 engine (git) and the v5 engine hydrate v3 data alike
//   C2 bridge v2                the REAL v2 engine (git) and the v5 engine hydrate v2 data alike
//   C3 working tree             the v5 engine hydrates games/<game> with zero warnings
//   C4 relative paths           data/… and books/… page-relative, assets/… built — never absolute
//   C5 bridge v4 (NEW)          the REAL v4 engine (git) and the v5 engine hydrate the committed v4 data alike, and play alike
//   C6 bridge v5 (NEW)          the REAL v5 engine and the v5 SHELF (git) and the v6 engine hydrate the committed data alike, and play alike
//   C7 vampire untouched (NEW)  the v6 engine over the committed v4 vampire: no sheet, no binding, no book url, no warning
//   C8 bridge v6 (NEW, v7)      the REAL v6 engine and the v7 engine hydrate and PLAY the committed data alike — a stamp-only migration changed nothing; vampire still warns zero times
//   G1 border loudness          a hand-broken set warns ONCE per fault, by row, and fails closed
//   G2 border loudness, books (NEW)   the §5.3 shelf warns `Book fault — …` once per fault; a pin at edition 3 fails CLOSED
//   G3 border loudness, the sheet (NEW) five broken games: one warning each, in §3.10's wording, each failing closed
//   G4 border loudness, demands (NEW, v7) five broken games: ONE warning each by the thing's name, each failing CLOSED — the entry is not on sale
//   T1 the committed shelf (NEW)      what books/ holds, that every book validates, that every file is canonical
//   T2 editions (NEW)                 edition 2 is edition 1 plus exactly one thing
//   T3 the shelf's version (NEW)      every data file on the shelf says SCHEMA_VERSION and moved no other byte
//   T4 the shelf's demands (NEW, v7)  no book on the shelf authors one (§12.1's decision, asserted); every book still validates
//       T1–T4's subject is THE COMMITTED SHELF — books/ as real, hand-authored DATA that must
//       not drift. It is not a claim that no shelf can be written: a scratch shelf is a
//       different subject and the checks that write one say so. The anchor below the T-heading
//       keeps the four pointed at the committed bytes and at nothing else.
//   W1 the shelf's placement fields (NEW) Gear ships quantity/number/1, Skills level/number/1, and nobody else a `quantity`
//   R6 the id census (NEW, stage 4)   every id-shaped string under books/** and games/** sits where
//       engine/config/ids.js's walk reaches, found by two hand-typed regexes that know nothing of the
//       marker tables; a total rename leaves no old string in the bytes; A→B→A is byte-identical; and
//       breaking a marker in memory turns both halves red. R1–R5, the fixture half, are in oracles-logic
//   D1 rebuild in-process (NEW)       the rebuilt dino plays EXACTLY what the v4 dino played, row by row, item by item
//   D2 rebuild CLI (NEW)              exit 0 writes D1's bytes; a second run exits 1; a partial state or a short shelf exits 2
//   D3 play replay (NEW)              I1's four steps over the rebuilt files + the shelf
//   D4 the pin is real (NEW)          edition 2 puts Nest in the Lairs row; edition 3 fails closed
//   D5 committed data (NEW)           once games/dino is rebuilt it byte-equals D1 (skipped until then)
//   D6 the dino data edit (NEW)       one declaration, four bindings, zero faults — and D1's projection, unchanged
//   D7 dino unchanged (NEW, v7)       five version lines and nothing else; no demand authored; D1's projection, item for item
//   W2 play with values (NEW)         §2.6's fifteen steps and its fifteen numbers, refusal and refund included
//   W3 the sheet's content (NEW)      gameState.sheet IS §2.4; the shell gained one element; the print block; two new engine files
//   W4 keep and load (NEW)            a child keeps, a FRESH child loads, and the two hold the same sheet — byte for byte
//   W5 a kept sheet meets a changed game (NEW) nine fixtures: eight notes and one refusal, nothing guessed
//   W7 play with demands (NEW, v7)    the PAINTED page: `Locked`, the `Needs:` line, the unmet clause, the printed `Would break …`, the unlock and the cascade
//   W8 kept sheets meet changed demands (NEW, v7) four fixtures: the note names the entry and its rule; KEPT_VERSION is still 1
//   W9 the caret rule survives (NEW, v7) `input` does not repaint or settle; `change` does both; a game with no demand attaches no listener at all
//   I1 play (dino)              pick a Lair → Location appears; unpick → it hides, refunds, and says so
//   I2 editor save order, books (NEW) a new pet placed INTO a book sheet, plus a things.order swap, land in the editor's order
//   I3 the editor round-trip and templates (NEW, v7) driven through the editor's OWN paint: `demands` fifth and once, deleted when emptied; "+ Add X from Y"
//   S1 committed files fit      validateGame says [] over the committed, migrated and climbed sets
//   S2 route refuses            a bad body is a 400 that names every path and writes nothing
//   S3 editor order end-to-end  four in parallel then content; a new type + thing + row + slot lands
//   S4 checked against disk     content is refused while a sibling ON DISK is hand-broken, unparsable or missing
//   S5 the shelf's routes (NEW) /books/… and /games/<g>/books/…; the asset search path; traversal
//   S6 save against the pins (NEW)    content.json is judged WITH the shelf: F1, F3, F15 by path, nothing written
//   S8 the server judges the binding (NEW) a bad `fills` or a bad `sheet` → 400 at its path, nothing written
//   S9 the server judges a demand (NEW, v7) shape faults at things.json, reference faults at content.json — each at its exact key, nothing written
//   S7 the engine over HTTP (NEW)     5 data + 12 book urls, page-relative; every image whole
//   E1 exact file set           engine/ + data/ + assets/ + the manifest, nothing else; manifest keys fixed
//   E2 bytes                    a book-less game's data travels as its own bytes; sizes and sha256 true to the manifest
//   E3 folder hydrates          the folder plays exactly like the source, page-relative, every image present
//   E4 subpath serving          the engine over real HTTP under /site/<game>/
//   E5 idempotent               a second export is byte-identical; a stray file is rebuilt away
//   E6 refuses old data         a v4 game is refused by version; nothing written
//   E7 refuses a dangle         a dangling row or a missing image is refused with its path; the previous export survives
//   E8 wipe safety              only a marked or empty folder is written; the source, the shelf and the project are never targets
//   E9 CLI                      exit 0 prints the tree; usage exits 1; refusals exit 2 and write nothing
//   E10 ignore rules            .gitignore holds .DS_Store and dist/; git ignores both
//   E11 export flatten (NEW)    the published dino is the FLATTENED merge and needs no shelf
//   W6 the published folder (NEW)     the whole of the player's sheet, with no shelf and no server
//   E12 assets (NEW)            the union of the game's and the books' assets/, one flat folder, collisions refused
//   E13 refusals, books (NEW)   a pin off the shelf, a broken shelf, --out inside books/ — all refused, nothing written
//   E14 the published folder plays them (NEW, v7) a demand survives the flatten; the folder paints the same page with no shelf and no server
//   M1 GET /api/games           every folder with title, version, books, counts, faults, exported flag
//   M2 addresses                / → /dinoEdit/; /games/<name>/ serves the engine and hydrates over HTTP page-relative
//   M3 POST /api/games          a newborn from the sheets, over a scratch SHELF: it pins basic 1 and hydrates clean
//   M4 create refusals          bad titles → 400 at title, repeat → 409, not-JSON → 400; nothing written
//   M5 two games, one server    both save in the editor's order, isolated; unknown game → 404 on every route
//   M6 export + /dist/          the route writes exportGame's bytes; /dist/<name>/ hydrates alone
//   M7 traversal and case       literal "..", %2e%2e, Dino, dino%2F..%2F → 403/404, never a server file
//   M8 launch.json              one "cyoa" entry, no game argument, port 3000
//   M9 scratch only             the real games/, dist/ AND books/ are byte-identical to before the run
//   M10 the seed pins Basic (NEW)     POST /api/games over a scratch shelf; books given, books empty, an empty shelf
//   M11 GET /api/books (NEW)          every folder, every edition, the counts and the problems
//   M12 no check writes the real shelf (RE-AIMED) books/ is byte-identical after the whole
//       run, AND the scratch-shelf mechanism that makes that true is asserted to be in use
//       — test hygiene, which is all this check ever proved. "An edition is frozen" is a
//       different promise and it is M13's.
//   M13 the freeze, POSITIVELY (NEW, stage 4) an edition a game pins refuses a save, a delete of
//       itself and a delete of its whole book — each naming the game, each moving no byte; a CUT
//       is allowed (it is what the refusal points at); the same writes one edition along, which
//       nobody pins, are accepted; and moving the pin moves the freeze with it
//   M14 POST /api/books (NEW)         the newborn's four files written out literally, and 10 refusals
//   M15 …/<e>/save (NEW)              the WHOLE book in one request; 9 refusals, nothing written
//   M16 …/<e>/cut and …/delete (NEW)  a copy plus more, assets included; the last edition takes the folder
//   M17 …/rename (NEW)                the name IS the namespace — ids, references and pins, counted independently
//   M18 the seam between routes (NEW) create → cut → delete → create again: no shared folder, no empty book
//   M19 a staging folder (NEW)        a stale <edition>.tmp and <book>.tmp are invisible to every reader
//   M20 ONE freeze sentence (NEW)     the editor's copy of the three is the server's own, word for word
//   M21 POST /api/games/<g>/extract (NEW) "save as a book": vampire's 64 UUIDs re-minted, dino's
//       four row facts left behind with a sentence each, and both games PLAY WHAT THEY PLAYED
//   I4  the editor opens a BOOK (NEW) through its own paint: reading writes nothing, frozen or not
//   I5  the home screen's LIBRARY (NEW) painted by its own code: the freeze as a fact on screen
//   I6  the SUBJECT TABLE (NEW)        spec §2's owed sweep: every attachment's `entry.file` is a
//       ROLE the drawers table answers, for BOTH kinds — which is the only thing standing
//       between `null` (silent, by design) and `undefined` (a warning on every paint)
//
// RETIRED, with the reason: H1–H4 (tools/restructure-v4.mjs). That script's
// PRECONDITION — a v4 set read from the working tree's border — no longer exists
// at SCHEMA_VERSION 5: migrateSet climbs straight past 4, so restructure-v4 can
// never be handed the shape it was written for. Its RESULT is pinned instead by
// the v4 data commit (V4_COMMIT) that A3 and C5 read, and the "one-off data
// script" oracle is now the D-checks over tools/rebuild-dino-v5.mjs. S1 drops
// its "restructured" set with them.
//
// NEW (v7, and two more in stage 4): four child modes, all about what a PERSON sees — or,
// for --subject, about the one table that decides what a person is looking at.
//   --paint  the engine's real app.js and view.js over a tiny hand-written DOM, so
//            W7, W9 and E14 can read the words and classes on a card and press the
//            button a player would press. The DOM is deliberately small and dumb —
//            no layout, no CSS — because what is checked is which words the engine
//            puts on the page, and a fuller fake would only be more code to be wrong
//            in. It is written here rather than pulled in: no npm, no build step.
//   --subject  dinoEdit/subject.js, the PURE half of the subject table, read out of the copy and
//            with every column evaluated over named sample states, because a function cannot
//            cross a pipe (I6).
//   --library  the home screen's Library (dinoEdit/library.js), painted from two receipts and
//            nothing else — renderLibrary fetches nothing, only a click does — so one fixture
//            holds a frozen edition, an unreadable one and a mis-named folder at once (I5).
//   --edit   the EDITOR's real view.js, painted the same way, for I3. Its modules
//            import "/config/…" — the one url the dev server maps onto engine/config/
//            (M2) — and node has no import map, so it runs out of a scratch copy with
//            that ONE mapping applied; I3 asserts the rewrite was only that.
//
// Data for the migration and bridge checks always comes from git (the pins
// below), never from the working tree — so rebuilding the committed data cannot
// make those checks drift. The engines under comparison come from git too (git
// archive), untouched. Each hydration runs in its own node process
// (--hydrate / --hydrate-http / --play modes, below) because gameConfig.js does
// its loading at import time, once per process. The S checks run the REAL server
// (server/server.js) on a free port over a scratch GAMES root (CYOA_GAMES_DIR),
// a scratch dist root (CYOA_DIST_DIR) and a scratch SHELF (CYOA_BOOKS_DIR); the
// E checks run the real export tool in-process and as a CLI. Nothing here ever
// writes under the real games/, dist/ or books/ — M9 and M12 hash all three
// before the first check and after the last one.

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
// FOUR pins now. The engine is byte-identical at the two v3 pins, so the v3
// engine is archived from the ENGINE pin and the v3 files are read from the DATA
// pin. NEW: V4_COMMIT is the v4 engine AND both games at v4 on disk — the last
// commit before the books arc, and the reference every "does v5 still play what
// v4 played?" check compares against.
const V2_COMMIT = process.env.CYOA_V2_COMMIT ?? '79b5ec4'            // v2 engine + v2 data
const V3_ENGINE_COMMIT = process.env.CYOA_V3_ENGINE_COMMIT ?? '11e46a2'
const V3_DATA_COMMIT = process.env.CYOA_V3_DATA_COMMIT ?? '2ab45f0'  // both games at v3 on disk
const V4_COMMIT = process.env.CYOA_V4_COMMIT ?? '1393b3e'            // NEW: v4 engine + both games at v4
// NEW (v6): the last commit of the v5 world — the v5 engine, the v5 SHELF and
// both games exactly as committed. It is what C6 bridges against (does a v6
// engine still play what the v5 engine played?) and what A4 climbs.
const V5_COMMIT = process.env.CYOA_V5_COMMIT ?? 'dee73a2'
// NEW (v7): the last commit of the v6 world — tag v6---player-sheet. T3 asks "the
// ONLY byte that moved on the shelf is the stamp", and that question is always about
// the PREVIOUS EDITION: at v6 the previous edition was V5_COMMIT, at v7 it is this
// one. The two pins are kept apart because they answer different questions — V5_COMMIT
// is "what did the v5 world play?" (C6, A4) and never moves again.
const V6_COMMIT = process.env.CYOA_V6_COMMIT ?? '8453da8'
const GIT_ROOT = process.env.CYOA_GIT_REPO
  ?? execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: DINO_DIR, encoding: 'utf8' }).trim()
const FILES = ['content', 'rules', 'themes', 'types', 'things']
const OPTIONAL_FILES = ['types', 'things']   // absent before v3 — reading them may come back null
const BOOK_FILE_NAMES = ['book', 'types', 'things', 'proposals']
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const REAL_BOOKS = join(DINO_DIR, 'books')   // READ-ONLY here, always: M12 hashes it
// NEW (stage 4): the two registries M12 reads. A check that needs a shelf it can
// WRITE takes a COPY (copyShelf) and points the server at it through CYOA_BOOKS_DIR.
// M12 used to prove that by hashing books/ and finding it unmoved — which was free
// while nothing in the project could write to a shelf at all. These two say the
// mechanism is genuinely IN USE, so the proof cannot pass because nobody tried.
const scratchShelves = []    // every copy copyShelf made, in the order it made them
const servedShelves = []     // every shelf a REAL server was pointed at (CYOA_BOOKS_DIR)

// the server's exact on-disk format
const serialize = (obj) => JSON.stringify(obj, null, 2) + '\n'

// ───────────────────────── child modes ─────────────────────────
// Every child serves <gameDir>/data/*.json to the engine through a fake fetch,
// captures console.warn, and prints ONE JSON object on stdout — nothing else may
// reach stdout, because the parent JSON.parses it.
// Every url the engine asks for is RECORDED into `fetched` before the lookup —
// the parent checks the spelling, not just the answer. The lookup itself:
// join(gameDir, url) accepts 'data/x.json' (the v4/v5 engines, page-relative)
// and '/data/x.json' (the v2 and v3 engines from git) alike, because join treats
// a leading slash on a later segment as nothing.
// CHANGED: a url under books/ is answered from `booksDir` — the SHELF, which is
// not in the game's folder. With no booksDir every book url is a 404, which is
// exactly what a published (flattened) folder is: no shelf on disk, and nothing
// that asks for one.
const BOOKS_PREFIX = 'books/'
const installFakeFetch = (gameDir, fetched = [], booksDir) => {
  globalThis.fetch = async (url) => {
    fetched.push(url)
    const rel = url.startsWith('/') ? url.slice(1) : url
    try {
      if (rel.startsWith(BOOKS_PREFIX) && booksDir === undefined) throw new Error('no shelf here')
      const text = readFileSync(rel.startsWith(BOOKS_PREFIX) ? join(booksDir, rel.slice(BOOKS_PREFIX.length)) : join(gameDir, url), 'utf8')
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

// The hydrated groups, summarized. The summary projects ONLY the fields the v2,
// v3, v4 and v5 engines all produce (a v5 row also carries query and fields; a
// v3 row carried displayType) — that is what lets C1, C2 and C5 deepEqual across
// engines. Keep it that way: a field only one engine has would make every bridge
// fail. `showWhen` is the one exception — the v2 and v3 engines have none, so
// noGates() strips it for those two bridges and project() reads it for the rest.
const summarize = (groups) => groups.map(group => ({
  id: group.id,
  label: group.label,
  min: String(group.min),               // Infinity does not survive JSON
  max: String(group.max),
  background: group.background,
  showWhen: group.showWhen ?? null,
  items: group.items.map(item => ({
    // the v4 and v5 engines build page-relative URLs (assets/x.jpg) so a
    // published folder works from any subpath; the v2 and v3 engines from git
    // still build /assets/x.jpg. Same file, two spellings — the leading slash is
    // dropped here so the bridges compare FILES, not spellings.
    id: item.id, name: item.name, cost: item.cost, imageURL: item.imageURL.replace(/^\//, ''),
    label: item.label, traits: item.traits
  })),
  children: summarize(group.children)
}))

// node oracles.mjs --hydrate <engineDir> <gameDir> [<booksDir>]
if (process.argv[2] === '--hydrate') {
  const [engineDir, gameDir, booksDir] = process.argv.slice(3)
  const warnings = captureWarnings()
  const fetched = []
  installFakeFetch(gameDir, fetched, booksDir)
  const mod = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const heroImage = mod.pageTheme?.heroImage ?? null
  const flat = (rows) => rows.flatMap(row => [row, ...flat(row.children)])
  // the item images UNSTRIPPED and distinct — summarize() drops a leading slash
  // so the bridges can compare files across engines; C4 pins the v5 spelling here
  const images = [...new Set(flat(mod.groups).flatMap(row => row.items.map(item => item.imageURL)).filter(Boolean))].sort()
  // one hydrated thing, whole, so D1 can pin a pet's placements and its Stats defaults
  const sample = (id) => flat(mod.groups).flatMap(row => row.items).find(item => item.id === id) ?? null
  const wanted = (process.env.CYOA_SAMPLE ?? '').split(',').filter(Boolean)
  const samples = Object.fromEntries(wanted.map(id => [id, sample(id)]))
  // NEW (v6): what the game says the PLAYER builds, and where each row's picks
  // land. Both are `null` under every engine before v6 (the modules export no
  // such name, and a hydrated row had no `fills`), which is exactly what lets the
  // bridges keep comparing whole answers.
  const playerSheet = mod.playerSheet == null ? null : {
    id: mod.playerSheet.id, label: mod.playerSheet.label,
    fields: mod.playerSheet.fields.map(field => ({ key: field.key, type: field.type, default: field.default })),
    sections: mod.playerSheet.sections.map(section => ({ id: section.id, key: section.key, kind: section.kind, of: section.of ?? null }))
  }
  const bindings = flat(mod.groups).map(row => ({ id: row.id, label: row.label, fills: row.fills?.id ?? null, quantityField: row.quantityField?.key ?? null, items: row.items.length }))
  // writeSync, not process.stdout.write: on macOS a write to a pipe is asynchronous,
  // and process.exit right after it would drop everything past the 64 KB pipe buffer
  writeSync(process.stdout.fd, JSON.stringify({ warnings, fetched, heroImage, images, samples, playerSheet, bindings, totalBudget: mod.totalBudget ?? null, groups: summarize(mod.groups) }))
  process.exit(0)
}

// node oracles.mjs --play <engineDir> <gameDir> <stepsJSON> [<booksDir>]
// Imports the engine's real state.js (which imports gameConfig through the fake
// fetch) and PLAYS. The warnings are captured, not silenced — a warning is a
// finding. CHANGED: the lines state.js prints with console.log (its refusals:
// "… is not shown", "… costs 2 more, but only 1 left") are captured too rather
// than dropped, because W2.9 asserts one of them verbatim. stdout still carries
// nothing but the one JSON object the parent parses.
//
// A STEP is one of five shapes, and they are told apart by the keys they carry:
//   { row, thing }                 toggle a pick            (v2 → v6: every old check)
//   { row, thing, by }             step that pick's quantity            (NEW, v6)
//   { row, thing, field, value }   set one placement value on that pick (NEW, v6)
//   { field, value }               type into one sheet slot             (NEW, v6)
//   { load }                       load a kept sheet, whole             (NEW, v6)
if (process.argv[2] === '--play') {
  const [engineDir, gameDir, stepsJSON, booksDir] = process.argv.slice(3)
  const warnings = captureWarnings()
  const logs = []
  console.log = (...parts) => logs.push(parts.join(' '))
  installFakeFetch(gameDir, [], booksDir)
  const { gameState } = await import(pathToFileURL(join(engineDir, 'state.js')).href)
  const { groups, playerSheet } = await import(pathToFileURL(join(engineDir, 'config', 'gameConfig.js')).href)
  const { flattenGroups } = await import(pathToFileURL(join(engineDir, 'helpers.js')).href)
  const allGroups = flattenGroups(groups)
  // The snapshot gains EXACTLY two keys, and both are `?? null`: the v2, v3, v4
  // and v5 engines have no such getter, so both sides of every bridge read null
  // and I1/C5/C6 can go on comparing whole snapshots. Anything richer (the typed
  // half, the values store, the notice, the captured log) would differ by shape
  // between two engines, so it travels in `final` instead — and only when asked.
  const snapshot = () => ({
    visible: [...gameState.visible],
    dropped: gameState.dropped.map(item => item.name),
    spent: gameState.spent,
    remaining: gameState.remaining,
    unmet: gameState.unmetGroups.map(group => group.id),
    sheet: gameState.sheet ?? null,
    kept: gameState.keptText ?? null
  })
  const { visible, unmet } = snapshot()
  const steps = JSON.parse(stepsJSON).map((step) => {
    if (step.load !== undefined) { gameState.loadKept(step.load); return snapshot() }
    if (step.row === undefined) { gameState.setTyped(playerSheet.fields.find(field => field.key === step.field), step.value); return snapshot() }
    const group = allGroups.find(group => group.id === step.row)
    const item = group.items.find(item => item.id === step.thing)
    if (step.by !== undefined) gameState.stepQuantity(group, item, step.by)
    else if (step.field !== undefined) gameState.setValue(group, item, group.fills.placement.find(field => field.key === step.field), step.value)
    else gameState.toggleSelection(group, item)
    return snapshot()
  })
  // CYOA_PLAY_STATE=1 asks for the whole of what the player is left holding —
  // the two stores, the selections as ids, the status line, the sheet and the
  // keepsake's bytes. It is left OUT by default so that the answer's SHAPE is the
  // same under a v2 engine and a v6 one, which is what the bridges compare.
  const final = process.env.CYOA_PLAY_STATE !== '1' ? undefined : {
    typed: gameState.typed ?? null,
    values: gameState.values ?? null,
    selections: Object.fromEntries(allGroups.map(group => [group.id, gameState.selections[group.id].map(item => item.id)])),
    notice: gameState.notice ?? null,
    status: gameState.statusMessage,
    spent: gameState.spent,
    remaining: gameState.remaining,
    visible: [...gameState.visible],
    sheet: gameState.sheet ?? null,
    kept: gameState.keptText ?? null,
    logs
  }
  writeSync(process.stdout.fd, JSON.stringify({ warnings, start: { visible, unmet }, steps, ...(final === undefined ? {} : { final }) }))   // sync, see --hydrate
  process.exit(0)
}

// ───────────────────────── the paint child's DOM ─────────────────────────
// NEW (v7): four checks in this file are about what the PLAYER SEES — a `Locked`
// button, a `Needs:` line with its unmet clause in red, a printed `Would break …`,
// and the caret surviving a keystroke. None of that is reachable through the
// `--play` child, which drives state.js and never paints.
//
// So the paint child gives view.js the smallest DOM that can answer those
// questions honestly: real elements, real classes, real listeners, and a real
// `click()` that runs the very handler a browser would run. It is deliberately
// SMALL and deliberately DUMB — no layout, no CSS, no reflow — because what is
// being checked is which words and which classes the engine puts on the page, and
// a fuller fake would only be more code to be wrong in. Anything it cannot answer
// (does the red actually look red?) is not a question an oracle can ask anyway.
//
// It is written here rather than pulled in as a dependency for the reason this
// whole project gives: no npm, no build step, and an oracle that needs a package
// manager is an oracle nobody runs.
const installDOM = () => {
  const parseSelector = (selector) => selector.trim().split(/\s+/).map(part => {
    const attribute = part.match(/\[([\w-]+)="([^"]*)"\]/)
    return {
      tag: (part.match(/^[a-zA-Z][\w-]*/) ?? [null])[0],
      id: (part.match(/#([\w-]+)/) ?? [null, null])[1],
      classes: [...part.matchAll(/\.([\w-]+)/g)].map(each => each[1]),
      attribute: attribute === null ? null : { name: attribute[1], value: attribute[2] }
    }
  })
  const matchesOne = (el, part) =>
    (part.tag === null || el.tagName === part.tag) &&
    (part.id === null || el.id === part.id) &&
    part.classes.every(name => el.classList.contains(name)) &&
    (part.attribute === null || (part.attribute.name.startsWith('data-')
      ? el.dataset[part.attribute.name.slice(5)] === part.attribute.value
      : (el.attributes?.[part.attribute.name] ?? el[part.attribute.name]) === part.attribute.value))
  // a descendant chain: the LAST part must match, and each earlier part must match
  // some ancestor, in order — which is all any selector in the engine or in these
  // checks asks for
  const matches = (el, parts) => {
    if (!matchesOne(el, parts[parts.length - 1])) return false
    let at = parts.length - 2
    for (let parent = el.parentNode; parent && at >= 0; parent = parent.parentNode) if (matchesOne(parent, parts[at])) at -= 1
    return at < 0
  }
  const descendants = (el) => el.children.flatMap(child => [child, ...descendants(child)])

  const makeEl = (tagName) => {
    const el = {
      tagName, children: [], parentNode: null, dataset: {}, listeners: {},
      className: '', id: '', hidden: false, disabled: false, title: '', value: '', scrollHeight: 0,
      style: { setProperty(name, value) { this[name] = value } },
      get classList() {
        const names = () => el.className.split(/\s+/).filter(Boolean)
        return {
          add: (...add) => { el.className = [...new Set([...names(), ...add])].join(' ') },
          remove: (...gone) => { el.className = names().filter(name => !gone.includes(name)).join(' ') },
          contains: (name) => names().includes(name)
        }
      },
      attributes: {},
      setAttribute(name, value) { el.attributes[name] = String(value) },
      getAttribute(name) { return el.attributes[name] ?? null },
      removeAttribute(name) { delete el.attributes[name] },
      // a fragment appends its CHILDREN, never itself — the one thing a fragment is for
      appendChild(child) {
        if (child.tagName === '#fragment') { const kids = [...child.children]; child.children = []; kids.forEach(kid => el.appendChild(kid)); return child }
        child.parentNode = el; el.children.push(child); return child
      },
      append(...kids) { kids.forEach(kid => el.appendChild(typeof kid === 'string' ? makeText(kid) : kid)) },
      prepend(...kids) { kids.reverse().forEach(kid => { const node = typeof kid === 'string' ? makeText(kid) : kid; node.parentNode = el; el.children.unshift(node) }) },
      insertBefore(child, before) { child.parentNode = el; el.children.splice(Math.max(0, el.children.indexOf(before)), 0, child); return child },
      remove() { const at = el.parentNode?.children.indexOf(el) ?? -1; if (at >= 0) el.parentNode.children.splice(at, 1); el.parentNode = null },
      addEventListener(type, handler) { (el.listeners[type] ??= []).push(handler) },
      dispatch(type) { (el.listeners[type] ?? []).forEach(handler => handler({ type, target: el })) },
      click() { el.dispatch('click') },
      querySelector(selector) { return el.querySelectorAll(selector)[0] ?? null },
      querySelectorAll(selector) { const parts = parseSelector(selector); return descendants(el).filter(each => matches(each, parts)) },
      get textContent() { return el.children.map(child => child.textContent).join('') },
      set textContent(text) { el.children = [makeText(text)] },
      set innerHTML(html) { el.children = [] }          // only ever set to '' by the engine
    }
    return el
  }
  const makeText = (text) => ({ tagName: '#text', children: [], parentNode: null, dataset: {}, classList: { contains: () => false, add: () => {}, remove: () => {} }, textContent: String(text), listeners: {}, dispatch: () => {} })

  const root = makeEl('html')
  const body = makeEl('body')
  root.appendChild(body)
  // engine/index.html's shell, built by hand: the four elements view.js reaches for
  const hero = makeEl('header'); hero.className = 'hero'
  const heroTitle = makeEl('h1'); heroTitle.className = 'hero-title'
  hero.appendChild(heroTitle)
  const status = makeEl('p'); status.id = 'status'
  const sheet = makeEl('section'); sheet.id = 'sheet'; sheet.hidden = true
  const groups = makeEl('div'); groups.id = 'groups'
  ;[hero, status, sheet, groups].forEach(el => body.appendChild(el))

  globalThis.document = {
    title: 'Loading…',
    documentElement: root,
    body,
    createElement: makeEl,
    createTextNode: makeText,
    createDocumentFragment: () => makeEl('#fragment'),
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector)
  }
  // app.js owns the browser, and these are the four bits of it it owns
  globalThis.location = { pathname: '/games/paint/' }
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) }
  }
  globalThis.window = { print: () => {} }
  globalThis.confirm = () => true
  globalThis.URL.createObjectURL = () => 'blob:paint'
  globalThis.URL.revokeObjectURL = () => {}
  globalThis.Blob = class { constructor(parts) { this.parts = parts } }
  return { root, body, status, sheet, groups, makeEl }
}

// node oracles.mjs --paint <engineDir> <gameDir> <scriptJSON> [<booksDir>]
// Imports the engine's real app.js — which paints through the real view.js — and
// then drives the PAGE: a click is a click on the button the player would press,
// and typing dispatches the very events a browser dispatches.
//
// A STEP is one of four shapes:
//   { click: { row, thing } }              press that card's button
//   { type: { field, value, event } }      set a sheet box and fire `input` or `change`
//   { mark: true }                         plant a marker node in #groups (W9)
//   { load: "<kept text>" }                walk a kept sheet in through the file door
if (process.argv[2] === '--paint') {
  const [engineDir, gameDir, scriptJSON, booksDir] = process.argv.slice(3)
  const warnings = captureWarnings()
  const logs = []
  console.log = (...parts) => logs.push(parts.join(' '))
  const fetched = []
  installFakeFetch(gameDir, fetched, booksDir)
  const page = installDOM()
  await import(pathToFileURL(join(engineDir, 'app.js')).href)
  const { gameState } = await import(pathToFileURL(join(engineDir, 'state.js')).href)

  // what a painted page LOOKS like, projected — every card, its classes, its button
  // and every word the demand lines put on it
  const textOf = (el) => el.textContent
  const cards = () => page.groups.querySelectorAll('.card').map(cardEl => {
    const buttonEl = cardEl.querySelector('.card-button')
    const demandsEl = cardEl.querySelector('.card-demands')
    return {
      name: textOf(cardEl.querySelector('.card-name')),
      classes: cardEl.className.split(/\s+/).filter(Boolean).sort(),
      button: { text: textOf(buttonEl), disabled: buttonEl.disabled === true, title: buttonEl.title },
      needs: demandsEl === null ? null : textOf(demandsEl),
      clauses: demandsEl === null ? [] : demandsEl.querySelectorAll('.card-demand').map(el => ({ text: textOf(el), unmet: el.classList.contains('card-demand--unmet') })),
      // the SECOND locked reason, printed on the card and not merely hovered
      breaks: cardEl.querySelectorAll('.card-demand--unmet').filter(el => el.parentNode === cardEl).map(textOf)
    }
  })
  // one typed box, and whether LEAVING it settles the sheet. A `select` already
  // carries one `change` of its own — that is how a dropdown reports its pick, the
  // same instant its `input` fires — so its OWN listener is not the settle one, and
  // the settle is the SECOND. Every other kind reports on `input`, so any `change`
  // at all on those is the settle.
  const boxes = () => Object.fromEntries(page.sheet.querySelectorAll('.sheet-field').map(fieldEl => {
    const controlEl = fieldEl.children[1]
    const changes = (controlEl.listeners.change ?? []).length
    return [textOf(fieldEl.children[0]), { value: controlEl.value, tag: controlEl.tagName, changes, settles: changes > (controlEl.tagName === 'select' ? 1 : 0) }]
  }))
  const shot = () => ({
    status: textOf(page.status),
    cards: cards(),
    boxes: boxes(),
    notes: page.sheet.querySelectorAll('.sheet-notes li').map(textOf),
    notice: page.sheet.querySelector('.sheet-notice') === null ? null : textOf(page.sheet.querySelector('.sheet-notice')),
    marker: page.groups.querySelectorAll('.oracle-marker').length,
    spent: gameState.spent, remaining: gameState.remaining
  })
  // a card is found by the NAME the player reads on it — `<name> - <cost> points`
  const cardNamed = (name) => page.groups.querySelectorAll('.card').find(cardEl => textOf(cardEl.querySelector('.card-name')).startsWith(`${name} - `))
  // taken BEFORE a step runs, and held: an object literal evaluates its properties in
  // order, so `start: shot()` written below the steps would quietly be the END state
  const start = shot()
  const steps = JSON.parse(scriptJSON).map(step => {
    if (step.mark !== undefined) { const marker = document.createElement('div'); marker.className = 'oracle-marker'; page.groups.appendChild(marker); return shot() }
    if (step.load !== undefined) { gameState.loadKept(step.load); return shot() }
    if (step.type !== undefined) {
      // what a BROWSER does: `input` on every keystroke, and `change` on blur — only
      // when the value really changed. So `event: "input"` is a keystroke mid-word and
      // `event: "change"` is the whole edit plus leaving the box, which is why the
      // change step fires BOTH: the value is saved by the input handler either way,
      // and the settle is the thing only leaving adds.
      const fieldEl = page.sheet.querySelectorAll('.sheet-field').find(each => textOf(each.children[0]) === step.type.field)
      const controlEl = fieldEl.children[1]
      controlEl.value = String(step.type.value)
      controlEl.dispatch('input')
      if (step.type.event === 'change') controlEl.dispatch('change')
      return shot()
    }
    const cardEl = cardNamed(step.click)
    cardEl.querySelector('.card-button').click()
    return shot()
  })
  writeSync(process.stdout.fd, JSON.stringify({ warnings, fetched, start, steps, logs }))
  process.exit(0)
}

// node oracles.mjs --edit <editRoot> <gameDir> <booksDir> <scriptJSON>
// The EDITOR, driven through its own paint. <editRoot> is a scratch copy of
// engine/ + dinoEdit/ in which the editor's ABSOLUTE specifiers ("/config/…",
// "/helpers.js") have been rewritten relative — which is the one mapping the dev
// server performs for those urls, and nothing else about the bytes is touched.
// (Node has no import map; the copy is how the editor's real modules run here.)
//
// A STEP is one of two shapes:
//   { startFrom: "<thing id>" }   choose in the "from [ — blank — ▾ ]" control
//   { add: true }                 press "+ Add <sheet>"
//
// CHANGED (stage 4): IT OPENS A SUBJECT, NOT A GAME. This child hard-coded a game's five
// drawers and the `#<game>/<tab>` hash, which made it the one shared dependency of the
// whole suite that could not be pointed at a book — and it is the ONLY check driven
// through the editor's real paint, so "opening a frozen edition writes nothing" had
// nowhere to be proved. `script.subject` is { kind, name, edition }; omitted means the
// game in <gameDir>, which is what I3 drives and what it drove before. A BOOK is opened
// out of <booksDir>: its four files, the layers its manifest REQUIRES, and the pin census
// (`script.pinnedBy`) that decides whether the edition is editable at all — an edition a
// game pins is frozen, and the editor must write nothing into it.
// OPENERS is a table keyed by kind, for the same reason the editor's own SUBJECTS is: a
// third kind of subject is a row, never a branch in here.
if (process.argv[2] === '--edit') {
  const [editRoot, gameDir, booksDir, scriptJSON] = process.argv.slice(3)
  const script = JSON.parse(scriptJSON)
  const warnings = captureWarnings()
  const page = installDOM()
  // the editor's shell — the three elements its modules reach for at import time
  const editorEl = page.makeEl('div'); editorEl.id = 'editor'
  const editorStatus = page.makeEl('p'); editorStatus.id = 'status'
  const tabs = page.makeEl('nav'); tabs.id = 'tabs'
  ;[editorEl, editorStatus, tabs].forEach(el => page.body.appendChild(el))
  globalThis.location = { hash: '' }

  const editDir = (...parts) => pathToFileURL(join(editRoot, ...parts)).href
  const { editorState, remerge, S } = await import(editDir('dinoEdit', 'state.js'))
  const { uiState, readHash, subjectAt, hashForSubject } = await import(editDir('dinoEdit', 'uiState.js'))
  const { render } = await import(editDir('dinoEdit', 'view.js'))
  const { migrateSet } = await import(editDir('engine', 'config', 'migrations.js'))

  const readBook = (pin) => {
    const at = (file) => { try { return JSON.parse(readFileSync(join(booksDir, pin.name, String(pin.edition), `${file}.json`), 'utf8')) } catch { return null } }
    const manifest = at('book')
    return manifest === null ? null : { pin, manifest, types: at('types'), things: at('things'), proposals: at('proposals') }
  }
  // one row per kind: the subject triple, the drawers, and the layers underneath.
  // A BOOK IS NEVER MIGRATED (engine/helpers.js: born at SCHEMA_VERSION and frozen there),
  // which is why only the game row climbs — migrateSet on a book would rewrite a frozen
  // edition, and its key set is the game's five anyway.
  const OPENERS = {
    game: () => {
      const set = migrateSet(Object.fromEntries(['content', 'rules', 'themes', 'types', 'things']
        .map(name => [name, JSON.parse(readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8'))])))
      return { subject: subjectAt('game', 'demo'), files: set, books: (set.content.books ?? []).map(readBook) }
    },
    book: (spec) => {
      const layer = readBook({ name: spec.name, edition: spec.edition })
      return {
        subject: subjectAt('book', spec.name, spec.edition),
        files: { book: layer.manifest, types: layer.types, things: layer.things, proposals: layer.proposals },
        books: (layer.manifest.requires ?? []).map(readBook)
      }
    }
  }
  const spec = script.subject ?? { kind: 'game' }
  const { subject, files, books } = OPENERS[spec.kind](spec)
  // `pinnedBy` is the freeze census the server answers with. [] = nobody pins this edition,
  // so it is editable; a non-empty list is a FROZEN edition, and SUBJECTS.book.editable
  // reads null (never asked) as frozen too.
  Object.assign(editorState, { subject, ...files, books, pinnedBy: script.pinnedBy ?? [] })
  remerge()

  const shownType = script.type
  const tab = script.tab ?? 'things'
  globalThis.location.hash = hashForSubject(subject, tab) + (tab === 'things' && shownType ? `/${shownType}` : '')
  readHash()
  // CHANGED (stage 4): the real render() is handed the real actions TABLE, so the painter
  // that asks for the shelf can ask. A Proxy and not a hand-typed list of the nine: a list
  // here would rot the day main.js grows an action, and what is being checked is the PAINT,
  // never what an action does. Every call is recorded instead of answered — `render({})`
  // would simply have thrown on the one tab that calls one.
  const actionCalls = []
  render(new Proxy({}, { get: (_, name) => (...args) => { actionCalls.push([String(name), ...args]) } }))

  const bucket = () => structuredClone(editorState.things.things[shownType] ?? [])
  // the SHEET's own two controls — the ones hung directly on the pane. A card carries
  // an "+ Add demand" button and its own condition rows, so "the first .add-button on
  // the page" is the wrong element; the pane's own children are the right ones.
  const paneEl = () => editorEl.querySelectorAll('.things-main')[0]
  const onPane = (selector) => paneEl().querySelectorAll(selector).filter(el => el.parentNode === paneEl())
  const fromSelect = () => onPane('.condition-row')[0].children.find(child => child.tagName === 'select')
  const addButton = () => onPane('.add-button')[0]
  // the LAST card on the pane — a newborn opens ready to edit, so its Demands box is
  // drawn and its two buttons are the ones a hand would reach for
  const lastCard = () => onPane('.item-card').at(-1)
  const shot = () => ({
    options: fromSelect().children.map(option => ({ value: option.value, label: option.textContent })),
    bucket: bucket(),
    // what the card SAYS about its demands — the sentence a locked book card shows too
    demandsLine: lastCard()?.querySelectorAll('.demands-line').map(el => el.textContent)[0]
      ?? lastCard()?.querySelectorAll('.demands-empty').map(el => el.textContent)[0] ?? null,
    demandRows: lastCard()?.querySelectorAll('.demand-row').length ?? 0
  })
  const steps = script.steps.map(step => {
    if (step.startFrom !== undefined) { const selectEl = fromSelect(); selectEl.value = step.startFrom; selectEl.dispatch('change'); return shot() }
    if (step.addDemand !== undefined) { lastCard().querySelectorAll('.add-button').find(el => el.textContent === '+ Add demand').click(); return shot() }
    if (step.removeDemand !== undefined) { lastCard().querySelectorAll('.demand-row .remove-button')[0].click(); return shot() }
    // identity, asked HERE because it cannot survive the pipe: which of the copy's
    // object-valued keys are the very same object as the source's. A template that
    // shared one array would be two things wearing two names.
    if (step.probeShared !== undefined) {
      const source = Object.values(editorState.merged.things.things).flat().find(thing => thing.id === step.probeShared)
      const copy = (editorState.things.things[shownType] ?? []).at(-1)
      return { ...shot(), shared: Object.keys(copy).filter(key => copy[key] !== null && typeof copy[key] === 'object' && copy[key] === source[key]) }
    }
    addButton().click()
    return shot()
  })
  writeSync(process.stdout.fd, JSON.stringify({
    warnings, steps,
    // the pane's own Add button, where there is a pane — a tab other than Things has none
    addLabel: paneEl() === undefined ? null : addButton().textContent,
    // CHANGED: what a SAVE would write is THE SUBJECT'S own drawers, whichever they are —
    // a game's five, or a book's four — read through the editor's own subject table so
    // this child cannot disagree with it about what the page is holding.
    own: Object.fromEntries(S().files.map(name => [name, editorState[name]])),
    // NEW: what was PAINTED, so a book's paint can be seen to have happened rather than
    // inferred from the absence of a throw: which tab, how many cards, how many of them
    // lockCard turned off, and the faults banner's own sentences.
    paint: {
      tab: uiState.tab,
      actions: actionCalls,
      // every card, of either style — CARD_STYLES gives a sheet's elements `editor-section`
      // (a row, a type) or `item-card` (a section, a thing, a field), and "how many cards did
      // this tab draw" has to mean both or it means whichever tab was looked at first
      cards: editorEl.querySelectorAll('.editor-section').length + editorEl.querySelectorAll('.item-card').length,
      locked: editorEl.querySelectorAll('.editor-section.locked').length + editorEl.querySelectorAll('.item-card.locked').length,
      faults: editorState.faults.map(fault => `${fault.path}: ${fault.message}`)
    }
  }))
  process.exit(0)
}

// node oracles.mjs --subject <editRoot>
// THE SUBJECT TABLE, read out of the editor's own module. dinoEdit/subject.js is PURE — no
// DOM, no fetch, no work at import time, every column taking the state it needs as an argument
// — exactly so a check can drive it. What it is not is importable by the FAST half: it reads
// FILE_SHEETS and calls the merge through the absolute "/config/…" urls only the dev server
// resolves, which is why the address half of the table lives in uiState.js (which imports
// nothing) and this half is read here, out of the copy with that one mapping applied.
// Functions cannot cross a pipe, so each column is EVALUATED here over named sample states and
// the answers travel. The samples are deliberately minimal: what is being checked is the TABLE,
// not the merge.
if (process.argv[2] === '--subject') {
  const [editRoot] = process.argv.slice(3)
  const { SUBJECTS } = await import(pathToFileURL(join(editRoot, 'dinoEdit', 'subject.js')).href)
  const sample = {
    game: { subject: { kind: 'game', name: 'demo', edition: 0 }, content: { meta: { pageTitle: 'A Game' } } },
    book: { subject: { kind: 'book', name: 'bk', edition: 2 }, book: { name: 'bk', title: 'A Book', edition: 2, requires: [] } }
  }
  writeSync(process.stdout.fd, JSON.stringify(Object.fromEntries(Object.entries(SUBJECTS).map(([kind, row]) => [kind, {
    files:    row.files,
    drawers:  row.drawers,
    mintsIds: row.mintsIds,
    keyword:  row.keyword,
    columns:  Object.keys(row).sort(),
    title:    row.title(sample[kind]),
    // `editable` is the freeze, asked three ways: a census that says nobody pins it, one that
    // names a game, and one that was never asked at all (null must read as FROZEN)
    editable: [[], [{ game: 'dino' }], null].map(pinnedBy => row.editable({ ...sample[kind], pinnedBy }))
  }]))))
  process.exit(0)
}

// node oracles.mjs --library <editRoot> <scriptJSON>
// THE HOME SCREEN'S LIBRARY, painted by its own code. `renderLibrary` (dinoEdit/library.js)
// is a pure function of two receipts — GET /api/books and GET /api/games — and a repaint
// handle: it fetches nothing itself, and only a CLICK does. So the whole author-facing surface
// of stage 4 (which editions may be edited, which are frozen and why, what a cut would be
// numbered, who pins what, the namespace, and the New book form) can be read off a real paint
// with no server at all. The two receipts are the script's, so a frozen edition, a broken
// edition and an empty shelf are each one fixture rather than a state to arrange on disk.
if (process.argv[2] === '--library') {
  const [editRoot, scriptJSON] = process.argv.slice(3)
  const script = JSON.parse(scriptJSON)
  const warnings = captureWarnings()
  const page = installDOM()
  const editorEl = page.makeEl('div'); editorEl.id = 'editor'
  page.body.appendChild(editorEl)
  globalThis.location = { hash: '' }
  const { renderLibrary } = await import(pathToFileURL(join(editRoot, 'dinoEdit', 'library.js')).href)
  const repaints = []
  renderLibrary(editorEl, script.shelf, script.games, { forget: () => repaints.push('forget'), now: () => repaints.push('now') })

  const textsOf = (el, selector) => el.querySelectorAll(selector).map(each => each.textContent)
  // one card per book, read the way an author reads it: the heading, the folder, every
  // `book-facts` line in order, and every control with its label and (for a link) its href
  const cards = editorEl.querySelectorAll('.book-card').map(cardEl => ({
    title: textsOf(cardEl, 'h2')[0] ?? null,
    path: textsOf(cardEl, '.book-path')[0] ?? null,
    facts: textsOf(cardEl, '.book-facts'),
    hints: textsOf(cardEl, '.wall-hint'),
    frozen: textsOf(cardEl, '.shelf-frozen'),
    rows: cardEl.querySelectorAll('.game-actions').map(rowEl => rowEl.children
      .filter(child => child.tagName === 'a' || child.tagName === 'button')
      .map(child => child.tagName === 'a' ? `${child.textContent} → ${child.href ?? child.getAttribute('href')}` : child.textContent))
  }))
  const formEl = editorEl.querySelectorAll('.new-game')[0]
  writeSync(process.stdout.fd, JSON.stringify({
    warnings, repaints, cards,
    heading: textsOf(editorEl, '.library-heading')[0] ?? null,
    hints: editorEl.children.filter(child => child.className === 'wall-hint').map(child => child.textContent),
    form: formEl === undefined ? null : {
      heading: textsOf(formEl, 'h2')[0] ?? null,
      labels: textsOf(formEl, 'label span'),
      offers: formEl.querySelectorAll('.checkbox-field').map(each => each.textContent)
    }
  }))
  process.exit(0)
}

// node oracles.mjs --hydrate-http <engineDir> <baseURL>
// The same hydration over REAL HTTP. baseURL ends in index.html, and every url
// the engine asks for is resolved against it with new URL(url, baseURL) — the
// exact page-relative resolution a browser performs for a fetch from a page —
// then handed to node's real fetch. No fake fetch: the server answers, and the
// parent reads which paths it was asked for.
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
// below the child branches because those must keep stdout pure JSON.)
const { blockedChecks } = await import('./oracles-logic.mjs')

const { migrateSet } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'migrations.js')).href)
const { SCHEMA_VERSION, fieldsOfType, listSectionsOf, thingKeys, sheetKeys, placementSheet, FILE_SHEETS, BOOK_FILE_SHEETS, BOOK_FILES, SHEETS, MINTS, BOOK_ID } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'schema.js')).href)
// NEW (stage 4): the id walk and the two marker tables it is blind without. R6 below asks
// the REAL books/** and games/** the one question the fast half cannot (it never reads the
// shelf): is there an id-shaped string anywhere on disk at a position this walk does not
// reach? The tables are imported so the anti-vacuity pass can break one IN MEMORY.
const { eachId, rewriteIds } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'ids.js')).href)
const { QUERY_IDS } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'query.js')).href)
// NEW (v6): the two files the player's sheet is made of. Both are pure, so the
// parent can ask them the same questions the engine asks — and W3 can build the
// sheet a child printed a second time, from the merged set, and compare.
const { QUANTITY_KEY, quantityFieldOf, blankFields } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'sheet.js')).href)
const { danglingReferences, forgetType, forgetThing } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'references.js')).href)
const { flattenGroups } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'helpers.js')).href)
const { validateFile, crossChecks, problemText, FILE_NAMES } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'validate.js')).href)
// CHANGED: validateSet lives in merge.js now — judging a set means merging the
// layers under it. The whole merge API is imported: the D-checks flatten, the
// T-checks validate books, the E-checks compare against flattenGame.
const { validateSet, validateGame, validateBook, flattenGame, mergeLayers } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'merge.js')).href)
const SERVER_SCRIPT = join(DINO_DIR, 'server', 'server.js')
const EXPORT_SCRIPT = join(DINO_DIR, 'tools', 'export.mjs')
const REBUILD_SCRIPT = join(DINO_DIR, 'tools', 'rebuild-dino-v5.mjs')
const { exportGame, ExportRefusal, MANIFEST, TOOL, listFiles, sha256, readBookSync } = await import(pathToFileURL(EXPORT_SCRIPT).href)
const { PLAN, statusOf, rebuildDino } = await import(pathToFileURL(REBUILD_SCRIPT).href)
const { seedSet } = await import(pathToFileURL(join(DINO_DIR, 'server', 'games.js')).href)
const { shelfOf, frozenEditionSentence, pinnedEditionSentence, pinnedBookSentence } = await import(pathToFileURL(join(DINO_DIR, 'server', 'books.js')).href)
assert.equal(SCHEMA_VERSION, 7, 'these oracles describe schema version 7')

const games = process.argv.length > 2 ? process.argv.slice(2) : ['dino', 'vampire']
const WORK = mkdtempSync(join(tmpdir(), 'cyoa-oracles-'))
let checks = 0
const ok = (label) => { checks += 1; console.log(`  ok  ${label}`) }
const skipped = []
const skip = (label) => { skipped.push(label); console.log(`  skip ${label}`) }

// an old engine, straight from git, untouched — under WORK/<name>/cyoa/DinoCYOA/engine
const archiveEngine = (commit, name) => {
  mkdirSync(join(WORK, name), { recursive: true })
  execFileSync('git', ['archive', '-o', join(WORK, `${name}.tar`), commit, `${DINO_IN_REPO}/engine`], { cwd: GIT_ROOT })
  execFileSync('tar', ['-xf', join(WORK, `${name}.tar`), '-C', join(WORK, name)])
  return join(WORK, name, DINO_IN_REPO, 'engine')
}
const v2EngineDir = archiveEngine(V2_COMMIT, 'v2')
const v3EngineDir = archiveEngine(V3_ENGINE_COMMIT, 'v3')
const v4EngineDir = archiveEngine(V4_COMMIT, 'v4')     // NEW: the last engine before the books arc
const v5EngineDir = join(DINO_DIR, 'engine')           // the working tree
// NEW (v6): the v5 engine AND the v5 shelf, straight from git. The shelf comes
// with it because a v5 engine reads v5 books: the version stamp on every file
// under books/ is part of the contract, so the two travel together (§4.2).
const archiveBooks = (commit, name) => {
  mkdirSync(join(WORK, name), { recursive: true })
  execFileSync('git', ['archive', '-o', join(WORK, `${name}.tar`), commit, `${DINO_IN_REPO}/books`], { cwd: GIT_ROOT })
  execFileSync('tar', ['-xf', join(WORK, `${name}.tar`), '-C', join(WORK, name)])
  return join(WORK, name, DINO_IN_REPO, 'books')
}
const v5PrevEngineDir = archiveEngine(V5_COMMIT, 'v5prev')
const v5PrevBooksDir = archiveBooks(V5_COMMIT, 'v5prev-books')
const v6PrevBooksDir = archiveBooks(V6_COMMIT, 'v6prev-books')   // NEW (v7): what T3 diffs the stamp against
const v6PrevEngineDir = archiveEngine(V6_COMMIT, 'v6prev')       // NEW (v7): the engine C8 bridges against

const gitShow = (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], { cwd: GIT_ROOT, encoding: 'utf8' })
const writeGame = (gameDir, set) => {
  mkdirSync(join(gameDir, 'data'), { recursive: true })
  FILES.forEach(name => {
    if (set[name] !== null) writeFileSync(join(gameDir, 'data', `${name}.json`), serialize(set[name]))
  })
  return gameDir
}
const readGameText = (gameDir) => Object.fromEntries(FILES.map(name => [name, readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8')]))
const readGameSet = (gameDir) => Object.fromEntries(FILES.map(name => {
  try {
    return [name, JSON.parse(readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8'))]
  } catch (error) {
    if (error.code === 'ENOENT' && OPTIONAL_FILES.includes(name)) return [name, null]
    throw error
  }
}))
const runChild = (mode, args, env = {}) => {
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), mode, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(out)
}
// CHANGED: an optional booksDir — the shelf the child's fake fetch answers
// `books/…` from. Absent = a folder with no shelf (a published export).
const hydrate = (engineDir, gameDir, booksDir, env) => runChild('--hydrate', [engineDir, gameDir, ...(booksDir === undefined ? [] : [booksDir])], env)
const play = (engineDir, gameDir, steps, booksDir, env = {}) => runChild('--play', [engineDir, gameDir, JSON.stringify(steps), ...(booksDir === undefined ? [] : [booksDir])], env)
// the same play, asking for the whole of the final state (see the child above)
const playFully = (engineDir, gameDir, steps, booksDir) => play(engineDir, gameDir, steps, booksDir, { CYOA_PLAY_STATE: '1' })
// NEW (v7): the PAINTED page — one child, one world, one script of clicks and keystrokes
const paint = (engineDir, gameDir, steps, booksDir) => runChild('--paint', [engineDir, gameDir, JSON.stringify(steps), ...(booksDir === undefined ? [] : [booksDir])])
// NEW (v7): the EDITOR's own paint. Its modules import "/config/…" — an absolute url
// the dev server maps onto engine/config/ (oracle M2) — and node has no import map, so
// the check runs the editor's real bytes out of a copy in which that ONE mapping has
// been applied. Nothing else about them is touched, and the rewrite is asserted below.
const editorCopy = (() => {
  const root = join(WORK, 'editor-copy')
  cpSync(join(DINO_DIR, 'engine'), join(root, 'engine'), { recursive: true })
  cpSync(join(DINO_DIR, 'dinoEdit'), join(root, 'dinoEdit'), { recursive: true })
  readdirSync(join(root, 'dinoEdit')).filter(file => file.endsWith('.js')).forEach(file => {
    const path = join(root, 'dinoEdit', file)
    writeFileSync(path, readFileSync(path, 'utf8')
      .replace(/(['"])\/config\//g, '$1../engine/config/')
      .replace(/(['"])\/helpers\.js/g, '$1../engine/helpers.js'))
  })
  return root
})()
const editorRun = (gameDir, booksDir, script) => runChild('--edit', [editorCopy, gameDir, booksDir, JSON.stringify(script)])
// NEW (stage 4): the same child, opening one EDITION OF A BOOK. There is no gameDir in the
// question at all, so the slot gets a path nothing under it reads — a book's drawers come
// from the shelf, and a child that quietly fell back to a game would be the bug this names.
const editorRunBook = (booksDir, name, edition, script) =>
  editorRun(join(booksDir, '-no-game-'), booksDir, { ...script, subject: { kind: 'book', name, edition } })
// NEW (stage 4): the home screen's Library, painted from two receipts and nothing else
const libraryRun = (script) => runChild('--library', [editorCopy, JSON.stringify(script)])
// NEW (stage 4): the subject table, read out of the editor's own pure module
const subjectTable = () => runChild('--subject', [editorCopy])
// The HTTP child must NOT be run with execFileSync: the server it fetches from
// lives in THIS process, and a synchronous wait would freeze the event loop that
// answers it — the child would wait forever. So this one is awaited.
const hydrateHTTP = (engineDir, baseURL) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--hydrate-http', engineDir, baseURL], { stdio: ['ignore', 'pipe', 'inherit'] })
  let out = ''
  child.stdout.on('data', chunk => { out += chunk })
  child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`--hydrate-http exited ${code}`)))   // close, not exit: stdout is drained by then
})
// the two CLIs, exit code and all (execFileSync would throw on exit 1/2, and those are the point)
const runExportCLI = (args) => {
  const { status, stdout } = spawnSync(process.execPath, [EXPORT_SCRIPT, ...args], { encoding: 'utf8' })
  return { status, stdout }
}
const runRebuildCLI = (args) => {
  const { status, stdout } = spawnSync(process.execPath, [REBUILD_SCRIPT, ...args], { encoding: 'utf8' })
  return { status, stdout }
}

// The REAL server on a free port (PORT=0) over a scratch games ROOT, a scratch
// dist root and a scratch SHELF — no game on the command line: the server serves
// every folder under the root, and every request names its game in the URL. It
// logs every request to stdout, so stdout is DRAINED for the life of the child —
// a full pipe would block it mid-request. The banner carries the port the OS
// picked. A child that dies or stays silent rejects (and is killed), so a broken
// server fails the run instead of hanging it.
// PORT=0 ALWAYS: port 3000 is the owner's live server and nothing here may bind it.
// CHANGED (stage 4): the shelf a server is pointed at is REGISTERED. The day a book
// write route exists, this is the list that says no server in the run could have
// written the real one — the hash M12 takes is the other half of the same claim.
const startServer = (gamesDir, distDir, booksDir) => new Promise((resolve, reject) => {
  servedShelves.push(booksDir)
  const child = spawn(process.execPath, [SERVER_SCRIPT], { env: { ...process.env, PORT: '0', CYOA_GAMES_DIR: gamesDir, CYOA_DIST_DIR: distDir, CYOA_BOOKS_DIR: booksDir }, stdio: ['ignore', 'pipe', 'inherit'] })
  let banner = ''
  const timer = setTimeout(() => { child.kill(); reject(new Error('server did not start in 10 s')) }, 10_000)
  child.on('exit', code => { clearTimeout(timer); reject(new Error(`server exited (${code}) before its banner`)) })
  child.stdout.on('data', chunk => { banner += chunk; const m = banner.match(/Server online at (http:\/\/localhost:\d+)/); if (m) { clearTimeout(timer); resolve({ origin: m[1], stop: () => child.kill() }) } })
})
// one POST to the save route OF ONE GAME; a string body goes over the wire AS IS (the not-JSON case)
const post = async (origin, game, name, body) => { const res = await fetch(`${origin}/api/games/${game}/save/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }); return { status: res.status, body: await res.json() } }
// exactly main.js's order: the four in parallel, content only when all four are ok
const editorSave = async (origin, game, set) => { const receipts = await Promise.all(['types', 'things', 'rules', 'themes'].map(name => post(origin, game, name, set[name]))); if (receipts.every(r => r.body.ok)) receipts.push(await post(origin, game, 'content', set.content)); return receipts }
const SAVED = { status: 200, body: { ok: true } }
// api(): any method, any path, an optional body → { status, body } where body is
// the parsed JSON — or the raw TEXT when the answer is not JSON — never a throw.
// redirect: 'manual', so a 302 is SEEN as a 302.
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
// raw(): the LITERAL path over http.request → { status, text }. fetch() is a URL
// parser first: it folds "/games/../x" to "/x" and "%2e%2e" to ".." on the
// CLIENT, before anything is sent — so a traversal check through fetch would
// prove nothing about the server. http.request sends the bytes it is given.
const raw = (origin, path, method = 'GET', body = null) => new Promise((resolve, reject) => {
  const { hostname, port } = new URL(origin)
  const headers = body === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  const req = httpRequest({ hostname, port, path, method, headers }, res => {
    let text = ''
    res.setEncoding('utf8')
    res.on('data', chunk => { text += chunk })
    res.on('end', () => resolve({ status: res.statusCode, text, length: Number(res.headers['content-length'] ?? -1) }))
  })
  req.on('error', reject)
  req.end(body ?? undefined)
})
// a fetch that only wants the status (and drains the body so the socket is reused)
const fetchStatus = async (url) => { const res = await fetch(url); await res.arrayBuffer(); return res.status }

// a small static server for E4 — /<prefix>/<rest> → <rootDir>/<rest>, 404 for
// anything else (so an ABSOLUTE /data/… from the engine would die here), every
// req.url recorded. Content-Length is set by hand: E4 compares it to the size.
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
// NEW: the real shelf, copied into a scratch root. EVERY server and every test
// that could conceivably write reads this copy, never books/ itself.
// CHANGED (stage 4): every copy is REGISTERED, so M12 can say the scratch shelf is
// really where the writing goes rather than merely that books/ did not move.
const copyShelf = (dest) => { mkdirSync(dirname(dest), { recursive: true }); cpSync(REAL_BOOKS, dest, { recursive: true }); scratchShelves.push(dest); return dest }
// NEW: a fixture book on a scratch shelf. `files` is { book, types, things,
// proposals } — anything absent is simply not written, which is how Basic and
// Stats ship (book.json + types.json only).
const writeBook = (root, name, edition, files) => {
  const dir = join(root, name, String(edition))
  mkdirSync(dir, { recursive: true })
  BOOK_FILE_NAMES.forEach(file => { if (files[file] !== undefined) writeFileSync(join(dir, `${file}.json`), serialize(files[file])) })
  return dir
}
// NEW: what a PLAYER sees, from a summarized tree — label, min/max, background,
// the gate and the items in order. A gate naming a row is resolved to that row's
// LABEL, so two games whose row ids differ (v4 uuids vs v5 book ids) can still be
// compared position by position. This is D1's whole equality test.
const project = (groups) => {
  const labelOf = new Map()
  const walk = (rows) => rows.forEach(row => { labelOf.set(row.id, row.label); walk(row.children) })
  walk(groups)
  const gate = (showWhen) => showWhen === null || showWhen === undefined ? null
    : showWhen.kind === 'anyInRow' ? { kind: 'anyInRow', row: labelOf.get(showWhen.row) ?? showWhen.row }
    : { ...showWhen }
  const project1 = (rows) => rows.map(row => ({
    label: row.label, min: row.min, max: row.max, background: row.background, showWhen: gate(row.showWhen),
    items: row.items.map(item => ({ name: item.name, cost: item.cost, imageURL: item.imageURL })),
    children: project1(row.children)
  }))
  return project1(groups)
}
// the v2 and v3 engines have no showWhen at all, so the two old bridges compare without it
const noGates = (groups) => groups.map(({ showWhen, children, ...rest }) => ({ ...rest, children: noGates(children) }))

// an independent walker over a problem path — `.key`, `[n]` and `["k"]` tokens
// applied from the set's top — so a path is proven to lead somewhere
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
const flatSummary = (groups) => groups.flatMap(group => [group, ...flatSummary(group.children)])
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

// the four uuids the dino's v4 rows and things are addressed by, and the book
// ids that replace them once the game is rebuilt (§11.1)
const DINO = {
  rows: {
    dino:     'dc59d633-7a9d-441b-a8c5-e9224d16eec8',
    gear:     '2f388c57-809e-49c0-b03d-216b9bd894f7',
    lair:     'bdd3ed8d-74a8-455f-bef7-b115fe5d9f2e',
    location: 'cd9dd080-40ca-4ae9-9487-d67242cf7265'
  },
  things: {
    lavaPit:    '6df9e5c4-c5c9-4bb1-898b-4982df7e4722',   // Lair, 3 points
    volcanoRim: '0568ef76-cce6-4fa6-be85-0c4f56592e72'    // Location, 1 point
  }
}
const REBUILT = {
  rows: { dino: 'dinosaur-age:row-companions', gear: 'dinosaur-age:row-gear', lair: 'dinosaur-age:row-lairs', location: 'dinosaur-age:row-locations' },
  things: { lavaPit: 'dinosaur-age:lava-pit', volcanoRim: 'dinosaur-age:volcano-rim', nest: 'dinosaur-age:nest' }
}
// NEW (v6): the four things §2.6's play uses, and the play itself — one list, so
// the SOURCE game (W2–W5) and the PUBLISHED folder (W6) are asked for the same
// fifteen steps and the same fifteen numbers. The four typed steps go through
// `{ field, value }`, raw string and all, exactly as an <input> hands them over.
const PLAYER = {
  tali:   'a8d09a0f-f269-4a04-a173-d694dc36b105',
  miku:   '0c63d4ce-f909-4682-b27f-c77929d1f40c',
  rock:   'dinosaur-age:cute-rock',
  banana: 'dinosaur-age:the-banana'
}
const PLAY_STEPS = [
  { field: 'name', value: 'Rexina' },
  { field: 'concept', value: 'A dino parent' },
  { field: 'size', value: 'big' },
  { field: 'strength', value: '12' },
  { field: 'notes', value: 'Allergic to ferns' },
  { row: REBUILT.rows.dino, thing: PLAYER.tali },                   // 2. a companion, 1
  { row: REBUILT.rows.gear, thing: PLAYER.rock },                   // 3. a free rock
  { row: REBUILT.rows.gear, thing: PLAYER.rock, by: 1 },            // 4. + twice → quantity 3
  { row: REBUILT.rows.gear, thing: PLAYER.rock, by: 1 },
  { row: REBUILT.rows.gear, thing: PLAYER.banana },                 // 5. THE BANANA, 2
  { row: REBUILT.rows.gear, thing: PLAYER.banana, by: 1 },          // 6. + once → 2 × 2
  { row: REBUILT.rows.lair, thing: REBUILT.things.lavaPit },        // 7. a Lair, 3 → Locations opens
  { row: REBUILT.rows.location, thing: REBUILT.things.volcanoRim }, // 8. a Location, 1 → spent 9
  { row: REBUILT.rows.gear, thing: PLAYER.banana, by: 1 },          // 9. refused: 2 more, 1 left
  { row: REBUILT.rows.lair, thing: REBUILT.things.lavaPit }         // 10. unpick → Locations hides, refund
]
const KEEP_AT_8 = PLAY_STEPS.slice(0, 13)          // the state §2.4 and §2.7 are written from
const SPENT_PER_STEP = [0, 0, 0, 0, 0, 1, 1, 1, 1, 3, 5, 8, 9, 9, 5]

// The real games/, dist/ and books/ as they are BEFORE anything below runs — M9
// and M12 hash them again at the very end. Every server this file starts is
// pointed at a scratch root, every export at a scratch folder, and the shelf is
// only ever READ; this is the proof.
const realGames = treeHash(join(DINO_DIR, 'games'))
const realDistDir = join(DINO_DIR, 'dist')
const realDist = existsSync(realDistDir) ? treeHash(realDistDir) : null
const realBooks = treeHash(REAL_BOOKS)

// the v5 source folder each game is served from below, filled as the loop runs
// (games/** is still at v4 on disk) — the manager block reads them back
const v5Sources = {}

for (const game of games) {
  console.log(`\n${game}`)
  const gamePath = `${DINO_IN_REPO}/games/${game}/data`
  const workingTreeDir = join(DINO_DIR, 'games', game)

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
  // NEW: the v4 set, as committed — the last shape before the books arc, and the
  // reference for "does v5 still play what v4 played?" (A3, B5, C5, D1)
  const rawV4 = deepFreeze(Object.fromEntries(FILES.map(name => [name, JSON.parse(gitShow(V4_COMMIT, `${gamePath}/${name}.json`))])))
  assert.equal(rawV4.content.version, 4, `${game} at ${V4_COMMIT} is a v4 game`)
  const v4Dir = writeGame(join(WORK, 'v4data', game), rawV4)

  // NEW (dino): the REBUILT game, in memory and on a scratch disk. games/dino is
  // still at v4 — the owner runs tools/rebuild-dino-v5.mjs once, at the end — so
  // every check below that needs the rebuilt files builds them here, from the
  // committed v4 data and the REAL shelf (read only), exactly as D1 does.
  let rebuilt = null, rebuiltDir = null, shelfLayers = null
  if (game === 'dino') {
    shelfLayers = PLAN.pins.map(pin => readBookSync(REAL_BOOKS, pin))
    rebuilt = rebuildDino(migrateSet(structuredClone(rawV4)), PLAN, shelfLayers)
    rebuiltDir = writeGame(join(WORK, 'rebuilt', game), rebuilt)
    cpSync(join(workingTreeDir, 'assets'), join(rebuiltDir, 'assets'), { recursive: true })
  }

  // ── A1 determinism, mint-free ──
  const first = migrateSet(rawV3)                  // rawV3 is frozen: a mutating step would throw
  const second = migrateSet(rawV3)
  const firstText = serialize(first)
  assert.equal(firstText, serialize(second), 'two v3 → v5 migrations are byte-identical')
  assert.ok(sameSet(uuidsIn(firstText), uuidsIn(v3Text)), 'v3 → v5 neither mints nor loses a uuid')
  ok(`A1 v3 → v5 twice is byte-identical; ${uuidsIn(v3Text).size} uuids in, the same ${uuidsIn(firstText).size} out (input untouched)`)

  // ── A2 climb ──
  // v2 → v5 mints type and field ids in step 2 only, so the two routes agree
  // once every id unknown to v2 is renamed by first appearance
  assert.equal(normalize(serialize(migrateSet(rawV2)), v2Ids), normalize(firstText, v2Ids), 'v2 → v5 equals v3 → v5 modulo minted ids')
  const v1 = {
    content: { ...rawV2.content, version: 1, groups: rawV2.content.groups.map(({ id, label, items }) => ({ id, label, items })) },
    rules: { ...rawV2.rules, version: 1 },
    themes: { ...rawV2.themes, version: 1 },
    types: null,
    things: null
  }
  const v2Flat = { ...v1, content: { ...v1.content, version: 2, groups: v1.content.groups.map(group => ({ ...group, children: [] })) },
                   rules: { ...v1.rules, version: 2 }, themes: { ...v1.themes, version: 2 } }
  assert.equal(normalize(serialize(migrateSet(v1)), v2Ids), normalize(serialize(migrateSet(v2Flat)), v2Ids), 'v1 → v5 equals v2 → v5')
  FILES.forEach(name => assert.equal(migrateSet(rawV2)[name].version, 7, `the v2 climb ends at 7 (${name})`))
  ok(`A2 v2 (git ${V2_COMMIT}) → v7 equals v3 (git ${V3_DATA_COMMIT}) → v7 modulo minted ids; v1 → v7 equals v2 → v7; every climb ends at 7`)

  // ── A3 the last step, over the COMMITTED v4 files: deterministic and mint-free ──
  const v4Text = serialize(rawV4)
  const fromV4 = migrateSet(rawV4)
  assert.equal(serialize(fromV4), serialize(migrateSet(rawV4)), 'two v4 → v5 migrations are byte-identical: the section id is DERIVED, never minted')
  assert.ok(sameSet(uuidsIn(serialize(fromV4)), uuidsIn(v4Text)), 'the same set of uuids comes out (a regex COUNT grows — <uuid>.identity holds it twice)')
  // every v4 field id survives exactly once, and now lives INSIDE a section
  const v4FieldIds = rawV4.types.types.flatMap(type => type.fields.map(field => field.id))
  const v5FieldIds = fromV4.types.types.flatMap(type => fieldsOfType(type).map(field => field.id))
  assert.deepEqual(v5FieldIds, v4FieldIds, 'every v4 field id, once, in order')
  fromV4.types.types.forEach(type => {
    assert.equal(type.sections.length, 1, 'one section per migrated type')
    assert.equal(type.sections[0].id, `${type.id}.identity`)
    assert.equal(listSectionsOf(type).length, 0, 'a migrated type has no list section')
  })
  assert.deepEqual(fromV4.content.books, [], 'a v4 game knew no books')
  assert.deepEqual(fromV4.content.rowOverrides, {})
  assert.deepEqual(validateSet(fromV4), [], 'and the result fits the v5 contract')
  // ── A4 the climb to v6, over the COMMITTED files (NEW) ──
  // The step this stage adds, run over the bytes that are actually in git: ONE
  // key on the game and ONE on every row, both born EMPTY. The whole result is
  // compared against a LITERAL built from the committed set — not read by eye —
  // so "the diff is exactly the five version lines, `sheet: ""` and one `fills`
  // per row" is a fact this run proves rather than a sentence a comment makes.
  const rawCommitted = deepFreeze(Object.fromEntries(FILES.map(name => [name, JSON.parse(gitShow(V5_COMMIT, `${gamePath}/${name}.json`))])))
  const committedVersion = rawCommitted.content.version
  assert.equal(committedVersion, game === 'dino' ? 5 : 4, `${game} at ${V5_COMMIT} is where the v5 world left it`)
  const climbed = migrateSet(rawCommitted)
  assert.equal(serialize(climbed), serialize(migrateSet(rawCommitted)), 'two climbs to v7 are byte-identical')
  FILES.forEach(name => assert.equal(climbed[name].version, 7, `${name}.json stamped 7`))
  assert.equal(climbed.content.sheet, '', 'a game that never heard of sheets builds NONE — not a guess at one')
  flattenGroups(climbed.content.groups).forEach(row => assert.equal(row.fills, '', `row ${row.id} fills nothing`))
  assert.ok(sameSet(uuidsIn(serialize(climbed)), uuidsIn(serialize(rawCommitted))), 'no uuid appears or disappears')
  if (committedVersion === 5) {
    const withFills = (rows) => rows.map(row => ({ id: row.id, label: row.label, query: row.query, fills: '', showWhen: row.showWhen, children: withFills(row.children) }))
    assert.equal(serialize(climbed), serialize({
      content: { version: 7, meta: rawCommitted.content.meta, books: rawCommitted.content.books, sheet: '',
                 groups: withFills(rawCommitted.content.groups), rowOverrides: rawCommitted.content.rowOverrides },
      rules:  { ...rawCommitted.rules,  version: 7 },
      themes: { ...rawCommitted.themes, version: 7 },
      types:  { ...rawCommitted.types,  version: 7 },
      things: { ...rawCommitted.things, version: 7 }
    }), 'the committed v5 game climbs to EXACTLY the committed bytes plus the stamps, the sheet and the bindings')
    assert.deepEqual(climbed.content.rowOverrides, rawCommitted.content.rowOverrides, 'and an override slot is not rewritten')
  }
  // judged WITH its books: a pinned game's rows show the books' sheets, so
  // validateSet (which is "no books") would call every one of those a dangle
  assert.deepEqual(validateGame({ own: climbed, books: climbed.content.books.map(pin => readBookSync(REAL_BOOKS, pin)) }), [], 'and the result fits the v7 contract')
  ok(`A3/A4 v4 (git ${V4_COMMIT}) → v5: twice byte-identical, ${uuidsIn(v4Text).size} uuids in and the same out, ${v4FieldIds.length} field ids each once inside a section, books: []; and the COMMITTED v${committedVersion} game (git ${V5_COMMIT}) climbs to v7 twice identically, mint-free, ${committedVersion === 5 ? 'byte-equal to a literal that is the committed bytes plus five stamps, sheet "" and one fills per row' : 'ending at sheet "" with every fills ""'}`)


  // ── B1 idempotence: save 1 → reload → migrate (no-op) → the one render-time write → save 2 ──
  const roundTrip = (set, label) => {
    const reloaded = Object.fromEntries(FILES.map(name => [name, JSON.parse(serialize(set[name]))]))
    const again = migrateSet(reloaded)
    assert.equal(again, reloaded, `${label}: a v5 set passes the border untouched — the same object`)
    again.types.types.forEach(type => { again.things.things[type.id] ??= [] })   // repairBuckets' one write
    FILES.forEach(name => assert.equal(serialize(again[name]), serialize(set[name]), `${label}: ${name}.json byte-identical on save 2`))
  }
  roundTrip(first, 'the migrated set')
  if (rebuilt) roundTrip(rebuilt, 'the rebuilt files')
  ok(`B1 save → reload → migrate → render → save: all five files byte-identical${rebuilt ? ' (the migrated set and the rebuilt files)' : ''}`)

  // ── B2 canonical shapes and key orders ──
  FILES.forEach(name => assert.equal(first[name].version, 7, `${name}.json stamped 7`))
  assert.equal(keysOf(first.content), 'version,meta,books,sheet,groups,rowOverrides')
  assert.equal(keysOf(first.types), 'version,types,sectionsFor,fieldsFor')
  assert.equal(keysOf(first.things), 'version,things')
  assert.equal(keysOf(first.rules), keysOf(rawV3.rules))
  assert.equal(keysOf(first.themes), keysOf(rawV3.themes))
  const typeIds = new Set(first.types.types.map(type => type.id))
  const checkRow = (row) => {
    assert.equal(keysOf(row), 'id,label,query,fills,showWhen,children')
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
    assert.equal(keysOf(type), 'id,label,sections')
    assert.equal(keysOf(type.sections[0]), 'id,key,caption,kind,fields')
    assert.equal(fieldsOfType(type).map(field => `${field.key}:${field.type}`).join(','), 'label:text,traits:lines')
    fieldsOfType(type).forEach(field => assert.equal(keysOf(field), 'id,key,caption,type'))
    first.things.things[type.id].forEach(thing => assert.equal(keysOf(thing), 'id,name,cost,imageURL,label,traits'))
  })
  assert.equal(Object.keys(first.things.things).length, first.types.types.length, 'one bucket per type, no extras')
  ok(`B2 canonical key orders; ${countGroups(first.content.groups)} rows each id,label,query,fills,showWhen,children; one "identity" section per type; where null; gate always; all five stamped 7`)

  // ── B3 the border's promise: a set missing a file names it. The v3 input is
  // the line `stamp` exists for: steps 3 and 4 have to carry a null THROUGH, and
  // a { ...null, version: 7 } would turn it into a stray object that slips past
  // the check. The v5 input never runs a step — it only proves the check itself. ──
  assert.throws(() => migrateSet({ ...rawV3, types: null, things: null }), /Missing data files for version 7: types, things/)
  assert.throws(() => migrateSet({ ...rawV4, types: null, things: null }), /Missing data files for version 7: types, things/)
  assert.throws(() => migrateSet({ ...first, types: null, things: null }), /Missing data files for version 7: types, things/)
  ok('B3 a v3, v4 or v5 game without types.json/things.json fails at the border, by name')

  // ── B5 the canonical v5 shapes of §2.8, over the migrated set and (dino) the rebuilt files ──
  const checkSection = (section, where) => {
    assert.equal(keysOf(section), section.kind === 'list' ? 'id,key,caption,kind,of,placement' : 'id,key,caption,kind,fields', `${where}: section key order`)
    const fields = section.kind === 'list' ? section.placement : section.fields
    fields.forEach(field => {
      const wanted = ['id', 'key', 'caption', 'type', ...(field.options === undefined ? [] : ['options']), ...(field.default === undefined ? [] : ['default'])]
      assert.deepEqual(Object.keys(field), wanted, `${where}: fieldDef ${field.id} key order`)
    })
  }
  first.types.types.forEach(type => type.sections.forEach(section => checkSection(section, `${game} migrated`)))
  if (rebuilt) {
    assert.equal(keysOf(rebuilt.content), 'version,meta,books,sheet,groups,rowOverrides')
    assert.equal(keysOf(rebuilt.rules), 'version,groupRules', 'no totalBudget: the book proposes it')
    assert.equal(keysOf(rebuilt.themes), 'version,page,groupThemes')
    assert.equal(keysOf(rebuilt.types), 'version,types,sectionsFor,fieldsFor')
    assert.equal(keysOf(rebuilt.things), 'version,things,order', '`order` last — the game arranges the merged shelf')
    rebuilt.content.books.forEach(pin => assert.equal(keysOf(pin), 'name,edition'))
    rebuilt.things.things['basic:character'].forEach(pet => assert.equal(keysOf(pet), 'id,name,cost,imageURL,concept,size,origin,notes', `${pet.name}: the SHEET's key order`))
    rebuilt.things.things['basic:place'].forEach(place => assert.equal(keysOf(place), 'id,name,cost,imageURL,description,kind,features', `${place.name}: the SHEET's key order`))
    // the sections a rebuilt pet is drawn from are the BOOKS' — so they are checked over the MERGED set
    const merged = mergeLayers({ books: shelfLayers, game: rebuilt }).set
    merged.types.types.forEach(type => {
      assert.equal(keysOf(type), 'id,label,sections')
      type.sections.forEach(section => checkSection(section, `${game} merged`))
    })
    assert.deepEqual(Object.keys(rebuilt.things.order), ['basic:place'])
  } else {
    assert.equal(first.things.order, undefined, 'a game that arranges nothing writes no `order` key')
  }
  // ── B6 the v6 shapes: the two new keys, in their canonical slots (NEW) ──
  // B2 has already walked the MIGRATED set (content gains `sheet` after `books`;
  // every row gains `fills` after `query`). This half is about the bytes the
  // owner actually edited: games/dino on disk, and the MERGED rows the engine
  // and the export eat, where a binding may come from a book or from an override.
  let bindings = 0
  if (rebuilt) {
    const disk = readGameSet(workingTreeDir)
    assert.equal(keysOf(disk.content), 'version,meta,books,sheet,groups,rowOverrides', 'games/dino on disk: sheet after books')
    assert.equal(disk.content.sheet, 'basic:character', 'and it names the sheet the player builds')
    Object.entries(disk.content.rowOverrides).forEach(([id, slot]) => assert.equal(keysOf(slot), 'label,fills', `rowOverrides["${id}"]: sparse, in edit order`))
    const mergedDisk = flattenGame({ books: disk.content.books.map(pin => readBookSync(REAL_BOOKS, pin)), game: disk })
    assert.equal(keysOf(mergedDisk.content), 'version,meta,books,sheet,groups,rowOverrides', 'the merged set carries the declaration too')
    flattenGroups(mergedDisk.content.groups).forEach(row => {
      assert.equal(keysOf(row), 'id,label,query,fills,showWhen,children', `merged row ${row.id}: fills straight after query`)
      bindings += 1
    })
  } else {
    assert.equal('sheet' in readGameSet(workingTreeDir).content, false, 'a game that has never been opened at v6 declares nothing — and no key is invented for it')
  }
  ok(`B5/B6 canonical v6 shapes: file key orders of §2.8; every section id,key,caption,kind,(fields|of,placement); every fieldDef id,key,caption,type[,options][,default]${rebuilt ? `; the rebuilt pets and places in SHEET key order; things.order last; games/dino on disk declares basic:character with label,fills override slots and ${bindings} merged rows in id,label,query,fills,showWhen,children` : '; no things.order; and no invented `sheet` key'}`)

  // ── C1 bridge v3: real v3 engine vs the v5 engine, over v3 data ──
  const v3GitDir = writeGame(join(WORK, 'v3data', game), rawV3)     // the committed v3 files — the lazy path for the v5 engine
  const v5SavedDir = writeGame(join(WORK, 'v5data', game), first)   // the migration, saved
  const v3Result = hydrate(v3EngineDir, v3GitDir)
  const v5Lazy = hydrate(v5EngineDir, v3GitDir)
  const v5Saved = hydrate(v5EngineDir, v5SavedDir)
  assert.deepEqual(v3Result.warnings, [], 'v3 engine warned over the v3 data')
  assert.deepEqual(v5Lazy.warnings, [], 'v5 engine warned over the v3 data (lazy migration)')
  assert.deepEqual(v5Saved.warnings, [], 'v5 engine warned over the saved migration')
  assert.deepEqual(noGates(v5Lazy.groups), noGates(v3Result.groups), 'v5 over v3 data ≠ v3 engine')
  assert.deepEqual(noGates(v5Saved.groups), noGates(v3Result.groups), 'v5 over the saved migration ≠ v3 engine')
  assert.deepEqual(v5Lazy.fetched, FILES.map(name => `data/${name}.json`), 'a book-less game asks for the five data files and NOTHING else')
  ok(`C1 v3 engine (git ${V3_ENGINE_COMMIT}) and v5 engine agree: ${countGroups(v3Result.groups)} rows, ${countItems(v3Result.groups)} items, no warnings, zero book fetches`)

  // ── C2 bridge v2: real v2 engine vs the v5 engine, over v2 data ──
  const v2GameDir = writeGame(join(WORK, 'v2data', game), rawV2)
  const v2Result = hydrate(v2EngineDir, v2GameDir)
  const v5OverV2 = hydrate(v5EngineDir, v2GameDir)
  assert.deepEqual(v5OverV2.warnings, [], 'v5 engine warned over the v2 data')
  assert.deepEqual(noGates(v5OverV2.groups), noGates(v2Result.groups), 'v5 over v2 data ≠ v2 engine')
  assert.deepEqual(v5OverV2.fetched, FILES.map(name => `data/${name}.json`))
  ok(`C2 v2 engine (git ${V2_COMMIT}) and v5 engine agree: ${countGroups(v2Result.groups)} rows, ${countItems(v2Result.groups)} items, no warnings, zero book fetches`)

  // ── C3 the working tree hydrates clean (true before and after the rebuild) ──
  // For dino the child is given the REAL shelf: games/dino is still at v4 here,
  // so it pins nothing and asks for nothing — but the day it is rebuilt this same
  // line keeps working, because the shelf is there to answer.
  const treeBooksDir = game === 'dino' ? REAL_BOOKS : undefined
  const v5Tree = hydrate(v5EngineDir, workingTreeDir, treeBooksDir)
  assert.deepEqual(v5Tree.warnings, [], 'v5 engine warned over the working-tree data')
  ok(`C3 v5 engine over games/${game}: ${countGroups(v5Tree.groups)} rows, ${countItems(v5Tree.groups)} items, no warnings`)

  // ── C4 the v5 engine asks for page-relative URLs — the one rule that lets a published folder play from any subpath ──
  // CHANGED: the working tree's game may PIN books (dino does, since the rebuild), so
  // what it asks for is the five data files and then four files per pin, in pin order —
  // computed from the game on disk rather than assumed, so this line stays true either way.
  const treePins = migrateSet(readGameSet(workingTreeDir)).content.books
  assert.deepEqual(
    v5Tree.fetched,
    [...FILES.map(name => `data/${name}.json`), ...treePins.flatMap(pin => BOOK_FILE_NAMES.map(file => `books/${pin.name}/${pin.edition}/${file}.json`))],
    'the five data files, then four files per pinned book, page-relative, in loader order')
  assert.equal(v5Tree.heroImage, 'assets/heroBG.jpg', 'the hero is assets/…, not /assets/…')
  // the summarizer strips a leading slash for the bridges, so the item images are checked UNSTRIPPED
  assert.ok(v5Tree.images.length > 0 && v5Tree.images.every(url => url.startsWith('assets/')), `unstripped item images: ${v5Tree.images.join(', ')}`)
  let bookURLs = []
  if (rebuilt) {
    // NEW: a game WITH pins asks for the shelf too — page-relative, beside data/,
    // four files per book in PIN order, and nothing else.
    const rebuiltHydration = hydrate(v5EngineDir, rebuiltDir, REAL_BOOKS)
    assert.deepEqual(rebuiltHydration.warnings, [], 'the rebuilt game hydrates clean')
    bookURLs = PLAN.pins.flatMap(pin => BOOK_FILE_NAMES.map(file => `books/${pin.name}/${pin.edition}/${file}.json`))
    assert.deepEqual(rebuiltHydration.fetched, [...FILES.map(name => `data/${name}.json`), ...bookURLs], 'the five data files, then twelve book files in pin order')
    assert.ok(rebuiltHydration.fetched.every(url => url.startsWith('data/') || url.startsWith('books/')), 'every url is page-relative')
    assert.ok(rebuiltHydration.images.every(url => url.startsWith('assets/')), 'a BOOK\'s picture is still assets/<name> — the layer it came from is not in the url')
    assert.equal(rebuiltHydration.heroImage, 'assets/heroBG.jpg')
  }
  ok(`C4 the v5 engine asks for data/… ${rebuilt ? `then ${bookURLs.length} books/… in pin order ` : ''}and builds assets/… — page-relative, never absolute`)

  // ── C5 bridge v4: the REAL v4 engine and the v5 engine over the committed v4 data ──
  const v4Result = hydrate(v4EngineDir, v4Dir)
  const v5OverV4 = hydrate(v5EngineDir, v4Dir)
  const v5SavedV5 = hydrate(v5EngineDir, writeGame(join(WORK, 'v4toV5', game), migrateSet(structuredClone(rawV4))))
  assert.deepEqual(v4Result.warnings, [], 'the v4 engine warned over its own data')
  assert.deepEqual(v5OverV4.warnings, [], 'the v5 engine warned over the v4 data (lazy migration)')
  assert.deepEqual(v5SavedV5.warnings, [], 'the v5 engine warned over the SAVED migration')
  assert.deepEqual(v5OverV4.groups, v4Result.groups, 'v5 over v4 data ≠ v4 engine')
  assert.deepEqual(v5SavedV5.groups, v4Result.groups, 'v5 over the saved migration ≠ v4 engine')
  assert.deepEqual(v5OverV4.fetched, FILES.map(name => `data/${name}.json`), 'a book-less v4 game asks for no shelf')
  assert.equal(v5OverV4.totalBudget, v4Result.totalBudget, 'and the budget is the same number')
  ok(`C5 v4 engine (git ${V4_COMMIT}) and v5 engine agree over the committed v4 data and over its saved migration: ${countGroups(v4Result.groups)} rows, ${countItems(v4Result.groups)} items, no warnings, no book fetch`)

  // ── G1 border loudness: one warning per fault, by row, and nothing widens ──
  // Eight faults over five rows (a filter fault and a gate fault can share a row
  // — each is its own warning). The expected strings are the engine's §3.5
  // messages verbatim, so a reworded warning fails here on purpose. Row E's kind
  // is spelled like an Object.prototype member: a plain-object lookup would find
  // the inherited function and let it through.
  const broken = structuredClone(first)
  const [rowA, rowB, rowC, rowD, rowE] = flattenGroups(broken.content.groups)
  const labelFieldOf = (row) => fieldsOfType(broken.types.types.find(type => type.id === row.query.type)).find(field => field.key === 'label')
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
  const brokenDir = writeGame(join(WORK, 'broken', game), broken)
  const brokenResult = hydrate(v5EngineDir, brokenDir)
  assert.deepEqual([...brokenResult.warnings].sort(), [...expectedWarnings].sort(), 'exactly one warning per fault, each naming its row')
  const brokenRows = flatSummary(brokenResult.groups)
  ;[rowA, rowB, rowC].forEach(row => assert.deepEqual(brokenRows.find(each => each.id === row.id).items, [], `"${row.label}" fails closed: no items`))
  const brokenPlay = play(v5EngineDir, brokenDir, [])
  assert.deepEqual([...brokenPlay.warnings].sort(), [...expectedWarnings].sort(), 'the play child sees the same warnings')
  ;[rowA, rowB, rowC, rowD, rowE].forEach(row => assert.ok(!brokenPlay.start.visible.includes(row.id), `"${row.label}" starts hidden — its gate became never`))
  ok(`G1 ${expectedWarnings.length} faults → ${brokenResult.warnings.length} warnings, one each by row; broken filters show nothing; broken gates start hidden`)

  // ═════════════════════ the shelf and the rebuild (dino) ═════════════════════
  if (game === 'dino') {
    // ── I1 play, over the COMMITTED v4 data: the gate opens, closes, refunds, and says so ──
    const I1_STEPS = [
      { row: DINO.rows.lair,     thing: DINO.things.lavaPit },      // 1. pick a Lair (3 pts) → Location opens
      { row: DINO.rows.location, thing: DINO.things.volcanoRim },   // 2. pick the Location (1 pt)
      { row: DINO.rows.lair,     thing: DINO.things.lavaPit },      // 3. unpick the Lair → Location closes, refund
      { row: DINO.rows.location, thing: DINO.things.volcanoRim }    // 4. a pick in a hidden row is refused
    ]
    const checkPlay = (played, rows, things, label) => {
      const [pickedLair, pickedLocation, unpickedLair, refused] = played.steps
      assert.deepEqual(played.warnings, [], `${label}: no warnings while playing`)
      assert.ok(!played.start.visible.includes(rows.location), `${label}: Location starts hidden`)
      assert.deepEqual(played.start.unmet, [rows.dino, rows.lair], `${label}: only the Dino and Lair rows are required at the start`)
      assert.ok(pickedLair.visible.includes(rows.location), `${label}: picking a Lair shows Location`)
      assert.equal(pickedLocation.spent, 4, `${label}: Lava Pit (3) + Volcano Rim (1)`)
      assert.ok(!unpickedLair.visible.includes(rows.location), `${label}: unpicking the last Lair hides Location`)
      assert.deepEqual(unpickedLair.dropped, ['Volcano Rim'], `${label}: the refund is named`)
      assert.equal(unpickedLair.spent, 0, `${label}: the refund came back`)
      assert.deepEqual(refused.dropped, [], `${label}: nothing to refund — the pick never went in`)
      assert.equal(refused.spent, 0, `${label}: a pick in a hidden row is refused`)
      assert.ok(!refused.visible.includes(rows.location), `${label}: and the row stays hidden`)
      played.steps.forEach(step => assert.ok(!step.unmet.includes(rows.location), `${label}: a hidden required row never nags`))
    }
    checkPlay(play(v5EngineDir, v4Dir, I1_STEPS), DINO.rows, DINO.things, 'v5 over v4')
    // the same four steps under the REAL v4 engine give the same snapshots — C5's play half
    const v4Play = play(v4EngineDir, v4Dir, I1_STEPS)
    assert.deepEqual(play(v5EngineDir, v4Dir, I1_STEPS), v4Play, 'the v4 and v5 engines play the committed v4 data identically')
    ok('I1 play: Lair → Location appears; Location picked (spent 4); Lair unpicked → hidden, "Volcano Rim" refunded (spent 0); hidden pick refused — identical under the v4 and v5 engines')

    // ── T1–T4: the subject, said out loud (RE-AIMED, stage 4 §10 step 1) ──
    // These four pin WHAT THE COMMITTED SHELF HOLDS — the real books/ as data, the
    // bytes three games are built on. They were written in a world where that was
    // also the only shelf there could be, so they read as "a shelf is never written".
    // They do not say that and must not: a scratch shelf may be written freely (M12),
    // and the four below keep judging the committed bytes regardless. The anchor is
    // what stops them being quietly re-pointed at a copy and going on passing — a
    // scratch shelf holds the same bytes on the day it is made, so "every book
    // validates" would be just as true of a copy, and just as worthless.
    assert.ok(!REAL_BOOKS.startsWith(WORK + sep), 'T1–T4 read the repo\'s own books/, never the scratch root')
    assert.ok(!scratchShelves.includes(REAL_BOOKS), 'and never a copy of it')
    assert.ok(execFileSync('git', ['ls-files', '--', `${DINO_IN_REPO}/books`], { cwd: GIT_ROOT, encoding: 'utf8' }).trim().length > 0,
      'every byte the four judge below is committed data — this is the shelf, not a temp folder')

    // ── T1 the committed shelf ──
    const shelf = await shelfOf(REAL_BOOKS)
    const folders = readdirSync(REAL_BOOKS, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    assert.deepEqual(folders, ['basic', 'dinosaur-age', 'stats'], 'three book folders')
    const editionsOf = (name) => readdirSync(join(REAL_BOOKS, name)).filter(entry => !entry.startsWith('.')).sort()
    assert.deepEqual(editionsOf('basic'), ['1'])
    assert.deepEqual(editionsOf('stats'), ['1'])
    assert.deepEqual(editionsOf('dinosaur-age'), ['1', '2'])
    const editions = [['basic', 1], ['stats', 1], ['dinosaur-age', 1], ['dinosaur-age', 2]]
    editions.forEach(([name, edition]) => {
      const layer = readBookSync(REAL_BOOKS, { name, edition })
      assert.ok(layer !== null, `books/${name}/${edition} loads`)
      assert.deepEqual(validateBook(layer, shelf).map(problemText), [], `books/${name}/${edition} validates`)
      assert.equal(layer.manifest.version, undefined, 'book.json is not a data file: no version key')
      assert.deepEqual(Object.keys(layer.manifest), ['name', 'title', 'edition', 'requires'], 'the manifest\'s canonical key order')
      // every file on the shelf is canonical bytes: serialize(parse(text)) === text
      BOOK_FILE_NAMES.forEach(file => {
        const path = join(REAL_BOOKS, name, String(edition), `${file}.json`)
        if (!existsSync(path)) return
        const text = readFileSync(path, 'utf8')
        assert.equal(serialize(JSON.parse(text)), text, `books/${name}/${edition}/${file}.json is canonical`)
      })
      // every id the book DEFINES is in its own namespace (validateBook says so too; this is the census)
      const defined = [
        ...(layer.types?.types ?? []).flatMap(type => [type.id, ...type.sections.flatMap(section => [section.id, ...(section.fields ?? section.placement ?? []).map(field => field.id)])]),
        ...Object.values(layer.types?.sectionsFor ?? {}).flat().map(section => section.id),
        ...Object.values(layer.types?.fieldsFor ?? {}).flat().map(field => field.id),
        ...Object.values(layer.things?.things ?? {}).flat().map(thing => thing.id),
        ...(layer.proposals?.groups ?? []).map(row => row.id)
      ]
      assert.ok(defined.length > 0, `books/${name}/${edition} defines something`)
      defined.forEach(id => {
        assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id), `${id} fits the book-id grammar`)
        assert.ok(id.startsWith(`${name}:`), `${id} is in ${name}'s namespace`)
      })
    })
    // structure only: Basic and Stats ship a manifest and a types.json, nothing else
    ;['basic', 'stats'].forEach(name => {
      assert.deepEqual(readdirSync(join(REAL_BOOKS, name, '1')).sort(), ['book.json', 'types.json'], `books/${name}/1 holds exactly two files`)
    })
    const basic = readBookSync(REAL_BOOKS, { name: 'basic', edition: 1 })
    assert.equal(basic.types.types.length, 7, 'Basic: seven sheets')
    assert.equal(basic.types.types.reduce((n, type) => n + type.sections.length, 0), 23, 'Basic: twenty-three sections')
    assert.deepEqual(basic.types.types.map(type => type.id), ['basic:character', 'basic:item', 'basic:place', 'basic:faction', 'basic:origin', 'basic:trait', 'basic:skill'])
    const stats = readBookSync(REAL_BOOKS, { name: 'stats', edition: 1 })
    assert.equal(Object.values(stats.types.fieldsFor).flat().length, 5, 'Stats: five field additions')
    const da1 = readBookSync(REAL_BOOKS, { name: 'dinosaur-age', edition: 1 })
    assert.equal(Object.values(da1.things.things).flat().length, 23, 'Dinosaur Age 1: twenty-three shelf entries')
    assert.deepEqual(Object.keys(da1.things.things), ['basic:origin', 'basic:trait', 'basic:skill', 'basic:item', 'basic:place'], 'in the §10.3 bucket order')
    assert.deepEqual(Object.values(da1.things.things).map(bucket => bucket.length), [6, 6, 4, 4, 3])
    assert.equal(Object.values(da1.types.fieldsFor).flat().length, 4, 'Dinosaur Age 1: four field additions')
    assert.equal(da1.proposals.groups.length, 4, 'and four proposed rows')
    // the four gear images are byte copies of the game's own
    const GEAR = ['banana.png', 'cannon.jpg', 'rock.jpeg', 'skates.jpg']
    ;[1, 2].forEach(edition => {
      const dir = join(REAL_BOOKS, 'dinosaur-age', String(edition), 'assets')
      assert.deepEqual(readdirSync(dir).filter(notDot).sort(), GEAR, `dinosaur-age/${edition}/assets holds exactly the four gear images`)
      GEAR.forEach(file => assert.equal(sha256(join(dir, file)), sha256(join(workingTreeDir, 'assets', file)), `${file}: the same bytes as games/dino/assets`))
    })
    ;['basic', 'stats'].forEach(name => assert.equal(existsSync(join(REAL_BOOKS, name, '1', 'assets')), false, `books/${name}/1 has no assets/`))
    ok(`T1 the committed shelf: basic/1, stats/1, dinosaur-age/1 and /2; validateBook = [] for all four; every defined id in its own namespace and grammar; every file canonical; Basic 7 sheets / 23 sections, Stats 5 additions, Dinosaur Age 23 things / 4 additions / 4 rows; the four gear images byte-equal to games/dino/assets`)

    // ── T2 editions: edition 2 is edition 1 plus exactly one thing ──
    const da2 = readBookSync(REAL_BOOKS, { name: 'dinosaur-age', edition: 2 })
    const at = (edition, file) => readFileSync(join(REAL_BOOKS, 'dinosaur-age', String(edition), `${file}.json`), 'utf8')
    assert.equal(at(2, 'types'), at(1, 'types'), 'types.json byte-identical')
    assert.equal(at(2, 'proposals'), at(1, 'proposals'), 'proposals.json byte-identical')
    assert.deepEqual(da2.manifest, { ...da1.manifest, edition: 2 }, 'book.json differs only in `edition`')
    assert.deepEqual(da2.manifest.requires, da1.manifest.requires)
    const thingsOf = (layer) => Object.entries(layer.things.things).flatMap(([sheet, bucket]) => bucket.map(thing => [thing.id, sheet]))
    const ids1 = new Map(thingsOf(da1)), ids2 = new Map(thingsOf(da2))
    ids1.forEach((sheet, id) => {
      assert.equal(ids2.get(id), sheet, `${id} is still on ${sheet} in edition 2`)
      const before = Object.values(da1.things.things).flat().find(thing => thing.id === id)
      const after = Object.values(da2.things.things).flat().find(thing => thing.id === id)
      assert.deepEqual(after, before, `${id} is unchanged in edition 2`)
    })
    const added = [...ids2.keys()].filter(id => !ids1.has(id))
    assert.deepEqual(added, ['dinosaur-age:nest'], 'edition 2 adds exactly one thing')
    const nest = da2.things.things['basic:place'].find(thing => thing.id === 'dinosaur-age:nest')
    assert.deepEqual([nest.name, nest.cost, nest.kind], ['Nest', 1, 'lair'])
    assert.equal(da2.things.things['basic:place'].indexOf(nest), 2, 'at index 2 of the Place bucket — between Play pen and Volcano Rim')
    ok('T2 editions: every id of Dinosaur Age 1 is in edition 2 on the same sheet, unchanged; edition 2 adds exactly dinosaur-age:nest (a lair, cost 1, index 2); types.json and proposals.json byte-identical; book.json differs only in `edition`')

    // ── T3 the shelf speaks THIS version (NEW) ──
    // A version bump costs a CEREMONY (§4.2): every data file on the shelf is
    // re-stamped, and NOTHING else about it moves. This is the check that makes
    // the next bump unable to forget it — and the one that proves the eight-line
    // edit really was eight lines.
    const shelfFiles = listFiles(REAL_BOOKS).filter(notDot)
    const committedShelf = execFileSync('git', ['ls-tree', '-r', '--name-only', V6_COMMIT, '--', `${DINO_IN_REPO}/books`], { cwd: GIT_ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean).map(path => path.slice(`${DINO_IN_REPO}/books/`.length)).sort()
    assert.deepEqual(shelfFiles, committedShelf, 'the shelf gained and lost no file')
    let stamped = 0
    shelfFiles.forEach(rel => {
      const committed = () => gitShow(V6_COMMIT, `${DINO_IN_REPO}/books/${rel}`)
      if (!rel.endsWith('.json')) { assert.equal(sha256(join(REAL_BOOKS, rel)), sha256(join(v6PrevBooksDir, rel)), `${rel}: a picture is not a data file — byte-identical`); return }
      const text = readFileSync(join(REAL_BOOKS, rel), 'utf8')
      const file = JSON.parse(text)
      if (file.version === undefined) { assert.equal(text, committed(), `${rel}: book.json is not a data file, and not one byte moved`); return }
      assert.equal(file.version, SCHEMA_VERSION, `${rel} speaks version ${SCHEMA_VERSION}`)
      assert.equal(text.replace(`"version": ${SCHEMA_VERSION}`, `"version": ${SCHEMA_VERSION - 1}`), committed(), `${rel}: the ONLY byte that moved is the stamp`)
      stamped += 1
    })
    assert.equal(stamped, 8, 'eight data files on the shelf, eight stamps')
    editions.forEach(([name, edition]) => assert.deepEqual(validateBook(readBookSync(REAL_BOOKS, { name, edition }), shelf).map(problemText), [], `books/${name}/${edition} still validates at ${SCHEMA_VERSION}`))
    ok(`T3 the shelf speaks version ${SCHEMA_VERSION}: ${shelfFiles.length} files, the same set as ${V6_COMMIT}; ${stamped} data files stamped ${SCHEMA_VERSION} and byte-equal to the committed bytes once the stamp is put back; the four book.json manifests and the four pictures untouched; validateBook still [] for all four books`)

    // ── T4 the shelf carries no demand (NEW) ──
    // T3 says the shelf's only moved byte is the stamp. T4 says the OTHER half of
    // §12.1's decision out loud, because a decision nobody asserts is a decision the
    // next person quietly reverses: NO BOOK ON THE SHELF AUTHORS A DEMAND. The
    // vocabulary ships; the shipped content does not use it yet. Every book still
    // validates, and every thing on the shelf still hydrates with no `demands` key of
    // its own — which is what makes A5's "nothing to migrate" true of real bytes.
    let shelfThings = 0, demandingThings = 0
    editions.forEach(([name, edition]) => {
      const layer = readBookSync(REAL_BOOKS, { name, edition })
      Object.values(layer.things?.things ?? {}).flat().forEach(thing => {
        shelfThings += 1
        assert.equal('demands' in thing, false, `books/${name}/${edition}: "${thing.name}" carries no demands key`)
        if ('demands' in thing) demandingThings += 1
      })
      assert.deepEqual(validateBook(layer, shelf).map(problemText), [], `books/${name}/${edition} still validates at ${SCHEMA_VERSION}`)
    })
    assert.equal(demandingThings, 0)
    // and the whole shelf, judged as one game's library, dangles nothing — the demand
    // audit is a third walk over the things, so a shelf that carries none says nothing
    const wholeShelf = flattenGame({ books: editions.map(([name, edition]) => readBookSync(REAL_BOOKS, { name, edition: Number(edition) })).filter(layer => layer.pin.name !== 'dinosaur-age' || layer.pin.edition === 1), game: null })
    assert.deepEqual(crossChecks(wholeShelf), [], 'nothing on the shelf points nowhere — demands included')
    ok(`T4 the shelf carries no demand: all ${shelfThings} things across the four books carry no \`demands\` key at all (§12.1's decision, asserted so it cannot be quietly reversed), every book still validates at ${SCHEMA_VERSION}, and the whole shelf flattened dangles nothing — the demand audit included`)

    // ── W1 the shelf's placement fields are real (NEW) ──
    // The quantity convention (§2.3) is a claim about the SHELF, not about the
    // engine: `quantity` multiplies only because Basic authored exactly one such
    // field, as a number, with a default of 1. If a book ever names a second one,
    // this is where the owner finds out — before a player pays twice for a Level.
    //
    // CHANGED (stage 4, gap 13): IT NOW SAYS WHAT TO DO. An author can CREATE a book since
    // the write routes landed, so the second `quantity` this check forbids is a thing a
    // person can now author into books/ in a few clicks — and before this the check went red
    // saying only "and NO other shipped list section carries a `quantity`", which names the
    // rule and not the remedy. The border does NOT refuse it (validate.js judges one file
    // against its sheet and knows nothing about the shelf, and quantityFieldOf is a reader,
    // not a checker), so until it does, the sentence below is the whole of the author's
    // guidance. THE HANDOFF, recorded where it will be read: refuse a second `quantity`
    // placement field at the border — the shelf-wide question belongs with bookRules, which
    // already judges one book against the books it requires — with a sentence that names the
    // section that already has one. Then this check becomes the second opinion it ought to be.
    const shelfLayersAll = editions.map(([name, edition]) => readBookSync(REAL_BOOKS, { name, edition }))
    const shelfSections = shelfLayersAll.flatMap(layer => [
      ...(layer.types?.types ?? []).flatMap(type => type.sections),
      ...Object.values(layer.types?.sectionsFor ?? {}).flat()
    ])
    const listSections = shelfSections.filter(section => section.kind === 'list')
    const spell = (field) => `${field.key}:${field.type}:${JSON.stringify(field.default)}`
    const sectionNamed = (id) => listSections.find(section => section.id === id)
    assert.deepEqual(sectionNamed('basic:character.gear').placement.map(spell), ['quantity:number:1'], 'Gear ships exactly one placement field, and it is the one that multiplies')
    assert.deepEqual(sectionNamed('basic:character.skills').placement.map(spell), ['level:number:1'], 'Skills ships exactly one, and a LEVEL does not multiply')
    assert.deepEqual(listSections.filter(section => section.placement.some(field => field.key === QUANTITY_KEY)).map(section => section.id),
      ['basic:character.gear'], 'and NO other list section on any shipped sheet carries a `quantity`. IF THIS IS RED, a book on the shelf has authored a second one: `quantity` is the ONE placement key that multiplies an entry\'s cost (sheet.js: entryCost = cost × quantityOf), so a second one makes a player pay twice for something that was never meant to be countable. The fix is in the BOOK, not here — rename that placement field to anything else (Basic\'s Skills calls its own `level` for exactly this reason, and a level does not multiply) by cutting a new edition of the book that added it, and re-pin. Only widen this list if the owner has decided a second section really should multiply')
    assert.equal(quantityFieldOf(sectionNamed('basic:character.gear')).id, 'basic:character.gear.quantity')
    assert.equal(quantityFieldOf(sectionNamed('basic:character.skills')), null)
    listSections.filter(section => section.id !== 'basic:character.gear').forEach(section => assert.equal(quantityFieldOf(section), null, `${section.id} multiplies nothing`))
    ok(`W1 the shelf's placement fields: over the REAL books, ${listSections.length} list sections; Gear's placement is exactly quantity/number/1 and Skills' is exactly level/number/1; no other shipped list section carries a "quantity", so quantityFieldOf answers null for every one of them — and the assertion now carries the remedy, because an author can write a second one into a book since the shelf's write routes landed and the border does not yet refuse it`)

    // ── D1 rebuild in-process — the exact-order equality test ──
    // The whole books arc's promise to the player, measured: the rebuilt dino,
    // merged against the real shelf and hydrated by the real engine, shows the
    // same four rows with the same labels, gates, min/max, backgrounds and the
    // same seventeen items IN ORDER as the committed v4 game under the v4 engine.
    const migratedV4 = migrateSet(structuredClone(rawV4))
    assert.deepEqual(validateGame({ own: rebuilt, books: shelfLayers }).map(problemText), [], 'the rebuilt game validates against its shelf')
    assert.deepEqual(rebuilt.content.books, PLAN.pins, 'the three pins')
    assert.deepEqual(rebuilt.content.groups, [], 'the game owns no rows any more')
    // CHANGED (Stage 2): an override slot now carries the BINDING as well as the
    // label — the game says which section of the player's sheet each of the four
    // proposed rows fills, because a frozen book edition cannot be edited to say it.
    assert.deepEqual(rebuilt.content.rowOverrides, Object.fromEntries(Object.values(PLAN.rows).map(({ from, to, fills }) => [to, { label: from, fills }])), 'four labels and four bindings, and nothing else, overridden')
    assert.deepEqual(rebuilt.rules, { version: 7, groupRules: {} }, 'rules keeps an empty cabinet — the book proposes the numbers')
    assert.deepEqual(rebuilt.types, { version: 7, types: [], sectionsFor: {}, fieldsFor: {} }, 'all four sheets are Basic\'s now')
    assert.deepEqual(rebuilt.themes.page, migratedV4.themes.page, 'the page theme is untouched — it was never about a row')
    assert.deepEqual(Object.keys(rebuilt.themes.groupThemes), Object.keys(migratedV4.themes.groupThemes).map(id => PLAN.rows[id].to), 'the two backgrounds are RE-KEYED to the proposed rows')
    assert.deepEqual(Object.values(rebuilt.themes.groupThemes), Object.values(migratedV4.themes.groupThemes), 'with the same values')
    assert.deepEqual(Object.keys(rebuilt.things.things), ['basic:character', 'basic:place'], 'only the two buckets this game still owns')
    assert.equal(Object.values(rebuilt.things.things).flat().length, 10, 'ten own things: eight pets and two joke lairs')
    assert.deepEqual(rebuilt.things.order, PLAN.order, 'and the v4 Lair order, written down')
    // the uuid census: nothing minted, nothing lost beyond the 23 the plan retires
    const beforeIds = uuidsIn(serialize(migratedV4))
    const afterIds = uuidsIn(serialize(rebuilt))
    assert.ok([...afterIds].every(id => beforeIds.has(id)), 'no uuid was minted')
    assert.equal(beforeIds.size - afterIds.size, 23, 'exactly 23 uuids retire')
    assert.equal(afterIds.size, 10, 'ten survive — the cast')
    assert.equal(statusOf(rebuilt, PLAN), 'done', 'and the result reads as `done`')
    assert.equal(statusOf(migratedV4, PLAN), 'fresh', 'while the committed v4 game reads as `fresh`')
    // the REAL engine over the rebuilt files + the REAL shelf
    const TALI = 'a8d09a0f-f269-4a04-a173-d694dc36b105'
    const rebuiltPlay = hydrate(v5EngineDir, rebuiltDir, REAL_BOOKS, { CYOA_SAMPLE: TALI })
    assert.deepEqual(rebuiltPlay.warnings, [], 'zero warnings')
    assert.equal(countGroups(rebuiltPlay.groups), 4, 'four rows')
    assert.equal(countItems(rebuiltPlay.groups), 17, 'seventeen items')
    assert.equal(rebuiltPlay.totalBudget, 10, 'the budget SHOWS THROUGH from Dinosaur Age')
    assert.equal(rebuilt.rules.totalBudget, undefined, 'because the game writes none')
    // THE equality: what a player sees, row by row, item by item, in order
    assert.deepEqual(project(rebuiltPlay.groups), project(v4Result.groups), 'the rebuilt dino projects EXACTLY what the v4 dino projected')
    // spelled out, so a failure above says which row
    const [companions, gear, lairs, locations] = rebuiltPlay.groups
    assert.deepEqual(rebuiltPlay.groups.map(row => row.id), [REBUILT.rows.dino, REBUILT.rows.gear, REBUILT.rows.lair, REBUILT.rows.location])
    assert.deepEqual(rebuiltPlay.groups.map(row => row.label), Object.values(PLAN.rows).map(each => each.from), 'the four v4 labels, in order')
    assert.deepEqual(rebuiltPlay.groups.map(row => `${row.min}/${row.max}`), ['1/1', '0/Infinity', '1/3', '0/Infinity'])
    const shown = (row) => row.items.map(item => `${item.name} ${item.cost} ${item.imageURL}`)
    assert.deepEqual(shown(companions), ['Tali 1 assets/dino.jpg', 'Miku 2 assets/flyer.jpg', 'Speedy Gonzales 2 assets/velo.png', 'The King 3 assets/trex.jpg', 'Dino Jesus 1 assets/trex.jpg', 'Jeff 2 assets/anky.jpg', 'Dino Sandra Bullock 4 assets/stag.jpg', 'Cery 4 assets/tri.png'])
    assert.deepEqual(shown(gear), ['Water Gun 1 assets/cannon.jpg', 'Dino Skates 1 assets/skates.jpg', 'THE BANANA 2 assets/banana.png', 'Cute rock 0 assets/rock.jpeg'])
    assert.deepEqual(shown(lairs), ['The Scritches Dimension 0 ', 'Lava Pit 3 ', 'Play pen 2 ', 'King of Burger!! 2 '])
    assert.deepEqual(shown(locations), ['Volcano Rim 1 '])
    assert.deepEqual(locations.showWhen, { kind: 'anyInRow', row: REBUILT.rows.lair }, 'the Location row waits on the Lair row')
    // B7, the one accepted visible change: a pet now carries the shelf's fields
    const tali = rebuiltPlay.samples[TALI]
    assert.equal(tali.concept, 'A biggie dino!', 'the v4 `label` became Basic\'s `concept`')
    assert.equal(tali.size, 'biggie')
    assert.deepEqual(tali.origin, [{ thing: 'dinosaur-age:tyrannosaurus', name: 'Tyrannosaurus' }], 'a placement resolves to its pointer AND the placed thing\'s name')
    ;['strength', 'dexterity', 'intelligence', 'health'].forEach(key => assert.equal(tali[key], 10, `${key} hydrates to Stats' default 10 — Tali says nothing`))
    ok('D1 rebuild in-process: the rebuilt files are the planned ones (three pins, four label overrides, empty rules/types, re-keyed themes, ten own things, the v4 Lair order); 23 uuids retire and none is minted; the real engine over the real shelf gives 4 rows, 17 items, budget 10, zero warnings, and a projection deep-equal to the v4 engine\'s over the committed v4 data')

    // ── D2 the rebuild CLI: exit 0 writes D1's bytes; 1 refuses a second run; 2 refuses a guess ──
    const rebuiltText = Object.fromEntries(FILES.map(name => [name, serialize(rebuilt[name])]))
    const scratchShelf = copyShelf(join(WORK, 'shelf-cli', 'books'))
    const cliDir = writeGame(join(WORK, 'rebuild-cli', game), rawV4)
    const run1 = runRebuildCLI(['--data-dir', join(cliDir, 'data'), '--books-dir', scratchShelf])
    assert.equal(run1.status, 0, `first run exits 0:\n${run1.stdout}`)
    assert.deepEqual(readGameText(cliDir), rebuiltText, 'the CLI wrote exactly D1\'s bytes')
    assert.match(run1.stdout, /dino rebuilt on basic 1, stats 1, dinosaur-age 1/)
    assert.match(run1.stdout, /17 items in v4 order/)
    assert.match(run1.stdout, /wrote 5 files to /)
    const run2 = runRebuildCLI(['--data-dir', join(cliDir, 'data'), '--books-dir', scratchShelf])
    assert.equal(run2.status, 1, 'a second run exits 1')
    assert.match(run2.stdout, /already rebuilt — nothing written/)
    assert.deepEqual(readGameText(cliDir), rebuiltText, 'and wrote nothing')
    const partialDir = writeGame(join(WORK, 'rebuild-partial', game), rawV4)
    const partialThings = readGameSet(partialDir).things
    partialThings.things[Object.keys(partialThings.things)[0]][0].name = 'Oops'   // one hand-edit the plan does not expect
    writeFileSync(join(partialDir, 'data', 'things.json'), serialize(partialThings))
    const partialBefore = readGameText(partialDir)
    const run3 = runRebuildCLI(['--data-dir', join(partialDir, 'data'), '--books-dir', scratchShelf])
    assert.equal(run3.status, 2, 'a hand-edited copy exits 2')
    assert.match(run3.stdout, /partially rebuilt — restore data from git/)
    assert.match(run3.stdout, /^not fresh: /m, 'and BOTH audits are printed, so the state is diagnosable')
    assert.match(run3.stdout, /^not done: /m)
    assert.deepEqual(readGameText(partialDir), partialBefore, 'nothing written')
    // a shelf that cannot answer a pin: exit 2, and the pin is named
    const shortShelf = copyShelf(join(WORK, 'shelf-short', 'books'))
    rmSync(join(shortShelf, 'stats'), { recursive: true })
    const freshDir = writeGame(join(WORK, 'rebuild-short', game), rawV4)
    const freshBefore = readGameText(freshDir)
    const run4 = runRebuildCLI(['--data-dir', join(freshDir, 'data'), '--books-dir', shortShelf])
    assert.equal(run4.status, 2, 'a shelf missing Stats exits 2')
    assert.match(run4.stdout, /"stats" 1 is not on the shelf/)
    assert.match(run4.stdout, /nothing written/)
    assert.deepEqual(readGameText(freshDir), freshBefore, 'and really wrote nothing')
    const usage = runRebuildCLI(['--nope'])
    assert.equal(usage.status, 1)
    assert.match(usage.stdout, /usage: node rebuild-dino-v5\.mjs/)
    ok('D2 rebuild CLI: exit 0 writes D1\'s bytes and prints the summary; a second run exits 1 (already rebuilt); a hand-edited copy exits 2 printing both audits; a shelf without Stats exits 2 naming the pin; usage exits 1 — nothing written on 1 or 2')

    // ── D3 play replay: I1's four steps over the REBUILT files + the shelf ──
    const rebuiltSteps = [
      { row: REBUILT.rows.lair,     thing: REBUILT.things.lavaPit },
      { row: REBUILT.rows.location, thing: REBUILT.things.volcanoRim },
      { row: REBUILT.rows.lair,     thing: REBUILT.things.lavaPit },
      { row: REBUILT.rows.location, thing: REBUILT.things.volcanoRim }
    ]
    checkPlay(play(v5EngineDir, rebuiltDir, rebuiltSteps, REAL_BOOKS), REBUILT.rows, REBUILT.things, 'the rebuilt game')
    ok('D3 play replay: the rebuilt dino plays I1 exactly — Location starts hidden, a Lair opens it, Volcano Rim costs 4, unpicking refunds "Volcano Rim" to 0 and hides it, a pick in a hidden row is refused, zero warnings')

    // ── D4 the pin is real: edition 2 puts Nest in the Lairs row; edition 3 fails closed ──
    const atEdition = (edition) => {
      const set = structuredClone(rebuilt)
      set.content.books = PLAN.pins.map(pin => pin.name === 'dinosaur-age' ? { name: pin.name, edition } : pin)
      const dir = writeGame(join(WORK, `pinned-${edition}`, game), set)
      cpSync(join(workingTreeDir, 'assets'), join(dir, 'assets'), { recursive: true })
      return hydrate(v5EngineDir, dir, scratchShelf)
    }
    const one = atEdition(1)
    const two = atEdition(2)
    assert.deepEqual(two.warnings, [], 'edition 2 hydrates clean')
    assert.deepEqual(one.groups[2].items.map(item => item.name), ['The Scritches Dimension', 'Lava Pit', 'Play pen', 'King of Burger!!'])
    assert.deepEqual(two.groups[2].items.map(item => item.name), ['The Scritches Dimension', 'Lava Pit', 'Play pen', 'King of Burger!!', 'Nest'], 'Nest lands at index 4 — after the game\'s arrangement')
    assert.equal(countItems(two.groups), 18)
    const withoutNest = structuredClone(two.groups)
    withoutNest[2].items = withoutNest[2].items.filter(item => item.name !== 'Nest')
    assert.deepEqual(project(withoutNest), project(one.groups), 'the two hydrations differ ONLY there')
    // edition 3 is not on the shelf: ONE fault, and the rows that showed the book's shelves offer nothing
    const three = atEdition(3)
    assert.deepEqual(three.warnings.filter(line => line.includes('is not on the shelf')),
      ['Book fault — content.books[2]: "dinosaur-age" 3 is not on the shelf; the book is skipped'])
    assert.equal(countGroups(three.groups), 0, 'every row this game shows is PROPOSED by Dinosaur Age — skipping it leaves no rows at all (fail closed)')
    assert.equal(countItems(three.groups), 0)
    ok('D4 the pin is real: at edition 1 the Lair row offers 4, at edition 2 it offers 5 with Nest at index 4 and nothing else differs; at edition 3 the book is skipped, F1 is warned, and the game falls closed to zero rows')

    // ── D5 the committed data (binds once the owner runs the rebuild) ──
    // CHANGED: the gate now asks TWO questions, not one. It always asked "has the
    // rebuild been run?" (statusOf); it now also asks "does the game on disk speak
    // THIS contract?". Both must hold, because rebuiltText is written by today's
    // migration and is therefore stamped SCHEMA_VERSION — so a game whose files
    // still carry the previous stamp cannot byte-equal it, and saying so is the
    // ceremony a version bump costs (§4.2), not a failure of the rebuild.
    // The assertion itself is untouched: when it runs it still demands every byte.
    const onDisk = readGameSet(workingTreeDir)
    if (statusOf(migrateSet(onDisk), PLAN) === 'done' && onDisk.content.version === SCHEMA_VERSION) {
      assert.deepEqual(readGameText(workingTreeDir), rebuiltText, 'games/dino byte-equals D1\'s output')
      assert.equal(treeHash(REAL_BOOKS), realBooks, 'and the shelf D1 merged against is the shelf on disk')
      ok('D5 games/dino byte-equals the rebuild script\'s output, over the committed shelf')
    } else {
      skip(`D5 — games/dino is not at version ${SCHEMA_VERSION} yet; the owner runs tools/rebuild-dino-v5.mjs once, at the end`)
    }

    // ── D6 the dino data edit (NEW) ──
    // Stage 2's whole visible change to the DATA: one declaration and four
    // bindings, written by the same script that wrote the rest (D5, re-run just
    // above). The claim worth making out loud is the last one: a binding changes
    // what a pick RECORDS, never what a row OFFERS — so D1's row-by-row,
    // item-by-item comparison against the v4 game still holds, untouched.
    const authored = readGameSet(workingTreeDir)
    const BINDINGS = [
      ['dinosaur-age:row-companions', 'basic:character.companions'],
      ['dinosaur-age:row-gear',       'basic:character.gear'],
      ['dinosaur-age:row-lairs',      'basic:character.places'],
      ['dinosaur-age:row-locations',  'basic:character.places']
    ]
    assert.equal(authored.content.sheet, 'basic:character', 'the game declares the sheet the player builds')
    assert.deepEqual(Object.entries(authored.content.rowOverrides).map(([id, slot]) => [id, slot.fills]), BINDINGS, 'four override slots, each naming the section its row fills')
    assert.deepEqual(authored.content.groups, [], 'and the game still owns no rows of its own — every one of them is Dinosaur Age\'s')
    const authoredMerge = mergeLayers({ books: shelfLayers, game: authored })
    assert.deepEqual(authoredMerge.faults, [], 'the merge has nothing to say')
    assert.deepEqual(validateGame({ own: authored, books: shelfLayers }), [], 'and the whole game fits the contract, judged with its books')
    assert.deepEqual(authoredMerge.set.content.groups.map(row => [row.id, row.fills]), BINDINGS, 'the bindings show through the merge, in row order')
    assert.equal(authoredMerge.set.content.sheet, 'basic:character')
    assert.deepEqual(readGameText(workingTreeDir), rebuiltText, 'the edit on disk IS what the script writes — no hand-tidying')
    // the real engine over the real shelf: the sheet resolves, every row binds,
    // and the Gear row is the only one that multiplies
    assert.deepEqual(v5Tree.warnings, [], 'zero warnings')
    assert.equal(v5Tree.playerSheet.id, 'basic:character')
    assert.equal(v5Tree.playerSheet.label, 'Character')
    assert.deepEqual(v5Tree.playerSheet.fields.map(field => field.key), ['name', 'concept', 'size', 'strength', 'dexterity', 'intelligence', 'health', 'notes'], '§2.5\'s eight typed slots, from three books, with no game-side authoring at all')
    assert.deepEqual(v5Tree.bindings.map(row => [row.id, row.fills]), BINDINGS, 'every hydrated row carries its SECTION')
    assert.deepEqual(v5Tree.bindings.map(row => row.quantityField), [null, 'quantity', null, null], 'and only Gear multiplies')
    assert.deepEqual(v5Tree.bindings.map(row => row.items), [8, 4, 4, 1], 'the same 17 items D1 counted — a binding changes what a pick RECORDS, never what a row OFFERS')
    assert.deepEqual(project(rebuiltPlay.groups), project(v4Result.groups), 'and D1\'s projection against the v4 game still holds')
    ok('D6 the dino data edit: content.sheet is basic:character, four rowOverrides carry the four bindings, the game still owns no rows; the merge has zero faults and validateGame is []; games/dino byte-equals the rebuild script\'s output (D5, re-run); the engine resolves the sheet to Character with eight typed slots, binds all four rows, multiplies only Gear, and still offers 8/4/4/1 items — D1\'s projection against the v4 dino, unchanged')

    // ── D7 dino is unchanged at v7 (NEW) ──
    // §12.1's decision, cashed: the ONLY thing this stage does to games/dino is stamp
    // five version lines. No demand is authored, so the game must still project D1's
    // play item for item — which is the strongest form of "nothing happened".
    {
      const disk = readGameSet(workingTreeDir)
      FILES.forEach(file => {
        const text = readFileSync(join(workingTreeDir, 'data', `${file}.json`), 'utf8')
        const committed = gitShow(V6_COMMIT, `${DINO_IN_REPO}/games/dino/data/${file}.json`)
        assert.equal(text.replace(`"version": ${SCHEMA_VERSION}`, `"version": ${SCHEMA_VERSION - 1}`), committed, `${file}.json: five version lines, and nothing else, since ${V6_COMMIT}`)
      })
      assert.deepEqual(validateGame({ own: disk, books: shelfLayers }), [], 'validateGame is []')
      assert.equal(JSON.stringify(disk.things.things).includes('"demands"'), false, 'not one thing of dino\'s own authors a demand')
      assert.deepEqual(disk.things.order, JSON.parse(gitShow(V6_COMMIT, `${DINO_IN_REPO}/games/dino/data/things.json`)).order, 'things.order is untouched')
      // the projection, item for item, row for row — against the v4 game D1 pinned it to
      assert.deepEqual(project(v5Tree.groups), project(v4Result.groups), 'the v7 game projects exactly what the v4 dino projected')
      assert.deepEqual(v5Tree.warnings, [], 'and says nothing while doing it')
      // every hydrated item now carries `demands`, and for this game every one is []
      const demandsOfEveryItem = flatSummary(rebuiltPlay.groups).flatMap(row => row.items.map(item => item.demands))
      assert.deepEqual([...new Set(demandsOfEveryItem.map(each => JSON.stringify(each ?? null)))], ['null'],
        'the PROJECTION carries no demands at all (summarize never did), so the bridges keep comparing whole answers')
      ok(`D7 dino unchanged at v7: its five data files differ from ${V6_COMMIT} in the version line only, validateGame is [], no thing of its own authors a demand, things.order is untouched, and the engine projects EXACTLY D1's play — ${countGroups(v5Tree.groups)} rows, ${countItems(v5Tree.groups)} items, zero warnings`)
    }

    // ── G3 border loudness, the sheet (NEW) ──
    // Five hand-broken games, each warning EXACTLY once, in §3.10's wording, and
    // each failing CLOSED. Failing closed here means the row offers NOTHING: the
    // alternative (keep offering the picks, they simply never reach the sheet)
    // makes the player PAY POINTS for an entry that appears nowhere, and paying
    // for nothing is silently wrong where an empty row is visibly wrong.
    const healthyItems = Object.fromEntries(v5Tree.bindings.map(row => [row.id, row.items]))
    const brokenSheet = (label, edit) => {
      const set = structuredClone(authored)
      edit(set)
      const dir = writeGame(join(WORK, `sheet-broken-${label.replace(/\W+/g, '-')}`, game), set)
      return hydrate(v5EngineDir, dir, REAL_BOOKS)
    }
    const GEAR_ROW = 'dinosaur-age:row-gear'
    const GEAR_LABEL = 'Now give your Dino stuffables!'
    // 1. the DECLARATION dangles. One cause, ONE sentence: every bound row would
    //    otherwise report too, which is five sentences for one typo.
    const noSheet = brokenSheet('no sheet', set => { set.content.sheet = 'basic:charcter' })
    assert.deepEqual(noSheet.warnings, ['This game builds a sheet that does not exist (basic:charcter); no sheet is shown'], 'one warning, and no row repeats it')
    assert.equal(noSheet.playerSheet, null, 'no sheet is shown')
    assert.deepEqual(noSheet.bindings.map(row => [row.fills, row.items]), Array(4).fill([null, 0]), 'and every bound row fails closed')
    // 2–4. the three ways a binding can be wrong, one row at a time
    const faults = [
      ['an unknown section', 'basic:character.gearz', `Row "${GEAR_LABEL}" fills a section that is not on the player's sheet (basic:character.gearz); it shows nothing`],
      ['a FIELDS section',   'basic:character.notes', `Row "${GEAR_LABEL}" fills "Notes", which holds fields, not entries (basic:character.notes); it shows nothing`],
      ['another shelf',      'basic:character.skills', `Row "${GEAR_LABEL}" shows basic:item but fills "Skills", which lists basic:skill (basic:character.skills); it shows nothing`]
    ]
    faults.forEach(([label, fills, warning]) => {
      const result = brokenSheet(label, set => { set.content.rowOverrides[GEAR_ROW].fills = fills })
      assert.deepEqual(result.warnings, [warning], `${label}: exactly one warning, in §3.10's wording`)
      assert.equal(result.playerSheet.id, 'basic:character', `${label}: the sheet itself is fine`)
      result.bindings.forEach(row => assert.equal(row.items, row.id === GEAR_ROW ? 0 : healthyItems[row.id], `${label}: ${row.id} is ${row.id === GEAR_ROW ? 'empty' : 'untouched'}`))
    })
    // 5. a binding with no sheet at all — the row names a section of a sheet this
    //    game does not build. The other three bindings go, so the ONE fault left
    //    is the one this fixture is about.
    const bindingWithoutSheet = brokenSheet('bound with no sheet', set => {
      set.content.sheet = ''
      Object.entries(set.content.rowOverrides).forEach(([id, slot]) => { if (id !== GEAR_ROW) slot.fills = '' })
    })
    assert.deepEqual(bindingWithoutSheet.warnings, [`Row "${GEAR_LABEL}" fills a section but this game builds no sheet (basic:character.gear); it shows nothing`])
    assert.equal(bindingWithoutSheet.playerSheet, null)
    assert.deepEqual(bindingWithoutSheet.bindings.map(row => row.items), [8, 0, 4, 1], 'the bound row shows nothing; the three plain pickers are exactly the v5 rows they were')
    ok('G3 border loudness, the sheet: five hand-broken games, each warning EXACTLY once in §3.10\'s wording — a dangling declaration says its one sentence and no row repeats it (every bound row still fails closed), and each of the four binding faults empties ITS row while every other row keeps every item')

    // ── G4 border loudness, demands (NEW) ──
    // Five more hand-broken games, and the rule is the one G3 already keeps: ONE
    // sentence per fault, by NAME, and fail CLOSED. Closed here means the thing is
    // not on sale — absent from `row.items` — because an entry whose rule this game
    // cannot RUN is not "always allowed" (that silently drops the author's rule) and
    // not "always refused" (a permanently grey card nobody can explain). Every other
    // entry in that row, and every other row, is untouched.
    const BURGER = 'b0e6c387-5297-4cd6-9a4a-a61fb51990c7'          // a lair the GAME owns
    const LAIRS_ROW = 'dinosaur-age:row-lairs'
    const demanding = (label, list, extra = () => {}) => brokenSheet(`demand-${label.replace(/\W+/g, '-')}`, set => {
      set.things.things['basic:place'].find(thing => thing.id === BURGER).demands = list
      extra(set)
    })
    const burgerName = 'King of Burger!!'
    const cases = [
      ['a slot not on this game\'s sheet', [{ field: 'stats:nowhere', op: 'gte', value: 2 }],
        `Thing "${burgerName}" cannot evaluate a demand — names a field that is not on this game's sheet (stats:nowhere); it is not offered`],
      ['an operator that does not fit', [{ field: 'basic:character.places', op: 'gte', value: 2 }],
        `Thing "${burgerName}" cannot evaluate a demand — operator "gte" does not fit a list field (places); it is not offered`],
      ['a holds naming a thing off the shelf', [{ field: 'basic:character.places', op: 'holds', value: 'dinosaur-age:atlantis' }],
        `Thing "${burgerName}" cannot evaluate a demand — names a thing that is not on the Places shelf (dinosaur-age:atlantis); it is not offered`],
      ['a valueless operator carrying a value', [{ field: 'basic:character.places', op: 'none', value: 'x' }],
        `Thing "${burgerName}" cannot evaluate a demand — operator "holds nothing" takes no value (found "x"); it is not offered`]
    ]
    cases.forEach(([label, list, warning]) => {
      const result = demanding(label, list)
      assert.deepEqual(result.warnings, [warning], `${label}: exactly ONE warning, naming the thing`)
      const rows = flatSummary(result.groups)
      const lairs = rows.find(row => row.id === LAIRS_ROW)
      assert.ok(lairs !== undefined, `${label}: the row still draws`)
      assert.equal(lairs.items.some(item => item.id === BURGER), false, `${label}: and the thing is NOT on sale — absent from row.items`)
      assert.equal(lairs.items.length, healthyItems[LAIRS_ROW] - 1, `${label}: the row's count drops by exactly one`)
      rows.filter(row => row.id !== LAIRS_ROW).forEach(row => assert.equal(row.items.length, healthyItems[row.id], `${label}: ${row.id} is untouched`))
      // it is refused ONCE, not once per demand: a second, equally broken clause on
      // the same thing must not double the sentence
      const twice = demanding(`${label} twice`, [...list, ...list])
      assert.deepEqual(twice.warnings, [warning], `${label}: ONE sentence per THING, not one per demand`)
    })
    // 5. `sheet: ""` — every demanding thing has ONE cause, so it is said ONCE for the
    //    whole game instead of once per entry. Same one-cause rule the audit and
    //    resolveFills already follow.
    const sheetless = demanding('no sheet at all', [{ field: 'basic:character.places', op: 'any', value: '' }], set => {
      set.content.sheet = ''
      Object.values(set.content.rowOverrides).forEach(slot => { slot.fills = '' })
      set.things.things['basic:place'].find(thing => thing.id !== BURGER).demands = [{ field: 'basic:character.places', op: 'any', value: '' }]
    })
    assert.deepEqual(sheetless.warnings, ['This game builds no sheet, so 2 entries that demand something are not offered'], 'ONE sentence for the whole game, counting the entries')
    assert.equal(sheetless.playerSheet, null)
    const sheetlessLairs = flatSummary(sheetless.groups).find(row => row.id === LAIRS_ROW)
    assert.equal(sheetlessLairs.items.length, healthyItems[LAIRS_ROW] - 2, 'and BOTH demanding things are unofferable, while the book\'s lairs are still there')
    assert.deepEqual(sheetlessLairs.items.map(item => item.name), ['Lava Pit', 'Play pen'])
    // and the healthy shape: a demand this game CAN judge costs no warning and no item
    const healthyDemand = demanding('healthy', [{ field: 'basic:character.places', op: 'lacks', value: '6ff555af-d3b4-404f-99f6-d84e66ed54c0' }])
    assert.deepEqual(healthyDemand.warnings, [], 'a demand the game can run says nothing…')
    assert.deepEqual(flatSummary(healthyDemand.groups).map(row => row.items.length), flatSummary(v5Tree.groups).map(row => row.items.length), '…and takes nothing off the shelf')
    ok(`G4 border loudness, demands: five hand-broken games — a slot not on this game's sheet, an operator that does not fit, a \`holds\` naming a thing off the shelf, a valueless operator carrying a value, and \`sheet: ""\` — each warning EXACTLY once (by the thing's name, or once for the whole game), each failing CLOSED so the entry is absent from row.items and the row's count drops by one while the row still draws and every other entry is still offered; two broken clauses on one thing are still ONE sentence; and a demand the game CAN judge costs nothing at all`)

    // ── G2 border loudness for books: the §5.3 shelf, warned once per fault ──
    // A scratch shelf carrying the "dup 1" book of §5.3 — it requires ONLY basic 1,
    // so Kahn's name tie-break puts it before stats and dinosaur-age, which is
    // what makes it the first definer of the water gun and the first proposer.
    const dupShelf = copyShelf(join(WORK, 'shelf-dup', 'books'))
    writeBook(dupShelf, 'dup', 1, {
      book: { name: 'dup', title: 'Dup', edition: 1, requires: [{ name: 'basic', edition: 1 }] },
      types: { version: 7, types: [], sectionsFor: {}, fieldsFor: { 'basic:nope': [{ id: 'dup:ghost', key: 'ghost', caption: 'Ghost', type: 'text' }] } },
      things: { version: 7, things: { 'basic:item': [{ id: 'dinosaur-age:water-gun', name: 'Not the water gun', cost: 9, imageURL: '' }] } },
      proposals: { version: 7, totalBudget: 12, groups: [], groupRules: { 'dinosaur-age:row-lairs': { max: 2 } } }
    })
    const dupSet = structuredClone(rebuilt)
    dupSet.content.books = [...PLAN.pins, { name: 'dup', edition: 1 }]
    const dupDir = writeGame(join(WORK, 'dup-game', game), dupSet)
    cpSync(join(workingTreeDir, 'assets'), join(dupDir, 'assets'), { recursive: true })
    const dupResult = hydrate(v5EngineDir, dupDir, dupShelf)
    assert.deepEqual(dupResult.warnings, [
      'Book fault — books["dup"].types.fieldsFor["basic:nope"]: adds fields to a section that does not exist (basic:nope); they are skipped',
      'Book fault — books["dinosaur-age"].things.things["basic:item"][0].id: duplicate id "dinosaur-age:water-gun" — already defined by dup 1; this one is skipped',
      'Book fault — rules.groupRules["dinosaur-age:row-lairs"].max: dup 1 and dinosaur-age 1 propose different values for max of row dinosaur-age:row-lairs — this game must set its own (using 2, the first)',
      'Book fault — rules.totalBudget: dup 1 proposes 12, dinosaur-age 1 proposes 10 — this game must set its own budget (using 12, the first)'
    ], 'the four §5.3 lines, verbatim, in order — and nothing else')
    assert.equal(countGroups(dupResult.groups), 4, 'and the game still plays its four rows')
    assert.equal(dupResult.groups[1].items[0].name, 'Not the water gun', 'with dup\'s water gun, because dup defined it first')
    ok('G2 border loudness for books: the §5.3 shelf gives exactly four `Book fault — <path>: <message>` warnings, verbatim and in order, and the game still hydrates its four rows')

    // ═════════════════ the player's sheet, played: W2–W5 ═════════════════
    // Everything below runs the REAL engine over the AUTHORED dino (games/dino on
    // disk) and the REAL shelf, in a child process, with no DOM anywhere: the
    // sheet is state.js's business, and state.js is the file that must never
    // touch a browser.
    const SCRITCHES = v5Tree.groups[2].items.find(item => item.name === 'The Scritches Dimension').id   // the free joke lair, by name
    const ROWS = REBUILT.rows
    // ONE child plays it, and W3, W4 and W5 all read that one answer: three
    // checks about the same moment must be about the SAME moment.
    const keepRun = playFully(v5EngineDir, workingTreeDir, KEEP_AT_8, REAL_BOOKS)
    const keptAtEight = keepRun.final.kept

    // ── W2 play with values ──
    {
      const played = playFully(v5EngineDir, workingTreeDir, PLAY_STEPS, REAL_BOOKS)
      assert.deepEqual(played.warnings, [], 'no warnings for the whole run')
      const spent = played.steps.map(step => step.spent)
      assert.deepEqual(spent, SPENT_PER_STEP, '§2.6\'s arithmetic, step by step')
      // W2.4 the honest free-item edge: 0 × 3 is still 0
      assert.equal(spent[8], 1, 'three Cute rocks cost what one costs, because a rock costs nothing')
      // W2.9 the refusal: the sentence, verbatim, and NOTHING moved
      assert.ok(played.final.logs.includes('THE BANANA at 3 costs 2 more, but only 1 left'), `the stepper's refusal, verbatim — got ${JSON.stringify(played.final.logs.slice(-3))}`)
      assert.equal(spent[13], spent[12], 'a refused step spends nothing')
      assert.equal(played.final.values[ROWS.gear][PLAYER.banana].quantity, 2, 'and leaves the quantity where it was')
      // W2.10 the refund, said out loud, and the values pruned with the picks
      const [, , , , , , , , , , , pickedLair, pickedLocation, , unpicked] = played.steps
      assert.ok(pickedLair.visible.includes(ROWS.location), 'a Lair opens the Locations row')
      assert.equal(pickedLocation.spent, 9)
      assert.equal(pickedLocation.remaining, 1)
      assert.deepEqual(unpicked.dropped, ['Volcano Rim'], 'unpicking the Lair refunds the Location, by name')
      assert.equal(unpicked.spent, 5)
      assert.ok(!unpicked.visible.includes(ROWS.location), 'and hides its row')
      assert.deepEqual(played.final.values[ROWS.location], {}, 'pruneValues: a value never outlives its pick')
      assert.deepEqual(played.final.values[ROWS.gear], { [PLAYER.rock]: { quantity: 3 }, [PLAYER.banana]: { quantity: 2 } })
      assert.deepEqual(played.final.typed, { name: 'Rexina', concept: 'A dino parent', size: 'big', strength: 12, dexterity: 10, intelligence: 10, health: 10, notes: ['Allergic to ferns'] },
        'the typed half: what the player wrote, through readValue, beside the four defaults nobody touched')
      // W2.5 min and max count PICKS, never quantities
      const counting = playFully(v5EngineDir, workingTreeDir, [
        { row: ROWS.gear, thing: PLAYER.rock },
        { row: ROWS.gear, thing: PLAYER.rock, by: 4 },        // five of one thing: allowed
        { row: ROWS.dino, thing: PLAYER.tali },
        { row: ROWS.dino, thing: PLAYER.miku }                // a second companion: refused
      ], REAL_BOOKS)
      assert.equal(counting.final.values[ROWS.gear][PLAYER.rock].quantity, 5, 'a quantity of five is fine — max counts PICKS')
      assert.deepEqual(counting.final.selections[ROWS.dino], [PLAYER.tali], 'while a second pick in a max-1 row is refused')
      assert.ok(counting.final.logs.some(line => line.includes('is full (max 1)')), 'and says so')
      assert.equal(counting.final.spent, 1, 'five free rocks and one Tali')
      ok('W2 play with values: §2.6\'s fifteen steps give 0,0,0,0,0,1,1,1,1,3,5,8,9,9,5 — three free rocks still cost 0, two bananas cost 4, a Lair opens Locations, the ninth step is refused with "THE BANANA at 3 costs 2 more, but only 1 left" and moves nothing, and unpicking the Lair refunds "Volcano Rim" to 5 and prunes its values; min/max count PICKS (quantity 5 allowed, a second companion refused); zero warnings')
    }

    // ── W3 the sheet's content ──
    {
      const played = keepRun
      const sheet = played.steps[12].sheet
      // §2.4, whole — the real output of the real engine over the real shelf
      assert.deepEqual(sheet, {
        name: 'Rexina', cost: 9, imageURL: '',
        concept: 'A dino parent', size: 'big', strength: 12, dexterity: 10, intelligence: 10, health: 10,
        notes: ['Allergic to ferns'],
        origin: [], advantages: [], disadvantages: [], skills: [],
        gear: [{ thing: PLAYER.rock, quantity: 3 }, { thing: PLAYER.banana, quantity: 2 }],
        companions: [{ thing: PLAYER.tali }],
        places: [{ thing: REBUILT.things.lavaPit }, { thing: 'dinosaur-age:volcano-rim' }],
        ties: []
      }, '§2.4, exactly')
      // THE headline claim: the player's sheet is a THING of its type
      const mergedSet = mergeLayers({ books: shelfLayers, game: authored }).set
      const character = mergedSet.types.types.find(type => type.id === 'basic:character')
      // AMENDED (v7): sheetKeys, not thingKeys. A THING may carry `demands`; a SHEET never
      // does — a sheet is what demands are ABOUT. The claim itself does not move.
      assert.deepEqual(Object.keys(sheet), sheetKeys(character), 'its keys ARE sheetKeys(basic:character) — `notes` before `origin`, measured')
      assert.equal('id' in sheet, false, 'and it mints nothing')
      assert.deepEqual(Object.keys(blankFields(character)), ['name', 'concept', 'size', 'strength', 'dexterity', 'intelligence', 'health', 'notes'])
      // it passes the AUTHOR's own placement audit: put it on the shelf it is a
      // thing of, and nothing dangles
      const before = danglingReferences(mergedSet).length
      mergedSet.things.things['basic:character'] = [...mergedSet.things.things['basic:character'], { id: 'player:sheet', ...sheet }]
      assert.equal(danglingReferences(mergedSet).length, before, 'the player\'s sheet passes the author\'s own placement audit')
      // and the two rows that fill ONE section landed in row order, then pick order
      assert.deepEqual(sheet.places.map(entry => entry.thing), ['dinosaur-age:lava-pit', 'dinosaur-age:volcano-rim'], 'Lairs before Locations — flattened row order')

      // the shell: exactly one new element, still wordless
      const indexPath = join(v5EngineDir, 'index.html')
      const indexText = readFileSync(indexPath, 'utf8')
      const SHEET_ELEMENT = '<section id="sheet" hidden></section>'
      assert.ok(indexText.includes(SHEET_ELEMENT), 'index.html holds the one new element')
      const committedIndex = gitShow(V5_COMMIT, `${DINO_IN_REPO}/engine/index.html`)
      assert.equal(indexText.split('\n').filter(line => !line.includes(SHEET_ELEMENT)).join('\n'), committedIndex, 'and it is the ONLY line that moved')
      // wordless means the BODY is wordless: every word a player reads is drawn
      // from the data. (<title> keeps its "Loading…" placeholder, which renderMeta
      // replaces the moment content.json lands.)
      const body = indexText.slice(indexText.indexOf('<body>'), indexText.indexOf('</body>'))
      const words = body.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, '')
      assert.equal(words, '', 'the shell is still wordless — every word on the page comes from the data')
      // the print block: the shop goes, the sheet stays
      const css = readFileSync(join(v5EngineDir, 'styles.css'), 'utf8')
      const printBlock = css.slice(css.indexOf('@media print'))
      assert.ok(css.includes('@media print'), 'styles.css holds a print block')
      ;['.hero', '#status', '#groups', '.sheet-actions'].forEach(selector => assert.ok(printBlock.includes(selector), `@media print hides ${selector}`))
      // and the engine grew exactly two files
      // engine/stuff.js is the owner's own untracked scratch file. §0.1 says leave
      // it alone, so it is named here rather than silently swept up — the day it
      // goes, this line goes with it and the claim is unchanged.
      const OWNER_JUNK = ['stuff.js']
      const v5Files = listFiles(v5PrevEngineDir).filter(notDot)
      const nowFiles = listFiles(v5EngineDir).filter(notDot).filter(file => !OWNER_JUNK.includes(file))
      // AMENDED (v7): three now — config/demands.js is the demand vocabulary, the fifth
      // sibling of query/visibility/sheet/references. The claim is the same claim: the
      // engine grows by NAMED files and never by accident.
      // CHANGED (stage 4): the names are a TABLE, so a new engine file is a ROW added
      // in the SAME COMMIT that adds the file — and the file is named beside its
      // reason, the way OWNER_JUNK above is. It stays a deepEqual: an engine file
      // nobody declared is exactly what this refuses.
      const NEW_SINCE_V5 = [
        'config/sheet.js',    // the player's sheet — what buildSheet reads and what a pick costs
        'config/kept.js',     // the keepsake: one file a player saves and loads
        'config/demands.js',  // what an entry DEMANDS of that sheet (v7)
        // DECLARED HERE, and the one row in this file whose truth another package owns:
        // the id walk every rewriter, the reference repairs and the audit read (spec §4).
        // The row and the file must land together — an exact set is the whole check, so
        // this row without the file fails just as loudly as the file without the row.
        'config/ids.js'
      ].sort()
      assert.deepEqual(nowFiles.filter(file => !v5Files.includes(file)).sort(), NEW_SINCE_V5, `${NEW_SINCE_V5.length} new files, and no others`)
      assert.deepEqual(v5Files.filter(file => !nowFiles.includes(file)), [], 'and none was lost')
      ok(`W3 the sheet's content: after §2.6's eighth step gameState.sheet deep-equals §2.4 whole (cost 9 included) and its keys ARE sheetKeys(basic:character); placed on the merged shelf it adds nothing to danglingReferences; the two rows that fill one section land in row order; index.html gained exactly ${SHEET_ELEMENT} and is still wordless; @media print hides .hero, #status, #groups and .sheet-actions; engine/ grew exactly ${NEW_SINCE_V5.join(', ')}`)
    }

    // ── W4 keep and load, end to end, no DOM ──
    {
      const kept = keepRun
      const keptText = keptAtEight
      assert.equal(keptText, kept.steps[12].kept, 'the keepsake a snapshot carries is the keepsake the run ends with')
      const file = JSON.parse(keptText)
      assert.deepEqual(Object.keys(file), ['kept', 'game', 'sheet', 'fields', 'picks'])
      assert.deepEqual([file.kept, file.game, file.sheet], [1, 'Adopt a Dino! CYOA', 'basic:character'])
      assert.deepEqual(file.picks.map(pick => [pick.row, pick.thing, pick.name, pick.values]), [
        [ROWS.dino, PLAYER.tali, 'Tali', {}],
        [ROWS.gear, PLAYER.rock, 'Cute rock', { quantity: 3 }],
        [ROWS.gear, PLAYER.banana, 'THE BANANA', { quantity: 2 }],
        [ROWS.lair, 'dinosaur-age:lava-pit', 'Lava Pit', {}],
        [ROWS.location, 'dinosaur-age:volcano-rim', 'Volcano Rim', {}]
      ], '§2.7\'s five picks, in flattened row order')
      assert.equal(keptText, JSON.stringify(file, null, 2) + '\n', 'two-space, trailing newline')
      // a FRESH engine, a fresh process, one door: load
      const loaded = playFully(v5EngineDir, workingTreeDir, [{ load: keptText }], REAL_BOOKS)
      assert.deepEqual(loaded.warnings, [], 'a clean load says nothing to the console')
      assert.deepEqual(loaded.final.notice, { bad: false, text: 'Loaded "Rexina".', notes: [] })
      assert.deepEqual(loaded.final.typed, kept.final.typed, 'the typed half came back')
      assert.deepEqual(loaded.final.selections, kept.final.selections, 'every pick, in every row')
      assert.deepEqual(loaded.final.values, kept.final.values, 'and every placement value')
      assert.equal(loaded.final.spent, 9)
      assert.deepEqual(loaded.final.visible, kept.final.visible, 'the gated row is open again — visibility is settled ONCE, at the end')
      assert.deepEqual(loaded.final.sheet, kept.final.sheet, 'so the document is the same document')
      assert.equal(loaded.final.kept, keptText, 'and re-keeping is BYTE-IDENTICAL')
      ok('W4 keep and load, end to end: one child plays §2.6\'s first eight steps and prints the keepsake (5 picks in flattened row order, canonical bytes); a FRESH child loads that text and its typed half, selections, values, spent, visible set and built sheet all deep-equal the first child\'s; the notice is the clean `Loaded "Rexina".`; re-keeping is byte-identical')
    }

    // ── W5 a kept sheet meets a changed game ──
    // The stage's second spine, measured nine ways: the file's IDENTITY being
    // wrong refuses the WHOLE file, while a REFERENCE inside it being gone drops
    // THAT entry, by name, and loads the rest. A removed rock must not cost a
    // player their character.
    {
      const scratchGame = (label, edit) => {
        const set = readGameSet(workingTreeDir)
        edit(set)
        return writeGame(join(WORK, `w5-${label}`, game), set)
      }
      const scratchShelf = (label, edit) => {
        const dir = copyShelf(join(WORK, `w5-${label}`, 'books'))
        edit((name, edition, file, change) => {
          const path = join(dir, name, String(edition), `${file}.json`)
          const json = JSON.parse(readFileSync(path, 'utf8'))
          change(json)
          writeFileSync(path, serialize(json))
        })
        return dir
      }
      // one fixture, loaded: the game (or the shelf) with ONE thing changed, and
      // W4's file walked in through the one door a click and a restore share
      // `repeats` is how many warnings this fixture says TWICE, and it is 0 for
      // every one of the nine: a note that names a CAUSE rather than a pick is
      // said once, however many picks that cause touched (kept.js's sayOnce).
      const meets = (dir, booksDir, text = keptAtEight, repeats = 0) => {
        const run = playFully(v5EngineDir, dir, [{ load: text }], booksDir)
        assert.equal(run.warnings.length - new Set(run.warnings).size, repeats, 'no warning is printed twice')
        assert.deepEqual(run.warnings.filter(line => line.includes('was refused after it was judged')), [], 'readKept judged it, so `place` has nothing left to object to')
        const notice = run.final.notice
        if (notice.bad === false) assert.deepEqual(run.warnings.filter(line => line.startsWith('Kept sheet — ')), notice.notes.map(note => `Kept sheet — ${note}`), 'the console gets every player sentence, in order')
        return run
      }
      const thingsIn = (run) => Object.values(run.final.selections).flat()
      const ALL_FIVE = [PLAYER.tali, PLAYER.rock, PLAYER.banana, 'dinosaur-age:lava-pit', 'dinosaur-age:volcano-rim']

      // 1. THE BANANA is taken off the shelf
      const noBanana = meets(workingTreeDir, scratchShelf('no-banana', edit => edit('dinosaur-age', 1, 'things', json => {
        json.things['basic:item'] = json.things['basic:item'].filter(thing => thing.id !== PLAYER.banana)
      })))
      assert.deepEqual(noBanana.final.notice.notes, ['"THE BANANA" is no longer offered in Now give your Dino stuffables!; it was dropped.'])
      assert.deepEqual(thingsIn(noBanana), ALL_FIVE.filter(id => id !== PLAYER.banana), 'that pick alone is gone')
      assert.equal(noBanana.final.spent, 5, 'and the four points it cost came back')

      // 2. the whole Gear row is hidden by a house rule
      const noGearRow = meets(scratchGame('no-gear-row', set => { set.content.rowOverrides[ROWS.gear].hidden = true }), REAL_BOOKS)
      assert.deepEqual(noGearRow.final.notice.notes, ['2 picks were dropped — the part of the game they came from is gone.'])
      assert.deepEqual(thingsIn(noGearRow), [PLAYER.tali, 'dinosaur-age:lava-pit', 'dinosaur-age:volcano-rim'])
      assert.equal(noGearRow.final.spent, 5)

      // 3. the Lairs row now allows one pick. The file for this one is W4's play
      // plus one FREE extra lair, because a lowered max only bites a row with a
      // tail to lose — and the tail in FILE ORDER is what goes.
      const twoLairs = playFully(v5EngineDir, workingTreeDir, [...KEEP_AT_8, { row: ROWS.lair, thing: SCRITCHES }], REAL_BOOKS).final.kept
      assert.equal(JSON.parse(twoLairs).picks.filter(pick => pick.row === ROWS.lair).length, 2)
      const oneLair = meets(scratchGame('one-lair', set => { set.rules.groupRules[ROWS.lair] = { ...set.rules.groupRules[ROWS.lair], max: 1 } }), REAL_BOOKS, twoLairs)
      assert.deepEqual(oneLair.final.notice.notes, ['"Now select a Lair! Do you have a Lair? Dino needs a Lair!" now allows 1 pick, not 2 — 1 pick was dropped.'])
      assert.deepEqual(oneLair.final.selections[ROWS.lair], ['dinosaur-age:lava-pit'], 'the FIRST pick in file order survives')

      // 4. `size` is taken off the Identity section
      const noSize = meets(workingTreeDir, scratchShelf('no-size', edit => edit('dinosaur-age', 1, 'types', json => {
        delete json.fieldsFor['basic:character.identity']
      })))
      assert.deepEqual(noSize.final.notice.notes, ['The field "size" is no longer on this sheet; what you typed there was dropped.'])
      assert.equal('size' in noSize.final.typed, false, 'the slot went with the field')
      assert.deepEqual(noSize.final.typed, { name: 'Rexina', concept: 'A dino parent', strength: 12, dexterity: 10, intelligence: 10, health: 10, notes: ['Allergic to ferns'] }, 'and every other typed value is kept')
      assert.deepEqual(thingsIn(noSize), ALL_FIVE)

      // 5. `strength` becomes a text field
      const textStrength = meets(workingTreeDir, scratchShelf('text-strength', edit => edit('stats', 1, 'types', json => {
        const strength = json.fieldsFor['basic:character.attributes'].find(field => field.key === 'strength')
        strength.type = 'text'
        strength.default = ''
      })))
      assert.deepEqual(textStrength.final.notice.notes, ['"Strength" was dropped — it must be a string (found 12).'], 'the VALIDATOR\'s own phrase, verbatim')
      assert.equal(textStrength.final.typed.strength, '', 'the slot holds its new default')
      assert.equal(textStrength.final.typed.dexterity, 10)

      // 6. `quantity` is taken off Gear's placement — nothing multiplies any more
      const noQuantity = meets(workingTreeDir, scratchShelf('no-quantity', edit => edit('basic', 1, 'types', json => {
        json.types.find(type => type.id === 'basic:character').sections.find(section => section.id === 'basic:character.gear').placement = []
      })), keptAtEight)
      // ONE sentence, though both gear picks carried a quantity: the field leaving
      // the game is one cause, and one cause is one sentence
      assert.deepEqual(noQuantity.final.notice.notes, ['"Gear · Quantity" is no longer part of this game; it was dropped.'])
      assert.deepEqual(Object.values(noQuantity.final.values[ROWS.gear]), [{}, {}], 'every gear entry is back to ×1')
      assert.equal(noQuantity.final.spent, 7, '1 + 0 + 2 + 3 + 1 — the two bananas and the three rocks are one each now')

      // 7. the budget is cut to 5. The sheet loads WHOLE: dropping by cost means
      // choosing which entry the player would have sacrificed, and that is a
      // guess about their character. Saying so is the honest answer.
      const poorer = meets(scratchGame('small-budget', set => { set.rules.totalBudget = 5 }), REAL_BOOKS)
      assert.deepEqual(poorer.final.notice.notes, [], 'nothing is dropped')
      assert.deepEqual(thingsIn(poorer), ALL_FIVE)
      assert.equal(poorer.final.spent, 9)
      assert.equal(poorer.final.remaining, -4)
      assert.ok(poorer.final.status.startsWith('Over budget by 4 — remove something'), `the status line says it in words: ${JSON.stringify(poorer.final.status)}`)

      // 8. the game builds a different KIND of sheet: refused whole, nothing loaded
      const otherSheet = meets(scratchGame('other-sheet', set => { set.content.sheet = 'basic:place' }), REAL_BOOKS)
      assert.deepEqual(otherSheet.final.notice, { bad: true, text: 'That sheet was kept for "Adopt a Dino! CYOA", which builds a different kind of sheet. Nothing was loaded.', notes: [], draft: false })
      assert.equal(otherSheet.final.spent, 0, 'nothing was loaded')
      assert.deepEqual(thingsIn(otherSheet), [])
      const placeSheet = mergeLayers({ books: shelfLayers, game: readGameSet(workingTreeDir) }).set.types.types.find(type => type.id === 'basic:place')
      assert.deepEqual(otherSheet.final.typed, blankFields(placeSheet), 'the player\'s own sheet is untouched — still blank')
      assert.ok(otherSheet.final.visible.length > 0, 'and the page still plays')

      // 9. a pinned book is UPGRADED — dinosaur-age 1 → 2, which only ADDS a lair.
      // Nothing the sheet points at moved, so NOTHING IS SAID. This is the case a
      // pin list in the file would have cried wolf on (§2.7).
      const upgraded = meets(scratchGame('edition-2', set => {
        set.content.books = set.content.books.map(pin => pin.name === 'dinosaur-age' ? { name: pin.name, edition: 2 } : pin)
      }), REAL_BOOKS)
      assert.deepEqual(upgraded.final.notice, { bad: false, text: 'Loaded "Rexina".', notes: [] }, 'loads clean')
      assert.deepEqual(thingsIn(upgraded), ALL_FIVE)
      assert.equal(upgraded.final.spent, 9, 'and the sheet costs exactly what it cost')
      assert.equal(upgraded.final.sheet.places.length, 2)
      ok('W5 a kept sheet meets a changed game: nine fixtures — a thing off the shelf (F6, refunded), a hidden row (F7, grouped), a lowered max (F9, the tail in file order), a removed field (F10), a field whose KIND changed (F11, ending with the validator\'s own phrase), a removed placement field (F12, every entry back to ×1), a cut budget (loads whole, remaining −4, "Over budget by 4 — remove something"), a game that builds another KIND of sheet (refused whole, nothing loaded, the page still plays) and an UPGRADED book (loads clean, nothing said); in every one: no warning twice, no guess, and `place` never refuses what readKept has judged')

      // ── W8 a kept sheet meets a game whose DEMANDS changed (NEW) ──
      // The two-severity discipline of W5, met by COMPOSITION rather than by a new
      // judge: kept.js does not change and KEPT_VERSION stays 1, because a demand
      // belongs to the THING and not to the pick. So the pick is placed with the
      // guard OFF, the ONE settle() at the end removes it, and loadKept turns the
      // loop's own answer into a note — that entry by name, with its rule, and the
      // rest loads. readKept must NOT re-implement the loop and cannot: whether a
      // pick survives depends on the whole surviving set and on the order the loop
      // removes things in.
      const withDemand = (label, edits) => scratchShelf(`w8-${label}`, edit => edit('dinosaur-age', 1, 'things', json => {
        Object.entries(edits).forEach(([id, demands]) => { json.things['basic:item'].find(thing => thing.id === id).demands = demands })
      }))
      const ORIGIN_ANY = [{ field: 'basic:character.origin', op: 'any', value: '' }]
      // 1. a demand was ADDED to a thing the file holds. It loads, the settle removes
      //    it, the note names it AND its rule, and the points come back.
      const added = meets(workingTreeDir, withDemand('added', { [PLAYER.banana]: ORIGIN_ANY }))
      assert.deepEqual(added.final.notice.notes, ['"THE BANANA" was dropped — it needs: Origin holds anything.'],
        'the house voice verbatim — kept.js already says `"X" was dropped — it …`')
      assert.equal(added.final.notice.bad, false, 'a demand can never refuse a FILE: it is no part of a file\'s identity')
      assert.equal(added.final.notice.text, 'Loaded your sheet, with 1 change:')
      assert.deepEqual(thingsIn(added), ALL_FIVE.filter(id => id !== PLAYER.banana), 'that pick alone is gone')
      assert.equal(added.final.spent, 5, 'and the four points it cost came back')
      // Download after the load writes the sheet that is ON SCREEN, not the file that
      // walked in — keptFrom reads the two stores as they stand after the settle
      assert.deepEqual(JSON.parse(added.final.kept).picks.map(pick => pick.thing), thingsIn(added), 'the keepsake is the sheet on screen')
      // 2. two entries that now EXCLUDE each other: both load, the settle removes the
      //    LAST in file order, ONE note names it. Never both, never neither.
      const excluding = meets(workingTreeDir, withDemand('excluding', {
        [PLAYER.rock]:   [{ field: 'basic:character.gear', op: 'lacks', value: PLAYER.banana }],
        [PLAYER.banana]: [{ field: 'basic:character.gear', op: 'lacks', value: PLAYER.rock }]
      }))
      assert.deepEqual(excluding.final.notice.notes, ['"THE BANANA" was dropped — it needs: Gear does not hold Cute rock.'],
        'ONE note, not two — the tail in file order goes and the picks the player made first are kept')
      assert.deepEqual(thingsIn(excluding), ALL_FIVE.filter(id => id !== PLAYER.banana))
      // 3. the THING a demand names is not on the shelf. The BORDER refuses to offer
      //    the entry, so readKept's EXISTING check 9 covers it and no new sentence
      //    was written for this stage.
      const offShelf = meets(workingTreeDir, withDemand('off-shelf', {
        [PLAYER.rock]: [{ field: 'basic:character.gear', op: 'holds', value: 'dinosaur-age:atlantis' }]
      }))
      assert.deepEqual(offShelf.final.notice.notes, ['"Cute rock" is no longer offered in Now give your Dino stuffables!; it was dropped.'])
      assert.deepEqual(thingsIn(offShelf), ALL_FIVE.filter(id => id !== PLAYER.rock))
      // 4. the game stopped declaring a sheet: check 4 refuses the WHOLE file. The
      //    identity severity is untouched by anything this stage did.
      const w8NoSheet = playFully(v5EngineDir, scratchGame('w8-no-sheet', set => {
        set.content.sheet = ''
        Object.values(set.content.rowOverrides).forEach(slot => { slot.fills = '' })
      }), [{ load: keptAtEight }], REAL_BOOKS)
      assert.equal(w8NoSheet.final.notice.bad, true)
      assert.equal(w8NoSheet.final.notice.text, 'This game does not build a sheet, so there is nothing to load into.')
      assert.deepEqual(Object.values(w8NoSheet.final.selections).flat(), [], 'nothing loaded at all')
      // 5. the FORMAT did not change, so a sheet kept by the V6 ENGINE loads into the
      //    v7 game unchanged — which is what KEPT_VERSION staying 1 means.
      assert.equal(JSON.parse(keptAtEight).kept, 1, 'KEPT_VERSION is still 1')
      const v6DinoDir = writeGame(join(WORK, 'w8-v6-dino'), Object.fromEntries(FILES.map(file =>
        [file, JSON.parse(gitShow(V6_COMMIT, `${DINO_IN_REPO}/games/dino/data/${file}.json`))])))
      const v6Kept = playFully(v6PrevEngineDir, v6DinoDir, KEEP_AT_8, v6PrevBooksDir).final.kept
      const v6Loaded = meets(workingTreeDir, REAL_BOOKS, v6Kept)
      assert.deepEqual(v6Loaded.final.notice, { bad: false, text: 'Loaded "Rexina".', notes: [] }, 'a v6-kept file loads into the v7 game with nothing to say')
      assert.equal(v6Loaded.final.kept, v6Kept, 'and re-keeping it is byte-identical')
      ok('W8 a kept sheet meets changed demands: a demand added to a held thing loads, is removed by the ONE settle and named with its rule while everything else loads and the four points come back; two entries that now exclude each other give ONE note and keep the earlier pick; a demand naming a thing off the shelf falls to readKept\'s EXISTING check 9, so no new sentence was written; a game that stopped building a sheet still refuses the whole file — a demand never does; KEPT_VERSION is still 1, a v6-ENGINE-kept file loads unchanged and re-keeps byte-identically, and Download after a marked load writes the sheet on screen')
    }
  }

  // ═══════ what the PLAYER SEES: W7, W9, E14 (NEW, v7) ═══════
  // Three checks about the PAINTED page, and they are dino-only for the same reason
  // W2–W5 are: the demand fixture is written into a scratch copy of the SHELF, and
  // vampire pins no book at all (§12.2 — it is the proof a v4 bookless game plays).
  if (rebuilt) {
    // The demand world all three paint. Dino ships NO demand (§12.1), so the fixture
    // is a scratch copy of the shelf with four written into Dinosaur Age's things —
    // three of them a chain, one the ONE-SIDED authored shape (the rule on the victim
    // and nothing on the thing that would break it), and one on a TYPED slot so the
    // caret rule has something to be about.
    const DEMO = {
      rock: 'dinosaur-age:cute-rock', skates: 'dinosaur-age:dino-skates',
      gun: 'dinosaur-age:water-gun', banana: 'dinosaur-age:the-banana',
      rim: 'dinosaur-age:volcano-rim'
    }
    const demoShelf = copyShelf(join(WORK, 'w7-demo', 'books'))
    {
      const path = join(demoShelf, 'dinosaur-age', '1', 'things.json')
      const json = JSON.parse(readFileSync(path, 'utf8'))
      const put = (id, demands) => {
        const thing = Object.values(json.things).flat().find(each => each.id === id)
        // written in the CANONICAL slot — fifth, straight after imageURL — because
        // the fixture must be a file an author could really have saved (B7)
        const rebuilt = {}
        Object.entries(thing).forEach(([key, value]) => {
          rebuilt[key] = value
          if (key === 'imageURL') rebuilt.demands = demands
        })
        Object.keys(thing).forEach(key => delete thing[key])
        Object.assign(thing, rebuilt)
      }
      const GEAR = 'basic:character.gear'
      put(DEMO.skates, [{ field: GEAR, op: 'holds', value: DEMO.rock }])                 // the chain's second link
      put(DEMO.gun,    [{ field: GEAR, op: 'holds', value: DEMO.skates }])               // and its third
      put(DEMO.banana, [{ field: GEAR, op: 'lacks', value: DEMO.rock }])                 // the ONE-SIDED shape
      put(DEMO.rim,    [{ field: 'stats:strength', op: 'gte', value: 12 }])              // the one TYPED demand
      writeFileSync(path, serialize(json))
      assert.deepEqual(validateBook(readBookSync(demoShelf, { name: 'dinosaur-age', edition: 1 }),
        { basic: { 1: readBookSync(demoShelf, { name: 'basic', edition: 1 }) }, stats: { 1: readBookSync(demoShelf, { name: 'stats', edition: 1 }) } }), [],
        'the fixture is a book an author could really have saved — it validates')
    }

    // ── W7 play with demands ──
    // Twelve scripted steps in a PAINTED child: real cards, real buttons, and a
    // click that runs the very handler a browser would run.
    {
      const script = [
        { click: 'THE BANANA' },        // 1  the one-sided shape, taken first
        { click: 'Cute rock' },         // 2  …refused at the door: it would BREAK it
        { click: 'THE BANANA' },        // 3  put the banana down
        { click: 'Cute rock' },         // 4  now the chain's head goes on
        { click: 'Dino Skates' },       // 5  which unlocked its second link
        { click: 'Water Gun' },         // 6  and that unlocked the third
        { click: 'Cute rock' }          // 7  pull the head out: both fall, and are named
      ]
      const run = paint(v5EngineDir, workingTreeDir, script, demoShelf)
      assert.deepEqual(run.warnings, [], 'the demo hydrates with no warning: every demand is one this game can run')
      const card = (shot, name) => shot.cards.find(each => each.name.startsWith(`${name} - `))
      // (a) A LOCKED CARD IS STILL SHOWN, and it says why. A shop whose rules only
      //     appear when you break them is a shop that punishes looking.
      const skates = card(run.start, 'Dino Skates')
      assert.deepEqual(skates.button, { text: 'Locked', disabled: true, title: 'Dino Skates needs: Gear holds Cute rock' })
      assert.deepEqual(skates.classes, ['card', 'card--locked', 'card--unmet'])
      assert.equal(skates.needs, 'Needs: Gear holds Cute rock', 'the GURPS prerequisite line, under the name')
      assert.deepEqual(skates.clauses, [{ text: 'Gear holds Cute rock', unmet: true }], 'and the failing clause is the one marked')
      assert.equal(card(run.start, 'Water Gun').needs, 'Needs: Gear holds Dino Skates')
      // …while a MET demand is printed too, and is NOT marked
      assert.deepEqual(card(run.start, 'THE BANANA').clauses, [{ text: 'Gear does not hold Cute rock', unmet: false }])
      assert.equal(card(run.start, 'THE BANANA').button.text, 'Select', 'a met demand locks nothing')
      // an entry that demands nothing draws not one new pixel
      assert.equal(card(run.start, 'Cute rock').needs, null, 'no demands, no line — today\'s cards are byte-for-byte what they were')
      // (b) THE ONE-SIDED SHAPE, refused at the door and PRINTED on the card. The
      //     rule is written on THE BANANA and nothing is written on Cute rock, so a
      //     guard that asked only "do this entry's own demands hold?" would admit
      //     the click and the settle would then evict a purchase already made.
      const afterBanana = run.steps[0]
      const rock = card(afterBanana, 'Cute rock')
      assert.deepEqual(rock.button, { text: 'Locked', disabled: true, title: 'Cute rock would break THE BANANA, which needs: Gear does not hold Cute rock' })
      assert.deepEqual(rock.breaks, ['Would break THE BANANA, which needs: Gear does not hold Cute rock'],
        'PRINTED, not merely hovered: on a touch screen a title is invisible, and the rule is written on the VICTIM')
      assert.equal(afterBanana.spent, 2)
      // the click that follows is refused and costs NOTHING
      assert.deepEqual(run.steps[1].cards, afterBanana.cards, 'the refused click changed not one pixel')
      assert.equal(run.steps[1].spent, 2, 'and not one point')
      // (c) TAKING THE PREREQUISITE UNLOCKS THE DEPENDANT
      const afterRock = run.steps[3]
      assert.equal(card(afterRock, 'Dino Skates').button.text, 'Select', 'the chain\'s second link is takeable now')
      assert.deepEqual(card(afterRock, 'Dino Skates').clauses, [{ text: 'Gear holds Cute rock', unmet: false }], 'and its clause is no longer marked')
      assert.equal(card(afterRock, 'Water Gun').button.text, 'Locked', 'the third is still locked — one link at a time')
      assert.equal(card(afterRock, 'THE BANANA').button.text, 'Locked', 'and the banana is now the one that cannot be had')
      // a card ALREADY PICKED is judged MINUS ITSELF — its own clause reads met
      const afterSkates = run.steps[4]
      assert.equal(card(afterSkates, 'Dino Skates').button.text, 'Selected')
      assert.deepEqual(card(afterSkates, 'Dino Skates').clauses, [{ text: 'Gear holds Cute rock', unmet: false }])
      assert.equal(card(run.steps[5], 'Water Gun').button.text, 'Selected', 'three links held, and the guarded build removed nothing')
      assert.match(run.steps[5].status, /^Remaining: 8 —/, 'and the three links cost exactly what they cost')
      // (d) UNPICK THE HEAD: the cascade, named on ONE status line, and the points back
      const cascade = run.steps[6]
      assert.ok(cascade.status.startsWith('Remaining: 10 — removed: Dino Skates, Water Gun (your sheet no longer meets what they ask)'),
        `both losses on one line, with the rule that took them, and the budget back to the number — got: ${cascade.status}`)
      assert.equal(cascade.spent, 0)
      assert.equal(card(cascade, 'Dino Skates').button.text, 'Locked')
      assert.equal(card(cascade, 'Water Gun').button.text, 'Locked')
      assert.equal(card(cascade, 'THE BANANA').button.text, 'Select', 'and what the rock forbade is offered again')
      ok('W7 play with demands: a locked card is still SHOWN and says why — `Locked`, the exact `Needs: …` line, the failing clause carrying .card-demand--unmet and the button\'s title the very sentence place() refuses with; a met demand is printed and unmarked; an entry that demands nothing draws no line at all; the one-sided authored shape is refused at the door with `Would break …` PRINTED on the card, changing not one pixel and not one point; taking the prerequisite unlocks the dependant one link at a time; a picked card is judged minus itself; and unpicking the head of a chain of three names BOTH losses on one status line and hands the whole budget back')
    }

    // ── W9 the caret rule survives (NEW) ──
    // A typed value is LOAD-BEARING now — a demand may read Strength — so leaving a
    // box has to settle the sheet. The caret rule is kept by moving the EVENT, not by
    // bending the rule: `input` still only saves and re-writes the status line, and
    // `change` (which fires when the player LEAVES the box) settles and repaints.
    // WHY IT MATTERS, measured in a real browser: editing a Strength of 15 down to 13
    // goes 15 → 1 → 13, because a backspace leaves a "1" behind. On `input` the "1"
    // fails `Strength ≥ 12`, the purchase is deleted mid-word, and finishing the word
    // does not bring it back. On `change` the "1" is never judged.
    {
      // the marker is a node planted in #groups: a repaint wipes that wall, so its
      // survival IS the question "did the page repaint?", asked of the real DOM
      const script = [
        { type: { field: 'Strength', value: 15, event: 'change' } },   // 1 a Strength the demand accepts
        { click: 'Lava Pit' },                                         // 2 open the Locations row
        { click: 'Volcano Rim' },                                      // 3 the pick a typed value governs
        { mark: true },                                                // 4 plant the marker on the wall
        { type: { field: 'Strength', value: 1, event: 'input' } },      // 5 a keystroke mid-word
        { type: { field: 'Strength', value: 9, event: 'change' } }      // 6 the value the player LEFT
      ]
      const run = paint(v5EngineDir, workingTreeDir, script, demoShelf)
      assert.deepEqual(run.warnings, [])
      const card = (shot, name) => shot.cards.find(each => each.name.startsWith(`${name} - `))
      // the box a demand READS is the only one wired to `change`
      assert.deepEqual(Object.entries(run.start.boxes).filter(([, box]) => box.settles).map(([caption]) => caption), ['Strength'],
        'only the slot an offered demand actually names gets a `change` listener')
      assert.equal(card(run.start, 'Volcano Rim'), undefined, 'the Locations row starts hidden — its gate is a Lair')
      assert.equal(card(run.steps[2], 'Volcano Rim').button.text, 'Selected', 'with Strength 15 it is takeable, and taken')
      assert.equal(run.steps[2].spent, 4)
      assert.equal(run.steps[3].marker, 1, 'the marker is on the wall')
      // 5 — `input`: SAVED and the status line re-written, but NOT repainted and NOT settled
      assert.equal(run.steps[4].marker, 1, 'a keystroke does not repaint — the caret survives, and so does the marker')
      assert.equal(run.steps[4].spent, 4, 'and it does not settle: the mid-word 1 costs the player nothing')
      assert.equal(card(run.steps[4], 'Volcano Rim').button.text, 'Selected', 'the card list is the one painted BEFORE the keystroke — proof no repaint happened')
      // 6 — `change`: settles AND repaints, so the value the player LEFT is judged
      assert.equal(run.steps[5].marker, 0, 'leaving the box repaints — the marker is gone')
      assert.equal(run.steps[5].spent, 3, 'and the 9 really does break `Strength ≥ 12`: the pick is removed and its point comes back')
      assert.equal(card(run.steps[5], 'Volcano Rim').button.text, 'Locked')
      assert.ok(run.steps[5].status.includes('removed: Volcano Rim (your sheet no longer meets what they ask)'), 'named, with its cause')
      // and typing 15 → 13 keeps the purchase: only the value LEFT in the box is judged
      const kept = paint(v5EngineDir, workingTreeDir, [
        { type: { field: 'Strength', value: 15, event: 'change' } },
        { click: 'Lava Pit' }, { click: 'Volcano Rim' },
        { type: { field: 'Strength', value: 1, event: 'input' } },
        { type: { field: 'Strength', value: 13, event: 'change' } }
      ], demoShelf)
      assert.equal(kept.steps[4].spent, 4, 'the purchase survives the backspace that passed through 1')
      assert.equal(card(kept.steps[4], 'Volcano Rim').button.text, 'Selected')
      // THE GAME WITH NO DEMANDS PAYS NOTHING. Over the REAL dino, `watchedFields` is
      // empty, so not one box on the page carries a `change` listener at all — asserted
      // directly, so nobody quietly moves the event back to `input`.
      const plain = paint(v5EngineDir, workingTreeDir, [{ type: { field: 'Strength', value: 9, event: 'input' } }], REAL_BOOKS)
      assert.deepEqual(plain.warnings, [])
      assert.deepEqual(Object.entries(plain.start.boxes).filter(([, box]) => box.settles), [],
        'the real dino has no demand, so watchedFields is empty and NOT ONE box gets the settle listener')
      // said the harder way too: every non-select box carries ZERO change listeners
      Object.entries(plain.start.boxes).filter(([, box]) => box.tag !== 'select')
        .forEach(([caption, box]) => assert.equal(box.changes, 0, `${caption}: no change listener at all`))
      assert.equal(Object.keys(plain.start.boxes).length, 8, 'over Name and the seven typed slots three books between them decided')
      ok(`W9 the caret rule survives, by moving the EVENT and not the rule: only the slot an offered demand names carries a \`change\` listener; \`input\` saves and re-writes the status line but does NOT repaint (a marker planted in the DOM survives) and does NOT settle, so a mid-word 1 costs nothing and a 15 → 13 edit keeps the purchase; \`change\` does both, and a 9 really does break \`Strength ≥ 12\` and says so by name; and over the REAL dino watchedFields is empty, so not one of its 8 boxes gets the listener at all — a game with no demand types exactly as it always has`)
    }

    // ── E14 the published folder plays them (NEW) ──
    // The engine is the PUBLISHED ARTEFACT: page-relative, no server call, no shelf.
    // A demand must therefore survive the flatten — it rides on the thing, and the
    // export writes the merged things.json verbatim — and the folder must say the
    // same words the dev-served game says. Not "equivalent": the same bytes.
    {
      const publishedDir = join(WORK, 'e14', 'dist', 'demo')
      const { manifest } = exportGame({ game: 'demo', sourceDir: workingTreeDir, booksDir: demoShelf, outDir: publishedDir })
      assert.equal(manifest.schemaVersion, SCHEMA_VERSION)
      // the demand travelled, in its canonical slot, into the flattened bytes
      const publishedThings = JSON.parse(readFileSync(join(publishedDir, 'data', 'things.json'), 'utf8'))
      const skates = Object.values(publishedThings.things).flat().find(thing => thing.id === DEMO.skates)
      assert.deepEqual(skates.demands, [{ field: 'basic:character.gear', op: 'holds', value: DEMO.rock }])
      assert.deepEqual(Object.keys(skates).slice(0, 5), ['id', 'name', 'cost', 'imageURL', 'demands'], 'fifth, as B7 says')
      assert.equal(publishedThings.things === undefined, false)
      assert.deepEqual(JSON.parse(readFileSync(join(publishedDir, 'data', 'content.json'), 'utf8')).books, [], 'a published folder pins nothing: the books are baked in')
      // the same script, twice: the dev-served game over the shelf, and the folder
      // ALONE — no booksDir at all, so every books/… url is a 404 the folder never asks for
      const script = [{ click: 'THE BANANA' }, { click: 'Cute rock' }, { click: 'THE BANANA' }, { click: 'Cute rock' }, { click: 'Dino Skates' }]
      const served = paint(v5EngineDir, workingTreeDir, script, demoShelf)
      const published = paint(publishedDir, publishedDir, script)   // the folder IS the engine: index.html sits beside data/
      assert.deepEqual(published.warnings, [], 'no shelf, no server, no warning')
      assert.deepEqual(published.fetched, FILES.map(name => `data/${name}.json`), 'five data urls and NOTHING else — it never asks for a shelf')
      assert.deepEqual(published.start, served.start, 'the published folder paints the same page: the Needs: lines, the Locked buttons, every class')
      assert.deepEqual(published.steps, served.steps, 'and the same page after every click — the refusal, the Would break … line and the unlock, byte for byte')
      // spelled out, so a failure names the thing rather than a diff of the whole page
      const card = (shot, name) => shot.cards.find(each => each.name.startsWith(`${name} - `))
      assert.equal(card(published.start, 'Dino Skates').needs, 'Needs: Gear holds Cute rock')
      assert.deepEqual(card(published.start, 'Dino Skates').clauses, [{ text: 'Gear holds Cute rock', unmet: true }])
      assert.equal(card(published.start, 'Dino Skates').button.text, 'Locked')
      assert.deepEqual(card(published.steps[0], 'Cute rock').breaks, ['Would break THE BANANA, which needs: Gear does not hold Cute rock'])
      assert.equal(card(published.steps[3], 'Dino Skates').button.text, 'Select', 'and the unlock')
      assert.equal(card(published.steps[4], 'Dino Skates').button.text, 'Selected')
      // the engine bytes really are the engine's
      assert.equal(readFileSync(join(publishedDir, 'config', 'demands.js'), 'utf8'), readFileSync(join(v5EngineDir, 'config', 'demands.js'), 'utf8'),
        'config/demands.js in the folder is the engine\'s own bytes')
      ok('E14 the published folder plays them: a demand survives the flatten into the published things.json in its canonical fifth slot; the folder asks for five data urls and NOTHING else — no shelf, no server, no warning — and the whole painted page, before and after every click, is deep-equal to the dev-served game\'s: the same `Needs:` lines, the same `Locked` buttons, the same printed `Would break …` and the same unlock')
    }
  }

  // ═════════════════════ the border: S1–S4 ═════════════════════
  // The validator is the contract the server enforces. S1 proves the committed
  // data fits it (and that its cross half IS G1's audit, by path); S2–S4 run the
  // REAL server over a scratch copy, a scratch dist root and a scratch SHELF.

  // The v5 source this game is served from. games/** is still at v4 on disk (the
  // owner migrates by opening each game in the editor, and rebuilds dino once),
  // so the scratch copy carries the v5 set: the REBUILT files for dino, the
  // migration for a book-less game.
  const v5Source = rebuiltDir ?? (() => {
    const dir = writeGame(join(WORK, 'v5source', game), migrateSet(structuredClone(rawV4)))
    cpSync(join(workingTreeDir, 'assets'), join(dir, 'assets'), { recursive: true })
    return dir
  })()
  v5Sources[game] = v5Source

  // ── S1 the committed files fit the contract, at every stage of their history ──
  const treeSet = migrateSet(readGameSet(workingTreeDir))
  // CHANGED: judged WITH the books it pins. A pinned game's rows show the books' sheets
  // and its arrangement names the books' things, so validateSet (which is "no books")
  // would call every one of those a dangling reference. A book-less game is unaffected:
  // there validateGame with an empty shelf IS validateSet (K9).
  assert.deepEqual(validateGame({ own: treeSet, books: treeSet.content.books.length > 0 ? shelfLayers : [] }), [], `games/${game}, migrated, fits — judged with its books`)
  FILES.forEach(name => assert.deepEqual(validateFile(name, treeSet[name]), [], `${name}.json alone fits`))
  assert.deepEqual(validateSet(first), [], 'the v3 → v5 migration fits')
  assert.deepEqual(validateSet(migrateSet(rawV2)), [], 'the v2 → v5 climb fits')
  assert.deepEqual(validateGame({ own: readGameSet(v5Source), books: rebuilt ? shelfLayers : [] }), [], 'and the v5 source this run serves fits, judged with its books')
  // G1's eight faults, seen by the validator: the same eight sentences, each now
  // attached to the pointer that dangles — and every path leads to its row
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
  ok(`S1 games/${game} (migrated), the v3 migration, the v2 climb and the v5 source all fit; crossChecks = G1's 8 faults by path; two bad kinds postpone the cross pass (D6)`)

  // ── S2 the route refuses and writes nothing ──
  const srvRoot = join(WORK, 'srv')
  const srvShelf = copyShelf(join(WORK, 'srv-shelf', 'books'))
  const srvDir = copyGame(v5Source, join(srvRoot, game))
  const booksOf = (set) => (set.content.books ?? []).map(pin => readBookSync(srvShelf, pin))
  const { origin, stop } = await startServer(srvRoot, join(WORK, 'srv-dist'), srvShelf)
  try {
    const before = readGameText(srvDir)
    const E = readGameSet(srvDir)
    const dataFile = (name) => join(srvDir, 'data', `${name}.json`)
    const unchanged = (label) => assert.deepEqual(readGameText(srvDir), before, `${label}: the disk is unchanged`)
    const old = await post(origin, game, 'content', { ...E.content, version: 4 })
    assert.equal(old.status, 400)
    assert.equal(old.body.ok, false)
    assert.equal(old.body.error, 'content.json does not fit the schema')
    assert.equal(old.body.problems.length, 1, 'an old version is ONE problem')
    assert.equal(old.body.problems[0].path, 'content.version')
    assert.match(old.body.problems[0].message, /must be 7 \(found 4\) — open the game in the editor and Save/)
    unchanged('an old version')
    assert.deepEqual(await post(origin, game, 'content', '{'), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    unchanged('a body that is not JSON')
    const brokenTypes = structuredClone(E.types)
    brokenTypes.types.push({ id: 'srv-dup', label: 'Dup', sections: [{ id: 'srv-dup.identity', key: 'identity', caption: 'Identity', kind: 'fields', fields: [
      { id: 'srv-dup.a', key: 'colour', caption: 'Colour', type: 'text' }, { id: 'srv-dup.b', key: 'colour', caption: 'Colour again', type: 'text' }] }] })
    const dup = await post(origin, game, 'types', brokenTypes)
    assert.equal(dup.status, 400)
    assert.deepEqual(dup.body.problems, validateFile('types', brokenTypes), 'the wire carries the module\'s own list')
    assert.match(dup.body.problems[0].path, /^types\.types\[\d+\]\.sections\[0\]\.fields\[1\]\.key$/)
    assert.match(dup.body.problems[0].message, /duplicate key "colour"/)
    unchanged('a duplicate field key')
    assert.deepEqual(await post(origin, game, 'nope', {}), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    // a target named like an inherited property is unknown too — the whitelist reads own keys only
    assert.deepEqual(await post(origin, game, 'constructor', { version: 7 }), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    // a save that fails ON DISK is a 500 receipt, never the end of the process
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
    assert.deepEqual(await post(origin, 'nope', 'rules', E.rules), { status: 404, body: { ok: false, error: 'Unknown CYOA "nope"' } })
    assert.equal((await api(origin, '/api/save/rules', { method: 'POST', body: E.rules })).status, 404, 'the old route is dead')
    ok('S2 route: version 4 → 400 at content.version; not-JSON → 400; a duplicate field key → 400 at its path; nothing written; unknown and prototype-named targets → 404; a disk refusal → 500 and the server lives; the v5 rules → 200; unknown game → 404; /api/save/ dead')

    // ── S3 the editor's order end-to-end: add-type-first-save, removal, and the negative ──
    assert.deepEqual(await editorSave(origin, game, E), Array(5).fill(SAVED), 'the v5 set lands: five 200s')
    assert.deepEqual(readGameText(srvDir), readGameText(v5Source), 'byte-identical to the source')
    // the editor's way to add a type: the type, its bucket with a thing, a row
    // asking for the type with a condition on its field, and a rules slot
    const E2 = structuredClone(E)
    const typeId = randomUUID(), sectionId = randomUUID(), fieldId = randomUUID(), thingId = randomUUID(), rowId = randomUUID()
    const firstThing = Object.values(E2.things.things)[0][0]
    E2.types.types.push({ id: typeId, label: 'Pet', sections: [{ id: sectionId, key: 'identity', caption: 'Identity', kind: 'fields', fields: [{ id: fieldId, key: 'colour', caption: 'Colour', type: 'text' }] }] })
    E2.things.things[typeId] = [{ id: thingId, name: 'Rex', cost: 1, imageURL: '', colour: 'green' }]
    E2.content.groups.push({ id: rowId, label: 'Pets', query: { type: typeId, where: { field: fieldId, op: 'is', value: 'green' } }, showWhen: { kind: 'thingPicked', thing: firstThing.id }, children: [] })
    E2.rules.groupRules[rowId] = { min: 1 }
    assert.deepEqual(validateGame({ own: E2, books: booksOf(E2) }), [], 'the pre-flight passes the new set')
    // negative first: content alone, before its type has landed, is refused against the disk
    const early = await post(origin, game, 'content', E2.content)
    assert.equal(early.status, 400)
    // the path locates the row at its MERGED index (§5.5, R5): a game whose rows
    // are PROPOSED by a book has the book's rows before its own
    const mergedRows = mergeLayers({ books: booksOf(E2), game: E2 }).set.content.groups
    assert.equal(early.body.problems[0].path, `content.groups[${mergedRows.findIndex(row => row.id === rowId)}].query.type`)
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
    assert.deepEqual(danglingReferences(mergeLayers({ books: booksOf(afterRemoval), game: afterRemoval }).set), [], 'nothing dangles on disk')
    assert.deepEqual(afterRemoval.content.groups.at(-1).query, { type: '', where: null }, 'the Pets row shows nothing now')
    ok('S3 editor order: the v5 set → five 200s, byte-identical; content posted early → 400 (type not on disk); add type+thing+row+slot → lands; remove the type → lands, closed')

    // ── S4 content is checked against the siblings AS THEY SIT ON DISK ──
    const atS4 = readGameText(srvDir)
    const content = readGameSet(srvDir).content
    const handBroken = readGameSet(srvDir).types
    handBroken.types.push({ id: 'hand-broken', label: 'Oops', sections: [{ id: 'hand-broken.identity', key: 'identity', caption: 'Identity', kind: 'fields', fields: [{ id: 'hand-broken.name', key: 'name', caption: 'N', type: 'text' }] }] })
    writeFileSync(dataFile('types'), serialize(handBroken))
    const reserved = await post(origin, game, 'content', content)
    assert.equal(reserved.status, 400)
    assert.match(reserved.body.problems[0].path, /^types\.types\[\d+\]\.sections\[0\]\.fields\[0\]\.key$/)
    assert.match(reserved.body.problems[0].message, /is a key every thing already has/)
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

  // ═════════════════════ the shelf over HTTP: S5–S7, I2 (dino) ═════════════════════
  // Its own scratch root, holding the REBUILT dino and a BOOK-LESS game beside
  // it (the migrated vampire, read from git so this block runs even for
  // `oracles.mjs dino`) — the asset search path needs both to be interesting.
  if (game === 'dino') {
    const shelfRoot = join(WORK, 'shelf-srv')
    const shelfGames = join(shelfRoot, 'games')
    const shelfBooks = copyShelf(join(shelfRoot, 'books'))
    const dinoDir = copyGame(rebuiltDir, join(shelfGames, 'dino'))
    const vampireV4 = Object.fromEntries(FILES.map(name => [name, JSON.parse(gitShow(V4_COMMIT, `${DINO_IN_REPO}/games/vampire/data/${name}.json`))]))
    const vampDir = writeGame(join(shelfGames, 'vampire'), migrateSet(vampireV4))
    cpSync(join(DINO_DIR, 'games', 'vampire', 'assets'), join(vampDir, 'assets'), { recursive: true })
    const rebuiltText = Object.fromEntries(FILES.map(name => [name, serialize(rebuilt[name])]))
    const { origin, stop } = await startServer(shelfGames, join(shelfRoot, 'dist'), shelfBooks)
    try {
      const at = (path) => get(`${origin}${path}`)
      const bookBytes = (...parts) => readFileSync(join(shelfBooks, ...parts), 'utf8')

      // ── S5 the shelf's routes ──
      assert.equal((await at('/books/basic/1/book.json')).text, bookBytes('basic', '1', 'book.json'), '/books/<n>/<e>/book.json is the shelf\'s bytes')
      assert.equal((await at('/books/basic/1/types.json')).status, 200)
      assert.equal((await at('/books/dinosaur-age/2/things.json')).text, bookBytes('dinosaur-age', '2', 'things.json'))
      // a folder is not a book: there is no index on the shelf
      for (const path of ['/books/basic/1/', '/books/basic/1', '/books/basic/', '/books/']) {
        const res = await at(path)
        assert.equal(res.status, 404, `${path} → 404`)
      }
      // the grammar is the guard — a name or an edition it refuses never touches the disk
      const refusedShelf = ['/books/Basic/1/book.json', '/books/basic/0/book.json', '/books/basic/01/book.json', '/books/basic/1.0/book.json', '/books/../server/server.js', '/books/basic/1/../../../server/server.js', '/books/basic/1/../../stats/1/book.json']
      for (const path of refusedShelf) {
        const { status, text } = await raw(origin, path)
        assert.ok([403, 404].includes(status), `${path} → ${status}`)
        assert.ok(!text.includes('createServer'), `${path}: never a server file`)
      }
      // The STATIC drawer is read-only: there is no route under /books/ that is not a
      // GET. RE-AIMED (stage 4): this clause used to carry the whole weight of "the
      // shelf cannot be written", which was really a fact about there being no write
      // route ANYWHERE. A book's write routes live under /api/books/ (§8), so what
      // this says — and all it meant — is that /books/ is a DRAWER, not a door. The
      // bytes are checked now, not just the status code: a 404 that wrote something
      // would have passed the old form.
      const shelfBefore = treeHash(shelfBooks)
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const { status } = await raw(origin, '/books/basic/1/book.json', method, '{}')
        assert.equal(status, 404, `${method} /books/… is not a route`)
      }
      assert.equal(treeHash(shelfBooks), shelfBefore, 'and not one byte of the shelf moved under any of the three')
      // the ENGINE asks page-relative, so the same file answers under the game too
      assert.equal((await at('/games/dino/books/basic/1/types.json')).text, bookBytes('basic', '1', 'types.json'), 'the engine\'s page-relative books/… lands on the same shelf')
      assert.equal((await at('/games/dino/books/nope/1/book.json')).status, 404)
      // the asset SEARCH PATH: the game's own assets/ first, then each pinned book's
      const gunInGame = join(dinoDir, 'assets', 'cannon.jpg')
      const gunInBook = join(shelfBooks, 'dinosaur-age', '1', 'assets', 'cannon.jpg')
      const own = await raw(origin, '/games/dino/assets/cannon.jpg')
      assert.equal(own.status, 200)
      assert.equal(own.length, statSync(gunInGame).size, 'the game\'s own copy answers first')
      rmSync(gunInGame)
      const fromBook = await raw(origin, '/games/dino/assets/cannon.jpg')
      assert.equal(fromBook.status, 200, 'and with the game\'s copy gone the BOOK\'s answers')
      assert.equal(fromBook.length, statSync(gunInBook).size, 'whole, from books/dinosaur-age/1/assets')
      cpSync(gunInBook, gunInGame)
      assert.equal((await raw(origin, '/games/dino/assets/dino.jpg')).status, 200, 'a picture only the game has')
      assert.equal((await at('/games/dino/assets/nope.jpg')).status, 404, 'a picture nobody has')
      assert.equal((await at('/games/vampire/assets/cannon.jpg')).status, 404, 'a game that pins nothing has no fallback')
      assert.equal((await raw(origin, '/games/dino/assets/../data/content.json')).status, 403, 'and the drawer\'s door is still guarded')
      ok(`S5 the shelf's routes: /books/<n>/<e>/<file> is the shelf's bytes, ${refusedShelf.length} refused spellings → 403/404 and never a server file, no folder index; the static drawer is GET-only — 3 write methods → 404 with not one byte of the shelf moved; /games/<g>/books/… is the same file; the asset search path answers the game's copy, then the book's, then 404 — and a game with no pins has no fallback`)

      // ── S6 save against the pins ──
      const shortShelfRoot = join(WORK, 'srv-short')
      const shortBooks = copyShelf(join(shortShelfRoot, 'books'))
      rmSync(join(shortBooks, 'stats'), { recursive: true })
      const shortGames = join(shortShelfRoot, 'games')
      const shortDir = copyGame(rebuiltDir, join(shortGames, 'dino'))
      const shortServer = await startServer(shortGames, join(shortShelfRoot, 'dist'), shortBooks)
      try {
        const receipts = await editorSave(shortServer.origin, 'dino', rebuilt)
        assert.deepEqual(receipts.slice(0, 4), Array(4).fill(SAVED), 'the four files that carry no pins land')
        assert.equal(receipts[4].status, 400, 'content.json does not')
        // the two PIN faults come first, verbatim — F1 for the book that is not
        // there and F3 for the one that needed it. Everything after them is the
        // honest cascade: with Dinosaur Age skipped, the game's own arrangement
        // and its pets' placements point at a shelf nobody filled.
        assert.deepEqual(receipts[4].body.problems.slice(0, 2), [
          { path: 'content.books[1]', message: '"stats" 1 is not on the shelf; the book is skipped' },
          { path: 'content.books[2]', message: '"dinosaur-age" 1 requires "stats" 1 — not pinned; the book is skipped' }
        ], 'F1 then F3, verbatim, at their pins')
        assert.ok(receipts[4].body.problems.slice(2).every(problem => problem.path.startsWith('things.')), 'and the rest is the cascade, in the game\'s own files')
        assert.equal(readFileSync(join(shortDir, 'data', 'content.json'), 'utf8'), rebuiltText.content, 'and nothing was written')
      } finally { shortServer.stop() }
      // with the whole shelf the same five files land, byte for byte
      const dinoHash = treeHash(dinoDir)
      assert.deepEqual(await editorSave(origin, 'dino', rebuilt), Array(5).fill(SAVED), 'over the full shelf: five 200s')
      assert.deepEqual(readGameText(dinoDir), rebuiltText, 'byte-identical to the rebuilt data')
      // the fault this case is ABOUT comes first; anything after it is the
      // cascade a skipped book leaves behind in the game's own files (an
      // arrangement and some placements pointing at a shelf nobody filled)
      const refuse = async (label, content, expected) => {
        const receipt = await post(origin, 'dino', 'content', content)
        assert.equal(receipt.status, 400, `${label}: 400`)
        assert.deepEqual(receipt.body.problems[0], expected, label)
        assert.ok(receipt.body.problems.slice(1).every(problem => problem.path.startsWith('things.')), `${label}: and the rest is the cascade`)
        assert.deepEqual(readGameText(dinoDir), rebuiltText, `${label}: nothing written`)
      }
      const withContent = (edit) => { const set = structuredClone(rebuilt); edit(set); return set.content }
      await refuse('a rowOverride hidden: false', withContent(set => { set.content.rowOverrides['dinosaur-age:row-gear'].hidden = false }),
        { path: 'content.rowOverrides["dinosaur-age:row-gear"].hidden', message: 'must be true or absent (found false)' })
      await refuse('a pin at an edition the shelf has not', withContent(set => { set.content.books[2] = { name: 'dinosaur-age', edition: 3 } }),
        { path: 'content.books[2]', message: '"dinosaur-age" 3 is not on the shelf; the book is skipped' })
      // things.json alone lands (a per-file check knows nothing of the shelf), and
      // then content.json is refused because the SET does not hold together
      const strayOrder = structuredClone(rebuilt.things)
      strayOrder.order['basic:place'].push('dinosaur-age:nest')            // edition 2's thing, under a pin at edition 1
      assert.deepEqual(await post(origin, 'dino', 'things', strayOrder), SAVED, 'things.json alone is a per-file check')
      const orderReceipt = await post(origin, 'dino', 'content', rebuilt.content)
      assert.equal(orderReceipt.status, 400)
      assert.deepEqual(orderReceipt.body.problems, [{ path: 'things.order["basic:place"][4]', message: 'arranges a thing that is not on shelf basic:place (dinosaur-age:nest); it is ignored' }], 'F15, at the id')
      assert.deepEqual(await post(origin, 'dino', 'things', rebuilt.things), SAVED, 'put the arrangement back')
      const strayPlacement = structuredClone(rebuilt.things)
      strayPlacement.things['basic:character'][0].origin = [{ thing: 'dinosaur-age:nope' }]
      assert.deepEqual(await post(origin, 'dino', 'things', strayPlacement), SAVED, 'a dangling placement lands per-file too')
      const placementReceipt = await post(origin, 'dino', 'content', rebuilt.content)
      assert.equal(placementReceipt.status, 400)
      assert.deepEqual(placementReceipt.body.problems, [{ path: 'things.things["basic:character"][0].origin[0].thing', message: 'places a thing that does not exist (dinosaur-age:nope)' }])
      assert.deepEqual(await post(origin, 'dino', 'things', rebuilt.things), SAVED, 'put back')
      assert.deepEqual(readGameText(dinoDir), rebuiltText)
      assert.equal(treeHash(dinoDir), dinoHash, 'the folder is exactly where it started')
      ok('S6 save against the pins: without Stats on the shelf the four land and content → 400 with F3 verbatim; with it, five 200s byte-identical; hidden: false, a pin at edition 3, an arrangement naming edition 2\'s Nest (F15) and a dangling placement each → 400 at their path, nothing written')

      // ── S8 the server judges the binding (NEW) ──
      // The validator is the contract the server enforces, and the two new
      // pointers join it: a save that names a section the player's sheet does not
      // have is a 400 with a sentence, not a game that quietly offers nothing.
      const mergedRows = flattenGame({ books: PLAN.pins.map(pin => readBookSync(shelfBooks, pin)), game: rebuilt }).content.groups
      const gearAt = `content.groups[${mergedRows.findIndex(row => row.id === 'dinosaur-age:row-gear')}]`
      assert.deepEqual(await post(origin, 'dino', 'content', rebuilt.content), SAVED, 'the good declaration and the four good bindings land')
      assert.equal(readFileSync(join(dinoDir, 'data', 'content.json'), 'utf8'), rebuiltText.content, 'and the bytes on disk are the bytes that were sent')
      const refuseSheet = async (label, content, expected) => {
        const receipt = await post(origin, 'dino', 'content', content)
        assert.equal(receipt.status, 400, `${label}: 400`)
        assert.deepEqual(receipt.body.problems, [expected], label)
        assert.equal(readFileSync(join(dinoDir, 'data', 'content.json'), 'utf8'), rebuiltText.content, `${label}: nothing written`)
      }
      await refuseSheet('a binding onto a FIELDS section', withContent(set => { set.content.rowOverrides['dinosaur-age:row-gear'].fills = 'basic:character.notes' }),
        { path: `${gearAt}.fills`, message: 'fills "Notes", which holds fields, not entries (basic:character.notes)' })
      await refuseSheet('a binding onto another shelf', withContent(set => { set.content.rowOverrides['dinosaur-age:row-gear'].fills = 'basic:character.skills' }),
        { path: `${gearAt}.fills`, message: 'shows basic:item but fills "Skills", which lists basic:skill (basic:character.skills)' })
      await refuseSheet('a sheet that is not on the shelf', withContent(set => { set.content.sheet = 'basic:nope' }),
        { path: 'content.sheet', message: 'builds a sheet that does not exist (basic:nope)' })
      await refuseSheet('a sheet that is not a string', withContent(set => { set.content.sheet = 3 }),
        { path: 'content.sheet', message: 'must be a string (found 3)' })
      assert.deepEqual(await post(origin, 'dino', 'content', rebuilt.content), SAVED, 'put back')
      ok('S8 the server judges the binding: a good sheet and four good bindings → 200 and the bytes on disk; a binding onto a FIELDS section, a binding onto another shelf, a sheet that is not on the shelf and a sheet that is not a string each → 400 with ONE problem at its exact path (the MERGED row for a binding, content.sheet for the declaration) and nothing written')

      // ── S9 the server judges a demand (NEW) ──
      // The third pointer pair joins the same contract, and it joins it in TWO halves,
      // exactly as a placement already does:
      //   SHAPE      things.json alone — is this even a condition? (validateFile)
      //   REFERENCE  content.json with its four siblings and the shelf — does it point
      //              at anything? (validateGame → crossChecks → the demand audit)
      // That split is not new and it is not arbitrary: the field a demand names lives
      // in types.json, which the things route has not read, so "does the slot exist?"
      // is a question only the whole-set pass can answer. S6 refuses a dangling
      // PLACEMENT the same way, at the same door.
      const BURGER_ID = 'b0e6c387-5297-4cd6-9a4a-a61fb51990c7'
      // TWO paths, and the difference is the point: a SHAPE fault is reported over the
      // game's OWN bucket (the file that was posted), a REFERENCE fault over the MERGED
      // one, because only the merge knows the shelf the demand points into.
      const burgerAt = `things.things["basic:place"][${rebuilt.things.things['basic:place'].findIndex(thing => thing.id === BURGER_ID)}]`
      const mergedPlaces = flattenGame({ books: PLAN.pins.map(pin => readBookSync(shelfBooks, pin)), game: rebuilt }).things.things['basic:place']
      const burgerMergedAt = `things.things["basic:place"][${mergedPlaces.findIndex(thing => thing.id === BURGER_ID)}]`
      const thingsText = () => readFileSync(join(dinoDir, 'data', 'things.json'), 'utf8')
      // the thing rewritten in the EDITOR's canonical order — id, name, cost,
      // imageURL, demands, then the type's own
      const withThings = (demands) => {
        const set = structuredClone(rebuilt)
        set.things.things['basic:place'] = set.things.things['basic:place'].map(thing => {
          if (thing.id !== BURGER_ID) return thing
          const rewritten = {}
          ;['id', 'name', 'cost', 'imageURL'].forEach(key => { rewritten[key] = thing[key] })
          if (demands !== null) rewritten.demands = demands
          Object.keys(thing).forEach(key => { if (!(key in rewritten)) rewritten[key] = thing[key] })
          return rewritten
        })
        return set.things
      }
      // (a) SHAPE — refused by things.json alone, and nothing is written
      const refuseShape = async (label, demands, expected) => {
        const before = thingsText()
        const receipt = await post(origin, 'dino', 'things', withThings(demands))
        assert.equal(receipt.status, 400, `${label}: 400`)
        assert.deepEqual(receipt.body.problems, [expected], label)
        assert.equal(thingsText(), before, `${label}: nothing written to disk`)
      }
      await refuseShape('the no-op nobody may write', [],
        { path: `${burgerAt}.demands`, message: 'must not be empty — a thing that demands nothing carries no "demands" key' })
      await refuseShape('an op no table has', [{ field: 'basic:character.places', op: 'nope', value: '' }],
        { path: `${burgerAt}.demands[0].op`, message: '"nope" is not an operator (is, isNot, eq, ne, lt, lte, gt, gte, has, lacks, holds, any, none)' })
      await refuseShape('a value of no legal type', [{ field: 'basic:character.places', op: 'holds', value: [] }],
        { path: `${burgerAt}.demands[0].value`, message: 'must be a string or a number (found an array)' })
      // (b) REFERENCE — the shape is fine, so things.json LANDS; content.json, judged
      // with its siblings and the shelf, is what refuses it, at the exact key
      const contentText = () => readFileSync(join(dinoDir, 'data', 'content.json'), 'utf8')
      const refuseReference = async (label, demands, expected) => {
        assert.deepEqual(await post(origin, 'dino', 'things', withThings(demands)), SAVED, `${label}: the SHAPE is fine, so things.json lands`)
        const before = contentText()
        const receipt = await post(origin, 'dino', 'content', rebuilt.content)
        assert.equal(receipt.status, 400, `${label}: content.json is refused`)
        assert.deepEqual(receipt.body.problems, [expected], label)
        assert.equal(contentText(), before, `${label}: and content.json is not written`)
      }
      await refuseReference('a slot that exists nowhere in the library', [{ field: 'basic:character.nope', op: 'holds', value: 'x' }],
        { path: `${burgerMergedAt}.demands[0].field`, message: 'demand names a field that does not exist (basic:character.nope)' })
      await refuseReference('an operator that does not fit the slot', [{ field: 'basic:character.places', op: 'gte', value: 2 }],
        { path: `${burgerMergedAt}.demands[0].op`, message: 'demand operator "gte" does not fit a list field (places)' })
      await refuseReference('a holds naming a thing off that shelf', [{ field: 'basic:character.places', op: 'holds', value: 'dinosaur-age:atlantis' }],
        { path: `${burgerMergedAt}.demands[0].value`, message: 'demand names a thing that is not on the Places shelf (dinosaur-age:atlantis)' })
      // (c) a healthy one lands, fifth key and all, and the game plays it
      const healthy = [{ field: 'basic:character.places', op: 'lacks', value: '6ff555af-d3b4-404f-99f6-d84e66ed54c0' }]
      assert.deepEqual(await post(origin, 'dino', 'things', withThings(healthy)), SAVED, 'a demand the library can answer is a 200')
      assert.deepEqual(await post(origin, 'dino', 'content', rebuilt.content), SAVED, 'and the whole set passes the cross pass')
      const saved = JSON.parse(thingsText())
      const savedBurger = saved.things['basic:place'].find(thing => thing.id === BURGER_ID)
      assert.deepEqual(Object.keys(savedBurger).slice(0, 5), ['id', 'name', 'cost', 'imageURL', 'demands'], 'on disk, `demands` is the FIFTH key')
      assert.deepEqual(savedBurger.demands, healthy)
      assert.deepEqual(Object.keys(savedBurger.demands[0]), ['field', 'op', 'value'])
      assert.equal(thingsText(), serialize(saved), 'the file is 2-space + trailing newline, as the server writes every file')
      const s9Play = hydrate(v5EngineDir, dinoDir, shelfBooks)
      assert.deepEqual(s9Play.warnings, [], 'zero warnings: the border can run this rule, so the entry is on sale')
      assert.equal(flatSummary(s9Play.groups).some(row => row.items.some(item => item.id === BURGER_ID)), true)
      // put the game back exactly as it was
      assert.deepEqual(await editorSave(origin, 'dino', rebuilt), Array(5).fill(SAVED), 'put back')
      assert.deepEqual(readGameText(dinoDir), rebuiltText, 'byte-identical to the rebuilt data')
      ok('S9 the server judges a demand, in the two halves the contract already has: the no-op `"demands": []`, an op no table has and a value of no legal type are SHAPE faults refused by things.json alone with nothing written; a slot that exists nowhere, an operator that does not fit and a `holds` naming a thing off that shelf are REFERENCE faults refused by content.json judged with its siblings and the shelf — each ONE problem at the exact key it is about, in demands.js\'s own words; a healthy demand lands fifth on disk in the editor\'s canonical order with its own field/op/value and the game hydrates it with zero warnings')

      // ── S7 the engine over HTTP: the shelf answers page-relative ──
      const http = await hydrateHTTP(v5EngineDir, `${origin}/games/dino/index.html`)
      assert.deepEqual(http.warnings, [], 'no warnings over HTTP')
      const bookURLsHTTP = PLAN.pins.flatMap(pin => BOOK_FILE_NAMES.map(file => `books/${pin.name}/${pin.edition}/${file}.json`))
      assert.deepEqual(http.fetched, [...FILES.map(name => `data/${name}.json`), ...bookURLsHTTP], '5 data urls then 12 book urls, page-relative, in pin order')
      // Basic and Stats ship no things.json or proposals.json: four honest 404s, tolerated
      const absent = ['basic/1/things.json', 'basic/1/proposals.json', 'stats/1/things.json', 'stats/1/proposals.json']
      for (const rest of absent) assert.equal((await at(`/games/dino/books/${rest}`)).status, 404, `${rest} is answered 404`)
      const folder = hydrate(v5EngineDir, dinoDir, shelfBooks)
      assert.deepEqual(project(http.groups), project(folder.groups), 'over HTTP the game plays exactly as it does over the folder')
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await raw(origin, `/games/dino/${rel}`)
        assert.equal(res.status, 200, rel)
        assert.ok(res.length > 0, `${rel}: whole file`)
      }
      ok(`S7 the engine over HTTP: ${http.fetched.length} page-relative urls (5 data, 12 book), the four absent book files answered 404 and tolerated, the hydration project-equal to the folder's, every image (the books' four included) served whole`)

      // ── I2 the editor's save order, with books ──
      const grown = structuredClone(rebuilt)
      const petId = randomUUID()
      grown.things.things['basic:character'].push({ id: petId, name: 'Nibbles', cost: 1, imageURL: '', concept: 'A tiny one', size: 'tiny', origin: [{ thing: 'dinosaur-age:velociraptor' }], notes: [] })
      grown.things.order['basic:place'] = [...grown.things.order['basic:place']].reverse()
      assert.deepEqual(validateGame({ own: grown, books: PLAN.pins.map(pin => readBookSync(shelfBooks, pin)) }), [], 'the pre-flight passes')
      assert.deepEqual(await editorSave(origin, 'dino', grown), Array(5).fill(SAVED), 'four then content: five 200s')
      const afterGrow = hydrate(v5EngineDir, dinoDir, shelfBooks)
      assert.deepEqual(afterGrow.warnings, [])
      assert.equal(countItems(afterGrow.groups), 18, 'nine pets now')
      assert.deepEqual(afterGrow.groups[2].items.map(item => item.name), ['King of Burger!!', 'Play pen', 'Lava Pit', 'The Scritches Dimension'], 'the ▲/▼ swap landed')
      // content posted ALONE, before things carries the new pet, is still fine —
      // a placement points INTO a book, and the books are on the shelf
      assert.deepEqual(await post(origin, 'dino', 'content', grown.content), SAVED, 'content alone is fine: its references live in the books')
      // but a new PRIVATE type referenced by a row is refused early, exactly as S3 shows
      const withPrivate = structuredClone(grown)
      const privateId = randomUUID(), privateRow = randomUUID()
      withPrivate.content.groups.push({ id: privateRow, label: 'Mine', query: { type: privateId, where: null }, showWhen: { kind: 'always' }, children: [] })
      const refusedEarly = await post(origin, 'dino', 'content', withPrivate.content)
      assert.equal(refusedEarly.status, 400)
      assert.match(refusedEarly.body.problems[0].message, /shows a type that does not exist/)
      assert.deepEqual(await editorSave(origin, 'dino', rebuilt), Array(5).fill(SAVED), 'put back')
      assert.deepEqual(readGameText(dinoDir), rebuiltText)
      ok('I2 editor save order with books: a new pet placing a book\'s origin plus a things.order swap land in the editor\'s order (four then content, five 200s) and show through the engine; content alone is fine because placements point INTO books; a new private type named by a row is still refused early')
      // ── I3 the editor round-trip, and templates (NEW) ──
      // Driven through the EDITOR'S OWN PAINT: a real card, a real "+ Add demand", a
      // real "from [ ▾ ]", and a click that runs the very handler a hand would run.
      // (The editor's modules import "/config/…" — the one url the dev server maps
      // onto engine/config/ — so they run here out of a copy with that ONE mapping
      // applied; `editorCopy` above does it, and nothing else about the bytes moves.)
      {
        // The rewrite really was the ONE mapping and nothing else. CHANGED (stage 4):
        // EVERY module of the editor, not just view.js. The copy is made by walking
        // dinoEdit/*.js, so checking one file proved the claim for one file and read as
        // a claim about the copy; a new editor module (the subject table the book editor
        // adds is the next one) would be rewritten unchecked. The list is read off disk,
        // so a new module joins this by existing.
        const editorModules = readdirSync(join(DINO_DIR, 'dinoEdit')).filter(file => file.endsWith('.js')).sort()
        assert.ok(editorModules.length >= 7, `the editor's modules were found (${editorModules.length})`)
        editorModules.forEach(file => {
          const rewritten = readFileSync(join(editorCopy, 'dinoEdit', file), 'utf8')
          assert.equal(rewritten.replace(/\.\.\/engine\/config\//g, '/config/').replace(/\.\.\/engine\/helpers\.js/g, '/helpers.js'),
            readFileSync(join(DINO_DIR, 'dinoEdit', file), 'utf8'), `dinoEdit/${file}: the copy is the editor's own bytes with only "/config/…" and "/helpers.js" made relative`)
        })
        assert.deepEqual(readdirSync(join(editorCopy, 'dinoEdit')).filter(file => file.endsWith('.js')).sort(), editorModules, 'and the copy holds exactly the editor\'s modules — no extra file runs in the child')

        // (a) READING MUST NOT WRITE. Opening the SUBJECT and painting it changes
        // nothing. (Here the subject is a game and its five files; the same claim over
        // a book's four is what makes opening a frozen edition safe, and it is owed by
        // whoever teaches this child to open one.)
        const opened = editorRun(dinoDir, shelfBooks, { type: 'basic:place', steps: [] })
        assert.deepEqual(opened.warnings, [], 'the paint says nothing')
        assert.equal(opened.addLabel, '+ Add Place', 'the sheet\'s own Add button')
        FILES.forEach(name => assert.equal(serialize(opened.own[name]), rebuiltText[name], `${name}.json: a no-edit paint is byte-identical`))

        // (b) THE DEMAND ROUND TRIP. A newborn carries no `demands` key at all;
        // "+ Add demand" writes one, FIFTH; and removing the last one DELETES it,
        // because "this entry demands nothing" already has a spelling.
        const edited = editorRun(dinoDir, shelfBooks, { type: 'basic:place', steps: [{ add: true }, { addDemand: true }, { removeDemand: true }] })
        assert.deepEqual(edited.warnings, [])
        const born = edited.steps[0].bucket.at(-1)
        assert.equal('demands' in born, false, 'a newborn writes no `demands` key — schema.js\'s `default: null` is that rule')
        assert.equal(edited.steps[0].demandsLine, 'no demands')
        const demanding = edited.steps[1].bucket.at(-1)
        assert.deepEqual(Object.keys(demanding).slice(0, 5), ['id', 'name', 'cost', 'imageURL', 'demands'], 'the key lands FIFTH, in the canonical slot')
        assert.equal(Object.keys(demanding).filter(key => key === 'demands').length, 1, 'and ONCE')
        assert.deepEqual(Object.keys(demanding.demands[0]), ['field', 'op', 'value'], 'a newborn demand is the three keys of query.where, in that order')
        assert.equal(edited.steps[1].demandRows, 1, 'one editable row on the card')
        assert.ok(edited.steps[1].demandsLine.startsWith('Needs: '), 'and the SENTENCE above it — demandText\'s own bytes, so a locked book card reads like the printed page')
        const emptied = edited.steps[2].bucket.at(-1)
        assert.equal('demands' in emptied, false, 'removing the LAST demand deletes the key — the file never carries a no-op')
        assert.deepEqual(emptied, born, 'and what is left is the newborn it was, byte for byte')

        // …and the server takes it: save, reload, the key is still fifth and still once
        const saved = structuredClone(rebuilt)
        saved.things.things['basic:place'] = edited.steps[1].bucket
        assert.deepEqual(await editorSave(origin, 'dino', saved), Array(5).fill(SAVED), 'five 200s, in the editor\'s order')
        const reloaded = editorRun(dinoDir, shelfBooks, { type: 'basic:place', steps: [] })
        const fromDisk = reloaded.own.things.things['basic:place'].at(-1)
        assert.deepEqual(Object.keys(fromDisk).slice(0, 5), ['id', 'name', 'cost', 'imageURL', 'demands'], 'reloaded, the key is still fifth')
        assert.deepEqual(fromDisk.demands, demanding.demands)
        assert.equal(serialize(reloaded.own.things), readFileSync(join(dinoDir, 'data', 'things.json'), 'utf8'), 'and a no-edit save after the reload is byte-identical')
        assert.deepEqual(await editorSave(origin, 'dino', rebuilt), Array(5).fill(SAVED), 'put back')
        assert.deepEqual(readGameText(dinoDir), rebuiltText)

        // (c) TEMPLATES, the author's half. A template is not a new shape and carries no
        // mark: it is a thing of a sheet's type used as a newborn's SOURCE.
        const TALI = 'a8d09a0f-f269-4a04-a173-d694dc36b105'
        const fromTali = editorRun(dinoDir, shelfBooks, { type: 'basic:character', steps: [{ startFrom: TALI }, { add: true }, { probeShared: TALI }] })
        assert.deepEqual(fromTali.warnings, [])
        assert.equal(fromTali.addLabel, '+ Add Character')
        assert.deepEqual(fromTali.steps[0].options[0], { value: '', label: '— blank —' }, '"— blank —" is first, so today\'s behaviour is the default')
        assert.deepEqual(fromTali.steps[0].options[1], { value: TALI, label: 'Tali (this game)' }, 'and every thing on the MERGED shelf is offered, labelled with the layer it came from')
        const tali = rebuilt.things.things['basic:character'].find(thing => thing.id === TALI)
        const copy = fromTali.steps[1].bucket.at(-1)
        assert.notEqual(copy.id, TALI)
        // a FRESH id from THIS SUBJECT's minter — a game mints uuids (a book cannot:
        // every id it defines must sit in its own `<name>:` namespace). What the claim
        // is about is the BUCKET: the copy lands in the subject's own, so its card is editable.
        assert.match(copy.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'a fresh uuid — the GAME\'s minter — and the copy lands in the GAME\'s bucket, so its card is editable')
        assert.equal(copy.name, 'Tali copy', 'a name that SAYS it is a copy, so two identical names never sit on one shelf')
        assert.deepEqual({ ...copy, id: TALI, name: tali.name }, tali, 'every other key deep-equal to the source')
        assert.deepEqual(Object.keys(copy), Object.keys(tali), 'in the source\'s own key order — the spread comes first')
        assert.deepEqual(fromTali.steps[2].shared, [], 'and the two share NO array: a deep clone, for the reason newborn clones each default')
        assert.equal(fromTali.steps[1].bucket.length, rebuilt.things.things['basic:character'].length + 1, 'one thing added, and only one')
        // a copy of a BOOK's thing lands in the GAME's own bucket, editable
        const fromBook = editorRun(dinoDir, shelfBooks, { type: 'basic:place', steps: [{ startFrom: 'dinosaur-age:lava-pit' }, { add: true }, { probeShared: 'dinosaur-age:lava-pit' }] })
        const bookCopy = fromBook.steps[1].bucket.at(-1)
        assert.equal(bookCopy.name, 'Lava Pit copy')
        assert.match(bookCopy.id, /^[0-9a-f]{8}-/, 'a fresh uuid, NOT dinosaur-age:lava-pit — which is how a book ships a template')
        assert.equal(fromBook.own.things.things['basic:place'].at(-1).id, bookCopy.id, 'and it is in the GAME\'s own bucket, which is what makes it editable')
        assert.deepEqual(fromBook.steps[2].shared, [])
        assert.deepEqual({ ...bookCopy, id: 'dinosaur-age:lava-pit', name: 'Lava Pit' },
          readBookSync(shelfBooks, { name: 'dinosaur-age', edition: 1 }).things.things['basic:place'].find(thing => thing.id === 'dinosaur-age:lava-pit'),
          'every other key is the BOOK\'s thing, exactly')
        // a source the shelf lost falls back to blank — a screen that moved on, not a fault
        const gone = editorRun(dinoDir, shelfBooks, { type: 'basic:place', steps: [{ startFrom: 'dinosaur-age:nowhere' }, { add: true }] })
        assert.equal(gone.steps[1].bucket.at(-1).name, 'New thing', 'a remembered source that is not on this shelf falls back to blank, quietly')
        ok('I3 the editor round-trip and templates, driven through the editor\'s OWN paint: opening a game and painting it is byte-identical (reading never writes); a newborn carries no `demands` key, "+ Add demand" writes one FIFTH and ONCE with its own field/op/value under demandText\'s sentence, and removing the last one DELETES the key leaving the newborn byte for byte; saved and reloaded through the real server the key is still fifth and a no-edit save is still byte-identical; and "+ Add Character from Tali" mints a fresh uuid, names it "Tali copy", deep-equals the source in every other key IN THE SOURCE\'S KEY ORDER, shares no array with it, and — from a BOOK\'s thing — lands in the game\'s own bucket, editable, while a source the shelf lost falls quietly back to blank')
      }

    } finally {
      stop()
    }
  }

  // ═════════════════════ the export: E1–E9 ═════════════════════
  // tools/export.mjs publishes a game as ONE static folder. E1–E5 prove what the
  // folder holds and that it plays, from a subpath, over real HTTP; E6–E9 prove
  // every refusal writes nothing and wipes nothing it did not write. The source
  // is the v5 scratch copy and the shelf is a scratch copy: the real books/ is
  // only ever read (T1/D1), never handed to a tool that writes.
  const expShelf = copyShelf(join(WORK, 'exp-shelf', 'books'))
  const exportOf = (options) => exportGame({ game, sourceDir: v5Source, booksDir: expShelf, ...options })
  const sourceSet = readGameSet(v5Source)
  const sourceBooks = (sourceSet.content.books ?? []).map(pin => readBookSync(expShelf, pin))
  const hasPins = sourceSet.content.books.length > 0

  // ── E1 exact file set ──
  const outDir = join(WORK, 'dist', game)
  const { manifest } = exportOf({ outDir })
  const exported = listFiles(outDir)
  const expectedFiles = [MANIFEST, ...listFiles(v5EngineDir).filter(notDot), ...FILES.map(name => `data/${name}.json`), ...listFiles(join(v5Source, 'assets')).filter(notDot).map(file => `assets/${file}`)].sort()
  assert.deepEqual(exported, expectedFiles, 'the engine, data/, assets/ and the manifest — nothing else')
  exported.forEach(path => assert.doesNotMatch(path, /dinoEdit|server|tools|oracles|books\/|\.mjs$|\.DS_Store/))
  assert.deepEqual(Object.keys(manifest.files), exported.filter(path => path !== MANIFEST), 'the manifest lists every file but itself, in listFiles order')
  assert.deepEqual(Object.keys(manifest), ['tool', 'game', 'schemaVersion', 'books', 'complete', 'rows', 'items', 'files'], 'fixed keys — no timestamp, no git hash')
  assert.equal(manifest.tool, 'cyoa-export')
  assert.equal(manifest.complete, true)
  assert.equal(manifest.schemaVersion, SCHEMA_VERSION)
  assert.equal(manifest.game, game)
  assert.deepEqual(manifest.books, sourceSet.content.books, 'the books folded in — the folder\'s only record of the shelf it was built on')
  assert.equal(manifest.rows, countGroups(v5Tree.groups))
  assert.equal(manifest.items, countItems(v5Tree.groups))
  // the dotfile filter only bites when a dotfile is THERE: plant Finder's droppings in a
  // scratch source and prove the export leaves them behind (the marker is the one dotfile)
  const dotted = copyGame(v5Source, join(WORK, 'dotted', game))
  writeFileSync(join(dotted, 'assets', '.DS_Store'), 'finder was here')
  mkdirSync(join(dotted, 'assets', '.hidden'), { recursive: true })
  writeFileSync(join(dotted, 'assets', '.hidden', 'x.txt'), 'hidden')
  const dottedOut = join(WORK, 'dist-dotted', game)
  exportOf({ outDir: dottedOut, sourceDir: dotted })
  assert.deepEqual(listFiles(dottedOut).filter(path => path !== MANIFEST && !notDot(path)), [], 'no dotfile or dot-folder travels — only the marker')
  ok(`E1 export = ${exported.length} files: engine/ + data/ + assets/ + ${MANIFEST}, nothing else; manifest keys tool, game, schemaVersion, books, complete, rows, items, files; ${manifest.rows} rows, ${manifest.items} things, books ${JSON.stringify(manifest.books)}; a planted .DS_Store stays behind`)

  // ── E2 bytes ──
  // A game that pins NOTHING travels as its own bytes — flattening it would be a
  // re-serialization of files that are already exactly right. A game WITH pins
  // travels as the flattened merge, because the folder must need no shelf.
  const flattened = hasPins ? flattenGame({ books: sourceBooks, game: sourceSet }) : null
  FILES.forEach(name => {
    const written = readFileSync(join(outDir, 'data', `${name}.json`), 'utf8')
    assert.equal(written, hasPins ? serialize(flattened[name]) : readFileSync(join(v5Source, 'data', `${name}.json`), 'utf8'),
      hasPins ? `data/${name}.json is the FLATTENED merge` : `data/${name}.json is the source's own bytes`)
  })
  listFiles(join(v5Source, 'assets')).filter(notDot).forEach(file => {
    const source = join(v5Source, 'assets', file), copy = join(outDir, 'assets', file)
    assert.equal(statSync(copy).size, statSync(source).size, `${file}: size`)
    assert.equal(sha256(copy), sha256(source), `${file}: sha256`)
  })
  if (game === 'vampire') assert.equal(readFileSync(join(outDir, 'assets', 'ATTRIBUTION.txt'), 'utf8'), readFileSync(join(v5Source, 'assets', 'ATTRIBUTION.txt'), 'utf8'), 'ATTRIBUTION.txt travels')
  if (!hasPins) {
    // the source's files are canonical, so bytes == serialize(parse(bytes)) could hide a
    // re-serialization: a source with 4-space content.json and no trailing newline cannot
    const nonCanon = copyGame(v5Source, join(WORK, 'noncanon', game))
    const oddText = JSON.stringify(JSON.parse(readFileSync(join(nonCanon, 'data', 'content.json'), 'utf8')), null, 4)
    writeFileSync(join(nonCanon, 'data', 'content.json'), oddText)
    exportOf({ outDir: join(WORK, 'dist-noncanon', game), sourceDir: nonCanon })
    assert.equal(readFileSync(join(WORK, 'dist-noncanon', game, 'data', 'content.json'), 'utf8'), oddText, 'a book-less game\'s data travels untouched, never re-serialized')
  }
  Object.entries(manifest.files).forEach(([path, { bytes, sha256: hash }]) => {
    assert.equal(sha256(join(outDir, path)), hash, `${path}: manifest sha256`)
    assert.equal(statSync(join(outDir, path)).size, bytes, `${path}: manifest bytes`)
  })
  assert.deepEqual(JSON.parse(readFileSync(join(outDir, MANIFEST), 'utf8')), manifest, 'the manifest on disk is the one returned')
  ok(`E2 bytes: the five data files ${hasPins ? 'are serialize(flattenGame(…))' : 'travel verbatim, never re-serialized'}; ${Object.keys(manifest.files).length} sizes and sha256s true to the manifest; the manifest on disk parses to itself`)

  // ── E3 the folder hydrates like the source — engine AND data from the folder, NO shelf ──
  const fromDist = hydrate(outDir, outDir)
  assert.deepEqual(fromDist.warnings, [])
  assert.deepEqual(fromDist.fetched, FILES.map(name => `data/${name}.json`), 'the published folder never asks for a shelf')
  const fromSource = hydrate(v5EngineDir, v5Source, hasPins ? expShelf : undefined)
  assert.deepEqual(project(fromDist.groups), project(fromSource.groups), 'the folder plays exactly like the source')
  assert.equal(fromDist.heroImage, 'assets/heroBG.jpg')
  imagesOf(fromDist.groups).forEach(rel => assert.ok(existsSync(join(outDir, rel)), `${rel} is in the folder`))
  ok(`E3 the folder hydrates like the source: same projection, five page-relative fetches and no book url, ${imagesOf(fromDist.groups).length} image URLs all present`)

  // ── W6 the published folder does all of it, with no server (NEW) ──
  // The published folder is the artifact this whole codebase exists to make: a
  // static directory, opened from any subpath, with no shelf on disk and no
  // server behind it. Everything Stage 2 added has to work THERE — otherwise it
  // is a feature of the workshop rather than of the game.
  if (game === 'dino') {
    assert.equal(fromDist.playerSheet.id, 'basic:character', 'the folder knows which sheet the player builds')
    assert.deepEqual(fromDist.bindings.map(row => row.fills), ['basic:character.companions', 'basic:character.gear', 'basic:character.places', 'basic:character.places'], 'and every row is bound')
    assert.deepEqual(fromDist.fetched, FILES.map(name => `data/${name}.json`), 'five urls, and never a books/… — the merge baked the shelf in')
    // the FLATTENED bytes on disk: the declaration, and a `fills` on every row
    const distContent = JSON.parse(readFileSync(join(outDir, 'data', 'content.json'), 'utf8'))
    assert.equal(distContent.sheet, 'basic:character')
    assert.deepEqual(distContent.groups.map(row => row.fills), ['basic:character.companions', 'basic:character.gear', 'basic:character.places', 'basic:character.places'])
    assert.deepEqual(distContent.rowOverrides, {}, 'nothing left to override — the folder IS the merge')
    // W2's play, over the folder, with the folder's own engine
    const distPlay = playFully(outDir, outDir, PLAY_STEPS)
    assert.deepEqual(distPlay.warnings, [])
    assert.deepEqual(distPlay.steps.map(step => step.spent), SPENT_PER_STEP, 'the same fifteen numbers as the source game')
    // W4's round trip, over the folder — the same BYTES as over the source
    const distKept = playFully(outDir, outDir, KEEP_AT_8).final.kept
    const sourceKept = playFully(v5EngineDir, v5Source, KEEP_AT_8, expShelf).final.kept
    assert.equal(distKept, sourceKept, 'a sheet kept from the published folder is byte-identical to one kept from the source')
    const loaded = playFully(outDir, outDir, [{ load: distKept }])
    assert.deepEqual(loaded.final.notice, { bad: false, text: 'Loaded "Rexina".', notes: [] }, 'and it loads back into the folder, clean')
    assert.equal(loaded.final.kept, distKept)
    assert.equal(loaded.final.spent, 9)
    // and the two new engine files travelled, byte for byte
    ;['config/sheet.js', 'config/kept.js'].forEach(file => {
      assert.ok(existsSync(join(outDir, file)), `${file} is in the folder`)
      assert.equal(sha256(join(outDir, file)), sha256(join(v5EngineDir, file)), `${file} byte-equals the engine's`)
    })
    ok('W6 the published folder: no shelf, no server — five data urls and nothing else; the flattened content.json carries the declaration and a fills on every row with rowOverrides {}; playerSheet resolves; §2.6\'s fifteen steps give §2.6\'s fifteen numbers; a sheet kept from the folder is BYTE-IDENTICAL to one kept from the source and loads back clean; config/sheet.js and config/kept.js byte-equal the engine\'s')
  }

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
      for (const [, spec] of readFileSync(join(outDir, rel), 'utf8').matchAll(/^\s*(?:import|export)[^'"\n]*from\s+['"]([^'"]+)['"]/gm)) assert.equal(await status(new URL(spec, moduleURL)), 200, `${spec} from ${rel}`)
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
  exportOf({ outDir })
  assert.equal(treeHash(outDir), h1, 'a second export is byte-identical, manifest included')
  assert.ok(!existsSync(join(outDir, 'stray.txt')), 'the stray file is gone')
  ok('E5 a second export is byte-identical (manifest included, no timestamp); a stray file in a marked folder is rebuilt away')

  // ── E6 refuses data that is not at the current version, and writes nothing ──
  const v4Src = writeGame(join(WORK, 'v4src', game), rawV4)
  cpSync(join(v5Source, 'assets'), join(v4Src, 'assets'), { recursive: true })
  const outV4 = join(WORK, 'out-v4', game)
  assert.throws(() => exportOf({ outDir: outV4, sourceDir: v4Src }), err => err instanceof ExportRefusal && /is at version 4, not 7 — open the game in the editor and Save first/.test(err.message))
  assert.equal(existsSync(outV4), false, 'nothing written')
  // a data file that is not JSON is a refusal by name, never a stack trace
  const badJSON = copyGame(v5Source, join(WORK, 'badjson', game))
  writeFileSync(join(badJSON, 'data', 'content.json'), '{')
  const outBad = join(WORK, 'out-badjson', game)
  assert.throws(() => exportOf({ outDir: outBad, sourceDir: badJSON }), err => err instanceof ExportRefusal && /data\/content\.json is not valid JSON \(/.test(err.message))
  assert.equal(existsSync(outBad), false, 'nothing written for bad JSON either')
  ok('E6 a v4 game is refused by version ("open the game in the editor and Save first"); a file that is not JSON is refused by name; nothing written')

  // ── E7 refuses a dangling set and a missing image, and preserves a previous export ──
  const keep = join(WORK, 'keep', game)
  exportOf({ outDir: keep })
  const hKeep = treeHash(keep)
  const dangling = copyGame(v5Source, join(WORK, 'dangling', game))
  const danglingSet = readGameSet(dangling)
  danglingSet.content.groups.push({ id: 'e7-row', label: 'E7', query: { type: '', where: null }, showWhen: { kind: 'anyInRow', row: 'no-such-row' }, children: [] })
  writeFileSync(join(dangling, 'data', 'content.json'), serialize(danglingSet.content))
  const danglingIndex = mergeLayers({ books: sourceBooks, game: danglingSet }).set.content.groups.findIndex(row => row.id === 'e7-row')
  assert.throws(() => exportOf({ outDir: keep, sourceDir: dangling }), err => {
    assert.ok(err instanceof ExportRefusal)
    assert.deepEqual(err.problems, [{ path: `content.groups[${danglingIndex}].showWhen`, message: 'show-when names a row that does not exist (no-such-row)' }])
    assert.match(err.message, /does not fit the schema \(1 problem/)
    return true
  })
  const ghost = copyGame(v5Source, join(WORK, 'ghost', game))
  const ghostSet = readGameSet(ghost)
  const [firstBucket] = Object.keys(ghostSet.things.things)
  ghostSet.things.things[firstBucket][0].imageURL = 'ghost.png'
  ghostSet.themes.page.heroImage = 'nohero.jpg'
  writeFileSync(join(ghost, 'data', 'things.json'), serialize(ghostSet.things))
  writeFileSync(join(ghost, 'data', 'themes.json'), serialize(ghostSet.themes))
  assert.throws(() => exportOf({ outDir: keep, sourceDir: ghost }), err => {
    assert.ok(err instanceof ExportRefusal)
    assert.ok(err.problems.some(problem => problem.path === `things.things[${JSON.stringify(firstBucket)}][0].imageURL` && problem.message === 'names a file that is not in assets/ (ghost.png)'), JSON.stringify(err.problems))
    assert.ok(err.problems.some(problem => problem.path === 'themes.page.heroImage' && problem.message === 'names a file that is not in assets/ (nohero.jpg)'))
    return true
  })
  assert.equal(treeHash(keep), hKeep, 'the previous export survives both refusals (validate before wipe)')
  ok('E7 a dangling gate → refused at its merged path; a ghost image and a ghost hero → refused by path; the previous export is untouched')

  // ── E8 wipe safety and out-dir guards ──
  const notMine = join(WORK, 'notmine', game)
  mkdirSync(notMine, { recursive: true })
  writeFileSync(join(notMine, 'precious.txt'), 'keep me\n')
  assert.throws(() => exportOf({ outDir: notMine }), /refusing to wipe .*no \.cyoa-export\.json marker/)
  assert.deepEqual(listFiles(notMine), ['precious.txt'], 'precious.txt survives')
  const empty = join(WORK, 'empty', game)
  mkdirSync(empty, { recursive: true })
  exportOf({ outDir: empty })
  assert.equal(treeHash(empty), h1, 'an existing empty folder is accepted and filled')
  const half = join(WORK, 'half', game)
  mkdirSync(half, { recursive: true })
  writeFileSync(join(half, MANIFEST), serialize({ tool: 'cyoa-export', game, schemaVersion: 5, complete: false }))
  writeFileSync(join(half, 'stale.txt'), 'from an interrupted run\n')
  exportOf({ outDir: half })
  assert.ok(!existsSync(join(half, 'stale.txt')), 'an interrupted export is ours to wipe')
  assert.equal(treeHash(half), h1)
  const theirs = join(WORK, 'theirs', game)
  mkdirSync(theirs, { recursive: true })
  writeFileSync(join(theirs, MANIFEST), serialize({ tool: 'other', game }))
  writeFileSync(join(theirs, 'theirs.txt'), 'another tool wrote this\n')
  assert.throws(() => exportOf({ outDir: theirs }), /refusing to wipe/)
  assert.deepEqual(listFiles(theirs), [MANIFEST, 'theirs.txt'], 'another tool\'s folder is untouched')
  const asFile = join(WORK, `outfile-${game}.txt`)
  writeFileSync(asFile, 'a file, not a folder\n')
  assert.throws(() => exportOf({ outDir: asFile }), err => err instanceof ExportRefusal && /it exists and is not a folder/.test(err.message))
  assert.equal(readFileSync(asFile, 'utf8'), 'a file, not a folder\n', 'the file is untouched')
  // claim-first: a copy that dies half way must leave OUR marker (complete: false)
  // behind, so the next run may wipe the debris.
  const dying = copyGame(v5Source, join(WORK, 'dying', game))
  const unreadable = join(dying, 'assets', 'unreadable.bin')
  writeFileSync(unreadable, 'x')
  const dyingOut = join(WORK, 'dist-dying', game)
  try {
    chmodSync(unreadable, 0o000)
    assert.throws(() => exportOf({ outDir: dyingOut, sourceDir: dying }), err => !(err instanceof ExportRefusal) && /EACCES/.test(err.message))
    const marker = JSON.parse(readFileSync(join(dyingOut, MANIFEST), 'utf8'))
    assert.deepEqual([marker.tool, marker.complete], [TOOL, false], 'the claim went down before the first copied byte')
  } finally {
    chmodSync(unreadable, 0o644)
  }
  exportOf({ outDir: dyingOut, sourceDir: dying })   // the debris carried our marker, so it is rebuilt
  assert.equal(JSON.parse(readFileSync(join(dyingOut, MANIFEST), 'utf8')).complete, true)
  const dataHash = treeHash(join(v5Source, 'data'))
  const shelfHash = treeHash(expShelf)
  // CHANGED (stage 4): the guard list is a TABLE carrying its reason per row, and it
  // reaches the depth an AUTHOR writes at. guardOutDir's rule is about a books folder
  // AT ANY DEPTH; the list only ever probed the shelf root and one book, so "never the
  // shelf" was read off a list that stopped one level above where a book actually
  // lives. Note whose claim this is: the EXPORT TOOL never writes into a books folder.
  // The editor's book routes write one on purpose, and the guard that matters there —
  // refusing a pinned edition — is theirs to state and theirs to prove.
  const GUARDED = [
    [v5Source,                     'the source game itself'],
    [join(v5Source, 'assets'),     'and its assets'],
    [expShelf,                     'the books folder'],
    [join(expShelf, 'basic'),      'a book inside it'],
    [join(expShelf, 'basic', '1'), 'and an EDITION inside that — the folder an author writes'],
    [dirname(DINO_DIR),            'cyoa/, which CONTAINS the books folder'],
    [DINO_DIR,                     'and the project itself']
  ]
  GUARDED.forEach(([target, why]) => {
    assert.throws(() => exportOf({ outDir: target }), /refusing to write/, `guard: ${why} (${target})`)
    assert.ok(!existsSync(join(target, MANIFEST)), `${why}: nothing claimed`)
  })
  assert.equal(treeHash(join(v5Source, 'data')), dataHash, 'the source game\'s data is untouched')
  assert.equal(treeHash(expShelf), shelfHash, 'and so is the shelf this export was given')
  ok(`E8 wipe safety: an unmarked folder with files → refused, file kept; an empty folder → filled; an interrupted export → rebuilt; another tool's marker → refused; a file as --out → refused; a copy that dies leaves the claim marker; ${GUARDED.length} guarded out-dirs — the source game, its assets, the books folder, a book, an EDITION, cyoa/ and DinoCYOA → refused, nothing claimed, nothing touched`)

  // ── E9 the CLI: exit codes and the printed tree ──
  const cliOut = join(WORK, 'cli-export', game)
  const cliArgs = ['--game-dir', v5Source, '--books-dir', expShelf]
  const written = runExportCLI([game, '--out', cliOut, ...cliArgs])
  assert.equal(written.status, 0, `the CLI exits 0:\n${written.stdout}`)
  ;[/→ /, /verified/, /preview\s+python3 -m http\.server/, /publish/].forEach(pattern => assert.match(written.stdout, pattern))
  if (hasPins) assert.match(written.stdout, /books\s+basic 1, stats 1, dinosaur-age 1 — folded in; the folder needs no shelf/)
  assert.equal(treeHash(cliOut), treeHash(outDir), 'the CLI writes what exportGame writes')
  const noArgs = runExportCLI([])
  assert.equal(noArgs.status, 1)
  assert.match(noArgs.stdout, /usage/)
  const wipe = runExportCLI([game, '--out', notMine, ...cliArgs])
  assert.equal(wipe.status, 2)
  assert.match(wipe.stdout, /refusing to wipe/)
  const cliV4 = join(WORK, 'cli-v4', game)
  const oldData = runExportCLI([game, '--game-dir', v4Src, '--books-dir', expShelf, '--out', cliV4])
  assert.equal(oldData.status, 2)
  assert.match(oldData.stdout, /Save first/)
  assert.equal(existsSync(cliV4), false, 'a refused CLI run writes nothing')
  const nosuch = runExportCLI(['nosuch'])
  assert.equal(nosuch.status, 2)
  assert.match(nosuch.stdout, /no such game/)
  ok('E9 CLI: exit 0 prints the tree (and the books folded in) and writes E1\'s bytes; no args → 1 (usage); unmarked folder, v4 data, unknown game → 2, nothing written')

  // ═════════════════════ the export, with books: E11–E13 (dino) ═════════════════════
  if (game === 'dino') {
    // ── E11 flatten equality: the published folder IS the merge, and needs no shelf ──
    const dist = readGameSet(outDir)
    assert.deepEqual(dist.content.books, [], 'the folder pins nothing — there is nothing left to pin')
    assert.deepEqual(dist.content.rowOverrides, {}, 'and nothing left to override')
    assert.deepEqual([dist.types.sectionsFor, dist.types.fieldsFor], [{}, {}])
    assert.equal(dist.things.order, undefined, 'the arrangement is baked into the buckets')
    assert.equal(dist.content.groups.length, 4, 'the four proposed rows are the folder\'s own rows now')
    assert.deepEqual(dist.things.things['basic:place'].map(thing => thing.name), ['The Scritches Dimension', 'Lava Pit', 'Play pen', 'King of Burger!!', 'Volcano Rim'])
    assert.deepEqual(validateSet(dist), [], 'and the folder\'s five files fit the contract with no books at all')
    // it PLAYS the same three ways: from the folder, from the live merge, and as v4 did
    assert.deepEqual(project(fromDist.groups), project(fromSource.groups), 'the folder plays the live merge')
    assert.deepEqual(project(fromDist.groups), project(v4Result.groups), 'and both play what v4 played')
    assert.deepEqual(fromDist.fetched, FILES.map(name => `data/${name}.json`))
    assert.deepEqual(manifest.books, PLAN.pins)
    assert.equal(treeHash(cliOut), h1, 'a second export, through the CLI, is byte-identical')
    ok('E11 export flatten: the published dino holds the FLATTENED merge (books [], no overrides, no order, the arranged buckets), fits the contract alone, asks for five data files and no shelf, and projects exactly what the live merge and the v4 game project')

    // ── E12 assets: one flat folder, the union of the game's and the books' ──
    const GEAR = ['banana.png', 'cannon.jpg', 'rock.jpeg', 'skates.jpg']
    GEAR.forEach(file => {
      assert.equal(listFiles(outDir).filter(path => path === `assets/${file}`).length, 1, `${file} is in the folder once`)
      assert.equal(sha256(join(outDir, 'assets', file)), sha256(join(expShelf, 'dinosaur-age', '1', 'assets', file)), `${file} has the book's bytes`)
    })
    // a source whose own assets/ lacks the four gets them from the book
    const bare = copyGame(v5Source, join(WORK, 'bare-assets', game))
    GEAR.forEach(file => rmSync(join(bare, 'assets', file)))
    const bareOut = join(WORK, 'dist-bare', game)
    exportOf({ outDir: bareOut, sourceDir: bare })
    GEAR.forEach(file => assert.equal(sha256(join(bareOut, 'assets', file)), sha256(join(expShelf, 'dinosaur-age', '1', 'assets', file)), `${file} came from the book`))
    assert.equal(treeHash(bareOut), h1, 'and the folder is byte-identical to the one built from the game\'s own copies')
    // the same name with DIFFERENT bytes is a question only the author can answer
    const clash = copyGame(v5Source, join(WORK, 'clash-assets', game))
    writeFileSync(join(clash, 'assets', 'cannon.jpg'), 'not the same picture at all\n')
    const clashOut = join(WORK, 'dist-clash', game)
    assert.throws(() => exportOf({ outDir: clashOut, sourceDir: clash }), err => {
      assert.ok(err instanceof ExportRefusal)
      const problem = err.problems.find(each => each.path === 'assets/cannon.jpg')
      assert.ok(problem, JSON.stringify(err.problems))
      assert.match(problem.message, /is in .*assets and in .*dinosaur-age.1.assets with different bytes — rename one/)
      return true
    })
    assert.equal(existsSync(clashOut), false, 'nothing written')
    // a name on no path at all
    const noPath = copyGame(v5Source, join(WORK, 'nopath-assets', game))
    const noPathSet = readGameSet(noPath)
    noPathSet.things.things['basic:item'] = [{ id: 'own-ghost', name: 'Ghost', cost: 0, imageURL: 'nowhere.png', description: '', tags: [] }]
    writeFileSync(join(noPath, 'data', 'things.json'), serialize(noPathSet.things))
    const ghostIndex = mergeLayers({ books: sourceBooks, game: noPathSet }).set.things.things['basic:item'].findIndex(thing => thing.id === 'own-ghost')
    assert.throws(() => exportOf({ outDir: join(WORK, 'dist-nopath', game), sourceDir: noPath }), err => {
      assert.deepEqual(err.problems, [{ path: `things.things["basic:item"][${ghostIndex}].imageURL`, message: 'names a file that is not in assets/ (nowhere.png)' }])
      return true
    })
    ok('E12 assets: the four gear images are in the folder once, with the book\'s bytes; a source whose own assets/ lacks them gets them from the book (byte-identical folder); the same name with different bytes → refused at assets/cannon.jpg, nothing written; a name on no path → refused at the thing\'s imageURL')

    // ── E13 refusals that only a shelf can cause ──
    const hKept = treeHash(outDir)
    const offShelf = copyGame(v5Source, join(WORK, 'offshelf', game))
    const offSet = readGameSet(offShelf)
    offSet.content.books[2] = { name: 'dinosaur-age', edition: 3 }
    writeFileSync(join(offShelf, 'data', 'content.json'), serialize(offSet.content))
    assert.throws(() => exportOf({ outDir, sourceDir: offShelf }), err => err instanceof ExportRefusal && /pins a book that is not on the shelf: dinosaur-age 3/.test(err.message))
    // the §5.3 shelf: the export refuses a game whose merge has faults, naming every one
    const dupExportShelf = copyShelf(join(WORK, 'exp-dup', 'books'))
    writeBook(dupExportShelf, 'dup', 1, {
      book: { name: 'dup', title: 'Dup', edition: 1, requires: [{ name: 'basic', edition: 1 }] },
      types: { version: 7, types: [], sectionsFor: {}, fieldsFor: { 'basic:nope': [{ id: 'dup:ghost', key: 'ghost', caption: 'Ghost', type: 'text' }] } },
      things: { version: 7, things: { 'basic:item': [{ id: 'dinosaur-age:water-gun', name: 'Not the water gun', cost: 9, imageURL: '' }] } },
      proposals: { version: 7, totalBudget: 12, groups: [], groupRules: { 'dinosaur-age:row-lairs': { max: 2 } } }
    })
    const dupSource = copyGame(v5Source, join(WORK, 'dupsource', game))
    const dupSet = readGameSet(dupSource)
    dupSet.content.books = [...PLAN.pins, { name: 'dup', edition: 1 }]
    writeFileSync(join(dupSource, 'data', 'content.json'), serialize(dupSet.content))
    assert.throws(() => exportGame({ game, sourceDir: dupSource, booksDir: dupExportShelf, outDir }), err => {
      assert.ok(err instanceof ExportRefusal)
      assert.deepEqual(err.problems.map(problem => problem.path), [
        'books["dup"].types.fieldsFor["basic:nope"]',
        'books["dinosaur-age"].things.things["basic:item"][0].id',
        'rules.groupRules["dinosaur-age:row-lairs"].max',
        'rules.totalBudget'
      ], 'the four §5.3 faults, by path')
      return true
    })
    // RE-AIMED (stage 4): the EXPORT TOOL never writes under a books folder — by the
    // rule, not by where the folder happens to sit. (It used to read "no tool ever",
    // which was a description of a project in which nothing could write a shelf at
    // all. The editor's book routes write one deliberately; what they must refuse is a
    // PINNED edition, and that sentence belongs to them.)
    assert.throws(() => exportOf({ outDir: join(expShelf, 'dinosaur-age', '9') }), /refusing to write .*the books folder/)
    assert.equal(treeHash(outDir), hKept, 'the previous export survives every one of them')
    assert.equal(treeHash(expShelf), shelfHash, 'and the shelf this export was given is untouched')
    ok('E13 refusals with a shelf: a pin the shelf cannot answer → "pins a book that is not on the shelf: dinosaur-age 3"; the §5.3 shelf → refused with the four fault paths; --out inside the books folder → the guard sentence, so the EXPORT tool is not a door onto a shelf; the previous export and the shelf survive all three')
  }
}

// ═════════════ the v7 stamp over the committed games: A5, B7 (once) ═════════════
// The v6 → v7 step is a PURE STAMP WITH NO BODY: `demands` is born ABSENT, so
// "this entry demands nothing" is spelled by the key not being there and there is
// nothing for a migration to write. These two checks say that about the bytes that
// are actually in git, over BOTH games at once, rather than about a fixture.
{
  const climbedGames = ['dino', 'vampire'].map(name => {
    const gameFiles = `${DINO_IN_REPO}/games/${name}/data`
    const rawV6 = deepFreeze(Object.fromEntries(FILES.map(file => [file, JSON.parse(gitShow(V6_COMMIT, `${gameFiles}/${file}.json`))])))
    const wasVersion = rawV6.content.version
    const climbed = migrateSet(rawV6)
    assert.equal(serialize(climbed), serialize(migrateSet(rawV6)), `${name}: two climbs to v7 are byte-identical`)
    FILES.forEach(file => assert.equal(climbed[file].version, 7, `${name}: ${file}.json stamped 7`))
    assert.ok(sameSet(uuidsIn(serialize(climbed)), uuidsIn(serialize(rawV6))), `${name}: no uuid minted, none lost`)
    if (wasVersion === 6) assert.equal(serialize(climbed), serialize(Object.fromEntries(FILES.map(file => [file, { ...rawV6[file], version: 7 }]))),
      `${name}: byte-equal to a literal that is the committed bytes plus five version lines, and nothing else`)
    assert.equal(serialize(climbed).includes('"demands"'), false, `${name}: not one \`demands\` key is invented`)
    assert.deepEqual(validateGame({ own: climbed, books: climbed.content.books.map(pin => readBookSync(REAL_BOOKS, pin)) }), [], `${name}: and it fits the v7 contract`)
    return `${name} v${wasVersion}`
  })
  ok(`A5 v6 → v7 over the COMMITTED files (${climbedGames.join(', ')}): each climbs twice byte-identically and mint-free, the v6 one byte-equal to a literal that is its own committed bytes plus five version lines and nothing else; no \`demands\` key is invented anywhere, and both fit the v7 contract`)

  // ── B7 canonical v7 shapes ──
  // Where the new key SITS when a thing has one, and — the rule that matters more —
  // where it is never written: the file carries no no-op, so a thing that demands
  // nothing carries no `demands` key and `"demands": []` appears nowhere at all.
  const dinoDisk = readGameSet(join(DINO_DIR, 'games', 'dino'))
  const dinoMerged = flattenGame({ books: dinoDisk.content.books.map(pin => readBookSync(REAL_BOOKS, pin)), game: dinoDisk })
  const character = dinoMerged.types.types.find(type => type.id === 'basic:character')
  const order = ['id', ...thingKeys(character)]
  assert.equal(order.indexOf('demands'), 4, 'the canonical thing order puts demands FIFTH: id, name, cost, imageURL, demands')
  const pet = dinoDisk.things.things['basic:character'][0]
  // written exactly the way dinoEdit writes a thing — the sheet's own walk — with one
  // demand added to a REAL committed pet
  const demanding = Object.fromEntries(order.filter(key => key === 'demands' || key in pet)
    .map(key => [key, key === 'demands' ? [{ field: 'basic:character.origin', op: 'any', value: '' }] : pet[key]]))
  assert.deepEqual(Object.keys(demanding).slice(0, 5), ['id', 'name', 'cost', 'imageURL', 'demands'])
  assert.deepEqual(Object.keys(demanding).filter(key => key !== 'demands'), order.filter(key => key !== 'demands' && key in pet), 'and every other key of the real pet is still there, in the same walk')
  assert.deepEqual(Object.keys(demanding.demands[0]), ['field', 'op', 'value'], 'a demand\'s own three keys, in query.where\'s order')
  assert.equal(serialize(demanding).split('\n')[5], '  "demands": [', 'and on disk, 2-space indented, on the fifth line')
  // the committed bytes of both games: canonical spelling, no `demands` anywhere, and
  // nothing moved since the previous edition but the version line
  let files = 0
  ;['dino', 'vampire'].forEach(name => FILES.forEach(file => {
    const path = join(DINO_DIR, 'games', name, 'data', `${file}.json`)
    const text = readFileSync(path, 'utf8')
    assert.equal(text, serialize(JSON.parse(text)), `games/${name}/data/${file}.json is 2-space + trailing newline`)
    assert.equal(text.includes('"demands"'), false, `games/${name}/data/${file}.json carries no demands key at all`)
    const committed = gitShow(V6_COMMIT, `${DINO_IN_REPO}/games/${name}/data/${file}.json`)
    const wasVersion = JSON.parse(committed).version
    assert.equal(text.replace(`"version": ${SCHEMA_VERSION}`, `"version": ${wasVersion}`), committed, `games/${name}/data/${file}.json: the only byte that moved since ${V6_COMMIT} is the stamp`)
    files += 1
  }))
  // and nowhere on the shelf either — so `"demands": []` is spelled by NO file in the project
  listFiles(REAL_BOOKS).filter(rel => rel.endsWith('.json')).forEach(rel =>
    assert.equal(readFileSync(join(REAL_BOOKS, rel), 'utf8').includes('"demands"'), false, `books/${rel} carries no demands key`))
  ok(`B7 canonical v7 shapes: on a thing that has one, \`demands\` is the FIFTH key and its own three are field, op, value in query.where's order, 2-space indented on the fifth line; and across ${files} committed game files and the whole shelf there is no \`demands\` key at all — so the no-op \`"demands": []\` is spelled by no file in the project — every one canonical and differing from ${V6_COMMIT} in its version line ONLY`)
}

// ═════════════════ the bridge to the v5 world: C6, C7 (once) ═════════════════
// C1, C2 and C5 ask "does today's engine still play what the v2/v3/v4 engines
// played?". C6 asks the same question of the engine one commit back — the last
// engine before the player had a sheet — and C7 asks the one question this whole
// stage has to be able to answer with a straight face: is the game that builds
// NO sheet byte-for-byte the game it was?
{
  const committedGame = (name) => writeGame(join(WORK, 'committed', name),
    Object.fromEntries(FILES.map(file => [file, JSON.parse(gitShow(V5_COMMIT, `${DINO_IN_REPO}/games/${name}/data/${file}.json`))])))

  // ── C6 the bridge that IS S6 ──
  // The v5 engine and the v5 SHELF travel together: a v5 engine reads v5 books,
  // and re-stamping the shelf is the ceremony a version bump costs (§4.2). Said
  // out loud: a v6 row carries three more keys than a v5 one, so `summarize`
  // goes on projecting only what BOTH engines produce — exactly as it already
  // does for `query` and `displayType`.
  const bridged = ['dino', 'vampire'].map(name => {
    const dir = committedGame(name)
    const before = hydrate(v5PrevEngineDir, dir, v5PrevBooksDir)
    const after = hydrate(v5EngineDir, dir, REAL_BOOKS)
    assert.deepEqual(before.warnings, [], `${name}: the v5 engine warned over the committed data`)
    assert.deepEqual(after.warnings, [], `${name}: the v6 engine warned over the committed data`)
    assert.deepEqual(after.groups, before.groups, `${name}: the v6 engine plays what the v5 engine played`)
    assert.deepEqual(after.fetched, before.fetched, `${name}: and asks for the same files, in the same order`)
    assert.equal(after.totalBudget, before.totalBudget, `${name}: for the same budget`)
    return { name, rows: countGroups(after.groups), items: countItems(after.groups) }
  })
  // and the four steps of I1, replayed through both engines over the committed
  // dino: the same snapshots, `sheet` and `kept` null on both sides (the v5
  // engine has no such getter; the committed game declares no sheet)
  const committedDino = join(WORK, 'committed', 'dino')
  const bridgeSteps = [
    { row: REBUILT.rows.lair, thing: REBUILT.things.lavaPit },
    { row: REBUILT.rows.location, thing: REBUILT.things.volcanoRim },
    { row: REBUILT.rows.lair, thing: REBUILT.things.lavaPit },
    { row: REBUILT.rows.location, thing: REBUILT.things.volcanoRim }
  ]
  const playedBefore = play(v5PrevEngineDir, committedDino, bridgeSteps, v5PrevBooksDir)
  const playedAfter = play(v5EngineDir, committedDino, bridgeSteps, REAL_BOOKS)
  assert.deepEqual(playedAfter, playedBefore, 'four steps, two engines, one answer — whole snapshots')
  assert.deepEqual(playedAfter.steps.map(step => [step.sheet, step.kept]), Array(4).fill([null, null]), 'a game that declares no sheet builds none, under either engine')
  ok(`C6 the bridge to the v5 engine (git ${V5_COMMIT}) and the v5 shelf: ${bridged.map(each => `${each.name} ${each.rows} rows / ${each.items} items`).join(', ')}, no warnings on either side, the same urls in the same order, project-equal hydrations; and I1's four steps replay through both engines to deep-equal snapshots with sheet and kept null throughout`)

  // ── C7 vampire is untouched ──
  // games/vampire is the proof that a v4, book-less, sheet-less game still plays.
  // Not one byte of it may move — not the version line — so this check reads the
  // WORKING TREE and compares it to git before it plays it.
  const vampireDir = join(DINO_DIR, 'games', 'vampire')
  FILES.forEach(name => assert.equal(readFileSync(join(vampireDir, 'data', `${name}.json`), 'utf8'), gitShow(V5_COMMIT, `${DINO_IN_REPO}/games/vampire/data/${name}.json`), `games/vampire/data/${name}.json is byte-identical to ${V5_COMMIT}`))
  const vampire = hydrate(v5EngineDir, vampireDir)
  assert.deepEqual(vampire.warnings, [], 'zero warnings')
  assert.equal(vampire.playerSheet, null, 'this game is a menu, not a sheet — and saying so is not a fault')
  assert.deepEqual([...new Set(vampire.bindings.map(row => row.fills))], [null], 'every row is a plain picker')
  assert.deepEqual([...new Set(vampire.bindings.map(row => row.quantityField))], [null], 'and nothing multiplies')
  assert.deepEqual(vampire.fetched, FILES.map(name => `data/${name}.json`), 'five data urls and nothing else — no shelf, no book')
  const firstRow = vampire.bindings.find(row => row.items > 0)
  const played = playFully(v5EngineDir, vampireDir, [{ row: firstRow.id, thing: flatSummary(vampire.groups).find(row => row.id === firstRow.id).items[0].id }])
  assert.deepEqual(played.steps.map(step => [step.sheet, step.kept]), [[null, null]], 'sheet and kept are null in the snapshot')
  assert.deepEqual(played.final.typed, {}, 'a game that builds no sheet types nothing')
  assert.equal(played.final.notice, null)
  assert.deepEqual(played.warnings, [])
  ok(`C7 vampire is untouched: its five data files byte-equal ${V5_COMMIT}; under the v6 engine it hydrates with zero warnings, playerSheet null, every one of its ${vampire.bindings.length} rows a plain picker with no quantity field, five data urls and nothing else; a pick leaves sheet and kept null and the typed half {}`)

  // ── C8 the bridge to v6, and vampire under the v7 engine (NEW) ──
  // The v7 step is a STAMP. That is a claim about behaviour, not about bytes, and
  // this is where it is cashed: the REAL v6 engine (git) and today's engine hydrate
  // and PLAY the committed data alike, with no named difference anywhere. Then the
  // one question a stage that adds a rule to entries must answer with a straight
  // face — is the game that has no sheet and no demand exactly the game it was?
  {
    const committedAt = (commit, name) => writeGame(join(WORK, 'committed-v6', name),
      Object.fromEntries(FILES.map(file => [file, JSON.parse(gitShow(commit, `${DINO_IN_REPO}/games/${name}/data/${file}.json`))])))
    const bridgedV6 = ['dino', 'vampire'].map(name => {
      const dir = committedAt(V6_COMMIT, name)
      const before = hydrate(v6PrevEngineDir, dir, v6PrevBooksDir)
      const after = hydrate(v5EngineDir, dir, REAL_BOOKS)
      assert.deepEqual(before.warnings, [], `${name}: the v6 engine warned over the committed v6 data`)
      assert.deepEqual(after.warnings, [], `${name}: the v7 engine warned over the same data`)
      // the v7 engine hangs `demands` on every hydrated item (always an array, so no
      // caller downstream ever writes `?? []`), and that is the ONE named difference
      // the two engines have — so it is stripped here and asserted separately, exactly
      // as `showWhen` and `displayType` were stripped for the older bridges.
      const strip = (rows) => rows.map(row => ({ ...row, items: row.items.map(({ demands, ...rest }) => rest), children: strip(row.children) }))
      assert.deepEqual(strip(after.groups), strip(before.groups), `${name}: the v7 engine plays what the v6 engine played`)
      assert.deepEqual(after.groups, before.groups, `${name}: and the projection never carried demands anyway, so the two are equal untouched`)
      assert.deepEqual(after.fetched, before.fetched, `${name}: the same files, in the same order`)
      assert.deepEqual(after.playerSheet, before.playerSheet, `${name}: the same sheet (or the same none)`)
      assert.deepEqual(after.bindings, before.bindings, `${name}: the same bindings, the same item counts`)
      assert.equal(after.totalBudget, before.totalBudget)
      return { name, rows: countGroups(after.groups), items: countItems(after.groups) }
    })
    // …and they PLAY alike: §2.6's fifteen steps through both engines, whole snapshots
    const v6Dino = join(WORK, 'committed-v6', 'dino')
    const beforePlay = play(v6PrevEngineDir, v6Dino, PLAY_STEPS, v6PrevBooksDir)
    const afterPlay = play(v5EngineDir, v6Dino, PLAY_STEPS, REAL_BOOKS)
    assert.deepEqual(afterPlay, beforePlay, 'fifteen steps, two engines, one answer — no named difference at all')

    // vampire, the v4 proof, under the v7 engine
    const vampireDir = join(DINO_DIR, 'games', 'vampire')
    const v4Vampire = hydrate(v5EngineDir, vampireDir)
    assert.deepEqual(v4Vampire.warnings, [], 'zero warnings: a v4 game reaches no line of the new code')
    assert.equal(v4Vampire.playerSheet, null, 'no sheet…')
    assert.equal(readFileSync(join(vampireDir, 'data', 'things.json'), 'utf8').includes('"demands"'), false, '…and no demands key anywhere in its bytes')
    flatSummary(v4Vampire.groups).forEach(row => row.items.forEach(item => assert.equal(item.demands, undefined, `${item.name}: summarize does not carry demands`)))
    const vampirePlay = playFully(v5EngineDir, vampireDir, [{ row: flatSummary(v4Vampire.groups).find(row => row.items.length > 0).id, thing: flatSummary(v4Vampire.groups).find(row => row.items.length > 0).items[0].id }])
    assert.deepEqual(vampirePlay.warnings, [])
    assert.deepEqual(vampirePlay.steps.map(step => [step.sheet, step.kept]), [[null, null]], 'and a pick still leaves sheet and kept null — whyNot with no sheet returns null, through this very door')
    ok(`C8 the bridge to the v6 engine (git ${V6_COMMIT}): ${bridgedV6.map(each => `${each.name} ${each.rows} rows / ${each.items} items`).join(', ')} hydrate identically under both engines and §2.6's fifteen steps replay to deep-equal snapshots — a stamp-only migration changed NOTHING; and the committed v4 vampire under the v7 engine warns zero times, builds no sheet, carries no demands key, and still plays a pick through the guarded door`)
  }
}

// ═════════════════════ the manager: M1–M7 ═════════════════════
// ONE server over a root holding EVERY game of this run, plus three folders
// planted to be listed loudly or skipped, and a scratch SHELF. Nothing here
// reads the real games/ or dist/, and the real books/ is only ever COPIED: ROOT
// is a scratch copy and DIST does not even exist yet — the export route has to
// make it. Every game name travels in the URL.
{
  const ROOT = join(WORK, 'manager'), DIST = join(WORK, 'manager-dist')   // DIST does not exist yet: the route must make it
  const SHELF = copyShelf(join(WORK, 'manager-shelf', 'books'))
  games.forEach(g => copyGame(v5Sources[g], join(ROOT, g)))
  mkdirSync(join(ROOT, 'Bad Name', 'data'), { recursive: true })          // a folder the rule refuses
  mkdirSync(join(ROOT, 'hollow'))                                          // a folder with no data
  mkdirSync(join(ROOT, '.hidden'))                                         // a dot-folder: skipped
  writeFileSync(join(ROOT, 'README.txt'), 'not a folder\n')                // a file: skipped
  const engineIndex = readFileSync(join(v5EngineDir, 'index.html'), 'utf8')
  const { origin, stop } = await startServer(ROOT, DIST, SHELF)
  try {
    const at = (path) => get(`${origin}${path}`)                            // a GET of one path on THIS server
    const call = (path, init) => api(origin, path, init)                    // one API call on THIS server
    const FACT_KEYS = ['name', 'title', 'version', 'books', 'rows', 'types', 'things', 'faults', 'exported']
    // the facts the list must show for a game folder, read from that folder AND
    // its shelf: the counts are the MERGED ones — what a player can actually see
    const factsOf = (name, dir) => {
      const own = readGameSet(dir)
      const merged = mergeLayers({ books: (own.content.books ?? []).map(pin => readBookSync(SHELF, pin)), game: own })
      return {
        name, title: own.content.meta.pageTitle, version: SCHEMA_VERSION, books: merged.order,
        rows: countGroups(merged.set.content.groups), types: merged.set.types.types.length,
        things: Object.values(merged.set.things.things).flat().length, faults: merged.faults.length, exported: false
      }
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
      assert.deepEqual(facts, factsOf(g, join(ROOT, g)), `${g}: the MERGED facts`)
      assert.equal(facts.faults, 0, `${g}: nothing on the way is broken`)
    })
    if (games.includes('dino')) {
      assert.deepEqual(cardOf(list1.body.games, 'dino').books, ['basic 1', 'stats 1', 'dinosaur-age 1'], 'dino lists its three books in LAYER order')
      assert.deepEqual([cardOf(list1.body.games, 'dino').rows, cardOf(list1.body.games, 'dino').things], [4, 33], 'and counts what plays: the four proposed rows, the merged shelf')
    }
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
    // a game that pins a book the shelf cannot answer still LISTS — loudly
    const lost = copyGame(v5Sources[games[0]], join(ROOT, 'lost-pin'))
    const lostSet = readGameSet(lost)
    lostSet.content.books = [...lostSet.content.books, { name: 'nope', edition: 3 }]
    writeFileSync(join(lost, 'data', 'content.json'), serialize(lostSet.content))
    assert.equal(cardOf(await listed(), 'lost-pin').faults, 1, 'a pin the shelf cannot answer reaches the home screen as faults > 0')
    rmSync(lost, { recursive: true })
    ok(`M1 GET /api/games: ${list1.body.games.length} folders listed, sorted; ${games.join(' and ')} with title, version ${SCHEMA_VERSION}, the books that survived, MERGED counts and faults 0; "Bad Name" → rename the folder; hollow → ENOENT; a "{" content.json → cannot be read; a pin off the shelf → faults 1; dot-folder and file skipped`)

    // ── M2 addresses: the manager is the door, the engine plays under /games/<name>/ page-relative ──
    const root = await at('/')
    assert.deepEqual([root.status, root.location], [302, '/dinoEdit/'], '/ → the editor')
    const bare = await at('/dinoEdit')
    assert.deepEqual([bare.status, bare.location], [302, '/dinoEdit/'])
    assert.equal((await at('/dinoEdit/')).text, readFileSync(join(DINO_DIR, 'dinoEdit', 'index.html'), 'utf8'), '/dinoEdit/ is the editor page')
    assert.equal((await at('/config/validate.js')).status, 200, 'the editor\'s absolute /config/*.js imports still answer')
    assert.equal((await at('/config/merge.js')).status, 200, 'merge.js among them')
    assert.equal((await at('/dinoEdit/books.js')).status, 200, 'and the editor\'s OWN books.js is not mistaken for a shelf url')
    assert.equal((await at('/data/content.json')).status, 404, 'the old absolute /data/ is dead')
    assert.equal((await at('/assets/heroBG.jpg')).status, 404, 'the old absolute /assets/ is dead')
    assert.equal((await at('/games/')).status, 404)
    const engineModules = listFiles(v5EngineDir).filter(notDot).filter(path => path.endsWith('.js'))
    for (const g of games) {
      const noSlash = await at(`/games/${g}`)
      assert.deepEqual([noSlash.status, noSlash.location], [302, `/games/${g}/`], `/games/${g} → the slash form (page-relative paths need it)`)
      assert.equal((await at(`/games/${g}/`)).text, engineIndex, `/games/${g}/ is engine/index.html`)
      const base = `${origin}/games/${g}/index.html`
      for (const [, attr] of engineIndex.matchAll(/(?:href|src)="([^"]+)"/g)) assert.equal(await fetchStatus(new URL(attr, base)), 200, `${attr} from index.html under /games/${g}/`)
      for (const rel of engineModules) {
        const moduleURL = new URL(rel, base)
        for (const [, spec] of readFileSync(join(v5EngineDir, rel), 'utf8').matchAll(/^\s*(?:import|export)[^'"\n]*from\s+['"]([^'"]+)['"]/gm)) assert.equal(await fetchStatus(new URL(spec, moduleURL)), 200, `${spec} from ${rel} under /games/${g}/`)
      }
      const http = await hydrateHTTP(v5EngineDir, base)
      assert.deepEqual(http.warnings, [], `${g}: no warnings over HTTP`)
      assert.deepEqual(project(http.groups), project(hydrate(v5EngineDir, join(ROOT, g), SHELF).groups), `${g}: over HTTP the game plays like the folder`)
      assert.ok(http.fetched.every(url => url.startsWith('data/') || url.startsWith('books/')), `page-relative fetches: ${http.fetched.join(' ')}`)
      assert.equal((await at(`/games/${g}/data/content.json`)).text, readFileSync(join(ROOT, g, 'data', 'content.json'), 'utf8'), `${g}: data/content.json is the bytes on disk`)
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await raw(origin, `/games/${g}/${rel}`)
        assert.equal(res.status, 200, `${g}: ${rel}`)
        assert.ok(res.length > 0, `${g}: ${rel} whole file`)
      }
    }
    ok(`M2 addresses: / and /dinoEdit → /dinoEdit/; /config/ alive (merge.js included), /dinoEdit/books.js is the editor's own, /data/ and /assets/ dead; /games/<g> → 302; /games/<g>/ = engine/index.html, every link and import 200, hydrates over HTTP page-relative with every image whole (${games.join(', ')})`)

    // ── M3 create: a newborn from the sheets, byte for byte, ON THE SHELF ──
    const born = await call('/api/games', { method: 'POST', body: { title: 'Space Pirates!' } })
    assert.deepEqual(born, { status: 201, body: { ok: true, name: 'space-pirates', title: 'Space Pirates!', books: [{ name: 'basic', edition: 1 }] } })
    const newborn = 'space-pirates', dir = join(ROOT, newborn)
    const seedPins = [{ name: 'basic', edition: 1 }]
    assert.deepEqual(listFiles(dir), FILES.map(name => `data/${name}.json`).sort(), 'five data files, nothing else')
    assert.ok(statSync(join(dir, 'assets')).isDirectory(), 'an assets/ folder')
    assert.equal(readdirSync(join(dir, 'assets')).length, 0, 'an EMPTY assets/ folder')
    assert.deepEqual(readGameText(dir), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Space Pirates!', seedPins)[name])])), 'the files are games.js\'s seed, pinned, in the server\'s on-disk format')
    const newSet = readGameSet(dir)
    assert.deepEqual(validateGame({ own: newSet, books: seedPins.map(pin => readBookSync(SHELF, pin)) }), [], 'the newborn fits, judged against the book it stands on')
    assert.equal(migrateSet(newSet), newSet, 'the newborn is already at SCHEMA_VERSION — the same object comes back')
    assert.equal(keysOf(newSet.content), 'version,meta,books,sheet,groups,rowOverrides')
    assert.equal(keysOf(newSet.rules), 'version,totalBudget,groupRules')
    assert.equal(keysOf(newSet.themes), 'version,page,groupThemes')
    assert.equal(keysOf(newSet.types), 'version,types,sectionsFor,fieldsFor')
    assert.equal(keysOf(newSet.things), 'version,things')
    const bornLocal = hydrate(v5EngineDir, dir, SHELF)
    assert.deepEqual([bornLocal.warnings, bornLocal.groups], [[], []], 'the engine hydrates the newborn: no warnings, no rows')
    const bornHTTP = await hydrateHTTP(v5EngineDir, `${origin}/games/${newborn}/index.html`)
    assert.deepEqual([bornHTTP.warnings, bornHTTP.groups], [[], []], 'and over HTTP')
    assert.deepEqual(cardOf(await listed(), newborn), { name: newborn, title: 'Space Pirates!', version: 7, books: ['basic 1'], rows: 0, types: 7, things: 0, faults: 0, exported: false }, 'the list shows the newborn on Basic: seven merged sheets, no rows')
    assert.deepEqual(await editorSave(origin, newborn, newSet), Array(5).fill(SAVED), 'a no-edit save: five 200s')
    assert.deepEqual(readGameText(dir), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Space Pirates!', seedPins)[name])])), 'a no-edit save of a newborn is byte-identical')
    // S3's add-a-type recipe on a newborn, BESIDE the books it already stands on
    const grown = structuredClone(newSet)
    const typeId = randomUUID(), sectionId = randomUUID(), fieldId = randomUUID(), thingId = randomUUID(), rowId = randomUUID()
    grown.types.types.push({ id: typeId, label: 'Pet', sections: [{ id: sectionId, key: 'identity', caption: 'Identity', kind: 'fields', fields: [{ id: fieldId, key: 'colour', caption: 'Colour', type: 'text' }] }] })
    grown.things.things[typeId] = [{ id: thingId, name: 'Rex', cost: 1, imageURL: '', colour: 'green' }]
    grown.content.groups.push({ id: rowId, label: 'Pets', query: { type: typeId, where: { field: fieldId, op: 'is', value: 'green' } }, showWhen: { kind: 'always' }, children: [] })
    grown.rules.groupRules[rowId] = { min: 1 }
    assert.deepEqual(validateGame({ own: grown, books: seedPins.map(pin => readBookSync(SHELF, pin)) }), [], 'the pre-flight passes the grown set')
    assert.deepEqual(await editorSave(origin, newborn, grown), Array(5).fill(SAVED), 'the first private type lands: five 200s')
    const grownResult = hydrate(v5EngineDir, dir, SHELF)
    assert.deepEqual(grownResult.warnings, [])
    assert.equal(countGroups(grownResult.groups), 1, 'one row')
    assert.equal(countItems(grownResult.groups), 1, 'one thing')
    assert.equal(hydrate(v5EngineDir, dir, SHELF).groups.length, 1)
    ok(`M3 POST /api/games "Space Pirates!" → 201 ${newborn} pinning basic 1: five seed files byte-equal to seedSet(title, pins), empty assets/; fits against its book; canonical key orders; hydrates clean over the folder and HTTP; listed 7 sheets / 0 rows / faults 0; no-edit save byte-identical; a private type + thing + row + slot lands beside the books`)

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
    assert.deepEqual(await call('/api/games', { method: 'POST', body: { title: ' Ünïcode Café ' } }), { status: 201, body: { ok: true, name: 'unicode-cafe', title: 'Ünïcode Café', books: [{ name: 'basic', edition: 1 }] } })
    ok(`M4 create refusals: ${refusals.length} bad bodies → 409 (repeat, same slug, ${games[0]}) or 400 at "title"; "{" → 400 Body is not valid JSON; PUT → not 201; /api/nope → 404 Unknown route; nothing written; " Ünïcode Café " → 201 unicode-cafe`)

    // ── M5 two games, one server: each saves in the editor's order, in isolation ──
    for (const g of games) {
      assert.deepEqual(await editorSave(origin, g, readGameSet(join(ROOT, g))), Array(5).fill(SAVED), `${g}: its own set lands`)
      assert.deepEqual(readGameText(join(ROOT, g)), readGameText(v5Sources[g]), `${g}: byte-identical to the source`)
    }
    let crossed = ''
    if (games.length >= 2) {
      const [a, b] = games
      const bBefore = readGameText(join(ROOT, b))
      const aSet = readGameSet(join(ROOT, a))
      const A2 = structuredClone(aSet)
      A2.themes.page.bodyBackground = '#123456'
      assert.deepEqual(await editorSave(origin, a, A2), Array(5).fill(SAVED), `${a}: an edit lands`)
      assert.equal(readFileSync(join(ROOT, a, 'data', 'themes.json'), 'utf8'), serialize(A2.themes), `${a}: the edit is on disk`)
      assert.deepEqual(readGameText(join(ROOT, b)), bBefore, `a save to ${a} never touches ${b}`)
      assert.deepEqual(await editorSave(origin, a, aSet), Array(5).fill(SAVED), `${a}: put back`)
      assert.deepEqual(readGameText(join(ROOT, a)), readGameText(v5Sources[a]), `${a}: back to the source bytes`)
      // the cross-post: b's content at a's route is checked against A's siblings — b's private types are not there
      const wrongGame = await post(origin, a, 'content', readGameSet(join(ROOT, b)).content)
      assert.equal(wrongGame.status, 400)
      // b's rows name b's private types, which a's types.json does not hold — and
      // b's content pins b's books, so a's own arrangement loses its shelf too
      assert.ok(wrongGame.body.problems.some(problem => /^content\.groups\[\d+\]\.query\.type$/.test(problem.path) && /shows a type that does not exist/.test(problem.message)), JSON.stringify(wrongGame.body.problems))
      assert.deepEqual(readGameText(join(ROOT, a)), readGameText(v5Sources[a]), `${a} unchanged by the refused cross-post`)
      crossed = `; ${b}'s content at ${a} → 400 (${a}'s siblings and shelf were read); a save to ${a} leaves ${b} untouched`
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
    const [firstGame] = games
    assert.deepEqual(await call(`/api/games/${firstGame}/save/nope`, { method: 'POST', body: {} }), { status: 404, body: { ok: false, error: 'Unknown save target' } })
    assert.deepEqual(await call(`/api/games/${firstGame}/nope`, { method: 'POST', body: {} }), { status: 404, body: { ok: false, error: 'Unknown route' } })
    assert.deepEqual(await call(`/api/games/${firstGame}/save/content`), { status: 404, body: { ok: false, error: 'Unknown route' } }, 'GET on the save route')
    assert.deepEqual(readdirSync(ROOT).sort(), foldersBefore, 'no unknown name made a folder')
    ok(`M5 two games, one server: ${games.join(' and ')} save in the editor's order, byte-identical${crossed}; ${unknown.length} unknown names → 404 on save, export, play and preview; bad target / bad route / GET → 404; nothing written`)

    // ── M6 export over HTTP + preview ──
    assert.equal((await at(`/dist/${firstGame}/`)).status, 404, 'nothing published yet — DIST does not exist')
    const exportedGames = [...games, newborn]
    for (const g of exportedGames) {
      const r = await call(`/api/games/${g}/export`, { method: 'POST' })
      assert.equal(r.status, 200, `${g}: ${JSON.stringify(r.body)}`)
      assert.deepEqual(Object.keys(r.body), ['ok', 'name', 'outDir', 'preview', 'files', 'rows', 'items'], 'the receipt\'s keys, in order')
      assert.equal(r.body.name, g)
      assert.equal(r.body.outDir, join(DIST, g))
      assert.equal(r.body.preview, `/dist/${g}/`)
      // the reference: the same tool, in-process, from the same source and the same shelf
      const reference = exportGame({ game: g, sourceDir: join(ROOT, g), outDir: join(WORK, 'manager-ref', g), booksDir: SHELF })
      assert.equal(treeHash(join(DIST, g)), treeHash(reference.outDir), `${g}: the route wrote exactly exportGame's bytes, manifest included`)
      assert.deepEqual({ rows: r.body.rows, items: r.body.items, files: r.body.files }, { rows: reference.manifest.rows, items: reference.manifest.items, files: Object.keys(reference.manifest.files).length }, `${g}: the receipt's counts`)
      const noSlash = await at(`/dist/${g}`)
      assert.deepEqual([noSlash.status, noSlash.location], [302, `/dist/${g}/`])
      assert.equal((await at(`/dist/${g}/`)).text, readFileSync(join(DIST, g, 'index.html'), 'utf8'), `${g}: /dist/${g}/ is the folder's own index.html`)
      const http = await hydrateHTTP(join(DIST, g), `${origin}/dist/${g}/index.html`)
      assert.deepEqual(http.warnings, [], `${g}: the published folder hydrates clean`)
      assert.deepEqual(project(http.groups), project(hydrate(v5EngineDir, join(ROOT, g), SHELF).groups), `${g}: and plays like the game folder`)
      assert.ok(http.fetched.every(url => url.startsWith('data/')), `${g}: the published folder never asks for a shelf: ${http.fetched.join(' ')}`)
      for (const rel of [...new Set(imagesOf(http.groups)), http.heroImage].filter(Boolean)) {
        const res = await raw(origin, `/dist/${g}/${rel}`)
        assert.equal(res.status, 200, `${g}: ${rel} under /dist/`)
        assert.ok(res.length > 0, `${g}: ${rel} whole file`)
      }
      assert.equal((await at(`/dist/${g}/app.js`)).status, 200, `${g}: the folder's own app.js`)
      assert.equal((await at(`/dist/${g}/nope.js`)).status, 404, `${g}: a file the folder lacks`)
      assert.equal((await at(`/dist/${g}/config/gameConfig.js`)).text, readFileSync(join(DIST, g, 'config', 'gameConfig.js'), 'utf8'), `${g}: config/gameConfig.js is the folder's copy`)
    }
    const afterExport = await listed()
    exportedGames.forEach(g => assert.equal(cardOf(afterExport, g).exported, true, `${g}: the list says exported`))
    assert.equal(cardOf(afterExport, 'unicode-cafe').exported, false, 'a game never exported still says so')
    // a refusal: the source is refused before dist/ is touched, so the previous export survives
    const h = treeHash(join(DIST, firstGame))
    const firstContentText = readFileSync(join(ROOT, firstGame, 'data', 'content.json'), 'utf8')
    const danglingContent = JSON.parse(firstContentText)
    danglingContent.groups.push({ id: 'm6-row', label: 'M6', query: { type: '', where: null }, showWhen: { kind: 'anyInRow', row: 'no-such-row' }, children: [] })
    writeFileSync(join(ROOT, firstGame, 'data', 'content.json'), serialize(danglingContent))
    const refused = await call(`/api/games/${firstGame}/export`, { method: 'POST' })
    assert.equal(refused.status, 400)
    assert.equal(refused.body.ok, false)
    assert.match(refused.body.error, /does not fit the schema \(1 problem/)
    assert.match(refused.body.problems[0].path, /^content\.groups\[\d+\]\.showWhen$/)
    assert.equal(refused.body.problems[0].message, 'show-when names a row that does not exist (no-such-row)')
    assert.equal(treeHash(join(DIST, firstGame)), h, 'the previous export survives the refusal')
    writeFileSync(join(ROOT, firstGame, 'data', 'content.json'), firstContentText)
    // the newborn, grown in M3, publishes too
    const bornExport = await call(`/api/games/${newborn}/export`, { method: 'POST' })
    assert.deepEqual([bornExport.status, bornExport.body.rows, bornExport.body.items], [200, 1, 1], 'the newborn exports with its one row and one thing')
    ok(`M6 export + /dist/: ${exportedGames.join(', ')} → 200 with exportGame's exact bytes and counts; /dist/<g> → 302; /dist/<g>/ hydrates from the folder alone (no book url), every image whole, no engine fallback; the list says exported; a dangling gate → 400 at its merged path and the old export survives; the newborn exports 1 row, 1 thing`)

    // ── M7 traversal and case ──
    // RE-AIMED (stage 4): the shelf clause below used to compare this scratch shelf
    // against a FRESH COPY of the real one, which asserted "nothing in the whole
    // manager block has ever written a shelf" — true only because no route could, and
    // a claim M12 makes properly. What M7 means is narrower and permanent: NO PROBE
    // WRITES. So the baseline is taken here, a line before the probes, and the same
    // shelf is compared against itself — which stays exactly as strong the day a
    // create-book route legitimately writes this shelf earlier in the block.
    const filesBefore = listFiles(ROOT)
    const shelfBeforeProbes = treeHash(SHELF)
    const probes = [
      `/games/../server/server.js`,
      `/games/%2e%2e/server/server.js`,
      `/games/${firstGame}/../../server/server.js`,
      `/games/${firstGame}/data/../../../server/server.js`,
      ...(games.length >= 2 ? [`/games/${firstGame}/data/../../${games[1]}/data/content.json`] : []),
      `/dist/../games/${firstGame}/data/content.json`,
      `/dist/${firstGame}/../../server/server.js`,
      `/dinoEdit/../server/server.js`,
      `/games/Dino/`,
      `/games/dino%2F..%2F/`,
      `/games/${firstGame}/assets/../data/content.json`,
      `/games/${firstGame}/books/../../../server/server.js`,
      `/books/basic/1/assets/../../../../server/server.js`
    ]
    for (const path of probes) {
      const { status, text } = await raw(origin, path)
      assert.ok([403, 404].includes(status), `${path} → ${status}`)
      assert.ok(!text.includes('createServer') && !text.includes('"version"'), `${path}: never a server file, never a game's data`)
      if (/^\/(games|dist)\/(\.\.|%2e%2e|Dino|dino%2F\.\.%2F)\//.test(path)) assert.equal(text, 'No such CYOA', `${path}: refused by the name grammar, not by a missing file`)
    }
    assert.equal((await raw(origin, '/games/../server/server.js')).status, 404, '".." is not a game name')
    assert.equal((await raw(origin, '/dinoEdit/../server/server.js')).status, 403, 'the editor\'s guard')
    assert.equal((await raw(origin, `/games/${firstGame}/data/../../../server/server.js`)).status, 403, 'the game folder\'s guard')
    const posts = [
      `/api/games/../x/save/rules`,
      `/api/games/Dino/save/rules`,
      `/api/games/${firstGame}/save/../../x`,
      `/api/games/%2e%2e/export`,
      `/api/games/${firstGame}/export/../x`,
      `/books/basic/1/book.json`
    ]
    for (const path of posts) {
      const { status, text } = await raw(origin, path, 'POST', '{}')
      assert.ok([403, 404].includes(status), `POST ${path} → ${status}`)
      assert.ok(!text.includes('createServer'), `POST ${path}: never a server file`)
    }
    assert.deepEqual(listFiles(ROOT), filesBefore, 'no probe wrote a file')
    assert.equal(existsSync(join(DIST, 'server')), false, 'no probe made a folder under dist/')
    assert.equal(treeHash(SHELF), shelfBeforeProbes, 'and no probe moved a byte of the shelf the server was pointed at')
    ok(`M7 traversal and case: ${probes.length} literal GET probes and ${posts.length} POST probes over http.request → 403/404, never a server file or another game's data; nothing written, on the games root, under dist/ or on the shelf this server serves`)
  } finally {
    stop()
  }
}

// ═════════════════════ the newborn on a shelf: M10 (once) ═════════════════════
// "Books not given" means BUILD ON BASIC: the shelf's latest Basic if there is
// one, and nothing at all when the shelf is empty — so a newborn over an empty
// shelf is byte-for-byte the newborn v4 made.
{
  const ROOT = join(WORK, 'm10'), DIST = join(WORK, 'm10-dist')
  const SHELF = copyShelf(join(WORK, 'm10-shelf', 'books'))
  // a second edition of Basic: the same book, one number different
  cpSync(join(SHELF, 'basic', '1'), join(SHELF, 'basic', '2'), { recursive: true })
  writeFileSync(join(SHELF, 'basic', '2', 'book.json'), serialize({ ...JSON.parse(readFileSync(join(SHELF, 'basic', '1', 'book.json'), 'utf8')), edition: 2 }))
  mkdirSync(ROOT, { recursive: true })
  const { origin, stop } = await startServer(ROOT, DIST, SHELF)
  try {
    const born = await api(origin, '/api/games', { method: 'POST', body: { title: 'On Basic' } })
    assert.deepEqual(born, { status: 201, body: { ok: true, name: 'on-basic', title: 'On Basic', books: [{ name: 'basic', edition: 2 }] } }, 'the LATEST Basic is what a newborn stands on')
    assert.deepEqual(readGameSet(join(ROOT, 'on-basic')).content.books, [{ name: 'basic', edition: 2 }])
    assert.deepEqual(readGameText(join(ROOT, 'on-basic')), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('On Basic', [{ name: 'basic', edition: 2 }])[name])])), 'the seed, pinned, byte for byte')
    const http = await hydrateHTTP(v5EngineDir, `${origin}/games/on-basic/index.html`)
    assert.deepEqual([http.warnings, http.groups], [[], []], 'it hydrates clean over HTTP with no rows')
    const listed = (await api(origin, '/api/games')).body.games.find(g => g.name === 'on-basic')
    assert.deepEqual([listed.books, listed.types, listed.rows, listed.faults], [['basic 2'], 7, 0, 0], 'and the list says seven merged sheets, no rows, no faults')
    // books GIVEN are used as given
    assert.deepEqual(await api(origin, '/api/games', { method: 'POST', body: { title: 'No Books', books: [] } }), { status: 201, body: { ok: true, name: 'no-books', title: 'No Books', books: [] } })
    assert.deepEqual(readGameSet(join(ROOT, 'no-books')).content.books, [])
    assert.deepEqual(await api(origin, '/api/games', { method: 'POST', body: { title: 'Old Basic', books: [{ name: 'basic', edition: 1 }] } }), { status: 201, body: { ok: true, name: 'old-basic', title: 'Old Basic', books: [{ name: 'basic', edition: 1 }] } })
    // a pin the shelf cannot answer, and one that is not even shaped like a pin
    const missing = await api(origin, '/api/games', { method: 'POST', body: { title: 'Ghost', books: [{ name: 'basic', edition: 9 }] } })
    assert.equal(missing.status, 400)
    assert.deepEqual(missing.body.problems, [{ path: 'books[0]', message: '"basic" 9 is not on the shelf' }])
    const misshapen = await api(origin, '/api/games', { method: 'POST', body: { title: 'Ghost', books: [{ name: 'Basic', edition: 1 }] } })
    assert.equal(misshapen.status, 400)
    assert.equal(misshapen.body.problems[0].path, 'books[0].name')
    assert.match(misshapen.body.problems[0].message, /is not a book name/)
    assert.equal(existsSync(join(ROOT, 'ghost')), false, 'a refused create writes nothing')
  } finally { stop() }
  // over an EMPTY shelf the newborn is exactly the one v4 made
  const EMPTY = join(WORK, 'm10-empty', 'books')
  mkdirSync(EMPTY, { recursive: true })
  const bare = await startServer(join(WORK, 'm10b'), join(WORK, 'm10b-dist'), EMPTY)
  try {
    assert.deepEqual(await api(bare.origin, '/api/games', { method: 'POST', body: { title: 'Alone' } }), { status: 201, body: { ok: true, name: 'alone', title: 'Alone', books: [] } })
    assert.deepEqual(readGameText(join(WORK, 'm10b', 'alone')), Object.fromEntries(FILES.map(name => [name, serialize(seedSet('Alone')[name])])), 'the bytes are seedSet(title) — no shelf, no pins')
    ok('M10 the seed pins Basic: with basic 1 and 2 on the shelf a newborn pins basic 2 and the receipt says so; it hydrates clean with 7 merged sheets and 0 rows; books: [] is honoured; a pin off the shelf → 400 at books[0] and a mis-spelled name → 400 at books[0].name, nothing written; over an EMPTY shelf a newborn pins nothing and its five files are seedSet(title) exactly')
  } finally { bare.stop() }
}

// ═════════════════════ the shelf's listing: M11 (once) ═════════════════════
{
  const SHELF = copyShelf(join(WORK, 'm11-shelf', 'books'))
  mkdirSync(join(SHELF, 'Bad Name', '1'), { recursive: true })              // a folder the grammar refuses
  mkdirSync(join(SHELF, 'hollow', '1'), { recursive: true })                 // an edition with no book.json
  mkdirSync(join(SHELF, 'basic', 'one'), { recursive: true })                // an edition folder that is not an edition
  writeBook(SHELF, 'broken', 1, {                                            // a Stats-like book writing outside its namespace
    book: { name: 'broken', title: 'Broken', edition: 1, requires: [{ name: 'basic', edition: 1 }] },
    types: { version: 7, types: [], sectionsFor: {}, fieldsFor: { 'basic:character.attributes': [{ id: 'basic:strength', key: 'strength', caption: 'Strength', type: 'number', default: 10 }] } }
  })
  const { origin, stop } = await startServer(join(WORK, 'm11'), join(WORK, 'm11-dist'), SHELF)
  try {
    const answer = await api(origin, '/api/books')
    assert.equal(answer.status, 200)
    assert.deepEqual(Object.keys(answer.body), ['ok', 'books'], 'the response keys, in order')
    assert.equal(answer.body.ok, true)
    const books = answer.body.books
    assert.deepEqual(books.map(book => book.name), ['Bad Name', 'basic', 'broken', 'dinosaur-age', 'hollow', 'stats'], 'every folder, sorted by name')
    const bookOf = (name) => books.find(book => book.name === name)
    assert.deepEqual(Object.keys(bookOf('Bad Name')), ['name', 'error'])
    assert.match(bookOf('Bad Name').error, /lowercase letters, digits and single dashes — rename the folder/)
    assert.deepEqual(Object.keys(bookOf('basic')), ['name', 'title', 'editions'], 'a book entry: name, title, editions')
    assert.deepEqual(bookOf('basic').editions.map(edition => edition.edition), [1, 'one'], 'editions ascending, a mis-named folder last')
    assert.match(bookOf('basic').editions[1].error, /edition folders are positive integers — rename the folder/)
    const basicOne = bookOf('basic').editions[0]
    assert.deepEqual(Object.keys(basicOne), ['edition', 'title', 'requires', 'sheets', 'sectionsAdded', 'fieldsAdded', 'things', 'rows', 'budget', 'problems'], 'an edition entry, in order')
    assert.deepEqual([basicOne.title, basicOne.requires, basicOne.sheets, basicOne.fieldsAdded, basicOne.things, basicOne.rows, basicOne.budget, basicOne.problems], ['Basic', [], 7, 0, 0, 0, null, []])
    const statsOne = bookOf('stats').editions[0]
    assert.deepEqual([statsOne.sheets, statsOne.fieldsAdded, statsOne.problems], [0, 5, []], 'Stats adds five fields and defines no sheet')
    assert.deepEqual(statsOne.requires, [{ name: 'basic', edition: 1 }])
    const [da1, da2] = bookOf('dinosaur-age').editions
    assert.deepEqual([da1.edition, da1.fieldsAdded, da1.things, da1.rows, da1.budget, da1.problems], [1, 4, 23, 4, 10, []])
    assert.deepEqual([da2.edition, da2.things], [2, 24], 'edition 2 holds one more thing')
    assert.equal(bookOf('dinosaur-age').title, 'Dinosaur Age', 'the book\'s title is the latest readable edition\'s')
    assert.deepEqual(bookOf('hollow').editions[0], { edition: 1, error: 'book.json cannot be read (ENOENT)' })
    assert.deepEqual(bookOf('broken').editions[0].problems, [{ path: 'types.fieldsFor["basic:character.attributes"][0].id', message: '"basic:strength" is not in this book\'s namespace (broken:)' }], 'the broken edition carries its namespace problem, by path')
    assert.equal(bookOf('broken').editions[0].fieldsAdded, 1, 'and its facts are still counted')
    ok(`M11 GET /api/books: ${books.length} folders listed sorted by name, editions ascending with a mis-named folder last; the response keys ok, books; a book entry name, title, editions; an edition entry edition, title, requires, sheets, sectionsAdded, fieldsAdded, things, rows, budget, problems; Basic 7 sheets, Stats 5 additions, Dinosaur Age 23/24 things, 4 rows, budget 10; "Bad Name", hollow and a namespace violation each carry their own sentence`)
  } finally { stop() }
}

// ═════════════════════ R6 the id census over the REAL tree (NEW, stage 4) ═════════════════════
// THE THIRD SOURCE of the rename proof, and the one the fast half cannot hold: oracles-logic
// NEVER READS THE SHELF, so R1–R5 there are the hand-authored fixtures and the substitution
// over them. This is the same three questions asked of the REAL books/** and games/**, where
// 300-odd ids in five shapes actually live — including the one shape no fixture would have
// thought of (a v3→v4 migrated section id is `<the type's uuid>.identity`, a uuid with a
// dotted tail, and it was THIS census that found it: without the tail in the grammar below,
// eight vampire uuids survived a total rename).
//
// It READS ONLY. Nothing here writes anything anywhere — the subject is the committed tree,
// exactly as T1–T4's is, and M9/M12 hash games/ and books/ after the last check to say so.
//
// WHY IT IS SHAPED THIS WAY. All three design judges found every proposed rename proof
// VACUOUS, because each generated its fixture from the same tables the walker reads, so a
// wrong marker passed with the fixture agreeing. The two halves below are independent of
// those tables by construction:
//   (a) a SHAPE CENSUS — "which strings LOOK like an id, and where do they sit?" — written
//       with two regexes typed out here and no reference whatever to MINTS, QUERY_IDS,
//       GATES, SHEETS or any file table. Every path it finds must be a path eachId reaches.
//   (c) TEXTUAL SUBSTITUTION — rename every id the census found to a fresh token, serialise,
//       and assert the old string survives nowhere in the bytes. That catches a missed
//       position WITHOUT knowing where positions are.
//   plus ROUND TRIP (A→B→A is byte-identical, key order included) and the ANTI-VACUITY pass
//   that breaks a marker in memory and asserts this very check goes red.
// The census's grammar is asserted to BE schema.js's BOOK_ID at the very end — said last, on
// purpose, so the census never read the thing it is being compared with.
{
  const NAMESPACED = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[.-][a-z0-9]+)*$/
  const UUID_ID    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-z0-9]+(?:[.-][a-z0-9]+)*)*$/
  const idShaped   = (value) => typeof value === 'string' && (NAMESPACED.test(value) || UUID_ID.test(value))
  // validate.js's own `at` rule and one spelling for a path, retyped rather than imported
  const at   = (path, key) => /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`
  const norm = (path) => path.replace(/\["([A-Za-z_$][\w$]*)"\]/g, '.$1')
  const censusOf = (root, value) => {
    const found = []
    const walk = (path, node) => {
      if (typeof node === 'string') { if (idShaped(node)) found.push({ path: norm(path), id: node }); return }
      if (Array.isArray(node)) { node.forEach((item, i) => walk(`${path}[${i}]`, item)); return }
      if (node !== null && typeof node === 'object') Object.entries(node).forEach(([key, item]) => {
        const here = at(path, key)
        if (idShaped(key)) found.push({ path: norm(here), id: key })            // the KEY itself is an id
        walk(here, item)
      })
    }
    walk(root, value)
    return found
  }
  const censusAll = (files) => Object.entries(files).flatMap(([name, file]) => file === null || file === undefined ? [] : censusOf(name, file))

  // ── the real tree, read with fs and nothing else ──
  const maybeJSON = (path) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
  const dirsIn = (dir) => existsSync(dir) ? readdirSync(dir).filter(name => !name.startsWith('.') && statSync(join(dir, name)).isDirectory()).sort() : []
  const shelf = {}
  dirsIn(REAL_BOOKS).forEach(name => dirsIn(join(REAL_BOOKS, name)).forEach(edition => {
    const dir = join(REAL_BOOKS, name, edition)
    ;(shelf[name] ??= {})[edition] = { pin: { name, edition: Number(edition) }, manifest: maybeJSON(join(dir, 'book.json')),
      types: maybeJSON(join(dir, 'types.json')), things: maybeJSON(join(dir, 'things.json')), proposals: maybeJSON(join(dir, 'proposals.json')) }
  }))
  // a SUBJECT is one thing eachId can be asked about: its files, the table that shapes them,
  // and the MERGED types that are its phonebook (which of a thing's keys hold placements, and
  // whether a demand's value is a thing id, are the only two questions that need one).
  const subjects = []
  dirsIn(join(DINO_DIR, 'games')).forEach(name => {
    const data = join(DINO_DIR, 'games', name, 'data')
    if (!existsSync(join(data, 'content.json'))) return
    const raw = Object.fromEntries(FILES.map(file => [file, maybeJSON(join(data, `${file}.json`))]))
    if (FILES.some(file => raw[file] === null)) return                          // a game that is not all five files is not this check's subject
    // a file below SCHEMA_VERSION is migrated first, because that is what EVERY reader of it
    // does at the border (loadData, the editor, the export) — the rewriter never meets v4 bytes
    const files = raw.content.version === SCHEMA_VERSION ? raw : migrateSet(structuredClone(raw))
    const pins = (files.content.books ?? []).map(pin => shelf[pin.name]?.[pin.edition] ?? null)
    subjects.push({ what: `games/${name}`, files, fileSheets: FILE_SHEETS, types: mergeLayers({ books: pins, game: files }).set.types.types })
  })
  Object.entries(shelf).forEach(([name, editions]) => Object.entries(editions).forEach(([edition, layer]) => {
    const required = (layer.manifest?.requires ?? []).map(pin => shelf[pin.name]?.[pin.edition] ?? null)
    subjects.push({ what: `books/${name}/${edition}`, fileSheets: BOOK_FILE_SHEETS,
      files: { book: layer.manifest, types: layer.types, things: layer.things, proposals: layer.proposals },
      types: mergeLayers({ books: [...required, layer], game: null }).set.types.types })
  }))
  assert.ok(subjects.length >= 6, `the real tree gave this check something to walk (${subjects.length} subjects)`)

  // ── (a) the census: every id-shaped string sits where eachId reaches ──
  const proveCensus = () => {
    let censused = 0, positions = 0
    const unreachable = []
    subjects.forEach(subject => {
      const seen = []
      const answer = eachId(subject.files, subject.types, (position) => seen.push(norm(position.path)), subject.fileSheets)
      const reached = new Set(seen)
      positions += seen.length
      assert.deepEqual(answer.unknownSheets, [], `${subject.what}: every things bucket's sheet is in the merged types`)
      censusAll(subject.files).forEach(({ path, id }) => {
        censused += 1
        if (!reached.has(path)) unreachable.push(`${subject.what}  ${path} = ${JSON.stringify(id)}`)
      })
    })
    assert.deepEqual(unreachable, [], `every id-shaped string on disk sits at a position eachId reaches:\n${unreachable.join('\n')}`)
    assert.ok(censused > 200, `the census found enough to be a census (${censused})`)
    return { censused, positions }
  }
  // ── (c) textual substitution, and the round trip ──
  const proveBytes = () => {
    let renamed = 0, bytes = 0
    subjects.forEach(subject => {
      const ids = [...new Set(censusAll(subject.files).map(entry => entry.id))].sort()
      const forward = Object.fromEntries(ids.map((id, i) => [id, `zz${i}:t`]))
      const back    = Object.fromEntries(ids.map((id, i) => [`zz${i}:t`, id]))
      const there = rewriteIds(subject.files, subject.types, forward, subject.fileSheets)
      const text  = serialize(there)
      const survivors = ids.filter(id => text.includes(id))
      assert.deepEqual(survivors, [], `${subject.what}: ${survivors.length} old id(s) still in the bytes after a total rename: ${survivors.join(', ')}`)
      // the phonebook for the way back is the RENAMED phonebook — a rename moves the sheets
      // too, and the merged types are not part of the files being rewritten. Getting this
      // wrong is not a silent loss: eachId NAMES the buckets whose sheet it could not find.
      const thereTypes = rewriteIds({ types: { version: SCHEMA_VERSION, types: subject.types, sectionsFor: {}, fieldsFor: {} } }, subject.types, forward).types.types
      const home = rewriteIds(there, thereTypes, back, subject.fileSheets)
      assert.deepEqual(eachId(there, thereTypes, () => {}, subject.fileSheets).unknownSheets, [], `${subject.what}: the renamed phonebook covers the way back`)
      assert.equal(serialize(home), serialize(subject.files), `${subject.what}: A→B→A is byte-identical — no key reordered, none dropped, none created`)
      assert.equal(serialize(subject.files), serialize(JSON.parse(serialize(subject.files))), `${subject.what}: rewriteIds left its input alone`)
      renamed += ids.length; bytes += text.length
    })
    return { renamed, bytes }
  }
  const { censused, positions } = proveCensus()
  const { renamed, bytes } = proveBytes()

  // ── ANTI-VACUITY: break a marker IN MEMORY and this check must go red ──
  // R5 does this for the fixtures; here it is done for the census, because "every id-shaped
  // string is reachable" is the one claim that could pass by the census being too narrow
  // rather than by the walk being complete.
  const SABOTAGE = [['MINTS.type', MINTS, 'type'], ['MINTS.group', MINTS, 'group'],
                    ['MINTS.section', MINTS, 'section'], ['MINTS.fieldDef', MINTS, 'fieldDef'],
                    ['QUERY_IDS.type', QUERY_IDS, 'type'], ['QUERY_IDS["where.field"]', QUERY_IDS, 'where.field']]
  SABOTAGE.forEach(([what, table, key]) => {
    const held = table[key]
    delete table[key]
    try {
      assert.throws(proveCensus, assert.AssertionError, `the census must FAIL with ${what} missing`)
      assert.throws(proveBytes, assert.AssertionError, `and so must the substitution`)
    } finally { table[key] = held }
  })
  proveCensus(); proveBytes()                                                   // put back, and green again

  // and the grammar the census typed out by hand IS the shelf's own — said LAST, so the
  // census never read it
  assert.equal(BOOK_ID.source, NAMESPACED.source, 'the census\'s hand-typed id grammar IS schema.js\'s BOOK_ID')
  ok(`R6 the id census over the REAL tree: ${censused} id-shaped strings (values AND object keys) found by two hand-typed regexes over ${subjects.length} real subjects, every one of them at a path eachId reaches — ${positions} positions visited in all, no things bucket's sheet missing from its phonebook; ${renamed} distinct ids renamed to fresh tokens and NOT ONE old string survives in the ${bytes} serialised bytes; A→B→A byte-identical for all ${subjects.length}; and each of the ${SABOTAGE.length} marker rows deleted in memory turns BOTH halves red, so this is a proof that can fail. The census's grammar is asserted equal to BOOK_ID last of all`)
}

// ═════════════════════ the shelf's WRITE half: M13–M19 (NEW, stage 4) ═════════════════════
// M12 above says the only thing it ever said: NO CHECK WRITES THE REAL SHELF. The promise an
// AUTHOR actually has is a different one — AN EDITION A GAME PINS CANNOT CHANGE — and until
// these checks it had none at all, because until stage 4 no route could have broken it. Every
// one of them runs over a COPY of the shelf (copyShelf) and a scratch games root, so M12 and
// M9 stay true and gain meaning: the writing really happens, and it really happens over there.
//
// ONE SENTENCE PER FAULT, READ BY EVERY READER: each refusal below is asserted by FULL STRING
// EQUALITY against the sentence server/books.js writes, never by a /regex/. A sentence is the
// product here — the author reads it and has to know what to do next — so a check that
// matched loosely would let the words rot while staying green.

// ── M13 the freeze, POSITIVELY (spec gap 6) ──
// The shape of the claim, in the order it is asked:
//   a pinned edition refuses a SAVE, a DELETE of itself, and a DELETE of its book; each
//   refusal NAMES the game that pins it and the shelf's bytes do not move;
//   a CUT is allowed while pinned, because a cut is the answer the refusal points at;
//   the CONVERSE — the same writes, aimed at an edition nobody pins, are accepted;
//   and UN-PINNING lifts it: the freeze is exactly "a game pins it", with no other ingredient.
{
  const SHELF = copyShelf(join(WORK, 'm13-shelf', 'books'))
  const GAMES = join(WORK, 'm13')
  // a game called `dino` so the refusals read the way an author will read them
  writeGame(join(GAMES, 'dino'), seedSet('Dino', [{ name: 'basic', edition: 1 }]))
  const before = treeHash(SHELF), gamesBefore = treeHash(GAMES)
  const basicFiles = () => ({ book: JSON.parse(readFileSync(join(SHELF, 'basic', '1', 'book.json'), 'utf8')),
                              types: JSON.parse(readFileSync(join(SHELF, 'basic', '1', 'types.json'), 'utf8')) })
  const { origin, stop } = await startServer(GAMES, join(WORK, 'm13-dist'), SHELF)
  try {
    // ── the three refusals, each naming games/dino, each writing nothing ──
    const refusals = [
      ['/api/books/basic/1/save', basicFiles(), 409, 'games/dino pins this edition — it is frozen. Cut edition 2 to change it.'],
      ['/api/books/basic/1/delete', undefined, 409, 'games/dino pins this edition. Un-pin it first, or delete the whole book.'],
      ['/api/books/basic/delete', undefined, 409, 'games/dino pins edition 1 — un-pin it first.']
    ]
    for (const [path, body, status, error] of refusals) {
      assert.deepEqual(await api(origin, path, { method: 'POST', body }), { status, body: { ok: false, error } }, `POST ${path}`)
      assert.equal(treeHash(SHELF), before, `POST ${path} wrote nothing — the shelf is byte-identical`)
      assert.equal(treeHash(GAMES), gamesBefore, `POST ${path} left the pinning game alone too`)
    }
    // a save that is not even about the pinned edition's CONTENT is refused: the freeze is
    // about the FOLDER, so posting the bytes that are already there is still a write
    assert.equal((await api(origin, '/api/books/basic/1/save', { method: 'POST', body: { ...basicFiles(), proposals: { version: SCHEMA_VERSION, groups: [], groupRules: {} } } })).status, 409,
      'even adding a file to a pinned edition is refused — the freeze is about the folder, not the diff')
    assert.equal(treeHash(SHELF), before)

    // ── the CUT is allowed while pinned: it is what the refusal tells the author to do ──
    assert.deepEqual(await api(origin, '/api/books/basic/1/cut', { method: 'POST' }), { status: 201, body: { ok: true, edition: 2 } },
      'the sentence said "Cut edition 2 to change it", and that is the edition the cut makes')
    assert.equal(treeHash(GAMES), gamesBefore, 'a cut changes no game — the pin still names edition 1')
    // edition 2 is edition 1's bytes plus the new number — the shelf's own definition of a cut
    ;['book.json', 'types.json'].forEach(file => assert.equal(
      readFileSync(join(SHELF, 'basic', '2', file), 'utf8'),
      file === 'book.json' ? readFileSync(join(SHELF, 'basic', '1', file), 'utf8').replace('"edition": 1', '"edition": 2') : readFileSync(join(SHELF, 'basic', '1', file), 'utf8'),
      `basic/2/${file} is basic/1's bytes (book.json differs only in the number)`))

    // ── THE CONVERSE: the identical writes, aimed at the edition nobody pins ──
    const editionTwo = { book: { ...basicFiles().book, edition: 2 }, types: basicFiles().types }
    assert.deepEqual(await api(origin, '/api/books/basic/2/save', { method: 'POST', body: editionTwo }), { status: 200, body: { ok: true } },
      'the SAME book, the SAME bytes, one edition along: accepted, because no game pins it')
    // ── and UN-PINNING lifts the freeze on edition 1: nothing else is an ingredient ──
    const content = JSON.parse(readFileSync(join(GAMES, 'dino', 'data', 'content.json'), 'utf8'))
    writeFileSync(join(GAMES, 'dino', 'data', 'content.json'), serialize({ ...content, books: [{ name: 'basic', edition: 2 }] }))
    assert.deepEqual(await api(origin, '/api/books/basic/1/save', { method: 'POST', body: basicFiles() }), { status: 200, body: { ok: true } },
      'the pin moved to edition 2, so edition 1 is the author\'s again — the freeze is exactly "a game pins it"')
    assert.deepEqual(await api(origin, '/api/books/basic/1/delete', { method: 'POST' }), { status: 200, body: { ok: true } }, 'and it can be deleted')
    assert.equal(existsSync(join(SHELF, 'basic', '1')), false)
    assert.equal(existsSync(join(SHELF, 'basic', '2')), true, 'the edition the game now pins is untouched')
    // …and edition 2, which the pin followed, is frozen now. The SAME edition, the other way.
    assert.deepEqual(await api(origin, '/api/books/basic/2/save', { method: 'POST', body: editionTwo }),
      { status: 409, body: { ok: false, error: 'games/dino pins this edition — it is frozen. Cut edition 3 to change it.' } },
      'and the edition the pin moved to is frozen now — the refusal follows the pin, and so does the number in it')
    ok(`M13 the freeze, POSITIVELY: over a scratch shelf and a scratch games root, an edition games/dino pins refuses a save, a delete of itself and a delete of its whole book — three 409s, each by FULL STRING EQUALITY against books.js's own sentence, each naming games/dino, and after every one of them the shelf AND the game are byte-identical; adding a file to the pinned edition is refused too (the freeze is the folder, not the diff); a CUT is allowed while pinned and makes exactly the edition the refusal named, with edition 1's bytes and the number changed; the CONVERSE holds — the same book one edition along, which nobody pins, takes the identical save; and moving the pin to edition 2 unfreezes 1 (save and delete both accepted) while freezing 2, whose refusal now says "Cut edition 3". That is the whole rule: an edition is frozen when a game pins it, and nothing else is an ingredient`)
  } finally { stop() }
}

// ── M14 POST /api/books: the newborn book and every refusal (§8 row 1) ──
{
  const SHELF = copyShelf(join(WORK, 'm14-shelf', 'books'))
  const GAMES = join(WORK, 'm14')
  mkdirSync(GAMES, { recursive: true })
  const { origin, stop } = await startServer(GAMES, join(WORK, 'm14-dist'), SHELF)
  try {
    assert.deepEqual(await api(origin, '/api/books', { method: 'POST', body: { title: 'My Beasts' } }),
      { status: 201, body: { ok: true, name: 'my-beasts', edition: 1 } }, 'the receipt: the folder the title made, and edition 1')
    // THE BYTES, written out literally rather than compared against the seeder that made
    // them — a newborn's birth values are a decision (§6, and BOOK_UNWRITTEN), and a check
    // that asked seedBook would agree with whatever it did.
    const born = join(SHELF, 'my-beasts', '1')
    assert.deepEqual(readdirSync(born).sort(), ['book.json', 'proposals.json', 'things.json', 'types.json'], 'all four files, and no assets folder')
    assert.equal(readFileSync(join(born, 'book.json'), 'utf8'), '{\n  "name": "my-beasts",\n  "title": "My Beasts",\n  "edition": 1,\n  "requires": []\n}\n',
      'book.json: name, title, edition, requires — in that order, and NO version key (it is not a data file)')
    assert.equal(readFileSync(join(born, 'types.json'), 'utf8'), `{\n  "version": ${SCHEMA_VERSION},\n  "types": [],\n  "sectionsFor": {},\n  "fieldsFor": {}\n}\n`)
    assert.equal(readFileSync(join(born, 'things.json'), 'utf8'), `{\n  "version": ${SCHEMA_VERSION},\n  "things": {}\n}\n`,
      'things.json carries no `order`: a book may not arrange a shelf, and `default: null` is that rule')
    assert.equal(readFileSync(join(born, 'proposals.json'), 'utf8'), `{\n  "version": ${SCHEMA_VERSION},\n  "groups": [],\n  "groupRules": {}\n}\n`,
      'proposals.json carries NO totalBudget: a book only PROPOSES one, and a proposal nobody made is not a proposal')
    // and what it is worth: the newborn is on the shelf, validating, and a game can pin it
    const shelf = await shelfOf(SHELF)
    assert.deepEqual(validateBook(shelf['my-beasts']['1'], shelf).map(problemText), [], 'a newborn book validates against the shelf it was born on')
    const listed = await api(origin, '/api/books')
    assert.deepEqual(listed.body.books.find(book => book.name === 'my-beasts').editions,
      [{ edition: 1, title: 'My Beasts', requires: [], sheets: 0, sectionsAdded: 0, fieldsAdded: 0, things: 0, rows: 0, budget: null, problems: [] }],
      'the Library lists it with no opinion about anything — budget null, nothing added')
    // a book born ON another book
    assert.deepEqual(await api(origin, '/api/books', { method: 'POST', body: { title: 'Built On Basic', requires: [{ name: 'basic', edition: 1 }] } }),
      { status: 201, body: { ok: true, name: 'built-on-basic', edition: 1 } })
    assert.deepEqual(JSON.parse(readFileSync(join(SHELF, 'built-on-basic', '1', 'book.json'), 'utf8')).requires, [{ name: 'basic', edition: 1 }])
    // a name GIVEN rather than made from the title
    assert.deepEqual(await api(origin, '/api/books', { method: 'POST', body: { title: 'Anything', name: 'given-name' } }),
      { status: 201, body: { ok: true, name: 'given-name', edition: 1 } }, 'a name may be given; the title still has to be there, it is the Library\'s card')
    // ── every refusal, with its status, its sentence and its path ──
    const before = treeHash(SHELF)
    const refusals = [
      [{ title: 'My Beasts' },                            409, 'a book named "my-beasts" is already on the shelf', undefined],
      [{ title: '  ' },                                   400, 'title does not make a book name', { path: 'title', message: 'must be a non-empty string' }],
      [{ name: 'nameless' },                              400, 'title does not make a book name', { path: 'title', message: 'must be a non-empty string' }],
      [{ title: '!!!' },                                  400, 'title does not make a book name', { path: 'title', message: 'gives no folder name (it needs a letter or a digit)' }],
      [{ title: 'Home' },                                 400, 'title does not make a book name', { path: 'title', message: '"home" is a name the editor keeps for itself' }],
      [{ title: 'Book' },                                 400, 'title does not make a book name', { path: 'title', message: '"book" is a name the editor keeps for itself' }],
      [{ title: 'X', name: 'Bad Name' },                  400, 'name does not make a book name', { path: 'name', message: '"Bad Name" is not a book name (lowercase letters, digits and single dashes)' }],
      [{ title: 'X', name: '..' },                        400, 'name does not make a book name', { path: 'name', message: '".." is not a book name (lowercase letters, digits and single dashes)' }],
      [{ title: 'Needy', requires: [{ name: 'nope', edition: 1 }] }, 400, 'books/needy/1 does not fit the schema', { path: 'book.requires[0]', message: '"nope" 1 is not on the shelf' }],
      [{ title: 'Needy', requires: [{ name: 'basic', edition: 0 }] }, 400, 'books/needy/1 does not fit the schema', { path: 'book.requires[0].edition', message: 'must be a positive integer (found 0)' }]
    ]
    for (const [body, status, error, problem] of refusals) {
      const answer = await api(origin, '/api/books', { method: 'POST', body })
      assert.deepEqual(answer, { status, body: problem === undefined ? { ok: false, error } : { ok: false, error, problems: [problem] } }, `POST /api/books ${JSON.stringify(body)}`)
    }
    assert.deepEqual(await api(origin, '/api/books', { method: 'POST', body: '{' }), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    assert.equal(treeHash(SHELF), before, 'not one refusal wrote a byte — and "needy" left no ghost folder behind either')
    assert.equal(existsSync(join(SHELF, 'needy')), false, 'a refusal AFTER the name was made leaves no claimed folder: the claim is books/<name> itself')
    // the NOT-a-route cases: the shelf's write half is POST under /api/books and nothing else
    assert.deepEqual(await api(origin, '/api/books', { method: 'PUT', body: { title: 'Nope' } }), { status: 404, body: { ok: false, error: 'Unknown route' } })
    assert.deepEqual(await api(origin, '/api/books/my-beasts/1/frobnicate', { method: 'POST', body: {} }), { status: 404, body: { ok: false, error: 'Unknown route' } })
    assert.deepEqual(await api(origin, '/api/books/my-beasts/1/save'), { status: 404, body: { ok: false, error: 'Unknown route' } }, 'GET on a write route is not a route at all')
    ok(`M14 POST /api/books: a newborn book is 201 { ok, name, edition: 1 } and four files on disk whose bytes are written out here literally — book.json name,title,edition,requires with NO version, the three data files stamped ${SCHEMA_VERSION}, things.json with no \`order\` (a book may not arrange a shelf) and proposals.json with NO totalBudget (a book only proposes one, and a proposal nobody made is not a proposal); it validates against its shelf and the Library lists it with budget null; \`requires\` and a given \`name\` are honoured; and ${refusals.length} refusals — 409 already on the shelf, a blank/absent/unusable title, the two reserved words, a bad given name, ".." refused by the GRAMMAR before any path is built, a requirement off the shelf and one with a bad edition — each at its exact status with its exact sentence and path, nothing written and no ghost folder left; "{" → 400, PUT → 404, an unknown action → 404, GET on a write route → 404`)
  } finally { stop() }
}

// ── M15 POST /api/books/<n>/<e>/save: the whole book in one request (§8 row 2) ──
// A game posts five files with content.json LAST because content.json carries every
// cross-reference. A book has four files and no such last one, so ONE route takes all four
// and renames the whole edition into place (L2) — which is why "half a saved book" is not a
// case this check can even construct.
{
  const SHELF = copyShelf(join(WORK, 'm15-shelf', 'books'))
  const GAMES = join(WORK, 'm15')
  mkdirSync(GAMES, { recursive: true })
  const { origin, stop } = await startServer(GAMES, join(WORK, 'm15-dist'), SHELF)
  try {
    await api(origin, '/api/books', { method: 'POST', body: { title: 'Beasts' } })
    const whole = {
      book: { name: 'beasts', title: 'Beasts', edition: 1, requires: [] },
      types: { version: SCHEMA_VERSION, types: [{ id: 'beasts:dino', label: 'Dino', sections: [
        { id: 'beasts:dino.identity', key: 'identity', caption: 'Identity', kind: 'fields',
          fields: [{ id: 'beasts:dino.identity.era', key: 'era', caption: 'Era', type: 'text', default: '' }] }] }], sectionsFor: {}, fieldsFor: {} },
      things: { version: SCHEMA_VERSION, things: { 'beasts:dino': [{ id: 'beasts:rex', name: 'Rex', cost: 2, imageURL: '', era: 'Cretaceous' }] } },
      proposals: { version: SCHEMA_VERSION, totalBudget: 12, groups: [
        { id: 'beasts:row-pick', label: 'Pick a beast', query: { type: 'beasts:dino', where: null }, fills: '', showWhen: { kind: 'always' }, children: [] }], groupRules: { 'beasts:row-pick': { min: 1 } } }
    }
    assert.deepEqual(await api(origin, `/api/books/beasts/1/save`, { method: 'POST', body: whole }), { status: 200, body: { ok: true } })
    BOOK_FILE_NAMES.forEach(file => assert.equal(readFileSync(join(SHELF, 'beasts', '1', `${file}.json`), 'utf8'), serialize(whole[file]),
      `${file}.json is the bytes that were posted, in the server's one on-disk format`))
    const shelf = await shelfOf(SHELF)
    assert.deepEqual(validateBook(shelf.beasts['1'], shelf).map(problemText), [], 'and what landed validates')
    // A FILE THE CALLER DOES NOT SEND IS A FILE THE EDITION DOES NOT HAVE. That is the only
    // way "the whole book in one request" can mean what it says — and it is how Basic and
    // Stats ship (book.json + types.json and nothing else).
    assert.deepEqual(await api(origin, '/api/books/beasts/1/save', { method: 'POST', body: { book: whole.book, types: whole.types } }), { status: 200, body: { ok: true } })
    assert.deepEqual(readdirSync(join(SHELF, 'beasts', '1')).sort(), ['book.json', 'types.json'],
      'things.json and proposals.json are GONE — a book\'s data files are optional, and absent means "this book has none of that"')
    const before = treeHash(SHELF)
    // ── every refusal ──
    const uuid = '11111111-2222-4333-8444-555555555555'
    const refusals = [
      ['/api/books/beasts/1/save', { ...whole, types: { ...whole.types, types: [{ id: uuid, label: 'Nope', sections: [] }] } }, 400,
        'books/beasts/1 does not fit the schema', [{ path: 'types.types[0].id', message: `"${uuid}" is not in this book's namespace (beasts:)` }]],
      ['/api/books/beasts/1/save', { ...whole, book: { ...whole.book, name: 'other' } }, 400,
        'books/beasts/1 does not fit the schema', [{ path: 'book.name', message: 'must be "beasts" — the folder\'s name (found "other")' }]],
      ['/api/books/beasts/1/save', { ...whole, book: { ...whole.book, requires: [{ name: 'beasts', edition: 1 }] } }, 400,
        'books/beasts/1 does not fit the schema', [{ path: 'book.requires[0]', message: 'a book cannot require itself' }]],
      ['/api/books/beasts/1/save', { ...whole, things: { ...whole.things, order: { 'beasts:dino': ['beasts:rex'] } } }, 400,
        'books/beasts/1 does not fit the schema', [{ path: 'things.order', message: 'a book may not arrange a shelf (order is the game\'s)' }]],
      ['/api/books/beasts/1/save', { types: whole.types }, 400,
        'books/beasts/1 does not fit the schema', [{ path: 'book', message: 'must be an object (found absent)' }]],
      ['/api/books/nobody/1/save', whole, 404, 'Unknown book "nobody" 1', undefined],
      ['/api/books/beasts/9/save', whole, 404, 'Unknown book "beasts" 9', undefined],
      ['/api/books/beasts/01/save', whole, 404, 'Unknown book "beasts" 01', undefined],
      ['/api/books/BEASTS/1/save', whole, 404, 'Unknown book "BEASTS" 1', undefined]
    ]
    for (const [path, body, status, error, problems] of refusals) {
      const answer = await api(origin, path, { method: 'POST', body })
      assert.deepEqual(answer, { status, body: problems === undefined ? { ok: false, error } : { ok: false, error, problems } }, `POST ${path}`)
      assert.equal(treeHash(SHELF), before, `POST ${path} wrote nothing`)
    }
    assert.deepEqual(await api(origin, '/api/books/beasts/1/save', { method: 'POST', body: '{' }), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    assert.equal(treeHash(SHELF), before)
    ok(`M15 POST /api/books/<n>/<e>/save: the WHOLE book in one request — four files posted, 200 { ok }, every byte on disk the server's own format, and validateBook clean; a file the caller does not send is a file the edition does not have (things.json and proposals.json really go, which is how Basic and Stats ship); and ${refusals.length} refusals — a UUID id outside the namespace, a manifest disagreeing with its folder, a book requiring itself, a book arranging a shelf, a body with no book.json, an unknown book, an unknown edition, "01" and "BEASTS" refused by the GRAMMAR before any path is built — each at its exact status with the validator's own path and sentence, and the shelf byte-identical after every single one`)
  } finally { stop() }
}

// ── M16 cut and delete (§8 rows 3 and 4) ──
// "AN EDITION IS A COPY PLUS MORE" is the shelf's own rule and T2 asserts it of the committed
// Dinosaur Age 2. Here it is asserted of the route that makes one — including the half T2
// cannot see, which is that everything that is NOT one of the four files comes along too.
{
  const SHELF = copyShelf(join(WORK, 'm16-shelf', 'books'))
  const GAMES = join(WORK, 'm16')
  writeGame(join(GAMES, 'dino'), seedSet('Dino', [{ name: 'basic', edition: 1 }, { name: 'stats', edition: 1 }, { name: 'dinosaur-age', edition: 2 }]))
  const { origin, stop } = await startServer(GAMES, join(WORK, 'm16-dist'), SHELF)
  try {
    // ── CUT: edition 3 of Dinosaur Age, which ships assets/ ──
    assert.deepEqual(await api(origin, '/api/books/dinosaur-age/2/cut', { method: 'POST' }), { status: 201, body: { ok: true, edition: 3 } })
    const [two, three] = ['2', '3'].map(edition => join(SHELF, 'dinosaur-age', edition))
    BOOK_FILE_NAMES.filter(file => file !== 'book').forEach(file => assert.equal(readFileSync(join(three, `${file}.json`), 'utf8'), readFileSync(join(two, `${file}.json`), 'utf8'),
      `${file}.json is edition 2's bytes, to the byte`))
    assert.equal(readFileSync(join(three, 'book.json'), 'utf8'), readFileSync(join(two, 'book.json'), 'utf8').replace('"edition": 2', '"edition": 3'),
      'book.json differs in the number and in nothing else')
    assert.equal(treeHash(join(three, 'assets')), treeHash(join(two, 'assets')), 'and the pictures came along — a cut carries everything that is not one of the four files')
    assert.ok(listFiles(join(three, 'assets')).length > 0, 'there really were pictures to carry')
    const shelf = await shelfOf(SHELF)
    assert.deepEqual(validateBook(shelf['dinosaur-age']['3'], shelf).map(problemText), [], 'the cut edition validates')
    // a cut is allowed from ANY edition, not just the latest — and the number is always one
    // past the HIGHEST folder, so a cut from 2 while 3 exists makes 4 and buries nothing
    assert.deepEqual(await api(origin, '/api/books/dinosaur-age/2/cut', { method: 'POST' }), { status: 201, body: { ok: true, edition: 4 } })
    assert.equal(readFileSync(join(SHELF, 'dinosaur-age', '4', 'types.json'), 'utf8'), readFileSync(join(two, 'types.json'), 'utf8'), 'edition 4 is edition 2 again')
    const before = treeHash(SHELF)
    assert.deepEqual(await api(origin, '/api/books/dinosaur-age/9/cut', { method: 'POST' }), { status: 404, body: { ok: false, error: 'books/dinosaur-age/9 is not on the shelf' } })
    assert.deepEqual(await api(origin, '/api/books/nobody/1/cut', { method: 'POST' }), { status: 404, body: { ok: false, error: 'books/nobody/1 is not on the shelf' } })
    assert.equal(treeHash(SHELF), before, 'a refused cut writes nothing')
    // ── DELETE an edition, and the rule the listing needs ──
    assert.deepEqual(await api(origin, '/api/books/dinosaur-age/4/delete', { method: 'POST' }), { status: 200, body: { ok: true } })
    assert.equal(existsSync(join(SHELF, 'dinosaur-age', '4')), false)
    assert.deepEqual(readdirSync(join(SHELF, 'dinosaur-age')).sort(), ['1', '2', '3'], 'the other editions are untouched and the book stays')
    assert.deepEqual(await api(origin, '/api/books/dinosaur-age/4/delete', { method: 'POST' }), { status: 404, body: { ok: false, error: 'books/dinosaur-age/4 is not on the shelf' } })
    // THE LAST EDITION TAKES THE BOOK FOLDER WITH IT, or the Library shows a book with no
    // editions — a ghost that cannot be opened, cannot be pinned and cannot be explained.
    await api(origin, '/api/books', { method: 'POST', body: { title: 'Only One' } })
    assert.deepEqual(await api(origin, '/api/books/only-one/1/delete', { method: 'POST' }), { status: 200, body: { ok: true } })
    assert.equal(existsSync(join(SHELF, 'only-one')), false, 'the last edition took the book folder with it')
    // …unless something the author made by hand is still in there: rmdir without recursive
    // is the whole rule, so a folder we did not delete keeps the book exactly as it is
    await api(origin, '/api/books', { method: 'POST', body: { title: 'Kept' } })
    mkdirSync(join(SHELF, 'kept', 'notes'))
    assert.deepEqual(await api(origin, '/api/books/kept/1/delete', { method: 'POST' }), { status: 200, body: { ok: true } })
    assert.deepEqual(readdirSync(join(SHELF, 'kept')), ['notes'], 'a folder the author made by hand keeps the book — nothing of theirs is swept away')
    // ── DELETE the whole book ──
    await api(origin, '/api/books', { method: 'POST', body: { title: 'Doomed' } })
    await api(origin, '/api/books/doomed/1/cut', { method: 'POST' })
    assert.deepEqual(await api(origin, '/api/books/doomed/delete', { method: 'POST' }), { status: 200, body: { ok: true } })
    assert.equal(existsSync(join(SHELF, 'doomed')), false, 'every edition, and the folder')
    assert.deepEqual(await api(origin, '/api/books/doomed/delete', { method: 'POST' }), { status: 404, body: { ok: false, error: 'books/doomed is not on the shelf' } })
    // a pinned edition is M13's subject; here the other half — the whole book, pinned at an
    // edition that does not even exist any more, is still refused and still names the game
    assert.deepEqual(await api(origin, '/api/books/dinosaur-age/delete', { method: 'POST' }),
      { status: 409, body: { ok: false, error: 'games/dino pins edition 2 — un-pin it first.' } })
    ok(`M16 cut and delete: a cut is 201 { ok, edition } and edition N+1 is edition N's bytes to the byte with book.json differing only in the number AND the assets/ folder carried (the half T2 cannot see); the number is one past the HIGHEST folder, so a cut from 2 while 3 exists makes 4 and buries nothing; a cut of an edition or a book that is not there is a 404 with the shelf's own sentence and writes nothing; deleting an edition leaves its siblings alone, deleting the LAST one takes the book folder with it (no ghost the Library would show), and a folder the author made by hand keeps the book instead; deleting a whole book takes every edition, a second delete is a 404, and a book a game pins is refused by name`)
  } finally { stop() }
}

// ── M17 POST /api/books/<n>/rename: the name IS the namespace (§8 row 5) ──
// A BOOK'S NAME IS ITS ID NAMESPACE, so a rename is two walks over two grammars: every id in
// every edition AND every reference to one inside every local game that pins it, plus the
// PINS themselves, which name a folder and are not ids at all. The count in the receipt is
// checked against an INDEPENDENT census (R6's, retyped) rather than against a magic number,
// so the two can never agree by being the same code twice.
{
  const SHELF = copyShelf(join(WORK, 'm17-shelf', 'books'))
  const GAMES = join(WORK, 'm17')
  // the REAL games/dino: the only game whose own files hold references INTO a book's
  // namespace (four rowOverrides keyed by Dinosaur Age's rows, ten things in Basic's buckets)
  copyGame(join(DINO_DIR, 'games', 'dino'), join(GAMES, 'dino'))
  const PREFIX = 'dinosaur-age:'
  const before = { shelf: readdirSync(SHELF).sort(), game: readGameSet(join(GAMES, 'dino')) }
  // the independent count: every id-shaped string under this namespace, found by reading the
  // bytes, with no reference to the walker the route uses
  const occurrences = (root) => listFiles(root).filter(rel => rel.endsWith('.json'))
    .reduce((n, rel) => n + [...readFileSync(join(root, rel), 'utf8').matchAll(/"(dinosaur-age:[a-z0-9]+(?:[.-][a-z0-9]+)*)"/g)].length, 0)
  // the pins are NOT ids and must not be counted: `"dinosaur-age"` has no colon, so the
  // regex above already excludes them — which is the point the receipt's two numbers make
  const expectedIds = occurrences(join(SHELF, 'dinosaur-age')) + occurrences(join(GAMES, 'dino'))
  const { origin, stop } = await startServer(GAMES, join(WORK, 'm17-dist'), SHELF)
  try {
    const answer = await api(origin, '/api/books/dinosaur-age/rename', { method: 'POST', body: { to: 'thunder-lizards' } })
    assert.deepEqual(answer, { status: 200, body: { ok: true, name: 'thunder-lizards', rewritten: { ids: expectedIds, pins: 1 } } },
      `the receipt names both walks, and \`ids\` is exactly the ${expectedIds} namespaced strings an independent byte count finds`)
    assert.deepEqual(readdirSync(SHELF).sort(), before.shelf.map(name => name === 'dinosaur-age' ? 'thunder-lizards' : name).sort(), 'one folder, renamed; nothing else on the shelf moved')
    assert.deepEqual(readdirSync(join(SHELF, 'thunder-lizards')).sort(), ['1', '2'], 'both editions came along')
    assert.ok(listFiles(join(SHELF, 'thunder-lizards', '1', 'assets')).length > 0, 'and their pictures')
    assert.equal(occurrences(join(SHELF, 'thunder-lizards')) + occurrences(join(GAMES, 'dino')), 0, 'not one string of the old namespace survives anywhere — in the book or in the game')
    // THE PIN is the other half, over a different grammar
    const content = JSON.parse(readFileSync(join(GAMES, 'dino', 'data', 'content.json'), 'utf8'))
    assert.deepEqual(content.books, before.game.content.books.map(pin => pin.name === 'dinosaur-age' ? { name: 'thunder-lizards', edition: pin.edition } : pin),
      'the pin names the new folder, and a pin\'s { name, edition } key order survived')
    // …and the world still fits together: the shelf validates, the game validates against it,
    // and the game's rowOverrides still point at rows that exist
    const shelf = await shelfOf(SHELF)
    Object.entries(shelf).forEach(([name, editions]) => Object.entries(editions).forEach(([edition, layer]) =>
      assert.deepEqual(validateBook(layer, shelf).map(problemText), [], `books/${name}/${edition} still validates after the rename`)))
    const own = readGameSet(join(GAMES, 'dino'))
    const books = own.content.books.map(pin => shelf[pin.name]?.[pin.edition] ?? null)
    assert.deepEqual(validateGame({ own, books }).map(problemText), [], 'and games/dino still fits — every rowOverride and every things bucket followed the rename')
    assert.deepEqual(Object.keys(own.content.rowOverrides), Object.keys(before.game.content.rowOverrides).map(id => id.replace(/^dinosaur-age:/, 'thunder-lizards:')),
      'the game\'s four override slots are the same four, under the new namespace, IN THEIR PLACES — a rewriter that deleted and re-assigned would have moved every one of them to the end')
    // EVERY file of the game that names one of these ids followed, and the ones that do not
    // are byte-identical — games/dino's themes.json keys two group themes by Dinosaur Age's
    // rows, so it moved; its types.json names no id of this book at all, so it did not.
    assert.deepEqual(Object.keys(own.themes.groupThemes), Object.keys(before.game.themes.groupThemes).map(id => id.replace(/^dinosaur-age:/, 'thunder-lizards:')),
      'themes.json keys two group themes by this book\'s rows, so they followed the rename — in their places')
    assert.equal(serialize(own.types), serialize(before.game.types), 'types.json names no id of this book, so it is byte-identical (the route writes only the files whose bytes change)')
    // ── every refusal ──
    const frozen = treeHash(SHELF), gamesFrozen = treeHash(GAMES)
    const refusals = [
      ['thunder-lizards', { to: 'thunder-lizards' }, 400, 'books/thunder-lizards is already called that', undefined],
      ['thunder-lizards', { to: 'basic' }, 409, 'a book named "basic" is already on the shelf', undefined],
      ['thunder-lizards', { to: 'Bad Name' }, 400, 'to does not make a book name', [{ path: 'to', message: '"Bad Name" is not a book name (lowercase letters, digits and single dashes)' }]],
      ['thunder-lizards', { to: '..' }, 400, 'to does not make a book name', [{ path: 'to', message: '".." is not a book name (lowercase letters, digits and single dashes)' }]],
      ['thunder-lizards', { to: 'book' }, 400, 'to does not make a book name', [{ path: 'to', message: '"book" is a name the editor keeps for itself' }]],
      ['ghost', { to: 'spook' }, 404, 'books/ghost has no edition to rename', undefined],
      // A REQUIRED BOOK CANNOT BE RENAMED, and this refusal is not in §8's table — the freeze
      // demands it. Following the rename into another book's `requires` means writing an
      // edition some other author's game may already pin, which is exactly what FROZEN forbids.
      ['basic', { to: 'bedrock' }, 409,
        'books/stats/1, books/thunder-lizards/1 and books/thunder-lizards/2 require this book — a required book cannot be renamed, because rewriting a frozen edition to follow it is exactly what "editions are frozen" forbids.', undefined]
    ]
    for (const [name, body, status, error, problems] of refusals) {
      const got = await api(origin, `/api/books/${name}/rename`, { method: 'POST', body })
      assert.deepEqual(got, { status, body: problems === undefined ? { ok: false, error } : { ok: false, error, problems } }, `POST /api/books/${name}/rename ${JSON.stringify(body)}`)
      assert.equal(treeHash(SHELF), frozen, 'a refused rename moves no byte of the shelf')
      assert.equal(treeHash(GAMES), gamesFrozen, 'and none of any game')
    }
    assert.deepEqual(await api(origin, '/api/books/thunder-lizards/rename', { method: 'POST', body: '{' }), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    assert.deepEqual(await api(origin, '/api/books/Bad Name/rename', { method: 'POST', body: { to: 'x' } }), { status: 404, body: { ok: false, error: 'Unknown book "Bad%20Name"' } },
      'the name in the URL is judged by the grammar before any path is built from it')
    assert.equal(treeHash(SHELF), frozen)
    // A RENAME IS ALLOWED WHILE A GAME PINS IT — the one reading of the freeze that holds,
    // because the pinning game is rewritten in the same step, so no world changes under it.
    // Said here as the positive half of the sentence the refusals above are the negative of.
    assert.deepEqual(await api(origin, '/api/books/thunder-lizards/rename', { method: 'POST', body: { to: 'dinosaur-age' } }),
      { status: 200, body: { ok: true, name: 'dinosaur-age', rewritten: { ids: expectedIds, pins: 1 } } }, 'and back again, the same two numbers')
    const backShelf = await shelfOf(SHELF)
    assert.deepEqual(validateBook(backShelf['dinosaur-age']['1'], backShelf).map(problemText), [])
    BOOK_FILE_NAMES.filter(file => file !== 'book').forEach(file => assert.equal(
      readFileSync(join(SHELF, 'dinosaur-age', '1', `${file}.json`), 'utf8'), readFileSync(join(REAL_BOOKS, 'dinosaur-age', '1', `${file}.json`), 'utf8'),
      `A→B→A: ${file}.json is byte-identical to the committed shelf's`))
    assert.deepEqual(readGameSet(join(GAMES, 'dino')), before.game, 'and the game came home byte-identical too')
    ok(`M17 POST /api/books/<n>/rename: renaming Dinosaur Age rewrites ${expectedIds} ids across both editions AND inside games/dino (its four rowOverride slots and its things buckets) plus the 1 pin that names the folder — and \`ids\` is checked against an INDEPENDENT count of namespaced strings in the bytes, never a magic number; afterwards not one string of the old namespace survives anywhere, both editions validate, games/dino validates against the renamed shelf, the pictures came along, themes.json's two group-theme keys followed in their places and types.json (which names no id of this book) is byte-identical; ${refusals.length} refusals — the same name, a name already taken, a bad name, "..", a reserved word, a book with no edition, and a book another book REQUIRES (the refusal §8's table does not list and the freeze demands) — each at its status with its sentence, and neither the shelf nor any game moves a byte; and renaming it BACK is byte-identical to the committed shelf, which is the round trip a rewriter owes`)
  } finally { stop() }
}

// ── M18 the seam between routes (gap 4), and M19 a staging folder (L2) ──
// NO ORACLE WALKED THE SEAM. Each route was sound on its own and the question nobody asked
// was what the SEQUENCE leaves behind: two books sharing a folder, or a folder with no
// editions in it. Both are invisible to a per-route check and both are permanent once made.
{
  const SHELF = copyShelf(join(WORK, 'm18-shelf', 'books'))
  const GAMES = join(WORK, 'm18')
  mkdirSync(GAMES, { recursive: true })
  const { origin, stop } = await startServer(GAMES, join(WORK, 'm18-dist'), SHELF)
  const dirsIn = (dir) => existsSync(dir) ? readdirSync(dir).filter(name => statSync(join(dir, name)).isDirectory()).sort() : null
  try {
    // every book folder holds at least one edition, and no two books share a folder
    const sound = async (after) => {
      const listed = (await api(origin, '/api/books')).body.books
      assert.deepEqual(listed.map(book => book.name), [...new Set(listed.map(book => book.name))], `${after}: no two books share a folder`)
      listed.forEach(book => assert.ok((book.editions ?? []).length > 0, `${after}: books/${book.name} has at least one edition — an empty book folder is a ghost`))
      dirsIn(SHELF).forEach(name => assert.ok(dirsIn(join(SHELF, name)).length > 0, `${after}: books/${name} is not an empty folder on disk either`))
      return listed
    }
    const seam = [
      ['create Seam', '/api/books', { title: 'Seam' }, 201, { ok: true, name: 'seam', edition: 1 }, ['1']],
      ['cut seam/1', '/api/books/seam/1/cut', undefined, 201, { ok: true, edition: 2 }, ['1', '2']],
      ['delete seam/1', '/api/books/seam/1/delete', undefined, 200, { ok: true }, ['2']],
      // THE SEAM ITSELF: the folder is still there holding edition 2, so creating the same
      // name again must be the 409 — this is the step a per-route check cannot reach, and
      // where a create that claimed the EDITION rather than the BOOK would land a second
      // book inside the first one's folder.
      ['create Seam again', '/api/books', { title: 'Seam' }, 409, { ok: false, error: 'a book named "seam" is already on the shelf' }, ['2']],
      ['delete seam/2 — the last one', '/api/books/seam/2/delete', undefined, 200, { ok: true }, null],
      ['create Seam a third time', '/api/books', { title: 'Seam' }, 201, { ok: true, name: 'seam', edition: 1 }, ['1']]
    ]
    for (const [what, path, body, status, receipt, editions] of seam) {
      assert.deepEqual(await api(origin, path, { method: 'POST', body }), { status, body: receipt }, what)
      assert.deepEqual(dirsIn(join(SHELF, 'seam')), editions, `${what}: the folders on disk`)
      await sound(what)
    }
    // the newborn at the end is a NEWBORN, not the old book's leftovers
    assert.equal(readFileSync(join(SHELF, 'seam', '1', 'book.json'), 'utf8'), '{\n  "name": "seam",\n  "title": "Seam",\n  "edition": 1,\n  "requires": []\n}\n',
      'and the third Seam is edition 1 of a new book, not an edition 2 wearing edition 1\'s number')
    ok(`M18 the seam between routes: create → cut → delete edition 1 → create the same name (409, because the folder still holds edition 2 — the step no per-route check can reach) → delete the last edition → create again. After EVERY step the shelf is sound: no two books share a folder, every listed book has at least one edition, and no folder on disk is an empty book. The last create is a real newborn at edition 1, not the previous book's leftovers`)

    // ── M19 a staging folder is invisible (L2) ──
    // An edition is built whole in <edition>.tmp and RENAMED into place, and a whole book is
    // staged at <name>.tmp while it is renamed. A crash leaves one of those behind. It must be
    // invisible to EVERY reader, or the Library lists a half-written edition as a broken book
    // and the next cut hands its number to a working one.
    const halfEdition = join(SHELF, 'seam', '9.tmp')
    mkdirSync(halfEdition, { recursive: true })
    writeFileSync(join(halfEdition, 'book.json'), serialize({ name: 'seam', title: 'Half written', edition: 9, requires: [] }))
    const halfBook = join(SHELF, 'ghost.tmp', '1')
    mkdirSync(halfBook, { recursive: true })
    writeFileSync(join(halfBook, 'book.json'), serialize({ name: 'ghost', title: 'Half renamed', edition: 1, requires: [] }))
    const listed = await sound('with two staging folders on the shelf')
    assert.deepEqual(listed.map(book => book.name), ['basic', 'dinosaur-age', 'seam', 'stats'], 'the Library does not list a staging folder as a book')
    assert.deepEqual(listed.find(book => book.name === 'seam').editions.map(edition => edition.edition), [1], 'nor as an edition')
    const shelf = await shelfOf(SHELF)
    assert.deepEqual(Object.keys(shelf).sort(), ['basic', 'dinosaur-age', 'seam', 'stats'], 'and the MERGE cannot find one: it is not on the shelf index at all')
    assert.deepEqual(Object.keys(shelf.seam), ['1'])
    // the NUMBER is the other half: a cut must not hand edition 9's number to a working
    // edition just because the staging that owns it is invisible
    assert.deepEqual(await api(origin, '/api/books/seam/1/cut', { method: 'POST' }), { status: 201, body: { ok: true, edition: 2 } },
      'a cut numbers from the editions that ARE editions — a staging folder owns no number')
    assert.deepEqual(dirsIn(join(SHELF, 'seam')), ['1', '2', '9.tmp'], 'and the staging is still sitting there for a human to rename or remove')
    // …and not over HTTP either: the static drawer's grammar refuses both spellings
    assert.equal((await api(origin, '/books/seam/9.tmp/book.json')).status, 404, 'a staging edition is not a url — isEditionName refuses "9.tmp"')
    assert.equal((await api(origin, '/books/ghost.tmp/1/book.json')).status, 404, 'and a staging book is not one either — isBookName refuses "ghost.tmp"')
    ok('M19 a staging folder is invisible (L2): an edition is written whole into <edition>.tmp and renamed into place, so a crash can leave one behind — and a stale <edition>.tmp AND a stale <book>.tmp are both absent from GET /api/books, absent from shelfOf (so no merge can find one), own no edition number (a cut numbers past the real editions and gives 2, not 10), and are not reachable over HTTP at all because the shelf\'s two grammars refuse both spellings. What is left is a folder a human can see and rename, which is the repair the one named window asks for')
  } finally { stop() }
}

// ── M21 POST /api/games/<g>/extract — "save as a book" (§8 row 6, NEW, stage 4) ──
// The third of Joelle's three forks: lift a game's OWN layer into books/<name>/1/, re-mint
// every id into the new namespace, and leave the game pinning the new book. It is the route
// with the most to get wrong, because it writes TWO folders and the thing it must not change
// is the only thing that matters — WHAT THE GAME PLAYS.
//
// So that is what this check asks, and it asks it of both real cases the brief names:
//   games/vampire — a whole world in UUIDs (8 sheets, 64 things, 8 rows), which exercises the
//                   full mint: every id the book defines must come out <name>:<noun>-<n>;
//   games/dino    — 10 things and nothing else of its own, whose FOUR row facts are all
//                   rowOverrides that CANNOT travel (book-over-book override is deferred), so
//                   the receipt's `left` is the whole of the author's honesty.
//
// THE FAITHFULNESS TEST is an ID-FREE projection of the flattened merge: every sheet by label,
// every section by caption, every field by key, every thing by name and cost under its sheet's
// LABEL, every row by label at every depth with its rule and its look, the budget and the
// declared sheet by label. Ids are exactly what this route changes, so a projection that
// mentioned one would be testing the rename instead of the game; everything a PLAYER can see
// is in here, and it must be identical before and after.
{
  const SHELF = copyShelf(join(WORK, 'm21-shelf', 'books'))
  const GAMES = join(WORK, 'm21')
  copyGame(join(DINO_DIR, 'games', 'dino'), join(GAMES, 'dino'))
  copyGame(join(DINO_DIR, 'games', 'vampire'), join(GAMES, 'vampire'))
  copyGame(join(DINO_DIR, 'games', 'vampire'), join(GAMES, 'stale'))              // kept at v4 on purpose, see the refusals

  // the v4 vampire is migrated the way every reader of it migrates it, because a BOOK is never
  // migrated and a game at an older schema is refused by name (one of the refusals below)
  writeGame(join(GAMES, 'vampire'), migrateSet(readGameSet(join(GAMES, 'vampire'))))

  const shelfOfNow = async () => shelfOf(SHELF)
  const flatten = async (game) => {
    const own = readGameSet(join(GAMES, game))
    const shelf = await shelfOfNow()
    const books = (own.content.books ?? []).map(pin => shelf[pin.name]?.[pin.edition] ?? null)
    return { own, books, set: flattenGame({ books, game: own }) }
  }
  // WHAT A PLAYER CAN SEE, with every id projected away
  const empty = (slot) => slot === undefined || slot === null || Object.keys(slot).length === 0 ? null : slot
  const faithful = ({ set }) => {
    const labelOf = new Map(set.types.types.map(type => [type.id, type.label]))
    const rowLabel = new Map()
    const walkRows = (rows) => rows.forEach(row => { rowLabel.set(row.id, row.label); walkRows(row.children ?? []) })
    walkRows(set.content.groups)
    const rows = (list) => list.map(row => ({
      label: row.label,
      shows: labelOf.get(row.query?.type) ?? row.query?.type ?? null,
      fills: row.fills === undefined || row.fills === '' ? '' : 'bound',
      gate: row.showWhen?.kind === 'anyInRow' ? `anyInRow:${rowLabel.get(row.showWhen.row) ?? '?'}`
        : row.showWhen?.kind === 'thingPicked' ? 'thingPicked' : (row.showWhen?.kind ?? null),
      // an EMPTY slot says nothing, exactly as an absent one does, so the projection spells
      // both `null`. games/vampire's rules.json really does hold one `"<row>": {}` — "a key
      // that means nothing is never written" broken in hand-written data, not by this route —
      // and the merge drops it on the way back through the book. A player cannot tell.
      rule: empty(set.rules.groupRules?.[row.id]),
      look: empty(set.themes.groupThemes?.[row.id]),
      children: rows(row.children ?? [])
    }))
    return {
      budget: set.rules.totalBudget ?? null,
      page: set.themes.page,
      meta: set.content.meta,
      builds: labelOf.get(set.content.sheet) ?? set.content.sheet ?? '',
      sheets: set.types.types.map(type => ({ label: type.label, sections: type.sections.map(section =>
        ({ caption: section.caption, kind: section.kind, of: labelOf.get(section.of) ?? section.of ?? null,
           fields: (section.fields ?? section.placement ?? []).map(field => `${field.key}:${field.type}`) })) })),
      things: Object.fromEntries(Object.entries(set.things.things).map(([sheetId, list]) =>
        [labelOf.get(sheetId) ?? sheetId, (list ?? []).map(thing => `${thing.name}/${thing.cost}/${thing.imageURL}`)])),
      rows: rows(set.content.groups)
    }
  }

  const { origin, stop } = await startServer(GAMES, join(WORK, 'm21-dist'), SHELF)
  try {
    // ── games/vampire: the full mint ──
    const wasVampire = faithful(await flatten('vampire'))
    const lifted = await api(origin, '/api/games/vampire/extract', { method: 'POST', body: { title: 'Night World' } })
    assert.equal(lifted.status, 201)
    assert.deepEqual(Object.keys(lifted.body), ['ok', 'name', 'edition', 'moved', 'left'], 'the receipt\'s keys, in order')
    assert.deepEqual([lifted.body.ok, lifted.body.name, lifted.body.edition], [true, 'night-world', 1])
    assert.deepEqual(lifted.body.moved, { types: 8, things: 64, rows: 8 }, 'vampire\'s whole world moved: 8 sheets, 64 things, 8 rows')
    // every id the book DEFINES is <name>:<noun>-<n>, and not one uuid came with it
    const book = Object.fromEntries(BOOK_FILE_NAMES.map(file => [file, JSON.parse(readFileSync(join(SHELF, 'night-world', '1', `${file}.json`), 'utf8'))]))
    const minted = []
    eachId({ book: book.book, types: book.types, things: book.things, proposals: book.proposals }, book.types.types,
      ({ id, defining }) => { if (defining) minted.push(id) }, BOOK_FILE_SHEETS)
    assert.equal(minted.length, 8 + 64 + 8 + minted.filter(id => /:(section|field)-/.test(id)).length, 'every defining position was minted')
    assert.deepEqual(minted.filter(id => !/^night-world:(sheet|section|field|row|thing)-[1-9][0-9]*$/.test(id)), [],
      'every id is <book>:<noun>-<ordinal>, the noun read from MINTS and the ordinal the smallest free one — never derived from a caption, because an id must not follow a later rename')
    assert.deepEqual([...new Set(minted)].length === minted.length, true, 'and each one exactly once')
    assert.equal(BOOK_FILE_NAMES.some(file => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(readFileSync(join(SHELF, 'night-world', '1', `${file}.json`), 'utf8'))), false,
      'not one uuid survives anywhere in the book — a uuid in a book is refused by bookRules, and this is why the mint exists')
    // the book is a book: same shape as one POST /api/books makes
    assert.deepEqual(readdirSync(join(SHELF, 'night-world', '1')).sort(), ['book.json', 'proposals.json', 'things.json', 'types.json'])
    assert.equal(readFileSync(join(SHELF, 'night-world', '1', 'book.json'), 'utf8'), '{\n  "name": "night-world",\n  "title": "Night World",\n  "edition": 1,\n  "requires": []\n}\n',
      'the manifest is the seed\'s — key order and all — and it requires exactly what the game pinned (nothing)')
    BOOK_FILE_NAMES.forEach(file => assert.equal(readFileSync(join(SHELF, 'night-world', '1', `${file}.json`), 'utf8'), serialize(book[file]), `${file}.json is canonical bytes`))
    // the GAME: its own layer emptied, pinning the new book, and its decisions kept
    const now = readGameSet(join(GAMES, 'vampire'))
    assert.deepEqual(now.content.books, [{ name: 'night-world', edition: 1 }], 'the game pins what it just made, last')
    assert.deepEqual([now.content.groups, now.types.types, now.types.sectionsFor, now.types.fieldsFor, now.things.things], [[], [], {}, {}, {}],
      'and owns nothing of its own any more')
    assert.equal(now.rules.totalBudget, 15, 'the budget is a DECISION and stays — a book only proposes one')
    assert.deepEqual(now.rules.groupRules, {}, 'the per-row rules on rows that MOVED went with them, as that row\'s own proposal')
    assert.deepEqual(Object.keys(now.themes.groupThemes).length, 8, 'the eight row themes stay (a book proposes no look) with their keys rewritten')
    // THE FAITHFULNESS TEST
    assert.deepEqual(faithful(await flatten('vampire')), wasVampire,
      'games/vampire plays EXACTLY what it played: every sheet, section, field, thing, row, rule, look, the budget and the sheet it builds — id-free, because ids are the one thing this route changes')
    const shelf = await shelfOfNow()
    assert.deepEqual(validateBook(shelf['night-world']['1'], shelf).map(problemText), [], 'the new book validates')
    assert.deepEqual(validateGame({ own: now, books: [shelf['night-world']['1']] }).map(problemText), [], 'and so does the game that now stands on it')
    // the honest half: vampire's 64 things name pictures that live in games/vampire/assets
    const pictures = lifted.body.left.filter(line => line.includes('names the picture'))
    assert.ok(pictures.length > 0 && pictures.every(line => line.endsWith('so it travels as a filename only.')),
      `${pictures.length} sentences say a picture could not travel (assets are out of scope this stage)`)
    assert.deepEqual(lifted.body.left.filter(line => !line.includes('names the picture')), [
      'themes stay with games/vampire — a book proposes no look, so the page\'s own look and 8 row themes are the game\'s (the keys that moved have been rewritten).',
      'rules.totalBudget stays with games/vampire — 15 is the game\'s DECISION and a book only proposes a budget; propose one on the book if you want it to travel.'
    ], 'and the two structural sentences, in the table\'s order')

    // ── games/dino: the case where almost nothing can travel ──
    const wasDino = faithful(await flatten('dino'))
    const overridesBefore = Object.keys(readGameSet(join(GAMES, 'dino')).content.rowOverrides)
    const dino = await api(origin, '/api/games/dino/extract', { method: 'POST', body: { title: 'Dino Extras' } })
    assert.equal(dino.status, 201)
    assert.deepEqual(dino.body.moved, { types: 0, things: 10, rows: 0 }, 'dino owns 10 things and nothing else — its four row facts are overrides')
    assert.deepEqual(dino.body.left.filter(line => !line.includes('names the picture')), [
      '4 row overrides stay with games/dino — an override answers a BOOK\'s proposal, and a book may not override another book.',
      'things.order stays with games/dino — arranging a shelf is the game\'s taste over the MERGED shelf and a book may not carry one; 2 ids in it named a thing that moved and have been rewritten, so the order still holds.',
      'themes stay with games/dino — a book proposes no look, so the page\'s own look and 2 row themes are the game\'s (the keys that moved have been rewritten).',
      'content.sheet stays with games/dino — a book proposes sheets and never says which one the player builds; games/dino still builds "basic:character".'
    ], 'FOUR sentences for the four kinds of thing that cannot travel — this is the feature being honest about what it did not do')
    const dinoNow = readGameSet(join(GAMES, 'dino'))
    assert.deepEqual(Object.keys(dinoNow.content.rowOverrides), overridesBefore, 'the four override slots are untouched — they key on a BOOK\'s row ids, which did not move')
    assert.deepEqual(dinoNow.content.books.at(-1), { name: 'dino-extras', edition: 1 }, 'the new book is pinned LAST, which is where the game\'s own layer was in the merge order')
    assert.deepEqual(JSON.parse(readFileSync(join(SHELF, 'dino-extras', '1', 'book.json'), 'utf8')).requires, dinoNow.content.books.slice(0, -1),
      'and the book REQUIRES exactly what the game pinned before, at the same editions — which is what keeps the layer order')
    assert.deepEqual(faithful(await flatten('dino')), wasDino, 'and games/dino plays exactly what it played, overrides and arrangement included')

    // ── every refusal, writing nothing ──
    const before = { shelf: treeHash(SHELF), games: treeHash(GAMES) }
    const refusals = [
      ['dino', { title: 'Dino Extras' }, 409, 'a book named "dino-extras" is already on the shelf', undefined],
      ['dino', { title: '  ' }, 400, 'title does not make a book name', [{ path: 'title', message: 'must be a non-empty string' }]],
      ['dino', { title: 'Book' }, 400, 'title does not make a book name', [{ path: 'title', message: '"book" is a name the editor keeps for itself' }]],
      ['dino', { title: 'X', name: 'Bad Name' }, 400, 'name does not make a book name', [{ path: 'name', message: '"Bad Name" is not a book name (lowercase letters, digits and single dashes)' }]],
      // NOTHING LEFT TO LIFT: dino was just emptied, so a second extract has nothing to carry
      ['dino', { title: 'Again' }, 400, 'games/dino has nothing of its own that a book could carry — no sheets, no rows, and no things on a sheet the shelf defines.', undefined],
      // A GAME AT AN OLDER SCHEMA. A book is NEVER migrated, so one born from stale shapes
      // would be stale for ever in an edition that freezes the moment a game pins it — and the
      // refusal is validate.js's own sentence, the one already on the author's screen.
      ['stale', { title: 'Old World' }, 400, 'games/stale does not fit the schema, so there is nothing safe to lift out of it',
        FILES.map(file => ({ path: `games/stale.${file}.version`, message: `must be ${SCHEMA_VERSION} (found 4) — open the game in the editor and Save to migrate it` }))]
    ]
    for (const [game, body, status, error, problems] of refusals) {
      const got = await api(origin, `/api/games/${game}/extract`, { method: 'POST', body })
      assert.deepEqual(got, { status, body: problems === undefined ? { ok: false, error } : { ok: false, error, problems } }, `POST /api/games/${game}/extract ${JSON.stringify(body)}`)
      assert.equal(treeHash(SHELF), before.shelf, 'a refused extract writes nothing on the shelf')
      assert.equal(treeHash(GAMES), before.games, 'and nothing in any game — both halves land or neither does')
    }
    assert.deepEqual(await api(origin, '/api/games/dino/extract', { method: 'POST', body: '{' }), { status: 400, body: { ok: false, error: 'Body is not valid JSON' } })
    assert.deepEqual(await api(origin, '/api/games/nope/extract', { method: 'POST', body: { title: 'X' } }), { status: 404, body: { ok: false, error: 'Unknown CYOA "nope"' } })
    assert.deepEqual(await api(origin, '/api/games/dino/extract'), { status: 404, body: { ok: false, error: 'Unknown route' } }, 'GET is not a route')
    assert.equal(treeHash(SHELF), before.shelf)
    assert.equal(treeHash(GAMES), before.games)
    ok(`M21 POST /api/games/<g>/extract — "save as a book": games/vampire's whole world (8 sheets, 64 things, 8 rows, every id a UUID) is lifted into books/night-world/1 with EVERY defining id re-minted as <book>:<noun>-<ordinal> from MINTS' own nouns, not one uuid left anywhere in it, the manifest in the seed's key order requiring exactly what the game pinned, canonical bytes throughout — and the game keeps its budget, its look and its declared sheet, owns nothing of its own, pins the new book LAST, and PLAYS EXACTLY WHAT IT PLAYED, measured by an id-free projection of the flattened merge (every sheet, section, field, thing with its cost and picture, every row with its rule, gate and look, the budget and the sheet it builds); games/dino — 10 things and four row facts that are all overrides — is lifted with four \`left\` sentences saying in the author's own language what could not travel and why, its overrides and arrangement untouched, and it too plays exactly what it played; and ${refusals.length + 3} refusals — already on the shelf, a blank title, a reserved word, a bad given name, a game with nothing of its own, a game at an older schema refused in validate.js's own words (a book is never migrated), "{", an unknown game and GET — each at its status with its sentence, and after every one the shelf AND every game are byte-identical, so the two halves land together or not at all`)
  } finally { stop() }
}

// ── I4 the editor opens a BOOK, through its own paint (NEW, stage 4; gap 9) ──
// I3 is the only check in the suite driven through the EDITOR'S REAL PAINT, and until now the
// child behind it hard-coded a game's five drawers, `editorState.game` and the `#<game>/<tab>`
// hash — so the one claim that matters most for a shelf an oracle hashes had nowhere to live:
// OPENING A BOOK AND LOOKING AT IT MUST WRITE NOTHING. That is I3(a)'s claim over a game's five
// files, asked of a book's four, and it is stronger here than there: a game's files are the
// author's to dirty, and a FROZEN edition's are not.
//
// The child is the same child (`--edit`), opening a SUBJECT instead of a game — see OPENERS.
// It is driven twice over each edition: with the freeze census EMPTY (nobody pins it, so the
// editor may write) and with it naming a game (frozen, so `repairBuckets` — the one write a
// paint is allowed — must hold its hand). Both must leave every byte where it was.
{
  const SHELF = copyShelf(join(WORK, 'i4-shelf', 'books'))
  const before = treeHash(SHELF)
  // dinosaur-age is the one book on the shelf that ships all four files, so it is the one
  // this child can open: the editor's REAL loader stands a container in for an absent
  // optional file (loadData.js's standIn) and this child reads the files itself rather than
  // re-implementing that rule — see the note at the end of this block.
  const editions = [1, 2]
  const census = [['editable', []], ['frozen', [{ game: 'dino', name: 'dinosaur-age', edition: 1 }]]]
  const TABS_THAT_PAINT = ['rows', 'types', 'things', 'books']
  const onDisk = (edition) => Object.fromEntries(BOOK_FILE_NAMES.map(file =>
    [file, readFileSync(join(SHELF, 'dinosaur-age', String(edition), `${file}.json`), 'utf8')]))
  let paints = 0
  assert.deepEqual(TABS_THAT_PAINT, ['rows', 'types', 'things', 'books'], 'all four tabs of the editor, none of them skipped')
  for (const edition of editions) {
    const text = onDisk(edition)
    for (const [state, pinnedBy] of census) {
      // EVERY tab, with the Things tab standing on a sheet this book fills
      for (const tab of ['rows', 'types', 'things', 'books']) {
        const run = editorRunBook(SHELF, 'dinosaur-age', edition, { tab, type: 'basic:origin', steps: [], pinnedBy })
        paints += 1
        assert.deepEqual(run.warnings, [], `books/dinosaur-age/${edition} ${state}, ${tab}: the paint says nothing`)
        assert.deepEqual(run.paint.faults, [], `books/dinosaur-age/${edition} ${state}, ${tab}: and nothing is wrong with the book`)
        assert.equal(run.paint.tab, tab, 'the hash #book/<name>/<edition>/<tab> really named this tab')
        // (a) READING MUST NOT WRITE — the claim, over the book's four drawers
        assert.deepEqual(Object.keys(run.own), BOOK_FILE_NAMES, 'the subject\'s own drawers are a book\'s four, in the table\'s order')
        BOOK_FILE_NAMES.forEach(file => assert.equal(serialize(run.own[file]), text[file],
          `books/dinosaur-age/${edition} ${state}, ${tab}: ${file}.json — a no-edit paint is byte-identical`))
      }
    }
    // the paint really happened, and it is the BOOK's paint: the Things tab draws the book's
    // own ten things plus the sheets it stands on, and a borrowed card is LOCKED while the
    // book's own are not — `isOwn` asking the subject table for its label rather than
    // comparing against GAME_LAYER is the whole reason that works for a book at all.
    const things = editorRunBook(SHELF, 'dinosaur-age', edition, { tab: 'things', type: 'basic:origin', steps: [], pinnedBy: [] })
    assert.equal(things.addLabel, '+ Add Origin', 'the pane\'s Add button is the merged sheet\'s own, in a book exactly as in a game')
    assert.equal(things.paint.cards, 6, 'the six dinosaurs this book puts on Basic\'s Origin sheet')
    assert.equal(things.paint.locked, 0, 'every one of them is this book\'s own, so none is locked — `isOwn` is asking the subject table for its layer label')
    const rows = editorRunBook(SHELF, 'dinosaur-age', edition, { tab: 'rows', steps: [], pinnedBy: [] })
    assert.equal(rows.paint.cards, 5, 'the Rows tab draws the page card plus this book\'s four proposed rows')
    const borrowed = editorRunBook(SHELF, 'dinosaur-age', edition, { tab: 'types', steps: [], pinnedBy: [] })
    assert.equal(borrowed.paint.cards, 7, 'the Types tab draws the seven sheets Basic defines')
    assert.equal(borrowed.paint.locked, 7, 'and EVERY one is locked — Dinosaur Age defines no sheet of its own, it only adds fields to Basic\'s')
    // the Books tab asks for the shelf rather than guessing at it
    const books = editorRunBook(SHELF, 'dinosaur-age', edition, { tab: 'books', steps: [], pinnedBy: [] })
    assert.deepEqual(books.paint.actions, [['readShelf']], 'the Books tab asks the server what else is on the shelf, once')
  }
  assert.equal(treeHash(SHELF), before, `${paints} paints of a book and the scratch shelf is byte-identical — the editor wrote nothing at all`)
  ok(`I4 the editor opens a BOOK, through its own paint: the ${paints} paints of Dinosaur Age's two editions — all four tabs × two freeze states × two editions — each say nothing, find no fault, land on the tab the #book/<name>/<edition>/<tab> address named, and hand back the subject's OWN four drawers byte-identical to the four files on disk; the scratch shelf is byte-identical afterwards, so READING NEVER WRITES holds for a book exactly as I3(a) holds it for a game, frozen edition included (repairBuckets' one permitted write is gated on \`editable\`); and the paint is really a book's — the Rows tab draws its four proposals, the Things pane's Add button is the merged sheet's own with this book's six dinosaurs editable, and all seven cards on the Types tab are borrowed ones drawn read-only, which is \`isOwn\` asking the subject table for its layer label instead of comparing against GAME_LAYER`)
  // WHAT THIS CHECK DOES NOT REACH, named so the next person does not have to find it twice:
  skip('I4(absent) a book whose optional data file is not on disk (basic/1, stats/1 ship book.json + types.json only) — this child reads the four files itself, so it does not exercise dinoEdit/loadData.js\'s standIn/bookBody pair. Owed as an I4 that drives loadBookEdition over real HTTP against a started server, which would cover the stand-in AND the freeze census through pinnersOf')
}

// ── M20 the freeze speaks ONE sentence, in two files (NEW, stage 4) ──
// server/books.js writes the three sentences of the freeze and every refusal the server sends
// carries one. dinoEdit/books.js holds a SECOND COPY of all three, and its own comment says
// why and calls it a debt: the editor needs the same words BEFORE it asks the server (a frozen
// edition must say why it is read-only the moment it opens, and a delete must say what it
// would refuse before the author clicks), server/ is not served to the browser, and
// engine/config — the one place both sides can read — has no door for a shelf sentence yet.
//
// ONE SENTENCE PER FAULT IN ONE PLACE is a house rule, and two copies is exactly the state
// that rots: the server's refusal and the editor's banner drift a word apart and nobody
// notices, because each half is green on its own. Until the handoff lands (move the three into
// engine/config beside the shelf's four grammars, which live there for this very reason with
// oracle N2 pinning them equal, and delete the editor's block), THIS is what holds them
// together. It pins both halves, two different ways:
//   the SERVER's by VALUE, over a table of inputs, against the words M13 asserts over HTTP;
//   the EDITOR's by TEXT, because dinoEdit/books.js imports "/config/…" and no node process
//   can load it without the dev server's url mapping — so its source is read and compared.
// Quote style is normalised (the two files differ only in " versus ') and nothing else is.
{
  const WANTED = ['andList', 'gamesThat', 'pinVerb', 'frozenEditionSentence', 'pinnedEditionSentence', 'pinnedBookSentence']
  const sentenceLines = (path) => readFileSync(path, 'utf8').split('\n')
    .filter(line => WANTED.some(name => line.startsWith(`const ${name} `) || line.startsWith(`const ${name}=`) || line.startsWith(`export const ${name} `) || line.startsWith(`export const ${name}=`)))
    .map(line => line.replace(/"/g, "'").replace(/\s+/g, ' ').trim())
  const serverSide = sentenceLines(join(DINO_DIR, 'server', 'books.js'))
  const editorSide = sentenceLines(join(DINO_DIR, 'dinoEdit', 'books.js'))
  assert.equal(serverSide.length, WANTED.length, `server/books.js writes all ${WANTED.length} lines, once each`)
  assert.deepEqual(editorSide, serverSide, 'dinoEdit/books.js\'s copy of the freeze sentences is the server\'s own, word for word — if this fails, the two have drifted and the author reads one wording before the click and another after it')
  // and the SERVER's half by value, so the words M13 saw over HTTP are the words this file
  // pins — including the plurals, which are the part a second copy gets wrong first
  const one  = [{ game: 'dino', name: 'basic', edition: 1 }]
  const many = [{ game: 'dino', name: 'basic', edition: 1 }, { game: 'space', name: 'basic', edition: 2 }, { game: 'vampire', name: 'basic', edition: 2 }]
  assert.equal(frozenEditionSentence(one, 2), 'games/dino pins this edition — it is frozen. Cut edition 2 to change it.')
  assert.equal(frozenEditionSentence(many, 7), 'games/dino, games/space and games/vampire pin this edition — it is frozen. Cut edition 7 to change it.')
  assert.equal(pinnedEditionSentence(one), 'games/dino pins this edition. Un-pin it first, or delete the whole book.')
  assert.equal(pinnedEditionSentence(many), 'games/dino, games/space and games/vampire pin this edition. Un-pin it first, or delete the whole book.')
  assert.equal(pinnedBookSentence(one), 'games/dino pins edition 1 — un-pin it first.')
  assert.equal(pinnedBookSentence(many), 'games/dino pins edition 1, games/space pins edition 2 and games/vampire pins edition 2 — un-pin them first.')
  // CHROME SPEAKS TITLES, FAULT PATHS SPEAK FOLDERS (§6): all three name a game by its
  // FOLDER, because the folder is the thing the author has to go and open
  assert.ok([frozenEditionSentence(one, 2), pinnedEditionSentence(one), pinnedBookSentence(one)].every(line => line.includes('games/dino')),
    'a fault path speaks folders — every one of the three names games/<folder>, never a title')
  ok(`M20 the freeze speaks ONE sentence in two files: server/books.js's ${WANTED.length} lines (the list formatter, the two helpers and the three sentences) are byte-identical to dinoEdit/books.js's copy once quote style is normalised — the editor needs the words before it asks and cannot import them, and that debt is what this check holds together until they move into engine/config; and the server's three are pinned BY VALUE in singular and plural (one game, three games — the half a copy gets wrong first), each naming a game by its FOLDER as §6 requires, which are the same bytes M13 read back over HTTP`)
}

// ── I5 the home screen's LIBRARY, painted by its own code (NEW, stage 4) ──
// The Library is where an author meets the shelf, and until stage 4 it was a list that could
// not be clicked. It now carries the whole lifecycle — Edit, Cut, Rename, Delete, New book —
// and THE ONE PLACE IN THE EDITOR WHERE THE FREEZE IS A FACT ON SCREEN rather than a refusal
// after a click. So what it SAYS is the product, and that is what this check reads.
//
// It is driven through renderLibrary itself, which is a pure function of two receipts (GET
// /api/books and GET /api/games) and fetches nothing — only a click does. So one fixture holds
// a frozen edition, an unpinned one, an unreadable one, a folder the grammar refuses and a
// book with a namespace problem all at once, which no arrangement of files on disk could.
{
  const shelf = {
    ok: true,
    books: [
      { name: 'basic', title: 'Basic', editions: [
        // edition 1 is pinned by games/dino below; edition 2 is not
        { edition: 1, title: 'Basic', requires: [], sheets: 7, sectionsAdded: 0, fieldsAdded: 0, things: 0, rows: 0, budget: null, problems: [] },
        { edition: 2, title: 'Basic', requires: [], sheets: 7, sectionsAdded: 0, fieldsAdded: 0, things: 0, rows: 0, budget: null, problems: [] }
      ] },
      { name: 'broken', title: 'Broken', editions: [{ edition: 1, error: 'book.json cannot be read (ENOENT)' }] },
      { name: 'Bad Name', error: 'lowercase letters, digits and single dashes — rename the folder' },
      { name: 'sad', title: 'Sad', editions: [{ edition: 1, title: 'Sad', requires: [{ name: 'basic', edition: 1 }],
        sheets: 0, sectionsAdded: 1, fieldsAdded: 2, things: 3, rows: 4, budget: 10,
        problems: [{ path: 'types.types[0].id', message: '"x" is not in this book\'s namespace (sad:)' }] }] }
    ]
  }
  const games = [{ name: 'dino', books: ['basic 1'] }]
  const painted = libraryRun({ shelf, games })
  assert.deepEqual(painted.warnings, [], 'the Library paints silently')
  assert.equal(painted.heading, 'Library')
  assert.deepEqual(painted.cards.map(card => card.title), ['Basic', 'Broken', 'Bad Name', 'Sad'], 'one card per folder, in the listing\'s order — a folder the author made is a folder the author sees')
  const [basic, broken, badName, sad] = painted.cards

  // ── the FREEZE, as a fact on screen ──
  // edition 1 is pinned: no Edit, no Delete edition, the border's own sentence, and a door in
  // (looking at a book a game depends on is the most ordinary thing an author does)
  assert.deepEqual(basic.rows[0], ['Open read-only → #book/basic/1/rows', 'Cut edition 3 as a copy'],
    'a PINNED edition offers Open read-only and the cut — and no Edit and no Delete edition at all')
  assert.deepEqual(basic.frozen, ['games/dino pins this edition — it is frozen. Cut edition 3 to change it.'],
    'and says WHY, in the border\'s own words, naming the game by its folder (§6) and the number the cut would take')
  // edition 2 is not pinned: the same book, the other answer
  assert.deepEqual(basic.rows[1], ['Edit → #book/basic/2/rows', 'Cut edition 3 as a copy', 'Delete edition'],
    'the very same book one edition along, which nobody pins: Edit, and a Delete edition')
  // BOTH cuts say edition 3 — one past the HIGHEST folder, which is the number the route
  // actually makes, so the sentence and the folder can never disagree
  assert.deepEqual(basic.facts, ['defines ids under basic:', 'edition 1 · requires nothing · 7 sheets', 'edition 2 · requires nothing · 7 sheets'],
    'the NAMESPACE is on screen — a book\'s hardest rule, and it was nowhere before — above one line per edition')
  assert.deepEqual(basic.rows[2], ['Rename…', 'Delete book…'], 'and the two whole-book acts, which open a panel rather than a confirm()')

  // ── the broken ones: every folder is shown, with its problem instead of its facts ──
  assert.deepEqual(broken.facts, ['defines ids under broken:', 'edition 1 · ⚠ book.json cannot be read (ENOENT)'])
  assert.deepEqual(broken.rows[0], ['Delete edition'], 'an edition that cannot be read offers no Edit and no cut — there is nothing to copy — but may be deleted')
  assert.deepEqual([badName.facts, badName.rows], [[], []], 'a folder whose NAME the grammar refuses offers nothing at all…')
  assert.deepEqual(badName.hints, ['lowercase letters, digits and single dashes — rename the folder'], '…and says the one thing to do about it')
  assert.equal(badName.path, 'books/Bad Name', 'while still naming the folder, so the author can find it')
  assert.deepEqual(sad.facts, ['defines ids under sad:',
    'edition 1 · requires Basic 1 · adds 1 section · adds 2 fields · 3 shelf entries · proposes 4 rows, budget 10 · ⚠ 1 problem — types.types[0].id: "x" is not in this book\'s namespace (sad:)'],
    'an edition that READS but does not validate says everything it brings AND the validator\'s own first sentence — CHROME SPEAKS TITLES, so its requirement is "Basic 1" and not "basic 1"')
  assert.deepEqual(sad.rows[0], ['Edit → #book/sad/1/rows', 'Cut edition 2 as a copy', 'Delete edition'], 'and it is still editable, which is how it gets fixed')

  // ── New book: the twin of New CYOA, and its picker ──
  assert.equal(painted.form.heading, 'New book')
  assert.deepEqual(painted.form.labels.slice(0, 2), [
    'Title — the folder name is made from it ("Dinosaur Age" → books/dinosaur-age)',
    'Folder name (optional) — it is also the id namespace: lowercase letters, digits and single dashes'
  ], 'the form says what the server will do with each answer, including that the folder name IS the namespace')
  assert.deepEqual(painted.form.offers, ['Basic 2'],
    'the requires picker offers the LATEST CLEAN edition of each book and nothing else: Basic 2 — not Basic 1, not the unreadable Broken, not the mis-named folder, and not Sad, which reads but does not validate')

  // ── the two empty answers ──
  const bare = libraryRun({ shelf: { ok: true, books: [] }, games: [] })
  assert.deepEqual(bare.cards, [])
  assert.deepEqual(bare.hints, ['No books on the shelf yet — make the first one below.'], 'an empty shelf points at the form instead of showing nothing')
  assert.equal(bare.form.heading, 'New book', 'and the form is still there — the first book has to be makeable')
  const unreadable = libraryRun({ shelf: { ok: false, error: 'no answer from the server' }, games: [] })
  assert.deepEqual(unreadable.cards, [])
  assert.deepEqual(unreadable.hints, ['Could not read the shelf — no answer from the server'], 'a shelf that cannot be read says so in the receipt\'s own words')
  assert.equal(unreadable.form, null, 'and offers no New book form — a create whose picker could not be built would be a form that lies')
  ok(`I5 the home screen's LIBRARY, painted by its own code: ${painted.cards.length} cards from one receipt holding a pinned edition, an unpinned one, an unreadable one, a folder the grammar refuses and a book that reads but does not validate. THE FREEZE IS A FACT ON SCREEN, which is the one thing the editor never said before: a pinned edition offers "Open read-only" and the cut and NOTHING else, with the border's own sentence naming games/dino by its folder and the number the cut will take; the same book one edition along offers Edit and Delete edition. Every card carries the NAMESPACE line ("defines ids under basic:"), a book's hardest rule and nowhere on screen until now. A broken edition offers a delete and no cut, a mis-named folder offers only the sentence that fixes it, and an edition with a namespace problem shows everything it brings plus the validator's own first sentence with its requirement spoken as a TITLE (§6). The New book form says what the server does with each answer, and its picker offers the LATEST CLEAN edition of each book only. An empty shelf points at the form; a shelf that cannot be read says so and offers no form at all`)
  skip('I5(clicks) the Library\'s buttons — Cut, Delete edition, Rename…, Delete book… and Create all fetch on click, and this child has no server behind it. The routes they call are M13–M21\'s subject, end to end and refusal by refusal; what is owed is the half in between: that the panel\'s PREVIEW (the edition, id and pin counts it shows before Confirm) matches what the route then does')
}

// ── I6 the SUBJECT TABLE resolves every attachment (NEW, stage 4; spec §2's owed sweep) ──
// THE SWEEP THE SPEC SAYS IS OWED, and the only thing standing between the editor and a
// console warning on every paint. V1(e) in the fast half sweeps attachments against
// FILE_SHEETS and says so out loud: `entry.file` on an attachment is a GAME file name, so all
// that sweep ever proved is "it resolves FOR A GAME". A book has no rules.json and no themes at
// all, and resolves an attachment through `SUBJECTS[kind].drawers` instead — a table of ROLES —
// so the second half of the sweep belongs here, with the table, and it could not live in the
// fast half because subject.js reads FILE_SHEETS and calls the merge through the absolute
// "/config/…" urls only the dev server resolves.
//
// THE TWO MEANINGS ONE KEYSTROKE APART, which is what this protects (spec §11):
//   drawers[role] === null  — "this subject has none of that, BY DESIGN". Silent: a book's
//                             Look card simply does not appear.
//   drawers[role] undefined — "no subject knows this role". Warn once, by name, FAIL CLOSED.
// A role an attachment names that NO row answers is the second case happening on every paint,
// and nothing before this check would have said a word about it.
{
  const table = subjectTable()
  const KINDS = ['game', 'book']
  assert.deepEqual(Object.keys(table), KINDS, 'the table has a row per kind of subject the page can open, and no "none" row')
  // THE CAP, said in the spec and worth a check so the next person meets it: 14 columns, and
  // the 15th is the signal to split into per-concern tables rather than to add a 15th.
  KINDS.forEach(kind => assert.equal(table[kind].columns.length, 14, `SUBJECTS.${kind} is at the stated cap of 14 columns — the 15th is the signal to split the table, not to widen it`))
  assert.deepEqual(table.game.columns, table.book.columns, 'and both rows answer for exactly the same columns — a row that skipped one would be a branch somewhere else')

  // THE SWEEP. Every attachment entry on every sheet, for every kind.
  const attachments = Object.values(SHEETS).flat().filter(entry => entry.type === 'attachment')
  assert.ok(attachments.length > 0, `there are attachments to sweep (${attachments.length})`)
  const sheetsOf = { game: FILE_SHEETS, book: BOOK_FILE_SHEETS }
  let resolved = 0, silent = 0
  KINDS.forEach(kind => {
    const { drawers, files } = table[kind]
    attachments.forEach(entry => {
      assert.ok(Object.hasOwn(drawers, entry.file), `SUBJECTS.${kind}.drawers has no row for the role "${entry.file}" — cabinetOf would warn once and fail closed on every paint`)
      const drawer = drawers[entry.file]
      if (drawer === null) { silent += 1; return }                  // "none of that, by design" — the Look card does not appear
      assert.ok(files.includes(drawer), `SUBJECTS.${kind}.drawers.${entry.file} names the drawer "${drawer}", which is not one of this subject's own files`)
      const cabinets = (sheetsOf[kind][drawer] ?? []).filter(cabinet => cabinet.type === 'cabinet' && cabinet.key === entry.cabinet && cabinet.of === entry.of)
      assert.equal(cabinets.length, 1, `attachment ${entry.file}.${entry.cabinet} (of "${entry.of}") resolves to exactly one cabinet in a ${kind}'s ${drawer}.json`)
      resolved += 1
    })
    // every role a row answers is either null or one of that subject's own files, and every
    // drawer it names really is on the table the same row declares
    Object.entries(drawers).forEach(([role, drawer]) => assert.ok(drawer === null || files.includes(drawer),
      `SUBJECTS.${kind}.drawers.${role} must be null or one of the subject's own files`))
    files.forEach(file => assert.ok(Object.hasOwn(sheetsOf[kind], file), `SUBJECTS.${kind}.files names "${file}", which its own fileSheets table does not have`))
  })
  // the one break this whole mechanism exists for, named rather than implied
  assert.equal(table.book.drawers.themes, null, 'a BOOK has no themes at all, and `null` says so SILENTLY — groupSchema carries a themes attachment hard-wired to a file a book does not have')
  assert.equal(table.book.drawers.rules, 'proposals', 'and a book\'s groupRules live in proposals.json — the same key and the same `of` as a game\'s rules.json, measured, which is why the Rules card draws unchanged')
  assert.equal(table.game.drawers.rules, 'rules')

  // THE REST OF THE TABLE, where a wrong cell is a silent fork rather than a warning
  assert.deepEqual(table.game.files, FILE_NAMES, 'a game\'s drawers are FILE_NAMES — read from the contract, never typed out')
  assert.deepEqual(table.book.files, ['book', ...BOOK_FILES], 'and a book\'s are the manifest first, then BOOK_FILES — the order BOOK_FILE_SHEETS is keyed in')
  assert.deepEqual([table.game.mintsIds, table.book.mintsIds], [false, true], 'a game mints UUIDs and a book mints <book>:<noun>-<n> — the one place the two layers differ in KIND')
  assert.deepEqual([table.game.keyword, table.book.keyword], ['', 'book'], 'a game is addressed by its own folder name; a book spends its first segment on the literal `book`, which is why RESERVED holds it')
  assert.deepEqual([table.game.title, table.book.title], ['A Game', 'A Book'], 'CHROME SPEAKS TITLES (§6): a game\'s pageTitle, a book\'s title')
  // THE FREEZE, from the editor's side: `editable` asked with an empty census, a census naming
  // a game, and a census that was never taken. NULL MUST READ AS FROZEN — opening an edition
  // before the answer arrives has to write nothing, which is the only safe direction when the
  // thing at risk is a folder a game depends on.
  assert.deepEqual(table.game.editable, [true, true, true], 'a game is always the author\'s to change, whatever any census says')
  assert.deepEqual(table.book.editable, [true, false, false],
    'a book edition is editable only when the census says NOBODY pins it — and a census that was never taken (null) reads as FROZEN, so a paint that arrives before the answer writes nothing')
  ok(`I6 the subject table resolves every attachment (spec §2's owed sweep): over ${KINDS.length} kinds × ${attachments.length} attachment entries, every \`entry.file\` is a ROLE the drawers table answers — ${resolved} resolve to exactly one cabinet with the matching key and \`of\` in a drawer the subject really has, and ${silent} resolve to \`null\`, which is "this subject has none of that, by design" and draws nothing SILENTLY. That is the whole distance between the two meanings one keystroke apart: a role no row answers is \`undefined\`, a warning on every paint, and V1(e) could never have seen it because it sweeps a GAME's file names. Both rows answer for exactly the same 14 columns — the cap the spec states, so the 15th is the signal to split the table — and the cells a wrong value forks silently are pinned too: a game's drawers are FILE_NAMES and a book's the manifest plus BOOK_FILES, a game mints UUIDs and a book <book>:<noun>-<n>, a book's Rules card draws into proposals.json and its Look card does not exist, and \`editable\` says a book edition is the author's ONLY when the freeze census says nobody pins it — a census never taken reads as frozen`)
}

// ── E10 ignore rules (once) ──
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

// ── M8 launch.json (once): ONE "cyoa" entry starts the server with no game and no shelf on the command line ──
{
  const launch = JSON.parse(readFileSync(join(GIT_ROOT, '.claude', 'launch.json'), 'utf8'))
  const names = launch.configurations.map(c => c.name)
  assert.ok(names.includes('cyoa'), 'a "cyoa" entry')
  assert.ok(names.includes('dist'), 'the "dist" entry is kept — it proves the folder under a foreign static server')
  assert.ok(!names.includes('dino') && !names.includes('vampire'), 'the per-game entries are gone')
  const cyoa = launch.configurations.find(c => c.name === 'cyoa')
  assert.deepEqual([cyoa.runtimeExecutable, cyoa.runtimeArgs, cyoa.port], ['node', ['cyoa/DinoCYOA/server/server.js'], 3000], 'node server.js, no game name and no shelf argument, port 3000')
  ok('M8 launch.json: one "cyoa" entry = node cyoa/DinoCYOA/server/server.js on 3000, no game or shelf argument; "dist" kept; no dino/vampire entries')
}

// ── M9 / M12 scratch only (once, after every server has been stopped) ──
// Every server above ran over a scratch root, every export went to a scratch
// folder, and every shelf a tool could write to was a COPY — the hashes taken
// before the first check say so.
//
// M12 RE-AIMED (stage 4, §10 step 1). It used to be read as "an edition is frozen",
// and it never was that: no route, no tool and no test COULD write to a shelf, so
// byte-identity was free and the check proved nothing about freezing. What it says,
// and all it ever said, is TEST HYGIENE — NO CHECK IN THIS FILE WRITES THE REAL
// SHELF. That claim keeps its whole value once the editor can author books, and it
// is worth keeping: a run that scribbled on books/ would corrupt the owner's data
// and every T-check's subject at once. The POSITIVE guarantee (a pinned edition is
// frozen, and the write route refuses it) is a different and narrower promise, and
// it landed with the first write route, as M13 — a pinned edition refuses a save, a delete of
// itself and a delete of its book, each naming the pinning game, each leaving every byte.
//
// The danger in restating it is that it becomes vacuous: "the shelf did not move"
// is also true of a run where nothing writes a shelf at all, which is precisely the
// world this check was born in. So the mechanism is asserted to be IN USE — copies
// were taken, every server was pointed at one, none of them is the real shelf, and
// at least one was really written. Had that write gone to books/ instead, the hash
// below would have moved and this check would be red, which is the property asked of
// it: it FAILS if a test writes the real shelf, and it fails if nobody writes at all.
{
  assert.equal(treeHash(join(DINO_DIR, 'games')), realGames, 'games/ is byte-identical to before the run')
  assert.equal(existsSync(realDistDir) ? treeHash(realDistDir) : null, realDist, 'dist/ is byte-identical to before the run')
  ok('M9 the real games/ and dist/ are untouched — every write went to the scratch roots')
  assert.equal(treeHash(REAL_BOOKS), realBooks, 'no check wrote the real books/ — it is byte-identical to before the run')
  assert.ok(scratchShelves.length > 0, 'the run took scratch shelves — without them this check would be vacuous')
  scratchShelves.forEach(dir => {
    assert.ok(dir.startsWith(WORK + sep), `a scratch shelf lives in the work dir, not at ${dir}`)
    assert.ok(dir !== REAL_BOOKS && !dir.startsWith(REAL_BOOKS + sep) && !REAL_BOOKS.startsWith(dir + sep), `${dir} is nowhere near the real shelf`)
  })
  assert.ok(servedShelves.length > 0, 'the run started servers')
  servedShelves.forEach(dir => assert.ok(dir.startsWith(WORK + sep), `a server was pointed at ${dir} — every CYOA_BOOKS_DIR is a scratch shelf, never books/`))
  const writtenShelves = scratchShelves.filter(dir => existsSync(dir) && treeHash(dir) !== realBooks)
  assert.ok(writtenShelves.length > 0, 'and a scratch shelf was really written — if the writing had gone to books/ the hash above would have moved')
  ok(`M12 no check writes the real shelf: books/ is ${listFiles(REAL_BOOKS).length} files with the same sha256s as before the first check; ${scratchShelves.length} scratch copies were taken, all ${servedShelves.length} servers were pointed at a shelf inside the work dir and never at books/, and ${writtenShelves.length} of the copies really were written — test hygiene, proven IN USE rather than by nobody trying. An edition being FROZEN is a different and narrower promise and it is M13's`)
}

const tail = `${skipped.length > 0 ? ` (${skipped.length} skipped: ${skipped.join('; ')})` : ''} (work dir: ${WORK})`
if (blockedChecks.length > 0) {
  console.log(`\n${checks} checks ran${tail}`)
  console.log(`${blockedChecks.length} check(s) BLOCKED by a bug in another package's file — the assertion says what the code must do:`)
  blockedChecks.forEach(line => console.log(`  FAIL ${line}`))
  process.exitCode = 1
} else {
  console.log(`\nall ${checks} checks passed${tail}`)
}
