// NEW FILE: a newborn FILE, read from the sheets — and the bytes every writer in
// server/ puts it on disk as. Two subjects, one reason to share them: a book is seeded
// by the same walk a game is, and books.js may never import games.js (see names.js's
// header for the knot that rule avoids).
//
// The walk itself is games.js's seedFile, lifted verbatim and given its table as an
// argument. Nothing about it was game-shaped: FILE_SHEETS and BOOK_FILE_SHEETS have the
// same shape, and BOOK_FILE_SHEETS.types IS FILE_SHEETS.types (the same array object),
// so the same four cases answer both. Measured before the move: run over
// BOOK_FILE_SHEETS the walk already produced types/things/proposals that
// validateBookFile accepts.
//
// WHAT IT CANNOT SEED, and why that is right: book.json. Its four entries carry no
// `default` at all (there is no sensible default for a name, a title or an edition —
// they come from the author and from the folder), and it is the one file in the project
// that must carry NO `version` key. So seedBook builds its manifest explicitly and
// calls this for the three data files only. A caller-supplied triple is what seedSet
// already does for a game's pageTitle/heroTitle; the manifest is simply all triple.
import { SCHEMA_VERSION, SHEETS } from "../engine/config/schema.js"

// the server's one on-disk format. Every byte-identity oracle depends on it (T1 reads a
// shelf file back through JSON.parse and asserts serialize gives the same text, T2
// compares one edition's bytes to another's), so there is one spelling of it and every
// writer in server/ uses this.
export const serialize = (obj) => JSON.stringify(obj, null, 2) + "\n"

// NEW: what a seeded BOOK leaves unwritten, by file. A GAME must have a budget, so its seed
// writes totalBudget's default of 10 and always has. A book only PROPOSES one — and a
// proposal nobody made is not a proposal. Without this, every freshly created book proposed
// 10, so pinning two untouched books put them in the merge's budget-conflict pool and made
// the Page card say "books conflict on the budget" about a number neither author chose.
// Basic and Stats ship no proposals.json AT ALL for exactly this reason: a book with no
// opinion says nothing. `optionalNumber`'s absent state is that silence, and schema.js
// already spells it out — "absent = a book's proposal shows through". Measured: a
// proposals.json with no totalBudget passes validateBookFile with [].
// A TABLE and not a branch, so the day proposals.json grows a second opinion-bearing key,
// it is one row here rather than an `if` inside the walk.
export const BOOK_UNWRITTEN = { proposals: ["totalBudget"] }

// dinoEdit/view.js's newborn() applies one rule to one card: walk the sheet,
// write every entry's default (a FRESH copy), skip the ones whose default is
// null. This applies the same rule to a whole FILE.
export const bornFrom = (sheet) => {
  const born = {}
  sheet.forEach(entry => {
    if (entry.key === undefined || entry.default === null) return
    born[entry.key] = structuredClone(entry.default)
  })
  return born
}

// One file of a set, born from its own table. `fileSheets` names the top of each file:
// a "form" is one sheet-shaped object, a "cabinet" and "buckets" start empty (they are
// keyed by ids that do not exist yet), everything else carries its own default (groups:
// [], types: [], totalBudget: 10). `version` goes first, so a seed file has exactly the
// key order migrations.js writes and the oracles (B2) pin. The seed can never drift
// from the contract, because it is READ from the contract — and the callers check what
// they built with validateGame / validateBook anyway.
// CHANGED: takes its table as an argument, so a BOOK's three data files are seeded by
// this same walk rather than by a second copy of it (that copy is what would rot the
// day a sheet grows an entry).
export const seedFrom = (fileSheets, name, unwritten = []) => {
  const file = { version: SCHEMA_VERSION }
  fileSheets[name].forEach(entry => {
    // NEW: a key this SUBJECT is born without (see BOOK_UNWRITTEN). It is checked first
    // because it outranks every default below: the entry has one, and this subject still
    // does not write it.
    if (unwritten.includes(entry.key)) return
    if (entry.type === "form") file[entry.key] = bornFrom(SHEETS[entry.of])
    else if (entry.type === "cabinet" || entry.type === "buckets") file[entry.key] = {}
    // the rule bornFrom already had, learnt one level up — an entry whose default is
    // null is NOT WRITTEN at birth. things.order is the first of them: "order: null" is
    // not an empty arrangement, it is a broken file the validator refuses (the key
    // exists, so `optional` does not save it).
    else if (entry.default === null) return
    else if (entry.default !== undefined) file[entry.key] = structuredClone(entry.default)
    else throw new Error(`No seed for ${name}.${entry.key}: sheet type "${entry.type}" has no default`)   // loud: the sheet grew a shape this walk does not know
  })
  return file
}
