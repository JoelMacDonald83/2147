export const loadJSON = async (url) => {
  const res = await fetch(url)
  return res.json()
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