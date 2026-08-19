import { totalBudget, groups } from './config/gameConfig.js'
// CHANGED from the old game: state used to import raw config (TOTAL_BUDGET and
// selectionGroups from config.js). Now everything arrives through the gameConfig
// doorway already hydrated — same shapes as before, but min, max and background
// are GUARANTEED to exist on every group, so nothing here ever checks for them.

// Helper functions

const buildEmptySelections = () => {
  const selections = {}
  groups.forEach(group => {
    selections[group.id] = [] // group.id is a UUID now, but the pattern is identical
  })
  return selections
}

const totalCost = (list) =>
  list.reduce((acc, item) => acc + item.cost, 0)

// State

export const gameState = {
  selections: buildEmptySelections(),

  get spent() {
    return groups.reduce(
      (acc, group) => acc + totalCost(this.selections[group.id]),
      0
    )
  },
  get remaining() {
    return totalBudget - this.spent
  },

  // NEW: min support (min arrived with rules.json — the old game had no concept
  // of "required picks"). A group is unmet while it has fewer picks than its min.
  get unmetGroups() {
    return groups.filter(group => this.selections[group.id].length < group.min)
  },
  get isComplete() {
    return this.unmetGroups.length === 0
  },

  get statusMessage() {
    const base = `Remaining: ${this.remaining}`
    // NEW: while any required group is unmet, the status nags about it by label
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
  }
}
