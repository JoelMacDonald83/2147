import { loadJSON, loadOptionalJSON } from "./helpers.js";
import { migrateSet } from "/config/migrations.js";   // CHANGED: one border function for the whole set

// get: fetch all five files, hold them in the "just arrived" tray.
// CHANGED: types.json and things.json may be missing (null) for a game saved
// before v3 — the set migration creates them.
const [rawContent, rawRules, rawThemes, rawTypes, rawThings] = await Promise.all([
  loadJSON("/data/content.json"),
  loadJSON("/data/rules.json"),
  loadJSON("/data/themes.json"),
  loadOptionalJSON("/data/types.json"),
  loadOptionalJSON("/data/things.json")
])

// check + publish: everything the editor sees has been through the border —
// the whole set crosses it together
const set = migrateSet({ content: rawContent, rules: rawRules, themes: rawThemes, types: rawTypes, things: rawThings })

export const content = set.content
export const rules   = set.rules
export const themes  = set.themes
export const types   = set.types
export const things  = set.things
