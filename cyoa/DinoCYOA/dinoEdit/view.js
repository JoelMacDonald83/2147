import { editorState } from './state.js'

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

  // The full bind-loop pattern, written out once — every field below repeats it:
  // window shows the throne (input.value = state), keystroke updates the throne.
  const pageTitleField = document.createElement('label')
  pageTitleField.className = 'field'
  const pageTitleCaption = document.createElement('span')
  pageTitleCaption.textContent = 'Page title (browser tab) — content.json'
  const pageTitleInput = document.createElement('input')
  pageTitleInput.type = 'text'
  pageTitleInput.value = editorState.content.meta.pageTitle
  pageTitleInput.addEventListener('input', () => {
    editorState.content.meta.pageTitle = pageTitleInput.value
  })
  pageTitleField.appendChild(pageTitleCaption)
  pageTitleField.appendChild(pageTitleInput)
  sectionEl.appendChild(pageTitleField)

  const heroTitleField = document.createElement('label')
  heroTitleField.className = 'field'
  const heroTitleCaption = document.createElement('span')
  heroTitleCaption.textContent = 'Hero title — content.json'
  const heroTitleInput = document.createElement('input')
  heroTitleInput.type = 'text'
  heroTitleInput.value = editorState.content.meta.heroTitle
  heroTitleInput.addEventListener('input', () => {
    editorState.content.meta.heroTitle = heroTitleInput.value
  })
  heroTitleField.appendChild(heroTitleCaption)
  heroTitleField.appendChild(heroTitleInput)
  sectionEl.appendChild(heroTitleField)

  const budgetField = document.createElement('label')
  budgetField.className = 'field'
  const budgetCaption = document.createElement('span')
  budgetCaption.textContent = 'Total budget — rules.json'
  const budgetInput = document.createElement('input')
  budgetInput.type = 'number'
  budgetInput.value = editorState.rules.totalBudget
  budgetInput.addEventListener('input', () => {
    editorState.rules.totalBudget = Number(budgetInput.value) // type border: string → number
  })
  budgetField.appendChild(budgetCaption)
  budgetField.appendChild(budgetInput)
  sectionEl.appendChild(budgetField)

  // ── page theme values (themes.json → applied as CSS custom properties by the game) ──

  const bodyBgField = document.createElement('label')
  bodyBgField.className = 'field'
  const bodyBgCaption = document.createElement('span')
  bodyBgCaption.textContent = 'Body background — themes.json'
  const bodyBgInput = document.createElement('input')
  bodyBgInput.type = 'text'
  bodyBgInput.value = editorState.themes.page.bodyBackground
  bodyBgInput.addEventListener('input', () => {
    editorState.themes.page.bodyBackground = bodyBgInput.value
  })
  bodyBgField.appendChild(bodyBgCaption)
  bodyBgField.appendChild(bodyBgInput)
  sectionEl.appendChild(bodyBgField)

  const fontField = document.createElement('label')
  fontField.className = 'field'
  const fontCaption = document.createElement('span')
  fontCaption.textContent = 'Font family — themes.json'
  const fontInput = document.createElement('input')
  fontInput.type = 'text'
  fontInput.value = editorState.themes.page.fontFamily
  fontInput.addEventListener('input', () => {
    editorState.themes.page.fontFamily = fontInput.value
  })
  fontField.appendChild(fontCaption)
  fontField.appendChild(fontInput)
  sectionEl.appendChild(fontField)

  const heroImageField = document.createElement('label')
  heroImageField.className = 'field'
  const heroImageCaption = document.createElement('span')
  heroImageCaption.textContent = 'Hero image filename — themes.json'
  const heroImageInput = document.createElement('input')
  heroImageInput.type = 'text'
  heroImageInput.value = editorState.themes.page.heroImage
  heroImageInput.addEventListener('input', () => {
    editorState.themes.page.heroImage = heroImageInput.value
  })
  heroImageField.appendChild(heroImageCaption)
  heroImageField.appendChild(heroImageInput)
  sectionEl.appendChild(heroImageField)

  const statusBgField = document.createElement('label')
  statusBgField.className = 'field'
  const statusBgCaption = document.createElement('span')
  statusBgCaption.textContent = 'Status bar background — themes.json'
  const statusBgInput = document.createElement('input')
  statusBgInput.type = 'text'
  statusBgInput.value = editorState.themes.page.statusBackground
  statusBgInput.addEventListener('input', () => {
    editorState.themes.page.statusBackground = statusBgInput.value
  })
  statusBgField.appendChild(statusBgCaption)
  statusBgField.appendChild(statusBgInput)
  sectionEl.appendChild(statusBgField)

  const statusColorField = document.createElement('label')
  statusColorField.className = 'field'
  const statusColorCaption = document.createElement('span')
  statusColorCaption.textContent = 'Status bar text color — themes.json'
  const statusColorInput = document.createElement('input')
  statusColorInput.type = 'text'
  statusColorInput.value = editorState.themes.page.statusColor
  statusColorInput.addEventListener('input', () => {
    editorState.themes.page.statusColor = statusColorInput.value
  })
  statusColorField.appendChild(statusColorCaption)
  statusColorField.appendChild(statusColorInput)
  sectionEl.appendChild(statusColorField)

  editorEl.appendChild(sectionEl)
}

// ───────────────────────── group cards ─────────────────────────

