import { editorState, markSaved, hasUnsavedEdits, gameTitle, ownFiles } from './state.js'
import { render, renderSaveStatus } from './view.js'
import { renderHome, renderLoadFailure, exportText } from './home.js'   // NEW
import { loadGame, loadBooks } from './loadData.js'                     // CHANGED: a function, called when a game opens
import { save, exportGame, listBooks } from './saveData.js'
import { uiState, readHash } from './uiState.js'
// CHANGED: validateSet moved to merge.js and grew a twin. validateGame judges a
// game AND the books under it: the shapes of the five files first, then the
// merge's own faults, then every reference over the MERGED set. It is the same
// function the server runs on content.json and the export runs before it copies.
import { validateGame } from '/config/merge.js'
import { rowsIn } from '/config/references.js'          // the row-tree walk, for naming a row in a refusal
// the words for a book — the Books tab owns them (it is the tab that reads the shelf)
import { pinTitle, shelfRequires } from './books.js'

const count = (problems) => `${problems.length} problem${problems.length === 1 ? '' : 's'}`

// NEW: the four sentences a refused save may need beyond the generic one. A
// merge fault is not a typo: it is two books disagreeing, or a pin that points
// nowhere, and the author cannot act on "3 problems (see console)" for those.
// Each reads the fault by its PATH — the coordinates the merge promises — and
// names the tab where the fix lives.
const F14 = 'rules.totalBudget'
const F13 = /^rules\.groupRules\["(.+)"\]\.(min|max)$/
const saveRefusal = (problems) => {
  if (problems.some(problem => problem.path === F14)) {
    return "Not saved — books conflict on the budget; set this game's budget (Rows › Page)"
  }
  const conflicted = problems.find(problem => F13.test(problem.path) && problem.message.includes('propose different values'))
  if (conflicted) {
    const [, rowId, key] = conflicted.path.match(F13)
    return `Not saved — books conflict on ${key} of row "${rowLabel(rowId)}"; set this game's value (Rows)`
  }
  const [first] = problems
  if (first.path.startsWith('content.books')) return `Not saved — ${first.message} (Books tab)`
  return `Not saved — ${count(problems)} (see console)`
}
// the label the author sees for a row id: the merged one (this game's override
// if it wrote one, else the book's proposal), then the raw proposal — a row that
// is HIDDEN is not in the merged tree, and its conflict is still worth naming —
// then, if all else fails, the id.
const rowLabel = (rowId) => {
  const named = (rows) => rowsIn(rows).find(row => row.id === rowId)?.label
  return named(editorState.merged?.content.groups ?? [])
    ?? named((editorState.proposed?.rows ?? []).map(entry => entry.row))
    ?? rowId
}

const actions = {
  // CHANGED: returns true when all five landed — saveAndExport waits for that answer.
  // The game is the one the PAGE holds (editorState.game), bound here, not read
  // from the address bar.
  async save() {
    // the whole set is checked HERE first, all five files at once, WITH the books
    // under it. The server checks again (curl, a hand-edit under us) — but a refusal
    // seen before the network means the four files never land while content.json is
    // refused, so the disk never holds half a save. Number.isFinite in the checker is
    // what makes that true: Number("1e400") is Infinity in memory and null on the
    // wire; both are refused, here, before any post.
    const problems = validateGame({ own: ownFiles(), books: editorState.books })
    if (problems.length > 0) {
      renderSaveStatus(saveRefusal(problems))
      console.warn('Not saved — the set does not fit the schema:')
      console.table(problems)                                   // two columns: path, message
      return false
    }
    renderSaveStatus('Saving…')
    const game = editorState.game
    // content.json goes LAST, on its own (its version stamp is the SET's version and
    // it carries every cross-reference — see the v4 note): the other four first, so a
    // partial save leaves content.json at its old version and the next load migrates again.
    // It carries the PINS too, which is the second reason it goes last: the four
    // files are already on disk when the server judges them against the shelf.
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
  },

  // ───────── the Books tab's four ─────────
  // A pin is an edit to content.json like any other — the unsaved-edits guard
  // covers it and Save posts it last. What is NOT like any other edit is that
  // the LAYERS have to be re-read from the shelf afterwards: the merge reads
  // layers, not pins. That is the one async edit in the editor, and it says so
  // in the status line while it happens.

  // NEW: the shelf, once per page. `shelf` is set to the receipt either way, so
  // a server that could not read books/ is asked once and then reported.
  async readShelf() {
    if (shelfPending) return
    shelfPending = true
    editorState.shelf = await listBooks()
    shelfPending = false
    if (!editorState.shelf.ok) console.warn(`GET /api/books: ${editorState.shelf.error}`)
    paint()
  },

  async reloadBooks() {
    editorState.books = await loadBooks(editorState.content.books)
    paint()                                   // render() remerges first thing, so the whole screen follows
  },

  // adding a book adds what it REQUIRES too: a book whose foundation is missing
  // is skipped whole by the merge, so pinning it alone would pin a fault.
  async pinBook(name, edition) {
    const pinned = new Set(editorState.content.books.map(pin => pin.name))
    const brought = shelfRequires(name, edition).filter(pin => !pinned.has(pin.name))
    brought.forEach(pin => editorState.content.books.push({ name: pin.name, edition: pin.edition }))
    editorState.content.books.push({ name, edition })
    renderSaveStatus(`loading ${pinTitle(name, edition)}…`)
    await actions.reloadBooks()
    renderSaveStatus(brought.length === 0
      ? `added ${pinTitle(name, edition)}`
      : `added ${pinTitle(name, edition)} (and ${brought.map(pin => pinTitle(pin.name, pin.edition)).join(', ')} — it requires them)`)
  },

  // Removing is loud and reversible: rows that showed its sheets warn, placements
  // into its shelves show ⟨missing⟩, its overrides become orphan notices — and
  // nothing is written to disk until Save.
  async unpinBook(name) {
    const at = editorState.content.books.findIndex(pin => pin.name === name)
    if (at === -1) return
    const [pin] = editorState.content.books.splice(at, 1)
    await actions.reloadBooks()
    renderSaveStatus(`removed ${pinTitle(pin.name, pin.edition)}`)
  },

  // THE migration ceremony: lazy, explicit, visible in the diff, reversible
  // until Save. An edition is a copy plus more, so an upgrade usually changes
  // nothing that was there — and when it does not fit (a newer edition wants a
  // newer Stats) the merge says exactly that and the fix is one card away.
  async setEdition(name, edition) {
    const pin = editorState.content.books.find(each => each.name === name)
    if (!pin) return
    const was = pin.edition
    pin.edition = edition
    renderSaveStatus(`loading ${pinTitle(name, edition)}…`)
    await actions.reloadBooks()
    renderSaveStatus(`pinned ${pinTitle(name, edition)} (was ${was})`)
  }
}

// NEW: one shelf read at a time. renderBooksTab asks for it while painting, and
// a paint that asks again before the first answer arrives would loop.
let shelfPending = false

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
  Object.assign(editorState, { game, ...files })        // the ONE place the five drawers — and the books — are filled
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
