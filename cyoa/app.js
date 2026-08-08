// imports
import initialContent from './data.json' with { type: 'json' }
import {render} from './render.js'
// state variables

let displayContent = initialContent

// program constants

// display constants

// setter function
const setDisplayContent = (newDisplayContent) => {
  displayContent = newDisplayContent
  render(newDisplayContent, makeSelection)
}
// named functions
const makeSelection = (sectionId, choiceId) => {
  const newSelections = {
    ...displayContent,
    sections: displayContent.sections.map(section =>
      section.id === sectionId
        ? { ...section, selectedChoiceId: choiceId }
        : section
    )
  }
  setDisplayContent(newSelections)
}
// render helper functions

render(displayContent,makeSelection) 