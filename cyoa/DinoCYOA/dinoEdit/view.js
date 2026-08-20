import { editorState } from './state.js'

const editorEl = document.querySelector('#editor')

const previewEl = document.createElement('p')

const renderPreview = () => {
  previewEl.textContent = `state says: "${editorState.content.meta.heroTitle}"`
}

export const renderMetaEditor = () => {
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
  labelEl.appendChild(inputEl)
  editorEl.appendChild(labelEl)
  editorEl.appendChild(previewEl)
  renderPreview()
}