// NEW: everything about the SCREEN that is not data. render() wipes the DOM
// on every structural edit, so anything the DOM would have remembered —
// which game, which tab, which type the rail selected, which cards are open —
// must live here or be lost at the next paint. Nothing here is ever saved.
// CHANGED: four tabs, Books FIRST. It is first because it is the question that
// comes before every other one — which books is this game built on? — and
// because everything the other three tabs show is a merge of those books with
// the game's own stuff. The DEFAULT is still Rows: Open lands on the story.
export const TABS = [['books', 'Books'], ['types', 'Types'], ['things', 'Things'], ['rows', 'Rows']]
export const uiState = {
  game: '',                // NEW: the CYOA the hash names — '' on the home screen. Mirrored in the hash.
  tab: 'rows',             // CHANGED: default Rows (Open lands on the story); 'books' | 'types' | 'things' | 'rows'
  selectedType: '',        // the Things rail's highlighted type id — mirrored in the hash
  expanded: new Set()      // ids of open cards — NOT in the hash (session memory on purpose)
}
export const HOME_HASH = '#home'

// NEW: the grammar, pure — a hash string in, the screen's address out, so the
// oracles can table it (N1):
//   #, #home                → home
//   #<game>                 → game, Rows
//   #<game>/books | #<game>/types | #<game>/things/<typeId> | #<game>/rows   (unknown tab → Rows)
// The tab names are read from TABS, so adding a tab there is the whole change —
// #<game>/books works because 'books' is in the table, not because of a line here.
// The editor does NOT judge the game name: the server is the border, and a
// name it does not know is a 404 that becomes the "Could not open" screen.
export const parseHash = (hash) => {
  const [first = '', tab = 'rows', selectedType = ''] = hash.replace(/^#/, '').split('/')
  if (first === '' || first === 'home') return { game: '', tab: 'rows', selectedType: '' }
  const known = TABS.some(([id]) => id === tab) ? tab : 'rows'
  return { game: first, tab: known, selectedType: known === 'things' ? selectedType : '' }
}
// CHANGED: reads through parseHash. selectedType is only overwritten on the
// Things tab, as before — leaving Things and coming back remembers the type.
// readHash only READS the hash. Tabs and rail lines are plain <a href="#…">
// links; the two places that set location.hash by hand are Create (home.js
// lands the newborn on its Types tab) and a refused leave (main.js restores
// the address the page last agreed with).
export const readHash = () => {
  const { game, tab, selectedType } = parseHash(location.hash)
  uiState.game = game
  uiState.tab = tab
  if (tab === 'things') uiState.selectedType = selectedType
}
// CHANGED: every address carries the game. view.js's four callers are unchanged.
export const hashFor = (tab, typeId = '') => '#' + [uiState.game, tab, typeId].filter(Boolean).join('/')
// NEW: where the home screen's Open lands, and where a newborn lands (Types: it has none yet)
export const hashForGame = (game, tab = 'rows') => `#${game}/${tab}`
