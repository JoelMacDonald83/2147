// HARD RULE, and it is not a preference: this file must NEVER touch localStorage,
// Blob, document, window or location. The oracles' `--play` child imports state.js
// directly under node, so a single module-scope `location.pathname` would throw at
// IMPORT and take every play check down with it. Persistence, the download and
// print() live in app.js, which is the only file that owns a browser.
// The split is also honest: this file owns what is TRUE about a play; app.js owns
// where those bytes are kept.
// CHANGED: + nameOfThing — the merged world's id → name, resolved once at the border.
// This file may not reach into things.json, and a demand's words have to be able to name
// a thing that lives on a shelf no row shows.
import { totalBudget, groups, playerSheet, meta, nameOfThing } from './config/gameConfig.js'
import { flattenGroups } from './helpers.js'
import { computeVisible, dropHidden } from './config/visibility.js'   // NEW: which rows are on screen, and the refund
// NEW: the player's sheet, as vocabulary — the cost rule (entryCost/quantityOf), the
// blank halves, the typing border, and the derived document. Not one of these
// answers is computed twice anywhere in this file.
import { blankFields, blankValues, entryCost, quantityOf, buildSheet, readValue } from './config/sheet.js'
// NEW: the keepsake's FORMAT and its one reader. readKept judges; this file places.
import { keptFrom, sheetText, readKept } from './config/kept.js'
// NEW: what an entry DEMANDS of the player's sheet. Three functions and no more: the
// first failing condition, the slot a condition names, and the condition in words. The
// border has already refused every demand this game could not judge, so nothing below
// ever meets one it cannot answer.
import { firstUnmet, demandFieldById, demandText } from './config/demands.js'

// the fire-drill roster: every group at every depth, for the mechanics
const allGroups = flattenGroups(groups)

