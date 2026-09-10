import { editorState, buildSheets, remerge } from './state.js'
// SHEETS is not imported from schema.js. Part of the phonebook depends on the
// loaded TYPES (one sheet per type), so state.js builds it — see buildSheets —
// and render() asks for a fresh one before every paint.
// The named imports are the Page card's three, the top of each tree
// (contentSchema for the rows, typesSchema for the types), and the two
// field lookups the query builder needs.
// NEW: rowOverrideSchema (the game's house rules on a proposed row), the two
// cabinet sheets drawn beside a proposal, asOption/placementSheet/listSectionsOf
// (the placements builder) and fieldDefault's reader.
// NEW: FILE_SHEETS, for the ONE entry on it the Page card draws — `content.sheet`,
// the type the PLAYER builds. It is on FILE_SHEETS and not on contentSchema for the
// same reason `books` is: contentSchema is what renderRowsTab walks card by card,
// and the sheet declaration belongs in the Page card beside the title and the budget.
import {
  contentSchema, typesSchema, metaSchema, pageThemeSchema, totalBudgetSchema,
  rowOverrideSchema, groupRulesSchema, groupThemeSchema, FILE_SHEETS,
  queryableFields, fieldById, asOption, placementSheet, listSectionsOf
} from '/config/schema.js'
// NEW: the player's sheet, as vocabulary — the leaf the engine, the validator and
// this screen all read. Same discipline as query.js and visibility.js above: the
// question "why can this row not fill what it names?" is answered by ONE function
// (checkFills), so the badge this screen draws is the sentence the player's console
// warns with and the sentence the server refuses the save with. Never write it twice.
import { fillableSections, sectionById, checkFills, quantityFieldOf } from '/config/sheet.js'
// NEW: the shared logic under engine/config/ — the same functions the game
// runs, so what the author reads here is what the player gets there.
// query.js answers a row's question; visibility.js says when a row shows;
// references.js walks the row tree and repairs it when something is removed.
import { OPERATORS, operatorOf, WHERE_VALUE_DEFAULT, checkWhere, filterThings, valuesOf } from '/config/query.js'
import { SHOW_WHEN_KINDS, checkShowWhen, deadRows, idsBelow } from '/config/visibility.js'
// NEW on this line: forgetFills and forgetPlayerSheet — the two repairs a removed
// section and a removed TYPE now owe the player's sheet (see REMOVE_HOOKS).
import { rowsIn, forgetType, forgetField, forgetThing, forgetRow, forgetPlaced, forgetSectionPlacements, forgetFills, forgetPlayerSheet } from '/config/references.js'
// NEW: the merge's two names the screen speaks — which layer is "the game" and
// how a book layer is labelled ("basic 1") — plus the sentence maker for a fault.
import { GAME_LAYER, bookLabel } from '/config/merge.js'
import { problemText } from '/config/validate.js'
// NEW: the screen's own memory — tab, rail type, open cards. See uiState.js.
import { uiState, TABS, hashFor } from './uiState.js'
// NEW: the fourth tab, in its own file — it is the only tab that talks to the
// server while a game is open, so it keeps its own company.
import { renderBooksTab } from './books.js'

// The phonebook for THIS paint. render() refills it first thing, so every
// card, newborn and cascade below reads the same, current sheets. It is a
// `let` for exactly one reason: the sheets for things change when types do.
let SHEETS = {}

// ───────────────────────── small lookups ─────────────────────────

