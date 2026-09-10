// CHANGED (stage 4): `S` comes with editorState — this page's row of the SUBJECT table
// (dinoEdit/subject.js). Everything below that used to spell "a game" — which drawer holds
// the rows, which cabinet an attachment points at, what origins calls the layer the author
// owns, what mints an id, whether a repair may write at all — asks it instead.
import { editorState, buildSheets, remerge, S } from './state.js'
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
  rowOverrideSchema, groupRulesSchema, groupThemeSchema, FILE_SHEETS, bookSchema,
  queryableFields, fieldById, asOption, placementSheet, listSectionsOf, fieldsOfType, coreThingSchema,
  MINTS   // NEW: which sheet mints which KIND of id — the noun in a book's <book>:<noun>-<n>
} from '/config/schema.js'
// NEW: the player's sheet, as vocabulary — the leaf the engine, the validator and
// this screen all read. Same discipline as query.js and visibility.js above: the
// question "why can this row not fill what it names?" is answered by ONE function
// (checkFills), so the badge this screen draws is the sentence the player's console
// warns with and the sentence the server refuses the save with. Never write it twice.
import { fillableSections, sectionById, checkFills, quantityFieldOf } from '/config/sheet.js'
// NEW: what an entry DEMANDS of the player's sheet — the same leaf the engine, the
// validator and the server read. Same discipline as sheet.js above: "why can this
// demand not be judged?" is answered by ONE function (checkDemand), so the ⚠ this
// screen draws is the sentence the player's console warns with and the sentence the
// server refuses the save with; and `demandText` is the very phrase the player's card
// prints, so a locked book's rule reads here exactly as it reads in the shop.
import {
  demandFields, demandFieldById, demandOperators, demandOperatorOf,
  demandsOf, checkDemand, demandText
} from '/config/demands.js'
// NEW: the shared logic under engine/config/ — the same functions the game
// runs, so what the author reads here is what the player gets there.
// query.js answers a row's question; visibility.js says when a row shows;
// references.js walks the row tree and repairs it when something is removed.
import { OPERATORS, operatorOf, WHERE_VALUE_DEFAULT, checkWhere, filterThings, valuesOf } from '/config/query.js'
import { SHOW_WHEN_KINDS, checkShowWhen, deadRows, idsBelow } from '/config/visibility.js'
// NEW on this line: forgetFills and forgetPlayerSheet — the two repairs a removed
// section and a removed TYPE owe the player's sheet; and, NEW again, forgetDemandField
// and forgetDemanded — the two a removed SLOT and a removed THING owe every demand that
// named them (see REMOVE_HOOKS).
import { rowsIn, forgetType, forgetField, forgetThing, forgetRow, forgetPlaced, forgetSectionPlacements, forgetFills, forgetPlayerSheet, forgetDemandField, forgetDemanded } from '/config/references.js'
// NEW: the merge's two names the screen speaks — which layer is "the game" and
// how a book layer is labelled ("basic 1") — plus the sentence maker for a fault.
// CHANGED: GAME_LAYER is not spelled here any more — which label means "mine" is the
// subject table's answer (see `mine` below), because a book's own layer is never the game
// layer. bookLabel still is: it is how a loaded layer is matched to an origin.
import { bookLabel } from '/config/merge.js'
import { problemText } from '/config/validate.js'
// NEW: the screen's own memory — tab, rail type, open cards. See uiState.js.
import { uiState, TABS, hashFor } from './uiState.js'
// NEW: the fourth tab, in its own file — it is the only tab that talks to the
// server while a game is open, so it keeps its own company.
// NEW on this line: bookTitle — the ONE way "Dinosaur Age 2" is spelled, wherever a book
// is named in chrome (§6). The Books tab owns the words for a book because it is the tab
// that reads the shelf.
// NEW on this line (stage 4): the two the read-only banner needs — the freeze's own sentence
// and the number a cut would take. Both live in books.js, beside everything else that reads
// the shelf.
import { renderBooksTab, bookTitle, frozenEditionSentence, nextEditionOf } from './books.js'

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

// NEW: a miss warns ONCE, BY NAME. The file's existing misses (renderField's "No builder
// for type", render's "No painter for tab") sit on a path that runs once per paint, so
// warning every time is the same as warning once. A missing DRAWER does not: it is reached
// from an attachment entry on every row of every paint, so the plain warn would bury the
// console under one true sentence repeated a thousand times. The sentence is the key, so
// two different misses both get said.
const warned = new Set()
const warnOnce = (sentence) => {
  if (warned.has(sentence)) return
  warned.add(sentence)
  console.warn(sentence)
}

// NEW: the three that read the game's OWN drawer, because a WRITE only ever
// goes there. ownBucketOf is the array a Remove splices and an Add pushes into;
// ownThing hands back the REAL object behind a merged clone, so a card built for
// an own thing edits the thing that gets saved — never the copy the merge made.
const ownBucketOf = (type) => editorState.things.things[type.id] ?? []
const ownThing    = (id)   => Object.values(editorState.things.things).flat().find(thing => thing.id === id)
// NEW: the subject's OWN row tree — content.groups for a game, proposals.groups for a book.
// The reference repairs (REMOVE_HOOKS, CHANGE_HOOKS) all walk it, and every one of them is
// the same repair either way: a removed field leaves a book's proposed row exactly as it
// leaves a game's own one. So this is the table's answer and not a second set of hooks.
const ownRows = () => S().rows(editorState)
// NEW: the label origins gives THE LAYER THE AUTHOR IS EDITING. For a game that is the
// constant GAME_LAYER, as it always was; for a book it is that book's own layer label
// ("dinosaur-age 2"), because in book mode the subject is the last BOOK layer and no layer
// is ever labelled GAME_LAYER. CHANGED: this is the parameter the whole ownership story
// turns on — isOwn, the badges and the lock all compared against a constant before, which
// would have drawn every one of a book author's own cards read-only.
// Named `ownLayer` and not `mine` on purpose: renderBudgetLine and ruleLine already have a
// local `mine` (this game's value for a key a book proposed), and two meanings of one word
// in one file is how a shadowed helper becomes a bug nobody can see.
const ownLayer = () => S().label(editorState)
// NEW: how the subject refers to ITSELF on a badge — the first cell of the DOM-side half of
// the subject table (see subject.js's header: the words and the painters stay here, because
// a table that mixed them could not be driven by a pure check). The rest of that table is
// SCREEN, below the Rows tab, where the painters it names are already written.
const selfWord = () => SCREEN[editorState.subject.kind].self

// NEW: "may this be edited?" — one question, asked of the merge's origins map.
// Everything the subject defined is the subject's to change; everything a book
// underneath defined is read-only here and is changed by publishing a new edition of
// that book.
const isOwn = (id) => editorState.origins.get(id) === ownLayer()

// NEW: the type the PLAYER builds, or undefined — the SUBJECT of every demand on this
// screen, and the one thing a demand is ever about. Asked at draw time because the
// declaration is one dropdown away on the Rows tab, and a demand's whole vocabulary
// changes with it. (sectionCaption and fillableSections ask the same question, so they
// ask it here now: one question, one function.)
const playerSheetType = () => typeById(editorState.merged.content.sheet ?? '')
// NEW: a thing's name from its id, over the MERGED world — what demandText is handed so
// that demands.js never reaches for a shelf of its own. Total: an id nothing defines
// reads as itself, exactly as the engine's nameOfThing does.
const thingName = (id) =>
  Object.values(editorState.merged.things.things).flat().find(thing => thing.id === id)?.name ?? id

