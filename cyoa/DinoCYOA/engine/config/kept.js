// NEW FILE: the kept sheet — the FILE a player takes away, and the door it comes
// back through.
//
// sheet.js owns what a sheet IS (its vocabulary, its cost rule, its document);
// this owns how a sheet is WRITTEN DOWN and how one is READ BACK, plus every
// sentence a player ever sees about it. That split is not tidiness — it is what
// keeps the import graph acyclic: sheet.js is a LEAF (schema.js only) so
// references.js may use checkFills, while THIS file sits one storey up and may
// use validate.js's checkFieldValue. Nothing imports kept.js back.
//
//     schema.js ── sheet.js ── references.js ── validate.js ── kept.js
//
// Pure, DOM-free, fetch-free, no work at import time: node runs it (the oracles
// drive it with fixtures) and the browser runs it (app.js's three doors). It
// never touches localStorage or a Blob — that is app.js's job, because the file
// FORMAT and the places a file can live are two different subjects.
//
// THE SENTENCE THIS FILE SERVES:
//   a removed rock must not cost a player their character. So the file's IDENTITY
//   being wrong refuses the WHOLE file (nothing is loaded), while a REFERENCE
//   inside it being gone drops THAT entry, BY NAME, and loads the rest.
import { placementSheet } from "./schema.js"
import { playerFields, blankFields, blankValues } from "./sheet.js"
import { checkFieldValue } from "./validate.js"

// NEW: the FILE's own edition — deliberately NOT SCHEMA_VERSION. This file is
// written by a player's browser, and the question at the door is "can this game
// load it?", never "is this file at schema 6?". A schema bump must not invalidate
// every character anyone ever saved. Nothing climbs a kept file in this stage
// (§4.3): a `kept` GREATER than this is one loud refusal, and that refusal is
// exactly the room a future KEPT_MIGRATIONS table needs.
export const KEPT_VERSION = 1

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)

// NEW: a store's values laid over a complete BLANK — every slot present, in the
// canonical order, holding what the player has or the default they never touched.
// Used for both halves of the file (the typed fields and one pick's values), so
// the two are written by the same rule instead of by two careful hands.
// `blank` is freshly built by blankFields/blankValues (each slot already cloned),
// so filling it in place aliases nothing; the values themselves are cloned because
// a `lines` value is an ARRAY, and a file that shared an array with gameState
// would change under the player's fingers.
const complete = (blank, held) => {
  Object.keys(blank).forEach(key => { if (held?.[key] !== undefined) blank[key] = structuredClone(held[key]) })
  return blank
}

// NEW: the keepsake. It is built KEY BY KEY in the canonical order (§2.8) from the
// two stores and NOTHING derived — no cost, no spent, no built sheet. Derived data
// in a file is data that can drift; the printable page is the human artifact, this
// is the machine's. Because every rule here is a WRITER's rule, read → write is
// byte-exact by construction rather than by care.
//   title      content.meta.pageTitle — for MESSAGES only, never a gate (a title is
//              not an id, two games may share one, and retitling your own game must
//              not invalidate every sheet you ever made)
//   sheetId    the declared type's id — this IS the gate
//   type       that type, for the field order and the defaults
//   rows       every row at every depth, hydrated (row.fills is a SECTION or null)
//   typed      gameState.typed          picksOf   (row) => its picks, in pick order
//   valuesFor  (row, item) => that pick's placement values
// picks holds EVERY pick, including those in rows that fill nothing: the file is
// the player's two stores, and a plain picker's choice is still a choice they made
// (and may still be what opens the gated row below it).
// There is deliberately no `books` key: content.books is [] at runtime for every
// game (merge.js writes it empty), so a pin list here could only ever say []. The
// provenance that works is { game, sheet } plus re-resolving every reference
// against the world the file is loaded into — stricter, because it catches a
// deleted thing, and quieter, because an upgraded book that moved nothing says
// nothing.
export const keptFrom = ({ title, sheetId, type, rows, typed, picksOf, valuesFor }) => ({
  kept: KEPT_VERSION,
  game: title,
  sheet: sheetId,
  // name first, then every field of every FIELDS section in sheet order, ALWAYS
  // COMPLETE — a document says 10, not "nothing". It is also why the round trip is
  // byte-stable, and why a book changing a default later cannot silently change a
  // sheet somebody already kept.
  fields: complete(blankFields(type), typed),
  // flattened ROW order, then pick order. `name` is redundant ON PURPOSE: it is the
  // only way the loader can say "THE BANANA is no longer offered" about a thing
  // that no longer exists to be named. `values` is always present, even {} — a pick
  // is ONE shape, and a reader that must handle two is where a bug hides.
  picks: rows.flatMap(row => picksOf(row).map(item => ({
    row: row.id,
    thing: item.id,
    name: item.name,
    values: complete(blankValues(row.fills ?? null), valuesFor(row, item))
  })))
})

// the bytes: the same two-space, trailing-newline spelling every JSON file in this
// project is written with, so a kept sheet reads like the data it came from
export const sheetText = (kept) => JSON.stringify(kept, null, 2) + "\n"

