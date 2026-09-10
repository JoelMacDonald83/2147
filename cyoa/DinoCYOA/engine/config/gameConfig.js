import { content, rules, themes, types, things } from "./loadData.js"   // one doorway in, five files out
// CHANGED: + placementSheet (the form one PLACEMENT carries) and totalBudgetSchema
// (the budget is optional now, so its default lives on the sheet like every other)
// CHANGED: + listSectionsOf, for the one-per-section quantity warning below
import { groupRulesSchema, groupThemeSchema, sheetOfType, placementSheet, listSectionsOf, totalBudgetSchema } from "./schema.js"
import { checkWhere, filterThings } from "./query.js"          // NEW: the row's filter — checked, then run
import { checkShowWhen } from "./visibility.js"                 // NEW: the row's gate — checked here, evaluated by state.js
// NEW: the player's sheet, as vocabulary — checkFills is the row's BINDING check,
// the twin of checkWhere and checkShowWhen above; the other three are what the
// border hands the interior once the check has passed.
import { checkFills, sectionById, quantityFieldOf, playerFields, QUANTITY_KEY } from "./sheet.js"
// NEW: what an entry DEMANDS of the player's sheet — checked here, at the border, and
// evaluated nowhere but state.js. Exactly the bargain checkShowWhen and checkFills already
// struck: the border makes sure a rule CAN be run, the interior runs it.
import { demandsOf, demandFieldById, checkDemand } from "./demands.js"
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
   8) NEW: the row's BINDING (`fills`) is checked here and evaluated nowhere
      else. In the file it is a SECTION ID; state.js and view.js are handed the
      SECTION OBJECT itself (or null), exactly the way they are handed `items`
      rather than a query. The row also gets `quantityField` — the one placement
      field that multiplies its cost, or null — so nobody downstream has to know
      the naming convention.
   The hydrated row that state.js and view.js trust looks like this:
     { id, label, query, fills, quantityField, showWhen, min, max, background, fields, items, children }
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
// NEW: `demands` is the one core key the sheet cannot resolve — it is not a value the
// player types but a list of CONDITIONS, and a thing that demands nothing carries no key
// at all (the file never holds a no-op). demandsOf is the one function that knows that,
// so the interior is handed an ARRAY every time and nobody downstream writes `?? []`.
const hydrateThing = (thing, sheet) => {
  const hydrated = { ...thing, ...resolveFromSheet(sheet, thing), imageURL: thing.imageURL ? `assets/${thing.imageURL}` : "", demands: demandsOf(thing) }
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
  // NEW, the one filter the demand border buys: a thing whose rule this game cannot RUN
  // is not on sale in any row. It sits after the query, not inside it, because it is not
  // a question about this row — it is a fact about the thing, decided once, above.
  return { fields: sheet, items: filterThings(bucket, type, row.query.where).filter(item => !UNOFFERABLE.has(item.id)) }
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

// NEW: the sheet the PLAYER builds, resolved ONCE, at import time.
//   null           this game builds no sheet ("" — every v5 game, and vampire)
//   null, LOUDLY   it names a type that is not there (a hand-edit, or a book
//                  un-pinned): say so once, then play the v5 way.
// Fail closed — a missing sheet never becomes a guessed one. Not "the first type",
// not basic:character: either would be a guess, and "this game is a menu, not a
// sheet" has to stay sayable.
// `fields` is the flat list of what the player TYPES (Name first); `sections` is
// the tree, because the panel is drawn section by section.
const resolvePlayerSheet = () => {
  const id = content.sheet ?? ""
  if (id === "") return null
  const type = types.types.find(type => type.id === id)
  if (!type) { console.warn(`This game builds a sheet that does not exist (${id}); no sheet is shown`); return null }
  // NEW: the quantity convention, said out loud where a book half-kept it. A
  // placement field keyed `quantity` MULTIPLIES its entry's cost, but only when it
  // is a NUMBER — validate.js refuses any other kind on SAVE, so this catches only
  // a book written before that rule existed. One sentence per section beats a
  // silent ×1 on every pick in it.
  listSectionsOf(type).forEach(section => {
    const named = placementSheet(section).find(field => field.key === QUANTITY_KEY)
    if (named && named.type !== "number")
      console.warn(`Section "${section.caption}" has a "quantity" field that is not a number; its picks are not multiplied`)
  })
  return { id, label: type.label, type, fields: playerFields(type), sections: type.sections }
}
export const playerSheet = resolvePlayerSheet()
// the game asked for a sheet and did not get one: every bound row below is broken,
// for the ONE reason resolvePlayerSheet has already named
const sheetDangles = (content.sheet ?? "") !== "" && playerSheet === null

// NEW: the merged world's answer to "what is this thing called?" — built ONCE, here,
// because `demandText` has to be able to say "Tyrannosaurus" for a thing that lives on a
// shelf NO ROW SHOWS, and neither state.js nor view.js may reach into things.json. That
// is the border principle: the interior asks for what it needs and is handed it.
// Falls back to the id, so a name is never blank and never a guess.
const THING_NAMES = new Map(Object.values(things.things).flat().map(thing => [thing.id, thing.name]))
export const nameOfThing = (id) => THING_NAMES.get(id) ?? id

// NEW: a thing's demands, CHECKED once at import time — not per row, because a demand is
// judged against the game's ONE declared sheet, so the answer cannot differ between rows.
// Three outcomes and no fourth:
//   the thing has none      → nothing happens, and its card is byte-for-byte v6's
//   they can be judged      → it is offered, and `demands` is an ARRAY in the interior,
//                             always, so nothing downstream ever writes `?? []`
//   they cannot be judged   → say so ONCE, by name, and DO NOT OFFER the thing.
// Fail closed, and the closed door is the honest one: an entry whose rule this game
// cannot run is not "always allowed" (that silently drops the author's rule) and not
// "always refused" (a permanently grey card nobody can explain — a bug that looks like
// content). It is not on sale. Same reasoning resolveFills already gives above: a pick
// that cannot land still COSTS POINTS, and paying for nothing is silently wrong where a
// missing card is visibly wrong.
//
// THE BORDER'S OWN FIRST SENTENCE, and it is not checkDemand's: "does this demand point at
// anything at all?" is a FAULT the validator reports at save time; "can THIS game judge
// it?" is a WARNING and an entry that is not offered. A prerequisite travels inside a
// FROZEN book — `dinosaur-age` may demand `stats:strength` — so a game that pins the book
// without the sheet that answers it has an entry it cannot sell and a file that is
// perfectly well-formed. Conflate the two and that book becomes unpinnable.
const shelfIdsFor = (field) => new Set((things.things[field.section.of] ?? []).map(thing => thing.id))

const resolveDemands = () => {
  const unofferable = new Set()
  // the field KEYS any demand actually names — the ONE reason typing has to re-settle
  // now (a demand can read Strength or Size). EMPTY for every game that exists today,
  // which is exactly what makes the caret rule cost dino and vampire nothing: view.js
  // attaches a `change` listener only to a box in this set.
  const watched = new Set()
  let sheetlessDemanders = 0
  Object.values(things.things).flat().forEach(thing => {
    const list = demandsOf(thing)
    if (list.length === 0) return                        // the ordinary thing: not one new byte
    if (playerSheet === null) { sheetlessDemanders += 1; unofferable.add(thing.id); return }
    const typedKeys = []
    for (const demand of list) {
      const field = demandFieldById(playerSheet.type, demand.field)
      const problem = field === undefined
        ? `names a field that is not on this game's sheet (${demand.field})`
        : checkDemand(demand, field, field.section ? shelfIdsFor(field) : null)
      if (problem) {
        // CHANGED: no "it" before the problem. checkDemand's sentences are checkWhere's
        // shape — they start with the thing that is wrong ("operator …", "value …",
        // "names …") — so they take the FILTER frame above, not the show-when frame.
        // "— it operator "gte" does not fit" is not a sentence.
        console.warn(`Thing "${thing.name}" cannot evaluate a demand — ${problem}; it is not offered`)
        unofferable.add(thing.id)
        return                                           // ONE sentence per thing, not one per demand
      }
      // a LIST section is not something anybody types, so it is not watched: picking is
      // already the door that settles (toggleSelection). Only a TYPED slot needs the event.
      if (!field.section) typedKeys.push(field.key)
    }
    typedKeys.forEach(key => watched.add(key))           // committed only once the whole thing passed
  })
  // the ONE-CAUSE rule the audit and resolveFills already follow: when the game builds no
  // sheet at all, every demanding thing has ONE cause, so it is said once for the game
  // instead of once per entry.
  if (sheetlessDemanders > 0)
    console.warn(`This game builds no sheet, so ${sheetlessDemanders} entries that demand something are not offered`)
  return { unofferable, watched }
}
const demandBorder = resolveDemands()
const UNOFFERABLE = demandBorder.unofferable
export const watchedFields = demandBorder.watched

// NEW: the row's binding, checked. Note the ORDER inside: checkFills is asked about
// the RAW row, while `fills` is still an ID — get that backwards and every message
// reads "[object Object]". Only then is the id replaced by the section it named.
// A row that cannot fill what it names offers NOTHING (`broken`). The alternative —
// keep offering the picks, they simply never reach the sheet — hides less from the
// player, and loses anyway: a pick that cannot land still COSTS POINTS, so the
// player would pay for an entry that appears nowhere on their document. Paying for
// nothing is silently wrong; an empty row is visibly wrong, and the author fixes it
// in seconds.
const resolveFills = (row) => {
  // The sheet itself dangled: every bound row is broken for one cause, and saying
  // so once per row would be five sentences for one mistake. Stay quiet, still fail
  // closed — resolvePlayerSheet already said the only thing worth saying.
  if (sheetDangles) return { fills: null, broken: (row.fills ?? "") !== "" }
  const problem = checkFills(row, playerSheet?.type ?? null)
  if (problem) { console.warn(`Row "${row.label}" ${problem}; it shows nothing`); return { fills: null, broken: true } }
  return { fills: (row.fills ?? "") === "" ? null : sectionById(playerSheet.type, row.fills), broken: false }
}

const hydrateGroup = (group, rules, themes) => {
  const bound  = resolveFills(group)                               // NEW: checked while `fills` is still an id
  const answer = resolveItems(group)                               // CHANGED: held, because a broken binding overrules its items
  return {
    ...group,                                                      // id, label, query (raw), fills (an id — replaced below), showWhen (replaced below), children (replaced below)
    ...resolveFromSheet(groupRulesSchema, rules.groupRules[group.id]),
    ...resolveFromSheet(groupThemeSchema, themes.groupThemes[group.id]),
    showWhen: resolveShowWhen(group),                              // NEW: the gate, checked
    ...answer,                                                     // CHANGED: the query, answered — fields + items
    fills: bound.fills,                                            // NEW: the SECTION object, or null
    quantityField: quantityFieldOf(bound.fills),                   // NEW: the number field that multiplies, or null
    items: bound.broken ? [] : answer.items,                       // NEW: fail closed — a pick that cannot land is not offered
    children: group.children.map(child => hydrateGroup(child, rules, themes))
  }
}

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
