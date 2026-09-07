import { content, rules, themes, types, things } from './loadData.js'
import { SHEETS, coreThingSchema, sheetOfType } from '/config/schema.js'

export const editorState = {
  content, rules, themes, types, things   // CHANGED: five files
}

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
