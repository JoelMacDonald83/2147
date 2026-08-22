// DOM constants
const displayArea = document.getElementById('display-area')
const pointsArea = document.getElementById('points-area')
const resultsArea = document.getElementById('results-area')
const heroSection = document.getElementById('hero-section')
const optionsSection = document.getElementById('options-section')
const patronChoices = document.getElementById('patron-choices')
const patronResult = document.getElementById('patron-result')
const factionChoices = document.getElementById('faction-choices')
const factionResult = document.getElementById('faction-result')
const patronArea = document.getElementById('patron-area')
const factionArea = document.getElementById('faction-area')
function renderHeroSection(hero){
  heroSection.textContent = hero[0].text
}

function renderPoints(points) {
  pointsArea.textContent = `Points: ${points}`
}

function renderPatronCards(patrons, onClick, patronSelection, PATRON_SECTION){
  patronChoices.innerHTML = ''
patronArea.querySelector('.patronTop')?.remove()
  const patronTop = document.createElement('div')
  patronTop.classList.add('patronTop')
  patronTop.textContent = PATRON_SECTION.heading
  patronArea.prepend(patronTop)

  patrons.forEach(patron => {
    const card = document.createElement('div')
    card.classList.add('patron-choice')
    if (patron === patronSelection) card.classList.add('patron-choice-selected')
    card.addEventListener('click', ()=>onClick(patron))
    const titleName = document.createElement('h2')
    const descriptionDisplay = document.createElement('p')
    descriptionDisplay.textContent = patron.description
    const traitList = document.createElement('ul')
    patron.traits.forEach(trait =>{
      const listItem = document.createElement("li")
      listItem.textContent = trait
      traitList.appendChild(listItem)
    }
    )
    const pointDisplay = document.createElement('p')
    const imageLayer = document.createElement('div')
    imageLayer.style.backgroundImage = `url(${patron.imageURL})`
    imageLayer.classList.add('patron-image')
    titleName.textContent = patron.name 
    pointDisplay.textContent = `Cost:${patron.points}` 
    card.appendChild(titleName)
    card.appendChild(descriptionDisplay)
    card.appendChild(imageLayer)
    card.appendChild(traitList)
    card.appendChild(pointDisplay)
    patronChoices.appendChild(card)
  })
}

const renderPatronSelection = (patronSelection) => {
  patronSelection === null 
    ? patronResult.textContent = 'nothing selected yet'
    : patronResult.textContent = (patronSelection.name)
}

const renderFactionCards = (factions, setSelectedFaction, factionSelection, FACTION_SECTION) => {
  factionChoices.innerHTML = ''
factionArea.querySelector('.factionTop')?.remove()
  const factionTop = document.createElement('div')
  factionTop.classList.add('factionTop')
  factionTop.textContent = FACTION_SECTION.heading
  factionArea.prepend(factionTop)

  factions.forEach(faction => {
    const card = document.createElement('div')
    card.classList.add('faction-choice')
    if (faction === factionSelection) card.classList.add('faction-choice-selected')
    card.addEventListener('click', ()=>setSelectedFaction(faction))
    const titleName = document.createElement('h2')
    const descriptionDisplay = document.createElement('p')
    descriptionDisplay.textContent = faction.description
    const traitList = document.createElement('ul')
    faction.traits.forEach(trait =>{
      const listItem = document.createElement("li")
      listItem.textContent = trait
      traitList.appendChild(listItem)
    }
    )
    const pointDisplay = document.createElement('p')
    const imageLayer = document.createElement('div')
    imageLayer.style.backgroundImage = `url(${faction.imageURL})`
    imageLayer.classList.add('faction-image')
    titleName.textContent = faction.name 
    pointDisplay.textContent = `Cost: ${faction.points}`
    card.appendChild(titleName)
    card.appendChild(descriptionDisplay)
    card.appendChild(imageLayer)
    card.appendChild(traitList)
    card.appendChild(pointDisplay)
    factionChoices.appendChild(card)
  })
}

const renderFactionSelection = (factionSelection) => {
  factionSelection === null 
    ? factionResult.textContent = 'nothing selected yet'
    : factionResult.textContent = (factionSelection.name)
}

export default function render(points, patrons, hero, onClick, patronSelection, setSelectedFaction, selectedFaction, factions, PATRON_SECTION, FACTION_SECTION) {
  renderPoints(points),
  renderHeroSection(hero)

  renderPatronCards(patrons, onClick, patronSelection, PATRON_SECTION)
  renderPatronSelection(patronSelection)
  renderFactionCards(factions, setSelectedFaction, selectedFaction, FACTION_SECTION)
  renderFactionSelection(selectedFaction)

}