// NEW FILE: WHAT THE PAGE IS HOLDING, as one table.
//
// The editor has always held exactly ONE subject at a time and that subject has always
// been a game, so "a game" was spelled into the spine in about thirty places: five drawer
// names, one merge call, one `content.groups`, one hash segment, one UUID minter. A BOOK is
// the same editor over a different set of drawers — four files, no themes, rows in
// `proposals` instead of `content` — so every one of those places is a PARAMETER and not a
// fork, and this is where the parameters live. `editorState.subject.kind` names the row;
// state.js exports `S()` as the one way to reach it.
//
// PURE, and it matters: no DOM, no fetch, no import of state.js, and no work at import
// time. Every column takes the state it needs as an ARGUMENT (`st` — editorState, or any
// object shaped like it), so the fast half of the oracles can drive the whole table without
// a browser and without building a page. The same discipline engine/config/** keeps, for the
// same reason: one set of bytes, two runtimes.
//
// THE THREE ADDRESS COLUMNS ARE WRITTEN IN uiState.js AND SPREAD IN HERE. They are columns
// of this table and they are read as such; they are SPELLED there because uiState.js imports
// nothing, which is what lets a check drive the hash grammar straight off disk with no
// import map — and this file cannot be driven that way, because it reads FILE_SHEETS and
// calls the merge through the absolute "/config/…" urls only the dev server resolves.
// Spread, never copied: one fact, one place.
//
// WHAT IS NOT HERE. Anything that touches the DOM or the network: the top card, the toolbar,
// the tab painters, the nouns, the loaders. Those live in view.js and main.js as their own
// table keyed by the same `kind`, because a table that mixed them could not be driven by a
// pure check — which is the whole reason this file is separate.
//
// THE LAW THIS FILE EXISTS TO KEEP (spec L1): BOOK_FILE_SHEETS.types IS FILE_SHEETS.types,
// and BOOK_FILE_SHEETS.proposals[0] IS FILE_SHEETS.rules[0] — the same objects, measured and
// oracle-pinned. So "give a book's sheet a different default" would rewrite the GAME's
// contract. EVERY game/book difference belongs in this table. Nothing here mutates a sheet.
//
// CAP: 14 COLUMNS, and it is at 14. Past about twenty the right move is not a wider table
// but per-concern tables keyed by kind — a DRAWERS table, a VALIDATION table — each read by
// the one module that cares, the way uiState.js's ADDRESSES already is; otherwise the table
// becomes the code and a reader has to know all of it to change any of it. The 15th column
// is the signal to start splitting, not to add a 15th.
import { FILE_SHEETS, BOOK_FILE_SHEETS, BOOK_FILES } from '/config/schema.js'
import { FILE_NAMES } from '/config/validate.js'
// the merge's two names for a layer, its two validators and the merge itself. subject.js may
// import merge.js freely (merge.js is a leaf of engine/config and knows nothing of the
// editor); the other direction would be absurd, so the graph stays a tree.
import { GAME_LAYER, bookLabel, mergeLayers, validateGame, validateBook } from '/config/merge.js'
// the three address columns, and the subject triple they are the written form of
import { ADDRESSES } from './uiState.js'

// ───────────────────────── what each column needs, spelled once ─────────────────────────

// the subject's own files, as the shape the validators and the merge want. Read through the
// row's `files` so a kind's drawer list is stated in ONE place.
const ownFilesOf = (st, files) => Object.fromEntries(files.map(name => [name, st[name]]))

// the subject BOOK as a LAYER — the shape engine/helpers.js's loadBook returns and the shape
// mergeLayers, bookRules and validateBook all eat. The pin comes from the SUBJECT (the
// folder), never from the manifest: the folder is the truth, and a manifest that disagrees
// with it is a fault bookRules says out loud rather than a fact anything here should believe.
const layerOf = (st) => ({
  pin:       { name: st.subject.name, edition: st.subject.edition },
  manifest:  st.book,
  types:     st.types,
  things:    st.things,
  proposals: st.proposals
})

// the books this book REQUIRES, keyed the way validateBook wants them: { name: { edition:
// layer } }. The editor loads them as a flat list (loadBooks, one per pin) because that is
// the order the merge wants; validateBook wants an index, so it is built here rather than
// held twice. A pin that is not on the shelf loaded as null and stays missing — the merge
// names it (F1, at book.requires[i]), which is the sentence that already exists.
const keyedShelf = (st) => {
  const shelf = {}
  ;(st.books ?? []).forEach(layer => {
    if (layer === null || layer === undefined) return
    ;(shelf[layer.pin.name] ??= {})[layer.pin.edition] = layer
  })
  return shelf
}

// ───────────────────────── the table ─────────────────────────

