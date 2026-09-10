// CHANGED: one way to talk to the API. Every answer is a receipt { ok, … }; a
// server that does not answer, or answers without a JSON body, is a receipt
// too — never a throw that takes a Promise.all in main.js down with it.
// CHANGED (stage 4): the HTTP status travels with the receipt. Every refusal already carries
// the border's own SENTENCE and that is what the screens print — but one of them also has to
// be ACTED on, and a sentence is the wrong thing to act on: a frozen edition comes back 409
// and turns the screen read-only (main.js's book saver), and reading that off the words would
// be a second grammar nobody declared. The status is the answer's own shape, so it is carried
// rather than re-derived. No refusal is ever re-worded from it.
const receipt = async (url, init) => {
  try { const res = await fetch(url, init); return { status: res.status, ...(await res.json()) } }
  catch (error) { return { ok: false, error: `no answer from the server (${error.message})` } }
}
const postJSON = (url, body) => receipt(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

// CHANGED: the route carries the game — the one the PAGE holds (editorState.subject.name),
// passed in by main.js, never read from the address bar: the hash may already
// name the next game while a save of this one is in flight.
export const save = async (game, name, data) => ({ name, ...(await postJSON(`/api/games/${game}/save/${name}`, data)) })
// NEW: the manager's three
export const listGames  = () => receipt('/api/games')
// CHANGED: a newborn may be built on books. `books` is a list of pins the
// server judges like any other data ({ name, edition }); undefined would let the
// server pick its own default, so the home screen always sends a list — the
// checkbox's answer, [] or [{ name: "basic", edition: N }].
export const createGame = (title, books) => postJSON('/api/games', { title, books })
export const exportGame = (game) => receipt(`/api/games/${game}/export`, { method: 'POST' })
// NEW: the shelf, as the server sees it — every folder under books/, its
// editions, their facts and their problems (§8.4). The Library paints from it;
// the Books tab reads it for what to offer and what to upgrade to.
export const listBooks  = () => receipt('/api/books')

// ───────────────────────── the shelf's write half (§8) ─────────────────────────
// NEW (stage 4): seven calls, one per route, ALL under /api/books — which is why every
// existing assertion about the static /books/… drawer survives: that one is still GET-only
// and these never touch it.
//
// Nothing here judges anything. A name, a title, a `requires` list and a frozen edition are
// all the BORDER's business, and the border is the server: it answers with the sentence the
// validator or the shelf already writes, and the screens print it verbatim. The editor's own
// pre-flight (S().validate before a save) is the second copy of that question, never a
// different one.
//
// A BOOK IS SAVED IN ONE REQUEST, all four files. A game posts five with content.json LAST
// because content.json carries every cross-reference and must land on a disk that already
// holds its siblings; a book has no such last file, so the route takes the whole book and
// renames it into place atomically (spec L2). The "half-saved book" is not a case.
export const saveBook = (name, edition, files) => postJSON(`/api/books/${name}/${edition}/save`, files)
// `name` is optional: given, it IS the folder (and the id namespace); absent, the server
// makes it from the title by the same rule a game's folder name comes from. Either way the
// receipt says which name was taken, because that is the word every id in the book starts
// with and the author has to know it.
export const createBook = (title, name, requires) => postJSON('/api/books', { title, ...(name ? { name } : {}), requires })
// edition N+1 as a copy of this one — the answer a frozen edition's refusal points at, so
// it is allowed while the source is pinned.
export const cutEdition = (name, edition) => postJSON(`/api/books/${name}/${edition}/cut`, {})
export const deleteEdition = (name, edition) => postJSON(`/api/books/${name}/${edition}/delete`, {})
export const deleteBook = (name) => postJSON(`/api/books/${name}/delete`, {})
// a book's name is its id NAMESPACE, so this rewrites every id in every edition and every
// pin that names it. The receipt's `rewritten: { ids, pins }` is what the Library reports
// afterwards — and what previews.js counts BEFORE, so nobody confirms it blind.
export const renameBook = (name, to) => postJSON(`/api/books/${name}/rename`, { to })
// NEW: "Save as a book" — lift a GAME's own layer onto the shelf. It is a route on the
// GAME (it reads the game's files and leaves the game pinning the new book), so it lives
// under /api/games, and its receipt carries the honest half: `left`, the sentences naming
// what could not travel.
export const extractBook = (game, name, title) => postJSON(`/api/games/${game}/extract`, { name, title })
