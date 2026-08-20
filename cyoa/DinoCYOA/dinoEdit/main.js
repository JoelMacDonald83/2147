import { editorState } from './state.js'
import { render, renderSaveStatus } from './view.js'
import { save } from './saveData.js'

const actions = {
  async save() {
    renderSaveStatus('Saving…')

    const receipts = await Promise.all([
      save('content', editorState.content),
      save('rules', editorState.rules),
      save('themes', editorState.themes)
    ])

    const allOk = receipts.every(receipt => receipt.ok)
    renderSaveStatus(allOk ? 'Saved ✓' : 'Save failed — check the console')
    if (!allOk) console.log('Save receipts:', receipts)
  }
}

render(actions)