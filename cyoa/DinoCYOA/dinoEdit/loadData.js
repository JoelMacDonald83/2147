import { loadJSON, loadOptionalJSON } from "./helpers.js"
import { migrateSet } from "/config/migrations.js"

// CHANGED: nothing loads at import time any more. The page has no game until
// the hash names one (and on the home screen it never does), so this is a
// FUNCTION main.js calls once it knows which game to open. The five urls are
// that game's — /games/<name>/data/… — the same files the engine asks for when
// it plays at /games/<name>/. A missing content.json is the loud, named miss
// ("Could not load /games/nope/data/content.json (404)", helpers.js); types and
// things may be missing (a pre-v3 game) and the set migration creates them.
// get → check (migrateSet, the whole set together) → the caller publishes.
export const loadGame = async (name) => {
  const url = (file) => `/games/${name}/data/${file}.json`
  const [rawContent, rawRules, rawThemes, rawTypes, rawThings] = await Promise.all([
    loadJSON(url("content")), loadJSON(url("rules")), loadJSON(url("themes")),
    loadOptionalJSON(url("types")), loadOptionalJSON(url("things"))
  ])
  return migrateSet({ content: rawContent, rules: rawRules, themes: rawThemes, types: rawTypes, things: rawThings })
}
