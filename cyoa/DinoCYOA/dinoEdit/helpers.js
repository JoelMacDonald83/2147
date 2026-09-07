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
export const loadOptionalJSON = async (url) => {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.json()
}