// NEW: the three questions half of this file asks. A type by its id (or
// undefined — a stale id from a hand-edited file), a type's bucket of things,
// and the "n things" / "1 field" wording every one-liner uses.
// CHANGED: both read the MERGED set. A row may show Basic's Character, a
// placement may name Dinosaur Age's Tyrannosaurus, and a count must include
// what the books put on the shelf — so every READ goes through the merge.
const typeById = (id) => editorState.merged.types.types.find(type => type.id === id)
const bucketOf = (type) => editorState.merged.things.things[type.id] ?? []
const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`

// NEW: the three that read the game's OWN drawer, because a WRITE only ever
// goes there. ownBucketOf is the array a Remove splices and an Add pushes into;
// ownThing hands back the REAL object behind a merged clone, so a card built for
// an own thing edits the thing that gets saved — never the copy the merge made.
const ownBucketOf = (type) => editorState.things.things[type.id] ?? []
const ownThing    = (id)   => Object.values(editorState.things.things).flat().find(thing => thing.id === id)
// NEW: "may this be edited?" — one question, asked of the merge's origins map.
// Everything the game defined is the game's to change; everything a book defined
// is read-only here and is changed by publishing a new edition of that book.
const isOwn = (id) => editorState.origins.get(id) === GAME_LAYER

// NEW: a layer label as the author's own words. The merge speaks in folder
// terms ("basic 1"); a badge should say what the Library says ("Basic 1").
const titleOf = (label) => {
  if (label === GAME_LAYER) return 'this game'
  const layer = editorState.books.find(book => book !== null && bookLabel(book.manifest) === label)
  return layer ? `${layer.manifest.title} ${layer.manifest.edition}` : label
}
// NEW: the small grey pill that says where a card came from. Nothing for
// something this game owns and can edit — a badge on every own card is noise.
// `always` is for a LOCKED card that the game happens to own: a hand-written
// addition into a book's sheet, which reads "this game" rather than nothing.
const badge = (id, always = false) => {
  const label = editorState.origins.get(id)
  if (label === undefined) return null
  if (label === GAME_LAYER && !always) return null
  return el('span', 'origin-badge', label === GAME_LAYER ? 'this game' : `from ${titleOf(label)}`)
}

// NEW: a small node maker for the cards added in this stage. The field builders
// below keep their longhand on purpose — they are the part of the file a
// learner reads first, and each one is meant to be readable start to finish.
const el = (tag, className = '', text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
// NEW: the small quiet buttons of the override lines — [override], [reset],
// [Hide], [Forget]. A button, not a link: it changes state, it does not navigate.
const smallButton = (text, onClick) => {
  const buttonEl = el('button', 'link-button link-button--small', text)
  buttonEl.type = 'button'
  buttonEl.addEventListener('click', onClick)
  return buttonEl
}

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
    // no rerender, here as everywhere: typing is a content edit and the input
    // already shows what was typed. The proposal line beside it (struck through
    // once this game has a value) catches up at the next paint — the same
    // one-beat delay every other one-liner in this file has always had.
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
// CHANGED: through asOption, because the options now arrive in two shapes. A
// SHEET writes them long ({ value, label } — the kind picker's four kinds); a
// choice FIELD a book authored writes them short (bare strings, value = label).
// One reader for both means the choice builder never asks which it is looking at.
choice: (entry, target) => {
  const fieldEl = document.createElement('label')
  fieldEl.className = 'field'

  const captionEl = document.createElement('span')
  captionEl.textContent = entry.caption

  const selectEl = document.createElement('select')
  // CHANGED: the source is handed the TARGET. Every source that existed takes no
  // argument and ignores an extra one, so nothing else moves — but the new
  // `fillableSections` source needs it: WHICH sections fit depends on the row being
  // drawn (a row showing Items may only fill a section that lists Items).
  const options = (entry.options ?? OPTION_SOURCES[entry.optionsFrom](target)).map(asOption)
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

// NEW: a field's default, read-only. Books author defaults (Stats writes
// `default: 10` on Strength); the editor shows what one says and offers no way
// to write one — Stage 2. Absent is the common case and draws nothing at all,
// so a plain text field's card stays three small inputs.
fieldDefault: (entry, target) => {
  const value = target[entry.key]
  if (value === undefined) return document.createTextNode('')
  return el('p', 'field-note', `${entry.caption}: ${value}`)
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

// NEW: a LIST section's entries — the things this thing has placed from
// another sheet's shelf (a pet's Origin, a character's Skills). One line per
// placement: WHICH thing, then that placement's own fields through the very
// same builders (a Skill's Level, an Item's Quantity), then a small Remove.
// The shelf is the MERGED one, so a game's own pet may place a book's species.
//
// The write happens on CLICK, never on paint: `target[entry.key] ??= []` lives
// inside the Add handler, so a thing that simply lacks the key keeps lacking it
// and a no-edit save stays byte-identical (the rule the whole file lives by).
placements: (entry, target) => {
  const section = entry.section
  const placed  = target[entry.key] ?? []
  const shelf   = OPTION_SOURCES.thingsOf(section.of)
  // NEW: the one placement key the ENGINE reads by name. A NUMBER field keyed
  // `quantity` MULTIPLIES its entry's cost when a player picks it (three Cute Rocks
  // cost three times one rock); every other placement field — a Skill's Level — is
  // just a value. So the author is told which box does that, where the box is.
  // Asked of quantityFieldOf and never of the key itself, so the day this becomes a
  // real `multiplies: true` flag on the field, that one function changes and this
  // line does not. (placementSheet dresses a fresh object per call, so the two are
  // compared by KEY, not by identity.)
  const multiplies = quantityFieldOf(section)?.key

  const bagEl = document.createDocumentFragment()
  bagEl.appendChild(captionSpan(entry.caption))
  placed.forEach(placement => {
    const lineEl = el('div', 'placement-row')
    lineEl.appendChild(selectOf(withCurrent(shelf, placement.thing, 'missing'), placement.thing, value => {
      placement.thing = value
      rerender()
    }))
    placementSheet(section).forEach(field => {
      lineEl.appendChild(renderField(field, placement))
      if (field.key === multiplies) lineEl.appendChild(el('span', 'field-note', '· multiplies cost'))
    })
    const removeBtn = el('button', 'remove-button', 'Remove')
    removeBtn.addEventListener('click', () => {
      const at = placed.indexOf(placement)
      if (at !== -1) placed.splice(at, 1)      // in place: the array is the one in state
      rerender()
    })
    lineEl.appendChild(removeBtn)
    bagEl.appendChild(lineEl)
  })

  const addBtn = el('button', 'add-button', `+ Add ${entry.caption}`)
  if (shelf.length === 0) {
    addBtn.disabled = true
    addBtn.title = `no ${sheetLabel(section.of)} on the shelf yet`
  }
  addBtn.addEventListener('click', () => {
    (target[entry.key] ??= []).push({ thing: shelf[0].value, ...bornFrom(placementSheet(section)) })
    rerender()
  })
  bagEl.appendChild(addBtn)
  return bagEl
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
  // CHANGED: `noun` on the entry wins. Most sheets are named well enough by
  // their own name ("+ Add row"); a sheet used for two different jobs is not —
  // a fieldDef inside a list section is a "placement field", not a "field".
  addBtn.textContent = `+ Add ${entry.noun ?? sheetLabel(entry.of)}`   // "+ Add row", "+ Add field", "+ Add Dino" — never a type's id
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
  // NEW: one sentence a whole cabinet needs, said where the cabinet is drawn — see
  // SHEET_NOTES. Today that is min/max on a row: they count PICKS, never quantities.
  if (SHEET_NOTES[entry.of]) bagEl.appendChild(el('p', 'field-note', SHEET_NOTES[entry.of]))
  return bagEl
}

}

// NEW: the values a fresh PLACEMENT carries beyond `thing` — every placement
// field at its default, in placement order, so the stored key order is the
// canonical one (§2.8). newborn's twin for a thing that has no id of its own.
const bornFrom = (sheet) => Object.fromEntries(sheet.map(entry => [entry.key, structuredClone(entry.default)]))

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
// CHANGED: every source reads the MERGED world and says where each option came
// from ("Character (Basic 1)"), because a game row may show a book's sheet and
// a game thing may place a book's thing — and the author should see the seam
// only here, when choosing, not afterwards.
const OPTION_SOURCES = {
  types: () => [
    { value: '', label: '— none —' },
    ...OPTION_SOURCES.sheets()
  ],
  // NEW: every merged sheet — what a list section may draw entries FROM
  sheets:       ()            => editorState.merged.types.types.map(type => ({ value: type.id, label: `${type.label} (${titleOf(editorState.origins.get(type.id))})` })),
  fieldsOf:     (type)        => [{ value: '', label: '— every thing —' }, ...queryableFields(type).map(field => ({ value: field.id, label: field.caption }))],
  operatorsFor: (kind)        => OPERATORS[kind].map(({ value, label }) => ({ value, label })),
  // CHANGED: a CHOICE field's values are its options, not the values things
  // happen to hold — a row may filter on "location" before any place is one.
  valuesFor:    (type, field) => field.type === 'choice'
    ? (field.options ?? []).map(asOption).map(({ value, label }) => ({ value: String(value), label }))
    : valuesOf(bucketOf(type), field).map(v => ({ value: String(v), label: String(v) })),
  things:       ()            => editorState.merged.types.types.flatMap(type => bucketOf(type).map(thing => ({ value: thing.id, label: `${type.label}: ${thing.name}` }))),
  // NEW: one merged shelf, for the placements builder's select
  thingsOf:     (sheetId)     => (editorState.merged.things.things[sheetId] ?? []).map(thing => ({ value: thing.id, label: `${thing.name} (${titleOf(editorState.origins.get(thing.id))})` })),
  // a row may wait on any row but itself and its descendants: those can never
  // hold a pick while this row is hidden, so offering them would mint dead
  // rows. Ancestors are offered — "pick a Lair, then choose a Location inside it".
  rows:         (self)        => { const below = new Set(idsBelow(self)); return rowsIn(editorState.merged.content.groups).filter(row => !below.has(row.id)).map(row => ({ value: row.id, label: row.label })) },
  // NEW: what a GAME may declare as the sheet the PLAYER builds — every merged type,
  // plus the honest "none" first. "" is a real answer and the default one: a game that
  // builds no sheet is a menu of plain pickers, which is what every v5 game is.
  // (its target is content.json's top, so it can name a sheet the library lost.)
  playerSheets: (content)     => withCurrent([{ value: '', label: '— nothing (a plain picker) —' }, ...OPTION_SOURCES.sheets()], content?.sheet ?? '', 'no longer exists'),
  // NEW: where a ROW's picks land — only the sections that FIT, which is the LIST
  // sections of the declared player sheet whose `of` is this row's query type. A
  // binding built from this dropdown can never mismatch, the same discipline the query
  // builder keeps by only offering fields that exist. (Measured: on today's dino every
  // row has exactly ONE fitting section, so binding a row is one click.)
  // Two notes for the reader. The `fillableSections(...)` INSIDE is the import from
  // sheet.js: a property name creates no binding, so nothing is shadowed — one name,
  // one idea. And withCurrent, for the reason every other select here has it: a
  // hand-written binding that does NOT fit is SHOWN, labelled, never silently swapped
  // for the first option; the row's header carries checkFills' sentence beside it.
  fillableSections: (row)     => {
    const type = typeById(editorState.merged.content.sheet ?? '')
    if (!type) return [{ value: '', label: '— this game builds no sheet —' }]
    const fits = fillableSections(type, row?.query?.type ?? '')
      .map(section => ({ value: section.id, label: `${section.caption} — ${sheetLabel(section.of)} entries` }))
    return withCurrent([{ value: '', label: '— nothing —' }, ...fits], row?.fills ?? '', 'does not fit this row')
  }
}

// what to call an element of a sheet on a button. Most sheets are named by
// their phonebook key ("type"); NOUNS spells out the ones that would read
// oddly — CHANGED: a group is a "row" on screen; a type's sheet is filed
// under the type's id, so its label is shown instead.
const NOUNS = { fieldDef: 'field', group: 'row', section: 'section' }

// NEW: one sentence a whole SHEET needs, drawn under it. Today there is exactly
// one, and it exists because `fills` gave min/max a neighbour they can be confused
// with: three Cute Rocks are ONE entry on the player's sheet and ONE pick in the
// row — a quantity multiplies the PRICE and never the COUNT, so `max: 3` still
// means three different things. A table rather than a line in the builder, for the
// reason NOUNS is one: the next such sentence should be an entry, not an edit.
const SHEET_NOTES = { groupRules: 'min and max count picks — a quantity does not count twice' }
const sheetLabel = (sheetName) =>
  NOUNS[sheetName] ?? typeById(sheetName)?.label ?? sheetName

// NEW: one SECTION of the player's sheet, by id, as the author's own caption
// ("Gear"). Total on purpose — it falls back to the bare id, because it is drawn on
// cards that must paint whatever the file says, including a binding to a section a
// book upgrade took away. The ⚠ beside it is checkFills' job, never this one's.
const sectionCaption = (sectionId) => {
  const type = typeById(editorState.merged.content.sheet ?? '')
  return (type ? sectionById(type, sectionId) : undefined)?.caption ?? sectionId
}

// CHANGED: an entry may only EXIST while a sibling says so (`showIf`). A
// section's `fields` while its kind is "fields", its `of` and `placement` while
// it is "list", a field's `options` while its kind is "choice". The card simply
// lacks the box — no disabled control, no empty list to explain. The validator
// applies the same rule to the same entries (an unexpected key is a problem),
// and newborn writes the same ones at birth: one prop, three readers.
const renderField = (entry, target) => {
  if (entry.showIf && target[entry.showIf.key] !== entry.showIf.value) return document.createTextNode('')
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
   writes the URL either: the hash is read (uiState.readHash), never set.
   Rule three (NEW): rendering READS the merged set and WRITES the game's own
   five drawers. remerge() at the top of the paint is what keeps the two in step. */

let currentActions = null // remembered at render time so rerender() keeps the same wiring

const rerender = () => render(currentActions)

export const render = (actions) => {
  currentActions = actions
  repairBuckets()                 // the ONE write render() may make — every OWN type, every paint, whichever tab
  remerge()                       // NEW: books + this game, flattened. Everything below reads editorState.merged.
  SHEETS = buildSheets()          // fresh phonebook — types (a book's or the game's) may have changed since the last paint
  renderTabs()                    // NEW: into the static #tabs
  editorEl.innerHTML = ''
  renderFaultsBanner()            // NEW: at the top of EVERY tab, because a fault anywhere refuses the save
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
  // The game's OWN types only: a book's shelf is not this game's to create, and
  // the merge already gives every merged sheet a bucket to read.
  editorState.types.types.forEach(type => { editorState.things.things[type.id] ??= [] })
}

// ───────────────────────── the faults banner ─────────────────────────

// NEW: the merge's complaints, in red, above every tab. A fault is not a
// warning: it is the reason the next Save will be refused, so it is on screen
// wherever the author happens to be standing. Each line links to the tab that
// owns the thing it names — a fault about a pin is fixed on Books, a fault
// about a proposal on Rows.
// Order matters in this table: content.books is a fault about a PIN and must be
// matched before the plain content… line that would otherwise catch it.
const FAULT_TABS = [
  [/^content\.books/,                 'books'],
  [/^books\["[^"]*"\]\.types/,        'types'],
  [/^books\["[^"]*"\]\.things/,       'things'],
  [/^books\["[^"]*"\]\.proposals/,    'rows'],
  [/^things/,                         'things'],
  [/^types/,                          'types'],
  [/^rules/,                          'rows'],
  [/^content/,                        'rows']
]
const tabForFault = (path) => FAULT_TABS.find(([pattern]) => pattern.test(path))?.[1] ?? 'rows'

const renderFaultsBanner = () => {
  if (editorState.faults.length === 0) return
  const bannerEl = el('section', 'faults')
  bannerEl.appendChild(el('h2', '', plural(editorState.faults.length, 'book fault')))
  editorState.faults.forEach(fault => {
    const lineEl = el('p', 'fault-line')
    const linkEl = el('a', '', problemText(fault))
    linkEl.href = hashFor(tabForFault(fault.path))
    lineEl.appendChild(linkEl)
    bannerEl.appendChild(lineEl)
  })
  editorEl.appendChild(bannerEl)
}
// NEW: the merge's own sentence for one coordinate, so a card can carry the very
// words the banner carries instead of inventing a second phrasing for one state.
const faultAt = (path) => editorState.faults.find(fault => fault.path === path)?.message

// ───────────────────────── tabs ─────────────────────────

// NEW: four plain links. The browser changes the hash, main.js repaints on
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

// ───────────────────────── the four tabs ─────────────────────────

// NEW: the Types tab is one walk of types.json's sheet — a collection of
// "type", each a folding card (see CARD_STYLES).
// CHANGED: the books' sheets come FIRST, read-only, in merge order — they are
// the ground this game is standing on, and seeing them is the point. Then the
// game's own types, editable, through the same collection walk as before.
const renderTypesTab = () => {
  editorState.merged.types.types
    .filter(type => !isOwn(type.id))
    .forEach(type => editorEl.appendChild(buildCard('type', type, [])))
  typesSchema.forEach(entry => {
    editorEl.appendChild(renderField(entry, editorState.types))
  })
}

// NEW: the Things tab. A rail on the left lists every type with its count;
// the pane on the right shows ONE type's bucket. The bucket is the MERGED one,
// in the game's own arranged order: a book's things as locked cards, the game's
// own as editable cards built from the REAL object in its drawer.
// A stale selected type (removed by hand) falls back to the first type at
// paint — the URL is not rewritten.
const renderThingsTab = () => {
  const types = editorState.merged.types.types
  const shownType = typeById(uiState.selectedType) ?? types[0]

  const layoutEl = document.createElement('div')
  layoutEl.className = 'things-layout'
  layoutEl.appendChild(renderRail(types, shownType))

  const paneEl = document.createElement('div')
  paneEl.className = 'things-main'
  if (!shownType) {
    const hintEl = document.createElement('p')
    hintEl.className = 'wall-hint'
    hintEl.innerHTML = `No sheets yet — <a href="${hashFor('books')}">pin a book</a> or <a href="${hashFor('types')}">add a type in Types</a>.`
    paneEl.appendChild(hintEl)
  } else {
    paneEl.appendChild(renderShelfHeading(shownType))
    // the merged shelf, in the arranged order the player will see
    const shelf = bucketOf(shownType)
    shelf.forEach((thing, at) => {
      const own    = isOwn(thing.id)
      const cardEl = own
        ? buildCard(shownType.id, ownThing(thing.id), ownBucketOf(shownType))   // the REAL object, editable
        : buildCard(shownType.id, thing, [])                                    // the merged clone, locked
      // the ▲▼ pair goes on AFTER buildCard, on purpose: lockCard disables every
      // control inside a book's card, and arranging the shelf is the game's
      // right even over a book's things — the order lives in the game's file.
      cardEl.querySelector('.group-header')?.appendChild(arrangeButtons(shownType.id, at, shelf.length))
      paneEl.appendChild(cardEl)
    })
    // "+ Add" writes on CLICK: the bucket for this sheet is created only when
    // something is actually put in it, so looking at a book's empty shelf never
    // adds an empty bucket to the game's things.json.
    const addBtn = el('button', 'add-button', `+ Add ${shownType.label}`)
    addBtn.addEventListener('click', () => {
      const born = newborn(shownType.id)
      ;(editorState.things.things[shownType.id] ??= []).push(born)
      uiState.expanded.add(born.id)
      rerender()
    })
    paneEl.appendChild(addBtn)
  }
  layoutEl.appendChild(paneEl)
  editorEl.appendChild(layoutEl)
}

// NEW: the shelf's heading — the sheet's label, its badge, and [Reset order]
// while this game holds an arrangement for it.
const renderShelfHeading = (type) => {
  const headEl = el('div', 'shelf-heading')
  headEl.appendChild(el('h2', '', type.label))
  const originBadge = badge(type.id)
  if (originBadge) headEl.appendChild(originBadge)
  if (editorState.things.order?.[type.id] !== undefined) {
    headEl.appendChild(smallButton('Reset order', () => {
      delete editorState.things.order[type.id]
      if (Object.keys(editorState.things.order).length === 0) delete editorState.things.order   // no empty key on disk
      rerender()
    }))
  }
  return headEl
}

// NEW: ▲ and ▼. The arrangement lives in the GAME's things.json as a list of
// ids per sheet: the ids listed come first in that order, everything else
// follows in merge order. So the merged shelf IS the arranged shelf — which is
// why one click can simply write the whole current order back with two
// neighbours swapped. The first click on a sheet nobody has arranged writes the
// full list for the first time; every later click rewrites the same list.
const arrangeButtons = (sheetId, at, total) => {
  const bagEl = el('span', 'arrange')
  const move = (to) => {
    const ids = (editorState.merged.things.things[sheetId] ?? []).map(thing => thing.id)
    if (to < 0 || to >= ids.length) return
    ;[ids[at], ids[to]] = [ids[to], ids[at]]
    ;(editorState.things.order ??= {})[sheetId] = ids
    rerender()
  }
  const upBtn = el('button', 'arrange-button', '▲');   upBtn.title = 'move up';   upBtn.disabled = at === 0
  const downBtn = el('button', 'arrange-button', '▼'); downBtn.title = 'move down'; downBtn.disabled = at === total - 1
  upBtn.addEventListener('click', () => move(at - 1))
  downBtn.addEventListener('click', () => move(at + 1))
  bagEl.append(upBtn, downBtn)
  return bagEl
}

// NEW: the rail — one link per MERGED sheet, the shown one highlighted, its
// count read as "shelf + own" (what the books put there, then what this game
// added), a badge for a book's sheet, and a way to the Types tab at the bottom.
// Below the sheets: any bucket in this game's things.json keyed by a sheet no
// layer defines — the state after un-pinning a book. It is not a fault (the
// things are still there, nothing is lost) but it is worth saying out loud.
// Links, not buttons: the hash is the address.
const renderRail = (types, shownType) => {
  const railEl = document.createElement('nav')
  railEl.className = 'rail'
  types.forEach(type => {
    const itemEl = document.createElement('a')
    itemEl.className = `rail-item${type === shownType ? ' rail-item--active' : ''}`
    itemEl.href = hashFor('things', type.id)
    const labelEl = document.createElement('span')
    labelEl.textContent = type.label
    const originBadge = badge(type.id)
    if (originBadge) labelEl.appendChild(originBadge)
    const countEl = document.createElement('span')
    countEl.className = 'rail-count'
    const own = ownBucketOf(type).length
    countEl.textContent = `${bucketOf(type).length - own} + ${own}`
    itemEl.appendChild(labelEl)
    itemEl.appendChild(countEl)
    railEl.appendChild(itemEl)
  })
  Object.keys(editorState.things.things)
    .filter(sheetId => typeById(sheetId) === undefined)
    .forEach(sheetId => railEl.appendChild(el('p', 'wall-hint', `Not on any sheet: ${sheetId} (${editorState.things.things[sheetId].length})`)))
  const manageEl = document.createElement('a')
  manageEl.className = 'rail-manage'
  manageEl.href = hashFor('types')
  manageEl.textContent = 'Manage types →'
  railEl.appendChild(manageEl)
  return railEl
}

// NEW: the Rows tab: the Page card first, then every row a pinned book
// PROPOSES (with this game's overrides beside each proposal), then any override
// left behind by an un-pinned book, then the game's OWN rows as ONE walk of
// content's sheet — groups is a collection of "group", and group's own sheet
// holds a collection of "group", so the nesting lives in the data, not here.
// Before any card is drawn, the paint context every row one-liner reads is
// filled once, over the MERGED tree (see rowSummary).
const renderRowsTab = () => {
  const mergedRows = rowsIn(editorState.merged.content.groups)
  const offered = {}
  mergedRows.forEach(row => { offered[row.id] = offeredBy(row) })
  // NEW: the player's sheet, resolved ONCE for the whole paint — every row's `fills`
  // is judged against this one type.
  const sheetId   = editorState.merged.content.sheet ?? ''
  const sheetType = typeById(sheetId)
  rowsContext = {
    rowIds:   new Set(mergedRows.map(row => row.id)),
    thingIds: new Set(Object.values(editorState.merged.things.things).flat().map(thing => thing.id)),
    dead:     deadRows(editorState.merged.content.groups, offered),
    // NEW: the proposed rows this game has hidden. They are gone from the merged
    // tree, so a row still waiting on one would otherwise read "names a row that
    // does not exist" — true, but not the sentence that helps.
    hiddenRows: new Set(proposedFlat().filter(row => overrideOf(row.id)?.hidden === true).map(row => row.id)),
    sheetType,
    // NEW: the audit's own ONE-CAUSE rule (references.js), applied where it belongs.
    // When the declared TYPE is gone, every bound row would ALSO report "fills a
    // section but this game builds no sheet" — one cause, five sentences. The Page
    // card carries the single sentence that matters; the rows stay quiet until the
    // declaration is fixed.
    sheetDangles: sheetId !== '' && sheetType === undefined
  }
  renderPageCard()
  editorState.proposed.rows.forEach(entry => editorEl.appendChild(buildProposedRowCard(entry)))
  renderOrphanOverrides()
  contentSchema.forEach(entry => {
    editorEl.appendChild(renderField(entry, editorState.content))
  })
}

// NEW: one painter per tab, dispatched like everything else
const TAB_PAINTERS = {
  books:  () => renderBooksTab(currentActions),
  types:  renderTypesTab,
  things: renderThingsTab,
  rows:   renderRowsTab
}

// ─────────────────── page-wide settings card ───────────────────
// One folding card holding everything that isn't a row: meta (content.json),
// the budget (rules.json) and the page theme (themes.json). It lives on the
// Rows tab because it answers the rows' question — what the player sees.
// The comment above each walk says which file its fields come from.
// Its id in uiState.expanded is the literal "page" — it is not a sheet element.

// CHANGED: the budget shown is the MERGED one — this game's number if it wrote
// one, else the first proposal, else the sheet's 10. That is the number the
// player will spend, so it is the number the summary says.
// CHANGED: it also says what the PLAYER builds, because that is now the biggest
// thing about a page — a game with a sheet is a character builder, a game without
// one is a menu, and the folded card should say which. A declaration naming a type
// the library no longer holds gets the validator's own sentence as a ⚠: nothing
// else on this screen would say it until the save was refused.
const pageSummary = () => {
  const sheetId  = editorState.content.sheet ?? ''
  const type     = typeById(sheetId)
  const warnings = editorState.proposed.totalBudget?.conflict ? ['books conflict on the budget'] : []
  if (sheetId !== '' && type === undefined) warnings.push(`builds a sheet that does not exist (${sheetId})`)
  return {
    text: `Page · "${editorState.content.meta.pageTitle}" · budget ${editorState.merged.rules.totalBudget ?? 10} · ${sheetId === '' ? 'no player sheet' : `builds ${type?.label ?? sheetId}`}`,
    warnings
  }
}

const renderPageCard = () => {
  const cardEl = document.createElement('section')
  cardEl.className = 'editor-section'
  const open = uiState.expanded.has('page')
  cardEl.appendChild(buildHeader('page', pageSummary(), open))

  if (open) {
    metaSchema.forEach(entry => {
      cardEl.appendChild(renderField(entry, editorState.content.meta))
    })
    cardEl.appendChild(renderSheetLine())     // NEW: above the budget — what the player builds, then what they may spend on it
    cardEl.appendChild(renderBudgetLine())
    // ── page theme values (themes.json → applied as CSS custom properties by the game) ──
    pageThemeSchema.forEach(entry => {
      cardEl.appendChild(renderField(entry, editorState.themes.page))
    })
  }
  editorEl.appendChild(cardEl)
}

// NEW: the ONE line that says what the PLAYER builds — a type from the MERGED
// library whose shape the player fills in, or "" (this game is a menu of plain
// pickers, which is what every v5 game is). It is the whole of Stage 2 in one
// dropdown: choose a sheet here, and every row card below gains a "Fills" box.
//
// The note under it is that choice's arithmetic, read from the merged library and
// nowhere else — what the player TYPES (Name, then every FIELDS section by name)
// and how many LIST sections the rows may fill. On today's dino it reads
// "the player fills Name, Identity, Attributes, Notes · 8 sections rows may fill",
// and no line of that came from this game: three books put it there.
//
// `afterChange` is written HERE rather than read off the sheet entry, for now. The
// consequence of changing this dropdown — every row bound to the old sheet loses its
// binding — is a CHANGE_HOOKS job, and that table lives in this file.
const renderSheetLine = () => {
  const entry  = FILE_SHEETS.content.find(item => item.key === 'sheet')
  const lineEl = el('div', 'override-line')
  lineEl.appendChild(renderField({ ...entry, afterChange: 'playerSheetChanged' }, editorState.content))
  const type = typeById(editorState.content.sheet ?? '')
  if (type) {
    const typedIn = ['Name', ...type.sections.filter(section => section.kind === 'fields').map(section => section.caption)]
    lineEl.appendChild(el('span', 'field-note', `the player fills ${typedIn.join(', ')} · ${plural(listSectionsOf(type).length, 'section')} rows may fill`))
  }
  return lineEl
}

// NEW: the budget, in four states — because `rules.totalBudget` is optional now
// and an absent key MEANS something. The input is the override: blank un-writes
// the key and lets the proposal back through; a number is this game's answer.
//
//   [    ]  Dinosaur Age 1 proposes 10 · blank = the proposal      nobody decided; the book's 10 applies
//   [ 12 ]  Dinosaur Age 1 proposes 10 — this game: 12  [reset]    this game decided
//   [ 15 ]                                                          no book proposes one (a book-less game)
//   [    ]  ⚠ dup 1 proposes 12, … — set this game's budget to decide   two books disagree; only the game can settle it
const renderBudgetLine = () => {
  const [entry] = totalBudgetSchema
  const proposal = editorState.proposed.totalBudget            // { value, from, conflict? } or null
  const mine     = editorState.rules.totalBudget               // a number, or absent
  const slot     = { peek: () => editorState.rules, ensure: () => editorState.rules }

  const lineEl = el('div', 'override-line')
  lineEl.appendChild(renderField({ ...entry, repaintOnEdit: true }, slot))
  if (proposal === null) {
    if (mine === undefined) lineEl.appendChild(el('span', 'field-note', '(default 10)'))
    return lineEl
  }
  if (proposal.conflict) {
    lineEl.appendChild(el('span', 'summary-warn', `⚠ ${proposal.conflict.map(label => `${titleOf(label)} proposes ${budgetProposedBy(label)}`).join(', ')} — set this game's budget to decide`))
    return lineEl
  }
  const proposalEl = el('span', `proposal${mine !== undefined ? ' proposal--overridden' : ''}`, `${titleOf(proposal.from)} proposes ${proposal.value}`)
  lineEl.appendChild(proposalEl)
  if (mine === undefined) lineEl.appendChild(el('span', 'field-note', '· blank = the proposal'))
  else {
    lineEl.appendChild(el('span', 'field-note', `— this game: ${mine}`))
    lineEl.appendChild(smallButton('reset', () => { delete editorState.rules.totalBudget; rerender() }))
  }
  return lineEl
}
// what ONE layer proposed, by its label — `proposed.totalBudget` records only
// the winner and who else disagreed, and the ⚠ wants every number by name.
const budgetProposedBy = (label) =>
  editorState.books.find(book => book !== null && bookLabel(book.manifest) === label)?.proposals?.totalBudget

