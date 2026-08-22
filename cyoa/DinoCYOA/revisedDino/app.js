import { meta, pageTheme } from './config/gameConfig.js'
import { gameState } from './state.js'
import { renderMeta, applyPageTheme, render } from './view.js'

// The conductor — same wiring as the old newApp.js, plus the two one-time
// painters that only exist because title/hero/theme are DATA now:

renderMeta(meta)        // content.json → tab title + hero heading
applyPageTheme(pageTheme) // themes.json → CSS custom properties on :root

// Events → state change → re-render everything from data.
// (This wipe-and-rebuild-from-state loop is the same pattern the old game used.)
const actions = {
  toggle(group, item) {
    gameState.toggleSelection(group, item)
    render(actions)
  }
}
render(actions)
