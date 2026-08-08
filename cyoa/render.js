// DOM variables
const headingTitle = document.getElementById('heading-title')
const displayArea = document.getElementById('display-area')

const renderChoice = (choice, section, onChoiceClick) => {
  const choiceEl = document.createElement('div')
  const isSelected = choice.id === section.selectedChoiceId
  choiceEl.className = isSelected ? 'choice selected' : 'choice'
  choiceEl.textContent = `${choice.title} — ${choice.text}`
  choiceEl.addEventListener('click', () => onChoiceClick(section.id, choice.id))
  return choiceEl
}
const renderSection = (section, onChoiceClick) => {
  const sectionEl = document.createElement('div')

  const sectionTitle = document.createElement('h2')
  sectionTitle.textContent = section.title
  sectionEl.appendChild(sectionTitle)

  section.choices.forEach(choice => {
    sectionEl.appendChild(renderChoice(choice, section, onChoiceClick))
  })

  return sectionEl
}
// render function
export const render = (displayState, onChoiceClick) => {
  headingTitle.textContent = displayState.title
  displayArea.innerHTML = ''

  displayState.sections.forEach(section => {
    displayArea.appendChild(renderSection(section, onChoiceClick))
  })
}