// ─────────────────── proposed rows and their overrides ───────────────────

// NEW: the game's house-rule slot for a proposed row. peek never creates —
// rendering must not change what gets saved; ensure is only ever called from a
// click handler.
const overrideOf  = (rowId) => editorState.content.rowOverrides[rowId]
const overrideFor = (rowId) => ({
  peek:   () => editorState.content.rowOverrides[rowId],
  ensure: () => (editorState.content.rowOverrides[rowId] ??= {})
})
// dropping the last key drops the slot too: an empty {} on disk would be a
// house rule that says nothing.
const dropOverride = (rowId, key) => {
  const slot = overrideOf(rowId)
  if (!slot) return
  delete slot[key]
  if (Object.keys(slot).length === 0) delete editorState.content.rowOverrides[rowId]
}

// every proposed row, at every depth, un-overridden — the raw proposals the
// books made. `proposed.rows` is [{ row, from }] at the top; children hang off
// each row and belong to the same book.
const proposedFlat = () => {
  const out = []
  const walk = (rows) => rows.forEach(row => { out.push(row); walk(row.children) })
  walk(editorState.proposed.rows.map(entry => entry.row))
  return out
}
const mergedRowById = (id) => rowsIn(editorState.merged.content.groups).find(row => row.id === id)
const effectiveLabel = (row) => overrideOf(row.id)?.label ?? row.label

