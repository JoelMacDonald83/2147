import { loadJSON } from "../helpers.js";
import { migrateRules } from "./migrations.js";

export const rules = migrateRules(await loadJSON("/data/rules.json"))