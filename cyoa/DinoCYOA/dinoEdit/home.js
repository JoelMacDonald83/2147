// NEW: the home screen — one card per folder under games/, the Library of books
// under books/, and the form that makes a new CYOA. It is painted into #editor
// like a tab, but it is not a tab: no game is open, so nothing here reads
// editorState. Every fact on a card comes from GET /api/games and GET /api/books
// — what is on disk right now.
import { listGames, createGame, listBooks, extractBook } from './saveData.js'
import { hashForGame, HOME_HASH, hashForSubject, subjectAt } from './uiState.js'
import { SCHEMA_VERSION } from '/config/schema.js'
// CHANGED (stage 4): the Library MOVED OUT, into library.js. It used to be three functions
// here and its own comment said "nothing here is clickable in Stage 1"; it is now the whole
// lifecycle of a book — open, cut, rename, delete, and the form that makes one — which is as
// much screen as the games list above it. What stays here is the games half and the shape of
// the page: games, then the Library, then the two New forms.
import { renderLibrary } from './library.js'
// NEW: what would travel into a book, and what would not — counted before anything is
// written (previews.js).
import { extractPreview } from './previews.js'

const editorEl = document.querySelector('#editor')
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`
// "entries", not plural()'s "entrys" — the shelf's own word for a thing on a shelf, spelled
// the way books.js's factsOf already spells it
const entries = (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`
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
// CHANGED (stage 4): and "Save as a book", which is the third thing this screen can do with
// what is on disk. It sits here and not in the open editor for the same reason Export does:
// the route reads the game's FILES, so the only honest place to offer it is the screen that
// holds nothing in memory to disagree with them.
const buildCard = (game, actions, repaint) => {
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
  const extractEl = el('button', 'link-button', 'Save as a book')
  extractEl.type = 'button'
  extractEl.title = "Lifts this game's OWN sheets, entries and rows onto the shelf as a new book"
  extractEl.addEventListener('click', () => openExtractPanel(game, cardEl, repaint))
  rowEl.append(openEl, playEl, exportEl, statusEl, previewEl, extractEl)
  cardEl.appendChild(rowEl)
  return cardEl
}

// ───────────────────────── "Save as a book" ─────────────────────────

