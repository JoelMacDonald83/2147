import { totalBudget, groups } from './config/gameConfig.js'
import { flattenGroups } from './helpers.js'
import { computeVisible, dropHidden } from './config/visibility.js'   // NEW: which rows are on screen, and the refund

// the fire-drill roster: every group at every depth, for the mechanics
const allGroups = flattenGroups(groups)

// CHANGED from the old game: state used to import raw config (TOTAL_BUDGET and
// selectionGroups from config.js). Now everything arrives through the gameConfig
// doorway already hydrated — same shapes as before, but min, max and background
// are GUARANTEED to exist on every group, so nothing here ever checks for them.
// The same goes for showWhen: the border has already replaced any gate it
// could not evaluate with { kind: "never" }, so computeVisible never meets a
// dangling id.

// Helper functions

const buildEmptySelections = () => {
  const selections = {}
  allGroups.forEach(group => {
    selections[group.id] = [] // group.id is a UUID now, but the pattern is identical
  })
  return selections
}

const totalCost = (list) =>
  list.reduce((acc, item) => acc + item.cost, 0)

// State

export const gameState = {
  selections: buildEmptySelections(),
  visible: new Set(),   // NEW: the rows on screen right now — filled by settle()
  dropped: [],          // NEW: the picks refunded by the LAST settle, for one status line

  // NEW: after every change, decide what is on screen and refund the picks in
  // rows that just went dark. ONE compute + ONE drop is the fixed point:
  // computeVisible never counted a pick in a row that ends hidden, so dropping
  // those picks cannot change the visible set (oracle L8 proves it).
  settle() {
    const visible = computeVisible(groups, this.selections)
    this.dropped = allGroups.filter(group => !visible.has(group.id)).flatMap(group => this.selections[group.id])
    this.selections = dropHidden(this.selections, visible)
    this.visible = visible
  },
  isVisible(group) {
    return this.visible.has(group.id)
  },

  // hidden rows hold [] after settle, so summing every row is exact
  get spent() {
    return allGroups.reduce(
      (acc, group) => acc + totalCost(this.selections[group.id]),
      0
    )
  },
  get remaining() {
    return totalBudget - this.spent
  },

  // min support (min arrived with rules.json — the old game had no concept of
  // "required picks"). A group is unmet while it has fewer picks than its min.
  // CHANGED: a hidden row cannot be unmet — it is not asking the player anything
  get unmetGroups() {
    return allGroups.filter(group => this.isVisible(group) && this.selections[group.id].length < group.min)
  },
  get isComplete() {
    return this.unmetGroups.length === 0
  },

  get statusMessage() {
    let base = `Remaining: ${this.remaining}`
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
  canAfford(item) {
    return this.remaining - item.cost >= 0
  },
  isSelected(group, item) {
    return this.selections[group.id].includes(item)
  },
  select(group, item) {
    // NEW: loud, never silent — the view never offers a hidden row's button,
    // so reaching this line means something other than a click asked
    if (!this.isVisible(group)) {
      console.log(`${group.label} is not shown`)
      return
    }
    if (this.isSelected(group, item)) {
      console.log(`${item.name} is already selected`)
      return
    }
    if (this.selections[group.id].length >= group.max) {
      console.log(`${group.id} is full (max ${group.max})`)
      return
    }
    if (!this.canAfford(item)) {
      console.log(`${item.name} costs ${item.cost}, but only ${this.remaining} left`)
      return
    }
    this.selections[group.id] = [...this.selections[group.id], item]
    console.log(`${item.name} selected`)
  },
  unSelect(group, item) {
    if (!this.isSelected(group, item)) {
      console.log(`${item.name} isn't selected`)
      return
    }
    this.selections[group.id] = this.selections[group.id].filter(chosen => chosen !== item)
  },
  toggleSelection(group, item) {
    if (this.isSelected(group, item)) {
      this.unSelect(group, item)
    } else {
      this.select(group, item)
    }
    this.settle()   // NEW: the one place picks change from the UI — a pick can open rows, an unpick can close them
  }
}

// NEW: startup — rows gated on picks start hidden; rows with `always` are
// visible before the first click. Runs here, after `selections` exists, so
// computeVisible always sees a key per row.
gameState.settle()
