import { editorState, buildSheets } from './state.js'
// SHEETS is not imported from schema.js. Part of the phonebook depends on the
// loaded TYPES (one sheet per type), so state.js builds it — see buildSheets —
// and render() asks for a fresh one before every paint.
// The named imports are the Page card's three, the top of each tree
// (contentSchema for the rows, typesSchema for the types), and the two
// field lookups the query builder needs.
import { contentSchema, typesSchema, metaSchema, pageThemeSchema, totalBudgetSchema, queryableFields, fieldById } from '/config/schema.js'
// NEW: the shared logic under engine/config/ — the same functions the game
// runs, so what the author reads here is what the player gets there.
// query.js answers a row's question; visibility.js says when a row shows;
// references.js walks the row tree and repairs it when something is removed.
import { OPERATORS, operatorOf, WHERE_VALUE_DEFAULT, checkWhere, filterThings, valuesOf } from '/config/query.js'
import { SHOW_WHEN_KINDS, checkShowWhen, deadRows, idsBelow } from '/config/visibility.js'
import { rowsIn, forgetType, forgetField, forgetThing, forgetRow } from '/config/references.js'
// NEW: the screen's own memory — tab, rail type, open cards. See uiState.js.
import { uiState, TABS, hashFor } from './uiState.js'

// The phonebook for THIS paint. render() refills it first thing, so every
// card, newborn and cascade below reads the same, current sheets. It is a
// `let` for exactly one reason: the sheets for things change when types do.
let SHEETS = {}

// ───────────────────────── small lookups ─────────────────────────

