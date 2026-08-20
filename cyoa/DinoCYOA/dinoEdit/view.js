import { editorState } from './state.js'

const editorEl = document.querySelector('#editor')

const previewEl = document.createElement('p')

const statusEl = document.querySelector('#status')

export const renderSaveStatus = (text) => {
  statusEl.textContent = text
}

const renderPreview = () => {
  previewEl.textContent = `state says: "${editorState.content.meta.heroTitle}"`
}

export const renderMetaEditor = (actions) => {
  const labelEl = document.createElement('label')
  labelEl.textContent = 
  "Hero title: "

  const inputEl = document.createElement('input')
  inputEl.type = 'text'
  inputEl.value = editorState.content.meta.heroTitle

  inputEl.addEventListener('input', ()=>{
    editorState.content.meta.heroTitle = inputEl.value

    renderPreview()
  })

  const saveButtonEl = document.createElement('button')
  saveButtonEl.textContent = 'Save'

  saveButtonEl.addEventListener('click', ()=> actions.save())

  editorEl.appendChild(saveButtonEl)
  labelEl.appendChild(inputEl)
  editorEl.appendChild(labelEl)
  editorEl.appendChild(previewEl)
  renderPreview()
}