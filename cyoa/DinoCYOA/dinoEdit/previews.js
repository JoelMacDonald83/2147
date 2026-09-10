// NEW FILE (stage 4): WHAT A SHELF MUTATION WILL DO, COUNTED BEFORE IT IS DONE.
//
// Three of the Library's buttons are not reversible. Renaming a book rewrote 73 ids and one
// pin on the real shelf; deleting one takes every edition of it; "Save as a book" moves part
// of a game onto the shelf and leaves the rest behind. None of those is a thing to ask an
// author to confirm blind, and none of them has a dry-run route — so this file reads the disk
// and counts, and the dialogs in library.js print what it says.
//
// IT WRITES NOTHING AND IT NEVER POSTS. Every function here is "fetch, count, say"; the
// button that follows is the caller's.
//
// THE ID COUNT IS THE SERVER'S OWN WALK. `eachId` (engine/config/ids.js) is the one place
// "where an id can hide" is written down — the rename route walks it to build its map and
// this walks it to count the same positions, so a preview cannot fall behind the thing it is
// previewing. The prefix test is the same one too: every string AT an id position starting
// "<name>:", which is why a label that happens to read like an id is prose and is not counted.
//
// WHAT A PREVIEW CANNOT SEE, said once here rather than hedged in three dialogs: it reads
// what the EDITOR can reach — the shelf over /books/…, a game's files over /games/…/data/…,
// and the list of games over /api/games. The server's census reads the raw pins out of every
// game's content.json; a game whose merge was refused does not appear in the listing's layer
// order, so a count here can be smaller than what the route does. Every dialog therefore
// prints the ROUTE's own receipt afterwards, which is the number that actually happened.
import { eachId } from '/config/ids.js'
import { mergeLayers } from '/config/merge.js'
import { FILE_SHEETS, BOOK_FILE_SHEETS } from '/config/schema.js'
import { loadBook } from '/helpers.js'
import { loadGame, loadBooks } from './loadData.js'
import { rowsIn } from '/config/references.js'

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`
// "entries", not plural()'s "entrys" — the same exception books.js's factsOf already makes,
// because a shelf ENTRY is the word this project uses for a thing on a shelf
const entries = (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`
const countIn = (buckets) => Object.values(buckets ?? {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0)

// the merged phonebook a walk needs: which of a thing's keys hold placements, and whether a
// demand's value is a thing id. null = this stack will not merge, which is itself the answer
// — ids that cannot be found cannot be counted, and the route refuses for the same reason.
const mergedTypes = (books, game) => {
  try { return mergeLayers({ books, game }).set.types.types }
  catch { return null }
}

// every id position in one file set that sits in this namespace. `unknownSheets` is carried
// out rather than swallowed: a bucket whose sheet nothing defines has its placements
// unreachable, and the rename route REFUSES on exactly that — so a preview that hid it would
// promise a rename the server is about to refuse.
const idsIn = (files, types, space, fileSheets) => {
  let found = 0
  const { unknownSheets } = eachId(files, types, ({ id }) => { if (id.startsWith(space)) found += 1 }, fileSheets)
  return { found, unknownSheets }
}

// ───────────────────────── rename, and delete ─────────────────────────

// ONE EDITION's contribution: its own ids, and the ids its own files use to point at them.
const editionCount = async (name, edition, space) => {
  const pin = { name, edition }
  const layer = await loadBook(`/books/${name}/${edition}/`, pin)
  if (layer === null) return { what: `books/${name}/${edition}`, unreadable: true }
  const required = await loadBooks(layer.manifest?.requires)
  const types = mergedTypes([...required, layer], null)
  if (types === null) return { what: `books/${name}/${edition}`, unmergeable: true }
  const files = { book: layer.manifest, types: layer.types, things: layer.things, proposals: layer.proposals }
  return { what: `books/${name}/${edition}`, ...idsIn(files, types, space, BOOK_FILE_SHEETS) }
}

// ONE GAME's contribution: every reference it holds into this book's namespace (a game's
// rowOverrides are keyed by a book's row ids and its things sit in buckets keyed by a book's
// SHEET ids, so a rename that touched only the book would orphan all of them), plus the pins
// that name the book — a different grammar, counted separately, exactly as the receipt
// reports `{ ids, pins }` separately.
const gameCount = async (game, name, space) => {
  let own
  try { own = await loadGame(game) } catch { return { what: `games/${game}`, unreadable: true } }
  const types = mergedTypes(own.books, own)
  if (types === null) return { what: `games/${game}`, unmergeable: true }
  const files = { content: own.content, rules: own.rules, themes: own.themes, types: own.types, things: own.things }
  const pins = (own.content?.books ?? []).filter(pin => pin?.name === name).length
  return { what: `games/${game}`, pins, ...idsIn(files, types, space, FILE_SHEETS) }
}

// WHAT A RENAME WOULD REWRITE. `editions` is the shelf listing's editions for this book;
// `pinners` is books.js's census ([{ game, edition }]).
// The two refusals the route makes that a count would otherwise hide are surfaced here as
// `blocked`, so the dialog can say "this will be refused, and why" instead of offering a
// button that cannot work: a book ANOTHER BOOK requires cannot be renamed at all (rewriting
// a frozen edition to follow it is what "editions are frozen" forbids), and an edition or a
// game that will not merge cannot have its ids found.
export const renamePreview = async (name, editions, pinners, shelf) => {
  const space = `${name}:`
  const subjects = []
  for (const edition of (editions ?? []).map(each => each.edition).filter(Number.isInteger)) {
    subjects.push(await editionCount(name, edition, space))
  }
  for (const game of [...new Set(pinners.map(pin => pin.game))]) {
    subjects.push(await gameCount(game, name, space))
  }
  const dependants = (shelf ?? []).flatMap(book => book.name === name ? [] :
    (book.editions ?? []).filter(edition => (edition.requires ?? []).some(req => req?.name === name))
      .map(edition => `books/${book.name}/${edition.edition}`))
  return {
    space,
    editions: subjects.filter(subject => subject.what.startsWith('books/')).map(subject => subject.what),
    games:    [...new Set(pinners.map(pin => pin.game))],
    ids:      subjects.reduce((n, subject) => n + (subject.found ?? 0), 0),
    pins:     subjects.reduce((n, subject) => n + (subject.pins ?? 0), 0),
    blocked: [
      ...dependants.map(where => `${where} requires this book — a required book cannot be renamed, because rewriting a frozen edition to follow it is exactly what "editions are frozen" forbids.`),
      ...subjects.filter(subject => subject.unreadable).map(subject => `${subject.what} cannot be read — a rename rewrites every edition or none of them.`),
      ...subjects.filter(subject => subject.unmergeable).map(subject => `${subject.what} will not merge with the books under it, so its ids cannot all be found.`),
      ...subjects.flatMap(subject => (subject.unknownSheets ?? []).length === 0 ? []
        : [`${subject.what} holds things on ${subject.unknownSheets.join(', ')}, which nothing under it defines — the rename cannot see what is inside them.`])
    ]
  }
}

// WHAT A DELETE WOULD TAKE. The blast radius in the two units that matter: how many editions
// (the folders that go) and how many ids (the work inside them). An edition that cannot be
// read is counted as a folder and not as ids, which is the honest shape — it is still going.
export const deletePreview = async (name, editions) => {
  const space = `${name}:`
  const counted = []
  for (const edition of (editions ?? []).map(each => each.edition).filter(Number.isInteger)) {
    counted.push(await editionCount(name, edition, space))
  }
  return {
    editions: (editions ?? []).length,
    ids: counted.reduce((n, subject) => n + (subject.found ?? 0), 0),
    unreadable: counted.filter(subject => subject.unreadable || subject.unmergeable).map(subject => subject.what)
  }
}

// ───────────────────────── "Save as a book" ─────────────────────────

// WHAT WOULD TRAVEL, AND WHAT WOULD NOT. The honest half is `left`: a game's own layer is not
// a book, and four of the five things in it have no book-shaped home. Measured on the real
// games: games/dino's own layer is 8 Characters + 2 Places, one shelf arrangement and FOUR
// rowOverrides — and the rowOverrides are the whole of its row taste, so for dino `left` is
// the longer half of the answer. games/space holds nothing at all and is refused here rather
// than at the route, with the same sentence either way.
//
// EVERY SENTENCE IS ABOUT SOMETHING THE GAME ACTUALLY HAS. A game with no arrangement is not
// told that arrangements do not travel; `left` is a list of facts, not a list of rules.
//
// IT READS THE DISK, not the open editor — the route does too (it is a POST on the game, and
// it reads the game's files), so the preview and the write see the same bytes. An author with
// unsaved edits is told to save first by the caller.
export const extractPreview = async (game) => {
  let own
  try { own = await loadGame(game) } catch (error) { return { error: error.message } }
  const types  = own.types?.types ?? []
  const things = countIn(own.things?.things)
  const rows   = rowsIn(own.content?.groups ?? []).length
  const moved  = { types: types.length, things, rows }

  const left = []
  const overrides = Object.keys(own.content?.rowOverrides ?? {}).length
  if (overrides > 0) left.push(`${plural(overrides, 'house rule')} on rows the books propose stay with games/${game} — a book may not override another book's row.`)
  const arranged = Object.keys(own.things?.order ?? {}).length
  if (arranged > 0) left.push(`the shelf arrangement for ${plural(arranged, 'sheet')} stays with games/${game} — a book may not arrange a shelf.`)
  if ((own.content?.sheet ?? '') !== '') left.push(`the player sheet declaration stays with games/${game} — a book proposes sheets, only a game chooses one.`)
  if (own.content?.meta?.pageTitle || own.content?.meta?.heroTitle) left.push(`the page title and hero stay with games/${game}.`)
  const themed = Object.keys(own.themes?.groupThemes ?? {}).length
  if (themed > 0 || Object.values(own.themes?.page ?? {}).some(value => value !== '')) left.push(`the look stays with games/${game} — books propose no look.`)
  if (own.rules?.totalBudget !== undefined) left.push(`the budget (${own.rules.totalBudget}) stays with games/${game} — a book may only PROPOSE one, and this number is the game's own decision.`)
  const pictured = Object.values(own.things?.things ?? {}).flat().filter(thing => (thing?.imageURL ?? '') !== '').length
  if (pictured > 0) left.push(`${entries(pictured)} name${pictured === 1 ? 's' : ''} a picture — the filename travels, the FILE does not: copy it into the book's own assets folder by hand.`)

  return {
    moved, left,
    // the route's own 400: a book with nothing in it is not a book. Said here so the button
    // can say why it is off, rather than firing a request to be refused.
    nothing: moved.types === 0 && moved.things === 0 && moved.rows === 0
      ? `games/${game} has no layer of its own to lift — every sheet, thing and row in it comes from the books it pins.`
      : null
  }
}
