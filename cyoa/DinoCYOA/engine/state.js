// HARD RULE, and it is not a preference: this file must NEVER touch localStorage,
// Blob, document, window or location. The oracles' `--play` child imports state.js
// directly under node, so a single module-scope `location.pathname` would throw at
// IMPORT and take every play check down with it. Persistence, the download and
// print() live in app.js, which is the only file that owns a browser.
// The split is also honest: this file owns what is TRUE about a play; app.js owns
// where those bytes are kept.
import { totalBudget, groups, playerSheet, meta } from './config/gameConfig.js'
import { flattenGroups } from './helpers.js'
import { computeVisible, dropHidden } from './config/visibility.js'   // NEW: which rows are on screen, and the refund
// NEW: the player's sheet, as vocabulary — the cost rule (entryCost/quantityOf), the
// blank halves, the typing border, and the derived document. Not one of these
// answers is computed twice anywhere in this file.
import { blankFields, blankValues, entryCost, quantityOf, buildSheet, readValue } from './config/sheet.js'
// NEW: the keepsake's FORMAT and its one reader. readKept judges; this file places.
import { keptFrom, sheetText, readKept } from './config/kept.js'

// the fire-drill roster: every group at every depth, for the mechanics
const allGroups = flattenGroups(groups)

// CHANGED from the old game: state used to import raw config (TOTAL_BUDGET and
// selectionGroups from config.js). Now everything arrives through the gameConfig
// doorway already hydrated — same shapes as before, but min, max and background
// are GUARANTEED to exist on every group, so nothing here ever checks for them.
// The same goes for showWhen: the border has already replaced any gate it
// could not evaluate with { kind: "never" }, so computeVisible never meets a
// dangling id.
// NEW, and the same bargain: `group.fills` is a SECTION OBJECT or null, never an
// id, and `group.quantityField` is a number field or null. Nothing below asks
// "does this game build a sheet?" more than once, and nothing below reads a
// section id.

// Helper functions

const buildEmptySelections = () => {
  const selections = {}
  allGroups.forEach(group => {
    selections[group.id] = [] // group.id is a UUID now, but the pattern is identical
  })
  return selections
}

// NEW: a fresh typed half — every slot on the declared sheet, holding its default.
// A game that builds no sheet types nothing, so its typed half is {} and stays {}.
const blankTyped = () => playerSheet === null ? {} : blankFields(playerSheet.type)

// State

