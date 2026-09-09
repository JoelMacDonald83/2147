// NEW: the home screen — one card per folder under games/, the Library of books
// under books/, and the form that makes a new CYOA. It is painted into #editor
// like a tab, but it is not a tab: no game is open, so nothing here reads
// editorState. Every fact on a card comes from GET /api/games and GET /api/books
// — what is on disk right now.
import { listGames, createGame, listBooks } from './saveData.js'
import { hashForGame, HOME_HASH } from './uiState.js'
import { SCHEMA_VERSION } from '/config/schema.js'

const editorEl = document.querySelector('#editor')
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`
const el = (tag, className = '', text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// the export receipt as one line — shared with the toolbar's button (main.js)
export const exportText = (receipt) => receipt.ok
  ? `exported — ${plural(receipt.rows, 'row')}, ${plural(receipt.items, 'thing')}, ${plural(receipt.files, 'file')}`
  : receipt.problems ? `export refused — ${plural(receipt.problems.length, 'problem')} (see console)` : `export failed — ${receipt.error}`

// CHANGED: the counts a game card shows are the MERGED ones (the server merges
// before it counts), so the card says what PLAYS, not what is in the game's own
// five files — a game built on Basic has 7 types even though its own types.json
// is empty. The pins are named, and a game whose books do not merge cleanly says
// so here rather than at the first paint of the editor.
const factsText = (game) => {
  const facts = [`games/${game.name}`, `schema v${game.version}`]
  if (game.types !== null) facts.push(plural(game.types, 'type'))
  if (game.things !== null) facts.push(plural(game.things, 'thing'))
  facts.push(plural(game.rows ?? 0, 'row'))
  facts.push(game.books?.length > 0 ? `books: ${game.books.join(', ')}` : 'no books')
  if (game.faults > 0) facts.push(`⚠ ${plural(game.faults, 'book fault')}`)
  if (game.version !== SCHEMA_VERSION) facts.push('Open and Save to migrate')
  return facts.join(' · ')
}

// one card per folder: title · facts · Open Play Export [status] (Preview).
// A folder that is not a game (a bad name, no data/content.json) is shown with
// its problem and nothing to click — loud, not hidden.
const buildCard = (game, actions) => {
  const cardEl = el('section', 'editor-section game-card')
  cardEl.appendChild(el('h2', '', game.error ? game.name : (game.title || '(untitled)')))
  if (game.error) { cardEl.appendChild(el('p', 'wall-hint', game.error)); return cardEl }
  cardEl.appendChild(el('p', 'game-facts', factsText(game)))
  const rowEl = el('div', 'game-actions')
  const openEl = el('a', 'save-button', 'Open');          openEl.href = hashForGame(game.name)
  const playEl = el('a', 'link-button', 'Play ↗');        playEl.href = `/games/${game.name}/`; playEl.target = '_blank'
  const exportEl = el('button', 'link-button', 'Export'); exportEl.title = 'Exports what is SAVED on disk'
  const statusEl = el('span', 'game-status', game.exported ? 'exported' : 'not exported yet')
  const previewEl = el('a', 'link-button', 'Preview ↗'); previewEl.href = `/dist/${game.name}/`; previewEl.target = '_blank'; previewEl.hidden = !game.exported
  // nothing is open on this screen, so what is on disk is all there is to export
  exportEl.addEventListener('click', async () => {
    statusEl.textContent = 'exporting…'
    const receipt = await actions.exportGame(game.name)
    statusEl.textContent = exportText(receipt)
    previewEl.hidden = !receipt.ok
  })
  rowEl.append(openEl, playEl, exportEl, statusEl, previewEl)
  cardEl.appendChild(rowEl)
  return cardEl
}

// ───────────────────────── the Library ─────────────────────────

// NEW: what is on the shelf, one card per book, one line per edition. A book is
// a folder, not a game: nothing here is clickable in Stage 1 — the Books tab
// inside a game is where a book is pinned. This screen answers "what could I
// build on?", and it answers it about the DISK, so a folder that is not a book
// is listed with its problem rather than quietly skipped.
const editionLine = (edition, titles) => {
  if (edition.error) return `edition ${edition.edition} · ⚠ ${edition.error}`
  const facts = [`edition ${edition.edition}`]
  // a requirement is written in the shelf's own terms (the folder's name); the
  // Library speaks the titles, which is what the author will look for
  facts.push(edition.requires.length === 0 ? 'requires nothing' : `requires ${edition.requires.map(pin => `${titles.get(pin.name) ?? pin.name} ${pin.edition}`).join(', ')}`)
  if (edition.sheets > 0) facts.push(plural(edition.sheets, 'sheet'))
  if (edition.sectionsAdded > 0) facts.push(`adds ${plural(edition.sectionsAdded, 'section')}`)
  if (edition.fieldsAdded > 0) facts.push(`adds ${plural(edition.fieldsAdded, 'field')}`)
  if (edition.things > 0) facts.push(`${edition.things} shelf ${edition.things === 1 ? 'entry' : 'entries'}`)
  const proposes = [edition.rows > 0 ? plural(edition.rows, 'row') : null, edition.budget !== null && edition.budget !== undefined ? `budget ${edition.budget}` : null].filter(Boolean)
  if (proposes.length > 0) facts.push(`proposes ${proposes.join(', ')}`)
  if (edition.problems?.length > 0) return `${facts.join(' · ')} · ⚠ ${plural(edition.problems.length, 'problem')} — ${edition.problems[0].path}: ${edition.problems[0].message}`
  return facts.join(' · ')
}

const buildBookCard = (book, titles) => {
  const cardEl = el('section', 'editor-section book-card')
  const headEl = el('div', 'book-head')
  headEl.appendChild(el('h2', '', book.title || book.name))
  headEl.appendChild(el('span', 'book-path', `books/${book.name}`))
  cardEl.appendChild(headEl)
  if (book.error) { cardEl.appendChild(el('p', 'wall-hint', book.error)); return cardEl }
  ;(book.editions ?? []).forEach(edition => cardEl.appendChild(el('p', 'book-facts', editionLine(edition, titles))))
  return cardEl
}

const renderLibrary = (receipt) => {
  editorEl.appendChild(el('h2', 'library-heading', 'Library'))
  if (!receipt.ok) { editorEl.appendChild(el('p', 'wall-hint', `Could not read the shelf — ${receipt.error}`)); return }
  if (receipt.books.length === 0) { editorEl.appendChild(el('p', 'wall-hint', 'No books on the shelf yet.')); return }
  const titles = new Map(receipt.books.map(book => [book.name, book.title || book.name]))
  receipt.books.forEach(book => editorEl.appendChild(buildBookCard(book, titles)))
}

// ───────────────────────── the New form ─────────────────────────

// a title → the server makes the folder name and says which; a refusal names why.
// NEW: one checkbox — start from Basic. It is the default because a game with no
// sheets has nothing to put on a shelf and nothing for a row to show; unticking
// it is the "I am building my own world from nothing" answer. The box only
// appears when the shelf actually holds a clean Basic, so an empty shelf makes
// exactly the newborn it always made.
const buildNewForm = (shelf) => {
  const basic = shelf.ok ? shelf.books.find(book => book.name === 'basic') : undefined
  const clean = (basic?.editions ?? []).filter(edition => edition.error === undefined && (edition.problems?.length ?? 0) === 0)
  const edition = clean.map(each => each.edition).sort((a, b) => b - a)[0]

  const formEl = el('form', 'editor-section new-game')
  formEl.appendChild(el('h2', '', 'New CYOA'))
  const labelEl = el('label', 'field')
  labelEl.appendChild(el('span', '', 'Title — the folder name is made from it ("Space Pirates!" → games/space-pirates)'))
  const inputEl = el('input'); inputEl.required = true; inputEl.placeholder = 'My CYOA'
  labelEl.appendChild(inputEl)
  formEl.appendChild(labelEl)

  let basicEl = null
  if (edition !== undefined) {
    const boxLabelEl = el('label', 'checkbox-field')
    basicEl = el('input'); basicEl.type = 'checkbox'; basicEl.checked = true
    boxLabelEl.appendChild(basicEl)
    boxLabelEl.appendChild(el('span', '', `Start from the Basic book (edition ${edition})`))
    formEl.appendChild(boxLabelEl)
  }

  const buttonEl = el('button', 'save-button', 'Create'); buttonEl.type = 'submit'
  const noteEl = el('span', 'game-status')
  formEl.append(buttonEl, noteEl)
  formEl.addEventListener('submit', async (event) => {
    event.preventDefault()
    noteEl.textContent = 'creating…'
    const books = basicEl?.checked ? [{ name: 'basic', edition }] : []
    const receipt = await createGame(inputEl.value, books)
    if (!receipt.ok) { noteEl.textContent = receipt.problems ? receipt.problems.map(problem => problem.message).join('; ') : receipt.error; return }
    // where a newborn lands depends on what it was born with: a game built on
    // Basic already HAS sheets, so the first job is filling a shelf (Things); a
    // game born with nothing has to invent a type first (Types).
    location.hash = hashForGame(receipt.name, receipt.books?.length > 0 ? 'things' : 'types')
  })
  return formEl
}

export const renderHome = async (actions) => {
  editorEl.innerHTML = ''
  editorEl.appendChild(el('p', 'wall-hint', 'Loading the list…'))
  // both lists at once: they are two folders on the same disk and neither waits
  // on the other. A shelf that cannot be read still leaves the games listed.
  const [receipt, shelf] = await Promise.all([listGames(), listBooks()])
  editorEl.innerHTML = ''
  if (!receipt.ok) { editorEl.appendChild(el('p', 'wall-hint', `Could not list the CYOAs — ${receipt.error}`)); return }
  if (receipt.games.length === 0) editorEl.appendChild(el('p', 'wall-hint', 'No CYOAs yet — make the first one below.'))
  receipt.games.forEach(game => editorEl.appendChild(buildCard(game, actions)))
  renderLibrary(shelf)
  editorEl.appendChild(buildNewForm(shelf))
}

// the hash named a game the server does not have, or its files did not load
export const renderLoadFailure = (name, error) => {
  editorEl.innerHTML = ''
  const cardEl = el('section', 'editor-section')
  cardEl.appendChild(el('h2', '', `Could not open "${name}"`))
  cardEl.appendChild(el('p', 'wall-hint', error.message))
  const backEl = el('a', 'save-button', 'Back to the list'); backEl.href = HOME_HASH
  cardEl.appendChild(backEl)
  editorEl.appendChild(cardEl)
}
