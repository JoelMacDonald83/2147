import { content, rules, themes, types, things } from "./loadData.js"   // CHANGED: one doorway in, five files out
import { groupRulesSchema, groupThemeSchema, sheetOfType } from "./schema.js"

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
      them into real URLs ("/assets/dino.jpg") so the view never has to build paths
   5) NEW: a group's items no longer live in content.json. The group says which
      TYPE it shows (displayType); the border fetches that type's bucket from
      things.json and hangs it on the group as `items`, so state.js never
      notices anything changed. A group that shows nothing ("", or a type that
      no longer exists) gets an empty list.
   6) NEW: the group also gets `fields` — its type's own field list — so the
      view knows which extras to draw on each card, and every thing gets any
      field it is missing filled with that kind's default.
*/

const resolveFromSheet = (sheet, source) => {
  const resolved = {}
  sheet.forEach(entry => {
    resolved[entry.key] = source?.[entry.key] ?? entry.hydrateDefault
  })
  return resolved
}

const hydrateGroup = (group, rules, themes) => ({
  ...group,
  ...resolveFromSheet(groupRulesSchema, rules.groupRules[group.id]),
  ...resolveFromSheet(groupThemeSchema, themes.groupThemes[group.id]),
  ...resolveItems(group),
  children: group.children.map(child => hydrateGroup(child, rules, themes))
})

const hydrateGroups = (content, rules, themes) =>
  content.groups.map(group => hydrateGroup(group, rules, themes))

// NEW: the type a group shows, or undefined when it shows nothing
const typeOf = (group) => types.types.find(type => type.id === group.displayType)

// CHANGED: "where do this group's things live, and what do they look like?"
// The bucket in things.json replaces group.items. Every hydrated thing is a
// FRESH object (the spread), so two groups showing the same type get separate
// copies — state.js compares by reference within one group's list, and that
// keeps working. As before, only the image path is rewritten.
const resolveItems = (group) => {
  const type = typeOf(group)
  if (!type) {
    // "" is the honest "shows nothing yet"; anything else is a pointer that
    // no longer matches a type (a hand-edited file) — say so, then show nothing
    if (group.displayType !== "") {
      console.warn(`Group "${group.label}" shows a type that does not exist (${group.displayType})`)
    }
    return { fields: [], items: [] }
  }
  const sheet = sheetOfType(type)
  const bucket = things.things[type.id] ?? []
  return {
    fields: type.fields,
    items: bucket.map(thing => ({
      ...thing,
      ...resolveFromSheet(sheet, thing),     // a missing custom field → its kind's default
      imageURL: thing.imageURL ? `/assets/${thing.imageURL}` : ""
    }))
  }
}



export const meta = content.meta
export const totalBudget = rules.totalBudget

// pageTheme gets the same border treatment as the things:
// heroImage arrives as a bare filename and leaves as a real URL
export const pageTheme = {
  ...themes.page,
  heroImage: themes.page.heroImage ? `/assets/${themes.page.heroImage}` : ""
}

export const groups = hydrateGroups(content, rules, themes)
