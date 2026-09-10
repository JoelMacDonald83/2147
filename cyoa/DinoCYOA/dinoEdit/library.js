// NEW FILE (stage 4): THE LIBRARY — the shelf as a screen an author can change.
//
// It was four lines inside home.js and its own comment said "nothing here is clickable":
// the shelf was read-only by construction, so the Library was a list of what you could build
// ON and the Books tab inside a game was the only place a book appeared at all. That is the
// biggest gap against the north star — the tool is FOR OTHER AUTHORS and the shelf is the
// sharing surface, and a stranger could make games all day without contributing one book.
// So the Library grows the whole lifecycle: make one, open one, cut the next edition, rename,
// delete. It moved out of home.js because it is now as big as the games list beside it.
//
// THREE RULES SHAPE EVERY BUTTON BELOW.
//   EDITIONS ARE FROZEN ONCE A GAME PINS ONE. That is the one fact a game's card has no
//     counterpart for, so every edition line says who pins it, and a pinned edition offers
//     "Open read-only" and "Cut edition N+1" where an unpinned one offers "Edit".
//   NOTHING IRREVERSIBLE WITHOUT A PREVIEW. Rename rewrote 73 ids and one pin on the real
//     shelf; delete takes every edition. previews.js counts both before the button appears.
//   THE SERVER IS THE BORDER. Nothing here judges a name, a title or a freeze: every refusal
//     printed below is the route's own sentence, and the two the screen says BEFORE asking
//     are the same bytes the route would have sent (books.js, with the debt written down).
import { createBook, cutEdition, deleteEdition, deleteBook, renameBook, saveBook } from './saveData.js'
import { bookTitle, pinnersOf, pinnersOfBook, frozenEditionSentence, pinnedEditionSentence, pinnedBookSentence, nextEditionOf } from './books.js'
import { hashForSubject, subjectAt } from './uiState.js'
import { renamePreview, deletePreview } from './previews.js'
import { loadBook } from '/helpers.js'

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`
const el = (tag, className = '', text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
const button = (className, text, onClick) => {
  const buttonEl = el('button', className, text)
  buttonEl.type = 'button'
  buttonEl.addEventListener('click', onClick)
  return buttonEl
}
const link = (className, text, href) => {
  const linkEl = el('a', className, text)
  linkEl.href = href
  return linkEl
}

// ───────────────────────── the facts of one edition ─────────────────────────

// MOVED from home.js, unchanged in substance: what this edition brings, in the shelf
// listing's own terms. Only what it HAS is said — Basic defines sheets and adds nothing,
// Stats defines nothing and adds five fields.
const editionLine = (edition, titles) => {
  if (edition.error) return `edition ${edition.edition} · ⚠ ${edition.error}`
  const facts = [`edition ${edition.edition}`]
  // a requirement is written in the shelf's own terms (the folder's name); the
  // Library speaks the titles, which is what the author will look for — and speaks them
  // through the one function that builds the phrase, so this screen and the Books tab
  // cannot drift apart again (§6). `titles` already falls back to the folder name.
  facts.push(edition.requires.length === 0 ? 'requires nothing' : `requires ${edition.requires.map(pin => bookTitle(titles.get(pin.name) ?? pin.name, pin.edition)).join(', ')}`)
  if (edition.sheets > 0) facts.push(plural(edition.sheets, 'sheet'))
  if (edition.sectionsAdded > 0) facts.push(`adds ${plural(edition.sectionsAdded, 'section')}`)
  if (edition.fieldsAdded > 0) facts.push(`adds ${plural(edition.fieldsAdded, 'field')}`)
  if (edition.things > 0) facts.push(`${edition.things} shelf ${edition.things === 1 ? 'entry' : 'entries'}`)
  const proposes = [edition.rows > 0 ? plural(edition.rows, 'row') : null, edition.budget !== null && edition.budget !== undefined ? `budget ${edition.budget}` : null].filter(Boolean)
  if (proposes.length > 0) facts.push(`proposes ${proposes.join(', ')}`)
  if (edition.problems?.length > 0) return `${facts.join(' · ')} · ⚠ ${plural(edition.problems.length, 'problem')} — ${edition.problems[0].path}: ${edition.problems[0].message}`
  return facts.join(' · ')
}

// ───────────────────────── the panel every dangerous button opens ─────────────────────────

// NEW: one in-page panel, not a confirm(). Three of these buttons have a PREVIEW to show —
// a count of editions, ids and pins — and confirm() can only show a string it was handed
// before the counting was done. The panel is appended under the card, counts while it says
// "reading the shelf…", and then shows the numbers with a Confirm beside them.
// Only one is ever open: opening another replaces it, so two half-answered questions cannot
// sit on the screen at once.
let openPanel = null
const panel = (holderEl, heading) => {
  openPanel?.remove()
  const panelEl = el('section', 'shelf-panel')
  panelEl.appendChild(el('h3', '', heading))
  const bodyEl = el('div', 'shelf-panel-body')
  panelEl.appendChild(bodyEl)
  holderEl.appendChild(panelEl)
  openPanel = panelEl
  return { panelEl, bodyEl, close: () => { panelEl.remove(); if (openPanel === panelEl) openPanel = null } }
}
const fact = (bodyEl, text) => bodyEl.appendChild(el('p', 'shelf-fact', text))
const refusal = (bodyEl, text) => bodyEl.appendChild(el('p', 'shelf-refusal', text))

// the receipt of a mutation, as one line. A route's refusal is printed in the route's own
// words — never re-worded here — and its `problems` go to the console the way every other
// refused save's do.
const said = (receipt, done) => {
  if (receipt.ok) return done
  if (receipt.problems) console.table(receipt.problems)
  return receipt.error
}

// ───────────────────────── one edition, and what may be done to it ─────────────────────────

// The action row of ONE edition — the only place in the editor where the freeze is a fact on
// screen rather than a refusal after a click.
//
// A PINNED EDITION IS NOT A HIDDEN SCREEN. "Open read-only" is offered beside the frozen
// sentence because looking at a book a game depends on is the most ordinary thing an author
// does, and the alternative — no door at all — teaches that a pinned book is gone.
const editionActions = (book, edition, pinners, next, repaint, holderEl) => {
  const rowEl = el('div', 'game-actions')
  const subject = subjectAt('book', book.name, edition.edition)
  const frozen = pinners.length > 0

  if (edition.error === undefined) {
    rowEl.appendChild(link('save-button', frozen ? 'Open read-only' : 'Edit', hashForSubject(subject, 'rows')))
    // the cut is offered either way, and it is the ANSWER the frozen sentence points at: a
    // new edition is a copy of this one plus more, so it is add-only by construction.
    rowEl.appendChild(button('link-button', `Cut edition ${next} as a copy`, async () => {
      const statusEl = el('span', 'game-status', 'cutting…')
      rowEl.appendChild(statusEl)
      const receipt = await cutEdition(book.name, edition.edition)
      statusEl.textContent = said(receipt, `cut edition ${receipt.edition}`)
      if (!receipt.ok) return
      repaint.forget()
      // straight into the new edition: it is editable, which is the whole point of cutting
      // one, and a different edition is a different subject so the page reloads onto it.
      location.hash = hashForSubject(subjectAt('book', book.name, receipt.edition), 'rows')
    }))
  }
  if (frozen) {
    rowEl.appendChild(el('span', 'shelf-frozen', frozenEditionSentence(pinners, next)))
    return rowEl
  }
  // deleting ONE edition. The whole-book Delete has the big preview; this one needs the
  // single fact the author cannot see, which is that the LAST edition takes the book with it.
  rowEl.appendChild(button('remove-button', 'Delete edition', () => {
    const { bodyEl, close } = panel(holderEl, `Delete books/${book.name}/${edition.edition}?`)
    fact(bodyEl, (book.editions ?? []).length === 1
      ? 'It is the only edition, so the book folder goes with it.'
      : `${plural((book.editions ?? []).length - 1, 'other edition')} of this book stay${(book.editions ?? []).length === 2 ? 's' : ''} on the shelf.`)
    const actionsEl = el('div', 'game-actions')
    const statusEl = el('span', 'game-status')
    actionsEl.appendChild(button('remove-button', 'Delete it', async () => {
      statusEl.textContent = 'deleting…'
      const receipt = await deleteEdition(book.name, edition.edition)
      statusEl.textContent = said(receipt, 'deleted')
      if (!receipt.ok) return
      close(); repaint.now()
    }))
    actionsEl.appendChild(button('link-button', 'Keep it', close))
    actionsEl.appendChild(statusEl)
    bodyEl.appendChild(actionsEl)
  }))
  return rowEl
}

// ───────────────────────── rename: the name, the title, or both ─────────────────────────

// THE GAP THE INTEGRATOR FOUND. Renaming dinosaur-age to mesozoic left the card reading
// "Dinosaur Age" over "books/mesozoic", because the route renames the NAME — the folder and
// the id namespace — and not the TITLE. That is consistent with the naming rule (chrome
// speaks titles, fault paths speak folders) and it is not what an author means by "rename".
//
// So this panel offers both, and it is careful to say that they are two different acts:
//   the NAME is the folder and the id NAMESPACE. Changing it rewrites every id in every
//     edition and every pin that names it — the preview counts all of it first.
//   the TITLE is one string in one book.json per edition, so changing it is a SAVE, and a
//     save into a FROZEN edition is refused. The panel lists which editions the new title can
//     reach and which keep the old one, before anything is written.
const retitle = async (name, edition, title) => {
  const layer = await loadBook(`/books/${name}/${edition}/`, { name, edition })
  if (layer === null) return { ok: false, error: `books/${name}/${edition} could not be read` }
  // the three data files go back EXACTLY as they were read, nulls included — an absent file
  // stays absent, so a title change moves the bytes of one file and no others.
  return saveBook(name, edition, { book: { ...layer.manifest, title }, types: layer.types, things: layer.things, proposals: layer.proposals })
}

const openRenamePanel = (book, shelf, games, repaint, holderEl) => {
  const { bodyEl, close } = panel(holderEl, `Rename "${book.title || book.name}"`)
  const editions = book.editions ?? []
  const pinners = pinnersOfBook(games, book.name)
  const frozen = new Set(pinners.map(pin => pin.edition))

  const nameLabelEl = el('label', 'field')
  nameLabelEl.appendChild(el('span', '', 'Folder name — also the id namespace every id in this book starts with'))
  const nameEl = el('input'); nameEl.value = book.name
  nameLabelEl.appendChild(nameEl)
  const titleLabelEl = el('label', 'field')
  titleLabelEl.appendChild(el('span', '', 'Title — what this screen and every game calls it'))
  const titleEl = el('input'); titleEl.value = book.title ?? ''
  titleLabelEl.appendChild(titleEl)
  bodyEl.append(nameLabelEl, titleLabelEl)

  const previewEl = el('div', 'shelf-preview')
  const actionsEl = el('div', 'game-actions')
  const statusEl = el('span', 'game-status')
  bodyEl.append(previewEl, actionsEl)

  // WHICH EDITIONS A TITLE CAN REACH. A title lives in ONE book.json per edition, so a
  // retitle is one save per edition — and a save into a pinned edition is refused by the
  // border. Computed once and printed by both halves of the preview below, because the
  // rename branch used to redraw over it and the author lost the only line that said an
  // edition would keep its old title.
  const numbered = editions.filter(edition => Number.isInteger(edition.edition))
  const reachable = numbered.filter(edition => !frozen.has(edition.edition))
  const kept = numbered.filter(edition => frozen.has(edition.edition))
  const editionList = (list) => list.map(edition => `edition ${edition.edition}`).join(', ')
  const titleLines = (title) => {
    fact(previewEl, `TITLE — a save, not a rename: "${title}" is written into book.json of ${reachable.length === 0 ? 'no edition' : editionList(reachable)}.`)
    if (kept.length > 0) refusal(previewEl, `${editionList(kept)} keep${kept.length === 1 ? 's' : ''} the old title — ${pinnedEditionSentence(pinners)}`)
  }

  // the preview is computed on demand, not on every keystroke: it reads every edition and
  // every pinning game off the disk, which is not a thing to do per character typed.
  const lookEl = button('link-button', 'What would this do?', async () => {
    previewEl.innerHTML = ''
    const to = nameEl.value.trim()
    const title = titleEl.value
    const renaming = to !== book.name
    const retitling = title !== (book.title ?? '')
    if (!renaming && !retitling) { fact(previewEl, 'Nothing to do — the name and the title are unchanged.'); return }

    if (!renaming) { titleLines(title); renderConfirm(false, retitling, to, title); return }

    fact(previewEl, 'NAME — reading every edition and every game that pins one…')
    const preview = await renamePreview(book.name, editions, pinners, shelf)
    previewEl.innerHTML = ''
    fact(previewEl, `NAME — ${book.name}: → ${to}: rewrites ${plural(preview.ids, 'id')} and ${plural(preview.pins, 'pin')}, across ${preview.editions.length === 0 ? 'no edition' : preview.editions.join(', ')}${preview.games.length > 0 ? ` and ${preview.games.map(game => `games/${game}`).join(', ')}` : ''}.`)
    fact(previewEl, 'Every id this book defines moves into the new namespace, and every reference to one — inside the book and inside the games that pin it — moves with it. Every edition is rewritten, pinned or not: the folder is the truth, so a manifest that disagreed with it would be a fault in every one it missed.')
    if (retitling) titleLines(title)
    preview.blocked.forEach(sentence => refusal(previewEl, sentence))
    renderConfirm(preview.blocked.length === 0, retitling, to, title)
  })

  // THE OUTCOME OUTLIVES THE ACT. Repainting the home screen was wiping the receipt — the
  // author never saw "89 ids and 1 pin rewritten", which is the whole number they were asked
  // to confirm, nor which edition kept its old title. So the panel stays, says what happened
  // in the route's own numbers, and repaints when the author is done reading it.
  const outcome = (sentences) => {
    bodyEl.innerHTML = ''
    sentences.forEach(({ text, bad }) => (bad ? refusal : fact)(bodyEl, text))
    const doneEl = el('div', 'game-actions')
    doneEl.appendChild(button('save-button', 'Done', () => { close(); repaint.now() }))
    bodyEl.appendChild(doneEl)
  }

  const renderConfirm = (mayRename, retitling, to, title) => {
    actionsEl.innerHTML = ''
    const renaming = to !== book.name
    const doEl = button('save-button', renaming ? `Rename to ${to}` : 'Save the title', async () => {
      statusEl.textContent = 'working…'
      const sentences = []
      let target = book.name
      if (renaming) {
        const receipt = await renameBook(book.name, to)
        if (!receipt.ok) { statusEl.textContent = said(receipt, ''); return }
        target = receipt.name
        sentences.push({ text: `books/${book.name} → books/${target} — ${plural(receipt.rewritten?.ids ?? 0, 'id')} and ${plural(receipt.rewritten?.pins ?? 0, 'pin')} rewritten.` })
      }
      if (retitling) {
        // after the rename, so the title lands in the folder that now exists
        const done = []
        for (const edition of reachable) {
          const receipt = await retitle(target, edition.edition, title)
          if (!receipt.ok) { sentences.push({ text: `edition ${edition.edition} — ${said(receipt, '')}`, bad: true }); break }
          done.push(edition.edition)
        }
        sentences.push({ text: `"${title}" saved into ${done.length === 0 ? 'no edition' : plural(done.length, 'edition')} of books/${target}.` })
        if (kept.length > 0) sentences.push({ text: `${editionList(kept)} still say${kept.length === 1 ? 's' : ''} "${book.title ?? ''}" — a pinned edition is frozen, and its title is one of its bytes.`, bad: true })
      }
      repaint.forget()
      outcome(sentences)
    })
    if (renaming && !mayRename) { doEl.disabled = true; doEl.title = 'the refusals above have to be answered first' }
    actionsEl.append(doEl, button('link-button', 'Cancel', close), statusEl)
  }

  bodyEl.insertBefore(lookEl, previewEl)
}

// ───────────────────────── delete the whole book ─────────────────────────

const openDeletePanel = (book, games, repaint, holderEl) => {
  const { bodyEl, close } = panel(holderEl, `Delete books/${book.name}?`)
  const pinners = pinnersOfBook(games, book.name)
  const statusEl = el('span', 'game-status')
  fact(bodyEl, 'counting what would go…')
  deletePreview(book.name, book.editions).then(preview => {
    bodyEl.innerHTML = ''
    fact(bodyEl, `${plural(preview.editions, 'edition')} and ${plural(preview.ids, 'id')} — every sheet, field, entry and row this book defines.`)
    preview.unreadable.forEach(where => fact(bodyEl, `${where} could not be read, so its ids are not in that count — the folder still goes.`))
    if (pinners.length > 0) {
      refusal(bodyEl, pinnedBookSentence(pinners))
      bodyEl.appendChild(el('p', 'shelf-fact', 'A game that pins a book cannot have it taken away underneath it — that is the promise the whole merge rests on.'))
    }
    const actionsEl = el('div', 'game-actions')
    const doEl = button('remove-button', `Delete ${plural(preview.editions, 'edition')}`, async () => {
      statusEl.textContent = 'deleting…'
      const receipt = await deleteBook(book.name)
      statusEl.textContent = said(receipt, 'deleted')
      if (!receipt.ok) return
      close(); repaint.now()
    })
    if (pinners.length > 0) { doEl.disabled = true; doEl.title = 'un-pin it first' }
    actionsEl.append(doEl, button('link-button', 'Keep it', close), statusEl)
    bodyEl.appendChild(actionsEl)
  })
}

// ───────────────────────── the card ─────────────────────────

const buildBookCard = (book, titles, games, shelf, repaint) => {
  const cardEl = el('section', 'editor-section book-card')
  const headEl = el('div', 'book-head')
  headEl.appendChild(el('h2', '', book.title || book.name))
  headEl.appendChild(el('span', 'book-path', `books/${book.name}`))
  cardEl.appendChild(headEl)
  if (book.error) { cardEl.appendChild(el('p', 'wall-hint', book.error)); return cardEl }
  // NEW: the NAMESPACE, which is a book's hardest rule and was nowhere on screen — every id
  // in here starts with it, and renaming the folder is what moves it.
  cardEl.appendChild(el('p', 'book-facts', `defines ids under ${book.name}:`))

  const next = nextEditionOf(book.editions)
  ;(book.editions ?? []).forEach(edition => {
    cardEl.appendChild(el('p', 'book-facts', editionLine(edition, titles)))
    cardEl.appendChild(editionActions(book, edition, pinnersOf(games, book.name, edition.edition), next, repaint, cardEl))
  })
  if ((book.editions ?? []).length === 0) cardEl.appendChild(el('p', 'wall-hint', 'No edition folders — nothing to open.'))

  const bookActionsEl = el('div', 'game-actions')
  bookActionsEl.appendChild(button('link-button', 'Rename…', () => openRenamePanel(book, shelf, games, repaint, cardEl)))
  bookActionsEl.appendChild(button('remove-button', 'Delete book…', () => openDeletePanel(book, games, repaint, cardEl)))
  cardEl.appendChild(bookActionsEl)
  return cardEl
}

// ───────────────────────── New book ─────────────────────────

// The twin of "New CYOA", under the Library for the same reason that one is under the games.
// Two answers and a list: a title (the server makes the folder name from it by the very rule
// a game's comes from, or takes the one typed here), and which books this one is built on.
//
// THE PICKER EXCLUDES THE BOOK BEING MADE — a book may not require itself (merge.js says so
// with a sentence) and the only way that can happen here is a typed name that matches
// something already on the shelf, which would be a 409 anyway. It also brings a requirement's
// OWN requirements along: `requires` is FLAT, every transitive one is written out, and a book
// whose foundation is missing is skipped whole by the merge.
const buildNewBookForm = (shelf, repaint) => {
  const books = shelf.ok ? shelf.books : []
  const cleanOf = (book) => (book.editions ?? []).filter(edition => edition.error === undefined && (edition.problems?.length ?? 0) === 0).map(edition => edition.edition).sort((a, b) => b - a)[0]
  const offers = books.map(book => ({ name: book.name, title: book.title || book.name, edition: cleanOf(book) })).filter(offer => offer.edition !== undefined)
  const requiresOf = (name, edition) => books.find(book => book.name === name)?.editions?.find(each => each.edition === edition)?.requires ?? []

  const formEl = el('form', 'editor-section new-game')
  formEl.appendChild(el('h2', '', 'New book'))
  const titleLabelEl = el('label', 'field')
  titleLabelEl.appendChild(el('span', '', 'Title — the folder name is made from it ("Dinosaur Age" → books/dinosaur-age)'))
  const titleEl = el('input'); titleEl.required = true; titleEl.placeholder = 'My book'
  titleLabelEl.appendChild(titleEl)
  const nameLabelEl = el('label', 'field')
  nameLabelEl.appendChild(el('span', '', 'Folder name (optional) — it is also the id namespace: lowercase letters, digits and single dashes'))
  const nameEl = el('input'); nameEl.placeholder = 'made from the title'
  nameLabelEl.appendChild(nameEl)
  formEl.append(titleLabelEl, nameLabelEl)

  const boxes = []
  if (offers.length > 0) {
    formEl.appendChild(el('p', 'field-note', 'Requires — the books this one is built on. Its own requirements come along; a book may not require itself.'))
    offers.forEach(offer => {
      const boxLabelEl = el('label', 'checkbox-field')
      const boxEl = el('input'); boxEl.type = 'checkbox'
      boxLabelEl.appendChild(boxEl)
      boxLabelEl.appendChild(el('span', '', bookTitle(offer.title, offer.edition)))
      formEl.appendChild(boxLabelEl)
      boxes.push({ ...offer, boxEl })
    })
  }

  const buttonEl = el('button', 'save-button', 'Create'); buttonEl.type = 'submit'
  const noteEl = el('span', 'game-status')
  formEl.append(buttonEl, noteEl)
  formEl.addEventListener('submit', async (event) => {
    event.preventDefault()
    noteEl.textContent = 'creating…'
    const typed = nameEl.value.trim()
    const picked = boxes.filter(box => box.boxEl.checked && box.name !== typed)
    // FLAT: everything a chosen book requires is written out too, or the merge skips it whole
    const requires = []
    const add = (pin) => { if (!requires.some(each => each.name === pin.name)) requires.push({ name: pin.name, edition: pin.edition }) }
    picked.forEach(pick => { requiresOf(pick.name, pick.edition).forEach(add); add(pick) })
    const brought = requires.length - picked.length
    const receipt = await createBook(titleEl.value, typed, requires)
    if (!receipt.ok) { noteEl.textContent = said(receipt, ''); return }
    repaint.forget()
    // a newborn book lands on its Types tab: it has no sheets yet, and a book with no sheets
    // has nothing for a row to show and nothing to put on a shelf — same reasoning as a
    // newborn game built on nothing.
    location.hash = hashForSubject(subjectAt('book', receipt.name, receipt.edition), 'types')
  })
  return formEl
}

// ───────────────────────── the screen ─────────────────────────

// `games` is the games listing home.js already fetched — the Library needs it for the freeze
// census and must not ask for it twice. `repaint.forget()` throws the cached shelf answer away
// (a book mutation makes it a lie, including for the game-side Books tab); `repaint.now()`
// does that and repaints the whole home screen from the disk.
export const renderLibrary = (editorEl, shelf, games, repaint) => {
  editorEl.appendChild(el('h2', 'library-heading', 'Library'))
  if (!shelf.ok) { editorEl.appendChild(el('p', 'wall-hint', `Could not read the shelf — ${shelf.error}`)); return }
  if (shelf.books.length === 0) editorEl.appendChild(el('p', 'wall-hint', 'No books on the shelf yet — make the first one below.'))
  const titles = new Map(shelf.books.map(book => [book.name, book.title || book.name]))
  shelf.books.forEach(book => editorEl.appendChild(buildBookCard(book, titles, games, shelf.books, repaint)))
  editorEl.appendChild(buildNewBookForm(shelf, repaint))
}
