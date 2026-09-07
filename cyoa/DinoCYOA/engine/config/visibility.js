// NEW: which rows are on screen. A row's showWhen is one POSITIVE gate on the
// player's picks; this file holds the gate vocabulary, the evaluator the game
// runs after every click, and the checks the border and the editor share.
// DOM-free, fetch-free, no work at import time — node runs it too.

// NEW: the gate vocabulary. label = what the editor's kind dropdown says,
// holds = what the engine runs. `never` is border-only: what a gate becomes
// when its thing or row no longer exists — the interior never sees a
// dangling id, it sees never. The editor's dropdown skips it (borderOnly).
export const GATES = {
  always:      { label: "Always",                       holds: () => true },
  thingPicked: { label: "A thing is picked…",           holds: (gate, picks) => picks.thingPicked(gate.thing) },
  anyInRow:    { label: "Anything in a row is picked…", holds: (gate, picks) => picks.anyInRow(gate.row) },
  never:       { label: "(never — broken reference)",   holds: () => false, borderOnly: true }
}
// the kinds an author may choose, as dropdown options
export const SHOW_WHEN_KINDS = Object.entries(GATES)
  .filter(([, gate]) => !gate.borderOnly)
  .map(([value, gate]) => ({ value, label: gate.label }))

// NEW: a kind that came from a FILE is looked up as an OWN property. A plain
// object inherits "toString", "constructor" and friends from Object.prototype,
// so GATES["toString"] is a function, not a gate — a hand-edited kind with one
// of those names would slip past the border and crash the evaluator. Own-
// property lookup makes every unknown kind unknown, whatever it is called.
const knownKind = (table, kind) => Object.hasOwn(table, kind)

// NEW: a row's id and every id nested inside it
export const idsBelow = (row) => [row.id, ...row.children.flatMap(idsBelow)]

// NEW: which rows are visible for these picks — a LEAST FIXPOINT.
// Start with nothing visible. A row becomes visible when its parent is
// visible (top level counts as visible) and its gate holds against picks in
// rows ALREADY visible. Repeat until a pass adds nothing. Gates are positive
// (a pick can only SHOW a row, never hide one), so the set only grows and the
// loop ends within rows+1 passes. Two rows that need each other ("A when
// anything in B", "B when anything in A") are never added — deterministic,
// no infinite loop, and honest: from a fresh game neither could ever get its
// first pick. Walk order cannot change the answer: a monotone fixpoint is unique.
// Total: an unknown kind counts as never, a missing selections key as no picks.
// (A "show when NOT picked" kind would break all of this: a pick could hide
// the very row it sits in, the set would stop growing monotonically, and two
// rows could flip each other forever. Negation is parked for v5.)
export const computeVisible = (rows, selections) => {
  const visible = new Set()
  const picksIn = (rowId) => selections[rowId] ?? []
  const picks = {
    thingPicked: (thingId) => [...visible].some(rowId => picksIn(rowId).some(item => item.id === thingId)),
    anyInRow:    (rowId)   => visible.has(rowId) && picksIn(rowId).length > 0
  }
  let grew = true
  while (grew) {
    grew = false
    const visit = (list, parentVisible) => list.forEach(row => {
      const gate = knownKind(GATES, row.showWhen.kind) ? GATES[row.showWhen.kind] : GATES.never
      if (parentVisible && !visible.has(row.id) && gate.holds(row.showWhen, picks)) {
        visible.add(row.id)
        grew = true
      }
      visit(row.children, visible.has(row.id))   // a hidden row hides its whole subtree
    })
    visit(rows, true)
  }
  return visible
}

// NEW: picks inside hidden rows are dropped (their cost comes back — spent is
// derived). A NEW object with the same keys in the same order; rows that stay
// visible keep the same array identity.
export const dropHidden = (selections, visible) =>
  Object.fromEntries(Object.entries(selections).map(([rowId, list]) => [rowId, visible.has(rowId) ? list : []]))

// NEW: why can this gate not be evaluated? null when it can. rowIds/thingIds
// are Sets of every id in the loaded files. Same message for the engine's
// warning and the editor's badge.
export const checkShowWhen = (row, rowIds, thingIds) => {
  const gate = row.showWhen
  if (!knownKind(GATES, gate.kind) || GATES[gate.kind].borderOnly) return `has an unknown kind "${gate.kind}"`
  if (gate.kind === "thingPicked" && !thingIds.has(gate.thing)) return `names a thing that does not exist (${gate.thing})`
  if (gate.kind === "anyInRow") {
    if (!rowIds.has(gate.row)) return `names a row that does not exist (${gate.row})`
    if (idsBelow(row).includes(gate.row)) return `waits for itself (or a row nested inside it)`
  }
  return null
}

// NEW (editor + oracle only): rows that can NEVER appear whatever the player
// does. Same fixpoint as computeVisible but over "could" instead of "did":
// anyInRow → its row is reachable AND offers at least one thing to pick;
// thingPicked → some reachable row offers that thing. offered = { rowId: [thingId] }.
// Cycles, self-gates and gates on things nobody shows all land here.
export const deadRows = (rows, offered) => {
  const reachable = new Set()
  const could = {
    always:      () => true,
    never:       () => false,
    anyInRow:    (gate) => reachable.has(gate.row) && (offered[gate.row] ?? []).length > 0,
    thingPicked: (gate) => [...reachable].some(rowId => (offered[rowId] ?? []).includes(gate.thing))
  }
  let grew = true
  while (grew) {
    grew = false
    const visit = (list, parentReachable) => list.forEach(row => {
      const test = knownKind(could, row.showWhen.kind) ? could[row.showWhen.kind] : could.never
      if (parentReachable && !reachable.has(row.id) && test(row.showWhen)) {
        reachable.add(row.id)
        grew = true
      }
      visit(row.children, reachable.has(row.id))
    })
    visit(rows, true)
  }
  const dead = new Set()
  const collect = (list) => list.forEach(row => { if (!reachable.has(row.id)) dead.add(row.id); collect(row.children) })
  collect(rows)
  return dead
}