// NEW: a layer label as the author's own words. The merge speaks in folder
// terms ("basic 1"); a badge should say what the Library says ("Basic 1").
// CHANGED (§6): the one naming rule — CHROME SPEAKS TITLES, FAULT PATHS SPEAK FOLDERS.
// "Dinosaur Age 2" is built by the ONE function that builds it everywhere (books.js's
// bookTitle, which the Library and the Books tab now share); the raw layer label
// ("dinosaur-age 2") is a fault-path word and is only ever the last resort, for a layer
// this page never loaded and therefore has no title for.
const titleOf = (label) => {
  if (label === ownLayer()) return selfWord()
  const layer = editorState.books.find(book => book !== null && bookLabel(book.manifest) === label)
  return layer ? bookTitle(layer.manifest.title, layer.manifest.edition) : label
}
// NEW: the small grey pill that says where a card came from. Nothing for
// something this game owns and can edit — a badge on every own card is noise.
// `always` is for a LOCKED card that the game happens to own: a hand-written
// addition into a book's sheet, which reads "this game" rather than nothing.
const badge = (id, always = false) => {
  const label = editorState.origins.get(id)
  if (label === undefined) return null
  if (label === ownLayer() && !always) return null
  return el('span', 'origin-badge', label === ownLayer() ? selfWord() : `from ${titleOf(label)}`)
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

// NEW: ONE line of a condition — WHICH slot, WHICH operator, WHICH value. EXTRACTED,
// not copied: a row's `where` and a thing's `demands[i]` are the same three keys in the
// same order (query.js's, by identity), so this project draws them with one function
// and there is exactly one grammar to learn. Two callers today; the day a fourth select
// is wanted, both gain it at once.
// Everything that differs between the two arrives as `sources`, and nothing else does:
//   gone         what a stored slot the world no longer holds is labelled
//   fields()     the slot dropdown's options; fieldOf(id) resolves one, or undefined
//   onField(v)   what a NEW slot MEANS to the caller — a row's condition may become
//                "every thing" (null), a demand is reborn complete. The caller writes,
//                this repaints, because a new slot changes the two selects after it.
//   operators(f) which operators fit THIS slot
//   onOp(f, v)   the operator write, which is the one write both callers spell alike
//   value(f)     the third control: a select, a number box, or NOTHING at all (an
//                operator that names nothing has no value to pick)
const conditionLine = (lineEl, condition, sources) => {
  const held = condition?.field ?? ''      // null is a row's "every thing", and only ever that
  lineEl.appendChild(selectOf(withCurrent(sources.fields(), held, sources.gone), held, value => { sources.onField(value); rerender() }))
  if (condition === null) return lineEl
  const field = sources.fieldOf(condition.field)
  if (!field) return lineEl                // the select says so; the card's ⚠ says what it costs
  lineEl.appendChild(selectOf(withCurrent(sources.operators(field), condition.op, 'not valid for this kind'), condition.op, value => { sources.onOp(field, value); rerender() }))
  const valueEl = sources.value(field)
  if (valueEl) lineEl.appendChild(valueEl)
  return lineEl
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

  // 2. the condition — the field, the operator and the value, drawn by the line
  //    every builder that asks a question shares (conditionLine above). CHANGED: the
  //    three selects were spelled out here; they are the same three a demand draws, so
  //    they moved into one function and this builder hands in its own sources. A new
  //    condition is still born complete: the kind's first operator and the first value
  //    the bucket offers (or the kind's empty condition value when the bucket offers
  //    none). A number field's value is Number()ed HERE, the one place a ROW's condition
  //    value is typed — exactly like the number builder.
  rowEl.appendChild(captionSpan('where'))
  conditionLine(rowEl, query.where, {
    gone:      'no longer exists',
    fields:    ()      => OPTION_SOURCES.fieldsOf(type),
    fieldOf:   (id)    => fieldById(type, id),
    onField:   (value) => {
      if (value === '') { query.where = null; return }
      const field = fieldById(type, value)
      query.where = { field: value, op: OPERATORS[field.type][0].value, value: firstValue(type, field) }
    },
    operators: (field) => OPTION_SOURCES.operatorsFor(field.type),
    onOp:      (field, value) => { query.where.op = value },
    value:     (field) => selectOf(withCurrent(OPTION_SOURCES.valuesFor(type, field), query.where.value, 'no thing has this'), query.where.value, value => {
      query.where.value = field.type === 'number' ? Number(value) : value
      rerender()
    })
  })
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

// NEW: what this entry DEMANDS of the player's sheet — a list of conditions, ALL of
// which must hold before the player may take it. It appears on every thing card with no
// wiring at all, because a thing's card sheet is coreThingSchema + the type's own
// (dinoEdit/state.js) and `demands` is now a core entry.
//
// THE SENTENCE FIRST, THEN THE EDITORS, and that order is the whole point: a book's
// card is drawn by this very code and then lockCard disables every control inside it,
// so without the sentence a frozen book's prerequisite would read as three greyed
// dropdowns. The sentence is demandText — the same bytes the player's card prints — so
// the author reads Dinosaur Age's rule the way the printed page states it.
//
// The write happens on CLICK, never on paint (the placements builder's own rule):
// `target[entry.key] ??= []` lives inside the Add handler, so a thing that was merely
// looked at saves byte-identical. And removing the LAST demand DELETES the key: "this
// entry demands nothing" already has a spelling and it is the key's absence — which is
// why the validator refuses `"demands": []` with a sentence of its own.
demands: (entry, target) => {
  const list = target[entry.key] ?? []     // absent stays absent: reading must not write
  const type = playerSheetType()

  const bagEl = document.createDocumentFragment()
  bagEl.appendChild(captionSpan(entry.caption))
  bagEl.appendChild(list.length === 0
    ? el('p', 'demands-empty', 'no demands')
    : el('p', 'field-note demands-line', `Needs: ${list.map(demand => demandPhrase(demand, type)).join(' · ')}`))

  list.forEach(demand => {
    const lineEl = el('div', 'demand-row')
    conditionLine(lineEl, demand, demandSources(demand, type))
    const removeBtn = el('button', 'remove-button', 'Remove')
    removeBtn.addEventListener('click', () => {
      const at = list.indexOf(demand)
      if (at !== -1) list.splice(at, 1)               // in place: the array is the one in state
      if (list.length === 0) delete target[entry.key] // the file never carries a no-op
      rerender()
    })
    lineEl.appendChild(removeBtn)
    bagEl.appendChild(lineEl)
  })

  // disabled with a title rather than hidden, exactly as the placements builder
  // disables Add on an empty shelf: a control that is missing teaches nothing, and both
  // of these have a fix that is one tab away.
  const addBtn = el('button', 'add-button', '+ Add demand')
  if (type === undefined) {
    addBtn.disabled = true
    // CHANGED (stage 4, gap 14): the REASON is a cell of the screen table, because it is a
    // different reason. A game without a sheet has a fix one tab away; a BOOK has no fix at
    // all — a demand's whole vocabulary comes from `content.sheet` and a book may not declare
    // one. Saying "say what the player builds on the Rows tab" to a book author would point
    // at a dropdown that is not there.
    addBtn.title = SCREEN[editorState.subject.kind].noSheet
  } else if (demandFields(type).length === 0) {
    addBtn.disabled = true
    addBtn.title = 'this sheet has no fields or lists to demand anything of'
  }
  addBtn.addEventListener('click', () => {
    reserveDemands(target).push(newbornDemand(type))
    rerender()
  })
  bagEl.appendChild(addBtn)
  return bagEl
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
  const bagEl = document.createDocumentFragment()
  // CHANGED (spec §2): the cabinet is asked for ONCE, here, rather than on every peek. Two
  // reasons and both matter: a subject that HAS no such cabinet (a book has no themes)
  // draws nothing at all rather than an empty card, and the role's one warning is said
  // once per card instead of once per keystroke. The drawer object is never replaced during
  // a paint, so holding it for the card's lifetime is the same object peek would have found.
  const cabinet = cabinetOf(entry)
  if (cabinet === undefined) return bagEl
  const slot = {
    peek:   () => cabinet[target.id],
    ensure: () => (cabinet[target.id] ??= {})
  }
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

// NEW: the demands array, created IN ITS CANONICAL PLACE when the thing has none yet.
// A thing's keys are id · name · cost · imageURL · demands · <the type's own>, and
// `demands` is the ONE key born ABSENT — its sheet default is null, which is schema.js's
// own spelling for "not written at birth" — so it is the one key that can ever arrive
// AFTER keys that should follow it. `target.demands ??= []` on a thing that already has
// a description would put it last, and a thing's key order is a rule this project keeps
// (the oracles read the file). A list section's key needs none of this: it is born with
// the thing, because its default is [].
// The later keys are re-added IN PLACE, so the object's IDENTITY survives — the card,
// the game's own bucket and the merge are all holding this very object, and building a
// replacement would edit a copy nobody saves.
const BEFORE_DEMANDS = ['id', ...coreThingSchema.slice(0, coreThingSchema.findIndex(entry => entry.key === 'demands')).map(entry => entry.key)]
const reserveDemands = (thing) => {
  if (Array.isArray(thing.demands)) return thing.demands
  const after = Object.keys(thing).filter(key => !BEFORE_DEMANDS.includes(key))
  const held  = Object.fromEntries(after.map(key => [key, thing[key]]))
  after.forEach(key => delete thing[key])
  thing.demands = []
  Object.assign(thing, held)
  return thing.demands
}

// NEW: one demand, in words — demandText with the two things that file may not fetch
// for itself handed in: the resolved slot, and a name for a thing id. TOTAL, because it
// is drawn on every card including one whose sheet was taken away: a slot that is gone
// reads as one sentence instead of throwing.
const demandPhrase = (demand, type) =>
  demandText(demand, type === undefined ? undefined : demandFieldById(type, demand.field), thingName)

// NEW: what a demand looks like the moment its SLOT is chosen — complete, never
// half-built, exactly as a gate is (NEWBORN_GATES). The slot's first operator, and the
// first value that operator can carry. Changing the slot rebuilds the whole condition,
// which is a `where`'s own rule verbatim: a condition names ONE kind's operators, so it
// cannot survive a change of kind.
const demandOn = (field) => {
  const operator = demandOperators(field)[0]
  return { field: field.id, op: operator.value, value: operator.valueless ? '' : firstDemandValue(field) }
}
// the first slot of the sheet the player builds. The [0] is safe: + Add demand is
// disabled while the sheet has no slots at all.
const newbornDemand = (type) => demandOn(demandFields(type)[0])

// NEW: the value a new demand starts with — the first value its dropdown offers, else
// the kind's empty condition value. A number never asks the dropdown (it has none, and
// §3.7 is why): 0 is where a number box starts, the same WHERE_VALUE_DEFAULT a row's
// condition uses. "" when a shelf is empty — and then the card's ⚠ quotes checkDemand's
// own sentence rather than this screen inventing a second one.
const firstDemandValue = (field) => field.type === 'number'
  ? WHERE_VALUE_DEFAULT.number
  : (OPTION_SOURCES.demandValues(field)[0]?.value ?? WHERE_VALUE_DEFAULT[field.type])

// NEW: the third control of a demand line — the ONE place a demand differs from a row
// filter, and there are only three answers:
//   an operator that names nothing (`holds anything`, `holds nothing`) → NO control at
//     all, and the stored value is "" — present and empty, never absent
//   a NUMBER slot → one number box. The only typed value in this whole language, and
//     the argument is short: a row filter can offer a dropdown because it filters an
//     existing bucket, while a demand has no bucket of player sheets — so "Strength ≥
//     12" would be unsayable unless some book happened to have written a 12 somewhere.
//     Nothing is parsed: there is no expression here, just one number crossing the same
//     Number() border every other number in this project crosses.
//   anything else → a dropdown, so a demand can never carry a typo
const demandValueControl = (field, demand) => {
  const operator = demandOperatorOf(field, demand.op)
  if (operator?.valueless) return null
  if (field.type === 'number') {
    const inputEl = document.createElement('input')
    inputEl.type = 'number'
    inputEl.value = demand.value
    // no rerender, here as everywhere: typing is a content edit and the box already
    // shows what was typed. The Needs: sentence above catches up at the next paint —
    // the same one-beat delay every other one-liner in this file has always had.
    inputEl.addEventListener('input', () => { demand.value = Number(inputEl.value) })
    return inputEl
  }
  return selectOf(withCurrent(OPTION_SOURCES.demandValues(field), demand.value, field.section ? 'not on the shelf' : 'no thing has this'), demand.value, value => {
    demand.value = value
    rerender()
  })
}

// NEW: the demand half of conditionLine's sources. Every one of them answers about the
// sheet the PLAYER builds — never about the shelf the card itself sits on, which is the
// single idea an author has to hold: a demand is a question about the player.
const demandSources = (demand, type) => ({
  gone:      "not on this game's sheet",
  fields:    ()      => OPTION_SOURCES.demandFields(),
  fieldOf:   (id)    => type === undefined ? undefined : demandFieldById(type, id),
  onField:   (value) => {
    const field = type === undefined ? undefined : demandFieldById(type, value)
    if (field === undefined) return          // only reachable by re-picking the stale option
    Object.assign(demand, demandOn(field))   // in place, so the stored key order stays field, op, value
  },
  operators: (field) => OPTION_SOURCES.demandOps(field),
  onOp:      (field, value) => {
    demand.op = value
    const operator = demandOperatorOf(field, value)
    // an operator that names nothing carries NO value, and turning it back into one
    // that DOES name something needs a real value again — or one edit would leave a
    // demand born broken, which is the state this builder exists to prevent.
    if (operator?.valueless) demand.value = ''
    else if (demand.value === '') demand.value = firstDemandValue(field)
  },
  value:     (field) => demandValueControl(field, demand)
})

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
  // NEW: the three sources a DEMAND's dropdowns read. All three answer about the sheet
  // the PLAYER builds, and the labels say where each slot came from, because a demand
  // routinely crosses a book boundary — Dinosaur Age's trait asks about Basic's Origin
  // and Stats' Strength, and the author should see that seam here, when choosing.
  // NEVER the core three: `name` and `imageURL` are not game state, and a sheet's `cost`
  // is what the picks being judged already cost — demandFields simply does not offer
  // them, which is why this screen needs no caption table of its own.
  // (`demandFields(...)` inside is the import from demands.js: a property name creates
  // no binding, so nothing is shadowed — the same note fillableSections carries below.)
  demandFields: () => {
    const type = playerSheetType()
    if (!type) return [{ value: '', label: '— this game builds no sheet —' }]
    return demandFields(type).map(field => {
      const from = editorState.origins.get(field.id)
      return { value: field.id, label: from === undefined ? field.caption : `${field.caption} (${titleOf(from)})` }
    })
  },
  // which operators FIT this slot: a LIST section's four, or the field kind's own row of
  // OPERATORS — query.js's table by identity, so a row filter and a demand can never
  // drift apart. Drawn from `label`, so `gte` reads "≥".
  demandOps:    (field) => demandOperators(field).map(({ value, label }) => ({ value, label })),
  // and what its value may be: a LIST section names a THING on the shelf it lists (the
  // whole merged shelf, wherever the entry came from); everything else offers exactly
  // what a row filter offers for that kind — a choice its own options, text and lines
  // the values the sheet type's own things hold. A number asks nothing of this source:
  // it gets a box (see demandValueControl).
  demandValues: (field) => field.section
    ? OPTION_SOURCES.thingsOf(field.section.of)
    : OPTION_SOURCES.valuesFor(playerSheetType(), field),
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
  // CHANGED (stage 4, spec §7a): WHERE the candidates come from is the screen table's answer,
  // because a book and a game are asking two different questions. A GAME asks "which section
  // of the sheet MY PLAYER BUILDS does this row fill" — one declared type, and a row that
  // filled anything else would be a fault the game has to fix. A BOOK has no declaration and
  // never will (only a game chooses one), but a `fills` names a SECTION id and a section id
  // is global across the merged library — so a book's candidates are every fitting list
  // section on every merged sheet. That is not a loophole, it is the decision: dino would not
  // need its four rowOverrides if Dinosaur Age could propose them.
  fillableSections: (row)     => SCREEN[editorState.subject.kind].fillable(row)
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
// CHANGED (stage 4): asked of the whole MERGED library rather than of the declared player
// sheet. A section id is global — that is the very reason a book may propose a `fills`
// (§7a) — and a book has no declaration to look it up in, so "fills Gear" read as
// "fills basic:character.gear" on every book's row. The player sheet is IN the merged types
// for a game, so a game's answer does not change; what changes is that there is now an answer
// for a subject that declares nothing.
const sectionCaption = (sectionId) => {
  for (const type of editorState.merged.types.types) {
    const section = sectionById(type, sectionId)
    if (section) return section.caption
  }
  return sectionId
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
  // NEW (stage 4): FROZEN IS A READ-ONLY MODE, NOT A HIDDEN SCREEN. An author must be able
  // to LOOK at an edition a game pins — it is the most ordinary thing they do — so the whole
  // screen is painted exactly as an editable one and then turned off, the way lockCard
  // already turns off one borrowed card. After the paint, so nothing in any painter has to
  // know, and so a painter added later is covered by being painted at all.
  if (!S().editable(editorState)) lockScreen()
}

// NEW: the read-only mode. Everything inside #editor is disabled except the card TOGGLES
// (folding is looking, and a book a game pins is mostly read for what is inside it), and the
// one sentence at the top says who pins it and offers the only thing that CAN be done: cut
// the next edition. The banner is prepended AFTER the lock so its own button stays alive —
// the same ordering lockCard uses for a badge, for the same reason.
// `pinnedBy: null` means the census was never answered, which SUBJECTS.book.editable reads as
// frozen: unknown is the one case where guessing editable would write into a shelf folder, so
// it falls closed and says so in plain words rather than naming a game it does not know.
const lockScreen = () => {
  editorEl.querySelectorAll('input, select, textarea, button').forEach(controlEl => {
    if (!controlEl.classList.contains('card-toggle')) controlEl.disabled = true
  })
  const bannerEl = el('section', 'notices')
  // the NUMBER the cut would take is the shelf's answer, and a save just before this may have
  // thrown the shelf away (every book mutation does — see actions.forgetShelf). Asking here is
  // the same thing the Books tab does on a null shelf, and readShelf repaints when it lands;
  // until then the banner says what it is doing rather than a number it would have to guess.
  if (editorState.shelf === null) {
    currentActions.readShelf()
    bannerEl.appendChild(el('p', 'notice-line', 'Read-only — reading the shelf…'))
    editorEl.prepend(bannerEl)
    return
  }
  const next = nextEditionOf(shelfEditions())
  // `frozen` is the BORDER's own sentence, kept word for word when the border is what said it
  // (a 409 on a save this screen believed was allowed). `pinnedBy` is the screen's own census;
  // an unasked one (null) reads as frozen and says exactly that, rather than naming a game it
  // does not know.
  const lineEl = el('p', 'notice-line', editorState.frozen
    ?? (Array.isArray(editorState.pinnedBy)
      ? frozenEditionSentence(editorState.pinnedBy, next)
      : 'Read-only — the editor could not ask which games pin this edition, so it is treating it as frozen.'))
  lineEl.appendChild(smallButton(`Cut edition ${next} as a copy`, () => currentActions.cutEdition()))
  bannerEl.appendChild(lineEl)
  editorEl.prepend(bannerEl)
}
// this book's editions, as the shelf listing names them — the one place the next edition's
// NUMBER comes from, so "Cut edition 3" and the folder the cut makes cannot disagree.
const shelfEditions = () =>
  (editorState.shelf?.ok ? editorState.shelf.books : []).find(book => book.name === editorState.subject.name)?.editions ?? []

const repairBuckets = () => {
  // A type born this session has no bucket yet. Giving it an empty one is the
  // ONE write render() is allowed: it repairs an invariant (every type has a
  // bucket), never touches what an author wrote, and migrated data always
  // arrives with its buckets, so a no-edit save stays byte-identical.
  // The subject's OWN types only: a borrowed book's shelf is not this subject's to
  // create, and the merge already gives every merged sheet a bucket to read.
  // CHANGED (stage 4): gated, and this is the ONLY change it needed — three designs said
  // this function had to be rewritten for a book and it does not, because
  // `editorState.types.types` and `editorState.things.things` are a book's OWN drawers
  // under the very same names (BOOK_FILE_SHEETS.types IS FILE_SHEETS.types). What it needed
  // is the gate: rendering a FROZEN edition must write nothing at all, or opening a book a
  // game pins would dirty it just by being looked at — and the "a file that was only looked
  // at is saved back unchanged" rule is load-bearing for a shelf an oracle hashes.
  if (!S().editable(editorState)) return
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
      // CHANGED (stage 4): …and ONLY the game's. `things.order` in a book is a fault the
      // merge refuses outright ("a book may not arrange a shelf"), so for a book the pair is
      // not drawn at all — see SCREEN.arranges.
      if (SCREEN[editorState.subject.kind].arranges) cardEl.querySelector('.group-header')?.appendChild(arrangeButtons(shownType.id, at, shelf.length))
      paneEl.appendChild(cardEl)
    })
    // "+ Add" writes on CLICK: the bucket for this sheet is created only when
    // something is actually put in it, so looking at a book's empty shelf never
    // adds an empty bucket to the game's things.json.
    // CHANGED: WHAT is born now depends on the "from" line below it — a blank thing
    // built from the sheet's defaults, which is every game's behaviour to date, or a
    // COPY of a thing already on this shelf. Both write on the same click.
    const addBtn = el('button', 'add-button', `+ Add ${shownType.label}`)
    addBtn.addEventListener('click', () => {
      const source = shelf.find(thing => thing.id === startFrom)   // undefined for "— blank —", and for a source the shelf lost
      const born = source === undefined ? newborn(shownType.id) : newbornFrom(source, shownType.id)
      ;(editorState.things.things[shownType.id] ??= []).push(born)
      uiState.expanded.add(born.id)
      rerender()
    })
    paneEl.appendChild(addBtn)
    paneEl.appendChild(startFromLine(shownType, shelf))
  }
  layoutEl.appendChild(paneEl)
  editorEl.appendChild(layoutEl)
}

