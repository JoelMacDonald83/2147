import { editorState, markSaved, hasUnsavedEdits, gameTitle } from './state.js'
import { render, renderSaveStatus } from './view.js'
import { renderHome, renderLoadFailure, exportText } from './home.js'   // NEW
import { loadGame } from './loadData.js'                                 // CHANGED: a function, called when a game opens
import { save, exportGame } from './saveData.js'
import { uiState, readHash } from './uiState.js'
import { validateSet } from '/config/validate.js'   // the same contract the server enforces

const count = (problems) => `${problems.length} problem${problems.length === 1 ? '' : 's'}`

const actions = {
  // CHANGED: returns true when all five landed — saveAndExport waits for that answer.
  // The game is the one the PAGE holds (editorState.game), bound here, not read
  // from the address bar.
  async save() {
    // the whole set is checked HERE first, all five files at once. The server checks
    // again (curl, a hand-edit under us) — but a refusal seen before the network means the
    // four files never land while content.json is refused, so the disk never holds half a
    // save. Number.isFinite in the checker is what makes that true: Number("1e400") is
    // Infinity in memory and null on the wire; both are refused, here, before any post.
    const problems = validateSet(editorState)
    if (problems.length > 0) {
      renderSaveStatus(`Not saved — ${count(problems)} (see console)`)
      console.warn('Not saved — the set does not fit the schema:')
      console.table(problems)                                   // two columns: path, message
      return false
    }
    renderSaveStatus('Saving…')
    const game = editorState.game
    // content.json goes LAST, on its own (its version stamp is the SET's version and
    // it carries every cross-reference — see the v4 note): the other four first, so a
    // partial save leaves content.json at its old version and the next load migrates again.
    const receipts = await Promise.all([
      save(game, 'types', editorState.types),
      save(game, 'things', editorState.things),
      save(game, 'rules', editorState.rules),
      save(game, 'themes', editorState.themes)
    ])
    if (receipts.every(receipt => receipt.ok)) {
      receipts.push(await save(game, 'content', editorState.content))
    }
    // a refusal is named. The status line carries the file and the count; the
    // console carries every problem by path.
    const failed = receipts.filter(receipt => !receipt.ok)
    if (failed.length === 0) { markSaved(); renderSaveStatus('Saved ✓'); return true }   // CHANGED: memory now equals disk
    const [first] = failed
    renderSaveStatus(first.problems
      ? `Save failed — ${first.name}.json: ${count(first.problems)} (see console)`
      : `Save failed — ${first.name}.json: ${first.error}`)
    failed.forEach(receipt => {
      console.warn(`${receipt.name}.json: ${receipt.error}`)
      if (receipt.problems) console.table(receipt.problems)
    })
    return false
  },

  // NEW: an export publishes what is ON DISK. The home screen holds nothing in
  // memory, so it exports the disk and says so. Returns the receipt; the caller paints.
  async exportGame(name) {
    const receipt = await exportGame(name)
    if (!receipt.ok) {
      console.warn(`export ${name}: ${receipt.error}`)
      if (receipt.problems) console.table(receipt.problems)
    }
    return receipt
  },

  // NEW: in an open game the button is "Save & export": nothing is exported unless
  // the save landed, so disk = screen at export time by construction — no dirty
  // flag, no stale export, and a pre-flight refusal reads "Not saved — …" first.
  async saveAndExport() {
    if (!(await actions.save())) return
    renderSaveStatus('Saved ✓ — exporting…')
    const receipt = await actions.exportGame(editorState.game)
    renderSaveStatus(`Saved ✓ · ${exportText(receipt)}`)
    if (receipt.ok) { previewEl.href = receipt.preview; previewEl.hidden = false }
  }
}

// NEW: the static header has two faces. On the home screen the tab strip and
// the toolbar are hidden (nothing to save); with a game open they show, the
// title names the game and Play links to the game's own address. It follows
// what the PAGE HOLDS (editorState.game), not the hash: a game that failed to
// load is nothing to save or play, so its "Could not open" screen — and the
// home screen painted in-page after it — show no toolbar.
const gameNameEl = document.querySelector('#game-name')
const tabsEl = document.querySelector('#tabs')
const toolbarEl = document.querySelector('.toolbar')
const playEl = document.querySelector('#play')
const previewEl = document.querySelector('#preview')
const paintChrome = () => {
  const home = editorState.game === ''
  gameNameEl.textContent = home ? '' : gameTitle()
  tabsEl.hidden = toolbarEl.hidden = home
  if (!home) playEl.href = `/games/${editorState.game}/`
}
// the home screen and a game paint differently — never render() over five nulls
const paint = () => (uiState.game === '' ? renderHome(actions) : render(actions))

// NEW: the hash the page last agreed with — restored when the author refuses to leave
let heldHash = location.hash
// NEW: set right before a reload WE asked for, so the browser's own leave-page
// dialog (beforeunload) does not ask a second time after our confirm
let leaving = false

const start = async () => {
  readHash()
  if (uiState.game === '') { paintChrome(); renderHome(actions); return }
  // NEW: the name this load is FOR. The hash may move on while the fetch is in
  // flight (the brand link clicked during a slow load): hashchange then paints
  // home or reloads, and this continuation must give up rather than paint the
  // game over it. editorState.game stays '' until the files are here, so the
  // unsaved-edits guard never compares five nulls against a snapshot.
  const game = uiState.game
  let files
  try {
    files = await loadGame(game)
  } catch (error) {
    if (uiState.game !== game) return                   // the hash moved on; this failure is nobody's now
    console.error(error)
    paintChrome()
    renderLoadFailure(game, error)
    return
  }
  if (uiState.game !== game) return                     // the hash moved on while we loaded
  Object.assign(editorState, { game, ...files })        // the ONE place the five drawers are filled
  paintChrome()
  render(actions)
  markSaved()   // after the first paint: repairBuckets' one write is not an edit
}

document.querySelector('#save').addEventListener('click', () => actions.save())
document.querySelector('#export').addEventListener('click', () => actions.saveAndExport())
// CHANGED: a hash change WITHIN the open game repaints, as before. A change of
// GAME (home → dino, dino → vampire, dino → home) reloads the page: one page
// holds one game's data, so there is never a moment with two games in memory
// and no card memory to clear. After a failed load the page holds no game
// (editorState.game is ''), so a game hash reloads and fails loudly again,
// while #home paints the list in place. Leaving with unsaved edits asks first;
// a "no" puts the address back.
window.addEventListener('hashchange', () => {
  readHash()
  if (uiState.game === editorState.game) { heldHash = location.hash; paint(); return }
  if (hasUnsavedEdits() && !confirm(`"${gameTitle()}" has unsaved edits. Leave and lose them?`)) { location.hash = heldHash; return }
  leaving = true
  location.reload()
})
// NEW: closing or reloading the tab with unsaved edits asks first — the browser's own dialog
window.addEventListener('beforeunload', (event) => { if (!leaving && hasUnsavedEdits()) event.preventDefault() })
start()
