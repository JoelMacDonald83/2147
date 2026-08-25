import { editorState } from './state.js'
import { metaSchema, groupSchema, itemSchema, pageThemeSchema, groupThemeSchema, totalBudgetSchema, groupRulesSchema } from '/config/schema.js'
// The craftsperson directory: type name → function that builds that field.
// The walker consults this; adding a type = adding one entry.
const FIELD_BUILDERS = {
  text: (entry, target) => {
    const fieldEl = document.createElement('label')
    fieldEl.className = 'field'

    const captionEl = document.createElement('span')
    captionEl.textContent = entry.caption

    const inputEl = document.createElement('input')
    inputEl.type = 'text'
    inputEl.value = target[entry.key]            
    inputEl.addEventListener('input', () => {
      target[entry.key] = inputEl.value         
    })

    fieldEl.appendChild(captionEl)
    fieldEl.appendChild(inputEl)
    return fieldEl
  },
  number: (entry, target) => {
  const fieldEl = document.createElement('label')
  fieldEl.className = 'field'

  const captionEl = document.createElement('span')
  captionEl.textContent = entry.caption

  const inputEl = document.createElement('input')
  inputEl.type = 'number'
  inputEl.value = target[entry.key]
  inputEl.addEventListener('input', () => {
    target[entry.key] = Number(inputEl.value)   // the type border, now written ONCE, ever
  })

  fieldEl.appendChild(captionEl)
  fieldEl.appendChild(inputEl)
  return fieldEl
},
lines: (entry, target) => {
  const fieldEl = document.createElement('label')
  fieldEl.className = 'field'

  const captionEl = document.createElement('span')
  captionEl.textContent = entry.caption

  const inputEl = document.createElement('textarea')
  inputEl.rows = 3
  inputEl.value = target[entry.key].join('\n')       // array → text, going in
  inputEl.addEventListener('input', () => {
    target[entry.key] = inputEl.value                // text → array, coming out
      .split('\n')
      .filter(line => line.trim() !== '')
  })

  fieldEl.appendChild(captionEl)
  fieldEl.appendChild(inputEl)
  return fieldEl
},
optionalNumber: (entry, target) => {
  // target here is { peek, ensure }: peek() returns the entry object or undefined
  // WITHOUT creating it; ensure() creates-if-missing and returns it.
  const fieldEl = document.createElement('label')
  fieldEl.className = 'field'

  const captionEl = document.createElement('span')
  captionEl.textContent = entry.caption

  const inputEl = document.createElement('input')
  inputEl.type = 'number'
  inputEl.value = target.peek()?.[entry.key] ?? ''   // absent entry or absent key → blank
  inputEl.addEventListener('input', () => {
    if (inputEl.value === '') {
      const obj = target.peek()
      if (obj) delete obj[entry.key]                 // empty = un-write, never 0
    } else {
      target.ensure()[entry.key] = Number(inputEl.value)
    }
  })

  fieldEl.appendChild(captionEl)
  fieldEl.appendChild(inputEl)
  return fieldEl
},
optionalText: (entry, target) => {
  // target is { peek, ensure } like optionalNumber — the holding object may not
  // exist until first edit. UNLIKE optionalNumber, emptying the field writes ""
  // rather than deleting the key (faithful to the longhand background border).
  const fieldEl = document.createElement('label')
  fieldEl.className = 'field'

  const captionEl = document.createElement('span')
  captionEl.textContent = entry.caption

  const inputEl = document.createElement('input')
  inputEl.type = 'text'
  inputEl.value = target.peek()?.[entry.key] ?? ''
  inputEl.addEventListener('input', () => {
    target.ensure()[entry.key] = inputEl.value
  })

  fieldEl.appendChild(captionEl)
  fieldEl.appendChild(inputEl)
  return fieldEl
}

}

const renderField = (entry, target) => {
  const builder = FIELD_BUILDERS[entry.type]
  if (!builder) {
    console.warn(`No builder for type "${entry.type}" (field: ${entry.key})`)
    return document.createTextNode('')
  }
  return builder(entry, target)
}

const editorEl = document.querySelector('#editor')
const statusEl = document.querySelector('#status')

export const renderSaveStatus = (text) => {
  statusEl.textContent = text
}

/* The editor now uses the same pattern as the game's view:
   wipe everything, rebuild everything from state.
   Content edits (typing in a field) mutate state directly through the
   bind-loop — no re-render needed, the input already shows what you typed.
   STRUCTURAL edits (add/remove item or group) mutate state and then call
   rerender(), so the screen is repainted from the new state. */

let currentActions = null // remembered at render time so rerender() keeps the same wiring

const rerender = () => render(currentActions)

export const render = (actions) => {
  currentActions = actions
  editorEl.innerHTML = ''

  renderTopBar(actions)
  renderPageSection()
  editorState.content.groups.forEach(group => renderGroupSection(group))
  renderAddGroupButton()
}

// ───────────────────────── top bar ─────────────────────────

