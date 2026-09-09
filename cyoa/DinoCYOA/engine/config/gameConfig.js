import { content, rules, themes, types, things } from "./loadData.js"   // one doorway in, five files out
// CHANGED: + placementSheet (the form one PLACEMENT carries) and totalBudgetSchema
// (the budget is optional now, so its default lives on the sheet like every other)
import { groupRulesSchema, groupThemeSchema, sheetOfType, placementSheet, totalBudgetSchema } from "./schema.js"
import { checkWhere, filterThings } from "./query.js"          // NEW: the row's filter — checked, then run
import { checkShowWhen } from "./visibility.js"                 // NEW: the row's gate — checked here, evaluated by state.js
import { flattenGroups } from "../helpers.js"                   // NEW: every row at every depth, for the id sets below

// helper functions

/* Hydration means rebuilding what the JSON format can't carry, so the rest of the
   game receives complete, ready-to-use group objects:
   1) if a group has no entry in rules.json (or an empty one), fill in the defaults:
      0 for min, Infinity for max
   2) JSON cannot represent Infinity at all, so "no max written" is how the data
      says "unlimited" — and it gets restored to a real Infinity right here
   3) each group also gets its look glued on: background from themes.json, or null
      if that group has no custom look
   4) authors write bare filenames in things.json ("dino.jpg"); the border turns
      them into real URLs ("assets/dino.jpg") so the view never has to build paths.
      CHANGED: the URL is PAGE-RELATIVE — one rule for every path the engine
      makes, and index.html already follows it for styles.css and app.js. Three
      places consume these strings, and all three resolve against the same
      folder: fetch("data/x.json") inside a module resolves against the
      DOCUMENT's base URL (the page, not the module) — index.html at / asks
      for /data/x.json, at /repo/dino/ for /repo/dino/data/x.json; an
      <img src="assets/x.jpg"> resolves against the document too; and the
      hero, url("assets/heroBG.jpg"), is written into an INLINE style on
      <html> (view.js), so it resolves against the document URL — or, if a
      browser resolves it where the var() is consumed (styles.css), against
      styles.css, which sits beside index.html: the same folder either way.
      That is why a published folder plays from any subpath with no rewrite.
   5) CHANGED: a row no longer POINTS at a type (displayType); it carries a QUERY
      ({ type, where }) and the border ANSWERS it: fetch the type's bucket from
      things.json, hydrate every thing, keep only the ones the condition
      matches, and hang the result on the row as `items`. A row whose type is
      "" (or no longer exists), or whose condition cannot run, gets an empty
      list — never a wider one. `query` itself rides through untouched, and
      state.js / view.js never read it: they read `items`.
   6) the row also gets `fields` — its type's SHEET (CHANGED: a type is sections
      now, and sheetOfType flattens them into the one flat list the view has
      always walked: a fields section contributes its fields, a LIST section
      contributes a single "placements" entry under the section's key) — so the
      view knows which extras to draw on each card, and every thing gets any
      field it is missing filled with that field's default.
   7) NEW: the row's gate (`showWhen`) is CHECKED here. One that names a thing
      or row that does not exist, waits for itself, or has a kind nobody knows
      is replaced by { kind: "never" }. It is EVALUATED later, by state.js,
      after every click — the border only makes sure it can be.
   The hydrated row that state.js and view.js trust looks like this:
     { id, label, query, showWhen, min, max, background, fields, items, children }
*/

// NEW: every id the gates may name, for the reference check in resolveShowWhen.
// Read from the raw files (content.groups still has its children, so
// flattenGroups walks it), before any row is hydrated.
const ROW_IDS   = new Set(flattenGroups(content.groups).map(row => row.id))
const THING_IDS = new Set(Object.values(things.things).flat().map(thing => thing.id))

const resolveFromSheet = (sheet, source) => {
  const resolved = {}
  sheet.forEach(entry => {
    resolved[entry.key] = source?.[entry.key] ?? entry.hydrateDefault
  })
  return resolved
}

// CHANGED: the type a row shows is now inside its query — or undefined when it shows nothing
const typeOf = (row) => types.types.find(type => type.id === row.query.type)

// NEW: one thing, ready for a card. Two halves, and the order matters: the raw
// thing first (so a stale key nobody asks for rides along harmlessly), then the
// sheet's answer for every entry the type declares — a thing born before a field
// existed gets that field's default rather than `undefined` on its card.
// imageURL is the one core field the border rewrites: authors write a bare
// filename, the view wants a URL (page-relative — see 4 above).
const hydrateThing = (thing, sheet) => {
  const hydrated = { ...thing, ...resolveFromSheet(sheet, thing), imageURL: thing.imageURL ? `assets/${thing.imageURL}` : "" }
  // A "placements" entry cannot be resolved by resolveFromSheet: its value is not
  // a stored value but a list of POINTERS that have to be followed. So the sheet
  // is walked once more for exactly those entries.
  sheet.filter(entry => entry.type === "placements").forEach(entry => {
    hydrated[entry.key] = resolvePlacements(thing, entry)
  })
  return hydrated
}