// which keys this game has written about a proposed row — the suffix on the
// header ("overridden: label, min") and the answer to "has this row been
// touched at all?". The three homes an override can live in are read in the
// order the card draws them.
const overriddenKeys = (rowId) => [
  ...Object.keys(overrideOf(rowId) ?? {}).filter(key => key !== 'hidden'),
  ...Object.keys(editorState.rules.groupRules[rowId] ?? {}),
  ...Object.keys(editorState.themes.groupThemes[rowId] ?? {})
]

// NEW: one proposed row, as a card. The header is the merged row's usual
// one-liner with two additions: who proposed it, and which keys this game
// overrode. The body is one line per key: the proposal, then this game's value
// when it has one. A hidden row draws its header only.
const buildProposedRowCard = ({ row, from }) => {
  const slot   = overrideFor(row.id)
  const hidden = slot.peek()?.hidden === true
  const merged = mergedRowById(row.id)
  const open   = !hidden && uiState.expanded.has(row.id)

  const cardEl = el('section', 'editor-section proposed-row')
  const summary = hidden
    ? { text: `proposed by ${titleOf(from)} · ${effectiveLabel(row)} · hidden`, warnings: [] }
    : proposedSummary(row, from, merged)
  // a hidden row folds shut and stays shut: there is nothing to set on a row the
  // player will never see, and the one thing there IS to do — [Show] — is right
  // here in the header.
  const headerEl = buildHeader(row.id, summary, open)
  if (hidden) headerEl.querySelector('.card-summary').classList.add('row-hidden')
  headerEl.appendChild(smallButton(hidden ? 'Show' : 'Hide', () => {
    if (hidden) dropOverride(row.id, 'hidden')
    else slot.ensure().hidden = true
    rerender()
  }))
  cardEl.appendChild(headerEl)

  if (open) {
    // the three the game may override in content.json, through one mechanism
    rowOverrideSchema.filter(entry => entry.key !== 'hidden').forEach(entry => {
      cardEl.appendChild(overridable(entry, row, from, slot))
    })
    // min and max: the optionalNumber on rules.groupRules[id] IS the override,
    // so the only new thing here is the proposal beside it.
    groupRulesSchema.forEach(entry => cardEl.appendChild(ruleLine(entry, row.id)))
    // NEW: the same sentence an own row's rules cabinet carries (SHEET_NOTES), said
    // here too — every binding dino writes is on a PROPOSED row, so this is the card
    // the owner is actually looking at when the question comes up.
    cardEl.appendChild(el('p', 'field-note', SHEET_NOTES.groupRules))
    // and the look, which no book proposes — this game's alone
    cardEl.appendChild(themeLine(row.id))
    if (row.children.length > 0) {
      cardEl.appendChild(captionSpan('Nested rows'))
      row.children.forEach(child => cardEl.appendChild(buildProposedRowCard({ row: child, from })))
    }
  }
  return cardEl
}

