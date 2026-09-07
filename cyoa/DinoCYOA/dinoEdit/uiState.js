// NEW: everything about the SCREEN that is not data. render() wipes the DOM
// on every structural edit, so anything the DOM would have remembered —
// which tab is open, which type the rail selected, which cards are open —
// must live here or be lost at the next paint. Nothing here is ever saved.
export const TABS = [['types', 'Types'], ['things', 'Things'], ['rows', 'Rows']]
export const uiState = {
  tab: 'types',            // 'types' | 'things' | 'rows'   — mirrored in the URL hash
  selectedType: '',        // the Things rail's highlighted type id — mirrored in the hash
  expanded: new Set()      // ids of open cards (types, things, rows, and the literal "page") — NOT in the hash
}
// expanded stays session memory on purpose: a hash of twenty uuids would be
// unreadable and would break what the back button means. A reload lands on
// the right tab and type with every card folded — stated, accepted.

// #types | #things/<typeId> | #rows — the hash IS the address of the screen,
// so a reload lands where you were. Unknown tab → types. Read, never written:
// tabs and rail lines are plain <a href="#…"> links, the browser changes the
// hash, and main.js repaints on hashchange — one path from navigation to paint.
// (A stale #things/<removed id> is resolved AT PAINT to the first type; the
// URL is left alone — rendering writes neither data nor the address.)
export const readHash = () => {
  const [tab = 'types', selectedType = ''] = location.hash.slice(1).split('/')
  uiState.tab = TABS.some(([id]) => id === tab) ? tab : 'types'
  if (uiState.tab === 'things') uiState.selectedType = selectedType
}
export const hashFor = (tab, typeId = '') => typeId ? `#${tab}/${typeId}` : `#${tab}`