// NEW: which thing the NEXT newborn copies — a thing id, or '' for a blank one.
// Module scope for exactly the reason uiState exists: render() wipes the DOM at every
// paint, so a control's own value is lost unless something outside the DOM holds it.
// It is not IN uiState because it is not in the hash and no other screen asks about it
// — one screen's scratch memory, and reloading the page forgetting it is correct.
let startFrom = ''

// NEW: "from [ — blank — ▾ ]", the whole AUTHOR half of templates.
// A template is not a new shape and carries no mark: it is a thing of a sheet's type
// used as a newborn's source, and buildSheet already says the player's sheet IS a thing
// of its type. So a book "ships a template" by shipping a thing, and this screen needs
// no new key, no validator rule and no migration to offer one.
// The options are the MERGED shelf, so a book's thing is offered and labelled with the
// book it came from — that is how a book's template reaches a game. "— blank —" is
// first and is today's behaviour exactly, which is why no existing game changes.
// It does NOT repaint on change: the select already shows the author's choice, and
// nothing else on the screen depends on it until Add is clicked.
// A remembered source that is not on the shown shelf — the rail moved to another type,
// or a book was un-pinned — falls back to blank instead of being shown as a missing
// option. It is not a fault in the data (nothing on disk points at it); it is a screen
// that moved on, and the quiet answer is the honest one.
const startFromLine = (type, shelf) => {
  if (!shelf.some(thing => thing.id === startFrom)) startFrom = ''
  const lineEl = conditionRow('from')
  const options = [{ value: '', label: '— blank —' }, ...OPTION_SOURCES.thingsOf(type.id)]
  lineEl.appendChild(selectOf(options, startFrom, value => { startFrom = value }))
  return lineEl
}

