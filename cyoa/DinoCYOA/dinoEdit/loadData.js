import { loadJSON, loadOptionalJSON } from "./helpers.js"
import { migrateSet } from "/config/migrations.js"
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
