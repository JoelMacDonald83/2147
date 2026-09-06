import { editorState } from './state.js'
// CHANGED: cards reach every sheet by NAME through SHEETS (the same way a
// collection entry's `of` does), so the named imports shrink to the Page card's
// three plus contentSchema, the top of the group tree.
import { SHEETS, contentSchema, metaSchema, pageThemeSchema, totalBudgetSchema } from '/config/schema.js'
// CHANGED: flattenGroups is gone. The editor's cascade (cascadeDelete, below)
// descends through the sheets itself, so it works for ANY nested list, not
// just group.children. The engine keeps its own flattenGroups untouched.

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
},

// NEW: the collection builder. target[entry.key] is the REAL array in state
// (content.groups, group.items, group.children) — not a copy. The builder
// keeps hold of it: every card's Remove and the "+ Add" button edit that ONE
// array, so nobody has to be told which list a card lives in any more.
// Nesting costs nothing: a card walks its sheet, meets another collection
// entry, and lands back here.
collection: (entry, target) => {
  const list = target[entry.key]

  // a fragment is a bag of nodes: append the bag and its contents spill into
  // the parent as direct children, the bag itself vanishes. So the DOM looks
  // exactly as the hand-built version did — cards and add button straight
  // inside the card (or straight inside #editor, at the top level).
  const bagEl = document.createDocumentFragment()
  list.forEach(element => {
    bagEl.appendChild(buildCard(entry.of, element, list))
  })

  const addBtn = document.createElement('button')
  addBtn.className = 'add-button'
  addBtn.textContent = `+ Add ${entry.of}`           // "+ Add item", "+ Add group"
  addBtn.addEventListener('click', () => {
    list.push(newborn(entry.of))                     // born from the sheet, into MY list
    rerender()
  })
  bagEl.appendChild(addBtn)
  return bagEl
},

