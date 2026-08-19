import { TOTAL_BUDGET, selectionGroups } from './config.js'

// Helper functions

const buildEmptySelections = () => {
  const selections = {}
  selectionGroups.forEach(group => {
    selections[group.id] = []
  })
  return selections
}

const totalCost = (list)=> 
  list.reduce((acc, ci)=>acc+ci.cost ,0)

// State

export const gameState = {
  selections: buildEmptySelections(),

  get spent(){
    return selectionGroups.reduce(
      (acc, group) => acc + totalCost(this.selections[group.id]),
      0
    )
  },
   get remaining(){
    return TOTAL_BUDGET - this.spent
  },
  get statusMessage(){
    const base = `Remaining: ${this.remaining}`
    return this.remaining === 0
      ? `${base} — you may only choose free options`
      : base
  },
  get canAffordMore(){
    return this.remaining > 0
  }, 
  canAfford(item){ 
    return this.remaining - item.cost >= 0
  },
  isSelected(group, item) {
    return this.selections[group.id].includes(item)
  },
  select(group, item){
    if(this.isSelected(group, item)){
      console.log(`${item.name} is already selected`)
      return
    }
    if(this.selections[group.id].length >= group.max){
      console.log(`${group.id} is full (max ${group.max})`)
      return
    }
    if(!this.canAfford(item)){
      console.log(`${item.name} costs ${item.cost}, but only ${this.remaining} left`)
      return
    }
    this.selections[group.id] = [...this.selections[group.id], item]
    console.log(`${item.name} selected`)
  },
  unSelect(group, item){
    if(!this.isSelected(group, item)){
      console.log(`${item.name} isn't selected`)
      return
    }
    this.selections[group.id] = this.selections[group.id].filter(chosen => chosen !== item)
  },
  toggleSelection(group, item){
    if(this.isSelected(group, item)){
      this.unSelect(group, item)
    } else {
      this.select(group, item)
    }
  }
}