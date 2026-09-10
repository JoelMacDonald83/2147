// CHANGED (stage 4): `S` is this page's row of the SUBJECT table and `subjectTitle` was
// gameTitle — see dinoEdit/subject.js. What the page holds is editorState.subject
// ({ kind, name, edition }), and `sameSubject` is the only comparison allowed to decide
// whether a hash change repaints or reloads: an EDITION change is a different subject.
import { editorState, markSaved, hasUnsavedEdits, subjectTitle, S } from './state.js'
import { render, renderSaveStatus } from './view.js'
import { renderHome, renderLoadFailure, exportText } from './home.js'   // NEW
// CHANGED (stage 4): and loadBookEdition — one edition of a book, as the drawers this page
// holds — plus bookBody, the four files as the save route wants them (an untouched absent
// file goes back as null, so looking at a book writes nothing).
import { loadGame, loadBooks, loadBookEdition, bookBody } from './loadData.js'
import { save, exportGame, listBooks, saveBook, cutEdition as postCut } from './saveData.js'
import { uiState, readHash, sameSubject, hashForSubject, subjectAt } from './uiState.js'
// CHANGED: the border is asked through the subject table now. For a game that is
// validateGame (the shapes of the five files, then the merge's own faults, then every
// reference over the MERGED set — the same function the server runs on content.json and the
// export runs before it copies); for a book it is validateBook, its exact twin. One call,
// one answer shape, no branch here.
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
  // CHANGED (stage 4): the subject's own pins path — `content.books` for a game,
  // `book.requires` for a book (merge.js's sitesFor writes both). One cell, one sentence.
  if (first.path.startsWith(S().pins.join('.'))) return `Not saved — ${first.message} (Books tab)`
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

// NEW (stage 4): one row per kind of subject — HOW ITS FILES REACH THE DISK. Each returns
// the receipts, each labelled with the `what` the status line names. The two are genuinely
// different transactions and neither is a rename of the other:
//
//   a GAME posts five files, four in parallel and content.json LAST, because content.json
//     carries every cross-reference AND the pins: the other four are already on disk when
//     the server judges it against the shelf, so the disk never holds half a save.
//   a BOOK posts the WHOLE book in ONE request (spec L2/§8). It has four files and no last
//     one carrying the references, so that ordering has no analogue — and one route that
//     takes all four and renames the staged edition into place is simpler AND stronger: the
//     half-saved book does not exist as a case.
const SAVERS = {
  game: async () => {
    const game = editorState.subject.name
    const receipts = await Promise.all([
      save(game, 'types', editorState.types),
      save(game, 'things', editorState.things),
      save(game, 'rules', editorState.rules),
      save(game, 'themes', editorState.themes)
    ])
    if (receipts.every(receipt => receipt.ok)) receipts.push(await save(game, 'content', editorState.content))
    return receipts.map(receipt => ({ ...receipt, what: `${receipt.name}.json` }))
  },
  book: async () => {
    const { name, edition } = editorState.subject
    const receipt = await saveBook(name, edition, bookBody(editorState))
    // THE FREEZE, ARRIVING LATE. The screen decides what to offer from a census it reads out
    // of the games LISTING, which can only see the games whose merge survived; the server's
    // own census reads the raw pins out of every content.json. So a 409 here is the border
    // telling us something the screen could not know — and the honest answer is to become the
    // read-only screen it should have been, carrying the server's own sentence, with the cut
    // (which keeps the unsaved work — see actions.cutEdition) as the one thing left to do.
    // 409 is the ONE refusal this route answers with, and it is the freeze: the status is
    // acted on, the sentence is only printed.
    if (receipt.status === 409) {
      editorState.pinnedBy = null
      editorState.frozen = receipt.error
    }
    // A BOOK SAVE IS A BOOK MUTATION. The shelf listing carries this edition's facts and its
    // problems, and both just moved — so the cached answer is about a disk that has changed,
    // which is the one thing a cache must never be. Everything that reads it asks again on
    // null (the Books tab, the read-only banner).
    if (receipt.ok) actions.forgetShelf()
    return [{ ...receipt, what: `books/${name}/${edition}` }]
  }
}

