import { content } from "./loadContent.js"
import { rules } from "./loadRules.js"
import { themes } from "./loadThemes.js"
import { groupRulesSchema, groupThemeSchema } from "./schema.js"

// helper functions

/* Hydration means rebuilding what the JSON format can't carry, so the rest of the
   game receives complete, ready-to-use group objects:
   1) if a group has no entry in rules.json (or an empty one), fill in the defaults:
      0 for min, Infinity for max
   2) JSON cannot represent Infinity at all, so "no max written" is how the data
      says "unlimited" — and it gets restored to a real Infinity right here
   3) each group also gets its look glued on: background from themes.json, or null
      if that group has no custom look
   4) authors write bare filenames in content.json ("dino.jpg"); the border turns
      them into real URLs ("/assets/dino.jpg") so the view never has to build paths
*/

const resolveFromSheet = (sheet, source) => {
  const resolved = {}
  sheet.forEach(entry => {
    resolved[entry.key] = source?.[entry.key] ?? entry.hydrateDefault
  })
  return resolved
}

const hydrateGroups = (content, rules, themes) =>
  content.groups.map(group => ({
    ...group,
    ...resolveFromSheet(groupRulesSchema, rules.groupRules[group.id]),
    ...resolveFromSheet(groupThemeSchema, themes.groupThemes[group.id]),
    ...resolveItems(group)
  }))

// "where do this group's images actually live?" — only the image path changes,
// every other item field passes through untouched
const resolveItems = (group) => {
  return {
    items: group.items.map(item => ({
      ...item,
      imageURL: `/assets/${item.imageURL}`
    }))
  }
}



export const meta = content.meta
export const totalBudget = rules.totalBudget

// pageTheme gets the same border treatment as the items:
// heroImage arrives as a bare filename and leaves as a real URL
export const pageTheme = {
  ...themes.page,
  heroImage: `/assets/${themes.page.heroImage}`
}

export const groups = hydrateGroups(content, rules, themes)
