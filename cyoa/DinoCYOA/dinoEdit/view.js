import { editorState, buildSheets } from './state.js'
// CHANGED: SHEETS is no longer imported from schema.js. Part of the phonebook
// depends on the loaded TYPES (one sheet per type), so state.js builds it —
// see buildSheets — and render() asks for a fresh one before every paint.
// The named imports are the Page card's three plus the top of each tree:
// contentSchema (the groups) and typesSchema (the types).
import { contentSchema, typesSchema, metaSchema, pageThemeSchema, totalBudgetSchema } from '/config/schema.js'
// CHANGED: flattenGroups is gone. The editor's cascade (cascadeDelete, below)
// descends through the sheets itself, so it works for ANY nested list, not
// just group.children. The engine keeps its own flattenGroups untouched.

// NEW: the phonebook for THIS paint. render() refills it first thing, so every
// card, newborn and cascade below reads the same, current sheets. It is a
// `let` for exactly one reason: the sheets for things change when types do.
let SHEETS = {}

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
    // CHANGED: a thing may lack a field its type gained later. Show the
    // kind's default until the author types — looking writes nothing.
    inputEl.value = target[entry.key] ?? entry.default
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
  inputEl.value = target[entry.key] ?? entry.default   // CHANGED: same as text — missing key → the kind's default
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
  // CHANGED: the value may be missing (a thing older than this field) or a
  // string (a field whose kind used to be text). Either way, show the
  // default — and write only when the author types, so looking changes nothing.
  const lines = target[entry.key]
  inputEl.value = (Array.isArray(lines) ? lines : entry.default).join('\n')   // array → text, going in
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

// NEW: a pick from a list. The options are either written on the sheet
// (entry.options) or, when they are DATA, named by entry.optionsFrom and
// looked up in OPTION_SOURCES. The stored value is the option's value.
// A pick is a whole edit in itself (unlike typing), and it can change what
// OTHER cards show — a field's kind changes the box every thing of that
// type gets — so a pick repaints.
choice: (entry, target) => {
  const fieldEl = document.createElement('label')
  fieldEl.className = 'field'

  const captionEl = document.createElement('span')
  captionEl.textContent = entry.caption

  const selectEl = document.createElement('select')
  const options = entry.options ?? OPTION_SOURCES[entry.optionsFrom]()
  options.forEach(option => {
    const optionEl = document.createElement('option')
    optionEl.value = option.value
    optionEl.textContent = option.label
    selectEl.appendChild(optionEl)
  })
  selectEl.value = target[entry.key] ?? entry.default
  selectEl.addEventListener('change', () => {
    target[entry.key] = selectEl.value
    rerender()
  })

  fieldEl.appendChild(captionEl)
  fieldEl.appendChild(selectEl)
  return fieldEl
},

// NEW: the collection builder. target[entry.key] is the REAL array in state
// (content.groups, group.children, types.types, a type's bucket of things) —
// not a copy. The builder keeps hold of it: every card's Remove and the
// "+ Add" button edit that ONE array, so nobody has to be told which list a
// card lives in any more.
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
  addBtn.textContent = `+ Add ${sheetLabel(entry.of)}`   // CHANGED: "+ Add group", "+ Add field", "+ Add Dino" — never a type's id
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

// NEW: where a choice gets its options when they are DATA, not a fixed list.
// "types" = every loaded type, read at draw time (so a type born a moment ago
// is already on every group's picker), plus a blank first row for "shows
// nothing" — its value "" is groupSchema's default for displayType.
const OPTION_SOURCES = {
  types: () => [
    { value: '', label: '— none —' },
    ...editorState.types.types.map(type => ({ value: type.id, label: type.label }))
  ]
}

// NEW: what to call an element of a sheet on a button. Most sheets are named
// by their phonebook key ("group", "type"); NOUNS spells out the one that
// would read oddly; a type's sheet is filed under the type's id, so its
// label is shown instead.
const NOUNS = { fieldDef: 'field' }
const sheetLabel = (sheetName) =>
  NOUNS[sheetName] ?? editorState.types.types.find(type => type.id === sheetName)?.label ?? sheetName

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
   STRUCTURAL edits (add/remove a card, a pick in a drop-down) mutate state
   and then call rerender(), so the screen is repainted from the new state.
   Rule of the file: structural edits change the array IN PLACE (push/splice)
   and then rerender. Never replace a list (group.children = group.children.filter(…))
   — the collection builder is holding the original array.
   Rule two: rendering never writes state — with ONE exception, marked in
   renderThingsLibrary. A file that was only looked at is saved back unchanged. */

let currentActions = null // remembered at render time so rerender() keeps the same wiring

const rerender = () => render(currentActions)

