import { editorState } from './state.js'
import { render, renderSaveStatus } from './view.js'
import { save } from './saveData.js'
import { readHash } from './uiState.js'                     // NEW
import { validateSet } from '/config/validate.js'   // NEW: the same contract the server enforces

const count = (problems) => `${problems.length} problem${problems.length === 1 ? '' : 's'}`

const actions = {
  async save() {
    // NEW: the whole set is checked HERE first, all five files at once. The server checks
    // again (curl, a hand-edit under us) — but a refusal seen before the network means the
    // four files never land while content.json is refused, so the disk never holds half a
    // save. Number.isFinite in the checker is what makes that true: Number("1e400") is
    // Infinity in memory and null on the wire; both are refused, here, before any post.
    const problems = validateSet(editorState)
    if (problems.length > 0) {
      renderSaveStatus(`Not saved — ${count(problems)} (see console)`)
      console.warn('Not saved — the set does not fit the schema:')
      console.table(problems)                                   // two columns: path, message
      return
    }
    renderSaveStatus('Saving…')

    // content.json goes LAST, on its own. Its version stamp is the SET's
    // version (migrations.js) — if it flipped to 4 while types/things failed
    // to land, the next load would refuse the whole set. Landing the other
    // four first means a partial save leaves content.json at its old
    // version, and the next load simply migrates again, overwriting the
    // strays (the migration mints nothing, so they come out identical).
    // content.json is also the one file carrying every cross-reference
    // (type, field, thing and row ids), so it is the file that must land whole.
    const receipts = await Promise.all([
      save('types', editorState.types),
      save('things', editorState.things),
      save('rules', editorState.rules),
      save('themes', editorState.themes)
    ])
    if (receipts.every(receipt => receipt.ok)) {
      receipts.push(await save('content', editorState.content))
    }

    // CHANGED: a refusal is named. The status line carries the file and the count; the
    // console carries every problem by path.
    const failed = receipts.filter(receipt => !receipt.ok)
    if (failed.length === 0) { renderSaveStatus('Saved ✓'); return }
    const [first] = failed
    renderSaveStatus(first.problems
      ? `Save failed — ${first.name}.json: ${count(first.problems)} (see console)`
      : `Save failed — ${first.name}.json: ${first.error}`)
    failed.forEach(receipt => {
      console.warn(`${receipt.name}.json: ${receipt.error}`)
      if (receipt.problems) console.table(receipt.problems)
    })
  }
}

// NEW: the Save button lives in index.html, not in a painter. It is shared by
// every tab and must survive every repaint; wiring it once here is the same
// "events → state → render" loop, minus rebuilding a button that never changes.
document.querySelector('#save').addEventListener('click', () => actions.save())
// NEW: the ONE navigation → paint path. Tabs and rail lines are plain links;
// the browser changes the hash, this repaints from it.
window.addEventListener('hashchange', () => { readHash(); render(actions) })
readHash()                                                                           // NEW: land where the URL says (no hash → Types)
render(actions)