export const SUBJECTS = {
  game: {
    // ── the drawers ──
    files:      FILE_NAMES,                                   // content, rules, themes, types, things
    fileSheets: FILE_SHEETS,
    // a ROLE → the drawer that plays it. `undefined` is "no subject knows this role" (a warn
    // by name, fail closed); `null` is "this subject has none of that, by design" (silent —
    // see §2 and cabinetOf in view.js). That is the codebase's own null-vs-undefined split,
    // already used by `default: null` and readJSON.
    drawers:    { content: 'content', rules: 'rules', themes: 'themes' },
    // ── the merge ──
    label:      () => GAME_LAYER,                             // what origins calls the subject's own layer
    rows:       (st) => st.content.groups,
    pins:       ['content', 'books'],                          // [file, key] — see the book row
    merge:      (st) => mergeLayers({ books: st.books, game: ownFilesOf(st, FILE_NAMES) }),
    validate:   (st) => validateGame({ own: ownFilesOf(st, FILE_NAMES), books: st.books }),
    // ── the chrome and the rules ──
    title:      (st) => st.content?.meta?.pageTitle ?? '',     // CHROME SPEAKS TITLES (§6)
    mintsIds:   false,                                         // a game's ids are UUIDs — see view.js's minter
    editable:   () => true,                                    // a game is always the author's to change
    // ── the address: keyword, address, subjectOf (spelled in uiState.js — see the header) ──
    ...ADDRESSES.game
  },

  book: {
    // ── the drawers ──
    // the manifest FIRST because that is how BOOK_FILE_SHEETS is keyed; it carries no
    // version stamp and it is not a data file. NOTE: this is the drawer LIST (what ownFiles
    // gathers and what the dirty snapshot serialises), not a save ORDER — a book is written
    // by one route that takes all four files and renames the whole edition into place
    // (spec L2/§8), so there is no "last file" to carry the cross-layer references the way
    // content.json does for a game.
    files:      ['book', ...BOOK_FILES],
    fileSheets: BOOK_FILE_SHEETS,
    // THE SHARPEST BREAK IN THE WHOLE STAGE, and the reason `drawers` is a table of ROLES.
    // groupSchema carries two attachment entries hard-wired to file "rules" and file
    // "themes" and a book has NEITHER file. Measured, so it can be relied on: the
    // groupRules cabinet entry is IDENTICAL on FILE_SHEETS.rules and
    // BOOK_FILE_SHEETS.proposals (same key, same `of`), so a book row's Rules card draws
    // unchanged into proposals.groupRules. Only themes is null — books propose no look, and
    // `null` says that SILENTLY rather than warning about it on every paint.
    drawers:    { content: 'proposals', rules: 'proposals', themes: null },
    // ── the merge ──
    // In book mode the subject book is the LAST BOOK layer, not the game layer, so origins
    // labels it 'dinosaur-age 2' and never GAME_LAYER — which is exactly why `isOwn` asks
    // this column instead of comparing against a constant. The label comes from the
    // MANIFEST because that is what mergeLayers labels the layer with; a manifest that
    // disagrees with its folder reads as owning nothing, which locks every card and puts
    // bookRules' own sentence in the faults banner. Fail closed, loudly.
    label:      (st) => bookLabel(st.book ?? {}),
    rows:       (st) => st.proposals.groups,
    // CHANGED (WP-5): the cell names the FILE, not the holder. It was `(st) => [st.book,
    // 'requires']` and nothing read it yet. A Books tab needs TWO facts about a pin list —
    // the array it edits AND the fault path the merge addresses a bad pin at
    // (`content.books[2]` for a game, `book.requires[0]` for a book; merge.js's sitesFor) —
    // and a drawer's name IS its file's name in both kinds, so one cell says both:
    // `st[file][key]` is the array and `${file}.${key}` is the path. The alternative was a
    // 15th column that could silently disagree with this one, and the table's own header
    // says the 15th column is the signal to split rather than to add.
    pins:       ['book', 'requires'],
    // the same call validateBook makes (merge.js): the books it requires, then this book on
    // top, and no game at all. `game: null` IS book mode — it is not a third argument shape.
    merge:      (st) => mergeLayers({ books: [...(st.books ?? []), layerOf(st)], game: null }),
    validate:   (st) => validateBook(layerOf(st), keyedShelf(st)),
    // ── the chrome and the rules ──
    title:      (st) => st.book?.title ?? '',
    // a book's ids are <book>:<noun>-<n>, never a UUID: merge.js's bookRules refuses a UUID
    // with a sentence that already exists, and never from the caption, because an id must
    // not follow a later rename.
    mintsIds:   true,
    // FROZEN ONCE A GAME PINS IT. `pinnedBy` is the server's census (which local games pin
    // this exact edition); `null` means it has not been asked yet, and an unknown census
    // reads as NOT editable — so opening an edition before the answer arrives writes
    // nothing, which is the only safe direction when the thing at risk is a frozen folder.
    editable:   (st) => Array.isArray(st.pinnedBy) && st.pinnedBy.length === 0,
    // ── the address: `#book/<name>/<edition>/<tab>` (spelled in uiState.js — see the header) ──
    ...ADDRESSES.book
  }
}
