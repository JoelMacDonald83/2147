import { groups } from './config/gameConfig.js'
import { gameState } from './state.js'
// Same relationship as the old game: the view reads config (what exists) and
// state (what the player has done) and paints the page from both.

// View: DOM refs

const statusEl = document.querySelector('#status')
const groupsEl = document.querySelector('#groups')

// View: one-time painters — run once at startup, never again

// The tab title and hero heading are CONTENT now: they arrive from content.json
// through the doorway. The HTML shell ships wordless; these are the page's first words.
export const renderMeta = (meta) => {
  document.title = meta.pageTitle
  document.querySelector('.hero-title').textContent = meta.heroTitle
}

// The page-wide look arrives from themes.json. styles.css owns the LAYOUT (the
// chassis: grids, flex, sizes) but contains no theme values at all — it only says
// var(--...). We inject the actual values here, as CSS custom properties on the
// root element. One source of truth: change themes.json, the whole page re-skins.
export const applyPageTheme = (pageTheme) => {
  const root = document.documentElement
  root.style.setProperty('--body-background', pageTheme.bodyBackground)
  root.style.setProperty('--font-family', pageTheme.fontFamily)
  root.style.setProperty('--hero-image', `url("${pageTheme.heroImage}")`)
  root.style.setProperty('--status-background', pageTheme.statusBackground)
  root.style.setProperty('--status-color', pageTheme.statusColor)
}

// View: render — identical structure to the old game:
// wipe everything, rebuild everything from config + state.

export const render = (actions) => {
  statusEl.textContent = gameState.statusMessage
  groupsEl.innerHTML = ''

  groups.forEach(group => {
    const sectionEl = document.createElement('div')
    sectionEl.className = 'group-section'
    // CHANGED from the old game: sections used to get the group id as a class name
    // (.dinos / .stuffables) and CSS held their looks. Ids are UUIDs now — useless
    // as class names — and each group carries its look IN THE DATA instead:
    if (group.background) {
      // backgroundImage rather than the background shorthand, so the stylesheet's
      // background-size/background-position still apply if a photo is used
      sectionEl.style.backgroundImage = group.background
    }

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

    group.items.forEach(item => {
      // CHANGED: group.options is now group.items (items live inside their group
      // in content.json — the old config.js variable indirection no longer exists)
      const cardEl = document.createElement('div')
      cardEl.className = 'card'

      const imgEl = document.createElement('img')
      imgEl.className = 'card-image'
      imgEl.src = item.imageURL // already a real URL: the border prefixed /assets/
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