// NEW: a placement becomes { thing, name, …the placement fields with their
// defaults } — the pointer kept (state.js and the view never need it, but the
// id is what the data means) plus the one thing a card wants to print: the
// placed thing's NAME, fetched from the shelf the section lists (`section.of`).
// A placement naming a thing that is not on that shelf is a hand-edit or a
// half-removed thing: say so once, by name, and drop THAT entry — the rest of
// the list still draws. Fail closed: a dangling pointer never becomes a blank
// or a guess on the card.
const resolvePlacements = (thing, entry) => (Array.isArray(thing[entry.key]) ? thing[entry.key] : []).flatMap(placement => {
  const target = (things.things[entry.section.of] ?? []).find(each => each.id === placement.thing)
  if (!target) {
    console.warn(`Thing "${thing.name}" places a thing that does not exist (${placement.thing}) in ${entry.caption}; it is skipped`)
    return []
  }
  return [{ ...resolveFromSheet(placementSheet(entry.section), placement), thing: placement.thing, name: target.name }]
})

// CHANGED: "which things does this row offer?" is now the row's QUERY, answered
// against the hydrated bucket: hydrate first (defaults, assets/ prefix), then
// filter, so a thing missing a field is compared on the default the card shows.
// Every hydrated thing is a FRESH object (the spread), so two rows showing the
// same type get separate copies — state.js compares by reference within one
// row's list, and that keeps working.
// RULE: a condition that cannot run never WIDENS what the player sees — the
// row shows nothing and says why. Showing the whole bucket would look fine and
// be wrong; an empty row is noticed in seconds, and the editor's header says why.
const resolveItems = (row) => {
  const type = typeOf(row)
  if (!type) {
    // "" is the honest "shows nothing yet"; anything else is a pointer that
    // no longer matches a type (a hand-edited file) — say so, then show nothing
    if (row.query.type !== "") console.warn(`Row "${row.label}" shows a type that does not exist (${row.query.type})`)
    return { fields: [], items: [] }
  }
  // CHANGED: the sheet, not the type's old flat `fields` list — and hydration
  // moved into hydrateThing, because a thing is more than its fixed slots now.
  const sheet = sheetOfType(type)
  const bucket = (things.things[type.id] ?? []).map(thing => hydrateThing(thing, sheet))
  const problem = checkWhere(row.query.where, type)
  if (problem) {
    console.warn(`Row "${row.label}" cannot run its filter — ${problem}; it shows nothing`)
    return { fields: sheet, items: [] }
  }
  return { fields: sheet, items: filterThings(bucket, type, row.query.where) }
}

// NEW: the gate, checked. A gate that names a missing thing or row, waits for
// itself, or has a kind nobody knows becomes `never` — the interior never sees
// a dangling id and warns nobody twice. Fail CLOSED: a hand-edit typo must
// not reveal a row the author meant to hide.
const resolveShowWhen = (row) => {
  const problem = checkShowWhen(row, ROW_IDS, THING_IDS)
  if (problem) {
    console.warn(`Row "${row.label}" cannot evaluate its show-when — it ${problem}; it is never shown`)
    return { kind: "never" }
  }
  return row.showWhen
}

const hydrateGroup = (group, rules, themes) => ({
  ...group,                                                        // id, label, query (raw), showWhen (replaced below), children (replaced below)
  ...resolveFromSheet(groupRulesSchema, rules.groupRules[group.id]),
  ...resolveFromSheet(groupThemeSchema, themes.groupThemes[group.id]),
  showWhen: resolveShowWhen(group),                                // NEW: the gate, checked
  ...resolveItems(group),                                          // CHANGED: the query, answered — fields + items
  children: group.children.map(child => hydrateGroup(child, rules, themes))
})

const hydrateGroups = (content, rules, themes) =>
  content.groups.map(group => hydrateGroup(group, rules, themes))



export const meta = content.meta
// CHANGED: the budget is OPTIONAL in the file now — a game that writes none lets
// a pinned book's proposal show through (the merge has already applied that), and
// when nothing proposes one either, the sheet's own default (10) applies. Read
// through the sheet like every other absent value, so the number lives in exactly
// one place: totalBudgetSchema.
export const totalBudget = resolveFromSheet(totalBudgetSchema, rules).totalBudget

// pageTheme gets the same border treatment as the things:
// heroImage arrives as a bare filename and leaves as a real URL
export const pageTheme = {
  ...themes.page,
  heroImage: themes.page.heroImage ? `assets/${themes.page.heroImage}` : ""   // CHANGED: page-relative (see 4 above)
}

export const groups = hydrateGroups(content, rules, themes)
