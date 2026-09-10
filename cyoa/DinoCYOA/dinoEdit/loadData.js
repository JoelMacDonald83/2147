import { loadJSON, loadOptionalJSON } from "./helpers.js"
import { migrateSet } from "/config/migrations.js"
// NEW (stage 4): a BOOK's four files, and the two facts a book has that a game does not —
// which of its data files are not on disk at all, and which local games pin this edition.
import { BOOK_FILE_SHEETS, BOOK_FILES, SCHEMA_VERSION } from "/config/schema.js"
import { validateBookFile, problemText } from "/config/validate.js"
import { listGames, listBooks } from "./saveData.js"
import { pinnersOf } from "./books.js"
// NEW: the ENGINE's book loader, imported rather than copied. One function
// decides what "a pinned book that is not on the shelf" means (null, never a
// throw, never a half-book) for the game, the editor and the export alike —
// see engine/helpers.js. /helpers.js resolves to engine/helpers.js the same
// way /config/… resolves to engine/config/… : the dev server serves the engine
// folder at the root and the editor at /dinoEdit/.
import { loadBook } from "/helpers.js"

// CHANGED: nothing loads at import time any more. The page has no game until
// the hash names one (and on the home screen it never does), so this is a
// FUNCTION main.js calls once it knows which game to open. The five urls are
// that game's — /games/<name>/data/… — the same files the engine asks for when
// it plays at /games/<name>/. A missing content.json is the loud, named miss
// ("Could not load /games/nope/data/content.json (404)", helpers.js); types and
// things may be missing (a pre-v3 game) and the set migration creates them.
// get → check (migrateSet, the whole set together) → the caller publishes.
// CHANGED: then the PINS. The books are loaded after the migration because a v4
// game has no `books` key until the migration writes one (an empty list), and
// because a pin is data like any other: it goes through the border first.
export const loadGame = async (name) => {
  const url = (file) => `/games/${name}/data/${file}.json`
  const [rawContent, rawRules, rawThemes, rawTypes, rawThings] = await Promise.all([
    loadJSON(url("content")), loadJSON(url("rules")), loadJSON(url("themes")),
    loadOptionalJSON(url("types")), loadOptionalJSON(url("things"))
  ])
  const set = migrateSet({ content: rawContent, rules: rawRules, themes: rawThemes, types: rawTypes, things: rawThings })
  return { ...set, books: await loadBooks(set.content.books) }
}

// NEW: the second half on its own — the Books tab calls it after every pin,
// un-pin and upgrade, because the layers under the game have changed and the
// merge reads LAYERS, not pins.
// The urls are ABSOLUTE (`/books/…`): the editor lives at /dinoEdit/, so a
// page-relative "books/…" would ask for /dinoEdit/books/… . The engine's copy
// of this call stays page-relative — it is the one that gets published.
// A pins list that is not a list is a border problem, not a crash: an empty
// shelf here lets the file load, and the `pins` checker says why on save.
export const loadBooks = (pins) =>
  Promise.all((Array.isArray(pins) ? pins : []).map(pin => loadBook(`/books/${pin?.name}/${pin?.edition}/`, pin)))

// ───────────────────────── one edition of a book ─────────────────────────

