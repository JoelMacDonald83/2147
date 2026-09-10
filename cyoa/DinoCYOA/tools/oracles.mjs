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
//   W1 the shelf's placement fields (NEW) Gear ships quantity/number/1, Skills level/number/1, and nobody else a `quantity`
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
//   M12 the shelf is read-only (NEW)  books/ is byte-identical after the whole run
//
// RETIRED, with the reason: H1–H4 (tools/restructure-v4.mjs). That script's
// PRECONDITION — a v4 set read from the working tree's border — no longer exists
// at SCHEMA_VERSION 5: migrateSet climbs straight past 4, so restructure-v4 can
// never be handed the shape it was written for. Its RESULT is pinned instead by
// the v4 data commit (V4_COMMIT) that A3 and C5 read, and the "one-off data
// script" oracle is now the D-checks over tools/rebuild-dino-v5.mjs. S1 drops
// its "restructured" set with them.
//
// NEW (v7): two more child modes, and both are about what a PERSON sees.
//   --paint  the engine's real app.js and view.js over a tiny hand-written DOM, so
//            W7, W9 and E14 can read the words and classes on a card and press the
//            button a player would press. The DOM is deliberately small and dumb —
//            no layout, no CSS — because what is checked is which words the engine
//            puts on the page, and a fuller fake would only be more code to be wrong
//            in. It is written here rather than pulled in: no npm, no build step.
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
if (process.argv[2] === '--edit') {
  const [editRoot, gameDir, booksDir, scriptJSON] = process.argv.slice(3)
  const warnings = captureWarnings()
  const page = installDOM()
  // the editor's shell — the three elements its modules reach for at import time
  const editorEl = page.makeEl('div'); editorEl.id = 'editor'
  const editorStatus = page.makeEl('p'); editorStatus.id = 'status'
  const tabs = page.makeEl('nav'); tabs.id = 'tabs'
  ;[editorEl, editorStatus, tabs].forEach(el => page.body.appendChild(el))
  globalThis.location = { hash: '' }

  const editDir = (...parts) => pathToFileURL(join(editRoot, ...parts)).href
  const { editorState, remerge } = await import(editDir('dinoEdit', 'state.js'))
  const { uiState, readHash } = await import(editDir('dinoEdit', 'uiState.js'))
  const { render } = await import(editDir('dinoEdit', 'view.js'))
  const { migrateSet } = await import(editDir('engine', 'config', 'migrations.js'))

  // the game's five files and the layers it pins, read straight off disk
  const set = migrateSet(Object.fromEntries(['content', 'rules', 'themes', 'types', 'things']
    .map(name => [name, JSON.parse(readFileSync(join(gameDir, 'data', `${name}.json`), 'utf8'))])))
  const readBook = (pin) => {
    const at = (file) => { try { return JSON.parse(readFileSync(join(booksDir, pin.name, String(pin.edition), `${file}.json`), 'utf8')) } catch { return null } }
    const manifest = at('book')
    return manifest === null ? null : { pin, manifest, types: at('types'), things: at('things'), proposals: at('proposals') }
  }
  Object.assign(editorState, { game: 'demo', ...set, books: set.content.books.map(readBook) })
  remerge()

  const shownType = JSON.parse(scriptJSON).type
  globalThis.location.hash = `#demo/things/${shownType}`
  readHash()
  render({})

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
  const steps = JSON.parse(scriptJSON).steps.map(step => {
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
    addLabel: addButton().textContent,
    // what the SAVE would write: the game's own five drawers, in the editor's order
    own: Object.fromEntries(['content', 'rules', 'themes', 'types', 'things'].map(name => [name, editorState[name]]))
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
const { SCHEMA_VERSION, fieldsOfType, listSectionsOf, thingKeys, sheetKeys, placementSheet } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'schema.js')).href)
// NEW (v6): the two files the player's sheet is made of. Both are pure, so the
// parent can ask them the same questions the engine asks — and W3 can build the
// sheet a child printed a second time, from the merged set, and compare.
const { QUANTITY_KEY, quantityFieldOf, blankFields } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'sheet.js')).href)
const { danglingReferences, forgetType, forgetThing } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'references.js')).href)
const { flattenGroups } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'helpers.js')).href)
const { validateFile, crossChecks, problemText } = await import(pathToFileURL(join(DINO_DIR, 'engine', 'config', 'validate.js')).href)
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
const { shelfOf } = await import(pathToFileURL(join(DINO_DIR, 'server', 'books.js')).href)
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
const startServer = (gamesDir, distDir, booksDir) => new Promise((resolve, reject) => {
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
const copyShelf = (dest) => { mkdirSync(dirname(dest), { recursive: true }); cpSync(REAL_BOOKS, dest, { recursive: true }); return dest }
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
      ['basic:character.gear'], 'and NO other list section on any shipped sheet carries a `quantity`')
    assert.equal(quantityFieldOf(sectionNamed('basic:character.gear')).id, 'basic:character.gear.quantity')
    assert.equal(quantityFieldOf(sectionNamed('basic:character.skills')), null)
    listSections.filter(section => section.id !== 'basic:character.gear').forEach(section => assert.equal(quantityFieldOf(section), null, `${section.id} multiplies nothing`))
    ok(`W1 the shelf's placement fields: over the REAL books, ${listSections.length} list sections; Gear's placement is exactly quantity/number/1 and Skills' is exactly level/number/1; no other shipped list section carries a "quantity", so quantityFieldOf answers null for every one of them`)

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
      assert.deepEqual(nowFiles.filter(file => !v5Files.includes(file)).sort(), ['config/demands.js', 'config/kept.js', 'config/sheet.js'], 'three new files, and no others')
      assert.deepEqual(v5Files.filter(file => !nowFiles.includes(file)), [], 'and none was lost')
      ok(`W3 the sheet's content: after §2.6's eighth step gameState.sheet deep-equals §2.4 whole (cost 9 included) and its keys ARE sheetKeys(basic:character); placed on the merged shelf it adds nothing to danglingReferences; the two rows that fill one section land in row order; index.html gained exactly ${SHEET_ELEMENT} and is still wordless; @media print hides .hero, #status, #groups and .sheet-actions; engine/ grew exactly config/sheet.js, config/kept.js and config/demands.js`)
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
      // read-only: there is no route under /books/ that is not a GET
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const { status } = await raw(origin, '/books/basic/1/book.json', method, '{}')
        assert.equal(status, 404, `${method} /books/… is not a route`)
      }
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
      ok(`S5 the shelf's routes: /books/<n>/<e>/<file> is the shelf's bytes, ${refusedShelf.length} refused spellings and 3 write methods → 403/404 and never a server file, no folder index; /games/<g>/books/… is the same file; the asset search path answers the game's copy, then the book's, then 404 — and a game with no pins has no fallback`)

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
        // the rewrite really was the ONE mapping and nothing else
        const rewritten = readFileSync(join(editorCopy, 'dinoEdit', 'view.js'), 'utf8')
        assert.equal(rewritten.replace(/\.\.\/engine\/config\//g, '/config/').replace(/\.\.\/engine\/helpers\.js/g, '/helpers.js'),
          readFileSync(join(DINO_DIR, 'dinoEdit', 'view.js'), 'utf8'), 'the editor copy is the editor\'s own bytes with only "/config/…" made relative')

        // (a) READING MUST NOT WRITE. Opening the game and painting it changes nothing.
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
        assert.match(copy.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'a FRESH uuid — the copy lands in the GAME\'s bucket, so its card is editable')
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
  ;[v5Source, join(v5Source, 'assets'), expShelf, join(expShelf, 'basic'), dirname(DINO_DIR), DINO_DIR].forEach(target => {
    assert.throws(() => exportOf({ outDir: target }), /refusing to write/, `guard: ${target}`)
    assert.ok(!existsSync(join(target, MANIFEST)), `${target}: nothing claimed`)
  })
  assert.equal(treeHash(join(v5Source, 'data')), dataHash, 'the source game\'s data is untouched')
  assert.equal(treeHash(expShelf), shelfHash, 'and so is the shelf')
  ok('E8 wipe safety: an unmarked folder with files → refused, file kept; an empty folder → filled; an interrupted export → rebuilt; another tool\'s marker → refused; a file as --out → refused; a copy that dies leaves the claim marker; the source game, its assets, the SHELF, cyoa/ and DinoCYOA → refused, untouched')

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
    // no tool ever writes under a books folder — the rule, not the location
    assert.throws(() => exportOf({ outDir: join(expShelf, 'dinosaur-age', '9') }), /refusing to write .*the books folder/)
    assert.equal(treeHash(outDir), hKept, 'the previous export survives every one of them')
    assert.equal(treeHash(expShelf), shelfHash, 'and the shelf is untouched')
    ok('E13 refusals with a shelf: a pin the shelf cannot answer → "pins a book that is not on the shelf: dinosaur-age 3"; the §5.3 shelf → refused with the four fault paths; --out inside the books folder → the guard sentence; the previous export and the shelf survive all three')
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
    const filesBefore = listFiles(ROOT)
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
    assert.equal(treeHash(SHELF), treeHash(copyShelf(join(WORK, 'shelf-witness', 'books'))), 'and the scratch shelf is byte-identical to a fresh copy of the real one')
    ok(`M7 traversal and case: ${probes.length} literal GET probes and ${posts.length} POST probes over http.request → 403/404, never a server file or another game's data; nothing written, on the games root, under dist/ or on the shelf`)
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
// before the first check say so. M12 is the shelf's half: books/** is authored
// once and then immutable, so no route, no tool and no test may change a byte.
{
  assert.equal(treeHash(join(DINO_DIR, 'games')), realGames, 'games/ is byte-identical to before the run')
  assert.equal(existsSync(realDistDir) ? treeHash(realDistDir) : null, realDist, 'dist/ is byte-identical to before the run')
  ok('M9 the real games/ and dist/ are untouched — every write went to the scratch roots')
  assert.equal(treeHash(REAL_BOOKS), realBooks, 'books/ is byte-identical to before the run')
  ok(`M12 the real books/ is untouched: ${listFiles(REAL_BOOKS).length} files, the same sha256s as before the first check — the shelf is read-only`)
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
