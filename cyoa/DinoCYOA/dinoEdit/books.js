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
// CHANGED (stage 4): the tab serves BOTH kinds of subject. A game's pins live in
// content.books and a book's requirements live in book.requires — a different file, a
// different key, an ADD-ONLY and FLAT one — and the subject table's `pins` cell names both
// (see PIN_RULES below). Every card, every fact and every action below is the same either
// way; what differs is three sentences and two exclusions, and those are a table.
import { editorState, S } from './state.js'
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
// NEW (§6): ONE NAMING RULE — CHROME SPEAKS TITLES, FAULT PATHS SPEAK FOLDERS.
// "Dinosaur Age 2" (a title and its edition) is what an author reads; "dinosaur-age 2" is
// merge.js's bookLabel and belongs in origins, in fault paths and in a folder path, never
// in a sentence. Before this there were THREE hand-written spellings of the same phrase —
// pinTitle here, the option label in the add form below, and the Library's requires line in
// home.js, each with its own fallback — and the Library and the Books tab could and did
// disagree about the same book. This is the one place the phrase is built; everyone else
// supplies the title they have in hand.
export const bookTitle = (title, edition) => `${title} ${edition}`
// exported: main.js writes the status lines ("added Dinosaur Age 1"), and the
// words for a book belong here, beside everything else that reads the shelf.
export const pinTitle = (name, edition) => bookTitle(titleOfBook(name), edition)
// exported for the same reason: adding a book adds what it requires, and the
// requirements of a book that is NOT pinned yet can only come from the listing.
export const shelfRequires = (name, edition) =>
  shelfEditions(name).find(each => each.edition === edition)?.requires ?? []

// ───────────────────────── the freeze, as the editor can see it ─────────────────────────

// NEW (stage 4): WHO PINS THIS EDITION — the question the whole freeze turns on, answered
// from GET /api/games because that is the only door the editor has onto games/.
//
// WHAT IT CAN SEE, said out loud because it is less than the server's census: a game card's
// `books` is the merged LAYER ORDER, so it lists the books that SURVIVED the merge. A game
// that pins this edition but whose merge was refused (a requirement missing, a file too old)
// does NOT appear here, and the server's own census — which reads the raw pins out of every
// content.json — does. So this answer can under-report, and it is used only to decide what
// the screen OFFERS. The border is the server: a save into an edition it finds pinned comes
// back 409 with the sentence below, and the editor then paints exactly what it was told.
// Fail closed is therefore kept where it matters; what is lost is an Edit button that should
// have read "frozen". THE HANDOFF: one `pinnedBy` field per edition on GET /api/books would
// make this exact, and would delete this function.
export const pinnersOf = (games, name, edition) => (games ?? [])
  .filter(game => (game.books ?? []).includes(`${name} ${edition}`))
  .map(game => ({ game: game.name, edition }))
// the same question about the WHOLE book — every edition any game pins, which is what
// deleting a book has to refuse on. Matched on the label's name half.
export const pinnersOfBook = (games, name) => (games ?? []).flatMap(game =>
  (game.books ?? []).filter(label => label.startsWith(`${name} `))
    .map(label => ({ game: game.name, edition: Number(label.slice(name.length + 1)) })))

// NEW: the three sentences of the freeze. THEY ARE A SECOND COPY, byte for byte, of
// server/books.js's — and that is a debt, not a design. The originals are the border's and
// every refusal the server sends carries one; the editor needs the same words BEFORE it asks
// (a frozen edition must say why it is read-only the moment it opens, and a delete must say
// what it would refuse before the author clicks). server/ is not served to the browser, so
// the editor cannot import them, and engine/config — the one place both sides can read — has
// no door for a shelf sentence yet. THE HANDOFF: move these three into engine/config beside
// the shelf's four grammars (which live there for exactly this reason, with an oracle pinning
// them equal) and delete this block. Copied byte-identically on purpose, so that when they
// move, nothing on screen changes.
const andList = (list) => list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
const gamesThat = (by) => andList(by.map(pin => `games/${pin.game}`))
const pinVerb   = (by) => by.length === 1 ? 'pins' : 'pin'
export const frozenEditionSentence = (by, next) => `${gamesThat(by)} ${pinVerb(by)} this edition — it is frozen. Cut edition ${next} to change it.`
export const pinnedEditionSentence = (by)       => `${gamesThat(by)} ${pinVerb(by)} this edition. Un-pin it first, or delete the whole book.`
export const pinnedBookSentence    = (by)       => `${andList(by.map(pin => `games/${pin.game} pins edition ${pin.edition}`))} — un-pin ${by.length === 1 ? 'it' : 'them'} first.`