// NEW: the shelf's heading — the sheet's label, its badge, and [Reset order]
// while this game holds an arrangement for it.
const renderShelfHeading = (type) => {
  const headEl = el('div', 'shelf-heading')
  headEl.appendChild(el('h2', '', type.label))
  const originBadge = badge(type.id)
  if (originBadge) headEl.appendChild(originBadge)
  // CHANGED (stage 4): a book may not hold one at all, so there is never one to reset
  if (SCREEN[editorState.subject.kind].arranges && editorState.things.order?.[type.id] !== undefined) {
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
// CHANGED (stage 4): three of its parts come from the SCREEN table, because three of them
// are the GAME's alone. A book proposes rows; it never overrides one (book-over-book override
// is deferred), it cannot hide one, and it has no rowOverrides file to leave an orphan in. So
// what a row another layer proposed looks like, and whether this subject can hide it, are
// cells — and everything else on the tab, including the whole own-row walk, is the same code.
const renderRowsTab = () => {
  const screen = SCREEN[editorState.subject.kind]
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
    hiddenRows: new Set(proposedFlat().filter(row => screen.hides(row.id)).map(row => row.id)),
    sheetType,
    // NEW: the audit's own ONE-CAUSE rule (references.js), applied where it belongs.
    // When the declared TYPE is gone, every bound row would ALSO report "fills a
    // section but this game builds no sheet" — one cause, five sentences. The Page
    // card carries the single sentence that matters; the rows stay quiet until the
    // declaration is fixed.
    sheetDangles: sheetId !== '' && sheetType === undefined,
    // NEW (stage 4): may this subject judge a row's binding at all? Only a game can — see
    // rowSummary. The dangling-declaration silence is folded in here so rowSummary asks ONE
    // question rather than two that have to be kept in the same order.
    judgesFills: screen.judgesFills && !(sheetId !== '' && sheetType === undefined)
  }
  screen.pageCard()
  // CHANGED: the rows the LAYERS UNDERNEATH proposed. In book mode the merge puts the
  // subject book in the `books` list — that is what book mode IS — so `proposed.rows` holds
  // the subject's own rows too, and they are drawn below as the editable own-row walk. One
  // filter rather than a branch: for a game no proposal is ever from the game layer, so it
  // removes nothing and the game's screen is unchanged.
  editorState.proposed.rows
    .filter(entry => entry.from !== ownLayer())
    .forEach(entry => editorEl.appendChild(screen.borrowedRow(entry)))
  screen.orphans()
  // CHANGED: the collection walk's target is the drawer the `content` ROLE names — the
  // game's content.json, or a book's proposals.json. contentSchema's one entry is the
  // `groups` collection and BOOK_FILE_SHEETS.proposals carries the same key, so the row
  // walk moves to a book with this one word and nothing else.
  contentSchema.forEach(entry => {
    editorEl.appendChild(renderField(entry, drawerOf('content')))
  })
}

// NEW: one painter per tab, dispatched like everything else.
// UNCHANGED by stage 4, and that is the measured claim of §1 rather than a hope: all four
// painters serve a BOOK as written. Books is the same tab over a different pin list (its own
// file says so); Types and Things read `editorState.merged`, write `editorState.types` /
// `editorState.things`, and a book's drawers carry those exact two names because
// BOOK_FILE_SHEETS.types IS FILE_SHEETS.types; Rows walks the drawer the `content` ROLE names.
const TAB_PAINTERS = {
  books:  () => renderBooksTab(currentActions),
  types:  renderTypesTab,
  things: renderThingsTab,
  rows:   renderRowsTab
}

// NEW (stage 4): THE DOM-SIDE HALF OF THE SUBJECT TABLE — the words and the painters.
// subject.js holds the pure half (drawers, merge, validate, the address) so the fast oracles
// can drive it with no browser; this half cannot be driven that way and so lives here, keyed
// by the same `kind`. Five cells, and every one of them is a thing only a GAME can do:
//
//   self          what a badge calls the subject's own layer
//   pageCard      a game's page is its title, its player sheet, its budget and its look; a
//                 book has NONE of those four — its "page" is its manifest plus the one
//                 budget it may PROPOSE. Two cards, not one card with four empty halves.
//   borrowedRow   a game OVERRIDES what a book proposes (that is the whole cascade); a book
//                 may not override another book's row — book-over-book is deferred — so it
//                 reads one instead.
//   hides         `hidden` is a rowOverride key, so hiding a proposed row is the game's alone.
//   orphans       an override left behind by an un-pinned book is a game's leftover. A book
//                 has no rowOverrides file, so it can never have one.
//   arranges      `things.order` is the game's taste over a merged shelf, and merge.js refuses
//                 one in a book outright ("a book may not arrange a shelf"). So the ▲▼ pair
//                 and [Reset order] are REMOVED for a book, not disabled: a control whose
//                 every use would be a fault is not a control.
//   noSheet       why a demand cannot be added — see the demands builder (gap 14).
const SCREEN = {
  game: {
    self:        'this game',
    pageCard:    () => renderPageCard(),
    borrowedRow: (entry) => buildProposedRowCard(entry),
    hides:       (rowId) => overrideOf(rowId)?.hidden === true,
    orphans:     () => renderOrphanOverrides(),
    arranges:    true,
    judgesFills: true,
    noSheet:     'this game builds no sheet — say what the player builds on the Rows tab',
    // the LIST sections of the declared player sheet whose `of` is this row's query type. A
    // binding built from this dropdown can never mismatch, the same discipline the query
    // builder keeps by only offering fields that exist. (Measured: on today's dino every row
    // has exactly ONE fitting section, so binding a row is one click.)
    // withCurrent, for the reason every other select here has it: a hand-written binding that
    // does NOT fit is SHOWN, labelled, never silently swapped for the first option; the row's
    // header carries checkFills' sentence beside it.
    fillable: (row) => {
      const type = playerSheetType()      // the same one question, asked in one place
      if (!type) return [{ value: '', label: '— this game builds no sheet —' }]
      const fits = fillableSections(type, row?.query?.type ?? '')
        .map(section => ({ value: section.id, label: `${section.caption} — ${sheetLabel(section.of)} entries` }))
      return withCurrent([{ value: '', label: '— nothing —' }, ...fits], row?.fills ?? '', 'does not fit this row')
    }
  },
  book: {
    self:        'this book',
    pageCard:    () => renderBookCard(),
    borrowedRow: (entry) => buildRequiredRowCard(entry),
    hides:       () => false,
    orphans:     () => {},
    arranges:    false,
    // a book never judges a binding: checkFills' sentence is "this GAME builds no sheet", and
    // references.js's book mode skips the same check for the same reason (spec §7a).
    judgesFills: false,
    noSheet:     'a book cannot say what the player builds, so there is no sheet to demand anything of — only a game declares one',
    // every fitting list section on every MERGED sheet — this book's own and its
    // requirements'. The label names the sheet it is on, because a book is choosing across
    // several and "Gear" alone would not say whose.
    fillable: (row) => {
      const fits = editorState.merged.types.types.flatMap(type =>
        fillableSections(type, row?.query?.type ?? '').map(section => ({ value: section.id, label: `${section.caption} — on ${type.label}` })))
      return withCurrent([{ value: '', label: '— nothing —' }, ...fits], row?.fills ?? '', 'does not fit this row')
    }
  }
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

// ─────────────────── the book's card: the manifest, and the one proposal ───────────────────

// NEW (stage 4): a BOOK's answer to the Page card, and it is deliberately not the same card
// with empty halves. A book has no meta, no themes.json and no player-sheet declaration — and
// "do not draw an empty one" is the rule: three blank boxes that can never be filled teach
// that a book is a crippled game, when the truth is that a page belongs to whoever shows it.
//
// What a book HAS that a game does not is a MANIFEST, so that is the card: the title the
// shelf calls it, the namespace every id in it starts with, and the single budget it may
// PROPOSE. Its `requires` is on the Books tab, beside the other question about what it stands
// on; its name and edition are the FOLDER's, shown here as the facts they are rather than as
// boxes — changing either is a Library act (a rename, a cut), not a keystroke.
const MANIFEST_FIELDS = ['title']     // the one entry of book.json an author edits HERE

const bookSummary = () => {
  const budget = editorState.proposals.totalBudget
  return {
    text: `Book · "${editorState.book.title}" · ${editorState.subject.name} ${editorState.subject.edition} · ${budget === undefined ? 'proposes no budget' : `proposes budget ${budget}`}`,
    // the manifest's own faults, in the banner's words — a title or a requires list the
    // border will refuse is worth seeing on the folded card too.
    warnings: editorState.faults.some(fault => fault.path.startsWith('book')) ? ['see the faults above'] : []
  }
}

const renderBookCard = () => {
  const cardEl = el('section', 'editor-section')
  const open = uiState.expanded.has('page')
  cardEl.appendChild(buildHeader('page', bookSummary(), open))
  if (open) {
    bookSchema.filter(entry => MANIFEST_FIELDS.includes(entry.key)).forEach(entry => {
      cardEl.appendChild(renderField(entry, editorState.book))
    })
    cardEl.appendChild(renderProposedBudgetLine())
    // THE FOLDER IS THE TRUTH — merge.js's bookRules refuses a manifest that disagrees with
    // it, and this is the one place an author can read what the folder therefore decided.
    cardEl.appendChild(el('p', 'field-note', `books/${editorState.subject.name}/${editorState.subject.edition} — the folder is the truth: the name and the edition come from it, and every id this book defines starts with "${editorState.subject.name}:". Renaming the folder is a Library act, and a new edition is a new folder.`))
  }
  editorEl.appendChild(cardEl)
}

// NEW: the budget a book PROPOSES. It is the same optionalNumber the game's budget line
// draws, and everything around it is different: a book never decides, so there is no
// [reset] and no ⚠ to settle — the most a book can do is propose a number and say what the
// books under it proposed, which is the disagreement only a GAME can end.
const renderProposedBudgetLine = () => {
  const [entry] = totalBudgetSchema
  const slot = { peek: () => editorState.proposals, ensure: () => editorState.proposals }
  const lineEl = el('div', 'override-line')
  lineEl.appendChild(renderField({ ...entry, caption: 'Propose a budget', repaintOnEdit: true }, slot))
  const others = editorState.books.filter(layer => layer !== null && layer.proposals?.totalBudget !== undefined)
  lineEl.appendChild(others.length === 0
    ? el('span', 'field-note', '· blank = this book proposes none, and the game decides')
    : el('span', 'proposal', `${others.map(layer => `${titleOf(bookLabel(layer.manifest))} proposes ${layer.proposals.totalBudget}`).join(', ')} — a game decides between them`))
  return lineEl
}

// NEW: a row one of the books UNDERNEATH proposed, read-only. A game gets
// buildProposedRowCard here — the whole override cascade — and a book gets this, because a
// book may not override another book's row (book-over-book override is deferred). It is not
// nothing, though: the row's id is TAKEN in the shared id space (merge F6 is
// first-definition-wins and would silently skip a second definition), and its entries show up
// on this book's shelves. So the card says what the row is and whose it is, and no more.
const buildRequiredRowCard = ({ row, from }) => {
  const merged = mergedRowById(row.id) ?? row
  const open = uiState.expanded.has(row.id)
  const { text, warnings } = rowSummary(merged)
  const cardEl = el('section', 'editor-section proposed-row locked')
  cardEl.appendChild(buildHeader(row.id, { text: `proposed by ${titleOf(from)} · ${text}`, warnings }, open))
  if (open) {
    cardEl.appendChild(el('p', 'field-note', `${titleOf(from)} proposes this row and its id "${row.id}" is taken — a book may not override another book's row, so there is nothing to set here. A game that pins both can override it.`))
    row.children.forEach(child => cardEl.appendChild(buildRequiredRowCard({ row: child, from })))
  }
  return cardEl
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
// CHANGED (stage 4): "in this game" was a literal on every type card, and a BOOK's Types tab
// draws the same cards. selfWord is the table's answer.
const typeSummary = (type) => ({ text: `${type.label} · ${plural(type.sections.length, 'section')} · ${plural(ownBucketOf(type).length, 'thing')} in ${selfWord()}`, warnings: [] })
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
  const parts = [`${thing.name} · ${thing.cost} pt${thing.cost === 1 ? '' : 's'}`]
  const warnings = []
  if (type) listSectionsOf(type).forEach(section => {
    const placed = thing[section.key]
    if (!Array.isArray(placed)) return
    const shelf = new Set((editorState.merged.things.things[section.of] ?? []).map(target => target.id))
    if (placed.some(placement => !shelf.has(placement?.thing))) warnings.push('places a thing that does not exist')
  })
  // NEW: what this entry asks of the player, and the two ways that can go wrong — the
  // border's ("this game cannot judge it, so it is not on sale") and the reachability
  // one below it. Both quote the ENGINE's own sentences; neither is written twice.
  const demands = demandsOf(thing)
  if (demands.length > 0) {
    parts.push(plural(demands.length, 'demand'))
    const cannot = cannotJudge(thing)
    if (cannot) warnings.push(cannot)
    const never = neverMet(demands)
    if (never) warnings.push(never)
  }
  return { text: parts.join(' · '), warnings }
}

// NEW: the BORDER's own question, asked on this screen: can THIS game JUDGE everything
// this entry demands? gameConfig.js warns once by name and DOES NOT OFFER a thing it
// must answer "no" for, so this screen must subtract exactly the same entries from a
// row's count — or the editor's number stops being the game's offer.
// null when the entry is offerable, which includes "it demands nothing at all".
// The first sentence is the border's and NOT checkDemand's, because the two ask
// different questions: "does this point at anything, anywhere?" is the audit's (it is a
// FAULT, and the banner at the top of this screen already carries it), while "can this
// GAME answer it?" is the border's — a book's trait may ask about Stats' Strength in a
// game that never pinned Stats, and that file is perfectly well-formed.
const cannotJudge = (thing) => {
  const demands = demandsOf(thing)
  if (demands.length === 0) return null
  const type = playerSheetType()
  // CHANGED (stage 4): `selfWord` rather than the words "this game" — the same sentence is
  // drawn over a BOOK's shelf, where every entry a required book ships is on screen and a
  // book has no declaration of its own to blame.
  if (type === undefined) return `demands something, but ${selfWord()} builds no sheet — it is not offered`
  for (const demand of demands) {
    const field = demandFieldById(type, demand.field)
    const problem = field === undefined
      ? `names a field that is not on ${selfWord()}'s sheet (${demand.field})`
      : checkDemand(demand, field, field.section ? shelfIdsOf(field) : null)
    if (problem) return `a demand ${problem}`     // ONE sentence per entry, as the border says one per thing
  }
  return null
}
const shelfIdsOf = (field) => new Set((editorState.merged.things.things[field.section.of] ?? []).map(thing => thing.id))

// NEW: the cheap, SOUND half of "can this entry ever be taken?" — a demand that asks a
// section to HOLD something can never be met while NO ROW fills that section, because a
// section fills only from a row's picks. It is the deadRows question one storey down and
// it is exactly decidable; the complete version is a reachability fixpoint over a
// non-monotone condition, and it is deliberately out of scope.
// Only `holds` and `holds anything` are asked about: on a section nothing can ever fill,
// `does not hold` and `holds nothing` are not unmeetable — they are permanently MET, and
// warning about them would be a lie.
const neverMet = (demands) => {
  const type = playerSheetType()
  if (type === undefined) return null                  // cannotJudge already said the one thing worth saying
  const filled = new Set(rowsIn(editorState.merged.content.groups).map(row => row.fills).filter(id => id))
  const doomed = demands.find(demand => {
    if (demand.op !== 'holds' && demand.op !== 'any') return false
    const field = demandFieldById(type, demand.field)
    return field?.section !== undefined && !filled.has(field.section.id)
  })
  if (doomed === undefined) return null
  return `asks about ${demandFieldById(type, doomed.field).caption}, which no row fills — nothing can ever meet it`
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
      // CHANGED: the count is what the row OFFERS, not what it matches. An entry whose
      // demands this game cannot judge is not on sale (cannotJudge, the border's own
      // rule), so counting it here would make this number a promise the player's page
      // does not keep. Nothing moves for a game with no demands: the filter drops none.
      const shown   = filterThings(bucketOf(type), type, row.query.where)
      const offered = shown.filter(thing => cannotJudge(thing) === null)
      parts.push(`shows ${type.label}${wherePhrase(row.query.where, type)}`, plural(offered.length, 'thing'))
      if (offered.length === 0 && (editorState.merged.rules.groupRules[row.id]?.min ?? 0) > 0) warnings.push('required but matches nothing')
    }
  }
  // NEW: where this row's picks LAND, right after what it shows — the two are one
  // thought, which is why `fills` sits beside `query` on the sheet. checkFills is
  // the one function three readers share: this badge, the engine's console warning
  // and the server's refusal are the same bytes, never written twice. It is silent
  // for a row that fills nothing (every v5 row is that row) and silent while the
  // declaration itself dangles (rowsContext.sheetDangles).
  // CHANGED (stage 4): …and silent in a BOOK, for the reason references.js's own book mode is
  // (danglingReferences takes a `mode` and skips this very check): "fills a section but this
  // game builds no sheet" is a question only a GAME can answer, so a book that binds a row is
  // not doing anything wrong and must not be told it is. One decision, in two tables, and the
  // editor's badge is the border's answer wherever the border has one.
  const fillsProblem = rowsContext.judgesFills ? checkFills(row, rowsContext.sheetType) : null
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

// CHANGED (stage 4, spec §2): `entry.file` stops naming a FILE and starts naming a ROLE.
// This was one line — `editorState[entry.file][entry.cabinet]` — and it was keyed by the
// GAME's five file names with a comment saying "it reads the game's OWN file, always".
// groupSchema carries two attachment entries hard-wired to file "rules" and file "themes",
// and a BOOK has neither file: its group rules live in proposals.groupRules and it proposes
// no look at all. So the name is looked up in the subject's `drawers` table, and the answer
// has three shapes — which is the codebase's own null-vs-undefined split, already used by
// `default: null` and readJSON:
//   a drawer name   the cabinet, as before
//   null            THIS SUBJECT HAS NONE OF THAT, BY DESIGN — undefined, silently. The Look
//                   card simply does not appear on a book's row, and a per-paint console
//                   warning about a thing that is working correctly is noise.
//   undefined       NO SUBJECT KNOWS THIS ROLE — a sheet grew an attachment nobody has a
//                   drawer for. Warned ONCE by name and failed closed (nothing drawn,
//                   nothing deleted), because the alternative is a TypeError mid-paint.
// The cabinet object itself must already be in the loaded file — a missing one
// is a border (migration) problem, never something to create while drawing.
const drawerOf = (role) => {
  const drawer = S().drawers[role]
  if (drawer === undefined) { warnOnce(`No drawer for "${role}" in a ${editorState.subject.kind}`); return undefined }
  return drawer === null ? undefined : editorState[drawer]
}
const cabinetOf = (entry) => drawerOf(entry.file)?.[entry.cabinet]

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
      // CHANGED (spec §2): a role this subject does not play has nothing to clear — and
      // `delete undefined[id]` is a TypeError, so the guard is not politeness. Same
      // three-way answer the attachment builder reads: a cabinet, or nothing to do.
      const cabinet = cabinetOf(entry)
      if (cabinet !== undefined) delete cabinet[element.id]
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
// NEW, what an entry DEMANDS — two more pointers, and both repairs SPLICE rather than
// neutralise. A gate on a removed thing becomes `always` because a row with no gate is a
// sensible row; a demand on a removed slot has no sensible neutral value at all ("always
// true" silently drops the author's rule, "always false" kills the entry), so the honest
// repair is that the condition ceases to exist and the author is told.
//   field / section (gone, kind flipped, re-aimed)  thing.demands[j].field  (forgetDemandField)
//   thing                                           thing.demands[j].value  (forgetDemanded)
//   content.sheet CHANGED                           NOTHING — see playerSheetChanged
const REMOVE_HOOKS = {
  type: (type) => {
    // its own things go, and every gate and every PLACEMENT on them — before the bucket does
    ownBucketOf(type).forEach(thing => {
      say(forgetThing(ownRows(), thing.id))
      say(forgetPlaced(editorState.things, editorState.merged.types.types, thing.id))
    })
    delete editorState.things.things[type.id]
    forgetShelfOrder(type.id)      // an arrangement of a shelf that is gone is fault F15, and unsaveable
    say(forgetType(ownRows(), type.id))
    // NEW: if this type WAS the sheet the player builds, this game builds no sheet
    // now — and every row bound to one of its list sections loses its binding. Two
    // repairs and not one, on purpose: forgetPlayerSheet deliberately does not walk
    // the rows, because a row names a SECTION and not a type. So the sections are
    // asked for by name, one at a time, and each keeps its own sentence.
    // CHANGED: through the `content` ROLE, which makes this repair TOTAL rather than
    // game-only: forgetPlayerSheet's first line is `if ((content.sheet ?? "") !== typeId)
    // return []`, and a book's rows drawer (proposals) has no `sheet` key at all — so a
    // book asking the question gets the right answer, [], with no branch anywhere.
    say(forgetPlayerSheet(drawerOf('content'), type.id))
    listSectionsOf(type).forEach(section => forgetBinding(section.id))
    // NEW: and every demand that asked about one of its slots. A demand may name a
    // FIELD or a LIST section — demandFields offers exactly those two — so exactly
    // those two are asked for by name, and a thing anywhere in this game may be the
    // one that asked.
    fieldsOfType(type).forEach(field => say(forgetDemandField(editorState.things, field.id)))
    listSectionsOf(type).forEach(section => say(forgetDemandField(editorState.things, section.id)))
    if (uiState.selectedType === type.id) uiState.selectedType = ''            // the Things pane falls back to the first type at paint
  },
  fieldDef: (field) => {
    say(forgetField(ownRows(), field.id))
    say(forgetDemandField(editorState.things, field.id))     // NEW: and every demand that asked about it
  },
  // NEW: a section takes its fields with it, so every condition built on one goes too
  // — and every BINDING that named it, because nothing can fill a section that is gone.
  section:  (section) => {
    (section.fields ?? []).forEach(field => {
      say(forgetField(ownRows(), field.id))
      say(forgetDemandField(editorState.things, field.id))   // NEW: its fields' demands go with them
    })
    forgetBinding(section.id)
    say(forgetDemandField(editorState.things, section.id))   // NEW: and every demand about the SECTION itself
  },
  thing:    (thing) => {
    say(forgetThing(ownRows(), thing.id))
    say(forgetPlaced(editorState.things, editorState.merged.types.types, thing.id))
    say(forgetDemanded(editorState.things, thing.id))        // NEW: "Fireball requires Mage" outlives neither
    forgetArranged(thing.id)
  },
  group:    (row)   => idsBelow(row).forEach(id => say(forgetRow(ownRows(), id)))   // the row AND its subtree
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
  // CHANGED: this is reached from forgetBinding, which every REMOVE_HOOK calls, so it is
  // SHARED machinery and has to be total. A book proposes; it never overrides — its rows
  // drawer holds no rowOverrides cabinet, and the ABSENCE of the key is the answer (the
  // same thing `default: null` means), so there is nothing to walk and nothing to say.
  const cabinet = drawerOf('content').rowOverrides
  if (cabinet === undefined) return changed
  Object.keys(cabinet).forEach(rowId => {
    if (cabinet[rowId].fills !== sectionId) return
    dropOverride(rowId, 'fills')
    changed.push({ row: mergedRowById(rowId) ?? { label: rowId }, what: 'fills nothing now — the section it filled changed or was removed' })
  })
  return changed
}
const forgetBinding = (sectionId) => {
  say(forgetFills(ownRows(), sectionId))
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
    say(forgetField(ownRows(), field.id))   // the old kind's operators and values no longer fit
    say(forgetDemandField(editorState.things, field.id))     // NEW: and neither do a demand's — the same reason, one storey down
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
      (section.fields ?? []).forEach(field => say(forgetField(ownRows(), field.id)))
      delete section.fields
      section.of ??= OPTION_SOURCES.sheets()[0]?.value ?? ''
      section.placement ??= []
    }
    // NEW: a fields section holds no entries, so nothing may fill it, and a section
    // that has just BECOME a list aims at a shelf no existing binding was judged
    // against. Either way the binding is void. (Idempotent: on the common path no
    // row names this section and nothing is said.)
    forgetBinding(section.id)
    // NEW: and so is every demand about it — a fields section cannot be `holds`-ed, and
    // a section that has just become a list holds ids from a shelf nothing has yet.
    say(forgetDemandField(editorState.things, section.id))
  },
  // a section re-aimed at another shelf: every entry placed under it named a
  // thing on the OLD shelf, so the arrays are emptied rather than left dangling.
  // NEW: and every ROW that filled it was showing the old shelf, so its binding goes
  // too — a row must show what the section it fills lists.
  sectionTargetChanged: (section) => {
    say(forgetSectionPlacements(editorState.things, editorState.merged.types.types, section.id))
    forgetBinding(section.id)
    say(forgetDemandField(editorState.things, section.id))   // NEW: its `holds` named a thing on the OLD shelf
  },
  // NEW: the game now builds a DIFFERENT sheet (or none). Named here rather than on
  // the sheet entry itself for now — see renderSheetLine. Every binding is re-judged
  // and each casualty is named, so an engine warning about `fills` always means
  // "somebody hand-edited a file" and never "the editor did this and said nothing".
  // NEW, and it is a DECISION that this hook gains nothing: a demand is a fact about the
  // ENTRY — "Fireball requires Mage" is true in every game that ships Fireball — so a
  // game that changes what the player builds makes some entries unofferable (the border
  // says so, once, by name; the card carries the ⚠) and repairs nothing. This is the one
  // place `fills` and `demands` deliberately differ, and it is what "the rule travels in
  // the book" means in code.
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

