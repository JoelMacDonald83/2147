import { SHEETS, coreThingSchema, sheetOfType } from '/config/schema.js'
import { FILE_NAMES } from '/config/validate.js'

// CHANGED: born EMPTY. main.js fills the five drawers from loadGame() once the
// hash names a game — the ONE place they are filled, once per page. On the home
// screen they stay null and nothing reads them (the home screen paints from
// GET /api/games, not from here). `game` names the CYOA in memory ('' = none).
export const editorState = { game: '', content: null, rules: null, themes: null, types: null, things: null }

// NEW: "does memory differ from the disk?" — answered by comparing TEXT, not by
// flagging every edit: the bind-loop writes state from dozens of places, and one
// forgotten flag would lie. Serialising a whole game costs nothing at this size.
// main.js calls markSaved after the first paint and after every green save.
let savedSnapshot = ''
const snapshot = () => JSON.stringify(FILE_NAMES.map(name => editorState[name]))
export const markSaved = () => { savedSnapshot = snapshot() }
export const hasUnsavedEdits = () => editorState.game !== '' && snapshot() !== savedSnapshot
export const gameTitle = () => editorState.content?.meta.pageTitle || editorState.game

// NEW: two entries with one key would overwrite each other in every sheet
// walk (two fresh fields both still called "newField", or a field named like
// a core one — or "id", which would blank the thing's own id at birth).
// Nothing is fixed here; it is said out loud rather than lost quietly.
const warnDuplicateKeys = (type, sheet) => {
  const keys = ['id', ...sheet.map(entry => entry.key)]
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
export const buildSheets = () => {
  const sheets = { ...SHEETS }
  editorState.types.types.forEach(type => {
    const sheet = [...coreThingSchema, ...sheetOfType(type)]
    warnDuplicateKeys(type, sheet)
    sheets[type.id] = sheet
  })
  return sheets
}