// NEW: the number a cut would give the next edition — one past the HIGHEST FOLDER, and 1
// when there are none. It is read from every edition the listing names, broken ones
// included, for the reason the server's nextEdition gives: a broken edition still owns its
// number, and handing its number to a new edition would bury the author's mistake under a
// working book. So "Cut edition 3" and the folder a cut actually makes agree.
export const nextEditionOf = (editions) => {
  const numbers = (editions ?? []).map(each => each.edition).filter(each => Number.isInteger(each))
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
}

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
// CHANGED: the coordinate it greps for is the subject's own pins path — `content.books[i]`
// for a game, `book.requires[i]` for a book (merge.js's sitesFor writes both).
const buildSkippedCard = (pin, at, actions) => {
  const cardEl = el('section', 'editor-section book-card book-card--skipped')
  cardEl.appendChild(el('h2', '', pinTitle(pin?.name, pin?.edition)))
  const fault = editorState.faults.find(each => each.path === `${pinsPath()}[${at}]`)
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

// ───────────────────────── whose pin list, and the words for it ─────────────────────────

// NEW (stage 4): the subject's pin list, its fault path, and the three things that differ
// between "which books is this GAME built on" and "which books does this BOOK require".
// The ARRAY and the PATH both come from the subject table's one `pins` cell, so they cannot
// disagree; the words and the two extra exclusions are this table, because they are DOM and
// the subject table is pure.
const pins = () => { const [file, key] = S().pins; return editorState[file][key] ?? [] }
const pinsPath = () => { const [file, key] = S().pins; return `${file}.${key}` }

// `mayPin(name)` is the whole of "two new exclusions the game case never needed"
// (merge.js:532 makes a self-requirement a fault; orderBooks refuses a cycle). A game needs
// neither — and must not inherit them: games/basic and books/basic are both legal folder
// names under ONE grammar, so excluding "the book with my own name" would hide the Basic
// book from a game that happens to be called basic.
const PIN_RULES = {
  game: {
    none:    'This CYOA is built on no books — every sheet, thing and row in it is its own.',
    heading: 'Add a book from the shelf',
    add:     'Add',
    hint:    'A book whose requirements are not pinned is added with them.',
    mayPin:  () => true
  },
  book: {
    none:    'This book requires nothing — everything in it is its own.',
    heading: 'Require a book from the shelf',
    add:     'Require',
    hint:    'A book is required together with everything IT requires: `requires` is FLAT, so every one is written out.',
    // a book may not require itself, and may not require a book that requires it — the
    // merge's two refusals, asked before the choice is offered rather than after it is made.
    mayPin:  (name) => name !== editorState.subject.name
      && !shelfRequires(name, latestClean(name)).some(pin => pin.name === editorState.subject.name)
  }
}
const pinRules = () => PIN_RULES[editorState.subject.kind]

// The offer: every book on the shelf this subject does not already name, at its
// latest clean edition. Adding one adds whatever it requires too — a book
// without its foundation is skipped whole by the merge, so offering the choice
// would only be offering a fault.
const buildAddForm = (actions) => {
  const words  = pinRules()
  const named  = new Set(pins().map(pin => pin?.name))
  const offers = shelfBooks()
    .filter(book => !named.has(book.name) && latestClean(book.name) !== undefined && words.mayPin(book.name))
    .map(book => ({ name: book.name, edition: latestClean(book.name) }))

  const formEl = el('section', 'editor-section')
  formEl.appendChild(el('h2', '', words.heading))
  if (editorState.shelf === null) { formEl.appendChild(el('p', 'wall-hint', 'Reading the shelf…')); return formEl }
  if (editorState.shelf.ok !== true) { formEl.appendChild(el('p', 'wall-hint', `Could not read the shelf — ${editorState.shelf.error}`)); return formEl }
  if (offers.length === 0) { formEl.appendChild(el('p', 'wall-hint', 'There is nothing else on the shelf to add.')); return formEl }

  const rowEl = el('div', 'game-actions')
  const selectEl = document.createElement('select')
  offers.forEach(offer => {
    const optionEl = document.createElement('option')
    optionEl.value = offer.name
    optionEl.textContent = pinTitle(offer.name, offer.edition)   // CHANGED (§6): the one spelling, not a second one
    selectEl.appendChild(optionEl)
  })
  rowEl.appendChild(selectEl)
  rowEl.appendChild(button('save-button', words.add, () => {
    const name = selectEl.value
    actions.pinBook(name, latestClean(name))
  }))
  formEl.appendChild(rowEl)
  formEl.appendChild(el('p', 'wall-hint', words.hint))
  return formEl
}

// ───────────────────────── the tab ─────────────────────────

export const renderBooksTab = (actions) => {
  // the shelf is fetched once and remembered on editorState, and asked for again the moment
  // something could have changed it — see actions.forgetShelf.
  // CORRECTED (stage 4): this comment used to say the answer "does not change while the
  // author edits", and cached it for the life of the page on those grounds. That premise
  // dies with the first route that writes a book: an author who creates one and comes back
  // to this tab would not be offered it, and the stale answer is about the DISK, which is
  // exactly the kind of lie a cache must not be allowed to tell. So the cache stays (it
  // saves a fetch per paint, which is the real reason for it) and invalidation is explicit:
  // every book mutation calls forgetShelf, and the next paint asks again.
  // A failure is remembered too, so a broken shelf is asked about once and then said out
  // loud, rather than retried on every paint.
  if (editorState.shelf === null) actions.readShelf()

  if (pins().length === 0) editorEl.appendChild(el('p', 'wall-hint', pinRules().none))
  // pinned, in LAYER order: a book always after the books it requires. That is
  // the order the merge computed, so the cards read in the order the sheets and
  // the rows were laid down.
  // CHANGED: in BOOK mode the merge's `order` ends with the SUBJECT book itself (it is the
  // last book layer — that is what book mode means), and the subject is not one of its own
  // requirements. `editorState.books` holds only the loaded requirements, so the find
  // simply does not match it and the subject draws no card here. Fail closed by shape.
  editorState.order.forEach(label => {
    const layer = editorState.books.find(each => each !== null && bookLabel(each.manifest) === label)
    if (layer) editorEl.appendChild(buildPinnedCard(layer, actions))
  })
  // then the pins that did not make it, in the order they are written
  pins().forEach((pin, at) => {
    const layer = editorState.books[at]
    if (layer !== null && layer !== undefined && editorState.order.includes(bookLabel(layer.manifest))) return
    editorEl.appendChild(buildSkippedCard(pin, at, actions))
  })
  editorEl.appendChild(buildAddForm(actions))
}
