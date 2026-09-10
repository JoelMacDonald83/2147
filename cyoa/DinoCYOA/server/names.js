// NEW FILE: the folder-name grammar and the title→folder step, in the one place BOTH
// halves of the server may read.
//
// WHY IT IS NOT IN games.js ANY MORE. A book author needs exactly what a game author
// needs: "Dinosaur Age" → dinosaur-age, and a sentence when that cannot be done. The
// rules are not merely similar, they are THE SAME rules — schema.js's BOOK_NAME is
// games.js's NAME, and oracle N2 pins the two regexes equal on purpose. But books.js
// may never import games.js (games.js imports books.js; two files that import each
// other are a knot nobody can read), so the shared half had to move somewhere both
// may reach. This file is that somewhere: it imports nothing at all.
//
// WHAT IS DELIBERATELY NOT HERE: the GRAMMAR sentence. "x is not a book name" is
// written once, in engine/config/validate.js's RULES.book, and asked of the manifest a
// writer is about to put on disk — so a create or a rename gets that sentence from the
// validator, at `book.name`, and never from a second copy here. What is left below is
// the three questions a regex cannot answer: is there a title at all, does it give a
// folder name, and is that name one the editor keeps for itself.

// A game name is a folder under games/ AND one segment of three URLs
// (/games/<name>/, /dist/<name>/, /api/games/<name>/…). A BOOK name is a folder under
// books/ and one segment of two more (/books/<name>/…, /api/books/<name>/…). ONE
// grammar decides all of them: lowercase a–z and 0–9, single dashes between runs,
// 1–40 characters, nothing else. So a name can never be "..", never hold a slash or a
// "%", never be "Dino" (macOS would find dino/ for it; a Linux host would not).
export const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const NAME_MAX = 40
// the one word the editor's hash keeps for a screen that is not a game (#home)
// CHANGED (stage 4): "book" joins it. The editor's address spends its first segment on
// the literal `book` (#book/<name>/<edition>/<tab>) because book and game folder names
// share ONE grammar, so #basic is otherwise ambiguous. Without reserving it, an author
// could create games/book and shadow every book address. dinoEdit/uiState.js derives the
// same list from the address table and oracle N2 pins the two equal — server/ never
// imports dinoEdit/, so a check is the only thing that can hold them together.
export const RESERVED = ["home", "book"]
export const isGameName = (name) => typeof name === "string" && name.length <= NAME_MAX && NAME.test(name)

// "Space Pirates!" → "space-pirates". Accents are stripped (é → e), every run
// of anything that is not a letter or digit becomes one dash, end dashes go.
export const slugOf = (title) => title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

// NEW: the one sentence about a TITLE itself, asked on its own — a create route that
// was GIVEN a folder name still wants to know there is something to call the thing on
// the Library's card. `path` so the caller's coordinate system is the receipt's.
export const blankTitle = (title, path = "title") =>
  typeof title !== "string" || title.trim() === "" ? [{ path, message: "must be a non-empty string" }] : []

// NEW: what is wrong with a folder NAME, as [{ path, message }] — [] means fine, and
// never more than one sentence. These are the three questions the regex is silent
// about; the regex's own answer comes from RULES.book over the manifest (see the
// header). Lifted out of titleProblems unchanged, so the sentences an author already
// reads are the same bytes — oracle N2 pins every one of them.
export const nameProblems = (name, path = "name") => {
  if (typeof name !== "string" || name === "") return [{ path, message: "must be a non-empty string" }]
  if (name.length > NAME_MAX) return [{ path, message: `folder name "${name}" is longer than ${NAME_MAX} characters` }]
  if (RESERVED.includes(name)) return [{ path, message: `"${name}" is a name the editor keeps for itself` }]
  return []
}

// what is wrong with a new game's or a new book's title, as [{ path, message }] — []
// means fine. CHANGED: the last three lines are nameProblems now, asked at "title"
// because "title" is the key the caller sent. Same questions, same sentences, same
// single problem per refusal; the folder-name half is just askable on its own too.
export const titleProblems = (title) => {
  const blank = blankTitle(title)
  if (blank.length > 0) return blank
  const name = slugOf(title)
  if (name === "") return [{ path: "title", message: "gives no folder name (it needs a letter or a digit)" }]
  return nameProblems(name, "title")
}