const actions = {
  // CHANGED: returns true when everything landed — saveAndExport waits for that answer.
  // The subject is the one the PAGE holds (editorState.subject), bound here, not read from
  // the address bar.
  async save() {
    // the whole set is checked HERE first, every file at once, WITH the books under it —
    // validateGame for a game, validateBook for a book, one call through the subject table.
    // The server checks again (curl, a hand-edit under us) — but a refusal seen before the
    // network means a game's four files never land while content.json is refused, so the
    // disk never holds half a save. Number.isFinite in the checker is what makes that true:
    // Number("1e400") is Infinity in memory and null on the wire; both are refused, here,
    // before any post.
    const problems = S().validate(editorState)
    if (problems.length > 0) {
      renderSaveStatus(saveRefusal(problems))
      console.warn('Not saved — the set does not fit the schema:')
      console.table(problems)                                   // two columns: path, message
      return false
    }
    // NEW: and a FROZEN edition is not saved at all. The button is disabled and every control
    // on the screen with it, so this is the belt and not the braces — but it is the one place
    // that would otherwise post an edition a game depends on.
    if (!S().editable(editorState)) { renderSaveStatus(`Not saved — ${editorState.frozen ?? 'this edition is frozen'}`); return false }
    renderSaveStatus('Saving…')
    // a refusal is named. The status line carries what failed and the count; the
    // console carries every problem by path.
    const failed = (await SAVERS[editorState.subject.kind]()).filter(receipt => !receipt.ok)
    if (failed.length === 0) { markSaved(); renderSaveStatus('Saved ✓'); return true }   // CHANGED: memory now equals disk
    const [first] = failed
    renderSaveStatus(first.problems
      ? `Save failed — ${first.what}: ${count(first.problems)} (see console)`
      : `Save failed — ${first.what}: ${first.error}`)
    failed.forEach(receipt => {
      console.warn(`${receipt.what}: ${receipt.error}`)
      if (receipt.problems) console.table(receipt.problems)
    })
    paint()     // NEW: a freeze found at the border turns the screen read-only at once
    return false
  },

  // NEW (stage 4): CUT EDITION N+1 — the one thing a frozen edition offers, and the answer
  // its refusal points at. A cut copies what is on DISK, so unsaved edits would be left
  // behind: they are posted into the new edition before the page moves to it, which is what
  // makes this safe to offer from a screen the author has already typed into (the 409 path
  // above). Moving to another edition is moving to another SUBJECT, so the hash change
  // reloads the page — and it is not dirty by then, so nothing asks to confirm.
  async cutEdition() {
    const { name, edition } = editorState.subject
    const carrying = hasUnsavedEdits()
    renderSaveStatus(carrying ? 'cutting a new edition for the unsaved edits…' : 'cutting a new edition…')
    const cut = await postCut(name, edition)
    if (!cut.ok) { renderSaveStatus(`Not cut — ${cut.error}`); return }
    actions.forgetShelf()
    if (carrying) {
      // THE FOLDER IS THE TRUTH, and this is where that bites: the manifest in memory says
      // the edition it was LOADED from, and posting it into the new folder is a manifest that
      // disagrees with its folder — which bookRules refuses by name, so the cut succeeded and
      // the carried edits came back "does not fit the schema". Measured, not guessed: it is
      // exactly what happened the first time this ran.
      const receipt = await saveBook(name, cut.edition, { ...bookBody(editorState), book: { ...editorState.book, edition: cut.edition } })
      if (!receipt.ok) {
        renderSaveStatus(`Edition ${cut.edition} was cut, but the edits were refused — ${receipt.error}`)
        if (receipt.problems) console.table(receipt.problems)
        return
      }
      markSaved()
    }
    location.hash = hashForSubject(subjectAt('book', name, cut.edition), uiState.tab)
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
    const receipt = await actions.exportGame(editorState.subject.name)
    renderSaveStatus(`Saved ✓ · ${exportText(receipt)}`)
    if (receipt.ok) { previewEl.href = receipt.preview; previewEl.hidden = false }
  },

  // ───────── the Books tab's four ─────────
  // A pin is an edit to content.json like any other — the unsaved-edits guard
  // covers it and Save posts it last. What is NOT like any other edit is that
  // the LAYERS have to be re-read from the shelf afterwards: the merge reads
  // layers, not pins. That is the one async edit in the editor, and it says so
  // in the status line while it happens.

  // NEW: the shelf, read once and then remembered. `shelf` is set to the receipt either
  // way, so a server that could not read books/ is asked once and then reported.
  // CORRECTED (stage 4): "once per PAGE" is no longer true and must not be claimed — see
  // forgetShelf below. It is once per ANSWER: whatever could have changed books/ throws the
  // answer away and the next paint asks again.
  async readShelf() {
    if (shelfPending) return
    shelfPending = true
    editorState.shelf = await listBooks()
    shelfPending = false
    if (!editorState.shelf.ok) console.warn(`GET /api/books: ${editorState.shelf.error}`)
    paint()
  },

  // NEW (spec §5, gap 7): THROW THE SHELF ANSWER AWAY. `editorState.shelf` was cached for
  // the life of the page on the stated grounds that books/ cannot change while the author
  // edits — which was true only while nothing could write a book. It is false the moment a
  // create/cut/delete/rename route exists, and it is false for the GAME side too: an author
  // who makes a book and comes back to this tab would not be offered it, because the cache
  // is an answer about the DISK and the disk moved. So every book mutation calls this, and
  // the next paint asks again (renderBooksTab and the Library both re-read on null).
  // It does NOT fetch: a mutation is usually followed by a paint anyway, and re-reading here
  // would race the paint's own readShelf. Setting it to null is the whole invalidation.
  forgetShelf() { editorState.shelf = null },

  async reloadBooks() {
    editorState.books = await loadBooks(pins())
    paint()                                   // render() remerges first thing, so the whole screen follows
  },

  // adding a book adds what it REQUIRES too: a book whose foundation is missing
  // is skipped whole by the merge, so pinning it alone would pin a fault.
  async pinBook(name, edition) {
    const pinned = new Set(pins().map(pin => pin.name))
    const brought = shelfRequires(name, edition).filter(pin => !pinned.has(pin.name))
    brought.forEach(pin => pins().push({ name: pin.name, edition: pin.edition }))
    pins().push({ name, edition })
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
    const at = pins().findIndex(pin => pin.name === name)
    if (at === -1) return
    const [pin] = pins().splice(at, 1)
    await actions.reloadBooks()
    renderSaveStatus(`removed ${pinTitle(pin.name, pin.edition)}`)
  },

  // THE migration ceremony: lazy, explicit, visible in the diff, reversible
  // until Save. An edition is a copy plus more, so an upgrade usually changes
  // nothing that was there — and when it does not fit (a newer edition wants a
  // newer Stats) the merge says exactly that and the fix is one card away.
  async setEdition(name, edition) {
    const pin = pins().find(each => each.name === name)
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

// NEW (stage 4): THE SUBJECT'S PIN LIST — `content.books` for a game, `book.requires` for a
// book, from the subject table's one `pins` cell. The four actions above edit it in place and
// then reload the LAYERS, because the merge reads layers and not pins; that is the same act
// either way, which is why there is one set of four actions and not two.
const pins = () => { const [file, key] = S().pins; return editorState[file][key] }

// NEW: the static header has two faces. On the home screen the tab strip and
// the toolbar are hidden (nothing to save); with a game open they show, the
// title names the game and Play links to the game's own address. It follows
// what the PAGE HOLDS (editorState.subject), not the hash: a game that failed to
// load is nothing to save or play, so its "Could not open" screen — and the
// home screen painted in-page after it — show no toolbar.
const gameNameEl = document.querySelector('#game-name')
const tabsEl = document.querySelector('#tabs')
const toolbarEl = document.querySelector('.toolbar')
const playEl = document.querySelector('#play')
const previewEl = document.querySelector('#preview')
const exportEl = document.querySelector('#export')
const saveEl = document.querySelector('#save')
// NEW (stage 4): the toolbar, per kind. A BOOK has no Play (there is no url at which a book
// is played — it is a layer, not a page), no Preview and no Save & export (dist/ is per game;
// a book is published by being ON THE SHELF). So: Save all only, which is the whole list.
const TOOLBAR = {
  game: { plays: (subject) => `/games/${subject.name}/`, exports: true },
  book: { plays: null,                                   exports: false }
}
const paintChrome = () => {
  const home = editorState.subject.name === ''          // CHANGED: the sentinel moved, the meaning did not
  gameNameEl.textContent = home ? '' : subjectTitle()   // CHROME SPEAKS TITLES (§6)
  tabsEl.hidden = toolbarEl.hidden = home
  if (home) return
  const bar = TOOLBAR[editorState.subject.kind]
  playEl.hidden = bar.plays === null
  if (bar.plays) playEl.href = bar.plays(editorState.subject)
  exportEl.hidden = !bar.exports
  if (!bar.exports) previewEl.hidden = true
  // a frozen edition has nothing to save, and saying so on the button is where an author
  // looks first. The whole screen is disabled with it (view.js's lockScreen).
  saveEl.disabled = !S().editable(editorState)
  saveEl.title = saveEl.disabled ? (editorState.frozen ?? 'this edition is frozen — cut a new one to change it') : ''
}
// the home screen and an open subject paint differently — never render() over null drawers
// CHANGED (stage 4): the chrome is repainted with the screen, not only at load. A freeze the
// BORDER found (a 409 on a save the screen thought was allowed) has to turn the Save button
// off on the same beat it turns the screen read-only, and one of the two repainting without
// the other is exactly the state an author would click in.
const paint = () => {
  if (uiState.subject.name === '') return renderHome(actions)
  paintChrome()
  return render(actions)
}

// NEW: the hash the page last agreed with — restored when the author refuses to leave
let heldHash = location.hash
// NEW: set right before a reload WE asked for, so the browser's own leave-page
// dialog (beforeunload) does not ask a second time after our confirm
let leaving = false

// NEW: one row per KIND of subject the page can open — the impure half of the subject
// table (subject.js stays fetch-free so a pure check can drive it, so the LOADERS live
// here beside the sequence that runs them). A kind with no row is failed closed by the
// very screen a missing game already uses, rather than by a fetch for a folder that is
// not there: the book row lands with the book screens.
const LOADERS = {
  game: (subject) => loadGame(subject.name),
  book: (subject) => loadBookEdition(subject)
}

const start = async () => {
  readHash()
  if (uiState.subject.name === '') { paintChrome(); renderHome(actions); return }
  // NEW: the SUBJECT this load is FOR. The hash may move on while the fetch is in
  // flight (the brand link clicked during a slow load): hashchange then paints
  // home or reloads, and this continuation must give up rather than paint the
  // subject over it. editorState.subject.name stays '' until the files are here, so the
  // unsaved-edits guard never compares null drawers against a snapshot.
  // CHANGED: the guard compares the whole subject, not one string — moving from edition 1
  // to edition 2 of a book while edition 1 is loading is exactly the case a name compare
  // would wave through.
  const subject = uiState.subject
  const load = LOADERS[subject.kind]
  // NEW (stage 4): the "Could not open" screen names the SUBJECT, and a book is not named by
  // its folder alone — an edition is a different folder holding different bytes, so "mesozoic"
  // would be three answers to "which one could not be opened".
  const named = subject.kind === 'book' ? `${subject.name} ${subject.edition}` : subject.name
  if (load === undefined) {
    paintChrome()
    renderLoadFailure(named, new Error(`The editor cannot open a ${subject.kind} yet`))
    return
  }
  let files
  try {
    files = await load(subject)
  } catch (error) {
    if (!sameSubject(uiState.subject, subject)) return   // the hash moved on; this failure is nobody's now
    console.error(error)
    paintChrome()
    renderLoadFailure(named, error)
    return
  }
  if (!sameSubject(uiState.subject, subject)) return     // the hash moved on while we loaded
  Object.assign(editorState, { subject, ...files })      // the ONE place the drawers — and the books — are filled
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
// (editorState.subject.name is ''), so a game hash reloads and fails loudly again,
// while #home paints the list in place. Leaving with unsaved edits asks first;
// a "no" puts the address back.
window.addEventListener('hashchange', () => {
  readHash()
  if (sameSubject(uiState.subject, editorState.subject)) { heldHash = location.hash; paint(); return }
  if (hasUnsavedEdits() && !confirm(`"${subjectTitle()}" has unsaved edits. Leave and lose them?`)) { location.hash = heldHash; return }
  leaving = true
  location.reload()
})
// NEW: closing or reloading the tab with unsaved edits asks first — the browser's own dialog
window.addEventListener('beforeunload', (event) => { if (!leaving && hasUnsavedEdits()) event.preventDefault() })
start()
