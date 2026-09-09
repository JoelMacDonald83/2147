// CHANGED: a missing file used to come back as the server's "File not found"
// page, which res.json() choked on with a confusing parse error. Now a bad
// status is a real error that names the url.
export const loadJSON = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.json()
}

// NEW: like loadJSON, but a MISSING file (404) comes back as null instead of
// throwing. Only types.json and things.json may be missing: a game saved
// before v3 has neither, and the set migration creates them. Any other bad
// status is still an error.
// CHANGED: a BOOK's files are optional the same way — loadBook below asks for
// all four through this one door, and null is its answer for "not on the shelf".
export const loadOptionalJSON = async (url) => {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.json()
}

// NEW: one pinned book, from a base url ("books/basic/1/" — page-relative in the
// engine, so a published folder would resolve it beside index.html; the editor
// passes "/books/basic/1/" because it lives at /dinoEdit/ and is never exported).
//
// Three rules live in these two lines:
//   1. book.json missing (404) → the WHOLE layer is null. A loader never throws
//      for a missing book and never invents a half-book: the merge meets a null
//      in that slot and names the pin that asked for it (fault F1). Deciding
//      here would mean the engine, the editor and the server each writing their
//      own sentence for the same missing folder.
//   2. The three data files are OPTIONAL (404 → null): "this book has none of
//      that". Basic and Stats ship only book.json + types.json.
//   3. Book files are NOT migrated. They are born at SCHEMA_VERSION and stay
//      there (an edition is never edited; a new edition is a new folder), so a
//      wrong version is a fault the merge reports (F2b), not a climb to make.
//
// The four fetches are issued in map order — the map callback runs to its first
// await synchronously — so the urls a book asks for are always
// book, types, things, proposals (what oracles C4/S7 pin).
export const loadBook = async (base, pin) => {
  const [manifest, types, things, proposals] = await Promise.all(
    ["book", "types", "things", "proposals"].map(file => loadOptionalJSON(`${base}${file}.json`))
  )
  return manifest === null ? null : { pin, manifest, types, things, proposals }
}


// Flattens a group tree into one list: every group, at every depth.
export const flattenGroups = (groups) => {
  const flat = []
  groups.forEach(group => {
    flat.push(group)
    flat.push(...flattenGroups(group.children))
  })
  return flat
}