// NEW: the three questions half of this file asks. A type by its id (or
// undefined — a stale id from a hand-edited file), a type's bucket of things,
// and the "n things" / "1 field" wording every one-liner uses.
const typeById = (id) => editorState.types.types.find(type => type.id === id)
// repairBuckets gives every type a bucket at the top of each paint, so the
// `?? []` is a formality there; it is kept so the helper stays total wherever
// it is called from.
const bucketOf = (type) => editorState.things.things[type.id] ?? []
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`

// NEW: a <select> from options, with the stored value selected. A select must
// never show a value the file does not hold: a stored value that is not among
// the options is appended, labelled — the screen tells the truth and looking
// writes nothing. Option values are compared as strings (a select's values are).
const withCurrent = (options, current, note = 'no longer present') =>
  options.some(option => String(option.value) === String(current)) ? options : [...options, { value: current, label: `${current} (${note})` }]

// NEW: the <select> the two condition builders draw. Unlike the choice
// builder it is not a labelled .field — the caller lays several of these in
// one line. An option may carry `disabled` (and a `title` saying why) so a
// kind nobody can complete yet stays visible but unpickable.
const selectOf = (options, current, onChange) => {
  const selectEl = document.createElement('select')
  options.forEach(option => {
    const optionEl = document.createElement('option')
    optionEl.value = option.value
    optionEl.textContent = option.label
    if (option.disabled) optionEl.disabled = true
    if (option.title) optionEl.title = option.title
    selectEl.appendChild(optionEl)
  })
  selectEl.value = String(current)
  selectEl.addEventListener('change', () => onChange(selectEl.value))
  return selectEl
}

// NEW: one line of the two condition builders: a small caption, then whatever
// selects the caller appends. A div, not a label — a label would bind to one
// control, and this line holds several.
const conditionRow = (caption) => {
  const rowEl = document.createElement('div')
  rowEl.className = 'condition-row'
  rowEl.appendChild(captionSpan(caption))
  return rowEl
}
const captionSpan = (text) => {
  const spanEl = document.createElement('span')
  spanEl.className = 'field-caption'
  spanEl.textContent = text
  return spanEl
}

// ───────────────────────── field builders ─────────────────────────

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
    // a thing may lack a field its type gained later. Show the kind's
    // default until the author types — looking writes nothing.
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
  inputEl.value = target[entry.key] ?? entry.default   // same as text — missing key → the kind's default
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
  // the value may be missing (a thing older than this field) or a string
  // (a field whose kind used to be text). Either way, show the default — and
  // write only when the author types, so looking changes nothing.
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

// a pick from a list. The options are either written on the sheet
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
    CHANGE_HOOKS[entry.afterChange]?.(target)   // NEW: a pick can invalidate what OTHER rows say about this element (see CHANGE_HOOKS)
    rerender()
  })

  fieldEl.appendChild(captionEl)
  fieldEl.appendChild(selectEl)
  return fieldEl
},

// NEW: the row's question, as three dropdowns: which TYPE it shows, and an
// optional condition — which FIELD, which OPERATOR, which VALUE. target is the
// row; query is the REAL { type, where } object (newborn and the migration
// guarantee it exists). Every change repaints: a pick is a whole edit (the
// choice rule), and the row's one-liner count changes with it.
// Values come only from dropdowns of values that exist in the bucket, so a
// condition can never carry a typo — "cost ≤ 3" is built by picking 3 from
// the costs things actually have.
query: (entry, target) => {
  const query = target[entry.key]
  const rowEl = conditionRow(entry.caption)

  // 1. the type. Changing it drops the condition: a condition names one of
  //    THAT type's fields, so it cannot survive a type change.
  rowEl.appendChild(selectOf(withCurrent(OPTION_SOURCES.types(), query.type, 'no longer exists'), query.type, value => {
    query.type = value
    query.where = null
    rerender()
  }))
  const type = typeById(query.type)
  if (!type) return rowEl   // "" (shows nothing yet) or a stale id — nothing below it can be built

  // 2. the field, or "every thing". A new condition is born complete: the
  //    kind's first operator and the first value the bucket offers (or the
  //    kind's empty condition value when the bucket offers none).
  rowEl.appendChild(captionSpan('where'))
  rowEl.appendChild(selectOf(withCurrent(OPTION_SOURCES.fieldsOf(type), query.where?.field ?? '', 'no longer exists'), query.where?.field ?? '', value => {
    if (value === '') {
      query.where = null
    } else {
      const field = fieldById(type, value)
      query.where = { field: value, op: OPERATORS[field.type][0].value, value: firstValue(type, field) }
    }
    rerender()
  }))
  if (query.where === null) return rowEl
  const field = fieldById(type, query.where.field)
  if (!field) return rowEl   // the field select shows "(no longer exists)"; the header carries checkWhere's message

  // 3. operator and value. The value select hands back a string (every
  //    <select> does); a number field's value is Number()ed HERE, the one
  //    place a condition value is typed — exactly like the number builder.
  rowEl.appendChild(selectOf(withCurrent(OPTION_SOURCES.operatorsFor(field.type), query.where.op, 'not valid for this kind'), query.where.op, value => {
    query.where.op = value
    rerender()
  }))
  rowEl.appendChild(selectOf(withCurrent(OPTION_SOURCES.valuesFor(type, field), query.where.value, 'no thing has this'), query.where.value, value => {
    query.where.value = field.type === 'number' ? Number(value) : value
    rerender()
  }))
  return rowEl
},

// NEW: the row's gate, as a kind dropdown and — for the two kinds that name
// something — a second dropdown naming it. target is the row. A kind change
// REPLACES target.showWhen with a fresh object: the in-place rule protects
// arrays a collection builder holds across a paint; nobody holds showWhen
// across a paint, so a new object is safe (references.js replaces it too).
showWhen: (entry, target) => {
  const gate = target[entry.key]
  const rowEl = conditionRow(entry.caption)

  // a kind nobody could complete is shown but disabled: "a thing is picked"
  // with no things in the library, "anything in a row" with no OTHER row.
  const kinds = SHOW_WHEN_KINDS.map(kind => {
    if (kind.value === 'thingPicked' && OPTION_SOURCES.things().length === 0) return { ...kind, disabled: true, title: 'no things yet' }
    if (kind.value === 'anyInRow' && OPTION_SOURCES.rows(target).length === 0) return { ...kind, disabled: true, title: 'no other rows yet' }
    return kind
  })
  rowEl.appendChild(selectOf(withCurrent(kinds, gate.kind, 'unknown kind'), gate.kind, value => {
    target[entry.key] = NEWBORN_GATES[value](target)
    rerender()
  }))

  // the picker for this kind, if the kind has one. An unknown kind (a
  // hand-edited file) shows in the select as "(unknown kind)" and draws no picker.
  const picker = GATE_PICKERS[gate.kind]
  if (picker) rowEl.appendChild(picker(gate, target))
  return rowEl
},

// the collection builder. target[entry.key] is the REAL array in state
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
  addBtn.textContent = `+ Add ${sheetLabel(entry.of)}`   // "+ Add row", "+ Add field", "+ Add Dino" — never a type's id
  addBtn.addEventListener('click', () => {
    const born = newborn(entry.of)                   // born from the sheet, into MY list
    list.push(born)
    uiState.expanded.add(born.id)                    // NEW: a newborn opens ready to edit
    rerender()
  })
  bagEl.appendChild(addBtn)
  return bagEl
},

// fields that belong to this element but are STORED in a side cabinet,
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

// NEW: the value a NEW condition starts with — the first value the bucket
// offers for this field, or, when no thing has one yet, the kind's empty
// condition value (WHERE_VALUE_DEFAULT, not FIELD_DEFAULTS: a lines condition
// names ONE line, a string, never the [] a thing holds).
const firstValue = (type, field) => valuesOf(bucketOf(type), field)[0] ?? WHERE_VALUE_DEFAULT[field.type]

// NEW: what a gate looks like the moment its kind is picked — complete, never
// half-built. The [0] is safe: the kind select disables thingPicked/anyInRow
// while their lists are empty, so a chosen kind always has a first option.
const NEWBORN_GATES = {
  always:      ()     => ({ kind: 'always' }),
  thingPicked: ()     => ({ kind: 'thingPicked', thing: OPTION_SOURCES.things()[0].value }),
  anyInRow:    (self) => ({ kind: 'anyInRow',    row:   OPTION_SOURCES.rows(self)[0].value })
}

// NEW: the second dropdown of a gate, dispatched by kind — like builders are
// dispatched by type. `always` has none. A missing thing or row is appended
// to the select as "(missing)" rather than silently swapped for another.
const GATE_PICKERS = {
  thingPicked: (gate)       => selectOf(withCurrent(OPTION_SOURCES.things(), gate.thing, 'missing'), gate.thing, value => { gate.thing = value; rerender() }),
  anyInRow:    (gate, self) => selectOf(withCurrent(OPTION_SOURCES.rows(self), gate.row, 'missing'), gate.row, value => { gate.row = value; rerender() })
}

// where a builder gets its options when they are DATA, not a fixed list.
// "types" is nullary — every loaded type, read at draw time, plus a blank
// first row for "shows nothing yet" (its value "" is the query's empty type)
// — and stays so for the choice builder, which calls sources with no
// arguments. NEW: the other sources take the context their options depend
// on: the fields OF a type, the operators FOR a kind, the values a type's
// bucket holds FOR a field, and the rows a given row may wait on.
const OPTION_SOURCES = {
  types: () => [
    { value: '', label: '— none —' },
    ...editorState.types.types.map(type => ({ value: type.id, label: type.label }))
  ],
  fieldsOf:     (type)        => [{ value: '', label: '— every thing —' }, ...queryableFields(type).map(field => ({ value: field.id, label: field.caption }))],
  operatorsFor: (kind)        => OPERATORS[kind].map(({ value, label }) => ({ value, label })),
  valuesFor:    (type, field) => valuesOf(bucketOf(type), field).map(v => ({ value: String(v), label: String(v) })),
  things:       ()            => editorState.types.types.flatMap(type => bucketOf(type).map(thing => ({ value: thing.id, label: `${type.label}: ${thing.name}` }))),
  // a row may wait on any row but itself and its descendants: those can never
  // hold a pick while this row is hidden, so offering them would mint dead
  // rows. Ancestors are offered — "pick a Lair, then choose a Location inside it".
  rows:         (self)        => { const below = new Set(idsBelow(self)); return rowsIn(editorState.content.groups).filter(row => !below.has(row.id)).map(row => ({ value: row.id, label: row.label })) }
}

// what to call an element of a sheet on a button. Most sheets are named by
// their phonebook key ("type"); NOUNS spells out the ones that would read
// oddly — CHANGED: a group is a "row" on screen; a type's sheet is filed
// under the type's id, so its label is shown instead.
const NOUNS = { fieldDef: 'field', group: 'row' }
const sheetLabel = (sheetName) =>
  NOUNS[sheetName] ?? typeById(sheetName)?.label ?? sheetName

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
const tabsEl   = document.querySelector('#tabs')     // NEW: the static header's tab strip

export const renderSaveStatus = (text) => {
  statusEl.textContent = text
}

/* The editor uses the same pattern as the game's view:
   wipe everything, rebuild everything from state.
   Content edits (typing in a field) mutate state directly through the
   bind-loop — no re-render needed, the input already shows what you typed.
   STRUCTURAL edits (add/remove a card, a pick in a drop-down, a fold) mutate
   state — or uiState — and then call rerender(), so the screen is repainted.
   Rule of the file: structural edits change the array IN PLACE (push/splice)
   and then rerender. Never replace a list (group.children = group.children.filter(…))
   — the collection builder is holding the original array.
   Rule two: rendering never writes state — with ONE exception, repairBuckets.
   A file that was only looked at is saved back unchanged. Rendering never
   writes the URL either: the hash is read (uiState.readHash), never set. */

let currentActions = null // remembered at render time so rerender() keeps the same wiring

const rerender = () => render(currentActions)

export const render = (actions) => {
  currentActions = actions
  SHEETS = buildSheets()          // fresh phonebook — types may have changed since the last paint
  repairBuckets()                 // the ONE write render() may make — every type, every paint, whichever tab
  renderTabs()                    // NEW: into the static #tabs
  editorEl.innerHTML = ''
  // CHANGED: one tab at a time, dispatched like everything else. The three
  // walls of v3 (Types, Things, Groups) are the three tabs now.
  const paint = TAB_PAINTERS[uiState.tab]
  if (!paint) { console.warn(`No painter for tab "${uiState.tab}"`); return }
  paint()
}

const repairBuckets = () => {
  // A type born this session has no bucket yet. Giving it an empty one is the
  // ONE write render() is allowed: it repairs an invariant (every type has a
  // bucket), never touches what an author wrote, and migrated data always
  // arrives with its buckets, so a no-edit save stays byte-identical.
  editorState.types.types.forEach(type => { editorState.things.things[type.id] ??= [] })
}

// ───────────────────────── tabs ─────────────────────────

// NEW: three plain links. The browser changes the hash, main.js repaints on
// hashchange — no click handler here. The Things link remembers its type.
const renderTabs = () => {
  tabsEl.innerHTML = ''
  TABS.forEach(([id, label]) => {
    const linkEl = document.createElement('a')
    linkEl.className = `tab${uiState.tab === id ? ' tab--active' : ''}`
    linkEl.href = id === 'things' ? hashFor('things', uiState.selectedType) : hashFor(id)
    linkEl.textContent = label
    tabsEl.appendChild(linkEl)
  })
}

// ───────────────────────── the three tabs ─────────────────────────

// NEW: the Types tab is one walk of types.json's sheet — a collection of
// "type", each a folding card (see CARD_STYLES).
const renderTypesTab = () => {
  typesSchema.forEach(entry => {
    editorEl.appendChild(renderField(entry, editorState.types))
  })
}

// NEW: the Things tab. A rail on the left lists every type with its count;
// the pane on the right shows ONE type's bucket as a collection, built on
// the spot because its `of` (the type's sheet) is only known now. The target
// is the buckets object itself, so the collection builder owns the REAL
// array in state: "+ Add Lair" pushes a newborn into the bucket, Remove
// splices it. A stale selected type (removed, or from the other game's hash)
// falls back to the first type at paint — the URL is not rewritten.
const renderThingsTab = () => {
  const types = editorState.types.types
  const shownType = typeById(uiState.selectedType) ?? types[0]

  const layoutEl = document.createElement('div')
  layoutEl.className = 'things-layout'
  layoutEl.appendChild(renderRail(types, shownType))

  const paneEl = document.createElement('div')
  paneEl.className = 'things-main'
  if (!shownType) {
    const hintEl = document.createElement('p')
    hintEl.className = 'wall-hint'
    hintEl.innerHTML = 'No types yet — <a href="#types">add one in Types</a>.'
    paneEl.appendChild(hintEl)
  } else {
    const headingEl = document.createElement('h2')
    headingEl.textContent = shownType.label
    paneEl.appendChild(headingEl)
    const entry = { key: shownType.id, caption: shownType.label, type: 'collection', of: shownType.id }
    paneEl.appendChild(renderField(entry, editorState.things.things))
  }
  layoutEl.appendChild(paneEl)
  editorEl.appendChild(layoutEl)
}

// NEW: the rail — one link per type, the shown one highlighted, and a way to
// the Types tab at the bottom. Links, not buttons: the hash is the address.
const renderRail = (types, shownType) => {
  const railEl = document.createElement('nav')
  railEl.className = 'rail'
  types.forEach(type => {
    const itemEl = document.createElement('a')
    itemEl.className = `rail-item${type === shownType ? ' rail-item--active' : ''}`
    itemEl.href = hashFor('things', type.id)
    const labelEl = document.createElement('span')
    labelEl.textContent = type.label
    const countEl = document.createElement('span')
    countEl.className = 'rail-count'
    countEl.textContent = bucketOf(type).length
    itemEl.appendChild(labelEl)
    itemEl.appendChild(countEl)
    railEl.appendChild(itemEl)
  })
  const manageEl = document.createElement('a')
  manageEl.className = 'rail-manage'
  manageEl.href = hashFor('types')
  manageEl.textContent = 'Manage types →'
  railEl.appendChild(manageEl)
  return railEl
}

// NEW: the Rows tab: the Page card first, then the whole row tree as ONE
// walk of content's sheet: groups is a collection of "group", and group's
// own sheet holds a collection of "group" — the nesting lives in the data,
// not here. The big "+ Add row" at the bottom comes from the same collection
// builder as every other add button. Before any card is drawn, the paint
// context every row one-liner reads is filled once (see rowSummary).
const renderRowsTab = () => {
  const offered = {}
  rowsIn(editorState.content.groups).forEach(row => { offered[row.id] = offeredBy(row) })
  rowsContext = {
    rowIds:   new Set(rowsIn(editorState.content.groups).map(row => row.id)),
    thingIds: new Set(Object.values(editorState.things.things).flat().map(thing => thing.id)),
    dead:     deadRows(editorState.content.groups, offered)
  }
  renderPageCard()
  contentSchema.forEach(entry => {
    editorEl.appendChild(renderField(entry, editorState.content))
  })
}

// NEW: one painter per tab, dispatched like everything else
const TAB_PAINTERS = { types: renderTypesTab, things: renderThingsTab, rows: renderRowsTab }

// ─────────────────── page-wide settings card ───────────────────
// One folding card holding everything that isn't a row: meta (content.json),
// the budget (rules.json) and the page theme (themes.json). It lives on the
// Rows tab because it answers the rows' question — what the player sees.
// The comment above each walk says which file its fields come from.
// Its id in uiState.expanded is the literal "page" — it is not a sheet element.

const pageSummary = () => ({
  text: `Page · "${editorState.content.meta.pageTitle}" · budget ${editorState.rules.totalBudget}`,
  warnings: []
})

const renderPageCard = () => {
  const cardEl = document.createElement('section')
  cardEl.className = 'editor-section'
  const open = uiState.expanded.has('page')
  cardEl.appendChild(buildHeader('page', pageSummary(), open))

  if (open) {
    metaSchema.forEach(entry => {
      cardEl.appendChild(renderField(entry, editorState.content.meta))
    })
    totalBudgetSchema.forEach(entry => {
      cardEl.appendChild(renderField(entry, editorState.rules))
    })
    // ── page theme values (themes.json → applied as CSS custom properties by the game) ──
    pageThemeSchema.forEach(entry => {
      cardEl.appendChild(renderField(entry, editorState.themes.page))
    })
  }
  editorEl.appendChild(cardEl)
}

// ───────────────────────── one-liners ─────────────────────────

// NEW: what the Rows tab knows for the length of ONE paint: every row id,
// every thing id (for the gate check) and the rows that can never appear.
// Filled by renderRowsTab before any row card is drawn; rowSummary reads it.
let rowsContext = null

// NEW: the thing ids a row's query yields today — the input deadRows needs
// to tell "waits on a row that offers nothing" from a live row. A query that
// cannot run offers nothing, the same rule the game's border applies.
const offeredBy = (row) => {
  const type = typeById(row.query.type)
  if (!type || checkWhere(row.query.where, type)) return []
  return filterThings(bucketOf(type), type, row.query.where).map(thing => thing.id)
}

// every summary returns { text, warnings } — warnings become ⚠ spans in the header
const typeSummary  = (type)  => ({ text: `${type.label} · ${plural(type.fields.length, 'field')} · ${plural(bucketOf(type).length, 'thing')}`, warnings: [] })
const thingSummary = (thing) => ({ text: `${thing.name} · ${thing.cost} pt${thing.cost === 1 ? '' : 's'}`, warnings: [] })

// NEW: the row's header sentence: label · what it shows · how many things ·
// min/max · when it is shown. Every "shows n things" here comes from the same
// filterThings the game runs, so the count the author reads is the count the
// player gets. A broken reference (hand-edited file) becomes a ⚠ instead of a part.
const rowSummary = (row) => {
  const parts = [row.label], warnings = []
  const type = typeById(row.query.type)
  if (row.query.type === '') parts.push('shows nothing yet')
  else if (!type) warnings.push('shows a type that no longer exists')
  else {
    const problem = checkWhere(row.query.where, type)
    if (problem) { parts.push(`shows ${type.label}`); warnings.push(`filter ${problem}`) }
    else {
      const shown = filterThings(bucketOf(type), type, row.query.where)
      parts.push(`shows ${type.label}${wherePhrase(row.query.where, type)}`, plural(shown.length, 'thing'))
      if (shown.length === 0 && (editorState.rules.groupRules[row.id]?.min ?? 0) > 0) warnings.push('required but matches nothing')
    }
  }
  const slot = editorState.rules.groupRules[row.id]
  if (slot?.min !== undefined) parts.push(`min ${slot.min}`)
  if (slot?.max !== undefined) parts.push(`max ${slot.max}`)
  const gateProblem = checkShowWhen(row, rowsContext.rowIds, rowsContext.thingIds)
  if (gateProblem) warnings.push(`show-when ${gateProblem}`)
  else if (row.showWhen.kind !== 'always') parts.push(whenPhrase(row.showWhen))
  if (rowsContext.dead.has(row.id)) warnings.push('can never appear')
  return { text: parts.join(' · '), warnings }
}

// the condition in words — only called once checkWhere has passed, so the
// field and the operator both exist
const wherePhrase = (where, type) => {
  if (where === null) return ''
  const field = fieldById(type, where.field)
  return ` where ${field.caption} ${operatorOf(field.type, where.op).label} ${where.value}`
}

// the gate in words — only called once checkShowWhen has passed, so the
// thing or row it names exists SOMEWHERE in the files. For a thing that is
// "somewhere in a bucket no type owns" (a hand-edited things.json), the
// dropdown has no label for it, so the id is shown instead of a crash.
const whenPhrase = (gate) => {
  if (gate.kind === 'thingPicked') return `shown when "${thingLabel(gate.thing)}" is picked`
  return `shown when anything in "${rowsIn(editorState.content.groups).find(row => row.id === gate.row).label}" is picked`
}
// "Type: name" — the same label the things dropdown shows; the dropdown only
// walks typed buckets, so a thing in an orphan bucket falls back to its id
const thingLabel = (thingId) =>
  OPTION_SOURCES.things().find(option => option.value === thingId)?.label ?? `${thingId} (in a bucket no type owns)`

// ───────────────────────── side cabinets ─────────────────────────

// the cabinet an attachment entry points at: <file>.<cabinet>, e.g.
// rules.groupRules. schema.js only knows the file's NAME; this is the ONE line
// that turns that name into the editor's object (editorState is keyed by the
// same file names). The attachment builder and cascadeDelete both ask here.
// The cabinet object itself must already be in the loaded file — a missing one
// is a border (migration) problem, never something to create while drawing.
const cabinetOf = (entry) => editorState[entry.file][entry.cabinet]

// when an element leaves, everything the side cabinets hold about it leaves
// too — and so does everything they hold about every element INSIDE it, or
// rules.json/themes.json would keep orphan UUIDs forever. The sheet is the
// map: an attachment entry says which cabinet to clear, a collection entry
// says where the descendants are. For a row: clear its rules and theme
// slots, then repeat for every child (a row, so it repeats all of this).
// A type walks its fields (no cabinets, so that stops); a thing has neither.
// Covers any future sheet with cabinets or nesting without touching this function.
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

// ───────────────────────── referential integrity ─────────────────────────

// NEW: what ELSE must go when an element leaves, beyond its cabinets
// (cascadeDelete): what OTHER files and rows say about it. Hooks run AFTER
// the splice and the cascade, over the tree WITHOUT the element — every
// reference is by id, so no hook needs to know who owned the element. The
// repairs themselves live in references.js (the restructure script and the
// oracle use the same four); each returns what it changed, and `say` names
// every changed row in the console.
//
//   removed / changed     pointer                              repair
//   type                  row.query.type                       { type: "", where: null }   (forgetType)
//   type                  things in its bucket ← showWhen.thing forgetThing per thing, THEN the bucket goes
//   field (removed)       row.query.where.field                where = null                (forgetField)
//   field (kind changed)  row.query.where.field                where = null                (forgetField, via CHANGE_HOOKS)
//   field (key renamed)   —                                    nothing: the filter follows the id; thing
//                                                              values stay under the old key (the footgun
//                                                              fieldDefSchema documents); the row's count
//                                                              drops and the value select says "(no thing has this)"
//   thing                 row.showWhen.thing                   { kind: "always" }          (forgetThing)
//   row (+ subtree)       row.showWhen.row                     { kind: "always" }          (forgetRow per id in idsBelow)
const REMOVE_HOOKS = {
  type: (type) => {
    bucketOf(type).forEach(thing => say(forgetThing(editorState.content.groups, thing.id)))   // its things go, and every gate on them — BEFORE the bucket does
    delete editorState.things.things[type.id]
    say(forgetType(editorState.content.groups, type.id))
    if (uiState.selectedType === type.id) uiState.selectedType = ''            // the Things pane falls back to the first type at paint
  },
  fieldDef: (field) => say(forgetField(editorState.content.groups, field.id)),
  thing:    (thing) => say(forgetThing(editorState.content.groups, thing.id)),
  group:    (row)   => idsBelow(row).forEach(id => say(forgetRow(editorState.content.groups, id)))   // the row AND its subtree
}
// a thing's sheet is filed under its type's id, so it is found by asking
// "is this sheet name a type?" — the same test cardStyleOf makes
const hookFor = (sheetName) => REMOVE_HOOKS[sheetName] ?? (isTypeSheet(sheetName) ? REMOVE_HOOKS.thing : undefined)

// NEW: hooks for a VALUE change, named on the sheet entry (afterChange) the way
// optionsFrom names an option source. The choice builder runs it after writing.
const CHANGE_HOOKS = {
  fieldKindChanged: (field) => say(forgetField(editorState.content.groups, field.id))   // the old kind's operators and values no longer fit
}
const say = (changed) => changed.forEach(({ row, what }) => console.warn(`Row "${row.label}" ${what}`))

// ───────────────────────── newborns ─────────────────────────

// a brand-new element, born from its sheet: a forever-id first, then each
// entry's default in sheet order — the same key order the old literals had and
// the saved files have. Two kinds of entry are skipped: attachment entries
// (no key — nothing is stored in the element) and entries whose default is
// null (the sheet rule: null = key not written at birth).
// structuredClone hands back a SEPARATE COPY of each default. Arrays and
// objects are references: without the copy every newborn row would share ONE
// children array — and ONE query object, so picking a type on row A would
// show up on row B.
// (No rules/themes slots are born on purpose: the game's hydration defaults
// cover absent entries, and editing min/max/background creates them — ensure.)
const newborn = (sheetName) => {
  const born = { id: crypto.randomUUID() }
  SHEETS[sheetName].forEach(entry => {
    if (entry.key === undefined) return                // attachment: nothing lives in the element
    if (entry.default === null) return                 // sheet rule: null = not written at birth
    born[entry.key] = structuredClone(entry.default)   // a FRESH copy, never the sheet's own [] or {}
  })
  return born
}

// ───────────────────────── cards ─────────────────────────

// CHANGED: was CARD_CLASS. A sheet's card now also says whether it folds and
// how its one-liner reads. Per-type sheets (things) share the `thing` row;
// field definitions never fold — they are three small inputs. A sheet with
// no row at all gets the plain item look, so a brand-new sheet renders
// before anyone styles it.
const CARD_STYLES = {
  group:    { className: 'editor-section', summary: rowSummary },     // the big white card; nested ones get the left rail via CSS
  type:     { className: 'editor-section', summary: typeSummary },
  thing:    { className: 'item-card',      summary: thingSummary },
  fieldDef: { className: 'item-card' }                                   // no summary = always open
}
const isTypeSheet  = (sheetName) => editorState.types.types.some(type => type.id === sheetName)
const cardStyleOf  = (sheetName) => CARD_STYLES[sheetName] ?? (isTypeSheet(sheetName) ? CARD_STYLES.thing : { className: 'item-card' })

// NEW: a card that folds remembers whether it is open in uiState.expanded —
// the DOM forgets at every paint. Flipping it is a structural edit of the
// SCREEN, so it repaints like one.
const toggleExpanded = (id) => {
  if (uiState.expanded.has(id)) uiState.expanded.delete(id)
  else uiState.expanded.add(id)
  rerender()
}

// NEW: the header of a folding card: a ▾/▸ toggle, the one-liner, and one
// ⚠ span per warning. The warnings sit BESIDE the sentence, not inside it:
// the sentence is the part that may be cut with an ellipsis, and a warning
// is the one thing a header must never cut. Clicking the toggle, the
// sentence or a warning folds/unfolds. The caller appends whatever else
// belongs in the header (Remove).
const buildHeader = (id, summary, open) => {
  const headerEl = document.createElement('div')
  headerEl.className = 'group-header'

  const toggleEl = document.createElement('button')
  toggleEl.className = 'card-toggle'
  toggleEl.textContent = open ? '▾' : '▸'
  toggleEl.setAttribute('aria-expanded', String(open))
  toggleEl.addEventListener('click', () => toggleExpanded(id))

  const summaryEl = document.createElement('span')
  summaryEl.className = 'card-summary'
  summaryEl.textContent = summary.text
  summaryEl.addEventListener('click', () => toggleExpanded(id))

  const warningsEl = document.createElement('span')
  warningsEl.className = 'summary-warns'
  summary.warnings.forEach(warning => {
    const warnEl = document.createElement('span')
    warnEl.className = 'summary-warn'
    warnEl.textContent = `⚠ ${warning}`
    warningsEl.appendChild(warnEl)
  })
  warningsEl.addEventListener('click', () => toggleExpanded(id))

  headerEl.appendChild(toggleEl)
  headerEl.appendChild(summaryEl)
  headerEl.appendChild(warningsEl)
  return headerEl
}

// ONE function builds every card and RETURNS it: a header row holding the
// one-liner and Remove, then — only when the card is open — the element's
// sheet walked top to bottom: scalars, cabinets, lists, in sheet order.
// A folded card costs nothing to draw: vampire's 64 things are 8 one-liners
// at a time. list = the array the collection builder read this element from.
// The builder owns it and lends it ONE hop so Remove can splice it; it is
// never passed further down (a nested list is re-read from element[entry.key]
// by the next collection entry).
const buildCard = (sheetName, element, list) => {
  const style = cardStyleOf(sheetName)
  const open = !style.summary || uiState.expanded.has(element.id)

  const cardEl = document.createElement('section')
  cardEl.className = style.className

  const headerEl = style.summary ? buildHeader(element.id, style.summary(element), open) : plainHeader()

  const removeBtn = document.createElement('button')
  removeBtn.className = 'remove-button'
  removeBtn.textContent = `Remove ${sheetLabel(sheetName)}`   // "Remove row", "Remove field", "Remove Dino"
  removeBtn.addEventListener('click', () => {
    const at = list.indexOf(element)
    if (at !== -1) list.splice(at, 1)                  // out of the list that owns it, in place
    cascadeDelete(sheetName, element)                  // and out of every cabinet, subtree included
    hookFor(sheetName)?.(element)                      // and out of every OTHER file/row that pointed at it
    uiState.expanded.delete(element.id)                // NEW: the screen forgets it too
    rerender()
  })
  headerEl.appendChild(removeBtn)
  cardEl.appendChild(headerEl)

  // the card IS the sheet: every entry goes through renderField, so a
  // collection entry lands in the collection builder (which calls buildCard
  // again for each element — that loop is the recursion) and an attachment
  // entry lands in the attachment builder.
  if (open) {
    SHEETS[sheetName].forEach(entry => {
      cardEl.appendChild(renderField(entry, element))
    })
  }
  return cardEl
}

// the header of a card that never folds (a field definition): Remove only
const plainHeader = () => {
  const headerEl = document.createElement('div')
  headerEl.className = 'group-header'
  return headerEl
}