// lowercase, every run of non-alphanumerics becomes one dash, the ends trimmed
const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
// NEW: what the download is called. The player's own name for their character
// first ("Rexina" → rexina-sheet.json); an unnamed sheet falls back to the game's
// title (adopt-a-dino-cyoa-sheet.json); and a name that slugs away to nothing (an
// emoji, say) still has to produce a filename, so "sheet" is the floor.
export const keptFileName = (kept) => `${slug(kept.fields.name || kept.game) || "sheet"}-sheet.json`


// ── reading one back ────────────────────────────────────────────────────────────
//
// THE MESSAGES BELOW ARE THE ONLY ONES IN THIS PROJECT WRITTEN FOR A PLAYER.
// Every other message names a path (things.things["basic:place"][2].kind) because
// an AUTHOR has to go and fix that line. A player has never seen a file and never
// will, so these are plain sentences with no paths in them. app.js shows them on
// the page; the console gets every one prefixed "Kept sheet — ", so a curious
// author still reads them in order.

const refuse = (refusal) => ({ ok: false, refusal })   // nothing else on the answer: a refusal loaded nothing

// F11 / F13 end with the VALIDATOR's own phrase, verbatim — "it must be a number
// (found "ten")". One contract, two doors: the same table that refuses an author's
// file refuses a hand-edited kept sheet, so the player is told the TRUE reason
// rather than a second, kinder-sounding approximation of it. The problem's PATH is
// dropped on purpose (see above) and only the first problem is quoted: one slot,
// one sentence.
const kindProblem = (field, value) => checkFieldValue(field, value)[0]?.message ?? null
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// NEW: the whole judgement, in ONE pure function — pure so the oracles can drive it
// with fixtures and compare `world` before and after, and TOTAL so garbage in is a
// refusal rather than a throw. It decides; it never DOES: the caller assigns the
// fields and walks `places` through gameState.place, which is the single door a
// click and a restore both go through.
//   world  { title, sheetId, type, rows } — `rows` is flattenGroups(groups), HYDRATED,
//          so row.id, row.label, row.fills, row.items and row.max are all present.
//          Handed in by state.js, so this file never imports the border.
//          (`title` rides along because the caller hands ONE world to the writer and
//          the reader; the refusal below names the FILE's game, not this one.)
//   out    { ok: false, refusal } · { ok: true, fields, places: [{ row, item, values }], notes }
//
// Checks 1–5 are IDENTITY: first miss wins and NOTHING is loaded, because nothing
// about the player's current game could be salvaged from that file and touching
// their current state would be vandalism. Checks 6–13 are REFERENCES: every miss is
// collected, named, and the rest loads.
//
// THE ADD-ONLY RULE, READ FROM THE PLAYER'S SIDE (checks 6 and 11): a key the file
// is MISSING is filled from the field's own default and is fine — that is exactly
// what a pinned book being upgraded looks like, and books are add-only. A key the
// file CARRIES that the game no longer has means something was REMOVED, and that is
// named and dropped. Absent key = default; unknown key = named and dropped.
//
// What it does NOT judge, and why. The row's GATE: a pick may legitimately open the
// row that holds the next pick, so visibility is settled ONCE at the end by the
// caller. The BUDGET: dropping by cost means choosing WHICH entry the player would
// have sacrificed — a guess about their character. Loading over budget and saying
// so on the status line is the honest answer.
export const readKept = (text, world) => {
  const notes = []
  // NEW: a note that names a CAUSE rather than a pick is said ONCE. A placement
  // field that left the game is one cause however many picks carried it, and
  // repeating its sentence per pick would read as several different losses.
  const saidOnce = new Set()
  const sayOnce = (note) => { if (!saidOnce.has(note)) { saidOnce.add(note); notes.push(note) } }

  // 1 — is it even text a machine wrote?
  let file
  try { file = JSON.parse(text) } catch { return refuse("That is not a kept sheet — the text is not JSON. Nothing was loaded.") }

  // 2 — is it OUR shape? The three keys the reader below indexes into, checked
  // before anything indexes into them. `kept` must be a real number: JSON.parse
  // turns 1e999 into Infinity, and "the edition is Infinity" is not a newer file,
  // it is a broken one.
  if (!isPlainObject(file) || !Number.isFinite(file.kept) || !isPlainObject(file.fields) || !Array.isArray(file.picks))
    return refuse("That is not a kept sheet. Nothing was loaded.")

  // 3 — kept by a format this code has never heard of. Fail CLOSED: a newer file
  // may hold keys whose meaning we would have to guess, and guessing at a player's
  // character is worse than refusing it.
  if (file.kept > KEPT_VERSION)
    return refuse("That sheet was kept by a newer version of this game. Nothing was loaded.")

  // 4 — this game builds no sheet at all (every v5 game, vampire included).
  if (!world.type)
    return refuse("This game does not build a sheet, so there is nothing to load into.")

  // 5 — a sheet of another KIND. The file's own `game` is quoted, because that is
  // where the player last saw it; when the file names no game, say so plainly
  // rather than printing "undefined" at somebody.
  const keptGame = typeof file.game === "string" && file.game !== "" ? file.game : "another game"
  if (file.sheet !== world.sheetId)
    return refuse(`That sheet was kept for "${keptGame}", which builds a different kind of sheet. Nothing was loaded.`)

  // 6 and 7 — the typed half. Start from a complete BLANK and lay the file's values
  // over it, so a slot the file lost, never had, or filled with nonsense ends up
  // holding its DEFAULT rather than nothing: a sheet is a document, and a blank
  // Strength is 10. Object.entries reads own keys only — JSON.parse makes
  // "__proto__" an own property, and it meets check 6 like any other unknown key.
  const slots = new Map(playerFields(world.type).map(field => [field.key, field]))
  const fields = blankFields(world.type)
  Object.entries(file.fields).forEach(([key, value]) => {
    const field = slots.get(key)
    if (field === undefined) {
      notes.push(`The field "${key}" is no longer on this sheet; what you typed there was dropped.`)
      return
    }
    const problem = kindProblem(field, value)
    if (problem !== null) {
      notes.push(`"${field.caption}" was dropped — it ${problem}.`)
      return
    }
    fields[key] = value
  })

  // 8 to 12 — the picked half, one pick at a time, in FILE order (which is the
  // order it was written in: flattened row order, then pick order).
  const rowById = new Map((world.rows ?? []).map(row => [row.id, row]))
  const taken = new Set()          // "<rowId> <thingId>" — the address a pick has
  const places = []
  let lostToRows = 0
  file.picks.forEach(pick => {
    // 8 — the row itself is gone. These are GROUPED into one sentence with a count:
    // naming each pick would be naming things the player can no longer act on, and
    // a whole section disappearing is ONE piece of news, not five. A pick that is
    // not even an object lands here too — it belongs to no row we have.
    const row = rowById.get(pick?.row)
    if (row === undefined) { lostToRows += 1; return }

    // 9 — the row is still here but no longer OFFERS that thing (it was deleted, or
    // the row's filter no longer matches it, or the section it filled went away so
    // the border emptied it). This is the one message that needs the file's own
    // `name`: the thing is gone, so today's shelf cannot name it for us.
    const item = (row.items ?? []).find(each => each.id === pick.thing)
    if (item === undefined) {
      const named = typeof pick.name === "string" && pick.name !== "" ? pick.name : String(pick.thing)
      notes.push(`"${named}" is no longer offered in ${row.label}; it was dropped.`)
      return
    }

    // 10 — the same thing twice in one row. A hand-edit, or two files spliced: the
    // engine guarantees a row holds a thing at most once (that is what makes
    // (row, thing) an address), so the second copy has nowhere to live.
    const address = `${row.id} ${item.id}`
    if (taken.has(address)) {
      notes.push(`"${item.name}" was picked twice in ${row.label}; the second was dropped.`)
      return
    }
    taken.add(address)

    // 11 and 12 — this pick's placement values, judged exactly like the typed half:
    // a complete blank, the file's values laid over it, every unknown key named and
    // every ill-typed value named. A row that fills nothing has no placement fields
    // at all, so ANY value on it is a leftover — and it is the row's own label that
    // has to appear in the sentence, because there is no section to name.
    const section = row.fills ?? null
    const placementFields = new Map(section === null ? [] : placementSheet(section).map(field => [field.key, field]))
    const values = blankValues(section)
    Object.entries(isPlainObject(pick.values) ? pick.values : {}).forEach(([key, value]) => {
      const field = placementFields.get(key)
      if (field === undefined) {
        // the field is gone, so its caption is gone with it: the KEY is all we have
        // left to show the player, dressed the way a caption reads
        const shown = key.charAt(0).toUpperCase() + key.slice(1)
        sayOnce(`"${section?.caption ?? row.label} · ${shown}" is no longer part of this game; it was dropped.`)
        return
      }
      const problem = kindProblem(field, value)
      if (problem !== null) {
        notes.push(`"${field.caption}" on "${item.name}" was dropped — it ${problem}.`)
        return
      }
      values[key] = value
    })

    places.push({ row, item, values })
  })
  if (lostToRows > 0)
    notes.push(`${plural(lostToRows, "pick was", "picks were")} dropped — the part of the game ${lostToRows === 1 ? "it" : "they"} came from is gone.`)

  // 13 — the row's max may have been LOWERED since the sheet was kept. The TAIL in
  // file order goes: the picks a player made first are the ones they meant most,
  // and "keep the first n" is a rule anybody can predict — choosing by cost or by
  // name would be the engine deciding which part of their character to delete.
  const held = new Map()
  places.forEach(place => held.set(place.row, (held.get(place.row) ?? 0) + 1))
  held.forEach((count, row) => {
    if (count <= row.max) return
    notes.push(`"${row.label}" now allows ${plural(row.max, "pick", "picks")}, not ${count} — ${plural(count - row.max, "pick was", "picks were")} dropped.`)
  })
  const room = new Map()
  const survivors = places.filter(place => {
    const used = (room.get(place.row) ?? 0) + 1
    room.set(place.row, used)
    return used <= place.row.max
  })

  return { ok: true, fields, places: survivors, notes }
}