// NEW (stage 4): WHAT STANDS IN FOR A DATA FILE THAT IS NOT ON DISK.
// Three of a book's four files are optional and two of today's four shelf editions ship
// only book.json + types.json. Every card in this editor writes into a container —
// `types.types`, `things.things`, `proposals.groups`, `proposals.groupRules` — so a book
// whose file is absent has nowhere to put a first row, and every read site would need a
// guard it does not need for a game.
//
// So an absent file arrives as its CONTAINERS AND NOTHING ELSE, read from the file's own
// sheet: a collection stands in as [], a cabinet and a buckets as {}, and a SCALAR stands
// in as nothing at all. That last word is the important one and it is not the seed's rule:
// `seedFrom` (server/seed.js) writes every entry's default because a NEWBORN is a thing
// being born, and this is a file that does not exist. A book that never proposed a budget
// must not start proposing 10 because somebody opened it — which is exactly the collision
// the seed's own BOOK_UNWRITTEN exists to avoid. "A key that means nothing is never
// written" is this editor's oldest rule (view.js); here it is applied to a whole file.
//
// The `version` stamp IS written: every book data file must carry SCHEMA_VERSION exactly
// or the border refuses it, and nothing downstream would put it there.
const CONTAINERS = { collection: () => [], cabinet: () => ({}), buckets: () => ({}) }
const standIn = (file) => {
  const stood = { version: SCHEMA_VERSION }
  BOOK_FILE_SHEETS[file].forEach(entry => {
    const container = CONTAINERS[entry.type]
    if (container && entry.key !== undefined) stood[entry.key] = container()
  })
  return stood
}
// …and the other half of that one fact, which is why it lives in this file and not in
// main.js: a file that was NOT on disk and STILL SAYS NOTHING is sent back as `null`, so the
// save route writes no file and the edition's bytes do not move. "A file that was only looked
// at is saved back unchanged" is load-bearing for a shelf an oracle hashes — and for a book
// it is stronger than for a game, because an absent file is a FACT about the book ("this book
// has none of that") and not an empty one.
// A file that WAS on disk is always sent, even emptied: emptying it is the author's edit.
//
// MEASURED, and this is why the test is "says nothing" and not "equals the stand-in": opening
// Basic's Things tab runs repairBuckets, which gives each of its seven OWN types an empty
// bucket — so the drawer stops equalling its stand-in without an author touching anything,
// and a no-edit save wrote a things.json holding seven empty shelves. An empty shelf is not
// something anybody said. So the question is asked of the CONTENT, through the file's own
// sheet: a container holding nothing says nothing, a cabinet or a buckets whose every slot is
// empty says nothing, and any scalar somebody wrote (a proposed budget) says something.
const saysNothing = (file, sheet) => sheet.every(entry => {
  const held = file?.[entry.key]
  if (held === undefined || held === null) return true
  if (Array.isArray(held)) return held.length === 0
  if (typeof held !== 'object') return false                        // a scalar an author wrote
  return Object.values(held).every(slot => slot === undefined || slot === null
    || (Array.isArray(slot) ? slot.length === 0 : typeof slot === 'object' && Object.keys(slot).length === 0))
})

export const bookBody = (state) => {
  const body = { book: state.book }
  BOOK_FILES.forEach(file => {
    const silent = state.absent.includes(file) && saysNothing(state[file], BOOK_FILE_SHEETS[file])
    body[file] = silent ? null : state[file]
  })
  return body
}

// NEW: ONE EDITION OF A BOOK, as the drawers the editor holds. The twin of loadGame, and
// the differences are the three the subject table could not express:
//
//   1. NO MIGRATION. Book files are born at SCHEMA_VERSION and never climb — an edition is
//      never edited, a new edition is a new folder — so a wrong version is a fault, not a
//      climb to make, and migrateSet would silently rewrite a FROZEN edition. The editor
//      refuses to open it instead, with the border's own sentence (spec §7b).
//   2. THE LAYERS UNDERNEATH come from the manifest's `requires`, which is FLAT and EXACT,
//      through the very same loadBooks a game's pins go through.
//   3. THE FREEZE CENSUS. "Frozen once a game pins it" is a fact about games/, so it is
//      read from GET /api/games — the only door the editor has to it. See pinnersOf
//      (books.js) for what that answer can and cannot see.
export const loadBookEdition = async (subject) => {
  const { name, edition } = subject
  const url = (file) => `/books/${name}/${edition}/${file}.json`
  // book.json is REQUIRED: a 404 here is "there is no such edition", and loadJSON's own
  // error names the url, which is the sentence the "Could not open" screen wants.
  const [book, ...raw] = await Promise.all([loadJSON(url('book')), ...BOOK_FILES.map(file => loadOptionalJSON(url(file)))])
  const files = {}
  const absent = []
  BOOK_FILES.forEach((file, at) => {
    if (raw[at] === null) { absent.push(file); files[file] = standIn(file); return }
    // the version gate, asked of the REAL table so the sentence is the one sentence: a
    // stale book file short-circuits validateBookFile to exactly this problem.
    const stale = validateBookFile(file, raw[at]).find(problem => problem.path === `${file}.version`)
    if (stale) throw new Error(`books/${name}/${edition} — ${problemText(stale)}`)
    files[file] = raw[at]
  })
  // the two listings this screen needs, together: which games pin this edition (the freeze),
  // and the shelf (the requires picker, and the NUMBER a cut would take — the read-only
  // banner says it out loud, so it has to be in hand before the first paint).
  const [games, shelf] = await Promise.all([listGames(), listBooks()])
  return {
    book, ...files, absent, shelf,
    books: await loadBooks(book?.requires),
    // null would read as "not asked yet", which SUBJECTS.book.editable treats as frozen.
    // A shelf we could ask about gets a real list, even an empty one.
    pinnedBy: games.ok ? pinnersOf(games.games, name, edition) : null
  }
}
