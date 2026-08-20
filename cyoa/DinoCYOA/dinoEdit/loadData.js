import { loadJSON } from "./helpers.js";

export const [content, rules, themes] = await Promise.all([
  loadJSON("/data/content.json"),
  loadJSON("/data/rules.json"),
  loadJSON("/data/themes.json")
])


