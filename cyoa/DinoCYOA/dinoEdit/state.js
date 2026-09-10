import { SHEETS, coreThingSchema, sheetOfType, thingKeys } from '/config/schema.js'
// NEW: the subject table — which drawers this page holds, how they merge, what is
// editable, what the address looks like. `editorState.subject.kind` names the row.
import { SUBJECTS } from './subject.js'
import { NO_SUBJECT } from './uiState.js'

// CHANGED: born EMPTY. main.js fills the drawers from the loader once the hash
// names a subject — the ONE place they are filled, once per page. On the home
// screen they stay null and nothing reads them (the home screen paints from
// GET /api/games, not from here). `subject` names what is in memory
// ({ kind, name, edition }; name '' = nothing open).
// CHANGED (stage 4): the drawers are no longer five. A GAME holds content/rules/
// themes/types/things; a BOOK holds book/types/things/proposals — types and things
// are the same two files ("a game's own stuff is its own book"), and the subject
// table says which list is this page's. The drawers a kind does not have stay null.
// NEW: everything after the drawers is DERIVED, never saved:
//   books    the loaded layers under this subject, one per pin (null = not on the shelf)
//   merged   the files of books-plus-subject flattened into one plain set — what every card READS
//   origins  id → the layer that defined it, for the read-only badges
//   proposed what the books proposed before the game decided, for the "X proposes …" lines
//   order    the layer labels in merge order, for the Books tab
//   faults   the merge's own complaints, for the banner and the refused save
//   shelf    the last GET /api/books receipt — what else is available to pin. CHANGED: it is
//            a cache with an invalidation (actions.forgetShelf), not a fact for the life of
//            the page: books/ CAN change under the author now, and a Books tab that did not
//            offer a book the author had just made would be a cache telling a lie.
//   pinnedBy NEW: which local games pin THIS edition. Only a book has one, and it is what
//            decides whether the edition is editable — null means "not asked yet", which
//            reads as frozen (see SUBJECTS.book.editable). A game never asks.
//   absent   NEW: which of a book's three OPTIONAL data files are not on disk at all. A
//            stand-in holds the containers the cards write into, and one that was never
//            touched is saved back as nothing — so looking at a book moves no bytes. See
//            loadData.js's standIn / bookBody, where both halves of that one fact live.
//   frozen   NEW: the BORDER's own sentence for "this edition is frozen", when the border is
//            the one that said it (a 409 on a save the screen believed was allowed). null
//            means nobody has said it, and the read-only banner then builds the sentence from
//            `pinnedBy` instead. Never re-worded: it is printed exactly as it arrived.
export const editorState = {
  subject: NO_SUBJECT(),
  content: null, rules: null, themes: null, types: null, things: null,
  book: null, proposals: null,
  books: [], merged: null, origins: null, proposed: null, order: [], faults: [], shelf: null,
  pinnedBy: null, absent: [], frozen: null
}

// NEW: the ONE way to reach this page's row of the subject table. It is a function and not
// a constant because the row follows what the page is HOLDING, and that is not known until
// the loader has answered. Everything that used to spell "a game" asks here instead.
export const S = () => SUBJECTS[editorState.subject.kind]

// NEW: the subject's own drawers alone. editorState carries the derived half too, and the
// merge must never be handed its own last answer to clone — so the two places
// that want "this subject's files" (the snapshot below and remerge) ask here.
// CHANGED: which drawers those are is the table's answer, not a constant.
export const ownFiles = () => Object.fromEntries(S().files.map(name => [name, editorState[name]]))

// NEW: "does memory differ from the disk?" — answered by comparing TEXT, not by
// flagging every edit: the bind-loop writes state from dozens of places, and one
// forgotten flag would lie. Serialising a whole game costs nothing at this size.
// main.js calls markSaved after the first paint and after every green save.
// The books are NOT in the snapshot and do not need to be: a pin is written in
// content.json, so pinning, un-pinning and upgrading all show up here already —
// and a BOOK's requires live in book.json, which is one of its own drawers for
// exactly the same reason.
let savedSnapshot = ''
const snapshot = () => JSON.stringify(S().files.map(name => editorState[name]))
export const markSaved = () => { savedSnapshot = snapshot() }
export const hasUnsavedEdits = () => editorState.subject.name !== '' && snapshot() !== savedSnapshot
// CHANGED: was gameTitle. CHROME SPEAKS TITLES (§6): the page title, the leave-confirm and
// the header all say what the author calls the thing — a game's pageTitle, a book's title —
// and fall back to the FOLDER name only when there is no title to speak.
export const subjectTitle = () => S().title(editorState) || editorState.subject.name

// NEW: the whole world, re-flattened. Called at the top of every paint (see
// render) because a paint may follow ANY edit — a pin, a new type, a renamed
// field — and every card below reads the merged set, not the subject's own files.
// The merge is pure and cheap at this size; running it always is what keeps the
// screen from ever showing a stale flattening.
// CHANGED: WHERE the subject sits in the stack is the table's answer. A game is the
// top layer (`game:`), a book is the LAST BOOK layer over the books it requires
// (`game: null`, which is merge.js's own book mode) — a different position, not a
// different argument shape, and it is why `isOwn` asks the table for the label
// instead of comparing against GAME_LAYER.
export const remerge = () => {
  const { set, origins, proposed, order, faults } = S().merge(editorState)
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