const proposedSummary = (row, from, merged) => {
  const said = `proposed by ${titleOf(from)} · `
  if (merged === undefined) return { text: said + effectiveLabel(row), warnings: ['not in the merged rows'] }
  const { text, warnings } = rowSummary(merged)
  // a fault must be visible on the folded card too — the twin of the Page card's
  // "books conflict on the budget". The full sentence is inside, beside the input
  // that settles it.
  const clashing = Object.entries(editorState.proposed.rules[row.id] ?? {}).filter(([, entry]) => entry.conflict).map(([key]) => key)
  if (clashing.length > 0) warnings.push(`books conflict on ${clashing.join(' and ')}`)
  const overridden = overriddenKeys(row.id)
  return { text: said + (overridden.length > 0 ? `${text} · overridden: ${overridden.join(', ')}` : text), warnings }
}

// NEW: one line of a proposed row's body — the whole override mechanism, in one
// function. The book's value is ALWAYS on the screen; this game's value, when it
// has one, sits under it and the proposal is struck through. [override] copies
// the proposal into this game's slot so the author edits from where the book
// left off; [reset] deletes the key and lets the proposal show through again.
// CHANGED: Stage 2 offers [override] for the label AND for `fills`. Binding a
// FROZEN book's row to a section of the player's sheet is the whole reason `fills`
// is on rowOverrideSchema at all: dino's four bindings are overrides of rows that
// dinosaur-age 1 proposed, and no new edition of that book was cut to get them.
// Re-aiming (`query`) and re-gating (`showWhen`) a book's row are still bigger ideas
// than this screen offers; a hand-written override of either is still drawn here,
// with its [reset], so nothing is hidden.
const OVERRIDABLE = new Set(['label', 'fills'])
const overridable = (entry, row, from, slot) => {
  const mine       = slot.peek()?.[entry.key]
  const overridden = mine !== undefined

  const bagEl  = document.createDocumentFragment()
  const lineEl = el('div', 'override-line')
  lineEl.appendChild(captionSpan(entry.caption))
  lineEl.appendChild(el('span', `proposal${overridden ? ' proposal--overridden' : ''}`, proposalText(entry, row, from, overridden)))

  const actionsEl = el('span', 'override-actions')
  if (overridden) actionsEl.appendChild(smallButton('reset', () => { dropOverride(row.id, entry.key); rerender() }))
  // CHANGED: `?? ''` — the frozen books were written before v6, so a proposal row
  // carries no `fills` key at all. Overriding one therefore starts from the empty
  // binding, which is the honest starting point: "" IS "fills nothing".
  else if (OVERRIDABLE.has(entry.key)) actionsEl.appendChild(smallButton('override', () => { slot.ensure()[entry.key] = structuredClone(row[entry.key] ?? ''); rerender() }))
  lineEl.appendChild(actionsEl)
  bagEl.appendChild(lineEl)

  // the real builder, on the real override object — which exists, because the
  // only way to get here is to have written a key into it.
  // NEW for `fills`: its options are resolved HERE and handed in. An override SLOT
  // is a bare { label, fills } with no id, so the choice builder would pass THAT to
  // the source — and the source needs the ROW, to know which sections fit its query
  // type. The row handed over is the MERGED one, so if this game also overrode the
  // query, the sections offered fit what the player will actually see.
  if (overridden && OVERRIDABLE.has(entry.key)) {
    const fitting = entry.key === 'fills' ? { options: OPTION_SOURCES.fillableSections(mergedRowById(row.id) ?? row) } : {}
    bagEl.appendChild(renderField({ ...entry, caption: 'this game', default: '', ...fitting }, slot.peek()))
  }
  return bagEl
}

