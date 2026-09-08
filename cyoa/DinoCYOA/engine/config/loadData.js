import { loadJSON, loadOptionalJSON } from "../helpers.js"
import { migrateSet } from "./migrations.js"

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

// check + publish: the whole set goes through the border together
const set = migrateSet({ content: rawContent, rules: rawRules, themes: rawThemes, types: rawTypes, things: rawThings })

export const content = set.content
export const rules   = set.rules
export const themes  = set.themes
export const types   = set.types
export const things  = set.things