// NEW (stage 4): a game's own layer, lifted onto the shelf. The preview is not a courtesy —
// it is the only place an author can learn that HALF OF WHAT THEY SEE IS NOT THEIRS TO MOVE.
// Measured on the real games: games/dino's own layer is 8 Characters + 2 Places and FOUR
// rowOverrides, and the overrides are the whole of its row taste — a book may not override
// another book's row, so for dino `left` is the longer half of the answer. games/space has no
// layer at all and is refused with a sentence rather than making an empty book.
//
// The preview's `left` is the EDITOR's reading of the game's files; the receipt's `left` is
// the route's own, and that is the one printed after the write. Both are shown, in that
// order, because the author decides on the first and learns from the second.
let openPanel = null
const openExtractPanel = (game, holderEl, repaint) => {
  openPanel?.remove()
  const panelEl = el('section', 'shelf-panel')
  panelEl.appendChild(el('h3', '', `Save games/${game.name} as a book`))
  const bodyEl = el('div', 'shelf-panel-body')
  panelEl.appendChild(bodyEl)
  holderEl.appendChild(panelEl)
  openPanel = panelEl
  const close = () => { panelEl.remove(); if (openPanel === panelEl) openPanel = null }

  bodyEl.appendChild(el('p', 'shelf-fact', 'reading what is on disk…'))
  extractPreview(game.name).then(preview => {
    bodyEl.innerHTML = ''
    if (preview.error) { bodyEl.appendChild(el('p', 'shelf-refusal', preview.error)); return }
    if (preview.nothing) {
      bodyEl.appendChild(el('p', 'shelf-refusal', preview.nothing))
      const refusedEl = el('div', 'game-actions')
      refusedEl.appendChild(buildClose(close))
      bodyEl.appendChild(refusedEl)
      return
    }
    const { types, things, rows } = preview.moved
    bodyEl.appendChild(el('p', 'shelf-fact', `MOVES — ${plural(types, 'sheet')}, ${entries(things)} and ${plural(rows, 'row')} of its own, every id rewritten into the new book's namespace.`))
    if (preview.left.length === 0) bodyEl.appendChild(el('p', 'shelf-fact', 'STAYS — nothing: this game has nothing that cannot travel.'))
    preview.left.forEach(sentence => bodyEl.appendChild(el('p', 'shelf-refusal', `STAYS — ${sentence}`)))
    bodyEl.appendChild(el('p', 'field-note', 'It publishes what is SAVED on disk. Save the game first if it is open in another tab.'))
    // THE TWO THINGS THE ROUTE REFUSES THAT A COUNT CANNOT SEE. It runs validateGame over
    // the game as it is on DISK before it lifts anything, so a game that could not be SAVED
    // cannot be lifted either — and this preview reads the game through loadGame, which
    // MIGRATES in memory, so it would happily count a v4 game's world and then watch the
    // route refuse it in validate.js's own words. Both facts are already on the card above;
    // they are repeated here because this is where the author is about to click.
    const blocked = []
    if (game.version !== SCHEMA_VERSION) blocked.push(`games/${game.name} is at schema v${game.version} — open it and Save to migrate it first. A book is NEVER migrated, so one born from stale shapes would be stale for ever.`)
    if (game.faults > 0) blocked.push(`games/${game.name} has ${plural(game.faults, 'book fault')} — the route lifts nothing out of a game that does not fit, because what it owns cannot all be found.`)
    blocked.forEach(sentence => bodyEl.appendChild(el('p', 'shelf-refusal', sentence)))

    const titleLabelEl = el('label', 'field')
    titleLabelEl.appendChild(el('span', '', "Title — what the shelf calls it"))
    const titleEl = el('input'); titleEl.value = game.title || game.name
    titleLabelEl.appendChild(titleEl)
    const nameLabelEl = el('label', 'field')
    nameLabelEl.appendChild(el('span', '', 'Folder name — also the id namespace every id in the book starts with: lowercase letters, digits and single dashes'))
    const nameEl = el('input'); nameEl.value = game.name
    nameLabelEl.appendChild(nameEl)
    bodyEl.append(titleLabelEl, nameLabelEl)

    const actionsEl = el('div', 'game-actions')
    const statusEl = el('span', 'game-status')
    const saveEl = buildSave(async () => {
      statusEl.textContent = 'writing…'
      const receipt = await extractBook(game.name, nameEl.value.trim(), titleEl.value)
      if (!receipt.ok) {
        statusEl.textContent = receipt.error
        if (receipt.problems) console.table(receipt.problems)
        return
      }
      statusEl.textContent = `books/${receipt.name}/${receipt.edition} — ${plural(receipt.moved?.types ?? 0, 'sheet')}, ${entries(receipt.moved?.things ?? 0)}, ${plural(receipt.moved?.rows ?? 0, 'row')}`
      ;(receipt.left ?? []).forEach(sentence => bodyEl.appendChild(el('p', 'shelf-refusal', `STAYED — ${sentence}`)))
      repaint.forget()
      const openRowEl = el('div', 'game-actions')
      openRowEl.appendChild(buildOpen(hashForSubject(subjectAt('book', receipt.name, receipt.edition), 'types')))
      bodyEl.appendChild(openRowEl)
    })
    if (blocked.length > 0) { saveEl.disabled = true; saveEl.title = 'the refusals above have to be answered first' }
    actionsEl.append(saveEl, buildClose(close), statusEl)
    bodyEl.appendChild(actionsEl)
  })
}
const buildClose = (onClick) => { const node = el('button', 'link-button', 'Cancel'); node.type = 'button'; node.addEventListener('click', onClick); return node }
const buildSave  = (onClick) => { const node = el('button', 'save-button', 'Save as a book'); node.type = 'button'; node.addEventListener('click', onClick); return node }
const buildOpen  = (href) => { const node = el('a', 'save-button', 'Open the book'); node.href = href; return node }

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

// CHANGED (stage 4): the Library is a screen that CHANGES the shelf now, so two things
// travel into it. `repaint` is how a mutation gets back here — `forget()` throws the cached
// shelf answer away (a book mutation makes it a lie, for the game-side Books tab too) and
// `now()` does that and paints this whole screen again from the disk. And the GAMES listing
// goes in as data: the freeze census ("which games pin this edition") is read from it, and
// fetching it twice on one screen would be two answers about one disk.
export const renderHome = async (actions) => {
  editorEl.innerHTML = ''
  editorEl.appendChild(el('p', 'wall-hint', 'Loading the list…'))
  // both lists at once: they are two folders on the same disk and neither waits
  // on the other. A shelf that cannot be read still leaves the games listed.
  const [receipt, shelf] = await Promise.all([listGames(), listBooks()])
  editorEl.innerHTML = ''
  if (!receipt.ok) { editorEl.appendChild(el('p', 'wall-hint', `Could not list the CYOAs — ${receipt.error}`)); return }
  const repaint = { forget: () => actions.forgetShelf(), now: () => { actions.forgetShelf(); renderHome(actions) } }
  if (receipt.games.length === 0) editorEl.appendChild(el('p', 'wall-hint', 'No CYOAs yet — make the first one below.'))
  receipt.games.forEach(game => editorEl.appendChild(buildCard(game, actions, repaint)))
  renderLibrary(editorEl, shelf, receipt.games, repaint)
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
