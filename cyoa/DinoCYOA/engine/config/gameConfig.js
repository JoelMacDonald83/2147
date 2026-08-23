import { content } from "./loadContent.js"
import { rules } from "./loadRules.js"
import { themes } from "./loadThemes.js"

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

// "what are this group's effective rules?" — one question, one answer
const resolveRules = (group, rules) => {
  const groupRules = rules.groupRules[group.id] ?? {}
  return {
    min: groupRules.min ?? 0,
    max: groupRules.max ?? Infinity
  }
}

// "what is this group's look?" — null means "no custom look", the view checks for it
const resolveTheme = (group, themes) => {
  const groupTheme = themes.groupThemes[group.id] ?? {}
  return {
    background: groupTheme.background ?? null
  }
}

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

const hydrateGroups = (content, rules, themes) =>
  content.groups.map(group => ({
    ...group,
    ...resolveRules(group, rules),
    ...resolveTheme(group, themes),
    ...resolveItems(group) // must come after ...group so the fixed items overwrite the raw ones
  }))

export const meta = content.meta
export const totalBudget = rules.totalBudget

// pageTheme gets the same border treatment as the items:
// heroImage arrives as a bare filename and leaves as a real URL
export const pageTheme = {
  ...themes.page,
  heroImage: `/assets/${themes.page.heroImage}`
}

export const groups = hydrateGroups(content, rules, themes)