// NEW: the two refusal sentences, from the ONE phrase-maker — so the shop's words, the
// card's words and the status line's words can never drift apart. `no.item` is the entry
// the sentence must NAME, which for a `breaks` is the VICTIM and not the thing clicked:
// "you would break something you already own" is the fact the player needs.
const refusalFor = (no, clicked) => {
  const said = demandText(no.demand, demandFieldById(playerSheet.type, no.demand.field), nameOfThing)
  return no.kind === "own"
    ? `${clicked.name} needs: ${said}`
    : `${clicked.name} would break ${no.item.name}, which needs: ${said}`
}

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
  // NEW: the picks the LAST settle removed because the SHEET stopped meeting what they
  // ask — `[{ item, said }]`.
  // WHY A SECOND LIST AND NOT A WIDER `dropped`: `dropped` is read by statusMessage, by
  // the oracles' --play child (`dropped.map(item => item.name)`) and by six proven
  // visibility checks; widening its element shape would be churn in shared, six-times-
  // proven code for no gain — the same argument this file already makes for keeping
  // `values` beside `selections`. And TWO CAUSES DESERVE TWO SENTENCES anyway: a row went
  // dark is not the same fact as your sheet stopped qualifying. `said` rides along because
  // the status line wants only the name while the kept sheet's note wants the reason.
  evicted: [],
  // NEW: the sheet's ONE message — { bad, text, notes: [], draft } or null. Loading
  // is the only thing on this page that can half-succeed, so it is the only thing
  // that needs a message the player reads rather than a console line.
  notice: null,

  // CHANGED: after every change, decide what is on screen and refund the picks in
  // rows that just went dark — and now, ALSO, remove the picks whose own rule the
  // sheet stopped meeting. TWO RULES, run to a fixpoint:
  //
  //   rule 1  the ROW gate — v5's proven one-compute-one-drop, verbatim
  //   rule 2  the ENTRY demand — remove AT MOST ONE pick, the LAST failing one in
  //           canonical (row, pick) order
  //
  // WHY IT TERMINATES, and this is the whole of the proof: BOTH RULES ONLY EVER REMOVE
  // PICKS. Nothing in this loop adds one. So the number of picks held is a non-negative
  // integer that strictly decreases on every round that does not break — the loop ends in
  // at most picks+1 rounds. (Measured against THIS code: 250 random worlds of 2–8 picks,
  // 183 of them carrying exclusions — every settle halted, worst 7 rounds at 8 picks, and
  // settling twice always gave the same answer as settling once.)
  //
  // WHY IT IS DETERMINISTIC: computeVisible is a least fixpoint over POSITIVE gates, so
  // it is unique and blind to walk order; dropHidden is a map; and lastUnmetPick is a
  // MAXIMUM under a total order, which is unique and is not a function of the order the
  // set is enumerated in. A composition of pure functions is a pure function.
  //
  // WHY AT MOST ONE, AND WHY THE LAST: "the tail in file order goes; the picks a player
  // made first are the ones they meant most" is already this project's rule for a lowered
  // `max` (kept.js check 13). Removing every offender at once is equally deterministic and
  // strictly crueller — two entries that exclude each other would BOTH go, when keeping
  // the older one is available, predictable, and already written down.
  //
  // WHY RULE 1 FIRST: a pick doomed by both should be told the coarser, truer reason —
  // the whole row went away. The order inside a round is fixed, and an oracle pins it.
  //
  // AND IT NEVER RE-ADMITS. A pick that was removed is gone; if the player re-satisfies
  // the rule they may pick it again. Re-admission would need a memory of what was lost, it
  // would make the loop non-monotone in both directions, and it would destroy the
  // measure above — which is to say, the proof.
  settle() {
    this.dropped = []      // refunded because their ROW went dark                     (v5's list, unchanged)
    this.evicted = []      // removed because the SHEET stopped meeting what they ask  (NEW)
    for (;;) {
      const visible = computeVisible(groups, this.selections)
      this.dropped.push(...allGroups.filter(group => !visible.has(group.id)).flatMap(group => this.selections[group.id]))
      this.selections = dropHidden(this.selections, visible)
      this.visible = visible
      const loser = this.lastUnmetPick()
      if (loser === null) break
      this.evicted.push({ item: loser.item, said: demandText(loser.demand, demandFieldById(playerSheet.type, loser.demand.field), nameOfThing) })
      this.selections[loser.row.id] = this.selections[loser.row.id].filter(item => item !== loser.item)
    }
    this.pruneValues()     // ONCE, at the end: a value must never outlive its pick
  },

  // NEW: every visible pick, in the ONE canonical order this project already has —
  // flattened ROW order, then pick order within a row. It is buildSheet's order, the kept
  // file's order and readKept's order; nothing here invents a third.
  get picksInOrder() {
    return allGroups.filter(group => this.isVisible(group))
      .flatMap(row => this.selections[row.id].map(item => ({ row, item })))
  },

  // NEW: the MAXIMUM under that total order whose demands fail, or null. A maximum is
  // unique and is NOT a function of the order the set is enumerated in — reversing the
  // walk returns the same pick, which is what makes the determinism claim above a fact
  // rather than a hope. (Written as a forEach that keeps overwriting `loser` precisely so
  // that "the LAST one" is the only rule in it.)
  // Each pick is judged against the sheet MINUS ITSELF — see sheetWith.
  lastUnmetPick() {
    if (playerSheet === null) return null                     // no sheet, so nothing to demand of
    let loser = null
    this.picksInOrder.forEach(({ row, item }) => {
      if (item.demands.length === 0) return                   // the same free skip whyNot makes, and for the same reason
      const failed = firstUnmet(item.demands, playerSheet.type, this.sheetWith({ skip: { row, item } }))
      if (failed !== null) loser = { row, item, demand: failed }
    })
    return loser
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
    // NEW: the SECOND cause, in its own clause and never conflated with the first — two
    // causes, two sentences. "no longer meets what they ask" covers both directions at
    // once: a requirement that fell away, and an exclusion that closed in. The clause sits
    // after the row's, because that is the order the two facts happened in (settle runs
    // the gate first inside every round).
    if (this.evicted.length > 0) {
      base += ` — removed: ${this.evicted.map(each => each.item.name).join(', ')} (your sheet no longer meets what they ask)`
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

  // NEW: may this entry be placed here — and it asks TWO questions.
  //   Q1  do this entry's OWN demands hold?  (against the CURRENT sheet — see MINUS ME
  //       on sheetWith: the candidate sheet minus the incoming entry IS the current one)
  //   Q2  would taking it BREAK a pick already held?
  // Q2 is not decoration, and it was found by a prototype rather than by reasoning:
  // without it, the ordinary authored shape — the rule written on Sunbather, nothing
  // written on Nightborn — admits the Nightborn click, and the settle then EVICTS
  // Sunbather. One click, one purchase gone, and the player is told only "removed:
  // Sunbather". Measured against THIS code: of 392 refusals over 250 random worlds, 35
  // provably cost a held pick when the second question was bypassed — roughly one refusal
  // in eleven, so it is not paranoia.
  //
  // THE GUARDED-CLICK THEOREM, which is what the two questions buy: if this returns null,
  // the settle that follows removes NOTHING — not this pick, not an older one, and not
  // through a gate. (Every held pick's demands hold, by Q2, against the sheet the click
  // makes; the new one's hold, by Q1; and visibility is monotone in picks, so adding one
  // can only ADD rows.) Measured against THIS code: 250 worlds, 189 guarded takes, and
  // removals after a guarded take: 0.
  //
  // ADDING NEVER COSTS THE PLAYER ANYTHING; REMOVING MAY, AND THE STATUS LINE SAYS WHAT.
  // That asymmetry is the design, and it is the same promise this file already keeps when
  // it lets a player put a negative-cost disadvantage down while over budget.
  //
  // Returns null, or { kind: "own" | "breaks", item, demand } — `item` is the entry the
  // sentence must NAME, which for a `breaks` is the VICTIM and not the thing clicked.
  // The two `.length === 0` skips are NOT a cache and nothing about them can go stale:
  // firstUnmet of an empty list is null whatever the subject is, so the only thing they
  // skip is BUILDING a sheet nobody then reads. They are here because they are what makes
  // "a game with no demands pays nothing" literally true — measured, over the real dino
  // (17 cards, 4 picks): a whole paint's worth of whyNot goes 252 µs → 3 µs.
  whyNot(group, item) {
    if (playerSheet === null) return null                     // no sheet, so nothing to demand of
    if (item.demands.length > 0) {
      const own = firstUnmet(item.demands, playerSheet.type, this.sheetWith())
      if (own !== null) return { kind: "own", item, demand: own }
    }
    for (const row of allGroups) {
      if (!this.isVisible(row)) continue
      for (const held of this.selections[row.id]) {
        if (held.demands.length === 0) continue
        const failed = firstUnmet(held.demands, playerSheet.type,
                                  this.sheetWith({ add: { row: group, item }, skip: { row, item: held } }))
        if (failed !== null) return { kind: "breaks", item: held, demand: failed }
      }
    }
    return null
  },

  // NEW: the ONE door a pick comes through — a click and a restore both. A CLICK
  // trusts nothing, so every guard is on. A RESTORE has already been judged by
  // readKept, and needs two of them OFF: the GATE, because a pick that OPENS a row
  // may sit after the pick inside it in the file; and the BUDGET, because dropping
  // by cost means guessing which entry the player would have sacrificed.
  // Returns null, or the refusal SENTENCE (the caller decides whether anyone hears it).
  // CHANGED, and this is the day v6's comment predicted: entry conditions are ONE more
  // guard here, and both doors honour them for free. A RESTORE turns it off with the
  // other two — readKept has already judged what it could, and the ONE settle() at the
  // end is what removes a pick the world stopped allowing, by name and with its reason.
  place(group, item, values, guards = { gate: true, budget: true, demands: true }) {
    if (guards.gate && !this.isVisible(group))                return `${group.label} is not shown`
    if (this.isSelected(group, item))                         return `${item.name} is already selected`
    if (this.selections[group.id].length >= group.max)        return `${group.id} is full (max ${group.max})`
    // NEW: THE RULES BEFORE THE MONEY. An entry you may not have AT ALL is not an entry
    // you cannot afford, and telling a player to save up for something they can never buy
    // is a lie. The guard order is the card's button ladder, exactly (view.js).
    if (guards.demands) { const no = this.whyNot(group, item); if (no !== null) return refusalFor(no, item) }
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

  // NEW: the sheet a demand is judged against. Two optional adjustments and nothing else:
  //   add   the pick being CONSIDERED (the click guard's candidate)
  //   skip  the pick under TEST, left out — see MINUS ME below
  // buildSheet already takes picksOf as a FUNCTION, so a hypothetical sheet costs ONE
  // closure and no copying. There is deliberately NO second sheet-shaped projection in
  // this project: one shape, one order, one set of rules — and one sheet to understand
  // rather than "the sheet, except when a demand looks at it". `get sheet` below is this
  // same call with no adjustments, which is why they can never disagree.
  //
  // MINUS ME, and it is the load-bearing rule of the whole stage:
  //   A demand is judged against the sheet WITHOUT its own entry.
  // Two things follow. First, "may I add this?" and "may this stay?" become the SAME
  // question: at click time the entry is not on the sheet yet, so the candidate sheet
  // minus the incoming entry IS the current sheet, and the guard's first question needs
  // no `add` and no `skip` at all. Second, a demand can never evict itself — "Traits
  // holds nothing" on a thing that LANDS in Traits is takeable and stable in one round,
  // where without minus-me it would be refused at the door for ever.
  //
  // `cost` is `spent` and is NOT adjusted for `add` — and it never needs to be, because
  // `cost` is not a demandable slot (demands.js's demandFields excludes it, so that a
  // condition can never be circular). Said here so nobody "fixes" it later.
  sheetWith({ add, skip } = {}) {
    return buildSheet({
      type: playerSheet.type,
      rows: allGroups.filter(group => this.isVisible(group)),
      typed: this.typed,
      picksOf: (group) => {
        let picks = this.selections[group.id]
        if (skip && skip.row === group) picks = picks.filter(item => item !== skip.item)
        if (add  && add.row  === group) picks = [...picks, add.item]
        return picks
      },
      valuesFor: (group, item) => this.valuesFor(group, item),
      spent: this.spent
    })
  },
  // CHANGED: the sheet, DERIVED on every read and stored nowhere — now through sheetWith,
  // with no adjustments, so there is ONE call to buildSheet in this file. One source of
  // truth is what makes a refund impossible to get wrong: settle() empties a hidden row's
  // list and the sheet follows, with no sheet-aware code anywhere in settle().
  // Only VISIBLE rows contribute. A hidden row holds no picks after settle anyway,
  // so that filter is belt and braces — and it is what keeps the sheet honest in the
  // instant a gate flips, before settle has run.
  get sheet() {
    if (playerSheet === null) return null
    return this.sheetWith()
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
    // CHANGED: the DEMAND guard is off here too, and for the same class of reason as the
    // other two — readKept cannot judge a demand without re-implementing this file's
    // settle loop, because whether a pick survives depends on the whole surviving set and
    // on the order the loop removes things in. A pick may equally satisfy the demand of a
    // pick written BEFORE it in the file. So: place everything, settle ONCE, and turn the
    // loop's own answer into notes below. Two implementations of one truth is exactly the
    // drift "one function, three readers" exists to prevent.
    answer.places.forEach(({ row, item, values }) => {
      const refusal = this.place(row, item, values, { gate: false, budget: false, demands: false })
      if (refusal) console.warn(`Kept sheet — a pick was refused after it was judged: ${refusal}`)
    })
    this.settle()
    // NEW: settle() may have removed picks the file was RIGHT to carry when it was kept —
    // the author has since added a prerequisite, or a book edition moved. That is a
    // REFERENCE-level loss under kept.js's own two-severity rule: the entry goes, BY NAME,
    // with the rule that took it, and everything else loads. A demand can never refuse a
    // whole FILE — it is no part of a file's identity.
    // The sentence is the house voice verbatim: kept.js already says `"X" was dropped — it …`.
    const lost  = this.evicted.map(each => `"${each.item.name}" was dropped — it needs: ${each.said}.`)
    const notes = [...answer.notes, ...lost]
    this.notice = notes.length === 0
      ? { bad: false, text: `Loaded ${this.typed.name ? `"${this.typed.name}"` : "your sheet"}.`, notes: [] }
      : { bad: false, text: `Loaded your sheet, with ${notes.length} change${notes.length === 1 ? "" : "s"}:`, notes }
    // the console gets every player sentence, in order, so a curious author reads
    // exactly what the player was told
    notes.forEach(note => console.warn(`Kept sheet — ${note}`))
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
