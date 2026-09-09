import { SHEETS, coreThingSchema, sheetOfType, thingKeys } from '/config/schema.js'
import { FILE_NAMES } from '/config/validate.js'
// NEW: the merge — the same pure function the game runs at load and the server
// runs on save. The editor runs it at every paint, so what the author reads is
// exactly what the player will get.
import { mergeLayers } from '/config/merge.js'

// CHANGED: born EMPTY. main.js fills the five drawers from loadGame() once the
// hash names a game — the ONE place they are filled, once per page. On the home
// screen they stay null and nothing reads them (the home screen paints from
// GET /api/games, not from here). `game` names the CYOA in memory ('' = none).
// NEW: everything after `things` is DERIVED, never saved:
//   books    the loaded layers under this game, one per pin (null = not on the shelf)
//   merged   the five files of books-plus-game flattened into one plain set — what every card READS
//   origins  id → the layer that defined it, for the read-only badges
//   proposed what the books proposed before the game decided, for the "X proposes …" lines
//   order    the layer labels in merge order, for the Books tab
//   faults   the merge's own complaints, for the banner and the refused save
//   shelf    the last GET /api/books receipt — what else is available to pin
export const editorState = {
  game: '', content: null, rules: null, themes: null, types: null, things: null,
  books: [], merged: null, origins: null, proposed: null, order: [], faults: [], shelf: null
}

// NEW: the five drawers alone. editorState carries the derived half too, and the
// merge must never be handed its own last answer to clone — so the two places
// that want "this game's files" (the snapshot below and remerge) ask here.
export const ownFiles = () => Object.fromEntries(FILE_NAMES.map(name => [name, editorState[name]]))

// NEW: "does memory differ from the disk?" — answered by comparing TEXT, not by
// flagging every edit: the bind-loop writes state from dozens of places, and one
// forgotten flag would lie. Serialising a whole game costs nothing at this size.
// main.js calls markSaved after the first paint and after every green save.
// The books are NOT in the snapshot and do not need to be: a pin is written in
// content.json, so pinning, un-pinning and upgrading all show up here already.
let savedSnapshot = ''
const snapshot = () => JSON.stringify(FILE_NAMES.map(name => editorState[name]))
export const markSaved = () => { savedSnapshot = snapshot() }
export const hasUnsavedEdits = () => editorState.game !== '' && snapshot() !== savedSnapshot
export const gameTitle = () => editorState.content?.meta.pageTitle || editorState.game

// NEW: the whole world, re-flattened. Called at the top of every paint (see
// render) because a paint may follow ANY edit — a pin, a new type, a renamed
// field — and every card below reads the merged set, not the game's own files.
// The merge is pure and cheap at this size; running it always is what keeps the
// screen from ever showing a stale flattening.
export const remerge = () => {
  const { set, origins, proposed, order, faults } = mergeLayers({ books: editorState.books, game: ownFiles() })
  Object.assign(editorState, { merged: set, origins, proposed, order, faults })
}

// NEW: two entries with one key would overwrite each other in every sheet
// walk (two fresh fields both still called "newField", or a field named like
// a core one — or "id", which would blank the thing's own id at birth).
// Nothing is fixed here; it is said out loud rather than lost quietly.
// CHANGED: reads thingKeys — the sheet's own list of "every key a thing of this
// type may hold", which now spans sections: a fields section's fields AND a list
// section's key (the array of placements lives under it).
const warnDuplicateKeys = (type) => {
  const keys = ['id', ...thingKeys(type)]
  keys.forEach((key, at) => {
    if (keys.indexOf(key) !== at) {
      console.warn(`Type "${type.label}" has two fields keyed "${key}" — rename one`)
    }
  })
}

// NEW: the phonebook the cards read. schema.js knows the fixed sheets; the
// sheets for THINGS depend on the loaded types, so they are built here, one
// per type, filed under the type's id: the core fields first, then the
// author's fields with their kind's default. view.js asks for a fresh one at
// the top of every paint, because types are born, edited and removed in-session.
// CHANGED: one sheet per MERGED type. A thing of Basic's Character is drawn from
// Basic's sections plus whatever Stats and Dinosaur Age added to them — the
// author never sees the seam, which is the whole point of the merge.
export const buildSheets = () => {
  const sheets = { ...SHEETS }
  editorState.merged.types.types.forEach(type => {
    warnDuplicateKeys(type)
    sheets[type.id] = [...coreThingSchema, ...sheetOfType(type)]
  })
  return sheets
}
