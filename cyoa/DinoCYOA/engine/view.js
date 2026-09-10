import { groups, playerSheet, totalBudget } from './config/gameConfig.js'   // CHANGED: + the declared sheet and the budget the sheet's total line prints
import { placementSheet, asOption } from './config/schema.js'   // NEW: the placement fields of a list section, for the line below
// NEW: the cost rule and the quantity reader, ASKED rather than repeated — the
// stepper's number and the sheet's per-entry points must be the ones the budget used.
import { entryCost, quantityOf } from './config/sheet.js'
// NEW: every row at every depth. The sheet's SHAPE is read from all of them (a
// section is drawn if any row can ever fill it), not just the ones on screen.
import { flattenGroups } from './helpers.js'
import { gameState } from './state.js'
// Same relationship as the old game: the view reads config (what exists) and
// state (what the player has done) and paints the page from both.

// View: DOM refs

const statusEl = document.querySelector('#status')
const sheetEl  = document.querySelector('#sheet')   // NEW: the player's sheet. It ships `hidden`; only a game that declares one un-hides it.
const groupsEl = document.querySelector('#groups')

// NEW: the fire-drill roster, the same one state.js keeps — every row at every
// depth. The sheet asks it one question only: "can ANY row ever fill this section?"
const allRows = flattenGroups(groups)

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
// CHANGED again, for the sheet: the shape is really "ONE ELEMENT with a class and a
// line of text", and the sheet needs it as an <h3> and a <li> too. `tagged` is that
// one shape; `p` is the paragraph half of it, so every existing caller is untouched.
const tagged = (tag, className, text) => {
  const el = document.createElement(tag)
  el.className = className
  el.textContent = text
  return el
}
const p = (className, text) => tagged('p', className, text)