const renderTopBar = (actions) => {
  const barEl = document.createElement('div')
  barEl.className = 'topbar'

  const saveButtonEl = document.createElement('button')
  saveButtonEl.className = 'save-button'
  saveButtonEl.textContent = 'Save all'
  saveButtonEl.addEventListener('click', () => actions.save())

  barEl.appendChild(saveButtonEl)
  editorEl.appendChild(barEl)
}

// ─────────────────── page-wide settings card ───────────────────
// One card holding everything that isn't a group: meta (content.json),
// the page theme (themes.json) and the budget (rules.json).
// Each field's caption says which file it lives in.

const renderPageSection = () => {
  const sectionEl = document.createElement('section')
  sectionEl.className = 'editor-section'

  const headingEl = document.createElement('h2')
  headingEl.textContent = 'Page'
  sectionEl.appendChild(headingEl)

  metaSchema.forEach(entry => {
    sectionEl.appendChild(renderField(entry, editorState.content.meta))
  })
  totalBudgetSchema.forEach(entry => {
    sectionEl.appendChild(renderField(entry, editorState.rules))
  })

  // ── page theme values (themes.json → applied as CSS custom properties by the game) ──

  pageThemeSchema.forEach(entry => {
    sectionEl.appendChild(renderField(entry, editorState.themes.page))
  })
  editorEl.appendChild(sectionEl)
}


// ───────────────────────── group cards ─────────────────────────

const renderGroupSection = (group) => {
  const sectionEl = document.createElement('section')
  sectionEl.className = 'editor-section'

  // header row: the remove button (the label is a walked field now)
  const headerEl = document.createElement('div')
  headerEl.className = 'group-header'

  const removeGroupBtn = document.createElement('button')
  removeGroupBtn.className = 'remove-button'
  removeGroupBtn.textContent = 'Remove group'
  removeGroupBtn.addEventListener('click', () => {
    editorState.content.groups = editorState.content.groups.filter(g => g !== group)
    // cascade: the group's UUID keys in the other two files go with it,
    // so no orphaned entries are left behind. `delete` removes a key from
    // an object entirely (and is a quiet no-op if the key isn't there).
    delete editorState.rules.groupRules[group.id]
    delete editorState.themes.groupThemes[group.id]
    rerender()
  })

  headerEl.appendChild(removeGroupBtn)
  sectionEl.appendChild(headerEl)

  // ── group content fields (content.json) ──
  groupSchema.forEach(entry => {
    sectionEl.appendChild(renderField(entry, group))
  })

  // ── group rules (rules.json) ──
  // Empty input = rule not set. That upholds the omission contract:
  // no min → 0, no max → Infinity, restored by the game's hydration.
  // So an empty field DELETES the key rather than writing 0.
  groupRulesSchema.forEach(entry => {
    sectionEl.appendChild(renderField(entry, {
      peek: () => editorState.rules.groupRules[group.id],
      ensure: () => (editorState.rules.groupRules[group.id] ??= {})
    }))
  })

  // ── group background (themes.json) — same peek/ensure cabinet as the rules ──
  groupThemeSchema.forEach(entry => {
    sectionEl.appendChild(renderField(entry, {
      peek: () => editorState.themes.groupThemes[group.id],
      ensure: () => (editorState.themes.groupThemes[group.id] ??= {})
    }))
  })

  // ── the items ──
  group.items.forEach(item => renderItemCard(group, item, sectionEl))

  const addItemBtn = document.createElement('button')
  addItemBtn.className = 'add-button'
  addItemBtn.textContent = '+ Add item'
  addItemBtn.addEventListener('click', () => {
    group.items.push({
      id: crypto.randomUUID(), // a new item is born with its forever-id
      name: 'New item',
      label: '',
      cost: 0,
      imageURL: '',
      traits: []
    })
    rerender()
  })
  sectionEl.appendChild(addItemBtn)

  editorEl.appendChild(sectionEl)
}

// ───────────────────────── item cards ─────────────────────────

const renderItemCard = (group, item, sectionEl) => {
  const cardEl = document.createElement('div')
  cardEl.className = 'item-card'

  itemSchema.forEach(entry => {
    cardEl.appendChild(renderField(entry, item))
  })

  const removeItemBtn = document.createElement('button')
  removeItemBtn.className = 'remove-button'
  removeItemBtn.textContent = 'Remove item'
  removeItemBtn.addEventListener('click', () => {
    group.items = group.items.filter(i => i !== item)
    rerender()
  })
  cardEl.appendChild(removeItemBtn)

  sectionEl.appendChild(cardEl)
}

// ───────────────────────── add group ─────────────────────────

const renderAddGroupButton = () => {
  const addGroupBtn = document.createElement('button')
  addGroupBtn.className = 'add-button add-button--group'
  addGroupBtn.textContent = '+ Add group'
  addGroupBtn.addEventListener('click', () => {
    editorState.content.groups.push({
      id: crypto.randomUUID(),
      label: 'New group',
      items: []
      // no rules/themes entries on purpose: the game's hydration defaults
      // (min 0, max Infinity, background null) cover absent entries,
      // and editing min/max/background above creates them when needed
    })
    rerender()
  })
  editorEl.appendChild(addGroupBtn)
}
