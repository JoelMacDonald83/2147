// NEW: the home screen — one card per folder under games/ and the form that
// makes a new CYOA. It is painted into #editor like a tab, but it is not a tab:
// no game is open, so nothing here reads editorState. Every fact on a card
// comes from GET /api/games — what is on disk right now.
import { listGames, createGame } from './saveData.js'
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

const factsText = (game) => {
  const facts = [`games/${game.name}`, `schema v${game.version}`]
  if (game.types !== null) facts.push(plural(game.types, 'type'))
  if (game.things !== null) facts.push(plural(game.things, 'thing'))
  facts.push(plural(game.rows ?? 0, 'row'))
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

// a title → the server makes the folder name and says which; a refusal names why
const buildNewForm = () => {
  const formEl = el('form', 'editor-section new-game')
  formEl.appendChild(el('h2', '', 'New CYOA'))
  const labelEl = el('label', 'field')
  labelEl.appendChild(el('span', '', 'Title — the folder name is made from it ("Space Pirates!" → games/space-pirates)'))
  const inputEl = el('input'); inputEl.required = true; inputEl.placeholder = 'My CYOA'
  labelEl.appendChild(inputEl)
  const buttonEl = el('button', 'save-button', 'Create'); buttonEl.type = 'submit'
  const noteEl = el('span', 'game-status')
  formEl.append(labelEl, buttonEl, noteEl)
  formEl.addEventListener('submit', async (event) => {
    event.preventDefault()
    noteEl.textContent = 'creating…'
    const receipt = await createGame(inputEl.value)
    if (!receipt.ok) { noteEl.textContent = receipt.problems ? receipt.problems.map(problem => problem.message).join('; ') : receipt.error; return }
    // a newborn has no types yet, so Types is step one. The game changed → main.js reloads.
    location.hash = hashForGame(receipt.name, 'types')
  })
  return formEl
}

export const renderHome = async (actions) => {
  editorEl.innerHTML = ''
  editorEl.appendChild(el('p', 'wall-hint', 'Loading the list…'))
  const receipt = await listGames()
  editorEl.innerHTML = ''
  if (!receipt.ok) { editorEl.appendChild(el('p', 'wall-hint', `Could not list the CYOAs — ${receipt.error}`)); return }
  if (receipt.games.length === 0) editorEl.appendChild(el('p', 'wall-hint', 'No CYOAs yet — make the first one below.'))
  receipt.games.forEach(game => editorEl.appendChild(buildCard(game, actions)))
  editorEl.appendChild(buildNewForm())
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
