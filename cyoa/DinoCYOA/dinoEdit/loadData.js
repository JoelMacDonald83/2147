import { loadJSON } from "./helpers.js";
import { migrateContent, migrateRules, migrateThemes } from "/config/migrations.js";

// get: fetch all three files, hold them in the "just arrived" tray
const [rawContent, rawRules, rawThemes] = await Promise.all([
  loadJSON("/data/content.json"),
  loadJSON("/data/rules.json"),
  loadJSON("/data/themes.json")
])

// check + publish: everything the editor sees has been through the border
export const content = migrateContent(rawContent)
export const rules = migrateRules(rawRules)
export const themes = migrateThemes(rawThemes)