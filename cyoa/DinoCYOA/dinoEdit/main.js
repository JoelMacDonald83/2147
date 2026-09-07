import { editorState } from './state.js'
import { render, renderSaveStatus } from './view.js'
import { save } from './saveData.js'

const actions = {
  async save() {
    renderSaveStatus('Saving…')

    // CHANGED: content.json goes LAST, on its own. Its version stamp is the
    // SET's version (migrations.js) — if it flipped to 3 while types/things
    // failed to land, the next load would refuse the whole set. Landing the
    // other four first means a partial save leaves content.json at its old
    // version, and the next load simply migrates again, overwriting the strays.
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

render(actions)
