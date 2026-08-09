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