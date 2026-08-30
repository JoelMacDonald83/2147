import { loadJSON } from "../helpers.js";


import { migrateThemes } from "./migrations.js";

export const themes = migrateThemes(await loadJSON("/data/themes.json"))