// NEW (spec §3): WHAT MINTS AN ID, which is the one place the two layers genuinely differ
// in KIND rather than in address. A game's ids are UUIDs and stay UUIDs. A book may only
// DEFINE ids under its own name and they must fit BOOK_ID — merge.js's bookRules refuses a
// UUID in a book with a sentence that already exists — so a book mints
// `<book>:<noun>-<smallest free ordinal>`: dinosaur-age:row-3, basic:field-7.
//
// THE NOUN COMES FROM MINTS (schema.js), NEVER FROM THE CAPTION. A caption gets renamed and
// an id must not follow it: a book's id is a permanent public reference — a game's
// rowOverrides are keyed by it and another book may point at it — so an id that tracked the
// label would break every reference the first time an author fixed a typo. (It is also the
// hand-authored shelf's own style: "dinosaur-age:row-companions" is a slug, not a caption.)
//
// THE FRESHNESS RULE, and it is the one hazard here: the smallest free ordinal is read from
// `editorState.origins`, which remerge() rebuilds at the top of EVERY paint. So a mint is
// the first birth in this project that depends on the merge being current, and the rule is
// the file's existing one — WRITE ON CLICK, NEVER ON PAINT — now covering ids too:
// `newborn` may only be called from a click handler. Every caller is one (the collection
// builder's "+ Add", the Things pane's "+ Add", the template copy) and each mints ONCE and
// then rerenders, which is what keeps two ids from one handler out of the question.
// A bulk mint (rename, "save as a book") cannot use this at all: it runs on the SERVER,
// where origins is not in hand, and checks the whole shelf instead (spec §3).
const nounFor = (sheetName) =>
  Object.hasOwn(MINTS, sheetName) ? MINTS[sheetName]            // a named sheet: row, sheet, section, field
  : isTypeSheet(sheetName) ? MINTS.thing                        // a thing's sheet is built per TYPE and has no name in SHEETS
  : undefined
