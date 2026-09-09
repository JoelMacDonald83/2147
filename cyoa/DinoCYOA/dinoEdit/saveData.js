// CHANGED: one way to talk to the API. Every answer is a receipt { ok, … }; a
// server that does not answer, or answers without a JSON body, is a receipt
// too — never a throw that takes a Promise.all in main.js down with it.
const receipt = async (url, init) => {
  try { return await (await fetch(url, init)).json() }
  catch (error) { return { ok: false, error: `no answer from the server (${error.message})` } }
}
const postJSON = (url, body) => receipt(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

// CHANGED: the route carries the game — the one the PAGE holds (editorState.game),
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
