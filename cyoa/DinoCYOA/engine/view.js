import { groups } from './config/gameConfig.js'
import { placementSheet } from './config/schema.js'   // NEW: the placement fields of a list section, for the line below
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
  // the value is page-relative (url("assets/…")) on an INLINE style, so it
  // resolves against the document URL — the same base every other engine path uses
  root.style.setProperty('--hero-image', pageTheme.heroImage ? `url("${pageTheme.heroImage}")` : 'none')
  root.style.setProperty('--status-background', pageTheme.statusBackground)
  root.style.setProperty('--status-color', pageTheme.statusColor)
}

// CHANGED: four of the five builders below make the same thing — one <p> with a
// class and a line of text — so that shape is written once, here, and each
// builder says only what is different about it.
const p = (className, text) => {
  const el = document.createElement('p')
  el.className = className
  el.textContent = text
  return el
}

// NEW: how each KIND of author-defined field is drawn on a card. The twin of
// the editor's FIELD_BUILDERS: the editor decides how a kind is EDITED, this
// table decides how it is SHOWN. Core fields (image, name, cost) are not
// here — they are drawn by hand below, exactly as before.
const DISPLAY_BUILDERS = {
  text: (field, value) => p('card-text', value),
  lines: (field, value) => {
    const el = document.createElement('ul')
    el.className = 'card-lines'
    const lines = Array.isArray(value) ? value : []   // a field that used to be text may still hold a string
    lines.forEach(line => {
      const lineEl = document.createElement('li')
      lineEl.textContent = line
      el.appendChild(lineEl)
    })
    return el
  },
  number: (field, value) => p('card-number', `${field.caption}: ${value}`),
  // NEW: a "choice" field. The stored value IS the label (options are bare
  // strings), so it reads exactly like a number does: "Size: biggie".
  choice: (field, value) => p('card-choice', `${field.caption}: ${value}`),
  // NEW: a LIST section's entries — the one builder whose value is not a stored
  // value but a resolved list, each entry { thing, name, …the placement fields }
  // (the border followed the pointers; see resolvePlacements in gameConfig.js).
  // One line: the caption, then each entry as its name followed by its placement
  // values — "Skills: Stomp Level 2, Roar Level 1", "Origin: Tyrannosaurus" when
  // the section has no placement fields at all. An EMPTY list draws nothing: a
  // character with no gear should have no Gear line, not an empty one.
  placements: (field, value) => value.length === 0
    ? document.createTextNode('')
    : p('card-placements', `${field.caption}: ${value.map(each =>
        [each.name, ...placementSheet(field.section).map(placementField => `${placementField.caption} ${each[placementField.key]}`)].join(' ')
      ).join(', ')}`)
}

// NEW: the mirror of the editor's renderField — look the kind up, warn (and
// draw nothing) when no builder knows it
const renderDisplay = (field, value) => {
  const builder = DISPLAY_BUILDERS[field.type]
  if (!builder) {
    console.warn(`No display for kind "${field.type}" (field: ${field.key})`)
    return document.createTextNode('')
  }
  return builder(field, value)
}

// Builds ONE group's section and RETURNS it — it never places itself.
// The caller decides which wall it hangs on: render() hangs top-level rows
// on #groups; this function hangs each visible child inside its parent's
// section (the recursion at the bottom).
const buildGroupSection = (group, actions) => {
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
    // CHANGED: group.items is hung on the group by the border (gameConfig.js)
    // from the bucket of things the group's type owns — the view never
    // learns where they came from
    const cardEl = document.createElement('div')
    cardEl.className = 'card'

    const imgEl = document.createElement('img')
    imgEl.className = 'card-image'
    if (item.imageURL) {
      imgEl.src = item.imageURL // already a real URL: the border prefixed assets/
    }
    imgEl.alt = item.name

    const descEl = document.createElement('p')
    descEl.className = 'card-name'
    descEl.textContent = `${item.name} - ${item.cost} points`

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
    // CHANGED: label and traits used to be drawn by hand right here. They are
    // the author's fields now (a migrated game has exactly those two), drawn
    // in the type's field order through the display table — same slot on the
    // card as before: after the name line, before the button.
    group.fields.forEach(field => {
      cardEl.appendChild(renderDisplay(field, item[field.key]))
    })
    cardEl.appendChild(buttonEl)
    cardsGridEl.appendChild(cardEl)
  })

  // NEW: a row with nothing to pick says so, in the grid's place. This is what
  // makes a filter that matches nothing (or one the border refused to run)
  // visible in the game itself — and it is honest for a row whose type is "".
  sectionEl.appendChild(group.items.length === 0 ? buildEmptyNotice() : cardsGridEl)

  // the recursion: each child group's section is built by THIS same function
  // and hung inside THIS section — not on the top-level wall.
  // stopping lives in the data: children: [] starts nothing.
  // NEW: a hidden child renders nothing — no heading, no placeholder. The page
  // reads as if the row did not exist; a "locked" teaser is a later design
  // choice and would need no data change.
  group.children.forEach(child => {
    if (gameState.isVisible(child)) sectionEl.appendChild(buildGroupSection(child, actions))
  })

  return sectionEl
}

// NEW: the empty state — one line where the cards would be
const buildEmptyNotice = () => {
  const emptyEl = document.createElement('p')
  emptyEl.className = 'group-empty'
  emptyEl.textContent = 'Nothing to choose here'
  return emptyEl
}

// View: render — identical structure to the old game:
// wipe everything, rebuild everything from config + state.

export const render = (actions) => {
  statusEl.textContent = gameState.statusMessage
  groupsEl.innerHTML = ''

  // NEW: only the rows state.js says are on screen get a section. Hidden rows
  // draw nothing at all (same rule as the child loop in buildGroupSection).
  groups.forEach(group => {
    if (gameState.isVisible(group)) groupsEl.appendChild(buildGroupSection(group, actions))
  })
}
