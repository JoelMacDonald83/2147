import { editorState } from './state.js'
import { render, renderSaveStatus } from './view.js'
import { save } from './saveData.js'
import { readHash } from './uiState.js'                     // NEW

const actions = {
  async save() {
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

    const allOk = receipts.every(receipt => receipt.ok)
    renderSaveStatus(allOk ? 'Saved ✓' : 'Save failed — check the console')
    if (!allOk) console.log('Save receipts:', receipts)
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