// NEW: fields that belong to this element but are STORED in a side cabinet,
// filed under the element's id. target is the ELEMENT itself (we need its id).
// The cabinet slot may not exist yet, so the inner fields get the same
// { peek, ensure } target optionalNumber/optionalText already expect:
// peek looks and never creates (rendering must not change what gets saved);
// ensure creates on first edit only — it is only ever called from an input
// handler. This is the same pair the group card used to write by hand, with
// the cabinet address now coming from the sheet.
attachment: (entry, target) => {
  const slot = {
    peek:   () => cabinetOf(entry)[target.id],
    ensure: () => (cabinetOf(entry)[target.id] ??= {})
  }
  const bagEl = document.createDocumentFragment()
  SHEETS[entry.of].forEach(inner => {
    bagEl.appendChild(renderField(inner, slot))
  })
  return bagEl
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
   rerender(), so the screen is repainted from the new state.
   Rule of the file: structural edits change the array IN PLACE (push/splice)
   and then rerender. Never replace a list (group.items = group.items.filter(…))
   — the collection builder is holding the original array. */

let currentActions = null // remembered at render time so rerender() keeps the same wiring

const rerender = () => render(currentActions)

export const render = (actions) => {
  currentActions = actions
  editorEl.innerHTML = ''

  renderTopBar(actions)
  renderPageSection()
  // CHANGED: no hand-built group cards. The whole group tree is ONE walk of
  // content's sheet: groups is a collection of "group", and group's own sheet
  // holds a collection of "group" — the nesting lives in the data, not here.
  // The big "+ Add group" at the bottom comes from the same collection builder
  // as every other add button.
  contentSchema.forEach(entry => {
    editorEl.appendChild(renderField(entry, editorState.content))
  })
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
// The comment above each walk says which file its fields come from.

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


// ───────────────────────── side cabinets ─────────────────────────

// NEW: the cabinet an attachment entry points at: <file>.<cabinet>, e.g.
// rules.groupRules. schema.js only knows the file's NAME; this is the ONE line
// that turns that name into the editor's object (editorState is keyed by the
// same three file names). The attachment builder and cascadeDelete both ask here.
// The cabinet object itself must already be in the loaded file — a missing one
// is a border (migration) problem, never something to create while drawing.
const cabinetOf = (entry) => editorState[entry.file][entry.cabinet]

// NEW: when an element leaves, everything the side cabinets hold about it
// leaves too — and so does everything they hold about every element INSIDE
// it, or rules.json/themes.json would keep orphan UUIDs forever. The sheet is
// the map: an attachment entry says which cabinet to clear, a collection entry
// says where the descendants are. For a group: clear its rules and theme
// slots, then repeat for every item (items have neither, so that stops) and
// for every child (a group, so it repeats all of this). Replaces the old
// flattenGroups([group]) loop, and covers any future sheet with cabinets or
// nesting without touching this function.
const cascadeDelete = (sheetName, element) => {
  SHEETS[sheetName].forEach(entry => {
    if (entry.type === 'attachment') {
      delete cabinetOf(entry)[element.id]
    }
    if (entry.type === 'collection') {
      element[entry.key].forEach(child => cascadeDelete(entry.of, child))
    }
  })
}

// ───────────────────────── newborns ─────────────────────────

// NEW: a brand-new element, born from its sheet: a forever-id first, then each
// entry's default in sheet order — the same key order the old literals had and
// the saved files have. Two kinds of entry are skipped: attachment entries
// (no key — nothing is stored in the element) and entries whose default is
// null (the sheet rule: null = key not written at birth).
// structuredClone hands back a SEPARATE COPY of each default. Arrays are
// references: without the copy every newborn group would share ONE items
// array, and adding an item to group A would show up in group B.
// (No rules/themes slots are born on purpose: the game's hydration defaults
// cover absent entries, and editing min/max/background creates them — ensure.)
const newborn = (sheetName) => {
  const born = { id: crypto.randomUUID() }
  SHEETS[sheetName].forEach(entry => {
    if (entry.key === undefined) return                // attachment: nothing lives in the element
    if (entry.default === null) return                 // sheet rule: null = not written at birth
    born[entry.key] = structuredClone(entry.default)   // a FRESH copy, never the sheet's own []
  })
  return born
}

// ───────────────────────── cards ─────────────────────────

// NEW: how a card of each sheet dresses. The sheet decides what goes IN a card;
// this table decides what the card looks like. A sheet without a row gets the
// plain item look, so a brand-new sheet renders before anyone styles it.
const CARD_CLASS = {
  group: 'editor-section',   // the big white card; nested ones get the left rail via CSS
  item:  'item-card'         // the small beige card
}

// CHANGED: buildGroupCard and renderItemCard are gone. ONE function builds
// every card and RETURNS it: a header row holding Remove, then the element's
// sheet walked top to bottom — scalars, cabinets, lists, in sheet order.
// list = the array the collection builder read this element from. The builder
// owns it and lends it ONE hop so Remove can splice it; it is never passed
// further down (a nested list is re-read from element[entry.key] by the next
// collection entry). That is what replaces the old parentList threading.
const buildCard = (sheetName, element, list) => {
  const cardEl = document.createElement('section')
  cardEl.className = CARD_CLASS[sheetName] ?? 'item-card'

  const headerEl = document.createElement('div')
  headerEl.className = 'group-header'

  const removeBtn = document.createElement('button')
  removeBtn.className = 'remove-button'
  removeBtn.textContent = `Remove ${sheetName}`       // "Remove group", "Remove item"
  removeBtn.addEventListener('click', () => {
    const at = list.indexOf(element)
    if (at !== -1) list.splice(at, 1)                  // out of the list that owns it, in place
    cascadeDelete(sheetName, element)                  // and out of every cabinet, subtree included
    rerender()
  })

  headerEl.appendChild(removeBtn)
  cardEl.appendChild(headerEl)

  // the card IS the sheet: every entry goes through renderField, so a
  // collection entry lands in the collection builder (which calls buildCard
  // again for each element — that loop is the recursion) and an attachment
  // entry lands in the attachment builder.
  SHEETS[sheetName].forEach(entry => {
    cardEl.appendChild(renderField(entry, element))
  })

  return cardEl
}
