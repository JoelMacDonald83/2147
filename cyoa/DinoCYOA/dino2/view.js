import { selectionGroups } from './config.js'
import { gameState } from './state.js'

// View: DOM refs

const statusEl = document.querySelector('#status')
const groupsEl = document.querySelector('#groups')

// View: render

export const render = (actions) => {
  statusEl.textContent = gameState.statusMessage
  groupsEl.innerHTML = ''

  selectionGroups.forEach(group => {
    const sectionEl = document.createElement('div')
    sectionEl.className = `group-section ${group.id}`

    const headingEl = document.createElement('h2')
    headingEl.className = 'group-heading'
    headingEl.textContent = group.label

    const chosen = gameState.selections[group.id]
    const summaryEl = document.createElement('p')
    summaryEl.className = 'group-summary'
    summaryEl.textContent = chosen.length === 0
      ? 'Nothing selected yet'
      : chosen.map(item => item.name).join(', ')

    sectionEl.appendChild(headingEl)
    sectionEl.appendChild(summaryEl)

    const cardsGridEl = document.createElement('div')
    cardsGridEl.className = 'cards-grid'

    group.options.forEach(item => {
      const cardEl = document.createElement('div')
      cardEl.className = 'card'

      const imgEl = document.createElement('img')
      imgEl.className = 'card-image'
      imgEl.src = item.imageURL
      imgEl.alt = item.name

      const descEl = document.createElement('p')
      descEl.className = 'card-name'
      descEl.textContent = `${item.name} - ${item.cost} points`

      const labelEl = document.createElement('p')
      labelEl.className = 'card-label'
      labelEl.textContent = item.label

      const traitsEl = document.createElement('ul')
      traitsEl.className = 'card-traits'
      item.traits.forEach(trait => {
        const traitEl = document.createElement('li')
        traitEl.textContent = trait
        traitsEl.appendChild(traitEl)
      })

      const buttonEl = document.createElement('button')
      buttonEl.className = 'card-button'

      if (gameState.isSelected(group, item)) {
        cardEl.classList.add('card--selected')
        buttonEl.textContent = 'Selected'
        buttonEl.addEventListener('click', () => actions.toggle(group, item))
      } else if (gameState.selections[group.id].length >= group.max) {
        cardEl.classList.add('card--locked')
        buttonEl.textContent = 'Full'
        buttonEl.disabled = true
      } else if (!gameState.canAfford(item)) {
        cardEl.classList.add('card--locked')
        buttonEl.textContent = 'Too expensive'
        buttonEl.disabled = true
      } else {
        buttonEl.textContent = 'Select'
        buttonEl.addEventListener('click', () => actions.toggle(group, item))
      }

      cardEl.appendChild(imgEl)
      cardEl.appendChild(descEl)
      cardEl.appendChild(labelEl)
      cardEl.appendChild(traitsEl)
      cardEl.appendChild(buttonEl)
      cardsGridEl.appendChild(cardEl)
    })

    sectionEl.appendChild(cardsGridEl)
    groupsEl.appendChild(sectionEl)
  })
}