export const loadJSON = async (url) => {
  const res = await fetch(url)
  return res.json()
}