export const gameState = {
  selections: buildEmptySelections(),
  // NEW: rowId → thingId → { placement key: value } — this pick's placement values.
  // WHY BESIDE selections AND NOT INSIDE IT: making a pick `{ item, values }` would
  // ripple into computeVisible (which asks `picksIn(row).some(item => item.id === …)`),
  // into six proven visibility oracles, into view.js's summary line and into the
  // --play child's `dropped.map(item => item.name)` — churn in shared, six-times-proven
  // code for no gain. (rowId, thingId) is a unique address because isSelected
  // guarantees a row holds a thing at most once.
  // The one price that buys — a value must never outlive its pick — is paid in ONE
  // place, pruneValues(), because settle() already runs after every change.
  values: {},
  typed: blankTyped(),  // NEW: what the player typed, one slot per field of the sheet
  visible: new Set(),   // NEW: the rows on screen right now — filled by settle()
  dropped: [],          // NEW: the picks refunded by the LAST settle, for one status line
  // NEW: the sheet's ONE message — { bad, text, notes: [], draft } or null. Loading
  // is the only thing on this page that can half-succeed, so it is the only thing
  // that needs a message the player reads rather than a console line.
  notice: null,

  // NEW: after every change, decide what is on screen and refund the picks in
  // rows that just went dark. ONE compute + ONE drop is the fixed point:
  // computeVisible never counted a pick in a row that ends hidden, so dropping
  // those picks cannot change the visible set (oracle L8 proves it).
  settle() {
    const visible = computeVisible(groups, this.selections)
    this.dropped = allGroups.filter(group => !visible.has(group.id)).flatMap(group => this.selections[group.id])
    this.selections = dropHidden(this.selections, visible)
    this.visible = visible
    this.pruneValues()                                        // NEW
  },
  // NEW: the price of keeping values beside selections instead of inside them.
  // dropHidden empties a hidden row's list; this drops the values that went with it,
  // so a refunded pick cannot leave a quantity behind to be found by the next load.
  // unSelect deletes its own slot, so this is the only other door.
  pruneValues() {
    Object.keys(this.values).forEach(rowId => {
      const alive = new Set((this.selections[rowId] ?? []).map(item => item.id))
      Object.keys(this.values[rowId]).forEach(id => { if (!alive.has(id)) delete this.values[rowId][id] })
    })
  },
  isVisible(group) {
    return this.visible.has(group.id)
  },

  // NEW: this pick's placement values — {} for a pick in a row that fills nothing,
  // and {} for a pick made before this row was bound. One shape, always.
  valuesFor(group, item) { return this.values[group.id]?.[item.id] ?? {} },

  // hidden rows hold [] after settle, so summing every row is exact
  // CHANGED: entryCost, not item.cost — a quantity of 3 costs three times. The rule
  // itself lives in sheet.js and is asked, never repeated (see canAfford below).
  get spent() {
    return allGroups.reduce((acc, group) => acc + this.selections[group.id]
      .reduce((sum, item) => sum + entryCost(item, group.fills, this.valuesFor(group, item)), 0), 0)
  },
  get remaining() {
    return totalBudget - this.spent
  },
  // NEW: how far past the budget we are, as a positive number. `canAfford` guards
  // only ADDING, so a CLICK can reach this too: dropping a negative-cost pick (a
  // disadvantage that was paying for something) raises `spent`, and so does a gate
  // closing over one, which settle() refunds. Loading a sheet into a game whose
  // budget shrank reaches it as well. The status line says so in words either way.
  get overBy() { return Math.max(0, -this.remaining) },

  // min support (min arrived with rules.json — the old game had no concept of
  // "required picks"). A group is unmet while it has fewer picks than its min.
  // CHANGED: a hidden row cannot be unmet — it is not asking the player anything
  // NEW, said once here because it is the thing most likely to be misread: min and
  // max count PICKS, never quantities. `max: 3` on Gear means three different
  // entries, each in any quantity the budget can pay.
  get unmetGroups() {
    return allGroups.filter(group => this.isVisible(group) && this.selections[group.id].length < group.min)
  },
  get isComplete() {
    return this.unmetGroups.length === 0
  },

  get statusMessage() {
    // NEW, one clause: over budget is reachable — by dropping a negative-cost pick,
    // by a gate closing over one, or by loading a sheet into a game whose budget
    // shrank or whose costs rose — so it gets the plain sentence a player can act
    // on instead of "Remaining: -4". Nothing is forbidden here: a player must
    // always be able to put a disadvantage down, even when it leaves them short.
    let base = this.remaining < 0
      ? `Over budget by ${this.overBy} — remove something`
      : `Remaining: ${this.remaining}`
    // NEW: a refund is said out loud once, or the player watches points reappear for no reason
    if (this.dropped.length > 0) {
      base += ` — removed: ${this.dropped.map(item => item.name).join(', ')} (their row is no longer shown)`
    }
    // while any required group is unmet, the status nags about it by label
    if (!this.isComplete) {
      const names = this.unmetGroups.map(group => group.label).join(', ')
      return `${base} — still required: ${names}`
    }
    return this.remaining === 0
      ? `${base} — you may only choose free options`
      : base
  },

  get canAffordMore() {
    return this.remaining > 0
  },
  // CHANGED: the group is APPENDED, never reordered, so a call site that has not
  // been updated keeps working — it simply prices the entry at ×1, which is exactly
  // what an unbound row costs anyway.
  // What a NEW pick costs is the section's DEFAULT quantity ({} reads as the field's
  // own default), not 1: a book may write `default: 3`, and the button must never
  // offer what cannot be paid for.
  canAfford(item, group) { return this.remaining - entryCost(item, group?.fills ?? null, {}) >= 0 },
  isSelected(group, item) {
    return this.selections[group.id].includes(item)
  },

  // NEW: the ONE door a pick comes through — a click and a restore both. A CLICK
  // trusts nothing, so every guard is on. A RESTORE has already been judged by
  // readKept, and needs two of them OFF: the GATE, because a pick that OPENS a row
  // may sit after the pick inside it in the file; and the BUDGET, because dropping
  // by cost means guessing which entry the player would have sacrificed.
  // Returns null, or the refusal SENTENCE (the caller decides whether anyone hears it).
  // This function exists so that the day entry conditions arrive they are ONE more
  // guard here, and both doors honour them for free.
  place(group, item, values, guards = { gate: true, budget: true }) {
    if (guards.gate && !this.isVisible(group))                return `${group.label} is not shown`
    if (this.isSelected(group, item))                         return `${item.name} is already selected`
    if (this.selections[group.id].length >= group.max)        return `${group.id} is full (max ${group.max})`
    if (guards.budget && !this.canAfford(item, group))        return `${item.name} costs ${item.cost}, but only ${this.remaining} left`
    this.selections[group.id] = [...this.selections[group.id], item]
    ;(this.values[group.id] ??= {})[item.id] = values
    return null
  },
  // CHANGED: through place, so there is one list of guards and not two. The four
  // sentences are v5's, verbatim — including "<uuid> is full", which reads oddly and
  // is not this stage's to fix. They are console-only: the view never offers a
  // button that would trip one, so reaching a line here means something other than a
  // click asked.
  select(group, item) {
    const refusal = this.place(group, item, blankValues(group.fills))
    if (refusal) { console.log(refusal); return }
    console.log(`${item.name} selected`)
  },
  // CHANGED: + the values slot. A value must never outlive its pick, and this is the
  // door that does not go through settle's prune.
  unSelect(group, item) {
    if (!this.isSelected(group, item)) {
      console.log(`${item.name} isn't selected`)
      return
    }
    this.selections[group.id] = this.selections[group.id].filter(chosen => chosen !== item)
    delete this.values[group.id]?.[item.id]
  },
  toggleSelection(group, item) {
    if (this.isSelected(group, item)) {
      this.unSelect(group, item)
    } else {
      this.select(group, item)
    }
    this.settle()   // NEW: the one place picks change from the UI — a pick can open rows, an unpick can close them
  },

  // NEW: the quantity, one step at a time — the only edit that moves the budget
  // without changing WHAT is picked. The floor is 1: below 1 an entry means nothing,
  // and the honest way to have none of something is to unpick it. view.js already
  // DISABLES the + when the budget cannot pay, so this guard is the closed door
  // behind the prevention: anything scripted or keyboard-driven meets the same wall.
  stepQuantity(group, item, by) {
    // this row's section has no multiplying field, so there is no quantity to step.
    // Only a scripted call can arrive here (the stepper is drawn from quantityField),
    // and it leaves without touching a thing.
    if (!group.quantityField) { console.log(`${item.name}: this row has no quantity to change`); return }
    const now = quantityOf(group.fills, this.valuesFor(group, item))
    const next = now + by
    if (next < 1) { console.log(`${item.name}: a quantity cannot go below 1 — remove it instead`); return }
    const extra = item.cost * (next - now)
    if (extra > this.remaining) { console.log(`${item.name} at ${next} costs ${extra} more, but only ${this.remaining} left`); return }
    this.values[group.id][item.id][group.quantityField.key] = next
  },
  // NEW: any other placement value (a Level, a note on a companion). FREE — only
  // `quantity` moves the budget — so nothing here can refuse it; the field's KIND is
  // the only border it crosses, and readValue is that border.
  setValue(group, item, field, raw) { this.values[group.id][item.id][field.key] = readValue(field, raw) },
  // NEW: one thing the player typed, through the same border. Same function, same
  // kinds, same defaults as the placement values above and as the editor's own
  // builders: one contract, two doors.
  setTyped(field, raw) { this.typed[field.key] = readValue(field, raw) },

  // NEW: the sheet, DERIVED on every read and stored nowhere. One source of truth is
  // what makes a refund impossible to get wrong: settle() empties a hidden row's
  // list and the sheet follows, with no sheet-aware code anywhere in settle().
  // Only VISIBLE rows contribute. A hidden row holds no picks after settle anyway,
  // so that filter is belt and braces — and it is what keeps the sheet honest in the
  // instant a gate flips, before settle has run.
  get sheet() {
    if (playerSheet === null) return null
    return buildSheet({
      type: playerSheet.type,
      rows: allGroups.filter(group => this.isVisible(group)),
      typed: this.typed,
      picksOf: (group) => this.selections[group.id],
      valuesFor: (group, item) => this.valuesFor(group, item),
      spent: this.spent
    })
  },
  // NEW: the keepsake, as an object and as bytes. TWO getters and not one, because
  // the file NAME is read off the object (the sheet's name, slugged) and building it
  // twice would be two chances to disagree.
  // `rows` is EVERY row, not just the visible ones: the file is the player's two
  // stores, and a hidden row holds nothing to write anyway.
  get kept() {
    if (playerSheet === null) return null
    return keptFrom({
      title: meta.pageTitle,
      sheetId: playerSheet.id,
      type: playerSheet.type,
      rows: allGroups,
      typed: this.typed,
      picksOf: (group) => this.selections[group.id],
      valuesFor: (group, item) => this.valuesFor(group, item)
    })
  },
  get keptText() { const kept = this.kept; return kept === null ? null : sheetText(kept) },

  // NEW: the door a downloaded file, a pasted draft and the autosave all come
  // through — one reader, so there is one set of sentences and one set of rules.
  // readKept DECIDES (purely, node-runnable); this PLACES.
  loadKept(text, { fromDraft = false } = {}) {
    const answer = readKept(text, {
      title: meta.pageTitle,
      sheetId: playerSheet?.id ?? "",
      type: playerSheet?.type ?? null,
      rows: allGroups
    })
    // an IDENTITY refusal loads nothing at all: the player's current sheet is not
    // touched, because nothing in that file could have been salvaged into it
    if (!answer.ok) { this.notice = { bad: true, text: answer.refusal, notes: [], draft: fromDraft }; return false }
    this.typed = answer.fields
    this.selections = buildEmptySelections(); this.values = {}
    // Visibility is bypassed during the loop and settled ONCE at the end: a pick
    // that OPENS a gated row may sit after the pick inside it, and placing them one
    // by one through the gate would lose the second. computeVisible is a least
    // fixpoint — it is built for exactly this — and anything genuinely unreachable
    // comes back through `dropped` and the status line the engine has had since v5.
    // readKept has already judged everything else `place` could object to, so this
    // loop is EXPECTED to collect no refusals; one would be a bug, and it says so.
    answer.places.forEach(({ row, item, values }) => {
      const refusal = this.place(row, item, values, { gate: false, budget: false })
      if (refusal) console.warn(`Kept sheet — a pick was refused after it was judged: ${refusal}`)
    })
    this.settle()
    this.notice = answer.notes.length === 0
      ? { bad: false, text: `Loaded ${this.typed.name ? `"${this.typed.name}"` : "your sheet"}.`, notes: [] }
      : { bad: false, text: `Loaded your sheet, with ${answer.notes.length} change${answer.notes.length === 1 ? "" : "s"}:`, notes: answer.notes }
    // the console gets every player sentence, in order, so a curious author reads
    // exactly what the player was told
    answer.notes.forEach(note => console.warn(`Kept sheet — ${note}`))
    return true
  },
  // NEW: and it is not optional. Because app.js autosaves, reloading the page no
  // longer gives a blank sheet — so there has to be a way to ASK for one. Both
  // stores go, the message goes, and settle() puts the gated rows back to sleep.
  // (app.js confirms first, and removes the saved slot: this file does not know
  // there is one.)
  startOver() {
    this.typed = blankTyped()
    this.selections = buildEmptySelections()
    this.values = {}
    this.notice = null
    this.settle()
  }
}

// NEW: startup — rows gated on picks start hidden; rows with `always` are
// visible before the first click. Runs here, after `selections` exists, so
// computeVisible always sees a key per row.
gameState.settle()
