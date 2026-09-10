// NEW: everything about the SCREEN that is not data. render() wipes the DOM
// on every structural edit, so anything the DOM would have remembered —
// which game, which tab, which type the rail selected, which cards are open —
// must live here or be lost at the next paint. Nothing here is ever saved.
// CHANGED: four tabs, Books FIRST. It is first because it is the question that
// comes before every other one — which books is this game built on? — and
// because everything the other three tabs show is a merge of those books with
// the game's own stuff. The DEFAULT is still Rows: Open lands on the story.
//
// CHANGED (stage 4): the address names a SUBJECT — a game, or one EDITION of a book — and
// three of the subject table's fourteen columns are written here rather than in
// dinoEdit/subject.js. That is deliberate and it has one reason: THIS FILE IMPORTS NOTHING.
// The grammar is the one piece of the editor a pure check can drive with no build step and
// no import map (oracle N1 imports this module straight off disk), and the rest of the
// subject table cannot be — it reads FILE_SHEETS and calls the merge, which live under the
// absolute "/config/…" urls only the dev server resolves. So the address data lives here,
// subject.js SPREADS it into its rows, and neither fact is written twice.
// A new kind of subject is a row in ADDRESSES and a row in SUBJECTS. Never a branch here.

export const TABS = [['books', 'Books'], ['types', 'Types'], ['things', 'Things'], ['rows', 'Rows']]

// NEW: the page's address for a subject, as data: which KIND of thing is open, its FOLDER
// name, and — only a book has one — its EDITION. Identity for "is this the same subject?"
// is all three: an edition change is a DIFFERENT subject and must reload, because an
// edition is a different folder holding different bytes.
// `name === ''` is the one sentinel for "nothing is open" (it was `uiState.game === ''` and
// `editorState.game === ''`, and it still means exactly that). `kind` is therefore never
// empty: it always names a real row, so nothing has to guard the lookup and the tables never
// need a "none" row that every column would have to answer for. 'game' is the default for
// the same reason the editor only ever held a game before today.
export const subjectAt = (kind, name, edition = 0) => ({ kind, name, edition })
export const NO_SUBJECT = () => subjectAt('game', '', 0)
export const sameSubject = (a, b) => a.kind === b.kind && a.name === b.name && a.edition === b.edition

// NEW: the three address columns of the subject table (§1's `hashPrefix`, split into the
// pair that has to agree — one writes the segments, one reads them back).
//   keyword    the literal first segment that says "what follows is one of these". A game
//              has none: a game's address starts with its own folder name. This is also the
//              word an author may not name a folder (see ADDRESS_KEYWORDS).
//   address    the segments this subject contributes, in order. The leading '#' and the
//              joining are hashFor's business, so a kind never has to remember them.
//   subjectOf  the subject those segments describe. TOTAL: the editor does NOT judge a name
//              or an edition — the server is the border, and a folder it does not have is a
//              404 that becomes the "Could not open" screen.
// How many segments a kind takes is `address(...).length` in BOTH directions rather than a
// fourth cell that could silently disagree with the other two.
export const ADDRESSES = {
  game: {
    keyword:   '',
    address:   (subject) => [subject.name],
    subjectOf: (parts) => subjectAt('game', parts[0] ?? '')
  },
  book: {
    // `#book/<name>/<edition>/<tab>`. The literal `book` segment is not decoration: book and
    // game folder names share ONE grammar (oracle N2 pins BOOK_NAME.source === NAME.source),
    // so `#basic` is genuinely ambiguous between a game called basic and the Basic book.
    // The edition is written as a STRING so an edition the grammar would refuse still
    // round-trips through the address instead of vanishing from it; 0 is no folder's name.
    keyword:   'book',
    address:   (subject) => ['book', subject.name, String(subject.edition)],
    subjectOf: (parts) => subjectAt('book', parts[1] ?? '', Number(parts[2]) || 0)
  }
}