export const render = (actions) => {
  currentActions = actions
  SHEETS = buildSheets()           // NEW: fresh phonebook — types may have changed since the last paint
  editorEl.innerHTML = ''

  renderTopBar(actions)
  renderPageSection()
  // NEW: three walls, in the order the data depends on itself: first say what
  // KINDS of things exist, then fill in the things, then arrange the groups
  // that show them. Each wall is one walk of a sheet — typesSchema over
  // types.json, contentSchema over content.json — except the things wall,
  // which has no fixed sheet: it is one card per loaded type.
  renderWallHeading('Types')
  typesSchema.forEach(entry => {
    editorEl.appendChild(renderField(entry, editorState.types))
  })
  renderWallHeading('Things')
  renderThingsLibrary()
  renderWallHeading('Groups')
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

// ───────────────────────── walls ─────────────────────────

// NEW: a plain heading straight on the wall, between the big cards
const renderWallHeading = (text) => {
  const headingEl = document.createElement('h2')
  headingEl.className = 'wall-heading'
  headingEl.textContent = text
  editorEl.appendChild(headingEl)
}

// NEW: the things library — one card per type, holding that type's bucket as
// a collection. The entry is built on the spot because its `of` (the type's
// sheet) is only known now; the target is the buckets object itself, so the
// collection builder owns the REAL array in state, exactly as it does for
// groups. "+ Add Dino" pushes a newborn into the bucket; Remove splices it.
const renderThingsLibrary = () => {
  if (editorState.types.types.length === 0) {
    const hintEl = document.createElement('p')
    hintEl.className = 'wall-hint'
    hintEl.textContent = 'No types yet — add one above.'
    editorEl.appendChild(hintEl)
  }
  editorState.types.types.forEach(type => {
    // A type born this session has no bucket yet. Giving it an empty one here
    // is the ONE write render() is allowed to make: it repairs an invariant
    // (every type has a bucket), never touches anything an author wrote, and
    // migrated data always arrives with its buckets, so a no-edit save stays
    // byte-identical.
    editorState.things.things[type.id] ??= []

    const cardEl = document.createElement('section')
    cardEl.className = 'editor-section'
    const headingEl = document.createElement('h2')
    headingEl.textContent = type.label
    cardEl.appendChild(headingEl)

    const entry = { key: type.id, caption: type.label, type: 'collection', of: type.id }
    cardEl.appendChild(renderField(entry, editorState.things.things))
    editorEl.appendChild(cardEl)
  })
}


// ───────────────────────── side cabinets ─────────────────────────

// NEW: the cabinet an attachment entry points at: <file>.<cabinet>, e.g.
// rules.groupRules. schema.js only knows the file's NAME; this is the ONE line
// that turns that name into the editor's object (editorState is keyed by the
// same file names). The attachment builder and cascadeDelete both ask here.
// The cabinet object itself must already be in the loaded file — a missing one
// is a border (migration) problem, never something to create while drawing.
const cabinetOf = (entry) => editorState[entry.file][entry.cabinet]

// NEW: when an element leaves, everything the side cabinets hold about it
// leaves too — and so does everything they hold about every element INSIDE
// it, or rules.json/themes.json would keep orphan UUIDs forever. The sheet is
// the map: an attachment entry says which cabinet to clear, a collection entry
// says where the descendants are. For a group: clear its rules and theme
// slots, then repeat for every child (a group, so it repeats all of this).
// A type walks its fields (no cabinets, so that stops); a thing has neither.
// Replaces the old flattenGroups([group]) loop, and covers any future sheet
// with cabinets or nesting without touching this function.
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

// NEW: what ELSE must go when an element of a sheet leaves, beyond its
// cabinets (cascadeDelete handles those) — what OTHER files say about it.
// Only a type needs one today: its bucket of things goes, and every group
// that showed it — at any depth — now shows nothing, or content.json would
// point at a type that no longer exists. Removing a thing needs nothing:
// groups show a TYPE, never one thing.
const REMOVE_HOOKS = {
  type: (type) => {
    delete editorState.things.things[type.id]
    forgetType(editorState.content.groups, type.id)
  }
}

// the walk down the group tree, in cascadeDelete's style: this level, then each child
const forgetType = (groups, typeId) => {
  groups.forEach(group => {
    if (group.displayType === typeId) group.displayType = ''
    forgetType(group.children, typeId)
  })
}

// ───────────────────────── newborns ─────────────────────────

// NEW: a brand-new element, born from its sheet: a forever-id first, then each
// entry's default in sheet order — the same key order the old literals had and
// the saved files have. Two kinds of entry are skipped: attachment entries
// (no key — nothing is stored in the element) and entries whose default is
// null (the sheet rule: null = key not written at birth).
// structuredClone hands back a SEPARATE COPY of each default. Arrays are
// references: without the copy every newborn group would share ONE children
// array, and adding a subgroup to group A would show up in group B.
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
  type:  'editor-section'    // CHANGED: a type is a big white card too; no `item` row any more —
                             // field definitions and things fall through to the beige look
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
  removeBtn.textContent = `Remove ${sheetLabel(sheetName)}`   // CHANGED: "Remove group", "Remove field", "Remove Dino"
  removeBtn.addEventListener('click', () => {
    const at = list.indexOf(element)
    if (at !== -1) list.splice(at, 1)                  // out of the list that owns it, in place
    cascadeDelete(sheetName, element)                  // and out of every cabinet, subtree included
    REMOVE_HOOKS[sheetName]?.(element)                 // NEW: and out of every OTHER file that pointed at it
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