// NEW: a button with a class, a word and one thing it does. Four of these on the
// sheet and two in every stepper, all identical but for those three things.
const button = (className, text, onClick) => {
  const el = tagged('button', className, text)
  el.addEventListener('click', onClick)
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

// NEW: how each KIND of field is FILLED IN by the player — the FOURTH reader of a
// field's kind, and the last one this project needs:
//   dinoEdit's FIELD_BUILDERS    how an AUTHOR edits a kind
//   DISPLAY_BUILDERS (above)     how a kind is SHOWN on a card
//   validate.js's CHECKERS       what shape a kind must hold
//   INPUT_BUILDERS (here)        how a PLAYER fills a kind in
// Four kinds and no structural ones: a player never edits a collection.
// It is written HERE and not imported from dinoEdit/ for one hard reason — the
// editor is never published, and the engine may import nothing that is not.
//
// Every builder returns the same shape (a <label> holding a caption and one box),
// so the sheet and a card can hang them in the same place without asking which kind
// they got. None of them repaints: the box already shows what was typed, and a
// repaint mid-word would eat the caret.
// NEW: grow a textarea to the text it holds. scrollHeight is 0 until the element
// is in the document, so this cannot run at build time — renderSheet calls it for
// every marked box once the sheet is hung, and the input handler calls it per key.
const fitToText = (el) => {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const labelled = (field, tag) => {
  const fieldEl = document.createElement('label')
  fieldEl.className = 'sheet-field'
  fieldEl.appendChild(tagged('span', '', field.caption))
  const controlEl = document.createElement(tag)
  fieldEl.appendChild(controlEl)
  return { fieldEl, controlEl }
}

const INPUT_BUILDERS = {
  text: (field, value, onChange) => {
    const { fieldEl, controlEl } = labelled(field, 'input')
    controlEl.type = 'text'
    controlEl.value = value ?? ''
    // only the Name slot carries one (see renderSheet): an empty sheet should say
    // what the empty box is FOR, and "Unnamed" is what an unnamed sheet is called
    if (field.placeholder) controlEl.placeholder = field.placeholder
    controlEl.addEventListener('input', () => onChange(controlEl.value))
    return fieldEl
  },
  number: (field, value, onChange) => {
    const { fieldEl, controlEl } = labelled(field, 'input')
    controlEl.type = 'number'
    controlEl.value = value ?? ''
    // the RAW string goes out, exactly as the editor's number builder does it:
    // readValue is the one border that turns keystrokes into a number, and it lives
    // in sheet.js so the player's door and the author's door cannot drift apart
    controlEl.addEventListener('input', () => onChange(controlEl.value))
    return fieldEl
  },
  lines: (field, value, onChange) => {
    const { fieldEl, controlEl } = labelled(field, 'textarea')
    controlEl.rows = 3
    // a value that is not an array is a field whose kind used to be text — show
    // nothing rather than the letters of a string, one per line
    controlEl.value = (Array.isArray(value) ? value : []).join('\n')
    // CHANGED: marked for fitToText, which renderSheet calls once the sheet is in
    // the document. Growing it ONLY on input was not enough: every repaint (a pick,
    // a load, Start over, a reload) rebuilds this box at three rows, and a textarea
    // does not grow itself on paper — so a long Notes was silently CLIPPED when
    // printed, which is the one place the sheet is supposed to be whole.
    controlEl.dataset.fit = 'text'
    controlEl.addEventListener('input', () => {
      fitToText(controlEl)
      onChange(controlEl.value)
    })
    return fieldEl
  },
  choice: (field, value, onChange) => {
    const { fieldEl, controlEl } = labelled(field, 'select')
    // through asOption, because options arrive in two shapes — a book writes them
    // short (bare strings), a sheet writes them long ({ value, label }). One reader
    // for both, the same one the editor's choice builder uses.
    ;(field.options ?? []).map(asOption).forEach(option => {
      const optionEl = document.createElement('option')
      optionEl.value = option.value
      optionEl.textContent = option.label
      controlEl.appendChild(optionEl)
    })
    controlEl.value = value ?? ''
    controlEl.addEventListener('change', () => onChange(controlEl.value))
    return fieldEl
  }
}

// NEW: the mirror of renderDisplay, one storey over. A kind with no builder warns
// once, by name, and draws NOTHING — never a box that silently writes nowhere.
const renderInput = (field, value, onChange) => {
  const builder = INPUT_BUILDERS[field.type]
  if (!builder) {
    console.warn(`No input for kind "${field.type}" (field: ${field.key})`)
    return document.createTextNode('')
  }
  return builder(field, value, onChange)
}

// NEW: [−] n [+] for a bound row whose section MULTIPLIES (a number placement field
// keyed `quantity`). The buttons are DISABLED with a reason rather than allowed and
// then refused: prevention on the button, and stepQuantity's own guards are the
// closed door behind it for anything scripted or keyboard-driven.
const buildStepper = (group, item, actions) => {
  const stepperEl = document.createElement('div')
  stepperEl.className = 'stepper'

  const now = quantityOf(group.fills, gameState.valuesFor(group, item))
  const downEl = button('stepper-button', '−', () => actions.step(group, item, -1))
  if (now <= 1) {
    // below 1 an entry means nothing, and the honest way to have none of something
    // is to unpick it — which the card's own button already does
    downEl.disabled = true
    downEl.title = 'Remove it from your sheet instead'
  }

  const upEl = button('stepper-button', '+', () => actions.step(group, item, 1))
  // one more of this item costs one more of its price — the same arithmetic
  // stepQuantity refuses on, written here as the reason the button is grey
  if (item.cost > gameState.remaining) {
    upEl.disabled = true
    upEl.title = `Not enough points left (${gameState.remaining} left)`
  }

  stepperEl.appendChild(downEl)
  stepperEl.appendChild(tagged('span', 'stepper-value', String(now)))
  stepperEl.appendChild(upEl)
  return stepperEl
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
    // CHANGED: the group is passed too, so the price on the button is the price a
    // NEW pick would really cost — its section's default quantity, not always ×1
    } else if (!gameState.canAfford(item, group)) {
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
    // NEW: three lines that only a SELECTED pick in a BOUND row gets. An unbound row
    // (every v5 row, every vampire row) is byte-for-byte the card it is today.
    //   1. the grey line naming where the entry went — the card is a shop, the sheet
    //      is the document, and this says which is which;
    //   2. the stepper, when this section multiplies;
    //   3. one box per OTHER placement field (a Level, a note), so every value has
    //      exactly one editor, and it is here beside the running total.
    // They go BEFORE the button on purpose: .card-button is `margin-top: auto`, so
    // it stays pinned to the bottom of the card whatever is added above it.
    if (gameState.isSelected(group, item) && group.fills) {
      cardEl.appendChild(p('card-fills', `→ ${group.fills.caption}`))
      if (group.quantityField) cardEl.appendChild(buildStepper(group, item, actions))
      // by KEY, not by identity: placementSheet dresses a fresh copy of every field
      // on each call, so `field !== group.quantityField` would never be false and the
      // quantity would get a plain box beside its own stepper
      placementSheet(group.fills)
        .filter(field => field.key !== group.quantityField?.key)
        .forEach(field => cardEl.appendChild(renderInput(
          field,
          gameState.valuesFor(group, item)[field.key],
          raw => actions.setValue(group, item, field, raw)
        )))
    }
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

// NEW: the player's sheet — the document the rows are FOR.
//
// It is painted from gameState and nothing else, because the sheet IS derived: the
// typed half comes from gameState.typed, the entries from the picks, the total from
// spent. Nothing here is stored, so nothing here can go stale.
//
// THREE RULES, each with its reason:
//   1. a FIELDS section is always drawn. A blank Concept is a blank line on a sheet:
//      honest, and it invites typing.
//   2. a LIST section is drawn if and only if SOME row can fill it — filled or not,
//      shown or not. Measured: dino fills three of Character's eight list sections,
//      so the other rule would print five headings dino can never fill. Drawing a
//      slot the game CAN fill before it is filled is also what keeps the sheet's
//      shape stable while a gated row comes and goes, which is what makes it
//      printable at any moment.
//   3. the entries are READ-ONLY here. Every value is edited on the card that bought
//      it (see the three card lines above) — one editor per value, always.
const renderSheet = (actions) => {
  // this game builds no sheet ("" — every v5 game, and vampire): #sheet keeps the
  // `hidden` it shipped with, and the page has not one new pixel on it
  if (playerSheet === null) return
  sheetEl.hidden = false
  // the CLASS is hung here and not in the markup, so the shell stays as wordless and
  // as styleless as it ships: a game with no sheet has an element with no class on it,
  // and not one rule in styles.css can reach it
  sheetEl.className = 'sheet'
  sheetEl.innerHTML = ''
  sheetEl.appendChild(tagged('h2', 'sheet-title', playerSheet.label))   // the sheet says what kind of thing it is

  // ── the one message. Loading is the only thing on this page that can half-succeed,
  // so it is the only thing that gets a sentence the player READS rather than a
  // console line. A refusal loaded nothing; a note dropped one entry, by name.
  const notice = gameState.notice
  if (notice !== null) {
    const noticeEl = p(notice.bad ? 'sheet-notice sheet-notice--bad' : 'sheet-notice', notice.text)
    // the refused bytes came from the browser's own drawer, and they are still in it
    // — offering them back is the difference between a browser that lost a character
    // sheet and one that handed it over
    if (notice.bad && notice.draft) noticeEl.appendChild(button('sheet-button', 'Download the old sheet', () => actions.downloadDraft()))
    sheetEl.appendChild(noticeEl)
    if (notice.notes.length > 0) {
      const notesEl = document.createElement('ul')
      notesEl.className = 'sheet-notes'
      notice.notes.forEach(note => notesEl.appendChild(tagged('li', '', note)))
      sheetEl.appendChild(notesEl)
    }
  }
  // a private window, a file:// origin or blocked site data. Said once, plainly, and
  // pointing at the door that always works: the file you download is yours.
  if (actions.storageRefused()) sheetEl.appendChild(p('sheet-notice', 'This browser will not remember your sheet — download it before you leave.'))

  // ── what the player TYPES: Name, then every field of every fields section, in
  // sheet order. `playerSheet.fields` is that same list already dressed with each
  // field's own default (the border built it), so the boxes and blankFields agree
  // about what an untouched Strength is.
  const dressed = (field) => playerSheet.fields.find(entry => entry.key === field.key) ?? field
  const typedEl = document.createElement('div')
  typedEl.className = 'sheet-block'
  const nameField = playerSheet.fields[0]     // playerFields puts Name first, always
  typedEl.appendChild(renderInput({ ...nameField, placeholder: 'Unnamed' }, gameState.typed[nameField.key],
                                  raw => actions.setTyped(nameField, raw)))
  playerSheet.sections.filter(section => section.kind === 'fields').forEach(section => {
    typedEl.appendChild(tagged('h3', 'sheet-caption', section.caption))
    section.fields.forEach(field => {
      const entry = dressed(field)
      typedEl.appendChild(renderInput(entry, gameState.typed[entry.key], raw => actions.setTyped(entry, raw)))
    })
  })
  sheetEl.appendChild(typedEl)

  // ── what the player PICKED, one block per fillable list section. Two rows may fill
  // ONE section (dino's Lairs and Locations both land in Places), so entries are
  // collected in ROW order and then pick order — the same one rule buildSheet and the
  // kept file follow, and the only ordering this feature has.
  playerSheet.sections
    .filter(section => section.kind === 'list' && allRows.some(row => row.fills?.id === section.id))
    .forEach(section => {
      const blockEl = document.createElement('div')
      blockEl.className = 'sheet-block'
      blockEl.appendChild(tagged('h3', 'sheet-caption', section.caption))
      // only VISIBLE rows contribute entries: a hidden row holds no picks after
      // settle() anyway, so this is belt and braces — and it keeps the sheet honest
      // in the instant a gate flips
      const entries = allRows
        .filter(row => row.fills?.id === section.id && gameState.isVisible(row))
        .flatMap(row => gameState.selections[row.id].map(item => ({ row, item })))
      if (entries.length === 0) {
        blockEl.appendChild(p('sheet-empty', 'Nothing yet'))
      } else {
        const listEl = document.createElement('ul')
        listEl.className = 'sheet-entries'
        entries.forEach(({ row, item }) => {
          const values = gameState.valuesFor(row, item)
          const howMany = quantityOf(row.fills, values)
          const entryEl = document.createElement('li')
          entryEl.className = 'sheet-entry'
          entryEl.appendChild(tagged('span', 'sheet-entry-name', item.name))
          // ×1 is not worth saying — it is what one of a thing already means
          if (howMany > 1) entryEl.appendChild(tagged('span', 'sheet-times', `×${howMany}`))
          // asked of entryCost, never multiplied here: the sheet must print the
          // number the budget actually charged
          entryEl.appendChild(tagged('span', 'sheet-points', `${entryCost(item, row.fills, values)} points`))
          listEl.appendChild(entryEl)
        })
        blockEl.appendChild(listEl)
      }
      sheetEl.appendChild(blockEl)
    })

  // on the SHEET, not only in the status bar, because a printed sheet has no status
  // bar and a character sheet that does not say what it cost is half a document
  sheetEl.appendChild(p('sheet-total', `${gameState.spent} of ${totalBudget} points spent`))

  // NEW: now that the sheet is IN the document, every marked box can measure itself.
  // This is what keeps a long Notes whole on paper after a repaint (see INPUT_BUILDERS.lines).
  sheetEl.querySelectorAll('[data-fit="text"]').forEach(fitToText)

  // ── the four doors. Not printed (the print block hides .sheet-actions): they are
  // the shop's furniture, not the document's.
  const actionsEl = p('sheet-actions', '')
  actionsEl.appendChild(button('sheet-button', 'Download', () => actions.download()))
  // Load… is a LABEL wrapping a hidden file input, because a file picker can only be
  // opened by a real click on a real input — the label IS that click, and it lets the
  // door look like the other three.
  const loadEl = tagged('label', 'sheet-button', 'Load…')
  const fileEl = document.createElement('input')
  fileEl.type = 'file'
  fileEl.accept = '.json,application/json'
  fileEl.hidden = true
  fileEl.addEventListener('change', () => {
    const file = fileEl.files[0]
    if (!file) return
    // cleared FIRST (the file is already in hand), so choosing the SAME file twice
    // still fires a change — a second load is a real request, not a no-op
    fileEl.value = ''
    file.text().then(text => actions.load(text))
  })
  loadEl.appendChild(fileEl)
  actionsEl.appendChild(loadEl)
  actionsEl.appendChild(button('sheet-button', 'Print', () => actions.print()))
  // not optional, and this is why: the autosave means a reload no longer gives a
  // blank sheet, so there has to be a way to ASK for one
  actionsEl.appendChild(button('sheet-button', 'Start over', () => actions.startOver()))
  sheetEl.appendChild(actionsEl)
}

// View: render — identical structure to the old game:
// wipe everything, rebuild everything from config + state.

// NEW: extracted, because typing is the one edit that must NOT repaint the page — a
// repaint mid-word eats the caret, and nothing on this page depends on a typed value.
// app.js calls this alone after setTyped/setValue; everything else calls render().
export const renderStatus = () => {
  statusEl.textContent = gameState.statusMessage
}

export const render = (actions) => {
  renderStatus()
  renderSheet(actions)   // NEW: between the status line and the rows — the rows are what it is for
  groupsEl.innerHTML = ''

  // NEW: only the rows state.js says are on screen get a section. Hidden rows
  // draw nothing at all (same rule as the child loop in buildGroupSection).
  groups.forEach(group => {
    if (gameState.isVisible(group)) groupsEl.appendChild(buildGroupSection(group, actions))
  })
}