const renderGroupSection = (group) => {
  const sectionEl = document.createElement('section')
  sectionEl.className = 'editor-section'

  // header row: editable group label + remove button
  const headerEl = document.createElement('div')
  headerEl.className = 'group-header'

  const labelInput = document.createElement('input')
  labelInput.className = 'group-label-input'
  labelInput.type = 'text'
  labelInput.value = group.label
  labelInput.addEventListener('input', () => {
    group.label = labelInput.value
  })

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

  headerEl.appendChild(labelInput)
  headerEl.appendChild(removeGroupBtn)
  sectionEl.appendChild(headerEl)

  // ── group rules (rules.json) ──
  // Empty input = rule not set. That upholds the omission contract:
  // no min → 0, no max → Infinity, restored by the game's hydration.
  // So an empty field DELETES the key rather than writing 0.
  const rulesRowEl = document.createElement('div')
  rulesRowEl.className = 'inline-fields'

  const minField = document.createElement('label')
  minField.className = 'field'
  const minCaption = document.createElement('span')
  minCaption.textContent = 'Min picks — rules.json (empty = 0)'
  const minInput = document.createElement('input')
  minInput.type = 'number'
  minInput.value = editorState.rules.groupRules[group.id]?.min ?? ''
  minInput.addEventListener('input', () => {
    editorState.rules.groupRules[group.id] ??= {} // create the entry the first time (assign only if missing)
    if (minInput.value === '') {
      delete editorState.rules.groupRules[group.id].min
    } else {
      editorState.rules.groupRules[group.id].min = Number(minInput.value)
    }
  })
  minField.appendChild(minCaption)
  minField.appendChild(minInput)

  const maxField = document.createElement('label')
  maxField.className = 'field'
  const maxCaption = document.createElement('span')
  maxCaption.textContent = 'Max picks — rules.json (empty = unlimited)'
  const maxInput = document.createElement('input')
  maxInput.type = 'number'
  maxInput.value = editorState.rules.groupRules[group.id]?.max ?? ''
  maxInput.addEventListener('input', () => {
    editorState.rules.groupRules[group.id] ??= {}
    if (maxInput.value === '') {
      delete editorState.rules.groupRules[group.id].max
    } else {
      editorState.rules.groupRules[group.id].max = Number(maxInput.value)
    }
  })
  maxField.appendChild(maxCaption)
  maxField.appendChild(maxInput)

  rulesRowEl.appendChild(minField)
  rulesRowEl.appendChild(maxField)
  sectionEl.appendChild(rulesRowEl)

  // ── group background (themes.json) ──
  const bgField = document.createElement('label')
  bgField.className = 'field'
  const bgCaption = document.createElement('span')
  bgCaption.textContent = 'Background (any CSS image value) — themes.json'
  const bgInput = document.createElement('input')
  bgInput.type = 'text'
  bgInput.value = editorState.themes.groupThemes[group.id]?.background ?? ''
  bgInput.addEventListener('input', () => {
    editorState.themes.groupThemes[group.id] ??= {} // a brand-new group has no entry until you style it
    editorState.themes.groupThemes[group.id].background = bgInput.value
  })
  bgField.appendChild(bgCaption)
  bgField.appendChild(bgInput)
  sectionEl.appendChild(bgField)

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

  // every handler below closes over THIS item — the reference is the targeting system
  const rowEl = document.createElement('div')
  rowEl.className = 'inline-fields'

  const nameField = document.createElement('label')
  nameField.className = 'field'
  const nameCaption = document.createElement('span')
  nameCaption.textContent = 'Name'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = item.name
  nameInput.addEventListener('input', () => {
    item.name = nameInput.value
  })
  nameField.appendChild(nameCaption)
  nameField.appendChild(nameInput)

  const labelField = document.createElement('label')
  labelField.className = 'field'
  const labelCaption = document.createElement('span')
  labelCaption.textContent = 'Label'
  const labelInput = document.createElement('input')
  labelInput.type = 'text'
  labelInput.value = item.label
  labelInput.addEventListener('input', () => {
    item.label = labelInput.value
  })
  labelField.appendChild(labelCaption)
  labelField.appendChild(labelInput)

  const costField = document.createElement('label')
  costField.className = 'field field--small'
  const costCaption = document.createElement('span')
  costCaption.textContent = 'Cost'
  const costInput = document.createElement('input')
  costInput.type = 'number'
  costInput.value = item.cost
  costInput.addEventListener('input', () => {
    item.cost = Number(costInput.value) // type border: string → number
  })
  costField.appendChild(costCaption)
  costField.appendChild(costInput)

  const imageField = document.createElement('label')
  imageField.className = 'field'
  const imageCaption = document.createElement('span')
  imageCaption.textContent = 'Image filename'
  const imageInput = document.createElement('input')
  imageInput.type = 'text'
  imageInput.value = item.imageURL
  imageInput.addEventListener('input', () => {
    item.imageURL = imageInput.value
  })
  imageField.appendChild(imageCaption)
  imageField.appendChild(imageInput)

  rowEl.appendChild(nameField)
  rowEl.appendChild(labelField)
  rowEl.appendChild(costField)
  rowEl.appendChild(imageField)
  cardEl.appendChild(rowEl)

  const traitsField = document.createElement('label')
  traitsField.className = 'field'
  const traitsCaption = document.createElement('span')
  traitsCaption.textContent = 'Traits (one per line)'
  const traitsInput = document.createElement('textarea')
  traitsInput.rows = 3
  traitsInput.value = item.traits.join('\n')             // array → text, going in
  traitsInput.addEventListener('input', () => {
    item.traits = traitsInput.value                      // text → array, coming out
      .split('\n')
      .filter(trait => trait.trim() !== '')
  })
  traitsField.appendChild(traitsCaption)
  traitsField.appendChild(traitsInput)
  cardEl.appendChild(traitsField)

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
