// NEW: the Books tab — which books this game is built on. It is the first tab
// because it is the first question: everything Types, Things and Rows show is a
// merge of these books with the game's own stuff.
//
// One card per PIN, in the order the merge computed (a book always after the
// books it requires), then the pins that did not make it, in red, each carrying
// the merge's own sentence for why. Every fact on a card is read from the LOADED
// layer — what the shelf actually holds — never from the pin, which only says
// where to look.
//
// This file talks to the server (GET /api/books, for what else could be pinned)
// and it edits content.books; both go through `actions` (main.js), so nothing
// here imports view.js and the module graph stays a tree.
import { editorState } from './state.js'
import { rowsIn } from '/config/references.js'
import { bookLabel } from '/config/merge.js'

const editorEl = document.querySelector('#editor')
const el = (tag, className = '', text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`
const button = (className, text, onClick) => {
  const buttonEl = el('button', className, text)
  buttonEl.type = 'button'
  buttonEl.addEventListener('click', onClick)
  return buttonEl
}

// ───────────────────────── reading the shelf ─────────────────────────

// the last GET /api/books answer, or null before the first. It is a receipt, so
// a server that could not read the shelf is remembered as a failure rather than
// asked again on every paint.
const shelfBooks = () => (editorState.shelf?.ok ? editorState.shelf.books : [])
// an edition entry of that answer: { edition, title, requires, sheets, …, problems } or { edition, error }
const shelfEditions = (name) => shelfBooks().find(book => book.name === name)?.editions ?? []
// "clean" = the server could read it AND validateBook found nothing. A book with
// a problem may sit on the shelf; it may not be offered as something to pin.
const cleanEditions = (name) => shelfEditions(name).filter(edition => edition.error === undefined && (edition.problems?.length ?? 0) === 0)
const latestClean   = (name) => cleanEditions(name).map(edition => edition.edition).sort((a, b) => b - a)[0]
// the title a book calls itself, wherever we can find it: the loaded layer first
// (it is the truth for a pinned book), then the shelf listing, then the folder.
const titleOfBook = (name) =>
  editorState.books.find(layer => layer !== null && layer.manifest.name === name)?.manifest.title
  ?? shelfBooks().find(book => book.name === name)?.title
  ?? name
// exported: main.js writes the status lines ("added Dinosaur Age 1"), and the
// words for a book belong here, beside everything else that reads the shelf.
export const pinTitle = (name, edition) => `${titleOfBook(name)} ${edition}`
// exported for the same reason: adding a book adds what it requires, and the
// requirements of a book that is NOT pinned yet can only come from the listing.
export const shelfRequires = (name, edition) =>
  shelfEditions(name).find(each => each.edition === edition)?.requires ?? []

// ───────────────────────── the facts on a card ─────────────────────────

const countLists = (buckets) => Object.values(buckets ?? {}).reduce((n, list) => n + (list?.length ?? 0), 0)

// What this book brings, as one line. Only what it HAS is said: Basic defines
// sheets and adds nothing; Stats defines nothing and adds five fields; Dinosaur
// Age adds four fields, fills the shelves and proposes the rows.
const factsOf = (layer) => {
  const facts = [`edition ${layer.manifest.edition}`]
  const requires = layer.manifest.requires ?? []
  facts.push(requires.length === 0 ? 'requires nothing' : `requires ${requires.map(pin => pinTitle(pin.name, pin.edition)).join(', ')}`)
  const sheets = layer.types?.types?.length ?? 0
  if (sheets > 0) facts.push(`defines ${plural(sheets, 'sheet')}`)
  const sections = countLists(layer.types?.sectionsFor)
  if (sections > 0) facts.push(`adds ${plural(sections, 'section')}`)
  const fields = countLists(layer.types?.fieldsFor)
  if (fields > 0) facts.push(`adds ${plural(fields, 'field')}`)
  const things = countLists(layer.things?.things)
  if (things > 0) facts.push(`${things} shelf ${things === 1 ? 'entry' : 'entries'}`)   // "entries", not plural()'s "entrys"
  const rows = rowsIn(layer.proposals?.groups ?? []).length
  const budget = layer.proposals?.totalBudget
  const proposes = [rows > 0 ? plural(rows, 'row') : null, budget !== undefined ? `budget ${budget}` : null].filter(Boolean)
  if (proposes.length > 0) facts.push(`proposes ${proposes.join(', ')}`)
  return facts
}

// Who would break if this book left. `requires` is FLAT (every transitive
// requirement is written out), so this one loop is the whole answer — and it is
// also the reason Remove is disabled: un-pinning Basic would make the merge skip
// Stats and Dinosaur Age, which is a page of faults for one click.
const requiredBy = (name) => editorState.books
  .filter(layer => layer !== null && (layer.manifest.requires ?? []).some(pin => pin.name === name))
  .map(layer => pinTitle(layer.manifest.name, layer.manifest.edition))

// ───────────────────────── the cards ─────────────────────────

const buildPinnedCard = (layer, actions) => {
  const { name, edition } = layer.manifest
  const cardEl = el('section', 'editor-section book-card')
  cardEl.appendChild(el('h2', '', layer.manifest.title))

  const needs = requiredBy(name)
  const facts = factsOf(layer)
  if (needs.length > 0) facts.push(`required by ${needs.join(', ')}`)
  cardEl.appendChild(el('p', 'book-facts', facts.join(' · ')))

  const actionsEl = el('div', 'game-actions')
  // an upgrade is a new EDITION of the same book: a copy of the old one plus
  // more, so it is add-only and usually changes nothing that was already there.
  // Offering only editions the shelf reads cleanly keeps a broken folder from
  // looking like an invitation.
  const newer = cleanEditions(name).map(each => each.edition).filter(each => each > edition).sort((a, b) => b - a)[0]
  if (newer !== undefined) {
    actionsEl.appendChild(el('span', 'field-note', `edition ${newer} is on the shelf`))
    actionsEl.appendChild(button('link-button', `Upgrade to edition ${newer}`, () => actions.setEdition(name, newer)))
  }
  const removeBtn = button('remove-button', 'Remove', () => actions.unpinBook(name))
  if (needs.length > 0) {
    removeBtn.disabled = true
    removeBtn.title = `required by ${needs.join(', ')}`
  }
  actionsEl.appendChild(removeBtn)
  cardEl.appendChild(actionsEl)
  return cardEl
}

// a pin the merge refused: not on the shelf, a book.json that disagrees with the
// folder, a requirement missing. The card carries the merge's own sentence — the
// same words the faults banner shows — and, when the shelf has some edition of
// that name, the one click that would fix it.
const buildSkippedCard = (pin, at, actions) => {
  const cardEl = el('section', 'editor-section book-card book-card--skipped')
  cardEl.appendChild(el('h2', '', pinTitle(pin?.name, pin?.edition)))
  const fault = editorState.faults.find(each => each.path === `content.books[${at}]`)
  cardEl.appendChild(el('p', 'book-facts', fault?.message ?? 'this pin did not load'))
  const actionsEl = el('div', 'game-actions')
  const latest = latestClean(pin?.name)
  if (latest !== undefined && latest !== pin?.edition) {
    actionsEl.appendChild(button('link-button', `Use edition ${latest}`, () => actions.setEdition(pin.name, latest)))
  }
  actionsEl.appendChild(button('remove-button', 'Remove', () => actions.unpinBook(pin?.name)))
  cardEl.appendChild(actionsEl)
  return cardEl
}

// The offer: every book on the shelf this game does not already pin, at its
// latest clean edition. Adding one adds whatever it requires too — a book
// without its foundation is skipped whole by the merge, so offering the choice
// would only be offering a fault.
const buildAddForm = (actions) => {
  const pinned = new Set(editorState.content.books.map(pin => pin.name))
  const offers = shelfBooks()
    .filter(book => !pinned.has(book.name) && latestClean(book.name) !== undefined)
    .map(book => ({ name: book.name, edition: latestClean(book.name) }))

  const formEl = el('section', 'editor-section')
  formEl.appendChild(el('h2', '', 'Add a book from the shelf'))
  if (editorState.shelf === null) { formEl.appendChild(el('p', 'wall-hint', 'Reading the shelf…')); return formEl }
  if (editorState.shelf.ok !== true) { formEl.appendChild(el('p', 'wall-hint', `Could not read the shelf — ${editorState.shelf.error}`)); return formEl }
  if (offers.length === 0) { formEl.appendChild(el('p', 'wall-hint', 'Every book on the shelf is already pinned.')); return formEl }

  const rowEl = el('div', 'game-actions')
  const selectEl = document.createElement('select')
  offers.forEach(offer => {
    const optionEl = document.createElement('option')
    optionEl.value = offer.name
    optionEl.textContent = `${titleOfBook(offer.name)} ${offer.edition}`
    selectEl.appendChild(optionEl)
  })
  rowEl.appendChild(selectEl)
  rowEl.appendChild(button('save-button', 'Add', () => {
    const name = selectEl.value
    actions.pinBook(name, latestClean(name))
  }))
  formEl.appendChild(rowEl)
  formEl.appendChild(el('p', 'wall-hint', 'A book whose requirements are not pinned is added with them.'))
  return formEl
}

// ───────────────────────── the tab ─────────────────────────

export const renderBooksTab = (actions) => {
  // the shelf is fetched once per page and remembered on editorState, because
  // the answer is about the DISK, not about this game — it does not change while
  // the author edits. A failure is remembered too, so a broken shelf is asked
  // about once and then said out loud, rather than retried on every paint.
  if (editorState.shelf === null) actions.readShelf()

  if (editorState.content.books.length === 0) {
    editorEl.appendChild(el('p', 'wall-hint', 'This CYOA is built on no books — every sheet, thing and row in it is its own.'))
  }
  // pinned, in LAYER order: a book always after the books it requires. That is
  // the order the merge computed, so the cards read in the order the sheets and
  // the rows were laid down.
  editorState.order.forEach(label => {
    const layer = editorState.books.find(each => each !== null && bookLabel(each.manifest) === label)
    if (layer) editorEl.appendChild(buildPinnedCard(layer, actions))
  })
  // then the pins that did not make it, in the order they are written
  editorState.content.books.forEach((pin, at) => {
    const layer = editorState.books[at]
    if (layer !== null && layer !== undefined && editorState.order.includes(bookLabel(layer.manifest))) return
    editorEl.appendChild(buildSkippedCard(pin, at, actions))
  })
  editorEl.appendChild(buildAddForm(actions))
}
