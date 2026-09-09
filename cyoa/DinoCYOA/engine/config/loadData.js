import { loadJSON, loadOptionalJSON, loadBook } from "../helpers.js"
import { migrateSet } from "./migrations.js"
import { mergeLayers } from "./merge.js"          // NEW: the layers under the game, flattened back into one set
import { problemText } from "./validate.js"       // NEW: one sentence for a { path, message }, the same everywhere

// NEW: one loader for the whole set — it replaces loadContent.js, loadRules.js
// and loadThemes.js, and mirrors the editor's loadData.js.
// get: fetch all five files, hold them in the "just arrived" tray.
// types.json and things.json may not exist yet (null) — the border makes them.
// CHANGED: the five urls are page-relative ("data/…", no leading slash), so a
// published folder works from any subpath. fetch resolves a relative url
// against the PAGE (index.html), not against this module — and index.html
// sits beside data/, whether the page is served at / or at /repo/dino/. The
// EDITOR keeps its absolute /data/ paths: it lives at /dinoEdit/ and is never
// exported.
const [rawContent, rawRules, rawThemes, rawTypes, rawThings] = await Promise.all([
  loadJSON("data/content.json"),
  loadJSON("data/rules.json"),
  loadJSON("data/themes.json"),
  loadOptionalJSON("data/types.json"),
  loadOptionalJSON("data/things.json")
])

// check: the whole set goes through the border together. CHANGED: this is the
// game's OWN layer now, not the whole world — hence the name.
const own = migrateSet({ content: rawContent, rules: rawRules, themes: rawThemes, types: rawTypes, things: rawThings })

// NEW: the books this game pins, fetched PAGE-RELATIVE like everything else —
// "books/<name>/<edition>/…" beside data/. Under the dev server the page is
// /games/<g>/index.html, so that reads as /games/<g>/books/… and the server maps
// it onto the one shared shelf. A PUBLISHED folder is flattened (the export
// writes the merged set with `books: []`), so this loop runs zero times there
// and the engine takes exactly the path it took in v4 — five fetches, no shelf.
// The pins are read AFTER the migration because a v4 game has no `books` key
// until the migration gives it the empty one.
const books = await Promise.all(own.content.books.map(pin => loadBook(`books/${pin.name}/${pin.edition}/`, pin)))

// publish: the stack, flattened. Below this line nothing in the engine knows
// that books exist — merged.set is a plain, book-less v5 set, the same shape
// hydrate has always eaten.
const merged = mergeLayers({ books, game: own })

// The border is LOUD. A fault here means a hand-edited file or a moved shelf
// (the editor refuses to save a game that has one), so say each of them once,
// by name — then play what DID merge. A skipped book's rows simply offer
// nothing: "Nothing to choose here" is the honest screen, and it is noticed in
// seconds. Failing closed beats guessing at what the author meant.
merged.faults.forEach(fault => console.warn(`Book fault — ${problemText(fault)}`))

export const content = merged.set.content
export const rules   = merged.set.rules
export const themes  = merged.set.themes
export const types   = merged.set.types
export const things  = merged.set.things