// what the proposal line SAYS, per key: a label is quoted, a query and a gate
// are read out as the same sentences the row's header uses — over the EFFECTIVE
// value, so an overridden query reads as what the player will get.
const proposalText = (entry, row, from, overridden) => {
  if (entry.key === 'label') return `${titleOf(from)} proposes "${row.label}"`
  // NEW: what the BOOK said about where the picks land — which, for every book on
  // today's shelf, is nothing at all. That is not a gap: a book proposes a row, and
  // where its picks land is the GAME's decision, because only the game declares the
  // sheet. So this line usually reads "Dinosaur Age 1 proposes nothing" with this
  // game's own binding under it.
  if (entry.key === 'fills') return `${titleOf(from)} proposes ${row.fills ? sectionCaption(row.fills) : 'nothing'}`
  const merged = mergedRowById(row.id) ?? row
  const said = entry.key === 'query' ? showsPhrase(merged.query) : whenSentence(merged.showWhen)
  return `${said} — ${overridden ? 'this game' : 'proposed'}`
}

// NEW: min / max — the proposal, then the input that overrides it. Blank means
// "the proposal", which is why the note says so; a conflict between two books
// is the one case where blank is not enough, so the merge's own sentence is
// carried here word for word.
const ruleLine = (entry, rowId) => {
  const proposal = editorState.proposed.rules[rowId]?.[entry.key]
  const mine     = editorState.rules.groupRules[rowId]?.[entry.key]
  const slot     = {
    peek:   () => editorState.rules.groupRules[rowId],
    ensure: () => (editorState.rules.groupRules[rowId] ??= {})
  }
  const lineEl = el('div', 'override-line')
  lineEl.appendChild(captionSpan(entry.caption))
  if (proposal) lineEl.appendChild(el('span', `proposal${mine !== undefined ? ' proposal--overridden' : ''}`, `${titleOf(proposal.from)} proposes ${proposal.value}`))
  lineEl.appendChild(renderField({ ...entry, caption: '', repaintOnEdit: true }, slot))
  if (proposal && mine === undefined) lineEl.appendChild(el('span', 'field-note', '(blank = the proposal)'))
  if (proposal?.conflict) {
    const path = `rules.groupRules[${JSON.stringify(rowId)}].${entry.key}`
    lineEl.appendChild(el('span', 'summary-warn', `⚠ ${faultAt(path) ?? `${proposal.conflict.map(titleOf).join(' and ')} propose different values for ${entry.key} — this game decides`}`))
  }
  return lineEl
}

// NEW: the look. Books propose no themes in Stage 1, so this is the one line on
// a proposed row's card that is purely this game's — said out loud rather than
// left to look like an override of nothing.
const themeLine = (rowId) => {
  const [entry] = groupThemeSchema
  const slot = {
    peek:   () => editorState.themes.groupThemes[rowId],
    ensure: () => (editorState.themes.groupThemes[rowId] ??= {})
  }
  const lineEl = el('div', 'override-line')
  lineEl.appendChild(renderField(entry, slot))
  lineEl.appendChild(el('span', 'field-note', "this game's look (books propose no look)"))
  return lineEl
}

// NEW: an override for a row nobody proposes any more — what un-pinning a book
// leaves behind. Not a fault (the merge ignores it): refusing to save over it
// would lock the author out of the very screen that fixes it. A yellow line and
// a [Forget] instead.
const renderOrphanOverrides = () => {
  const proposedIds = new Set(proposedFlat().map(row => row.id))
  const orphans = Object.keys(editorState.content.rowOverrides).filter(id => !proposedIds.has(id))
  if (orphans.length === 0) return
  const noticesEl = el('section', 'notices')
  orphans.forEach(id => {
    const lineEl = el('p', 'notice-line', `rowOverrides[${JSON.stringify(id)}] — no pinned book proposes this row`)
    lineEl.appendChild(smallButton('Forget', () => { delete editorState.content.rowOverrides[id]; rerender() }))
    noticesEl.appendChild(lineEl)
  })
  editorEl.appendChild(noticesEl)
}

// ───────────────────────── one-liners ─────────────────────────

// NEW: what the Rows tab knows for the length of ONE paint: every row id,
// every thing id (for the gate check), the rows that can never appear and the
// proposed rows this game has hidden. Filled by renderRowsTab before any row
// card is drawn; rowSummary reads it.
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
// CHANGED: a type is counted in SECTIONS now (its fields live inside them), and
// its things are counted as the ones THIS GAME holds — a book's shelf is the
// book's, and the Things tab is where the merged count belongs.
const typeSummary = (type) => ({ text: `${type.label} · ${plural(type.sections.length, 'section')} · ${plural(ownBucketOf(type).length, 'thing')} in this game`, warnings: [] })
// NEW: a section reads as what it holds — fixed slots, or entries from a shelf.
const sectionSummary = (section) => ({
  text: section.kind === 'list'
    ? `${section.caption} · list of ${sheetLabel(section.of)} · ${plural((section.placement ?? []).length, 'placement field')}`
    : `${section.caption} · fields · ${plural((section.fields ?? []).length, 'field')}`,
  warnings: []
})
// CHANGED: a thing's one-liner now also carries the placement audit's finding —
// a pet whose Origin names a species that left the shelf says so where the
// author is looking, not only in the console.
const thingSummary = (thing, sheetName) => {
  const type = typeById(sheetName)
  const warnings = []
  if (type) listSectionsOf(type).forEach(section => {
    const placed = thing[section.key]
    if (!Array.isArray(placed)) return
    const shelf = new Set((editorState.merged.things.things[section.of] ?? []).map(target => target.id))
    if (placed.some(placement => !shelf.has(placement?.thing))) warnings.push('places a thing that does not exist')
  })
  return { text: `${thing.name} · ${thing.cost} pt${thing.cost === 1 ? '' : 's'}`, warnings }
}

// NEW: the row's header sentence: label · what it shows · how many things ·
// min/max · when it is shown. Every "shows n things" here comes from the same
// filterThings the game runs, so the count the author reads is the count the
// player gets. A broken reference (hand-edited file) becomes a ⚠ instead of a part.
// CHANGED: everything it reads is MERGED — the type, the bucket, the min/max
// after the cascade. It is handed the merged row, so a proposed row and an own
// row get the very same sentence.
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
      if (shown.length === 0 && (editorState.merged.rules.groupRules[row.id]?.min ?? 0) > 0) warnings.push('required but matches nothing')
    }
  }
  // NEW: where this row's picks LAND, right after what it shows — the two are one
  // thought, which is why `fills` sits beside `query` on the sheet. checkFills is
  // the one function three readers share: this badge, the engine's console warning
  // and the server's refusal are the same bytes, never written twice. It is silent
  // for a row that fills nothing (every v5 row is that row) and silent while the
  // declaration itself dangles (rowsContext.sheetDangles).
  const fillsProblem = rowsContext.sheetDangles ? null : checkFills(row, rowsContext.sheetType)
  if (fillsProblem) warnings.push(fillsProblem)
  else if ((row.fills ?? '') !== '') parts.push(`fills ${sectionCaption(row.fills)}`)
  const slot = editorState.merged.rules.groupRules[row.id]
  if (slot?.min !== undefined) parts.push(`min ${slot.min}`)
  if (slot?.max !== undefined) parts.push(`max ${slot.max}`)
  const gateProblem = checkShowWhen(row, rowsContext.rowIds, rowsContext.thingIds)
  if (gateProblem) {
    // NEW: the friendlier twin. The validator's sentence for a gate on a hidden
    // row is "names a row that does not exist" — true (the merge dropped it) but
    // it hides the cause, which is one click away on this very screen.
    const waited = row.showWhen.kind === 'anyInRow' ? row.showWhen.row : null
    if (waited !== null && rowsContext.hiddenRows.has(waited)) {
      const waitedRow = proposedFlat().find(other => other.id === waited)
      warnings.push(`waits on a hidden row ("${waitedRow ? effectiveLabel(waitedRow) : waited}") — show it, or hide this row too`)
    } else warnings.push(`show-when ${gateProblem}`)
  } else if (row.showWhen.kind !== 'always') parts.push(whenPhrase(row.showWhen))
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