const mintId = (sheetName) => {
  if (!S().mintsIds) return crypto.randomUUID()
  const noun = nounFor(sheetName)
  if (noun === undefined) {
    // fail closed, by name, at the border rather than here: a UUID in a book is refused by
    // bookRules' own sentence ("is not in this book's namespace"), which is the sentence
    // that already exists for exactly this. Minting a wrong-but-legal-looking id would be
    // the silent version.
    warnOnce(`No id noun for sheet "${sheetName}" — add a row to MINTS (schema.js)`)
    return crypto.randomUUID()
  }
  const space = `${editorState.subject.name}:${noun}-`
  let n = 1
  while (editorState.origins.has(`${space}${n}`)) n += 1        // the smallest FREE ordinal, over the merged world
  return `${space}${n}`
}

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
  const born = { id: mintId(sheetName) }
  SHEETS[sheetName].forEach(entry => {
    if (entry.key === undefined) return                            // attachment: nothing lives in the element
    if (entry.showIf && born[entry.showIf.key] !== entry.showIf.value) return   // NEW: not this shape
    if (entry.default === null) return                             // sheet rule: null = not written at birth
    born[entry.key] = structuredClone(entry.default)               // a FRESH copy, never the sheet's own [] or {}
  })
  return born
}

// NEW: a newborn from a SOURCE — newborn's twin, and the only new function templates
// need. `newborn` builds from the sheet's defaults; this builds from another thing on
// the same shelf, which is what a template IS.
// Three things are deliberate here and each is one word of the line:
//   a FRESH uuid, never the source's — the copy lands in the GAME's bucket, so origins
//     claims it for the game layer at the next merge and its card is editable even when
//     the source was a frozen book's locked one. That is how a book ships a template.
//   a name that SAYS it is a copy, so two identical names never sit on one shelf and
//     the author is told which card to rename.
//   a DEEP clone of everything else, for the same reason newborn clones each default:
//     two things that share one array are one thing wearing two names. `demands` and
//     the list sections come with it, and that is right — a copy of an entry is a copy
//     of its rules, and everything after this point is what any newborn already gets
//     (the cascade, the repairs, the validation, the canonical save order).
// Spread FIRST, then override: `id` and `name` already exist on the source, so the copy
// keeps the source's key order rather than inventing a second one.
// CHANGED: the fresh id is minted the same way a newborn's is — a copy made inside a BOOK
// lands in the book's own namespace, so it goes through mintId too. The source's sheet is
// its TYPE's, which is the sheet name the caller already has.
const newbornFrom = (source, sheetName) => ({ ...structuredClone(source), id: mintId(sheetName), name: `${source.name} copy` })

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
  if (headerEl) headerEl.prepend(el('span', 'origin-badge', ownerLabel === ownLayer() ? selfWord() : `from ${titleOf(ownerLabel)}`))
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
  const locked = owner !== ownLayer()
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