// NEW: every word the address keeps for something that is not an author's folder name.
// 'home' was always one; 'book' joins it because the grammar above spends the first segment
// on it, and without it an author could create games/book and shadow every book address.
// server/games.js's RESERVED must hold the same words — it cannot import this file
// (server/ never imports dinoEdit/), so the two lists are pinned equal by an oracle,
// exactly as BOOK_NAME and NAME already are.
export const ADDRESS_KEYWORDS = ['home', ...Object.values(ADDRESSES).map(row => row.keyword).filter(Boolean)]
// the kind a first address segment names, or nothing — which means "a game, addressed by
// its own name". Derived from the `keyword` cell so a new kind is a row and never a branch.
export const KIND_OF_KEYWORD = Object.fromEntries(
  Object.entries(ADDRESSES).filter(([, row]) => row.keyword !== '').map(([kind, row]) => [row.keyword, kind])
)

export const uiState = {
  // CHANGED: was `game: ''`. One scalar could name a game; a book needs a name AND an
  // edition AND the word that tells the two kinds apart, and all three together are the
  // identity that decides whether a hash change repaints or reloads.
  subject: NO_SUBJECT(),   // { kind, name, edition } — mirrored in the hash
  tab: 'rows',             // CHANGED: default Rows (Open lands on the story); 'books' | 'types' | 'things' | 'rows'
  selectedType: '',        // the Things rail's highlighted type id — mirrored in the hash
  expanded: new Set()      // ids of open cards — NOT in the hash (session memory on purpose)
}
export const HOME_HASH = '#home'

// NEW: the grammar, pure — a hash string in, the screen's address out, so the
// oracles can table it (N1):
//   #, #home                                                → home
//   #<game>                                                 → the game, Rows
//   #<game>/books | types | things/<typeId> | rows          (unknown tab → Rows)
//   #book/<name>/<edition>[/<tab>[/<typeId>]]               → that edition of that book
// The tab names are read from TABS, so adding a tab there is the whole change —
// #<game>/books works because 'books' is in the table, not because of a line here.
// CHANGED (stage 4): the FIRST segment now says which KIND of subject the rest of the
// address describes, and it has to — see ADDRESSES.book. Which segments each kind takes is
// the address table's answer, so the tab is no longer at a fixed position: it is whatever
// is left over after the subject's own segments.
export const parseHash = (hash) => {
  const parts = hash.replace(/^#/, '').split('/')
  const [first = ''] = parts
  if (first === '' || first === 'home') return { subject: NO_SUBJECT(), tab: 'rows', selectedType: '' }
  const subject = ADDRESSES[KIND_OF_KEYWORD[first] ?? 'game'].subjectOf(parts)
  const [tab = 'rows', selectedType = ''] = parts.slice(ADDRESSES[subject.kind].address(subject).length)
  const known = TABS.some(([id]) => id === tab) ? tab : 'rows'
  return { subject, tab: known, selectedType: known === 'things' ? selectedType : '' }
}
// CHANGED: reads through parseHash. selectedType is only overwritten on the
// Things tab, as before — leaving Things and coming back remembers the type.
// readHash only READS the hash. Tabs and rail lines are plain <a href="#…">
// links; the two places that set location.hash by hand are Create (home.js
// lands the newborn on its Types tab) and a refused leave (main.js restores
// the address the page last agreed with).
export const readHash = () => {
  const { subject, tab, selectedType } = parseHash(location.hash)
  uiState.subject = subject
  uiState.tab = tab
  if (tab === 'things') uiState.selectedType = selectedType
}
// CHANGED: every address carries the SUBJECT's own segments, from the table — one name for
// a game, three for an edition of a book. view.js's callers are unchanged.
// filter(Boolean) is what keeps the home screen's `#rows` reading exactly as it always did:
// a subject with no name contributes no segment at all.
export const hashFor = (tab, typeId = '') =>
  '#' + [...ADDRESSES[uiState.subject.kind].address(uiState.subject), tab, typeId].filter(Boolean).join('/')
// NEW: the address of a subject the page is NOT holding — where the home screen's Open
// lands, and where a newborn lands (Types: it has none yet). The Library's per-book links
// get their address from this same one function, so there is never a second place that
// spells one.
export const hashForSubject = (subject, tab = 'rows') =>
  '#' + [...ADDRESSES[subject.kind].address(subject), tab].filter(Boolean).join('/')
export const hashForGame = (game, tab = 'rows') => hashForSubject(subjectAt('game', game), tab)