// NEW: the whole query in words, for the proposal line on a proposed row's card.
// Unlike wherePhrase this one is TOTAL — it is drawn beside a book's proposal,
// which may name a sheet a later un-pin took away, and a card must still paint.
const showsPhrase = (query) => {
  if (query.type === '') return 'nothing yet'
  const type = typeById(query.type)
  if (!type) return `a type that does not exist (${query.type})`
  const problem = checkWhere(query.where, type)
  if (problem) return `${type.label} — filter ${problem}`
  return query.where === null ? `${type.label} (every thing)` : `${type.label}${wherePhrase(query.where, type)}`
}

// the gate in words — only called once checkShowWhen has passed, so the
// thing or row it names exists SOMEWHERE in the files. For a thing that is
// "somewhere in a bucket no type owns" (a hand-edited things.json), the
// dropdown has no label for it, so the id is shown instead of a crash.
const whenPhrase = (gate) => {
  if (gate.kind === 'thingPicked') return `shown when "${thingLabel(gate.thing)}" is picked`
  return `shown when anything in "${rowsIn(editorState.merged.content.groups).find(row => row.id === gate.row).label}" is picked`
}
// NEW: whenPhrase's total twin, for the same reason showsPhrase exists.
const whenSentence = (gate) => {
  if (gate.kind === 'always') return 'Always'
  if (gate.kind === 'thingPicked') return `shown when "${thingLabel(gate.thing)}" is picked`
  const waited = rowsIn(editorState.merged.content.groups).find(row => row.id === gate.row)
  return `shown when anything in "${waited?.label ?? gate.row}" is picked`
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
// It reads the game's OWN file, always: a cabinet is where a house rule lives,
// and a house rule is the game's.
const cabinetOf = (entry) => editorState[entry.file][entry.cabinet]

// when an element leaves, everything the side cabinets hold about it leaves
// too — and so does everything they hold about every element INSIDE it, or
// rules.json/themes.json would keep orphan UUIDs forever. The sheet is the
// map: an attachment entry says which cabinet to clear, a collection entry
// says where the descendants are. For a row: clear its rules and theme
// slots, then repeat for every child (a row, so it repeats all of this).
// A type walks its sections, a section its fields (no cabinets, so that stops);
// a thing has neither.
// Covers any future sheet with cabinets or nesting without touching this function.
// CHANGED: `?? []` on the collection, because a collection entry may be absent
// by showIf — a list section has no `fields` key at all.
const cascadeDelete = (sheetName, element) => {
  SHEETS[sheetName].forEach(entry => {
    if (entry.type === 'attachment') {
      delete cabinetOf(entry)[element.id]
    }
    if (entry.type === 'collection') {
      (element[entry.key] ?? []).forEach(child => cascadeDelete(entry.of, child))
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
//   thing                 another thing's placements           the placement is spliced out (forgetPlaced)
//   thing                 things.order[sheet]                  the id leaves the line      (forgetArranged)
//   section (of changed)  placements under its key             emptied (forgetSectionPlacements)
//   row (+ subtree)       row.showWhen.row                     { kind: "always" }          (forgetRow per id in idsBelow)
// NEW, the player's sheet — two pointers, and a binding may live in either of two
// places, so each cause repairs both:
//   section (gone/kind flipped/re-aimed)  row.fills             the key goes to ""   (forgetFills)
//                                         rowOverrides[…].fills the key is dropped   (forgetOverrideFills)
//   the TYPE the player's sheet names     content.sheet         the key goes to ""   (forgetPlayerSheet)
//   content.sheet itself (a NEW sheet)    every binding that no longer fits         (forgetUnfitFills)
const REMOVE_HOOKS = {
  type: (type) => {
    // its own things go, and every gate and every PLACEMENT on them — before the bucket does
    ownBucketOf(type).forEach(thing => {
      say(forgetThing(editorState.content.groups, thing.id))
      say(forgetPlaced(editorState.things, editorState.merged.types.types, thing.id))
    })
    delete editorState.things.things[type.id]
    forgetShelfOrder(type.id)      // an arrangement of a shelf that is gone is fault F15, and unsaveable
    say(forgetType(editorState.content.groups, type.id))
    // NEW: if this type WAS the sheet the player builds, this game builds no sheet
    // now — and every row bound to one of its list sections loses its binding. Two
    // repairs and not one, on purpose: forgetPlayerSheet deliberately does not walk
    // the rows, because a row names a SECTION and not a type. So the sections are
    // asked for by name, one at a time, and each keeps its own sentence.
    say(forgetPlayerSheet(editorState.content, type.id))
    listSectionsOf(type).forEach(section => forgetBinding(section.id))
    if (uiState.selectedType === type.id) uiState.selectedType = ''            // the Things pane falls back to the first type at paint
  },
  fieldDef: (field) => say(forgetField(editorState.content.groups, field.id)),
  // NEW: a section takes its fields with it, so every condition built on one goes too
  // — and every BINDING that named it, because nothing can fill a section that is gone.
  section:  (section) => {
    (section.fields ?? []).forEach(field => say(forgetField(editorState.content.groups, field.id)))
    forgetBinding(section.id)
  },
  thing:    (thing) => {
    say(forgetThing(editorState.content.groups, thing.id))
    say(forgetPlaced(editorState.things, editorState.merged.types.types, thing.id))
    forgetArranged(thing.id)
  },
  group:    (row)   => idsBelow(row).forEach(id => say(forgetRow(editorState.content.groups, id)))   // the row AND its subtree
}
// a thing's sheet is filed under its type's id, so it is found by asking
// "is this sheet name a type?" — the same test cardStyleOf makes
const hookFor = (sheetName) => REMOVE_HOOKS[sheetName] ?? (isTypeSheet(sheetName) ? REMOVE_HOOKS.thing : undefined)

// NEW: the arrangement is a list of ids. An id that is no longer on the shelf is
// fault F15 and refuses the save, so a removed thing leaves the line it was
// standing in — and a shelf that is gone takes its whole line with it.
const forgetArranged = (thingId) => {
  const order = editorState.things.order
  if (order === undefined) return
  Object.keys(order).forEach(sheetId => {
    const at = order[sheetId].indexOf(thingId)
    if (at !== -1) order[sheetId].splice(at, 1)
  })
}
const forgetShelfOrder = (sheetId) => {
  const order = editorState.things.order
  if (order === undefined) return
  delete order[sheetId]
  if (Object.keys(order).length === 0) delete editorState.things.order
}

// NEW: a binding to the player's sheet lives in ONE of two places, and which one
// depends on who wrote the row: on the game's own row (`row.fills`), or in
// content.rowOverrides for a row a BOOK proposed — which is where all four of dino's
// bindings live, because dinosaur-age 1 is frozen. references.js's forgetFills walks
// the rows; this walks the cabinet beside them. `forgetBinding` is the one door the
// hooks call, so no hook has to remember there are two places.
// The KEY is dropped, not the slot: an override may also carry a label, and a slot
// left holding nothing is dropped by dropOverride's own rule.
const forgetOverrideFills = (sectionId) => {
  const changed = []
  Object.keys(editorState.content.rowOverrides).forEach(rowId => {
    if (editorState.content.rowOverrides[rowId].fills !== sectionId) return
    dropOverride(rowId, 'fills')
    changed.push({ row: mergedRowById(rowId) ?? { label: rowId }, what: 'fills nothing now — the section it filled changed or was removed' })
  })
  return changed
}
const forgetBinding = (sectionId) => {
  say(forgetFills(editorState.content.groups, sectionId))
  say(forgetOverrideFills(sectionId))
}

// NEW: the game changed WHICH sheet the player builds. Every binding is re-judged
// against the new one — by the very function the engine warns with and the server
// refuses with — and the ones that no longer fit go, each named.
// Why this is not forgetFills: that repair is keyed by SECTION, which is the right
// shape when a section LEAVES (every row naming it is wrong, by definition). Here
// every section is still where it was and the SHEET underneath them moved, so the
// question is per row: two rows may name one section while only one of them still
// fits it, and clearing by id would take the innocent one with it.
const forgetUnfitFills = (content) => {
  const type    = typeById(content.sheet ?? '')
  const said    = 'fills nothing now — this game builds a different sheet'
  const changed = []
  rowsIn(content.groups).forEach(row => {                       // the game's own rows
    if ((row.fills ?? '') === '' || checkFills(row, type) === null) return
    row.fills = ''
    changed.push({ row, what: said })
  })
  Object.entries(content.rowOverrides).forEach(([rowId, slot]) => {   // and the bindings it wrote onto a book's rows
    if (slot.fills === undefined) return
    // judged on the MERGED row: the override's value meets the BOOK's query there,
    // and that pair is what checkFills has to weigh. (The merge is one paint stale
    // here, which is exactly right — it still holds the binding being judged.)
    const merged = mergedRowById(rowId)
    if (merged !== undefined && checkFills(merged, type) === null) return
    dropOverride(rowId, 'fills')
    changed.push({ row: merged ?? { label: rowId }, what: said })
  })
  return changed
}

// NEW: hooks for a VALUE change, named on the sheet entry (afterChange) the way
// optionsFrom names an option source. The choice builder runs it after writing.
const CHANGE_HOOKS = {
  fieldKindChanged: (field) => {
    say(forgetField(editorState.content.groups, field.id))   // the old kind's operators and values no longer fit
    // NEW: a choice needs options and no other kind may carry them. An empty
    // list is unsaveable ("a choice needs at least one option") — loudly wrong
    // beats silently blank.
    if (field.type === 'choice') field.options = []
    else delete field.options
  },
  // NEW: a section is one shape or the other, never half of both. Turning a
  // fields section into a list drops its fields (and every condition built on
  // them); turning it back drops the shelf it pointed at.
  sectionKindChanged: (section) => {
    if (section.kind === 'fields') {
      delete section.of
      delete section.placement
      section.fields ??= []
    } else {
      (section.fields ?? []).forEach(field => say(forgetField(editorState.content.groups, field.id)))
      delete section.fields
      section.of ??= OPTION_SOURCES.sheets()[0]?.value ?? ''
      section.placement ??= []
    }
    // NEW: a fields section holds no entries, so nothing may fill it, and a section
    // that has just BECOME a list aims at a shelf no existing binding was judged
    // against. Either way the binding is void. (Idempotent: on the common path no
    // row names this section and nothing is said.)
    forgetBinding(section.id)
  },
  // a section re-aimed at another shelf: every entry placed under it named a
  // thing on the OLD shelf, so the arrays are emptied rather than left dangling.
  // NEW: and every ROW that filled it was showing the old shelf, so its binding goes
  // too — a row must show what the section it fills lists.
  sectionTargetChanged: (section) => {
    say(forgetSectionPlacements(editorState.things, editorState.merged.types.types, section.id))
    forgetBinding(section.id)
  },
  // NEW: the game now builds a DIFFERENT sheet (or none). Named here rather than on
  // the sheet entry itself for now — see renderSheetLine. Every binding is re-judged
  // and each casualty is named, so an engine warning about `fills` always means
  // "somebody hand-edited a file" and never "the editor did this and said nothing".
  playerSheetChanged: (content) => say(forgetUnfitFills(content))
}
// CHANGED: a repair may now report a THING as well as a row (a placement lost) — or
// NEITHER: `content.sheet` is a declaration the whole game makes, belonging to no row
// and no thing. So the noun is read from whichever the entry carries, and the third
// one carries no name to quote.
const say = (changed) => changed.forEach(entry => {
  const who = entry.row ? `Row "${entry.row.label}"` : entry.thing ? `Thing "${entry.thing.name}"` : 'This game'
  console.warn(`${who} ${entry.what}`)
})

// ───────────────────────── newborns ─────────────────────────

// a brand-new element, born from its sheet: a forever-id first, then each
// entry's default in sheet order — the same key order the old literals had and
// the saved files have. Three kinds of entry are skipped: attachment entries
// (no key — nothing is stored in the element), entries whose default is null
// (the sheet rule: null = key not written at birth) and — NEW — entries whose
// showIf the newborn does not satisfy YET. The sheet's order is what makes that
// work: `kind` comes before the three keys it governs, so a section is born
// fields-shaped and a field is born without `options`.
// structuredClone hands back a SEPARATE COPY of each default. Arrays and
// objects are references: without the copy every newborn row would share ONE
// children array — and ONE query object, so picking a type on row A would
// show up on row B.
// (No rules/themes slots are born on purpose: the game's hydration defaults
// cover absent entries, and editing min/max/background creates them — ensure.)
const newborn = (sheetName) => {
  const born = { id: crypto.randomUUID() }
  SHEETS[sheetName].forEach(entry => {
    if (entry.key === undefined) return                            // attachment: nothing lives in the element
    if (entry.showIf && born[entry.showIf.key] !== entry.showIf.value) return   // NEW: not this shape
    if (entry.default === null) return                             // sheet rule: null = not written at birth
    born[entry.key] = structuredClone(entry.default)               // a FRESH copy, never the sheet's own [] or {}
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
  section:  { className: 'item-card',      summary: sectionSummary },   // NEW: a type's sections fold too — eleven of them on Character
  thing:    { className: 'item-card',      summary: thingSummary },
  fieldDef: { className: 'item-card' }                                   // no summary = always open
}
const isTypeSheet  = (sheetName) => editorState.merged.types.types.some(type => type.id === sheetName)
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

// NEW: the whole read-only story, in one function. A card a BOOK owns keeps its
// fold (looking is always allowed) and loses every other control: the sheet
// walk above built the card exactly as it builds an editable one, and this
// turns it off afterwards. Nothing in the builders knows about books.
// The badge is prepended to the header, and only when it says something the
// enclosing card has not already said — Stats' four numbers inside Basic's
// Attributes are worth a badge; Basic's own eleven sections are not.
const lockCard = (cardEl, ownerLabel, showBadge) => {
  cardEl.classList.add('locked')
  cardEl.querySelectorAll('input, select, textarea, button').forEach(controlEl => {
    if (!controlEl.classList.contains('card-toggle')) controlEl.disabled = true
  })
  if (!showBadge) return
  const headerEl = cardEl.querySelector('.group-header')
  if (headerEl) headerEl.prepend(el('span', 'origin-badge', ownerLabel === GAME_LAYER ? 'this game' : `from ${titleOf(ownerLabel)}`))
}

// NEW: whose card is being walked right now. A nested card compares its own
// owner with this to decide whether its badge would be news. It is a module
// variable rather than a parameter because the path from a card to its nested
// card runs through the collection builder, which has no business knowing.
let cardOwner = null

// ONE function builds every card and RETURNS it: a header row holding the
// one-liner and Remove, then — only when the card is open — the element's
// sheet walked top to bottom: scalars, cabinets, lists, in sheet order.
// A folded card costs nothing to draw: vampire's 64 things are 8 one-liners
// at a time. list = the array the collection builder read this element from.
// The builder owns it and lends it ONE hop so Remove can splice it; it is
// never passed further down (a nested list is re-read from element[entry.key]
// by the next collection entry).
// CHANGED: a card the game does not own gets no Remove and, after the walk,
// lockCard. Fail closed: an id the merge never claimed (it should not exist)
// reads as not-own and is drawn read-only rather than offered for editing.
const buildCard = (sheetName, element, list) => {
  const style  = cardStyleOf(sheetName)
  const open   = !style.summary || uiState.expanded.has(element.id)
  const owner  = editorState.origins.get(element.id)
  const locked = owner !== GAME_LAYER
  const parent = cardOwner

  const cardEl = document.createElement('section')
  cardEl.className = style.className

  const headerEl = style.summary ? buildHeader(element.id, style.summary(element, sheetName), open) : plainHeader()

  if (!locked) {
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
  }
  cardEl.appendChild(headerEl)

  // the card IS the sheet: every entry goes through renderField, so a
  // collection entry lands in the collection builder (which calls buildCard
  // again for each element — that loop is the recursion) and an attachment
  // entry lands in the attachment builder.
  if (open) {
    cardOwner = owner
    SHEETS[sheetName].forEach(entry => {
      cardEl.appendChild(renderField(entry, element))
    })
    cardOwner = parent
  }
  if (locked) lockCard(cardEl, owner, owner !== parent)
  return cardEl
}

// the header of a card that never folds (a field definition): Remove only
const plainHeader = () => {
  const headerEl = document.createElement('div')
  headerEl.className = 'group-header'
  return headerEl
}
