// NEW: everything the server knows about the games FOLDER, as plain functions
// over a root directory: names, the list, the seed, the claim. No HTTP in here —
// server.js turns these answers into receipts. The oracles import this file
// directly for the pure parts (N2, N3) and then prove the same answers over
// HTTP (M1–M9). Imports come from engine/config (the contract) and the export
// tool's two constants (the marker it writes), never from dinoEdit/.
import { readdir, readFile, mkdir, writeFile, rm } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { SCHEMA_VERSION, SHEETS, FILE_SHEETS } from "../engine/config/schema.js"
import { FILE_NAMES, validateSet, problemText } from "../engine/config/validate.js"
// export.mjs runs its CLI only when it is argv[1] and its --verify child only when
// argv[2] says so — importing it runs nothing (the oracles have imported it since v4)
import { MANIFEST, TOOL } from "../tools/export.mjs"

// ───────────── names ─────────────
// A game name is a folder under games/ AND one segment of three URLs
// (/games/<name>/, /dist/<name>/, /api/games/<name>/…). ONE grammar decides
// both: lowercase a–z and 0–9, single dashes between runs, 1–40 characters,
// nothing else. So a name can never be "..", never hold a slash or a "%",
// never be "Dino" (macOS would find dino/ for it; a Linux host would not).
export const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const NAME_MAX = 40
// the one word the editor's hash keeps for a screen that is not a game (#home)
export const RESERVED = ["home"]
export const isGameName = (name) => typeof name === "string" && name.length <= NAME_MAX && NAME.test(name)

// "Space Pirates!" → "space-pirates". Accents are stripped (é → e), every run
// of anything that is not a letter or digit becomes one dash, end dashes go.
export const slugOf = (title) => title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

// what is wrong with a new game's title, as [{ path, message }] — [] means fine
export const titleProblems = (title) => {
  if (typeof title !== "string" || title.trim() === "") return [{ path: "title", message: "must be a non-empty string" }]
  const name = slugOf(title)
  if (name === "") return [{ path: "title", message: "gives no folder name (it needs a letter or a digit)" }]
  if (name.length > NAME_MAX) return [{ path: "title", message: `folder name "${name}" is longer than ${NAME_MAX} characters` }]
  if (RESERVED.includes(name)) return [{ path: "title", message: `"${name}" is a name the editor keeps for itself` }]
  return []
}

// a game exists when its folder holds data/content.json — the same test the
// export tool makes (readTexts). A name the grammar refuses never reaches join().
export const gameExists = (gamesDir, name) => isGameName(name) && existsSync(join(gamesDir, name, "data", "content.json"))

// ───────────── the seed: a newborn set, read from the sheets ─────────────
// dinoEdit/view.js's newborn() applies one rule to one card: walk the sheet,
// write every entry's default (a FRESH copy), skip the ones whose default is
// null. This applies the same rule to a whole FILE. FILE_SHEETS names the top
// of each file: a "form" is one sheet-shaped object, a "cabinet" and "buckets"
// start empty (they are keyed by ids that do not exist yet), everything else
// carries its own default (groups: [], types: [], totalBudget: 10). `version`
// goes first, so a seed file has exactly the key order migrations.js writes and
// the oracles (B2) pin. The seed can never drift from the contract, because it
// is READ from the contract — and createGame checks it with validateSet anyway.
const bornFrom = (sheet) => {
  const born = {}
  sheet.forEach(entry => {
    if (entry.key === undefined || entry.default === null) return
    born[entry.key] = structuredClone(entry.default)
  })
  return born
}
const seedFile = (name) => {
  const file = { version: SCHEMA_VERSION }
  FILE_SHEETS[name].forEach(entry => {
    if (entry.type === "form") file[entry.key] = bornFrom(SHEETS[entry.of])
    else if (entry.type === "cabinet" || entry.type === "buckets") file[entry.key] = {}
    else if (entry.default !== undefined) file[entry.key] = structuredClone(entry.default)
    else throw new Error(`No seed for ${name}.${entry.key}: sheet type "${entry.type}" has no default`)   // loud: the sheet grew a shape this walk does not know
  })
  return file
}
export const seedSet = (title) => {
  const set = Object.fromEntries(FILE_NAMES.map(name => [name, seedFile(name)]))
  set.content.meta.pageTitle = title   // the ONE value the author gave —
  set.content.meta.heroTitle = title   // and the banner too, so the first Play is not blank
  return set
}

// ───────────── listing ─────────────
const serialize = (obj) => JSON.stringify(obj, null, 2) + "\n"   // the server's on-disk format
const countRows = (rows) => rows.reduce((n, row) => n + 1 + countRows(row.children ?? []), 0)   // ?? []: a v1 row has no children
const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"))

// the cheap facts the home screen shows for one FOLDER under games/ — what is
// on disk, read fresh. A folder that is not a game is still listed, with its
// problem instead of facts: the author should see the folder they made.
export const gameFacts = async (gamesDir, distDir, name) => {
  if (!isGameName(name)) return { name, error: "folder name must be lowercase letters, digits and single dashes — rename the folder" }
  const data = join(gamesDir, name, "data")
  let content
  try { content = await readJSON(join(data, "content.json")) }
  catch (error) { return { name, error: `data/content.json cannot be read (${error.code ?? error.message})` } }
  const optional = async (file) => { try { return await readJSON(join(data, `${file}.json`)) } catch (error) { if (error.code === "ENOENT") return null; throw error } }
  const types = await optional("types"), things = await optional("things")   // absent before v3
  let exported = false
  try { const manifest = await readJSON(join(distDir, name, MANIFEST)); exported = manifest.tool === TOOL && manifest.complete === true }
  catch { /* never exported, or not by our tool: false */ }
  return {
    name,
    title:    content.meta?.pageTitle ?? "",
    version:  content.version ?? null,
    rows:     Array.isArray(content.groups) ? countRows(content.groups) : null,
    types:    types?.types?.length ?? null,
    things:   things ? Object.values(things.things ?? {}).reduce((n, bucket) => n + bucket.length, 0) : null,
    exported
  }
}
export const listGames = async (gamesDir, distDir) => {
  let entries
  try { entries = await readdir(gamesDir, { withFileTypes: true }) }
  catch (error) { if (error.code === "ENOENT") return []; throw error }   // no games folder yet = no games yet
  const names = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".")).map(entry => entry.name).sort()
  return Promise.all(names.map(name => gameFacts(gamesDir, distDir, name)))
}

// ───────────── creating ─────────────
// The seed is built and CHECKED before anything is touched (a seed that does not
// fit is a bug in the sheets: a loud throw, never a quiet write). mkdir WITHOUT
// recursive is the existence check and the claim in one step: two "Create"
// clicks in the same instant cannot both pass an existsSync and both write —
// EEXIST is the caller's 409. Anything that fails AFTER the claim (a full disk)
// takes the half-made folder with it: a refusal or a failure leaves nothing behind.
export const createGame = async (gamesDir, name, title) => {
  const set = seedSet(title)
  const problems = validateSet(set)
  if (problems.length > 0) throw new Error(`the newborn set does not fit the schema: ${problems.map(problemText).join("; ")}`)
  await mkdir(gamesDir, { recursive: true })   // the root itself may be new (a scratch root)
  const dir = join(gamesDir, name)
  await mkdir(dir)                             // EEXIST → 409 in server.js
  try {
    await mkdir(join(dir, "data"))
    await mkdir(join(dir, "assets"))
    for (const file of FILE_NAMES) await writeFile(join(dir, "data", `${file}.json`), serialize(set[file]))
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
}
