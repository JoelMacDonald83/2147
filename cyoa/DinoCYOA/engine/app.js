// app.js is the ONLY file in the engine that touches localStorage, Blob, print()
// or location. That is not tidiness, it is a hard rule with a bruise behind it:
// the oracles' `--play` child imports state.js directly under NODE, so a single
// module-scope `location.pathname` in there would throw at import and take every
// play check down with it. state.js owns what is TRUE about a play; this file owns
// where those bytes are kept and which browser buttons move them.
import { meta, pageTheme, playerSheet } from './config/gameConfig.js'
import { gameState } from './state.js'
import { keptFileName } from './config/kept.js'   // NEW: the file's own name, read off the sheet's name
import { renderMeta, applyPageTheme, render, renderStatus } from './view.js'

// The conductor — same wiring as the old newApp.js, plus the two one-time
// painters that only exist because title/hero/theme are DATA now:

// NEW: where this deployment's autosave lives. The pathname is part of the key on
// purpose: "/games/dino/" and "/dist/dino/" are two deployments of one game, and a
// draft made in one must not appear in the other.
const SLOT = `cyoa.sheet:${location.pathname}`
// NEW: a private window, a file:// origin or blocked site data makes every one of
// these throw. That is a SENTENCE on the sheet (view.js draws it), never an
// exception that stops the page — and the download door still works regardless.
let storageRefused = false
// NEW: the bytes of a saved draft this game refused at startup. Held here, so the
// [Download the old sheet] button hands back what was REFUSED even after the player
// has changed something and overwritten the slot.
let refusedDraft = null

const remember = (text) => {
  try { text === null ? localStorage.removeItem(SLOT) : localStorage.setItem(SLOT, text) }
  catch { storageRefused = true }
}
const recall = () => {
  try { return localStorage.getItem(SLOT) }
  catch { storageRefused = true; return null }
}

// NEW: the keepsake, handed to the player. No server, no API, no build step — a
// Blob, an object URL, a temporary link clicked, and the URL released. That is what
// makes Download work in a published folder opened from a memory stick.
const downloadText = (text, name) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const linkEl = document.createElement('a')
  linkEl.href = url
  linkEl.download = name
  linkEl.click()
  URL.revokeObjectURL(url)
}

// Events → state change → re-render everything from data.
// (This wipe-and-rebuild-from-state loop is the same pattern the old game used.)
// NEW: every action that changes what is TRUE goes through after() — save the
// bytes, then repaint. The two TYPING actions deliberately do not: they save and
// update the status line only, because a repaint mid-word would eat the caret and
// nothing else on this page depends on a typed value.
const actions = {
  toggle(group, item)               { gameState.toggleSelection(group, item); after() },
  step(group, item, by)             { gameState.stepQuantity(group, item, by); after() },
  setValue(group, item, field, raw) { gameState.setValue(group, item, field, raw); remember(gameState.keptText); renderStatus() },
  setTyped(field, raw)              { gameState.setTyped(field, raw); remember(gameState.keptText); renderStatus() },
  download()                        { downloadText(gameState.keptText, keptFileName(gameState.kept)) },
  load(text)                        { gameState.loadKept(text); after() },
  print()                           { window.print() },
  startOver() {
    if (!confirm('Start a new sheet? What you have now is lost unless you have downloaded it.')) return
    gameState.startOver()
    // remember(null) REMOVES the slot, and then we render rather than after(): asking
    // for a blank sheet should leave nothing behind, not save a blank one back
    remember(null)
    render(actions)
  },
  // the two questions view.js asks the browser through this file, because view.js
  // may not ask it directly
  storageRefused() { return storageRefused },
  downloadDraft()  { downloadText(refusedDraft, 'old-sheet.json') }   // a refused file cannot be trusted to name itself
}
const after = () => { remember(gameState.keptText); render(actions) }

renderMeta(meta)        // content.json → tab title + hero heading
applyPageTheme(pageTheme) // themes.json → CSS custom properties on :root

// PAINT FIRST, then restore. A saved sheet that no longer fits this game has to say
// so on a page that is already there — and the stored text is NOT deleted when it is
// refused (the slot is only overwritten when the player changes something), so
// [Download the old sheet] has real bytes behind it.
render(actions)
const draft = playerSheet === null ? null : recall()
if (draft !== null) {
  if (!gameState.loadKept(draft, { fromDraft: true })) refusedDraft = draft
  render(actions)
}
