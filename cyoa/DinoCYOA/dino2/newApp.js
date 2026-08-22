import { gameState } from './state.js'
import { render } from './view.js'

const actions = {
  toggle(group, item) {
    gameState.toggleSelection(group, item)
    render(actions)
  }
}
render(actions)
