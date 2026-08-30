import { loadJSON } from "../helpers.js";
import { migrateContent } from "./migrations.js";

export const content = migrateContent(await loadJSON("/data/content.json"))